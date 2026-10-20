import React, { useEffect, useState } from 'react';
import { fetchSummary, fetchTransactions } from '../lib/api';
import { SummaryData, Transaction } from '../lib/types';

interface DashboardProps {
  onNavigateToUpload?: () => void;
  onNavigateToTransactions?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigateToUpload, onNavigateToTransactions }) => {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [recentTxns, setRecentTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [sumData, txns] = await Promise.all([fetchSummary(), fetchTransactions()]);
      setSummary(sumData);
      setRecentTxns(txns.slice(0, 5));
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const totalSpent = summary?.total_spent || 0;
  const totalIncome = summary?.total_income || 0;
  const netBalance = totalIncome - totalSpent;
  const categoryEntries = Object.entries(summary?.category_breakdown || {}).sort((a, b) => b[1] - a[1]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem', color: '#f8fafc' }}>
            Spending Dashboard
          </h2>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.95rem' }}>
            Real-time analytics computed strictly from persisted transactions.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {onNavigateToUpload && (
            <button
              onClick={onNavigateToUpload}
              style={{
                background: '#38bdf8',
                color: '#0f172a',
                border: 'none',
                padding: '0.5rem 1rem',
                borderRadius: '0.375rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              + Parse New SMS/Email
            </button>
          )}
          <button
            onClick={loadDashboardData}
            style={{
              background: '#1e293b',
              color: '#38bdf8',
              border: '1px solid #334155',
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {loading && <div style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem' }}>Loading summary from database...</div>}

      {error && (
        <div style={{ background: '#7f1d1d', border: '1px solid #ef4444', color: '#fecaca', padding: '1rem', borderRadius: '0.5rem' }}>
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Top Metrics Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div style={{ background: '#1e293b', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #334155' }}>
              <div style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: 600 }}>TOTAL EXPENSES</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#f87171', marginTop: '0.5rem' }}>
                ₹{totalSpent.toFixed(2)}
              </div>
              <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.25rem' }}>Across all categories</div>
            </div>

            <div style={{ background: '#1e293b', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #334155' }}>
              <div style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: 600 }}>TOTAL INCOME</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#34d399', marginTop: '0.5rem' }}>
                ₹{totalIncome.toFixed(2)}
              </div>
              <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.25rem' }}>Salary, refunds & credits</div>
            </div>

            <div style={{ background: '#1e293b', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #334155' }}>
              <div style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: 600 }}>NET BALANCE</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: netBalance >= 0 ? '#38bdf8' : '#f87171', marginTop: '0.5rem' }}>
                {netBalance >= 0 ? '+' : ''}₹{netBalance.toFixed(2)}
              </div>
              <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.25rem' }}>Income minus expenses</div>
            </div>

            <div style={{ background: '#1e293b', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #334155' }}>
              <div style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: 600 }}>CONFIRMED TRANSACTIONS</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#c084fc', marginTop: '0.5rem' }}>
                {summary?.transaction_count || 0}
              </div>
              <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.25rem' }}>Validated in database</div>
            </div>
          </div>

          {/* Category Breakdown & Recent Transactions */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
            {/* Category Breakdown */}
            <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '0.75rem', border: '1px solid #334155' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: '#f8fafc' }}>Expenses by Category</h3>
              {categoryEntries.length === 0 ? (
                <p style={{ color: '#64748b', fontSize: '0.9rem' }}>No categorized debits recorded yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {categoryEntries.map(([cat, amt]) => {
                    const pct = totalSpent > 0 ? (amt / totalSpent) * 100 : 0;
                    return (
                      <div key={cat}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                          <span style={{ fontWeight: 600, color: '#e2e8f0' }}>{cat}</span>
                          <span style={{ color: '#94a3b8' }}>₹{amt.toFixed(2)} ({pct.toFixed(0)}%)</span>
                        </div>
                        <div style={{ background: '#0f172a', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ background: '#38bdf8', height: '100%', width: `${pct}%`, borderRadius: '4px' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Recent Transactions Preview */}
            <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '0.75rem', border: '1px solid #334155', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc' }}>Recent Activity</h3>
                {onNavigateToTransactions && recentTxns.length > 0 && (
                  <button
                    onClick={onNavigateToTransactions}
                    style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
                  >
                    View All →
                  </button>
                )}
              </div>

              {recentTxns.length === 0 ? (
                <div style={{ color: '#64748b', fontSize: '0.9rem', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  No recent activity. Parse a payment message to get started.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {recentTxns.map((t, idx) => (
                    <div
                      key={t.id || idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.6rem 0.75rem',
                        background: '#0f172a',
                        borderRadius: '0.375rem',
                        border: '1px solid #334155',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#f8fafc' }}>
                          {t.merchant_normalized || 'Unknown'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {t.category} • {t.transaction_date ? new Date(t.transaction_date).toLocaleDateString() : 'Unspecified'}
                        </div>
                      </div>
                      <div style={{
                        fontWeight: 700,
                        fontSize: '0.95rem',
                        color: t.transaction_type === 'CREDIT' ? '#34d399' : '#f87171',
                      }}>
                        {t.transaction_type === 'CREDIT' ? '+' : '-'}₹{t.amount?.toFixed(2)}
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
