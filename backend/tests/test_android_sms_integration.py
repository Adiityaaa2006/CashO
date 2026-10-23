import pytest
from datetime import datetime
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db.database import Base, get_db
from app.db.models import TransactionModel, ReviewQueueModel, SyncConnectionModel
from app.config import settings
from app.nlp.extractor import extract_amount, extract_transaction_type, extract_merchant_candidate
from app.services.pipeline import run_pipeline
from app.services.ingestion import ingest_message, ingest_batch


@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


# Requirement 1: Incoming ₹50 from a friend → CREDIT
def test_incoming_friend_transfer_is_credit():
    samples = [
        "Rahul sent you ₹50 via UPI on 21-10-2026. Ref: 9876543210",
        "You received Rs 50 from Rahul in your Account ending 1234. UPI Ref: 12345678",
        "Ankit sent you Rs. 50 via GPay"
    ]
    for text in samples:
        amt = extract_amount(text)
        direction = extract_transaction_type(text)
        assert amt == 50.0, f"Failed amount on '{text}'"
        assert direction == "CREDIT", f"Failed CREDIT classification on '{text}'"

    res = run_pipeline("Rahul sent you ₹50", source="android")
    assert res.transaction.amount == 50.0
    assert res.transaction.transaction_type == "CREDIT"
    assert res.transaction.merchant_normalized == "Rahul"


# Requirement 2: Outgoing ₹50 to a friend → DEBIT
def test_outgoing_friend_transfer_is_debit():
    samples = [
        "You sent Rahul ₹200 via Paytm UPI on 21-10-2026",
        "You paid ₹150 to ABC Store via UPI",
        "Sent Rs. 50 to Rohan via PhonePe"
    ]
    for text in samples:
        direction = extract_transaction_type(text)
        assert direction == "DEBIT", f"Failed DEBIT classification on '{text}'"

    res = run_pipeline("You sent Rahul ₹200", source="android")
    assert res.transaction.amount == 200.0
    assert res.transaction.transaction_type == "DEBIT"
    assert res.transaction.merchant_normalized == "Rahul"


# Requirement 3: Bank credit notification → CREDIT
def test_bank_credit_notification_is_credit():
    text = "Rs. 500 credited to your account ending 4321 on 20-Oct-26."
    assert extract_amount(text) == 500.0
    assert extract_transaction_type(text) == "CREDIT"

    res = run_pipeline("Your account has been credited by ₹1,000", source="android")
    assert res.transaction.amount == 1000.0
    assert res.transaction.transaction_type == "CREDIT"


# Requirement 4: Bank debit notification → DEBIT
def test_bank_debit_notification_is_debit():
    text = "INR 250 debited from your account 1234 on 19-Oct-26 at Swiggy."
    assert extract_amount(text) == 250.0
    assert extract_transaction_type(text) == "DEBIT"

    res = run_pipeline("Your account has been debited by ₹300", source="android")
    assert res.transaction.amount == 300.0
    assert res.transaction.transaction_type == "DEBIT"


# Requirement 5: UPI payment confirmation → correct direction
def test_upi_payment_confirmation():
    text1 = "UPI transaction successful for Rs. 120 to Chai Point. UPI Ref: 48192841"
    assert extract_amount(text1) == 120.0
    assert extract_transaction_type(text1) == "DEBIT"

    text2 = "Payment of ₹300 to ABC Store successful via UPI."
    assert extract_amount(text2) == 300.0
    assert extract_transaction_type(text2) == "DEBIT"


# Requirement 6: Refund notification → correct direction (CREDIT)
def test_refund_notification_is_credit():
    text = "Refund of Rs 200 credited to your account ending 8901 for Flipkart order."
    assert extract_amount(text) == 200.0
    # In NLP extractor it detects REFUND, and pipeline maps refund to CREDIT
    res = run_pipeline(text, source="android")
    assert res.transaction.amount == 200.0
    assert res.transaction.transaction_type == "CREDIT"
    assert res.metadata["is_refund"] is True


# Requirement 7: OTP containing 6-digit number → filtered out from confirmed transactions
def test_otp_not_completed_transaction(db_session):
    text = "Your OTP is 123456 for transaction of Rs 500 at Amazon. Do not share with anyone."
    # When ingested, OTP text does not have completed transaction verbs or is unconfirmed
    res = ingest_message(db_session, text, source="android")
    # Must not be inserted into confirmed ledger
    assert res["status"] != "inserted"
    assert db_session.query(TransactionModel).count() == 0


