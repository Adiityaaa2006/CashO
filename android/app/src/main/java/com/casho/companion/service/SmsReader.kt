package com.casho.companion.service

import android.content.Context
import android.net.Uri
import android.provider.Telephony
import com.casho.companion.model.SmsMessageItem

class SmsReader(private val context: Context) {

    // Bank and financial sender patterns common in India (e.g. VK-HDFCBK, AX-SBIINB, SWIGGY)
    private val bankSenderRegex = Regex(
        "(?i)(HDFC|SBI|ICICI|AXIS|KOTAK|PNB|BOB|CANARA|YESBK|INDUS|UNIONB|PAYTM|GPAY|PHONEPE|CRED|AMAZON|SWIGGY|ZOMATO|FLIPKART)"
    )

    // Financial transaction intent patterns
    private val financialBodyKeywords = listOf(
        "debited", "credited", "spent", "withdrawn", "paid", "transferred",
        "inr", "rs.", "rs ", "txn", "vpa", "upi ref", "card ending"
    )

    /**
     * Read bank transactional SMS messages newer than the given timestamp.
     */
    fun readFinancialSms(sinceTimestamp: Long = 0L, limit: Int = 100): List<SmsMessageItem> {
        val messages = mutableListOf<SmsMessageItem>()
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
                    val id = it.getString(idCol)
                    val sender = it.getString(addressCol) ?: ""
                    val body = it.getString(bodyCol) ?: ""
                    val date = it.getLong(dateCol)

                    if (isFinancialMessage(sender, body)) {
                        messages.add(
                            SmsMessageItem(
                                id = id,
                                sender = sender,
                                body = body,
                                timestamp = date
                            )
                        )
                    }
                }
            }
        } catch (e: SecurityException) {
            // Permission not granted
        }

        return messages
    }

    private fun isFinancialMessage(sender: String, body: String): Boolean {
        val lowerBody = body.lowercase()
        // 1. Must contain financial keywords
        val hasFinancialKeywords = financialBodyKeywords.any { lowerBody.contains(it) }
        if (!hasFinancialKeywords) return false

        // 2. Either sender matches known bank/payment gateway, or contains standard bank headers
        val senderMatchesBank = bankSenderRegex.containsMatchIn(sender) || sender.length >= 6
        return senderMatchesBank
    }
}
