import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { sign } from 'hono/jwt';
import app from '../src/index';
import type { Bindings } from '../src/env';
import { GOOGLE_JWKS_URL, clearGoogleKeyCache } from '../src/lib/google';
import { SIGNUPS_PER_IP_PER_DAY } from '../src/routes/auth';
import { createTestD1, type TestD1 } from './d1';
import { createTestKV } from './kv';

const CLIENT_ID = 'test-client.apps.googleusercontent.com';
const NONCE = 'nonce-123';

type Jwk = JsonWebKey & { kid: string };
let googleKey: { privateJwk: Jwk; publicJwk: Jwk };
let otherKey: { privateJwk: Jwk; publicJwk: Jwk };
let published: Jwk[];
let jwksAvailable: boolean;
let jwksFetches: number;

async function makeKey(kid: string) {
  const pair = (await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify']
  )) as CryptoKeyPair;
  const privateJwk = { ...(await crypto.subtle.exportKey('jwk', pair.privateKey)), kid } as Jwk;
  const publicJwk = { ...(await crypto.subtle.exportKey('jwk', pair.publicKey)), kid, alg: 'RS256', use: 'sig' } as Jwk;
  return { privateJwk, publicJwk };
}

function googleToken(claims: Record<string, unknown> = {}, key = googleKey.privateJwk) {
  const now = Math.floor(Date.now() / 1000);
  return sign(
    {
      iss: 'https://accounts.google.com',
      aud: CLIENT_ID,
      sub: 'google-sub-1',
      email: 'reader@example.com',
      email_verified: true,
      name: 'Test Reader',
      nonce: NONCE,
      iat: now - 10,
      exp: now + 3600,
      ...claims
    },
    key as Parameters<typeof sign>[1],
    'RS256'
  );
}

let d1: TestD1;
let env: Bindings;

beforeAll(async () => {
  googleKey = await makeKey('google-key-1');
  otherKey = await makeKey('google-key-1'); // same kid, different key: a forgery
});

beforeEach(async () => {
  d1 = await createTestD1();
  env = { DB: d1.db, JWT_SECRET: 'test-secret-that-is-at-least-32-bytes-long', ALLOWED_ORIGINS: '', GOOGLE_CLIENT_ID: CLIENT_ID, GEMINI_API_KEY: '', GEMINI_MODEL: 'gemini-2.0-flash', UPGRADE_URL: '', CACHE: createTestKV().kv };
  clearGoogleKeyCache();
  published = [googleKey.publicJwk];
  jwksAvailable = true;
  jwksFetches = 0;
  vi.stubGlobal('fetch', async (url: string) => {
    if (url !== GOOGLE_JWKS_URL) throw new Error(`unexpected fetch ${url}`);
    jwksFetches++;
    if (!jwksAvailable) return new Response('down', { status: 503 });
    return new Response(JSON.stringify({ keys: published }), { headers: { 'Cache-Control': 'public, max-age=3600' } });
  });
});

afterEach(() => {
  d1.close();
  vi.unstubAllGlobals();
});

function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return app.request(
    path,
    { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) },
    env
  );
}

async function json(res: Response): Promise<any> {
  return res.json();
}

async function signIn(claims: Record<string, unknown> = {}, headers: Record<string, string> = {}) {
  return post('/v1/auth/google', { idToken: await googleToken(claims), nonce: NONCE }, headers);
}

