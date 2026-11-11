-- Phase 1 Writing Engine Schema: Staged Entity Architecture
-- Migration: 0005_phase1_writing.sql
-- Entities: Question, Response, Evaluation, ContentAsset

-- 1. Questions (Prompt repository with versioning and quality audit trail)
CREATE TABLE IF NOT EXISTS questions (
  id               TEXT PRIMARY KEY,             -- e.g. 'q_pte_we_001', 'q_ielts_wt2_001'
  exam_type        TEXT NOT NULL CHECK (exam_type IN ('pte_academic', 'ielts_academic')),
  task_type        TEXT NOT NULL CHECK (task_type IN ('pte_write_essay', 'pte_summarize_written_text', 'ielts_writing_task_1', 'ielts_writing_task_2')),
  prompt_text      TEXT NOT NULL,
  source           TEXT NOT NULL,                -- e.g. 'official_mock_v1', 'cambridge_ielts_18'
  author           TEXT NOT NULL,
  reviewer         TEXT NOT NULL,
  difficulty       TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  answer_key       TEXT,                         -- Model answer / high-scoring benchmark
  content_version  TEXT NOT NULL DEFAULT '1.0.0',
  metadata_json    TEXT,                         -- JSON object (minWords, maxWords, timeLimitSeconds, chartAssetId)
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_questions_exam_task ON questions(exam_type, task_type);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON questions(difficulty);

-- 2. Responses (Learner writing drafts and final submissions)
CREATE TABLE IF NOT EXISTS responses (
  id                 TEXT PRIMARY KEY,           -- e.g. 'resp_01...'
  user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id        TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  exam_type          TEXT NOT NULL CHECK (exam_type IN ('pte_academic', 'ielts_academic')),
  task_type          TEXT NOT NULL CHECK (task_type IN ('pte_write_essay', 'pte_summarize_written_text', 'ielts_writing_task_1', 'ielts_writing_task_2')),
  response_text      TEXT NOT NULL,
  word_count         INTEGER NOT NULL DEFAULT 0,
  time_spent_seconds INTEGER NOT NULL DEFAULT 0,
  status             TEXT NOT NULL CHECK (status IN ('draft', 'submitted', 'evaluating', 'evaluated', 'error')),
  submitted_at       TEXT,                       -- ISO-8601 timestamp
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_responses_user ON responses(user_id);
CREATE INDEX IF NOT EXISTS idx_responses_question ON responses(question_id);
CREATE INDEX IF NOT EXISTS idx_responses_status ON responses(status);

-- 3. Evaluations (AI & deterministic rubric evaluations with mandatory estimate disclosure)
CREATE TABLE IF NOT EXISTS evaluations (
  id                 TEXT PRIMARY KEY,           -- e.g. 'eval_01...'
  response_id        TEXT NOT NULL REFERENCES responses(id) ON DELETE CASCADE,
  user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exam_type          TEXT NOT NULL CHECK (exam_type IN ('pte_academic', 'ielts_academic')),
  task_type          TEXT NOT NULL CHECK (task_type IN ('pte_write_essay', 'pte_summarize_written_text', 'ielts_writing_task_1', 'ielts_writing_task_2')),
  overall_score      TEXT NOT NULL,              -- e.g. '79' for PTE or '7.5' for IELTS
  score_label        TEXT NOT NULL DEFAULT 'LexiFlow estimate',
  trait_scores_json  TEXT NOT NULL,              -- JSON breakdown of Pearson traits or IELTS criteria
  feedback_markdown  TEXT NOT NULL,              -- Structured feedback text
  error_codes_json   TEXT NOT NULL,              -- JSON array of taxonomy error codes detected
  rubric_version     TEXT NOT NULL,              -- Version of the scoring rubric applied
  model_used         TEXT NOT NULL,              -- LLM identifier or 'deterministic_engine'
  tokens_used        INTEGER NOT NULL DEFAULT 0,
  cost_usd           REAL NOT NULL DEFAULT 0.0,
  created_at         TEXT NOT NULL,
  UNIQUE(response_id)
);
CREATE INDEX IF NOT EXISTS idx_evaluations_user ON evaluations(user_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_response ON evaluations(response_id);

-- 4. Content Assets (Images for IELTS Task 1 charts, diagrams, and question media)
CREATE TABLE IF NOT EXISTS content_assets (
  id                 TEXT PRIMARY KEY,           -- e.g. 'ca_01...'
  owner_id           TEXT NOT NULL,              -- user_id or 'system'
  asset_type         TEXT NOT NULL CHECK (asset_type IN ('image', 'audio', 'document')),
  mime_type          TEXT NOT NULL,
  size_bytes         INTEGER NOT NULL,
  r2_key             TEXT NOT NULL,
  storage_path       TEXT NOT NULL,
  retention_days     INTEGER NOT NULL DEFAULT 90,
  created_at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_content_assets_owner ON content_assets(owner_id);
CREATE INDEX IF NOT EXISTS idx_content_assets_type ON content_assets(asset_type);
