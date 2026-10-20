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
