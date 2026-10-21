import React, { useEffect, useState } from 'react';
import { fetchSummary, fetchTransactions, fetchSyncStatus } from '../lib/api';
import { SummaryData, Transaction, SyncStatus } from '../lib/types';

interface DashboardProps {
  onNavigateToUpload?: () => void;
  onNavigateToTransactions?: (category?: string) => void;
  onNavigateToConnections?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onNavigateToUpload,
  onNavigateToTransactions,
  onNavigateToConnections,
}) => {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [recentTxns, setRecentTxns] = useState<Transaction[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [sumData, txns, sync] = await Promise.all([
        fetchSummary(),
        fetchTransactions(),
        fetchSyncStatus().catch(() => null),
      ]);
      setSummary(sumData);
      setRecentTxns(txns.slice(0, 6));
      setSyncStatus(sync);
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve dashboard telemetry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalSpent = summary?.total_spent || 0;
  const totalIncome = summary?.total_income || 0;
  const netBalance = totalIncome - totalSpent;
  const totalVolume = totalIncome + totalSpent;
  const incomeRatio = totalVolume > 0 ? (totalIncome / totalVolume) * 100 : 0;
  const expenseRatio = totalVolume > 0 ? (totalSpent / totalVolume) * 100 : 0;
  const categoryEntries = Object.entries(summary?.category_breakdown || {}).sort((a, b) => b[1] - a[1]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Editorial Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-lime)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Financial Telemetry
            </span>
            <span style={{ color: 'var(--border-strong)' }}>•</span>
            <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
              October 2026 Cycle
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>
            Financial Overview
          </h1>
          <p style={{ margin: '0.35rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Aggregated liquidity, cash flow velocity, and categorized expenditure.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {onNavigateToUpload && (
            <button
              onClick={onNavigateToUpload}
              style={{
                background: 'var(--bg-surface-elevated)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-medium)',
                padding: '0.55rem 1rem',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              + Ingest Data
            </button>
          )}
          <button
            onClick={loadData}
            style={{
              background: 'var(--bg-surface)',
              color: 'var(--text-muted)',
              border: '1px solid var(--border-subtle)',
              padding: '0.55rem 0.85rem',
              borderRadius: '6px',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
            title="Refresh analytics"
          >
            ↻
          </button>
        </div>
      </div>

      {/* Discreet Review Notification Banner */}
      {syncStatus && syncStatus.review_queue_pending_count > 0 && onNavigateToConnections && (
        <div
          onClick={onNavigateToConnections}
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            borderLeft: '4px solid #F59E0B',
            borderRadius: '6px',
            padding: '0.85rem 1.25rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ color: '#F59E0B', fontSize: '0.9rem' }}>◬</span>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
              <strong>{syncStatus.review_queue_pending_count} transaction{syncStatus.review_queue_pending_count > 1 ? 's' : ''}</strong> require manual verification before posting to confirmed aggregates.
            </span>
          </div>
          <span style={{ fontSize: '0.8rem', color: '#FBBF24', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
            Resolve Review Queue →
          </span>
        </div>
      )}

      {loading && (
        <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
          Computing verified ledger aggregates...
        </div>
      )}

      {error && (
        <div style={{ padding: '1.25rem', background: 'var(--color-debit-dim)', border: '1px solid var(--color-debit)', borderRadius: '6px', color: '#FCA5A5', fontSize: '0.875rem' }}>
          ⚠️ {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Primary Cash Flow Terminal Board */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
            {/* Net Position Hero Card */}
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '1.75rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    Net Cash Position
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.7rem',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '4px',
                      background: netBalance >= 0 ? 'var(--color-credit-dim)' : 'var(--color-debit-dim)',
                      color: netBalance >= 0 ? 'var(--color-credit)' : 'var(--color-debit)',
                      border: `1px solid ${netBalance >= 0 ? 'rgba(199, 243, 107, 0.3)' : 'rgba(229, 106, 84, 0.3)'}`,
                    }}
                  >
                    {netBalance >= 0 ? 'SURPLUS' : 'DEFICIT'}
                  </span>
                </div>

                <div
                  className="tabular-nums"
                  style={{
                    fontSize: '2.5rem',
                    fontWeight: 700,
                    color: netBalance >= 0 ? 'var(--color-credit)' : 'var(--color-debit)',
                    marginTop: '0.65rem',
                  }}
                >
                  {netBalance >= 0 ? '+' : ''}₹{netBalance.toFixed(2)}
                </div>

                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                  Confirmed income less debited expenditures in active ledger.
                </div>
              </div>

              {/* Cash Flow Distribution Bar */}
              <div style={{ marginTop: '1.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', marginBottom: '0.4rem' }}>
                  <span style={{ color: 'var(--color-credit)' }}>Inflow {incomeRatio.toFixed(0)}%</span>
                  <span style={{ color: 'var(--color-debit)' }}>Outflow {expenseRatio.toFixed(0)}%</span>
                </div>
                <div style={{ height: '6px', width: '100%', background: 'var(--bg-surface-subtle)', borderRadius: '3px', overflow: 'hidden', display: 'flex' }}>
                  <div style={{ width: `${incomeRatio}%`, background: 'var(--color-credit)', transition: 'width 0.4s ease' }} />
                  <div style={{ width: `${expenseRatio}%`, background: 'var(--color-debit)', transition: 'width 0.4s ease' }} />
                </div>
              </div>
            </div>

            {/* Income & Expense Breakdown Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {/* Confirmed Inflow */}
              <div
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    Total Inflow
                  </div>
                  <div
                    className="tabular-nums"
                    style={{ fontSize: '1.65rem', fontWeight: 700, color: 'var(--color-credit)', marginTop: '0.5rem' }}
                  >
                    +₹{totalIncome.toFixed(2)}
                  </div>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '1rem' }}>
                  Verified credits & interest
                </div>
              </div>

              {/* Confirmed Outflow */}
              <div
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    Total Outflow
                  </div>
                  <div
                    className="tabular-nums"
                    style={{ fontSize: '1.65rem', fontWeight: 700, color: 'var(--color-debit)', marginTop: '0.5rem' }}
                  >
                    -₹{totalSpent.toFixed(2)}
                  </div>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '1rem' }}>
                  Debited purchases & bills
                </div>
              </div>

              {/* Verified Count */}
              <div
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  padding: '1.5rem',
                  gridColumn: 'span 2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    Verified Database Transactions
                  </div>
                  <div
                    className="tabular-nums"
                    style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.25rem' }}
                  >
                    {summary?.transaction_count || 0} <span style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--text-muted)' }}>entries</span>
                  </div>
                </div>
                {onNavigateToTransactions && (
                  <button
                    onClick={() => onNavigateToTransactions()}
                    style={{
                      background: 'transparent',
                      color: 'var(--accent-lime)',
                      border: '1px solid var(--border-medium)',
                      padding: '0.45rem 0.85rem',
                      borderRadius: '5px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Open Ledger →
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Allocation & Recent Feed Dual Section */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
            {/* Category Expenditure Allocation */}
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Expenditure Allocation
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Ranked by confirmed spend volume
                  </div>
                </div>
                <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                  {categoryEntries.length} Categories
                </span>
              </div>

              {categoryEntries.length === 0 ? (
                <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No confirmed categorized debits recorded in this period.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {categoryEntries.map(([category, amount]) => {
                    const percent = totalSpent > 0 ? (amount / totalSpent) * 100 : 0;
                    return (
                      <div
                        key={category}
                        onClick={() => onNavigateToTransactions && onNavigateToTransactions(category)}
                        style={{
                          cursor: onNavigateToTransactions ? 'pointer' : 'default',
                          padding: '0.5rem',
                          borderRadius: '6px',
                          transition: 'background 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'var(--bg-surface-elevated)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                        }}
                        title={onNavigateToTransactions ? `Filter ledger by ${category}` : undefined}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                            {category}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span className="tabular-nums" style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                              ₹{amount.toFixed(2)}
                            </span>
                            <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                              {percent.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                        <div style={{ height: '4px', background: 'var(--bg-surface-subtle)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${percent}%`,
                              background: 'var(--accent-lime)',
                              height: '100%',
                              borderRadius: '2px',
                              transition: 'width 0.4s ease',
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Recent Verified Activity */}
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Recent Ledger Feed
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Latest confirmed postings
                  </div>
                </div>
                {onNavigateToTransactions && recentTxns.length > 0 && (
                  <button
                    onClick={() => onNavigateToTransactions()}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--accent-lime)',
                      fontSize: '0.8rem',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    View All →
                  </button>
                )}
              </div>

              {recentTxns.length === 0 ? (
                <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No transaction activity found. Ingest an SMS or email notice.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {recentTxns.map((t, idx) => (
                    <div
                      key={t.id || idx}
                      onClick={() => onNavigateToTransactions && onNavigateToTransactions()}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.75rem 0.85rem',
                        background: 'var(--bg-surface-subtle)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '6px',
                        cursor: onNavigateToTransactions ? 'pointer' : 'default',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                          {t.merchant_normalized || 'Unknown Payee'}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          <span>{t.category || 'Miscellaneous'}</span>
                          <span>•</span>
                          <span style={{ fontFamily: 'var(--font-mono)' }}>
                            {t.transaction_date ? new Date(t.transaction_date).toLocaleDateString(undefined, { dateStyle: 'short' }) : 'Unspecified'}
                          </span>
                        </div>
                      </div>

                      <div
                        className="tabular-nums"
                        style={{
                          fontWeight: 700,
                          fontSize: '0.95rem',
                          color: t.transaction_type === 'CREDIT' ? 'var(--color-credit)' : 'var(--color-debit)',
                        }}
                      >
                        {t.transaction_type === 'CREDIT' ? '+' : '-'}₹{(t.amount || 0).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
