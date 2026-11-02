import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestD1, type TestD1 } from './d1';

let d1: TestD1;

beforeEach(async () => {
  d1 = await createTestD1();
});

afterEach(() => {
  d1.close();
});

function seedUser(id = 'usr_speaking_test') {
  d1.exec(
    `INSERT INTO users (id, google_sub, email, name, plan, plan_expires_at, created_at)
     VALUES (?1, ?2, 'speaker@example.com', 'Speaking Student', 'free', NULL, '2026-11-01T00:00:00Z')`,
    [id, `g_${id}`]
  );
  return id;
}

describe('TICKET LF-009: Phase 2 Speaking Migration (0006_phase2_speaking.sql)', () => {
  it('1. Verifies tables recordings, transcripts, word_timestamps, and pronunciation_evaluations exist in D1', async () => {
    const tables = await d1.db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('recordings', 'transcripts', 'word_timestamps', 'pronunciation_evaluations')"
      )
      .all<{ name: string }>();

    const names = tables.results.map((r) => r.name);
    expect(names).toContain('recordings');
    expect(names).toContain('transcripts');
    expect(names).toContain('word_timestamps');
    expect(names).toContain('pronunciation_evaluations');
  });

  it('2. Inserts recording with 90-day retention and transcript with word timestamps', async () => {
    const userId = seedUser();

    // Insert recording
    d1.exec(
      `INSERT INTO recordings (id, user_id, task_id, exam_type, audio_format, mime_type, duration_ms, size_bytes, r2_key, storage_url, retention_days, expires_at, created_at)
       VALUES ('rec_pte_ra_001', ?1, 'pte_read_aloud_01', 'pte_academic', 'webm', 'audio/webm', 15400, 128000, 'audio/rec_001.webm', 'https://r2.lexiflow.app/audio/rec_001.webm', 90, '2027-01-30T00:00:00Z', '2026-11-01T00:00:00Z')`,
      [userId]
    );

    const recording = await d1.db.prepare('SELECT * FROM recordings WHERE id = ?').bind('rec_pte_ra_001').first<any>();
    expect(recording).not.toBeNull();
    expect(recording.retention_days).toBe(90);

    // Insert transcript
    d1.exec(
      `INSERT INTO transcripts (id, recording_id, user_id, verbatim_text, confidence, wpm, language, model_used, created_at)
       VALUES ('tr_001', 'rec_pte_ra_001', ?1, 'Modern agricultural practices have significantly increased crop yields.', 0.96, 142.5, 'en', 'deepgram-nova-2', '2026-11-01T00:01:00Z')`,
      [userId]
    );

    const transcript = await d1.db.prepare('SELECT * FROM transcripts WHERE id = ?').bind('tr_001').first<any>();
    expect(transcript).not.toBeNull();
    expect(transcript.wpm).toBe(142.5);

    // Insert word timestamps
    d1.exec(
      `INSERT INTO word_timestamps (id, transcript_id, word_index, word, start_ms, end_ms, confidence, pause_before_ms, created_at)
       VALUES ('wt_001', 'tr_001', 0, 'Modern', 120, 650, 0.98, 120, '2026-11-01T00:01:00Z'),
              ('wt_002', 'tr_001', 1, 'agricultural', 670, 1450, 0.95, 20, '2026-11-01T00:01:00Z')`
    );

    const timestamps = await d1.db.prepare('SELECT * FROM word_timestamps WHERE transcript_id = ? ORDER BY word_index ASC').bind('tr_001').all<any>();
    expect(timestamps.results.length).toBe(2);
    expect(timestamps.results[0].word).toBe('Modern');
  });

  it('3. Inserts pronunciation evaluation and verifies foreign key cascade deletion', async () => {
    const userId = seedUser();

    d1.exec(
      `INSERT INTO recordings (id, user_id, task_id, exam_type, audio_format, mime_type, duration_ms, size_bytes, r2_key, storage_url, retention_days, expires_at, created_at)
       VALUES ('rec_ielts_p2_001', ?1, 'ielts_speaking_part_2', 'ielts_academic', 'webm', 'audio/webm', 115000, 950000, 'audio/rec_p2.webm', 'https://r2.lexiflow.app/audio/rec_p2.webm', 90, '2027-01-30T00:00:00Z', '2026-11-01T00:00:00Z')`,
      [userId]
    );

    d1.exec(
      `INSERT INTO pronunciation_evaluations (id, recording_id, user_id, exam_type, task_type, overall_score, score_label, pronunciation_score, fluency_score, content_score, trait_scores_json, feedback_markdown, phoneme_breakdown_json, error_codes_json, rubric_version, model_used, created_at)
       VALUES ('pe_001', 'rec_ielts_p2_001', ?1, 'ielts_academic', 'ielts_speaking_part_2', '7.5', 'LexiFlow estimate', 7.5, 7.0, 8.0, '{"fluencyCoherence": 7.0, "lexicalResource": 7.5, "grammaticalAccuracy": 7.5, "pronunciation": 7.5}', 'Fluently spoken with clear intonation.', '[]', '["IELTS.FLUENCY_HESITATION"]', 'ielts_speaking_v1', 'gemini-2.0-flash', '2026-11-01T00:02:00Z')`,
      [userId]
    );

    const evaluation = await d1.db.prepare('SELECT * FROM pronunciation_evaluations WHERE id = ?').bind('pe_001').first<any>();
    expect(evaluation).not.toBeNull();
    expect(evaluation.score_label).toBe('LexiFlow estimate');

    // Deleting the recording must cascade to evaluation
    d1.exec("DELETE FROM recordings WHERE id = 'rec_ielts_p2_001'");
    const evalAfter = await d1.db.prepare('SELECT * FROM pronunciation_evaluations WHERE id = ?').bind('pe_001').first();
    expect(evalAfter).toBeNull();
  });
});
