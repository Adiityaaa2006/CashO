# Demo Guide & Viva Preparation

## Live Demonstration Flow
1. **SMS Ingestion**:
   - Paste a sample bank SMS (e.g., HDFC/SBI/ICICI style debit message).
   - Point out how PII (account number, phone number) is masked instantly.
2. **Entity Extraction**:
   - Highlight parsed amount, transaction type (debit/credit), date, and merchant candidate.
3. **Normalization & Categorization**:
   - Show how noisy merchant strings (`SWIGGY_BANGALORE_IND`) resolve to canonical `Swiggy`.
   - Show the assigned category (`Food & Dining`) with confidence metric.
4. **AI Reasoning in Action**:
   - Show fired forward-chaining rules (e.g. `HIGH_SINGLE_EXPENSE` for spends > Rs 5000).
   - Display the rule trace explaining *why* the advice was generated.
5. **Dashboard Analytics**:
   - Review category spending distribution and metrics.

## Key Viva Questions
- **Q**: Why use both regex and merchant normalization?
  - **A**: Bank SMS formats vary wildly and often contain UPI handles or location suffixes. Regex extracts candidate tokens, while Levenshtein distance and n-grams map them to canonical entities reliably.
- **Q**: What role does the Bayesian Network play?
  - **A**: Certain merchants like Amazon sell groceries, electronics, and digital media. A Bayes Net updates category belief based on amount range, order time, and complementary signals.
