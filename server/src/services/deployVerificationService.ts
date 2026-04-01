import { getPool } from './postgresql.js';
import { getLatestAuditBaseline } from './auditTruthService.js';

export interface DeployVerificationJob {
  id: string;
  user_id: string;
  workspace_id: string;
  url: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  source: string;
  provider: string | null;
  environment: string | null;
  deployment_id: string | null;
  commit_sha: string | null;
  baseline_audit_id: string | null;
  baseline_score: number | null;
  verification_audit_id: string | null;
  score_after: number | null;
  score_delta: number | null;
  scheduled_for: string;
  started_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  last_error: string | null;
  trigger_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type DeployVerificationHooks = {
  onCompleted?: (payload: {
    userId: string;
    workspaceId: string;
    jobId: string;
    url: string;
    auditId: string;
    scoreBefore: number | null;
    scoreAfter: number | null;
    scoreDelta: number | null;
  }) => Promise<void> | void;
  onFailed?: (payload: {
    userId: string;
    workspaceId: string;
    jobId: string;
    url: string;
    reason: string;
  }) => Promise<void> | void;
};

let deployVerificationIntervalId: ReturnType<typeof setInterval> | null = null;
let deployVerificationLoopRunning = false;
const DEPLOY_VERIFICATION_INTERVAL_MS = 60_000;

function normalizeUrl(input: string): string {
  return String(input || '').trim().toLowerCase();
}

export async function createDeployVerificationJob(args: {
  userId: string;
  workspaceId: string;
  url: string;
  scheduledFor?: string | null;
  source?: string;
  provider?: string | null;
  environment?: string | null;
  deploymentId?: string | null;
  commitSha?: string | null;
  triggerMetadata?: Record<string, unknown>;
  baselineAuditId?: string | null;
}): Promise<DeployVerificationJob> {
  const pool = getPool();
  const normalizedUrl = normalizeUrl(args.url);
  const scheduledFor = args.scheduledFor ? new Date(args.scheduledFor) : new Date();
  if (Number.isNaN(scheduledFor.getTime())) {
    throw new Error('scheduledFor must be a valid ISO timestamp');
  }

  let baselineAuditId = args.baselineAuditId || null;
  let baselineScore: number | null = null;
  if (!baselineAuditId) {
    const baseline = await getLatestAuditBaseline(args.userId, args.workspaceId, normalizedUrl);
    baselineAuditId = baseline.auditId;
    baselineScore = baseline.score;
  } else {
    const baselineRow = await pool.query(
      `SELECT visibility_score
       FROM audits
       WHERE id = $1 AND user_id = $2 AND workspace_id = $3
       LIMIT 1`,
      [baselineAuditId, args.userId, args.workspaceId]
    );
    const parsed = Number(baselineRow.rows[0]?.visibility_score);
    baselineScore = Number.isFinite(parsed) ? parsed : null;
  }

  const { rows } = await pool.query(
    `INSERT INTO deploy_verification_jobs (
       user_id, workspace_id, url, status, source, provider, environment,
       deployment_id, commit_sha, baseline_audit_id, baseline_score, scheduled_for, trigger_metadata
     ) VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING *`,
    [
      args.userId,
      args.workspaceId,
      normalizedUrl,
      String(args.source || 'manual_deploy_verification').slice(0, 64),
      args.provider ? String(args.provider).slice(0, 32) : null,
      args.environment ? String(args.environment).slice(0, 32) : null,
      args.deploymentId ? String(args.deploymentId).slice(0, 120) : null,
      args.commitSha ? String(args.commitSha).slice(0, 120) : null,
      baselineAuditId,
      baselineScore,
      scheduledFor.toISOString(),
      JSON.stringify(args.triggerMetadata || {}),
    ]
  );

  return rows[0];
}

export async function listDeployVerificationJobs(userId: string, workspaceId: string, limit = 50): Promise<DeployVerificationJob[]> {
  const pool = getPool();
  const cappedLimit = Math.min(200, Math.max(1, Number(limit || 50)));
  const { rows } = await pool.query(
    `SELECT *
     FROM deploy_verification_jobs
     WHERE user_id = $1 AND workspace_id = $2
     ORDER BY created_at DESC
     LIMIT $3`,
    [userId, workspaceId, cappedLimit]
  );
  return rows;
}

export async function updateDeployVerificationJob(
  id: string,
  userId: string,
  workspaceId: string,
  updates: { scheduledFor?: string; status?: 'pending' | 'cancelled' }
): Promise<DeployVerificationJob | null> {
  const sets: string[] = ['updated_at = NOW()'];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (typeof updates.scheduledFor === 'string') {
    const scheduledFor = new Date(updates.scheduledFor);
    if (Number.isNaN(scheduledFor.getTime())) {
      throw new Error('scheduledFor must be a valid ISO timestamp');
    }
    sets.push(`scheduled_for = $${paramIndex}`);
    values.push(scheduledFor.toISOString());
    paramIndex += 1;
  }

  if (updates.status) {
    sets.push(`status = $${paramIndex}`);
    values.push(updates.status);
    paramIndex += 1;
  }

  values.push(id, userId, workspaceId);
  const { rows } = await getPool().query(
    `UPDATE deploy_verification_jobs
     SET ${sets.join(', ')}
     WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1} AND workspace_id = $${paramIndex + 2}
     RETURNING *`,
    values
  );

  return rows[0] || null;
}

export async function processDueDeployVerificationJobs(
  analyzeInternally: (userId: string, workspaceId: string, url: string) => Promise<string | null>,
  hooks?: DeployVerificationHooks,
): Promise<number> {
  const pool = getPool();
  let processed = 0;

  const { rows } = await pool.query(
    `SELECT *
     FROM deploy_verification_jobs
     WHERE status IN ('pending', 'failed', 'running')
       AND scheduled_for <= NOW()
     ORDER BY scheduled_for ASC
     LIMIT 10`
  );

  for (const row of rows) {
    const claimed = await pool.query(
      `UPDATE deploy_verification_jobs
       SET status = 'running',
           started_at = COALESCE(started_at, NOW()),
           last_error = NULL,
           updated_at = NOW()
       WHERE id = $1
         AND status IN ('pending', 'failed', 'running')
       RETURNING id`,
      [row.id]
    );
    if (!claimed.rowCount) continue;

    try {
      const auditId = await analyzeInternally(String(row.user_id), String(row.workspace_id), String(row.url));
      if (!auditId) {
        throw new Error('Deploy verification scan did not return an audit ID');
      }

      const scoreRows = await pool.query(
        `SELECT visibility_score FROM audits WHERE id = $1 LIMIT 1`,
        [auditId]
      );
      const scoreAfterRaw = Number(scoreRows.rows[0]?.visibility_score);
      const scoreAfter = Number.isFinite(scoreAfterRaw) ? scoreAfterRaw : null;
      const baselineScore = row.baseline_score == null ? null : Number(row.baseline_score);
      const scoreDelta = baselineScore == null || scoreAfter == null
        ? null
        : Math.round((scoreAfter - baselineScore) * 100) / 100;

      await pool.query(
        `UPDATE deploy_verification_jobs
         SET status = 'completed',
             verification_audit_id = $2,
             score_after = $3,
             score_delta = $4,
             completed_at = NOW(),
             failed_at = NULL,
             updated_at = NOW()
         WHERE id = $1`,
        [row.id, auditId, scoreAfter, scoreDelta]
      );

      await hooks?.onCompleted?.({
        userId: String(row.user_id),
        workspaceId: String(row.workspace_id),
        jobId: String(row.id),
        url: String(row.url),
        auditId,
        scoreBefore: baselineScore,
        scoreAfter,
        scoreDelta,
      });
      processed += 1;
    } catch (error: any) {
      const reason = String(error?.message || 'Deploy verification failed').slice(0, 500);
      await pool.query(
        `UPDATE deploy_verification_jobs
         SET status = 'failed',
             failed_at = NOW(),
             last_error = $2,
             updated_at = NOW()
         WHERE id = $1`,
        [row.id, reason]
      );
      await hooks?.onFailed?.({
        userId: String(row.user_id),
        workspaceId: String(row.workspace_id),
        jobId: String(row.id),
        url: String(row.url),
        reason,
      });
    }
  }

  return processed;
}

export function startDeployVerificationLoop(
  analyzeInternally: (userId: string, workspaceId: string, url: string) => Promise<string | null>,
  hooks?: DeployVerificationHooks,
): void {
  if (deployVerificationIntervalId) return;

  const tick = async () => {
    if (deployVerificationLoopRunning) return;
    deployVerificationLoopRunning = true;
    try {
      await processDueDeployVerificationJobs(analyzeInternally, hooks);
    } catch (error: any) {
      console.error('[DeployVerification] loop error:', error?.message || error);
    } finally {
      deployVerificationLoopRunning = false;
    }
  };

  void tick();
  deployVerificationIntervalId = setInterval(() => {
    void tick();
  }, DEPLOY_VERIFICATION_INTERVAL_MS);
  console.log('[DeployVerification] loop started (interval: 60s)');
}
