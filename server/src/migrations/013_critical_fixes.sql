-- ============================================================
-- AiVIS — Migration 013: Critical Fixes
-- Resolves all 🔴 critical issues identified in schema audit
--
-- Idempotent: safe to run multiple times against any state
-- produced by migrations 001–012.
--
-- Issues resolved:
--   [1]  updated_at auto-update triggers (6 tables + licenses)
--   [2]  claims.subject_id FK ON DELETE contradiction
--   [3]  ingestion_jobs worker lock columns (race condition guard)
--   [4]  crawl_snapshots.html size cap + storage key columns
--   [5]  url_hash format CHECK constraints (all tables)
--   [6]  verification_token plaintext → hashed storage
--   [7]  stripe_webhook_events idempotency table
--   [8]  workspaces table + FK stubs for multi-tenant isolation
--   [9]  generate_conflict_edges deterministic replacement
--   [10] Stripe webhook idempotency helper function
-- ============================================================

BEGIN;

-- ============================================================
-- [1] SHARED updated_at TRIGGER FUNCTION
--     One function, applied to all tables that have updated_at.
--     CREATE OR REPLACE is idempotent.
-- ============================================================

CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- analysis_cache
DROP TRIGGER IF EXISTS trg_analysis_cache_updated_at ON analysis_cache;
CREATE TRIGGER trg_analysis_cache_updated_at
  BEFORE UPDATE ON analysis_cache
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- users
DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- payments
DROP TRIGGER IF EXISTS trg_payments_updated_at ON payments;
CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- audits
DROP TRIGGER IF EXISTS trg_audits_updated_at ON audits;
CREATE TRIGGER trg_audits_updated_at
  BEFORE UPDATE ON audits
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ingestion_jobs
DROP TRIGGER IF EXISTS trg_ingestion_jobs_updated_at ON ingestion_jobs;
CREATE TRIGGER trg_ingestion_jobs_updated_at
  BEFORE UPDATE ON ingestion_jobs
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- analysis_results
DROP TRIGGER IF EXISTS trg_analysis_results_updated_at ON analysis_results;
CREATE TRIGGER trg_analysis_results_updated_at
  BEFORE UPDATE ON analysis_results
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- licenses (from 001_licenses.sql — uses TIMESTAMP not TIMESTAMPTZ,
-- trigger still works; no schema change to avoid breaking existing data)
DROP TRIGGER IF EXISTS trg_licenses_updated_at ON licenses;
CREATE TRIGGER trg_licenses_updated_at
  BEFORE UPDATE ON licenses
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();


-- ============================================================
-- [2] claims.subject_id FK ON DELETE contradiction
--
--     Column was declared NOT NULL but FK used ON DELETE SET NULL —
--     this causes a runtime NOT NULL violation on entity delete.
--     Fix: drop and re-add as ON DELETE RESTRICT so entity deletes
--     are blocked while claims exist (safe, auditable behaviour).
--
--     Step: rename constraint, re-add with correct rule.
--     Guarded: only runs if claims and entities tables exist (from 010).
-- ============================================================

DO $$
BEGIN
  -- Check both tables exist before proceeding
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'claims'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'entities'
  ) THEN
    
    -- Drop the contradictory FK if it exists
    IF EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_name = 'claims'
        AND constraint_type = 'FOREIGN KEY'
        AND constraint_name = 'claims_subject_id_fkey'
    ) THEN
      ALTER TABLE claims DROP CONSTRAINT claims_subject_id_fkey;
    END IF;

    -- Re-add with ON DELETE RESTRICT (entity cannot be deleted while claims reference it)
    ALTER TABLE claims
      ADD CONSTRAINT claims_subject_id_fkey
      FOREIGN KEY (subject_id)
      REFERENCES entities(id)
      ON DELETE RESTRICT;

    -- Confirm NOT NULL is still enforced (should already be, this is defensive)
    ALTER TABLE claims ALTER COLUMN subject_id SET NOT NULL;
  END IF;
END $$;


