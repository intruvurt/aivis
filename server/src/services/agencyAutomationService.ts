import { getPool } from './postgresql.js';
import { enqueueAuditJob } from '../infra/queues/auditQueue.js';
import { emitAgencyEvent, onAgencyEvent } from './agencyEventBus.js';

type ProjectRecord = {
  id: string;
  owner_user_id: string;
  organization_name: string;
  domain: string;
  plan: string;
  status: string;
};

export async function createPortfolioProject(args: {
  userId: string;
  organizationName: string;
  domain: string;
  plan?: string;
}): Promise<ProjectRecord> {
  const { rows } = await getPool().query(
    `INSERT INTO portfolio_projects (owner_user_id, organization_name, domain, plan, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'active', NOW(), NOW())
     RETURNING id, owner_user_id, organization_name, domain, plan, status`,
    [args.userId, args.organizationName.trim(), args.domain.trim(), args.plan || 'observer']
  );
  return rows[0] as ProjectRecord;
}

export async function listPortfolioProjects(userId: string): Promise<ProjectRecord[]> {
  const { rows } = await getPool().query(
    `SELECT id, owner_user_id, organization_name, domain, plan, status
       FROM portfolio_projects
      WHERE owner_user_id = $1
      ORDER BY created_at DESC`,
    [userId]
  );
  return rows as ProjectRecord[];
}

export async function getPortfolioOverview(userId: string) {
  const projects = await listPortfolioProjects(userId);
  const result = await Promise.all(projects.map(async (project) => {
    const { rows } = await getPool().query(
      `SELECT visibility_score, created_at
         FROM audits
        WHERE user_id = $1
          AND LOWER(url) LIKE '%' || LOWER($2) || '%'
          AND status = 'completed'
        ORDER BY created_at DESC
        LIMIT 2`,
      [userId, project.domain]
    );

    const latest = rows[0] ? Number(rows[0].visibility_score || 0) : null;
    const previous = rows[1] ? Number(rows[1].visibility_score || 0) : null;
    const trend = latest != null && previous != null ? Number((latest - previous).toFixed(2)) : null;

    return {
      ...project,
      latestScore: latest,
      trend,
      direction: trend == null ? 'flat' : trend > 0 ? 'up' : trend < 0 ? 'down' : 'flat',
    };
  }));

  return result;
}

export async function runPortfolioDailyAutomation(userId: string): Promise<{ queued: number }> {
  const projects = await listPortfolioProjects(userId);
  let queued = 0;
  for (const project of projects) {
    await enqueueAuditJob({
      url: project.domain,
      userId,
      priority: 'normal',
    });
    queued += 1;
  }
  return { queued };
}

export async function listPortfolioTasks(userId: string) {
  const { rows } = await getPool().query(
    `SELECT id, project_id, issue, impact, priority, auto_fixable, status, payload, created_at
       FROM portfolio_tasks
      WHERE owner_user_id = $1
      ORDER BY created_at DESC
      LIMIT 200`,
    [userId]
  );
  return rows;
}

export async function updatePortfolioTaskStatus(userId: string, taskId: string, status: string) {
  const { rows } = await getPool().query(
    `UPDATE portfolio_tasks
        SET status = $3,
            updated_at = NOW()
      WHERE id = $1
        AND owner_user_id = $2
    RETURNING id, status`,
    [taskId, userId, status]
  );
  return rows[0] || null;
}

async function createTaskFromEvent(args: {
  userId: string;
  domain: string;
  issue: string;
  impact: string;
  priority: 'high' | 'medium' | 'low';
  autoFixable: boolean;
  payload: Record<string, unknown>;
}) {
  const project = await getPool().query(
    `SELECT id FROM portfolio_projects WHERE owner_user_id = $1 AND LOWER(domain) = LOWER($2) LIMIT 1`,
    [args.userId, args.domain]
  );
  const projectId = project.rows[0]?.id || null;
  if (!projectId) return;

  await getPool().query(
    `INSERT INTO portfolio_tasks (
      project_id, owner_user_id, issue, impact, priority, auto_fixable, status, payload, created_at, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,'open',$7::jsonb,NOW(),NOW())`,
    [projectId, args.userId, args.issue, args.impact, args.priority, args.autoFixable, JSON.stringify(args.payload)]
  );
}

