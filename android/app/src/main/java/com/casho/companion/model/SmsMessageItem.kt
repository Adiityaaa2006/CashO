package com.casho.companion.model

data class SmsMessageItem(
    val id: String,
    val sender: String,
    val body: String,
    val timestamp: Long
)

data class BatchIngestRequest(
    val items: List<IngestItemPayload>
)

data class IngestItemPayload(
    val text: String,
    val source: String = "android",
    val external_id: String,
    val timestamp: String? = null
)

data class BatchIngestItemResult(
    val index: Int = 0,
    val status: String,
    val transaction_id: Int? = null,
    val duplicate_of_id: Int? = null,
    val review_id: Int? = null,
    val reason: String? = null
)

data class BatchIngestResponse(
    val total_received: Int,
    val inserted: Int,
    val duplicates: Int,
    val review_queue: Int,
    val skipped: Int,
    val results: List<BatchIngestItemResult>? = null
)
