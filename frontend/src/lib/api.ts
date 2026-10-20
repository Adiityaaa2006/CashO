import {
  PipelineResult,
  SummaryData,
  Transaction,
  RuleTraceItem,
  SyncStatus,
  ReviewItem,
  BatchIngestResponse
} from './types';

const API_BASE = 'http://localhost:8000/api';

export async function parseMessage(text: string, source: 'sms' | 'email' = 'sms'): Promise<PipelineResult> {
  const response = await fetch(`${API_BASE}/parse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, source }),
  });
  if (!response.ok) {
    throw new Error(`Failed to parse text: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchTransactions(): Promise<Transaction[]> {
  const response = await fetch(`${API_BASE}/transactions`);
  if (!response.ok) {
    throw new Error('Failed to fetch transactions');
  }
  return response.json();
}

export async function fetchSummary(): Promise<SummaryData> {
  const response = await fetch(`${API_BASE}/summary`);
  if (!response.ok) {
    throw new Error('Failed to fetch summary');
  }
  return response.json();
}

export async function fetchAdvice(): Promise<RuleTraceItem[]> {
  const response = await fetch(`${API_BASE}/advice`);
  if (!response.ok) {
    throw new Error('Failed to fetch advice');
  }
  return response.json();
}

// Synchronization & Review API Calls
export async function fetchSyncStatus(): Promise<SyncStatus> {
  const response = await fetch(`${API_BASE}/sync/status`);
  if (!response.ok) {
    throw new Error('Failed to fetch synchronization status');
  }
  return response.json();
}

export async function fetchGmailAuthUrl(): Promise<{ auth_url: string; state: string }> {
  const response = await fetch(`${API_BASE}/sync/gmail/auth-url`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to retrieve Gmail OAuth URL' }));
    throw new Error(error.detail || 'Failed to retrieve Gmail OAuth URL');
  }
  return response.json();
}

export async function disconnectGmail(): Promise<{ status: string; message: string }> {
  const response = await fetch(`${API_BASE}/sync/gmail/disconnect`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error('Failed to disconnect Gmail');
  }
  return response.json();
}

export async function triggerGmailSync(maxMessages = 50, forceFull = false): Promise<BatchIngestResponse> {
  const response = await fetch(`${API_BASE}/sync/gmail/trigger?max_messages=${maxMessages}&force_full=${forceFull}`, {
    method: 'POST',
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Gmail sync failed' }));
    throw new Error(error.detail || 'Gmail sync failed');
  }
  return response.json();
}

export async function fetchReviewQueue(statusFilter = 'pending'): Promise<ReviewItem[]> {
  const response = await fetch(`${API_BASE}/review?status_filter=${statusFilter}`);
  if (!response.ok) {
    throw new Error('Failed to fetch review queue');
  }
  return response.json();
}

export async function resolveReviewItem(
  id: number,
  data: {
    action: 'approve' | 'reject';
    amount?: number;
    merchant?: string;
    category?: string;
    transaction_type?: string;
  }
): Promise<{ status: string; transaction_id?: number }> {
  const response = await fetch(`${API_BASE}/review/${id}/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to resolve review item' }));
    throw new Error(error.detail || 'Failed to resolve review item');
  }
  return response.json();
}
