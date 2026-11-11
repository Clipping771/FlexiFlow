import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestD1, type TestD1 } from './d1';

let d1: TestD1;

beforeEach(async () => {
  d1 = await createTestD1();
});

afterEach(() => {
  d1.close();
});

function seedUser(id = 'usr_rl_test') {
  d1.exec(
    `INSERT INTO users (id, google_sub, email, name, plan, plan_expires_at, created_at)
     VALUES (?1, ?2, 'reader@example.com', 'Reading Student', 'free', NULL, '2026-11-01T00:00:00Z')`,
    [id, `g_${id}`]
  );
  return id;
}

describe('TICKET LF-014: Phase 3 Reading & Listening Migration (0007_phase3_reading_listening.sql)', () => {
  it('1. Verifies tables passages, reading_listening_questions, and reading_listening_attempts exist in D1', async () => {
    const tables = await d1.db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('passages', 'reading_listening_questions', 'reading_listening_attempts')"
      )
      .all<{ name: string }>();

    const names = tables.results.map((r) => r.name);
    expect(names).toContain('passages');
    expect(names).toContain('reading_listening_questions');
    expect(names).toContain('reading_listening_attempts');
  });

  it('2. Inserts passage and questions with relational cascade deletion', async () => {
    d1.exec(
      `INSERT INTO passages (id, exam_type, section, task_type, title, text_content, audio_url, duration_seconds, word_count, metadata_json, created_at)
       VALUES ('pas_01', 'pte_academic', 'reading', 'pte_fill_in_blanks', 'Ecosystem Dynamics', 'Forest ecosystems depend on biodiversity to flourish.', NULL, NULL, 58, '{}', '2026-11-01T00:00:00Z')`
    );

    d1.exec(
      `INSERT INTO reading_listening_questions (id, passage_id, question_number, question_type, prompt, options_json, correct_answer_json, explanation, points, created_at)
       VALUES ('rlq_01', 'pas_01', 1, 'fib_dropdown', 'Select the best fit for blank 1', '["biodiversity","pollution","degradation"]', '"biodiversity"', 'Biodiversity is essential for ecological stability.', 1, '2026-11-01T00:00:00Z')`
    );

    const q = await d1.db.prepare('SELECT * FROM reading_listening_questions WHERE id = ?').bind('rlq_01').first<any>();
    expect(q).not.toBeNull();
    expect(q.prompt).toContain('blank 1');

    // Verify cascade deletion
    d1.exec('DELETE FROM passages WHERE id = ?', ['pas_01']);
    const qAfter = await d1.db.prepare('SELECT * FROM reading_listening_questions WHERE id = ?').bind('rlq_01').first();
    expect(qAfter).toBeNull();
  });

  it('3. Records a reading attempt with "LexiFlow estimate" validation', async () => {
    const userId = seedUser();

    d1.exec(
      `INSERT INTO passages (id, exam_type, section, task_type, title, text_content, word_count, created_at)
       VALUES ('pas_ielts_01', 'ielts_academic', 'reading', 'ielts_true_false_not_given', 'Urban Heat Islands', 'Cities absorb heat.', 250, '2026-11-01T00:00:00Z')`
    );

    d1.exec(
      `INSERT INTO reading_listening_attempts (id, user_id, passage_id, exam_type, section, task_type, raw_score, max_score, scaled_score, time_spent_seconds, is_estimate, raw_responses_json, item_results_json, taxonomy_codes_json, created_at)
       VALUES ('rla_01', ?1, 'pas_ielts_01', 'ielts_academic', 'reading', 'ielts_true_false_not_given', 4.0, 5.0, 7.5, 320, 1, '{"q1":"TRUE"}', '[]', '["IELTS.READING_TF_CONFUSION"]', '2026-11-01T00:05:00Z')`,
      [userId]
    );

    const attempt = await d1.db.prepare('SELECT * FROM reading_listening_attempts WHERE id = ?').bind('rla_01').first<any>();
    expect(attempt).not.toBeNull();
    expect(attempt.is_estimate).toBe(1);
    expect(attempt.scaled_score).toBe(7.5);
  });
});
