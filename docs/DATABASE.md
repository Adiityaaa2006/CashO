# Database Design

## SQLite Engine
Stored locally at `backend/app/db/casho.db`.

### Transactions Table (`transactions`)
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique ID |
| `raw_text` | TEXT | NOT NULL | Anonymized input string |
| `amount` | REAL | NOT NULL | Transaction amount |
| `currency` | TEXT | DEFAULT 'INR' | Currency code |
| `transaction_type` | TEXT | 'DEBIT' or 'CREDIT' | Cash flow direction |
| `merchant_raw` | TEXT | NULLABLE | Raw candidate extracted from text |
| `merchant_normalized`| TEXT | NULLABLE | Standardized canonical merchant |
| `category` | TEXT | NOT NULL | Expense category |
| `confidence` | REAL | DEFAULT 0.0 | Combined parsing confidence (0.0 - 1.0) |
| `transaction_date` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Extracted or ingestion date |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Record creation timestamp |
