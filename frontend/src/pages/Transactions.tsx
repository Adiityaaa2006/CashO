import React, { useEffect, useState } from 'react';
import { fetchTransactions } from '../lib/api';
import { Transaction } from '../lib/types';

interface TransactionsProps {
  onNavigateToUpload?: () => void;
}

export const Transactions: React.FC<TransactionsProps> = ({ onNavigateToUpload }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTransactions();
      setTransactions(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load transactions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const categories = ['ALL', ...Array.from(new Set(transactions.map((t) => t.category)))];

  const filtered = transactions.filter((t) => {
    const matchesSearch =
      (t.merchant_normalized || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.merchant_raw || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.raw_text || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'ALL' || t.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem', color: '#f8fafc' }}>
            Confirmed Transactions Ledger
          </h2>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.95rem' }}>
            Real financial transactions extracted by NLP and validated before persistence.
          </p>
        </div>

        <button
          onClick={loadData}
          style={{
            background: '#1e293b',
            color: '#38bdf8',
            border: '1px solid #334155',
            padding: '0.5rem 1rem',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          ↻ Refresh Ledger
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', background: '#1e293b', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #334155' }}>
        <input
          type="text"
          placeholder="Search merchant or text..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            flex: 1,
            minWidth: '200px',
            background: '#0f172a',
            color: '#f8fafc',
            border: '1px solid #334155',
            padding: '0.5rem 0.75rem',
            borderRadius: '0.375rem',
            fontSize: '0.9rem',
          }}
        />

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          style={{
            background: '#0f172a',
            color: '#f8fafc',
            border: '1px solid #334155',
            padding: '0.5rem 0.75rem',
            borderRadius: '0.375rem',
            fontSize: '0.9rem',
          }}
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              Category: {c}
            </option>
          ))}
        </select>
      </div>

      {loading && <div style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem' }}>Loading transactions from database...</div>}

      {error && (
        <div style={{ background: '#7f1d1d', border: '1px solid #ef4444', color: '#fecaca', padding: '1rem', borderRadius: '0.5rem' }}>
          {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div style={{ background: '#1e293b', padding: '3rem', borderRadius: '0.75rem', textAlign: 'center', border: '1px solid #334155' }}>
          <p style={{ color: '#94a3b8', fontSize: '1.1rem', margin: '0 0 1rem 0' }}>
            No confirmed transactions found.
          </p>
          {onNavigateToUpload && (
            <button
              onClick={onNavigateToUpload}
              style={{
                background: '#38bdf8',
                color: '#0f172a',
                border: 'none',
                padding: '0.6rem 1.25rem',
                borderRadius: '0.375rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Parse & Save a Sample SMS →
            </button>
          )}
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div style={{ background: '#1e293b', borderRadius: '0.75rem', border: '1px solid #334155', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: '#0f172a', borderBottom: '1px solid #334155', color: '#94a3b8' }}>
                <th style={{ padding: '0.85rem 1rem' }}>Date</th>
                <th style={{ padding: '0.85rem 1rem' }}>Merchant</th>
                <th style={{ padding: '0.85rem 1rem' }}>Category</th>
                <th style={{ padding: '0.85rem 1rem' }}>Direction</th>
                <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Amount</th>
                <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Confidence</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t, idx) => (
                <tr
                  key={t.id || idx}
                  style={{
                    borderBottom: '1px solid #334155',
                    background: idx % 2 === 0 ? '#1e293b' : '#172033',
                  }}
                >
                  <td style={{ padding: '0.85rem 1rem', color: '#cbd5e1' }}>
                    {t.transaction_date ? new Date(t.transaction_date).toLocaleDateString(undefined, { dateStyle: 'medium' }) : 'Unspecified'}
                  </td>
                  <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: '#f8fafc' }}>
                    {t.merchant_normalized || 'Unknown Merchant'}
                    {t.merchant_raw && t.merchant_raw !== t.merchant_normalized && (
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 400 }}>
                        {t.merchant_raw}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <span style={{
                      background: '#312e81',
                      color: '#c7d2fe',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '0.25rem',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                    }}>
                      {t.category}
                    </span>
                  </td>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <span style={{
                      background: t.transaction_type === 'CREDIT' ? '#064e3b' : '#7f1d1d',
                      color: t.transaction_type === 'CREDIT' ? '#6ee7b7' : '#fca5a5',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '0.25rem',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                    }}>
                      {t.transaction_type}
                    </span>
                  </td>
                  <td style={{
                    padding: '0.85rem 1rem',
                    textAlign: 'right',
                    fontWeight: 700,
                    color: t.transaction_type === 'CREDIT' ? '#34d399' : '#f87171',
                  }}>
                    {t.amount !== null ? `${t.transaction_type === 'CREDIT' ? '+' : '-'}₹${t.amount.toFixed(2)}` : 'N/A'}
                  </td>
                  <td style={{ padding: '0.85rem 1rem', textAlign: 'center', color: '#94a3b8' }}>
                    {(t.confidence * 100).toFixed(0)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Transactions;
