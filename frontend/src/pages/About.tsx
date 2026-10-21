import React from 'react';

export const About: React.FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Editorial Page Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <span className="section-label">Engineering Specification</span>
          <span style={{ color: 'var(--border-strong)' }}>•</span>
          <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
            System Architecture & Academic Lab Overview
          </span>
        </div>
        <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>
          System Architecture
        </h1>
        <p style={{ margin: '0.35rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Technical specification of the CashO personal finance intelligence platform for demonstration and review.
        </p>
      </div>

      {/* Core Architectural Pillars */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
        {/* Privacy & Masking Layer */}
        <div className="card-terminal" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{ fontSize: '1.1rem', color: 'var(--accent-lime)' }}>⟠</span>
            <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary)', fontWeight: 600 }}>
              Privacy & Ingestion Masking
            </h3>
          </div>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.6 }}>
            Every raw financial payload (SMS or Gmail message) passes through a pre-processing scrub before tokenization. Bank account numbers, phone numbers, and recipient names are masked. Gmail OAuth refresh tokens are encrypted at rest using AES-Fernet with key derivation.
          </p>
          <div style={{ marginTop: 'auto', paddingTop: '0.5rem' }}>
            <span className="badge badge-lime">AES-FERNET AT REST</span>
          </div>
        </div>

        {/* NLP Lab Extraction */}
        <div className="card-terminal" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{ fontSize: '1.1rem', color: 'var(--accent-lime)' }}>◈</span>
            <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary)', fontWeight: 600 }}>
              NLP & Merchant Normalizer
            </h3>
          </div>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.6 }}>
            Multi-stage extraction resolves transaction amounts, directions (debit vs credit), transaction dates, and raw merchant substrings. Entity normalization uses Levenshtein edit distance and n-gram similarity against canonical merchant taxonomies.
          </p>
          <div style={{ marginTop: 'auto', paddingTop: '0.5rem' }}>
            <span className="badge badge-gray">LEVENSHTEIN + N-GRAMS</span>
          </div>
        </div>

        {/* Rule Reasoning Engine */}
        <div className="card-terminal" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{ fontSize: '1.1rem', color: 'var(--accent-lime)' }}>◬</span>
            <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary)', fontWeight: 600 }}>
              AI Rule Engine & Advisory
            </h3>
          </div>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.6 }}>
            Deterministic forward-chaining rule engine traces expenditure velocity without opaque black-box hallucinations. Derivations evaluate discretionary dining ratios, large irregular cash outflows, and recurring subscription burdens to produce explainable financial advice.
          </p>
          <div style={{ marginTop: 'auto', paddingTop: '0.5rem' }}>
            <span className="badge badge-amber">TRACEABLE FORWARD CHAINING</span>
          </div>
        </div>
      </div>

      {/* End-to-End Pipeline Diagram */}
      <div className="card-terminal" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)', fontWeight: 600 }}>
          End-to-End Ingestion & Processing Pipeline
        </h3>
        <div
          style={{
            background: 'var(--bg-base)',
            padding: '1.25rem',
            borderRadius: '6px',
            border: '1px solid var(--border-subtle)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8rem',
            lineHeight: 1.8,
            color: 'var(--text-secondary)',
            overflowX: 'auto',
          }}
        >
          <div><strong style={{ color: 'var(--accent-lime)' }}>1. Data Ingestion:</strong> Android SMS BroadcastReceiver & Google Gmail API (gmail.readonly)</div>
          <div><strong style={{ color: 'var(--accent-lime)' }}>2. Privacy Scrub:</strong> Regex-driven sanitization of PII (account numbers, recipient names, UPI handles)</div>
          <div><strong style={{ color: 'var(--accent-lime)' }}>3. Entity Extraction:</strong> Extraction of amount, transaction date, debit/credit flow, and merchant token</div>
          <div><strong style={{ color: 'var(--accent-lime)' }}>4. Merchant Normalization:</strong> Fuzzy matching against verified dictionary via Levenshtein distance</div>
          <div><strong style={{ color: 'var(--accent-lime)' }}>5. Quality & Deduplication:</strong> Validation of required fields; SHA-256 fingerprint deduplication</div>
          <div><strong style={{ color: 'var(--accent-lime)' }}>6. Storage & Review:</strong> Confirmed items saved to SQLite; anomalous records routed to Review Queue</div>
          <div><strong style={{ color: 'var(--accent-lime)' }}>7. Intelligence Layer:</strong> Forward-chaining rule engine triggers explainable advisory recommendations</div>
        </div>
      </div>

      {/* Technology Stack & Environment Specifications */}
      <div className="card-terminal" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)', fontWeight: 600 }}>
          Technology Stack
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          <div style={{ background: 'var(--bg-base)', padding: '1rem', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-lime)', textTransform: 'uppercase' }}>
              Backend Service
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
              FastAPI & Python 3.11+
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Asynchronous REST APIs with Pydantic validation
            </div>
          </div>

          <div style={{ background: 'var(--bg-base)', padding: '1rem', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-lime)', textTransform: 'uppercase' }}>
              Persistence Layer
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
              SQLite & SQLAlchemy ORM
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Atomic transactions with zero remote cloud egress
            </div>
          </div>

          <div style={{ background: 'var(--bg-base)', padding: '1rem', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-lime)', textTransform: 'uppercase' }}>
              Frontend Terminal
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
              React 18 & TypeScript
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Vite bundler, custom dark fintech design system
            </div>
          </div>

          <div style={{ background: 'var(--bg-base)', padding: '1rem', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-lime)', textTransform: 'uppercase' }}>
              Cryptography & Tokens
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
              AES-Fernet (PBKDF2)
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Encrypted OAuth token store with PKCE flow
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default About;
