import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/index';
import type { Bindings } from '../src/env';
import { signAccessToken } from '../src/lib/tokens';
import { deleteAccount } from '../src/lib/retention';
import { createTestD1, type TestD1 } from './d1';
import { createTestKV } from './kv';

const SECRET = 'test-secret-that-is-at-least-32-bytes-long';
let d1: TestD1;
let env: Bindings;

beforeEach(async () => {
  d1 = await createTestD1();
  env = {
    DB: d1.db,
    JWT_SECRET: SECRET,
    ALLOWED_ORIGINS: 'http://localhost:8787',
    GOOGLE_CLIENT_ID: 'test-client.apps.googleusercontent.com',
    GEMINI_API_KEY: '',
    GEMINI_MODEL: 'gemini-2.0-flash',
    UPGRADE_URL: '',
    CACHE: createTestKV().kv
  };
});
afterEach(() => d1.close());

function seedUser(id = 'usr_sync') {
  d1.exec(
    `INSERT INTO users (id, google_sub, email, name, plan, plan_expires_at, created_at)
     VALUES (?1, ?2, 'student@example.com', 'Student', 'free', NULL, '2026-11-01T00:00:00Z')`,
    [id, `g_${id}`]
  );
  return id;
}
const token = (id: string) => signAccessToken({ id, plan: 'free', planExpiresAt: null }, SECRET, new Date());
const call = async (method: string, body?: unknown, tok?: string) =>
  app.request(
    '/v1/sync',
    {
      method,
      headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body)
    },
    env
  );

const mistake = {
  id: 'mm_1',
  errorCode: 'GRA.SUBJ_VERB_AGR',
  masteryState: 'Improving',
  totalOccurrences: 2,
  successfulCorrections: 1,
  lastSeenAt: '2026-11-10T10:00:00.000Z',
  nextReviewAt: '2026-11-14',
  nextReviewDays: 3,
  practiceSessions: 1,
  updatedAt: '2026-11-11T10:00:00.000Z',
  recentOccurrences: [{ id: 'o1', taskId: 'smart_practice_writing', evidenceText: 'He go.', contextSnippet: 'He goes.', createdAt: '2026-11-10T10:00:00.000Z' }]
};

describe('Learner sync', () => {
  it('needs sign-in', async () => {
    expect((await call('GET')).status).toBe(401);
  });

  it('a new learner gets an empty snapshot; a saved snapshot comes back', async () => {
    const tok = await token(seedUser());
    const empty = (await (await call('GET', undefined, tok)).json()) as any;
    expect(empty.data).toMatchObject({ mistakes: [], goals: null, activity: {} });

    const goals = { level: 'B1', focus: ['speaking'], dailyMinutes: 15, reminderTime: '20:00', updatedAt: '2026-11-11T00:00:00.000Z' };
    const put = await call('PUT', { mistakes: [mistake], goals, activity: { '2026-11-11': { review: 3, drill: 4, practice: 0 } } }, tok);
    expect(put.status).toBe(200);

    const back = (await (await call('GET', undefined, tok)).json()) as any;
    expect(back.data.mistakes[0]).toMatchObject({ errorCode: 'GRA.SUBJ_VERB_AGR', practiceSessions: 1 });
    expect(back.data.goals).toEqual(goals);
    expect(back.data.activity['2026-11-11'].drill).toBe(4);
  });

  it('rejects invalid or oversized data', async () => {
    const tok = await token(seedUser());
    expect((await call('PUT', { mistakes: [{ ...mistake, masteryState: 'Done' }] }, tok)).status).toBe(400);
    expect((await call('PUT', '{bad', tok)).status).toBe(400);
    expect((await call('PUT', { mistakes: [], activity: { yesterday: { review: 1, drill: 0, practice: 0 } } }, tok)).status).toBe(400);
    expect((await call('PUT', 'x'.repeat(600 * 1024), tok)).status).toBe(400);
  });

  it('account deletion removes synced data and mistake records', async () => {
    const id = seedUser();
    const tok = await token(id);
    await call('PUT', { mistakes: [mistake] }, tok);
    await deleteAccount(env.DB, id);
    const left = await env.DB.prepare('SELECT COUNT(*) AS n FROM learner_sync WHERE user_id = ?1').bind(id).first<{ n: number }>();
    expect(left?.n).toBe(0);
  });
});
