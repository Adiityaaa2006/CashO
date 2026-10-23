package com.casho.companion.service

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
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
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.TimeUnit

class SyncWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    private val repository = SyncRepository(appContext)
    private val smsReader = SmsReader(appContext)
    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()
    private val gson = Gson()
    private val isoFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        // 1. Check if user enabled SMS synchronization
        if (!repository.isSmsSyncEnabled) {
            repository.lastSyncStatus = "Idle: SMS synchronization is disabled in settings"
            return@withContext Result.success()
        }

        // 2. Check runtime permission (never read without user consent)
        val hasPermission = ContextCompat.checkSelfPermission(
            applicationContext,
            Manifest.permission.READ_SMS
        ) == PackageManager.PERMISSION_GRANTED

        if (!hasPermission) {
            repository.lastSyncStatus = "Failed: READ_SMS permission is not granted"
            return@withContext Result.failure()
        }

        // 3. Check API Key
        val serverUrl = repository.serverUrl
        val apiKey = repository.apiKey
        if (apiKey.isBlank()) {
            repository.lastSyncStatus = "Failed: Companion API key not configured"
            return@withContext Result.failure()
        }

        // 4. Scan financial messages locally
        val sinceTimestamp = repository.lastSyncTimestamp
        val messages = smsReader.readFinancialSms(sinceTimestamp = sinceTimestamp, limit = 50)
        repository.lastDetectedCount = messages.size
        repository.lastSkippedCount = smsReader.lastScanSkippedMessages

        if (messages.isEmpty()) {
            val timeStr = SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date())
            repository.lastSyncStatus = "Synced at $timeStr (0 new payment messages detected)"
            return@withContext Result.success()
        }

        // 5. Build payload
        val payloadItems = messages.map { msg ->
            IngestItemPayload(
                text = msg.body,
                source = "android",
                external_id = "sms_${msg.id}",
                timestamp = isoFormat.format(Date(msg.timestamp))
            )
        }

        val batchRequest = BatchIngestRequest(items = payloadItems)
        val jsonBody = gson.toJson(batchRequest)
        val requestBody = jsonBody.toRequestBody("application/json".toMediaType())

        // Ingest as review candidates so dashboard totals require user confirmation
        val endpointUrl = "$serverUrl/api/sync/android/ingest?review_mode=true"
        val request = Request.Builder()
            .url(endpointUrl)
            .addHeader("Authorization", "Bearer $apiKey")
            .post(requestBody)
            .build()

        try {
            client.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    val responseBody = response.body?.string()
                    val batchResponse = gson.fromJson(responseBody, BatchIngestResponse::class.java)

                    val maxTimestamp = messages.maxOf { it.timestamp }
                    repository.lastSyncTimestamp = maxTimestamp
                    repository.lastUploadedCount = messages.size
                    repository.lastDuplicateCount = batchResponse?.duplicates ?: 0
                    repository.lastReviewCount = batchResponse?.review_queue ?: 0

                    val timeStr = SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date())
                    repository.lastSyncStatus = "Synced at $timeStr: ${batchResponse?.review_queue ?: 0} candidates in review, ${batchResponse?.duplicates ?: 0} duplicates"
                    Result.success()
                } else {
                    val errorMsg = "HTTP ${response.code}: ${response.message}"
                    repository.lastSyncStatus = "Sync error: $errorMsg"
                    Result.retry()
                }
            }
        } catch (e: Exception) {
            repository.lastSyncStatus = "Sync failed: ${e.localizedMessage ?: e.javaClass.simpleName}"
            Result.retry()
        }
    }
}
