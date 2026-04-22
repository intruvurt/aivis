import { getPool } from './postgresql.js';
import { randomUUID } from 'crypto';
import { readdir, readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

export type DeterministicStage =
    | 'queued'
    | 'fetched'
    | 'parsed'
    | 'entities'
    | 'citations'
    | 'scored'
    | 'finalized';

let contractTablesEnsured = false;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrationSanityChecks(): Promise<{
    pass: boolean;
    hasBlocked000Prefix: boolean;
    duplicatePrefixes: string[];
    strictlyOrdered: boolean;
    constraintSafetyViolations: string[];
}> {
    const migrationsDir = path.resolve(__dirname, '../migrations');
    const entries = await readdir(migrationsDir, { withFileTypes: true });
    const sqlFiles = entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
        .map((entry) => entry.name)
        .sort((a, b) => a.localeCompare(b));

    const executableSqlFiles = sqlFiles.filter((name) => !name.endsWith('.RETIRED.sql'));
    const hasBlocked000Prefix = executableSqlFiles.some((name) => /^000_/i.test(name));

    const numbered = executableSqlFiles
        .map((name) => ({
            name,
            prefix: (/^(\d+)_/.exec(name)?.[1] || ''),
        }))
        .filter((entry) => entry.prefix.length > 0);

    const prefixCounts = new Map<string, number>();
    for (const entry of numbered) {
        prefixCounts.set(entry.prefix, (prefixCounts.get(entry.prefix) || 0) + 1);
    }

    const duplicatePrefixes = Array.from(prefixCounts.entries())
        .filter(([, count]) => count > 1)
        .map(([prefix]) => prefix)
        .sort((a, b) => Number(a) - Number(b));

    const numericOrder = numbered.map((entry) => Number(entry.prefix));
    const sortedNumericOrder = [...numericOrder].sort((a, b) => a - b);
    const strictlyOrdered = numericOrder.every((value, idx) => value === sortedNumericOrder[idx]);

    const addConstraintMap = new Map<string, string[]>();
    const droppedConstraints = new Set<string>();
    for (const fileName of executableSqlFiles) {
        const content = await readFile(path.join(migrationsDir, fileName), 'utf8');

        const addMatches = content.matchAll(/\bADD\s+CONSTRAINT\s+([a-zA-Z0-9_]+)/gi);
        for (const match of addMatches) {
            const constraint = String(match[1] || '').toLowerCase();
            if (!constraint) continue;
            const files = addConstraintMap.get(constraint) || [];
            files.push(fileName);
            addConstraintMap.set(constraint, files);
        }

        const dropMatches = content.matchAll(/\bDROP\s+CONSTRAINT\s+IF\s+EXISTS\s+([a-zA-Z0-9_]+)/gi);
        for (const match of dropMatches) {
            const constraint = String(match[1] || '').toLowerCase();
            if (!constraint) continue;
            droppedConstraints.add(constraint);
        }
    }

    const constraintSafetyViolations = Array.from(addConstraintMap.entries())
        .filter(([constraint, files]) => files.length > 1 && !droppedConstraints.has(constraint))
        .map(([constraint, files]) => `${constraint} (${files.join(', ')})`)
        .sort();

    const pass =
        !hasBlocked000Prefix &&
        duplicatePrefixes.length === 0 &&
        strictlyOrdered &&
        constraintSafetyViolations.length === 0;

    return {
        pass,
        hasBlocked000Prefix,
        duplicatePrefixes,
        strictlyOrdered,
        constraintSafetyViolations,
    };
}

async function safeExec(sql: string): Promise<void> {
    try {
        await getPool().query(sql);
    } catch {
        // Best-effort hardening; do not break runtime when a managed DB blocks DDL.
    }
}

export async function ensureDeterministicContractTables(): Promise<void> {
    if (contractTablesEnsured) return;

    await safeExec(`
    CREATE TABLE IF NOT EXISTS analysis_stage_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      run_id UUID NOT NULL,
      stage TEXT NOT NULL,
      status TEXT NOT NULL,
      event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
    await safeExec(`CREATE INDEX IF NOT EXISTS idx_analysis_stage_events_run ON analysis_stage_events(run_id, event_timestamp)`);

    await safeExec(`
    CREATE TABLE IF NOT EXISTS analysis_fix_plans (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      run_id UUID,
      previous_run_id UUID,
      user_id UUID,
      workspace_id UUID,
      url TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      actions JSONB NOT NULL DEFAULT '[]'::jsonb,
      generated_patch JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
    await safeExec(`CREATE INDEX IF NOT EXISTS idx_analysis_fix_plans_run ON analysis_fix_plans(run_id, created_at DESC)`);

    await safeExec(`ALTER TABLE ingestion_jobs ADD COLUMN IF NOT EXISTS run_id UUID`);
    await safeExec(`CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_run_id ON ingestion_jobs(run_id)`);
    await safeExec(`ALTER TABLE extracted_entities ADD COLUMN IF NOT EXISTS run_id UUID`);
    await safeExec(`CREATE INDEX IF NOT EXISTS idx_extracted_entities_run_id ON extracted_entities(run_id)`);
    await safeExec(`ALTER TABLE citations ADD COLUMN IF NOT EXISTS run_id UUID`);
    await safeExec(`CREATE INDEX IF NOT EXISTS idx_citations_run_id ON citations(run_id)`);

    contractTablesEnsured = true;
}

export async function recordStageEvent(args: {
    runId: string;
    stage: DeterministicStage;
    status: 'pending' | 'running' | 'complete' | 'failed';
    payload?: Record<string, unknown>;
    timestamp?: number;
}): Promise<void> {
    await ensureDeterministicContractTables();

    await getPool().query(
        `INSERT INTO analysis_stage_events (run_id, stage, status, event_timestamp, payload)
     VALUES ($1::uuid, $2, $3, to_timestamp($4 / 1000.0), $5::jsonb)`,
        [
            args.runId,
            args.stage,
            args.status,
            Number.isFinite(args.timestamp) ? Number(args.timestamp) : Date.now(),
            JSON.stringify(args.payload || {}),
        ],
    );
}

export function computeDeterministicDelta(currentResult: any, previousSnapshot: any): {
    scoreDiff: number;
    entityDiff: { added: string[]; removed: string[]; changed: string[] };
    conflictsResolved: number;
} {
    const currentScore = Number(currentResult?.visibility_score || currentResult?.score || 0);
    const previousScore = Number(previousSnapshot?.visibility_score || previousSnapshot?.score || 0);

    const currentEntities = new Set<string>((currentResult?.brand_entities || []).map((v: unknown) => String(v).trim().toLowerCase()).filter(Boolean));
    const previousEntities = new Set<string>((previousSnapshot?.brand_entities || []).map((v: unknown) => String(v).trim().toLowerCase()).filter(Boolean));

    const added: string[] = [];
    const removed: string[] = [];
    for (const ent of currentEntities) if (!previousEntities.has(ent)) added.push(ent);
    for (const ent of previousEntities) if (!currentEntities.has(ent)) removed.push(ent);

    const prevConflictCount = Number(previousSnapshot?.contradiction_report?.blocker_count || 0);
    const currentConflictCount = Number(currentResult?.contradiction_report?.blocker_count || 0);

    return {
        scoreDiff: currentScore - previousScore,
        entityDiff: {
            added,
            removed,
            changed: [],
        },
        conflictsResolved: Math.max(0, prevConflictCount - currentConflictCount),
    };
}

export async function runProductionHardChecks(): Promise<{
    ok: boolean;
    checks: Record<string, unknown>;
}> {
    await ensureDeterministicContractTables();
    const pool = getPool();
    const migrationSanity = await runMigrationSanityChecks();

    const extRes = await pool.query(`SELECT extname FROM pg_extension WHERE extname IN ('pgcrypto')`);
    const tableRes = await pool.query(`
    SELECT
      to_regclass('public.analysis_results') AS analysis_results,
      to_regclass('public.analysis_cache') AS analysis_cache,
      to_regclass('public.analysis_runs') AS analysis_runs,
      to_regclass('public.extracted_entities') AS extracted_entities
  `);
    const hashRes = await pool.query(`SELECT COUNT(*)::int AS invalid_hash_rows FROM analysis_results WHERE char_length(url_hash) <> 64`);
    const rlsRes = await pool.query(`
    SELECT relname, relrowsecurity
    FROM pg_class
    WHERE relname IN ('audits','analysis_results','analysis_runs')
  `);
    const queueDepthRes = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE status IN ('queued', 'processing'))::int AS active_jobs,
      COUNT(*) FILTER (WHERE status='processing' AND started_at < NOW() - INTERVAL '5 minutes')::int AS stuck_jobs,
      COUNT(*) FILTER (WHERE status IN ('queued','processing') AND retry_count >= max_retries)::int AS retry_exhausted
    FROM ingestion_jobs
  `);
    const expiredCacheRes = await pool.query(`SELECT COUNT(*)::int AS expired_cache_rows FROM analysis_cache WHERE expires_at < NOW()`);

    const hasPgcrypto = extRes.rows.some((r) => r.extname === 'pgcrypto');
    const tableRow = tableRes.rows[0] || {};
    const hasAllTables =
        !!tableRow.analysis_results &&
        !!tableRow.analysis_cache &&
        !!tableRow.analysis_runs &&
        !!tableRow.extracted_entities;

    const invalidHashRows = Number(hashRes.rows[0]?.invalid_hash_rows || 0);
    const rlsFailures = rlsRes.rows.filter((r) => r.relrowsecurity === false).map((r) => r.relname);
    const queueRow = queueDepthRes.rows[0] || {};
    const stuckJobs = Number(queueRow.stuck_jobs || 0);
    const retryExhausted = Number(queueRow.retry_exhausted || 0);
    const activeJobs = Number(queueRow.active_jobs || 0);
    const expiredCacheRows = Number(expiredCacheRes.rows[0]?.expired_cache_rows || 0);
    const queueDepthThreshold = Math.max(1, Number(process.env.DETERMINISM_QUEUE_DEPTH_THRESHOLD || 250));

    const checks = {
        schema_integrity: {
            pgcrypto: hasPgcrypto,
            tables_present: hasAllTables,
            invalid_url_hash_rows: invalidHashRows,
            pass: hasPgcrypto && hasAllTables && invalidHashRows === 0,
        },
        migration_sanity: {
            ...migrationSanity,
            pass: migrationSanity.pass,
        },
        rls_guard: {
            failing_tables: rlsFailures,
            pass: rlsFailures.length === 0,
        },
        ingestion_liveness: {
            active_jobs: activeJobs,
            queue_depth_threshold: queueDepthThreshold,
            stuck_jobs: stuckJobs,
            retry_exhausted: retryExhausted,
            pass: activeJobs < queueDepthThreshold && stuckJobs === 0 && retryExhausted === 0,
        },
        cache_health: {
            expired_rows: expiredCacheRows,
            pass: expiredCacheRows < 1000,
        },
    };

    const ok =
        checks.schema_integrity.pass &&
        checks.migration_sanity.pass &&
        checks.rls_guard.pass &&
        checks.ingestion_liveness.pass &&
        checks.cache_health.pass;

    return { ok, checks };
}

export async function createFixPlanRecord(args: {
    runId?: string;
    previousRunId?: string;
    userId: string;
    workspaceId?: string | null;
    url: string;
    actions: Array<{ type: string; value: unknown }>;
}): Promise<{ id: string; status: string }> {
    await ensureDeterministicContractTables();

    const suggestedPatch = {
        generated_at: new Date().toISOString(),
        changes: args.actions.map((a) => ({
            type: a.type,
            value: a.value,
        })),
    };

    const res = await getPool().query(
        `INSERT INTO analysis_fix_plans (run_id, previous_run_id, user_id, workspace_id, url, status, actions, generated_patch)
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, 'pending', $6::jsonb, $7::jsonb)
     RETURNING id, status`,
        [
            args.runId || null,
            args.previousRunId || null,
            args.userId,
            args.workspaceId || null,
            args.url,
            JSON.stringify(args.actions || []),
            JSON.stringify(suggestedPatch),
        ],
    );

    return {
        id: String(res.rows[0]?.id || randomUUID()),
        status: String(res.rows[0]?.status || 'pending'),
    };
}
