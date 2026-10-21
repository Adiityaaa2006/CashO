import pytest
import hashlib
from datetime import datetime
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db.database import Base, get_db
from app.db.models import TransactionModel, ReviewQueueModel, SyncConnectionModel
from app.config import settings
from app.services.ingestion import ingest_message, ingest_batch
from app.schemas import BatchIngestItem


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


def generate_manual_external_id(text: str) -> str:
    norm = " ".join(text.strip().split())
    digest = hashlib.sha256(norm.encode("utf-8")).hexdigest()[:16]
    return f"manual_{digest}"


# 1. Empty and oversized input
def test_empty_and_oversized_input(db_session, client):
    # Empty string
    res_empty = ingest_message(db_session, "", source="android")
    assert res_empty["status"] == "skipped"
    assert res_empty["reason"] == "empty_text"

    # Whitespace only
    res_ws = ingest_message(db_session, "     \n\t  ", source="android")
    assert res_ws["status"] == "skipped"
    assert res_ws["reason"] == "empty_text"

    # Oversized input (> 4000 characters)
    oversized_text = "Paid Rs 100 at Chai Point on 10-04-2024 " + ("X" * 4100)
    res_oversized = ingest_message(db_session, oversized_text, source="android")
    assert res_oversized["status"] == "skipped"
    assert res_oversized["reason"] == "oversized_text"

    # API level test with empty and oversized
    headers = {"Authorization": f"Bearer {settings.ANDROID_API_KEY}"}
    payload = {
        "items": [
            {"text": "   ", "source": "android", "external_id": "man_1"},
            {"text": oversized_text, "source": "android", "external_id": "man_2"}
        ]
    }
    response = client.post("/api/sync/android/ingest", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["skipped"] == 2
    assert data["inserted"] == 0


# 2. Valid UPI debit and credit messages
def test_valid_upi_debit_and_credit_import(db_session, client):
    headers = {"Authorization": f"Bearer {settings.ANDROID_API_KEY}"}

    # Valid Debit
    debit_text = "Sent Rs. 350.00 to Swiggy via UPI Ref: 3948192849 on 15-10-2026"
    debit_ext_id = generate_manual_external_id(debit_text)
    payload_debit = {
        "items": [
            {"text": debit_text, "source": "android", "external_id": debit_ext_id}
        ]
    }
    res_debit = client.post("/api/sync/android/ingest", json=payload_debit, headers=headers)
    assert res_debit.status_code == 200
    data_debit = res_debit.json()
    assert data_debit["inserted"] == 1
    assert data_debit["results"][0]["status"] == "inserted"

    tx_debit = db_session.query(TransactionModel).filter(TransactionModel.external_id == debit_ext_id).first()
    assert tx_debit is not None
    assert tx_debit.amount == 350.0
    assert tx_debit.transaction_type == "DEBIT"
    assert tx_debit.review_status == "approved"

    # Valid Credit
    credit_text = "Salary of Rs. 65,000.00 credited to Account ending 1234 on 01-10-2026 from TechCorp India Pvt Ltd"
    credit_ext_id = generate_manual_external_id(credit_text)
    payload_credit = {
        "items": [
            {"text": credit_text, "source": "android", "external_id": credit_ext_id}
        ]
    }
    res_credit = client.post("/api/sync/android/ingest", json=payload_credit, headers=headers)
    assert res_credit.status_code == 200
    data_credit = res_credit.json()
    assert data_credit["inserted"] == 1
    assert data_credit["results"][0]["status"] == "inserted"

    tx_credit = db_session.query(TransactionModel).filter(TransactionModel.external_id == credit_ext_id).first()
    assert tx_credit is not None
    assert tx_credit.amount == 65000.0
    assert tx_credit.transaction_type == "CREDIT"


# 3. Ambiguous or incomplete messages going to review
def test_ambiguous_and_incomplete_messages_go_to_review(db_session, client):
    headers = {"Authorization": f"Bearer {settings.ANDROID_API_KEY}"}

    # Missing amount
    missing_amt_text = "Your payment to Amazon India was successful. Reference: UPI-9849204812"
    missing_amt_id = generate_manual_external_id(missing_amt_text)
    payload = {
        "items": [
            {"text": missing_amt_text, "source": "android", "external_id": missing_amt_id}
        ]
    }
    res = client.post("/api/sync/android/ingest", json=payload, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["review_queue"] == 1
    assert data["inserted"] == 0
    assert data["results"][0]["status"] == "review_queue"
    assert data["results"][0]["reason"] == "missing_amount"

    rev_item = db_session.query(ReviewQueueModel).filter(ReviewQueueModel.external_id == missing_amt_id).first()
    assert rev_item is not None
    assert rev_item.status == "pending"
    assert rev_item.reason == "missing_amount"

    # Confirmed transactions endpoint must NOT include pending review items
    tx_res = client.get("/api/transactions")
    assert tx_res.status_code == 200
    transactions = tx_res.json()
    assert len(transactions) == 0


# 4. Failed-payment messages not counted as confirmed expenses
def test_failed_payment_messages_not_counted_as_confirmed_expenses(db_session, client):
    headers = {"Authorization": f"Bearer {settings.ANDROID_API_KEY}"}

    failed_text = "Payment of Rs. 990.00 to Netflix failed due to bank network decline"
    failed_id = generate_manual_external_id(failed_text)
    payload = {
        "items": [
            {"text": failed_text, "source": "android", "external_id": failed_id}
        ]
    }
    res = client.post("/api/sync/android/ingest", json=payload, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["review_queue"] == 1
    assert data["inserted"] == 0
    assert data["results"][0]["status"] == "review_queue"

    # Check that failed payment is NOT in confirmed transactions
    tx_res = client.get("/api/transactions")
    assert len(tx_res.json()) == 0

    # Check summary: total_spent must be 0
    summary_res = client.get("/api/summary")
    assert summary_res.status_code == 200
    summary_data = summary_res.json()
    assert summary_data["total_spent"] == 0.0
    assert summary_data["transaction_count"] == 0


# 5. Re-importing the same message without duplication
def test_reimport_same_message_without_duplication(db_session, client):
    headers = {"Authorization": f"Bearer {settings.ANDROID_API_KEY}"}

    text = "Sent Rs. 420.00 to Blinkit via UPI Ref: 123098 on 12-10-2026"
    ext_id = generate_manual_external_id(text)
    payload = {
        "items": [
            {"text": text, "source": "android", "external_id": ext_id}
        ]
    }

    # First import
    res1 = client.post("/api/sync/android/ingest", json=payload, headers=headers)
    assert res1.json()["inserted"] == 1
    orig_tx_id = res1.json()["results"][0]["transaction_id"]

    # Re-import identical message with same external ID
    res2 = client.post("/api/sync/android/ingest", json=payload, headers=headers)
    data2 = res2.json()
    assert data2["inserted"] == 0
    assert data2["duplicates"] == 1
    assert data2["results"][0]["status"] == "duplicate"
    assert data2["results"][0]["duplicate_of_id"] == orig_tx_id

    # Re-import without external ID (whitespace variation)
    payload_no_id = {
        "items": [
            {"text": f"   {text}   \n", "source": "android"}
        ]
    }
    res3 = client.post("/api/sync/android/ingest", json=payload_no_id, headers=headers)
    data3 = res3.json()
    assert data3["inserted"] == 0
    assert data3["duplicates"] == 1
    assert data3["results"][0]["status"] == "duplicate"
    assert data3["results"][0]["duplicate_of_id"] == orig_tx_id

    # Re-importing pending review item must NOT create duplicate review rows
    ambig_text = "Transaction alert without amount to Merchant"
    res_rev1 = client.post("/api/sync/android/ingest", json={"items": [{"text": ambig_text, "source": "android"}]}, headers=headers)
    assert res_rev1.json()["review_queue"] == 1
    rev1_id = res_rev1.json()["results"][0]["review_id"]

    # Re-import same ambiguous text
    res_rev2 = client.post("/api/sync/android/ingest", json={"items": [{"text": ambig_text, "source": "android"}]}, headers=headers)
    assert res_rev2.json()["review_queue"] == 1
    assert res_rev2.json()["results"][0]["review_id"] == rev1_id

    # Verify only 1 row in review_queue
    rev_count = db_session.query(ReviewQueueModel).filter(ReviewQueueModel.raw_text.like("%Merchant%")).count()
    assert rev_count == 1


# 6. Message already ingested from Gmail not double-counted via cross-source matching
def test_cross_source_deduplication_gmail_and_manual_sms(db_session, client):
    headers = {"Authorization": f"Bearer {settings.ANDROID_API_KEY}"}

    # 1. First ingested from Gmail order receipt
    gmail_text = "Your Swiggy order confirmation. Total paid is Rs 450.00 on 10-10-2026 via Card"
    gmail_res = ingest_message(db_session, gmail_text, source="gmail", external_id="gmail_msg_001")
    assert gmail_res["status"] == "inserted"
    gmail_tx_id = gmail_res["transaction_id"]

    # 2. Manual SMS pasted in Android companion for the same Swiggy transaction
    manual_sms = "Rs. 450.00 debited from A/c XX1234 at Swiggy on 10-10-2026"
    manual_ext_id = generate_manual_external_id(manual_sms)
    payload = {
        "items": [
            {"text": manual_sms, "source": "android", "external_id": manual_ext_id}
        ]
    }
    res = client.post("/api/sync/android/ingest", json=payload, headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert data["duplicates"] == 1
    assert data["inserted"] == 0
    assert data["results"][0]["status"] == "duplicate"
    assert data["results"][0]["reason"] == "cross_source_match"
    assert data["results"][0]["duplicate_of_id"] == gmail_tx_id

    # Ledger must contain strictly 1 transaction
    total_txs = db_session.query(TransactionModel).count()
    assert total_txs == 1


# 7. Authentication and API failure handling
def test_authentication_and_api_failures(client):
    valid_payload = {
        "items": [
            {"text": "Sent Rs. 100 to Chai Point on 10-10-2026", "source": "android"}
        ]
    }

    # Missing authorization header
    res_no_auth = client.post("/api/sync/android/ingest", json=valid_payload)
    assert res_no_auth.status_code == 401
    assert "Invalid or missing companion authorization token" in res_no_auth.json()["detail"]

    # Invalid authorization token
    res_bad_auth = client.post(
        "/api/sync/android/ingest",
        json=valid_payload,
        headers={"Authorization": "Bearer invalid_secret_token_xyz"}
    )
    assert res_bad_auth.status_code == 401

    # Malformed payload (empty body or missing items)
    headers = {"Authorization": f"Bearer {settings.ANDROID_API_KEY}"}
    res_bad_body = client.post("/api/sync/android/ingest", json={}, headers=headers)
    assert res_bad_body.status_code == 422


# 8. Retry idempotency with normalized hash
def test_retry_idempotency_with_normalized_hash(db_session, client):
    headers = {"Authorization": f"Bearer {settings.ANDROID_API_KEY}"}

    base_text = "Paid Rs 550 at Decathlon on 10-10-2026 via UPI"
    ext_id = generate_manual_external_id(base_text)

    # Initial submission
    res1 = client.post(
        "/api/sync/android/ingest",
        json={"items": [{"text": base_text, "source": "android", "external_id": ext_id}]},
        headers=headers
    )
    assert res1.json()["inserted"] == 1

    # Simulated retry with identical external ID but extra spaces in body
    text_with_spaces = f"  {base_text}   \n\n "
    retry_ext_id = generate_manual_external_id(text_with_spaces)
    assert retry_ext_id == ext_id  # Normalized hash must match exactly!

    res2 = client.post(
        "/api/sync/android/ingest",
        json={"items": [{"text": text_with_spaces, "source": "android", "external_id": retry_ext_id}]},
        headers=headers
    )
    assert res2.json()["duplicates"] == 1
    assert res2.json()["inserted"] == 0
