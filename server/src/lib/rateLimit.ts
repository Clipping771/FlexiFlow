const WINDOW_SECONDS = 60;

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

/** Counts this request in the user's current one-minute window and checks it against `limit`. */
export async function hitRateLimit(
  db: D1Database,
  userId: string,
  limit: number,
  now: Date = new Date()
): Promise<RateLimitResult> {
  const nowSeconds = Math.floor(now.getTime() / 1000);
  const windowStart = nowSeconds - (nowSeconds % WINDOW_SECONDS);

  const row = await db
    .prepare(
      `INSERT INTO rate_limits (user_id, window_start, count) VALUES (?1, ?2, 1)
       ON CONFLICT(user_id, window_start) DO UPDATE SET count = count + 1
       RETURNING count`
    )
    .bind(userId, windowStart)
    .first<{ count: number }>();
  const count = row?.count ?? 1;

  if (count === 1) {
    await db.prepare('DELETE FROM rate_limits WHERE user_id = ?1 AND window_start < ?2').bind(userId, windowStart).run();
  }
  if (count <= limit) return { ok: true };
  return { ok: false, retryAfterSeconds: Math.max(1, windowStart + WINDOW_SECONDS - nowSeconds) };
}
