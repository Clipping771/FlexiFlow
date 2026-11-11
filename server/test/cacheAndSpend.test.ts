import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/index';
import type { Bindings } from '../src/env';
import { signAccessToken } from '../src/lib/tokens';
import { CACHE_TTL_SECONDS } from '../src/lib/cache';
import { KILL_SWITCH_KEY, estimateMicroUsd } from '../src/lib/spend';
import { dhakaDay } from '../src/lib/time';
import { PROMPT_VERSION } from '../../src/services/ai/prompts';
import { createTestD1, type TestD1 } from './d1';
import { createTestKV, type TestKV } from './kv';

const SECRET = 'test-secret-that-is-at-least-32-bytes-long';

const stageA = {
  selectedText: 'resilient',
  lemma: 'resilient',
  partOfSpeech: 'adjective',
  easyEnglish: 'Able to recover quickly.',
  easyBengali: 'দ্রুত সামলে ওঠার ক্ষমতা আছে এমন',
  contextMeaning: 'They kept going in hard times.',
  confidence: 'high',
  contextualSenseId: 'sense_1'
};

const stageB = {
  lemma: 'bank',
  partOfSpeech: 'noun',
  contextualSenseId: 'sense_1',
  senses: [
    {
      id: 'sense_1',
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
let kv: TestKV;
let env: Bindings;
let geminiCalls: number;
let webhookBodies: unknown[];
let nextOutput: unknown;

beforeEach(async () => {
  d1 = await createTestD1();
  kv = createTestKV();
  env = {
    DB: d1.db,
    CACHE: kv.kv,
    JWT_SECRET: SECRET,
    ALLOWED_ORIGINS: '',
    GOOGLE_CLIENT_ID: 'test-client',
    GEMINI_API_KEY: 'k',
    GEMINI_MODEL: 'gemini-2.0-flash',
    UPGRADE_URL: 'https://lexiflow.test/pro',
    GEMINI_INPUT_USD_PER_MTOK: '0.10',
    GEMINI_OUTPUT_USD_PER_MTOK: '0.40',
    FREE_DAILY_BUDGET_USD: '5',
    ALERT_WEBHOOK_URL: 'https://hooks.test/alert'
  };
  geminiCalls = 0;
  webhookBodies = [];
  nextOutput = stageB;
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    if (url === 'https://hooks.test/alert') {
      webhookBodies.push(JSON.parse(String(init.body)));
      return new Response(null, { status: 204 });
    }
    geminiCalls++;
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify(nextOutput) }] } }],
      usageMetadata: { promptTokenCount: 400, candidatesTokenCount: 120 }
    }));
  });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  for (const [id, plan] of [['usr_free', 'free'], ['usr_pro', 'pro']]) {
    d1.exec(`INSERT INTO users (id, google_sub, email, plan, created_at) VALUES (?1, ?2, 'r@example.com', ?3, '2026-10-01T00:00:00Z')`, [id, `g_${id}`, plan]);
  }
});

