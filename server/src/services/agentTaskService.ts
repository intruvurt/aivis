// server/src/services/agentTaskService.ts
// Agent task queue — processes GuideBot-initiated actions sequentially
import { getPool } from './postgresql.js';
import { createUserNotification } from './notificationService.js';
import { trackBrandMentions, persistMentionScan } from './mentionTracker.js';
import type { CanonicalTier } from '../../../shared/types.js';

/* ────────────────────────────────────────────────────────────────────────────
 * Types
 * ──────────────────────────────────────────────────────────────────────────── */
export type AgentTaskType =
  | 'schedule_audits'
  | 'run_citation_test'
  | 'add_competitor'
  | 'scan_mentions'
  | 'schedule_rescan';

export interface AgentTask {
  id: string;
  user_id: string;
  task_type: AgentTaskType;
  payload: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  result: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Tier-based task limits per day (prevent abuse)
 * ──────────────────────────────────────────────────────────────────────────── */
export const DAILY_TASK_LIMITS: Record<CanonicalTier, number> = {
  observer: 3,
  alignment: 10,
  signal: 20,
  scorefix: 40,
  agency: 80,
  enterprise: 150,
};

/* ────────────────────────────────────────────────────────────────────────────
 * CRUD
 * ──────────────────────────────────────────────────────────────────────────── */
export async function createTask(
  userId: string,
  taskType: AgentTaskType,
  payload: Record<string, unknown>,
  tier: CanonicalTier,
): Promise<AgentTask> {
  const pool = getPool();

  // Enforce daily limit
  const countRes = await pool.query(
    `SELECT COUNT(*) AS cnt FROM agent_tasks
     WHERE user_id = $1 AND created_at >= CURRENT_DATE`,
    [userId],
  );
  const todayCount = Number(countRes.rows[0]?.cnt ?? 0);
  const limit = DAILY_TASK_LIMITS[tier] ?? DAILY_TASK_LIMITS.observer;
  if (todayCount >= limit) {
    throw new Error(`Daily task limit reached (${todayCount}/${limit}). Try again tomorrow or upgrade your plan.`);
  }

  const res = await pool.query(
    `INSERT INTO agent_tasks (user_id, task_type, payload)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [userId, taskType, JSON.stringify(payload)],
  );
  return res.rows[0] as AgentTask;
}

export async function getUserTasks(userId: string, limit = 20): Promise<AgentTask[]> {
  const pool = getPool();
  const res = await pool.query(
    `SELECT * FROM agent_tasks
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit],
  );
  return res.rows as AgentTask[];
}

