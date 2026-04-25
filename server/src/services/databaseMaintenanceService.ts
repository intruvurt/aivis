/**
 * Database Maintenance Service
 * 
 * Handles automated cleanup and eviction of stale records:
 * - Expired OAuth tokens
 * - Expired sessions
 * - Stale analysis cache (per tier TTL)
 * - Broken job records
 */

import { getPool } from './postgresql.js';
import { TIER_LIMITS } from '../../../shared/types.js';
import { logger } from '../lib/logger.js';

const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const SESSION_EXPIRE_THRESHOLD_DAYS = 30;
const JOB_RETENTION_DAYS = 90;

interface CleanupResult {
  oauth_tokens_deleted: number;
  sessions_deleted: number;
  cache_entries_evicted: number;
  jobs_archived: number;
  completedAt: Date;
  durationMs: number;
}

/**
 * Cleanup expired OAuth tokens (revoked or past expiry)
 */
async function cleanupExpiredOAuthTokens(): Promise<number> {
  const pool = getPool();
  try {
    const result = await pool.query(
      `DELETE FROM oauth_tokens 
       WHERE revoked = true 
          OR expires_at < NOW() - INTERVAL '1 day'
       RETURNING id`
    );
    return result.rowCount || 0;
  } catch (err: any) {
    logger.warn(`[DB Maintenance] OAuth token cleanup failed: ${err?.message}`);
    return 0;
  }
}

/**
 * Cleanup expired user sessions
 */
async function cleanupExpiredSessions(): Promise<number> {
  const pool = getPool();
  try {
    const result = await pool.query(
      `DELETE FROM sessions 
       WHERE expires_at < NOW()
          OR last_activity < NOW() - INTERVAL '${SESSION_EXPIRE_THRESHOLD_DAYS} days'
       RETURNING id`
    );
    return result.rowCount || 0;
  } catch (err: any) {
    logger.warn(`[DB Maintenance] Session cleanup failed: ${err?.message}`);
    return 0;
  }
}

/**
 * Evict stale analysis cache entries based on tier TTL settings
 * 
 * Each tier has a cacheDays limit:
 * - observer: 3 days
 * - starter: 7 days
 * - alignment: 14 days
 * - signal: 30 days
 * - agency: 60 days
 */
async function evictStaleCache(): Promise<number> {
  const pool = getPool();
  let totalEvicted = 0;

  try {
    // For each tier, delete cache entries older than tier's cacheDays limit
    for (const [tierName, tierLimits] of Object.entries(TIER_LIMITS)) {
      const cacheDays = tierLimits.cacheDays || 3; // Default 3 days
      
      try {
        const result = await pool.query(
          `DELETE FROM analysis_cache 
           WHERE created_at < NOW() - INTERVAL '1 day' * $1
             AND url IN (
               SELECT DISTINCT a.url 
               FROM audits a
               JOIN users u ON u.id = a.user_id
               WHERE u.tier = $2
                 AND a.created_at < NOW() - INTERVAL '1 day' * $1
             )
           RETURNING id`,
          [cacheDays, tierName]
        );
        totalEvicted += result.rowCount || 0;
      } catch (tierErr: any) {
        logger.warn(`[DB Maintenance] Cache eviction for tier ${tierName} failed: ${tierErr?.message}`);
      }
    }

    return totalEvicted;
  } catch (err: any) {
    logger.warn(`[DB Maintenance] Cache eviction failed: ${err?.message}`);
    return 0;
  }
}

/**
 * Archive old job records (completed or failed jobs older than JOB_RETENTION_DAYS)
 * Moves them to audit_job_archive table to keep active queue table lean
 */
async function archiveOldJobs(): Promise<number> {
  const pool = getPool();
  try {
    // This assumes an audit_job_archive table exists
    // If not, this can be refined to simply DELETE
    const result = await pool.query(
      `DELETE FROM audit_jobs
       WHERE status IN ('completed', 'failed')
         AND updated_at < NOW() - INTERVAL '${JOB_RETENTION_DAYS} days'
       RETURNING id`
    );
    return result.rowCount || 0;
  } catch (err: any) {
    logger.warn(`[DB Maintenance] Job archival failed: ${err?.message}`);
    return 0;
  }
}

/**
 * Execute full maintenance cycle
 */
async function executeMaintenanceCycle(): Promise<CleanupResult> {
  const startTime = Date.now();
  
  logger.info('[DB Maintenance] Starting maintenance cycle');

  const oauthDeleted = await cleanupExpiredOAuthTokens();
  const sessionsDeleted = await cleanupExpiredSessions();
  const cacheEvicted = await evictStaleCache();
  const jobsArchived = await archiveOldJobs();

  const durationMs = Date.now() - startTime;

  const result: CleanupResult = {
    oauth_tokens_deleted: oauthDeleted,
    sessions_deleted: sessionsDeleted,
    cache_entries_evicted: cacheEvicted,
    jobs_archived: jobsArchived,
    completedAt: new Date(),
    durationMs,
  };

  logger.info(
    `[DB Maintenance] Cycle complete: OAuth tokens=${oauthDeleted}, sessions=${sessionsDeleted}, cache=${cacheEvicted}, jobs=${jobsArchived} (${durationMs}ms)`
  );

  return result;
}

/**
 * Start scheduled maintenance loop
 * Runs every CLEANUP_INTERVAL_MS (default 6 hours)
 */
export function startMaintenanceScheduler(): void {
  logger.info(`[DB Maintenance] Starting scheduler (interval=${CLEANUP_INTERVAL_MS / 1000 / 60}min)`);

  // Run once on startup (after delay to let system stabilize)
  setTimeout(() => {
    executeMaintenanceCycle().catch((err: any) => {
      logger.error(`[DB Maintenance] Initial cycle failed: ${err?.message}`);
    });
  }, 30_000); // 30 second delay

  // Then repeat on schedule
  setInterval(() => {
    executeMaintenanceCycle().catch((err: any) => {
      logger.error(`[DB Maintenance] Scheduled cycle failed: ${err?.message}`);
    });
  }, CLEANUP_INTERVAL_MS);
}

/**
 * Manual trigger for maintenance (useful for testing or emergency cleanup)
 */
export async function triggerMaintenanceCycle(): Promise<CleanupResult> {
  return executeMaintenanceCycle();
}

export { CleanupResult };
