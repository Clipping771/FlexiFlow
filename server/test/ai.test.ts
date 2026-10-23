import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/index';
import type { Bindings } from '../src/env';
import { signAccessToken } from '../src/lib/tokens';
import { PLAN_LIMITS } from '../src/lib/plans';
import { createTestD1, type TestD1 } from './d1';
import { createTestKV } from './kv';

const SECRET = 'test-secret-that-is-at-least-32-bytes-long';
const GEMINI_HOST = 'https://generativelanguage.googleapis.com/';

const validStageA = {
  selectedText: 'resilient',
  lemma: 'resilient',
  partOfSpeech: 'adjective',
  easyEnglish: 'Able to recover quickly after something bad happens.',
  easyBengali: 'কঠিন অবস্থা থেকে দ্রুত সামলে ওঠার ক্ষমতা আছে এমন',
  contextMeaning: 'They stayed strong and kept going during hard times.',
  example: 'Children are often very resilient.',
  exampleBengali: 'শিশুরা প্রায়ই খুব সহজে সামলে ওঠে।',
  confidence: 'high',
  contextualSenseId: 'sense_1'
};

const validStageB = {
  lemma: 'bank',
  partOfSpeech: 'noun',
  contextualSenseId: 'sense_financial',
  senses: [
    {
      id: 'sense_geographical',
      partOfSpeech: 'noun',
      easyEnglish: 'The land beside a river.',
      easyBengali: 'নদীর তীর বা পাড়',
      isContextual: false,
      examples: [{ english: 'We sat on the river bank.', bengali: 'আমরা নদীর তীরে বসেছিলাম।' }],
      synonyms: [],
      antonyms: []
    },
    {
      id: 'sense_financial',
      partOfSpeech: 'noun',
      easyEnglish: 'A business that keeps money.',
      easyBengali: 'অর্থ লেনদেনের প্রতিষ্ঠান',
      isContextual: true,
      examples: [{ english: 'She went to the bank.', bengali: 'সে ব্যাংকে গিয়েছিল।' }],
      synonyms: [],
      antonyms: []
    }
  ],
  collocations: [],
  idiomsAndPhrases: []
};

let d1: TestD1;
let env: Bindings;
let geminiReplies: Array<{ status?: number; body?: unknown }>;
let geminiRequests: Array<{ url: string; headers: Headers; prompt: string }>;

function geminiReply(output: unknown) {
  return {
    body: {
      candidates: [{ content: { parts: [{ text: typeof output === 'string' ? output : JSON.stringify(output) }] } }],
      usageMetadata: { promptTokenCount: 400, candidatesTokenCount: 120 }
    }
  };
}

beforeEach(async () => {
  d1 = await createTestD1();
  env = {
    DB: d1.db,
    JWT_SECRET: SECRET,
    ALLOWED_ORIGINS: '',
    GOOGLE_CLIENT_ID: 'test-client',
    GEMINI_API_KEY: 'gemini-test-key',
    GEMINI_MODEL: 'gemini-2.0-flash',
    UPGRADE_URL: 'https://lexiflow.test/pro', CACHE: createTestKV().kv
  };
  geminiReplies = [];
  geminiRequests = [];
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    if (!String(url).startsWith(GEMINI_HOST)) throw new Error(`unexpected fetch ${url}`);
    const body = JSON.parse(String(init.body));
    geminiRequests.push({ url: String(url), headers: new Headers(init.headers), prompt: body.contents[0].parts[0].text });
    const reply = geminiReplies.shift();
    if (!reply) throw new Error('no Gemini reply queued');
    return new Response(JSON.stringify(reply.body ?? {}), { status: reply.status ?? 200 });
  });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  d1.close();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function seedUser(plan: 'free' | 'pro' = 'free') {
  d1.exec(
    `INSERT INTO users (id, google_sub, email, plan, created_at) VALUES ('usr_1', 'g_1', 'r@example.com', ?1, '2026-10-01T00:00:00Z')`,
    [plan]
  );
}

async function call(path: string, body: unknown, token?: string | null) {
  const auth: Record<string, string> = token === null ? {} : { Authorization: `Bearer ${token ?? (await signAccessToken({ id: 'usr_1', plan: 'free', planExpiresAt: null }, SECRET))}` };
  return app.request(
    path,
    { method: 'POST', headers: { 'Content-Type': 'application/json', ...auth }, body: JSON.stringify(body) },
    env
  );
}

async function json(res: Response): Promise<any> {
  return res.json();
}

const stageABody = { text: 'resilient', contextSentence: 'They remained resilient during challenging times.', targetLang: 'bn' };