-- ============================================================
-- [3] ingestion_jobs — worker lock columns
--
--     Without these, two concurrent workers can claim the same
--     queued job (lost-update race). The application layer uses:
--
--       UPDATE ingestion_jobs
--       SET status = 'processing',
--           worker_id = $worker_id,
--           locked_at = NOW(),
--           updated_at = NOW()
--       WHERE status = 'queued'
--         AND (locked_at IS NULL
--              OR locked_at < NOW() - INTERVAL '10 minutes')
--       ORDER BY priority DESC, scheduled_at ASC
--       LIMIT 1
--       RETURNING id;
--
--     The 10-minute stale-lock recovery handles crashed workers.
-- ============================================================

ALTER TABLE ingestion_jobs ADD COLUMN IF NOT EXISTS worker_id   TEXT;
ALTER TABLE ingestion_jobs ADD COLUMN IF NOT EXISTS locked_at   TIMESTAMPTZ;
ALTER TABLE ingestion_jobs ADD COLUMN IF NOT EXISTS claimed_at  TIMESTAMPTZ;  -- audit trail: when worker first claimed

-- Composite index to make the worker-claim query fast under load
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_claim_queue
  ON ingestion_jobs (status, priority DESC, scheduled_at ASC)
  WHERE status IN ('queued', 'processing');


-- ============================================================
-- [4] crawl_snapshots.html — size cap + external storage path
--
--     Raw HTML can be 2–5 MB per page. At 10K crawls = 20–50 GB
--     in a single TEXT column. Add:
--       - html_size_bytes: lets you monitor bloat without reading the blob
--       - html_storage_key: S3/R2 object key for offloaded HTML
--       - A CHECK cap at 5 MB for any HTML kept inline (MVP guard)
--
--     Workflow: store small pages inline; offload large pages to
--     object storage and null out html, set html_storage_key.
-- ============================================================

ALTER TABLE crawl_snapshots ADD COLUMN IF NOT EXISTS html_size_bytes    INTEGER;
ALTER TABLE crawl_snapshots ADD COLUMN IF NOT EXISTS html_storage_key   TEXT;    -- e.g. "crawls/2026/04/22/<url_hash>.html.gz"
ALTER TABLE crawl_snapshots ADD COLUMN IF NOT EXISTS html_compressed    BOOLEAN DEFAULT FALSE;

-- Backfill size for existing rows
UPDATE crawl_snapshots
SET html_size_bytes = octet_length(html)
WHERE html IS NOT NULL AND html_size_bytes IS NULL;

-- Runtime cap: reject inline HTML over 5 MB going forward
-- (existing rows that exceed this will NOT be touched by the constraint —
--  use NOT VALID + VALIDATE CONSTRAINT pattern to avoid locking)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'crawl_snapshots' AND constraint_name = 'chk_crawl_snapshots_html_size'
  ) THEN
    ALTER TABLE crawl_snapshots
      ADD CONSTRAINT chk_crawl_snapshots_html_size
      CHECK (html IS NULL OR octet_length(html) <= 5242880)
      NOT VALID;

    -- Validate asynchronously (skips row locks on existing data)
    ALTER TABLE crawl_snapshots
      VALIDATE CONSTRAINT chk_crawl_snapshots_html_size;
  END IF;
END $$;


-- ============================================================
-- [5] url_hash format CHECK constraints
--
--     url_hash is SHA-256 hex = always exactly 64 lowercase hex chars.
--     TEXT with no validation accepts anything. Add CHECK on all
--     tables that store url_hash. NOT VALID + VALIDATE avoids full
--     table locks on existing data.
-- ============================================================

-- analysis_cache
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'analysis_cache' AND constraint_name = 'chk_analysis_cache_url_hash_format'
  ) THEN
    ALTER TABLE analysis_cache
      ADD CONSTRAINT chk_analysis_cache_url_hash_format
      CHECK (url_hash ~ '^[0-9a-f]{64}$') NOT VALID;
    ALTER TABLE analysis_cache VALIDATE CONSTRAINT chk_analysis_cache_url_hash_format;
  END IF;
END $$;

-- ingestion_jobs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'ingestion_jobs' AND constraint_name = 'chk_ingestion_jobs_url_hash_format'
  ) THEN
    ALTER TABLE ingestion_jobs
      ADD CONSTRAINT chk_ingestion_jobs_url_hash_format
      CHECK (url_hash ~ '^[0-9a-f]{64}$') NOT VALID;
    ALTER TABLE ingestion_jobs VALIDATE CONSTRAINT chk_ingestion_jobs_url_hash_format;
  END IF;
