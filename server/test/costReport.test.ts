import { describe, expect, it } from 'vitest';
import { readPricing, spendQuery, summarize, tokenCostUsd, usageQuery, type UsageRow } from '../scripts/costReport.mjs';
import { createTestD1 } from './d1';

const prices = { inputPerMTok: 0.1, outputPerMTok: 0.4 };

function row(overrides: Partial<UsageRow>): UsageRow {
  return {
    day: '2026-10-23',
    endpoint: 'stage-a',
    requests: 0,
    answered: 0,
    cache_hits: 0,
    refunded: 0,
    rejected: 0,
    credits: 0,
    tokens_in: 0,
    tokens_out: 0,
    users: 0,
    model_latency_ms: null,
    ...overrides
  };
}

describe('cost report', () => {
  it('prices tokens per million', () => {
    expect(tokenCostUsd(1_000_000, 1_000_000, prices)).toBeCloseTo(0.5);
  });

  it('computes cost per charged credit, cache hit rate and refund rate', () => {
    const { lines, totals } = summarize(
      [
        row({ endpoint: 'stage-a', requests: 10, answered: 8, cache_hits: 2, refunded: 1, rejected: 1, credits: 8, tokens_in: 4000, tokens_out: 1000 }),
        row({ endpoint: 'stage-b', requests: 10, answered: 10, cache_hits: 5, credits: 10, tokens_in: 6000, tokens_out: 4000 })
      ],
      prices
    );

    expect(lines[0].costUsd).toBeCloseTo((4000 * 0.1 + 1000 * 0.4) / 1e6);
    expect(lines[0].cacheHitRate).toBeCloseTo(0.25);
    expect(totals).toMatchObject({ requests: 20, answered: 18, credits: 18, rejected: 1, tokensIn: 10000, tokensOut: 5000 });
    expect(totals.costUsd).toBeCloseTo(0.003);
    expect(totals.costPerCredit).toBeCloseTo(0.003 / 18);
    expect(totals.cacheHitRate).toBeCloseTo(7 / 18);
    expect(totals.refundRate).toBeCloseTo(1 / 20);
  });

  it('handles an empty period without dividing by zero', () => {
    expect(summarize([], prices).totals).toMatchObject({ costUsd: 0, costPerCredit: 0, cacheHitRate: 0, refundRate: 0 });
  });

  it('reads prices from wrangler.toml and falls back to defaults', () => {
    expect(readPricing('GEMINI_INPUT_USD_PER_MTOK = "0.25"\nFREE_DAILY_BUDGET_USD = "12"')).toEqual({
      inputPerMTok: 0.25,
      outputPerMTok: 0.4,
      freeDailyBudgetUsd: 12
    });
  });

  it('rejects a non-integer day count instead of interpolating it', () => {
    expect(() => usageQuery(Number('7; DROP TABLE users'))).toThrow();
    expect(() => spendQuery(0)).toThrow();
  });

  it('runs its SQL against the real schema and groups by Dhaka day', async () => {
    const d1 = await createTestD1();
    d1.exec(`INSERT INTO users (id, google_sub, email, created_at) VALUES ('u1', 'g1', 'a@b.c', '2026-10-01T00:00:00Z')`);
    const now = new Date();
    const at = (msAgo: number) => new Date(now.getTime() - msAgo).toISOString();
    d1.exec(
      `INSERT INTO usage_events (user_id, endpoint, credits, cached, tokens_in, tokens_out, latency_ms, status, created_at) VALUES
       ('u1', 'stage-a', 1, 0, 400, 120, 900, 'ok', ?1),
       ('u1', 'stage-a', 1, 1, NULL, NULL, 0, 'ok', ?1),
       ('u1', 'stage-a', 1, 0, 800, 240, 2000, 'refunded', ?1),
       ('u1', 'stage-a', 1, 0, 400, 120, 900, 'ok', ?2)`,
      [at(60_000), at(30 * 24 * 3600 * 1000)]
    );

    const rows = (await d1.db.prepare(usageQuery(7)).all<UsageRow>()).results;

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ endpoint: 'stage-a', requests: 3, answered: 2, cache_hits: 1, refunded: 1, credits: 2, tokens_in: 1200, users: 1, model_latency_ms: 900 });
    expect(rows[0].day).toBe(new Date(now.getTime() - 60_000 + 6 * 3600e3).toISOString().slice(0, 10));
    expect((await d1.db.prepare(spendQuery(7)).all()).results).toEqual([]);
    d1.close();
  });
});
