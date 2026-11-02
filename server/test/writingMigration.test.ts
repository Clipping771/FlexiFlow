import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestD1, type TestD1 } from './d1';

let d1: TestD1;

beforeEach(async () => {
  d1 = await createTestD1();
});

afterEach(() => {
  d1.close();
});

function seedUser(id = 'usr_writing_test') {
  d1.exec(
    `INSERT INTO users (id, google_sub, email, name, plan, plan_expires_at, created_at)
     VALUES (?1, ?2, 'writer@example.com', 'Writing Student', 'free', NULL, '2026-11-01T00:00:00Z')`,
    [id, `g_${id}`]
  );
  return id;
}

describe('TICKET LF-005: Phase 1 Staged Database Migration (0005_phase1_writing.sql)', () => {
  it('1. Verifies tables questions, responses, evaluations, and content_assets exist in D1', async () => {
    const tables = await d1.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('questions', 'responses', 'evaluations', 'content_assets')")
      .all<{ name: string }>();

    const names = tables.results.map((r) => r.name);
    expect(names).toContain('questions');
    expect(names).toContain('responses');
    expect(names).toContain('evaluations');
    expect(names).toContain('content_assets');
  });

  it('2. Inserts question and response, enforcing exam_type and task_type constraints', async () => {
    const userId = seedUser();

    // Insert valid PTE question
    d1.exec(
      `INSERT INTO questions (id, exam_type, task_type, prompt_text, source, author, reviewer, difficulty, answer_key, content_version, metadata_json, created_at, updated_at)
       VALUES ('q_pte_we_001', 'pte_academic', 'pte_write_essay', 'Do you agree that universities should make physical education compulsory?', 'official_mock_v1', 'editorial_team', 'expert_pte', 'medium', 'Universities should foster holistic development...', '1.0.0', '{"minWords": 200, "maxWords": 300, "strictTimeLimitSeconds": 1200}', '2026-11-01T00:00:00Z', '2026-11-01T00:00:00Z')`
    );

    const question = await d1.db.prepare('SELECT * FROM questions WHERE id = ?').bind('q_pte_we_001').first<any>();
    expect(question).not.toBeNull();
    expect(question.exam_type).toBe('pte_academic');
    expect(question.task_type).toBe('pte_write_essay');

    // Insert valid learner response
    d1.exec(
      `INSERT INTO responses (id, user_id, question_id, exam_type, task_type, response_text, word_count, time_spent_seconds, status, submitted_at, created_at, updated_at)
       VALUES ('resp_001', ?1, 'q_pte_we_001', 'pte_academic', 'pte_write_essay', 'Physical education in higher education remains a subject of debate...', 245, 1050, 'submitted', '2026-11-01T00:18:00Z', '2026-11-01T00:00:00Z', '2026-11-01T00:18:00Z')`,
      [userId]
    );

    const response = await d1.db.prepare('SELECT * FROM responses WHERE id = ?').bind('resp_001').first<any>();
    expect(response).not.toBeNull();
    expect(response.word_count).toBe(245);
    expect(response.status).toBe('submitted');
  });

  it('3. Inserts evaluation with mandatory LexiFlow estimate scoreLabel and foreign key cascade', async () => {
    const userId = seedUser();

    d1.exec(
      `INSERT INTO questions (id, exam_type, task_type, prompt_text, source, author, reviewer, difficulty, answer_key, content_version, metadata_json, created_at, updated_at)
       VALUES ('q_ielts_wt2_001', 'ielts_academic', 'ielts_writing_task_2', 'Some people think environmental problems should be solved globally...', 'cambridge_18', 'author_team', 'ielts_examiner', 'hard', NULL, '1.0.0', '{"minWords": 250}', '2026-11-01T00:00:00Z', '2026-11-01T00:00:00Z')`
    );

    d1.exec(
      `INSERT INTO responses (id, user_id, question_id, exam_type, task_type, response_text, word_count, time_spent_seconds, status, submitted_at, created_at, updated_at)
       VALUES ('resp_ielts_001', ?1, 'q_ielts_wt2_001', 'ielts_academic', 'ielts_writing_task_2', 'Environmental challenges transcend national boundaries...', 280, 2200, 'evaluated', '2026-11-01T00:36:00Z', '2026-11-01T00:00:00Z', '2026-11-01T00:36:00Z')`,
      [userId]
    );

    // Insert Evaluation
    d1.exec(
      `INSERT INTO evaluations (id, response_id, user_id, exam_type, task_type, overall_score, score_label, trait_scores_json, feedback_markdown, error_codes_json, rubric_version, model_used, tokens_used, cost_usd, created_at)
       VALUES ('eval_001', 'resp_ielts_001', ?1, 'ielts_academic', 'ielts_writing_task_2', '7.5', 'LexiFlow estimate', '{"taskAchievement": 7.5, "coherenceCohesion": 7.0, "lexicalResource": 8.0, "grammaticalAccuracy": 7.5}', 'Well structured argument with strong lexical resource.', '["GRA.ART_MISSING", "VOC.COLLOCATION"]', 'ielts_v1', 'claude-3-5-sonnet', 850, 0.0035, '2026-11-01T00:37:00Z')`,
      [userId]
    );

    const evaluation = await d1.db.prepare('SELECT * FROM evaluations WHERE id = ?').bind('eval_001').first<any>();
    expect(evaluation).not.toBeNull();
    expect(evaluation.overall_score).toBe('7.5');
    expect(evaluation.score_label).toBe('LexiFlow estimate');

    // Cascade deletion test: deleting the question cascades to response and evaluation
    d1.exec("DELETE FROM questions WHERE id = 'q_ielts_wt2_001'");

    const respAfter = await d1.db.prepare('SELECT * FROM responses WHERE id = ?').bind('resp_ielts_001').first();
    expect(respAfter).toBeNull();

    const evalAfter = await d1.db.prepare('SELECT * FROM evaluations WHERE id = ?').bind('eval_001').first();
    expect(evalAfter).toBeNull();
  });

  it('4. Content assets table manages IELTS chart images with 90-day retention metadata', async () => {
    d1.exec(
      `INSERT INTO content_assets (id, owner_id, asset_type, mime_type, size_bytes, r2_key, storage_path, retention_days, created_at)
       VALUES ('ca_chart_001', 'system', 'image', 'image/png', 245760, 'charts/ielts_task1_bar_chart_01.png', 'https://r2.lexiflow.app/charts/ielts_task1_bar_chart_01.png', 90, '2026-11-01T00:00:00Z')`
    );

    const asset = await d1.db.prepare('SELECT * FROM content_assets WHERE id = ?').bind('ca_chart_001').first<any>();
    expect(asset).not.toBeNull();
    expect(asset.asset_type).toBe('image');
    expect(asset.retention_days).toBe(90);
  });
});
