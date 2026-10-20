import { PipelineResult, SummaryData, Transaction, RuleTraceItem } from './types';

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
