/**
 * Trial Service - manages 14-day Signal trial lifecycle.
 *
 * Responsibilities:
 *   • start trial (guard: one per account, observer-only)
 *   • query trial status
 *   • mark conversion after paid checkout
 *   • expire stale trials + downgrade users
 *   • send warning emails at day 10 + day 13
 *   • background loop (startTrialExpiryLoop)
 */

import { getPool } from './postgresql.js';
import { sendTrialEmail, type TrialEmailType } from './trialEmailTemplates.js';
import { createUserNotification } from './notificationService.js';
import type { CanonicalTier } from '../../../shared/types.js';

const TRIAL_DURATION_DAYS = 14;
const TRIAL_TIER: CanonicalTier = 'signal';
const WARNING_DAYS: readonly { day: number; emailType: TrialEmailType }[] = [
  { day: 10, emailType: 'trial_warning_day10' },
  { day: 13, emailType: 'trial_warning_day13' },
];
const LOOP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

// ─── Start Trial ──────────────────────────────────────────────────────────────

export interface StartTrialResult {
  ok: boolean;
  message: string;
  trialEndsAt?: string;
}

export async function startTrial(userId: string, email: string): Promise<StartTrialResult> {
  const pool = getPool();

  // Guard: check current state
  const userRow = await pool.query(
    `SELECT tier, trial_ends_at, trial_used, trial_converted FROM users WHERE id = $1`,
    [userId],
  );
  const user = userRow.rows[0];
  if (!user) return { ok: false, message: 'User not found.' };

  if (user.trial_used) {
    return { ok: false, message: 'Trial already used on this account.' };
  }
  if (user.trial_converted) {
    return { ok: false, message: 'Account already converted from trial.' };
  }
  if (user.trial_ends_at && new Date(user.trial_ends_at) > new Date()) {
    return { ok: false, message: 'Trial is already active.', trialEndsAt: user.trial_ends_at };
  }

  const storedTier = String(user.tier || 'observer').toLowerCase();
  if (storedTier !== 'observer') {
    return { ok: false, message: 'Trial is only available for Observer accounts.' };
  }

  // Grant trial
  const trialEndsAt = new Date(Date.now() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);

  await pool.query(
    `UPDATE users
     SET tier = $2,
         trial_ends_at = $3,
         trial_tier = $4,
         trial_started_at = NOW(),
         trial_used = TRUE,
         updated_at = NOW()
     WHERE id = $1`,
    [userId, TRIAL_TIER, trialEndsAt.toISOString(), TRIAL_TIER],
  );

  // Send welcome email (best-effort)
  sendTrialEmail(email, 'trial_started', { trialEndsAt: trialEndsAt.toISOString() }).catch((err) => {
    console.error(`[TrialService] Failed to send trial start email to ${email}:`, err?.message);
  });

  // Log email send
  await pool.query(
    `INSERT INTO trial_email_log (user_id, email_type) VALUES ($1, $2)
     ON CONFLICT (user_id, email_type) DO NOTHING`,
    [userId, 'trial_started'],
  ).catch(() => {});

  console.log(`[TrialService] Trial started for user ${userId} - ends ${trialEndsAt.toISOString()}`);

  createUserNotification({
    userId,
    eventType: 'trial_started',
    title: '14-Day Signal Trial Activated',
    message: `Your free Signal trial is active until ${trialEndsAt.toLocaleDateString()}. Enjoy triple-check analysis, citation testing, and more.`,
    metadata: { tier: TRIAL_TIER, trialEndsAt: trialEndsAt.toISOString() },
  }).catch(() => {});

  return { ok: true, message: 'Trial started.', trialEndsAt: trialEndsAt.toISOString() };
}

// ─── Trial Status ─────────────────────────────────────────────────────────────

export interface TrialStatus {
  active: boolean;
  trialTier: CanonicalTier | null;
  trialEndsAt: string | null;
  daysRemaining: number;
  trialUsed: boolean;
  converted: boolean;
}

export async function getTrialStatus(userId: string): Promise<TrialStatus> {
  const pool = getPool();
  const row = (await pool.query(
    `SELECT trial_tier, trial_ends_at, trial_used, trial_converted FROM users WHERE id = $1`,
    [userId],
  )).rows[0];

  if (!row) {
    return { active: false, trialTier: null, trialEndsAt: null, daysRemaining: 0, trialUsed: false, converted: false };
  }

  const now = new Date();
  const trialEnd = row.trial_ends_at ? new Date(row.trial_ends_at) : null;
  const active = !!trialEnd && trialEnd > now && !row.trial_converted;
  const daysRemaining = trialEnd && active
    ? Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
    : 0;

  return {
    active,
    trialTier: row.trial_tier || null,
    trialEndsAt: row.trial_ends_at ? new Date(row.trial_ends_at).toISOString() : null,
    daysRemaining,
    trialUsed: !!row.trial_used,
    converted: !!row.trial_converted,
  };
}

// ─── Trial Conversion (called from Stripe webhook) ───────────────────────────

