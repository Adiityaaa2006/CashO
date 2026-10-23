package com.casho.companion.filter

import java.util.Locale
import java.util.regex.Pattern

data class FilterEvaluation(
    val isAccepted: Boolean,
    val rejectionReason: String? = null,
    val extractedAmount: Double? = null,
    val transactionDirection: String? = null
)

object PaymentSmsFilter {

    private val BANK_SENDER_PATTERN = Pattern.compile(
        "(?i)(?:[A-Z]{2}-)?(HDFC|SBI|ICICI|AXIS|KOTAK|PNB|BOB|CANARA|YESBK|YESBNK|INDUS|UNIONB|PAYTM|GPAY|PHONEPE|CRED|AMAZON|BHIM|SLICE|JIOFIN|IDFC|FEDBNK|AUBANK)"
    )

    // Negative 1: OTP / Verification codes
    private val OTP_PATTERN = Pattern.compile(
        """\b(?:otp|one\s*time\s*password|verification\s*code|security\s*code|secret\s*code|auth\s*code|login\s*code|do\s*not\s*share|never\s*share|is\s*your\s*otp)\b""",
        Pattern.CASE_INSENSITIVE
    )

    // Negative 2: Promotional / Spam / Loans / Scratch cards / Lotteries / Discounts
    private val PROMO_PATTERN = Pattern.compile(
        """\b(?:loan\s*offer|pre-?approved|apply\s*now|congratulations\s*you\s*won|you\s*can\s*win|chance\s*to\s*win|win\s*up\s*to|cashback\s*scratch\s*card|scratch\s*card|flat\s*\d+%\s*off|discount\s*coupon|voucher|claim\s*your|use\s*code|promo\s*code|click\s*here|click\s*to\s*claim|exclusive\s*deal|hurry|limited\s*period\s*offer|kyc\s*suspended|account\s*blocked\s*click)\b""",
        Pattern.CASE_INSENSITIVE
    )

    // Negative 3: Logistics / E-commerce tracking
    private val DELIVERY_PATTERN = Pattern.compile(
        """\b(?:out\s*for\s*delivery|will\s*arrive|arriving\s*today|arriving\s*tomorrow|package\s*delivered|shipment\s*dispatched|courier|driver\s*is\s*on\s*the\s*way)\b""",
        Pattern.CASE_INSENSITIVE
    )

    // Negative 4: Uncompleted Payment Requests / Mandates / Future Promises
    private val UNCOMPLETED_PATTERN = Pattern.compile(
        """\b(?:requested\s*(?:rs|inr|₹|money)|has\s*requested|requesting\s*money|collect\s*request|mandate\s*(?:created|requested|pending)|will\s*send|will\s*transfer|promise\s*to\s*pay|promising\s*to\s*pay|bill\s*is\s*due|due\s*date|payment\s*reminder)\b""",
        Pattern.CASE_INSENSITIVE
    )

    // Negative 5: Failed / Declined / Cancelled
    private val FAILED_PATTERN = Pattern.compile(
        """\b(?:failed|declined|unsuccessful|cancelled|canceled|rejected|could\s*not\s*be\s*processed|payment\s*was\s*not\s*successful|failed\s*to\s*debit)\b""",
        Pattern.CASE_INSENSITIVE
    )

    // Positive 1: Financial Currency Amount Pattern
    private val AMOUNT_PATTERN = Pattern.compile(
        """(?:Rs\.?|INR|₹|\$)\s*([0-9]+(?:,[0-9]+)*(?:\.[0-9]{1,2})?)""",
        Pattern.CASE_INSENSITIVE
    )

    // Positive 2: Completed Transaction Verbs & Confirmation Phrases
    private val TRANSACTION_CONFIRMATION_PATTERN = Pattern.compile(
        """(?i)\b(?:credited\s*(?:to|with|in)|has\s*been\s*credited|deposited|debited\s*(?:from|by|with)|has\s*been\s*debited|withdrawn|paid\s*(?:to|for|at|online)?|payment\s*(?:to|for|at|successful\s*for|made\s*to|of\s*(?:rs\.?|inr|₹)?\s*[\d,]+(?:\.\d{1,2})?\s*to)|spent\s*(?:on|at)|transferred\s*to|you\s*sent|sent\s*to|received\s*(?:rs\.?|inr|₹)?\s*[\d,]+(?:\.\d{1,2})?\s*from|payment\s*received\s*from|[a-zA-Z0-9&\.\-_]+\s*(?:has\s*)?sent\s*you\s*(?:rs\.?|inr|₹)?\s*[\d,]+|refund\s*(?:of|credited|processed)|reversed|reversal|upi\s*transaction\s*successful\s*for|upi\s*txn\s*successful)\b"""
    )

