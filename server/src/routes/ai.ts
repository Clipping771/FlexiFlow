import { Hono, type Context } from 'hono';
import type { AppEnv } from '../env';
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
import { type GeminiConfig, type TaskResult, isSupportedTargetLang, runStageA, runStageB } from '../lib/stageTasks';
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

async function readBody<K extends string>(
  c: Context<AppEnv>,
  fields: Record<K, Field>,
  limits: PlanLimits
): Promise<Partial<Record<K, string>>> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new ApiError(400, 'INVALID_REQUEST', 'Request body must be JSON.');
  }
  const out: Partial<Record<K, string>> = {};
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

/**
 * The metered pipeline shared by every AI endpoint (CLOUD_BACKEND_DESIGN.md §2):
 * plan → input validation → rate limit → quota reserve → model → commit, or refund on failure.
 */
async function metered<K extends string, T>(
  c: Context<AppEnv>,
  endpoint: AiEndpoint,
  fields: Record<K, Field>,
  run: (gemini: GeminiConfig, input: Partial<Record<K, string>>) => Promise<TaskResult<T>>
) {
  const userId = c.get('userId');
  const now = new Date();
  const db = c.env.DB;

  const user = await loadUser(db, userId, now);
  if (!user) throw new ApiError(401, 'AUTH_REQUIRED', 'Account not found. Sign in again.');
  const limits = PLAN_LIMITS[user.plan];
  const input = await readBody(c, fields, limits);

  const rate = await hitRateLimit(db, userId, limits.requestsPerMinute, now);
  if (!rate.ok) {
    c.header('Retry-After', String(rate.retryAfterSeconds));
    throw new ApiError(429, 'RATE_LIMITED', 'Too many requests. Slow down for a moment.', {
      retryAfterSeconds: rate.retryAfterSeconds
    });
  }

  const day = dhakaDay(now);
  const credits = CREDIT_COSTS[endpoint];
  const resetAt = nextDhakaMidnight(now);
  const used = await reserveCredits(db, userId, day, credits, limits.dailyCredits);
  if (used === null) {
    await recordUsageEvent(db, { userId, endpoint, credits, cached: false, status: 'rejected' }, now);
    throw new ApiError(402, 'QUOTA_EXCEEDED', "You have used today's LexiFlow credits.", {
      used: await currentUsage(db, userId, day),
      limit: limits.dailyCredits,
      resetAt,
      upgradeUrl: c.env.UPGRADE_URL
    });
  }

  const started = Date.now();
  let result: TaskResult<T>;
  try {
    result = await run({ apiKey: c.env.GEMINI_API_KEY, model: c.env.GEMINI_MODEL }, input);
  } catch (err) {
    await refundCredits(db, userId, day, credits);
    await recordUsageEvent(db, { userId, endpoint, credits, cached: false, latencyMs: Date.now() - started, status: 'refunded' });
    console.warn(`[lexiflow-api] ${endpoint} failed (${(err as Error)?.name}); credits refunded`);
    throw new ApiError(503, 'AI_UNAVAILABLE', 'LexiFlow AI is busy right now. Try again in a moment. No credits were used.');
  }

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
  return c.json({ data: result.data, usage: { used, limit: limits.dailyCredits, resetAt }, cached: false });
}

const TARGET_LANG: Field = { required: true, max: 16, pattern: /^[a-z]{2,3}$/ };

ai.post('/stage-a', (c) =>
  metered(
    c,
    'stage-a',
    {
      text: { required: true, max: MAX_TARGET_CHARS },
      contextSentence: { max: (limits) => limits.maxSentenceChars },
      paragraphContext: { max: MAX_PARAGRAPH_CHARS },
      targetLang: TARGET_LANG
    },
    (gemini, input) =>
      runStageA(gemini, {
        text: input.text!,
        contextSentence: input.contextSentence,
        paragraphContext: input.paragraphContext,
        targetLang: input.targetLang!
      })
  )
);

ai.post('/stage-b', (c) =>
  metered(
    c,
    'stage-b',
    {
      lemma: { required: true, max: MAX_TARGET_CHARS },
      partOfSpeech: { max: 40 },
      contextualSenseId: { max: 40, pattern: /^[\w-]+$/ },
      targetLang: TARGET_LANG
    },
    (gemini, input) =>
      runStageB(gemini, {
        lemma: input.lemma!,
        partOfSpeech: input.partOfSpeech,
        contextualSenseId: input.contextualSenseId,
        targetLang: input.targetLang!
      })
  )
);
