import { getPool } from './postgresql.js';
import { normalizeTrackedUrl } from '../utils/normalizeUrl.js';
import type { AuditTruthHistoryEntry, ContradictionReport, GeoSignalProfile } from '../../../shared/types.js';

function extractTruthEntry(row: any): AuditTruthHistoryEntry {
  const geo = row?.geo_signal_profile && typeof row.geo_signal_profile === 'object'
    ? row.geo_signal_profile as GeoSignalProfile
    : null;
  const contradictions = row?.contradiction_report && typeof row.contradiction_report === 'object'
    ? row.contradiction_report as ContradictionReport
    : null;

  return {
    audit_id: String(row.audit_id),
    url: String(row.url || ''),
    created_at: String(row.created_at),
    visibility_score: Number(row.visibility_score || 0),
    execution_class: typeof row.execution_class === 'string' ? row.execution_class : null,
    geo_signal_profile: geo,
    contradiction_report: contradictions,
  };
}

export async function listAuditTruthHistory(
  userId: string,
  workspaceId: string,
  targetUrl: string,
  limit = 25,
): Promise<{
  normalizedTarget: string;
  total: number;
  entries: AuditTruthHistoryEntry[];
  summary: {
    firstScore: number | null;
    latestScore: number | null;
    scoreDelta: number | null;
    latestExecutionClass: string | null;
    latestInformationGain: string | null;
    latestBlockerCount: number;
  };
}> {
  const normalizedTarget = normalizeTrackedUrl(targetUrl);
  const cappedLimit = Math.min(100, Math.max(1, Number(limit || 25)));
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT audit_id, prior_run_id, url, visibility_score, execution_class,
            geo_signal_profile, contradiction_report, created_at
     FROM audit_score_snapshots
     WHERE user_id = $1 AND workspace_id IS NOT DISTINCT FROM $2
       AND normalized_url = $3
     ORDER BY created_at DESC
     LIMIT $4`,
    [userId, workspaceId, normalizedTarget, cappedLimit]
  );

  const matching = rows.map(extractTruthEntry);

  const chronological = [...matching].reverse();
  const first = chronological[0] || null;
  const latest = matching[0] || null;
  const firstScore = first ? Number(first.visibility_score) : null;
  const latestScore = latest ? Number(latest.visibility_score) : null;

  return {
    normalizedTarget,
    total: matching.length,
    entries: matching,
    summary: {
      firstScore,
      latestScore,
      scoreDelta: firstScore === null || latestScore === null ? null : Math.round((latestScore - firstScore) * 100) / 100,
      latestExecutionClass: latest?.execution_class || null,
      latestInformationGain: latest?.geo_signal_profile?.information_gain || null,
      latestBlockerCount: Number(latest?.contradiction_report?.blocker_count || 0),
    },
  };
}

export async function getLatestAuditBaseline(
  userId: string,
  workspaceId: string,
  targetUrl: string,
): Promise<{ auditId: string | null; score: number | null }> {
  const normalizedTarget = normalizeTrackedUrl(targetUrl);
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT audit_id, visibility_score
     FROM audit_score_snapshots
     WHERE user_id = $1 AND workspace_id IS NOT DISTINCT FROM $2
       AND normalized_url = $3
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, workspaceId, normalizedTarget]
  );

  const match = rows[0];
  if (!match) {
    return { auditId: null, score: null };
  }

  const parsedScore = Number(match.visibility_score);
  return {
    auditId: String(match.audit_id),
    score: Number.isFinite(parsedScore) ? parsedScore : null,
  };
}