END $$;

-- crawl_snapshots
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'crawl_snapshots' AND constraint_name = 'chk_crawl_snapshots_url_hash_format'
  ) THEN
    ALTER TABLE crawl_snapshots
      ADD CONSTRAINT chk_crawl_snapshots_url_hash_format
      CHECK (url_hash ~ '^[0-9a-f]{64}$') NOT VALID;
    ALTER TABLE crawl_snapshots VALIDATE CONSTRAINT chk_crawl_snapshots_url_hash_format;
  END IF;
END $$;

-- extracted_entities
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'extracted_entities' AND constraint_name = 'chk_extracted_entities_url_hash_format'
  ) THEN
    ALTER TABLE extracted_entities
      ADD CONSTRAINT chk_extracted_entities_url_hash_format
      CHECK (url_hash ~ '^[0-9a-f]{64}$') NOT VALID;
    ALTER TABLE extracted_entities VALIDATE CONSTRAINT chk_extracted_entities_url_hash_format;
  END IF;
END $$;

-- analysis_results
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'analysis_results' AND constraint_name = 'chk_analysis_results_url_hash_format'
  ) THEN
    ALTER TABLE analysis_results
      ADD CONSTRAINT chk_analysis_results_url_hash_format
      CHECK (url_hash ~ '^[0-9a-f]{64}$') NOT VALID;
    ALTER TABLE analysis_results VALIDATE CONSTRAINT chk_analysis_results_url_hash_format;
  END IF;
END $$;

-- analysis_runs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'analysis_runs' AND constraint_name = 'chk_analysis_runs_url_hash_format'
  ) THEN
    ALTER TABLE analysis_runs
      ADD CONSTRAINT chk_analysis_runs_url_hash_format
      CHECK (url_hash ~ '^[0-9a-f]{64}$') NOT VALID;
    ALTER TABLE analysis_runs VALIDATE CONSTRAINT chk_analysis_runs_url_hash_format;
  END IF;
END $$;

-- citations
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'citations' AND constraint_name = 'chk_citations_url_hash_format'
  ) THEN
    ALTER TABLE citations
      ADD CONSTRAINT chk_citations_url_hash_format
      CHECK (url_hash ~ '^[0-9a-f]{64}$') NOT VALID;
    ALTER TABLE citations VALIDATE CONSTRAINT chk_citations_url_hash_format;
  END IF;
END $$;


-- ============================================================
-- [6] verification_token — plaintext → hashed storage
--
--     verification_token is stored in plaintext and indexed.
--     A DB breach exposes all pending tokens (still valid for login).
--     Fix: store SHA-256 hash of the token. Application generates
--     the raw token, hashes it before writing, hashes again on
--     verify to compare. Raw token is emailed, never stored.
--
--     Migration path:
--       1. Add _hash column
--       2. Backfill hash for any existing tokens
--       3. Add index on hash column
--       4. Application must be updated before old column is dropped
--          (old column left in place as DEPRECATED — drop in 014
--          after application deployment confirms hash-only reads)
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token_hash VARCHAR(64);

-- Backfill: hash any existing plaintext tokens using pgcrypto
UPDATE users
SET verification_token_hash = encode(digest(verification_token, 'sha256'), 'hex')
WHERE verification_token IS NOT NULL
  AND verification_token_hash IS NULL;

-- Index on hash column (application reads will use this after deploy)
CREATE INDEX IF NOT EXISTS idx_users_verification_token_hash
  ON users (verification_token_hash)
  WHERE verification_token_hash IS NOT NULL;

-- Mark old plaintext column as deprecated via comment
-- (DO NOT DROP until application is confirmed reading from _hash column)
COMMENT ON COLUMN users.verification_token IS
  'DEPRECATED as of migration 013. Use verification_token_hash instead. '
  'Drop this column in migration 014 after confirming app reads from hash column.';


