import pytest
from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.database import Base
from app.db.models import TransactionModel, ReviewQueueModel
from app.nlp.extractor import (
    extract_amount,
    extract_transaction_type,
    extract_date,
    extract_merchant_candidate,
    extract_entities
)
from app.nlp.merchant_normalizer import MerchantNormalizer
from app.services.pipeline import run_pipeline
from app.services.ingestion import ingest_message, reprocess_anomalous_transactions


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()
    yield session
    session.close()


def test_slice_bank_added_is_credit():
    """
    Slice Bank: When funds are 'added' to an account, it must be recognized
    as a CREDIT (account funding), not inverted to DEBIT.
    """
    text = "Rs 100.00 added to your slice bank account balance via UPI."
    res = run_pipeline(text, source="email", db=None)

    assert res.transaction.amount == 100.0
    assert res.transaction.transaction_type == "CREDIT"
    assert res.transaction.merchant_normalized == "Slice"
    assert res.transaction.is_complete is True
    assert res.transaction.confidence >= 0.70


def test_dob_password_disclaimer_date_rejected():
    """
    Statement emails often include DOB password guidance (e.g. 'DOB is 15/07/1998').
    This must not be extracted as the transaction date (1998).
    """
    email_body = (
        "Your monthly account summary has been generated. "
        "Here's what you earned in interest: Rs. 42.50. "
        "Your statement is password protected. For example, if your DOB is 15/07/1998, "
        "your password is 15071998."
    )

    extracted_date = extract_date(email_body)
    # The 1998 DOB must be rejected as an implausible / password example date
    assert extracted_date is None

    # Pipeline should fall back safely without inventing a fake date
    res = run_pipeline(email_body, source="email", db=None)
    assert res.transaction.amount == 42.50
    assert res.transaction.transaction_date is None


def test_merchant_noise_stripping():
    """
    Surrounding boilerplate like 'Order No', 'Please Report', 'RRN',
    and email addresses must not contaminate the merchant name.
    """
    # 1. Bigbasket with order number
    txt1 = "Your order at Bigbasket Order No: 981248 has been placed for Rs. 540.00."
    res1 = run_pipeline(txt1, source="email", db=None)
    assert res1.transaction.merchant_normalized == "Bigbasket"
    assert "Order No" not in (res1.transaction.merchant_raw or "")

    # 2. HyugaLife with customer support boilerplate
    txt2 = "Paid Rs. 1,299.00 at Hyugalife Please Report any discrepancy within 24 hours."
    res2 = run_pipeline(txt2, source="email", db=None)
    assert res2.transaction.merchant_normalized == "HyugaLife"
    assert "Please Report" not in (res2.transaction.merchant_raw or "")

    # 3. Minimalist with support email and punctuation
    txt3 = "Order confirmation from Help@Beminimalist.Co. If You& have questions Rs. 699.00 paid."
    res3 = run_pipeline(txt3, source="email", db=None)
    assert res3.transaction.merchant_normalized == "Be Minimalist"
    assert "@" not in (res3.transaction.merchant_raw or "")
    assert "&" not in (res3.transaction.merchant_raw or "")


def test_upi_individual_payee_preserved():
    """Valid individual payee names in UPI payments should be preserved and title-cased."""
    txt = "Paid Rs. 250.00 to Jashan Rrn 627546826378 via UPI on your account."
    res = run_pipeline(txt, source="sms", db=None)

    assert res.transaction.amount == 250.0
    assert res.transaction.transaction_type == "DEBIT"
    assert res.transaction.merchant_normalized == "Jashan"
    assert "627546826378" not in (res.transaction.merchant_normalized or "")


def test_failed_transactions_not_completed():
    """Failed, declined, or cancelled transactions must not be treated as completed debits."""
    txt = "Transaction of Rs. 1,450.00 at Amazon failed due to technical error. Your account was not debited."
    res = run_pipeline(txt, source="email", db=None)

    assert res.transaction.transaction_type == "FAILED"
    assert res.transaction.is_complete is False
    assert res.metadata["status"] == "failed"


def test_refund_distinguished_and_credited():
    """Refunds must be identified, recorded as CREDIT for the ledger, and flagged in metadata."""
    txt = "Refund of Rs. 850.00 for order #4591 has been credited to your account from Flipkart."
    res = run_pipeline(txt, source="email", db=None)

    assert res.transaction.amount == 850.0
    assert res.transaction.transaction_type == "CREDIT"
    assert res.metadata.get("is_refund") is True
    assert res.transaction.merchant_normalized == "Flipkart"
    assert res.transaction.is_complete is True


