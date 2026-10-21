import React, { useEffect, useState } from 'react';
import { fetchAdvice } from '../lib/api';
import { RuleTraceItem } from '../lib/types';

export const Insights: React.FC = () => {
  const [advice, setAdvice] = useState<RuleTraceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAdvice = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdvice();
      setAdvice(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch AI rule evaluations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdvice();
  }, []);

  const getSeverityBadgeClass = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'warning':
        return 'badge-coral';
      case 'success':
        return 'badge-lime';
      default:
        return 'badge-blue';
    }
  };

  const getSeverityBorderColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'warning':
        return 'var(--color-debit)';
      case 'success':
        return 'var(--accent-lime)';
      default:
        return 'var(--color-info)';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Editorial Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span className="section-label">AI Reasoning Engine</span>
            <span style={{ color: 'var(--border-strong)' }}>•</span>
            <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
              Deterministic Rule Knowledge Base
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>
            Financial Advisory & Traces
          </h1>
          <p style={{ margin: '0.35rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Traceable derivations from forward-chaining rule engine and Bayesian categorical inference over verified cash transactions.
          </p>
        </div>

        <button
          onClick={loadAdvice}
          className="btn-secondary btn-sm"
          title="Re-run knowledge engine against latest ledger"
        >
          ↻ Re-evaluate Rules
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
            RULE ENGINE // EVALUATING FINANCIAL AXIOMS...
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div
          style={{
            background: 'var(--color-debit-dim)',
            border: '1px solid rgba(229, 106, 84, 0.4)',
            color: 'var(--color-debit)',
            padding: '1rem 1.25rem',
            borderRadius: '6px',
            fontSize: '0.875rem',
          }}
        >
          ⚠ {error}
        </div>
      )}

      {/* Advice Traces List */}
      {!loading && !error && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {advice.length === 0 ? (
            <div
              className="card-terminal"
              style={{
                textAlign: 'center',
                padding: '3.5rem 1.5rem',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.85rem',
              }}
            >
              No active rule derivations triggered on current transaction profile. Financial telemetry is within baseline tolerances.
            </div>
          ) : (
            advice.map((item, idx) => {
              const borderAccent = getSeverityBorderColor(item.severity);
              const badgeClass = getSeverityBadgeClass(item.severity);

              return (
                <div
                  key={idx}
                  className="card-terminal"
                  style={{
                    borderLeft: `3px solid ${borderAccent}`,
                    padding: '1.25rem 1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.85rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-lime)' }}>
                        RULE_{String(idx + 1).padStart(2, '0')}
                      </span>
                      <span style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                        {item.rule_name}
                      </span>
                    </div>

                    <span className={`badge ${badgeClass}`}>
                      {item.severity.toUpperCase()}
                    </span>
                  </div>

                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                    {item.description}
                  </p>

                  <div
                    style={{
                      background: 'var(--bg-base)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '6px',
                      padding: '0.85rem 1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.25rem',
                    }}
                  >
                    <div style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-lime)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Actionable Recommendation
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                      {item.recommendation}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default Insights;