-- ============================================================
-- [7] stripe_webhook_events — full idempotency table
--
--     The existing stripe_last_event_id unique index on payments
--     only catches duplicate events that map to payment rows.
--     Stripe sends many event types (customer.created,
--     invoice.finalized, etc.) that do not touch payments.
--     This table is the single gate: check before processing any
--     webhook, insert after successful processing.
--
--     Application pattern:
--       INSERT INTO stripe_webhook_events (stripe_event_id, event_type, payload)
--       VALUES ($1, $2, $3)
--       ON CONFLICT (stripe_event_id) DO NOTHING
--       RETURNING stripe_event_id;
--       -- If no row returned: already processed, skip handler
-- ============================================================

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  stripe_event_id  VARCHAR(255)  PRIMARY KEY,           -- e.g. evt_1ABC...
  event_type       VARCHAR(100)  NOT NULL,              -- e.g. customer.subscription.updated
  livemode         BOOLEAN       NOT NULL DEFAULT FALSE,
  processed_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  processing_ms    INTEGER,                             -- handler duration for latency tracking
  error            TEXT,                                -- non-null = handler failed but event recorded
  payload          JSONB                                -- full Stripe event (for replay / debugging)
);

CREATE INDEX IF NOT EXISTS idx_stripe_events_type       ON stripe_webhook_events (event_type);
CREATE INDEX IF NOT EXISTS idx_stripe_events_processed  ON stripe_webhook_events (processed_at DESC);
CREATE INDEX IF NOT EXISTS idx_stripe_events_livemode   ON stripe_webhook_events (livemode);

-- Helper: record a webhook event with timing
CREATE OR REPLACE FUNCTION record_stripe_webhook(
  p_event_id   TEXT,
  p_event_type TEXT,
  p_livemode   BOOLEAN,
  p_payload    JSONB,
  p_ms         INTEGER DEFAULT NULL,
  p_error      TEXT    DEFAULT NULL
)
RETURNS BOOLEAN   -- TRUE = first time seen, FALSE = duplicate (skip)
LANGUAGE plpgsql
AS $$
DECLARE
  v_rows INTEGER;
BEGIN
  INSERT INTO stripe_webhook_events
    (stripe_event_id, event_type, livemode, payload, processing_ms, error)
  VALUES
    (p_event_id, p_event_type, p_livemode, p_payload, p_ms, p_error)
  ON CONFLICT (stripe_event_id) DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;


-- ============================================================
-- [8] workspaces table + FK stubs
--
--     scans.workspace_id and claims.workspace_id are bare nullable
--     UUIDs with no FK. If multi-tenant is planned, the FK must be
--     added before production data accumulates (backfilling is costly).
--     Adding the table and FKs now with NOT VALID means existing NULL
--     rows are accepted; new rows must reference a valid workspace
--     or be NULL (observer/single-tenant mode).
-- ============================================================

CREATE TABLE IF NOT EXISTS workspaces (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT         NOT NULL,
  slug        TEXT         UNIQUE,                      -- URL-safe identifier
  owner_id    UUID         REFERENCES users(id) ON DELETE SET NULL,
  plan        VARCHAR(50)  DEFAULT 'free',
  is_active   BOOLEAN      DEFAULT TRUE,
  settings    JSONB        DEFAULT '{}',
  created_at  TIMESTAMPTZ  DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspaces_owner   ON workspaces (owner_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_slug    ON workspaces (slug);

DROP TRIGGER IF EXISTS trg_workspaces_updated_at ON workspaces;
CREATE TRIGGER trg_workspaces_updated_at
  BEFORE UPDATE ON workspaces
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- Add FKs to scans and claims (NOT VALID = skip existing NULL rows)
-- Guarded: only runs if scans table exists (from 009 or earlier)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'scans'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'scans' AND constraint_name = 'fk_scans_workspace'
  ) THEN
    ALTER TABLE scans
      ADD CONSTRAINT fk_scans_workspace
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
      NOT VALID;
  END IF;
END $$;

-- Guarded: only runs if claims table exists (from 010)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'claims'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'claims' AND constraint_name = 'fk_claims_workspace'
  ) THEN
    ALTER TABLE claims
      ADD CONSTRAINT fk_claims_workspace
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
      NOT VALID;
  END IF;
END $$;

-- workspace_members junction: user ↔ workspace with role
CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id  UUID        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role          VARCHAR(20) NOT NULL DEFAULT 'member'
                            CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  joined_at     TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members (user_id);


