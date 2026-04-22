/**
 * MCP Audit Processor
 *
 * Processes audits queued by MCP and WebMCP endpoints.
 * Transitions: queued → scanning → analyzing → complete (or error)
 *
 * The analysis function is injected by server.ts after startup
 * (same pattern as scheduledRescanService).
 */
import { getPool } from './postgresql.js';

// ── Injected analyzer ────────────────────────────────────────────────────────

type AnalyzeFn = (userId: string, workspaceId: string, url: string) => Promise<string | null>;

let _analyzeFn: AnalyzeFn | null = null;

export function setMcpAnalyzer(fn: AnalyzeFn): void {
  _analyzeFn = fn;
}

// ── Process a single queued audit ────────────────────────────────────────────

export async function processQueuedAudit(auditId: string, userId: string, workspaceId: string, url: string): Promise<void> {
  const pool = getPool();

  if (!_analyzeFn) {
    console.error(`[mcp-audit] No analyzer configured, cannot process ${auditId}`);
    await pool.query(
      `UPDATE audits SET status = 'error', updated_at = NOW() WHERE id = $1`,
      [auditId],
    );
    return;
  }

  try {
    // Mark as scanning
    await pool.query(
      `UPDATE audits SET status = 'scanning', updated_at = NOW() WHERE id = $1`,
      [auditId],
    );

    // Run the analysis pipeline (scrape + AI)
    await pool.query(
      `UPDATE audits SET status = 'analyzing', updated_at = NOW() WHERE id = $1`,
      [auditId],
    );

    const resultAuditId = await _analyzeFn(userId, workspaceId, url);

    if (resultAuditId) {
      // analyzeInternally persists a NEW audit row - copy its result back to the queued row
      const { rows } = await pool.query(
        `SELECT visibility_score, result, tier_at_analysis FROM audits WHERE id = $1`,
        [resultAuditId],
      );

      if (rows.length) {
        await pool.query(
          `UPDATE audits SET
             status = 'complete',
             visibility_score = $2,
             result = $3,
             tier_at_analysis = $4,
             updated_at = NOW()
           WHERE id = $1`,
          [auditId, rows[0].visibility_score, rows[0].result, rows[0].tier_at_analysis],
        );

        // Remove the duplicate row created by analyzeInternally (if different from queued ID)
        if (resultAuditId !== auditId) {
          await pool.query(`DELETE FROM audits WHERE id = $1`, [resultAuditId]).catch(() => { });
        }
      } else {
        await pool.query(
          `UPDATE audits SET status = 'error', updated_at = NOW() WHERE id = $1`,
          [auditId],
        );
      }
    } else {
      await pool.query(
        `UPDATE audits SET status = 'error', updated_at = NOW() WHERE id = $1`,
        [auditId],
      );
    }
  } catch (err: any) {
    console.error(`[mcp-audit] Failed to process ${auditId}: ${err.message}`);
    await pool.query(
      `UPDATE audits SET status = 'error', updated_at = NOW() WHERE id = $1`,
      [auditId],
    ).catch(() => { });
  }
}

// ── Background loop: pick up orphaned queued audits ──────────────────────────

let _loopTimeout: ReturnType<typeof setTimeout> | null = null;

// Auto-disable after repeated schema errors (missing table/column)
const MAX_CONSECUTIVE_ERRORS = 5;
let consecutiveErrors = 0;

function isSchemaError(msg: string): boolean {
  return /does not exist|undefined column|relation .* does not exist/i.test(msg);
}

function isConnectionError(msg: string): boolean {
  return /EDBHANDLEREXITED|connection (closed|lost|refused)|connection to database closed|failed to connect|no available server/i.test(msg);
}

export function startMcpAuditLoop(): void {
  if (_loopTimeout) return;
  consecutiveErrors = 0;
  scheduleNextRun();
  console.log('[mcp-audit] Background queue processor started (30s interval)');
}

export function stopMcpAuditLoop(): void {
  if (_loopTimeout) {
    clearTimeout(_loopTimeout);
    _loopTimeout = null;
  }
}

function scheduleNextRun(): void {
  _loopTimeout = setTimeout(async () => {
    try {
      await processOrphanedAudits();
      consecutiveErrors = 0;
    } catch (err: any) {
      const msg = err?.message || '';
      if (isConnectionError(msg)) {
        console.error(`[mcp-audit] Connection error detected: ${msg}`);
        // Reset pool on connection error so next attempt gets fresh connection
        const { resetPool } = await import('./postgresql.js');
        resetPool();
        consecutiveErrors++;
        if (consecutiveErrors >= 3) {
          console.error(`[mcp-audit] Disabling loop after ${consecutiveErrors} connection failures`);
          stopMcpAuditLoop();
          return;
        }
      } else if (isSchemaError(msg)) {
        consecutiveErrors++;
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          console.error(`[mcp-audit] Disabling loop after ${consecutiveErrors} consecutive schema errors: ${msg}`);
          stopMcpAuditLoop();
          return;
        }
      } else {
        // Non-schema, non-connection errors reset counter but continue
        console.error(`[mcp-audit] Loop error: ${msg}`);
      }
    }
    if (_loopTimeout !== null) scheduleNextRun();
  }, 30_000);
}

async function processOrphanedAudits(): Promise<void> {
  if (!_analyzeFn) return;

  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id, user_id, workspace_id, url
     FROM audits
     WHERE status = 'queued'
       AND created_at > NOW() - INTERVAL '10 minutes'
     ORDER BY created_at ASC
     LIMIT 5
     FOR UPDATE SKIP LOCKED`,
  );

  for (const row of rows) {
    await processQueuedAudit(row.id, row.user_id, row.workspace_id, row.url);
  }

  if (rows.length > 0) {
    console.log(`[mcp-audit] Processed ${rows.length} orphaned queued audit(s)`);
  }
}
