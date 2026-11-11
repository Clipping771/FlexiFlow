-- Learner data sync: Mistake Memory (with drill/FSRS state), goals and daily activity,
-- stored as one validated JSON snapshot per user so a learner keeps progress across devices.
-- Migration: 0008_learner_sync.sql
CREATE TABLE IF NOT EXISTS learner_sync (
  user_id        TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  mistakes_json  TEXT NOT NULL DEFAULT '[]',
  goals_json     TEXT,
  activity_json  TEXT NOT NULL DEFAULT '{}',
  updated_at     TEXT NOT NULL
);
