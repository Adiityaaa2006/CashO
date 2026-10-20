from typing import Tuple

DEFAULT_MERCHANT_CATEGORIES = {
    "Swiggy": "Food & Dining",
    "Zomato": "Food & Dining",
    "Blinkit": "Groceries",
    "Zepto": "Groceries",
    "Bigbasket": "Groceries",
    "Amazon": "Shopping",
    "Flipkart": "Shopping",
    "Be Minimalist": "Shopping",
    "HyugaLife": "Health & Fitness",
    "Starbucks": "Food & Dining",
    "Uber": "Travel & Transport",
    "Ola Cabs": "Travel & Transport",
    "Netflix": "Entertainment",
    "Spotify": "Entertainment",
    "Electricity": "Bills & Utilities",
    "Airtel": "Bills & Utilities",
    "Paytm": "Bills & Utilities",
    "PhonePe": "Bills & Utilities",
    "Google Pay": "Bills & Utilities",
    "CRED": "Bills & Utilities",
    "Slice": "Income",
    "Salary": "Income",
}

class TransactionCategorizer:
    """Hybrid categorizer using keyword heuristics and merchant associations."""
    
    def __init__(self):
        self.merchant_map = DEFAULT_MERCHANT_CATEGORIES

    def predict(self, merchant: str, text: str) -> Tuple[str, float]:
        """Predict category from normalized merchant or raw text."""
        if merchant in self.merchant_map:
            return self.merchant_map[merchant], 0.90
        
        text_lower = text.lower()
        if any(w in text_lower for w in ["food", "restaurant", "cafe", "dine"]):
            return "Food & Dining", 0.75
        if any(w in text_lower for w in ["grocery", "mart", "supermarket"]):
            return "Groceries", 0.75
        if any(w in text_lower for w in ["ride", "cab", "metro", "fuel", "petrol"]):
            return "Travel & Transport", 0.75
        if any(w in text_lower for w in ["bill", "recharge", "utility", "electricity", "broadband"]):
            return "Bills & Utilities", 0.75
        if any(w in text_lower for w in ["salary", "payroll", "dividend"]):
            return "Income", 0.85

        return "Miscellaneous", 0.40
