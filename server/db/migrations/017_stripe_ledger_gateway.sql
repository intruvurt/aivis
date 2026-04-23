-- Migration 017: Stripe idempotent ingestion + immutable credit ledger + reservations

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS stripe_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_events_type_created
  ON stripe_events(type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stripe_events_processed
  ON stripe_events(processed_at DESC);

CREATE TABLE IF NOT EXISTS credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(40) NOT NULL,
  delta NUMERIC(12,2) NOT NULL,
  source VARCHAR(30) NOT NULL,
  request_id TEXT,
  stripe_event_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_ledger_user_created
  ON credit_ledger(user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_ledger_user_request_id
  ON credit_ledger(user_id, request_id)
  WHERE request_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_ledger_stripe_event_id
  ON credit_ledger(stripe_event_id)
  WHERE stripe_event_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS credit_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  request_id TEXT,
  source VARCHAR(30) NOT NULL DEFAULT 'gateway',
  status VARCHAR(20) NOT NULL DEFAULT 'reserved',
  expires_at TIMESTAMPTZ NOT NULL,
  committed_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_reservations_user_status
  ON credit_reservations(user_id, status, expires_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_reservations_user_request_id
  ON credit_reservations(user_id, request_id)
  WHERE request_id IS NOT NULL;
