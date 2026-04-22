-- Migration: Create audits table
-- Run this on your Neon database

CREATE TABLE IF NOT EXISTS audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  url TEXT NOT NULL,
  normalized_url TEXT,
  run_group_id UUID NOT NULL DEFAULT gen_random_uuid(),
  prior_run_id UUID REFERENCES audits(id) ON DELETE SET NULL,
  snapshot_kind VARCHAR(20) NOT NULL DEFAULT 'snapshot',
  status VARCHAR(20) NOT NULL DEFAULT 'completed',
  visibility_score INTEGER,
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_audits_user_id ON audits(user_id);
CREATE INDEX IF NOT EXISTS idx_audits_status ON audits(status);
CREATE INDEX IF NOT EXISTS idx_audits_created_at ON audits(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audits_user_created ON audits(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audits_normalized_url_created ON audits(normalized_url, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audits_run_group_created ON audits(run_group_id, created_at DESC);
