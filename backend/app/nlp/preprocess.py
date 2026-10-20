import re

def mask_account_numbers(text: str) -> str:
    """Mask account/card numbers (e.g., 'A/c XX1234' or 'card ending 5678')."""
    text = re.sub(r'(\b(?:A/c|Acct|card|Account|ending)\s*[:#\-]?\s*(?:no\.?\s*)?)[X*\d]+(\d{4})', r'\1[MASKED_\2]', text, flags=re.IGNORECASE)
    return text

def mask_phone_numbers(text: str) -> str:
    """Mask 10-digit telephone numbers."""
    text = re.sub(r'(\b(?:\+91|0)?[6-9]\d{9}\b)', '[PHONE_MASKED]', text)
    return text

def clean_text(text: str) -> str:
    """Standardize whitespace and remove non-printable control characters."""
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def preprocess_message(text: str) -> str:
    """Anonymize and clean raw SMS or email."""
    cleaned = clean_text(text)
    masked = mask_account_numbers(cleaned)
    masked = mask_phone_numbers(masked)
    return masked
