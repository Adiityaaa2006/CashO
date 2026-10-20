from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class ParseRequest(BaseModel):
    text: str = Field(..., description="Raw SMS or Email text to parse")
    source: str = Field("sms", description="'sms' or 'email'")

class TransactionBase(BaseModel):
    amount: float
    currency: str = "INR"
    transaction_type: str = "DEBIT"  # DEBIT or CREDIT
    merchant_raw: Optional[str] = None
    merchant_normalized: Optional[str] = None
    category: Optional[str] = "Miscellaneous"
    confidence: float = 0.0
    transaction_date: Optional[datetime] = None

class TransactionCreate(TransactionBase):
    raw_text: str

class TransactionResponse(TransactionBase):
    id: int
    raw_text: str
    created_at: datetime

    class Config:
        from_attributes = True

class RuleTraceItem(BaseModel):
    rule_name: str
    description: str
    recommendation: str
    severity: str = "info"

class PipelineResult(BaseModel):
    transaction: TransactionBase
    rule_traces: List[RuleTraceItem] = []
    metadata: Dict[str, Any] = {}

class SummaryResponse(BaseModel):
    total_spent: float
    total_income: float
    category_breakdown: Dict[str, float]
    transaction_count: int
