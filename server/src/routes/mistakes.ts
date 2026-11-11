import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../env';
import { ApiError } from '../lib/errors';
import { requireAuth } from '../middleware/auth';
import { loadUser } from '../lib/users';
import { MistakeMemoryDbService } from '../lib/mistakeMemory';

export const RecordOccurrenceSchema = z.object({
  error_code: z.string().trim().min(1, 'error_code is required'),
  task_id: z.string().trim().min(1, 'task_id is required'),
  evidence_text: z.string().trim().min(1, 'evidence_text is required'),
  context_snippet: z.string().optional()
});

export const PracticeAttemptSchema = z.object({
  error_code: z.string().trim().min(1, 'error_code is required'),
  is_successful: z.boolean()
});

export const mistakes = new Hono<AppEnv>();

mistakes.use('*', requireAuth);

/** GET /v1/mistakes — lists learner mistake memory items and state counts */
mistakes.get('/', async (c) => {
  const userId = c.get('userId');
  const user = await loadUser(c.env.DB, userId, new Date());
  if (!user) throw new ApiError(401, 'AUTH_REQUIRED', 'Account not found. Sign in again.');

  const result = await MistakeMemoryDbService.getLearnerMistakes(c.env.DB, userId);
  return c.json(result);
});

/** POST /v1/mistakes/occurrence — records an error occurrence detected in learner submission */
mistakes.post('/occurrence', async (c) => {
  const userId = c.get('userId');
  const user = await loadUser(c.env.DB, userId, new Date());
  if (!user) throw new ApiError(401, 'AUTH_REQUIRED', 'Account not found. Sign in again.');

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new ApiError(400, 'INVALID_REQUEST', 'Invalid JSON payload.');
  }

  const parsed = RecordOccurrenceSchema.safeParse(body);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new ApiError(400, 'INVALID_REQUEST', errorMsg);
  }

  const res = await MistakeMemoryDbService.recordOccurrence(c.env.DB, {
    userId,
    errorCode: parsed.data.error_code,
    taskId: parsed.data.task_id,
    evidenceText: parsed.data.evidence_text,
    contextSnippet: parsed.data.context_snippet
  });

  return c.json({ success: true, ...res });
});

/** POST /v1/mistakes/practice/start — marks an error as currently being practised */
mistakes.post('/practice/start', async (c) => {
  const userId = c.get('userId');
  const user = await loadUser(c.env.DB, userId, new Date());
  if (!user) throw new ApiError(401, 'AUTH_REQUIRED', 'Account not found. Sign in again.');

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    throw new ApiError(400, 'INVALID_REQUEST', 'Invalid JSON payload.');
  }

  if (!body?.error_code) {
    throw new ApiError(400, 'INVALID_REQUEST', 'error_code is required.');
  }

  const res = await MistakeMemoryDbService.startPractice(c.env.DB, userId, body.error_code);
  return c.json({ success: true, ...res });
});

/** POST /v1/mistakes/practice/result — records a drill result and updates mastery state and FSRS */
mistakes.post('/practice/result', async (c) => {
  const userId = c.get('userId');
  const user = await loadUser(c.env.DB, userId, new Date());
  if (!user) throw new ApiError(401, 'AUTH_REQUIRED', 'Account not found. Sign in again.');

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new ApiError(400, 'INVALID_REQUEST', 'Invalid JSON payload.');
  }

  const parsed = PracticeAttemptSchema.safeParse(body);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new ApiError(400, 'INVALID_REQUEST', errorMsg);
  }

  const res = await MistakeMemoryDbService.recordPracticeAttempt(c.env.DB, {
    userId,
    errorCode: parsed.data.error_code,
    isSuccessful: parsed.data.is_successful
  });

  return c.json({ success: true, ...res });
});
