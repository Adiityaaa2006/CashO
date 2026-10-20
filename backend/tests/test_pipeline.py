import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.services.pipeline import run_pipeline
from app.db.database import Base
from app.db.models import TransactionModel

@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()

def test_pipeline_basic_debit():
    sample_sms = "Rs. 350.00 debited from A/c XX1234 at Swiggy on 10-Oct-2026."
    res = run_pipeline(sample_sms, source="sms", db=None)
    
    assert res.transaction.amount == 350.0
    assert res.transaction.transaction_type == "DEBIT"
    assert res.transaction.merchant_normalized == "Swiggy"
    assert res.transaction.category == "Food & Dining"
    assert res.transaction.transaction_date is not None
    assert res.transaction.transaction_date.day == 10
    assert res.transaction.transaction_date.month == 10

def test_pipeline_missing_date_not_fabricated():
    # Message without any date mentioned
    sample_sms = "Rs. 150.00 debited for Uber ride"
    res = run_pipeline(sample_sms, source="sms", db=None)
    
    assert res.transaction.amount == 150.0
    assert res.transaction.transaction_date is None
    assert res.transaction.is_complete is True

def test_pipeline_failed_payment_rejected(db_session):
    # Payment declined/failed
    sample_sms = "Payment of Rs. 990.00 to Netflix failed due to network issue."
    res = run_pipeline(sample_sms, source="sms", db=db_session)
    
    assert res.transaction.transaction_type == "FAILED"
    assert res.transaction.is_complete is False
    assert res.metadata["status"] == "failed"
    
    # Must not be saved to confirmed ledger
    persisted = db_session.query(TransactionModel).all()
    assert len(persisted) == 0

def test_pipeline_refund_reversal():
    sample_sms = "Refund of Rs. 450.00 received from Swiggy into account."
    res = run_pipeline(sample_sms, source="sms", db=None)
    
    assert res.transaction.amount == 450.0
    assert res.transaction.transaction_type == "CREDIT"
    assert res.transaction.merchant_normalized == "Swiggy"

def test_pipeline_unknown_direction(db_session):
    # Ambiguous message with amount but no debit/credit indicator
    sample_sms = "Update: Your monthly statement shows Rs. 500.00 at Store."
    res = run_pipeline(sample_sms, source="sms", db=db_session)
    
    assert res.transaction.transaction_type == "UNKNOWN"
    assert res.transaction.is_complete is False
    assert res.metadata["status"] == "incomplete"
    assert "transaction_type" in res.metadata.get("missing_fields", [])
    
    persisted = db_session.query(TransactionModel).all()
    assert len(persisted) == 0

def test_pipeline_duplicate_detection(db_session):
    sample_sms = "Rs. 299.00 debited from card ending 1234 to Blinkit on 15-Oct-2026."
    
    # First ingestion -> confirmed and saved
    res1 = run_pipeline(sample_sms, source="sms", db=db_session)
    assert res1.metadata["status"] == "confirmed"
    assert db_session.query(TransactionModel).count() == 1
    
    # Second ingestion of identical text -> detected as duplicate, not inserted again
    res2 = run_pipeline(sample_sms, source="sms", db=db_session)
    assert res2.metadata["status"] == "duplicate"
    assert res2.metadata.get("is_duplicate") is True
    assert db_session.query(TransactionModel).count() == 1

def test_pipeline_email_parsing():
    email_text = "Your order #402-9981-123 confirmation. Total amount: Rs. 1,499.00 paid for Amazon item."
    res = run_pipeline(email_text, source="email", db=None)
    
    assert res.transaction.amount == 1499.0
    assert res.metadata.get("order_id") == "402-9981-123"
    assert res.transaction.merchant_normalized == "Amazon"

