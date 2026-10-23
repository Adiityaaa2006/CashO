import logging
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.nlp.preprocess import preprocess_message
from app.services.pipeline import run_pipeline
from app.db.models import TransactionModel, ReviewQueueModel
from app.schemas import BatchIngestItem, BatchIngestItemResult, BatchIngestResponse

logger = logging.getLogger(__name__)


def find_cross_source_match(
    db: Session,
    amount: float,
    merchant_normalized: Optional[str],
    tx_date: Optional[datetime],
    source: str
) -> Optional[TransactionModel]:
    """
    Detect whether a complementary transaction already exists in the database.
    For example: an SMS debit matches an email order receipt for the same amount,
    merchant, and timeframe.
    """
    if amount is None or amount <= 0:
        return None

    # Search for transactions with same amount (+- 1 rupee for roundings/fees)
    candidates = db.query(TransactionModel).filter(
        TransactionModel.amount >= (amount - 1.0),
        TransactionModel.amount <= (amount + 1.0)
    ).all()

    sms_sources = {"sms", "android"}
    email_sources = {"email", "gmail"}

    current_is_sms = source.lower() in sms_sources
    current_is_email = source.lower() in email_sources

    for candidate in candidates:
        candidate_source = (candidate.source or "manual").lower()
        candidate_is_sms = candidate_source in sms_sources
        candidate_is_email = candidate_source in email_sources

        # Cross-source deduplication only applies across different medium types
        if (current_is_sms and candidate_is_sms) or (current_is_email and candidate_is_email):
            continue

        # Check merchant similarity
        norm1 = (merchant_normalized or "").lower().strip()
        norm2 = (candidate.merchant_normalized or candidate.merchant_raw or "").lower().strip()

        merchant_matches = False
        if norm1 and norm2:
            if norm1 in norm2 or norm2 in norm1:
                merchant_matches = True
            elif norm1 == "miscellaneous" or norm2 == "miscellaneous":
                # Allow match if date proximity is very tight
                merchant_matches = True
        else:
            # If one source didn't extract a merchant, allow if dates match closely
            merchant_matches = True

        if not merchant_matches:
            continue

        # Check date proximity (within 12 hours)
        date1 = tx_date or datetime.utcnow()
        date2 = candidate.transaction_date or candidate.created_at

        if abs((date1 - date2).total_seconds()) <= (12 * 3600):
            return candidate

    return None


