import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/index';
import type { Bindings } from '../src/env';
import { signAccessToken } from '../src/lib/tokens';
import { RETENTION, runRetention } from '../src/lib/retention';
import { createTestD1, type TestD1 } from './d1';
import { createTestKV } from './kv';

const SECRET = 'test-secret-that-is-at-least-32-bytes-long';
const NOW = new Date('2026-10-23T12:00:00Z');

let d1: TestD1;
let env: Bindings;

beforeEach(async () => {
  d1 = await createTestD1();
  env = {
    DB: d1.db,
    CACHE: createTestKV().kv,
    JWT_SECRET: SECRET,
    ALLOWED_ORIGINS: '',
    GOOGLE_CLIENT_ID: 'c',
    GEMINI_API_KEY: '',
    GEMINI_MODEL: 'gemini-2.0-flash',
    UPGRADE_URL: ''
  };
});

afterEach(() => d1.close());

function seedUser(id: string, createdAt = '2026-10-01T00:00:00Z', ipHash: string | null = 'abc') {
  d1.exec(`INSERT INTO users (id, google_sub, email, created_at, signup_ip_hash) VALUES (?1, ?2, 'r@example.com', ?3, ?4)`, [id, `g_${id}`, createdAt, ipHash]);
}

function seedActivity(id: string) {
  d1.exec(`INSERT INTO refresh_tokens (id, user_id, token_hash, family_id, expires_at) VALUES (?1, ?2, ?1, 'f', '2099-01-01T00:00:00Z')`, [`rt_${id}`, id]);
  d1.exec(`INSERT INTO usage_daily (user_id, day, credits_used) VALUES (?1, '2026-10-23', 5)`, [id]);
  d1.exec(`INSERT INTO usage_events (user_id, endpoint, credits, cached, status, created_at) VALUES (?1, 'stage-a', 1, 0, 'ok', '2026-10-23T00:00:00Z')`, [id]);
  d1.exec(`INSERT INTO rate_limits (user_id, window_start, count) VALUES (?1, 1, 1)`, [id]);
}

async function count(table: string, userId?: string): Promise<number> {
  const sql = userId ? `SELECT COUNT(*) AS n FROM ${table} WHERE ${table === 'users' ? 'id' : 'user_id'} = ?1` : `SELECT COUNT(*) AS n FROM ${table}`;
  const stmt = d1.db.prepare(sql);
  return (await (userId ? stmt.bind(userId) : stmt).first<number>('n')) ?? 0;
}

describe('DELETE /v1/me', () => {
  it('deletes the account and everything tied to it, leaving other accounts alone', async () => {
    seedUser('usr_1');
    seedUser('usr_2');
    seedActivity('usr_1');
    seedActivity('usr_2');
    const token = await signAccessToken({ id: 'usr_1', plan: 'free', planExpiresAt: null }, SECRET);

    const res = await app.request('/v1/me', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }, env);

    expect(res.status).toBe(204);
    for (const table of ['users', 'refresh_tokens', 'usage_daily', 'usage_events', 'rate_limits']) {
      expect(await count(table, 'usr_1')).toBe(0);
      expect(await count(table, 'usr_2')).toBe(1);
    }
    // The same access token can no longer read the account.
    const me = await app.request('/v1/me', { headers: { Authorization: `Bearer ${token}` } }, env);
    expect(me.status).toBe(401);
  });

  it('requires sign-in', async () => {
    expect((await app.request('/v1/me', { method: 'DELETE' }, env)).status).toBe(401);
  });
});

describe('runRetention', () => {
  it('deletes data past its retention period and keeps recent data', async () => {
    seedUser('usr_old', '2026-10-01T00:00:00Z', 'old-hash');
    seedUser('usr_new', '2026-10-23T00:00:00Z', 'new-hash');
    const day = (daysBefore: number) => new Date(NOW.getTime() - daysBefore * 864e5).toISOString();
    d1.exec(`INSERT INTO usage_events (user_id, endpoint, credits, cached, status, created_at) VALUES
      ('usr_old', 'stage-a', 1, 0, 'ok', ?1), ('usr_old', 'stage-a', 1, 0, 'ok', ?2)`,
      [day(RETENTION.usageEventsDays + 1), day(RETENTION.usageEventsDays - 1)]);
    d1.exec(`INSERT INTO usage_daily (user_id, day, credits_used) VALUES ('usr_old', ?1, 1), ('usr_old', ?2, 1)`,
      [day(RETENTION.usageDailyDays + 2).slice(0, 10), '2026-10-23']);
    d1.exec(`INSERT INTO spend_daily (day, plan, micro_usd) VALUES (?1, 'free', 1), ('2026-10-23', 'free', 1)`,
      [day(RETENTION.spendDailyDays + 2).slice(0, 10)]);
    d1.exec(`INSERT INTO refresh_tokens (id, user_id, token_hash, family_id, expires_at) VALUES
      ('a', 'usr_old', 'h1', 'f', '2026-10-01T00:00:00Z'), ('b', 'usr_old', 'h2', 'f', '2026-11-20T00:00:00Z')`);
    const nowSec = Math.floor(NOW.getTime() / 1000);
    d1.exec(`INSERT INTO rate_limits (user_id, window_start, count) VALUES ('usr_old', ?1, 1), ('usr_old', ?2, 1)`,
      [nowSec - 7200, nowSec - 60]);

    const result = await runRetention(d1.db, NOW);

    expect(result).toEqual({ usageEvents: 1, usageDaily: 1, spendDaily: 1, refreshTokens: 1, rateLimits: 1, signupIpHashes: 1 });
    expect(await count('usage_events')).toBe(1);
    expect(await count('usage_daily')).toBe(1);
    expect(await count('spend_daily')).toBe(1);
    expect(await count('refresh_tokens')).toBe(1);
    expect(await count('rate_limits')).toBe(1);
    const hashes = (await d1.db.prepare('SELECT id, signup_ip_hash FROM users ORDER BY id').all()).results;
    expect(hashes).toEqual([
      { id: 'usr_new', signup_ip_hash: 'new-hash' }, // still inside the 24-hour signup limit window
      { id: 'usr_old', signup_ip_hash: null }
    ]);
  });

  it('is a no-op on an empty database', async () => {
    expect(Object.values(await runRetention(d1.db, NOW)).every((n) => n === 0)).toBe(true);
  });
});
