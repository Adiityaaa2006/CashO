package com.casho.companion.service

import android.content.Context
import android.content.SharedPreferences

class SyncRepository(context: Context) {

    private val prefs: SharedPreferences = context.getSharedPreferences("casho_companion_prefs", Context.MODE_PRIVATE)

    var serverUrl: String
        get() = prefs.getString("server_url", "http://10.0.2.2:8000") ?: "http://10.0.2.2:8000"
        set(value) = prefs.edit().putString("server_url", value.trim().trimEnd('/')).apply()

    var apiKey: String
        get() = prefs.getString("api_key", "") ?: ""
        set(value) = prefs.edit().putString("api_key", value.trim()).apply()

    var lastSyncTimestamp: Long
        get() = prefs.getLong("last_sync_timestamp", 0L)
        set(value) = prefs.edit().putLong("last_sync_timestamp", value).apply()

    var isAutoSyncEnabled: Boolean
        get() = prefs.getBoolean("auto_sync_enabled", false)
        set(value) = prefs.edit().putBoolean("auto_sync_enabled", value).apply()

    /**
     * Clear master toggle to enable or disable SMS reading and synchronization.
     * When false, background sync will abort without reading SMS.
     */
    var isSmsSyncEnabled: Boolean
        get() = prefs.getBoolean("sms_sync_enabled", false)
        set(value) = prefs.edit().putBoolean("sms_sync_enabled", value).apply()

    var lastSyncStatus: String
        get() = prefs.getString("last_sync_status", "Never synced") ?: "Never synced"
        set(value) = prefs.edit().putString("last_sync_status", value).apply()

    var lastDetectedCount: Int
        get() = prefs.getInt("last_detected_count", 0)
        set(value) = prefs.edit().putInt("last_detected_count", value).apply()

    var lastUploadedCount: Int
        get() = prefs.getInt("last_uploaded_count", 0)
        set(value) = prefs.edit().putInt("last_uploaded_count", value).apply()

    var lastSkippedCount: Int
        get() = prefs.getInt("last_skipped_count", 0)
        set(value) = prefs.edit().putInt("last_skipped_count", value).apply()

    var lastDuplicateCount: Int
        get() = prefs.getInt("last_duplicate_count", 0)
        set(value) = prefs.edit().putInt("last_duplicate_count", value).apply()

    var lastReviewCount: Int
        get() = prefs.getInt("last_review_count", 0)
        set(value) = prefs.edit().putInt("last_review_count", value).apply()
}
