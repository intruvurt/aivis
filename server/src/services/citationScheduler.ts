/**
 * Citation Ranking Scheduler
 *
 * Manages persistent, in-process scheduled citation ranking jobs.
 * - Jobs survive server restarts (loaded from DB on startup)
 * - Each job runs the full NicheRankingEngine pipeline on its interval
 * - Jobs can be created, paused, resumed, and deleted via the API
 */

import { getPool } from './postgresql.js';
import { runNicheRanking } from './citationRankingEngine.js';
import type { ScheduledCitationJob, CitationSchedulePreset } from '../../../shared/types.js';
import { CITATION_PRESET_HOURS } from '../../../shared/types.js';
import { detectAndStoreDropAlert } from './citationIntelligenceService.js';
import { sendCitationDropAlert } from './trendAlertEmails.js';
import { emitBackboneEvent } from './eventBackbone.js';

function getServerApiKey(): string | null {
  return process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_API_KEY || null;
}

// ─── In-memory job registry ───────────────────────────────────────────────────

interface ActiveJob {
  jobId: string;
  timer: ReturnType<typeof setInterval>;
}

const activeTimers = new Map<string, ActiveJob>();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hoursToMs(hours: number): number {
  return Math.max(hours, 0.5) * 60 * 60 * 1000;
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hoursToMs(hours));
}

function inferBrandFromUrl(targetUrl: string): string {
  try {
    const hostname = new URL(targetUrl).hostname.replace(/^www\./i, '');
    const root = hostname.split('.')[0] || '';
    const normalized = root.replace(/[-_]+/g, ' ').trim();
    return normalized || root || hostname;
  } catch {
    return targetUrl;
  }
}

// ─── Core execution ───────────────────────────────────────────────────────────

async function executeJob(job: ScheduledCitationJob): Promise<void> {
  const apiKey = getServerApiKey();
  if (!apiKey) {
    console.warn(`[CitationScheduler] No API key - skipping job ${job.id}`);
    return;
  }

  console.log(`[CitationScheduler] Running job ${job.id} for "${job.target_url}"`);
  emitBackboneEvent('citation.job.started', {
    source: 'citation',
    userId: job.user_id,
    domain: job.target_url,
    jobId: job.id,
    intervalHours: job.interval_hours,
  });

  const pool = getPool();

  try {
    const identityRes = await pool.query<{ brand_name: string | null; niche: string | null; niche_keywords: string[] | null }>(
      `SELECT brand_name, niche, niche_keywords
       FROM citation_niche_rankings
       WHERE user_id = $1 AND target_url = $2
       ORDER BY ran_at DESC
       LIMIT 1`,
      [job.user_id, job.target_url]
    ).catch(() => ({ rows: [] as Array<{ brand_name: string | null; niche: string | null; niche_keywords: string[] | null }> }));

    const latestIdentity = identityRes.rows[0];
    const resolvedBrand =
      String(latestIdentity?.brand_name || '').trim() ||
      inferBrandFromUrl(job.target_url);

    const resolvedNiche =
      String(job.niche || '').trim() ||
      String(latestIdentity?.niche || '').trim() ||
      'general';

    const resolvedKeywords =
      Array.isArray(job.niche_keywords) && job.niche_keywords.length > 0
        ? job.niche_keywords
        : Array.isArray(latestIdentity?.niche_keywords)
          ? latestIdentity.niche_keywords
          : [];

    const result = await runNicheRanking({
      targetUrl: job.target_url,
      brandName: resolvedBrand,
      niche: resolvedNiche,
      nicheKeywords: resolvedKeywords,
      apiKey,
      userId: job.user_id,
      scheduledJobId: job.id,
    });

    const now = new Date();
    const nextRun = addHours(now, job.interval_hours);

    await pool.query(
      `UPDATE citation_scheduled_jobs
       SET last_run_at = $1, next_run_at = $2, run_count = run_count + 1,
           last_ranking_id = $3, updated_at = NOW()
       WHERE id = $4`,
      [now.toISOString(), nextRun.toISOString(), result?.id ?? null, job.id]
    );

    emitBackboneEvent('citation.job.completed', {
      source: 'citation',
      userId: job.user_id,
      domain: job.target_url,
      jobId: job.id,
      rankingId: result?.id ?? null,
      nextRunAt: nextRun.toISOString(),
    });

    emitBackboneEvent('citation.ledger.updated', {
      source: 'citation',
      userId: job.user_id,
      domain: job.target_url,
      jobId: job.id,
      rankingId: result?.id ?? null,
    });

    console.log(`[CitationScheduler] Job ${job.id} complete. Next: ${nextRun.toISOString()}`);

    // Check for mention-rate drops and fire email if threshold exceeded
    try {
      const alert = await detectAndStoreDropAlert(job.user_id, job.target_url);
      if (alert) {
        // Look up the user's email to send the notification
        const { rows: userRows } = await pool.query<{ email: string }>(
          `SELECT email FROM users WHERE id = $1 LIMIT 1`,
          [job.user_id]
        );
        const userEmail = userRows[0]?.email;
        if (userEmail) {
          await sendCitationDropAlert({
            to: userEmail,
            url: job.target_url,
            previousMentionRate: alert.previous_mention_rate,
            currentMentionRate: alert.current_mention_rate,
            drop: alert.drop_magnitude,
          }).catch((e: Error) => {
            console.warn(`[CitationScheduler] Drop alert email failed for ${job.id}:`, e.message);
          });
        }
      }
    } catch (dropErr: any) {
      console.warn(`[CitationScheduler] Drop detection failed for ${job.id}:`, dropErr.message);
    }
  } catch (err: any) {
    console.error(`[CitationScheduler] Job ${job.id} failed:`, err.message);
    emitBackboneEvent('citation.job.failed', {
      source: 'citation',
      userId: job.user_id,
      domain: job.target_url,
      jobId: job.id,
      error: String(err?.message || err),
    });
    // Update next_run_at without incrementing to avoid missing runs
    const nextRun = addHours(new Date(), job.interval_hours);
    await pool.query(
      `UPDATE citation_scheduled_jobs SET next_run_at = $1, updated_at = NOW() WHERE id = $2`,
      [nextRun.toISOString(), job.id]
    ).catch(() => { /* non-fatal */ });
  }
}

