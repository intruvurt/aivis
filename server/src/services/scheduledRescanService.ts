/**
 * Scheduled Rescan Service
 * Manages scheduled automatic rescans for Signal-tier users.
 * Runs a check loop every 5 minutes, executing due rescans against /api/analyze.
 */
import { getPool } from './postgresql.js';
import { hasFeatureAccess } from '../middleware/featureGate.js';
import { getUserById } from '../models/User.js';
import { buildScoreChangeReason, detectSubstantialChange } from './changeDetectionService.js';
import { normalizePublicHttpUrl } from '../lib/urlSafety.js';
import { TIER_LIMITS, uiTierFromCanonical, type CanonicalTier, type LegacyTier } from '../../../shared/types.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ScheduledRescan {
  id: string;
  user_id: string;
  url: string;
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'once';
  next_run_at: string;
  last_run_at: string | null;
  last_checked_at: string | null;
  last_audit_id: string | null;
  last_change_fingerprint: string | null;
  last_change_snapshot: Record<string, unknown> | null;
  last_change_evidence: Record<string, unknown> | null;
  last_score_change_reason: Record<string, unknown> | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export type RescanLifecycleHooks = {
  onCompleted?: (payload: {
    userId: string;
    workspaceId: string;
    url: string;
    scheduleId: string;
    auditId: string | null;
  }) => Promise<void> | void;
  onFailed?: (payload: {
    userId: string;
    workspaceId: string;
    url: string;
    scheduleId: string;
    reason: string;
  }) => Promise<void> | void;
  onSkipped?: (payload: {
    userId: string;
    workspaceId: string;
    url: string;
    scheduleId: string;
    reason: string;
  }) => Promise<void> | void;
};

const FREQUENCY_MS: Record<string, number> = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  biweekly: 14 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
};

// ── CRUD operations ──────────────────────────────────────────────────────────

export async function createScheduledRescan(
  userId: string,
  workspaceId: string,
  url: string,
  frequency: string = 'weekly'
): Promise<ScheduledRescan> {
  const pool = getPool();
  const normalized = normalizePublicHttpUrl(url);
  if (!normalized.ok) {
    throw new Error(normalized.error);
  }
  const nextRun = new Date(Date.now() + (FREQUENCY_MS[frequency] || FREQUENCY_MS.weekly));

  const { rows } = await pool.query(
    `INSERT INTO scheduled_rescans (user_id, workspace_id, url, frequency, next_run_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, COALESCE(workspace_id, '00000000-0000-0000-0000-000000000000'::uuid), url) DO UPDATE SET frequency = $4, next_run_at = $5, enabled = TRUE, updated_at = NOW()
     RETURNING *`,
    [userId, workspaceId, normalized.url, frequency, nextRun.toISOString()]
  );
  return rows[0];
}

export async function getScheduledRescans(userId: string, workspaceId: string): Promise<ScheduledRescan[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT * FROM scheduled_rescans WHERE user_id = $1 AND workspace_id = $2 ORDER BY created_at DESC`,
    [userId, workspaceId]
  );
  return rows;
}

export async function getScheduledRescanById(id: string, userId: string, workspaceId: string): Promise<ScheduledRescan | null> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT * FROM scheduled_rescans WHERE id = $1 AND user_id = $2 AND workspace_id = $3`,
    [id, userId, workspaceId]
  );
  return rows[0] || null;
}

export async function updateScheduledRescan(
  id: string,
  userId: string,
  workspaceId: string,
  updates: { frequency?: string; enabled?: boolean }
): Promise<ScheduledRescan | null> {
  const pool = getPool();
  const sets: string[] = ['updated_at = NOW()'];
  const vals: any[] = [];
  let paramIndex = 1;

  if (updates.frequency) {
    sets.push(`frequency = $${paramIndex}`);
    vals.push(updates.frequency);
    paramIndex++;
    // Recalculate next_run_at based on new frequency
    const nextRun = new Date(Date.now() + (FREQUENCY_MS[updates.frequency] || FREQUENCY_MS.weekly));
    sets.push(`next_run_at = $${paramIndex}`);
    vals.push(nextRun.toISOString());
    paramIndex++;
  }
  if (typeof updates.enabled === 'boolean') {
    sets.push(`enabled = $${paramIndex}`);
    vals.push(updates.enabled);
    paramIndex++;
  }

  vals.push(id, userId, workspaceId);
  const { rows } = await pool.query(
    `UPDATE scheduled_rescans SET ${sets.join(', ')} WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1} AND workspace_id = $${paramIndex + 2} RETURNING *`,
    vals
  );
  return rows[0] || null;
}