# Requirement 8: Promotional SMS containing currency amount → filtered out
def test_promotional_sms_filtered_out(db_session):
    text = "Congratulations! You can win ₹10,000 cash prize. Click here to claim your loan offer."
    res = ingest_message(db_session, text, source="android")
    assert res["status"] != "inserted"
    assert db_session.query(TransactionModel).count() == 0


# Requirement 9: Personal conversation mentioning currency → not recorded as confirmed transaction
def test_personal_conversation_not_confirmed(db_session):
    text = "Hey bro can you give me ₹500 for dinner tonight?"
    res = ingest_message(db_session, text, source="android")
    assert res["status"] != "inserted"
    assert db_session.query(TransactionModel).count() == 0


# Requirement 10: Failed payment → not recorded as a completed transaction
def test_failed_payment_not_completed(db_session):
    text = "Payment of Rs 990 to Netflix failed due to technical decline."
    assert extract_transaction_type(text) == "FAILED"
    res = ingest_message(db_session, text, source="android")
    assert res["status"] == "review_queue"
    assert res["reason"] == "failed_payment"
    assert db_session.query(TransactionModel).count() == 0


# Requirement 11: Payment request without completed transfer → not completed
def test_payment_request_without_transfer():
    text1 = "Rahul requested ₹50 from you via UPI. Pay or decline collect request."
    assert extract_transaction_type(text1) == "UNKNOWN"

    text2 = "Rahul will send you ₹50 tomorrow when salary arrives."
    assert extract_transaction_type(text2) == "UNKNOWN"


# Requirement 12: Ambiguous transaction → review required
def test_ambiguous_transaction_requires_review(db_session):
    text = "₹500 transaction with Rahul on 21-10-2026."
    res = ingest_message(db_session, text, source="android")
    assert res["status"] == "review_queue"
    assert "unsupported_type_unknown" in res["reason"] or res["reason"] == "incomplete_transaction"
    assert db_session.query(TransactionModel).count() == 0

    item = db_session.query(ReviewQueueModel).first()
    assert item is not None
    assert item.suggested_amount == 500.0
    assert item.suggested_transaction_type == "UNKNOWN"


# Requirement 13: SMS with multiple currency amounts → correct transaction amount selected
def test_multiple_amounts_selects_transaction_amount():
    text1 = "Avl Bal: Rs. 12,500.00. Account debited by Rs. 500.00."
    assert extract_amount(text1) == 500.0

    text2 = "A/c *1234 debited by INR 350.00 on 20-Oct-26. Clear Bal: INR 45,000.00."
    assert extract_amount(text2) == 350.0


# Requirement 14 & 15: Deduplication and retry idempotency
def test_duplicate_sms_and_retry_idempotency(client, db_session):
    headers = {"Authorization": f"Bearer {settings.ANDROID_API_KEY}"}
    payload = {
        "items": [
            {
                "text": "Rahul sent you ₹50 via UPI on 21-10-2026. Ref: 9876543210",
                "source": "android",
                "external_id": "sms_test_friend_50",
                "as_review": True
            }
        ]
    }

    # 1. First sync: creates review item
    res1 = client.post("/api/sync/android/ingest?review_mode=true", json=payload, headers=headers)
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["review_queue"] == 1
    assert data1["inserted"] == 0
    assert data1["duplicates"] == 0

    # 2. Retry sync: must be recognized as duplicate, 0 new items
    res2 = client.post("/api/sync/android/ingest?review_mode=true", json=payload, headers=headers)
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["duplicates"] == 1
    assert data2["review_queue"] == 0
    assert data2["inserted"] == 0

    # Total review queue items in DB must be exactly 1
    assert db_session.query(ReviewQueueModel).count() == 1


