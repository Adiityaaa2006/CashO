export interface Transaction {
  id?: number;
  amount: number;
  currency: string;
  transaction_type: 'DEBIT' | 'CREDIT';
  merchant_raw?: string;
  merchant_normalized?: string;
  category: string;
  confidence: number;
  transaction_date?: string;
  raw_text?: string;
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