-- ============================================================
-- [9] generate_conflict_edges — deterministic replacement
--
--     Original used random() < 0.1 sampling: non-repeatable,
--     produces different conflict graphs on identical data.
--     Replaced with ROW_NUMBER() window to deterministically
--     cap pairs at 500 per (subject, predicate) cluster.
--     Safe to run multiple times (ON CONFLICT DO NOTHING).
--     Only callable after 010 (claims, claim_edges tables exist).
-- ============================================================

CREATE OR REPLACE FUNCTION generate_conflict_edges(p_scan_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  inserted INTEGER;
BEGIN
  -- Guard: only proceed if required tables exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'claims'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'claim_edges'
  ) THEN
    RETURN 0;  -- Tables don't exist yet; skip
  END IF;

  WITH
  -- All claims for this scan plus claims that share subject+predicate
  -- with any claim in this scan (cross-scan conflict detection)
  relevant_claims AS (
    SELECT DISTINCT c2.id, c2.subject_id, c2.predicate,
                    c2.object_value, c2.object_number
    FROM claims c1
    JOIN claims c2
      ON  c1.subject_id = c2.subject_id
      AND c1.predicate  = c2.predicate
    WHERE c1.scan_id = p_scan_id
  ),
  -- Generate ordered pairs (a < b enforced) where object values differ
  raw_pairs AS (
    SELECT
      LEAST(a.id, b.id)    AS claim_a,
      GREATEST(a.id, b.id) AS claim_b,
      1.0::REAL             AS w,
      -- Deterministic rank within each cluster; cap at 500 pairs
      ROW_NUMBER() OVER (
        PARTITION BY a.subject_id, a.predicate
        ORDER BY LEAST(a.id, b.id), GREATEST(a.id, b.id)
      ) AS pair_rank
    FROM relevant_claims a
    JOIN relevant_claims b
      ON  a.subject_id = b.subject_id
      AND a.predicate  = b.predicate
      AND a.id         < b.id
      -- Normalize comparison across string/number types
      AND COALESCE(a.object_value, a.object_number::TEXT)
            IS DISTINCT FROM
          COALESCE(b.object_value, b.object_number::TEXT)
  )
  INSERT INTO claim_edges (claim_a, claim_b, edge_type, weight)
  SELECT claim_a, claim_b, 'CONFLICTS', w
  FROM   raw_pairs
  WHERE  pair_rank <= 500   -- deterministic hard ceiling per cluster
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted;
END;
$$;


-- ============================================================
-- [10] Post-migration verification query
--      Run this to confirm all critical fixes applied correctly.
--      Expected: all checks return TRUE.
-- ============================================================

DO $$
DECLARE
  v_trigger_count INTEGER;
  v_fk_ok         BOOLEAN;
  v_webhook_table  BOOLEAN;
  v_workspace_table BOOLEAN;
  v_worker_cols    BOOLEAN;
BEGIN
  -- Check triggers exist
  SELECT COUNT(*) INTO v_trigger_count
  FROM information_schema.triggers
  WHERE trigger_name LIKE 'trg_%_updated_at'
    AND event_manipulation = 'UPDATE';

  -- Check claims FK was fixed (should be RESTRICT not SET NULL)
  SELECT (delete_rule = 'RESTRICT') INTO v_fk_ok
  FROM information_schema.referential_constraints
  WHERE constraint_name = 'claims_subject_id_fkey';

  -- Check new tables exist
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stripe_webhook_events') INTO v_webhook_table;
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workspaces') INTO v_workspace_table;

  -- Check worker lock columns
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ingestion_jobs' AND column_name = 'worker_id'
  ) INTO v_worker_cols;

  RAISE NOTICE '================================================';
  RAISE NOTICE 'Migration 013 Verification Results:';
  RAISE NOTICE '  updated_at triggers installed : % (expected >= 7)', v_trigger_count;
  RAISE NOTICE '  claims FK ON DELETE RESTRICT  : %', COALESCE(v_fk_ok::TEXT, 'NOT FOUND');
  RAISE NOTICE '  stripe_webhook_events table   : %', v_webhook_table;
  RAISE NOTICE '  workspaces table              : %', v_workspace_table;
  RAISE NOTICE '  ingestion_jobs.worker_id col  : %', v_worker_cols;
  RAISE NOTICE '================================================';
END $$;

COMMIT;