    /**
     * Determine whether an SMS is a genuine completed payment/banking alert.
     * Rejects OTPs, promotional content, delivery tracking, payment requests,
     * failed transactions, and personal chat.
     */
    fun isPaymentSms(sender: String, body: String): Boolean {
        return evaluate(sender, body).isAccepted
    }

    /**
     * Fully evaluate message and return structured decision with reason.
     */
    fun evaluate(sender: String, body: String): FilterEvaluation {
        val trimmedBody = body.trim()
        if (trimmedBody.isEmpty()) {
            return FilterEvaluation(false, "REJECTED_EMPTY")
        }
        if (trimmedBody.length > 2000) {
            return FilterEvaluation(false, "REJECTED_OVERSIZED")
        }

        // 1. Negative Check: OTPs & Authentication (Never upload auth codes)
        if (OTP_PATTERN.matcher(trimmedBody).find()) {
            return FilterEvaluation(false, "REJECTED_OTP")
        }

        // 2. Negative Check: Promotional / Loans / Spams
        if (PROMO_PATTERN.matcher(trimmedBody).find()) {
            return FilterEvaluation(false, "REJECTED_PROMOTIONAL")
        }

        // 3. Negative Check: Logistics / Deliveries
        if (DELIVERY_PATTERN.matcher(trimmedBody).find()) {
            return FilterEvaluation(false, "REJECTED_DELIVERY_TRACKING")
        }

        // 4. Negative Check: Payment Requests, Mandates, Future Promises
        if (UNCOMPLETED_PATTERN.matcher(trimmedBody).find()) {
            return FilterEvaluation(false, "REJECTED_NOT_COMPLETED")
        }

        // 5. Negative Check: Failed / Declined payments
        if (FAILED_PATTERN.matcher(trimmedBody).find()) {
            return FilterEvaluation(false, "REJECTED_FAILED_PAYMENT")
        }

        // 6. Currency Amount Check
        val amountMatcher = AMOUNT_PATTERN.matcher(trimmedBody)
        if (!amountMatcher.find()) {
            return FilterEvaluation(false, "REJECTED_NO_AMOUNT")
        }
        val amount = amountMatcher.group(1)?.replace(",", "")?.toDoubleOrNull()
        if (amount == null || amount <= 0.0) {
            return FilterEvaluation(false, "REJECTED_INVALID_AMOUNT")
        }

        // 7. Transaction Confirmation Check
        if (!TRANSACTION_CONFIRMATION_PATTERN.matcher(trimmedBody).find()) {
            return FilterEvaluation(false, "REJECTED_NO_CONFIRMATION_VERB")
        }

        // 8. Personal Conversation Check:
        // If sender is a 10-digit mobile number (+91 / 0-9), verify it's not personal chat
        val isNumericSender = sender.replace("+", "").replace("-", "").all { it.isDigit() }
        val senderMatchesBank = BANK_SENDER_PATTERN.matcher(sender).find() || (sender.length in 6..9 && !isNumericSender)

        if (isNumericSender && !senderMatchesBank) {
            // Must have unmistakable P2P transfer confirmation structure
            val hasFormalP2PStructure = Pattern.compile(
                """(?i)(?:sent\s*you\s*(?:rs\.?|inr|₹)|received\s*(?:rs\.?|inr|₹)?\s*[\d,]+\s*from|upi\s*ref|rrn|txn\s*id|credited\s*to\s*(?:your\s*)?a/c|debited\s*from\s*(?:your\s*)?a/c)"""
            ).matcher(trimmedBody).find()

            if (!hasFormalP2PStructure) {
                return FilterEvaluation(false, "REJECTED_PERSONAL_CONVERSATION")
            }
        }

        // Determine preliminary direction
        val lower = trimmedBody.lowercase(Locale.ROOT)
        val direction = when {
            Pattern.compile("""\b(?:refund|reversed|reversal)\b""").matcher(lower).find() -> "CREDIT"
            Pattern.compile("""\b(?:credited|deposited|sent\s*you|received\s*from)\b""").matcher(lower).find() -> "CREDIT"
            Pattern.compile("""\b(?:debited|paid|spent|withdrawn|you\s*sent|transferred\s*to)\b""").matcher(lower).find() -> "DEBIT"
            else -> "UNKNOWN"
        }

        return FilterEvaluation(
            isAccepted = true,
            extractedAmount = amount,
            transactionDirection = direction
        )
    }
}
