import { getPool } from './postgresql.js';
import { uiTierFromCanonical, type CanonicalTier, type LegacyTier } from '../../../shared/types.js';

type UserLike = {
  id: string;
  email?: string | null;
  tier?: string | null;
};

const OBSERVER_TIER: CanonicalTier = 'observer';
let allowlistCountWarned = false;

function normalizeTier(value: unknown): CanonicalTier {
  return uiTierFromCanonical((String(value || OBSERVER_TIER).toLowerCase() as CanonicalTier | LegacyTier));
}

function normalizeEmail(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

export function getAllowlistedElevatedEmails(): Set<string> {
  const raw = String(process.env.ELEVATED_TIER_ALLOWLIST_EMAILS || process.env.ADMIN_ELEVATED_ALLOWLIST_EMAILS || '');
  const emails = new Set(
    raw
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean)
  );

  if (!allowlistCountWarned && emails.size > 0) {
    allowlistCountWarned = true;
    console.log(`[EntitlementGuard] Loaded ${emails.size} allowlisted elevated account(s).`);
  }

  return emails;
}

async function hasConfirmedStripePayment(userId: string): Promise<boolean> {
  const pool = getPool();

  // Check 1: user row has an active stripe subscription id
  const userResult = await pool.query(
    `SELECT stripe_subscription_id FROM users WHERE id = $1`,
    [userId]
  );
  if (userResult.rows[0]?.stripe_subscription_id) return true;

  // Check 2: completed payment with a subscription OR a one-time completed payment
  const paymentResult = await pool.query(
    `SELECT EXISTS (
       SELECT 1
       FROM payments
       WHERE user_id = $1
         AND status = 'completed'
     ) AS has_paid`,
    [userId]
  );

  return paymentResult.rows[0]?.has_paid === true;
}

/**
 * Recover a user's tier from completed payments when current tier is observer
 * but a valid paid record exists (e.g., after an erroneous downgrade).
 */
async function recoverTierFromPayments(userId: string): Promise<CanonicalTier | null> {
  const pool = getPool();

  // Check if the user row has a stripe_subscription_id — look up the tier stored on the user
  const userRow = await pool.query(
    `SELECT tier, stripe_subscription_id FROM users WHERE id = $1`,
    [userId]
  );
  if (userRow.rows[0]?.stripe_subscription_id) {
    // The user has a subscription id but their tier was set to observer — something went wrong.
    // Look up the most recent completed payment to find the actual tier.
  }

  // Find the latest completed payment with a tier that isn't observer/free/scan_pack
  const paymentRow = await pool.query(
    `SELECT tier FROM payments
     WHERE user_id = $1
       AND status = 'completed'
       AND tier NOT IN ('observer', 'free', 'scan_pack', 'unknown')
     ORDER BY completed_at DESC NULLS LAST, created_at DESC
     LIMIT 1`,
    [userId]
  );

  if (!paymentRow.rows[0]?.tier) return null;

  const recoveredTier = normalizeTier(paymentRow.rows[0].tier);
  if (recoveredTier !== OBSERVER_TIER) {
    console.log(`[EntitlementGuard] Recovered tier '${recoveredTier}' from payments for user ${userId}`);
    return recoveredTier;
  }

  return null;
}

export async function resolveEffectiveTier(user: UserLike): Promise<CanonicalTier> {
  const normalizedTier = normalizeTier(user.tier);

  // Allowlist bypass — always trust elevated accounts
  const email = normalizeEmail(user.email);
  const allowlistedEmails = getAllowlistedElevatedEmails();
  if (email && allowlistedEmails.has(email)) {
    return normalizedTier;
  }

  // Check active trial — if user has a trial_ends_at in the future, honour the tier
  const trialTier = await getActiveTrialTier(String(user.id));
  if (trialTier) {
    return trialTier;
  }

  // If user is observer, check if they have a valid payment that was incorrectly downgraded
  if (normalizedTier === OBSERVER_TIER) {
    const recovered = await recoverTierFromPayments(String(user.id));
    return recovered ?? OBSERVER_TIER;
  }

  // For paid tiers, verify an actual active payment/subscription exists
  const paid = await hasConfirmedStripePayment(String(user.id));
  return paid ? normalizedTier : OBSERVER_TIER;
}

/**
 * Checks if a user has an active (non-expired) trial. Returns the trial tier
 * if active, or null. Also performs automatic downgrade if trial has expired.
 */
async function getActiveTrialTier(userId: string): Promise<CanonicalTier | null> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT tier, trial_ends_at FROM users WHERE id = $1`,
    [userId]
  );

  const row = result.rows[0];
  if (!row?.trial_ends_at) return null;

  const trialEnd = new Date(row.trial_ends_at);
  if (trialEnd > new Date()) {
    // Trial is still active — return the tier the user has
    const tier = normalizeTier(row.tier);
    return tier !== OBSERVER_TIER ? tier : null;
  }

  // Trial has expired — check if they've since made a real payment
  const paid = await hasConfirmedStripePayment(userId);
  if (paid) return null; // Let the normal paid-tier path handle it

  // No payment after trial expired → downgrade to observer
  console.log(`[EntitlementGuard] Trial expired for user ${userId} — downgrading to observer`);
  await pool.query(
    `UPDATE users
     SET tier = 'observer', trial_ends_at = NULL, updated_at = NOW()
     WHERE id = $1`,
    [userId]
  );
  return null; // Caller will resolve to observer
}

export async function enforceEffectiveTier(user: UserLike): Promise<CanonicalTier> {
  const effectiveTier = await resolveEffectiveTier(user);
  const storedTier = normalizeTier(user.tier);

  if (storedTier !== effectiveTier) {
    const pool = getPool();
    await pool.query(
      `UPDATE users
       SET tier = $2,
           updated_at = NOW()
       WHERE id = $1`,
      [user.id, effectiveTier]
    );
  }

  return effectiveTier;
}
