import "dotenv/config";
import pg from "pg";
import type { Pool, PoolClient } from "pg";
import { IS_PRODUCTION } from "../config/runtime.js";

const { Pool: PgPool } = pg;

function normalizeDatabaseUrl(raw: string): string {
  const input = String(raw || "").trim();
  if (!input) return "";

  if (!IS_PRODUCTION) return input;

  // Supabase PgBouncer pooler and managed Postgres services use intermediate CAs.
  // Always use sslmode=require in the connection string; actual verification
  // (rejectUnauthorized) is controlled by DATABASE_CA_CERT env var in getPool().
  if (/sslmode=(prefer|require|verify-ca|verify-full)\b/i.test(input)) {
    return input.replace(/sslmode=(prefer|require|verify-ca|verify-full)\b/i, 'sslmode=require');
  }

  if (!/sslmode=/i.test(input)) {
    const sep = input.includes("?") ? "&" : "?";
    return `${input}${sep}sslmode=require`;
  }

  return input;
}

const DATABASE_URL = normalizeDatabaseUrl(
  process.env.DATABASE_URL?.trim() || "",
);

export const dbConfigured = DATABASE_URL.length > 0;

let poolInstance: Pool | null = null;
let migrationsRan = false;
let databaseAvailable = dbConfigured;
let lastDatabaseError: string | null = dbConfigured
  ? null
  : "DATABASE_URL not configured";
let lastDatabaseErrorTime: number = 0;
const DB_UNAVAILABLE_RETRY_MS = 60_000; // retry DB check after 60s

export function isDatabaseQuotaError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err || "");
  return /exceeded the compute time quota/i.test(message);
}

function shouldRetryDatabaseError(err: unknown): boolean {
  return !isDatabaseQuotaError(err);
}

export function isDatabaseAvailable(): boolean {
  return dbConfigured && databaseAvailable;
}

export function getDatabaseStatus(): {
  configured: boolean;
  available: boolean;
  lastError: string | null;
} {
  return {
    configured: dbConfigured,
    available: isDatabaseAvailable(),
    lastError: lastDatabaseError,
  };
}

function markDatabaseAvailable(): void {
  databaseAvailable = true;
  lastDatabaseError = null;
}

function markDatabaseUnavailable(err: unknown): void {
  databaseAvailable = false;
  lastDatabaseError =
    err instanceof Error
      ? err.message
      : String(err || "Unknown database error");
  lastDatabaseErrorTime = Date.now();
}

export function getPool(): Pool {
  if (!dbConfigured) {
    throw new Error("DATABASE_URL not configured");
  }
  if (!poolInstance) {
    // Strip sslmode/ssl params from URL so pg doesn't override our explicit ssl config
    let connectionString = DATABASE_URL;
    try {
      const u = new URL(DATABASE_URL);
      u.searchParams.delete("sslmode");
      u.searchParams.delete("ssl");
      connectionString = u.toString();
    } catch {
      // If URL parsing fails, use as-is
    }

    const poolConfig: any = {
      connectionString,
      max: 30,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      statement_timeout: 30_000,
    };

    // If CA certificate is provided (Railway/managed Postgres), use it for SSL verification
    const caCert = process.env.DATABASE_CA_CERT || process.env.PG_CA_CERT;
    if (caCert) {
      console.log("[DB SSL] Using CA certificate for connection");
      poolConfig.ssl = {
        rejectUnauthorized: true,
        ca: [caCert],
      };
    } else if (IS_PRODUCTION) {
      console.warn(
        "[DB SSL] No CA certificate provided; connecting with ssl rejectUnauthorized=false (Supabase PgBouncer)",
      );
      poolConfig.ssl = { rejectUnauthorized: false };
    }

    poolInstance = new PgPool(poolConfig);
  }
  return poolInstance;
}

async function runSingleMigration(
  client: PoolClient,
  query: string,
  description?: string,
): Promise<boolean> {
  try {
    await client.query(query);
    if (description) console.log(`  ✓ ${description}`);
    return true;
  } catch (err: any) {
    // Log but don't fail on idempotent operations that already exist
    if (description)
      console.warn(`  ⚠ ${description}: ${err.message.substring(0, 60)}`);
    return false;
  }
}