export async function handleTrialConversionFromStripe(
  userId: string,
  newTier: string,
): Promise<void> {
  const pool = getPool();

  await pool.query(
    `UPDATE users
     SET trial_converted = TRUE,
         trial_ends_at = NULL,
         updated_at = NOW()
     WHERE id = $1`,
    [userId],
  );

  // Get user email to send conversion email
  const userRow = await pool.query(`SELECT email FROM users WHERE id = $1`, [userId]);
  const email = userRow.rows[0]?.email;
  if (email) {
    sendTrialEmail(email, 'trial_converted', { newTier }).catch((err) => {
      console.error(`[TrialService] Failed to send conversion email:`, err?.message);
    });
    await pool.query(
      `INSERT INTO trial_email_log (user_id, email_type) VALUES ($1, $2)
       ON CONFLICT (user_id, email_type) DO NOTHING`,
      [userId, 'trial_converted'],
    ).catch(() => {});
  }

  console.log(`[TrialService] Trial conversion recorded for user ${userId} → ${newTier}`);

  createUserNotification({
    userId,
    eventType: 'trial_converted',
    title: `Welcome to ${newTier.charAt(0).toUpperCase() + newTier.slice(1)}!`,
    message: `Your trial has been converted to a paid ${newTier} plan. Thank you for subscribing!`,
    metadata: { newTier },
  }).catch(() => {});
}

// ─── Expire Stale Trials ─────────────────────────────────────────────────────

export async function expireStaleTrials(): Promise<number> {
  const pool = getPool();

  const result = await pool.query(
    `UPDATE users
     SET tier = 'observer',
         trial_ends_at = NULL,
         updated_at = NOW()
     WHERE trial_ends_at IS NOT NULL
       AND trial_ends_at < NOW()
       AND trial_converted = FALSE
       AND (tier != 'observer' OR trial_ends_at IS NOT NULL)
     RETURNING id, email`,
  );

  for (const row of result.rows) {
    console.log(`[TrialService] Expired trial for user ${row.id}`);

    createUserNotification({
      userId: row.id,
      eventType: 'trial_expired',
      title: 'Signal Trial Ended',
      message: 'Your 14-day Signal trial has expired. Upgrade to keep premium features.',
      metadata: { previousTier: TRIAL_TIER },
    }).catch(() => {});

    if (row.email) {
      sendTrialEmail(row.email, 'trial_expired', {}).catch((err) => {
        console.error(`[TrialService] Failed to send expiry email:`, err?.message);
      });
      await pool.query(
        `INSERT INTO trial_email_log (user_id, email_type) VALUES ($1, $2)
         ON CONFLICT (user_id, email_type) DO NOTHING`,
        [row.id, 'trial_expired'],
      ).catch(() => {});
    }
  }

  return result.rowCount ?? 0;
}

// ─── Warning Emails ──────────────────────────────────────────────────────────

export async function sendTrialWarningEmails(): Promise<number> {
  const pool = getPool();
  let sent = 0;

  for (const { day, emailType } of WARNING_DAYS) {
    // Find users whose trial started `day` days ago, haven't converted, and haven't received this email yet
    const result = await pool.query(
      `SELECT u.id, u.email, u.trial_ends_at
       FROM users u
       WHERE u.trial_ends_at IS NOT NULL
         AND u.trial_converted = FALSE
         AND u.trial_ends_at > NOW()
         AND u.trial_started_at IS NOT NULL
         AND u.trial_started_at <= NOW() - INTERVAL '1 day' * $1
         AND NOT EXISTS (
           SELECT 1 FROM trial_email_log tel
           WHERE tel.user_id = u.id AND tel.email_type = $2
         )`,
      [day, emailType],
    );

    for (const row of result.rows) {
      const daysLeft = Math.max(0, Math.ceil(
        (new Date(row.trial_ends_at).getTime() - Date.now()) / (24 * 60 * 60 * 1000),
      ));
      await sendTrialEmail(row.email, emailType, { daysLeft, trialEndsAt: row.trial_ends_at }).catch((err) => {
        console.error(`[TrialService] Warning email failed for ${row.id}:`, err?.message);
      });
      await pool.query(
        `INSERT INTO trial_email_log (user_id, email_type) VALUES ($1, $2)
         ON CONFLICT (user_id, email_type) DO NOTHING`,
        [row.id, emailType],
      ).catch(() => {});
      sent++;
    }
  }

  return sent;
}

// ─── Background Loop ─────────────────────────────────────────────────────────

export function startTrialExpiryLoop(): void {
  console.log('[TrialService] Starting trial expiry + warning loop');

  const run = async () => {
    try {
      const expired = await expireStaleTrials();
      const warned = await sendTrialWarningEmails();
      if (expired > 0 || warned > 0) {
        console.log(`[TrialService] Loop tick: expired=${expired}, warned=${warned}`);
      }
    } catch (err: any) {
      console.error('[TrialService] Loop error:', err?.message);
    }
  };

  // Run immediately, then on interval
  run();
  setInterval(run, LOOP_INTERVAL_MS);
}
