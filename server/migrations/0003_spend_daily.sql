-- Estimated model spend per Asia/Dhaka day and plan, for the free-tier budget kill switch
-- (CLOUD_BACKEND_DESIGN.md §5.4). Kept in D1 rather than KV because increments must be atomic.
CREATE TABLE spend_daily (
  day        TEXT NOT NULL,                         -- 'YYYY-MM-DD' (Asia/Dhaka)
  plan       TEXT NOT NULL CHECK (plan IN ('free', 'pro')),
  micro_usd  INTEGER NOT NULL DEFAULT 0,            -- millionths of a US dollar
  PRIMARY KEY (day, plan)
);

CREATE INDEX idx_usage_events_time ON usage_events(created_at);
