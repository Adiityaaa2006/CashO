from sqlalchemy import Column, Integer, String, Float, DateTime
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
