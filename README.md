# CashO 💸

Intelligent Personal Finance Assistant powered by NLP entity extraction & AI rule-based reasoning.

## Directory Structure
`
Casho/
├── backend/
│   ├── app/
│   │   ├── main.py                    # FastAPI app and CORS
│   │   ├── config.py                  # categories, thresholds, paths
│   │   ├── schemas.py                 # request/response models
│   │   ├── api/
│   │   │   └── routes.py              # /parse, /transactions, /summary, /advice
│   │   ├── nlp/                       # NLP lab part
│   │   │   ├── preprocess.py          # anonymize, clean, tokenize
│   │   │   ├── extractor.py           # amount, merchant, date, type (regex + tagger)
│   │   │   ├── merchant_normalizer.py # edit distance, n-grams, merchant dictionary
│   │   │   ├── categorizer.py         # TF-IDF + classifier
│   │   │   ├── email_parser.py        # order emails (Phase 2)
│   │   │   └── linker.py              # SMS-to-email matching (Phase 2)
│   │   ├── ai/                        # AI lab part
│   │   │   ├── rules.py               # forward-chaining rules
│   │   │   ├── forward_chaining.py    # inference engine with rule trace
│   │   │   └── bayes_net.py           # Bayesian network for ambiguous categories
│   │   ├── services/
│   │   │   └── pipeline.py            # SMS → NLP → AI → results
│   │   └── db/
│   │       ├── database.py            # SQLite connection
│   │       └── models.py
│   ├── data/
│   │   ├── sample/                    # synthetic SMS and sample emails (safe to commit)
│   │   ├── labeled/                   # your anonymized labeled set
│   │   └── merchants.json             # canonical merchant dictionary
│   ├── evaluation/
│   │   ├── eval_extraction.py         # per-field precision/recall/F1
│   │   ├── eval_categorizer.py        # per-class F1, baseline comparison
│   │   └── results/                   # tables and plots for the journal
│   ├── tests/
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/                # charts, transaction table, cards
│   │   ├── pages/                     # Dashboard, Upload, Transactions, Insights, About
│   │   ├── lib/api.ts                 # REST client
│   │   ├── lib/types.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── docs/
│   ├── PRD.md
│   ├── DESIGN.md
│   ├── ARCHITECTURE.md
│   ├── DATABASE.md
│   ├── API.md
│   ├── IMPLEMENTATION_PLAN.md
│   ├── DEMO_GUIDE.md                  # presentation script and viva Q&A
│   └── journals/
│       ├── nlp_lab/                   # NLP journal write-ups
│       └── ai_lab/                    # AI journal write-ups
├── notebooks/                         # data exploration
├── AGENTS.md                          # rules for the coding agent
├── .env.example
├── .gitignore                         # must exclude real SMS/email data
└── README.md
`

## Quick Start

### Backend
`ash
cd backend
python -m venv venv
venv\Scripts\activate  # On Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
`

### Frontend
`ash
cd frontend
npm install
npm run dev
`