# Requirement 16 & 17: Ingestion with review_mode saves pending items and leaves dashboard totals untouched
def test_android_ingest_review_mode_and_dashboard_totals(client, db_session):
    headers = {"Authorization": f"Bearer {settings.ANDROID_API_KEY}"}
    payload = {
        "items": [
            {
                "text": "Rahul sent you ₹50 via UPI on 21-10-2026",
                "source": "android",
                "external_id": "sms_friend_50_review"
            }
        ]
    }

    res = client.post("/api/sync/android/ingest?review_mode=true", json=payload, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["review_queue"] == 1
    assert data["inserted"] == 0

    # Check that pending review item is prepared
    review_item = db_session.query(ReviewQueueModel).filter(ReviewQueueModel.external_id == "sms_friend_50_review").first()
    assert review_item is not None
    assert review_item.suggested_amount == 50.0
    assert review_item.suggested_transaction_type == "CREDIT"
    assert review_item.suggested_merchant == "Rahul"
    assert review_item.status == "pending"

    # Dashboard totals must be 0 until approved
    summary_res = client.get("/api/summary")
    summary = summary_res.json()
    assert summary["total_income"] == 0.0
    assert summary["total_spent"] == 0.0
    assert summary["transaction_count"] == 0


# Requirement 18: Existing Gmail transaction extraction still works
def test_gmail_ingestion_still_works(client, db_session):
    gmail_text = "Your Swiggy order confirmation. Total paid is Rs 450.00 on 10-10-2026 via Card"
    res = ingest_message(db_session, gmail_text, source="gmail", external_id="gmail_order_101")
    assert res["status"] == "inserted"
    tx = db_session.query(TransactionModel).filter(TransactionModel.external_id == "gmail_order_101").first()
    assert tx is not None
    assert tx.amount == 450.0
    assert tx.transaction_type == "DEBIT"


# Requirement 19: Approval preserves CREDIT/DEBIT and updates dashboard totals correctly
def test_approval_preserves_credit_and_updates_dashboard_totals(client, db_session):
    headers = {"Authorization": f"Bearer {settings.ANDROID_API_KEY}"}
    payload = {
        "items": [
            {
                "text": "Rahul sent you ₹50 via UPI on 21-10-2026",
                "source": "android",
                "external_id": "sms_friend_50_approve"
            }
        ]
    }

    # Ingest into review queue
    client.post("/api/sync/android/ingest?review_mode=true", json=payload, headers=headers)
    item = db_session.query(ReviewQueueModel).filter(ReviewQueueModel.external_id == "sms_friend_50_approve").first()
    assert item is not None
    assert item.suggested_transaction_type == "CREDIT"

    # User approves without having to manually change direction
    resolve_payload = {
        "action": "approve",
        "amount": item.suggested_amount,
        "transaction_type": item.suggested_transaction_type
    }
    resolve_res = client.post(f"/api/review/{item.id}/resolve", json=resolve_payload)
    assert resolve_res.status_code == 200
    assert resolve_res.json()["status"] == "approved"

    # Verify transaction in DB is CREDIT
    tx = db_session.query(TransactionModel).filter(TransactionModel.external_id == "sms_friend_50_approve").first()
    assert tx is not None
    assert tx.amount == 50.0
    assert tx.transaction_type == "CREDIT"
    assert tx.review_status == "approved"

    # Verify dashboard totals now reflect the CREDIT
    summary_res = client.get("/api/summary")
    summary = summary_res.json()
    assert summary["total_income"] == 50.0
    assert summary["total_spent"] == 0.0
    assert summary["transaction_count"] == 1


# Requirement 20: Reject candidate without recording transaction
def test_reject_removes_from_pending_without_recording(client, db_session):
    headers = {"Authorization": f"Bearer {settings.ANDROID_API_KEY}"}
    payload = {
        "items": [
            {
                "text": "Unrecognized charge of Rs 100",
                "source": "android",
                "external_id": "sms_charge_reject"
            }
        ]
    }
    client.post("/api/sync/android/ingest?review_mode=true", json=payload, headers=headers)
    item = db_session.query(ReviewQueueModel).filter(ReviewQueueModel.external_id == "sms_charge_reject").first()

    # Reject
    res_reject = client.post(f"/api/review/{item.id}/resolve", json={"action": "reject"})
    assert res_reject.status_code == 200
    assert res_reject.json()["status"] == "rejected"

    db_session.refresh(item)
    assert item.status == "rejected"
    assert db_session.query(TransactionModel).filter(TransactionModel.external_id == "sms_charge_reject").count() == 0

    # Pending items list must be empty
    pending_res = client.get("/api/review?status_filter=pending")
    assert len(pending_res.json()) == 0
