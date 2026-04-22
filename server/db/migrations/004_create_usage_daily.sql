CREATE TABLE IF NOT EXISTS usage_daily (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  requests INT NOT NULL DEFAULT 0,
  scan_units NUMERIC(12,2) NOT NULL DEFAULT 1,
  compute_units INTEGER NOT NULL DEFAULT 0,
  entities_extracted INTEGER NOT NULL DEFAULT 0,
  citations_generated INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_usage_daily_date ON usage_daily(date);
