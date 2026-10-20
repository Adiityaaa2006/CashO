# Rules for Coding Agents - CashO

## Mission
CashO is an intelligent financial tracking and insights assistant integrating:
1. **NLP Lab Module**: Preprocessing & anonymization, entity extraction (amount, date, merchant, type), merchant normalization (Levenshtein + n-grams), categorization (TF-IDF + classifier), order email parsing, and SMS-to-email linking.
2. **AI Lab Module**: Knowledge representation with forward-chaining rule engine (with traceable derivations) and Bayesian Network for ambiguous category inference.
3. **Core Services & DB**: SQLite storage via SQLAlchemy and FastAPI REST endpoints.
4. **Modern Frontend**: React + TypeScript dashboard.

## Rules & Standards
- **Privacy & Anonymization**: Never commit, log, or persist raw unmasked personal identifiers (bank account numbers, phone numbers, recipient names). All raw text MUST pass through preprocess.py first.
- **Rule Explainability**: AI reasoning engines must always return explicit RuleTraceItem outputs detailing which rule fired, why it fired, and actionable advice.
- **Preserve Structure**: Keep the directory structure strictly modular. Do not merge NLP and AI inference into monolithic files.