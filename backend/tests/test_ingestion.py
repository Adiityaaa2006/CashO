import pytest
from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db.database import Base
from app.db.models import TransactionModel, ReviewQueueModel
from app.db.migrations import run_migrations
from app.services.ingestion import ingest_message, ingest_batch, resolve_review_item
from app.schemas import BatchIngestItem

@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    yield session
    session.close()

def test_ingest_single_valid_sms(db_session):
    text = "Paid Rs 450 at Starbucks on 10-04-2024 via UPI ref 12345"
    result = ingest_message(db_session, text, source="android", external_id="sms_001")
    assert result["status"] == "inserted"
    assert result["transaction_id"] is not None

    tx = db_session.query(TransactionModel).filter(TransactionModel.id == result["transaction_id"]).first()
    assert tx is not None
    assert tx.amount == 450.0
    assert tx.source == "android"
    assert tx.external_id == "sms_001"

def test_ingest_duplicate_external_id(db_session):
    text1 = "Paid Rs 200 at Uber on 10-04-2024"
    result1 = ingest_message(db_session, text1, source="android", external_id="ext_999")
    assert result1["status"] == "inserted"

    text2 = "Paid Rs 200 at Uber on 10-04-2024 duplicate attempt"
    result2 = ingest_message(db_session, text2, source="android", external_id="ext_999")
    assert result2["status"] == "duplicate"
    assert result2["reason"] == "duplicate_external_id"
    assert result2["duplicate_of_id"] == result1["transaction_id"]

def test_ingest_missing_amount_routes_to_review_queue(db_session):
    text = "Payment received at Cafe Coffee Day on 10-04-2024"
    result = ingest_message(db_session, text, source="gmail", external_id="email_001")
    assert result["status"] == "review_queue"
    assert result["reason"] == "missing_amount"
    assert result["review_id"] is not None

    review = db_session.query(ReviewQueueModel).filter(ReviewQueueModel.id == result["review_id"]).first()
    assert review is not None
    assert review.source == "gmail"
    assert review.status == "pending"

def test_cross_source_deduplication(db_session):
    # 1. Android SMS debit arrives
    sms_text = "Paid Rs 349 at Swiggy on 15-05-2024 via UPI"
    sms_res = ingest_message(db_session, sms_text, source="android", external_id="sms_swiggy_1")
    assert sms_res["status"] == "inserted"
    orig_id = sms_res["transaction_id"]

    # 2. Gmail order confirmation email arrives for same amount & merchant
    email_text = "Your Swiggy order is confirmed. Total amount paid is Rs 349.00 on 15-05-2024"
    email_res = ingest_message(db_session, email_text, source="gmail", external_id="gmail_swiggy_1")
    assert email_res["status"] == "duplicate"
    assert email_res["reason"] == "cross_source_match"
    assert email_res["duplicate_of_id"] == orig_id

    # Verify only 1 transaction exists in database
    count = db_session.query(TransactionModel).count()
    assert count == 1

def test_resolve_review_queue_item(db_session):
    text = "Payment sent to Bookstore"
    result = ingest_message(db_session, text, source="android")
    assert result["status"] == "review_queue"
    review_id = result["review_id"]

    # User manually reviews and approves with amount
    tx = resolve_review_item(
        db_session,
        review_id=review_id,
        action="approve",
        amount=650.0,
        merchant="Bookstore",
        category="Education"
    )
    assert tx is not None
    assert tx.amount == 650.0
    assert tx.category == "Education"

    # Check review queue status updated
    rev = db_session.query(ReviewQueueModel).filter(ReviewQueueModel.id == review_id).first()
    assert rev.status == "approved"

def test_batch_ingestion(db_session):
    items = [
        BatchIngestItem(text="Paid Rs 120 at Zomato on 01-01-2024", source="android", external_id="b1"),
        BatchIngestItem(text="Paid Rs 120 at Zomato on 01-01-2024", source="android", external_id="b1"), # duplicate
        BatchIngestItem(text="Your balance statement for this month", source="gmail", external_id="b2") # missing amount
    ]
    batch_res = ingest_batch(db_session, items)
    assert batch_res.total_received == 3
    assert batch_res.inserted == 1
    assert batch_res.duplicates == 1
    assert batch_res.review_queue == 1
