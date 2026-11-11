import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/index';
import type { Bindings } from '../src/env';
import { signAccessToken } from '../src/lib/tokens';
import { createTestD1, type TestD1 } from './d1';
import { createTestKV } from './kv';
import { SPEECH_MODEL } from '../src/lib/speech';

const SECRET = 'test-secret-that-is-at-least-32-bytes-long';
let d1: TestD1;
let env: Bindings;
let reply: { status: number; body: unknown };
let requests: Array<{ url: string; body: any }>;

beforeEach(async () => {
  d1 = await createTestD1();
  env = {
    DB: d1.db,
    JWT_SECRET: SECRET,
    ALLOWED_ORIGINS: '',
    GOOGLE_CLIENT_ID: 'test-client',
    GEMINI_API_KEY: 'gemini-test-key',
    GEMINI_MODEL: 'gemini-2.0-flash',
    UPGRADE_URL: '',
    CACHE: createTestKV().kv
  };
  requests = [];
  reply = {
    status: 200,
    body: {
      candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/L16;codec=pcm;rate=24000', data: 'AAAA' } }] } }],
      usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 1000 }
    }
  };
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    requests.push({ url, body: JSON.parse(String(init.body)) });
    return new Response(JSON.stringify(reply.body), { status: reply.status, headers: { 'Content-Type': 'application/json' } });
  });
  d1.exec(
    `INSERT INTO users (id, google_sub, email, name, plan, plan_expires_at, created_at)
     VALUES ('usr_speech', 'g_speech', 's@example.com', 'S', 'free', NULL, '2026-11-01T00:00:00Z')`
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  d1.close();
});

async function speak(body: unknown) {
  const token = await signAccessToken({ id: 'usr_speech', plan: 'free', planExpiresAt: null }, SECRET, new Date());
  return app.request('/v1/ai/speech', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) }, env);
}

describe('POST /v1/ai/speech', () => {
  it('returns natural AI audio, charges 1 credit and logs usage', async () => {
    const res = await speak({ text: 'A short news brief for learners.' });
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.data).toMatchObject({ format: 'pcm16', base64: 'AAAA', sampleRate: 24000, model: SPEECH_MODEL, voice: 'Kore' });
    expect(json.usage.used).toBe(1);
    expect(requests[0].url).toContain(`models/${SPEECH_MODEL}:generateContent`);
    expect(requests[0].body.generationConfig.responseModalities).toEqual(['AUDIO']);
    const event = await env.DB.prepare("SELECT endpoint, tokens_out, status FROM usage_events WHERE user_id = 'usr_speech'").first<any>();
    expect(event).toMatchObject({ endpoint: 'speech', tokens_out: 1000, status: 'ok' });
  });

  it('refunds the credit when the model fails or returns no audio', async () => {
    reply = { status: 500, body: {} };
    expect((await speak({ text: 'Hello there.' })).status).toBe(503);
    reply = { status: 200, body: { candidates: [] } };
    expect((await speak({ text: 'Hello again.' })).status).toBe(503);
    const used = await env.DB.prepare("SELECT COALESCE(SUM(credits),0) AS n FROM usage_events WHERE user_id = 'usr_speech' AND status = 'ok'").first<any>();
    expect(used.n).toBe(0);
  });

  it('rejects missing or too long text', async () => {
    expect((await speak({})).status).toBe(400);
    expect((await speak({ text: 'x'.repeat(1300) })).status).toBe(413);
  });
});
