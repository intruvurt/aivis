/**
 * dbCleanup.ts - Periodic database maintenance.
 *
 * Runs on a configurable interval (default: every 6 hours) and:
 *  1. Prunes expired user sessions
 *  2. Trims per-user audit rows beyond their tier's maxStoredAudits
 *  3. Evicts stale analysis_cache beyond tier cacheDays
 *  4. Prunes rate_limit_events older than 30 days
 *  5. Prunes notifications older than 90 days (read) / 180 days (unread)
 *  6. Prunes usage_daily rows older than 90 days
 *  7. Prunes completed/failed agent_tasks older than 30 days
 *  8. Prunes disabled scheduled_rescans older than 60 days
 *  9. Prunes brand_mentions older than 180 days
 * 10. Prunes completed niche_discovery_jobs older than 30 days
 */

import { getPool, isDatabaseAvailable } from './postgresql.js';
import { TIER_LIMITS, type CanonicalTier, type TierLimits } from '../../../shared/types.js';

const CLEANUP_INTERVAL_MS = 6 * 60 * 60_000; // 6 hours
const RATE_LIMIT_RETENTION_DAYS = 30;
const NOTIFICATION_READ_RETENTION_DAYS = 90;
const NOTIFICATION_UNREAD_RETENTION_DAYS = 180;
const USAGE_DAILY_RETENTION_DAYS = 90;
const AGENT_TASK_RETENTION_DAYS = 30;
const DISABLED_RESCAN_RETENTION_DAYS = 60;
const BRAND_MENTION_RETENTION_DAYS = 180;
const NICHE_JOB_RETENTION_DAYS = 30;

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