export async function deleteScheduledRescan(id: string, userId: string, workspaceId: string): Promise<boolean> {
  const pool = getPool();
  const { rowCount } = await pool.query(
    `DELETE FROM scheduled_rescans WHERE id = $1 AND user_id = $2 AND workspace_id = $3`,
    [id, userId, workspaceId]
  );
  return (rowCount ?? 0) > 0;
}

// ── Rescan execution loop ────────────────────────────────────────────────────

let rescanIntervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Fetch up to 10 due rescans and execute them.
 * Called by the interval loop. Each rescan triggers an internal analyze call.
 */
export async function processDueRescans(
  analyzeInternally: (userId: string, workspaceId: string, url: string) => Promise<string | null>,
  hooks?: RescanLifecycleHooks,
): Promise<number> {
  const pool = getPool();
  let processed = 0;

  try {
    const { rows: dueRows } = await pool.query(
      `SELECT sr.*, u.tier
       FROM scheduled_rescans sr
       JOIN users u ON u.id = sr.user_id
       WHERE sr.enabled = TRUE AND sr.next_run_at <= NOW()
       ORDER BY sr.next_run_at ASC
       LIMIT 10
       FOR UPDATE OF sr SKIP LOCKED`
    );

    for (const row of dueRows) {
      // Verify user still has scheduled rescan access
      if (!hasFeatureAccess(row.tier, 'scheduledRescans')) {
        await pool.query(
          `UPDATE scheduled_rescans SET enabled = FALSE, updated_at = NOW() WHERE id = $1`,
          [row.id]
        );
        continue;
      }

      try {
        const normalizedTarget = normalizePublicHttpUrl(String(row.url || ''));
        if (!normalizedTarget.ok) {
          await pool.query(
            `UPDATE scheduled_rescans SET enabled = FALSE, updated_at = NOW() WHERE id = $1`,
            [row.id]
          );

          if (hooks?.onFailed) {
            await hooks.onFailed({
              userId: row.user_id,
              workspaceId: row.workspace_id,
              url: row.url,
              scheduleId: row.id,
              reason: `Invalid scheduled URL: ${normalizedTarget.error}`,
            });
          }
          continue;
        }

        const effectiveUrl = normalizedTarget.url;
        const changeCheck = await detectSubstantialChange(
          effectiveUrl,
          row.last_change_fingerprint || null,
          row.last_change_snapshot || null,
        );

        if (!changeCheck.shouldAnalyze) {
          // For 'once' frequency, disable after first check even if skipped
          if (row.frequency === 'once') {
            await pool.query(
              `UPDATE scheduled_rescans
               SET
                 enabled = FALSE,
                 last_checked_at = NOW(),
                 last_change_fingerprint = $1,
                 last_change_snapshot = $2,
                 last_change_evidence = $3,
                 updated_at = NOW()
               WHERE id = $4`,
              [
                changeCheck.fingerprint,
                JSON.stringify(changeCheck.snapshot),
                JSON.stringify(changeCheck.evidence),
                row.id,
              ]
            );
          } else {
            const skippedNextRun = new Date(Date.now() + (FREQUENCY_MS[row.frequency] || FREQUENCY_MS.weekly));
            await pool.query(
              `UPDATE scheduled_rescans
             SET
               next_run_at = $1,
               last_checked_at = NOW(),
               last_change_fingerprint = $2,
               last_change_snapshot = $3,
               last_change_evidence = $4,
               updated_at = NOW()
             WHERE id = $5`,
              [
                skippedNextRun.toISOString(),
                changeCheck.fingerprint,
                JSON.stringify(changeCheck.snapshot),
                JSON.stringify(changeCheck.evidence),
                row.id,
              ]
            );
          }

          if (hooks?.onSkipped) {
            await hooks.onSkipped({
              userId: row.user_id,
              workspaceId: row.workspace_id,
              url: effectiveUrl,
              scheduleId: row.id,
              reason: String(changeCheck.evidence.reason || 'no_material_change'),
            });
          }
          continue;
        }

        let previousAuditScore: number | null = null;
        if (row.last_audit_id) {
          const { rows: previousRows } = await pool.query(
            `SELECT visibility_score FROM audits WHERE id = $1 LIMIT 1`,
            [row.last_audit_id]
          );
          const parsed = Number(previousRows[0]?.visibility_score);
          if (Number.isFinite(parsed)) {
            previousAuditScore = parsed;
          }
        }
        const auditId = await analyzeInternally(row.user_id, row.workspace_id, effectiveUrl);
        if (!auditId) {
          throw new Error('Internal scheduled rescan did not produce an audit record');
        }
        const isOnce = row.frequency === 'once';
        const nextRunAt = isOnce
          ? new Date().toISOString()
          : new Date(Date.now() + (FREQUENCY_MS[row.frequency] || FREQUENCY_MS.weekly)).toISOString();

        let nextScore: number | null = null;
        const { rows: scoreRows } = await pool.query(
          `SELECT visibility_score FROM audits WHERE id = $1 LIMIT 1`,
          [auditId]
        );
        const parsed = Number(scoreRows[0]?.visibility_score);
        if (Number.isFinite(parsed)) {
          nextScore = parsed;
        }

        const scoreReason = buildScoreChangeReason(
          previousAuditScore,
          nextScore,
          changeCheck.evidence.changed_signals || [],
          'scheduled_rescan',
        );

        await pool.query(
          `UPDATE scheduled_rescans
           SET
             last_run_at = NOW(),
             last_checked_at = NOW(),
             last_audit_id = $1,
             next_run_at = $2,
             enabled = $8,
             last_change_fingerprint = $3,
             last_change_snapshot = $4,
             last_change_evidence = $5,
             last_score_change_reason = $6,
             updated_at = NOW()
           WHERE id = $7`,
          [
            auditId,
            nextRunAt,
            changeCheck.fingerprint,
            JSON.stringify(changeCheck.snapshot),
            JSON.stringify(changeCheck.evidence),
            scoreReason ? JSON.stringify(scoreReason) : null,
            row.id,
            !isOnce,
          ]
        );

        if (hooks?.onCompleted) {
          await hooks.onCompleted({
            userId: row.user_id,
            workspaceId: row.workspace_id,
            url: effectiveUrl,
            scheduleId: row.id,
            auditId,
          });
        }

        processed++;
        console.log(`[rescan] Completed scheduled rescan for ${effectiveUrl} (user ${row.user_id})`);
      } catch (err: any) {
        console.error(`[rescan] Failed rescan for ${row.url}: ${err.message}`);
        // Push next_run_at forward so we don't retry immediately
        const retryDelay = Math.min(FREQUENCY_MS[row.frequency] || FREQUENCY_MS.weekly, 60 * 60 * 1000); // retry in 1 hour max
        const nextRetry = new Date(Date.now() + retryDelay);
        await pool.query(
          `UPDATE scheduled_rescans SET next_run_at = $1, updated_at = NOW() WHERE id = $2`,
          [nextRetry.toISOString(), row.id]
        );

        if (hooks?.onFailed) {
          await hooks.onFailed({
            userId: row.user_id,
            workspaceId: row.workspace_id,
            url: row.url,
            scheduleId: row.id,
            reason: String(err?.message || 'Rescan execution failed'),
          });
        }
      }
    }
  } catch (err: any) {
    console.error(`[rescan] processDueRescans error: ${err.message}`);
  }

  return processed;
}

