-- Phase 3 Reading & Listening Engine Schema: Staged Entity Architecture
-- Migration: 0007_phase3_reading_listening.sql
-- Entities: Passages, ReadingListeningQuestions, ReadingListeningAttempts

-- 1. Passages (Reading texts and Listening prompts/transcripts)
CREATE TABLE IF NOT EXISTS passages (
  id               TEXT PRIMARY KEY,              -- e.g. 'pas_pte_fib_01', 'pas_ielts_r_p1'
  exam_type        TEXT NOT NULL CHECK (exam_type IN ('pte_academic', 'ielts_academic')),
  section          TEXT NOT NULL CHECK (section IN ('reading', 'listening')),
  task_type        TEXT NOT NULL,                 -- e.g. 'pte_fill_in_blanks', 'ielts_matching_headings'
  title            TEXT NOT NULL,
  text_content     TEXT NOT NULL,                 -- Full passage text or transcript
  audio_url        TEXT,                          -- Optional audio prompt URL for listening
  duration_seconds INTEGER,                       -- Optional audio duration
  word_count       INTEGER NOT NULL DEFAULT 0,
  metadata_json    TEXT NOT NULL DEFAULT '{}',
  created_at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_passages_exam_section ON passages(exam_type, section);
CREATE INDEX IF NOT EXISTS idx_passages_task_type ON passages(task_type);

-- 2. Reading & Listening Questions
CREATE TABLE IF NOT EXISTS reading_listening_questions (
  id                  TEXT PRIMARY KEY,           -- e.g. 'rlq_01...'
  passage_id          TEXT NOT NULL REFERENCES passages(id) ON DELETE CASCADE,
  question_number     INTEGER NOT NULL,
  question_type       TEXT NOT NULL,              -- e.g. 'fib_dropdown', 'multiple_choice_single', 'true_false_not_given'
  prompt              TEXT NOT NULL,
  options_json        TEXT NOT NULL DEFAULT '[]', -- JSON array of string options / dropdown items
  correct_answer_json TEXT NOT NULL,              -- JSON string or array of correct answers
  explanation         TEXT NOT NULL,
  points              INTEGER NOT NULL DEFAULT 1,
  created_at          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rl_questions_passage ON reading_listening_questions(passage_id);
CREATE INDEX IF NOT EXISTS idx_rl_questions_order ON reading_listening_questions(passage_id, question_number);

-- 3. Student Attempts & Scoring Evaluations
CREATE TABLE IF NOT EXISTS reading_listening_attempts (
  id                  TEXT PRIMARY KEY,           -- e.g. 'rla_01...'
  user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  passage_id          TEXT NOT NULL REFERENCES passages(id) ON DELETE CASCADE,
  exam_type           TEXT NOT NULL CHECK (exam_type IN ('pte_academic', 'ielts_academic')),
  section             TEXT NOT NULL CHECK (section IN ('reading', 'listening')),
  task_type           TEXT NOT NULL,
  raw_score           REAL NOT NULL,
  max_score           REAL NOT NULL,
  scaled_score        REAL NOT NULL,              -- Scaled score (PTE 10-90 or IELTS 0.0-9.0 band)
  time_spent_seconds  INTEGER NOT NULL DEFAULT 0,
  is_estimate         INTEGER NOT NULL DEFAULT 1 CHECK (is_estimate = 1),
  raw_responses_json  TEXT NOT NULL DEFAULT '{}', -- User's selected answers
  item_results_json   TEXT NOT NULL DEFAULT '[]', -- Question-by-question breakdown
  taxonomy_codes_json TEXT NOT NULL DEFAULT '[]', -- Detected mistake codes (e.g. ['PTE.READING_COLLOCATION_MISMATCH'])
  created_at          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rl_attempts_user ON reading_listening_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_rl_attempts_passage ON reading_listening_attempts(passage_id);
CREATE INDEX IF NOT EXISTS idx_rl_attempts_created ON reading_listening_attempts(created_at);
