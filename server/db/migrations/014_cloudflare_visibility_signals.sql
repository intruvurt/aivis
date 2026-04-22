CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS cloudflare_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
  url TEXT NOT NULL,
  url_hash TEXT NOT NULL,
  requests INTEGER NOT NULL DEFAULT 0,
  cached_requests INTEGER NOT NULL DEFAULT 0,
  cache_hit_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
  ai_crawler_hits INTEGER NOT NULL DEFAULT 0,
  human_hits INTEGER NOT NULL DEFAULT 0,
  edge_bytes BIGINT NOT NULL DEFAULT 0,
  origin_bytes BIGINT NOT NULL DEFAULT 0,
  avg_ttfb_ms INTEGER,
  source JSONB NOT NULL DEFAULT '{}'::jsonb,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_cloudflare_metrics_url_hash_format CHECK (url_hash ~ '^[0-9a-f]{64}$')
);

CREATE INDEX IF NOT EXISTS idx_cloudflare_metrics_url_hash_observed
  ON cloudflare_metrics (url_hash, observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_cloudflare_metrics_workspace_observed
  ON cloudflare_metrics (workspace_id, observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_cloudflare_metrics_user_observed
  ON cloudflare_metrics (user_id, observed_at DESC);