export async function processDueCompetitorAutopilot(
  analyzeInternally: (userId: string, workspaceId: string, url: string) => Promise<string | null>,
): Promise<number> {
  const pool = getPool();
  let processed = 0;

  try {
    const { rows: dueRows } = await pool.query(
      `SELECT ct.*, u.tier
       FROM competitor_tracking ct
       JOIN users u ON u.id = ct.user_id
       WHERE ct.monitoring_enabled = TRUE
         AND ct.workspace_id IS NOT NULL
         AND ct.next_monitor_at <= NOW()
       ORDER BY ct.next_monitor_at ASC
       LIMIT 10`
    );
    console.log(`[competitor-autopilot] Cycle candidates=${dueRows.length}`);

    for (const row of dueRows) {
      try {
        const user = await getUserById(String(row.user_id));
        const tier = String(user?.tier || row.tier || 'observer');
        if (!hasFeatureAccess(tier, 'competitorDiff')) {
          await pool.query(
            `UPDATE competitor_tracking SET monitoring_enabled = FALSE, updated_at = NOW() WHERE id = $1`,
            [row.id]
          );
          continue;
        }

        const check = await detectSubstantialChange(
          row.competitor_url,
          row.last_change_fingerprint || null,
          row.last_change_snapshot || null,
        );

        const nextMonitor = new Date(Date.now() + (FREQUENCY_MS[row.monitor_frequency] || FREQUENCY_MS.daily));

        if (!check.shouldAnalyze) {
          await pool.query(
            `UPDATE competitor_tracking
             SET
               last_checked_at = NOW(),
               next_monitor_at = $1,
               last_change_fingerprint = $2,
               last_change_snapshot = $3,
               last_change_evidence = $4,
               updated_at = NOW()
             WHERE id = $5`,
            [
              nextMonitor.toISOString(),
              check.fingerprint,
              JSON.stringify(check.snapshot),
              JSON.stringify(check.evidence),
              row.id,
            ]
          );
          continue;
        }

        const previousScore = Number(row.latest_score);
        const auditId = await analyzeInternally(row.user_id, row.workspace_id, row.competitor_url);

        let newScore: number | null = null;
        if (auditId) {
          const { rows: scoreRows } = await pool.query(
            `SELECT visibility_score FROM audits WHERE id = $1 LIMIT 1`,
            [auditId]
          );
          const parsed = Number(scoreRows[0]?.visibility_score);
          if (Number.isFinite(parsed)) {
            newScore = parsed;
          }
        }

        const scoreReason = buildScoreChangeReason(
          Number.isFinite(previousScore) ? previousScore : null,
          newScore,
          check.evidence.changed_signals || [],
          'competitor_autopilot',
        );

        await pool.query(
          `UPDATE competitor_tracking
           SET
             last_checked_at = NOW(),
             last_change_detected_at = NOW(),
             next_monitor_at = $1,
             last_change_fingerprint = $2,
             last_change_snapshot = $3,
             last_change_evidence = $4,
             last_score_change_reason = $5,
             updated_at = NOW()
           WHERE id = $6`,
          [
            nextMonitor.toISOString(),
            check.fingerprint,
            JSON.stringify(check.snapshot),
            JSON.stringify(check.evidence),
            scoreReason ? JSON.stringify(scoreReason) : null,
            row.id,
          ]
        );

        processed++;
      } catch (err: any) {
        const retry = new Date(Date.now() + 60 * 60 * 1000);
        await pool.query(
          `UPDATE competitor_tracking SET next_monitor_at = $1, updated_at = NOW() WHERE id = $2`,
          [retry.toISOString(), row.id]
        );
        console.error(`[competitor-autopilot] Failed monitor for ${row.competitor_url}: ${err?.message || err}`);
      }
    }
  } catch (err: any) {
    console.error(`[competitor-autopilot] process error: ${err?.message || err}`);
  }

  return processed;
}

