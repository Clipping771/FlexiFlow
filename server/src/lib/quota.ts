/** Credit cost per endpoint (CLOUD_BACKEND_DESIGN.md §5.1). */
export const CREDIT_COSTS = {
  'stage-a': 1,
  'stage-b': 1
} as const;

export type AiEndpoint = keyof typeof CREDIT_COSTS;

/**
 * Atomically adds `credits` to the user's day if that stays within `limit`.
 * Returns the new total, or null when the day's quota would be exceeded.
 */
export async function reserveCredits(
  db: D1Database,
  userId: string,
  day: string,
  credits: number,
  limit: number
): Promise<number | null> {
  await db
    .prepare('INSERT INTO usage_daily (user_id, day, credits_used) VALUES (?1, ?2, 0) ON CONFLICT DO NOTHING')
    .bind(userId, day)
    .run();
  const row = await db
    .prepare(
      `UPDATE usage_daily SET credits_used = credits_used + ?3
       WHERE user_id = ?1 AND day = ?2 AND credits_used + ?3 <= ?4
       RETURNING credits_used`
    )
    .bind(userId, day, credits, limit)
    .first<{ credits_used: number }>();
  return row ? row.credits_used : null;
}

/** Gives back credits reserved for a request that failed. Returns the new total. */
export async function refundCredits(db: D1Database, userId: string, day: string, credits: number): Promise<number> {
  const row = await db
    .prepare(
      `UPDATE usage_daily SET credits_used = MAX(credits_used - ?3, 0)
       WHERE user_id = ?1 AND day = ?2
       RETURNING credits_used`
    )
    .bind(userId, day, credits)
    .first<{ credits_used: number }>();
  return row?.credits_used ?? 0;
}

export async function currentUsage(db: D1Database, userId: string, day: string): Promise<number> {
  const row = await db
    .prepare('SELECT credits_used FROM usage_daily WHERE user_id = ?1 AND day = ?2')
    .bind(userId, day)
    .first<{ credits_used: number }>();
  return row?.credits_used ?? 0;
}

export interface UsageEvent {
  userId: string;
  endpoint: AiEndpoint;
  credits: number;
  cached: boolean;
  tokensIn?: number;
  tokensOut?: number;
  latencyMs?: number;
  status: 'ok' | 'refunded' | 'rejected';
}

/** Analytics only; never pass the user's text here. */
export async function recordUsageEvent(db: D1Database, event: UsageEvent, now: Date = new Date()): Promise<void> {
  await db
    .prepare(
      `INSERT INTO usage_events (user_id, endpoint, credits, cached, tokens_in, tokens_out, latency_ms, status, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`
    )
    .bind(
      event.userId,
      event.endpoint,
      event.credits,
      event.cached ? 1 : 0,
      event.tokensIn ?? null,
      event.tokensOut ?? null,
      event.latencyMs ?? null,
      event.status,
      now.toISOString()
    )
    .run();
}
