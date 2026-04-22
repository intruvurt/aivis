-- Migration 017: AI Answer Simulation Engine tables
-- Creates simulation_runs for AVP tracking and temporal drift analysis.
-- Gracefully handles concurrent deploys via IF NOT EXISTS guards.

-- ── simulation_runs ──────────────────────────────────────────────────────────
-- Stores the aggregate outcome of each AI Answer Simulation Engine run.
-- Full per-query detail is written in-memory during the scan; only the
-- aggregate metrics are persisted here to keep the table compact.

CREATE TABLE IF NOT EXISTS simulation_runs (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID        NOT NULL,
    workspace_id    UUID        REFERENCES workspaces(id) ON DELETE SET NULL,
    url             TEXT        NOT NULL,
    primary_entity  TEXT        NOT NULL,
    scan_id         UUID        NULL,         -- soft reference to analysis_cache.id
    run_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Core AVP metrics
    aggregate_avp   DOUBLE PRECISION NOT NULL DEFAULT 0,  -- 0–1 headline metric
    average_overlap DOUBLE PRECISION NOT NULL DEFAULT 0,  -- 0–1 cross-model overlap
    avp_delta       DOUBLE PRECISION,                     -- NULL on first run
    -- Metadata
    models_used     TEXT[]      NOT NULL DEFAULT '{}',
    query_count     INTEGER     NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure deduplication guard: one run per user+url per minute
CREATE UNIQUE INDEX IF NOT EXISTS simulation_runs_user_url_minute
    ON simulation_runs (user_id, LOWER(url), date_trunc('minute', run_at));

-- Fast lookup by user + url for drift queries
CREATE INDEX IF NOT EXISTS simulation_runs_user_url_idx
    ON simulation_runs (user_id, LOWER(url), run_at DESC);

-- Workspace-scoped queries for agency multi-tenant
CREATE INDEX IF NOT EXISTS simulation_runs_workspace_idx
    ON simulation_runs (workspace_id, run_at DESC)
    WHERE workspace_id IS NOT NULL;

-- ── RLS policy ────────────────────────────────────────────────────────────────
ALTER TABLE simulation_runs ENABLE ROW LEVEL SECURITY;

-- Server uses service-role (RLS bypassed) — these policies guard direct
-- client access via anon key only.
DROP POLICY IF EXISTS simulation_runs_user_select ON simulation_runs;
CREATE POLICY simulation_runs_user_select ON simulation_runs
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS simulation_runs_user_insert ON simulation_runs;
CREATE POLICY simulation_runs_user_insert ON simulation_runs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Retention cleanup function (call from daily cron or scheduler)
CREATE OR REPLACE FUNCTION prune_old_simulation_runs()
    RETURNS bigint
    LANGUAGE plpgsql
    SECURITY DEFINER
AS $$
DECLARE
    deleted bigint;
BEGIN
    DELETE FROM simulation_runs WHERE run_at < NOW() - INTERVAL '1 year';
    GET DIAGNOSTICS deleted = ROW_COUNT;
    RETURN deleted;
END;
$$;