async function runCleanup(): Promise<void> {
  if (!isDatabaseAvailable()) return;

  const pool = getPool();
  const start = Date.now();
  const stats = {
    sessions: 0, audits: 0, cache: 0, rateLimits: 0,
    notifications: 0, usageDaily: 0, agentTasks: 0,
    rescans: 0, mentions: 0, nicheJobs: 0,
  };

  try {
    // ── 1. Expired sessions ───────────────────────────────────────────────
    const sessResult = await pool.query(
      `DELETE FROM user_sessions WHERE expires_at < NOW()`
    );
    stats.sessions = sessResult.rowCount ?? 0;

    // ── 2. Per-user audit cap ─────────────────────────────────────────────
    // For each tier, find users with more audits than maxStoredAudits and trim
    for (const [tier, limits] of Object.entries(TIER_LIMITS) as [string, TierLimits][]) {
      if (limits.maxStoredAudits < 0) continue; // unlimited
      const auditResult = await pool.query(
        `DELETE FROM audits WHERE id IN (
          SELECT a.id FROM audits a
          JOIN users u ON a.user_id = u.id
          WHERE u.tier = $1
            AND a.id NOT IN (
              SELECT a2.id FROM audits a2
              WHERE a2.user_id = a.user_id
              ORDER BY a2.created_at DESC
              LIMIT $2
            )
        )`,
        [tier, limits.maxStoredAudits]
      );
      stats.audits += auditResult.rowCount ?? 0;
    }

    // ── 3. Stale cache eviction ───────────────────────────────────────────
    // Use the longest cacheDays across tiers (120 days for scorefix) as the
    // global cache retention cutoff. Per-user tier-aware cache eviction would
    // require joining cache → audits → users which is heavier than needed.
    const maxCacheDays = Math.max(...(Object.values(TIER_LIMITS) as TierLimits[]).map(t => t.cacheDays));
    await pool.query(
      `UPDATE analysis_cache
          SET status = 'expired',
              updated_at = NOW()
        WHERE status NOT IN ('expired', 'invalidated')
          AND expires_at <= NOW()`
    );
    const cacheResult = await pool.query(
      `DELETE FROM analysis_cache
        WHERE (status = 'expired' AND expires_at < NOW() - INTERVAL '1 day' * $1)
           OR (status = 'invalidated' AND COALESCE(invalidated_at, updated_at, created_at) < NOW() - INTERVAL '1 day' * $1)`,
      [maxCacheDays]
    );
    stats.cache = cacheResult.rowCount ?? 0;

    // ── 4. Rate limit events ──────────────────────────────────────────────
    const rlResult = await pool.query(
      `DELETE FROM rate_limit_events WHERE created_at < NOW() - INTERVAL '1 day' * $1`,
      [RATE_LIMIT_RETENTION_DAYS]
    );
    stats.rateLimits = rlResult.rowCount ?? 0;

    // ── 5. Old notifications ──────────────────────────────────────────────
    const notifResult = await pool.query(
      `DELETE FROM notifications WHERE
        (id IN (SELECT notification_id FROM notification_reads) AND created_at < NOW() - INTERVAL '1 day' * $1)
        OR
        (id NOT IN (SELECT notification_id FROM notification_reads) AND created_at < NOW() - INTERVAL '1 day' * $2)`,
      [NOTIFICATION_READ_RETENTION_DAYS, NOTIFICATION_UNREAD_RETENTION_DAYS]
    );
    stats.notifications = notifResult.rowCount ?? 0;

    // ── 6. Old usage_daily rows ───────────────────────────────────────────
    const usageResult = await pool.query(
      `DELETE FROM usage_daily WHERE date < CURRENT_DATE - INTERVAL '1 day' * $1`,
      [USAGE_DAILY_RETENTION_DAYS]
    );
    stats.usageDaily = usageResult.rowCount ?? 0;

    // ── 7. Completed/failed agent_tasks ─────────────────────────────────
    try {
      const atResult = await pool.query(
        `DELETE FROM agent_tasks WHERE status IN ('completed', 'failed') AND completed_at < NOW() - INTERVAL '1 day' * $1`,
        [AGENT_TASK_RETENTION_DAYS]
      );
      stats.agentTasks = atResult.rowCount ?? 0;
    } catch { /* table may not exist yet */ }

    // ── 8. Disabled scheduled_rescans older than retention ──────────────
    try {
      const rsResult = await pool.query(
        `DELETE FROM scheduled_rescans WHERE enabled = FALSE AND updated_at < NOW() - INTERVAL '1 day' * $1`,
        [DISABLED_RESCAN_RETENTION_DAYS]
      );
      stats.rescans = rsResult.rowCount ?? 0;
    } catch { /* table may not exist yet */ }

    // ── 9. Old brand_mentions ───────────────────────────────────────────
    try {
      const bmResult = await pool.query(
        `DELETE FROM brand_mentions WHERE created_at < NOW() - INTERVAL '1 day' * $1`,
        [BRAND_MENTION_RETENTION_DAYS]
      );
      stats.mentions = bmResult.rowCount ?? 0;
    } catch { /* table may not exist yet */ }

    // ── 10. Completed niche_discovery_jobs ───────────────────────────────
    try {
      const njResult = await pool.query(
        `DELETE FROM niche_discovery_jobs WHERE status IN ('completed', 'failed') AND created_at < NOW() - INTERVAL '1 day' * $1`,
        [NICHE_JOB_RETENTION_DAYS]
      );
      stats.nicheJobs = njResult.rowCount ?? 0;
    } catch { /* table may not exist yet */ }

    const elapsed = Date.now() - start;
    const total = stats.sessions + stats.audits + stats.cache + stats.rateLimits
      + stats.notifications + stats.usageDaily + stats.agentTasks
      + stats.rescans + stats.mentions + stats.nicheJobs;

    if (total > 0) {
      console.log(
        `[DB Cleanup] Pruned ${total} rows in ${elapsed}ms -`,
        `sessions=${stats.sessions} audits=${stats.audits} cache=${stats.cache}`,
        `rateLimits=${stats.rateLimits} notifications=${stats.notifications} usageDaily=${stats.usageDaily}`,
        `agentTasks=${stats.agentTasks} rescans=${stats.rescans} mentions=${stats.mentions} nicheJobs=${stats.nicheJobs}`
      );
    }
  } catch (err) {
    console.warn('[DB Cleanup] Error during cleanup:', err instanceof Error ? err.message : err);
  }
}

export function startDbCleanupLoop(): void {
  if (cleanupTimer) return;

  // Run once soon after startup (30s delay) then on interval
  setTimeout(() => {
    runCleanup();
  }, 30_000);

  cleanupTimer = setInterval(runCleanup, CLEANUP_INTERVAL_MS);

  // Don't keep process alive just for cleanup
  if (cleanupTimer && typeof cleanupTimer === 'object' && 'unref' in cleanupTimer) {
    cleanupTimer.unref();
  }

  console.log('[DB Cleanup] Scheduled every 6h (sessions, audits, cache, rate_limit_events, notifications, agent_tasks, rescans, mentions)');
}

/** Run cleanup immediately - used by admin endpoint */
export { runCleanup as runDbCleanupNow };
