-- Fixed one-minute request windows per user (CLOUD_BACKEND_DESIGN.md §5.2).
-- Old windows are deleted when a user opens a new one, so the table stays small.
CREATE TABLE rate_limits (
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  window_start  INTEGER NOT NULL,                 -- unix seconds, multiple of 60
  count         INTEGER NOT NULL,
  PRIMARY KEY (user_id, window_start)
);