afterEach(() => {
  d1.close();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function call(path: string, body: Record<string, unknown>, userId = 'usr_free') {
  const token = await signAccessToken({ id: userId, plan: 'free', planExpiresAt: null }, SECRET);
  return app.request(
    path,
    { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) },
    env
  );
}

async function json(res: Response): Promise<any> {
  return res.json();
}

const bankB = { lemma: 'bank', partOfSpeech: 'noun', contextualSenseId: 'sense_1', targetLang: 'bn' };

async function spend(plan: string): Promise<number> {
  return (await env.DB.prepare('SELECT micro_usd FROM spend_daily WHERE plan = ?1').bind(plan).first<number>('micro_usd')) ?? 0;
}

describe('shared cache', () => {
  it('answers a repeat lookup from cache, still charging a credit, with no model call', async () => {
    const first = await json(await call('/v1/ai/stage-b', bankB));
    const second = await json(await call('/v1/ai/stage-b', { ...bankB, lemma: '  Bank ' }, 'usr_pro'));

    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(second.data).toEqual(first.data);
    expect(second.usage.used).toBe(1);
    expect(geminiCalls).toBe(1);

    const events = (await env.DB.prepare('SELECT cached, tokens_in FROM usage_events ORDER BY id').all<any>()).results;
    expect(events).toEqual([{ cached: 0, tokens_in: 400 }, { cached: 1, tokens_in: null }]);
  });

  it('stores entries with a 30-day TTL under a versioned key', async () => {
    await call('/v1/ai/stage-b', bankB);
    expect([...kv.store.keys()]).toEqual([`sb:${PROMPT_VERSION}:bn:bank:noun:sense_1`]);
    expect([...kv.store.values()][0].ttl).toBe(CACHE_TTL_SECONDS);
  });

  it('keeps separate entries per sense, part of speech and language', async () => {
    await call('/v1/ai/stage-b', bankB);
    await call('/v1/ai/stage-b', { ...bankB, contextualSenseId: 'sense_2' });
    await call('/v1/ai/stage-b', { ...bankB, partOfSpeech: 'verb' });
    expect(geminiCalls).toBe(3);
  });

  it('keys Stage A on a hash of the context and never stores the sentence in the key', async () => {
    nextOutput = stageA;
    const sentence = 'My private diary says they remained resilient.';
    await call('/v1/ai/stage-a', { text: 'resilient', contextSentence: sentence, targetLang: 'bn' });
    const hit = await json(await call('/v1/ai/stage-a', { text: 'Resilient', contextSentence: sentence, targetLang: 'bn' }));
    await call('/v1/ai/stage-a', { text: 'resilient', contextSentence: 'Another sentence.', targetLang: 'bn' });

    expect(geminiCalls).toBe(2);
    expect(hit.cached).toBe(true);
    expect(hit.data.selectedText).toBe('Resilient');
    for (const key of kv.store.keys()) {
      expect(key).toMatch(new RegExp(`^sa:${PROMPT_VERSION}:bn:[0-9a-f]{64}:[0-9a-f]{64}$`));
      expect(key).not.toContain('diary');
    }
  });

  it('does not cache invalid model output', async () => {
    nextOutput = { ...stageB, senses: [{ ...stageB.senses[0], easyBengali: 'English only' }] };
    expect((await call('/v1/ai/stage-b', bankB)).status).toBe(503);
    expect(kv.store.size).toBe(0);
  });

  it('keeps working when KV is down', async () => {
    kv.fail = true;
    expect((await call('/v1/ai/stage-b', bankB)).status).toBe(200);
    expect((await call('/v1/ai/stage-b', bankB)).status).toBe(200);
    expect(geminiCalls).toBe(2);
  });
});

describe('spend tracking and kill switch', () => {
  it('adds the estimated cost of each model call to the plan\'s daily spend', async () => {
    await call('/v1/ai/stage-b', bankB);
    await call('/v1/ai/stage-b', { ...bankB, lemma: 'river' }, 'usr_pro');
    await call('/v1/ai/stage-b', bankB); // cache hit costs nothing

    const perCall = estimateMicroUsd(env, 400, 120);
    expect(perCall).toBe(88); // 400 × 0.10 + 120 × 0.40 micro-USD
    expect(await spend('free')).toBe(perCall);
    expect(await spend('pro')).toBe(perCall);
  });

  it('counts tokens spent on failed attempts even though the reader is refunded', async () => {
    nextOutput = 'not json';
    expect((await call('/v1/ai/stage-b', bankB)).status).toBe(503);
    expect(geminiCalls).toBe(2);
    expect(await spend('free')).toBe(2 * 88);
    const event = await env.DB.prepare('SELECT status, tokens_in, tokens_out FROM usage_events').first();
    expect(event).toEqual({ status: 'refunded', tokens_in: 800, tokens_out: 240 });
  });

  it('pauses new Free lookups at the budget without charging, but serves cached answers and Pro', async () => {
    await call('/v1/ai/stage-b', bankB); // cache "bank"
    d1.exec(`UPDATE spend_daily SET micro_usd = 5000000 WHERE plan = 'free'`);

    const paused = await call('/v1/ai/stage-b', { ...bankB, lemma: 'river' });
    expect(paused.status).toBe(503);
    expect((await json(paused)).error).toMatchObject({ code: 'AI_PAUSED' });
    expect((await json(await call('/v1/ai/stage-b', bankB))).cached).toBe(true);
    expect((await call('/v1/ai/stage-b', { ...bankB, lemma: 'river' }, 'usr_pro')).status).toBe(200);

    const used = await env.DB.prepare(`SELECT credits_used FROM usage_daily WHERE user_id = 'usr_free'`).first<number>('credits_used');
    expect(used).toBe(2); // the first lookup and the cache hit; the paused request was free
  });

  it('alerts once when Free spend first crosses the budget', async () => {
    d1.exec(`INSERT INTO spend_daily (day, plan, micro_usd) VALUES (?1, 'free', 4999950)`, [dhakaDay()]);
    await call('/v1/ai/stage-b', bankB); // crosses: 4,999,950 + 88
    await call('/v1/ai/stage-b', { ...bankB, lemma: 'river' }); // now paused, no further spend

    expect(webhookBodies).toHaveLength(1);
    expect(webhookBodies[0]).toMatchObject({ text: expect.stringContaining('$5.00 daily budget') });
  });

  it('honours the manual switch for Free only or for everyone', async () => {
    kv.store.set(KILL_SWITCH_KEY, { value: 'free' });
    expect((await call('/v1/ai/stage-b', bankB)).status).toBe(503);
    expect((await call('/v1/ai/stage-b', bankB, 'usr_pro')).status).toBe(200);

    kv.store.set(KILL_SWITCH_KEY, { value: 'all' });
    const pro = await call('/v1/ai/stage-b', { ...bankB, lemma: 'river' }, 'usr_pro');
    expect(pro.status).toBe(503);
    expect((await json(pro)).error.message).toContain('maintenance');

    kv.store.delete(KILL_SWITCH_KEY);
    expect((await call('/v1/ai/stage-b', { ...bankB, lemma: 'river' })).status).toBe(200);
  });
});
