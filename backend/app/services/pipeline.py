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
    """Execute complete SMS -> NLP -> AI -> Result pipeline."""
    # Step 1: Preprocess and anonymize
    clean_text = preprocess_message(raw_text)

    # Step 2: Extract entities
    entities = extract_entities(clean_text)

    # Step 3: Normalize merchant
    norm_merchant, norm_conf = normalizer.normalize(entities.get("merchant_candidate", ""))

    # Step 4: Categorize
    category, cat_conf = categorizer.predict(norm_merchant, clean_text)
    overall_confidence = round((norm_conf + cat_conf) / 2.0, 2)

    # Step 5: Construct Transaction entity
    is_complete = entities["amount"] is not None
    tx_data = {
        "amount": entities["amount"],
        "currency": "INR",
        "transaction_type": entities["transaction_type"],
        "merchant_raw": entities.get("merchant_candidate"),
        "merchant_normalized": norm_merchant,
        "category": category,
        "confidence": overall_confidence,
        "transaction_date": entities["transaction_date"],
        "is_complete": is_complete,
    }
    tx_base = TransactionBase(**tx_data)

    # Step 6: AI Rule Evaluation
    rule_traces = evaluate_transaction_rules(tx_data)

    # Step 7: Persist if DB session provided and transaction is complete
    if db is not None and is_complete:
        from app.db.models import TransactionModel
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
        "status": "confirmed" if is_complete else "incomplete",
    }
    if not is_complete:
        metadata["missing_fields"] = ["amount"]

    return PipelineResult(
        transaction=tx_base,
        rule_traces=rule_traces,
        metadata=metadata
    )
