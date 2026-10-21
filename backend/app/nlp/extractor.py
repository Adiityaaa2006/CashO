import re
from typing import Optional, Dict, Any, Tuple
from datetime import datetime
from dateutil import parser as date_parser

def extract_amount(text: str) -> Optional[float]:
    """
    Extract transaction amount using regex patterns for INR / USD etc.
    Prioritizes explicit transaction amounts over balance figures.
    """
    # 1. Look for explicit transaction amount anchors first
    anchor_pattern = r'(?:amount|paid|debited|credited|spent|added|total|order value|txn amt|rs\.?|inr|₹)\s*[:\-]?\s*(?:rs\.?|inr|₹|\$|usd)?\s*([0-9]+(?:,[0-9]+)*(?:\.[0-9]{1,2})?)(?![a-zA-Z0-9])'
    anchor_match = re.search(anchor_pattern, text, re.IGNORECASE)
    if anchor_match:
        try:
            val = float(anchor_match.group(1).replace(',', ''))
            if val > 0:
                return val
        except ValueError:
            pass

    # 2. General currency pattern fallback
    pattern = r'(?:Rs\.?|INR|₹|USD|\$)\s*([0-9]+(?:,[0-9]+)*(?:\.[0-9]{1,2})?)(?![a-zA-Z0-9])'
    match = re.search(pattern, text, re.IGNORECASE)
    if match:
        try:
            return float(match.group(1).replace(',', ''))
        except ValueError:
            return None
    return None


def extract_transaction_type(text: str) -> str:
    """
    Detect transaction direction: DEBIT, CREDIT, REFUND, FAILED, or UNKNOWN.
    Contextually analyzes banking, wallet, and ecommerce patterns while rejecting ambiguous signals.
    """
    text_lower = text.lower()

    # 1. Failed, declined, or cancelled transactions
    failed_patterns = [
        r'\b(?:failed|declined|unsuccessful|cancelled|canceled|rejected|could not be processed|failure)\b',
        r'\b(?:payment\s+was\s+not\s+successful|transaction\s+failed|failed\s+to\s+debit)\b'
    ]
    for pat in failed_patterns:
        if re.search(pat, text_lower):
            return "FAILED"

    # 2. Refunds and reversals (credits back to account)
    # Exclude policy boilerplate like "refund policy"
    text_clean_refund = re.sub(r'\brefunds?\s+policy\b', '', text_lower)
    refund_patterns = [
        r'\b(?:refund|reversed|reversal|refunded|cashback|cash\s+back)\b',
        r'\b(?:refund\s+of|refund\s+initiated|refund\s+processed|amount\s+refunded)\b'
    ]
    for pat in refund_patterns:
        if re.search(pat, text_clean_refund):
            return "REFUND"

    # 3. Credits / Account additions / Wallet top-ups
    credit_patterns = [
        # Explicit credit verbs
        r'\b(?:credited\s+(?:to|with|in)|has\s+been\s+credited)\b',
        r'\b(?:deposited\s+(?:to|in)|has\s+been\s+deposited)\b',
        # Wallet / Account funding ("added to slice bank account", "money added to wallet", "added to your account")
        r'\b(?:added\s+to\s+(?:your\s+)?(?:slice|bank|account|wallet|balance|card))\b',
        r'\b(?:money\s+added|amount\s+added|funds\s+added|top-?up\s+successful|loaded\s+(?:to|in))\b',
        # P2P / UPI received ("received from <name>", "payment received from", "amount received from")
        r'\b(?:received\s+from|payment\s+received\s+from|amount\s+received\s+from|received\s+in\s+your)\b',
        # Salary / interest / income
        r'\b(?:salary\s+credited|interest\s+credited|earned\s+in\s+interest|dividend\s+credited)\b'
    ]
    for pat in credit_patterns:
        if re.search(pat, text_lower):
            return "CREDIT"

    # 4. Debits / Purchases / Payments
    debit_patterns = [
        r'\b(?:debited\s+(?:from|by|with)|has\s+been\s+debited)\b',
        r'\b(?:paid\s+(?:to|for|at|online)|payment\s+(?:to|for|at|successful\s+for|made\s+to))\b',
        r'\b(?:spent\s+(?:on|at)|withdrawn\s+(?:from|at)|sent\s+to|transferred\s+to)\b',
        r'\b(?:sent|transferred)\s+(?:rs\.?|inr)?\s*[\d,]+(?:\.\d{1,2})?\s+to\b',
        r'\b(?:order\s+(?:placed|confirmed|confirmation|received)|thank\s+you\s+for\s+your\s+order)\b',
        r'\b(?:purchase\s+(?:at|of|on|from)|made\s+a\s+purchase|billed\s+to|charged\s+to)\b'
    ]
    for pat in debit_patterns:
        if re.search(pat, text_lower):
            return "DEBIT"

    # 5. Fallback context clues (only when explicit verbs are absent)
    if re.search(r'\b(?:added\s+to|credited)\b', text_lower):
        return "CREDIT"
    if re.search(r'\b(?:debited|paid|spent|withdrawn)\b', text_lower):
        return "DEBIT"

    # Genuinely ambiguous / unknown direction (never silently assume DEBIT)
    return "UNKNOWN"


