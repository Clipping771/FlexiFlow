import { randomToken, sha256Hex } from './crypto';

export const REFRESH_TOKEN_TTL_DAYS = 30;

interface RefreshRow {
  id: string;
  user_id: string;
  family_id: string;
  expires_at: string;
  revoked_at: string | null;
}

function expiryFrom(now: Date): string {
  return new Date(now.getTime() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

/** Stores only the SHA-256 of the token; the plaintext goes to the client once. */
export async function issueRefreshToken(
  db: D1Database,
  userId: string,
  familyId: string = randomToken('fam_', 16),
  now: Date = new Date()
): Promise<string> {
  const token = randomToken('rt_');
  await db
    .prepare('INSERT INTO refresh_tokens (id, user_id, token_hash, family_id, expires_at) VALUES (?1, ?2, ?3, ?4, ?5)')
    .bind(randomToken('rtk_', 16), userId, await sha256Hex(token), familyId, expiryFrom(now))
    .run();
  return token;
}

export type RotateResult =
  | { ok: true; userId: string; refreshToken: string }
  | { ok: false; reason: 'unknown' | 'expired' | 'reused' };

/**
 * Exchanges a refresh token for a new one in the same family. Presenting an already-rotated token
 * means it was copied, so the whole family is revoked and every device in it must sign in again.
 */
export async function rotateRefreshToken(db: D1Database, token: string, now: Date = new Date()): Promise<RotateResult> {
  const row = await db
    .prepare('SELECT id, user_id, family_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = ?1')
    .bind(await sha256Hex(token))
    .first<RefreshRow>();
  if (!row) return { ok: false, reason: 'unknown' };

  if (row.revoked_at) {
    await revokeFamily(db, row.family_id, now);
    return { ok: false, reason: 'reused' };
  }
  if (Date.parse(row.expires_at) <= now.getTime()) return { ok: false, reason: 'expired' };

  // The revoked_at guard makes two concurrent rotations of one token resolve to a single winner.
  const claimed = await db
    .prepare('UPDATE refresh_tokens SET revoked_at = ?1 WHERE id = ?2 AND revoked_at IS NULL')
    .bind(now.toISOString(), row.id)
    .run();
  if (!claimed.meta.changes) {
    await revokeFamily(db, row.family_id, now);
    return { ok: false, reason: 'reused' };
  }

  return { ok: true, userId: row.user_id, refreshToken: await issueRefreshToken(db, row.user_id, row.family_id, now) };
}

export async function revokeFamily(db: D1Database, familyId: string, now: Date = new Date()): Promise<void> {
  await db
    .prepare('UPDATE refresh_tokens SET revoked_at = ?1 WHERE family_id = ?2 AND revoked_at IS NULL')
    .bind(now.toISOString(), familyId)
    .run();
}

/** Logout: revokes the device's family. Unknown tokens are ignored so logout is idempotent. */
export async function revokeByToken(db: D1Database, token: string, now: Date = new Date()): Promise<void> {
  const row = await db
    .prepare('SELECT family_id FROM refresh_tokens WHERE token_hash = ?1')
    .bind(await sha256Hex(token))
    .first<{ family_id: string }>();
  if (row) await revokeFamily(db, row.family_id, now);
}
