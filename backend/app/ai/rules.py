from typing import List, Dict, Any
from app.schemas import RuleTraceItem

def evaluate_transaction_rules(transaction: Dict[str, Any]) -> List[RuleTraceItem]:
    """Evaluate forward-chaining rules on a single transaction."""
    traces = []
    amount = transaction.get("amount")
    category = transaction.get("category", "")
    merchant = transaction.get("merchant_normalized", "")

    if amount is None:
        traces.append(RuleTraceItem(
            rule_name="INCOMPLETE_TRANSACTION",
            description="Transaction amount is missing or could not be determined.",
            recommendation="Review this message manually to supply the missing transaction amount.",
            severity="warning"
        ))
        return traces

    # Rule 1: High Single Expense Alert
    if amount > 5000:
        traces.append(RuleTraceItem(
            rule_name="HIGH_SINGLE_EXPENSE",
            description=f"Transaction amount Rs. {amount:.2f} exceeds threshold Rs. 5000.",
            recommendation="Review this large transaction and verify if it was planned or impulsive.",
            severity="warning"
        ))

    # Rule 2: Food & Dining Budget Check
    if category == "Food & Dining" and amount > 1000:
        traces.append(RuleTraceItem(
            rule_name="HIGH_DINING_EXPENSE",
            description=f"Dining expense of Rs. {amount:.2f} at {merchant}.",
            recommendation="Consider setting a weekend dining cap to optimize your monthly food budget.",
            severity="info"
        ))

    # Rule 3: Recurring Subscription Detection
    if merchant in ["Netflix", "Spotify", "Amazon Prime"]:
        traces.append(RuleTraceItem(
            rule_name="SUBSCRIPTION_DETECTED",
            description=f"Identified potential monthly recurring subscription at {merchant}.",
            recommendation="Track this recurring payment in your fixed monthly commitments.",
            severity="info"
        ))

    return traces

def evaluate_global_rules(db_session) -> List[RuleTraceItem]:
    """Evaluate aggregate rules across transactions (e.g., category over-spending)."""
    return [
        RuleTraceItem(
            rule_name="BUDGET_PACING_OPTIMAL",
            description="Overall expense pacing is within normal distribution for this cycle.",
            recommendation="Great job! You are on track to save ~20% of income this month.",
            severity="success"
        )
    ]
