import { getPool, executeTransaction } from './postgresql.js';
import { createUserNotification } from './notificationService.js';
import {
  MILESTONES,
  type MilestoneKey,
  type MilestoneDefinition,
} from '../../../shared/types.js';

/* ────────── helpers ────────── */

function roundCredits(value: number): number {
  return Math.round(Math.max(0, Number(value || 0)) * 100) / 100;
}

/* ────────── public API ────────── */

/**
 * Get all milestones a user has already unlocked.
 */
export async function getUserMilestones(
  userId: string,
): Promise<{ key: MilestoneKey; creditsAwarded: number; unlockedAt: string }[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT milestone_key, credits_awarded, unlocked_at
     FROM user_milestones WHERE user_id = $1
     ORDER BY unlocked_at ASC`,
    [userId],
  );
  return rows.map((r: any) => ({
    key: r.milestone_key as MilestoneKey,
    creditsAwarded: Number(r.credits_awarded),
    unlockedAt: r.unlocked_at,
  }));
}

/**
 * Get milestones the user has NOT yet unlocked.
 */
export async function getNextMilestones(
  userId: string,
): Promise<MilestoneDefinition[]> {
  const unlocked = await getUserMilestones(userId);
  const unlockedSet = new Set(unlocked.map((m) => m.key));
  return MILESTONES.filter((m) => !unlockedSet.has(m.key));
}

/**
 * Try to award a specific milestone. Returns true if newly awarded.
 * Idempotent — will not double-award.
 */
export async function awardMilestone(
  userId: string,
  milestoneKey: MilestoneKey,
): Promise<{ awarded: boolean; creditReward: number }> {
  const def = MILESTONES.find((m) => m.key === milestoneKey);
  if (!def) return { awarded: false, creditReward: 0 };

  return executeTransaction(async (client: any) => {
    // Idempotent check
    const existing = await client.query(
      `SELECT id FROM user_milestones WHERE user_id = $1 AND milestone_key = $2`,
      [userId, milestoneKey],
    );
    if (existing.rows.length > 0) return { awarded: false, creditReward: 0 };

    // Record milestone
    await client.query(
      `INSERT INTO user_milestones (user_id, milestone_key, credits_awarded)
       VALUES ($1, $2, $3)`,
      [userId, milestoneKey, def.creditReward],
    );

    // Grant credits
    const creditAmount = roundCredits(def.creditReward);
    if (creditAmount > 0) {
      await client.query(
        `INSERT INTO scan_pack_credits (user_id, credits_remaining)
         VALUES ($1, $2)
         ON CONFLICT (user_id)
         DO UPDATE SET credits_remaining = ROUND((scan_pack_credits.credits_remaining + $2)::numeric, 2),
                       updated_at = NOW()
         RETURNING credits_remaining`,
        [userId, creditAmount],
      );

      // Ledger entry
      const balSnap = await client.query(
        `SELECT credits_remaining FROM scan_pack_credits WHERE user_id = $1`,
        [userId],
      );
      const balanceAfter = Number(balSnap.rows[0]?.credits_remaining || 0);

      await client.query(
        `INSERT INTO credit_usage_ledger (user_id, delta_credits, balance_after, reason, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          userId,
          creditAmount,
          balanceAfter,
          'milestone_reward',
          JSON.stringify({
            milestoneKey,
            label: def.label,
            creditReward: creditAmount,
            purpose: 'milestone_reward',
            trackedAt: new Date().toISOString(),
          }),
        ],
      );
    }

    // Notification
    await createUserNotification({
      userId,
      eventType: 'milestone_unlocked',
      title: `${def.icon} Milestone: ${def.label}`,
      message: `${def.description} — ${def.creditReward} credits rewarded!`,
      metadata: { milestoneKey, creditReward: def.creditReward },
    }).catch(() => {});

    return { awarded: true, creditReward: def.creditReward };
  });
}

/* ────────── event-driven milestone checks ────────── */

/**
 * Call after any audit completes. Checks first_audit, power_scanner_25, century_club_100.
 */
export async function checkAuditMilestones(userId: string): Promise<void> {
  const pool = getPool();

  // Total audit count
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS cnt FROM audits WHERE user_id = $1`,
    [userId],
  );
  const count = rows[0]?.cnt ?? 0;

  if (count >= 1) await awardMilestone(userId, 'first_audit');
  if (count >= 25) await awardMilestone(userId, 'power_scanner_25');
  if (count >= 100) await awardMilestone(userId, 'century_club_100');
}

/**
 * Call after a score comparison detects improvement.
 * prevScore and newScore are visibility_score values (0-100).
 */
export async function checkScoreImprovementMilestone(
  userId: string,
  prevScore: number,
  newScore: number,
): Promise<void> {
  if (newScore - prevScore >= 10) {
    await awardMilestone(userId, 'score_improver_10');
  }
}

/**
 * Call after a citation test completes.
 */
export async function checkCitationMilestones(userId: string): Promise<void> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS cnt FROM citation_tests WHERE user_id = $1`,
    [userId],
  );
  if ((rows[0]?.cnt ?? 0) >= 10) {
    await awardMilestone(userId, 'citation_hunter_10');
  }
}

/**
 * Call after a competitor is added.
 */
export async function checkCompetitorMilestones(userId: string): Promise<void> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS cnt FROM competitor_tracking WHERE user_id = $1`,
    [userId],
  );
  if ((rows[0]?.cnt ?? 0) >= 3) {
    await awardMilestone(userId, 'competitor_watcher_3');
  }
}

/**
 * Call on login. Checks streak_7_days.
 */
export async function checkStreakMilestone(userId: string): Promise<void> {
  const pool = getPool();
  // Check if user has 7 consecutive days with activity
  // Uses usage_daily as the activity signal
  const { rows } = await pool.query(
    `WITH daily_dates AS (
       SELECT DISTINCT usage_date FROM usage_daily
       WHERE user_id = $1
       ORDER BY usage_date DESC
       LIMIT 30
     ),
     streaks AS (
       SELECT usage_date,
              usage_date - (ROW_NUMBER() OVER (ORDER BY usage_date))::int AS grp
       FROM daily_dates
     )
     SELECT COUNT(*)::int AS streak_len
     FROM streaks
     GROUP BY grp
     ORDER BY streak_len DESC
     LIMIT 1`,
    [userId],
  );
  if ((rows[0]?.streak_len ?? 0) >= 7) {
    await awardMilestone(userId, 'streak_7_days');
  }
}

/**
 * Call after a referral is confirmed.
 */
export async function checkReferralMilestones(userId: string): Promise<void> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS cnt FROM referral_attributions
     WHERE referrer_user_id = $1 AND status = 'completed'`,
    [userId],
  );
  if ((rows[0]?.cnt ?? 0) >= 3) {
    await awardMilestone(userId, 'referral_star_3');
  }
}
