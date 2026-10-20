import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from app.nlp.extractor import extract_amount, extract_entities
from app.services.pipeline import run_pipeline
from app.db.database import Base
from app.db.models import TransactionModel
from app.main import app

# In-memory SQLite session for testing database isolation
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

# Case 1: A normal SMS with an amount
def test_normal_sms_with_amount():
    text = "INR 500 debited from your account"
    amount = extract_amount(text)
    entities = extract_entities(text)
    
    assert amount == 500.0
    assert entities["amount"] == 500.0

# Case 2: An SMS with no amount
def test_sms_with_no_amount():
    text = "Your payment to Amazon was successful"
    amount = extract_amount(text)
    entities = extract_entities(text)
    
    assert amount is None
    assert entities["amount"] is None

# Case 3: An SMS containing a valid amount of 0.0
def test_sms_with_valid_zero_amount():
    text = "INR 0.0 debited from your account"
    amount = extract_amount(text)
    entities = extract_entities(text)
    
    assert amount == 0.0
    assert entities["amount"] == 0.0
    assert entities["amount"] is not None

# Case 4: An SMS with an invalid or malformed amount
def test_sms_with_invalid_or_malformed_amount():
    # Alphanumeric suffix attached to amount
    assert extract_amount("INR 500xyz debited") is None
    # Currency with no digits
    assert extract_amount("INR abc was debited from account") is None
    # Currency symbol only
    assert extract_amount("Payment of INR  completed") is None

# Case 5: A complete, valid transaction through the pipeline
def test_complete_valid_transaction(db_session):
    text = "Rs. 350.00 debited from A/c XX1234 at Swiggy on 10-Oct-2026."
    res = run_pipeline(text, source="sms", db=db_session)
    
    assert res.transaction.amount == 350.0
    assert res.transaction.is_complete is True
    assert res.transaction.transaction_type == "DEBIT"
    assert res.transaction.merchant_normalized == "Swiggy"
    assert res.metadata["is_complete"] is True
    assert res.metadata["status"] == "confirmed"
    
    # Confirm it was persisted to the database
    persisted = db_session.query(TransactionModel).all()
    assert len(persisted) == 1
    assert persisted[0].amount == 350.0
    assert persisted[0].merchant_normalized == "Swiggy"

# Case 6: An incomplete transaction passed through the service pipeline (not persisted)
def test_incomplete_transaction_pipeline_not_persisted(db_session):
    text = "Your payment to Amazon was successful"
    res = run_pipeline(text, source="sms", db=db_session)
    
    # Extraction must preserve None and be marked incomplete
    assert res.transaction.amount is None
    assert res.transaction.is_complete is False
    assert res.metadata["is_complete"] is False
    assert res.metadata["status"] == "incomplete"
    assert "amount" in res.metadata.get("missing_fields", [])
    
    # Ensure incomplete transaction is NOT persisted to the database
    persisted = db_session.query(TransactionModel).all()
    assert len(persisted) == 0
    
    # Verify incomplete transaction rule trace was emitted
    rule_names = [trace.rule_name for trace in res.rule_traces]
    assert "INCOMPLETE_TRANSACTION" in rule_names

# Case 7: API request/response involving a missing amount
def test_api_parse_endpoint_missing_amount():
    client = TestClient(app)
    response = client.post("/api/parse", json={
        "text": "Your payment to Amazon was successful",
        "source": "sms"
    })
    
    assert response.status_code == 200
    data = response.json()
    assert data["transaction"]["amount"] is None
    assert data["transaction"]["is_complete"] is False
    assert data["metadata"]["is_complete"] is False
    assert data["metadata"]["status"] == "incomplete"
    assert "amount" in data["metadata"]["missing_fields"]