def extract_date(text: str) -> Optional[datetime]:
    """
    Extract transaction date if explicitly present in the financial message body.
    Filters out password disclaimers, DOB examples, and implausible years (< 2015).
    """
    current_year = datetime.utcnow().year

    # 1. Anchor-based transaction date patterns (highest confidence)
    anchored_patterns = [
        r'(?:transaction\s+date|paid\s+on|txn\s+date|dated|order\s+date|date\s*[:\-])\s*([0-9]{1,2}[-/][0-9]{1,2}[-/][0-9]{2,4})',
        r'(?:transaction\s+date|paid\s+on|txn\s+date|dated|order\s+date|date\s*[:\-])\s*([0-9]{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*,?\s*[0-9]{2,4})',
        r'(?:transaction\s+date|paid\s+on|txn\s+date|dated|order\s+date|date\s*[:\-])\s*([A-Za-z]{3}\s+[0-9]{1,2},?\s+[0-9]{2,4})',
        r'(?:transaction\s+date|paid\s+on|txn\s+date|dated|order\s+date|date\s*[:\-])\s*([0-9]{1,2}-(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-[0-9]{2,4})'
    ]
    for pat in anchored_patterns:
        match = re.search(pat, text, re.IGNORECASE)
        if match:
            date_str = match.group(1).strip()
            try:
                dt = date_parser.parse(date_str)
                if 2015 <= dt.year <= (current_year + 1):
                    return dt
            except Exception:
                pass

    # 2. General date patterns, strictly rejecting DOB / password / example contexts
    general_patterns = [
        r'\b(\d{1,2}-(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-?\d{2,4})\b',
        r'\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{2,4})\b',
        r'\b(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\b',
    ]

    for pat in general_patterns:
        for match in re.finditer(pat, text, re.IGNORECASE):
            # Check surrounding context for DOB / password / example indicators
            start_pos = max(0, match.start() - 50)
            end_pos = min(len(text), match.end() + 30)
            context = text[start_pos:end_pos].lower()

            if any(k in context for k in ["dob", "date of birth", "password", "for example", "e.g.", "sample", "format", "ddmmyyyy"]):
                continue

            date_str = match.group(1).strip()
            try:
                dt = date_parser.parse(date_str)
                # Ensure plausible year
                if 2015 <= dt.year <= (current_year + 1):
                    return dt
            except Exception:
                pass

    return None