def ingest_message(
    db: Session,
    raw_text: str,
    source: str = "sms",
    external_id: Optional[str] = None,
    timestamp: Optional[datetime] = None,
    as_review: bool = False
) -> Dict[str, Any]:
    """
    Unified entry point for raw message ingestion from all channels
    (Manual, Android SMS, Gmail OAuth, etc.)
    """
    if len(raw_text or "") > 4000:
        return {
            "status": "skipped",
            "reason": "oversized_text",
            "transaction_id": None,
            "duplicate_of_id": None,
            "review_id": None
        }

    clean_text = preprocess_message(raw_text or "")
    if not clean_text:
        return {
            "status": "skipped",
            "reason": "empty_text",
            "transaction_id": None,
            "duplicate_of_id": None,
            "review_id": None
        }

    # 1. External ID check (idempotency across retries/syncs)
    if external_id:
        existing_ext = db.query(TransactionModel).filter(TransactionModel.external_id == external_id).first()
        if existing_ext:
            return {
                "status": "duplicate",
                "reason": "duplicate_external_id",
                "transaction_id": existing_ext.id,
                "duplicate_of_id": existing_ext.id,
                "review_id": None
            }
        existing_review = db.query(ReviewQueueModel).filter(ReviewQueueModel.external_id == external_id).first()
        if existing_review:
            return {
                "status": "duplicate",
                "reason": "duplicate_external_id",
                "transaction_id": None,
                "duplicate_of_id": None,
                "review_id": existing_review.id
            }

    # 2. Exact text check against confirmed transactions
    existing_text = db.query(TransactionModel).filter(TransactionModel.raw_text == clean_text).first()
    if existing_text:
        return {
            "status": "duplicate",
            "reason": "exact_text_duplicate",
            "transaction_id": existing_text.id,
            "duplicate_of_id": existing_text.id,
            "review_id": None
        }

    # 2b. Exact text check against pending review queue items (scoped safely by source)
    existing_pending_review = db.query(ReviewQueueModel).filter(
        ReviewQueueModel.raw_text == clean_text,
        ReviewQueueModel.source == source,
        ReviewQueueModel.status == "pending"
    ).first()
    if existing_pending_review:
        return {
            "status": "review_queue",
            "reason": "existing_review_item",
            "transaction_id": None,
            "duplicate_of_id": None,
            "review_id": existing_pending_review.id
        }

    # 3. Run through NLP pipeline without auto-committing
    pipeline_result = run_pipeline(clean_text, source=source, db=None)
    tx = pipeline_result.transaction
    metadata = pipeline_result.metadata

    # 4. Check for incomplete or ambiguous extractions
    is_complete = tx.is_complete and (tx.amount is not None) and (tx.transaction_type in ("DEBIT", "CREDIT", "REFUND"))
    if not is_complete:
        reason = "incomplete_transaction"
        if tx.amount is None:
            reason = "missing_amount"
        elif metadata.get("status") in ("failed", "failed_payment") or tx.transaction_type == "FAILED":
            reason = "failed_payment"
        elif tx.transaction_type not in ("DEBIT", "CREDIT", "REFUND"):
            reason = f"unsupported_type_{tx.transaction_type.lower()}"

        review_item = ReviewQueueModel(
            source=source,
            external_id=external_id,
            raw_text=clean_text,
            suggested_amount=tx.amount,
            suggested_currency=tx.currency,
            suggested_transaction_type=tx.transaction_type,
            suggested_merchant=tx.merchant_normalized or tx.merchant_raw,
            suggested_category=tx.category,
            suggested_date=tx.transaction_date or timestamp,
            reason=reason,
            status="pending"
        )
        db.add(review_item)
        db.commit()
        db.refresh(review_item)

        return {
            "status": "review_queue",
            "reason": reason,
            "transaction_id": None,
            "duplicate_of_id": None,
            "review_id": review_item.id,
            "pipeline_result": pipeline_result
        }

    # 5. Cross-source deduplication check
    matched_candidate = find_cross_source_match(
        db,
        amount=tx.amount,
        merchant_normalized=tx.merchant_normalized,
        tx_date=tx.transaction_date or timestamp,
        source=source
    )
    if matched_candidate:
        # Enrich the existing transaction if current source has a more specific merchant/category
        if (not matched_candidate.merchant_normalized or matched_candidate.merchant_normalized == "Miscellaneous") and tx.merchant_normalized:
            matched_candidate.merchant_normalized = tx.merchant_normalized
        if matched_candidate.category == "Miscellaneous" and tx.category and tx.category != "Miscellaneous":
            matched_candidate.category = tx.category
        db.commit()

        return {
            "status": "duplicate",
            "reason": "cross_source_match",
            "transaction_id": matched_candidate.id,
            "duplicate_of_id": matched_candidate.id,
            "review_id": None,
            "pipeline_result": pipeline_result
        }

    # 6. Save as review candidate if as_review is True (preserves user approval workflow)
    if as_review:
        review_item = ReviewQueueModel(
            source=source,
            external_id=external_id,
            raw_text=clean_text,
            suggested_amount=tx.amount,
            suggested_currency=tx.currency,
            suggested_transaction_type=tx.transaction_type,
            suggested_merchant=tx.merchant_normalized or tx.merchant_raw,
            suggested_category=tx.category,
            suggested_date=tx.transaction_date or timestamp,
            reason="pending_user_approval",
            status="pending"
        )
        db.add(review_item)
        db.commit()
        db.refresh(review_item)

        return {
            "status": "review_queue",
            "reason": "pending_user_approval",
            "transaction_id": None,
            "duplicate_of_id": None,
            "review_id": review_item.id,
            "pipeline_result": pipeline_result
        }

    # 7. Insert new verified transaction
    db_model = TransactionModel(
        raw_text=clean_text,
        amount=tx.amount,
        currency=tx.currency,
        transaction_type=tx.transaction_type,
        merchant_raw=tx.merchant_raw,
        merchant_normalized=tx.merchant_normalized,
        category=tx.category,
        confidence=tx.confidence,
        transaction_date=tx.transaction_date or timestamp,
        source=source,
        external_id=external_id,
        review_status="approved"
    )
    db.add(db_model)
    db.commit()
    db.refresh(db_model)

    return {
        "status": "inserted",
        "reason": "success",
        "transaction_id": db_model.id,
        "duplicate_of_id": None,
        "review_id": None,
        "pipeline_result": pipeline_result
    }


