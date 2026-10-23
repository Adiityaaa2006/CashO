package com.casho.companion.filter

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PaymentSmsFilterTest {

    @Test
    fun testIncomingFriendTransferIsCredit() {
        val sender = "AD-UPIBNK"
        val body = "Rahul sent you ₹50 via UPI on 21-10-2026. Ref: 9876543210"
        val evaluation = PaymentSmsFilter.evaluate(sender, body)

        assertTrue("Incoming friend transfer must be accepted", evaluation.isAccepted)
        assertEquals(50.0, evaluation.extractedAmount ?: 0.0, 0.01)
        assertEquals("CREDIT", evaluation.transactionDirection)
    }

    @Test
    fun testReceivedFromFriendIsCredit() {
        val sender = "VK-HDFCBK"
        val body = "You received Rs 50 from Rahul in your A/c XX1234. UPI Ref: 12345678"
        val evaluation = PaymentSmsFilter.evaluate(sender, body)

        assertTrue(evaluation.isAccepted)
        assertEquals(50.0, evaluation.extractedAmount ?: 0.0, 0.01)
        assertEquals("CREDIT", evaluation.transactionDirection)
    }

    @Test
    fun testBankCreditNotificationIsCredit() {
        val sender = "AX-SBIINB"
        val body = "Rs. 500 credited to your account ending 4321 on 20-Oct-26."
        val evaluation = PaymentSmsFilter.evaluate(sender, body)

        assertTrue(evaluation.isAccepted)
        assertEquals(500.0, evaluation.extractedAmount ?: 0.0, 0.01)
        assertEquals("CREDIT", evaluation.transactionDirection)
    }

    @Test
    fun testOutgoingFriendTransferIsDebit() {
        val sender = "VK-PAYTM"
        val body = "You sent Rahul ₹200 via Paytm UPI on 21-10-2026."
        val evaluation = PaymentSmsFilter.evaluate(sender, body)

        assertTrue(evaluation.isAccepted)
        assertEquals(200.0, evaluation.extractedAmount ?: 0.0, 0.01)
        assertEquals("DEBIT", evaluation.transactionDirection)
    }

    @Test
    fun testBankDebitNotificationIsDebit() {
        val sender = "JM-ICICIB"
        val body = "INR 250 debited from your account 1234 on 19-Oct-26 at Swiggy."
        val evaluation = PaymentSmsFilter.evaluate(sender, body)

        assertTrue(evaluation.isAccepted)
        assertEquals(250.0, evaluation.extractedAmount ?: 0.0, 0.01)
        assertEquals("DEBIT", evaluation.transactionDirection)
    }

    @Test
    fun testUpiPaymentConfirmationIsDebit() {
        val sender = "AD-GPAY"
        val body = "UPI transaction successful for Rs. 120 to Chai Point. UPI Ref: 48192841"
        val evaluation = PaymentSmsFilter.evaluate(sender, body)

        assertTrue(evaluation.isAccepted)
        assertEquals(120.0, evaluation.extractedAmount ?: 0.0, 0.01)
        assertEquals("DEBIT", evaluation.transactionDirection)
    }

    @Test
    fun testMerchantPaymentSuccessfulIsDebit() {
        val sender = "VM-AXISBK"
        val body = "Payment of ₹300 to ABC Store successful via UPI."
        val evaluation = PaymentSmsFilter.evaluate(sender, body)

        assertTrue(evaluation.isAccepted)
        assertEquals(300.0, evaluation.extractedAmount ?: 0.0, 0.01)
        assertEquals("DEBIT", evaluation.transactionDirection)
    }

    @Test
    fun testRefundNotificationIsCredit() {
        val sender = "BW-HDFCBK"
        val body = "Refund of Rs 200 credited to your account ending 8901 for Flipkart order."
        val evaluation = PaymentSmsFilter.evaluate(sender, body)

        assertTrue(evaluation.isAccepted)
        assertEquals(200.0, evaluation.extractedAmount ?: 0.0, 0.01)
        assertEquals("CREDIT", evaluation.transactionDirection)
    }

    @Test
    fun testOtpMessageFilteredOut() {
        val sender = "VK-HDFCBK"
        val body = "Your OTP is 123456 for transaction of Rs 500 at Merchant. Do not share with anyone."
        val evaluation = PaymentSmsFilter.evaluate(sender, body)

        assertFalse("OTPs must never be uploaded", evaluation.isAccepted)
        assertEquals("REJECTED_OTP", evaluation.rejectionReason)
    }

    @Test
    fun testPromotionalMessageFilteredOut() {
        val sender = "CP-PROMOS"
        val body = "Congratulations! You can win ₹10,000 cash prize. Click here to claim your loan offer."
        val evaluation = PaymentSmsFilter.evaluate(sender, body)

        assertFalse("Promotional SMS must be filtered out", evaluation.isAccepted)
        assertEquals("REJECTED_PROMOTIONAL", evaluation.rejectionReason)
    }

    @Test
    fun testDeliveryTrackingFilteredOut() {
        val sender = "EKART"
        val body = "Your order will arrive tomorrow. Courier package is out for delivery with pin 1234."
        val evaluation = PaymentSmsFilter.evaluate(sender, body)

        assertFalse("Delivery notifications must be filtered out", evaluation.isAccepted)
        assertEquals("REJECTED_DELIVERY_TRACKING", evaluation.rejectionReason)
    }

    @Test
    fun testPaymentRequestFilteredOut() {
        val sender = "VK-PAYTM"
        val body = "Rahul requested ₹50 from you via UPI. Pay or decline collect request."
        val evaluation = PaymentSmsFilter.evaluate(sender, body)

        assertFalse("Incomplete payment request must not be treated as a transaction", evaluation.isAccepted)
        assertEquals("REJECTED_NOT_COMPLETED", evaluation.rejectionReason)
    }

    @Test
    fun testFuturePromiseFilteredOut() {
        val sender = "+919876543210"
        val body = "Rahul will send you ₹50 tomorrow when salary arrives."
        val evaluation = PaymentSmsFilter.evaluate(sender, body)

        assertFalse("Future promise must be filtered out", evaluation.isAccepted)
    }

    @Test
    fun testFailedPaymentFilteredOut() {
        val sender = "JM-ICICIB"
        val body = "Payment of Rs 990 to Netflix failed due to technical decline."
        val evaluation = PaymentSmsFilter.evaluate(sender, body)

        assertFalse("Failed payments must not be uploaded as completed transactions", evaluation.isAccepted)
        assertEquals("REJECTED_FAILED_PAYMENT", evaluation.rejectionReason)
    }

    @Test
    fun testPersonalConversationFilteredOut() {
        val sender = "+919876543210"
        val body = "Hey bro can you give me ₹500 for dinner tonight?"
        val evaluation = PaymentSmsFilter.evaluate(sender, body)

        assertFalse("Ordinary personal conversations must not be uploaded", evaluation.isAccepted)
    }
}