async function creditsUsed(): Promise<number> {
  return (await env.DB.prepare(`SELECT COALESCE(SUM(credits_used), 0) AS n FROM usage_daily`).first<number>('n')) ?? 0;
}

async function events() {
  return (await env.DB.prepare('SELECT endpoint, credits, status, tokens_in, tokens_out FROM usage_events ORDER BY id').all<any>()).results;
}

describe('POST /v1/ai/stage-a', () => {
  it('returns validated data, charges one credit and records usage', async () => {
    seedUser();
    geminiReplies.push(geminiReply(validStageA));

    const res = await call('/v1/ai/stage-a', stageABody);

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data).toMatchObject({ selectedText: 'resilient', easyBengali: validStageA.easyBengali });
    expect(body.usage).toMatchObject({ used: 1, limit: 30 });
    expect(body.cached).toBe(false);

    expect(geminiRequests).toHaveLength(1);
    expect(geminiRequests[0].url).toContain('/models/gemini-2.0-flash:generateContent');
    expect(geminiRequests[0].headers.get('x-goog-api-key')).toBe('gemini-test-key');
    expect(geminiRequests[0].prompt).toContain('Target: "resilient"');
    expect(await events()).toEqual([{ endpoint: 'stage-a', credits: 1, status: 'ok', tokens_in: 400, tokens_out: 120 }]);
  });

  it('retries once with the validation errors and succeeds', async () => {
    seedUser();
    geminiReplies.push(geminiReply({ ...validStageA, easyBengali: 'not Bengali' }), geminiReply(validStageA));

    const res = await call('/v1/ai/stage-a', stageABody);

    expect(res.status).toBe(200);
    expect(geminiRequests).toHaveLength(2);
    expect(geminiRequests[1].prompt).toContain('Your previous response had validation errors');
    expect(geminiRequests[1].prompt).toContain('easyBengali must contain Bengali script');
    expect(await creditsUsed()).toBe(1);
    expect((await events())[0]).toMatchObject({ tokens_in: 800, tokens_out: 240 });
  });

  it('retries unparseable output with a JSON-only reminder', async () => {
    seedUser();
    geminiReplies.push(geminiReply('this is not json'), geminiReply(validStageA));
    expect((await call('/v1/ai/stage-a', stageABody)).status).toBe(200);
    expect(geminiRequests[1].prompt).toContain('CRITICAL: Output ONLY valid JSON.');
  });

  it('refunds and answers AI_UNAVAILABLE when the output stays invalid', async () => {
    seedUser();
    const bad = geminiReply({ ...validStageA, easyBengali: 'still English' });
    geminiReplies.push(bad, bad);

    const res = await call('/v1/ai/stage-a', stageABody);

    expect(res.status).toBe(503);
    expect((await json(res)).error.code).toBe('AI_UNAVAILABLE');
    expect(geminiRequests).toHaveLength(2);
    expect(await creditsUsed()).toBe(0);
    expect((await events()).map((e) => e.status)).toEqual(['refunded']);
  });

  it('refunds when Gemini itself fails', async () => {
    seedUser();
    geminiReplies.push({ status: 500, body: { error: 'boom' } });
    const res = await call('/v1/ai/stage-a', stageABody);
    expect(res.status).toBe(503);
    expect(await creditsUsed()).toBe(0);
  });

  it('answers QUOTA_EXCEEDED without calling Gemini once the day is used up', async () => {
    seedUser();
    d1.exec(`INSERT INTO usage_daily (user_id, day, credits_used) VALUES ('usr_1', ?1, 30)`, [
      new Date(Date.now() + 6 * 3600e3).toISOString().slice(0, 10)
    ]);

    const res = await call('/v1/ai/stage-a', stageABody);

    expect(res.status).toBe(402);
    const body = await json(res);
    expect(body.error).toMatchObject({ code: 'QUOTA_EXCEEDED', used: 30, limit: 30 });
    expect(body.error.resetAt).toMatch(/T00:00:00\+06:00$/);
    // Monetization is off unless MONETIZATION_ENABLED is "true", so there is nothing to upgrade to.
    expect(body.error).not.toHaveProperty('upgradeUrl');
    expect(body.error.message).not.toMatch(/credit|pro\b/i);
    expect(geminiRequests).toHaveLength(0);
    expect(await creditsUsed()).toBe(30);
    expect((await events()).map((e) => e.status)).toEqual(['rejected']);
  });

  it('adds the upgrade link to QUOTA_EXCEEDED only when monetization is on', async () => {
    seedUser();
    d1.exec(`INSERT INTO usage_daily (user_id, day, credits_used) VALUES ('usr_1', ?1, 30)`, [
      new Date(Date.now() + 6 * 3600e3).toISOString().slice(0, 10)
    ]);
    env.MONETIZATION_ENABLED = 'true';

    const body = await json(await call('/v1/ai/stage-a', stageABody));

    expect(body.error).toMatchObject({ code: 'QUOTA_EXCEEDED', upgradeUrl: 'https://lexiflow.test/pro' });
  });

  it('lets only one of two concurrent requests take the last credit', async () => {
    seedUser();
    d1.exec(`INSERT INTO usage_daily (user_id, day, credits_used) VALUES ('usr_1', ?1, 29)`, [
      new Date(Date.now() + 6 * 3600e3).toISOString().slice(0, 10)
    ]);
    geminiReplies.push(geminiReply(validStageA), geminiReply(validStageA));

    const statuses = (await Promise.all([call('/v1/ai/stage-a', stageABody), call('/v1/ai/stage-a', stageABody)])).map((r) => r.status);

    expect(statuses.sort()).toEqual([200, 402]);
    expect(await creditsUsed()).toBe(30);
  });

  it('rate-limits per minute without charging credits', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-23T10:00:05Z'));
    seedUser();
    const limit = PLAN_LIMITS.free.requestsPerMinute;
    for (let i = 0; i < limit; i++) geminiReplies.push(geminiReply(validStageA));
    for (let i = 0; i < limit; i++) expect((await call('/v1/ai/stage-a', stageABody)).status).toBe(200);

    const limited = await call('/v1/ai/stage-a', stageABody);
    expect(limited.status).toBe(429);
    expect(limited.headers.get('Retry-After')).toBe('55');
    expect((await json(limited)).error).toMatchObject({ code: 'RATE_LIMITED', retryAfterSeconds: 55 });
    expect(await creditsUsed()).toBe(limit);

    vi.setSystemTime(new Date('2026-10-23T10:01:00Z'));
    geminiReplies.push(geminiReply(validStageA));
    expect((await call('/v1/ai/stage-a', stageABody)).status).toBe(200);
    // Old windows are cleaned up when a new one opens.
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM rate_limits').first('n')).toBe(1);
  });

  it.each([
    ['a missing text', { targetLang: 'bn' }, 400, 'INVALID_REQUEST'],
    ['a non-string text', { text: 42, targetLang: 'bn' }, 400, 'INVALID_REQUEST'],
    ['an unsupported language', { text: 'x', targetLang: 'xx' }, 400, 'INVALID_REQUEST'],
    ['a custom-language pair id', { text: 'x', targetLang: 'en-bn' }, 400, 'INVALID_REQUEST'],
    ['a sentence over the Free limit', { text: 'x', contextSentence: 'a'.repeat(601), targetLang: 'bn' }, 413, 'INPUT_TOO_LONG']
  ])('rejects %s before charging', async (_label, body, status, code) => {
    seedUser();
    const res = await call('/v1/ai/stage-a', body);
    expect(res.status).toBe(status);
    expect((await json(res)).error.code).toBe(code);
    expect(geminiRequests).toHaveLength(0);
    expect(await creditsUsed()).toBe(0);
  });

  it('reports the limit for INPUT_TOO_LONG and allows longer sentences on Pro', async () => {
    seedUser('pro');
    const tooLong = await json(await call('/v1/ai/stage-a', { ...stageABody, contextSentence: 'a'.repeat(2001) }));
    expect(tooLong.error).toMatchObject({ code: 'INPUT_TOO_LONG', field: 'contextSentence', maxChars: 2000 });

    geminiReplies.push(geminiReply(validStageA));
    const ok = await call('/v1/ai/stage-a', { ...stageABody, contextSentence: 'a'.repeat(1500) });
    expect(ok.status).toBe(200);
    expect((await json(ok)).usage.limit).toBe(600);
  });

  it('requires sign-in', async () => {
    seedUser();
    const res = await call('/v1/ai/stage-a', stageABody, null);
    expect(res.status).toBe(401);
    expect((await json(res)).error.code).toBe('AUTH_REQUIRED');
  });
});

describe('POST /v1/ai/stage-b', () => {
  it('returns the entry with the contextual sense first', async () => {
    seedUser();
    geminiReplies.push(geminiReply(validStageB));

    const res = await call('/v1/ai/stage-b', { lemma: 'Bank', partOfSpeech: 'noun', contextualSenseId: 'sense_financial', targetLang: 'bn' });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data.senses[0].id).toBe('sense_financial');
    expect(body.usage.used).toBe(1);
    expect(geminiRequests[0].prompt).toContain('Word: "bank"');
  });

  it('rejects a malformed sense id', async () => {
    seedUser();
    const res = await call('/v1/ai/stage-b', { lemma: 'bank', contextualSenseId: 'x"; drop', targetLang: 'bn' });
    expect(res.status).toBe(400);
  });
});