export async function cancelTask(userId: string, taskId: string): Promise<boolean> {
  const pool = getPool();
  const res = await pool.query(
    `UPDATE agent_tasks SET status = 'cancelled', completed_at = NOW()
     WHERE id = $1 AND user_id = $2 AND status = 'pending'
     RETURNING id`,
    [taskId, userId],
  );
  return (res.rowCount ?? 0) > 0;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Task Executor — runs the actual work for each task type
 * ──────────────────────────────────────────────────────────────────────────── */
const TASK_TIMEOUT_MS = 60_000; // 60s per task

async function executeTask(task: AgentTask): Promise<Record<string, unknown>> {
  switch (task.task_type) {
    case 'schedule_audits':
      return await executeScheduleAudits(task);
    case 'schedule_rescan':
      return await executeScheduleRescan(task);
    case 'add_competitor':
      return await executeAddCompetitor(task);
    case 'scan_mentions':
      return await executeScanMentions(task);
    case 'run_citation_test':
      return await executeRunCitationTest(task);
    default:
      throw new Error(`Unknown task type: ${task.task_type}`);
  }
}

async function executeScheduleAudits(task: AgentTask): Promise<Record<string, unknown>> {
  const urls = (task.payload.urls as string[]) || [];
  if (!urls.length) throw new Error('No URLs provided');
  if (urls.length > 25) throw new Error('Maximum 25 URLs per batch');

  const pool = getPool();
  const scheduled: string[] = [];
  const workspaceId = (task.payload.workspace_id as string) || null;

  for (const url of urls) {
    const normalized = url.trim().toLowerCase();
    if (!normalized) continue;

    await pool.query(
      `INSERT INTO scheduled_rescans (user_id, workspace_id, url, frequency, next_run_at)
       VALUES ($1, $2, $3, 'once', NOW())
       ON CONFLICT (user_id, COALESCE(workspace_id, '00000000-0000-0000-0000-000000000000'::uuid), url) DO UPDATE SET next_run_at = NOW(), enabled = TRUE`,
      [task.user_id, workspaceId, normalized],
    );
    scheduled.push(normalized);
  }

  return { scheduled_count: scheduled.length, urls: scheduled };
}

async function executeScheduleRescan(task: AgentTask): Promise<Record<string, unknown>> {
  const url = (task.payload.url as string) || '';
  const frequency = (task.payload.frequency as string) || 'weekly';
  if (!url) throw new Error('No URL provided');

  const pool = getPool();
  const workspaceId = (task.payload.workspace_id as string) || null;
  const nextRun = frequency === 'daily' ? "NOW() + INTERVAL '1 day'" : "NOW() + INTERVAL '7 days'";

  await pool.query(
    `INSERT INTO scheduled_rescans (user_id, workspace_id, url, frequency, next_run_at)
     VALUES ($1, $2, $3, $4, ${nextRun})
     ON CONFLICT (user_id, COALESCE(workspace_id, '00000000-0000-0000-0000-000000000000'::uuid), url) DO UPDATE SET frequency = $4, next_run_at = ${nextRun}, enabled = TRUE`,
    [task.user_id, workspaceId, url.trim().toLowerCase(), frequency],
  );

  return { url, frequency, status: 'scheduled' };
}

async function executeAddCompetitor(task: AgentTask): Promise<Record<string, unknown>> {
  const targetUrl = (task.payload.target_url as string) || '';
  const competitorUrl = (task.payload.competitor_url as string) || '';
  if (!targetUrl || !competitorUrl) throw new Error('Both target_url and competitor_url are required');

  const pool = getPool();
  const res = await pool.query(
    `INSERT INTO competitor_tracking (user_id, target_url, competitor_url)
     VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [task.user_id, targetUrl.trim().toLowerCase(), competitorUrl.trim().toLowerCase()],
  );

  return {
    target_url: targetUrl,
    competitor_url: competitorUrl,
    added: (res.rowCount ?? 0) > 0,
  };
}

async function executeScanMentions(task: AgentTask): Promise<Record<string, unknown>> {
  const brand = (task.payload.brand as string) || '';
  const domain = (task.payload.domain as string) || '';
  if (!brand) throw new Error('Brand name is required for mention scanning');

  const results = await trackBrandMentions(brand, domain || brand);
  const totalMentions = results.mentions.length;

  // Persist the scan
  await persistMentionScan(task.user_id, brand, domain || brand, results.mentions);

  return {
    brand,
    domain: domain || brand,
    total_mentions: totalMentions,
    sources_checked: results.sources_checked,
    top_mentions: results.mentions.slice(0, 5).map((m) => ({
      source: m.source,
      title: m.title,
      url: m.url,
    })),
  };
}

async function executeRunCitationTest(task: AgentTask): Promise<Record<string, unknown>> {
  const query = (task.payload.query as string) || '';
  const brandName = (task.payload.brand_name as string) || '';
  const url = (task.payload.url as string) || '';
  if (!query) throw new Error('Query/keyword is required for citation testing');

  // Create a citation test record
  const pool = getPool();
  const testRes = await pool.query(
    `INSERT INTO citation_tests (user_id, query, brand_name, url, status)
     VALUES ($1, $2, $3, $4, 'pending')
     RETURNING id`,
    [task.user_id, query, brandName, url],
  );

  return {
    citation_test_id: testRes.rows[0]?.id,
    query,
    brand_name: brandName,
    status: 'created',
    message: 'Citation test created. Run it from the Citations page to see full results.',
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Background Worker — sequential task processor
 * ──────────────────────────────────────────────────────────────────────────── */
let workerInterval: ReturnType<typeof setInterval> | null = null;
let isProcessing = false;

// Exponential backoff for repeated errors (recovers automatically)
const MAX_CONSECUTIVE_ERRORS = 5;
let consecutiveErrors = 0;
let backoffUntil = 0;

function isSchemaError(msg: string): boolean {
  return /does not exist|undefined column|relation .* does not exist/i.test(msg);
}

export async function processNextTask(): Promise<boolean> {
  // Guard against concurrent execution
  if (isProcessing) return false;
  isProcessing = true;

  try {
    const pool = getPool();

    // Claim the oldest pending task atomically
    const res = await pool.query(
      `UPDATE agent_tasks
       SET status = 'running', started_at = NOW()
       WHERE id = (
         SELECT id FROM agent_tasks
         WHERE status = 'pending'
         ORDER BY created_at ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED
       )
       RETURNING *`,
    );

    if (!res.rows.length) return false;

    const task = res.rows[0] as AgentTask;

    try {
      // Execute with timeout
      const result = await Promise.race([
        executeTask(task),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Task timed out')), TASK_TIMEOUT_MS),
        ),
      ]);

      // Mark completed
      await pool.query(
        `UPDATE agent_tasks SET status = 'completed', result = $1, completed_at = NOW()
         WHERE id = $2`,
        [JSON.stringify(result), task.id],
      );

      // Notify user
      await createUserNotification({
        userId: task.user_id,
        eventType: 'agent_task_completed',
        title: `Task completed: ${friendlyTaskName(task.task_type)}`,
        message: friendlyTaskResult(task.task_type, result),
        metadata: { task_id: task.id, task_type: task.task_type },
      });

      return true;
    } catch (err: any) {
      const errorMsg = err?.message || 'Unknown error';
      await pool.query(
        `UPDATE agent_tasks SET status = 'failed', error = $1, completed_at = NOW()
         WHERE id = $2`,
        [errorMsg.slice(0, 500), task.id],
      );

      await createUserNotification({
        userId: task.user_id,
        eventType: 'agent_task_failed',
        title: `Task failed: ${friendlyTaskName(task.task_type)}`,
        message: errorMsg.slice(0, 200),
        metadata: { task_id: task.id, task_type: task.task_type },
      });

      return true;
    }
  } finally {
    isProcessing = false;
  }
}

function friendlyTaskName(type: AgentTaskType): string {
  const names: Record<AgentTaskType, string> = {
    schedule_audits: 'Schedule Audits',
    run_citation_test: 'Citation Test',
    add_competitor: 'Add Competitor',
    scan_mentions: 'Mention Scan',
    schedule_rescan: 'Schedule Rescan',
  };
  return names[type] || type;
}

function friendlyTaskResult(type: AgentTaskType, result: Record<string, unknown>): string {
  switch (type) {
    case 'schedule_audits':
      return `Scheduled ${result.scheduled_count ?? 0} URL(s) for auditing.`;
    case 'scan_mentions':
      return `Found ${result.total_mentions ?? 0} mentions for "${result.brand ?? ''}" across ${result.sources_checked ?? 0} sources.`;
    case 'add_competitor':
      return `Competitor ${result.competitor_url ?? ''} ${result.added ? 'added' : 'already tracked'} for ${result.target_url ?? ''}.`;
    case 'schedule_rescan':
      return `Rescan scheduled for ${result.url ?? ''} (${result.frequency ?? 'weekly'}).`;
    case 'run_citation_test':
      return `Citation test created for "${result.query ?? ''}". View results on the Citations page.`;
    default:
      return 'Task completed successfully.';
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Worker lifecycle
 * ──────────────────────────────────────────────────────────────────────────── */
const WORKER_POLL_MS = 10_000; // Poll every 10 seconds

export function startTaskWorker(): void {
  if (workerInterval) return; // Already running
  console.log('[AgentTaskService] Starting background task worker');
  consecutiveErrors = 0;
  backoffUntil = 0;
  workerInterval = setInterval(() => {
    // Skip processing during backoff cooldown
    if (Date.now() < backoffUntil) return;

    void processNextTask()
      .then(() => { consecutiveErrors = 0; backoffUntil = 0; })
      .catch((err) => {
        const msg = err?.message || '';
        consecutiveErrors++;
        if (isSchemaError(msg) && consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          // Backoff exponentially: 30s, 60s, 120s, 240s... capped at 10 min
          const backoffMs = Math.min(30_000 * Math.pow(2, consecutiveErrors - MAX_CONSECUTIVE_ERRORS), 600_000);
          backoffUntil = Date.now() + backoffMs;
          console.warn(`[AgentTaskService] Backing off for ${backoffMs / 1000}s after ${consecutiveErrors} errors: ${msg}`);
        } else {
          console.error('[AgentTaskService] Worker error:', msg);
        }
      });
  }, WORKER_POLL_MS);
}

export function stopTaskWorker(): void {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    console.log('[AgentTaskService] Stopped background task worker');
  }
}
