import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../src/index';
import type { Bindings } from '../src/env';
import { signAccessToken } from '../src/lib/tokens';
import { dhakaDay, nextDhakaMidnight } from '../src/lib/time';
import { effectivePlan } from '../src/lib/plans';
import { createTestD1, type TestD1 } from './d1';

const SECRET = 'test-secret-that-is-at-least-32-bytes-long';
const EXT_ORIGIN = 'chrome-extension://abcdefghijklmnop';

let d1: TestD1;
let env: Bindings;

beforeEach(async () => {
  d1 = await createTestD1();
  env = {
    DB: d1.db,
    JWT_SECRET: SECRET,
    ALLOWED_ORIGINS: `${EXT_ORIGIN}, http://localhost:8787`,
    GOOGLE_CLIENT_ID: 'test-client.apps.googleusercontent.com'
  };
});

afterEach(() => {
  d1.close();
  vi.useRealTimers();
});

function seedUser(overrides: { id?: string; plan?: string; planExpiresAt?: string | null } = {}) {
  const id = overrides.id ?? 'usr_test';
  d1.exec(
    `INSERT INTO users (id, google_sub, email, name, plan, plan_expires_at, created_at)
     VALUES (?1, ?2, 'reader@example.com', 'Test Reader', ?3, ?4, '2026-10-01T00:00:00Z')`,
    [id, `g_${id}`, overrides.plan ?? 'free', overrides.planExpiresAt ?? null]
  );
  return id;
}

async function tokenFor(id: string, now = new Date()) {
  return signAccessToken({ id, plan: 'free', planExpiresAt: null }, SECRET, now);
}

async function json(res: Response): Promise<any> {
  return res.json();
}

function get(path: string, headers: Record<string, string> = {}) {
  return app.request(path, { headers }, env);
}

describe('GET /v1/health', () => {
  it('reports ok when D1 answers', async () => {
    const res = await get('/v1/health');
    expect(res.status).toBe(200);
    expect(await json(res)).toMatchObject({ status: 'ok', db: 'ok' });
  });

  it('reports degraded with 503 when D1 fails', async () => {
    d1.close();
    const res = await get('/v1/health');
    expect(res.status).toBe(503);
    expect(await json(res)).toMatchObject({ status: 'degraded', db: 'error' });
    d1 = await createTestD1(); // afterEach closes it again
  });
});

describe('GET /v1/me', () => {
  it('returns the profile, plan and today\'s usage', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-23T20:00:00Z')); // 02:00 on Oct 24 in Dhaka
    const id = seedUser();
    d1.exec(`INSERT INTO usage_daily (user_id, day, credits_used) VALUES (?1, '2026-10-24', 12)`, [id]);
    d1.exec(`INSERT INTO usage_daily (user_id, day, credits_used) VALUES (?1, '2026-10-23', 29)`, [id]);

    const res = await get('/v1/me', { Authorization: `Bearer ${await tokenFor(id)}` });

    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({
      user: { id, email: 'reader@example.com', name: 'Test Reader' },
      plan: 'free',
      planExpiresAt: null,
      usage: { used: 12, limit: 30, resetAt: '2026-10-25T00:00:00+06:00' }
    });
  });

  it('returns zero usage when nothing was used today', async () => {
    const id = seedUser();
    const res = await get('/v1/me', { Authorization: `Bearer ${await tokenFor(id)}` });
    expect((await json(res)).usage.used).toBe(0);
  });

  it('reads the plan from D1, not from the token', async () => {
    const id = seedUser({ plan: 'pro', planExpiresAt: '2099-01-01T00:00:00Z' });
    const res = await get('/v1/me', { Authorization: `Bearer ${await tokenFor(id)}` });
    const body = await json(res);
    expect(body.plan).toBe('pro');
    expect(body.planExpiresAt).toBe('2099-01-01T00:00:00Z');
    expect(body.usage.limit).toBe(600);
  });

  it('treats a lapsed Pro plan as Free', async () => {
    const id = seedUser({ plan: 'pro', planExpiresAt: '2020-01-01T00:00:00Z' });
    const res = await get('/v1/me', { Authorization: `Bearer ${await tokenFor(id)}` });
    const body = await json(res);
    expect(body).toMatchObject({ plan: 'free', planExpiresAt: null, usage: { limit: 30 } });
  });

  it.each([
    ['no header', {}],
    ['a non-bearer header', { Authorization: 'Basic abc' }],
    ['a forged token', { Authorization: 'Bearer not.a.jwt' }]
  ])('rejects %s with AUTH_REQUIRED', async (_label, headers) => {
    const res = await get('/v1/me', headers as Record<string, string>);
    expect(res.status).toBe(401);
    expect((await json(res)).error.code).toBe('AUTH_REQUIRED');
  });

  it('rejects a token signed with another secret', async () => {
    const id = seedUser();
    const token = await signAccessToken({ id, plan: 'free', planExpiresAt: null }, 'another-secret-that-is-32-bytes-long!!');
    const res = await get('/v1/me', { Authorization: `Bearer ${token}` });
    expect((await json(res)).error.code).toBe('AUTH_REQUIRED');
  });

  it('rejects an expired token with AUTH_EXPIRED', async () => {
    const id = seedUser();
    const token = await tokenFor(id, new Date(Date.now() - 2 * 60 * 60 * 1000));
    const res = await get('/v1/me', { Authorization: `Bearer ${token}` });
    expect(res.status).toBe(401);
    expect((await json(res)).error.code).toBe('AUTH_EXPIRED');
  });

  it('rejects a valid token for a deleted account', async () => {
    const res = await get('/v1/me', { Authorization: `Bearer ${await tokenFor('usr_gone')}` });
    expect(res.status).toBe(401);
    expect((await json(res)).error.code).toBe('AUTH_REQUIRED');
  });
});

describe('CORS and fallbacks', () => {
  it('allows the extension origin on preflight', async () => {
    const res = await app.request('/v1/me', {
      method: 'OPTIONS',
      headers: { Origin: EXT_ORIGIN, 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'authorization' }
    }, env);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(EXT_ORIGIN);
    expect(res.headers.get('Access-Control-Allow-Headers')?.toLowerCase()).toContain('authorization');
  });

  it('does not allow other origins', async () => {
    const res = await get('/v1/health', { Origin: 'https://evil.example' });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('returns the error envelope for unknown routes', async () => {
    const res = await get('/v1/nope');
    expect(res.status).toBe(404);
    expect(await json(res)).toEqual({ error: { code: 'NOT_FOUND', message: 'Route not found.' } });
  });
});

describe('time and plan helpers', () => {
  it('rolls the Dhaka day over at 18:00 UTC', () => {
    expect(dhakaDay(new Date('2026-10-23T17:59:59Z'))).toBe('2026-10-23');
    expect(dhakaDay(new Date('2026-10-23T18:00:00Z'))).toBe('2026-10-24');
    expect(nextDhakaMidnight(new Date('2026-10-23T17:59:59Z'))).toBe('2026-10-24T00:00:00+06:00');
    expect(nextDhakaMidnight(new Date('2026-12-31T19:00:00Z'))).toBe('2027-01-02T00:00:00+06:00');
  });

  it('resolves the effective plan', () => {
    const now = new Date('2026-10-23T00:00:00Z');
    expect(effectivePlan('free', null, now)).toBe('free');
    expect(effectivePlan('pro', null, now)).toBe('pro');
    expect(effectivePlan('pro', '2026-10-23T00:00:00Z', now)).toBe('free');
    expect(effectivePlan('enterprise', null, now)).toBe('free');
  });
});
