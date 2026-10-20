export interface Transaction {
  id?: number;
  amount: number | null;
  currency: string;
  transaction_type: 'DEBIT' | 'CREDIT' | 'FAILED' | 'UNKNOWN';
  merchant_raw?: string | null;
  merchant_normalized?: string | null;
  category: string;
  confidence: number;
  transaction_date?: string | null;
  raw_text?: string;
  is_complete?: boolean;
  source?: string;
  external_id?: string | null;
  review_status?: string;
}

export interface RuleTraceItem {
  rule_name: string;
  description: string;
  recommendation: string;
  severity: 'info' | 'warning' | 'success';
}

export interface PipelineResult {
  transaction: Transaction;
  rule_traces: RuleTraceItem[];
  metadata: Record<string, any>;
}

export interface SummaryData {
  total_spent: number;
  total_income: number;
  category_breakdown: Record<string, number>;
  transaction_count: number;
}

export interface ProviderStatus {
  connected: boolean;
  status: string;
  last_synced_at?: string | null;
  error_message?: string | null;
}

export interface SyncStatus {
  gmail: ProviderStatus;
  android: ProviderStatus;
  review_queue_pending_count: number;
}

export interface ReviewItem {
  id: number;
  source: string;
  external_id?: string | null;
  raw_text: string;
  suggested_amount?: number | null;
  suggested_currency: string;
  suggested_merchant?: string | null;
  suggested_category?: string | null;
  suggested_date?: string | null;
  reason: string;
  status: string;
  created_at: string;
}

export interface BatchIngestResponse {
  total_received: number;
  inserted: number;
  duplicates: number;
  review_queue: number;
  skipped: number;
}
