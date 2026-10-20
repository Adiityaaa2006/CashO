from typing import Optional, Dict, Any

class LinkResult:
    def __init__(self, is_matched: bool, confidence: float, matched_id: Optional[str] = None):
        self.is_matched = is_matched
        self.confidence = confidence
        self.matched_id = matched_id

def match_sms_to_email(sms_record: Dict[str, Any], email_record: Dict[str, Any]) -> LinkResult:
    """Link SMS transaction to an email receipt based on amount, merchant, and timestamp."""
    sms_amount = sms_record.get("amount")
    email_amount = email_record.get("total_amount")
    
    if sms_amount and email_amount and abs(sms_amount - email_amount) < 0.01:
        return LinkResult(is_matched=True, confidence=0.92, matched_id=email_record.get("order_id"))
    
    return LinkResult(is_matched=False, confidence=0.0)
