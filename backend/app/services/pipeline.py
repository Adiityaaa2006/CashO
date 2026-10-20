from typing import Dict, Any
from sqlalchemy.orm import Session
from app.nlp.preprocess import preprocess_message
from app.nlp.extractor import extract_entities
from app.nlp.merchant_normalizer import MerchantNormalizer
from app.nlp.categorizer import TransactionCategorizer
from app.ai.rules import evaluate_transaction_rules
from app.schemas import PipelineResult, TransactionBase
from app.config import settings

normalizer = MerchantNormalizer(settings.MERCHANTS_FILE)
categorizer = TransactionCategorizer()

def run_pipeline(raw_text: str, source: str = "sms", db: Session = None) -> PipelineResult:
    """Execute complete SMS/Email -> NLP -> Validation -> Result pipeline."""
    # Step 1: Preprocess and anonymize
    clean_text = preprocess_message(raw_text)

    # Step 2: Extract entities
    entities = extract_entities(clean_text)

    # If email source, supplement with email-specific parser if amount not already found
    order_id = None
    if source == "email":
        from app.nlp.email_parser import parse_order_email
        email_info = parse_order_email(clean_text)
        if entities["amount"] is None and email_info.get("total_amount") is not None:
            entities["amount"] = email_info["total_amount"]
        order_id = email_info.get("order_id")

    # Step 3: Normalize merchant
    merchant_candidate = entities.get("merchant_candidate")
    if not merchant_candidate and source == "email":
        for key in normalizer.merchants:
            if key in clean_text.lower():
                merchant_candidate = key
                break

    norm_merchant, norm_conf = normalizer.normalize(merchant_candidate or "")

    # Step 4: Categorize
    category, cat_conf = categorizer.predict(norm_merchant, clean_text)
    overall_confidence = round((norm_conf + cat_conf) / 2.0, 2)

    # Step 5: Validate completeness and transaction direction
    has_amount = entities["amount"] is not None
    txn_type = entities["transaction_type"]
    missing_fields = []

    if not has_amount:
        missing_fields.append("amount")
    if txn_type == "UNKNOWN":
        missing_fields.append("transaction_type")

    is_complete = has_amount and (txn_type in ["DEBIT", "CREDIT"])
    
    # Determine lifecycle status
    if txn_type == "FAILED":
        status = "failed"
    elif not is_complete:
        status = "incomplete"
    else:
        status = "confirmed"

    # Step 6: Construct Transaction entity
    tx_data = {
        "amount": entities["amount"],
        "currency": "INR",
        "transaction_type": txn_type,
        "merchant_raw": entities.get("merchant_candidate"),
        "merchant_normalized": norm_merchant,
        "category": category,
        "confidence": overall_confidence,
        "transaction_date": entities["transaction_date"],
        "is_complete": is_complete,
    }
    tx_base = TransactionBase(**tx_data)

    # Step 7: AI Rule Evaluation
    rule_traces = evaluate_transaction_rules(tx_data)

    # Step 8: Safe persistence (guard against incomplete, failed, or duplicate records)
    is_duplicate = False
    duplicate_of_id = None

    if db is not None and is_complete:
        from app.db.models import TransactionModel
        # Check for duplicate import of identical text
        existing = db.query(TransactionModel).filter(TransactionModel.raw_text == clean_text).first()
        if existing:
            is_duplicate = True
            duplicate_of_id = existing.id
            status = "duplicate"
        else:
            db_data = {k: v for k, v in tx_data.items() if k != "is_complete"}
            db_model = TransactionModel(
                raw_text=clean_text,
                **db_data
            )
            db.add(db_model)
            db.commit()
            db.refresh(db_model)

    metadata = {
        "source": source,
        "anonymized_preview": clean_text[:40],
        "is_complete": is_complete,
        "status": status,
    }
    if missing_fields:
        metadata["missing_fields"] = missing_fields
    if order_id:
        metadata["order_id"] = order_id
    if is_duplicate:
        metadata["is_duplicate"] = True
        metadata["duplicate_of_id"] = duplicate_of_id

    return PipelineResult(
        transaction=tx_base,
        rule_traces=rule_traces,
        metadata=metadata
    )
    