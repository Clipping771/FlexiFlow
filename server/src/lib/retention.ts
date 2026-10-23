// Data retention, run daily by the cron trigger (wrangler.toml). The periods are stated in PRIVACY.md;
// change both together.
export const RETENTION = {
  usageEventsDays: 180,
  usageDailyDays: 90,
  spendDailyDays: 400,
  /** The signup IP hash only backs the 24-hour new-account limit. */
  signupIpHashHours: 48,
  rateLimitWindowsHours: 1
} as const;

const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;

function daysAgo(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function dhakaDayOf(date: Date): string {
  return new Date(date.getTime() + DHAKA_OFFSET_MS).toISOString().slice(0, 10);
}

export interface RetentionResult {
  usageEvents: number;
  usageDaily: number;
  spendDaily: number;
  refreshTokens: number;
  rateLimits: number;
  signupIpHashes: number;
}

export async function runRetention(db: D1Database, now: Date = new Date()): Promise<RetentionResult> {
  const changes = async (sql: string, ...params: unknown[]) =>
    (await db.prepare(sql).bind(...params).run()).meta.changes ?? 0;

  return {
    usageEvents: await changes('DELETE FROM usage_events WHERE created_at < ?1', daysAgo(now, RETENTION.usageEventsDays).toISOString()),
    usageDaily: await changes('DELETE FROM usage_daily WHERE day < ?1', dhakaDayOf(daysAgo(now, RETENTION.usageDailyDays))),
    spendDaily: await changes('DELETE FROM spend_daily WHERE day < ?1', dhakaDayOf(daysAgo(now, RETENTION.spendDailyDays))),
    // Expired tokens are useless; revoked ones are kept until expiry only for reuse detection.
    refreshTokens: await changes('DELETE FROM refresh_tokens WHERE expires_at < ?1', now.toISOString()),
    rateLimits: await changes(
      'DELETE FROM rate_limits WHERE window_start < ?1',
      Math.floor(now.getTime() / 1000) - RETENTION.rateLimitWindowsHours * 3600
    ),
    signupIpHashes: await changes(
      'UPDATE users SET signup_ip_hash = NULL WHERE signup_ip_hash IS NOT NULL AND created_at < ?1',
      new Date(now.getTime() - RETENTION.signupIpHashHours * 3600 * 1000).toISOString()
    )
  };
}

/** Everything tied to one account. Shared cache entries and plan-level spend totals hold no user id. */
export async function deleteAccount(db: D1Database, userId: string): Promise<void> {
  // Explicit deletes instead of relying on ON DELETE CASCADE being enforced.
  for (const table of ['usage_events', 'usage_daily', 'rate_limits', 'refresh_tokens']) {
    await db.prepare(`DELETE FROM ${table} WHERE user_id = ?1`).bind(userId).run();
  }
  await db.prepare('DELETE FROM users WHERE id = ?1').bind(userId).run();
}
