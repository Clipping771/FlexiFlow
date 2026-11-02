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

function seedUser(id = 'usr_test_mistakes') {
  d1.exec(
    `INSERT INTO users (id, google_sub, email, name, plan, plan_expires_at, created_at)
     VALUES (?1, ?2, 'student@example.com', 'Test Student', 'free', NULL, '2026-11-01T00:00:00Z')`,
    [id, `g_${id}`]
  );
  return id;
}

async function tokenFor(id: string) {
  return signAccessToken({ id, plan: 'free', planExpiresAt: null }, SECRET, new Date());
}

async function postJson(path: string, body: unknown, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return app.request(path, { method: 'POST', headers, body: JSON.stringify(body) }, env);
}

async function getJson(path: string, token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return app.request(path, { method: 'GET', headers }, env);
}

describe('TICKET LF-002: Mistake Memory D1 Endpoints & Lifecycle', () => {
  it('1. End-to-End Fake Error Lifecycle in D1: New -> Practising -> Improving -> Mastered -> Reopened', async () => {
    const userId = seedUser();
    const token = await tokenFor(userId);

    // Step 1: Detect occurrence -> state becomes 'New'
    const res1 = await postJson(
      '/v1/mistakes/occurrence',
      {
        error_code: 'GRA.SUBJ_VERB_AGR',
        task_id: 'ielts_writing_task_2',
        evidence_text: 'The list of candidate items were reviewed',
        context_snippet: 'The list of candidate items were reviewed by the examiner.'
      },
      token
    );
    expect(res1.status).toBe(200);
    const data1 = (await res1.json()) as any;
    expect(data1.success).toBe(true);
    expect(data1.transition.nextState).toBe('New');
    expect(data1.transition.occurrences).toBe(1);

    // Step 2: Start practice -> state becomes 'Practising'
    const res2 = await postJson(
      '/v1/mistakes/practice/start',
      { error_code: 'GRA.SUBJ_VERB_AGR' },
      token
    );
    expect(res2.status).toBe(200);
    const data2 = (await res2.json()) as any;
    expect(data2.transition.nextState).toBe('Practising');

    // Step 3: Complete drill attempt 1 (success) -> state becomes 'Improving'
    const res3 = await postJson(
      '/v1/mistakes/practice/result',
      { error_code: 'GRA.SUBJ_VERB_AGR', is_successful: true },
      token
    );
    expect(res3.status).toBe(200);
    const data3 = (await res3.json()) as any;
    expect(data3.transition.nextState).toBe('Improving');
    expect(data3.transition.successfulCorrections).toBe(1);
    expect(data3.transition.nextReviewDays).toBe(3);

    // Step 4: Complete drill attempt 2 (success) -> state graduates to 'Mastered'
    const res4 = await postJson(
      '/v1/mistakes/practice/result',
      { error_code: 'GRA.SUBJ_VERB_AGR', is_successful: true },
      token
    );
    expect(res4.status).toBe(200);
    const data4 = (await res4.json()) as any;
    expect(data4.transition.nextState).toBe('Mastered');
    expect(data4.transition.successfulCorrections).toBe(2);
    expect(data4.transition.isNewlyMastered).toBe(true);
    expect(data4.transition.nextReviewDays).toBe(21);

    // Verify D1 row has mastered_at set
    const masteredRow = await d1.db
      .prepare('SELECT mastery_state, mastered_at, successful_corrections FROM mistake_memories WHERE user_id = ?1')
      .bind(userId)
      .first<any>();
    expect(masteredRow.mastery_state).toBe('Mastered');
    expect(masteredRow.mastered_at).not.toBeNull();
    expect(masteredRow.successful_corrections).toBe(2);

    // Step 5: Relapse! Learner repeats error in a future task -> state flips to 'Reopened'
    const res5 = await postJson(
      '/v1/mistakes/occurrence',
      {
        error_code: 'GRA.SUBJ_VERB_AGR',
        task_id: 'pte_write_essay',
        evidence_text: 'A collection of paintings are on display'
      },
      token
    );
    expect(res5.status).toBe(200);
    const data5 = (await res5.json()) as any;
    expect(data5.transition.nextState).toBe('Reopened');
    expect(data5.transition.isRelapse).toBe(true);
    expect(data5.transition.occurrences).toBe(2);

    // Verify D1 row has cleared mastered_at
    const relapsedRow = await d1.db
      .prepare('SELECT mastery_state, mastered_at, successful_corrections FROM mistake_memories WHERE user_id = ?1')
      .bind(userId)
      .first<any>();
    expect(relapsedRow.mastery_state).toBe('Reopened');
    expect(relapsedRow.mastered_at).toBeNull();
    expect(relapsedRow.successful_corrections).toBe(0);
  });

  it('2. Unknown error code is rejected with 400 Bad Request', async () => {
    const userId = seedUser();
    const token = await tokenFor(userId);

    const res = await postJson(
      '/v1/mistakes/occurrence',
      {
        error_code: 'UNKNOWN_NONEXISTENT_CODE',
        task_id: 'pte_read_aloud',
        evidence_text: 'Sample error'
      },
      token
    );

    expect(res.status).toBe(400);
    const data = (await res.json()) as any;
    expect(data.error.code).toBe('INVALID_REQUEST');
  });

  it('3. GET /v1/mistakes returns learner mistake summary with definition metadata', async () => {
    const userId = seedUser('usr_summary');
    const token = await tokenFor(userId);

    await postJson(
      '/v1/mistakes/occurrence',
      {
        error_code: 'PTE.SWT_MULTI_SENTENCE',
        task_id: 'pte_summarize_written_text',
        evidence_text: 'First sentence. Second sentence.'
      },
      token
    );

    const res = await getJson('/v1/mistakes', token);
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.counts.total).toBe(1);
    expect(data.counts.new).toBe(1);
    expect(data.items[0].error_code).toBe('PTE.SWT_MULTI_SENTENCE');
    expect(data.items[0].definition).toBeDefined();
    expect(data.items[0].definition.category).toBe('PTE');
    expect(data.items[0].definition.severity).toBe('critical');
  });
});
