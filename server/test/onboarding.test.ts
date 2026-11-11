import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/index';
import type { Bindings } from '../src/env';
import { signAccessToken } from '../src/lib/tokens';
import { createTestD1, type TestD1 } from './d1';
import { createTestKV } from './kv';

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
    GOOGLE_CLIENT_ID: 'test-client.apps.googleusercontent.com',
    GEMINI_API_KEY: '',
    GEMINI_MODEL: 'gemini-2.0-flash',
    UPGRADE_URL: '',
    CACHE: createTestKV().kv
  };
});

afterEach(() => {
  d1.close();
});

function seedUser(id = 'usr_test_onboarding') {
  d1.exec(
    `INSERT INTO users (id, google_sub, email, name, plan, plan_expires_at, created_at)
     VALUES (?1, ?2, 'learner@example.com', 'Test Learner', 'free', NULL, '2026-11-01T00:00:00Z')`,
    [id, `g_${id}`]
  );
  return id;
}

async function tokenFor(id: string) {
  return signAccessToken({ id, plan: 'free', planExpiresAt: null }, SECRET, new Date());
}

async function postOnboarding(body: unknown, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return app.request('/v1/onboarding', { method: 'POST', headers, body: JSON.stringify(body) }, env);
}

async function getOnboarding(token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return app.request('/v1/onboarding', { method: 'GET', headers }, env);
}

describe('TICKET LF-001: Onboarding & Auth Core API', () => {
  it('1. happy_path: User submits valid PTE onboarding form -> 200 OK and initializes profiles in D1', async () => {
    const userId = seedUser();
    const token = await tokenFor(userId);

    const res = await postOnboarding(
      {
        target_exam: 'pte_academic',
        target_score: '79',
        target_exam_date: '2026-12-15',
        mother_tongue: 'bn',
        study_hours_weekly: 15
      },
      token
    );

    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.success).toBe(true);
    expect(data.profile).toMatchObject({
      userId,
      targetExam: 'pte_academic',
      targetScore: '79',
      targetExamDate: '2026-12-15',
      motherTongue: 'bn',
      studyHoursWeekly: 15
    });

    // Verify D1 database state
    const learnerRow = await d1.db
      .prepare('SELECT * FROM learner_profiles WHERE user_id = ?1')
      .bind(userId)
      .first<any>();
    expect(learnerRow).not.toBeNull();
    expect(learnerRow.target_exam).toBe('pte_academic');
    expect(learnerRow.target_score).toBe('79');

    const examRow = await d1.db
      .prepare('SELECT * FROM exam_profiles WHERE user_id = ?1 AND exam_type = ?2')
      .bind(userId, 'pte_academic')
      .first<any>();
    expect(examRow).not.toBeNull();
    expect(examRow.exam_type).toBe('pte_academic');
  });

  it('2. failure_invalid_exam: Rejects unsupported exam (e.g. toefl_ibt) with 400 Bad Request', async () => {
    const userId = seedUser();
    const token = await tokenFor(userId);

    const res = await postOnboarding(
      {
        target_exam: 'toefl_ibt',
        target_score: '100'
      },
      token
    );

    expect(res.status).toBe(400);
    const data = await res.json() as any;
    expect(data.error.code).toBe('INVALID_REQUEST');
    expect(data.error.message).toContain('target_exam');
  });

  it('3. failure_unauthenticated: Request without valid bearer session fails with 401 Unauthorized', async () => {
    const res = await postOnboarding({
      target_exam: 'ielts_academic',
      target_score: '7.5'
    });

    expect(res.status).toBe(401);
  });

  it('4. edge_case_optional_date: User omits target exam date -> succeeds with null date without crashing', async () => {
    const userId = seedUser();
    const token = await tokenFor(userId);

    const res = await postOnboarding(
      {
        target_exam: 'ielts_academic',
        target_score: '7.5'
      },
      token
    );

    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.profile.targetExamDate).toBeNull();
    expect(data.profile.motherTongue).toBe('bn'); // Default Bengali
  });

  it('5. get_onboarding: Returns completed: false for a newly signed up user', async () => {
    const userId = seedUser('usr_new');
    const token = await tokenFor(userId);

    const res = await getOnboarding(token);
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.completed).toBe(false);
    expect(data.profile).toBeNull();
  });

  it('6. get_onboarding: Returns full profile and active exam profile after onboarding completion', async () => {
    const userId = seedUser('usr_completed');
    const token = await tokenFor(userId);

    await postOnboarding(
      {
        target_exam: 'ielts_academic',
        target_score: '8.0',
        mother_tongue: 'bn'
      },
      token
    );

    const res = await getOnboarding(token);
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.completed).toBe(true);
    expect(data.profile.targetExam).toBe('ielts_academic');
    expect(data.profile.targetScore).toBe('8.0');
    expect(data.profile.activeExamProfile).not.toBeNull();
    expect(data.profile.activeExamProfile.examType).toBe('ielts_academic');
  });
});
