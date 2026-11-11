export interface Pricing {
  inputPerMTok: number;
  outputPerMTok: number;
  freeDailyBudgetUsd: number;
}

export interface UsageRow {
  day: string;
  endpoint: string;
  requests: number;
  answered: number;
  cache_hits: number;
  refunded: number;
  rejected: number;
  credits: number;
  tokens_in: number;
  tokens_out: number;
  users: number;
  model_latency_ms: number | null;
}

export interface SummaryLine {
  day: string;
  endpoint: string;
  requests: number;
  answered: number;
  cacheHitRate: number;
  refunded: number;
  rejected: number;
  credits: number;
  users: number;
  tokensIn: number;
  tokensOut: number;
  modelLatencyMs: number | null;
  costUsd: number;
  costPerCredit: number;
}

export interface Summary {
  lines: SummaryLine[];
  totals: {
    requests: number;
    answered: number;
    cacheHitRate: number;
    refundRate: number;
    rejected: number;
    credits: number;
    tokensIn: number;
    tokensOut: number;
    costUsd: number;
    costPerCredit: number;
  };
}

export function usageQuery(days: number): string;
export function spendQuery(days: number): string;
export function tokenCostUsd(tokensIn: number, tokensOut: number, prices: Pick<Pricing, 'inputPerMTok' | 'outputPerMTok'>): number;
export function summarize(rows: UsageRow[], prices: Pick<Pricing, 'inputPerMTok' | 'outputPerMTok'>): Summary;
export const DATABASES: { local: string; staging: string; production: string };
export function readPricing(wranglerToml: string, env?: 'staging' | 'production'): Pricing;
