import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { ApiError } from '../lib/errors';
import { requireAuth } from '../middleware/auth';
import { loadUser } from '../lib/users';
import { SyncSnapshotSchema } from '../lib/schemas/sync';

const MAX_BODY_BYTES = 512 * 1024;

export const sync = new Hono<AppEnv>();

sync.use('*', requireAuth);

/** GET /v1/sync — the learner's saved mistakes, goals and activity (empty for a new learner) */
sync.get('/', async (c) => {
  const userId = c.get('userId');
  const user = await loadUser(c.env.DB, userId, new Date());
  if (!user) throw new ApiError(401, 'AUTH_REQUIRED', 'Account not found. Sign in again.');

  const row = await c.env.DB.prepare(
    'SELECT mistakes_json, goals_json, activity_json, updated_at FROM learner_sync WHERE user_id = ?1'
  )
    .bind(userId)
    .first<{ mistakes_json: string; goals_json: string | null; activity_json: string; updated_at: string }>();

  if (!row) return c.json({ data: { mistakes: [], goals: null, activity: {}, updatedAt: null } });
  return c.json({
    data: {
      mistakes: JSON.parse(row.mistakes_json),
      goals: row.goals_json ? JSON.parse(row.goals_json) : null,
      activity: JSON.parse(row.activity_json),
      updatedAt: row.updated_at
    }
  });
});

/** PUT /v1/sync — replaces the saved snapshot (the extension merges before it sends) */
sync.put('/', async (c) => {
  const userId = c.get('userId');
  const user = await loadUser(c.env.DB, userId, new Date());
  if (!user) throw new ApiError(401, 'AUTH_REQUIRED', 'Account not found. Sign in again.');

  const raw = await c.req.text();
  if (raw.length > MAX_BODY_BYTES) throw new ApiError(400, 'INPUT_TOO_LONG', 'Sync data is too large.');
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new ApiError(400, 'INVALID_REQUEST', 'Invalid JSON payload.');
  }
  const parsed = SyncSnapshotSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues
      .slice(0, 3)
      .map((e) => `${e.path.join('.')}: ${e.message}`)
      .join(', ');
    throw new ApiError(400, 'INVALID_REQUEST', msg);
  }

  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `INSERT INTO learner_sync (user_id, mistakes_json, goals_json, activity_json, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5)
     ON CONFLICT(user_id) DO UPDATE SET
       mistakes_json = excluded.mistakes_json,
       goals_json = excluded.goals_json,
       activity_json = excluded.activity_json,
       updated_at = excluded.updated_at`
  )
    .bind(
      userId,
      JSON.stringify(parsed.data.mistakes),
      parsed.data.goals ? JSON.stringify(parsed.data.goals) : null,
      JSON.stringify(parsed.data.activity ?? {}),
      now
    )
    .run();

  return c.json({ data: { updatedAt: now } });
});
