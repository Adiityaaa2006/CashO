from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class ParseRequest(BaseModel):
    text: str = Field(..., description="Raw SMS or Email text to parse")
    source: str = Field("sms", description="'sms', 'email', 'gmail', or 'android'")

class TransactionBase(BaseModel):
    amount: Optional[float] = None
    currency: str = "INR"
    transaction_type: str = "DEBIT"  # DEBIT or CREDIT
    merchant_raw: Optional[str] = None
    merchant_normalized: Optional[str] = None
    category: Optional[str] = "Miscellaneous"
    confidence: float = 0.0
    transaction_date: Optional[datetime] = None
    is_complete: bool = True
    source: Optional[str] = "manual"
    external_id: Optional[str] = None
    review_status: Optional[str] = "approved"

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

# Ingestion & Sync Schemas
class BatchIngestItem(BaseModel):
    text: str = Field(..., description="Raw text of SMS or email")
    source: str = Field("sms", description="Source provider: 'sms', 'email', 'gmail', 'android'")
    external_id: Optional[str] = Field(None, description="External message ID (e.g. Gmail message ID or Android SMS ID)")
    timestamp: Optional[datetime] = Field(None, description="Message arrival or delivery timestamp")
    as_review: Optional[bool] = Field(None, description="Force route candidate to review queue for user approval")

class BatchIngestRequest(BaseModel):
    items: List[BatchIngestItem]

class BatchIngestItemResult(BaseModel):
    index: int
    status: str  # "inserted", "duplicate", "review_queue", "skipped"
    transaction_id: Optional[int] = None
    duplicate_of_id: Optional[int] = None
    review_id: Optional[int] = None
    reason: Optional[str] = None

class BatchIngestResponse(BaseModel):
    total_received: int
    inserted: int
    duplicates: int
    review_queue: int
    skipped: int
    results: List[BatchIngestItemResult]

class SyncConnectionResponse(BaseModel):
    id: int
    provider: str
    status: str
    last_synced_at: Optional[datetime] = None
    error_message: Optional[str] = None

    class Config:
        from_attributes = True

class ReviewItemResponse(BaseModel):
    id: int
    source: str
    external_id: Optional[str] = None
    raw_text: str
    suggested_amount: Optional[float] = None
    suggested_currency: str = "INR"
    suggested_transaction_type: Optional[str] = "UNKNOWN"
    suggested_merchant: Optional[str] = None
    suggested_category: Optional[str] = None
    suggested_date: Optional[datetime] = None
    reason: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class ReviewResolveRequest(BaseModel):
    action: str = Field(..., description="'approve' or 'reject'")
    amount: Optional[float] = None
    merchant: Optional[str] = None
    category: Optional[str] = None
    transaction_type: Optional[str] = None