let bootstrapped = false;
export function bootstrapAgencyAutomation(): void {
  if (bootstrapped) return;
  bootstrapped = true;

  onAgencyEvent('visibility.drop', async (payload) => {
    await createTaskFromEvent({
      userId: payload.userId,
      domain: payload.domain,
      issue: 'visibility score dropped significantly',
      impact: `-${payload.scoreDrop.toFixed(1)} points`,
      priority: 'high',
      autoFixable: true,
      payload,
    });
  });

  onAgencyEvent('fix.applied', async (payload) => {
    await createTaskFromEvent({
      userId: payload.userId,
      domain: payload.domain,
      issue: 'auto fix applied; verification required',
      impact: 'verification pending',
      priority: 'medium',
      autoFixable: false,
      payload,
    });
  });

  onAgencyEvent('audit.completed', async (payload) => {
    if (payload.score < 50) {
      await createTaskFromEvent({
        userId: payload.userId,
        domain: payload.domain,
        issue: 'low visibility baseline detected',
        impact: `score ${payload.score}`,
        priority: 'high',
        autoFixable: true,
        payload,
      });
    }
  });
}

export async function publishAuditCompleted(args: { userId: string; domain: string; score: number; projectId?: string }) {
  await emitAgencyEvent('audit.completed', args);
}

// ── Level 5: Bulk fix ─────────────────────────────────────────────────────────

export interface BulkFixProgress {
  total: number;
  completed: number;
  failed: number;
  results: Array<{ project_id: string; domain: string; status: 'queued' | 'failed'; error?: string }>;
}

export interface BulkFixJob {
  id: string;
  user_id: string;
  workspace_id: string;
  fix_type: string;
  project_ids: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: BulkFixProgress;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export async function runBulkFix(args: {
  userId: string;
  workspaceId: string;
  projectIds: string[];
  fixType: string;
}): Promise<BulkFixJob> {
  const pool = getPool();

  // Create the job record
  const initialProgress: BulkFixProgress = {
    total: args.projectIds.length,
    completed: 0,
    failed: 0,
    results: [],
  };

  const { rows } = await pool.query<BulkFixJob>(
    `INSERT INTO bulk_fix_jobs (user_id, workspace_id, fix_type, project_ids, status, progress)
     VALUES ($1, $2, $3, $4::text[], 'running', $5::jsonb)
     RETURNING *`,
    [args.userId, args.workspaceId, args.fixType, args.projectIds, JSON.stringify(initialProgress)]
  );
  const job = rows[0] as BulkFixJob;

  // Fetch projects and enqueue in background (fire-and-forget)
  void (async () => {
    const progress: BulkFixProgress = { ...initialProgress, results: [] };
    try {
      const { rows: projects } = await pool.query<{ id: string; domain: string }>(
        `SELECT id, domain FROM portfolio_projects
          WHERE id = ANY($1::text[]) AND owner_user_id = $2`,
        [args.projectIds, args.userId]
      );

      for (const project of projects) {
        try {
          await enqueueAuditJob({ url: project.domain, userId: args.userId, priority: 'normal' });
          progress.results.push({ project_id: project.id, domain: project.domain, status: 'queued' });
          progress.completed += 1;
        } catch (err) {
          progress.results.push({
            project_id: project.id,
            domain: project.domain,
            status: 'failed',
            error: String((err as Error).message || 'enqueue failed'),
          });
          progress.failed += 1;
        }
      }

      await pool.query(
        `UPDATE bulk_fix_jobs
            SET status = 'completed', progress = $2::jsonb, completed_at = NOW(), updated_at = NOW()
          WHERE id = $1`,
        [job.id, JSON.stringify(progress)]
      );
    } catch (err) {
      await pool.query(
        `UPDATE bulk_fix_jobs SET status = 'failed', updated_at = NOW() WHERE id = $1`,
        [job.id]
      ).catch(() => {});
    }
  })();

  return job;
}

export async function getBulkFixJob(userId: string, jobId: string): Promise<BulkFixJob | null> {
  const { rows } = await getPool().query<BulkFixJob>(
    `SELECT * FROM bulk_fix_jobs WHERE id = $1 AND user_id = $2`,
    [jobId, userId]
  );
  return (rows[0] as BulkFixJob) ?? null;
}