let competitorIntervalId: ReturnType<typeof setInterval> | null = null;
let discoveryIntervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Auto-discover niche competitors for each user by finding keyword-overlapping
 * domains from their audit history and inserting them with auto_discovered=TRUE.
 * Runs every 6 hours. Respects tier competitor limits.
 */
export async function processCompetitorAutoDiscovery(): Promise<number> {
  const pool = getPool();
  let inserted = 0;

  try {
    // Find eligible users: alignment+ tier, have a website, have audits with keywords
    const { rows: users } = await pool.query(`
      SELECT DISTINCT
        u.id AS user_id,
        u.tier,
        u.website,
        w.id AS workspace_id
      FROM users u
      LEFT JOIN workspaces w ON w.created_by_user_id = u.id AND w.is_default = TRUE
      WHERE u.website IS NOT NULL
        AND u.website != ''
        AND u.tier IN ('alignment','signal','agency','scorefix')
        AND EXISTS (
          SELECT 1 FROM audits a
          WHERE a.user_id = u.id
            AND a.result->'topical_keywords' IS NOT NULL
            AND jsonb_array_length(COALESCE(a.result->'topical_keywords','[]')) > 0
        )
      LIMIT 50
    `);

    for (const user of users) {
      try {
        const tier = uiTierFromCanonical((user.tier || 'observer') as CanonicalTier | LegacyTier);
        const maxCompetitors = Number(TIER_LIMITS[tier]?.competitors ?? 0);
        if (maxCompetitors === 0) continue;

        // Count currently tracked competitors
        const { rows: countRows } = await pool.query(
          `SELECT COUNT(*) AS cnt FROM competitor_tracking WHERE user_id = $1`,
          [user.user_id],
        );
        const currentCount = parseInt(countRows[0]?.cnt || '0', 10);
        const slotsAvailable = maxCompetitors - currentCount;
        if (slotsAvailable <= 0) continue;

        // Normalize user's own domain
        let userDomain = '';
        try {
          const candidate = /^https?:\/\//i.test(user.website) ? user.website : `https://${user.website}`;
          userDomain = new URL(candidate).hostname.replace(/^www\./, '').toLowerCase();
        } catch { continue; }
        if (!userDomain) continue;

        // Get target keywords from user's own domain audit
        const { rows: kwRows } = await pool.query(
          `SELECT result->'topical_keywords' AS keywords
           FROM audits
           WHERE user_id = $1 AND url ILIKE $2
           ORDER BY created_at DESC LIMIT 1`,
          [user.user_id, `%${userDomain}%`],
        );
        const targetKeywords: string[] = Array.isArray(kwRows[0]?.keywords)
          ? kwRows[0].keywords.map((k: unknown) => String(k).toLowerCase())
          : [];
        if (targetKeywords.length === 0) continue;

        // Get already-tracked competitor domains
        const { rows: tracked } = await pool.query(
          `SELECT competitor_url FROM competitor_tracking WHERE user_id = $1`,
          [user.user_id],
        );
        const trackedDomains = new Set<string>(
          tracked.map((r: any) => {
            try { return new URL(r.competitor_url).hostname.replace(/^www\./, '').toLowerCase(); }
            catch { return ''; }
          }).filter(Boolean),
        );
        trackedDomains.add(userDomain);

        // Find other audited URLs with keyword overlap
        const { rows: candidates } = await pool.query(
          `SELECT DISTINCT ON (lower(regexp_replace(regexp_replace(url, '^https?://(www\\.)?', ''), '/+$', '')))
             url, result->'topical_keywords' AS keywords
           FROM audits
           WHERE user_id = $1
             AND url NOT ILIKE $2
             AND result->'topical_keywords' IS NOT NULL
           ORDER BY lower(regexp_replace(regexp_replace(url, '^https?://(www\\.)?', ''), '/+$', '')),
                    created_at DESC
           LIMIT 40`,
          [user.user_id, `%${userDomain}%`],
        );

        let toAdd = Math.min(slotsAvailable, 3); // cap auto-adds per run

        for (const c of candidates) {
          if (toAdd <= 0) break;
          let domain = '';
          try { domain = new URL(c.url).hostname.replace(/^www\./, '').toLowerCase(); }
          catch { continue; }
          if (trackedDomains.has(domain)) continue;

          const cKeywords: string[] = Array.isArray(c.keywords)
            ? c.keywords.map((k: unknown) => String(k).toLowerCase())
            : [];
          const overlap = targetKeywords.filter(k => cKeywords.includes(k)).length;
          const overlapRatio = targetKeywords.length > 0 ? overlap / targetKeywords.length : 0;
          if (overlap < 2 && overlapRatio < 0.2) continue;

          const safeNickname = domain.split('.')[0] || domain;
          try {
            await pool.query(
              `INSERT INTO competitor_tracking
                 (user_id, competitor_url, nickname, monitoring_enabled, next_monitor_at,
                  canonical_domain, auto_discovered, workspace_id)
               VALUES ($1, $2, $3, TRUE, NOW(), $4, TRUE, $5)
               ON CONFLICT (user_id, competitor_url) DO NOTHING`,
              [user.user_id, c.url, safeNickname, domain, user.workspace_id || null],
            );
            trackedDomains.add(domain);
            inserted++;
            toAdd--;
          } catch { /* skip duplicates */ }
        }
      } catch (err: any) {
        console.warn(`[competitor-discovery] Failed for user ${user.user_id}: ${err?.message}`);
      }
    }
  } catch (err: any) {
    console.error(`[competitor-discovery] process error: ${err?.message}`);
  }

  return inserted;
}