def ingest_batch(
    db: Session,
    items: List[BatchIngestItem],
    review_mode: bool = False
) -> BatchIngestResponse:
    """Process a batch of incoming messages sequentially with transactional safety."""
    results: List[BatchIngestItemResult] = []
    total = len(items)
    inserted = 0
    duplicates = 0
    review_queue = 0
    skipped = 0

    for idx, item in enumerate(items):
        try:
            item_as_review = review_mode or getattr(item, 'as_review', None) is True
            res = ingest_message(
                db=db,
                raw_text=item.text,
                source=item.source,
                external_id=item.external_id,
                timestamp=item.timestamp,
                as_review=item_as_review
            )
            st = res["status"]
            if st == "inserted":
                inserted += 1
            elif st == "duplicate":
                duplicates += 1
            elif st == "review_queue":
                review_queue += 1
            else:
                skipped += 1

            results.append(BatchIngestItemResult(
                index=idx,
                status=st,
                transaction_id=res.get("transaction_id"),
                duplicate_of_id=res.get("duplicate_of_id"),
                review_id=res.get("review_id"),
                reason=res.get("reason")
            ))
        except Exception as e:
            logger.error(f"Error ingesting item {idx}: {str(e)}")
            skipped += 1
            results.append(BatchIngestItemResult(
                index=idx,
                status="skipped",
                reason=f"exception: {str(e)}"
            ))

    return BatchIngestResponse(
        total_received=total,
        inserted=inserted,
        duplicates=duplicates,
        review_queue=review_queue,
        skipped=skipped,
        results=results
    )


def resolve_review_item(
    db: Session,
    review_id: int,
    action: str,
    amount: Optional[float] = None,
    merchant: Optional[str] = None,
    category: Optional[str] = None,
    transaction_type: Optional[str] = None
) -> Optional[TransactionModel]:
    """Approve or reject an item in the review queue."""
    item = db.query(ReviewQueueModel).filter(ReviewQueueModel.id == review_id).first()
    if not item:
        return None

    if action == "reject":
        item.status = "rejected"
        db.commit()
        return None

    if action == "approve":
        final_amount = amount if amount is not None else item.suggested_amount
        if final_amount is None:
            raise ValueError("Cannot approve transaction without an amount")

        resolved_type = transaction_type or getattr(item, "suggested_transaction_type", None) or "DEBIT"
        if resolved_type not in ("CREDIT", "DEBIT", "REFUND"):
            resolved_type = "DEBIT"

        tx = TransactionModel(
            raw_text=item.raw_text,
            amount=final_amount,
            currency=item.suggested_currency or "INR",
            transaction_type=resolved_type,
            merchant_raw=merchant or item.suggested_merchant,
            merchant_normalized=merchant or item.suggested_merchant,
            category=category or item.suggested_category or "Miscellaneous",
            confidence=1.0,  # User approved
            transaction_date=item.suggested_date or item.created_at,
            source=item.source,
            external_id=item.external_id,
            review_status="approved"
        )
        item.status = "approved"
        db.add(tx)
        db.commit()
        db.refresh(tx)
        return tx

    return None


