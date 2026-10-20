import logging
from typing import List, Optional, Dict, Any
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, Header, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import SyncConnectionModel, ReviewQueueModel, TransactionModel
from app.config import settings
from app.services.crypto import encrypt_json
from app.services.gmail_sync import get_authorization_url, exchange_code_for_tokens, sync_gmail
from app.services.ingestion import ingest_batch, resolve_review_item, reprocess_anomalous_transactions
from app.schemas import (
    BatchIngestRequest,
    BatchIngestResponse,
    SyncConnectionResponse,
    ReviewItemResponse,
    ReviewResolveRequest,
    TransactionResponse
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sync", tags=["sync"])


@router.get("/status")
def get_sync_status(db: Session = Depends(get_db)):
    """Retrieve current synchronization status for Gmail and Android companion."""
    gmail_conn = db.query(SyncConnectionModel).filter(SyncConnectionModel.provider == "gmail").first()
    android_conn = db.query(SyncConnectionModel).filter(SyncConnectionModel.provider == "android").first()
    review_count = db.query(ReviewQueueModel).filter(ReviewQueueModel.status == "pending").count()

    return {
        "gmail": {
            "connected": gmail_conn.status == "connected" if gmail_conn else False,
            "status": gmail_conn.status if gmail_conn else "disconnected",
            "last_synced_at": gmail_conn.last_synced_at if gmail_conn else None,
            "error_message": gmail_conn.error_message if gmail_conn else None
        },
        "android": {
            "connected": android_conn.status == "connected" if android_conn else False,
            "status": android_conn.status if android_conn else "disconnected",
            "last_synced_at": android_conn.last_synced_at if android_conn else None,
            "error_message": android_conn.error_message if android_conn else None
        },
        "review_queue_pending_count": review_count
    }


@router.get("/gmail/auth-url")
def get_gmail_auth_url():
    """Generate Google OAuth consent URL for Gmail read-only access."""
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google OAuth Client ID and Secret are not configured in settings."
        )
    try:
        auth_url, state = get_authorization_url()
        return {"auth_url": auth_url, "state": state}
    except Exception as e:
        logger.error(f"Failed to generate Gmail OAuth URL: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/gmail/callback")
def gmail_oauth_callback(
    code: str = Query(..., description="OAuth authorization code"),
    state: Optional[str] = Query(None, description="OAuth state parameter"),
    db: Session = Depends(get_db)
):
    """Handle OAuth redirect, securely exchange and encrypt credentials at rest."""
    if not state:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OAuth exchange failed: Missing OAuth state parameter."
        )
    try:
        token_data = exchange_code_for_tokens(code, state)
        encrypted_creds = encrypt_json(token_data)

        conn = db.query(SyncConnectionModel).filter(SyncConnectionModel.provider == "gmail").first()
        if not conn:
            conn = SyncConnectionModel(provider="gmail")
            db.add(conn)

        conn.status = "connected"
        conn.encrypted_credentials = encrypted_creds
        conn.error_message = None
        db.commit()

        return {"status": "success", "message": "Gmail connected successfully"}
    except Exception as e:
        logger.error(f"Gmail OAuth exchange failed: {str(e)}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"OAuth exchange failed: {str(e)}")


@router.post("/gmail/disconnect")
def disconnect_gmail(db: Session = Depends(get_db)):
    """Revoke and delete stored Gmail tokens."""
    conn = db.query(SyncConnectionModel).filter(SyncConnectionModel.provider == "gmail").first()
    if conn:
        conn.status = "disconnected"
        conn.encrypted_credentials = None
        conn.sync_cursor = None
        db.commit()
    return {"status": "success", "message": "Gmail disconnected"}


@router.post("/gmail/trigger", response_model=BatchIngestResponse)
def trigger_gmail_sync(
    max_messages: int = Query(50, ge=1, le=200),
    force_full: bool = Query(False),
    db: Session = Depends(get_db)
):
    """Trigger manual or incremental synchronization from Gmail."""
    try:
        return sync_gmail(db, max_messages=max_messages, force_full=force_full)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"Error during Gmail sync: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Sync error: {str(e)}")


@router.post("/android/ingest", response_model=BatchIngestResponse)
def ingest_android_sms(
    batch: BatchIngestRequest,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """
    Secure endpoint for the Android companion application to push filtered bank SMS.
    Requires Bearer API token configured in settings.
    """
    expected_token = f"Bearer {settings.ANDROID_API_KEY}"
    if not authorization or authorization.strip() != expected_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing companion authorization token."
        )

    response = ingest_batch(db, batch.items)

    # Upsert Android connection state
    conn = db.query(SyncConnectionModel).filter(SyncConnectionModel.provider == "android").first()
    if not conn:
        conn = SyncConnectionModel(provider="android")
        db.add(conn)

    conn.status = "connected"
    conn.last_synced_at = datetime.utcnow()
    conn.error_message = None
    db.commit()

    return response


@router.post("/reprocess")
def reprocess_transactions_endpoint(
    dry_run: bool = Query(True, description="When true, only report changes without modifying database"),
    db: Session = Depends(get_db)
):
    """Safely detect and reprocess historical anomalous transactions in-place without duplicating records."""
    try:
        return reprocess_anomalous_transactions(db, dry_run=dry_run)
    except Exception as e:
        logger.error(f"Error during transaction reprocessing: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# Review Queue Endpoints
review_router = APIRouter(prefix="/api/review", tags=["review"])


@review_router.get("", response_model=List[ReviewItemResponse])
def get_review_items(
    status_filter: str = Query("pending", description="'pending', 'approved', 'rejected', or 'all'"),
    db: Session = Depends(get_db)
):
    """Fetch transactions awaiting user confirmation or disambiguation."""
    query = db.query(ReviewQueueModel)
    if status_filter != "all":
        query = query.filter(ReviewQueueModel.status == status_filter)
    return query.order_by(ReviewQueueModel.created_at.desc()).all()


@review_router.post("/{review_id}/resolve")
def resolve_review(
    review_id: int,
    req: ReviewResolveRequest,
    db: Session = Depends(get_db)
):
    """Approve or reject an ambiguous item from the review queue."""
    try:
        tx = resolve_review_item(
            db,
            review_id=review_id,
            action=req.action,
            amount=req.amount,
            merchant=req.merchant,
            category=req.category,
            transaction_type=req.transaction_type
        )
        if req.action == "reject":
            return {"status": "rejected", "message": "Transaction rejected."}
        if not tx:
            raise HTTPException(status_code=404, detail="Review item not found.")
        return {"status": "approved", "transaction_id": tx.id}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Failed to resolve review item {review_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
