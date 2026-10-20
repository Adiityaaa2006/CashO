import re
from typing import Dict, Any

def parse_order_email(email_html_or_text: str) -> Dict[str, Any]:
    """Parse confirmation emails (e.g., Amazon, Swiggy order receipts)."""
    order_id_match = re.search(r'order\s*#?\s*[:\-]?\s*([A-Za-z0-9\-]+)', email_html_or_text, re.IGNORECASE)
    order_id = order_id_match.group(1) if order_id_match else None

    total_amount_match = re.search(r'(?:Total|Grand Total|Amount Paid)\s*[:\-]?\s*(?:Rs\.?|₹|INR)?\s*([0-9,]+\.[0-9]{2})', email_html_or_text, re.IGNORECASE)
    total_amount = float(total_amount_match.group(1).replace(',', '')) if total_amount_match else None

    return {
        "order_id": order_id,
        "total_amount": total_amount,
        "raw_length": len(email_html_or_text)
    }
