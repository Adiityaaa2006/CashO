import re
from typing import Optional, Dict, Any
from datetime import datetime
from dateutil import parser as date_parser

def extract_amount(text: str) -> Optional[float]:
    """Extract transaction amount using regex patterns for INR / USD etc."""
    pattern = r'(?:Rs\.?|INR|₹|USD|\$)\s*([0-9]+(?:,[0-9]+)*(?:\.[0-9]{1,2})?)'
    match = re.search(pattern, text, re.IGNORECASE)
    if match:
        amt_str = match.group(1).replace(',', '')
        try:
            return float(amt_str)
        except ValueError:
            return None
    return None

def extract_transaction_type(text: str) -> str:
    """Detect whether transaction is DEBIT or CREDIT."""
    credit_keywords = ['credited', 'received', 'refund', 'deposited', 'salary']
    debit_keywords = ['debited', 'spent', 'paid', 'withdrawn', 'purchase', 'sent']
    
    text_lower = text.lower()
    for kw in credit_keywords:
        if kw in text_lower:
            return "CREDIT"
    for kw in debit_keywords:
        if kw in text_lower:
            return "DEBIT"
    return "DEBIT"

def extract_merchant_candidate(text: str) -> Optional[str]:
    """Extract candidate merchant string using prepositions and patterns."""
    patterns = [
        r'(?:at|to|vpa|info|trf to)\s+([A-Za-z0-9&\.\-_@]+(?:\s+[A-Za-z0-9&\.\-_@]+){0,2})',
        r'paid to\s+([A-Za-z0-9&\.\-_@]+)',
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            candidate = match.group(1).strip()
            candidate = re.sub(r'[,\.]+$', '', candidate)
            return candidate
    return None

def extract_date(text: str) -> Optional[datetime]:
    """Extract date if present, else fallback to current timestamp."""
    date_patterns = [
        r'\b(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\b',
        r'\b(\d{1,2}-(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-?\d{2,4})\b',
    ]
    for pat in date_patterns:
        match = re.search(pat, text, re.IGNORECASE)
        if match:
            try:
                return date_parser.parse(match.group(1))
            except Exception:
                pass
    return datetime.utcnow()

def extract_entities(text: str) -> Dict[str, Any]:
    """Orchestrate extraction of amount, type, merchant candidate, and date."""
    return {
        "amount": extract_amount(text) or 0.0,
        "transaction_type": extract_transaction_type(text),
        "merchant_candidate": extract_merchant_candidate(text),
        "transaction_date": extract_date(text),
    }
