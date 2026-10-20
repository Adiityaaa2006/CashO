import React, { useState } from 'react';
import Dashboard from './pages/Dashboard';
import Upload from './pages/Upload';
import Transactions from './pages/Transactions';
import Insights from './pages/Insights';
import Connections from './pages/Connections';
import About from './pages/About';

export function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'upload' | 'transactions' | 'insights' | 'connections' | 'about'>('dashboard');

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', minHeight: '100vh', background: '#0f172a', color: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '1.25rem 2rem', background: '#1e293b', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#38bdf8' }}>CashO 💸</h1>
        <nav style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {(['dashboard', 'upload', 'transactions', 'insights', 'connections', 'about'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background: activeTab === tab ? '#38bdf8' : 'transparent',
                color: activeTab === tab ? '#0f172a' : '#94a3b8',
                border: 'none',
                padding: '0.5rem 1rem',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontWeight: 600,
                textTransform: 'capitalize',
              }}
            >
              {tab === 'connections' ? 'Connections ⚡' : tab}
            </button>
          ))}
        </nav>
      </header>
      <main style={{ padding: '2rem', flex: 1, maxWidth: '1200px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        {activeTab === 'dashboard' && (
          <Dashboard
            onNavigateToUpload={() => setActiveTab('upload')}
            onNavigateToTransactions={() => setActiveTab('transactions')}
          />
        )}
        {activeTab === 'upload' && (
          <Upload
            onNavigateToTransactions={() => setActiveTab('transactions')}
          />
        )}
        {activeTab === 'transactions' && (
          <Transactions
            onNavigateToUpload={() => setActiveTab('upload')}
          />
        )}
        {activeTab === 'insights' && <Insights />}
        {activeTab === 'connections' && (
          <Connections
            onRefreshTransactions={() => {}}
          />
        )}
        {activeTab === 'about' && <About />}
      </main>
    </div>
  );
}

export default App;
