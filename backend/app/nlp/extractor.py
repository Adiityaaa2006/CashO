import re
from typing import Optional, Dict, Any
from datetime import datetime
from dateutil import parser as date_parser

def extract_amount(text: str) -> Optional[float]:
    """Extract transaction amount using regex patterns for INR / USD etc."""
    # Matches currency symbol followed by amount, ensuring no trailing alphanumeric characters (e.g. rejecting INR 500xyz)
    pattern = r'(?:Rs\.?|INR|₹|USD|\$)\s*([0-9]+(?:,[0-9]+)*(?:\.[0-9]{1,2})?)(?![a-zA-Z0-9])'
    match = re.search(pattern, text, re.IGNORECASE)
    if match:
        amt_str = match.group(1).replace(',', '')
        try:
            return float(amt_str)
        except ValueError:
            return None
    return None

def extract_transaction_type(text: str) -> str:
    """Detect whether transaction is DEBIT, CREDIT, FAILED, or UNKNOWN."""
    text_lower = text.lower()
    
    # 1. Failed or declined payments
    failed_keywords = ['failed', 'declined', 'unsuccessful', 'cancelled', 'rejected']
    for kw in failed_keywords:
        if kw in text_lower:
            return "FAILED"

    # 2. Refunds and reversals are credits back to account
    refund_keywords = ['refund', 'reversed', 'reversal']
    for kw in refund_keywords:
        if kw in text_lower:
            return "CREDIT"

    # 3. Standard credit indicators
    credit_keywords = ['credited', 'received', 'deposited', 'salary']
    for kw in credit_keywords:
        if kw in text_lower:
            return "CREDIT"

    # 4. Standard debit indicators
    debit_keywords = ['debited', 'spent', 'paid', 'withdrawn', 'purchase', 'sent']
    for kw in debit_keywords:
        if kw in text_lower:
            return "DEBIT"

    # 5. Ambiguous / unknown direction (never silently assume DEBIT)
    return "UNKNOWN"

def extract_merchant_candidate(text: str) -> Optional[str]:
    """Extract candidate merchant string using prepositions and patterns."""
    patterns = [
        r'(?:paid to|paid for)\s+([A-Za-z0-9&\.\-_@]+(?:\s+[A-Za-z0-9&\.\-_@]+){0,2})',
        r'(?:at|vpa|info|trf to)\s+([A-Za-z0-9&\.\-_@]+(?:\s+[A-Za-z0-9&\.\-_@]+){0,2})',
        r'(?:to|from)\s+([A-Za-z0-9&\.\-_@]+(?:\s+[A-Za-z0-9&\.\-_@]+){0,2})',
    ]
    for pattern in patterns:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            candidate = match.group(1).strip()
            candidate = re.sub(r'[,\.]+$', '', candidate)
            cand_lower = candidate.lower()
            # Ignore account, card, or masked identifiers
            if any(cand_lower.startswith(p) for p in ['a/c', 'acct', 'card', '[masked', 'account', 'your ']):
                continue
            if cand_lower in ['account', 'a/c', 'card', 'bank', 'avl']:
                continue
            return candidate
    return None

def extract_date(text: str) -> Optional[datetime]:
    """Extract date if present in text, else return None (never fabricate dates)."""
    date_patterns = [
        r'\b(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\b',
        r'\b(\d{1,2}-(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-?\d{2,4})\b',
        r'\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{2,4})\b',
    ]
    for pat in date_patterns:
        match = re.search(pat, text, re.IGNORECASE)
        if match:
            try:
                return date_parser.parse(match.group(1))
            except Exception:
                pass
    return None

def extract_entities(text: str) -> Dict[str, Any]:
    """Orchestrate extraction of amount, type, merchant candidate, and date."""
    amount = extract_amount(text)
    return {
        "amount": amount,
        "transaction_type": extract_transaction_type(text),
        "merchant_candidate": extract_merchant_candidate(text),
        "transaction_date": extract_date(text),
    }