async function checkDatabaseInitialized(client: PoolClient): Promise<boolean> {
  try {
    const result = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public'
          AND table_name = 'users'
      ) as exists
    `);
    return result.rows[0]?.exists === true;
  } catch {
    return false;
  }
}

export async function runMigrations(): Promise<void> {
  if (migrationsRan || !dbConfigured) return;

  let client: PoolClient | null = null;
  const retriesFromEnv = Number(process.env.DB_MIGRATION_MAX_RETRIES || "");
  const maxRetries =
    Number.isFinite(retriesFromEnv) && retriesFromEnv > 0
      ? Math.floor(retriesFromEnv)
      : 3;
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      client = await getPool().connect();

      // Check if core tables already exist
      const coreTablesExist = await checkDatabaseInitialized(client);
      if (coreTablesExist) {
        // Tables exist, but we still need to run idempotent ALTER/CREATE statements
        // to ensure newer columns and tables added after initial deployment are present.
        // Each statement runs independently so one failure doesn't block the rest.
        {
          const patchStatements = [
            // ── Workspace infrastructure (may be missing if initial DDL batch failed partway) ──
            `CREATE TABLE IF NOT EXISTS organizations (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              name TEXT NOT NULL,
              slug VARCHAR(60) NOT NULL,
              owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              is_personal BOOLEAN NOT NULL DEFAULT FALSE,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              UNIQUE (owner_user_id, slug)
            )`,
            `CREATE TABLE IF NOT EXISTS workspaces (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
              name TEXT NOT NULL,
              slug VARCHAR(60) NOT NULL DEFAULT 'default',
              created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              is_default BOOLEAN NOT NULL DEFAULT FALSE,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              UNIQUE (organization_id, slug)
            )`,
            `CREATE TABLE IF NOT EXISTS workspace_members (
              workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
              user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              role VARCHAR(20) NOT NULL DEFAULT 'member',
              joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              PRIMARY KEY (workspace_id, user_id)
            )`,
            `CREATE TABLE IF NOT EXISTS workspace_invites (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
              email TEXT NOT NULL,
              role VARCHAR(20) NOT NULL DEFAULT 'member',
              token TEXT UNIQUE NOT NULL,
              expires_at TIMESTAMPTZ NOT NULL,
              invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              accepted_at TIMESTAMPTZ,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )`,
            `ALTER TABLE workspace_invites ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES users(id) ON DELETE CASCADE`,
            `CREATE INDEX IF NOT EXISTS idx_workspace_invites_token ON workspace_invites(token)`,
            `CREATE INDEX IF NOT EXISTS idx_workspace_invites_workspace ON workspace_invites(workspace_id)`,
            `CREATE TABLE IF NOT EXISTS public_report_links (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              audit_id UUID NOT NULL UNIQUE REFERENCES audits(id) ON DELETE CASCADE,
              user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
              slug VARCHAR(140) NOT NULL UNIQUE,
              public_token TEXT NOT NULL,
              expires_at TIMESTAMPTZ NOT NULL,
              is_active BOOLEAN NOT NULL DEFAULT TRUE,
              last_accessed_at TIMESTAMPTZ,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )`,
            `CREATE INDEX IF NOT EXISTS idx_public_report_links_slug ON public_report_links(slug)`,
            `CREATE INDEX IF NOT EXISTS idx_public_report_links_workspace ON public_report_links(workspace_id)`,
            `ALTER TABLE audits ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE`,
            `ALTER TABLE audits ADD COLUMN IF NOT EXISTS tier_at_analysis VARCHAR(40)`,
            `CREATE TABLE IF NOT EXISTS github_app_installations (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              user_id VARCHAR(255) NOT NULL,
              workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
              installation_id INTEGER NOT NULL UNIQUE,
              account_login VARCHAR(255) NOT NULL,
              account_type VARCHAR(20) NOT NULL DEFAULT 'User',
              permissions JSONB NOT NULL DEFAULT '{}',
              repo_selection VARCHAR(20) NOT NULL DEFAULT 'all',
              suspended_at TIMESTAMPTZ,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )`,
            `CREATE INDEX IF NOT EXISTS idx_github_app_inst_user ON github_app_installations(user_id)`,
            `CREATE INDEX IF NOT EXISTS idx_github_app_inst_workspace ON github_app_installations(workspace_id)`,
            `CREATE INDEX IF NOT EXISTS idx_github_app_inst_id ON github_app_installations(installation_id)`,
            `CREATE TABLE IF NOT EXISTS workspace_activity_log (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
              user_id UUID REFERENCES users(id) ON DELETE SET NULL,
              type VARCHAR(80) NOT NULL,
              metadata JSONB NOT NULL DEFAULT '{}',
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )`,
            `CREATE INDEX IF NOT EXISTS idx_workspace_activity_ws ON workspace_activity_log(workspace_id, created_at DESC)`,
            `CREATE INDEX IF NOT EXISTS idx_workspace_activity_user ON workspace_activity_log(user_id, created_at DESC)`,
            // ── Support tickets (added post-launch) ──
            `CREATE TABLE IF NOT EXISTS support_tickets (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              ticket_number VARCHAR(16) NOT NULL UNIQUE,
              user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              subject VARCHAR(200) NOT NULL,
              category VARCHAR(32) NOT NULL DEFAULT 'general',
              priority VARCHAR(16) NOT NULL DEFAULT 'normal',
              status VARCHAR(32) NOT NULL DEFAULT 'open',
              description TEXT NOT NULL,
              metadata JSONB DEFAULT '{}',
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              resolved_at TIMESTAMPTZ
            )`,
            `CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets(user_id)`,
            `CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status)`,
            `CREATE INDEX IF NOT EXISTS idx_support_tickets_number ON support_tickets(ticket_number)`,
            `CREATE TABLE IF NOT EXISTS support_ticket_messages (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
              sender_type VARCHAR(16) NOT NULL DEFAULT 'user',
              sender_id UUID,
              message TEXT NOT NULL,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )`,
            `CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON support_ticket_messages(ticket_id)`,
            // ── audits columns for MCP queue processor ──
            `ALTER TABLE audits ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'completed'`,
            `ALTER TABLE audits ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ`,
            `CREATE INDEX IF NOT EXISTS idx_audits_status ON audits(status) WHERE status = 'queued'`,
            // ── Registry Memory: drift score tracking ──
            `ALTER TABLE drift_scores ADD COLUMN IF NOT EXISTS drift_delta NUMERIC`,
            // ── Incremental audit page hashes ──
            `CREATE TABLE IF NOT EXISTS audit_page_hashes (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              domain TEXT NOT NULL,
              path TEXT NOT NULL,
              content_hash VARCHAR(64) NOT NULL,
              change_count INTEGER NOT NULL DEFAULT 0,
              last_checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              last_changed_at TIMESTAMPTZ,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              UNIQUE (domain, path)
            )`,
            `CREATE INDEX IF NOT EXISTS idx_audit_page_hashes_domain ON audit_page_hashes(domain)`,
            // ── Self-healing loop state ──
            `CREATE TABLE IF NOT EXISTS self_healing_preferences (
              user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
              mode VARCHAR(20) NOT NULL DEFAULT 'manual',
              enabled BOOLEAN NOT NULL DEFAULT TRUE,
              drop_threshold NUMERIC(6,2) NOT NULL DEFAULT 10,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )`,
            `CREATE TABLE IF NOT EXISTS self_healing_events (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              domain TEXT NOT NULL,
              before_score NUMERIC(6,2) NOT NULL,
              after_score NUMERIC(6,2) NOT NULL,
              score_drop NUMERIC(6,2) NOT NULL,
              mention_drop NUMERIC(6,4) NOT NULL DEFAULT 0,
              mode VARCHAR(20) NOT NULL,
              status VARCHAR(30) NOT NULL,
              confidence NUMERIC(5,4) NOT NULL DEFAULT 0,
              reason TEXT,
              fix_plan JSONB NOT NULL DEFAULT '{}',
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )`,
            `CREATE INDEX IF NOT EXISTS idx_self_healing_events_user_time ON self_healing_events(user_id, created_at DESC)`,
            // ── Agency portfolio control system ──
            `CREATE TABLE IF NOT EXISTS portfolio_projects (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              organization_name TEXT NOT NULL,
              domain TEXT NOT NULL,
              plan VARCHAR(20) NOT NULL DEFAULT 'observer',
              status VARCHAR(20) NOT NULL DEFAULT 'active',
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              UNIQUE(owner_user_id, domain)
            )`,
            `CREATE INDEX IF NOT EXISTS idx_portfolio_projects_owner ON portfolio_projects(owner_user_id, created_at DESC)`,
            `CREATE TABLE IF NOT EXISTS portfolio_agents (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              project_id UUID NOT NULL REFERENCES portfolio_projects(id) ON DELETE CASCADE,
              agent_type VARCHAR(40) NOT NULL,
              status VARCHAR(20) NOT NULL DEFAULT 'active',
              config JSONB NOT NULL DEFAULT '{}',
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              UNIQUE(project_id, agent_type)
            )`,
            `CREATE INDEX IF NOT EXISTS idx_portfolio_agents_project ON portfolio_agents(project_id)`,
            `CREATE TABLE IF NOT EXISTS portfolio_tasks (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              project_id UUID NOT NULL REFERENCES portfolio_projects(id) ON DELETE CASCADE,
              owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              issue TEXT NOT NULL,
              impact TEXT,
              priority VARCHAR(10) NOT NULL DEFAULT 'medium',
              auto_fixable BOOLEAN NOT NULL DEFAULT FALSE,
              status VARCHAR(20) NOT NULL DEFAULT 'open',
              payload JSONB NOT NULL DEFAULT '{}',
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )`,
            `CREATE INDEX IF NOT EXISTS idx_portfolio_tasks_owner ON portfolio_tasks(owner_user_id, created_at DESC)`,
            // ── Product-led growth engine ──
            `CREATE TABLE IF NOT EXISTS growth_leads (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              domain TEXT NOT NULL,
              source VARCHAR(40) NOT NULL DEFAULT 'manual',
              status VARCHAR(20) NOT NULL DEFAULT 'queued',
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              UNIQUE(owner_user_id, domain)
            )`,
            `CREATE INDEX IF NOT EXISTS idx_growth_leads_owner ON growth_leads(owner_user_id, created_at DESC)`,
            `CREATE TABLE IF NOT EXISTS growth_referrals (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              referral_code VARCHAR(100) NOT NULL,
              converted_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              bonus_credits NUMERIC(12,2) NOT NULL DEFAULT 5,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              UNIQUE(owner_user_id, referral_code, converted_user_id)
            )`,
            `CREATE INDEX IF NOT EXISTS idx_growth_referrals_owner ON growth_referrals(owner_user_id, created_at DESC)`,
            // ── Agent task queue ──
            `CREATE TABLE IF NOT EXISTS agent_tasks (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              task_type VARCHAR(40) NOT NULL,
              payload JSONB NOT NULL DEFAULT '{}',
              status VARCHAR(20) NOT NULL DEFAULT 'pending',
              result JSONB,
              error TEXT,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              started_at TIMESTAMPTZ,
              completed_at TIMESTAMPTZ
            )`,
            `CREATE INDEX IF NOT EXISTS idx_agent_tasks_user ON agent_tasks(user_id)`,
            `CREATE INDEX IF NOT EXISTS idx_agent_tasks_status ON agent_tasks(status) WHERE status = 'pending'`,
            // ── Niche Discovery Jobs (added post-launch) ──
            `CREATE TABLE IF NOT EXISTS niche_discovery_jobs (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              workspace_id UUID NOT NULL,
              query TEXT NOT NULL,
              location TEXT NOT NULL DEFAULT '',
              status VARCHAR(20) NOT NULL DEFAULT 'pending',
              discovered_urls JSONB DEFAULT '[]'::jsonb,
              scheduled_count INTEGER DEFAULT 0,
              audited_count INTEGER DEFAULT 0,
              error TEXT,
              created_at TIMESTAMPTZ DEFAULT NOW(),
              updated_at TIMESTAMPTZ DEFAULT NOW()
            )`,
            `CREATE INDEX IF NOT EXISTS idx_niche_discovery_user ON niche_discovery_jobs(user_id)`,
            // ── Auto Score Fix Jobs (added post-launch) ──
            `CREATE TABLE IF NOT EXISTS auto_score_fix_jobs (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
              audit_id UUID REFERENCES audits(id) ON DELETE SET NULL,
              target_url TEXT NOT NULL,
              vcs_provider VARCHAR(20) NOT NULL DEFAULT 'github',
              repo_owner TEXT NOT NULL,
              repo_name TEXT NOT NULL,
              repo_branch TEXT NOT NULL DEFAULT 'main',
              status VARCHAR(30) NOT NULL DEFAULT 'pending',
              credits_spent NUMERIC(12,2) NOT NULL DEFAULT 10,
              pr_number INTEGER,
              pr_url TEXT,
              pr_title TEXT,
              pr_body TEXT,
              fix_plan JSONB,
              evidence_snapshot JSONB,
              error_message TEXT,
              implementation_duration_minutes INTEGER,
              checks_status VARCHAR(32) NOT NULL DEFAULT 'unknown',
              github_pr_merged_at TIMESTAMPTZ,
              rescan_status VARCHAR(24) NOT NULL DEFAULT 'not_scheduled',
              rescan_scheduled_for TIMESTAMPTZ,
              rescan_started_at TIMESTAMPTZ,
              rescan_completed_at TIMESTAMPTZ,
              rescan_audit_id UUID REFERENCES audits(id) ON DELETE SET NULL,
              score_before NUMERIC(6,2),
              score_after NUMERIC(6,2),
              score_delta NUMERIC(6,2),
              expires_at TIMESTAMPTZ NOT NULL,
              approved_at TIMESTAMPTZ,
              rejected_at TIMESTAMPTZ,
              refund_processed_at TIMESTAMPTZ,
              refund_credits NUMERIC(12,2),
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )`,
            `CREATE INDEX IF NOT EXISTS idx_asf_jobs_user ON auto_score_fix_jobs(user_id, created_at DESC)`,
            `CREATE INDEX IF NOT EXISTS idx_asf_jobs_status ON auto_score_fix_jobs(status)`,
            `CREATE INDEX IF NOT EXISTS idx_asf_jobs_expires ON auto_score_fix_jobs(expires_at) WHERE status IN ('pending_approval', 'pending')`,
            `CREATE INDEX IF NOT EXISTS idx_asf_jobs_workspace ON auto_score_fix_jobs(workspace_id)`,
            `CREATE INDEX IF NOT EXISTS idx_asf_jobs_rescan_status ON auto_score_fix_jobs(rescan_status)`,
            // ── VCS Tokens (added post-launch) ──
            `CREATE TABLE IF NOT EXISTS vcs_tokens (
              user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              provider VARCHAR(20) NOT NULL,
              encrypted_token TEXT NOT NULL,
              token_hint VARCHAR(12) NOT NULL,
              scopes TEXT[],
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              PRIMARY KEY(user_id, provider)
            )`,
            `CREATE INDEX IF NOT EXISTS idx_vcs_tokens_user ON vcs_tokens(user_id)`,
            // ── OAuth 2.0 Tables (added post-launch) ──
            `CREATE TABLE IF NOT EXISTS oauth_clients (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              client_id VARCHAR(64) NOT NULL UNIQUE,
              client_secret_hash VARCHAR(128) NOT NULL,
              user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              name VARCHAR(120) NOT NULL,
              redirect_uris JSONB NOT NULL DEFAULT '[]',
              scopes JSONB NOT NULL DEFAULT '[]',
              enabled BOOLEAN NOT NULL DEFAULT TRUE,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )`,
            `CREATE INDEX IF NOT EXISTS idx_oauth_clients_user ON oauth_clients(user_id)`,
            `CREATE UNIQUE INDEX IF NOT EXISTS idx_oauth_clients_client_id ON oauth_clients(client_id)`,
            `CREATE TABLE IF NOT EXISTS oauth_authorization_codes (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              code_hash VARCHAR(128) NOT NULL,
              client_id VARCHAR(64) NOT NULL,
              user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              redirect_uri TEXT NOT NULL,
              scopes JSONB NOT NULL DEFAULT '[]',
              redeemed BOOLEAN NOT NULL DEFAULT FALSE,
              expires_at TIMESTAMPTZ NOT NULL,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )`,
            `CREATE INDEX IF NOT EXISTS idx_oauth_codes_hash ON oauth_authorization_codes(code_hash)`,
            `CREATE TABLE IF NOT EXISTS oauth_tokens (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              token_hash VARCHAR(128) NOT NULL,
              client_id VARCHAR(64) NOT NULL,
              user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              scopes JSONB NOT NULL DEFAULT '[]',
              revoked BOOLEAN NOT NULL DEFAULT FALSE,
              expires_at TIMESTAMPTZ NOT NULL,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )`,
            `CREATE INDEX IF NOT EXISTS idx_oauth_tokens_hash ON oauth_tokens(token_hash)`,
            `CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user ON oauth_tokens(user_id)`,
            // ── Visibility Snapshots (added post-launch) ──
            `CREATE TABLE IF NOT EXISTS visibility_snapshots (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              prompt TEXT NOT NULL,
              engine VARCHAR(64) NOT NULL,
              brand_found BOOLEAN NOT NULL DEFAULT FALSE,
              position INT,
              cited_urls TEXT[],
              competitors TEXT[],
              sentiment VARCHAR(32),
              raw_text TEXT,
              captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )`,
            `CREATE INDEX IF NOT EXISTS idx_vs_engine_time ON visibility_snapshots(engine, captured_at DESC)`,
            `CREATE INDEX IF NOT EXISTS idx_vs_brand_time ON visibility_snapshots(brand_found, captured_at DESC)`,
            `CREATE INDEX IF NOT EXISTS idx_vs_captured ON visibility_snapshots(captured_at DESC)`,
            // ── Fixpack Status (added post-launch) ──
            `CREATE TABLE IF NOT EXISTS fixpack_status (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
              fixpack_id VARCHAR(128) NOT NULL,
              status VARCHAR(20) NOT NULL DEFAULT 'open',
              owner VARCHAR(255),
              started_at TIMESTAMPTZ,
              validated_at TIMESTAMPTZ,
              re_audit_id UUID REFERENCES audits(id) ON DELETE SET NULL,
              blocked_at TIMESTAMPTZ,
              resolved_at TIMESTAMPTZ,
              reopened_at TIMESTAMPTZ,
              blocker_reason TEXT,
              lifecycle_state VARCHAR(32) NOT NULL DEFAULT 'opened',
              verification_status VARCHAR(24) NOT NULL DEFAULT 'not_requested',
              verification_notes TEXT,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              UNIQUE(user_id, audit_id, fixpack_id)
            )`,
            `CREATE INDEX IF NOT EXISTS idx_fixpack_status_user ON fixpack_status(user_id)`,
            `CREATE INDEX IF NOT EXISTS idx_fixpack_status_audit ON fixpack_status(audit_id)`,
            `CREATE INDEX IF NOT EXISTS idx_fixpack_status_lifecycle_state ON fixpack_status(lifecycle_state)`,
            `CREATE INDEX IF NOT EXISTS idx_fixpack_status_status ON fixpack_status(status)`,
            `CREATE INDEX IF NOT EXISTS idx_fixpack_status_verification_status ON fixpack_status(verification_status)`,
            // ── GSC Intelligence Console (added post-launch) ──
            `CREATE TABLE IF NOT EXISTS gsc_connections (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              google_account_email VARCHAR(320) NOT NULL,
              google_sub VARCHAR(255) NOT NULL,
              encrypted_refresh_token TEXT NOT NULL,
              encrypted_access_token TEXT NOT NULL,
              token_expires_at TIMESTAMPTZ,
              is_active BOOLEAN NOT NULL DEFAULT TRUE,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              UNIQUE(user_id, google_sub)
            )`,
            `CREATE INDEX IF NOT EXISTS idx_gsc_connections_user ON gsc_connections(user_id)`,
            `CREATE TABLE IF NOT EXISTS gsc_properties (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              gsc_connection_id UUID NOT NULL REFERENCES gsc_connections(id) ON DELETE CASCADE,
              site_url TEXT NOT NULL,
              permission_level VARCHAR(40) NOT NULL DEFAULT 'siteUnverifiedUser',
              is_selected BOOLEAN NOT NULL DEFAULT FALSE,
              is_active BOOLEAN NOT NULL DEFAULT TRUE,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              UNIQUE(user_id, site_url)
            )`,
            `CREATE INDEX IF NOT EXISTS idx_gsc_properties_user ON gsc_properties(user_id)`,
            `CREATE INDEX IF NOT EXISTS idx_gsc_properties_conn ON gsc_properties(gsc_connection_id)`,
            `CREATE TABLE IF NOT EXISTS gsc_snapshots (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              property_id UUID NOT NULL REFERENCES gsc_properties(id) ON DELETE CASCADE,
              source_mode VARCHAR(20) NOT NULL DEFAULT 'snapshot',
              start_date DATE NOT NULL,
              end_date DATE NOT NULL,
              captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )`,
            `CREATE INDEX IF NOT EXISTS idx_gsc_snapshots_prop ON gsc_snapshots(property_id)`,
            `CREATE TABLE IF NOT EXISTS gsc_snapshots_pages (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              property_id UUID NOT NULL REFERENCES gsc_properties(id) ON DELETE CASCADE,
              start_date DATE NOT NULL,
              end_date DATE NOT NULL,
              page TEXT NOT NULL,
              clicks DOUBLE PRECISION NOT NULL DEFAULT 0,
              impressions DOUBLE PRECISION NOT NULL DEFAULT 0,
              captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )`,
            `CREATE INDEX IF NOT EXISTS idx_gsc_snap_pages_prop ON gsc_snapshots_pages(property_id, start_date, end_date)`,
            `CREATE TABLE IF NOT EXISTS gsc_snapshots_queries (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              property_id UUID NOT NULL REFERENCES gsc_properties(id) ON DELETE CASCADE,
              start_date DATE NOT NULL,
              end_date DATE NOT NULL,
              query TEXT NOT NULL,
              page TEXT NOT NULL,
              clicks DOUBLE PRECISION NOT NULL DEFAULT 0,
              impressions DOUBLE PRECISION NOT NULL DEFAULT 0,
              captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )`,
            `CREATE INDEX IF NOT EXISTS idx_gsc_snap_queries_prop ON gsc_snapshots_queries(property_id, start_date, end_date)`,
            `CREATE TABLE IF NOT EXISTS gsc_tool_runs (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              property_id UUID NOT NULL REFERENCES gsc_properties(id) ON DELETE CASCADE,
              tool_name VARCHAR(64) NOT NULL,
              source_mode VARCHAR(20) NOT NULL DEFAULT 'live_gsc',
              input_args JSONB NOT NULL DEFAULT '{}',
              output_summary JSONB NOT NULL DEFAULT '{}',
              executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )`,
            `CREATE INDEX IF NOT EXISTS idx_gsc_tool_runs_user ON gsc_tool_runs(user_id)`,
            `CREATE INDEX IF NOT EXISTS idx_gsc_tool_runs_prop ON gsc_tool_runs(property_id)`,
            `CREATE TABLE IF NOT EXISTS gsc_evidence_links (
              evidence_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              property_id UUID NOT NULL REFERENCES gsc_properties(id) ON DELETE CASCADE,
              source_type VARCHAR(20) NOT NULL,
              source_ref TEXT NOT NULL,
              payload JSONB NOT NULL DEFAULT '{}',
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )`,
            `CREATE INDEX IF NOT EXISTS idx_gsc_evidence_user ON gsc_evidence_links(user_id)`,
            `CREATE INDEX IF NOT EXISTS idx_gsc_evidence_prop ON gsc_evidence_links(property_id)`,
            `CREATE TABLE IF NOT EXISTS gsc_snapshot_jobs (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              property_id UUID NOT NULL REFERENCES gsc_properties(id) ON DELETE CASCADE,
              status VARCHAR(20) NOT NULL DEFAULT 'pending',
              details JSONB,
              started_at TIMESTAMPTZ,
              finished_at TIMESTAMPTZ,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )`,
            `CREATE INDEX IF NOT EXISTS idx_gsc_snapshot_jobs_user ON gsc_snapshot_jobs(user_id)`,
            // ── SSFR + Deterministic pipeline column reconciliation ──
            // These columns are required by the audit pipeline but were only
            // created inside the full DDL batch (which never runs after first deploy).
            `ALTER TABLE audits ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64)`,
            `CREATE TABLE IF NOT EXISTS audit_evidence (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              audit_run_id UUID,
              url TEXT,
              category VARCHAR(60),
              key VARCHAR(80),
              label VARCHAR(200),
              value_json JSONB,
              source VARCHAR(120),
              selector VARCHAR(255),
              attribute VARCHAR(120),
              status VARCHAR(20) NOT NULL DEFAULT 'present',
              confidence NUMERIC(3,2) DEFAULT 1.0,
              notes_json JSONB DEFAULT '[]'::jsonb,
              created_at TIMESTAMPTZ DEFAULT NOW()
            )`,
            `ALTER TABLE audit_evidence ADD COLUMN IF NOT EXISTS audit_id UUID`,
            `ALTER TABLE audit_evidence ADD COLUMN IF NOT EXISTS family VARCHAR(20)`,
            `ALTER TABLE audit_evidence ADD COLUMN IF NOT EXISTS evidence_key TEXT`,
            `ALTER TABLE audit_evidence ADD COLUMN IF NOT EXISTS value JSONB DEFAULT '{}'`,
            `ALTER TABLE audit_evidence ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'scraper'`,
            `ALTER TABLE audit_evidence ADD COLUMN IF NOT EXISTS confidence NUMERIC(5,2) DEFAULT 1.0`,
            `ALTER TABLE audit_evidence ADD COLUMN IF NOT EXISTS notes JSONB`,
            `ALTER TABLE audit_evidence ADD COLUMN IF NOT EXISTS evidence_id VARCHAR(20)`,
            `ALTER TABLE audit_evidence ADD COLUMN IF NOT EXISTS entity_id TEXT`,
            `ALTER TABLE audit_evidence ALTER COLUMN category DROP NOT NULL`,
            `ALTER TABLE audit_evidence ALTER COLUMN key DROP NOT NULL`,
            `ALTER TABLE audit_evidence ALTER COLUMN label DROP NOT NULL`,
            `CREATE TABLE IF NOT EXISTS audit_rule_results (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              audit_id UUID,
              rule_id VARCHAR(120) NOT NULL,
              family VARCHAR(20),
              passed BOOLEAN NOT NULL DEFAULT FALSE,
              weight NUMERIC(5,2) DEFAULT 1.0,
              score_contribution NUMERIC(5,2) DEFAULT 0,
              is_hard_blocker BOOLEAN NOT NULL DEFAULT FALSE,
              evidence_ids UUID[],
              explanation TEXT,
              created_at TIMESTAMPTZ DEFAULT NOW()
            )`,
            `ALTER TABLE audit_rule_results ADD COLUMN IF NOT EXISTS audit_id UUID`,
            `ALTER TABLE audit_rule_results ADD COLUMN IF NOT EXISTS family VARCHAR(20)`,
            `ALTER TABLE audit_rule_results ADD COLUMN IF NOT EXISTS is_hard_blocker BOOLEAN NOT NULL DEFAULT FALSE`,
            `ALTER TABLE audit_rule_results ADD COLUMN IF NOT EXISTS evidence_ids UUID[]`,
            `ALTER TABLE audit_rule_results ADD COLUMN IF NOT EXISTS score_cap INTEGER`,
            `ALTER TABLE audit_rule_results ADD COLUMN IF NOT EXISTS details JSONB`,
            `ALTER TABLE audit_rule_results ADD COLUMN IF NOT EXISTS title TEXT`,
            `ALTER TABLE audit_rule_results ADD COLUMN IF NOT EXISTS severity VARCHAR(12)`,
            `CREATE TABLE IF NOT EXISTS audit_score_snapshots (
              audit_id UUID PRIMARY KEY,
              user_id UUID NOT NULL,
              url TEXT NOT NULL,
              normalized_url TEXT NOT NULL,
              visibility_score NUMERIC(6,2) NOT NULL,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )`,
            `ALTER TABLE audit_score_snapshots ADD COLUMN IF NOT EXISTS prior_run_id UUID`,
            `ALTER TABLE audit_score_snapshots ADD COLUMN IF NOT EXISTS workspace_id UUID`,
            `ALTER TABLE audit_score_snapshots ADD COLUMN IF NOT EXISTS execution_class VARCHAR(40)`,
            `ALTER TABLE audit_score_snapshots ADD COLUMN IF NOT EXISTS information_gain VARCHAR(20)`,
            `ALTER TABLE audit_score_snapshots ADD COLUMN IF NOT EXISTS contradiction_status VARCHAR(20)`,
            `ALTER TABLE audit_score_snapshots ADD COLUMN IF NOT EXISTS blocker_count INTEGER NOT NULL DEFAULT 0`,
            `ALTER TABLE audit_score_snapshots ADD COLUMN IF NOT EXISTS geo_signal_profile JSONB`,
            `ALTER TABLE audit_score_snapshots ADD COLUMN IF NOT EXISTS contradiction_report JSONB`,
            `ALTER TABLE audit_score_snapshots ADD COLUMN IF NOT EXISTS family_scores JSONB`,
            `ALTER TABLE audit_score_snapshots ADD COLUMN IF NOT EXISTS final_score NUMERIC(6,2)`,
            `ALTER TABLE audit_score_snapshots ADD COLUMN IF NOT EXISTS score_cap INTEGER`,
            `ALTER TABLE audit_score_snapshots ADD COLUMN IF NOT EXISTS score_version VARCHAR(20)`,
            `ALTER TABLE audit_score_snapshots ADD COLUMN IF NOT EXISTS framework_detected VARCHAR(60)`,
            `ALTER TABLE audit_score_snapshots ADD COLUMN IF NOT EXISTS crawlability_score NUMERIC(5,2)`,
            `ALTER TABLE audit_score_snapshots ADD COLUMN IF NOT EXISTS indexability_score NUMERIC(5,2)`,
            `ALTER TABLE audit_score_snapshots ADD COLUMN IF NOT EXISTS renderability_score NUMERIC(5,2)`,
            `ALTER TABLE audit_score_snapshots ADD COLUMN IF NOT EXISTS metadata_score NUMERIC(5,2)`,
            `ALTER TABLE audit_score_snapshots ADD COLUMN IF NOT EXISTS schema_score NUMERIC(5,2)`,
            `ALTER TABLE audit_score_snapshots ADD COLUMN IF NOT EXISTS entity_score NUMERIC(5,2)`,
            `ALTER TABLE audit_score_snapshots ADD COLUMN IF NOT EXISTS content_score NUMERIC(5,2)`,
            `ALTER TABLE audit_score_snapshots ADD COLUMN IF NOT EXISTS citation_score NUMERIC(5,2)`,
            `ALTER TABLE audit_score_snapshots ADD COLUMN IF NOT EXISTS trust_score NUMERIC(5,2)`,

            // ── Ensure audit_score_snapshots has pkey (may be missing after restore) ──
            // Dedup first: keep the row with the latest created_at per audit_id before
            // adding the constraint to avoid "could not create unique index" failures.
            `DO $$ BEGIN
              IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conrelid = 'audit_score_snapshots'::regclass AND contype = 'p'
              ) THEN
                -- Remove duplicate audit_id rows (keep the newest by created_at, then ctid)
                DELETE FROM audit_score_snapshots a
                  USING audit_score_snapshots b
                  WHERE a.audit_id = b.audit_id
                    AND (a.created_at < b.created_at
                         OR (a.created_at = b.created_at AND a.ctid < b.ctid));
                ALTER TABLE audit_score_snapshots ADD PRIMARY KEY (audit_id);
              END IF;
            END $$`,
            // ── V1 Infrastructure Tables (projects, issues, fixes, PRs) ──
            `CREATE TABLE IF NOT EXISTS v1_projects (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              org_id UUID NOT NULL,
              domain TEXT NOT NULL,
              repo_owner TEXT,
              repo_name TEXT,
              repo_installation_id TEXT,
              auto_scan_enabled BOOLEAN NOT NULL DEFAULT FALSE,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )`,
            `ALTER TABLE v1_projects ADD COLUMN IF NOT EXISTS auto_scan_enabled BOOLEAN NOT NULL DEFAULT FALSE`,
            `CREATE INDEX IF NOT EXISTS idx_v1_projects_org ON v1_projects(org_id)`,
            `CREATE UNIQUE INDEX IF NOT EXISTS idx_v1_projects_org_domain ON v1_projects(org_id, domain)`,
            `CREATE TABLE IF NOT EXISTS v1_audits (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              project_id UUID REFERENCES v1_projects(id) ON DELETE CASCADE,
              score INT,
              delta INT DEFAULT 0,
              status VARCHAR(20) NOT NULL DEFAULT 'queued',
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )`,
            `CREATE INDEX IF NOT EXISTS idx_v1_audits_project ON v1_audits(project_id, created_at DESC)`,
            `CREATE INDEX IF NOT EXISTS idx_v1_audits_status ON v1_audits(status)`,
            `CREATE TABLE IF NOT EXISTS v1_audit_categories (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              audit_id UUID NOT NULL REFERENCES v1_audits(id) ON DELETE CASCADE,
              name TEXT NOT NULL,
              score INT NOT NULL DEFAULT 0
            )`,
            `CREATE INDEX IF NOT EXISTS idx_v1_audit_categories_audit ON v1_audit_categories(audit_id)`,
            `CREATE TABLE IF NOT EXISTS v1_issues (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              audit_id UUID NOT NULL REFERENCES v1_audits(id) ON DELETE CASCADE,
              severity VARCHAR(20) NOT NULL DEFAULT 'medium',
              title TEXT NOT NULL,
              impact_score INT DEFAULT 0,
              effort VARCHAR(20) DEFAULT 'medium',
              auto_fixable BOOLEAN NOT NULL DEFAULT FALSE,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )`,
            `CREATE INDEX IF NOT EXISTS idx_v1_issues_audit ON v1_issues(audit_id)`,
            `CREATE INDEX IF NOT EXISTS idx_v1_issues_severity ON v1_issues(severity)`,
            `CREATE TABLE IF NOT EXISTS v1_evidence (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              issue_id UUID NOT NULL REFERENCES v1_issues(id) ON DELETE CASCADE,
              url TEXT,
              message TEXT,
              raw JSONB DEFAULT '{}'
            )`,
            `CREATE INDEX IF NOT EXISTS idx_v1_evidence_issue ON v1_evidence(issue_id)`,
            `CREATE TABLE IF NOT EXISTS v1_fixes (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              issue_id UUID NOT NULL REFERENCES v1_issues(id) ON DELETE CASCADE,
              status VARCHAR(30) NOT NULL DEFAULT 'pending',
              expected_delta INT DEFAULT 0,
              actual_delta INT,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )`,
            `CREATE INDEX IF NOT EXISTS idx_v1_fixes_issue ON v1_fixes(issue_id)`,
            `CREATE INDEX IF NOT EXISTS idx_v1_fixes_status ON v1_fixes(status)`,
            `CREATE TABLE IF NOT EXISTS v1_pull_requests (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              project_id UUID REFERENCES v1_projects(id) ON DELETE CASCADE,
              fix_id UUID REFERENCES v1_fixes(id) ON DELETE SET NULL,
              pr_url TEXT,
              pr_number INT,
              status VARCHAR(20) NOT NULL DEFAULT 'open',
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )`,
            `CREATE INDEX IF NOT EXISTS idx_v1_prs_project ON v1_pull_requests(project_id)`,
            `CREATE INDEX IF NOT EXISTS idx_v1_prs_status ON v1_pull_requests(status)`,
            // ── Audit score timeline (added post-launch - visibility timeline) ──
            `CREATE TABLE IF NOT EXISTS audit_score_timeline (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              user_id VARCHAR(255) NOT NULL,
              workspace_id UUID,
              url TEXT NOT NULL,
              score NUMERIC(5,2) NOT NULL,
              score_delta NUMERIC(6,2),
              event_type VARCHAR(50) NOT NULL DEFAULT 'manual_audit',
              event_label TEXT,
              audit_id UUID,
              fix_id UUID,
              captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )`,
            `CREATE INDEX IF NOT EXISTS idx_ast_user_url ON audit_score_timeline(user_id, url)`,
            `CREATE INDEX IF NOT EXISTS idx_ast_captured_at ON audit_score_timeline(captured_at DESC)`,
            // ── IndexNow Submissions (added post-launch) ──
            `CREATE TABLE IF NOT EXISTS indexnow_submissions (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              urls JSONB NOT NULL DEFAULT '[]',
              submitted_count INTEGER NOT NULL DEFAULT 0,
              skipped_count INTEGER NOT NULL DEFAULT 0,
              error TEXT,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )`,
            `CREATE INDEX IF NOT EXISTS idx_indexnow_submissions_user ON indexnow_submissions(user_id)`,
            // ── Agent Tasks (added post-launch) ──
            `CREATE TABLE IF NOT EXISTS agent_tasks (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              task_type VARCHAR(60) NOT NULL,
              payload JSONB NOT NULL DEFAULT '{}',
              status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
              result JSONB,
              error TEXT,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              started_at TIMESTAMPTZ,
              completed_at TIMESTAMPTZ
            )`,
            `CREATE INDEX IF NOT EXISTS idx_agent_tasks_user_status ON agent_tasks(user_id, status)`,
            `CREATE INDEX IF NOT EXISTS idx_agent_tasks_pending ON agent_tasks(status, created_at) WHERE status = 'pending'`,
            // ── Partnership agreements (dual-party signing + tamper-lock) ──
            `CREATE TABLE IF NOT EXISTS partnership_agreements (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              slug VARCHAR(120) UNIQUE NOT NULL,
              title VARCHAR(300) NOT NULL,
              terms_html TEXT NOT NULL,
              terms_hash VARCHAR(128) NOT NULL,
              party_a_name VARCHAR(200) NOT NULL,
              party_a_email VARCHAR(320) NOT NULL,
              party_a_phone VARCHAR(40),
              party_a_org VARCHAR(200),
              party_b_name VARCHAR(200) NOT NULL,
              party_b_email VARCHAR(320) NOT NULL,
              party_b_phone VARCHAR(40),
              party_b_org VARCHAR(200),
              status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','partially_signed','fully_signed','expired','revoked')),
              valid_until TIMESTAMPTZ,
              signing_deadline TIMESTAMPTZ NOT NULL,
              party_a_signed_at TIMESTAMPTZ,
              party_a_signature VARCHAR(200),
              party_a_ip INET,
              party_a_ua TEXT,
              party_b_signed_at TIMESTAMPTZ,
              party_b_signature VARCHAR(200),
              party_b_ip INET,
              party_b_ua TEXT,
              locked_at TIMESTAMPTZ,
              locked_hash VARCHAR(128),
              pdf_url TEXT,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )`,
            `CREATE INDEX IF NOT EXISTS idx_agreements_slug ON partnership_agreements(slug)`,
            `CREATE INDEX IF NOT EXISTS idx_agreements_status ON partnership_agreements(status)`,
            // ── Partnership agreements v2: OTP, access token, referral links, reminders ──
            `ALTER TABLE partnership_agreements ADD COLUMN IF NOT EXISTS access_token VARCHAR(64)`,
            `ALTER TABLE partnership_agreements ADD COLUMN IF NOT EXISTS otp_code_hash VARCHAR(128)`,
            `ALTER TABLE partnership_agreements ADD COLUMN IF NOT EXISTS otp_party VARCHAR(1)`,
            `ALTER TABLE partnership_agreements ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMPTZ`,
            `ALTER TABLE partnership_agreements ADD COLUMN IF NOT EXISTS otp_attempts INT DEFAULT 0`,
            `ALTER TABLE partnership_agreements ADD COLUMN IF NOT EXISTS reminders_sent JSONB DEFAULT '[]'`,
            `CREATE TABLE IF NOT EXISTS agreement_referral_links (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              agreement_slug VARCHAR(120) NOT NULL,
              code VARCHAR(20) UNIQUE NOT NULL,
              created_by VARCHAR(200),
              expires_at TIMESTAMPTZ,
              clicks INT DEFAULT 0,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )`,
            `CREATE INDEX IF NOT EXISTS idx_referral_links_code ON agreement_referral_links(code)`,
            `CREATE INDEX IF NOT EXISTS idx_referral_links_slug ON agreement_referral_links(agreement_slug)`,
            `CREATE TABLE IF NOT EXISTS agreement_referral_visits (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              link_code VARCHAR(20) NOT NULL,
              visitor_hash VARCHAR(64),
              referrer TEXT,
              visited_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )`,
            `CREATE INDEX IF NOT EXISTS idx_referral_visits_code ON agreement_referral_visits(link_code)`,

            // Partnership invoices – private PayPal payment tracking for partnership agreements
            `CREATE TABLE IF NOT EXISTS partnership_invoices (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              agreement_slug VARCHAR(120) NOT NULL,
              description TEXT NOT NULL,
              amount_usd DECIMAL(10,2) NOT NULL CHECK (amount_usd > 0),
              status VARCHAR(30) NOT NULL DEFAULT 'pending',
              paypal_order_id VARCHAR(64),
              created_by VARCHAR(320) NOT NULL,
              paid_by_email VARCHAR(320),
              paid_at TIMESTAMPTZ,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )`,
            `CREATE INDEX IF NOT EXISTS idx_partnership_invoices_slug ON partnership_invoices(agreement_slug)`,
            `CREATE INDEX IF NOT EXISTS idx_partnership_invoices_status ON partnership_invoices(status)`,

            // ── Badge embed tracking (dofollow backlink badges) ──
            `CREATE TABLE IF NOT EXISTS badge_events (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              event_type VARCHAR(12) NOT NULL CHECK (event_type IN ('impression','click')),
              badge_owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
              referrer_url TEXT,
              referrer_domain TEXT,
              ip_hash VARCHAR(64),
              user_agent TEXT,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )`,
            `CREATE INDEX IF NOT EXISTS idx_badge_events_type ON badge_events(event_type)`,
            `CREATE INDEX IF NOT EXISTS idx_badge_events_owner ON badge_events(badge_owner_id)`,
            `CREATE INDEX IF NOT EXISTS idx_badge_events_created ON badge_events(created_at)`,

            // ── Fix outcomes (ROI tracking for fix learning) ──
            `CREATE TABLE IF NOT EXISTS fix_outcomes (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              fix_type VARCHAR(40) NOT NULL,
              fix_subtype VARCHAR(60),
              expected_delta NUMERIC(6,2) NOT NULL DEFAULT 0,
              actual_delta NUMERIC(6,2) NOT NULL DEFAULT 0,
              roi_ratio NUMERIC(6,2) NOT NULL DEFAULT 0,
              url TEXT NOT NULL,
              captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )`,
            `CREATE INDEX IF NOT EXISTS idx_fix_outcomes_user ON fix_outcomes(user_id)`,
            `CREATE INDEX IF NOT EXISTS idx_fix_outcomes_type ON fix_outcomes(fix_type)`,
            `CREATE INDEX IF NOT EXISTS idx_fix_outcomes_url ON fix_outcomes(url)`,

            // ── Ensure audits.id has a PRIMARY KEY constraint (may be missing after a
            //    partial init batch or DB restore) — pipeline_runs FKs require it.
            //    First deduplicate any orphan id collisions, then add the constraint. ──
            `DO $$ BEGIN
              IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conrelid = 'audits'::regclass AND contype = 'p'
              ) THEN
                -- Remove duplicate ids (keep the newest row per id)
                DELETE FROM audits a USING audits b
                  WHERE a.id = b.id AND a.ctid < b.ctid;
                ALTER TABLE audits ADD PRIMARY KEY (id);
              END IF;
            END $$`,

            // ── Pipeline runs (self-healing audit pipeline orchestration) ──
            `CREATE TABLE IF NOT EXISTS pipeline_runs (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
              target_url TEXT NOT NULL,
              mode VARCHAR(20) NOT NULL DEFAULT 'advisory',
              status VARCHAR(30) NOT NULL DEFAULT 'pending',
              audit_id UUID REFERENCES audits(id) ON DELETE SET NULL,
              scoring_result JSONB,
              classification_result JSONB,
              fixpacks JSONB DEFAULT '[]'::jsonb,
              rescan_audit_id UUID REFERENCES audits(id) ON DELETE SET NULL,
              rescan_uplift JSONB,
              error_message TEXT,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )`,
            `CREATE INDEX IF NOT EXISTS idx_pipeline_runs_user ON pipeline_runs(user_id, created_at DESC)`,
            `CREATE INDEX IF NOT EXISTS idx_pipeline_runs_status ON pipeline_runs(status)`,
            `CREATE INDEX IF NOT EXISTS idx_pipeline_runs_url ON pipeline_runs(target_url)`,
            // ── Multi-tenant AI citation/mention tracker ──
            `CREATE TABLE IF NOT EXISTS tenants (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              name TEXT NOT NULL DEFAULT 'Personal',
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )`,
            `CREATE TABLE IF NOT EXISTS tenant_users (
              tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
              user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              role VARCHAR(20) NOT NULL DEFAULT 'owner',
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              PRIMARY KEY (tenant_id, user_id)
            )`,
            `CREATE INDEX IF NOT EXISTS idx_tenant_users_user ON tenant_users(user_id)`,
            `CREATE TABLE IF NOT EXISTS tracking_projects (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
              domain TEXT NOT NULL,
              competitor_domains JSONB NOT NULL DEFAULT '[]'::jsonb,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )`,
            `CREATE INDEX IF NOT EXISTS idx_tracking_projects_tenant ON tracking_projects(tenant_id, created_at DESC)`,
            `CREATE TABLE IF NOT EXISTS tracking_queries (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              project_id UUID NOT NULL REFERENCES tracking_projects(id) ON DELETE CASCADE,
              query TEXT NOT NULL,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )`,
            `CREATE INDEX IF NOT EXISTS idx_tracking_queries_project ON tracking_queries(project_id)`,
            `CREATE TABLE IF NOT EXISTS tracking_runs (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              project_id UUID NOT NULL REFERENCES tracking_projects(id) ON DELETE CASCADE,
              status VARCHAR(20) NOT NULL DEFAULT 'queued',
              total_queries INTEGER NOT NULL DEFAULT 0,
              completed_queries INTEGER NOT NULL DEFAULT 0,
              error_message TEXT,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              completed_at TIMESTAMPTZ
            )`,
            `CREATE INDEX IF NOT EXISTS idx_tracking_runs_project ON tracking_runs(project_id, created_at DESC)`,
            `CREATE INDEX IF NOT EXISTS idx_tracking_runs_status ON tracking_runs(status)`,
            `CREATE TABLE IF NOT EXISTS tracking_results (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              run_id UUID NOT NULL REFERENCES tracking_runs(id) ON DELETE CASCADE,
              query_id UUID NOT NULL REFERENCES tracking_queries(id) ON DELETE CASCADE,
              model VARCHAR(80) NOT NULL,
              mentioned BOOLEAN NOT NULL DEFAULT FALSE,
              cited BOOLEAN NOT NULL DEFAULT FALSE,
              position INTEGER,
              raw_response TEXT,
              competitor_mentions JSONB NOT NULL DEFAULT '[]'::jsonb,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )`,
            `CREATE INDEX IF NOT EXISTS idx_tracking_results_run ON tracking_results(run_id)`,
            `CREATE INDEX IF NOT EXISTS idx_tracking_results_query ON tracking_results(query_id)`,
            `CREATE TABLE IF NOT EXISTS tracking_citations (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              result_id UUID NOT NULL REFERENCES tracking_results(id) ON DELETE CASCADE,
              url TEXT NOT NULL,
              domain TEXT NOT NULL,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )`,
            `CREATE INDEX IF NOT EXISTS idx_tracking_citations_result ON tracking_citations(result_id)`,
            `CREATE TABLE IF NOT EXISTS tracking_query_cache (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              query_hash VARCHAR(64) NOT NULL,
              model VARCHAR(80) NOT NULL,
              raw_response TEXT NOT NULL,
              expires_at TIMESTAMPTZ NOT NULL,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              UNIQUE (query_hash, model)
            )`,
            `CREATE INDEX IF NOT EXISTS idx_tracking_qcache_hash ON tracking_query_cache(query_hash, model)`,
            `CREATE INDEX IF NOT EXISTS idx_tracking_qcache_expires ON tracking_query_cache(expires_at)`,
            `CREATE TABLE IF NOT EXISTS competitors (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              domain TEXT UNIQUE NOT NULL,
              first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )`,
            `CREATE INDEX IF NOT EXISTS idx_competitors_domain ON competitors(domain)`,
            `CREATE TABLE IF NOT EXISTS project_competitors (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              project_id UUID NOT NULL REFERENCES tracking_projects(id) ON DELETE CASCADE,
              competitor_id UUID NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
              score FLOAT NOT NULL DEFAULT 0,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              UNIQUE (project_id, competitor_id)
            )`,
            `CREATE INDEX IF NOT EXISTS idx_project_competitors_project ON project_competitors(project_id, score DESC)`,
            `CREATE TABLE IF NOT EXISTS competitor_metrics (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              run_id UUID NOT NULL REFERENCES tracking_runs(id) ON DELETE CASCADE,
              competitor_id UUID NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
              mentions INTEGER NOT NULL DEFAULT 0,
              citations INTEGER NOT NULL DEFAULT 0,
              avg_position FLOAT,
              UNIQUE (run_id, competitor_id)
            )`,
            `CREATE INDEX IF NOT EXISTS idx_competitor_metrics_run ON competitor_metrics(run_id)`,
            `CREATE INDEX IF NOT EXISTS idx_competitor_metrics_competitor ON competitor_metrics(competitor_id)`,
            `CREATE TABLE IF NOT EXISTS entity_snapshots (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              run_id UUID NOT NULL REFERENCES tracking_runs(id) ON DELETE CASCADE,
              query_id UUID NOT NULL REFERENCES tracking_queries(id) ON DELETE CASCADE,
              model TEXT NOT NULL,
              entity_detected BOOLEAN NOT NULL DEFAULT FALSE,
              entity_name TEXT,
              category TEXT,
              description TEXT,
              confidence FLOAT NOT NULL DEFAULT 0,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              UNIQUE (run_id, query_id, model)
            )`,
            `CREATE INDEX IF NOT EXISTS idx_entity_snapshots_run ON entity_snapshots(run_id)`,
            // citation_results additive columns (needed on already-initialized DBs)
            `ALTER TABLE citation_results ADD COLUMN IF NOT EXISTS mention_quality_score SMALLINT`,
            `ALTER TABLE citation_results ADD COLUMN IF NOT EXISTS is_false_positive BOOLEAN`,
            `ALTER TABLE citation_results ALTER COLUMN is_false_positive DROP DEFAULT`,
            `ALTER TABLE citation_tests ADD COLUMN IF NOT EXISTS brand_name TEXT`,
            // ── MentionJuice Score snapshots ──
            `CREATE TABLE IF NOT EXISTS mention_juice_snapshots (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              brand TEXT NOT NULL,
              domain TEXT NOT NULL,
              mention_juice_score FLOAT NOT NULL DEFAULT 0,
              tier VARCHAR(20) NOT NULL DEFAULT 'weak',
              total_mentions INTEGER NOT NULL DEFAULT 0,
              credibility_breakdown JSONB NOT NULL DEFAULT '{}',
              spam_filtered INTEGER NOT NULL DEFAULT 0,
              duplicate_filtered INTEGER NOT NULL DEFAULT 0,
              evidence_ids JSONB NOT NULL DEFAULT '[]',
              computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )`,
            `CREATE INDEX IF NOT EXISTS idx_mjs_user_brand ON mention_juice_snapshots(user_id, brand, computed_at DESC)`,
            // ── CitationRankScore snapshots ──
            `CREATE TABLE IF NOT EXISTS citation_rank_snapshots (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              brand TEXT NOT NULL,
              url TEXT NOT NULL,
              citation_rank_score FLOAT NOT NULL DEFAULT 0,
              model_coverage JSONB NOT NULL DEFAULT '{}',
              evidence_results JSONB NOT NULL DEFAULT '[]',
              queries_tested INTEGER NOT NULL DEFAULT 0,
              models_tested INTEGER NOT NULL DEFAULT 0,
              found_count INTEGER NOT NULL DEFAULT 0,
              computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )`,
            `CREATE INDEX IF NOT EXISTS idx_crs_user_url ON citation_rank_snapshots(user_id, url, computed_at DESC)`,
            // ── Fix: public_report_links.expires_at must allow NULL (permanent links) ──
            `ALTER TABLE public_report_links ALTER COLUMN expires_at DROP NOT NULL`,
            // ── Fix: evidence_ids column type mismatch (UUID[] → JSONB) to match fresh-DB schema ──
            `ALTER TABLE audit_rule_results ALTER COLUMN evidence_ids TYPE JSONB USING COALESCE(to_jsonb(evidence_ids), '[]'::jsonb)`,
            `ALTER TABLE audit_rule_results ALTER COLUMN evidence_ids SET DEFAULT '[]'::jsonb`,
            // ── Fix: alert_subscriptions + alert_notifications missing on existing DBs ──
            `CREATE TABLE IF NOT EXISTS alert_subscriptions (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              user_id VARCHAR(255) NOT NULL,
              channel VARCHAR(20) NOT NULL,
              channel_config JSONB NOT NULL DEFAULT '{}',
              alert_types TEXT[] NOT NULL DEFAULT '{}',
              enabled BOOLEAN NOT NULL DEFAULT TRUE,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              UNIQUE (user_id, channel)
            )`,
            `CREATE INDEX IF NOT EXISTS idx_alert_sub_user ON alert_subscriptions(user_id)`,
            `CREATE TABLE IF NOT EXISTS alert_notifications (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              user_id VARCHAR(255) NOT NULL,
              alert_type VARCHAR(50) NOT NULL,
              title TEXT NOT NULL,
              body TEXT NOT NULL,
              metadata JSONB NOT NULL DEFAULT '{}',
              read_at TIMESTAMPTZ,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )`,
            `CREATE INDEX IF NOT EXISTS idx_alert_notif_user ON alert_notifications(user_id, created_at DESC)`,
            // ── Evidence-first architecture: entities, drift_scores, job_queue_log ──
            `CREATE TABLE IF NOT EXISTS entities (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              domain TEXT,
              user_id UUID REFERENCES users(id) ON DELETE CASCADE,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )`,
            `CREATE INDEX IF NOT EXISTS idx_entities_user ON entities(user_id)`,
            `CREATE INDEX IF NOT EXISTS idx_entities_domain ON entities(domain)`,
            `CREATE TABLE IF NOT EXISTS drift_scores (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
              score INTEGER NOT NULL DEFAULT 0,
              evidence_count INTEGER NOT NULL DEFAULT 0,
              score_source VARCHAR(40) NOT NULL DEFAULT 'evidence',
              drift_delta NUMERIC,
              computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )`,
            `CREATE INDEX IF NOT EXISTS idx_drift_scores_entity ON drift_scores(entity_id, computed_at DESC)`,
            `CREATE TABLE IF NOT EXISTS job_queue_log (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              url TEXT NOT NULL,
              entity_id TEXT REFERENCES entities(id) ON DELETE SET NULL,
              status VARCHAR(20) NOT NULL DEFAULT 'queued',
              error_message TEXT,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              completed_at TIMESTAMPTZ
            )`,
            `CREATE INDEX IF NOT EXISTS idx_job_queue_status ON job_queue_log(status, created_at DESC)`,
            // ── Entity OS Core: pgvector + enhanced entity identity schema ──────
            // pgvector extension (non-fatal if unavailable on this host)
            `CREATE EXTENSION IF NOT EXISTS vector`,
            // Enhance the existing entities table with Entity OS Core columns
            `ALTER TABLE entities ADD COLUMN IF NOT EXISTS canonical_name TEXT`,
            `ALTER TABLE entities ADD COLUMN IF NOT EXISTS normalized_name TEXT`,
            `ALTER TABLE entities ADD COLUMN IF NOT EXISTS description TEXT`,
            `ALTER TABLE entities ADD COLUMN IF NOT EXISTS embedding vector(1536)`,
            `ALTER TABLE entities ADD COLUMN IF NOT EXISTS entity_type TEXT`,
            `ALTER TABLE entities ADD COLUMN IF NOT EXISTS collision_score FLOAT DEFAULT 0`,
            `ALTER TABLE entities ADD COLUMN IF NOT EXISTS clarity_score FLOAT DEFAULT 0`,
            `ALTER TABLE entities ADD COLUMN IF NOT EXISTS authority_score FLOAT DEFAULT 0`,
            `ALTER TABLE entities ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'`,
            `ALTER TABLE entities ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`,
            // Unique index on normalized_name for fast entity resolution
            `CREATE UNIQUE INDEX IF NOT EXISTS idx_entities_normalized ON entities(normalized_name) WHERE normalized_name IS NOT NULL`,
            // Entity Variants: name collision surface (same entity, different surface names across sources)
            `CREATE TABLE IF NOT EXISTS entity_variants (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
            surface_name TEXT NOT NULL,
            source_url TEXT,
            context_snippet TEXT,
            embedding vector(1536),
            confidence FLOAT DEFAULT 0,
            is_conflict BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )`,
            `CREATE INDEX IF NOT EXISTS idx_entity_variants_entity ON entity_variants(entity_id)`,
            `CREATE INDEX IF NOT EXISTS idx_entity_variants_surface ON entity_variants(surface_name)`,
            // Entity Evidence: CITE backbone — deduplicated cross-source evidence per entity
            `CREATE TABLE IF NOT EXISTS entity_evidence (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
            evidence_type TEXT,
            source TEXT,
            snippet TEXT,
            hash TEXT UNIQUE,
            embedding vector(1536),
            weight FLOAT DEFAULT 1.0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )`,
            `CREATE INDEX IF NOT EXISTS idx_entity_evidence_entity ON entity_evidence(entity_id)`,
            `CREATE INDEX IF NOT EXISTS idx_entity_evidence_hash ON entity_evidence(hash)`,
            `CREATE INDEX IF NOT EXISTS idx_entity_evidence_type ON entity_evidence(evidence_type)`,
            // Entity Collisions: moat table — semantic/name/category collision detection
            `CREATE TABLE IF NOT EXISTS entity_collisions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            entity_a TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
            entity_b TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
            collision_type TEXT,
            severity FLOAT,
            shared_signals JSONB DEFAULT '{}'::jsonb,
            resolved BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )`,
            `CREATE INDEX IF NOT EXISTS idx_entity_collisions_a ON entity_collisions(entity_a)`,
            `CREATE INDEX IF NOT EXISTS idx_entity_collisions_b ON entity_collisions(entity_b)`,
            `CREATE INDEX IF NOT EXISTS idx_entity_collisions_type ON entity_collisions(collision_type)`,
            // Composite unique: prevent duplicate collision pairs regardless of direction
            `CREATE UNIQUE INDEX IF NOT EXISTS idx_entity_collisions_pair ON entity_collisions(LEAST(entity_a, entity_b), GREATEST(entity_a, entity_b), collision_type)`,
            // Link audits to the Entity OS identity layer
            `ALTER TABLE audits ADD COLUMN IF NOT EXISTS entity_id TEXT REFERENCES entities(id) ON DELETE SET NULL`,
            `CREATE INDEX IF NOT EXISTS idx_audits_entity_id ON audits(entity_id)`,
            // HNSW vector indexes for embedding similarity search (non-fatal if pgvector absent)
            `CREATE INDEX IF NOT EXISTS idx_entities_embedding ON entities USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)`,
            `CREATE INDEX IF NOT EXISTS idx_entity_evidence_embedding ON entity_evidence USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)`,
            `CREATE INDEX IF NOT EXISTS idx_entity_variants_embedding ON entity_variants USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)`,
            // ── Forensic Pipeline: event log, ledger, and registry (append-only truth) ──────────
            // EVENT LOG (append-only truth)
            `CREATE TABLE IF NOT EXISTS scan_events (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              scan_id UUID NOT NULL,
              event_type TEXT NOT NULL,
              payload JSONB NOT NULL DEFAULT '{}',
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )`,
            `CREATE INDEX IF NOT EXISTS idx_scan_events_scan ON scan_events(scan_id, created_at ASC)`,
            `CREATE INDEX IF NOT EXISTS idx_scan_events_type ON scan_events(event_type)`,
            // SCANS (root entity — maps 1:1 to audits but decoupled for forensic replay)
            `CREATE TABLE IF NOT EXISTS scan_runs (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              audit_id UUID REFERENCES audits(id) ON DELETE SET NULL,
              url TEXT NOT NULL,
              domain TEXT NOT NULL,
              input_brand TEXT,
              status TEXT NOT NULL DEFAULT 'pending',
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )`,
            `CREATE INDEX IF NOT EXISTS idx_scan_runs_audit ON scan_runs(audit_id)`,
            `CREATE INDEX IF NOT EXISTS idx_scan_runs_domain ON scan_runs(domain)`,
            // QUERIES (generated intent layer)
            `CREATE TABLE IF NOT EXISTS scan_queries (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              scan_id UUID NOT NULL REFERENCES scan_runs(id) ON DELETE CASCADE,
              query TEXT NOT NULL,
              query_type TEXT,
              priority INT DEFAULT 0,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )`,
            `CREATE INDEX IF NOT EXISTS idx_scan_queries_scan ON scan_queries(scan_id)`,
            // SOURCES (authority layer — deduplicated by domain)
            `CREATE TABLE IF NOT EXISTS citation_sources (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              domain TEXT NOT NULL,
              url TEXT NOT NULL,
              authority_score FLOAT DEFAULT 0,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              UNIQUE(url)
            )`,
            `CREATE INDEX IF NOT EXISTS idx_citation_sources_domain ON citation_sources(domain)`,
            // CITATION LEDGER (core immutable evidence — append-only, never update rows)
            `CREATE TABLE IF NOT EXISTS citation_ledger (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              scan_id UUID NOT NULL REFERENCES scan_runs(id) ON DELETE CASCADE,
              query_id UUID REFERENCES scan_queries(id) ON DELETE SET NULL,
              source_id UUID REFERENCES citation_sources(id) ON DELETE SET NULL,
              position INT,
              mentioned BOOLEAN NOT NULL DEFAULT FALSE,
              cited BOOLEAN NOT NULL DEFAULT FALSE,
              context TEXT,
              sentiment TEXT,
              confidence FLOAT DEFAULT 1.0,
              model TEXT,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )`,
            `CREATE INDEX IF NOT EXISTS idx_citation_ledger_scan ON citation_ledger(scan_id)`,
            `CREATE INDEX IF NOT EXISTS idx_citation_ledger_query ON citation_ledger(query_id)`,
            `CREATE INDEX IF NOT EXISTS idx_citation_ledger_source ON citation_ledger(source_id)`,
            `CREATE INDEX IF NOT EXISTS idx_citation_ledger_cited ON citation_ledger(scan_id, cited)`,
            // ENTITY MENTIONS (link layer — entity_id references existing entities table)
            `CREATE TABLE IF NOT EXISTS entity_mention_links (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
              citation_id UUID NOT NULL REFERENCES citation_ledger(id) ON DELETE CASCADE,
              relevance FLOAT DEFAULT 1.0,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )`,
            `CREATE INDEX IF NOT EXISTS idx_entity_mention_links_entity ON entity_mention_links(entity_id)`,
            `CREATE INDEX IF NOT EXISTS idx_entity_mention_links_citation ON entity_mention_links(citation_id)`,
            // VISIBILITY REGISTRY (derived queryable state — upserted by pipeline)
            `CREATE TABLE IF NOT EXISTS visibility_registry (
              scan_id UUID PRIMARY KEY REFERENCES scan_runs(id) ON DELETE CASCADE,
              entity_clarity FLOAT,
              citation_coverage FLOAT,
              authority_alignment FLOAT,
              answer_presence FLOAT,
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )`,
            // QUERY COVERAGE (derived per-query state)
            `CREATE TABLE IF NOT EXISTS query_coverage (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              scan_id UUID NOT NULL REFERENCES scan_runs(id) ON DELETE CASCADE,
              query_id UUID NOT NULL REFERENCES scan_queries(id) ON DELETE CASCADE,
              appears BOOLEAN NOT NULL DEFAULT FALSE,
              citation_count INT DEFAULT 0,
              avg_position FLOAT,
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              UNIQUE(scan_id, query_id)
            )`,
            `CREATE INDEX IF NOT EXISTS idx_query_coverage_scan ON query_coverage(scan_id)`,
            // AUTHORITY REGISTRY (derived per-source state)
            `CREATE TABLE IF NOT EXISTS authority_registry (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              scan_id UUID NOT NULL REFERENCES scan_runs(id) ON DELETE CASCADE,
              source_id UUID NOT NULL REFERENCES citation_sources(id) ON DELETE CASCADE,
              mentions INT DEFAULT 0,
              citations INT DEFAULT 0,
              alignment_score FLOAT DEFAULT 0,
              UNIQUE(scan_id, source_id)
            )`,
            `CREATE INDEX IF NOT EXISTS idx_authority_registry_scan ON authority_registry(scan_id)`,
            // GAPS (what users pay for — visibility failure surface)
            `CREATE TABLE IF NOT EXISTS scan_gaps (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              scan_id UUID NOT NULL REFERENCES scan_runs(id) ON DELETE CASCADE,
              gap_type TEXT NOT NULL,
              description TEXT,
              related_query_id UUID REFERENCES scan_queries(id) ON DELETE SET NULL,
              related_entity_id TEXT REFERENCES entities(id) ON DELETE SET NULL,
              severity FLOAT DEFAULT 0.5,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )`,
            `CREATE INDEX IF NOT EXISTS idx_scan_gaps_scan ON scan_gaps(scan_id)`,
            `CREATE INDEX IF NOT EXISTS idx_scan_gaps_type ON scan_gaps(gap_type)`,
            `CREATE INDEX IF NOT EXISTS idx_scan_gaps_severity ON scan_gaps(scan_id, severity DESC)`,
          ];
          let patchOk = 0;
          let patchFail = 0;
          for (const stmt of patchStatements) {
            try {
              await client.query(stmt);
              patchOk++;
            } catch (stmtErr: any) {
              patchFail++;
              // Log first 100 chars of the failing statement + error for debuggability
              const stmtPreview = stmt.replace(/\s+/g, " ").substring(0, 100);
              console.warn(
                `[DB] Patch stmt failed (non-fatal): ${stmtPreview}... | ${stmtErr?.message?.substring(0, 80)}`,
              );
            }
          }
          console.log(
            `[DB] Schema patch complete: ${patchOk} applied, ${patchFail} skipped`,
          );
        }
        markDatabaseAvailable();
        console.log("[DB] Database already initialized, schema verified");
        migrationsRan = true;
        return;
      }

      console.log(
        `[DB] Running database migrations (non-transactional) - attempt ${attempt}/${maxRetries}...`,
      );
      // Batch all DDL into a single round-trip to minimize connection overhead
      // (~200 queries → 1 query = ~99% reduction in compute time)
      const _ddl: string[] = [];
      const _q = (sql: string) => {
        _ddl.push(sql.trim().replace(/;\s*$/, ""));
      };
      _q(`
      CREATE TABLE IF NOT EXISTS analysis_cache (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        url TEXT UNIQUE NOT NULL,
        result JSONB NOT NULL,
        analyzed_at_timestamp BIGINT NOT NULL,
        analyzed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_analysis_cache_url ON analysis_cache(url)`,
      );
      _q(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        tier VARCHAR(20) DEFAULT 'observer',
        is_verified BOOLEAN DEFAULT FALSE,
        mfa_secret VARCHAR(32),
        login_attempts INTEGER DEFAULT 0,
        locked_until TIMESTAMPTZ,
        last_login TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
      _q(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
      _q(`CREATE INDEX IF NOT EXISTS idx_users_tier ON users(tier)`);
      _q(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        session_token VARCHAR(512) UNIQUE NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        user_agent TEXT,
        ip_address INET,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token)`,
      );

      // ─── Organizations / Workspaces (must be created early - many tables reference workspaces) ───
      _q(`
      CREATE TABLE IF NOT EXISTS organizations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        is_personal BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_organizations_owner ON organizations(owner_user_id)`,
      );
      _q(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_personal_owner ON organizations(owner_user_id) WHERE is_personal = TRUE`,
      );

      _q(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        slug TEXT NOT NULL,
        created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        is_default BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (organization_id, slug)
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_workspaces_org ON workspaces(organization_id)`,
      );
      _q(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_default_org ON workspaces(organization_id) WHERE is_default = TRUE`,
      );

      _q(`
      CREATE TABLE IF NOT EXISTS workspace_members (
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL DEFAULT 'member',
        joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (workspace_id, user_id)
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id)`,
      );

      _q(`
      CREATE TABLE IF NOT EXISTS workspace_invites (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'member',
        token TEXT UNIQUE NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        accepted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_workspace_invites_token ON workspace_invites(token)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_workspace_invites_workspace ON workspace_invites(workspace_id)`,
      );
      // Ensure invited_by column exists for tables created before it was added to the schema
      _q(
        `ALTER TABLE workspace_invites ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES users(id) ON DELETE CASCADE`,
      );

      _q(`
      CREATE TABLE IF NOT EXISTS usage_daily (
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        requests INT NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, date)
      )
    `);
      _q(`
      CREATE TABLE IF NOT EXISTS scan_pack_credits (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        credits_remaining NUMERIC(12,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
      _q(`
      CREATE TABLE IF NOT EXISTS scan_pack_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        pack_key VARCHAR(64) NOT NULL,
        credits_added NUMERIC(12,2) NOT NULL,
        amount_cents INT,
        currency VARCHAR(10) DEFAULT 'usd',
        stripe_session_id VARCHAR(255) UNIQUE,
        stripe_payment_intent_id VARCHAR(255),
        status VARCHAR(30) DEFAULT 'completed',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_scan_pack_tx_user_id ON scan_pack_transactions(user_id)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_scan_pack_tx_pack_key ON scan_pack_transactions(pack_key)`,
      );
      _q(
        `ALTER TABLE scan_pack_transactions ADD COLUMN IF NOT EXISTS bonus_percent INT NOT NULL DEFAULT 0`,
      );
      _q(
        `ALTER TABLE scan_pack_transactions ADD COLUMN IF NOT EXISTS bonus_source VARCHAR(80)`,
      );
      _q(
        `ALTER TABLE scan_pack_credits ALTER COLUMN credits_remaining TYPE NUMERIC(12,2) USING credits_remaining::numeric(12,2)`,
      );
      _q(
        `ALTER TABLE scan_pack_transactions ALTER COLUMN credits_added TYPE NUMERIC(12,2) USING credits_added::numeric(12,2)`,
      );
      _q(`
      CREATE TABLE IF NOT EXISTS credit_usage_ledger (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        delta_credits NUMERIC(12,2) NOT NULL,
        balance_after NUMERIC(12,2) NOT NULL,
        reason VARCHAR(80) NOT NULL,
        metadata JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_credit_usage_ledger_user ON credit_usage_ledger(user_id, created_at DESC)`,
      );

      _q(`
      CREATE TABLE IF NOT EXISTS tier_credit_bonus_grants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        tier_key VARCHAR(20) NOT NULL,
        billing_period VARCHAR(20) NOT NULL,
        base_credits INT NOT NULL,
        bonus_percent INT NOT NULL,
        bonus_credits INT NOT NULL,
        total_credits_added INT NOT NULL,
        milestone_qualified BOOLEAN NOT NULL DEFAULT FALSE,
        milestone_window_minutes INT,
        reason VARCHAR(60) NOT NULL DEFAULT 'initial_tier_bonus',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, tier_key, billing_period, reason)
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_tier_bonus_user_id ON tier_credit_bonus_grants(user_id)`,
      );
      _q(`
      CREATE TABLE IF NOT EXISTS referral_codes (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        code VARCHAR(24) UNIQUE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes(code)`,
      );

      _q(`
      CREATE TABLE IF NOT EXISTS referral_attributions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        referrer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        referred_user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        referral_code VARCHAR(24) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        credits_awarded_referrer INT NOT NULL DEFAULT 0,
        credits_awarded_referred INT NOT NULL DEFAULT 0,
        rejected_reason TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        awarded_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(referrer_user_id, referred_user_id)
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_referral_attr_referrer ON referral_attributions(referrer_user_id)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_referral_attr_referred ON referral_attributions(referred_user_id)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_referral_attr_status ON referral_attributions(status)`,
      );

      _q(`
      CREATE TABLE IF NOT EXISTS referral_credit_ledger (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        counterparty_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        attribution_id UUID REFERENCES referral_attributions(id) ON DELETE SET NULL,
        delta_credits INT NOT NULL,
        reason VARCHAR(80) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_referral_ledger_user ON referral_credit_ledger(user_id)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_referral_ledger_attr ON referral_credit_ledger(attribution_id)`,
      );

      _q(`
      CREATE TABLE IF NOT EXISTS user_milestones (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        milestone_key VARCHAR(40) NOT NULL,
        credits_awarded NUMERIC(8,2) NOT NULL DEFAULT 0,
        unlocked_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, milestone_key)
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_user_milestones_user ON user_milestones(user_id)`,
      );

      _q(`
      CREATE TABLE IF NOT EXISTS tool_usage_monthly (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        tool_action VARCHAR(40) NOT NULL,
        month_key VARCHAR(7) NOT NULL,
        usage_count INT NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, tool_action, month_key)
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_tool_usage_monthly_user_month ON tool_usage_monthly(user_id, month_key)`,
      );

      _q(`
      CREATE TABLE IF NOT EXISTS newsletter_dispatches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        edition_key VARCHAR(32) NOT NULL,
        channel VARCHAR(20) NOT NULL DEFAULT 'email',
        metadata JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, edition_key)
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_newsletter_dispatches_edition ON newsletter_dispatches(edition_key)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_newsletter_dispatches_user ON newsletter_dispatches(user_id)`,
      );
      _q(`
      CREATE TABLE IF NOT EXISTS admin_runtime_settings (
        key VARCHAR(100) PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_admin_runtime_settings_updated ON admin_runtime_settings(updated_at DESC)`,
      );
      _q(`
      CREATE TABLE IF NOT EXISTS newsletter_editions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        edition_key VARCHAR(64) UNIQUE NOT NULL,
        title VARCHAR(180),
        summary TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'draft',
        metadata JSONB,
        created_by VARCHAR(80) NOT NULL DEFAULT 'admin',
        sent_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_newsletter_editions_status_created ON newsletter_editions(status, created_at DESC)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_newsletter_editions_key ON newsletter_editions(edition_key)`,
      );
      _q(`
      CREATE TABLE IF NOT EXISTS user_notification_preferences (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        email_notifications BOOLEAN NOT NULL DEFAULT TRUE,
        share_link_expiration_days INTEGER NOT NULL DEFAULT 30,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
      _q(
        `ALTER TABLE user_notification_preferences ADD COLUMN IF NOT EXISTS share_link_expiration_days INTEGER`,
      );
      _q(
        `UPDATE user_notification_preferences SET share_link_expiration_days = 30 WHERE share_link_expiration_days IS NULL`,
      );
      _q(
        `ALTER TABLE user_notification_preferences ALTER COLUMN share_link_expiration_days SET DEFAULT 30`,
      );
      _q(
        `ALTER TABLE user_notification_preferences ALTER COLUMN share_link_expiration_days SET NOT NULL`,
      );
      _q(
        `ALTER TABLE user_notification_preferences DROP CONSTRAINT IF EXISTS user_notification_preferences_share_link_expiration_days_check`,
      );
      _q(`
      ALTER TABLE user_notification_preferences
      ADD CONSTRAINT user_notification_preferences_share_link_expiration_days_check
      CHECK (share_link_expiration_days IN (0, 7, 14, 30, 90))
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_user_notification_email ON user_notification_preferences(email_notifications)`,
      );
      // Granular notification preferences - per-category and channel toggles (2026-03-29)
      _q(
        `ALTER TABLE user_notification_preferences ADD COLUMN IF NOT EXISTS in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE`,
      );
      _q(
        `ALTER TABLE user_notification_preferences ADD COLUMN IF NOT EXISTS sound_enabled BOOLEAN NOT NULL DEFAULT TRUE`,
      );
      _q(
        `ALTER TABLE user_notification_preferences ADD COLUMN IF NOT EXISTS browser_enabled BOOLEAN NOT NULL DEFAULT FALSE`,
      );
      _q(
        `ALTER TABLE user_notification_preferences ADD COLUMN IF NOT EXISTS muted_categories TEXT[] NOT NULL DEFAULT '{}'`,
      );
      _q(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        scope VARCHAR(20) NOT NULL DEFAULT 'user',
        event_type VARCHAR(80) NOT NULL,
        title VARCHAR(140) NOT NULL,
        message VARCHAR(500) NOT NULL,
        metadata JSONB,
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        read_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_notifications_scope_created ON notifications(scope, created_at DESC)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(is_read, created_at DESC)`,
      );
      _q(`
      CREATE TABLE IF NOT EXISTS notification_reads (
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
        read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, notification_id)
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_notification_reads_user ON notification_reads(user_id, read_at DESC)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_notification_reads_notification ON notification_reads(notification_id)`,
      );
      _q(`
      CREATE TABLE IF NOT EXISTS scheduled_platform_notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_type VARCHAR(80) NOT NULL DEFAULT 'platform_event',
        title VARCHAR(140) NOT NULL,
        message VARCHAR(500) NOT NULL,
        metadata JSONB,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        scheduled_for TIMESTAMPTZ NOT NULL,
        published_at TIMESTAMPTZ,
        created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        last_error VARCHAR(400),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_scheduled_platform_notifications_status_time ON scheduled_platform_notifications(status, scheduled_for ASC)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_scheduled_platform_notifications_created_by ON scheduled_platform_notifications(created_by_user_id, created_at DESC)`,
      );
      _q(`
      CREATE TABLE IF NOT EXISTS payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        stripe_customer_id VARCHAR(255),
        stripe_subscription_id VARCHAR(255),
        plan VARCHAR(50),
        status VARCHAR(50),
        current_period_start TIMESTAMPTZ,
        current_period_end TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
      _q(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        stripe_subscription_id VARCHAR(255) UNIQUE NOT NULL,
        status VARCHAR(40) NOT NULL,
        price_id VARCHAR(255),
        current_period_end TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status)`,
      );
      _q(`
      CREATE TABLE IF NOT EXISTS usage (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        audits_used INT NOT NULL DEFAULT 0,
        period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        period_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 month'),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
      _q(`
      CREATE TABLE IF NOT EXISTS audits (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        url TEXT NOT NULL,
        visibility_score INTEGER,
        result JSONB,
        status VARCHAR(20) DEFAULT 'completed',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ
      )
    `);
      _q(`CREATE INDEX IF NOT EXISTS idx_audits_user_id ON audits(user_id)`);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_audits_created_at ON audits(created_at DESC)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_audits_status ON audits(status) WHERE status = 'queued'`,
      );

      _q(`
      CREATE TABLE IF NOT EXISTS competitor_tracking (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        competitor_url TEXT NOT NULL,
        nickname VARCHAR(255) NOT NULL,
        latest_audit_id UUID REFERENCES audits(id) ON DELETE SET NULL,
        latest_score INTEGER,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, competitor_url)
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_competitor_tracking_user_id ON competitor_tracking(user_id)`,
      );

      _q(`
      CREATE TABLE IF NOT EXISTS citation_tests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        queries JSONB NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        results JSONB,
        summary JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_citation_tests_user_id ON citation_tests(user_id)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_citation_tests_status ON citation_tests(status)`,
      );

      _q(`
      CREATE TABLE IF NOT EXISTS citation_results (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        citation_test_id UUID NOT NULL REFERENCES citation_tests(id) ON DELETE CASCADE,
        query TEXT NOT NULL,
        platform VARCHAR(20) NOT NULL,
        mentioned BOOLEAN DEFAULT FALSE,
        position INTEGER DEFAULT 0,
        excerpt TEXT,
        screenshot_url TEXT,
        competitors_mentioned JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_citation_results_test_id ON citation_results(citation_test_id)`,
      );

      _q(`
      CREATE TABLE IF NOT EXISTS citation_prompt_ledger (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        citation_test_id UUID NOT NULL REFERENCES citation_tests(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        query TEXT NOT NULL,
        prompt_text TEXT NOT NULL,
        prompt_hash VARCHAR(64) NOT NULL,
        validation_status VARCHAR(20) NOT NULL DEFAULT 'validated',
        platform VARCHAR(20) NOT NULL,
        model_used TEXT,
        model_role VARCHAR(20),
        mentioned BOOLEAN NOT NULL DEFAULT FALSE,
        position INTEGER NOT NULL DEFAULT 0,
        evidence_excerpt TEXT,
        metadata JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(citation_test_id, prompt_hash, platform)
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_citation_prompt_ledger_user_created ON citation_prompt_ledger(user_id, created_at DESC)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_citation_prompt_ledger_url_created ON citation_prompt_ledger(url, created_at DESC)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_citation_prompt_ledger_test ON citation_prompt_ledger(citation_test_id)`,
      );

      // ─── Additive column migrations (safe to re-run) ─────────────────────────
      // users: columns added after initial schema
      const userCols: [string, string][] = [
        ["name", "VARCHAR(255)"],
        ["role", "VARCHAR(20) DEFAULT 'user'"],
        ["verification_token", "VARCHAR(128)"],
        ["verification_token_expires", "TIMESTAMPTZ"],
        ["stripe_subscription_id", "VARCHAR(255)"],
        ["stripe_customer_id", "VARCHAR(255)"],
        ["login_attempts", "INTEGER DEFAULT 0"],
        ["locked_until", "TIMESTAMPTZ"],
        ["last_login", "TIMESTAMPTZ"],
        ["mfa_secret", "VARCHAR(32)"],
        ["company", "VARCHAR(255)"],
        ["website", "TEXT"],
        ["bio", "TEXT"],
        ["avatar_url", "TEXT"],
        ["timezone", "VARCHAR(80)"],
        ["language", "VARCHAR(32)"],
        ["org_description", "TEXT"],
        ["org_logo_url", "TEXT"],
        ["org_favicon_url", "TEXT"],
        ["org_phone", "VARCHAR(64)"],
        ["org_address", "TEXT"],
        ["org_verified", "BOOLEAN DEFAULT FALSE"],
        ["org_verification_confidence", "INTEGER"],
        ["org_verification_reasons", "JSONB"],
        ["trial_ends_at", "TIMESTAMPTZ"],
        ["trial_used", "BOOLEAN DEFAULT FALSE"],
        ["trial_tier", "TEXT"],
        ["trial_started_at", "TIMESTAMPTZ"],
        ["trial_converted", "BOOLEAN DEFAULT FALSE"],
        ["last_reset_date", "TIMESTAMPTZ"],
        ["is_test", "BOOLEAN DEFAULT FALSE"],
      ];
      for (const [col, def] of userCols) {
        _q(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${col} ${def}`);
      }

      // payments: expand to hold full Stripe lifecycle data
      const paymentCols: [string, string][] = [
        ["tier", "VARCHAR(50) DEFAULT 'observer'"],
        ["method", "VARCHAR(20) DEFAULT 'stripe'"],
        ["stripe_session_id", "VARCHAR(255)"],
        ["stripe_price_id", "VARCHAR(255)"],
        ["amount_cents", "INTEGER"],
        ["currency", "VARCHAR(10) DEFAULT 'usd'"],
        ["completed_at", "TIMESTAMPTZ"],
        ["failed_at", "TIMESTAMPTZ"],
        ["canceled_at", "TIMESTAMPTZ"],
        ["subscription_status", "VARCHAR(30)"],
        ["cancel_at_period_end", "BOOLEAN DEFAULT FALSE"],
        ["last_payment_at", "TIMESTAMPTZ"],
        ["last_invoice_id", "VARCHAR(255)"],
        ["last_failed_payment_at", "TIMESTAMPTZ"],
        ["failed_invoice_id", "VARCHAR(255)"],
        ["metadata", "JSONB"],
      ];
      for (const [col, def] of paymentCols) {
        _q(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS ${col} ${def}`);
      }
      _q(
        `CREATE INDEX IF NOT EXISTS idx_payments_stripe_session ON payments(stripe_session_id) WHERE stripe_session_id IS NOT NULL`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_payments_stripe_sub ON payments(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id)`,
      );

      // analysis_cache: columns added after initial schema
      const cacheCols: [string, string][] = [
        ["analyzed_at_timestamp", "BIGINT"],
        ["analyzed_at", "TIMESTAMPTZ"],
        ["updated_at", "TIMESTAMPTZ DEFAULT NOW()"],
      ];
      for (const [col, def] of cacheCols) {
        _q(`ALTER TABLE analysis_cache ADD COLUMN IF NOT EXISTS ${col} ${def}`);
      }
      // Backfill analyzed_at_timestamp for rows that existed before the column
      _q(`
      UPDATE analysis_cache
      SET analyzed_at_timestamp = EXTRACT(EPOCH FROM created_at)::BIGINT * 1000
      WHERE analyzed_at_timestamp IS NULL
    `);

      // ─── License tables ───────────────────────────────────────────────────────
      _q(`
      CREATE TABLE IF NOT EXISTS licenses (
        id VARCHAR(255) PRIMARY KEY,
        license_key VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) NOT NULL,
        product_id VARCHAR(255) NOT NULL,
        product_name VARCHAR(500) NOT NULL,
        order_number INTEGER NOT NULL,
        sale_id VARCHAR(255) NOT NULL,
        purchase_date TIMESTAMP NOT NULL,
        is_active BOOLEAN DEFAULT true,
        activation_count INTEGER DEFAULT 0,
        max_activations INTEGER DEFAULT 3,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
      _q(`
      CREATE TABLE IF NOT EXISTS license_activations (
        id VARCHAR(255) PRIMARY KEY,
        license_id VARCHAR(255) REFERENCES licenses(id),
        machine_id VARCHAR(500) NOT NULL,
        activated_at TIMESTAMP NOT NULL,
        deactivated_at TIMESTAMP,
        is_active BOOLEAN DEFAULT true,
        metadata JSONB DEFAULT '{}',
        UNIQUE(license_id, machine_id)
      )
    `);
      _q(`
      CREATE TABLE IF NOT EXISTS license_verifications (
        id VARCHAR(255) PRIMARY KEY,
        license_id VARCHAR(255) REFERENCES licenses(id),
        verified_at TIMESTAMP NOT NULL,
        metadata JSONB DEFAULT '{}'
      )
    `);
      _q(`CREATE INDEX IF NOT EXISTS idx_licenses_email ON licenses(email)`);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_licenses_key ON licenses(license_key)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_activations_license ON license_activations(license_id)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_activations_machine ON license_activations(machine_id)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_verifications_license ON license_verifications(license_id)`,
      );

      // ─── Assistant usage tracking ─────────────────────────────────────────────
      _q(`
      CREATE TABLE IF NOT EXISTS assistant_usage (
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        messages INT NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, date)
      )
    `);

      // ─── SEO crawl persistence ───────────────────────────────────────────────
      _q(`
      CREATE TABLE IF NOT EXISTS seo_crawls (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        root_url TEXT NOT NULL,
        max_pages INTEGER NOT NULL,
        pages_crawled INTEGER NOT NULL DEFAULT 0,
        pages_with_errors INTEGER NOT NULL DEFAULT 0,
        average_word_count INTEGER NOT NULL DEFAULT 0,
        summary JSONB NOT NULL DEFAULT '{}',
        started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_seo_crawls_user ON seo_crawls(user_id)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_seo_crawls_created ON seo_crawls(created_at DESC)`,
      );

      _q(`
      CREATE TABLE IF NOT EXISTS seo_crawl_pages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        crawl_id UUID NOT NULL REFERENCES seo_crawls(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        depth INTEGER NOT NULL DEFAULT 0,
        status VARCHAR(20) NOT NULL DEFAULT 'ok',
        diagnostics JSONB NOT NULL DEFAULT '{}',
        issues JSONB NOT NULL DEFAULT '[]',
        links_discovered INTEGER NOT NULL DEFAULT 0,
        canonical_url TEXT,
        word_count INTEGER,
        title TEXT,
        error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(crawl_id, url)
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_seo_crawl_pages_crawl ON seo_crawl_pages(crawl_id)`,
      );

      // ─── Scheduled Rescans ────────────────────────────────────────────────────
      _q(`
      CREATE TABLE IF NOT EXISTS scheduled_rescans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        frequency VARCHAR(20) NOT NULL DEFAULT 'weekly',
        next_run_at TIMESTAMPTZ NOT NULL,
        last_run_at TIMESTAMPTZ,
        last_audit_id UUID REFERENCES audits(id) ON DELETE SET NULL,
        enabled BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, url)
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_scheduled_rescans_user ON scheduled_rescans(user_id)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_scheduled_rescans_next ON scheduled_rescans(next_run_at) WHERE enabled = TRUE`,
      );

      // ─── Audit Score Snapshots ─────────────────────────────────────────────
      _q(`
      CREATE TABLE IF NOT EXISTS audit_score_snapshots (
        audit_id UUID PRIMARY KEY REFERENCES audits(id) ON DELETE CASCADE,
        prior_run_id UUID REFERENCES audit_score_snapshots(audit_id) ON DELETE SET NULL,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        normalized_url TEXT NOT NULL,
        visibility_score NUMERIC(6,2) NOT NULL,
        execution_class VARCHAR(40),
        information_gain VARCHAR(20),
        contradiction_status VARCHAR(20),
        blocker_count INTEGER NOT NULL DEFAULT 0,
        geo_signal_profile JSONB,
        contradiction_report JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_audit_score_snapshots_user_url ON audit_score_snapshots(user_id, normalized_url, created_at DESC)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_audit_score_snapshots_workspace_url ON audit_score_snapshots(workspace_id, normalized_url, created_at DESC)`,
      );

      // ── Reconcile audit_score_snapshots schema: add SSFR pipeline columns ──
      _q(
        `ALTER TABLE audit_score_snapshots ADD COLUMN IF NOT EXISTS family_scores JSONB`,
      );
      _q(
        `ALTER TABLE audit_score_snapshots ADD COLUMN IF NOT EXISTS final_score NUMERIC(6,2)`,
      );
      _q(
        `ALTER TABLE audit_score_snapshots ADD COLUMN IF NOT EXISTS score_cap INTEGER`,
      );
      _q(
        `ALTER TABLE audit_score_snapshots ADD COLUMN IF NOT EXISTS score_version VARCHAR(20)`,
      );
      _q(
        `ALTER TABLE audit_score_snapshots ADD COLUMN IF NOT EXISTS framework_detected VARCHAR(60)`,
      );
      _q(
        `ALTER TABLE audit_score_snapshots ADD COLUMN IF NOT EXISTS crawlability_score NUMERIC(5,2)`,
      );
      _q(
        `ALTER TABLE audit_score_snapshots ADD COLUMN IF NOT EXISTS indexability_score NUMERIC(5,2)`,
      );
      _q(
        `ALTER TABLE audit_score_snapshots ADD COLUMN IF NOT EXISTS renderability_score NUMERIC(5,2)`,
      );
      _q(
        `ALTER TABLE audit_score_snapshots ADD COLUMN IF NOT EXISTS metadata_score NUMERIC(5,2)`,
      );
      _q(
        `ALTER TABLE audit_score_snapshots ADD COLUMN IF NOT EXISTS schema_score NUMERIC(5,2)`,
      );
      _q(
        `ALTER TABLE audit_score_snapshots ADD COLUMN IF NOT EXISTS entity_score NUMERIC(5,2)`,
      );
      _q(
        `ALTER TABLE audit_score_snapshots ADD COLUMN IF NOT EXISTS content_score NUMERIC(5,2)`,
      );
      _q(
        `ALTER TABLE audit_score_snapshots ADD COLUMN IF NOT EXISTS citation_score NUMERIC(5,2)`,
      );
      _q(
        `ALTER TABLE audit_score_snapshots ADD COLUMN IF NOT EXISTS trust_score NUMERIC(5,2)`,
      );

      // NOTE: audit_rule_results reconciliation ALTERs moved to after CREATE TABLE (line ~1315)

      // ─── Deploy Hook Endpoints ─────────────────────────────────────────────
      _q(`
      CREATE TABLE IF NOT EXISTS deploy_hook_endpoints (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        provider VARCHAR(24) NOT NULL DEFAULT 'generic',
        name VARCHAR(120) NOT NULL,
        secret_hash VARCHAR(128) NOT NULL,
        secret_hint VARCHAR(16) NOT NULL,
        default_url TEXT,
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_deploy_hook_endpoints_workspace ON deploy_hook_endpoints(workspace_id, created_at DESC)`,
      );

      // ─── Deploy Verification Jobs ───────────────────────────────────────────
      _q(`
      CREATE TABLE IF NOT EXISTS deploy_verification_jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        status VARCHAR(24) NOT NULL DEFAULT 'pending',
        source VARCHAR(64) NOT NULL DEFAULT 'manual_deploy_verification',
        provider VARCHAR(32),
        environment VARCHAR(32),
        deployment_id VARCHAR(120),
        commit_sha VARCHAR(120),
        baseline_audit_id UUID REFERENCES audits(id) ON DELETE SET NULL,
        baseline_score NUMERIC(6,2),
        verification_audit_id UUID REFERENCES audits(id) ON DELETE SET NULL,
        score_after NUMERIC(6,2),
        score_delta NUMERIC(6,2),
        scheduled_for TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        failed_at TIMESTAMPTZ,
        last_error TEXT,
        trigger_metadata JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_deploy_verification_jobs_user ON deploy_verification_jobs(user_id, created_at DESC)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_deploy_verification_jobs_workspace ON deploy_verification_jobs(workspace_id, created_at DESC)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_deploy_verification_jobs_due ON deploy_verification_jobs(scheduled_for ASC) WHERE status IN ('pending', 'failed', 'running')`,
      );

      // ─── API Keys ─────────────────────────────────────────────────────────────
      _q(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        key_hash VARCHAR(128) NOT NULL UNIQUE,
        key_prefix VARCHAR(12) NOT NULL,
        name VARCHAR(100) NOT NULL DEFAULT 'Default',
        scopes TEXT[] NOT NULL DEFAULT '{"read:audits","read:analytics"}',
        last_used_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ,
        enabled BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
      _q(`CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id)`);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash) WHERE enabled = TRUE`,
      );

      // ─── External API Metering ───────────────────────────────────────────────
      _q(`
      CREATE TABLE IF NOT EXISTS api_usage_daily (
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        requests INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, workspace_id, api_key_id, date)
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_api_usage_workspace_date ON api_usage_daily(workspace_id, date)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_api_usage_key_date ON api_usage_daily(api_key_id, date)`,
      );

      // ─── External API Page Validation Records ───────────────────────────────
      _q(`
      CREATE TABLE IF NOT EXISTS api_page_validations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
        url TEXT NOT NULL,
        result JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_api_page_validations_workspace_created ON api_page_validations(workspace_id, created_at DESC)`,
      );

      // ─── MCP Export Tokens ──────────────────────────────────────────────────
      _q(`
      CREATE TABLE IF NOT EXISTS mcp_export_tokens (
        token UUID PRIMARY KEY,
        audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        format VARCHAR(10) NOT NULL DEFAULT 'json',
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_mcp_export_tokens_expires ON mcp_export_tokens(expires_at)`,
      );

      // ─── Authority Check Cache ──────────────────────────────────────────────
      _q(`
      CREATE TABLE IF NOT EXISTS authority_check_cache (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        cache_key VARCHAR(512) NOT NULL,
        result JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_authority_cache_key ON authority_check_cache(user_id, cache_key)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_authority_cache_created ON authority_check_cache(created_at)`,
      );

      // ─── Consent / Compliance Persistence ───────────────────────────────────
      _q(`
      CREATE TABLE IF NOT EXISTS user_consents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        consent_type VARCHAR(40) NOT NULL,
        status VARCHAR(20) NOT NULL,
        policy_version VARCHAR(40),
        source VARCHAR(20) NOT NULL DEFAULT 'web',
        metadata JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, workspace_id, consent_type)
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_user_consents_workspace ON user_consents(workspace_id)`,
      );

      // ─── Webhooks ─────────────────────────────────────────────────────────────
      _q(`
      CREATE TABLE IF NOT EXISTS webhooks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider VARCHAR(20) NOT NULL DEFAULT 'generic',
        display_name VARCHAR(120),
        url TEXT NOT NULL,
        events TEXT[] NOT NULL DEFAULT '{"audit.completed"}',
        secret VARCHAR(64) NOT NULL,
        enabled BOOLEAN DEFAULT TRUE,
        last_triggered_at TIMESTAMPTZ,
        failure_count INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
      _q(`CREATE INDEX IF NOT EXISTS idx_webhooks_user ON webhooks(user_id)`);

      // ─── User Branding (White-Label) ──────────────────────────────────────────
      _q(`
      CREATE TABLE IF NOT EXISTS user_branding (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        company_name VARCHAR(255),
        logo_url TEXT,
        logo_base64 TEXT,
        primary_color VARCHAR(7) DEFAULT '#0ea5e9',
        accent_color VARCHAR(7) DEFAULT '#6366f1',
        footer_text TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

      // Workspace foreign keys for tenant-scoped resources
      _q(
        `ALTER TABLE audits ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE`,
      );
      _q(
        `ALTER TABLE audits ADD COLUMN IF NOT EXISTS tier_at_analysis VARCHAR(40)`,
      );
      _q(
        `ALTER TABLE competitor_tracking ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE`,
      );
      _q(
        `ALTER TABLE competitor_tracking ADD COLUMN IF NOT EXISTS monitoring_enabled BOOLEAN NOT NULL DEFAULT TRUE`,
      );
      _q(
        `ALTER TABLE competitor_tracking ADD COLUMN IF NOT EXISTS monitor_frequency VARCHAR(20) NOT NULL DEFAULT 'daily'`,
      );
      _q(
        `ALTER TABLE competitor_tracking ADD COLUMN IF NOT EXISTS next_monitor_at TIMESTAMPTZ`,
      );
      _q(
        `ALTER TABLE competitor_tracking ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ`,
      );
      _q(
        `ALTER TABLE competitor_tracking ADD COLUMN IF NOT EXISTS last_change_detected_at TIMESTAMPTZ`,
      );
      _q(
        `ALTER TABLE competitor_tracking ADD COLUMN IF NOT EXISTS last_change_fingerprint TEXT`,
      );
      _q(
        `ALTER TABLE competitor_tracking ADD COLUMN IF NOT EXISTS last_change_snapshot JSONB`,
      );
      _q(
        `ALTER TABLE competitor_tracking ADD COLUMN IF NOT EXISTS last_change_evidence JSONB`,
      );
      _q(
        `ALTER TABLE competitor_tracking ADD COLUMN IF NOT EXISTS last_score_change_reason JSONB`,
      );
      _q(
        `ALTER TABLE citation_tests ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE`,
      );
      _q(
        `ALTER TABLE citation_results ADD COLUMN IF NOT EXISTS source_type VARCHAR(20)`,
      );
      _q(
        `ALTER TABLE citation_results ADD COLUMN IF NOT EXISTS citation_urls JSONB`,
      );
      _q(
        `ALTER TABLE citation_results ADD COLUMN IF NOT EXISTS model_used TEXT`,
      );
      _q(
        `ALTER TABLE citation_results ADD COLUMN IF NOT EXISTS model_role VARCHAR(20)`,
      );
      _q(
        `ALTER TABLE scheduled_rescans ADD COLUMN IF NOT EXISTS workspace_id UUID`,
      );
      _q(
        `ALTER TABLE scheduled_rescans ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ`,
      );
      _q(
        `ALTER TABLE scheduled_rescans ADD COLUMN IF NOT EXISTS last_change_fingerprint TEXT`,
      );
      _q(
        `ALTER TABLE scheduled_rescans ADD COLUMN IF NOT EXISTS last_change_snapshot JSONB`,
      );
      _q(
        `ALTER TABLE scheduled_rescans ADD COLUMN IF NOT EXISTS last_change_evidence JSONB`,
      );
      _q(
        `ALTER TABLE scheduled_rescans ADD COLUMN IF NOT EXISTS last_score_change_reason JSONB`,
      );
      _q(
        `ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE`,
      );
      _q(
        `ALTER TABLE webhooks ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE`,
      );
      _q(
        `ALTER TABLE webhooks ADD COLUMN IF NOT EXISTS provider VARCHAR(20) NOT NULL DEFAULT 'generic'`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_webhooks_provider ON webhooks(provider)`,
      );
      _q(
        `ALTER TABLE webhooks ADD COLUMN IF NOT EXISTS display_name VARCHAR(120)`,
      );
      _q(
        `ALTER TABLE user_branding ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE`,
      );
      _q(
        `ALTER TABLE user_branding ADD COLUMN IF NOT EXISTS tagline VARCHAR(255)`,
      );
      _q(
        `ALTER TABLE user_branding ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255)`,
      );
      _q(`ALTER TABLE user_branding ADD COLUMN IF NOT EXISTS website_url TEXT`);
      _q(
        `ALTER TABLE user_branding ADD COLUMN IF NOT EXISTS show_cover_page BOOLEAN DEFAULT FALSE`,
      );

      // ─── Automatic Report Delivery Targets ───────────────────────────────────
      _q(`
      CREATE TABLE IF NOT EXISTS report_delivery_targets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        provider VARCHAR(20) NOT NULL DEFAULT 'email',
        display_name VARCHAR(120),
        target TEXT NOT NULL,
        branded BOOLEAN NOT NULL DEFAULT TRUE,
        include_pdf BOOLEAN NOT NULL DEFAULT TRUE,
        include_share_link BOOLEAN NOT NULL DEFAULT TRUE,
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        last_triggered_at TIMESTAMPTZ,
        failure_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_report_delivery_targets_user ON report_delivery_targets(user_id)`,
      );
      _q(
        `ALTER TABLE report_delivery_targets ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE`,
      );

      _q(`
      CREATE TABLE IF NOT EXISTS public_report_links (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        audit_id UUID NOT NULL UNIQUE REFERENCES audits(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
        slug VARCHAR(140) NOT NULL UNIQUE,
        public_token TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        last_accessed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_public_report_links_slug ON public_report_links(slug)`,
      );

      // Share links are now permanent — drop the NOT NULL constraint on expires_at
      _q(
        `ALTER TABLE public_report_links ALTER COLUMN expires_at DROP NOT NULL`,
      );

      // ─── IndexNow Submissions ─────────────────────────────────────────────────
      _q(`
      CREATE TABLE IF NOT EXISTS indexnow_submissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        urls JSONB NOT NULL DEFAULT '[]',
        submitted_count INTEGER NOT NULL DEFAULT 0,
        skipped_count INTEGER NOT NULL DEFAULT 0,
        error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_indexnow_submissions_user ON indexnow_submissions(user_id)`,
      );

      // ─── Agent Tasks (GuideBot task queue) ─────────────────────────────────
      _q(`
      CREATE TABLE IF NOT EXISTS agent_tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        task_type VARCHAR(60) NOT NULL,
        payload JSONB NOT NULL DEFAULT '{}',
        status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
        result JSONB,
        error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_agent_tasks_user_status ON agent_tasks(user_id, status)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_agent_tasks_pending ON agent_tasks(status, created_at) WHERE status = 'pending'`,
      );

      // ─── SSFR Audit Evidence ────────────────────────────────────────────────
      _q(`
      CREATE TABLE IF NOT EXISTS audit_evidence (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
        family VARCHAR(20) NOT NULL CHECK (family IN ('source', 'signal', 'fact', 'relationship')),
        evidence_key TEXT NOT NULL,
        value JSONB NOT NULL DEFAULT '{}',
        source TEXT NOT NULL DEFAULT 'scraper',
        status VARCHAR(20) NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'missing', 'invalid', 'partial')),
        confidence NUMERIC(5,2) DEFAULT 1.0,
        notes JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_audit_evidence_audit ON audit_evidence(audit_id)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_audit_evidence_family ON audit_evidence(audit_id, family)`,
      );

      // ── Reconcile audit_evidence: add columns used by SSFR pipeline ──
      // The legacy deterministic-pipeline definition (line ~1825) lacks these columns.
      // If the table was created from that definition first, these must be added.
      _q(`ALTER TABLE audit_evidence ADD COLUMN IF NOT EXISTS audit_id UUID`);
      _q(
        `ALTER TABLE audit_evidence ADD COLUMN IF NOT EXISTS family VARCHAR(20)`,
      );
      _q(
        `ALTER TABLE audit_evidence ADD COLUMN IF NOT EXISTS evidence_key TEXT`,
      );
      _q(
        `ALTER TABLE audit_evidence ADD COLUMN IF NOT EXISTS value JSONB DEFAULT '{}'`,
      );
      _q(
        `ALTER TABLE audit_evidence ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'scraper'`,
      );
      _q(
        `ALTER TABLE audit_evidence ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'present'`,
      );
      _q(
        `ALTER TABLE audit_evidence ADD COLUMN IF NOT EXISTS confidence NUMERIC(5,2) DEFAULT 1.0`,
      );
      _q(`ALTER TABLE audit_evidence ADD COLUMN IF NOT EXISTS notes JSONB`);
      _q(`ALTER TABLE audit_evidence ADD COLUMN IF NOT EXISTS evidence_id VARCHAR(20)`);
      _q(`ALTER TABLE audit_evidence ADD COLUMN IF NOT EXISTS entity_id TEXT`);
      _q(`ALTER TABLE audit_evidence ALTER COLUMN key DROP NOT NULL`);

      // ─── SSFR Rule Results ──────────────────────────────────────────────────
      _q(`
      CREATE TABLE IF NOT EXISTS audit_rule_results (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
        family VARCHAR(20) NOT NULL CHECK (family IN ('source', 'signal', 'fact', 'relationship')),
        rule_id TEXT NOT NULL,
        title TEXT NOT NULL,
        passed BOOLEAN NOT NULL DEFAULT FALSE,
        severity VARCHAR(12) NOT NULL DEFAULT 'medium' CHECK (severity IN ('critical', 'high', 'medium', 'low')),
        is_hard_blocker BOOLEAN NOT NULL DEFAULT FALSE,
        score_cap INTEGER,
        evidence_ids JSONB NOT NULL DEFAULT '[]',
        details JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_audit_rule_results_audit ON audit_rule_results(audit_id)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_audit_rule_results_blocker ON audit_rule_results(audit_id) WHERE is_hard_blocker = TRUE`,
      );

      // ── Reconcile audit_rule_results: add columns used by ruleEngine inserts ──
      // These columns exist in the legacy second definition but not in the primary one above.
      // ADD COLUMN IF NOT EXISTS is safe for both fresh and existing tables.
      // audit_id may be missing if the table was originally created with the legacy schema (audit_run_id).
      _q(
        `ALTER TABLE audit_rule_results ADD COLUMN IF NOT EXISTS audit_id UUID`,
      );
      _q(
        `ALTER TABLE audit_rule_results ADD COLUMN IF NOT EXISTS description TEXT`,
      );
      _q(
        `ALTER TABLE audit_rule_results ADD COLUMN IF NOT EXISTS score_impact NUMERIC(5,2) DEFAULT 0`,
      );
      _q(
        `ALTER TABLE audit_rule_results ADD COLUMN IF NOT EXISTS hard_blocker BOOLEAN DEFAULT FALSE`,
      );
      _q(
        `ALTER TABLE audit_rule_results ADD COLUMN IF NOT EXISTS evidence_ids_json JSONB DEFAULT '[]'::jsonb`,
      );
      _q(
        `ALTER TABLE audit_rule_results ADD COLUMN IF NOT EXISTS remediation_key VARCHAR(80)`,
      );
      _q(
        `ALTER TABLE audit_rule_results ADD COLUMN IF NOT EXISTS family VARCHAR(20)`,
      );
      _q(`ALTER TABLE audit_rule_results ADD COLUMN IF NOT EXISTS title TEXT`);
      _q(
        `ALTER TABLE audit_rule_results ADD COLUMN IF NOT EXISTS passed BOOLEAN DEFAULT FALSE`,
      );
      _q(
        `ALTER TABLE audit_rule_results ADD COLUMN IF NOT EXISTS severity VARCHAR(12) DEFAULT 'medium'`,
      );
      _q(
        `ALTER TABLE audit_rule_results ADD COLUMN IF NOT EXISTS is_hard_blocker BOOLEAN DEFAULT FALSE`,
      );
      _q(
        `ALTER TABLE audit_rule_results ADD COLUMN IF NOT EXISTS score_cap INTEGER`,
      );
      _q(
        `ALTER TABLE audit_rule_results ADD COLUMN IF NOT EXISTS evidence_ids JSONB DEFAULT '[]'`,
      );
      _q(
        `ALTER TABLE audit_rule_results ADD COLUMN IF NOT EXISTS details JSONB`,
      );
      _q(
        `ALTER TABLE audit_rule_results ADD COLUMN IF NOT EXISTS audit_run_id UUID`,
      );
      _q(
        `ALTER TABLE audit_rule_results ADD COLUMN IF NOT EXISTS details JSONB`,
      );

      // ── Fix evidence_ids column type: legacy schema created it as UUID[] but
      //    the rule engine stores string keys (e.g. 'organization_schema'), not UUIDs.
      //    Convert to JSONB so JSON.stringify(r.evidence_ids) inserts cleanly.
      _q(`
        DO $$ BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'audit_rule_results'
              AND column_name = 'evidence_ids'
              AND data_type = 'ARRAY'
          ) THEN
            ALTER TABLE audit_rule_results
              ALTER COLUMN evidence_ids DROP DEFAULT,
              ALTER COLUMN evidence_ids TYPE JSONB USING COALESCE(to_jsonb(evidence_ids), '[]'::jsonb),
              ALTER COLUMN evidence_ids SET DEFAULT '[]'::jsonb;
          END IF;
        END $$
      `);

      // ─── SSFR Fixpacks ─────────────────────────────────────────────────────
      _q(`
      CREATE TABLE IF NOT EXISTS audit_fixpacks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
        type VARCHAR(30) NOT NULL DEFAULT 'insight' CHECK (type IN ('insight', 'entity_patch', 'schema_fix', 'content_block', 'meta_fix')),
        title TEXT NOT NULL,
        summary TEXT,
        priority VARCHAR(12) NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
        assets JSONB NOT NULL DEFAULT '[]',
        auto_generatable BOOLEAN NOT NULL DEFAULT FALSE,
        verification_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'failed', 'skipped')),
        based_on_rule_ids JSONB NOT NULL DEFAULT '[]',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_audit_fixpacks_audit ON audit_fixpacks(audit_id)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_audit_fixpacks_priority ON audit_fixpacks(audit_id, priority)`,
      );
      _q(
        `ALTER TABLE audit_fixpacks ADD COLUMN IF NOT EXISTS audit_run_id UUID`,
      );
      // Seed personal organization/workspace for existing users (idempotent)
      _q(`
      INSERT INTO organizations (name, slug, owner_user_id, is_personal)
      SELECT
        COALESCE(NULLIF(u.name, ''), split_part(u.email, '@', 1) || '''s Organization') AS name,
        'personal-' || substr(replace(u.id::text, '-', ''), 1, 24) AS slug,
        u.id,
        TRUE
      FROM users u
      WHERE NOT EXISTS (
        SELECT 1 FROM organizations o WHERE o.owner_user_id = u.id AND o.is_personal = TRUE
      )
    `);

      _q(`
      INSERT INTO workspaces (organization_id, name, slug, created_by_user_id, is_default)
      SELECT o.id, 'Personal Workspace', 'default', o.owner_user_id, TRUE
      FROM organizations o
      WHERE o.is_personal = TRUE
        AND NOT EXISTS (
          SELECT 1 FROM workspaces w WHERE w.organization_id = o.id AND w.is_default = TRUE
        )
    `);

      _q(`
      INSERT INTO workspace_members (workspace_id, user_id, role)
      SELECT w.id, o.owner_user_id, 'owner'
      FROM organizations o
      JOIN workspaces w ON w.organization_id = o.id AND w.is_default = TRUE
      WHERE o.is_personal = TRUE
      ON CONFLICT (workspace_id, user_id) DO NOTHING
    `);

      // Backfill workspace_id on existing rows via user's default workspace
      _q(`
      UPDATE audits a
      SET workspace_id = wm.workspace_id
      FROM workspace_members wm
      JOIN workspaces w ON w.id = wm.workspace_id AND w.is_default = TRUE
      WHERE a.workspace_id IS NULL AND a.user_id = wm.user_id
    `);
      _q(`
      UPDATE competitor_tracking ct
      SET workspace_id = wm.workspace_id
      FROM workspace_members wm
      JOIN workspaces w ON w.id = wm.workspace_id AND w.is_default = TRUE
      WHERE ct.workspace_id IS NULL AND ct.user_id = wm.user_id
    `);
      _q(`
      UPDATE competitor_tracking
      SET next_monitor_at = NOW() + INTERVAL '24 hours'
      WHERE next_monitor_at IS NULL
    `);
      _q(
        `ALTER TABLE competitor_tracking ALTER COLUMN next_monitor_at SET DEFAULT (NOW() + INTERVAL '24 hours')`,
      );
      _q(`
      UPDATE citation_tests t
      SET workspace_id = wm.workspace_id
      FROM workspace_members wm
      JOIN workspaces w ON w.id = wm.workspace_id AND w.is_default = TRUE
      WHERE t.workspace_id IS NULL AND t.user_id = wm.user_id
    `);
      _q(`
      UPDATE scheduled_rescans sr
      SET workspace_id = wm.workspace_id
      FROM workspace_members wm
      JOIN workspaces w ON w.id = wm.workspace_id AND w.is_default = TRUE
      WHERE sr.workspace_id IS NULL AND sr.user_id = wm.user_id
    `);
      _q(`
      UPDATE api_keys ak
      SET workspace_id = wm.workspace_id
      FROM workspace_members wm
      JOIN workspaces w ON w.id = wm.workspace_id AND w.is_default = TRUE
      WHERE ak.workspace_id IS NULL AND ak.user_id = wm.user_id
    `);
      _q(`
      UPDATE webhooks wh
      SET workspace_id = wm.workspace_id
      FROM workspace_members wm
      JOIN workspaces w ON w.id = wm.workspace_id AND w.is_default = TRUE
      WHERE wh.workspace_id IS NULL AND wh.user_id = wm.user_id
    `);
      _q(`
      UPDATE user_branding ub
      SET workspace_id = wm.workspace_id
      FROM workspace_members wm
      JOIN workspaces w ON w.id = wm.workspace_id AND w.is_default = TRUE
      WHERE ub.workspace_id IS NULL AND ub.user_id = wm.user_id
    `);
      _q(`
      UPDATE public_report_links prl
      SET workspace_id = a.workspace_id
      FROM audits a
      WHERE prl.workspace_id IS NULL AND prl.audit_id = a.id
    `);

      _q(
        `CREATE INDEX IF NOT EXISTS idx_audits_workspace ON audits(workspace_id)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_competitor_tracking_workspace ON competitor_tracking(workspace_id)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_competitor_tracking_next_monitor ON competitor_tracking(next_monitor_at) WHERE monitoring_enabled = TRUE`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_citation_tests_workspace ON citation_tests(workspace_id)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_scheduled_rescans_workspace ON scheduled_rescans(workspace_id)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_api_keys_workspace ON api_keys(workspace_id)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_webhooks_workspace ON webhooks(workspace_id)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_report_delivery_targets_workspace ON report_delivery_targets(workspace_id)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_public_report_links_workspace ON public_report_links(workspace_id)`,
      );

      // ─── Niche Competitive Ranking Table ─────────────────────────────────────
      _q(`
      CREATE TABLE IF NOT EXISTS citation_niche_rankings (
        id VARCHAR(64) PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        target_url TEXT NOT NULL,
        brand_name TEXT NOT NULL,
        niche TEXT NOT NULL,
        niche_keywords TEXT[] DEFAULT '{}',
        target_rank INTEGER,
        in_top_50 BOOLEAN NOT NULL DEFAULT FALSE,
        in_top_100 BOOLEAN NOT NULL DEFAULT FALSE,
        top_50 JSONB NOT NULL DEFAULT '[]',
        top_100 JSONB NOT NULL DEFAULT '[]',
        ranking_model_id TEXT NOT NULL,
        ranking_model_short TEXT NOT NULL,
        ranking_model_role TEXT NOT NULL DEFAULT 'primary',
        citation_models_used JSONB NOT NULL DEFAULT '[]',
        scheduled_job_id UUID,
        ran_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_niche_rankings_user ON citation_niche_rankings(user_id)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_niche_rankings_url ON citation_niche_rankings(target_url)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_niche_rankings_ran_at ON citation_niche_rankings(ran_at DESC)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_niche_rankings_in_top50 ON citation_niche_rankings(in_top_50) WHERE in_top_50 = TRUE`,
      );

      // ─── GDPR fix: change citation_niche_rankings from SET NULL → CASCADE ──
      _q(`DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'citation_niche_rankings_user_id_fkey'
          AND table_name = 'citation_niche_rankings'
      ) THEN
        ALTER TABLE citation_niche_rankings DROP CONSTRAINT citation_niche_rankings_user_id_fkey;
        ALTER TABLE citation_niche_rankings
          ADD CONSTRAINT citation_niche_rankings_user_id_fkey
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
      END IF;
    END $$`);

      // ─── Scheduled Citation Ranking Jobs ─────────────────────────────────────
      _q(`
      CREATE TABLE IF NOT EXISTS citation_scheduled_jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        target_url TEXT NOT NULL,
        niche TEXT,
        niche_keywords TEXT[] DEFAULT '{}',
        interval_hours INTEGER NOT NULL DEFAULT 24,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        last_run_at TIMESTAMPTZ,
        next_run_at TIMESTAMPTZ,
        last_ranking_id VARCHAR(64),
        run_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_citation_sched_user ON citation_scheduled_jobs(user_id)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_citation_sched_active ON citation_scheduled_jobs(is_active) WHERE is_active = TRUE`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_citation_sched_next_run ON citation_scheduled_jobs(next_run_at ASC) WHERE is_active = TRUE`,
      );
      _q(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_user_branding_workspace ON user_branding(workspace_id)`,
      );

      _q(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'scheduled_rescans_user_id_url_key' AND conrelid = 'scheduled_rescans'::regclass
        ) THEN
          ALTER TABLE scheduled_rescans DROP CONSTRAINT scheduled_rescans_user_id_url_key;
        END IF;
      END $$;
    `);
      _q(`DROP INDEX IF EXISTS idx_scheduled_rescans_user_workspace_url`);
      _q(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_scheduled_rescans_user_ws_url ON scheduled_rescans(user_id, COALESCE(workspace_id, '00000000-0000-0000-0000-000000000000'::uuid), url)`,
      );

      _q(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'users_tier_allowed' AND conrelid = 'users'::regclass
        ) THEN
          ALTER TABLE users DROP CONSTRAINT users_tier_allowed;
        END IF;

        UPDATE users SET tier = 'observer' WHERE tier IN ('free', 'Free');
        UPDATE users SET tier = 'alignment' WHERE tier IN ('core', 'Core', 'Jump Start');
        UPDATE users SET tier = 'signal' WHERE tier IN ('premium', 'Premium', 'pro', 'Pro', 'enterprise', 'Enterprise', 'Agency');
        UPDATE users SET tier = 'scorefix' WHERE tier IN ('scorefix', 'scorefix', 'Score Fix', 'blockbuster', 'Blockbuster');

        IF EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'users_tier_canonical' AND conrelid = 'users'::regclass
        ) THEN
          ALTER TABLE users DROP CONSTRAINT users_tier_canonical;
        END IF;

        ALTER TABLE users ADD CONSTRAINT users_tier_canonical
          CHECK (tier IN ('observer', 'starter', 'alignment', 'signal', 'scorefix'));
      END $$;
    `);

      _q(`
      CREATE TABLE IF NOT EXISTS query_packs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        queries JSONB NOT NULL,
        tags TEXT[] DEFAULT '{}',
        client_name VARCHAR(255),
        execution_count INTEGER DEFAULT 0,
        last_executed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_query_packs_user ON query_packs(user_id)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_query_packs_workspace ON query_packs(workspace_id)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_query_packs_created ON query_packs(created_at DESC)`,
      );

      _q(`
      CREATE TABLE IF NOT EXISTS query_pack_executions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        query_pack_id UUID NOT NULL REFERENCES query_packs(id) ON DELETE CASCADE,
        citation_test_id UUID NOT NULL REFERENCES citation_tests(id) ON DELETE CASCADE,
        mention_rate_snapshot DECIMAL(5, 2),
        top_3_count INTEGER,
        executed_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_pack_executions_pack ON query_pack_executions(query_pack_id)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_pack_executions_test ON query_pack_executions(citation_test_id)`,
      );

      _q(`
      CREATE TABLE IF NOT EXISTS citation_evidences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        citation_result_id UUID NOT NULL REFERENCES citation_results(id) ON DELETE CASCADE,
        query_pack_id UUID REFERENCES query_packs(id) ON DELETE SET NULL,
        evidence_key VARCHAR(255) NOT NULL,
        confidence_score DECIMAL(3, 2) DEFAULT 0.85,
        curated BOOLEAN DEFAULT FALSE,
        curation_note TEXT,
        rev_cite_suggestions JSONB,
        starred BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(citation_result_id, evidence_key)
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_citation_evidences_result ON citation_evidences(citation_result_id)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_citation_evidences_pack ON citation_evidences(query_pack_id)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_citation_evidences_curated ON citation_evidences(curated) WHERE curated = TRUE`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_citation_evidences_starred ON citation_evidences(starred) WHERE starred = TRUE`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_citation_evidences_confidence ON citation_evidences(confidence_score DESC)`,
      );

      // ─── Auto Score Fix Jobs ──────────────────────────────────────────────────
      _q(`
      CREATE TABLE IF NOT EXISTS auto_score_fix_jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        audit_id UUID REFERENCES audits(id) ON DELETE SET NULL,
        target_url TEXT NOT NULL,
        vcs_provider VARCHAR(20) NOT NULL DEFAULT 'github',
        repo_owner TEXT NOT NULL,
        repo_name TEXT NOT NULL,
        repo_branch TEXT NOT NULL DEFAULT 'main',
        status VARCHAR(30) NOT NULL DEFAULT 'pending',
        credits_spent NUMERIC(12,2) NOT NULL DEFAULT 10,
        pr_number INTEGER,
        pr_url TEXT,
        pr_title TEXT,
        pr_body TEXT,
        fix_plan JSONB,
        evidence_snapshot JSONB,
        error_message TEXT,
        implementation_duration_minutes INTEGER,
        checks_status VARCHAR(32) NOT NULL DEFAULT 'unknown',
        github_pr_merged_at TIMESTAMPTZ,
        rescan_status VARCHAR(24) NOT NULL DEFAULT 'not_scheduled',
        rescan_scheduled_for TIMESTAMPTZ,
        rescan_started_at TIMESTAMPTZ,
        rescan_completed_at TIMESTAMPTZ,
        rescan_audit_id UUID REFERENCES audits(id) ON DELETE SET NULL,
        score_before NUMERIC(6,2),
        score_after NUMERIC(6,2),
        score_delta NUMERIC(6,2),
        expires_at TIMESTAMPTZ NOT NULL,
        approved_at TIMESTAMPTZ,
        rejected_at TIMESTAMPTZ,
        refund_processed_at TIMESTAMPTZ,
        refund_credits NUMERIC(12,2),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_asf_jobs_user ON auto_score_fix_jobs(user_id, created_at DESC)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_asf_jobs_status ON auto_score_fix_jobs(status)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_asf_jobs_expires ON auto_score_fix_jobs(expires_at) WHERE status IN ('pending_approval', 'pending')`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_asf_jobs_workspace ON auto_score_fix_jobs(workspace_id)`,
      );

      _q(
        `ALTER TABLE auto_score_fix_jobs ADD COLUMN IF NOT EXISTS implementation_duration_minutes INTEGER`,
      );
      _q(
        `ALTER TABLE auto_score_fix_jobs ADD COLUMN IF NOT EXISTS checks_status VARCHAR(32) NOT NULL DEFAULT 'unknown'`,
      );
      _q(
        `ALTER TABLE auto_score_fix_jobs ADD COLUMN IF NOT EXISTS github_pr_merged_at TIMESTAMPTZ`,
      );
      _q(
        `ALTER TABLE auto_score_fix_jobs ADD COLUMN IF NOT EXISTS rescan_status VARCHAR(24) NOT NULL DEFAULT 'not_scheduled'`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_asf_jobs_rescan_status ON auto_score_fix_jobs(rescan_status)`,
      );
      _q(
        `ALTER TABLE auto_score_fix_jobs ADD COLUMN IF NOT EXISTS rescan_scheduled_for TIMESTAMPTZ`,
      );
      _q(
        `ALTER TABLE auto_score_fix_jobs ADD COLUMN IF NOT EXISTS rescan_started_at TIMESTAMPTZ`,
      );
      _q(
        `ALTER TABLE auto_score_fix_jobs ADD COLUMN IF NOT EXISTS rescan_completed_at TIMESTAMPTZ`,
      );
      _q(
        `ALTER TABLE auto_score_fix_jobs ADD COLUMN IF NOT EXISTS rescan_audit_id UUID REFERENCES audits(id) ON DELETE SET NULL`,
      );
      _q(
        `ALTER TABLE auto_score_fix_jobs ADD COLUMN IF NOT EXISTS score_before NUMERIC(6,2)`,
      );
      _q(
        `ALTER TABLE auto_score_fix_jobs ADD COLUMN IF NOT EXISTS score_after NUMERIC(6,2)`,
      );
      _q(
        `ALTER TABLE auto_score_fix_jobs ADD COLUMN IF NOT EXISTS score_delta NUMERIC(6,2)`,
      );
      _q(
        `ALTER TABLE auto_score_fix_jobs ADD COLUMN IF NOT EXISTS deterministic_patches_count INTEGER DEFAULT 0`,
      );

      // ─── VCS Tokens (encrypted at rest) ──────────────────────────────────────
      _q(`
      CREATE TABLE IF NOT EXISTS vcs_tokens (
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider VARCHAR(20) NOT NULL,
        encrypted_token TEXT NOT NULL,
        token_hint VARCHAR(12) NOT NULL,
        scopes TEXT[],
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY(user_id, provider)
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_vcs_tokens_user ON vcs_tokens(user_id)`,
      );

      // ─── Visibility Snapshots (self-hosted tracker) ───────────────────────────
      _q(`
      CREATE TABLE IF NOT EXISTS visibility_snapshots (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        prompt TEXT NOT NULL,
        engine VARCHAR(64) NOT NULL,
        brand_found BOOLEAN NOT NULL DEFAULT FALSE,
        position INT,
        cited_urls TEXT[],
        competitors TEXT[],
        sentiment VARCHAR(32),
        raw_text TEXT,
        captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_vs_engine_time ON visibility_snapshots(engine, captured_at DESC)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_vs_brand_time ON visibility_snapshots(brand_found, captured_at DESC)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_vs_captured ON visibility_snapshots(captured_at DESC)`,
      );

      // ─── Fixpack completion tracking ─────────────────────────────────────────
      _q(`
      CREATE TABLE IF NOT EXISTS fixpack_status (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
        fixpack_id VARCHAR(128) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'open',
        owner VARCHAR(255),
        started_at TIMESTAMPTZ,
        validated_at TIMESTAMPTZ,
        re_audit_id UUID REFERENCES audits(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, audit_id, fixpack_id)
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_fixpack_status_user ON fixpack_status(user_id)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_fixpack_status_audit ON fixpack_status(audit_id)`,
      );
      _q(
        `ALTER TABLE fixpack_status ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMPTZ`,
      );
      _q(
        `ALTER TABLE fixpack_status ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ`,
      );
      _q(
        `ALTER TABLE fixpack_status ADD COLUMN IF NOT EXISTS reopened_at TIMESTAMPTZ`,
      );
      _q(
        `ALTER TABLE fixpack_status ADD COLUMN IF NOT EXISTS blocker_reason TEXT`,
      );
      _q(
        `ALTER TABLE fixpack_status ADD COLUMN IF NOT EXISTS lifecycle_state VARCHAR(32) NOT NULL DEFAULT 'opened'`,
      );
      _q(
        `ALTER TABLE fixpack_status ADD COLUMN IF NOT EXISTS verification_status VARCHAR(24) NOT NULL DEFAULT 'not_requested'`,
      );
      _q(
        `ALTER TABLE fixpack_status ADD COLUMN IF NOT EXISTS verification_notes TEXT`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_fixpack_status_lifecycle_state ON fixpack_status(lifecycle_state)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_fixpack_status_status ON fixpack_status(status)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_fixpack_status_verification_status ON fixpack_status(verification_status)`,
      );

      // ─── Deterministic audit pipeline tables ──────────────────────────────────
      _q(`
      CREATE TABLE IF NOT EXISTS audit_evidence (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        audit_run_id UUID NOT NULL,
        url TEXT,
        category VARCHAR(60) NOT NULL,
        key VARCHAR(80) NOT NULL,
        label VARCHAR(200) NOT NULL,
        value_json JSONB,
        source VARCHAR(120),
        selector VARCHAR(255),
        attribute VARCHAR(120),
        status VARCHAR(20) NOT NULL DEFAULT 'present',
        confidence NUMERIC(3,2) DEFAULT 1.0,
        notes_json JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_audit_evidence_run ON audit_evidence(audit_run_id)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_audit_evidence_url ON audit_evidence(url)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_audit_evidence_created ON audit_evidence(created_at DESC)`,
      );

      // NOTE: audit_rule_results is already created at line ~1315 with the
      // correct schema (audit_id FK, is_hard_blocker, evidence_ids, etc.).
      // Legacy duplicate definition removed to prevent schema confusion.
      // The ALTER TABLE reconciliation at line ~1030 adds any missing columns.
      _q(
        `CREATE INDEX IF NOT EXISTS idx_audit_rule_results_audit_id ON audit_rule_results(audit_id)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_audit_rule_results_created ON audit_rule_results(created_at DESC)`,
      );

      // NOTE: audit_score_snapshots is already created at line ~739 with the
      // correct schema (audit_id PK, prior_run_id, normalized_url, etc.).
      // Legacy duplicate definition removed to prevent schema confusion.
      _q(
        `CREATE INDEX IF NOT EXISTS idx_audit_score_snap_user ON audit_score_snapshots(user_id)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_audit_score_snap_url ON audit_score_snapshots(url)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_audit_score_snap_created ON audit_score_snapshots(created_at DESC)`,
      );

      _q(`
      CREATE TABLE IF NOT EXISTS fixpacks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        audit_run_id UUID NOT NULL,
        user_id UUID NOT NULL,
        title VARCHAR(200) NOT NULL,
        summary TEXT,
        priority INTEGER DEFAULT 0,
        type VARCHAR(60) NOT NULL,
        framework_targets JSONB DEFAULT '[]'::jsonb,
        auto_generatable BOOLEAN DEFAULT TRUE,
        estimated_lift_min NUMERIC(5,2) DEFAULT 0,
        estimated_lift_max NUMERIC(5,2) DEFAULT 0,
        evidence_ids_json JSONB DEFAULT '[]'::jsonb,
        rule_ids_json JSONB DEFAULT '[]'::jsonb,
        verification_checks JSONB DEFAULT '[]'::jsonb,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_fixpacks_run ON fixpacks(audit_run_id)`,
      );
      _q(`CREATE INDEX IF NOT EXISTS idx_fixpacks_user ON fixpacks(user_id)`);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_fixpacks_created ON fixpacks(created_at DESC)`,
      );

      _q(`
      CREATE TABLE IF NOT EXISTS fixpack_assets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        fixpack_id UUID NOT NULL REFERENCES fixpacks(id) ON DELETE CASCADE,
        asset_type VARCHAR(60) NOT NULL,
        label VARCHAR(200),
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_fixpack_assets_fp ON fixpack_assets(fixpack_id)`,
      );

      _q(`
      CREATE TABLE IF NOT EXISTS verification_runs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        prior_audit_run_id UUID,
        new_audit_run_id UUID,
        fixpack_ids JSONB DEFAULT '[]'::jsonb,
        checks_json JSONB DEFAULT '[]'::jsonb,
        verified_lift NUMERIC(5,2),
        blockers_cleared INTEGER DEFAULT 0,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_verification_runs_user ON verification_runs(user_id)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_verification_runs_created ON verification_runs(created_at DESC)`,
      );

      _q(`
      CREATE TABLE IF NOT EXISTS brag_trail (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        audit_run_id UUID NOT NULL,
        recommendation_id VARCHAR(80),
        build_source VARCHAR(60) NOT NULL DEFAULT 'rule_engine_v1',
        reference_ids JSONB DEFAULT '[]'::jsonb,
        audit_linkage VARCHAR(80),
        ground_output JSONB,
        confidence NUMERIC(3,2) DEFAULT 1.0,
        advisory_only BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_brag_trail_run ON brag_trail(audit_run_id)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_brag_trail_created ON brag_trail(created_at DESC)`,
      );

      // ── Cite Ledger — cryptographic hash chain for BRAG validation trail ──
      _q(`
      CREATE TABLE IF NOT EXISTS cite_ledger (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        audit_run_id UUID NOT NULL,
        sequence INTEGER NOT NULL,
        brag_id VARCHAR(80) NOT NULL,
        content_hash VARCHAR(128) NOT NULL,
        previous_hash VARCHAR(128) NOT NULL,
        chain_hash VARCHAR(128) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_cite_ledger_run ON cite_ledger(audit_run_id)`,
      );
      _q(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_cite_ledger_run_seq ON cite_ledger(audit_run_id, sequence)`,
      );
      _q(`ALTER TABLE cite_ledger ADD COLUMN IF NOT EXISTS entity_id TEXT`);
      _q(`ALTER TABLE cite_ledger ADD COLUMN IF NOT EXISTS evidence_id VARCHAR(20)`);

      _q(`
      CREATE TABLE IF NOT EXISTS trial_email_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        email_type VARCHAR(40) NOT NULL,
        sent_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, email_type)
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_trial_email_log_user ON trial_email_log(user_id)`,
      );

      _q(`
      CREATE TABLE IF NOT EXISTS rate_limit_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID,
        ip VARCHAR(100),
        endpoint VARCHAR(255),
        tier VARCHAR(30),
        blocked BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_rate_limit_events_created ON rate_limit_events(created_at DESC)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_rate_limit_events_user ON rate_limit_events(user_id)`,
      );

      // ─── Citation Intelligence Tables ─────────────────────────────────────────
      _q(`
      CREATE TABLE IF NOT EXISTS citation_mention_trends (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        test_id UUID REFERENCES citation_tests(id) ON DELETE SET NULL,
        mention_rate NUMERIC(5,2) NOT NULL,
        total_queries INTEGER NOT NULL,
        mentioned_count INTEGER NOT NULL,
        platform_breakdown JSONB NOT NULL DEFAULT '{}',
        sampled_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_cite_trends_user_url ON citation_mention_trends(user_id, url, sampled_at DESC)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_cite_trends_sampled ON citation_mention_trends(sampled_at DESC)`,
      );

      _q(`
      CREATE TABLE IF NOT EXISTS citation_competitor_share (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        competitor_name TEXT NOT NULL,
        mention_count INTEGER NOT NULL DEFAULT 0,
        total_queries INTEGER NOT NULL DEFAULT 0,
        platforms_present TEXT[] DEFAULT '{}',
        window_start TIMESTAMPTZ NOT NULL,
        window_end TIMESTAMPTZ NOT NULL,
        computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_cite_share_user_url ON citation_competitor_share(user_id, url, computed_at DESC)`,
      );

      _q(`
      CREATE TABLE IF NOT EXISTS citation_drop_alerts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        previous_mention_rate NUMERIC(5,2) NOT NULL,
        current_mention_rate NUMERIC(5,2) NOT NULL,
        drop_magnitude NUMERIC(5,2) NOT NULL,
        alert_type VARCHAR(30) NOT NULL DEFAULT 'mention_drop',
        dismissed BOOLEAN NOT NULL DEFAULT FALSE,
        dismissed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_cite_alerts_user ON citation_drop_alerts(user_id, dismissed, created_at DESC)`,
      );

      _q(`
      CREATE TABLE IF NOT EXISTS citation_cooccurrences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        brand_name TEXT NOT NULL,
        query_used TEXT NOT NULL,
        source_url TEXT NOT NULL,
        source_title TEXT,
        mention_context TEXT,
        has_link BOOLEAN NOT NULL DEFAULT FALSE,
        found_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_cite_cooccur_user_url ON citation_cooccurrences(user_id, url, found_at DESC)`,
      );

      _q(
        `ALTER TABLE citation_results ADD COLUMN IF NOT EXISTS mention_quality_score SMALLINT`,
      );

      // ─── SOC1 Compliance Tables ─────────────────────────────────────────
      _q(`
      CREATE TABLE IF NOT EXISTS security_audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
        actor_email VARCHAR(255),
        action VARCHAR(100) NOT NULL,
        category VARCHAR(50) NOT NULL,
        target_type VARCHAR(50),
        target_id TEXT,
        details JSONB DEFAULT '{}',
        ip VARCHAR(100),
        user_agent TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_sec_audit_log_created ON security_audit_log(created_at DESC)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_sec_audit_log_actor ON security_audit_log(actor_id, created_at DESC)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_sec_audit_log_action ON security_audit_log(action, created_at DESC)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_sec_audit_log_category ON security_audit_log(category, created_at DESC)`,
      );

      // ─── Brand Mention Tracker ───────────────────────────────────────────
      _q(`
      CREATE TABLE IF NOT EXISTS brand_mentions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        brand TEXT NOT NULL,
        domain TEXT NOT NULL DEFAULT '',
        source VARCHAR(50) NOT NULL,
        url TEXT NOT NULL,
        title TEXT,
        snippet TEXT,
        sentiment VARCHAR(10) DEFAULT 'neutral',
        detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, source, url)
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_brand_mentions_user_brand ON brand_mentions(user_id, LOWER(brand), detected_at DESC)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_brand_mentions_source ON brand_mentions(user_id, source)`,
      );

      // ─── Mention sentiment + KPI ─────────────────────────────────────────────
      _q(
        `ALTER TABLE brand_mentions ADD COLUMN IF NOT EXISTS sentiment VARCHAR(10) DEFAULT 'neutral'`,
      );
      _q(`
      CREATE TABLE IF NOT EXISTS mention_kpi_snapshots (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        brand TEXT NOT NULL,
        snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
        volume INTEGER NOT NULL DEFAULT 0,
        positive_count INTEGER NOT NULL DEFAULT 0,
        negative_count INTEGER NOT NULL DEFAULT 0,
        neutral_count INTEGER NOT NULL DEFAULT 0,
        net_sentiment_score FLOAT NOT NULL DEFAULT 0,
        brand_health_score FLOAT NOT NULL DEFAULT 0,
        source_count INTEGER NOT NULL DEFAULT 0,
        top_sources JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, brand, snapshot_date)
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_mention_kpi_user_brand ON mention_kpi_snapshots(user_id, LOWER(brand), snapshot_date DESC)`,
      );

      // ─── NER run entities ────────────────────────────────────────────────────
      _q(`
      CREATE TABLE IF NOT EXISTS ner_run_entities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        run_id UUID NOT NULL REFERENCES tracking_runs(id) ON DELETE CASCADE,
        entity_text TEXT NOT NULL,
        entity_type VARCHAR(20) NOT NULL,
        total_count INTEGER NOT NULL DEFAULT 1,
        is_target_brand BOOLEAN NOT NULL DEFAULT FALSE,
        result_count INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(run_id, entity_text)
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_ner_run_entities_run ON ner_run_entities(run_id)`,
      );

      // ─── SERP snapshots (structured SERP data per user/domain) ──────────────
      _q(`
      CREATE TABLE IF NOT EXISTS serp_snapshots (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        domain TEXT NOT NULL,
        query TEXT NOT NULL,
        snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
        organic_position INTEGER,
        featured_snippet BOOLEAN NOT NULL DEFAULT FALSE,
        knowledge_panel BOOLEAN NOT NULL DEFAULT FALSE,
        knowledge_panel_description TEXT,
        paa_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
        rich_results BOOLEAN NOT NULL DEFAULT FALSE,
        sitelinks BOOLEAN NOT NULL DEFAULT FALSE,
        scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, domain, snapshot_date)
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_serp_snapshots_user_domain ON serp_snapshots(user_id, LOWER(domain), snapshot_date DESC)`,
      );

      _q(
        `ALTER TABLE audits ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64)`,
      );

      // ─── MCP audit queue columns ────────────────────────────────────────────
      _q(
        `ALTER TABLE audits ADD COLUMN IF NOT EXISTS status VARCHAR(24) NOT NULL DEFAULT 'complete'`,
      );
      _q(`ALTER TABLE audits ADD COLUMN IF NOT EXISTS goal TEXT`);
      _q(`ALTER TABLE audits ADD COLUMN IF NOT EXISTS platform_focus JSONB`);
      _q(
        `ALTER TABLE audits ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_audits_status ON audits(status) WHERE status IN ('queued', 'scanning', 'analyzing')`,
      );

      // ─── Niche Discovery Jobs ───────────────────────────────────────────────
      _q(`
      CREATE TABLE IF NOT EXISTS niche_discovery_jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        workspace_id UUID NOT NULL,
        query TEXT NOT NULL,
        location TEXT NOT NULL DEFAULT '',
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        discovered_urls JSONB DEFAULT '[]'::jsonb,
        scheduled_count INTEGER DEFAULT 0,
        audited_count INTEGER DEFAULT 0,
        error TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_niche_discovery_user ON niche_discovery_jobs(user_id)`,
      );

      // ─── OAuth 2.0 Tables ────────────────────────────────────────────────────
      _q(`
      CREATE TABLE IF NOT EXISTS oauth_clients (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id VARCHAR(64) NOT NULL UNIQUE,
        client_secret_hash VARCHAR(128) NOT NULL,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(120) NOT NULL,
        redirect_uris JSONB NOT NULL DEFAULT '[]',
        scopes JSONB NOT NULL DEFAULT '[]',
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_oauth_clients_user ON oauth_clients(user_id)`,
      );
      _q(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_oauth_clients_client_id ON oauth_clients(client_id)`,
      );

      _q(`
      CREATE TABLE IF NOT EXISTS oauth_authorization_codes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code_hash VARCHAR(128) NOT NULL,
        client_id VARCHAR(64) NOT NULL,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        redirect_uri TEXT NOT NULL,
        scopes JSONB NOT NULL DEFAULT '[]',
        redeemed BOOLEAN NOT NULL DEFAULT FALSE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_oauth_codes_hash ON oauth_authorization_codes(code_hash)`,
      );

      _q(`
      CREATE TABLE IF NOT EXISTS oauth_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        token_hash VARCHAR(128) NOT NULL,
        client_id VARCHAR(64) NOT NULL,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        scopes JSONB NOT NULL DEFAULT '[]',
        revoked BOOLEAN NOT NULL DEFAULT FALSE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_oauth_tokens_hash ON oauth_tokens(token_hash)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user ON oauth_tokens(user_id)`,
      );

      // ─── Support tickets ──────────────────────────────────────────────────────
      _q(`
      CREATE TABLE IF NOT EXISTS support_tickets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ticket_number VARCHAR(16) NOT NULL UNIQUE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        subject VARCHAR(200) NOT NULL,
        category VARCHAR(32) NOT NULL DEFAULT 'general',
        priority VARCHAR(16) NOT NULL DEFAULT 'normal',
        status VARCHAR(32) NOT NULL DEFAULT 'open',
        description TEXT NOT NULL,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        resolved_at TIMESTAMPTZ
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets(user_id)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_support_tickets_number ON support_tickets(ticket_number)`,
      );

      _q(`
      CREATE TABLE IF NOT EXISTS support_ticket_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
        sender_type VARCHAR(16) NOT NULL DEFAULT 'user',
        sender_id UUID,
        message TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON support_ticket_messages(ticket_id)`,
      );

      // ── Agent task queue ──
      _q(`
      CREATE TABLE IF NOT EXISTS agent_tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        task_type VARCHAR(40) NOT NULL,
        payload JSONB NOT NULL DEFAULT '{}',
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        result JSONB,
        error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_agent_tasks_user ON agent_tasks(user_id)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_agent_tasks_status ON agent_tasks(status) WHERE status = 'pending'`,
      );

      // ── GitHub App installations ──
      _q(`
      CREATE TABLE IF NOT EXISTS github_app_installations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(255) NOT NULL,
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        installation_id INTEGER NOT NULL UNIQUE,
        account_login VARCHAR(255) NOT NULL,
        account_type VARCHAR(20) NOT NULL DEFAULT 'User',
        permissions JSONB NOT NULL DEFAULT '{}',
        repo_selection VARCHAR(20) NOT NULL DEFAULT 'all',
        suspended_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_github_app_inst_user ON github_app_installations(user_id)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_github_app_inst_workspace ON github_app_installations(workspace_id)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_github_app_inst_id ON github_app_installations(installation_id)`,
      );

      _q(`
      CREATE TABLE IF NOT EXISTS workspace_activity_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        type VARCHAR(80) NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_workspace_activity_ws ON workspace_activity_log(workspace_id, created_at DESC)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_workspace_activity_user ON workspace_activity_log(user_id, created_at DESC)`,
      );

      // ── Audit score timeline (Level 4 – Visibility Timeline) ─────────────────
      _q(`
      CREATE TABLE IF NOT EXISTS audit_score_timeline (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(255) NOT NULL,
        workspace_id UUID,
        url TEXT NOT NULL,
        score NUMERIC(5,2) NOT NULL,
        score_delta NUMERIC(6,2),
        event_type VARCHAR(50) NOT NULL DEFAULT 'manual_audit',
        event_label TEXT,
        audit_id UUID,
        fix_id UUID,
        captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_ast_user_url ON audit_score_timeline(user_id, url)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_ast_captured_at ON audit_score_timeline(captured_at DESC)`,
      );

      // ── Alert subscriptions (Level 4 – Alert Service) ────────────────────────
      _q(`
      CREATE TABLE IF NOT EXISTS alert_subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(255) NOT NULL,
        channel VARCHAR(20) NOT NULL,
        channel_config JSONB NOT NULL DEFAULT '{}',
        alert_types TEXT[] NOT NULL DEFAULT '{}',
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, channel)
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_alert_sub_user ON alert_subscriptions(user_id)`,
      );

      // ── In-app alert notifications (Level 4 – Alert Service) ─────────────────
      _q(`
      CREATE TABLE IF NOT EXISTS alert_notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(255) NOT NULL,
        alert_type VARCHAR(50) NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}',
        read_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_alert_notif_user ON alert_notifications(user_id, created_at DESC)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_alert_notif_unread ON alert_notifications(user_id) WHERE read_at IS NULL`,
      );

      // ── Fix outcomes / ROI tracking (Level 4 – Fix Learning) ─────────────────
      _q(`
      CREATE TABLE IF NOT EXISTS fix_outcomes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(255) NOT NULL,
        fix_type VARCHAR(50) NOT NULL,
        fix_subtype VARCHAR(100),
        expected_delta NUMERIC(6,2) NOT NULL,
        actual_delta NUMERIC(6,2) NOT NULL,
        roi_ratio NUMERIC(8,4) NOT NULL DEFAULT 0,
        url TEXT NOT NULL,
        captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_fix_outcomes_user ON fix_outcomes(user_id)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_fix_outcomes_type ON fix_outcomes(fix_type)`,
      );

      // ── Level 5: VaaS - Industry benchmarks ───────────────────────────────────
      _q(`
      CREATE TABLE IF NOT EXISTS industry_benchmarks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        category VARCHAR(100) NOT NULL,
        subcategory VARCHAR(100),
        avg_score NUMERIC(5,2) NOT NULL,
        p25 NUMERIC(5,2) NOT NULL DEFAULT 0,
        p50 NUMERIC(5,2) NOT NULL DEFAULT 0,
        p75 NUMERIC(5,2) NOT NULL DEFAULT 0,
        p90 NUMERIC(5,2) NOT NULL DEFAULT 0,
        sample_count INTEGER NOT NULL DEFAULT 0,
        computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_industry_benchmarks_category ON industry_benchmarks(category)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_industry_benchmarks_computed ON industry_benchmarks(computed_at DESC)`,
      );

      // ── Level 5: VaaS - Embeddable widget tokens ──────────────────────────────
      _q(`
      CREATE TABLE IF NOT EXISTS widget_embed_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        token VARCHAR(64) NOT NULL UNIQUE,
        label VARCHAR(120),
        url TEXT NOT NULL,
        config JSONB NOT NULL DEFAULT '{}',
        views INTEGER NOT NULL DEFAULT 0,
        last_viewed_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_widget_tokens_user ON widget_embed_tokens(user_id)`,
      );
      _q(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_widget_tokens_token ON widget_embed_tokens(token)`,
      );

      // ── Level 5: VaaS - Bulk fix jobs ─────────────────────────────────────────
      _q(`
      CREATE TABLE IF NOT EXISTS bulk_fix_jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        fix_type VARCHAR(50) NOT NULL DEFAULT 'schema',
        project_ids TEXT[] NOT NULL DEFAULT '{}',
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        progress JSONB NOT NULL DEFAULT '{"total":0,"completed":0,"failed":0,"results":[]}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_bulk_fix_jobs_user ON bulk_fix_jobs(user_id)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_bulk_fix_jobs_status ON bulk_fix_jobs(status, created_at DESC)`,
      );

      // ── V1 Infrastructure Tables (projects, issues, evidence, fixes, PRs) ──
      _q(`
      CREATE TABLE IF NOT EXISTS v1_projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL,
        domain TEXT NOT NULL,
        repo_owner TEXT,
        repo_name TEXT,
        repo_installation_id TEXT,
        auto_scan_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_v1_projects_org ON v1_projects(org_id)`,
      );
      _q(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_v1_projects_org_domain ON v1_projects(org_id, domain)`,
      );
      _q(
        `ALTER TABLE v1_projects ADD COLUMN IF NOT EXISTS auto_scan_enabled BOOLEAN NOT NULL DEFAULT FALSE`,
      );

      _q(`
      CREATE TABLE IF NOT EXISTS v1_audits (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID REFERENCES v1_projects(id) ON DELETE CASCADE,
        score INT,
        delta INT DEFAULT 0,
        status VARCHAR(20) NOT NULL DEFAULT 'queued',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_v1_audits_project ON v1_audits(project_id, created_at DESC)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_v1_audits_status ON v1_audits(status)`,
      );

      _q(`
      CREATE TABLE IF NOT EXISTS v1_audit_categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        audit_id UUID NOT NULL REFERENCES v1_audits(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        score INT NOT NULL DEFAULT 0
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_v1_audit_categories_audit ON v1_audit_categories(audit_id)`,
      );

      _q(`
      CREATE TABLE IF NOT EXISTS v1_issues (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        audit_id UUID NOT NULL REFERENCES v1_audits(id) ON DELETE CASCADE,
        severity VARCHAR(20) NOT NULL DEFAULT 'medium',
        title TEXT NOT NULL,
        impact_score INT DEFAULT 0,
        effort VARCHAR(20) DEFAULT 'medium',
        auto_fixable BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_v1_issues_audit ON v1_issues(audit_id)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_v1_issues_severity ON v1_issues(severity)`,
      );

      _q(`
      CREATE TABLE IF NOT EXISTS v1_evidence (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        issue_id UUID NOT NULL REFERENCES v1_issues(id) ON DELETE CASCADE,
        url TEXT,
        message TEXT,
        raw JSONB DEFAULT '{}'
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_v1_evidence_issue ON v1_evidence(issue_id)`,
      );

      _q(`
      CREATE TABLE IF NOT EXISTS v1_fixes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        issue_id UUID NOT NULL REFERENCES v1_issues(id) ON DELETE CASCADE,
        status VARCHAR(30) NOT NULL DEFAULT 'pending',
        expected_delta INT DEFAULT 0,
        actual_delta INT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
      _q(`CREATE INDEX IF NOT EXISTS idx_v1_fixes_issue ON v1_fixes(issue_id)`);
      _q(`CREATE INDEX IF NOT EXISTS idx_v1_fixes_status ON v1_fixes(status)`);

      _q(`
      CREATE TABLE IF NOT EXISTS v1_pull_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID REFERENCES v1_projects(id) ON DELETE CASCADE,
        fix_id UUID REFERENCES v1_fixes(id) ON DELETE SET NULL,
        pr_url TEXT,
        pr_number INT,
        status VARCHAR(20) NOT NULL DEFAULT 'open',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_v1_prs_project ON v1_pull_requests(project_id)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_v1_prs_status ON v1_pull_requests(status)`,
      );

      // ── Partnership agreements (dual-party signing + tamper-lock) ──────────
      _q(`
      CREATE TABLE IF NOT EXISTS partnership_agreements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        slug VARCHAR(120) UNIQUE NOT NULL,
        title VARCHAR(300) NOT NULL,
        terms_html TEXT NOT NULL,
        terms_hash VARCHAR(128) NOT NULL,
        party_a_name VARCHAR(200) NOT NULL,
        party_a_email VARCHAR(320) NOT NULL,
        party_a_phone VARCHAR(40),
        party_a_org VARCHAR(200),
        party_b_name VARCHAR(200) NOT NULL,
        party_b_email VARCHAR(320) NOT NULL,
        party_b_phone VARCHAR(40),
        party_b_org VARCHAR(200),
        status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','partially_signed','fully_signed','expired','revoked')),
        valid_until TIMESTAMPTZ,
        signing_deadline TIMESTAMPTZ NOT NULL,
        party_a_signed_at TIMESTAMPTZ,
        party_a_signature VARCHAR(200),
        party_a_ip INET,
        party_a_ua TEXT,
        party_b_signed_at TIMESTAMPTZ,
        party_b_signature VARCHAR(200),
        party_b_ip INET,
        party_b_ua TEXT,
        locked_at TIMESTAMPTZ,
        locked_hash VARCHAR(128),
        pdf_url TEXT,
        access_token VARCHAR(64),
        otp_code_hash VARCHAR(128),
        otp_party VARCHAR(1),
        otp_expires_at TIMESTAMPTZ,
        otp_attempts INT DEFAULT 0,
        reminders_sent JSONB DEFAULT '[]',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_agreements_slug ON partnership_agreements(slug)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_agreements_status ON partnership_agreements(status)`,
      );

      _q(`
      CREATE TABLE IF NOT EXISTS agreement_referral_links (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        agreement_slug VARCHAR(120) NOT NULL,
        code VARCHAR(20) UNIQUE NOT NULL,
        created_by VARCHAR(200),
        expires_at TIMESTAMPTZ,
        clicks INT DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_referral_links_code ON agreement_referral_links(code)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_referral_links_slug ON agreement_referral_links(agreement_slug)`,
      );

      _q(`
      CREATE TABLE IF NOT EXISTS agreement_referral_visits (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        link_code VARCHAR(20) NOT NULL,
        visitor_hash VARCHAR(64),
        referrer TEXT,
        visited_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_referral_visits_code ON agreement_referral_visits(link_code)`,
      );

      /* ── Score-improvement benchmarks (public proof) ───────────── */
      _q(`
      CREATE TABLE IF NOT EXISTS score_improvements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        url_hash VARCHAR(64) NOT NULL,
        first_audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
        latest_audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
        score_before INTEGER NOT NULL,
        score_after INTEGER NOT NULL,
        delta INTEGER NOT NULL,
        audit_count INTEGER NOT NULL DEFAULT 2,
        domain_category VARCHAR(100),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
      _q(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_score_improvements_user_url ON score_improvements(user_id, url_hash)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_score_improvements_delta ON score_improvements(delta DESC)`,
      );

      // ── Entity fingerprint system (per-user entity disambiguation) ────────
      _q(`
      CREATE TABLE IF NOT EXISTS entity_fingerprints (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        brand_name VARCHAR(200) NOT NULL,
        canonical_domain VARCHAR(255) NOT NULL,
        founder_name VARCHAR(200) NOT NULL DEFAULT '',
        social_handles JSONB NOT NULL DEFAULT '{}',
        wikidata_id VARCHAR(40) NOT NULL DEFAULT '',
        google_kg_id VARCHAR(60) NOT NULL DEFAULT '',
        schema_org_id TEXT NOT NULL DEFAULT '',
        product_category VARCHAR(120) NOT NULL DEFAULT '',
        description_keywords TEXT[] NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(user_id)
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_entity_fingerprints_user ON entity_fingerprints(user_id)`,
      );

      _q(`
      CREATE TABLE IF NOT EXISTS entity_blocklists (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        pattern TEXT NOT NULL,
        type VARCHAR(20) NOT NULL DEFAULT 'name',
        reason TEXT NOT NULL DEFAULT '',
        auto_detected BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_entity_blocklists_user ON entity_blocklists(user_id)`,
      );

      _q(`
      CREATE TABLE IF NOT EXISTS entity_audit_runs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        triggered_by VARCHAR(60) NOT NULL DEFAULT 'manual',
        queries_run INTEGER NOT NULL DEFAULT 0,
        citations_found INTEGER NOT NULL DEFAULT 0,
        false_positives_blocked INTEGER NOT NULL DEFAULT 0,
        anchor_score INTEGER NOT NULL DEFAULT 0,
        duration_ms INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_entity_audit_runs_user ON entity_audit_runs(user_id)`,
      );

      // Extend existing tables for entity-safe tracking
      // NOTE: DEFAULT NULL (not FALSE) so revalidation service can find un-processed rows via IS NULL.
      _q(
        `ALTER TABLE citation_results ADD COLUMN IF NOT EXISTS is_false_positive BOOLEAN`,
      );
      // Add brand_name to citation_tests (used by revalidation + false-positive gates)
      _q(
        `ALTER TABLE citation_tests ADD COLUMN IF NOT EXISTS brand_name TEXT`,
      );
      // Post-launch fix: remove erroneous DEFAULT FALSE from is_false_positive so
      // the revalidation service can detect un-processed rows via IS NULL.
      // Also reset rows that were silently defaulted to FALSE (never explicitly evaluated).
      _q(
        `ALTER TABLE citation_results ALTER COLUMN is_false_positive DROP DEFAULT`,
      );
      _q(
        `UPDATE citation_results SET is_false_positive = NULL WHERE is_false_positive = FALSE AND excerpt IS NOT NULL`,
      );
      _q(
        `ALTER TABLE competitor_tracking ADD COLUMN IF NOT EXISTS canonical_domain TEXT`,
      );
      _q(
        `ALTER TABLE competitor_tracking ADD COLUMN IF NOT EXISTS track_keywords JSONB DEFAULT '[]'`,
      );

      // ── Multi-tenant AI citation/mention tracker ──
      _q(`
      CREATE TABLE IF NOT EXISTS tenants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL DEFAULT 'Personal',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
      _q(`
      CREATE TABLE IF NOT EXISTS tenant_users (
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL DEFAULT 'owner',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (tenant_id, user_id)
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_tenant_users_user ON tenant_users(user_id)`,
      );
      _q(`
      CREATE TABLE IF NOT EXISTS tracking_projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        domain TEXT NOT NULL,
        competitor_domains JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_tracking_projects_tenant ON tracking_projects(tenant_id, created_at DESC)`,
      );
      _q(`
      CREATE TABLE IF NOT EXISTS tracking_queries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES tracking_projects(id) ON DELETE CASCADE,
        query TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_tracking_queries_project ON tracking_queries(project_id)`,
      );
      _q(`
      CREATE TABLE IF NOT EXISTS tracking_runs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES tracking_projects(id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL DEFAULT 'queued',
        total_queries INTEGER NOT NULL DEFAULT 0,
        completed_queries INTEGER NOT NULL DEFAULT 0,
        error_message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_tracking_runs_project ON tracking_runs(project_id, created_at DESC)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_tracking_runs_status ON tracking_runs(status)`,
      );
      _q(`
      CREATE TABLE IF NOT EXISTS tracking_results (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        run_id UUID NOT NULL REFERENCES tracking_runs(id) ON DELETE CASCADE,
        query_id UUID NOT NULL REFERENCES tracking_queries(id) ON DELETE CASCADE,
        model VARCHAR(80) NOT NULL,
        mentioned BOOLEAN NOT NULL DEFAULT FALSE,
        cited BOOLEAN NOT NULL DEFAULT FALSE,
        position INTEGER,
        raw_response TEXT,
        competitor_mentions JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_tracking_results_run ON tracking_results(run_id)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_tracking_results_query ON tracking_results(query_id)`,
      );
      _q(`
      CREATE TABLE IF NOT EXISTS tracking_citations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        result_id UUID NOT NULL REFERENCES tracking_results(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        domain TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_tracking_citations_result ON tracking_citations(result_id)`,
      );
      _q(`
      CREATE TABLE IF NOT EXISTS tracking_query_cache (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        query_hash VARCHAR(64) NOT NULL,
        model VARCHAR(80) NOT NULL,
        raw_response TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (query_hash, model)
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_tracking_qcache_hash ON tracking_query_cache(query_hash, model)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_tracking_qcache_expires ON tracking_query_cache(expires_at)`,
      );
      _q(`
      CREATE TABLE IF NOT EXISTS competitors (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        domain TEXT UNIQUE NOT NULL,
        first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_competitors_domain ON competitors(domain)`,
      );
      _q(`
      CREATE TABLE IF NOT EXISTS project_competitors (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES tracking_projects(id) ON DELETE CASCADE,
        competitor_id UUID NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
        score FLOAT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (project_id, competitor_id)
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_project_competitors_project ON project_competitors(project_id, score DESC)`,
      );
      _q(`
      CREATE TABLE IF NOT EXISTS competitor_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        run_id UUID NOT NULL REFERENCES tracking_runs(id) ON DELETE CASCADE,
        competitor_id UUID NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
        mentions INTEGER NOT NULL DEFAULT 0,
        citations INTEGER NOT NULL DEFAULT 0,
        avg_position FLOAT,
        UNIQUE (run_id, competitor_id)
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_competitor_metrics_run ON competitor_metrics(run_id)`,
      );
      _q(
        `CREATE INDEX IF NOT EXISTS idx_competitor_metrics_competitor ON competitor_metrics(competitor_id)`,
      );
      _q(`
      CREATE TABLE IF NOT EXISTS entity_snapshots (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        run_id UUID NOT NULL REFERENCES tracking_runs(id) ON DELETE CASCADE,
        query_id UUID NOT NULL REFERENCES tracking_queries(id) ON DELETE CASCADE,
        model TEXT NOT NULL,
        entity_detected BOOLEAN NOT NULL DEFAULT FALSE,
        entity_name TEXT,
        category TEXT,
        description TEXT,
        confidence FLOAT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (run_id, query_id, model)
      )
    `);
      _q(
        `CREATE INDEX IF NOT EXISTS idx_entity_snapshots_run ON entity_snapshots(run_id)`,
      );

      /* ── Dataset Pipeline (Audit-Verified) ── */
      _q(`
      CREATE TABLE IF NOT EXISTS dataset_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        vertical VARCHAR(30) NOT NULL CHECK (vertical IN ('ai_governance','incident_response','agentic_interaction')),
        stage VARCHAR(20) NOT NULL DEFAULT 'ingested' CHECK (stage IN ('ingested','annotated','synthesized','audited')),
        origin VARCHAR(12) NOT NULL DEFAULT 'real' CHECK (origin IN ('real','synthetic')),
        source_url TEXT NOT NULL DEFAULT '',
        title TEXT NOT NULL DEFAULT '',
        content TEXT NOT NULL DEFAULT '',
        labels JSONB NOT NULL DEFAULT '{}'::jsonb,
        ground_truth JSONB,
        audit_hash VARCHAR(64),
        provenance_jsonld JSONB,
        confidence FLOAT NOT NULL DEFAULT 0,
        human_reviewed BOOLEAN NOT NULL DEFAULT FALSE,
        tags TEXT[] NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
      _q(`CREATE INDEX IF NOT EXISTS idx_dataset_entries_user ON dataset_entries(user_id)`);
      _q(`CREATE INDEX IF NOT EXISTS idx_dataset_entries_vertical ON dataset_entries(vertical)`);
      _q(`CREATE INDEX IF NOT EXISTS idx_dataset_entries_stage ON dataset_entries(stage)`);
      _q(`CREATE INDEX IF NOT EXISTS idx_dataset_entries_origin ON dataset_entries(origin)`);
      _q(`CREATE INDEX IF NOT EXISTS idx_dataset_entries_audit_hash ON dataset_entries(audit_hash) WHERE audit_hash IS NOT NULL`);

      _q(`
      CREATE TABLE IF NOT EXISTS dataset_audit_proofs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        entry_id UUID NOT NULL REFERENCES dataset_entries(id) ON DELETE CASCADE,
        audit_hash VARCHAR(64) NOT NULL,
        algorithm VARCHAR(10) NOT NULL DEFAULT 'sha256',
        content_snapshot TEXT NOT NULL,
        labels_snapshot TEXT NOT NULL,
        provenance_jsonld JSONB NOT NULL DEFAULT '{}'::jsonb,
        issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (entry_id, audit_hash)
      )
    `);
      _q(`CREATE INDEX IF NOT EXISTS idx_dataset_audit_proofs_entry ON dataset_audit_proofs(entry_id)`);
      _q(`CREATE INDEX IF NOT EXISTS idx_dataset_audit_proofs_hash ON dataset_audit_proofs(audit_hash)`);

      // ── Evidence-first architecture: entities, drift_scores, job_queue_log ──
      _q(`
      CREATE TABLE IF NOT EXISTS entities (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        domain TEXT,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
      _q(`CREATE INDEX IF NOT EXISTS idx_entities_user ON entities(user_id)`);
      _q(`CREATE INDEX IF NOT EXISTS idx_entities_domain ON entities(domain)`);
      _q(`
      CREATE TABLE IF NOT EXISTS drift_scores (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
        score INTEGER NOT NULL DEFAULT 0,
        evidence_count INTEGER NOT NULL DEFAULT 0,
        score_source VARCHAR(40) NOT NULL DEFAULT 'evidence',
        drift_delta NUMERIC,
        computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
      _q(`CREATE INDEX IF NOT EXISTS idx_drift_scores_entity ON drift_scores(entity_id, computed_at DESC)`);
      _q(`
      CREATE TABLE IF NOT EXISTS job_queue_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        url TEXT NOT NULL,
        entity_id TEXT REFERENCES entities(id) ON DELETE SET NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'queued',
        error_message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      )
    `);
      _q(`CREATE INDEX IF NOT EXISTS idx_job_queue_status ON job_queue_log(status, created_at DESC)`);

      // ── TRUTH CONTRACT: Audit Evidence Entries ────────────────────────────
      // This table is the canonical truth store for all engine outputs.
      // Every AuditEvidenceEntry row is hash-chained to detect post-write mutation.
      // No score or response may be produced without a corresponding row here.
      _q(`
      CREATE TABLE IF NOT EXISTS audit_evidence_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        url TEXT NOT NULL,
        audit_id TEXT NOT NULL,
        source_type TEXT NOT NULL,
        source_metadata JSONB NOT NULL DEFAULT '{}',
        raw_evidence TEXT NOT NULL,
        raw_evidence_hash TEXT NOT NULL,
        extracted_signal TEXT NOT NULL,
        confidence_score FLOAT NOT NULL DEFAULT 0,
        confidence_basis TEXT NOT NULL DEFAULT '',
        interpretation TEXT NOT NULL DEFAULT '',
        entity_refs JSONB NOT NULL DEFAULT '[]',
        related_findings JSONB NOT NULL DEFAULT '[]',
        tags JSONB NOT NULL DEFAULT '[]',
        ledger_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
      `);
      _q(`CREATE INDEX IF NOT EXISTS idx_aee_audit ON audit_evidence_entries(audit_id, created_at ASC)`);
      _q(`CREATE INDEX IF NOT EXISTS idx_aee_url ON audit_evidence_entries(url, created_at DESC)`);
      _q(`CREATE INDEX IF NOT EXISTS idx_aee_source ON audit_evidence_entries(source_type)`);
      _q(`CREATE UNIQUE INDEX IF NOT EXISTS idx_aee_ledger_hash ON audit_evidence_entries(ledger_hash)`);
      if (_ddl.length > 0) {
        console.log(
          `[DB] Executing ${_ddl.length} DDL statements in single batch...`,
        );
        await client.query(_ddl.join(";\n"));
      }

      // Migration complete
      markDatabaseAvailable();
      migrationsRan = true;
      console.log("[DB] Database migrations complete");
      return;
    } catch (err) {
      lastError = err;
      const msg = (err as any).message || String(err);
      console.warn(
        `[DB] Migration error on attempt ${attempt}/${maxRetries}: ${msg.substring(0, 80)}`,
      );

      if (!shouldRetryDatabaseError(err)) {
        console.warn(
          "[DB] Migration retries skipped because the database reported a quota exhaustion error",
        );
        break;
      }

      if (attempt < maxRetries) {
        const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 15000);
        console.log(`[DB] Retrying in ${delayMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    } finally {
      if (client) client.release();
    }
  }

  // After all retries exhausted
  markDatabaseUnavailable(lastError);
  console.error(
    "[DB] Migration failed after all retries:",
    (lastError as any).message,
  );
  // Don't throw - allow server to start even if migrations fail
  // This allows recovery when DB is temporarily overloaded
  migrationsRan = true;
}

export const pool = new Proxy({} as Pool, {
  get(_target, prop) {
    const real = getPool() as any;
    return real[prop];
  },
});

export async function getConnection(): Promise<PoolClient> {
  return getPool().connect();
}

export async function executeTransaction<T>(
  callback: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore rollback errors */
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function healthCheck(): Promise<boolean> {
  if (!dbConfigured) return false;
  // If DB was marked unavailable, allow periodic retry after TTL
  if (!databaseAvailable && lastDatabaseError) {
    const elapsed = Date.now() - lastDatabaseErrorTime;
    if (elapsed < DB_UNAVAILABLE_RETRY_MS) {
      return false;
    }
    // TTL expired - attempt a real connection check
  }
  try {
    await getPool().query("SELECT 1");
    markDatabaseAvailable();
    return true;
  } catch (err) {
    markDatabaseUnavailable(err);
    return false;
  }
}

export async function closePool(): Promise<void> {
  if (poolInstance) await poolInstance.end();
  poolInstance = null;
}
