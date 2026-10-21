import pytest
from datetime import datetime
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db.database import Base, get_db
from app.db.models import TransactionModel, ReviewQueueModel


@pytest.fixture
def db_session():
    """Isolated in-memory SQLite database session for testing."""
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
    """FastAPI TestClient with overridden database session."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_confirmed_and_needs_review_summary_filtering(client, db_session):
    """
    Verify /api/summary strictly aggregates confirmed transactions (approved & legacy NULL)
    and excludes needs_review debits/credits from total spent, income, categories, and counts.
    """
    # 1. Confirmed Debit
    tx1 = TransactionModel(
        raw_text="Paid Rs 500 to Swiggy",
        amount=500.0,
        currency="INR",
        transaction_type="DEBIT",
        merchant_normalized="Swiggy",
        category="Food & Dining",
        review_status="approved",
        transaction_date=datetime(2026, 10, 1)
    )
    # 2. Confirmed Credit (Legacy NULL review_status)
    tx2 = TransactionModel(
        raw_text="Salary Rs 2000 credited",
        amount=2000.0,
        currency="INR",
        transaction_type="CREDIT",
        merchant_normalized="Employer",
        category="Income",
        review_status=None,  # Legacy confirmed transaction
        transaction_date=datetime(2026, 10, 2)
    )
    # 3. Needs_Review Debit (failed or ambiguous payment)
    tx3 = TransactionModel(
        raw_text="Payment failed for Brand Eyes Rs 1424",
        amount=1424.0,
        currency="INR",
        transaction_type="DEBIT",
        merchant_normalized="Brand Eyes",
        category="Shopping",
        review_status="needs_review",
        transaction_date=datetime(2026, 10, 3)
    )
    # 4. Needs_Review Credit (promotional reward points / newsletter)
    tx4 = TransactionModel(
        raw_text="50 MCash credited reward points",
        amount=50.0,
        currency="INR",
        transaction_type="CREDIT",
        merchant_normalized="Be Minimalist",
        category="Income",
        review_status="needs_review",
        transaction_date=datetime(2026, 10, 4)
    )
    db_session.add_all([tx1, tx2, tx3, tx4])
    db_session.commit()

    response = client.get("/api/summary")
    assert response.status_code == 200
    data = response.json()

    # Confirmed financial aggregates
    assert data["total_spent"] == 500.0, "Should only include confirmed debit (Rs 500), excluding needs_review debit (Rs 1424)"
    assert data["total_income"] == 2000.0, "Should only include confirmed credit (Rs 2000), excluding needs_review credit (Rs 50)"
    assert data["transaction_count"] == 2, "Should count only the 2 confirmed transactions"

    # Category breakdown must only contain categories from confirmed debits
    assert "Food & Dining" in data["category_breakdown"]
    assert data["category_breakdown"]["Food & Dining"] == 500.0
    assert "Shopping" not in data["category_breakdown"], "Needs_review debit category must be excluded"


def test_transaction_listing_and_pagination(client, db_session):
    """
    Verify /api/transactions defaults to confirmed transactions and excludes needs_review,
    while pagination remains accurate and explicit review_status filtering is supported.
    """
    tx_confirmed_1 = TransactionModel(
        raw_text="Tx 1",
        amount=100.0,
        transaction_type="DEBIT",
        category="Food & Dining",
        review_status="approved"
    )
    tx_confirmed_2 = TransactionModel(
        raw_text="Tx 2",
        amount=200.0,
        transaction_type="DEBIT",
        category="Transport",
        review_status="approved"
    )
    tx_needs_review = TransactionModel(
        raw_text="Tx 3 Ambiguous",
        amount=999.0,
        transaction_type="DEBIT",
        category="Miscellaneous",
        review_status="needs_review"
    )
    db_session.add_all([tx_confirmed_1, tx_confirmed_2, tx_needs_review])
    db_session.commit()

    # Default listing: excludes needs_review
    res_default = client.get("/api/transactions")
    assert res_default.status_code == 200
    items_default = res_default.json()
    assert len(items_default) == 2
    assert all(item["review_status"] != "needs_review" for item in items_default)

    # Pagination on confirmed items
    res_page_1 = client.get("/api/transactions?skip=0&limit=1")
    assert res_page_1.status_code == 200
    assert len(res_page_1.json()) == 1

    res_page_2 = client.get("/api/transactions?skip=1&limit=1")
    assert res_page_2.status_code == 200
    assert len(res_page_2.json()) == 1
    assert res_page_1.json()[0]["id"] != res_page_2.json()[0]["id"]

    # Explicit filter for needs_review
    res_review = client.get("/api/transactions?review_status=needs_review")
    assert res_review.status_code == 200
    items_review = res_review.json()
    assert len(items_review) == 1
    assert items_review[0]["amount"] == 999.0
    assert items_review[0]["review_status"] == "needs_review"

    # Explicit filter for all
    res_all = client.get("/api/transactions?review_status=all")
    assert res_all.status_code == 200
    assert len(res_all.json()) == 3


def test_review_queue_resolution_flow(client, db_session):
    """
    Verify that resolving items in the review queue correctly produces
    confirmed transactions that immediately reflect in the summary and ledger.
    """
    # 1. Add pending item to review queue
    review_item = ReviewQueueModel(
        source="email",
        raw_text="Payment of Rs 350 to HyugaLife successful",
        suggested_amount=350.0,
        suggested_currency="INR",
        suggested_transaction_type="DEBIT",
        suggested_merchant="HyugaLife",
        suggested_category="Health & Fitness",
        reason="ambiguous_direction",
        status="pending"
    )
    db_session.add(review_item)
    db_session.commit()
    db_session.refresh(review_item)

    # Initially, review queue has 1 pending item
    res_queue = client.get("/api/review")
    assert res_queue.status_code == 200
    assert len(res_queue.json()) == 1

    # Initially, summary has 0 transactions
    summary_before = client.get("/api/summary").json()
    assert summary_before["transaction_count"] == 0
    assert summary_before["total_spent"] == 0.0

    # 2. Approve the review item
    resolve_payload = {
        "action": "approve",
        "amount": 350.0,
        "merchant": "HyugaLife",
        "category": "Health & Fitness",
        "transaction_type": "DEBIT"
    }
    res_resolve = client.post(f"/api/review/{review_item.id}/resolve", json=resolve_payload)
    assert res_resolve.status_code == 200
    assert res_resolve.json()["status"] == "approved"

    # 3. Verify confirmed summary now includes the approved transaction
    summary_after = client.get("/api/summary").json()
    assert summary_after["transaction_count"] == 1
    assert summary_after["total_spent"] == 350.0
    assert summary_after["category_breakdown"]["Health & Fitness"] == 350.0

    # 4. Verify transaction listing includes it as confirmed
    res_tx = client.get("/api/transactions")
    assert len(res_tx.json()) == 1
    assert res_tx.json()[0]["merchant_normalized"] == "HyugaLife"
    assert res_tx.json()[0]["review_status"] == "approved"

    # 5. Reject a second review item
    reject_item = ReviewQueueModel(
        source="email",
        raw_text="Spam email with Rs 100",
        suggested_amount=100.0,
        suggested_transaction_type="DEBIT",
        reason="low_confidence",
        status="pending"
    )
    db_session.add(reject_item)
    db_session.commit()

    res_reject = client.post(f"/api/review/{reject_item.id}/resolve", json={"action": "reject"})
    assert res_reject.status_code == 200
    assert res_reject.json()["status"] == "rejected"

    # Summary remains unchanged
    summary_final = client.get("/api/summary").json()
    assert summary_final["transaction_count"] == 1
    assert summary_final["total_spent"] == 350.0
