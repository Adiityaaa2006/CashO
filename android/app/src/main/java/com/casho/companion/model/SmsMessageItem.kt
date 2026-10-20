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

data class BatchIngestResponse(
    val total_received: Int,
    val inserted: Int,
    val duplicates: Int,
    val review_queue: Int,
    val skipped: Int
)
