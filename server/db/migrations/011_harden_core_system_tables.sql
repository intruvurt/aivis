CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE analysis_cache ADD COLUMN IF NOT EXISTS raw_url TEXT;
ALTER TABLE analysis_cache ADD COLUMN IF NOT EXISTS url_hash TEXT;
ALTER TABLE analysis_cache ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'fresh';
ALTER TABLE analysis_cache ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE analysis_cache ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ;
ALTER TABLE analysis_cache ADD COLUMN IF NOT EXISTS invalidated_at TIMESTAMPTZ;
ALTER TABLE analysis_cache ADD COLUMN IF NOT EXISTS hit_count INTEGER DEFAULT 0;
UPDATE analysis_cache SET raw_url = COALESCE(raw_url, url) WHERE raw_url IS NULL;
UPDATE analysis_cache SET analyzed_at = COALESCE(analyzed_at, created_at, NOW()) WHERE analyzed_at IS NULL;
UPDATE analysis_cache
SET url_hash = encode(digest(COALESCE(url, raw_url), 'sha256'), 'hex')
WHERE url_hash IS NULL AND COALESCE(url, raw_url) IS NOT NULL;
UPDATE analysis_cache
SET expires_at = COALESCE(expires_at, analyzed_at + INTERVAL '7 days', NOW() + INTERVAL '7 days')
WHERE expires_at IS NULL;
UPDATE analysis_cache
SET status = CASE
  WHEN invalidated_at IS NOT NULL THEN 'invalidated'
  WHEN expires_at <= NOW() THEN 'expired'
  WHEN analyzed_at <= NOW() - INTERVAL '1 day' THEN 'stale'
  ELSE COALESCE(status, 'fresh')
END;
ALTER TABLE analysis_cache DROP CONSTRAINT IF EXISTS analysis_cache_url_key;
ALTER TABLE analysis_cache DROP CONSTRAINT IF EXISTS unique_url_hash;
ALTER TABLE analysis_cache DROP CONSTRAINT IF EXISTS analysis_cache_status_check;
ALTER TABLE analysis_cache ADD CONSTRAINT analysis_cache_status_check CHECK (status IN ('fresh', 'stale', 'expired', 'invalidated', 'revalidated'));
ALTER TABLE analysis_cache DROP COLUMN IF EXISTS analyzed_at_timestamp;
CREATE UNIQUE INDEX IF NOT EXISTS idx_analysis_cache_url_hash_unique ON analysis_cache(url_hash);
CREATE INDEX IF NOT EXISTS idx_analysis_cache_status_expires ON analysis_cache(status, expires_at);

DROP INDEX IF EXISTS idx_user_sessions_token;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS session_token_hash VARCHAR(128);
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS session_token_last4 VARCHAR(4);
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT NOW();
UPDATE user_sessions
SET session_token_hash = encode(digest(session_token, 'sha256'), 'hex')
WHERE session_token_hash IS NULL AND session_token IS NOT NULL;
UPDATE user_sessions
SET session_token_last4 = RIGHT(session_token, 4)
WHERE session_token_last4 IS NULL AND session_token IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON user_sessions(session_token_hash);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(user_id, revoked_at, expires_at DESC);

ALTER TABLE usage_daily ADD COLUMN IF NOT EXISTS scan_units NUMERIC(12,2) NOT NULL DEFAULT 1;
ALTER TABLE usage_daily ADD COLUMN IF NOT EXISTS compute_units INTEGER NOT NULL DEFAULT 0;
ALTER TABLE usage_daily ADD COLUMN IF NOT EXISTS entities_extracted INTEGER NOT NULL DEFAULT 0;
ALTER TABLE usage_daily ADD COLUMN IF NOT EXISTS citations_generated INTEGER NOT NULL DEFAULT 0;

ALTER TABLE payments ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS stripe_last_event_id VARCHAR(255);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_last_event_id ON payments(stripe_last_event_id) WHERE stripe_last_event_id IS NOT NULL;

ALTER TABLE audits ADD COLUMN IF NOT EXISTS normalized_url TEXT;
ALTER TABLE audits ADD COLUMN IF NOT EXISTS run_group_id UUID DEFAULT gen_random_uuid();
ALTER TABLE audits ADD COLUMN IF NOT EXISTS prior_run_id UUID REFERENCES audits(id) ON DELETE SET NULL;
ALTER TABLE audits ADD COLUMN IF NOT EXISTS snapshot_kind VARCHAR(20) DEFAULT 'snapshot';
UPDATE audits SET normalized_url = COALESCE(normalized_url, url) WHERE normalized_url IS NULL;
UPDATE audits SET run_group_id = COALESCE(run_group_id, gen_random_uuid()) WHERE run_group_id IS NULL;
UPDATE audits SET snapshot_kind = COALESCE(snapshot_kind, CASE WHEN prior_run_id IS NULL THEN 'snapshot' ELSE 'delta' END) WHERE snapshot_kind IS NULL;
ALTER TABLE audits DROP CONSTRAINT IF EXISTS audits_snapshot_kind_check;
ALTER TABLE audits ADD CONSTRAINT audits_snapshot_kind_check CHECK (snapshot_kind IN ('snapshot', 'delta'));
CREATE INDEX IF NOT EXISTS idx_audits_normalized_url_created ON audits(normalized_url, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audits_run_group_created ON audits(run_group_id, created_at DESC);