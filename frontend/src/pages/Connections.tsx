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
  const [submittingReviewId, setSubmittingReviewId] = useState<number | null>(null);
  const [syncFeedback, setSyncFeedback] = useState<BatchIngestResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [reviewFilter, setReviewFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');

  // Editable fields for review queue items
  const [editingItem, setEditingItem] = useState<{
    id: number;
    amount: string;
    merchant: string;
    category: string;
    transaction_type: string;
  } | null>(null);

  const loadData = async (filter: string = reviewFilter) => {
    try {
      setIsLoading(true);
      setErrorMsg(null);
      const [statusData, reviewData] = await Promise.all([
        fetchSyncStatus(),
        fetchReviewQueue(filter),
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
    loadData(reviewFilter);
  }, [reviewFilter]);

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
    if (submittingReviewId !== null) return; // Prevent double submissions
    try {
      setSubmittingReviewId(item.id);
      setErrorMsg(null);
      setSuccessMsg(null);
      if (action === 'reject') {
        await resolveReviewItem(item.id, { action: 'reject' });
        setSuccessMsg(`Review record #${item.id} discarded and excluded from ledger.`);
      } else {
        const amountNum = editingItem?.id === item.id && editingItem.amount
          ? parseFloat(editingItem.amount)
          : (item.suggested_amount || 0);

        if (isNaN(amountNum) || amountNum <= 0) {
          setErrorMsg('Please specify a valid amount greater than ₹0.00 to approve this record.');
          setSubmittingReviewId(null);
          return;
        }

        const resolvedType = editingItem?.id === item.id && editingItem.transaction_type
          ? editingItem.transaction_type
          : (item.suggested_transaction_type === 'CREDIT' ? 'CREDIT' : 'DEBIT');

        await resolveReviewItem(item.id, {
          action: 'approve',
          amount: amountNum,
          merchant: editingItem?.id === item.id ? editingItem.merchant : (item.suggested_merchant || ''),
          category: editingItem?.id === item.id ? editingItem.category : (item.suggested_category || 'Miscellaneous'),
          transaction_type: resolvedType,
        });
        setSuccessMsg(`✓ Approved transaction: ${editingItem?.merchant || item.suggested_merchant || 'Merchant'} (₹${amountNum.toFixed(2)} ${resolvedType}) added to ledger.`);
      }

      setEditingItem(null);
      await loadData();
      if (onRefreshTransactions) onRefreshTransactions();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to resolve review item');
    } finally {
      setSubmittingReviewId(null);
    }
  };

  if (isLoading && !syncStatus) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>SYNC TERMINAL // INITIALIZING...</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Editorial Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span className="section-label">Pipeline Ingestion</span>
            <span style={{ color: 'var(--border-strong)' }}>•</span>
            <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
              Live Telemetry & Verification
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>
            Connections & Sync
          </h1>
          <p style={{ margin: '0.35rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Automated financial stream ingestion via Gmail OAuth and Android companion gateway.
          </p>
        </div>

        <button
          onClick={() => loadData(reviewFilter)}
          className="btn-secondary btn-sm"
          title="Refresh connection status and review items"
        >
          ↻ Refresh Sync State
        </button>
      </div>

      {/* Notifications / Alerts */}
      {errorMsg && (
        <div
          style={{
            padding: '0.85rem 1.25rem',
            background: 'var(--color-debit-dim)',
            border: '1px solid rgba(229, 106, 84, 0.4)',
            borderRadius: '6px',
            color: 'var(--color-debit)',
            fontSize: '0.875rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>⚠ {errorMsg}</span>
          <button
            onClick={() => setErrorMsg(null)}
            style={{ background: 'none', border: 'none', color: 'var(--color-debit)', cursor: 'pointer', fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
      )}

      {successMsg && (
        <div
          style={{
            padding: '0.85rem 1.25rem',
            background: 'var(--accent-lime-dim)',
            border: '1px solid rgba(199, 243, 107, 0.3)',
            borderRadius: '6px',
            color: 'var(--accent-lime)',
            fontSize: '0.875rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{successMsg}</span>
          <button
            onClick={() => setSuccessMsg(null)}
            style={{ background: 'none', border: 'none', color: 'var(--accent-lime)', cursor: 'pointer', fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Connections Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
        {/* Gmail OAuth Card */}
        <div className="card-terminal" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '6px',
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-medium)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.1rem',
                  color: 'var(--accent-lime)',
                }}
              >
                ✉
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                  Gmail OAuth Ingestion
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  Bank Notices & Merchant Invoices
                </span>
              </div>
            </div>

            <span className={syncStatus?.gmail.connected ? 'badge badge-lime' : 'badge badge-gray'}>
              {syncStatus?.gmail.connected ? '● CONNECTED' : '○ DISCONNECTED'}
            </span>
          </div>

          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Scans order confirmation emails and bank transaction notices using Google OAuth with read-only scope.
            Credentials are encrypted with local AES-Fernet cryptography.
          </p>

          <div
            style={{
              background: 'var(--bg-base)',
              padding: '0.85rem 1rem',
              borderRadius: '6px',
              border: '1px solid var(--border-subtle)',
              fontSize: '0.8rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Last Synced:</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                {syncStatus?.gmail.last_synced_at ? new Date(syncStatus.gmail.last_synced_at).toLocaleString() : 'Never synced'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Cryptographic Storage:</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-lime)' }}>AES-Fernet (PBKDF2)</span>
            </div>
          </div>

          {syncFeedback && (
            <div
              style={{
                background: 'var(--accent-lime-dim)',
                border: '1px solid rgba(199, 243, 107, 0.25)',
                color: 'var(--accent-lime)',
                padding: '0.75rem 1rem',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontFamily: 'var(--font-mono)',
              }}
            >
              ✓ Ingestion complete: {syncFeedback.inserted} confirmed, {syncFeedback.duplicates} duplicates skipped, {syncFeedback.review_queue} routed to review.
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: 'auto', paddingTop: '0.5rem' }}>
            {!syncStatus?.gmail.connected ? (
              <button
                onClick={handleConnectGmail}
                className="btn-primary"
                style={{ flex: 1, justifyContent: 'center' }}
              >
                Connect Gmail Account
              </button>
            ) : (
              <>
                <button
                  onClick={handleSyncGmailNow}
                  disabled={isSyncingGmail}
                  className="btn-primary"
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  {isSyncingGmail ? 'Running Ingestion...' : 'Sync Gmail Now ↻'}
                </button>
                <button
                  onClick={handleDisconnectGmail}
                  className="btn-danger"
                  style={{ padding: '0.55rem 0.85rem' }}
                  title="Disconnect and revoke Gmail tokens"
                >
                  Disconnect
                </button>
              </>
            )}
          </div>
        </div>

        {/* Android Companion Card */}
        <div className="card-terminal" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '6px',
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-medium)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.1rem',
                  color: 'var(--color-info)',
                }}
              >
                ⎈
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                  Android Companion Bridge
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  Indian Bank SMS Listener
                </span>
              </div>
            </div>

            <span className={syncStatus?.android.connected ? 'badge badge-lime' : 'badge badge-blue'}>
              {syncStatus?.android.connected ? '● ACTIVE' : '○ READY TO PAIR'}
            </span>
          </div>

          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Native background receiver captures bank SMS notifications (HDFC, SBI, ICICI, Axis), sanitizes PII locally, and delivers structured payloads.
          </p>

          <div
            style={{
              background: 'var(--bg-base)',
              padding: '0.85rem 1rem',
              borderRadius: '6px',
              border: '1px solid var(--border-subtle)',
              fontSize: '0.8rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Last SMS Batch:</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                {syncStatus?.android.last_synced_at ? new Date(syncStatus.android.last_synced_at).toLocaleString() : 'Awaiting sync'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Target Host:</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>http://localhost:8000</span>
            </div>
          </div>

          <div
            style={{
              background: 'var(--bg-surface-elevated)',
              padding: '0.75rem 1rem',
              borderRadius: '6px',
              border: '1px solid var(--border-medium)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
                Companion Pair Token
              </div>
              <code style={{ color: 'var(--accent-lime)', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
                casho_android_sync_key_98765
              </code>
            </div>
            <button
              onClick={handleCopyApiKey}
              className="btn-secondary btn-sm"
              style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
            >
              {copiedKey ? '✓ Copied' : 'Copy'}
            </button>
          </div>

          <div style={{ marginTop: 'auto', fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            Source: <code>/android</code> • Companion ready for local sideloading
          </div>
        </div>
      </div>

      {/* Review Queue Workspace */}
      <div className="card-terminal" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
              <span className="section-label">Exception Handling</span>
              <span style={{ color: 'var(--border-strong)' }}>•</span>
              <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                Manual Verification Queue
              </span>
            </div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Transactions Needing Review
            </h3>
            <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Items flagged for low confidence, missing fields, or conflicting amounts are isolated from the confirmed ledger until approved.
            </p>
          </div>

          {/* Filter Pills */}
          <div style={{ display: 'flex', gap: '0.35rem', background: 'var(--bg-base)', padding: '0.25rem', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
            {(['pending', 'approved', 'rejected', 'all'] as const).map((filter) => {
              const isActive = reviewFilter === filter;
              return (
                <button
                  key={filter}
                  onClick={() => setReviewFilter(filter)}
                  style={{
                    background: isActive ? 'var(--bg-surface-elevated)' : 'transparent',
                    color: isActive ? 'var(--accent-lime)' : 'var(--text-muted)',
                    border: isActive ? '1px solid var(--border-medium)' : '1px solid transparent',
                    padding: '0.35rem 0.75rem',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                  }}
                >
                  {filter === 'pending'
                    ? `Pending (${syncStatus?.review_queue_pending_count ?? reviewItems.length})`
                    : filter}
                </button>
              );
            })}
          </div>
        </div>

        {/* Review Items List */}
        {reviewItems.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '3rem 1.5rem',
              color: 'var(--text-muted)',
              background: 'var(--bg-base)',
              borderRadius: '6px',
              border: '1px dashed var(--border-medium)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.85rem',
            }}
          >
            No records in {reviewFilter} scope. Financial stream processing is verified.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {reviewItems.map((item) => {
              const isEditing = editingItem?.id === item.id;
              const isSubmitting = submittingReviewId === item.id;
              const currentAmount = isEditing ? editingItem.amount : (item.suggested_amount ? String(item.suggested_amount) : '');
              const currentMerchant = isEditing ? editingItem.merchant : (item.suggested_merchant || '');
              const currentCategory = isEditing ? editingItem.category : (item.suggested_category || 'Miscellaneous');
              const currentType = isEditing ? editingItem.transaction_type : (item.suggested_transaction_type === 'CREDIT' ? 'CREDIT' : 'DEBIT');

              return (
                <div
                  key={item.id}
                  style={{
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: '6px',
                    padding: '1.1rem 1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.85rem',
                  }}
                >
                  {/* Top Metadata Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      {item.source.toLowerCase().includes('android') || item.source.toLowerCase() === 'sms' ? (
                        <span className="badge badge-blue">📱 ANDROID SMS</span>
                      ) : item.source.toLowerCase().includes('gmail') ? (
                        <span className="badge badge-lime">✉ GMAIL</span>
                      ) : (
                        <span className="badge badge-gray">{item.source.toUpperCase()}</span>
                      )}

                      {item.reason === 'pending_user_approval' ? (
                        <span className="badge badge-lime">READY FOR APPROVAL</span>
                      ) : item.reason === 'missing_amount' ? (
                        <span className="badge badge-coral">MISSING AMOUNT</span>
                      ) : item.reason === 'unknown_direction' || item.reason === 'unsupported_type_unknown' ? (
                        <span className="badge badge-yellow" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#FBBF24', border: '1px solid rgba(245, 158, 11, 0.4)' }}>
                          UNCLEAR DIRECTION
                        </span>
                      ) : item.reason === 'failed_payment' ? (
                        <span className="badge badge-coral">FAILED PAYMENT</span>
                      ) : (
                        <span className="badge badge-coral">FLAG: {item.reason}</span>
                      )}

                      {item.status !== 'pending' && (
                        <span className={item.status === 'approved' ? 'badge badge-lime' : 'badge badge-coral'}>
                          {item.status.toUpperCase()}
                        </span>
                      )}

                      {item.external_id && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          Ref: <code style={{ color: 'var(--accent-lime)' }}>{item.external_id}</code>
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                      {item.suggested_date && (
                        <span style={{ color: 'var(--text-secondary)' }}>
                          Txn Date: <strong style={{ color: 'var(--text-primary)' }}>{new Date(item.suggested_date).toLocaleDateString()}</strong>
                        </span>
                      )}
                      <span style={{ color: 'var(--text-muted)' }}>
                        #{item.id} • {new Date(item.created_at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    </div>
                  </div>

                  {/* Informative Guidance Banner for Ambiguous Items */}
                  {item.status === 'pending' && (!item.suggested_amount || item.suggested_transaction_type === 'UNKNOWN' || item.reason === 'failed_payment') && (
                    <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '4px', padding: '0.45rem 0.75rem', fontSize: '0.78rem', color: '#FBBF24' }}>
                      {!item.suggested_amount
                        ? '⚠️ Amount could not be confidently recognized. Please inspect the message and specify amount.'
                        : item.suggested_transaction_type === 'UNKNOWN'
                        ? '⚠️ Flow direction is ambiguous. Verify whether money entered (CREDIT) or left (DEBIT) your account.'
                        : '⚠️ This payment was flagged as declined/failed. Verify before approving.'}
                    </div>
                  )}

                  {/* Raw Masked Source Text */}
                  <div
                    style={{
                      fontSize: '0.825rem',
                      color: 'var(--text-secondary)',
                      background: 'var(--bg-surface-elevated)',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '5px',
                      border: '1px solid var(--border-subtle)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    "{item.raw_text}"
                  </div>

                  {/* Actions / Editing Form */}
                  {item.status === 'pending' ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', marginTop: '0.25rem' }}>
                      {/* Amount Field */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          ₹ AMOUNT:
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={currentAmount}
                          onChange={(e) => {
                            setEditingItem({
                              id: item.id,
                              amount: e.target.value,
                              merchant: currentMerchant,
                              category: currentCategory,
                              transaction_type: currentType,
                            });
                          }}
                          className="input-terminal tabular-nums"
                          style={{ width: '100px', padding: '0.4rem 0.55rem', fontSize: '0.825rem' }}
                        />
                      </div>

                      {/* Direction Selector */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          FLOW:
                        </label>
                        <select
                          value={currentType}
                          onChange={(e) => {
                            setEditingItem({
                              id: item.id,
                              amount: currentAmount,
                              merchant: currentMerchant,
                              category: currentCategory,
                              transaction_type: e.target.value,
                            });
                          }}
                          className="select-terminal"
                          style={{
                            padding: '0.4rem 0.55rem',
                            fontSize: '0.8rem',
                            color: currentType === 'CREDIT' ? 'var(--color-credit)' : 'var(--color-debit)',
                            fontWeight: 600,
                          }}
                        >
                          <option value="DEBIT">OUTFLOW (DEBIT)</option>
                          <option value="CREDIT">INFLOW (CREDIT)</option>
                        </select>
                      </div>

                      {/* Merchant Field */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          ENTITY:
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Swiggy, Amazon"
                          value={currentMerchant}
                          onChange={(e) => {
                            setEditingItem({
                              id: item.id,
                              amount: currentAmount,
                              merchant: e.target.value,
                              category: currentCategory,
                              transaction_type: currentType,
                            });
                          }}
                          className="input-terminal"
                          style={{ width: '130px', padding: '0.4rem 0.55rem', fontSize: '0.825rem' }}
                        />
                      </div>

                      {/* Category Field */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          CAT:
                        </label>
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
                              transaction_type: currentType,
                            });
                          }}
                          className="input-terminal"
                          style={{ width: '120px', padding: '0.4rem 0.55rem', fontSize: '0.825rem' }}
                        />
                      </div>

                      {/* Action Buttons */}
                      <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
                        <button
                          onClick={() => handleResolveReview(item, 'approve')}
                          disabled={isSubmitting}
                          className="btn-primary btn-sm"
                        >
                          {isSubmitting ? 'Approving...' : 'Approve & Post ✓'}
                        </button>
                        <button
                          onClick={() => handleResolveReview(item, 'reject')}
                          disabled={isSubmitting}
                          className="btn-danger btn-sm"
                        >
                          Discard
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      STATUS: <strong style={{ color: item.status === 'approved' ? 'var(--accent-lime)' : 'var(--color-debit)' }}>{item.status.toUpperCase()}</strong> • Suggested: ₹{item.suggested_amount ?? '0.00'} at {item.suggested_merchant || 'Unknown'} ({item.suggested_category || 'Miscellaneous'})
                    </div>
                  )}
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