describe('POST /v1/auth/google', () => {
  it('creates an account on first sign-in and returns a working session', async () => {
    const res = await signIn();
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body).toMatchObject({
      expiresIn: 3600,
      plan: 'free',
      user: { email: 'reader@example.com', name: 'Test Reader' }
    });
    expect(body.user.id).toMatch(/^usr_/);
    expect(body.refreshToken).toMatch(/^rt_/);

    const me = await app.request('/v1/me', { headers: { Authorization: `Bearer ${body.accessToken}` } }, env);
    expect(me.status).toBe(200);
    expect((await json(me)).user.id).toBe(body.user.id);
  });

  it('signs an existing account back in and refreshes its profile', async () => {
    const first = await json(await signIn());
    const second = await json(await signIn({ email: 'new@example.com', name: 'Renamed' }));
    expect(second.user).toEqual({ id: first.user.id, email: 'new@example.com', name: 'Renamed' });
  });

  it('stores only a hash of the refresh token', async () => {
    const body = await json(await signIn());
    const row = await env.DB.prepare('SELECT token_hash FROM refresh_tokens').first<{ token_hash: string }>();
    expect(row?.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row?.token_hash).not.toContain(body.refreshToken);
  });

  it.each([
    ['another audience', { aud: 'someone-else.apps.googleusercontent.com' }],
    ['another issuer', { iss: 'https://evil.example' }],
    ['an expired token', { iat: 1_000_000, exp: 1_000_100 }],
    ['a different nonce', { nonce: 'replayed' }],
    ['an unverified email', { email_verified: false }]
  ])('rejects %s', async (_label, claims) => {
    const res = await signIn(claims);
    expect(res.status).toBe(401);
    expect((await json(res)).error.code).toBe('AUTH_REQUIRED');
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM users').first('n')).toBe(0);
  });

  it('rejects a token signed by a key Google did not publish', async () => {
    const forged = await googleToken({}, otherKey.privateJwk);
    const res = await post('/v1/auth/google', { idToken: forged, nonce: NONCE });
    expect(res.status).toBe(401);
  });

  it('caches Google keys and refetches once when Google rotates them', async () => {
    await signIn();
    await signIn();
    expect(jwksFetches).toBe(1);

    const rotated = await makeKey('google-key-2');
    published = [rotated.publicJwk];
    const res = await post('/v1/auth/google', { idToken: await googleToken({}, rotated.privateJwk), nonce: NONCE });
    expect(res.status).toBe(200);
    expect(jwksFetches).toBe(2);
  });

  it('answers 503 when Google keys cannot be fetched', async () => {
    jwksAvailable = false;
    const res = await signIn();
    expect(res.status).toBe(503);
    expect((await json(res)).error.code).toBe('SERVICE_UNAVAILABLE');
  });

  it.each([
    ['non-JSON', 'not json'],
    ['a missing nonce', { idToken: 'x' }],
    ['an oversized token', { idToken: 'x'.repeat(5000), nonce: NONCE }]
  ])('rejects %s with INVALID_REQUEST', async (_label, body) => {
    const res = await post('/v1/auth/google', body);
    expect(res.status).toBe(400);
    expect((await json(res)).error.code).toBe('INVALID_REQUEST');
  });

  it('limits new accounts per network but still lets existing users sign in', async () => {
    const ip = { 'CF-Connecting-IP': '203.0.113.7' };
    for (let i = 0; i < SIGNUPS_PER_IP_PER_DAY; i++) {
      expect((await signIn({ sub: `sub-${i}` }, ip)).status).toBe(200);
    }
    const blocked = await signIn({ sub: 'sub-extra' }, ip);
    expect(blocked.status).toBe(429);
    expect((await json(blocked)).error.code).toBe('RATE_LIMITED');

    expect((await signIn({ sub: 'sub-0' }, ip)).status).toBe(200);
    expect((await signIn({ sub: 'sub-other-network' }, { 'CF-Connecting-IP': '198.51.100.1' })).status).toBe(200);

    const stored = await env.DB.prepare('SELECT signup_ip_hash FROM users LIMIT 1').first<string>('signup_ip_hash');
    expect(stored).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('POST /v1/auth/refresh', () => {
  it('rotates the refresh token and issues a new access token', async () => {
    const session = await json(await signIn());
    const res = await post('/v1/auth/refresh', { refreshToken: session.refreshToken });
    expect(res.status).toBe(200);
    const next = await json(res);
    expect(next.refreshToken).not.toBe(session.refreshToken);
    expect(next.user.id).toBe(session.user.id);

    const me = await app.request('/v1/me', { headers: { Authorization: `Bearer ${next.accessToken}` } }, env);
    expect(me.status).toBe(200);
  });

  it('revokes the whole family when an old refresh token is replayed', async () => {
    const session = await json(await signIn());
    const next = await json(await post('/v1/auth/refresh', { refreshToken: session.refreshToken }));

    const replay = await post('/v1/auth/refresh', { refreshToken: session.refreshToken });
    expect(replay.status).toBe(401);
    // The legitimate newer token dies with the family.
    expect((await post('/v1/auth/refresh', { refreshToken: next.refreshToken })).status).toBe(401);
  });

  it('keeps other devices signed in when one family is revoked', async () => {
    const laptop = await json(await signIn());
    const desktop = await json(await signIn());
    await post('/v1/auth/refresh', { refreshToken: laptop.refreshToken });
    await post('/v1/auth/refresh', { refreshToken: laptop.refreshToken }); // replay kills laptop's family

    expect((await post('/v1/auth/refresh', { refreshToken: desktop.refreshToken })).status).toBe(200);
  });

  it('rejects expired and unknown refresh tokens', async () => {
    const session = await json(await signIn());
    d1.exec(`UPDATE refresh_tokens SET expires_at = '2000-01-01T00:00:00Z'`);
    expect((await post('/v1/auth/refresh', { refreshToken: session.refreshToken })).status).toBe(401);
    expect((await post('/v1/auth/refresh', { refreshToken: 'rt_unknown' })).status).toBe(401);
  });

  it('ends sessions when the account is deleted', async () => {
    const session = await json(await signIn());
    d1.exec('DELETE FROM users');
    expect((await post('/v1/auth/refresh', { refreshToken: session.refreshToken })).status).toBe(401);
  });
});

describe('POST /v1/auth/logout', () => {
  it('revokes the session and is idempotent', async () => {
    const session = await json(await signIn());
    expect((await post('/v1/auth/logout', { refreshToken: session.refreshToken })).status).toBe(204);
    expect((await post('/v1/auth/refresh', { refreshToken: session.refreshToken })).status).toBe(401);
    expect((await post('/v1/auth/logout', { refreshToken: session.refreshToken })).status).toBe(204);
    expect((await post('/v1/auth/logout', { refreshToken: 'rt_unknown' })).status).toBe(204);
  });
});
