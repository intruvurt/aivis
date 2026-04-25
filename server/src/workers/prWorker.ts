/**
 * PR Worker - BullMQ worker that creates GitHub pull requests from generated fixes.
 * Uses the GitHub App service for authenticated PR creation.
 */
import { Worker } from 'bullmq';
import { getBullMQConnection } from '../infra/queues/connection.js';
import { getPool } from '../services/postgresql.js';
import { createPRViaApp, isGitHubAppConfigured } from '../services/githubAppService.js';
import type { PRJobData } from '../infra/queues/prQueue.js';

let workerInstance: Worker<PRJobData> | null = null;

async function processPRJob(data: PRJobData): Promise<void> {
  const pool = getPool();
  const evidenceBlock = data.evidenceContext
    ? `\n\n### Worker Handoff Evidence Context\n- handoff_trace: ${data.evidenceContext.handoffTraceId || 'unknown'}\n- audit_id: ${data.evidenceContext.auditId || 'unknown'}\n- source_url: ${data.evidenceContext.sourceUrl || 'unknown'}\n- visibility_score: ${data.evidenceContext.visibilityScore ?? 'unknown'}\n- evidence_count: ${data.evidenceContext.evidenceCount ?? 'unknown'}\n- BRAG findings/rejected: ${data.evidenceContext.bragFindingsCount ?? 'unknown'} / ${data.evidenceContext.bragRejectedCount ?? 'unknown'}\n- BRAG coverage_ratio: ${data.evidenceContext.bragCoverageRatio ?? 'unknown'}\n- cite_ledger_entries: ${data.evidenceContext.citeLedgerCount ?? 'unknown'}\n- root_hash: ${data.evidenceContext.rootHash || 'unknown'}\n- gate_version: ${data.evidenceContext.gateVersion || 'unknown'}\n- recommendation_count: ${data.evidenceContext.recommendationCount ?? 'unknown'}\n${data.evidenceContext.topFindingIds?.length ? `- top_finding_ids: ${data.evidenceContext.topFindingIds.slice(0, 5).join(', ')}\n` : ''}${data.evidenceContext.topFindingTitles?.length ? `- top_finding_titles: ${data.evidenceContext.topFindingTitles.slice(0, 3).join(' | ')}\n` : ''}${data.evidenceContext.topRecommendationTitles?.length ? `- top_recommendations: ${data.evidenceContext.topRecommendationTitles.slice(0, 3).join(' | ')}\n` : ''}`
    : '';

  if (!isGitHubAppConfigured()) {
    await pool.query(
      `UPDATE v1_fixes SET status = 'failed', updated_at = NOW()
       WHERE issue_id = $1 AND status = 'pr_queued'`,
      [data.fixId]
    );
    throw new Error('GitHub App not configured');
  }

  // Create PR via GitHub App
  const result = await createPRViaApp({
    installationId: data.installationId,
    owner: data.repoOwner,
    repo: data.repoName,
    baseBranch: data.baseBranch,
    title: data.title,
    body: `${data.body}${evidenceBlock}`,
    files: data.files.map((f) => ({ ...f, operation: 'update' as const })),
  });

  // Store PR record
  await pool.query(
    `INSERT INTO v1_pull_requests (project_id, fix_id, pr_url, pr_number, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'open', NOW(), NOW())`,
    [data.projectId, data.fixId, result.pr_url, result.pr_number]
  );

  // Update fix status
  await pool.query(
    `UPDATE v1_fixes SET status = 'pr_open', updated_at = NOW()
     WHERE issue_id = $1 AND status = 'pr_queued'`,
    [data.fixId]
  );
}

export function startPRWorker(): void {
  const connection = getBullMQConnection();
  if (!connection) {
    console.log('[PRWorker] Redis not configured - PR worker disabled');
    return;
  }
  if (workerInstance) return;

  workerInstance = new Worker<PRJobData>('pr', async (job) => {
    console.log(`[PRWorker] Processing PR job ${job.id} for fix ${job.data.fixId}`);
    await processPRJob(job.data);
    console.log(`[PRWorker] Completed PR job ${job.id}`);
  }, {
    connection,
    concurrency: 2,
    limiter: { max: 5, duration: 60_000 },
  });

  workerInstance.on('failed', (job, err) => {
    console.error(`[PRWorker] Job ${job?.id} failed:`, err.message);
  });

  console.log('[PRWorker] PR worker started');
}
