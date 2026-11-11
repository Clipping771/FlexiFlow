import { Hono, type Context } from 'hono';
import type { AppEnv } from '../env';
import { hmacSha256Hex, randomToken } from '../lib/crypto';
import { ApiError } from '../lib/errors';
import { verifyGoogleIdToken } from '../lib/google';
import { issueRefreshToken, revokeByToken, rotateRefreshToken } from '../lib/refreshTokens';
import { ACCESS_TOKEN_TTL_SECONDS, signAccessToken } from '../lib/tokens';
import { type AccountUser, loadUser, publicUser } from '../lib/users';

/** New accounts allowed per network per rolling 24 hours (CLOUD_BACKEND_DESIGN.md §5.4). */
export const SIGNUPS_PER_IP_PER_DAY = 5;

export const auth = new Hono<AppEnv>();

async function readStrings<K extends string>(c: Context<AppEnv>, keys: readonly K[]): Promise<Record<K, string>> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new ApiError(400, 'INVALID_REQUEST', 'Request body must be JSON.');
  }
  const out = {} as Record<K, string>;
  for (const key of keys) {
    const value = (body as Record<string, unknown> | null)?.[key];
    // 4 KB is well above any Google ID token or our refresh tokens.
    if (typeof value !== 'string' || !value || value.length > 4096) {
      throw new ApiError(400, 'INVALID_REQUEST', `"${key}" is required.`);
    }
    out[key] = value;
  }
  return out;
}

async function sessionResponse(c: Context<AppEnv>, user: AccountUser, refreshToken: string) {
  return c.json({
    accessToken: await signAccessToken(user, c.env.JWT_SECRET),
    refreshToken,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    user: publicUser(user),
    plan: user.plan
  });
}

auth.post('/google', async (c) => {
  const { idToken, nonce } = await readStrings(c, ['idToken', 'nonce'] as const);

  let result;
  try {
    result = await verifyGoogleIdToken(idToken, { clientId: c.env.GOOGLE_CLIENT_ID, nonce });
  } catch {
    throw new ApiError(503, 'SERVICE_UNAVAILABLE', 'Google sign-in is temporarily unavailable. Try again shortly.');
  }
  if (!result.ok) {
    const message = result.reason === 'unverified_email'
      ? 'Your Google account email is not verified.'
      : 'Google sign-in could not be verified. Try again.';
    throw new ApiError(401, 'AUTH_REQUIRED', message);
  }

  const { sub, email, name } = result.identity;
  const now = new Date();
  const db = c.env.DB;

  const existing = await db.prepare('SELECT id FROM users WHERE google_sub = ?1').bind(sub).first<{ id: string }>();
  let userId: string;
  if (existing) {
    userId = existing.id;
    await db.prepare('UPDATE users SET email = ?1, name = ?2 WHERE id = ?3').bind(email, name, userId).run();
  } else {
    const ip = c.req.header('CF-Connecting-IP');
    // Peppered with JWT_SECRET so a leaked database does not reveal IPs.
    const ipHash = ip ? await hmacSha256Hex(c.env.JWT_SECRET, ip) : null;
    if (ipHash) {
      const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const recent = await db
        .prepare('SELECT COUNT(*) AS n FROM users WHERE signup_ip_hash = ?1 AND created_at >= ?2')
        .bind(ipHash, since)
        .first<{ n: number }>();
      if ((recent?.n ?? 0) >= SIGNUPS_PER_IP_PER_DAY) {
        throw new ApiError(429, 'RATE_LIMITED', 'Too many new accounts from this network today. Try again tomorrow.');
      }
    }
    // ON CONFLICT covers two first-time sign-ins for the same Google account racing each other.
    await db
      .prepare(
        `INSERT INTO users (id, google_sub, email, name, created_at, signup_ip_hash)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6) ON CONFLICT(google_sub) DO NOTHING`
      )
      .bind(randomToken('usr_', 16), sub, email, name, now.toISOString(), ipHash)
      .run();
    const row = await db.prepare('SELECT id FROM users WHERE google_sub = ?1').bind(sub).first<{ id: string }>();
    if (!row) throw new Error('user insert failed');
    userId = row.id;
  }

  const user = await loadUser(db, userId, now);
  if (!user) throw new Error('user vanished after sign-in');
  return sessionResponse(c, user, await issueRefreshToken(db, userId, undefined, now));
});

auth.post('/refresh', async (c) => {
  const { refreshToken } = await readStrings(c, ['refreshToken'] as const);
  const now = new Date();

  const rotated = await rotateRefreshToken(c.env.DB, refreshToken, now);
  if (!rotated.ok) {
    if (rotated.reason === 'reused') console.warn('[lexiflow-api] refresh token reuse detected; family revoked');
    throw new ApiError(401, 'AUTH_REQUIRED', 'Session ended. Sign in again.');
  }

  const user = await loadUser(c.env.DB, rotated.userId, now);
  if (!user) throw new ApiError(401, 'AUTH_REQUIRED', 'Account not found. Sign in again.');
  return sessionResponse(c, user, rotated.refreshToken);
});

auth.post('/logout', async (c) => {
  const { refreshToken } = await readStrings(c, ['refreshToken'] as const);
  await revokeByToken(c.env.DB, refreshToken);
  return c.body(null, 204);
});
