/**
 * Scheduler + Event Engine
 *
 * Cron-based audit scheduling for all active projects.
 * Webhook event handlers for GitHub PR merged → re-audit, deploy hooks → re-scan.
 */
import cron from 'node-cron';
import { getPool } from '../services/postgresql.js';
import { enqueueAuditJob } from '../infra/queues/auditQueue.js';

let schedulerStarted = false;

/**
 * Enqueue audits for all active projects that haven't been audited recently.
 * Runs every 6 hours by default.
 */
async function enqueueAllProjectsForAudit(): Promise<void> {
  const pool = getPool();

  // Find projects that haven't been audited in the last 6 hours
  const { rows: projects } = await pool.query(`
    SELECT p.id, p.domain, p.org_id
    FROM v1_projects p
    WHERE NOT EXISTS (
      SELECT 1 FROM v1_audits a
      WHERE a.project_id = p.id
        AND a.created_at > NOW() - INTERVAL '6 hours'
    )
    ORDER BY p.created_at ASC
    LIMIT 50
  `);

  if (projects.length === 0) return;

  console.log(`[Scheduler] Enqueuing audits for ${projects.length} projects`);

  for (const project of projects) {
    try {
      // Find a user in this org to run the audit as
      const { rows: members } = await pool.query(
        `SELECT u.id FROM users u
         JOIN organizations o ON o.owner_user_id = u.id
         WHERE o.id = $1
         LIMIT 1`,
        [project.org_id]
      );

      if (!members.length) continue;

      await enqueueAuditJob({
        url: project.domain.startsWith('http') ? project.domain : `https://${project.domain}`,
        userId: members[0].id,
        priority: 'normal',
      });
    } catch (err: any) {
      console.warn(`[Scheduler] Failed to enqueue audit for project ${project.id}: ${err.message}`);
    }
  }
}

/**
 * Handle GitHub PR merged event — triggers re-audit for the project.
 */
export async function handlePRMerged(payload: {
  projectId: string;
  prUrl: string;
  mergedBy?: string;
}): Promise<void> {
  const pool = getPool();

  // Update PR status
  await pool.query(
    `UPDATE v1_pull_requests SET status = 'merged', updated_at = NOW()
     WHERE pr_url = $1`,
    [payload.prUrl]
  );

  // Find the project and trigger re-audit
  const { rows } = await pool.query(
    `SELECT p.id, p.domain, p.org_id FROM v1_projects p WHERE p.id = $1`,
    [payload.projectId]
  );
  if (!rows.length) return;

  const project = rows[0];

  // Find org owner
  const { rows: members } = await pool.query(
    `SELECT u.id FROM users u
     JOIN organizations o ON o.owner_user_id = u.id
     WHERE o.id = $1
     LIMIT 1`,
    [project.org_id]
  );
  if (!members.length) return;

  console.log(`[Scheduler] PR merged for project ${project.id} — triggering re-audit`);

  await enqueueAuditJob({
    url: project.domain.startsWith('http') ? project.domain : `https://${project.domain}`,
    userId: members[0].id,
    priority: 'high',
  });
}

/**
 * Handle deploy hook — triggered by Vercel/Render deploy webhooks.
 */
export async function handleDeployHook(payload: {
  domain: string;
  source: string;
}): Promise<void> {
  const pool = getPool();

  // Find matching project by domain
  const { rows: projects } = await pool.query(
    `SELECT p.id, p.domain, p.org_id FROM v1_projects p
     WHERE p.domain = $1 OR p.domain = $2`,
    [payload.domain, payload.domain.replace(/^https?:\/\//, '')]
  );
  if (!projects.length) return;

  for (const project of projects) {
    const { rows: members } = await pool.query(
      `SELECT u.id FROM users u
       JOIN organizations o ON o.owner_user_id = u.id
       WHERE o.id = $1
       LIMIT 1`,
      [project.org_id]
    );
    if (!members.length) continue;

    console.log(`[Scheduler] Deploy hook (${payload.source}) for ${project.domain} — triggering re-scan`);

    await enqueueAuditJob({
      url: project.domain.startsWith('http') ? project.domain : `https://${project.domain}`,
      userId: members[0].id,
      priority: 'high',
    });
  }
}

/**
 * Start the scheduler — all cron jobs.
 */
export function startScheduler(): void {
  if (schedulerStarted) return;
  schedulerStarted = true;

  // Run full project audit sweep every 6 hours
  cron.schedule('0 */6 * * *', () => {
    enqueueAllProjectsForAudit().catch((err) => {
      console.error('[Scheduler] Audit sweep failed:', err.message);
    });
  });

  // Clean up stale audit jobs every hour
  cron.schedule('0 * * * *', async () => {
    try {
      const pool = getPool();
      // Mark stale running audits as failed after 10 minutes
      await pool.query(`
        UPDATE v1_audits SET status = 'failed', updated_at = NOW()
        WHERE status = 'running' AND created_at < NOW() - INTERVAL '10 minutes'
      `);
    } catch (err: any) {
      console.warn('[Scheduler] Stale job cleanup failed:', err.message);
    }
  });

  console.log('[Scheduler] Cron scheduler started (6h audit sweep, 1h stale cleanup)');
}
