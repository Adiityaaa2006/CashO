package com.casho.companion.service

import com.casho.companion.model.BatchIngestItemResult
import com.casho.companion.model.BatchIngestRequest
import com.casho.companion.model.BatchIngestResponse
import com.casho.companion.model.IngestItemPayload
import com.google.gson.Gson
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.security.MessageDigest
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.TimeUnit
import java.util.regex.Pattern

data class TransactionPreview(
    val amount: Double?,
    val currency: String = "INR",
    val transactionType: String?,
    val merchantCandidate: String?,
    val dateCandidate: String?,
    val isAmbiguous: Boolean
)

sealed class ManualImportResult {
    data class Success(
        val status: String, // "inserted", "duplicate", "review_queue", "skipped"
        val transactionId: Int?,
        val duplicateOfId: Int?,
        val reviewId: Int?,
        val reason: String?,
        val summaryText: String
    ) : ManualImportResult()

    data class AuthError(val message: String) : ManualImportResult()
    data class NetworkError(val message: String) : ManualImportResult()
    data class ValidationError(val message: String) : ManualImportResult()
}

object ManualImportHelper {

    const val MAX_MESSAGE_LENGTH = 2000

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    private val gson = Gson()

    private val isoFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }

    /**
     * Parse safe local preview without fabricating any missing fields.
     */
    fun parsePreview(rawText: String): TransactionPreview {
        val trimmed = rawText.trim()
        if (trimmed.isEmpty()) {
            return TransactionPreview(
                amount = null,
                transactionType = null,
                merchantCandidate = null,
                dateCandidate = null,
                isAmbiguous = true
            )
        }

        val amount = extractAmount(trimmed)
        val transactionType = extractDirection(trimmed)
        val merchant = extractMerchantCandidate(trimmed)
        val dateCandidate = extractDateCandidate(trimmed)

        val isAmbiguous = amount == null || transactionType == null || transactionType == "UNKNOWN"

        return TransactionPreview(
            amount = amount,
            currency = "INR",
            transactionType = transactionType,
            merchantCandidate = merchant,
            dateCandidate = dateCandidate,
            isAmbiguous = isAmbiguous
        )
    }

    private fun extractAmount(text: String): Double? {
        val anchorPattern = Pattern.compile(
            """(?:amount|paid|debited|credited|spent|added|total|order value|txn amt|rs\.?|inr|₹)\s*[:\-]?\s*(?:rs\.?|inr|₹|\$|usd)?\s*([0-9]+(?:,[0-9]+)*(?:\.[0-9]{1,2})?)(?![a-zA-Z0-9])""",
            Pattern.CASE_INSENSITIVE
        )
        val m1 = anchorPattern.matcher(text)
        if (m1.find()) {
            val numStr = m1.group(1)?.replace(",", "")
            numStr?.toDoubleOrNull()?.let { if (it > 0) return it }
        }

        val fallbackPattern = Pattern.compile(
            """(?:Rs\.?|INR|₹)\s*([0-9]+(?:,[0-9]+)*(?:\.[0-9]{1,2})?)(?![a-zA-Z0-9])""",
            Pattern.CASE_INSENSITIVE
        )
        val m2 = fallbackPattern.matcher(text)
        if (m2.find()) {
            val numStr = m2.group(1)?.replace(",", "")
            return numStr?.toDoubleOrNull()
        }

        return null
    }

    private fun extractDirection(text: String): String? {
        val lower = text.lowercase(Locale.ROOT)

        if (Pattern.compile("""\b(?:failed|declined|unsuccessful|cancelled|canceled|rejected|could not be processed)\b""").matcher(lower).find()) {
            return "FAILED"
        }
        if (Pattern.compile("""\b(?:refund|reversed|reversal|refunded|cashback)\b""").matcher(lower).find()) {
            return "REFUND"
        }
        if (Pattern.compile("""\b(?:credited\s+(?:to|with|in)|has\s+been\s+credited|deposited|added\s+to|money\s+added|received\s+from|salary\s+credited)\b""").matcher(lower).find()) {
            return "CREDIT"
        }
        if (Pattern.compile("""\b(?:debited\s+(?:from|by|with)|has\s+been\s+debited|paid\s+(?:to|for|at|online)|spent\s+(?:on|at)|withdrawn|sent\s+to|transferred\s+to)\b""").matcher(lower).find()) {
            return "DEBIT"
        }
        if (Pattern.compile("""\b(?:credited|added)\b""").matcher(lower).find()) {
            return "CREDIT"
        }
        if (Pattern.compile("""\b(?:debited|paid|spent|withdrawn)\b""").matcher(lower).find()) {
            return "DEBIT"
        }

        return null
    }

    private fun extractMerchantCandidate(text: String): String? {
        // Look for common merchant anchors
        val anchorPattern = Pattern.compile(
            """(?:at|to|for|vpa|paid to|sent to)\s+([A-Za-z0-9\s&.\-_]{2,30})""",
            Pattern.CASE_INSENSITIVE
        )
        val matcher = anchorPattern.matcher(text)
        if (matcher.find()) {
            val candidate = matcher.group(1)?.trim()
            if (!candidate.isNullOrBlank() && !candidate.equals("a/c", ignoreCase = true) && !candidate.equals("your", ignoreCase = true)) {
                return candidate.take(30)
            }
        }
        return null
    }

    private fun extractDateCandidate(text: String): String? {
        val pattern = Pattern.compile(
            """\b([0-9]{1,2}[-/][0-9]{1,2}[-/][0-9]{2,4})\b|\b([0-9]{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*,?\s*[0-9]{2,4})\b""",
            Pattern.CASE_INSENSITIVE
        )
        val matcher = pattern.matcher(text)
        if (matcher.find()) {
            return matcher.group(0)?.trim()
        }
        return null
    }

    /**
     * Normalize message text by standardizing whitespace and trimming.
     * Ensures consistent hash generation across retries regardless of whitespace variations.
     */
    fun normalizeMessageText(rawText: String): String {
        return rawText.replace(Regex("\\s+"), " ").trim()
    }

    /**
     * Generate deterministic external ID based on normalized text hash to ensure idempotency.
     * Clearly prefixed with "manual_" so it is distinguishable from genuine bank references.
     */
    fun generateDeterministicExternalId(rawText: String): String {
        val normalized = normalizeMessageText(rawText)
        val digest = MessageDigest.getInstance("SHA-256")
        val hashBytes = digest.digest(normalized.toByteArray(Charsets.UTF_8))
        val hexString = hashBytes.take(16).joinToString("") { "%02x".format(it) }
        return "manual_$hexString"
    }

    /**
     * Submit manual SMS text to the backend endpoint using the existing companion auth.
     */
    suspend fun submitManualImport(
        serverUrl: String,
        apiKey: String,
        rawText: String
    ): ManualImportResult = withContext(Dispatchers.IO) {
        val trimmed = rawText.trim()
        if (trimmed.isEmpty()) {
            return@withContext ManualImportResult.ValidationError("Message text cannot be empty.")
        }
        if (trimmed.length > MAX_MESSAGE_LENGTH) {
            return@withContext ManualImportResult.ValidationError(
                "Message exceeds maximum size limit of $MAX_MESSAGE_LENGTH characters (current: ${trimmed.length})."
            )
        }
        if (apiKey.isBlank()) {
            return@withContext ManualImportResult.AuthError("Companion API Key is not set. Please configure it in Connection Settings.")
        }

        val normalizedUrl = serverUrl.trim().trimEnd('/')
        val endpoint = "$normalizedUrl/api/sync/android/ingest"
        val externalId = generateDeterministicExternalId(trimmed)

        val payload = BatchIngestRequest(
            items = listOf(
                IngestItemPayload(
                    text = trimmed,
                    source = "android",
                    external_id = externalId,
                    timestamp = isoFormat.format(Date())
                )
            )
        )

        val jsonBody = gson.toJson(payload)
        val requestBody = jsonBody.toRequestBody("application/json".toMediaType())

        val request = Request.Builder()
            .url(endpoint)
            .addHeader("Authorization", "Bearer $apiKey")
            .post(requestBody)
            .build()

        try {
            client.newCall(request).execute().use { response ->
                when (response.code) {
                    200 -> {
                        val bodyString = response.body?.string() ?: ""
                        val batchResponse = gson.fromJson(bodyString, BatchIngestResponse::class.java)
                        val itemResult = batchResponse?.results?.firstOrNull()
                        val status = itemResult?.status ?: when {
                            (batchResponse?.inserted ?: 0) > 0 -> "inserted"
                            (batchResponse?.duplicates ?: 0) > 0 -> "duplicate"
                            (batchResponse?.review_queue ?: 0) > 0 -> "review_queue"
                            else -> "skipped"
                        }

                        val summaryText = when (status) {
                            "inserted" -> "Transaction confirmed and added to ledger (ID: #${itemResult?.transaction_id ?: "New"})."
                            "duplicate" -> "Transaction already exists (Duplicate of ID: #${itemResult?.duplicate_of_id ?: itemResult?.transaction_id ?: "Existing"})."
                            "review_queue" -> "Ambiguous or incomplete transaction routed to CashO Review Queue (Review ID: #${itemResult?.review_id ?: "Pending"}). Reason: ${itemResult?.reason ?: "Needs user verification"}."
                            else -> "Message processed with status: $status (${itemResult?.reason ?: "Skipped"})."
                        }

                        ManualImportResult.Success(
                            status = status,
                            transactionId = itemResult?.transaction_id,
                            duplicateOfId = itemResult?.duplicate_of_id,
                            reviewId = itemResult?.review_id,
                            reason = itemResult?.reason,
                            summaryText = summaryText
                        )
                    }
                    401 -> ManualImportResult.AuthError("Unauthorized (HTTP 401). Please verify your Companion API Key.")
                    403 -> ManualImportResult.AuthError("Forbidden (HTTP 403). Companion authorization rejected.")
                    422 -> ManualImportResult.ValidationError("Validation error: Invalid request payload format.")
                    else -> ManualImportResult.NetworkError("Server returned HTTP ${response.code}: ${response.message}")
                }
            }
        } catch (e: Exception) {
            ManualImportResult.NetworkError("Connection failed: ${e.localizedMessage ?: e.javaClass.simpleName}")
        }
    }
}