export function startCompetitorAutopilotLoop(
  analyzeInternally: (userId: string, workspaceId: string, url: string) => Promise<string | null>,
): void {
  if (competitorIntervalId) return;

  const globalDisable = process.env.DISABLE_BACKGROUND_JOBS === 'true';
  const loopDisable = process.env.DISABLE_COMPETITOR_AUTOPILOT === 'true';
  if (globalDisable || loopDisable) {
    console.log('[competitor-autopilot] Loop disabled via env (DISABLE_COMPETITOR_AUTOPILOT or DISABLE_BACKGROUND_JOBS)');
    return;
  }

  console.log(' Competitor autopilot loop started (10-min interval)');
  competitorIntervalId = setInterval(async () => {
    const count = await processDueCompetitorAutopilot(analyzeInternally);
    console.log(`[competitor-autopilot] Cycle processed=${count}`);
  }, 10 * 60 * 1000);

  setTimeout(async () => {
    const count = await processDueCompetitorAutopilot(analyzeInternally);
    console.log(`[competitor-autopilot] Initial cycle processed=${count}`);
  }, 45_000);

  // Auto-discovery: find and add niche competitors from audit history every 6 hours.
  discoveryIntervalId = setInterval(async () => {
    const added = await processCompetitorAutoDiscovery();
    if (added > 0) console.log(`[competitor-discovery] Auto-added ${added} niche competitor(s)`);
  }, 6 * 60 * 60 * 1000);

  // Initial discovery run after 3 minutes (let the DB warm up first)
  setTimeout(async () => {
    const added = await processCompetitorAutoDiscovery();
    if (added > 0) console.log(`[competitor-discovery] Initial auto-add: ${added} niche competitor(s)`);
  }, 3 * 60 * 1000);
}

