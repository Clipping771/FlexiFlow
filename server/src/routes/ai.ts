import { Hono, type Context } from 'hono';
import type { AppEnv } from '../env';
import { cacheGet, cachePut, stageACacheKey, stageBCacheKey } from '../lib/cache';
import { ApiError } from '../lib/errors';
import { PLAN_LIMITS, type PlanLimits } from '../lib/plans';
import {
  CREDIT_COSTS,
  type AiEndpoint,
  currentUsage,
  recordUsageEvent,
  refundCredits,
  reserveCredits
} from '../lib/quota';
import { hitRateLimit } from '../lib/rateLimit';
import { addSpend, checkPause, estimateMicroUsd } from '../lib/spend';
import {
  type GeminiConfig,
  type TaskResult,
  TaskFailedError,
  isSupportedTargetLang,
  runStageA,
  runStageB
} from '../lib/stageTasks';
import { dhakaDay, nextDhakaMidnight } from '../lib/time';
import { loadUser } from '../lib/users';
import { requireAuth } from '../middleware/auth';

/** Longest word or phrase accepted as a Stage A/B target. */
const MAX_TARGET_CHARS = 120;
/** The prompt only uses the first 300 characters; anything far beyond that is not a real selection. */
const MAX_PARAGRAPH_CHARS = 2000;

export const ai = new Hono<AppEnv>();

ai.use('*', requireAuth);

type Field = { required?: boolean; max: number | ((limits: PlanLimits) => number); pattern?: RegExp };
type Input<K extends string> = Partial<Record<K, string>>;

async function readBody<K extends string>(
  c: Context<AppEnv>,
  fields: Record<K, Field>,
  limits: PlanLimits
): Promise<Input<K>> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new ApiError(400, 'INVALID_REQUEST', 'Request body must be JSON.');
  }
  const out: Input<K> = {};
  for (const [key, field] of Object.entries(fields) as [K, Field][]) {
    const raw = (body as Record<string, unknown> | null)?.[key];
    if (raw === undefined || raw === null || raw === '') {
      if (field.required) throw new ApiError(400, 'INVALID_REQUEST', `"${key}" is required.`);
      continue;
    }
    if (typeof raw !== 'string') throw new ApiError(400, 'INVALID_REQUEST', `"${key}" must be a string.`);
    const value = key === 'targetLang' ? raw.trim().toLowerCase() : raw;
    if (field.required && !value.trim()) throw new ApiError(400, 'INVALID_REQUEST', `"${key}" is required.`);
    const max = typeof field.max === 'function' ? field.max(limits) : field.max;
    if (value.length > max) {
      throw new ApiError(413, 'INPUT_TOO_LONG', `"${key}" is longer than ${max} characters.`, { field: key, maxChars: max });
    }
    if (field.pattern && !field.pattern.test(value)) throw new ApiError(400, 'INVALID_REQUEST', `"${key}" is not valid.`);
    out[key] = value;
  }
  if (out['targetLang' as K] !== undefined && !isSupportedTargetLang(out['targetLang' as K]!)) {
    throw new ApiError(400, 'INVALID_REQUEST', 'This target language is not available on LexiFlow Cloud yet.');
  }
  return out;
}

interface TaskSpec<K extends string, T> {
  endpoint: AiEndpoint;
  fields: Record<K, Field>;
  cacheKey: (input: Input<K>) => string | Promise<string>;
  run: (gemini: GeminiConfig, input: Input<K>) => Promise<TaskResult<T>>;
  /** Adapts a cached answer to this request, e.g. echoing the reader's exact selection. */
  fromCache?: (data: T, input: Input<K>) => T;
}

/**
 * The metered pipeline shared by every AI endpoint (CLOUD_BACKEND_DESIGN.md §2):
 * plan → input validation → rate limit → shared cache → kill switch (misses only) → quota reserve
 * → model → commit, or refund on failure. Cache hits are charged like any answer but cost no model call.
 */