// ─── Scheduler control ────────────────────────────────────────────────────────

/**
 * Start a timer for a job that is already in the DB.
 * If a timer already exists for this job it is cancelled first.
 */
export function startJobTimer(job: ScheduledCitationJob): void {
  if (activeTimers.has(job.id)) {
    clearInterval(activeTimers.get(job.id)!.timer);
    activeTimers.delete(job.id);
  }

  if (!job.is_active) return;

  const intervalMs = hoursToMs(job.interval_hours);
  const timer = setInterval(() => {
    executeJob(job).catch((err: Error) => {
      console.error(`[CitationScheduler] Interval error for ${job.id}:`, err.message);
    });
  }, intervalMs);

  activeTimers.set(job.id, { jobId: job.id, timer });
  console.log(`[CitationScheduler] Timer started for job ${job.id} every ${job.interval_hours}h`);
}

/**
 * Stop and remove the timer for a specific job.
 */
export function stopJobTimer(jobId: string): void {
  const active = activeTimers.get(jobId);
  if (active) {
    clearInterval(active.timer);
    activeTimers.delete(jobId);
    console.log(`[CitationScheduler] Timer stopped for job ${jobId}`);
  }
}

/**
 * Load all active scheduled jobs from DB and start timers.
 * Called once on server startup.
 */
export async function bootstrapScheduler(): Promise<void> {
  const pool = getPool();
  try {
    const { rows } = await pool.query<ScheduledCitationJob>(
      `SELECT * FROM citation_scheduled_jobs WHERE is_active = TRUE ORDER BY created_at ASC`
    );
    console.log(`[CitationScheduler] Bootstrapping ${rows.length} active scheduled jobs`);
    for (const job of rows) {
      startJobTimer(job);
    }
  } catch (err: any) {
    // Non-fatal if table doesn't exist yet (before first migration)
    console.warn('[CitationScheduler] Bootstrap skipped (table may not exist yet):', err.message);
  }
}

// ─── DB-backed CRUD ───────────────────────────────────────────────────────────

/**
 * Resolve an optional preset + explicit intervalHours to final hours value.
 * Preset takes priority. 'custom' uses the provided intervalHours.
 */
function resolvePresetHours(preset: CitationSchedulePreset | undefined, intervalHours: number): number {
  if (preset && preset !== 'custom') {
    return CITATION_PRESET_HOURS[preset];
  }
  return Math.max(1, Math.min(intervalHours, 8760)); // 1h – 1yr
}

