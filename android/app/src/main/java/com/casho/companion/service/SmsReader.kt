package com.casho.companion.service

import android.content.Context
import android.net.Uri
import android.provider.Telephony
import com.casho.companion.filter.PaymentSmsFilter
import com.casho.companion.model.SmsMessageItem

class SmsReader(private val context: Context) {

    var lastScanTotalMessages: Int = 0
        private set
    var lastScanAcceptedMessages: Int = 0
        private set
    var lastScanSkippedMessages: Int = 0
        private set

    /**
     * Read bank transactional SMS messages newer than the given timestamp.
     * Evaluates messages locally using PaymentSmsFilter. Never transmits OTPs or personal texts.
     */
    fun readFinancialSms(sinceTimestamp: Long = 0L, limit: Int = 100): List<SmsMessageItem> {
        val messages = mutableListOf<SmsMessageItem>()
        lastScanTotalMessages = 0
        lastScanAcceptedMessages = 0
        lastScanSkippedMessages = 0

        val uri: Uri = Telephony.Sms.Inbox.CONTENT_URI
        val projection = arrayOf(
            Telephony.Sms._ID,
            Telephony.Sms.ADDRESS,
            Telephony.Sms.BODY,
            Telephony.Sms.DATE
        )

        val selection = "${Telephony.Sms.DATE} > ?"
        val selectionArgs = arrayOf(sinceTimestamp.toString())
        val sortOrder = "${Telephony.Sms.DATE} ASC"

        try {
            val cursor = context.contentResolver.query(
                uri,
                projection,
                selection,
                selectionArgs,
                sortOrder
            )

            cursor?.use {
                val idCol = it.getColumnIndexOrThrow(Telephony.Sms._ID)
                val addressCol = it.getColumnIndexOrThrow(Telephony.Sms.ADDRESS)
                val bodyCol = it.getColumnIndexOrThrow(Telephony.Sms.BODY)
                val dateCol = it.getColumnIndexOrThrow(Telephony.Sms.DATE)

                while (it.moveToNext() && messages.size < limit) {
                    lastScanTotalMessages++
                    val id = it.getString(idCol)
                    val sender = it.getString(addressCol) ?: ""
                    val body = it.getString(bodyCol) ?: ""
                    val date = it.getLong(dateCol)

                    if (PaymentSmsFilter.isPaymentSms(sender, body)) {
                        lastScanAcceptedMessages++
                        messages.add(
                            SmsMessageItem(
                                id = id,
                                sender = sender,
                                body = body,
                                timestamp = date
                            )
                        )
                    } else {
                        lastScanSkippedMessages++
                    }
                }
            }
        } catch (e: SecurityException) {
            // Permission not granted or revoked at runtime
        } catch (e: Exception) {
            // General query error
        }

        return messages
    }
}