async function metered<K extends string, T>(c: Context<AppEnv>, spec: TaskSpec<K, T>) {
  const { endpoint } = spec;
  const userId = c.get('userId');
  const now = new Date();
  const db = c.env.DB;

  const user = await loadUser(db, userId, now);
  if (!user) throw new ApiError(401, 'AUTH_REQUIRED', 'Account not found. Sign in again.');
  const limits = PLAN_LIMITS[user.plan];
  const input = await readBody(c, spec.fields, limits);

  const rate = await hitRateLimit(db, userId, limits.requestsPerMinute, now);
  if (!rate.ok) {
    c.header('Retry-After', String(rate.retryAfterSeconds));
    throw new ApiError(429, 'RATE_LIMITED', 'Too many requests. Slow down for a moment.', {
      retryAfterSeconds: rate.retryAfterSeconds
    });
  }

  const day = dhakaDay(now);
  const resetAt = nextDhakaMidnight(now);
  const key = await spec.cacheKey(input);
  const cached = await cacheGet<T>(c.env.CACHE, key);

  if (cached === null) {
    const pause = await checkPause(c.env, user.plan, day);
    if (pause.paused) {
      throw new ApiError(
        503,
        'AI_PAUSED',
        pause.reason === 'budget'
          ? 'LexiFlow Cloud is pausing new Free lookups for today because of high demand. Words others already looked up still work.'
          : 'LexiFlow Cloud is paused for maintenance. Words others already looked up still work. Try again later.',
        { resetAt }
      );
    }
  }

  const credits = CREDIT_COSTS[endpoint];
  const used = await reserveCredits(db, userId, day, credits, limits.dailyCredits);
  if (used === null) {
    await recordUsageEvent(db, { userId, endpoint, credits, cached: cached !== null, status: 'rejected' }, now);
    throw new ApiError(402, 'QUOTA_EXCEEDED', "You have used today's LexiFlow credits.", {
      used: await currentUsage(db, userId, day),
      limit: limits.dailyCredits,
      resetAt,
      upgradeUrl: c.env.UPGRADE_URL
    });
  }
  const usage = { used, limit: limits.dailyCredits, resetAt };

  if (cached !== null) {
    await recordUsageEvent(db, { userId, endpoint, credits, cached: true, latencyMs: 0, status: 'ok' }, now);
    return c.json({ data: spec.fromCache ? spec.fromCache(cached, input) : cached, usage, cached: true });
  }

  const started = Date.now();
  let result: TaskResult<T>;
  try {
    result = await spec.run({ apiKey: c.env.GEMINI_API_KEY, model: c.env.GEMINI_MODEL }, input);
  } catch (err) {
    // The reader gets the credit back, but tokens spent on a failed attempt still count toward our costs.
    const spentIn = err instanceof TaskFailedError ? err.tokensIn : 0;
    const spentOut = err instanceof TaskFailedError ? err.tokensOut : 0;
    await refundCredits(db, userId, day, credits);
    await addSpend(c.env, day, user.plan, estimateMicroUsd(c.env, spentIn, spentOut));
    await recordUsageEvent(db, {
      userId,
      endpoint,
      credits,
      cached: false,
      tokensIn: spentIn,
      tokensOut: spentOut,
      latencyMs: Date.now() - started,
      status: 'refunded'
    });
    const reason = err instanceof TaskFailedError ? err.reason : (err as Error)?.name;
    console.warn(`[lexiflow-api] ${endpoint} failed (${reason}); credits refunded`);
    throw new ApiError(503, 'AI_UNAVAILABLE', 'LexiFlow AI is busy right now. Try again in a moment. No credits were used.');
  }

  await addSpend(c.env, day, user.plan, estimateMicroUsd(c.env, result.tokensIn, result.tokensOut));
  await cachePut(c.env.CACHE, key, result.data);
  await recordUsageEvent(db, {
    userId,
    endpoint,
    credits,
    cached: false,
    tokensIn: result.tokensIn,
    tokensOut: result.tokensOut,
    latencyMs: Date.now() - started,
    status: 'ok'
  });
  return c.json({ data: result.data, usage, cached: false });
}

const TARGET_LANG: Field = { required: true, max: 16, pattern: /^[a-z]{2,3}$/ };

ai.post('/stage-a', (c) =>
  metered(c, {
    endpoint: 'stage-a',
    fields: {
      text: { required: true, max: MAX_TARGET_CHARS },
      contextSentence: { max: (limits) => limits.maxSentenceChars },
      paragraphContext: { max: MAX_PARAGRAPH_CHARS },
      targetLang: TARGET_LANG
    },
    cacheKey: (input) =>
      stageACacheKey({
        text: input.text!,
        contextSentence: input.contextSentence,
        paragraphContext: input.paragraphContext,
        targetLang: input.targetLang!
      }),
    run: (gemini, input) =>
      runStageA(gemini, {
        text: input.text!,
        contextSentence: input.contextSentence,
        paragraphContext: input.paragraphContext,
        targetLang: input.targetLang!
      }),
    fromCache: (data, input) => ({ ...data, selectedText: input.text!.trim() })
  })
);

ai.post('/stage-b', (c) =>
  metered(c, {
    endpoint: 'stage-b',
    fields: {
      lemma: { required: true, max: MAX_TARGET_CHARS },
      partOfSpeech: { max: 40 },
      contextualSenseId: { max: 40, pattern: /^[\w-]+$/ },
      targetLang: TARGET_LANG
    },
    cacheKey: (input) =>
      stageBCacheKey({
        lemma: input.lemma!,
        partOfSpeech: input.partOfSpeech,
        contextualSenseId: input.contextualSenseId,
        targetLang: input.targetLang!
      }),
    run: (gemini, input) =>
      runStageB(gemini, {
        lemma: input.lemma!,
        partOfSpeech: input.partOfSpeech,
        contextualSenseId: input.contextualSenseId,
        targetLang: input.targetLang!
      })
  })
);
