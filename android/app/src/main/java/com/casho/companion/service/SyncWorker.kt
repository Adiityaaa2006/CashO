package com.casho.companion.service

import android.content.Context
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
        val serverUrl = repository.serverUrl
        val apiKey = repository.apiKey

        if (apiKey.isBlank()) {
            repository.lastSyncStatus = "Failed: API key not set"
            return@withContext Result.failure()
        }

        val sinceTimestamp = repository.lastSyncTimestamp
        val messages = smsReader.readFinancialSms(sinceTimestamp = sinceTimestamp, limit = 50)

        if (messages.isEmpty()) {
            repository.lastSyncStatus = "Synced at ${SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date())} (0 new transactions)"
            return@withContext Result.success()
        }

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

        val request = Request.Builder()
            .url("$serverUrl/api/sync/android/ingest")
            .addHeader("Authorization", "Bearer $apiKey")
            .post(requestBody)
            .build()

        try {
            client.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    val responseBody = response.body?.string()
                    val batchResponse = gson.fromJson(responseBody, BatchIngestResponse::class.java)

                    // Advance cursor to latest message timestamp
                    val maxTimestamp = messages.maxOf { it.timestamp }
                    repository.lastSyncTimestamp = maxTimestamp
                    repository.lastSyncStatus = "Success: ${batchResponse?.inserted ?: 0} inserted, ${batchResponse?.duplicates ?: 0} duplicates"
                    Result.success()
                } else {
                    val errorMsg = "HTTP ${response.code}: ${response.message}"
                    repository.lastSyncStatus = "Sync error: $errorMsg"
                    Result.retry()
                }
            }
        } catch (e: Exception) {
            repository.lastSyncStatus = "Sync failed: ${e.localizedMessage}"
            Result.retry()
        }
    }
}
