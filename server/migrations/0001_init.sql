-- Initial schema for LexiFlow Cloud (CLOUD_BACKEND_DESIGN.md §8).
-- Timestamps are ISO-8601 UTC strings; usage days are Asia/Dhaka calendar days.

CREATE TABLE users (
  id               TEXT PRIMARY KEY,                -- 'usr_' + random
  google_sub       TEXT UNIQUE NOT NULL,
  email            TEXT NOT NULL,
  name             TEXT,
  plan             TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  plan_expires_at  TEXT,                            -- NULL = no expiry
  created_at       TEXT NOT NULL,
  signup_ip_hash   TEXT
);

CREATE TABLE refresh_tokens (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT UNIQUE NOT NULL,               -- SHA-256 of the opaque token
  family_id    TEXT NOT NULL,                      -- rotation family, for reuse detection
  expires_at   TEXT NOT NULL,
  revoked_at   TEXT
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_family ON refresh_tokens(family_id);

CREATE TABLE usage_daily (
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day           TEXT NOT NULL,                     -- 'YYYY-MM-DD' (Asia/Dhaka)
  credits_used  INTEGER NOT NULL DEFAULT 0 CHECK (credits_used >= 0),
  PRIMARY KEY (user_id, day)
);

-- Analytics only: never store the user's text here.
CREATE TABLE usage_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL,
  credits     INTEGER NOT NULL,
  cached      INTEGER NOT NULL,
  tokens_in   INTEGER,
  tokens_out  INTEGER,
  latency_ms  INTEGER,
  status      TEXT NOT NULL CHECK (status IN ('ok', 'refunded', 'rejected')),
  created_at  TEXT NOT NULL
);
CREATE INDEX idx_usage_events_user_time ON usage_events(user_id, created_at);