def reprocess_anomalous_transactions(db: Session, dry_run: bool = True) -> Dict[str, Any]:
    """
    Safely scan existing stored transactions for known extraction anomalies:
    1. Implausible dates (e.g. year < 2015 or in future)
    2. Direction mismatches (e.g. account funding/credits mistakenly stored as DEBIT)
    3. Contaminated merchant names (Order No, Please Report, RRNs, emails)
    4. Failed payments stored as completed transactions

    Updates records in-place without creating duplicates or dropping records.
    """
    records = db.query(TransactionModel).all()
    updated_items = []

    for tx in records:
        if not tx.raw_text:
            continue

        pipeline_result = run_pipeline(tx.raw_text, source=tx.source or "email", db=None)
        new_tx = pipeline_result.transaction
        metadata = pipeline_result.metadata

        diffs = {}
        is_promo = metadata.get("is_promotional", False) or metadata.get("status") == "promotional"
        is_failed = metadata.get("status") == "failed_payment" or new_tx.transaction_type == "FAILED"

        # 1. Review status check for non-transactions (newsletters, loyalty points) or failed payments
        if is_promo or is_failed or not new_tx.is_complete:
            if tx.review_status != "needs_review":
                diffs["review_status"] = {"old": tx.review_status, "new": "needs_review"}

        # 2. Date check (only for genuine transactions)
        tx_dt = tx.transaction_date
        is_bad_date = tx_dt is None or tx_dt.year < 2015 or tx_dt.year > (datetime.utcnow().year + 1)
        if is_bad_date and not is_promo:
            fixed_date = new_tx.transaction_date or tx.created_at
            if fixed_date and (not tx_dt or tx_dt.isoformat() != fixed_date.isoformat()):
                diffs["transaction_date"] = {
                    "old": tx_dt.isoformat() if tx_dt else None,
                    "new": fixed_date.isoformat()
                }

        # 3. Transaction direction check (strictly preserve DEBIT/CREDIT schema enum, do not introduce FAILED)
        if not is_promo and not is_failed:
            if new_tx.transaction_type in ("CREDIT", "DEBIT") and new_tx.transaction_type != tx.transaction_type:
                diffs["transaction_type"] = {"old": tx.transaction_type, "new": new_tx.transaction_type}

        # 4. Merchant check:
        # Only propose merchant changes if:
        # a) Not promotional/failed
        # b) Existing merchant is noisy or placeholder (Order No, Please Report, RRN, help@, you earned in, slice bank account, sep 17, unknown)
        # c) New merchant is clean and not another noisy fragment
        if not is_promo and not is_failed:
            curr_merch = (tx.merchant_normalized or tx.merchant_raw or "").strip()
            curr_raw = (tx.merchant_raw or "").strip()

            is_noisy_existing = any(noise in curr_merch.lower() for noise in [
                "order no", "please report", "rrn", "help@", "if you", "you earned in", "slice bank account", "sep 17", "unknown merchant", "unknown"
            ]) or any(noise in curr_raw.lower() for noise in ["order no", "please report", "rrn"])

            new_merch = (new_tx.merchant_normalized or "").strip()
            is_new_noisy = any(noise in new_merch.lower() for noise in [
                "signup", "lower prices", "learn more", "for example", "rs ", "order no", "please report", "rrn"
            ])

            if is_noisy_existing and new_merch and not is_new_noisy and (new_merch != curr_merch or new_tx.merchant_raw != curr_raw):
                diffs["merchant_raw"] = {"old": tx.merchant_raw, "new": new_tx.merchant_raw}
                diffs["merchant_normalized"] = {"old": tx.merchant_normalized, "new": new_merch}

        # 5. Category check:
        if not is_promo and not is_failed:
            if new_tx.category and new_tx.category != "Miscellaneous" and tx.category != new_tx.category:
                diffs["category"] = {"old": tx.category, "new": new_tx.category}

        # 6. Confidence check:
        if not is_promo and not is_failed:
            if round(tx.confidence, 2) != round(new_tx.confidence, 2) and tx.review_status != "approved":
                diffs["confidence"] = {"old": tx.confidence, "new": new_tx.confidence}

        if diffs:
            updated_items.append({
                "transaction_id": tx.id,
                "diffs": diffs
            })

            if not dry_run:
                if "transaction_date" in diffs:
                    tx.transaction_date = new_tx.transaction_date or tx.created_at
                if "transaction_type" in diffs:
                    tx.transaction_type = diffs["transaction_type"]["new"]
                if "review_status" in diffs:
                    tx.review_status = diffs["review_status"]["new"]
                if "merchant_raw" in diffs:
                    tx.merchant_raw = diffs["merchant_raw"]["new"]
                if "merchant_normalized" in diffs:
                    tx.merchant_normalized = diffs["merchant_normalized"]["new"]
                if "category" in diffs:
                    tx.category = diffs["category"]["new"]
                if "confidence" in diffs and tx.review_status != "approved":
                    tx.confidence = diffs["confidence"]["new"]

    if not dry_run and updated_items:
        db.commit()

    return {
        "dry_run": dry_run,
        "total_scanned": len(records),
        "anomalies_found": len(updated_items),
        "updated_items": updated_items
    }

