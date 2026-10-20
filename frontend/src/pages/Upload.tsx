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
    label: 'Missing Amount (Incomplete)',
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
      setError('Please enter SMS or email text to process.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await parseMessage(text.trim(), source);
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Failed to process message.');
    } finally {
      setLoading(false);
    }
  };

  const status = result?.metadata?.status || (result?.transaction?.is_complete ? 'confirmed' : 'incomplete');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem', color: '#f8fafc' }}>
          Process Payment Message
        </h2>
        <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.95rem' }}>
          Paste raw SMS notifications or order emails. The NLP engine anonymizes personal identifiers, extracts financial entities, normalizes the merchant, and validates transactions before saving.
        </p>
      </div>

      {/* Preset sample buttons */}
      <div>
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Quick Load Sample Messages:
        </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
          {SAMPLE_MESSAGES.map((sample, idx) => (
            <button
              key={idx}
              onClick={() => {
                setText(sample.text);
                setSource(sample.source);
                setError(null);
              }}
              style={{
                background: '#1e293b',
                color: '#38bdf8',
                border: '1px solid #334155',
                padding: '0.4rem 0.8rem',
                borderRadius: '0.375rem',
                fontSize: '0.85rem',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              {sample.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input Form */}
      <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '0.75rem', border: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ fontWeight: 600, fontSize: '0.9rem', color: '#e2e8f0' }}>Message Content</label>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Source:</span>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as 'sms' | 'email')}
              style={{
                background: '#0f172a',
                color: '#f8fafc',
                border: '1px solid #475569',
                padding: '0.3rem 0.6rem',
                borderRadius: '0.375rem',
                fontSize: '0.85rem',
              }}
            >
              <option value="sms">SMS Text</option>
              <option value="email">Order Email</option>
            </select>
          </div>
        </div>

        <textarea
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste transaction SMS or order receipt email..."
          style={{
            width: '100%',
            background: '#0f172a',
            color: '#f8fafc',
            border: '1px solid #334155',
            borderRadius: '0.5rem',
            padding: '0.75rem',
            fontSize: '0.95rem',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
            resize: 'vertical',
          }}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
          <button
            onClick={() => { setText(''); setResult(null); setError(null); }}
            style={{
              background: 'transparent',
              color: '#94a3b8',
              border: '1px solid #475569',
              padding: '0.6rem 1.2rem',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Clear
          </button>
          <button
            onClick={handleParse}
            disabled={loading}
            style={{
              background: loading ? '#0284c7' : '#38bdf8',
              color: '#0f172a',
              border: 'none',
              padding: '0.6rem 1.5rem',
              borderRadius: '0.5rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            {loading ? 'Processing NLP...' : 'Run NLP Pipeline & Save'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: '#7f1d1d', border: '1px solid #ef4444', color: '#fecaca', padding: '1rem', borderRadius: '0.5rem' }}>
          {error}
        </div>
      )}

      {/* Results View */}
      {result && (
        <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '0.75rem', border: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Status Banner */}
          <div style={{
            padding: '1rem',
            borderRadius: '0.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background:
              status === 'confirmed' ? '#064e3b' :
              status === 'duplicate' ? '#1e3a8a' :
              status === 'failed' ? '#7f1d1d' : '#78350f',
            border: `1px solid ${
              status === 'confirmed' ? '#10b981' :
              status === 'duplicate' ? '#3b82f6' :
              status === 'failed' ? '#ef4444' : '#f59e0b'
            }`,
          }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: '#f8fafc' }}>
                {status === 'confirmed' && '✓ Valid Transaction Confirmed & Persisted'}
                {status === 'duplicate' && 'ℹ Duplicate Transaction (Already Recorded)'}
                {status === 'failed' && '✗ Payment Failed / Declined (Not Persisted)'}
                {status === 'incomplete' && '⚠ Incomplete Transaction (Missing Critical Details)'}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#e2e8f0', marginTop: '0.25rem' }}>
                {status === 'confirmed' && 'All critical fields extracted and verified. Recorded in database.'}
                {status === 'duplicate' && `This message has already been recorded (ID #${result.metadata?.duplicate_of_id || ''}). Duplicate insertion skipped.`}
                {status === 'failed' && 'This payment was declined or failed. Excluded from expense ledger.'}
                {status === 'incomplete' && `Missing required fields: ${(result.metadata?.missing_fields || ['amount']).join(', ')}. Not saved to confirmed ledger.`}
              </div>
            </div>

            {status === 'confirmed' && onNavigateToTransactions && (
              <button
                onClick={onNavigateToTransactions}
                style={{
                  background: '#10b981',
                  color: '#0f172a',
                  border: 'none',
                  padding: '0.5rem 1rem',
                  borderRadius: '0.375rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                }}
              >
                View Ledger →
              </button>
            )}
          </div>

          {/* Extracted Entities Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            {/* Amount */}
            <div style={{ background: '#0f172a', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #334155' }}>
              <div style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>Amount</div>
              <div style={{
                fontSize: '1.4rem',
                fontWeight: 700,
                marginTop: '0.25rem',
                color: result.transaction.amount === null ? '#f59e0b' : '#38bdf8',
              }}>
                {result.transaction.amount !== null ? `₹${result.transaction.amount.toFixed(2)}` : 'Missing (None)'}
              </div>
            </div>

            {/* Merchant */}
            <div style={{ background: '#0f172a', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #334155' }}>
              <div style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>Merchant</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '0.25rem', color: '#f8fafc' }}>
                {result.transaction.merchant_normalized || 'Unknown Merchant'}
              </div>
              {result.transaction.merchant_raw && (
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                  Raw: {result.transaction.merchant_raw}
                </div>
              )}
            </div>

            {/* Direction */}
            <div style={{ background: '#0f172a', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #334155' }}>
              <div style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>Direction</div>
              <div style={{
                fontSize: '1.2rem',
                fontWeight: 700,
                marginTop: '0.25rem',
                color:
                  result.transaction.transaction_type === 'CREDIT' ? '#34d399' :
                  result.transaction.transaction_type === 'DEBIT' ? '#f87171' :
                  result.transaction.transaction_type === 'FAILED' ? '#ef4444' : '#f59e0b',
              }}>
                {result.transaction.transaction_type}
              </div>
            </div>

            {/* Date */}
            <div style={{ background: '#0f172a', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #334155' }}>
              <div style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>Transaction Date</div>
              <div style={{ fontSize: '1rem', fontWeight: 600, marginTop: '0.25rem', color: result.transaction.transaction_date ? '#f8fafc' : '#94a3b8' }}>
                {result.transaction.transaction_date ? new Date(result.transaction.transaction_date).toLocaleDateString(undefined, { dateStyle: 'medium' }) : 'Not specified'}
              </div>
            </div>

            {/* Category */}
            <div style={{ background: '#0f172a', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #334155' }}>
              <div style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>Category</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '0.25rem', color: '#a78bfa' }}>
                {result.transaction.category}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                Confidence: {(result.transaction.confidence * 100).toFixed(0)}%
              </div>
            </div>
          </div>

          {/* Anonymized Preview */}
          <div style={{ fontSize: '0.8rem', color: '#64748b', borderTop: '1px solid #334155', paddingTop: '0.75rem' }}>
            Privacy scrub preview: <code style={{ color: '#94a3b8' }}>{result.metadata?.anonymized_preview || 'Scrubbed'}...</code>
          </div>
        </div>
      )}
    </div>
  );
};

export default Upload;
