-- ============================================================
-- AiVIS - Migration 015: Scale hardening and runtime guardrails
-- Purpose: additive, idempotent schema hardening for production safety
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- [1] claim_clusters scale indexes
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_claim_clusters_predicate_subject
  ON claim_clusters (predicate, subject_id);

CREATE INDEX IF NOT EXISTS idx_claim_clusters_created_at_desc
  ON claim_clusters (created_at DESC);

-- ------------------------------------------------------------
-- [2] created_at backfill columns for operational tables
-- ------------------------------------------------------------
ALTER TABLE query_packs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE query_pack_executions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE citation_niche_rankings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE citation_scheduled_jobs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE citation_evidences ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE assistant_usage ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE api_usage_daily ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE api_page_validations ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE user_consents ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE webhooks ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE user_branding ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE report_delivery_targets ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- ------------------------------------------------------------
-- [3] url_hash contract checks across URL-indexed tables
-- ------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT *
    FROM (
      VALUES
        ('analysis_cache', 'chk_analysis_cache_url_hash_format_v2'),
        ('ingestion_jobs', 'chk_ingestion_jobs_url_hash_format_v2'),
        ('crawl_snapshots', 'chk_crawl_snapshots_url_hash_format_v2'),
        ('extracted_entities', 'chk_extracted_entities_url_hash_format_v2'),
        ('analysis_results', 'chk_analysis_results_url_hash_format_v2'),
        ('analysis_runs', 'chk_analysis_runs_url_hash_format_v2'),
        ('citations', 'chk_citations_url_hash_format_v2'),
        ('cloudflare_metrics', 'chk_cloudflare_metrics_url_hash_format_v2')
    ) AS x(table_name, constraint_name)
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = r.table_name AND column_name = 'url_hash'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_schema = 'public' AND table_name = r.table_name AND constraint_name = r.constraint_name
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I CHECK (url_hash ~ ''^[0-9a-f]{64}$'') NOT VALID',
        r.table_name,
        r.constraint_name
      );
      EXECUTE format('ALTER TABLE %I VALIDATE CONSTRAINT %I', r.table_name, r.constraint_name);
    END IF;
  END LOOP;
END
$$;

-- ------------------------------------------------------------
-- [4] canonical tier configuration and user quota cleanup
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tier_config (
  tier TEXT PRIMARY KEY,
  scans_per_month INTEGER NOT NULL CHECK (scans_per_month >= 0),
  model_profile TEXT,
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO tier_config (tier, scans_per_month, model_profile, features)
VALUES
  ('observer', 3, 'free-fallback-chain', '{"reasoning":"single-pass","triple_check":false}'::jsonb),
  ('starter', 15, 'gpt-5-nano', '{"reasoning":"light","triple_check":false}'::jsonb),
  ('alignment', 60, 'gpt-5-nano', '{"reasoning":"deterministic","triple_check":false}'::jsonb),
  ('signal', 110, 'triple-check', '{"reasoning":"peer-validated","triple_check":true}'::jsonb),
  ('scorefix', 0, 'remediation-credit', '{"credits":250,"one_time":true}'::jsonb)
ON CONFLICT (tier) DO UPDATE
SET
  scans_per_month = EXCLUDED.scans_per_month,
  model_profile = EXCLUDED.model_profile,
  features = EXCLUDED.features,
  is_active = TRUE,
  updated_at = NOW();

ALTER TABLE users DROP COLUMN IF EXISTS audits_per_month;

-- ------------------------------------------------------------
-- [5] scans updated_at + deterministic trigger
-- ------------------------------------------------------------
ALTER TABLE scans ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE OR REPLACE FUNCTION set_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_scans_set_updated_at'
  ) THEN
    CREATE TRIGGER trg_scans_set_updated_at
    BEFORE UPDATE ON scans
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_tier_config_set_updated_at'
  ) THEN
    CREATE TRIGGER trg_tier_config_set_updated_at
    BEFORE UPDATE ON tier_config
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at_column();
  END IF;
END
$$;

-- ------------------------------------------------------------
-- [6] normalize licenses timestamps to timestamptz
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'licenses' AND column_name = 'purchase_date' AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE licenses ALTER COLUMN purchase_date TYPE TIMESTAMPTZ USING purchase_date AT TIME ZONE 'UTC';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'licenses' AND column_name = 'created_at' AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE licenses ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'licenses' AND column_name = 'updated_at' AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE licenses ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'license_activations' AND column_name = 'activated_at' AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE license_activations ALTER COLUMN activated_at TYPE TIMESTAMPTZ USING activated_at AT TIME ZONE 'UTC';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'license_activations' AND column_name = 'deactivated_at' AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE license_activations ALTER COLUMN deactivated_at TYPE TIMESTAMPTZ USING deactivated_at AT TIME ZONE 'UTC';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'license_verifications' AND column_name = 'verified_at' AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE license_verifications ALTER COLUMN verified_at TYPE TIMESTAMPTZ USING verified_at AT TIME ZONE 'UTC';
  END IF;
END
$$;

-- ------------------------------------------------------------
-- [7] soft delete support for lifecycle-safe data retention
-- ------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE citations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);
CREATE INDEX IF NOT EXISTS idx_workspaces_deleted_at ON workspaces(deleted_at);
CREATE INDEX IF NOT EXISTS idx_entities_deleted_at ON entities(deleted_at);
CREATE INDEX IF NOT EXISTS idx_claims_deleted_at ON claims(deleted_at);
CREATE INDEX IF NOT EXISTS idx_citations_deleted_at ON citations(deleted_at);

-- ------------------------------------------------------------
-- [8] policy-level RLS isolation on audits by workspace
-- ------------------------------------------------------------
ALTER TABLE audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE audits FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'audits'
      AND policyname = 'audits_workspace_isolation_v1'
  ) THEN
    CREATE POLICY audits_workspace_isolation_v1
      ON audits
      FOR ALL
      USING (
        current_setting('app.workspace_id', true) IS NULL
        OR workspace_id = current_setting('app.workspace_id', true)::uuid
      )
      WITH CHECK (
        current_setting('app.workspace_id', true) IS NULL
        OR workspace_id = current_setting('app.workspace_id', true)::uuid
      );
  END IF;
END
$$;

-- ------------------------------------------------------------
-- [9] cache contract hardening + deterministic cleanup function
-- ------------------------------------------------------------
ALTER TABLE analysis_cache DROP CONSTRAINT IF EXISTS analysis_cache_status_check;
ALTER TABLE analysis_cache DROP CONSTRAINT IF EXISTS analysis_cache_status_check_v1;
ALTER TABLE analysis_cache
  ADD CONSTRAINT analysis_cache_status_check_v1
  CHECK (status IN ('fresh', 'stale', 'expired', 'invalidated', 'revalidated'));

CREATE OR REPLACE FUNCTION cleanup_expired_analysis_cache()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_rows INTEGER := 0;
BEGIN
  DELETE FROM analysis_cache
  WHERE
    status IN ('expired', 'invalidated')
    OR expires_at < NOW() - INTERVAL '7 days';

  GET DIAGNOSTICS deleted_rows = ROW_COUNT;
  RETURN deleted_rows;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF NOT EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'cleanup-analysis-cache'
    ) THEN
      PERFORM cron.schedule(
        'cleanup-analysis-cache',
        '*/30 * * * *',
        $$SELECT cleanup_expired_analysis_cache();$$
      );
    END IF;
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    NULL;
  WHEN insufficient_privilege THEN
    NULL;
END
$$;

COMMIT;
