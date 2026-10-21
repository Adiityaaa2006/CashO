import React, { useEffect, useState, useMemo } from 'react';
import { fetchTransactions } from '../lib/api';
import { Transaction } from '../lib/types';

interface TransactionsProps {
  onNavigateToUpload?: () => void;
  initialCategory?: string;
}

export const Transactions: React.FC<TransactionsProps> = ({ onNavigateToUpload, initialCategory }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Scope
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory || 'ALL');
  const [directionFilter, setDirectionFilter] = useState<'ALL' | 'DEBIT' | 'CREDIT'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'confirmed' | 'needs_review' | 'all'>('confirmed');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'>('date_desc');
  const [expandedTxId, setExpandedTxId] = useState<number | null>(null);

  const loadData = async (status = statusFilter) => {
    setLoading(true);
    setError(null);
    try {
      const queryStatus = status === 'confirmed' ? undefined : status;
      const data = await fetchTransactions(queryStatus);
      setTransactions(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load ledger records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(statusFilter);
  }, [statusFilter]);

  useEffect(() => {
    if (initialCategory) {
      setSelectedCategory(initialCategory);
    }
  }, [initialCategory]);

  const categories = useMemo(() => {
    const cats = Array.from(new Set(transactions.map((t) => t.category).filter(Boolean)));
    return ['ALL', ...cats.sort()];
  }, [transactions]);

  const filteredAndSorted = useMemo(() => {
    return transactions
      .filter((t) => {
        const term = searchTerm.toLowerCase().trim();
        const matchesSearch =
          !term ||
          (t.merchant_normalized || '').toLowerCase().includes(term) ||
          (t.merchant_raw || '').toLowerCase().includes(term) ||
          (t.raw_text || '').toLowerCase().includes(term) ||
          (t.category || '').toLowerCase().includes(term) ||
          (t.amount !== null && String(t.amount).includes(term)) ||
          (t.transaction_date && t.transaction_date.toLowerCase().includes(term));

        const matchesCategory = selectedCategory === 'ALL' || t.category === selectedCategory;
        const matchesDirection = directionFilter === 'ALL' || t.transaction_type === directionFilter;

        return matchesSearch && matchesCategory && matchesDirection;
      })
      .sort((a, b) => {
        if (sortBy === 'date_desc') {
          const dateA = a.transaction_date ? new Date(a.transaction_date).getTime() : 0;
          const dateB = b.transaction_date ? new Date(b.transaction_date).getTime() : 0;
          return dateB - dateA;
        }
        if (sortBy === 'date_asc') {
          const dateA = a.transaction_date ? new Date(a.transaction_date).getTime() : 0;
          const dateB = b.transaction_date ? new Date(b.transaction_date).getTime() : 0;
          return dateA - dateB;
        }
        if (sortBy === 'amount_desc') {
          return (b.amount || 0) - (a.amount || 0);
        }
        if (sortBy === 'amount_asc') {
          return (a.amount || 0) - (b.amount || 0);
        }
        return 0;
      });
  }, [transactions, searchTerm, selectedCategory, directionFilter, sortBy]);

  const filteredDebitsTotal = useMemo(() => {
    return filteredAndSorted
      .filter((t) => t.transaction_type === 'DEBIT')
      .reduce((sum, t) => sum + (t.amount || 0), 0);
  }, [filteredAndSorted]);

  const filteredCreditsTotal = useMemo(() => {
    return filteredAndSorted
      .filter((t) => t.transaction_type === 'CREDIT')
      .reduce((sum, t) => sum + (t.amount || 0), 0);
  }, [filteredAndSorted]);

  const hasActiveFilters = searchTerm !== '' || selectedCategory !== 'ALL' || directionFilter !== 'ALL';

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedCategory('ALL');
    setDirectionFilter('ALL');
    setSortBy('date_desc');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Ledger Page Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-lime)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Financial Terminal
            </span>
            <span style={{ color: 'var(--border-strong)' }}>•</span>
            <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
              Double-Entry Ledger
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>
            Transaction Workspace
          </h1>
          <p style={{ margin: '0.35rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Multi-field filtering, direction breakdown, and entity verification.
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
              + Ingest Notice
            </button>
          )}
          <button
            onClick={() => loadData(statusFilter)}
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
            title="Refresh records"
          >
            ↻
          </button>
        </div>
      </div>

      {/* Segmented Scope Control */}
      <div
        style={{
          display: 'inline-flex',
          background: 'var(--bg-surface)',
          padding: '0.25rem',
          borderRadius: '6px',
          border: '1px solid var(--border-subtle)',
          alignSelf: 'flex-start',
        }}
      >
        <button
          onClick={() => setStatusFilter('confirmed')}
          style={{
            background: statusFilter === 'confirmed' ? 'var(--bg-surface-elevated)' : 'transparent',
            color: statusFilter === 'confirmed' ? 'var(--accent-lime)' : 'var(--text-muted)',
            border: statusFilter === 'confirmed' ? '1px solid var(--border-medium)' : '1px solid transparent',
            padding: '0.45rem 1rem',
            borderRadius: '4px',
            fontSize: '0.8rem',
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          CONFIRMED LEDGER
        </button>
        <button
          onClick={() => setStatusFilter('needs_review')}
          style={{
            background: statusFilter === 'needs_review' ? 'var(--bg-surface-elevated)' : 'transparent',
            color: statusFilter === 'needs_review' ? '#FBBF24' : 'var(--text-muted)',
            border: statusFilter === 'needs_review' ? '1px solid var(--border-medium)' : '1px solid transparent',
            padding: '0.45rem 1rem',
            borderRadius: '4px',
            fontSize: '0.8rem',
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          REVIEW QUEUE
        </button>
        <button
          onClick={() => setStatusFilter('all')}
          style={{
            background: statusFilter === 'all' ? 'var(--bg-surface-elevated)' : 'transparent',
            color: statusFilter === 'all' ? 'var(--text-primary)' : 'var(--text-muted)',
            border: statusFilter === 'all' ? '1px solid var(--border-medium)' : '1px solid transparent',
            padding: '0.45rem 1rem',
            borderRadius: '4px',
            fontSize: '0.8rem',
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          ALL RECORDS
        </button>
      </div>

      {/* High-Density Filtering Toolbar */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '8px',
          padding: '0.85rem 1.25rem',
          display: 'flex',
          gap: '0.75rem',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        {/* Search */}
        <div style={{ flex: '1 1 240px', display: 'flex', alignItems: 'center', background: 'var(--bg-surface-subtle)', borderRadius: '6px', border: '1px solid var(--border-subtle)', padding: '0 0.75rem' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginRight: '0.5rem' }}>⌕</span>
          <input
            type="text"
            placeholder="Search merchant, amount, category, date..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              flex: 1,
              background: 'transparent',
              color: 'var(--text-primary)',
              border: 'none',
              padding: '0.55rem 0',
              fontSize: '0.85rem',
              outline: 'none',
            }}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Category Filter */}
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          style={{
            background: 'var(--bg-surface-subtle)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-subtle)',
            padding: '0.55rem 0.85rem',
            borderRadius: '6px',
            fontSize: '0.85rem',
            cursor: 'pointer',
          }}
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c === 'ALL' ? 'All Categories' : c}
            </option>
          ))}
        </select>

        {/* Direction Segment */}
        <div style={{ display: 'inline-flex', background: 'var(--bg-surface-subtle)', borderRadius: '6px', border: '1px solid var(--border-subtle)', padding: '0.15rem' }}>
          {(['ALL', 'DEBIT', 'CREDIT'] as const).map((dir) => (
            <button
              key={dir}
              onClick={() => setDirectionFilter(dir)}
              style={{
                background: directionFilter === dir ? 'var(--bg-surface-elevated)' : 'transparent',
                color: directionFilter === dir ? (dir === 'CREDIT' ? 'var(--color-credit)' : dir === 'DEBIT' ? 'var(--color-debit)' : 'var(--text-primary)') : 'var(--text-muted)',
                border: 'none',
                padding: '0.35rem 0.75rem',
                borderRadius: '4px',
                fontSize: '0.75rem',
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {dir === 'ALL' ? 'ALL' : dir === 'DEBIT' ? 'OUTFLOW' : 'INFLOW'}
            </button>
          ))}
        </div>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          style={{
            background: 'var(--bg-surface-subtle)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-subtle)',
            padding: '0.55rem 0.85rem',
            borderRadius: '6px',
            fontSize: '0.85rem',
            cursor: 'pointer',
          }}
        >
          <option value="date_desc">Date: Newest First</option>
          <option value="date_asc">Date: Oldest First</option>
          <option value="amount_desc">Amount: Descending</option>
          <option value="amount_asc">Amount: Ascending</option>
        </select>

        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            style={{
              background: 'transparent',
              color: 'var(--text-muted)',
              border: '1px solid var(--border-medium)',
              padding: '0.5rem 0.75rem',
              borderRadius: '6px',
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            Reset
          </button>
        )}
      </div>

      {/* Filtered Active Metrics Strip */}
      {filteredAndSorted.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: '1.75rem',
            flexWrap: 'wrap',
            background: 'var(--bg-surface-subtle)',
            border: '1px solid var(--border-subtle)',
            padding: '0.65rem 1.25rem',
            borderRadius: '6px',
            fontSize: '0.8rem',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-secondary)',
          }}
        >
          <div>
            MATCHES: <strong style={{ color: 'var(--text-primary)' }}>{filteredAndSorted.length}</strong> / {transactions.length}
          </div>
          <div>
            OUTFLOW: <strong style={{ color: 'var(--color-debit)' }}>-₹{filteredDebitsTotal.toFixed(2)}</strong>
          </div>
          <div>
            INFLOW: <strong style={{ color: 'var(--color-credit)' }}>+₹{filteredCreditsTotal.toFixed(2)}</strong>
          </div>
          <div>
            DELTA:{' '}
            <strong style={{ color: (filteredCreditsTotal - filteredDebitsTotal) >= 0 ? 'var(--color-credit)' : 'var(--color-debit)' }}>
              {(filteredCreditsTotal - filteredDebitsTotal) >= 0 ? '+' : ''}₹{(filteredCreditsTotal - filteredDebitsTotal).toFixed(2)}
            </strong>
          </div>
        </div>
      )}

      {loading && (
        <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
          Querying ledger database...
        </div>
      )}

      {error && (
        <div style={{ padding: '1.25rem', background: 'var(--color-debit-dim)', border: '1px solid var(--color-debit)', borderRadius: '6px', color: '#FCA5A5', fontSize: '0.875rem' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredAndSorted.length === 0 && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '3.5rem 1.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>∅</div>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            No records match the active criteria
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.35rem', marginBottom: '1.5rem' }}>
            {hasActiveFilters ? 'Relax search parameters or clear filters.' : 'No transactions exist in this scope.'}
          </div>
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              style={{
                background: 'var(--accent-lime)',
                color: '#111411',
                border: 'none',
                padding: '0.5rem 1.25rem',
                borderRadius: '6px',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              Reset Filters
            </button>
          )}
        </div>
      )}

      {/* Ledger Table */}
      {!loading && !error && filteredAndSorted.length > 0 && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '8px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-surface-subtle)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '0.7rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                <th style={{ padding: '0.75rem 1rem' }}>Posting Date</th>
                <th style={{ padding: '0.75rem 1rem' }}>Payee / Merchant</th>
                <th style={{ padding: '0.75rem 1rem' }}>Category</th>
                <th style={{ padding: '0.75rem 1rem' }}>Type</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Amount (INR)</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Confidence</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Inspect</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSorted.map((t, idx) => {
                const isExpanded = expandedTxId === (t.id || idx);
                return (
                  <React.Fragment key={t.id || idx}>
                    <tr
                      onClick={() => setExpandedTxId(isExpanded ? null : (t.id || idx))}
                      style={{
                        borderBottom: isExpanded ? 'none' : '1px solid var(--border-subtle)',
                        background: isExpanded ? 'var(--bg-surface-elevated)' : (idx % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-surface-subtle)'),
                        cursor: 'pointer',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                        {t.transaction_date ? new Date(t.transaction_date).toLocaleDateString(undefined, { dateStyle: 'short' }) : 'Unspecified'}
                      </td>

                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {t.merchant_normalized || 'Unknown Payee'}
                        </div>
                        {t.merchant_raw && t.merchant_raw !== t.merchant_normalized && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            Raw: {t.merchant_raw}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span
                          style={{
                            background: 'var(--bg-surface-elevated)',
                            color: 'var(--text-secondary)',
                            border: '1px solid var(--border-subtle)',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontFamily: 'var(--font-mono)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {t.category || 'Miscellaneous'}
                        </span>
                      </td>

                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span
                          style={{
                            background: t.transaction_type === 'CREDIT' ? 'var(--color-credit-dim)' : 'var(--color-debit-dim)',
                            color: t.transaction_type === 'CREDIT' ? 'var(--color-credit)' : 'var(--color-debit)',
                            border: `1px solid ${t.transaction_type === 'CREDIT' ? 'rgba(199, 243, 107, 0.3)' : 'rgba(229, 106, 84, 0.3)'}`,
                            padding: '0.15rem 0.45rem',
                            borderRadius: '3px',
                            fontSize: '0.7rem',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 700,
                          }}
                        >
                          {t.transaction_type}
                        </span>
                      </td>

                      <td
                        className="tabular-nums"
                        style={{
                          padding: '0.75rem 1rem',
                          textAlign: 'right',
                          fontWeight: 700,
                          fontSize: '0.9rem',
                          color: t.transaction_type === 'CREDIT' ? 'var(--color-credit)' : 'var(--color-debit)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {t.amount !== null
                          ? `${t.transaction_type === 'CREDIT' ? '+' : '-'}₹${t.amount.toFixed(2)}`
                          : 'N/A'}
                      </td>

                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                        <span
                          style={{
                            color: t.confidence >= 0.8 ? 'var(--color-credit)' : t.confidence >= 0.6 ? '#FBBF24' : 'var(--color-debit)',
                            fontWeight: 600,
                          }}
                        >
                          {(t.confidence * 100).toFixed(0)}%
                        </span>
                      </td>

                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center', color: 'var(--accent-lime)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                        {isExpanded ? '▲' : '▼'}
                      </td>
                    </tr>

                    {/* Expandable Technical Inset */}
                    {isExpanded && (
                      <tr style={{ background: 'var(--bg-surface-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
                        <td colSpan={7} style={{ padding: '1rem 1.25rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                              <div style={{ display: 'flex', gap: '1rem' }}>
                                <span style={{ color: 'var(--text-muted)' }}>RECORD ID: <strong style={{ color: 'var(--text-primary)' }}>#{t.id}</strong></span>
                                <span style={{ color: 'var(--text-muted)' }}>SOURCE: <strong style={{ color: 'var(--text-primary)', textTransform: 'uppercase' }}>{t.source || 'manual'}</strong></span>
                                {t.external_id && (
                                  <span style={{ color: 'var(--text-muted)' }}>EXTERNAL REF: <code>{t.external_id}</code></span>
                                )}
                              </div>
                              <span
                                style={{
                                  background: t.review_status === 'needs_review' ? 'rgba(245, 158, 11, 0.15)' : 'var(--color-credit-dim)',
                                  color: t.review_status === 'needs_review' ? '#FBBF24' : 'var(--color-credit)',
                                  padding: '0.15rem 0.5rem',
                                  borderRadius: '3px',
                                  border: `1px solid ${t.review_status === 'needs_review' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(199, 243, 107, 0.3)'}`,
                                }}
                              >
                                STATUS: {(t.review_status || 'approved').toUpperCase()}
                              </span>
                            </div>

                            <div>
                              <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontFamily: 'var(--font-mono)', marginBottom: '0.25rem', textTransform: 'uppercase' }}>
                                Masked Anonymized Ingestion Payload:
                              </div>
                              <div
                                style={{
                                  background: 'var(--bg-base)',
                                  padding: '0.75rem',
                                  borderRadius: '4px',
                                  color: 'var(--text-primary)',
                                  fontFamily: 'var(--font-mono)',
                                  fontSize: '0.8rem',
                                  lineHeight: 1.5,
                                  wordBreak: 'break-word',
                                  border: '1px solid var(--border-subtle)',
                                }}
                              >
                                {t.raw_text || 'No raw payload preserved.'}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Transactions;
