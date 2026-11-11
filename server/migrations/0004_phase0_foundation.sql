-- Phase 0 Foundation Schema: Staged Entity Architecture
-- Migration: 0004_phase0_foundation.sql
-- Entities: LearnerProfile, ExamProfile, ErrorTaxonomy, ErrorOccurrence, MistakeMemory, ReviewSchedule, UsageRecord

-- 1. Learner Profile (Onboarding target, exam date, mother tongue)
CREATE TABLE IF NOT EXISTS learner_profiles (
  user_id            TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  target_exam        TEXT NOT NULL CHECK (target_exam IN ('pte_academic', 'ielts_academic')),
  target_score       TEXT NOT NULL,
  target_exam_date   TEXT,                         -- ISO-8601 date string 'YYYY-MM-DD'
  mother_tongue      TEXT NOT NULL DEFAULT 'bn',   -- ISO 639-1 ('bn' = Bengali)
  study_hours_weekly INTEGER NOT NULL DEFAULT 10,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_learner_profiles_exam ON learner_profiles(target_exam);

-- 2. Exam Profile (Active exam settings & diagnostics)
CREATE TABLE IF NOT EXISTS exam_profiles (
  id                 TEXT PRIMARY KEY,
  user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exam_type          TEXT NOT NULL CHECK (exam_type IN ('pte_academic', 'ielts_academic')),
  diagnostic_score   TEXT,
  weak_categories    TEXT,                         -- JSON array of categories (e.g. '["GRA", "VOC"]')
  settings_json      TEXT,                         -- Exam-specific preferences (timer mode, font size)
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  UNIQUE(user_id, exam_type)
);
CREATE INDEX IF NOT EXISTS idx_exam_profiles_user ON exam_profiles(user_id);

-- 3. Error Taxonomy (Versioned catalog of high-frequency language errors)
CREATE TABLE IF NOT EXISTS error_taxonomies (
  code               TEXT NOT NULL,                -- e.g. 'GRA.SUBJ_VERB_AGR'
  version            TEXT NOT NULL,                -- e.g. '1.0.0'
  category           TEXT NOT NULL,                -- e.g. 'GRA', 'VOC', 'MEC', 'PTE', 'IELTS'
  name               TEXT NOT NULL,
  definition         TEXT NOT NULL,
  severity           TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  incorrect_example  TEXT,
  correct_example    TEXT,
  created_at         TEXT NOT NULL,
  PRIMARY KEY (code, version)
);
CREATE INDEX IF NOT EXISTS idx_error_taxonomies_cat ON error_taxonomies(category);

-- 4. Error Occurrences (Instances detected in learner submissions)
CREATE TABLE IF NOT EXISTS error_occurrences (
  id                 TEXT PRIMARY KEY,             -- 'occ_' + random
  user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  error_code         TEXT NOT NULL,
  taxonomy_version   TEXT NOT NULL,
  task_id            TEXT NOT NULL,                -- e.g. 'ielts_writing_task_2' or 'pte_write_essay'
  evidence_text      TEXT NOT NULL,                -- snippet containing the error
  corrected_text     TEXT,                         -- AI suggested correction
  context_snippet    TEXT,                         -- surrounding sentence or paragraph
  detected_by_model  TEXT NOT NULL,
  created_at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_error_occurrences_user ON error_occurrences(user_id);
CREATE INDEX IF NOT EXISTS idx_error_occurrences_code ON error_occurrences(error_code);

-- 5. Mistake Memory (Core mastery state machine)
CREATE TABLE IF NOT EXISTS mistake_memories (
  id                     TEXT PRIMARY KEY,         -- 'mm_' + random
  user_id                TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  error_code             TEXT NOT NULL,
  mastery_state          TEXT NOT NULL CHECK (mastery_state IN ('New', 'Practising', 'Improving', 'Mastered', 'Reopened')),
  total_occurrences      INTEGER NOT NULL DEFAULT 1,
  successful_corrections INTEGER NOT NULL DEFAULT 0,
  last_seen_at           TEXT NOT NULL,
  mastered_at            TEXT,
  created_at             TEXT NOT NULL,
  updated_at             TEXT NOT NULL,
  UNIQUE(user_id, error_code)
);
CREATE INDEX IF NOT EXISTS idx_mistake_memories_user_state ON mistake_memories(user_id, mastery_state);

-- 6. Review Schedules (FSRS Spaced Repetition 1/3/7/21 days)
CREATE TABLE IF NOT EXISTS review_schedules (
  id                 TEXT PRIMARY KEY,             -- 'rev_' + random
  mistake_memory_id  TEXT NOT NULL REFERENCES mistake_memories(id) ON DELETE CASCADE,
  user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  due_date           TEXT NOT NULL,                -- 'YYYY-MM-DD'
  interval_days      INTEGER NOT NULL DEFAULT 1,
  stability          REAL NOT NULL DEFAULT 1.0,
  difficulty         REAL NOT NULL DEFAULT 5.0,
  retrievability     REAL NOT NULL DEFAULT 1.0,
  repetitions        INTEGER NOT NULL DEFAULT 0,
  last_reviewed_at   TEXT,
  created_at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_review_schedules_due ON review_schedules(user_id, due_date);

-- 7. Usage Records (AI Token & Cost Audit Trail)
CREATE TABLE IF NOT EXISTS usage_records (
  id                 TEXT PRIMARY KEY,             -- 'rec_' + random
  user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id            TEXT,
  provider           TEXT NOT NULL,                -- 'gemini', 'anthropic', 'openai', 'ollama'
  model              TEXT NOT NULL,                -- e.g. 'gemini-2.5-flash'
  prompt_tokens      INTEGER NOT NULL DEFAULT 0,
  completion_tokens  INTEGER NOT NULL DEFAULT 0,
  total_tokens       INTEGER NOT NULL DEFAULT 0,
  estimated_cost_usd REAL NOT NULL DEFAULT 0.0,
  prompt_version     TEXT NOT NULL,
  rubric_version     TEXT NOT NULL,
  taxonomy_version   TEXT NOT NULL,
  latency_ms         INTEGER,
  status             TEXT NOT NULL CHECK (status IN ('success', 'uncertain', 'failed')),
  created_at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_usage_records_user_time ON usage_records(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_usage_records_provider ON usage_records(provider, model);
