-- =============================================================================
-- Supabase Row Level Security (RLS) — defensive setup
-- =============================================================================
--
-- ARCHITECTURE NOTE
-- The Express server connects via DATABASE_URL (Supabase PgBouncer pooler) using
-- the service-role password. Service-role connections bypass RLS entirely, so
-- enabling RLS here has no impact on any existing server-side operations.
--
-- Purpose of this script:
--   1. Enable RLS on all user-data tables (default-deny for anon/authenticated
--      Supabase clients — protects against any future direct DB queries from the
--      browser SDK or public API surface).
--   2. Add explicit service_role bypass policies (belt-and-suspenders — the
--      service role already bypasses RLS by Supabase design, but being explicit
--      makes audits easier).
--   3. Add per-user SELECT/INSERT/UPDATE/DELETE policies on the tables that
--      the browser-side Supabase JS client (client/src/utils/supabase.ts) may
--      query directly in the future.
--
-- HOW TO RUN
--   Open the Supabase dashboard → SQL Editor → paste and run this script.
--   All statements are idempotent (IF NOT EXISTS / OR REPLACE) so re-running is safe.
--
-- =============================================================================

-- ─── 1. Enable RLS on user-data tables ───────────────────────────────────────

ALTER TABLE users                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_daily            ENABLE ROW LEVEL SECURITY;
ALTER TABLE audits                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_cache         ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments               ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_tracking    ENABLE ROW LEVEL SECURITY;
ALTER TABLE citation_tests         ENABLE ROW LEVEL SECURITY;
ALTER TABLE citation_results       ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_mentions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE mention_kpi_snapshots  ENABLE ROW LEVEL SECURITY;
ALTER TABLE serp_snapshots         ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets        ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces             ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members      ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_invites      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_report_links    ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_runs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_score_fix_jobs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE vcs_tokens             ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_clients          ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_tokens           ENABLE ROW LEVEL SECURITY;

-- ─── 2. Service-role bypass (belt-and-suspenders) ────────────────────────────
-- The service role already bypasses RLS by Supabase design. These policies make
-- the intent explicit and visible in the Supabase dashboard policy list.

CREATE POLICY IF NOT EXISTS "service_role_all_users"
  ON users FOR ALL
  USING (current_setting('role') = 'service_role');

CREATE POLICY IF NOT EXISTS "service_role_all_audits"
  ON audits FOR ALL
  USING (current_setting('role') = 'service_role');

-- ─── 3. User-scoped policies for browser SDK access ─────────────────────────
-- These apply when the anon/authenticated Supabase JS client queries directly.
-- The JWT from your own auth system is NOT a Supabase JWT, so auth.uid() will
-- return NULL for your standard users. Enable these policies only when you
-- integrate Supabase Auth or pass user context through the SDK.
--
-- UNCOMMENT when you are ready to allow direct client-side DB access:
--
-- CREATE POLICY IF NOT EXISTS "users_own_row"
--   ON users FOR ALL
--   USING (auth.uid()::text = id::text);
--
-- CREATE POLICY IF NOT EXISTS "audits_own_rows"
--   ON audits FOR ALL
--   USING (auth.uid()::text = user_id::text);
--
-- CREATE POLICY IF NOT EXISTS "usage_daily_own_rows"
--   ON usage_daily FOR ALL
--   USING (auth.uid()::text = user_id::text);
--
-- CREATE POLICY IF NOT EXISTS "support_tickets_own_rows"
--   ON support_tickets FOR ALL
--   USING (auth.uid()::text = user_id::text);

-- ─── 4. Public read-only tables (no user ownership) ─────────────────────────
-- analysis_cache is keyed by URL, not user_id. Allow authenticated reads.
-- The server writes via service role (bypassed), so SELECT-only for clients.
--
-- UNCOMMENT if you want public read access to analysis_cache:
--
-- CREATE POLICY IF NOT EXISTS "analysis_cache_public_read"
--   ON analysis_cache FOR SELECT
--   USING (true);

-- =============================================================================
-- DONE. Verify in Supabase dashboard → Authentication → Policies
-- =============================================================================
