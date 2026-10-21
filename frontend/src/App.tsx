import React, { useState, useEffect } from 'react';
import Dashboard from './pages/Dashboard';
import Upload from './pages/Upload';
import Transactions from './pages/Transactions';
import Insights from './pages/Insights';
import Connections from './pages/Connections';
import About from './pages/About';
import { fetchSyncStatus } from './lib/api';
import { SyncStatus } from './lib/types';

export function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'upload' | 'insights' | 'connections' | 'about'>('dashboard');
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const loadStatus = async () => {
    try {
      const data = await fetchSyncStatus();
      setSyncStatus(data);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  interface NavItem {
    id: typeof activeTab;
    label: string;
    icon: string;
    badge?: string | null;
  }

  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: '◈' },
    { id: 'transactions', label: 'Transactions', icon: '☰' },
    { id: 'upload', label: 'Ingest & Parse', icon: '⊕' },
    { id: 'insights', label: 'AI Advisory', icon: '◬' },
    {
      id: 'connections',
      label: 'Connections',
      icon: '⚡',
      badge: syncStatus?.review_queue_pending_count ? `${syncStatus.review_queue_pending_count}` : null,
    },
    { id: 'about', label: 'System Specs', icon: 'ℹ' },
  ];

  const handleNav = (tab: typeof activeTab, category?: string) => {
    setSelectedCategory(category);
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      {/* Desktop Persistent Sidebar */}
      <aside
        style={{
          width: '240px',
          background: 'var(--bg-surface)',
          borderRight: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          position: 'sticky',
          top: 0,
          height: '100vh',
          zIndex: 40,
        }}
        className="desktop-sidebar"
      >
        {/* Brand Header */}
        <div style={{ padding: '1.5rem 1.25rem', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-strong)',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-lime)',
                fontWeight: 800,
                fontSize: '1rem',
                fontFamily: 'var(--font-mono)',
              }}
            >
              ⟠
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                CashO
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                FINTECH TERMINAL
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav style={{ padding: '1rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', padding: '0.5rem 0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Navigation
          </div>
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.6rem 0.75rem',
                  borderRadius: '6px',
                  background: isActive ? 'var(--bg-surface-elevated)' : 'transparent',
                  color: isActive ? 'var(--accent-lime)' : 'var(--text-secondary)',
                  border: isActive ? '1px solid var(--border-medium)' : '1px solid transparent',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: isActive ? 600 : 500,
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <span style={{ fontSize: '0.9rem', color: isActive ? 'var(--accent-lime)' : 'var(--text-muted)' }}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    style={{
                      background: 'rgba(245, 158, 11, 0.15)',
                      color: '#FBBF24',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      padding: '0.1rem 0.4rem',
                      borderRadius: '10px',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom System Status */}
        <div style={{ padding: '1rem', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-surface-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: syncStatus?.gmail.connected ? 'var(--accent-lime)' : '#6B7280',
                }}
              />
              {syncStatus?.gmail.connected ? 'Gmail Active' : 'Gmail Standby'}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>v1.0</span>
          </div>
        </div>
      </aside>

      {/* Main App Canvas */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top Header Bar */}
        <header
          style={{
            height: '56px',
            background: 'var(--bg-surface)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 1.5rem',
            position: 'sticky',
            top: 0,
            zIndex: 30,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="mobile-nav-bar"
              style={{
                display: 'none',
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-medium)',
                color: 'var(--text-primary)',
                padding: '0.35rem 0.6rem',
                borderRadius: '5px',
                fontSize: '1rem',
                cursor: 'pointer',
              }}
              aria-label="Toggle navigation"
            >
              ☰
            </button>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
              Terminal /
            </span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.9rem', textTransform: 'capitalize' }}>
              {activeTab}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.72rem',
                color: 'var(--text-muted)',
                background: 'var(--bg-surface-elevated)',
                padding: '0.25rem 0.55rem',
                borderRadius: '4px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              OCT 2026 • INR ₹
            </span>

            <button
              onClick={() => handleNav('upload')}
              className="btn-primary btn-sm"
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.78rem',
              }}
            >
              <span>+</span> Ingest SMS
            </button>
          </div>
        </header>

        {/* Mobile Slide-Over Drawer */}
        {mobileMenuOpen && (
          <div
            style={{
              position: 'fixed',
              top: '56px',
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.7)',
              zIndex: 50,
              display: 'flex',
            }}
            onClick={() => setMobileMenuOpen(false)}
          >
            <div
              style={{
                width: '260px',
                background: 'var(--bg-surface)',
                borderRight: '1px solid var(--border-medium)',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                padding: '1rem',
                gap: '0.5rem',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0.5rem' }}>
                Navigation Menu
              </div>
              {navItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNav(item.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.75rem 0.85rem',
                      borderRadius: '6px',
                      background: isActive ? 'var(--bg-surface-elevated)' : 'transparent',
                      color: isActive ? 'var(--accent-lime)' : 'var(--text-secondary)',
                      border: isActive ? '1px solid var(--border-medium)' : '1px solid transparent',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: isActive ? 600 : 500,
                      textAlign: 'left',
                      width: '100%',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <span style={{ fontSize: '1rem', color: isActive ? 'var(--accent-lime)' : 'var(--text-muted)' }}>
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="badge badge-amber">{item.badge}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Viewport Content */}
        <main
          className="app-main-canvas"
          style={{
            flex: 1,
            padding: '2rem 2.5rem',
            maxWidth: '1240px',
            width: '100%',
            margin: '0 auto',
            boxSizing: 'border-box',
          }}
        >
          {activeTab === 'dashboard' && (
            <Dashboard
              onNavigateToUpload={() => handleNav('upload')}
              onNavigateToTransactions={(cat) => handleNav('transactions', cat)}
              onNavigateToConnections={() => handleNav('connections')}
            />
          )}

          {activeTab === 'transactions' && (
            <Transactions
              onNavigateToUpload={() => handleNav('upload')}
              initialCategory={selectedCategory}
            />
          )}

          {activeTab === 'upload' && (
            <Upload
              onNavigateToTransactions={() => handleNav('transactions')}
            />
          )}

          {activeTab === 'insights' && <Insights />}

          {activeTab === 'connections' && (
            <Connections
              onRefreshTransactions={loadStatus}
            />
          )}

          {activeTab === 'about' && <About />}
        </main>
      </div>
    </div>
  );
}

export default App;