def test_ambiguous_direction_routes_to_review(db_session):
    """
    Messages with an amount but completely ambiguous direction must NOT default to DEBIT.
    They must be routed to the review queue with UNKNOWN type.
    """
    txt = "Notification: Your monthly statement closing balance is Rs. 12,500.00."
    ingest_res = ingest_message(db_session, raw_text=txt, source="email")

    assert ingest_res["status"] == "review_queue"
    assert "unsupported_type_unknown" in ingest_res["reason"]

    # Must NOT have inserted into transactions ledger
    assert db_session.query(TransactionModel).count() == 0
    # Must exist in review queue
    review_item = db_session.query(ReviewQueueModel).first()
    assert review_item is not None
    assert review_item.suggested_amount == 12500.0
    assert review_item.suggested_transaction_type == "UNKNOWN"


def test_confidence_calibration():
    """
    Confidence must be a weighted composite of field-level confidences.
    A valid amount must not conceal an ambiguous direction.
    """
    # 1. Clear complete transaction
    txt_clear = "Paid Rs. 500.00 to Swiggy on 12-Oct-2026."
    res_clear = run_pipeline(txt_clear, source="sms", db=None)
    assert res_clear.transaction.confidence >= 0.85

    # 2. Valid amount with unknown direction
    txt_unknown_dir = "Balance statement Rs. 500.00 recorded."
    res_unknown = run_pipeline(txt_unknown_dir, source="sms", db=None)
    # Direction confidence is 0.0, so overall confidence cannot exceed 0.60
    assert res_unknown.transaction.confidence <= 0.60
    assert res_unknown.transaction.is_complete is False


def test_safe_reprocess_anomalous_transactions(db_session):
    """
    Verify that anomalous transactions in the database (e.g. 1998 date, inverted Slice credit,
    noisy merchant) are safely reprocessed in-place without creating duplicates or dropping rows.
    """
    # Insert 2 flawed historical transactions
    flawed_tx1 = TransactionModel(
        raw_text="Rs 100.00 added to your slice bank account balance via UPI.",
        amount=100.0,
        currency="INR",
        transaction_type="DEBIT",  # Inverted!
        merchant_raw="Slice Bank Account",
        merchant_normalized="Unknown Merchant",
        category="Miscellaneous",
        confidence=0.40,
        transaction_date=datetime(1998, 7, 15),  # Flawed DOB date!
        source="gmail",
        external_id="msg_001",
        review_status="approved"
    )
    flawed_tx2 = TransactionModel(
        raw_text="Your order at Bigbasket Order No: 981248 has been placed for Rs. 540.00.",
        amount=540.0,
        currency="INR",
        transaction_type="DEBIT",
        merchant_raw="Bigbasket Order No",  # Contaminated!
        merchant_normalized="Unknown Merchant",
        category="Miscellaneous",
        confidence=0.40,
        transaction_date=datetime(2026, 10, 15),
        source="gmail",
        external_id="msg_002",
        review_status="approved"
    )
    db_session.add_all([flawed_tx1, flawed_tx2])
    db_session.commit()

    initial_count = db_session.query(TransactionModel).count()
    assert initial_count == 2

    # 1. Run dry-run first
    dry_run_res = reprocess_anomalous_transactions(db_session, dry_run=True)
    assert dry_run_res["dry_run"] is True
    assert dry_run_res["anomalies_found"] == 2
    # Verify records were NOT changed in dry-run
    db_session.refresh(flawed_tx1)
    assert flawed_tx1.transaction_type == "DEBIT"
    assert flawed_tx1.transaction_date.year == 1998

    # 2. Run actual in-place reprocessing
    reprocess_res = reprocess_anomalous_transactions(db_session, dry_run=False)
    assert reprocess_res["dry_run"] is False
    assert reprocess_res["anomalies_found"] == 2

    # Verify no new records created (no duplicates)
    assert db_session.query(TransactionModel).count() == 2

    # Verify flawed_tx1 corrected in-place
    db_session.refresh(flawed_tx1)
    assert flawed_tx1.transaction_type == "CREDIT"
    assert flawed_tx1.merchant_normalized == "Slice"
    assert flawed_tx1.transaction_date.year != 1998

    # Verify flawed_tx2 corrected in-place
    db_session.refresh(flawed_tx2)
    assert flawed_tx2.merchant_normalized == "Bigbasket"
