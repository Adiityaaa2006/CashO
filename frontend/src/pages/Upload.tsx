import React, { useState } from 'react';
import { parseMessage } from '../lib/api';
import { PipelineResult } from '../lib/types';

interface UploadProps {
  onNavigateToTransactions?: () => void;
}

const SAMPLE_MESSAGES = [
  {
    label: 'Swiggy Food Debit (₹350)',
    source: 'sms' as const,
    text: 'Rs. 350.00 debited from A/c XX1234 at Swiggy on 10-Oct-2026. Avl Bal: Rs 14,200.00',
  },
  {
    label: 'Salary Credit (₹65,000)',
    source: 'sms' as const,
    text: 'Salary of Rs. 65,000.00 credited to Account ending 1234 on 01-Oct-2026 from TechCorp India Pvt Ltd.',
  },
  {
    label: 'Blinkit Grocery (₹75)',
    source: 'sms' as const,
    text: 'Sent Rs. 75.00 to Blinkit via UPI Ref: 3948192849 on 15-Oct-2026.',
  },
  {
    label: 'Amazon Order Email',
    source: 'email' as const,
    text: 'Your Amazon.in order #402-19283-1920 confirmation. Total amount: Rs. 1,299.00 paid via Card on 14-Oct-2026.',
  },
  {
    label: 'Missing Amount (Flagged)',
    source: 'sms' as const,
    text: 'Your payment to Amazon India was successful. Reference: UPI-9849204812.',
  },
  {
    label: 'Failed Payment (Declined)',
    source: 'sms' as const,
    text: 'Payment of Rs. 990.00 to Netflix failed due to bank network decline.',
  },
];

