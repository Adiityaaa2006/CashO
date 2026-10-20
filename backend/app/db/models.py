from sqlalchemy import Column, Integer, String, Float, DateTime, Text
from datetime import datetime
from app.db.database import Base

class TransactionModel(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    raw_text = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    currency = Column(String, default="INR")
    transaction_type = Column(String, default="DEBIT")
    merchant_raw = Column(String, nullable=True)
    merchant_normalized = Column(String, nullable=True)
    category = Column(String, default="Miscellaneous")
    confidence = Column(Float, default=0.0)
    transaction_date = Column(DateTime, nullable=True, default=None)
    created_at = Column(DateTime, default=datetime.utcnow)
    source = Column(String, default="manual", nullable=True)
    external_id = Column(String, nullable=True, index=True)
    review_status = Column(String, default="approved", nullable=True)


class SyncConnectionModel(Base):
    __tablename__ = "sync_connections"

    id = Column(Integer, primary_key=True, index=True)
    provider = Column(String, unique=True, index=True, nullable=False)  # "gmail", "android"
    status = Column(String, default="disconnected")  # "connected", "disconnected", "error", "syncing"
    encrypted_credentials = Column(Text, nullable=True)  # Fernet encrypted JSON / tokens
    last_synced_at = Column(DateTime, nullable=True)
    sync_cursor = Column(String, nullable=True)  # history_id for Gmail or last timestamp for Android
    error_message = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ReviewQueueModel(Base):
    __tablename__ = "review_queue"

    id = Column(Integer, primary_key=True, index=True)
    source = Column(String, default="unknown")  # "gmail", "android", "sms", "email"
    external_id = Column(String, nullable=True, index=True)
    raw_text = Column(Text, nullable=False)
    suggested_amount = Column(Float, nullable=True)
    suggested_currency = Column(String, default="INR")
    suggested_transaction_type = Column(String, default="UNKNOWN", nullable=True)
    suggested_merchant = Column(String, nullable=True)
    suggested_category = Column(String, nullable=True)
    suggested_date = Column(DateTime, nullable=True)
    reason = Column(String, nullable=False)  # "missing_amount", "unknown_direction", "low_confidence", "cross_source_candidate"
    status = Column(String, default="pending")  # "pending", "approved", "rejected"
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
