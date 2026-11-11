-- Phase 2 Speaking Engine Schema: Staged Entity Architecture
-- Migration: 0006_phase2_speaking.sql
-- Entities: Recording, Transcript, WordTimestamp, PronunciationEvaluation

-- 1. Recordings (Audio assets with 90-day retention metadata)
CREATE TABLE IF NOT EXISTS recordings (
  id             TEXT PRIMARY KEY,               -- e.g. 'rec_01...'
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id        TEXT NOT NULL,                  -- e.g. 'pte_read_aloud_01', 'ielts_speaking_p2_01'
  exam_type      TEXT NOT NULL CHECK (exam_type IN ('pte_academic', 'ielts_academic')),
  audio_format   TEXT NOT NULL,                  -- e.g. 'webm', 'mp4', 'wav'
  mime_type      TEXT NOT NULL,
  duration_ms    INTEGER NOT NULL,
  size_bytes     INTEGER NOT NULL,
  r2_key         TEXT NOT NULL,
  storage_url    TEXT NOT NULL,
  retention_days INTEGER NOT NULL DEFAULT 90,
  expires_at     TEXT NOT NULL,                  -- ISO-8601 timestamp for auto-deletion
  created_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_recordings_user ON recordings(user_id);
CREATE INDEX IF NOT EXISTS idx_recordings_task ON recordings(task_id);
CREATE INDEX IF NOT EXISTS idx_recordings_expires ON recordings(expires_at);

-- 2. Transcripts (Verbatim speech-to-text outputs)
CREATE TABLE IF NOT EXISTS transcripts (
  id             TEXT PRIMARY KEY,               -- e.g. 'tr_01...'
  recording_id   TEXT NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  verbatim_text  TEXT NOT NULL,
  confidence     REAL NOT NULL DEFAULT 1.0,
  wpm            REAL NOT NULL DEFAULT 0.0,      -- Words Per Minute
  language       TEXT NOT NULL DEFAULT 'en',
  model_used     TEXT NOT NULL,
  created_at     TEXT NOT NULL,
  UNIQUE(recording_id)
);
CREATE INDEX IF NOT EXISTS idx_transcripts_user ON transcripts(user_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_recording ON transcripts(recording_id);

-- 3. Word Timestamps (Granular millisecond-level word timing and pauses)
CREATE TABLE IF NOT EXISTS word_timestamps (
  id               TEXT PRIMARY KEY,             -- e.g. 'wt_01...'
  transcript_id    TEXT NOT NULL REFERENCES transcripts(id) ON DELETE CASCADE,
  word_index       INTEGER NOT NULL,
  word             TEXT NOT NULL,
  start_ms         INTEGER NOT NULL,
  end_ms           INTEGER NOT NULL,
  confidence       REAL NOT NULL DEFAULT 1.0,
  pause_before_ms  INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_word_timestamps_transcript ON word_timestamps(transcript_id);
CREATE INDEX IF NOT EXISTS idx_word_timestamps_order ON word_timestamps(transcript_id, word_index);

-- 4. Pronunciation Evaluations (Acoustic, fluency, and pronunciation scoring)
CREATE TABLE IF NOT EXISTS pronunciation_evaluations (
  id                     TEXT PRIMARY KEY,       -- e.g. 'pe_01...'
  recording_id           TEXT NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
  user_id                TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exam_type              TEXT NOT NULL CHECK (exam_type IN ('pte_academic', 'ielts_academic')),
  task_type              TEXT NOT NULL,
  overall_score          TEXT NOT NULL,          -- e.g. '79' for PTE or '7.5' for IELTS
  score_label            TEXT NOT NULL DEFAULT 'LexiFlow estimate',
  pronunciation_score    REAL NOT NULL,
  fluency_score          REAL NOT NULL,
  content_score          REAL NOT NULL,
  trait_scores_json      TEXT NOT NULL,          -- Trait breakdown
  feedback_markdown      TEXT NOT NULL,
  phoneme_breakdown_json TEXT,                   -- Granular phonemic issue breakdown
  error_codes_json       TEXT NOT NULL,          -- JSON array of taxonomy error codes
  rubric_version         TEXT NOT NULL,
  model_used             TEXT NOT NULL,
  created_at             TEXT NOT NULL,
  UNIQUE(recording_id)
);
CREATE INDEX IF NOT EXISTS idx_pronunciation_evaluations_user ON pronunciation_evaluations(user_id);
CREATE INDEX IF NOT EXISTS idx_pronunciation_evaluations_recording ON pronunciation_evaluations(recording_id);
