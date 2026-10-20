from typing import Dict

class SimpleBayesCategorizer:
    """Bayesian model to resolve ambiguous transactions (e.g., Amazon, generic UPI).
    
    P(Category | Merchant, AmountRange, TimeOfDay) ~ P(Category) * P(Evidence | Category)
    """

    def __init__(self):
        self.priors: Dict[str, float] = {
            "Shopping": 0.40,
            "Groceries": 0.30,
            "Entertainment": 0.20,
            "Miscellaneous": 0.10,
        }

    def infer(self, merchant: str, amount: float) -> Dict[str, float]:
        """Compute posterior probabilities given evidence."""
        posteriors = dict(self.priors)
        
        # Likelihood updates based on amount
        if merchant.lower() == "amazon":
            if amount < 500:
                posteriors["Groceries"] *= 2.0  # e.g., Amazon Fresh
                posteriors["Entertainment"] *= 1.5  # Prime Video rental
            elif amount > 2000:
                posteriors["Shopping"] *= 3.0

        # Normalize
        total = sum(posteriors.values())
        return {k: round(v / total, 3) for k, v in posteriors.items()}