/**
 * Start the background rescan loop. Checks every 5 minutes.
 */
export function startRescanLoop(
  analyzeInternally: (userId: string, workspaceId: string, url: string) => Promise<string | null>,
  hooks?: RescanLifecycleHooks,
): void {
  if (rescanIntervalId) return;

  const globalDisable = process.env.DISABLE_BACKGROUND_JOBS === 'true';
  const loopDisable = process.env.DISABLE_SCHEDULED_RESCANS === 'true';
  if (globalDisable || loopDisable) {
    console.log('[rescan] Scheduled rescan loop disabled via env (DISABLE_SCHEDULED_RESCANS or DISABLE_BACKGROUND_JOBS)');
    return;
  }

  console.log(' Scheduled rescan loop started (5-min interval)');
  rescanIntervalId = setInterval(async () => {
    const count = await processDueRescans(analyzeInternally, hooks);
    if (count > 0) console.log(`[rescan] Processed ${count} scheduled rescans`);
  }, 5 * 60 * 1000);

  // Also run immediately on startup after a short delay
  setTimeout(() => processDueRescans(analyzeInternally, hooks), 30_000);
}

export function stopRescanLoop(): void {
  if (rescanIntervalId) {
    clearInterval(rescanIntervalId);
    rescanIntervalId = null;
  }

  if (competitorIntervalId) {
    clearInterval(competitorIntervalId);
    competitorIntervalId = null;
  }

  if (discoveryIntervalId) {
    clearInterval(discoveryIntervalId);
    discoveryIntervalId = null;
  }
}
