// Pure helpers for scripts/cost-report.mjs, kept separate so they can be unit tested.

/** Days are Asia/Dhaka calendar days, matching usage_daily and spend_daily. */
export function usageQuery(days) {
  if (!Number.isInteger(days) || days < 1 || days > 366) throw new Error('days must be an integer from 1 to 366');
  return `SELECT substr(datetime(created_at, '+6 hours'), 1, 10) AS day,
  endpoint,
  COUNT(*) AS requests,
  SUM(CASE WHEN status = 'ok' THEN 1 ELSE 0 END) AS answered,
  SUM(CASE WHEN status = 'ok' AND cached = 1 THEN 1 ELSE 0 END) AS cache_hits,
  SUM(CASE WHEN status = 'refunded' THEN 1 ELSE 0 END) AS refunded,
  SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected,
  SUM(CASE WHEN status = 'ok' THEN credits ELSE 0 END) AS credits,
  COALESCE(SUM(tokens_in), 0) AS tokens_in,
  COALESCE(SUM(tokens_out), 0) AS tokens_out,
  COUNT(DISTINCT user_id) AS users,
  CAST(AVG(CASE WHEN status = 'ok' AND cached = 0 THEN latency_ms END) AS INTEGER) AS model_latency_ms
FROM usage_events
WHERE created_at >= datetime('now', '-${days} days')
GROUP BY day, endpoint
ORDER BY day, endpoint`;
}

export function spendQuery(days) {
  if (!Number.isInteger(days) || days < 1 || days > 366) throw new Error('days must be an integer from 1 to 366');
  return `SELECT day, plan, micro_usd FROM spend_daily
WHERE day >= substr(datetime('now', '+6 hours', '-${days} days'), 1, 10)
ORDER BY day, plan`;
}

/** USD for a token count, with prices in USD per million tokens. */
export function tokenCostUsd(tokensIn, tokensOut, prices) {
  return (tokensIn * prices.inputPerMTok + tokensOut * prices.outputPerMTok) / 1_000_000;
}

const ratio = (part, whole) => (whole > 0 ? part / whole : 0);

/**
 * Turns grouped usage rows into per-row costs plus totals. The number that matters for pricing is
 * `costPerCredit`: model spend divided by credits charged, including spend on refunded attempts.
 */
export function summarize(rows, prices) {
  const lines = rows.map((r) => {
    const costUsd = tokenCostUsd(r.tokens_in, r.tokens_out, prices);
    return {
      day: r.day,
      endpoint: r.endpoint,
      requests: r.requests,
      answered: r.answered,
      cacheHitRate: ratio(r.cache_hits, r.answered),
      refunded: r.refunded,
      rejected: r.rejected,
      credits: r.credits,
      users: r.users,
      tokensIn: r.tokens_in,
      tokensOut: r.tokens_out,
      modelLatencyMs: r.model_latency_ms,
      costUsd,
      costPerCredit: ratio(costUsd, r.credits)
    };
  });

  const sum = (key) => rows.reduce((n, r) => n + (r[key] ?? 0), 0);
  const tokensIn = sum('tokens_in');
  const tokensOut = sum('tokens_out');
  const costUsd = tokenCostUsd(tokensIn, tokensOut, prices);
  const credits = sum('credits');
  const answered = sum('answered');
  return {
    lines,
    totals: {
      requests: sum('requests'),
      answered,
      cacheHitRate: ratio(sum('cache_hits'), answered),
      refundRate: ratio(sum('refunded'), sum('requests')),
      rejected: sum('rejected'),
      credits,
      tokensIn,
      tokensOut,
      costUsd,
      costPerCredit: ratio(costUsd, credits)
    }
  };
}

/** Reads the price and budget vars from wrangler.toml so the report uses what the Worker uses. */
export function readPricing(wranglerToml) {
  const value = (name, fallback) => {
    const m = new RegExp(`^${name}\\s*=\\s*"([^"]*)"`, 'm').exec(wranglerToml);
    const n = m ? Number(m[1]) : NaN;
    return Number.isFinite(n) ? n : fallback;
  };
  return {
    inputPerMTok: value('GEMINI_INPUT_USD_PER_MTOK', 0.1),
    outputPerMTok: value('GEMINI_OUTPUT_USD_PER_MTOK', 0.4),
    freeDailyBudgetUsd: value('FREE_DAILY_BUDGET_USD', 5)
  };
}
