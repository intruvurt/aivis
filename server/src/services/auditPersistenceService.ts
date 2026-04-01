import { getPool } from './postgresql.js';
import { computeContentHash } from './securityAuditService.js';
import { normalizeTrackedUrl } from '../utils/normalizeUrl.js';
import { checkAuditMilestones, checkScoreImprovementMilestone } from './milestoneService.js';
import type { ContradictionReport, GeoSignalProfile } from '../../../shared/types.js';

function extractExecutionClass(result: Record<string, unknown>): string | null {
  const integrity = result.analysis_integrity;
  if (!integrity || typeof integrity !== 'object') return null;
  const executionClass = (integrity as Record<string, unknown>).execution_class;
  return typeof executionClass === 'string' ? executionClass : null;
}

function extractGeoSignalProfile(result: Record<string, unknown>): GeoSignalProfile | null {
  const geo = result.geo_signal_profile;
  return geo && typeof geo === 'object' ? geo as GeoSignalProfile : null;
}

function extractContradictionReport(result: Record<string, unknown>): ContradictionReport | null {
  const contradictions = result.contradiction_report;
  return contradictions && typeof contradictions === 'object' ? contradictions as ContradictionReport : null;
}

export async function persistAuditRecord(args: {
  userId: string;
  workspaceId?: string | null;
  url: string;
  visibilityScore: number;
  result: Record<string, unknown>;
  tierAtAnalysis?: string | null;
  createdAt?: Date;
}): Promise<string> {
  const pool = getPool();
  const normalizedUrl = normalizeTrackedUrl(args.url);
  const createdAt = args.createdAt || new Date();
  const executionClass = extractExecutionClass(args.result);
  const geoSignalProfile = extractGeoSignalProfile(args.result);
  const contradictionReport = extractContradictionReport(args.result);

  // --- Step 1: Insert the audit row with content hash (CRITICAL — must not be blocked by snapshot logic) ---
  const contentHash = computeContentHash(args.result);
  let auditInsertRows: Array<{ id: string }>;
  try {
    const auditInsert = await pool.query(
      `INSERT INTO audits (user_id, workspace_id, url, tier_at_analysis, visibility_score, result, content_hash, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        args.userId,
        args.workspaceId || null,
        args.url,
        args.tierAtAnalysis || null,
        args.visibilityScore,
        JSON.stringify(args.result),
        contentHash,
        createdAt.toISOString(),
      ]
    );
    auditInsertRows = auditInsert.rows;
  } catch (insertErr: any) {
    // 42703 = undefined_column: a required column is missing (migration not yet applied).
    // Fall back to minimal known-safe column set so audits are always persisted.
    if (insertErr?.code === '42703') {
      console.warn('[persistAudit] Full insert failed (missing column), retrying with minimal columns:', insertErr.message);
      const fallback = await pool.query(
        `INSERT INTO audits (user_id, url, visibility_score, result, created_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [args.userId, args.url, args.visibilityScore, JSON.stringify(args.result), createdAt.toISOString()]
      );
      auditInsertRows = fallback.rows;
    } else {
      throw insertErr;
    }
  }
  const auditId = String(auditInsertRows[0]?.id || '');
  if (!auditId) {
    throw new Error('Audit insert did not return an id');
  }

  // --- Step 2: Insert snapshot (non-critical — must not prevent audit_id from being returned) ---
  try {
    let priorRunId: string | null = null;
    try {
      const priorRunQuery = await pool.query(
        `SELECT audit_id
         FROM audit_score_snapshots
         WHERE user_id = $1
           AND workspace_id IS NOT DISTINCT FROM $2
           AND normalized_url = $3
         ORDER BY created_at DESC
         LIMIT 1`,
        [args.userId, args.workspaceId || null, normalizedUrl]
      );
      priorRunId = priorRunQuery.rows[0]?.audit_id ? String(priorRunQuery.rows[0].audit_id) : null;
    } catch (priorErr: any) {
      console.warn('[persistAudit] Prior-run lookup failed (non-fatal):', priorErr?.message);
    }

    await pool.query(
      `INSERT INTO audit_score_snapshots (
         audit_id, prior_run_id, user_id, workspace_id, url, normalized_url,
         visibility_score, execution_class, information_gain, contradiction_status,
         blocker_count, geo_signal_profile, contradiction_report, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        auditId,
        priorRunId,
        args.userId,
        args.workspaceId || null,
        args.url,
        normalizedUrl,
        args.visibilityScore,
        executionClass,
        geoSignalProfile?.information_gain || null,
        contradictionReport?.status || null,
        Number(contradictionReport?.blocker_count || 0),
        geoSignalProfile ? JSON.stringify(geoSignalProfile) : null,
        contradictionReport ? JSON.stringify(contradictionReport) : null,
        createdAt.toISOString(),
      ]
    );
  } catch (snapErr: any) {
    console.warn('[persistAudit] Snapshot insert failed (non-fatal, audit row saved):', snapErr?.message);
  }

  // --- Step 3: Check milestones in background (non-critical) ---
  try {
    checkAuditMilestones(args.userId).catch(() => {});

    // Score improvement check: compare to prior audit for same URL
    const priorScoreRes = await pool.query(
      `SELECT visibility_score FROM audits
       WHERE user_id = $1 AND url = $2 AND id != $3
       ORDER BY created_at DESC LIMIT 1`,
      [args.userId, args.url, auditId],
    );
    if (priorScoreRes.rows.length > 0) {
      const prevScore = Number(priorScoreRes.rows[0].visibility_score || 0);
      checkScoreImprovementMilestone(args.userId, prevScore, args.visibilityScore).catch(() => {});
    }
  } catch {
    // Milestones are non-critical
  }

  return auditId;
}
