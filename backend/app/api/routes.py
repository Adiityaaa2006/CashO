from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional

from app.schemas import (
    ParseRequest,
    PipelineResult,
    TransactionResponse,
    SummaryResponse,
    RuleTraceItem,
)
from app.db.database import get_db
from app.services.pipeline import run_pipeline

router = APIRouter()


def get_confirmed_filter():
    """Consistent definition of confirmed transactions across reporting endpoints.
    Includes approved transactions and legacy NULL records, while strictly excluding
    records marked 'needs_review', 'pending', or 'rejected'.
    """
    from app.db.models import TransactionModel
    return or_(
        TransactionModel.review_status.notin_(["needs_review", "pending", "rejected"]),
        TransactionModel.review_status.is_(None)
    )


@router.post("/parse", response_model=PipelineResult)
def parse_text(request: ParseRequest, db: Session = Depends(get_db)):
    """Parse raw SMS or email, run NLP extraction and AI reasoning rules."""
    result = run_pipeline(request.text, source=request.source, db=db)
    return result


@router.get("/transactions", response_model=List[TransactionResponse])
def get_transactions(
    skip: int = 0,
    limit: int = 100,
    review_status: Optional[str] = Query(None, description="Filter by review status ('approved', 'needs_review', 'all'). Defaults to confirmed transactions."),
    db: Session = Depends(get_db)
):
    """Retrieve list of confirmed transactions (excluding unreviewed/rejected records by default)."""
    from app.db.models import TransactionModel
    query = db.query(TransactionModel)

    if review_status == "all":
        pass
    elif review_status:
        query = query.filter(TransactionModel.review_status == review_status)
    else:
        query = query.filter(get_confirmed_filter())

    items = query.order_by(TransactionModel.id.desc()).offset(skip).limit(limit).all()
    return items


@router.get("/summary", response_model=SummaryResponse)
def get_summary(db: Session = Depends(get_db)):
    """Retrieve summary of total spent, income, and category breakdown strictly for confirmed transactions."""
    from app.db.models import TransactionModel
    transactions = db.query(TransactionModel).filter(get_confirmed_filter()).all()
    
    total_spent = sum(t.amount for t in transactions if t.transaction_type == "DEBIT" and t.amount is not None)
    total_income = sum(t.amount for t in transactions if t.transaction_type == "CREDIT" and t.amount is not None)
    
    category_breakdown = {}
    for t in transactions:
        if t.transaction_type == "DEBIT" and t.amount is not None:
            category_breakdown[t.category] = category_breakdown.get(t.category, 0.0) + t.amount

    return SummaryResponse(
        total_spent=total_spent,
        total_income=total_income,
        category_breakdown=category_breakdown,
        transaction_count=len(transactions)
    )

@router.get("/advice", response_model=List[RuleTraceItem])
def get_advice(db: Session = Depends(get_db)):
    """Retrieve advice triggered across recent transactions."""
    from app.ai.rules import evaluate_global_rules
    return evaluate_global_rules(db)
