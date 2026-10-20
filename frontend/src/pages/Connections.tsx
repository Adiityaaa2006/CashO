import React, { useState, useEffect } from 'react';
import {
  fetchSyncStatus,
  fetchGmailAuthUrl,
  disconnectGmail,
  triggerGmailSync,
  fetchReviewQueue,
  resolveReviewItem,
} from '../lib/api';
import { SyncStatus, ReviewItem, BatchIngestResponse } from '../lib/types';

interface ConnectionsProps {
  onRefreshTransactions?: () => void;
}

export function Connections({ onRefreshTransactions }: ConnectionsProps) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncingGmail, setIsSyncingGmail] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<BatchIngestResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Editable fields for review queue items
  const [editingItem, setEditingItem] = useState<{
    id: number;
    amount: string;
    merchant: string;
    category: string;
    transaction_type: string;
  } | null>(null);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);
      const [statusData, reviewData] = await Promise.all([
        fetchSyncStatus(),
        fetchReviewQueue('pending'),
      ]);
      setSyncStatus(statusData);
      setReviewItems(reviewData);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load connections status');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleConnectGmail = async () => {
    try {
      setErrorMsg(null);
      const { auth_url } = await fetchGmailAuthUrl();
      window.location.href = auth_url;
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not initiate Google OAuth. Verify GOOGLE_CLIENT_ID in backend.');
    }
  };

  const handleDisconnectGmail = async () => {
    if (!window.confirm('Are you sure you want to disconnect Gmail?')) return;
    try {
      setErrorMsg(null);
      await disconnectGmail();
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to disconnect Gmail');
    }
  };

  const handleSyncGmailNow = async () => {
    try {
      setIsSyncingGmail(true);
      setErrorMsg(null);
      setSyncFeedback(null);
      const res = await triggerGmailSync(50);
      setSyncFeedback(res);
      await loadData();
      if (onRefreshTransactions) onRefreshTransactions();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gmail sync failed');
    } finally {
      setIsSyncingGmail(false);
    }
  };

  const handleCopyApiKey = () => {
    navigator.clipboard.writeText('casho_android_sync_key_98765');
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2500);
  };

  const handleResolveReview = async (item: ReviewItem, action: 'approve' | 'reject') => {
    try {
      setErrorMsg(null);
      if (action === 'reject') {
        await resolveReviewItem(item.id, { action: 'reject' });
      } else {
        const amountNum = editingItem?.id === item.id && editingItem.amount
          ? parseFloat(editingItem.amount)
          : (item.suggested_amount || 0);

        if (isNaN(amountNum) || amountNum <= 0) {
          setErrorMsg('Please specify a valid amount to approve this transaction.');
          return;
        }

        await resolveReviewItem(item.id, {
          action: 'approve',
          amount: amountNum,
          merchant: editingItem?.id === item.id ? editingItem.merchant : (item.suggested_merchant || ''),
          category: editingItem?.id === item.id ? editingItem.category : (item.suggested_category || 'Miscellaneous'),
          transaction_type: editingItem?.id === item.id ? editingItem.transaction_type : 'DEBIT',
        });
      }

      setEditingItem(null);
      await loadData();
      if (onRefreshTransactions) onRefreshTransactions();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to resolve review item');
    }
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
        Loading connections & sync state...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h2 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700, color: '#f8fafc' }}>
          Data Sources & Auto-Sync ⚡
        </h2>
        <p style={{ margin: '0.25rem 0 0 0', color: '#94a3b8', fontSize: '0.95rem' }}>
          Automatically ingest bank transactions from Gmail order alerts and your Android SMS companion.
        </p>
      </div>

      {errorMsg && (
        <div style={{ padding: '1rem', background: '#451a1a', border: '1px solid #dc2626', borderRadius: '0.5rem', color: '#fca5a5' }}>
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Connection Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
        {/* Gmail Sync Card */}
        <div style={{ background: '#1e293b', borderRadius: '0.75rem', padding: '1.5rem', border: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.75rem' }}>📧</span>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#f8fafc', fontWeight: 600 }}>Gmail Integration</h3>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Bank alerts, Swiggy, Amazon receipts</span>
              </div>
            </div>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '0.25rem 0.6rem',
                borderRadius: '1rem',
                background: syncStatus?.gmail.connected ? '#065f46' : '#334155',
                color: syncStatus?.gmail.connected ? '#34d399' : '#94a3b8',
              }}
            >
              {syncStatus?.gmail.connected ? '● CONNECTED' : '○ DISCONNECTED'}
            </span>
          </div>

          <p style={{ margin: 0, fontSize: '0.875rem', color: '#cbd5e1', lineHeight: 1.5 }}>
            Scans order confirmation emails and bank transaction notices using Google OAuth with minimal read-only scope.
          </p>

          <div style={{ fontSize: '0.8rem', color: '#94a3b8', background: '#0f172a', padding: '0.75rem', borderRadius: '0.5rem' }}>
            <div>Last Synced: <strong>{syncStatus?.gmail.last_synced_at ? new Date(syncStatus.gmail.last_synced_at).toLocaleString() : 'Never'}</strong></div>
            <div>Scope: <code>gmail.readonly</code> (Tokens AES-Fernet encrypted)</div>
          </div>

          {syncFeedback && (
            <div style={{ background: '#064e3b', border: '1px solid #059669', color: '#a7f3d0', padding: '0.75rem', borderRadius: '0.5rem', fontSize: '0.85rem' }}>
              ✓ Sync complete: {syncFeedback.inserted} added, {syncFeedback.duplicates} duplicates skipped, {syncFeedback.review_queue} sent for review.
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: 'auto' }}>
            {!syncStatus?.gmail.connected ? (
              <button
                onClick={handleConnectGmail}
                style={{
                  background: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.65rem 1.25rem',
                  borderRadius: '0.5rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  flex: 1,
                }}
              >
                Connect Gmail Account
              </button>
            ) : (
              <>
                <button
                  onClick={handleSyncGmailNow}
                  disabled={isSyncingGmail}
                  style={{
                    background: '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    padding: '0.65rem 1.25rem',
                    borderRadius: '0.5rem',
                    fontWeight: 600,
                    cursor: isSyncingGmail ? 'not-allowed' : 'pointer',
                    flex: 1,
                  }}
                >
                  {isSyncingGmail ? 'Syncing...' : 'Sync Gmail Now 🔄'}
                </button>
                <button
                  onClick={handleDisconnectGmail}
                  style={{
                    background: 'transparent',
                    color: '#ef4444',
                    border: '1px solid #ef4444',
                    padding: '0.65rem 1rem',
                    borderRadius: '0.5rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Disconnect
                </button>
              </>
            )}
          </div>
        </div>

        {/* Android Companion Card */}
        <div style={{ background: '#1e293b', borderRadius: '0.75rem', padding: '1.5rem', border: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.75rem' }}>📱</span>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#f8fafc', fontWeight: 600 }}>Android Companion</h3>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Real-time Indian Bank SMS Ingestion</span>
              </div>
            </div>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '0.25rem 0.6rem',
                borderRadius: '1rem',
                background: syncStatus?.android.connected ? '#065f46' : '#1e3a8a',
                color: syncStatus?.android.connected ? '#34d399' : '#60a5fa',
              }}
            >
              {syncStatus?.android.connected ? '● ACTIVE' : '○ READY TO PAIR'}
            </span>
          </div>

          <p style={{ margin: 0, fontSize: '0.875rem', color: '#cbd5e1', lineHeight: 1.5 }}>
            Our companion app runs on your phone, locally filters bank SMS (HDFC, SBI, ICICI, etc.), and securely transmits transactions.
          </p>

          <div style={{ fontSize: '0.8rem', color: '#94a3b8', background: '#0f172a', padding: '0.75rem', borderRadius: '0.5rem' }}>
            <div>Last SMS Upload: <strong>{syncStatus?.android.last_synced_at ? new Date(syncStatus.android.last_synced_at).toLocaleString() : 'Awaiting first sync'}</strong></div>
            <div style={{ marginTop: '0.25rem' }}>Backend Server: <code>http://localhost:8000</code></div>
          </div>

          <div style={{ background: '#0f172a', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #334155' }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Companion Pairing API Token:</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <code style={{ color: '#38bdf8', fontSize: '0.85rem' }}>casho_android_sync_key_98765</code>
              <button
                onClick={handleCopyApiKey}
                style={{
                  background: copiedKey ? '#10b981' : '#334155',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '0.25rem',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                }}
              >
                {copiedKey ? 'Copied! ✓' : 'Copy Key'}
              </button>
            </div>
          </div>

          <div style={{ marginTop: 'auto', fontSize: '0.8rem', color: '#64748b' }}>
            ℹ️ Companion source code is available in <code>/android</code>. Open in Android Studio to build & sideload.
          </div>
        </div>
      </div>

      {/* Review Queue Section */}
      <div style={{ background: '#1e293b', borderRadius: '0.75rem', padding: '1.5rem', border: '1px solid #334155' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc' }}>
              Transactions Needing Review 🔍
            </h3>
            <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
              Ambiguous messages, missing amounts, or unconfirmed spends needing your verification
            </span>
          </div>
          <span
            style={{
              background: reviewItems.length > 0 ? '#b45309' : '#065f46',
              color: '#ffffff',
              padding: '0.35rem 0.75rem',
              borderRadius: '1rem',
              fontSize: '0.85rem',
              fontWeight: 700,
            }}
          >
            {reviewItems.length} Pending
          </span>
        </div>

        {reviewItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#94a3b8', background: '#0f172a', borderRadius: '0.5rem' }}>
            🎉 All ingested transactions have been verified and processed cleanly! No review required.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {reviewItems.map((item) => {
              const isEditing = editingItem?.id === item.id;
              const currentAmount = isEditing ? editingItem.amount : (item.suggested_amount ? String(item.suggested_amount) : '');
              const currentMerchant = isEditing ? editingItem.merchant : (item.suggested_merchant || '');
              const currentCategory = isEditing ? editingItem.category : (item.suggested_category || 'Miscellaneous');

              return (
                <div
                  key={item.id}
                  style={{
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '0.5rem',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span style={{ background: '#334155', color: '#94a3b8', fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '0.25rem', textTransform: 'uppercase', fontWeight: 700 }}>
                        {item.source}
                      </span>
                      <span style={{ background: '#7c2d12', color: '#fdba74', fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '0.25rem', fontWeight: 600 }}>
                        Reason: {item.reason}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {new Date(item.created_at).toLocaleTimeString()}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.9rem', color: '#cbd5e1', fontStyle: 'italic', background: '#1e293b', padding: '0.5rem 0.75rem', borderRadius: '0.375rem' }}>
                    "{item.raw_text}"
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Amount (₹):</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="e.g. 250"
                        value={currentAmount}
                        onChange={(e) => {
                          setEditingItem({
                            id: item.id,
                            amount: e.target.value,
                            merchant: currentMerchant,
                            category: currentCategory,
                            transaction_type: 'DEBIT',
                          });
                        }}
                        style={{
                          background: '#1e293b',
                          border: '1px solid #475569',
                          color: '#ffffff',
                          padding: '0.35rem 0.5rem',
                          borderRadius: '0.25rem',
                          width: '100px',
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Merchant:</label>
                      <input
                        type="text"
                        placeholder="e.g. Starbucks"
                        value={currentMerchant}
                        onChange={(e) => {
                          setEditingItem({
                            id: item.id,
                            amount: currentAmount,
                            merchant: e.target.value,
                            category: currentCategory,
                            transaction_type: 'DEBIT',
                          });
                        }}
                        style={{
                          background: '#1e293b',
                          border: '1px solid #475569',
                          color: '#ffffff',
                          padding: '0.35rem 0.5rem',
                          borderRadius: '0.25rem',
                          width: '140px',
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Category:</label>
                      <input
                        type="text"
                        placeholder="Food & Dining"
                        value={currentCategory}
                        onChange={(e) => {
                          setEditingItem({
                            id: item.id,
                            amount: currentAmount,
                            merchant: currentMerchant,
                            category: e.target.value,
                            transaction_type: 'DEBIT',
                          });
                        }}
                        style={{
                          background: '#1e293b',
                          border: '1px solid #475569',
                          color: '#ffffff',
                          padding: '0.35rem 0.5rem',
                          borderRadius: '0.25rem',
                          width: '130px',
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
                      <button
                        onClick={() => handleResolveReview(item, 'approve')}
                        style={{
                          background: '#10b981',
                          color: '#ffffff',
                          border: 'none',
                          padding: '0.4rem 0.85rem',
                          borderRadius: '0.375rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                        }}
                      >
                        Approve & Save ✓
                      </button>
                      <button
                        onClick={() => handleResolveReview(item, 'reject')}
                        style={{
                          background: 'transparent',
                          color: '#ef4444',
                          border: '1px solid #ef4444',
                          padding: '0.4rem 0.75rem',
                          borderRadius: '0.375rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                        }}
                      >
                        Discard ✕
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default Connections;