export async function createScheduledJob(input: {
  userId: string;
  targetUrl: string;
  niche?: string;
  nicheKeywords?: string[];
  intervalHours: number;
  /** Optional preset — if provided, intervalHours is derived from preset */
  preset?: CitationSchedulePreset;
}): Promise<ScheduledCitationJob> {
  const pool = getPool();
  const intervalHours = resolvePresetHours(input.preset, input.intervalHours);
  const now = new Date();
  const nextRun = addHours(now, intervalHours);

  const { rows } = await pool.query<Record<string, any>>(
    `INSERT INTO citation_scheduled_jobs
      (user_id, target_url, niche, niche_keywords, interval_hours, is_active, next_run_at)
     VALUES ($1, $2, $3, $4, $5, TRUE, $6)
     RETURNING *`,
    [
      input.userId,
      input.targetUrl,
      input.niche ?? null,
      input.nicheKeywords ?? [],
      intervalHours,
      nextRun.toISOString(),
    ]
  );

  const job = rowToJob(rows[0], input.preset);

  // Start timer immediately
  startJobTimer(job);

  // Run first execution asap (non-blocking)
  setImmediate(() => {
    executeJob(job).catch((err: Error) => {
      console.warn(`[CitationScheduler] Initial execution error for ${job.id}:`, err.message);
    });
  });

  return job;
}

export async function listScheduledJobs(userId: string): Promise<ScheduledCitationJob[]> {
  const pool = getPool();
  const { rows } = await pool.query<Record<string, any>>(
    `SELECT * FROM citation_scheduled_jobs WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  return rows.map(r => rowToJob(r));
}

export async function getScheduledJob(id: string, userId: string): Promise<ScheduledCitationJob | null> {
  const pool = getPool();
  const { rows } = await pool.query<Record<string, any>>(
    `SELECT * FROM citation_scheduled_jobs WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return rows.length ? rowToJob(rows[0]) : null;
}

export async function toggleScheduledJob(
  id: string,
  userId: string,
  isActive: boolean
): Promise<ScheduledCitationJob | null> {
  const pool = getPool();
  const { rows } = await pool.query<Record<string, any>>(
    `UPDATE citation_scheduled_jobs
     SET is_active = $1, updated_at = NOW()
     WHERE id = $2 AND user_id = $3
     RETURNING *`,
    [isActive, id, userId]
  );
  if (!rows.length) return null;
  const job = rowToJob(rows[0]);
  if (isActive) {
    startJobTimer(job);
  } else {
    stopJobTimer(id);
  }
  return job;
}

export async function deleteScheduledJob(id: string, userId: string): Promise<boolean> {
  stopJobTimer(id);
  const pool = getPool();
  const { rowCount } = await pool.query(
    `DELETE FROM citation_scheduled_jobs WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return (rowCount ?? 0) > 0;
}

export async function updateScheduledJobInterval(
  id: string,
  userId: string,
  intervalHours: number
): Promise<ScheduledCitationJob | null> {
  const pool = getPool();
  const hours = Math.max(1, Math.min(intervalHours, 8760));
  const { rows } = await pool.query<Record<string, any>>(
    `UPDATE citation_scheduled_jobs
     SET interval_hours = $1, updated_at = NOW()
     WHERE id = $2 AND user_id = $3
     RETURNING *`,
    [hours, id, userId]
  );
  if (!rows.length) return null;
  const job = rowToJob(rows[0]);
  // Restart timer with new interval
  startJobTimer(job);
  return job;
}

/**
 * Update a scheduled job's preset (and derive the interval from it).
 * For 'custom', pass explicit intervalHours instead.
 */
export async function updateScheduledJobPreset(
  id: string,
  userId: string,
  preset: CitationSchedulePreset,
  customIntervalHours?: number,
): Promise<ScheduledCitationJob | null> {
  const hours = resolvePresetHours(preset, customIntervalHours ?? 168);
  const job = await updateScheduledJobInterval(id, userId, hours);
  if (!job) return null;
  // Annotate the in-memory object with the preset label
  job.preset = preset;
  return job;
}

// ─── Active job count (for monitoring) ───────────────────────────────────────

export function getActiveTimerCount(): number {
  return activeTimers.size;
}

// ─── DB row -> type mapping ───────────────────────────────────────────────────

function rowToJob(row: Record<string, any>, presetOverride?: CitationSchedulePreset): ScheduledCitationJob {
  return {
    id: row.id,
    user_id: row.user_id,
    target_url: row.target_url,
    niche: row.niche ?? undefined,
    niche_keywords: Array.isArray(row.niche_keywords) ? row.niche_keywords : [],
    interval_hours: Number(row.interval_hours),
    preset: (presetOverride ?? row.preset ?? undefined) as CitationSchedulePreset | undefined,
    is_active: Boolean(row.is_active),
    last_run_at: row.last_run_at ? new Date(row.last_run_at).toISOString() : undefined,
    next_run_at: row.next_run_at ? new Date(row.next_run_at).toISOString() : undefined,
    last_ranking_id: row.last_ranking_id ?? undefined,
    run_count: Number(row.run_count ?? 0),
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  };
}