export const Upload: React.FC<UploadProps> = ({ onNavigateToTransactions }) => {
  const [text, setText] = useState(SAMPLE_MESSAGES[0].text);
  const [source, setSource] = useState<'sms' | 'email'>('sms');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PipelineResult | null>(null);

  const handleParse = async () => {
    if (!text.trim()) {
      setError('Please provide SMS notification or order email text to parse.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await parseMessage(text.trim(), source);
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Pipeline parsing failed.');
    } finally {
      setLoading(false);
    }
  };

  const status = result?.metadata?.status || (result?.transaction?.is_complete ? 'confirmed' : 'incomplete');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Editorial Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span className="section-label">NLP Laboratory</span>
            <span style={{ color: 'var(--border-strong)' }}>•</span>
            <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
              Entity Extraction & Normalization
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>
            Ingest & Parse Sandbox
          </h1>
          <p style={{ margin: '0.35rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Test raw notification parsing: anonymization scrub, regex entity extraction, Levenshtein merchant canonicalization, and rule persistence.
          </p>
        </div>
      </div>

      {/* Preset sample buttons */}
      <div>
        <div style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>
          Select Test Fixture:
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {SAMPLE_MESSAGES.map((sample, idx) => (
            <button
              key={idx}
              onClick={() => {
                setText(sample.text);
                setSource(sample.source);
                setError(null);
                setResult(null);
              }}
              className="btn-secondary btn-sm"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                border: text === sample.text ? '1px solid var(--accent-lime)' : undefined,
                color: text === sample.text ? 'var(--accent-lime)' : undefined,
              }}
            >
              {sample.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input Form Terminal Card */}
      <div className="card-terminal" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Raw Inbound Payload
            </span>
            <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
              (Scrubbed prior to extraction)
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <label style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
              SOURCE PROTOCOL:
            </label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as 'sms' | 'email')}
              className="select-terminal"
              style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}
            >
              <option value="sms">SMS Text Alert</option>
              <option value="email">Order Receipt Email</option>
            </select>
          </div>
        </div>

        <textarea
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste raw bank SMS notification, UPI alert, or order receipt..."
          className="input-terminal"
          style={{
            width: '100%',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.85rem',
            lineHeight: 1.6,
            resize: 'vertical',
            minHeight: '90px',
          }}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button
            onClick={() => { setText(''); setResult(null); setError(null); }}
            className="btn-secondary"
          >
            Clear Buffer
          </button>
          <button
            onClick={handleParse}
            disabled={loading}
            className="btn-primary"
          >
            {loading ? 'Executing Pipeline...' : 'Run NLP Pipeline & Ingest ⟠'}
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div
          style={{
            background: 'var(--color-debit-dim)',
            border: '1px solid rgba(229, 106, 84, 0.4)',
            color: 'var(--color-debit)',
            padding: '0.85rem 1.25rem',
            borderRadius: '6px',
            fontSize: '0.875rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>⚠ {error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: 'var(--color-debit)', cursor: 'pointer', fontWeight: 700 }}>✕</button>
        </div>
      )}

      {/* Results View */}
      {result && (
        <div className="card-terminal" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Status Banner */}
          <div
            style={{
              padding: '1rem 1.25rem',
              borderRadius: '6px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
              background:
                status === 'confirmed' ? 'var(--accent-lime-dim)' :
                status === 'duplicate' ? 'var(--color-info-dim)' :
                status === 'failed' ? 'var(--color-debit-dim)' : 'var(--color-warning-dim)',
              border: `1px solid ${
                status === 'confirmed' ? 'rgba(199, 243, 107, 0.3)' :
                status === 'duplicate' ? 'rgba(96, 165, 250, 0.3)' :
                status === 'failed' ? 'rgba(229, 106, 84, 0.3)' : 'rgba(234, 179, 8, 0.3)'
              }`,
            }}
          >
            <div>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  fontFamily: 'var(--font-mono)',
                  color:
                    status === 'confirmed' ? 'var(--accent-lime)' :
                    status === 'duplicate' ? 'var(--color-info)' :
                    status === 'failed' ? 'var(--color-debit)' : 'var(--color-warning)',
                }}
              >
                {status === 'confirmed' && '✓ VALID TRANSACTION PERSISTED TO LEDGER'}
                {status === 'duplicate' && 'ℹ DUPLICATE RECORD IDENTIFIED (SKIPPED)'}
                {status === 'failed' && '✗ TRANSACTION FAILED / DECLINED (EXCLUDED)'}
                {status === 'incomplete' && '⚠ INCOMPLETE ENTITY (ROUTED TO REVIEW)'}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                {status === 'confirmed' && 'All critical transaction entities validated. Ingested into database.'}
                {status === 'duplicate' && `Message fingerprint matches existing transaction #${result.metadata?.duplicate_of_id || ''}.`}
                {status === 'failed' && 'Declined bank attempt. Not counted towards expenditure.'}
                {status === 'incomplete' && `Missing required fields: ${(result.metadata?.missing_fields || ['amount']).join(', ')}. Placed in review queue.`}
              </div>
            </div>

            {status === 'confirmed' && onNavigateToTransactions && (
              <button
                onClick={onNavigateToTransactions}
                className="btn-primary btn-sm"
              >
                Open Ledger →
              </button>
            )}
          </div>

          {/* Extracted Entities Matrix */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            {/* Amount */}
            <div style={{ background: 'var(--bg-base)', padding: '1rem', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
                Parsed Amount
              </div>
              <div
                className="tabular-nums"
                style={{
                  fontSize: '1.4rem',
                  fontWeight: 700,
                  marginTop: '0.35rem',
                  color: result.transaction.amount === null ? 'var(--color-warning)' : 'var(--accent-lime)',
                }}
              >
                {result.transaction.amount !== null ? `₹${result.transaction.amount.toFixed(2)}` : 'NULL (Missing)'}
              </div>
            </div>

            {/* Merchant */}
            <div style={{ background: 'var(--bg-base)', padding: '1rem', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
                Normalized Merchant
              </div>
              <div style={{ fontSize: '1.15rem', fontWeight: 700, marginTop: '0.35rem', color: 'var(--text-primary)' }}>
                {result.transaction.merchant_normalized || 'Unknown'}
              </div>
              {result.transaction.merchant_raw && (
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '0.25rem' }}>
                  Raw token: "{result.transaction.merchant_raw}"
                </div>
              )}
            </div>

            {/* Direction */}
            <div style={{ background: 'var(--bg-base)', padding: '1rem', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
                Direction Flow
              </div>
              <div
                style={{
                  fontSize: '1.15rem',
                  fontWeight: 700,
                  marginTop: '0.35rem',
                  fontFamily: 'var(--font-mono)',
                  color:
                    result.transaction.transaction_type === 'CREDIT' ? 'var(--color-credit)' :
                    result.transaction.transaction_type === 'DEBIT' ? 'var(--color-debit)' :
                    result.transaction.transaction_type === 'FAILED' ? 'var(--color-debit)' : 'var(--color-warning)',
                }}
              >
                {result.transaction.transaction_type}
              </div>
            </div>

            {/* Date */}
            <div style={{ background: 'var(--bg-base)', padding: '1rem', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
                Extracted Date
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 600, marginTop: '0.35rem', fontFamily: 'var(--font-mono)', color: result.transaction.transaction_date ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                {result.transaction.transaction_date ? new Date(result.transaction.transaction_date).toLocaleDateString(undefined, { dateStyle: 'medium' }) : 'Unspecified'}
              </div>
            </div>

            {/* Category */}
            <div style={{ background: 'var(--bg-base)', padding: '1rem', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
                Classification
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, marginTop: '0.35rem', color: 'var(--accent-lime)' }}>
                {result.transaction.category}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '0.25rem' }}>
                Confidence: {(result.transaction.confidence * 100).toFixed(0)}%
              </div>
            </div>
          </div>

          {/* Anonymized Privacy Scrub Preview */}
          <div
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              borderTop: '1px solid var(--border-subtle)',
              paddingTop: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span style={{ fontFamily: 'var(--font-mono)' }}>PII Scrub Preview:</span>
            <code style={{ color: 'var(--text-secondary)', background: 'var(--bg-base)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
              {result.metadata?.anonymized_preview || 'Anonymized'}
            </code>
          </div>
        </div>
      )}
    </div>
  );
};

export default Upload;
