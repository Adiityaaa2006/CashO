# API Documentation

## Base URL
`http://localhost:8000/api`

## Endpoints

### 1. `POST /api/parse`
Extracts entities and evaluates rules on a raw SMS or email string.
- **Request**:
```json
{
  "text": "Rs. 450.00 debited from A/c XX8910 at Swiggy on 12-Oct-2026.",
  "source": "sms"
}
```
- **Response**:
```json
{
  "transaction": {
    "amount": 450.0,
    "currency": "INR",
    "transaction_type": "DEBIT",
    "merchant_raw": "Swiggy",
    "merchant_normalized": "Swiggy",
    "category": "Food & Dining",
    "confidence": 0.95
  },
  "rule_traces": [],
  "metadata": { "source": "sms" }
}
```

### 2. `GET /api/transactions`
Returns list of stored transactions.

### 3. `GET /api/summary`
Returns total spent, total income, and category breakdown.

### 4. `GET /api/advice`
Returns active advisory alerts and insights.