def extract_merchant_candidate(text: str) -> Optional[str]:
    """
    Extract candidate merchant or payee string cleanly without noise words,
    order IDs, reference numbers, or email addresses.
    """
    patterns = [
        r'\b(?:paid to|paid for|payment to|payment for|payment successful for)\s+([A-Za-z0-9&\.\-_@]+(?:\s+[A-Za-z0-9&\.\-_@]+){0,3})',
        r'\b(?:trf to|transferred to|sent to)\s+([A-Za-z0-9&\.\-_@]+(?:\s+[A-Za-z0-9&\.\-_@]+){0,3})',
        r'\b(?:received from|refund from|refund of.*?from|credited from)\s+([A-Za-z0-9&\.\-_@]+(?:\s+[A-Za-z0-9&\.\-_@]+){0,2})',
        r'\b(?:order at|order on|order from|purchase at|purchase from)\s+([A-Za-z0-9&\.\-_@]+(?:\s+[A-Za-z0-9&\.\-_@]+){0,4})',
        r'\b(?:at|vpa|info)\s+([A-Za-z0-9&\.\-_@]+(?:\s+[A-Za-z0-9&\.\-_@]+){0,2})',
        r'\b(?:to)\s+([A-Za-z0-9&\.\-_@]+(?:\s+[A-Za-z0-9&\.\-_@]+){0,3})',
        r'\b(?:from)\s+([A-Za-z0-9&\.\-_@]+(?:\s+[A-Za-z0-9&\.\-_@]+){0,2})',
    ]

    NOISE_PHRASES = [
        r'\b(?:order\s*(?:no\.?|#|id)?[:\-]?\s*[\w\-]+)',
        r'\b(?:please\s+report.*)',
        r'\b(?:into\s+(?:your\s+)?(?:account|a/c|wallet|bank|balance).*)',
        r'\b(?:to\s+(?:your\s+)?(?:account|a/c|wallet|bank|balance).*)',
        r'\b(?:rrn\b.*)',
        r'\b(?:ref\s*(?:no\.?)?\b.*)',
        r'\b(?:utr\b.*)',
        r'\b(?:upi\b.*)',
        r'\b(?:via\b.*)',
        r'\b(?:using\b.*)',
        r'\b(?:through\b.*)',
        r'\b(?:on\s+(?:your\s+)?(?:account|a/c|wallet|card|bank).*)',
        r'\b(?:if\s+you.*)',
        r'\b(?:txn\s*(?:id|no\.?)?\b.*)',
        r'\b(?:help@[\w\.-]+)',
        r'\b(?:support@[\w\.-]+)',
        r'\b(?:best\s*,?\s*team.*)',
        r'\b(?:team\s+slice.*)',
        r'\b(?:thank\s+you.*)',
        r'\b(?:view\s+order.*)',
    ]

    for pattern in patterns:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            raw_candidate = match.group(1).strip()

            # Clean out known noise patterns
            for noise in NOISE_PHRASES:
                raw_candidate = re.sub(noise, '', raw_candidate, flags=re.IGNORECASE).strip()

            # Clean out email addresses
            raw_candidate = re.sub(r'[\w\.-]+@[\w\.-]+', '', raw_candidate).strip()

            # Clean punctuation and trailing symbols
            raw_candidate = re.sub(r'[,\.:;\-_&]+$', '', raw_candidate).strip()
            raw_candidate = re.sub(r'^[,\.:;\-_&]+', '', raw_candidate).strip()

            # Strip trailing connecting prepositions/noise words
            raw_candidate = re.sub(r'\s+(?:on|at|for|via|in|by|to|from|with)$', '', raw_candidate, flags=re.IGNORECASE).strip()

            cand_lower = raw_candidate.lower()

            # Ignore structural, generic, infinitive verbs, or masked identifiers
            infinitive_verbs = ('open', 'view', 'download', 'use', 'access', 'get', 'know', 'verify', 'check', 'pay', 'see', 'learn', 'read', 'contact', 'click', 'drop', 'visit', 'shop', 'find', 'talk')
            if any(cand_lower.startswith(v + ' ') or cand_lower == v for v in infinitive_verbs):
                continue
            if any(cand_lower.startswith(p) for p in [
                'a/c', 'acct', 'card', '[masked', 'account', 'your ', 'my ', 'our ', 'the ', 'for example', 'open it'
            ]):
                continue
            if cand_lower in [
                'account', 'a/c', 'card', 'bank', 'avl', 'bal', 'balance', 'it', 'us',
                'here', 'there', 'you', 'talk to us', 'open it', 'slice bank account',
                'it. for example', 'for example'
            ]:
                continue
            if len(raw_candidate) < 2:
                continue

            return raw_candidate

    return None


def extract_entities(text: str) -> Dict[str, Any]:
    """Orchestrate extraction of amount, type, merchant candidate, and date with field-level confidences."""
    amount = extract_amount(text)
    txn_type = extract_transaction_type(text)
    merchant = extract_merchant_candidate(text)
    dt = extract_date(text)

    # Field-level calibrated confidences
    conf_amount = 1.0 if (amount is not None and amount > 0) else 0.0
    conf_type = 1.0 if txn_type in ["DEBIT", "CREDIT", "REFUND"] else (0.5 if txn_type == "FAILED" else 0.0)
    conf_date = 1.0 if dt is not None else 0.0
    conf_merchant = 0.8 if (merchant and len(merchant) >= 3) else 0.0

    return {
        "amount": amount,
        "transaction_type": txn_type,
        "merchant_candidate": merchant,
        "transaction_date": dt,
        "field_confidences": {
            "amount": conf_amount,
            "transaction_type": conf_type,
            "date": conf_date,
            "merchant": conf_merchant
        }
    }
