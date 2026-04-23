import crypto from 'crypto';
import { executeTransaction, getPool } from './postgresql.js';
import { appendCreditLedgerEvent } from './creditLedger.js';

const REFERRAL_CODE_LENGTH = 8;
const REFERRAL_CREDITS_TO_REFERRER = Number(process.env.REFERRAL_CREDITS_TO_REFERRER || 5);
const REFERRAL_CREDITS_TO_REFERRED = Number(process.env.REFERRAL_CREDITS_TO_REFERRED || 5);
const REFERRAL_MIN_AUDITS_FOR_REWARD = Number(process.env.REFERRAL_MIN_AUDITS_FOR_REWARD || 5);
const REFERRAL_PAID_REWARD_MULTIPLIER = Number(process.env.REFERRAL_PAID_REWARD_MULTIPLIER || 3);
const PAID_TIERS = new Set(['alignment', 'signal', 'scorefix']);

function sanitizeCode(code: string): string {
  return String(code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function randomCode(length = REFERRAL_CODE_LENGTH): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

async function createUniqueReferralCode(userId: string): Promise<string> {
  const pool = getPool();
  for (let i = 0; i < 8; i += 1) {
    const code = randomCode();
    const inserted = await pool.query(
      `INSERT INTO referral_codes (user_id, code)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
       RETURNING code`,
      [userId, code]
    ).catch(async (err: any) => {
      if (String(err?.message || '').toLowerCase().includes('duplicate key value')) {
        return null;
      }
      throw err;
    });

    if (inserted?.rows?.length) {
      return String(inserted.rows[0].code);
    }
  }

  throw new Error('Failed to generate unique referral code');
}

export async function getOrCreateReferralCode(userId: string): Promise<string> {
  const pool = getPool();
  const existing = await pool.query('SELECT code FROM referral_codes WHERE user_id = $1', [userId]);
  if (existing.rows[0]?.code) return String(existing.rows[0].code);
  return createUniqueReferralCode(userId);
}

export async function validateReferralCode(referralCode: string): Promise<{ valid: boolean; referrerUserId?: string; code?: string }> {
  const code = sanitizeCode(referralCode);
  if (!code || code.length < 6) return { valid: false };
  const pool = getPool();
  const hit = await pool.query('SELECT user_id, code FROM referral_codes WHERE code = $1', [code]);
  const row = hit.rows[0];
  if (!row?.user_id) return { valid: false };
  return { valid: true, referrerUserId: String(row.user_id), code: String(row.code) };
}

export async function attachReferralAtSignup(args: {
  referredUserId: string;
  referredEmail: string;
  referralCode: string;
}): Promise<{ attached: boolean; reason?: string; referrerUserId?: string }> {
  const validated = await validateReferralCode(args.referralCode);
  if (!validated.valid || !validated.referrerUserId || !validated.code) {
    return { attached: false, reason: 'invalid_referral_code' };
  }

  if (validated.referrerUserId === args.referredUserId) {
    return { attached: false, reason: 'self_referral_blocked' };
  }

  const pool = getPool();

  const referrer = await pool.query('SELECT id, email, is_verified FROM users WHERE id = $1 LIMIT 1', [validated.referrerUserId]);
  if (!referrer.rows[0]?.id) {
    return { attached: false, reason: 'referrer_not_found' };
  }

  if (String(referrer.rows[0].email || '').toLowerCase() === String(args.referredEmail || '').toLowerCase()) {
    return { attached: false, reason: 'self_referral_email_match' };
  }

  await executeTransaction(async (client) => {
    await client.query(
      `INSERT INTO referral_attributions (referrer_user_id, referred_user_id, referral_code, status)
       VALUES ($1, $2, $3, 'pending')
       ON CONFLICT (referred_user_id)
       DO NOTHING`,
      [validated.referrerUserId, args.referredUserId, validated.code]
    );
  });

  return { attached: true, referrerUserId: validated.referrerUserId };
}

export async function settleReferralCreditsIfEligible(referredUserId: string): Promise<{
  granted: boolean;
  reason?: string;
  referrerUserId?: string;
  referrerCreditsAdded?: number;
  referredCreditsAdded?: number;
  multiplier?: number;
  auditCount?: number;
  requiredAudits?: number;
  referredTier?: string;
}> {
  return executeTransaction(async (client) => {
    const attrRes = await client.query(
      `SELECT id, referrer_user_id, referred_user_id, status
       FROM referral_attributions
       WHERE referred_user_id = $1
       FOR UPDATE
       LIMIT 1`,
      [referredUserId]
    );

    const attribution = attrRes.rows[0];
    if (!attribution?.id) {
      return { granted: false, reason: 'no_referral_attribution' };
    }

    if (String(attribution.status) === 'granted') {
      return { granted: false, reason: 'already_granted', referrerUserId: String(attribution.referrer_user_id) };
    }

    if (String(attribution.status) === 'rejected') {
      return { granted: false, reason: 'attribution_rejected', referrerUserId: String(attribution.referrer_user_id) };
    }

    const referrerUserId = String(attribution.referrer_user_id);
    const userRes = await client.query(
      `SELECT tier FROM users WHERE id = $1 LIMIT 1`,
      [referredUserId]
    );
    const referredTier = String(userRes.rows[0]?.tier || 'observer').toLowerCase();
    const isPaidReferredUser = PAID_TIERS.has(referredTier);

    const auditCountRes = await client.query(
      `SELECT COUNT(*)::int AS total FROM audits WHERE user_id = $1`,
      [referredUserId]
    );
    const auditCount = Number(auditCountRes.rows[0]?.total || 0);
    const meetsAuditThreshold = auditCount >= REFERRAL_MIN_AUDITS_FOR_REWARD;

    if (!meetsAuditThreshold && !isPaidReferredUser) {
      return {
        granted: false,
        reason: 'eligibility_not_met',
        referrerUserId,
        auditCount,
        requiredAudits: REFERRAL_MIN_AUDITS_FOR_REWARD,
        referredTier,
      };
    }

    const multiplier = isPaidReferredUser ? Math.max(1, REFERRAL_PAID_REWARD_MULTIPLIER) : 1;
    const referrerCredits = REFERRAL_CREDITS_TO_REFERRER * multiplier;
    const referredCredits = REFERRAL_CREDITS_TO_REFERRED * multiplier;

    const claimRes = await client.query(
      `UPDATE referral_attributions
       SET status = 'granting',
           updated_at = NOW()
       WHERE id = $1
         AND status = 'pending'
       RETURNING id`,
      [attribution.id]
    );

    if (!claimRes.rows[0]?.id) {
      return {
        granted: false,
        reason: 'already_settled_or_in_progress',
        referrerUserId,
        auditCount,
        requiredAudits: REFERRAL_MIN_AUDITS_FOR_REWARD,
        referredTier,
      };
    }

    await client.query(
      `INSERT INTO scan_pack_credits (user_id, credits_remaining)
       VALUES ($1, $2)
       ON CONFLICT (user_id)
       DO UPDATE SET credits_remaining = scan_pack_credits.credits_remaining + EXCLUDED.credits_remaining,
                     updated_at = NOW()`,
      [referrerUserId, referrerCredits]
    );

    await appendCreditLedgerEvent({
      userId: referrerUserId,
      type: 'adjustment',
      delta: referrerCredits,
      source: 'system',
      requestId: `referral:${attribution.id}:referrer:${referrerUserId}`,
      metadata: {
        attributionId: attribution.id,
        referredUserId,
        reason: 'referral_reward_referrer',
        multiplier,
      },
      client,
    });

    await client.query(
      `INSERT INTO scan_pack_credits (user_id, credits_remaining)
       VALUES ($1, $2)
       ON CONFLICT (user_id)
       DO UPDATE SET credits_remaining = scan_pack_credits.credits_remaining + EXCLUDED.credits_remaining,
                     updated_at = NOW()`,
      [referredUserId, referredCredits]
    );

    await appendCreditLedgerEvent({
      userId: referredUserId,
      type: 'adjustment',
      delta: referredCredits,
      source: 'system',
      requestId: `referral:${attribution.id}:referred:${referredUserId}`,
      metadata: {
        attributionId: attribution.id,
        referrerUserId,
        reason: 'referral_reward_referred',
        multiplier,
      },
      client,
    });

    const finalizeRes = await client.query(
      `UPDATE referral_attributions
       SET status = 'granted',
           credits_awarded_referrer = $2,
           credits_awarded_referred = $3,
           awarded_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
         AND status = 'granting'
       RETURNING id`,
      [attribution.id, referrerCredits, referredCredits]
    );

    if (!finalizeRes.rows[0]?.id) {
      throw new Error('Failed to finalize referral credit grant');
    }

    await client.query(
      `INSERT INTO referral_credit_ledger (user_id, counterparty_user_id, attribution_id, delta_credits, reason)
       VALUES
       ($1, $2, $3, $4, 'referral_reward_referrer'),
       ($2, $1, $3, $5, 'referral_reward_referred')`,
      [referrerUserId, referredUserId, attribution.id, referrerCredits, referredCredits]
    );

    return {
      granted: true,
      referrerUserId,
      referrerCreditsAdded: referrerCredits,
      referredCreditsAdded: referredCredits,
      multiplier,
      auditCount,
      requiredAudits: REFERRAL_MIN_AUDITS_FOR_REWARD,
      referredTier,
    };
  });
}

export async function grantReferralCreditsOnVerification(referredUserId: string) {
  return settleReferralCreditsIfEligible(referredUserId);
}

export async function getReferralProgramSummary(userId: string): Promise<{
  code: string;
  stats: {
    pending: number;
    granted: number;
    totalReferrals: number;
    totalCreditsEarned: number;
    totalCreditsGivenToFriends: number;
  };
  constants: {
    creditsToReferrer: number;
    creditsToReferred: number;
    requiredAuditsForReward: number;
    paidRewardMultiplier: number;
  };
}> {
  const code = await getOrCreateReferralCode(userId);
  const pool = getPool();

  const statsRes = await pool.query(
    `SELECT
        COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
        COUNT(*) FILTER (WHERE status = 'granted')::int AS granted,
        COUNT(*)::int AS total,
        COALESCE(SUM(credits_awarded_referrer), 0)::int AS earned,
        COALESCE(SUM(credits_awarded_referred), 0)::int AS given
     FROM referral_attributions
     WHERE referrer_user_id = $1`,
    [userId]
  );

  const row = statsRes.rows[0] || {};
  return {
    code,
    stats: {
      pending: Number(row.pending || 0),
      granted: Number(row.granted || 0),
      totalReferrals: Number(row.total || 0),
      totalCreditsEarned: Number(row.earned || 0),
      totalCreditsGivenToFriends: Number(row.given || 0),
    },
    constants: {
      creditsToReferrer: REFERRAL_CREDITS_TO_REFERRER,
      creditsToReferred: REFERRAL_CREDITS_TO_REFERRED,
      requiredAuditsForReward: REFERRAL_MIN_AUDITS_FOR_REWARD,
      paidRewardMultiplier: Math.max(1, REFERRAL_PAID_REWARD_MULTIPLIER),
    },
  };
}

export async function getReferralAttributionForUser(userId: string): Promise<{
  referredByCode?: string;
  status?: string;
  creditsAwarded?: number;
} | null> {
  const pool = getPool();
  const hit = await pool.query(
    `SELECT referral_code, status, credits_awarded_referred
     FROM referral_attributions
     WHERE referred_user_id = $1
     LIMIT 1`,
    [userId]
  );
  const row = hit.rows[0];
  if (!row) return null;
  return {
    referredByCode: String(row.referral_code || ''),
    status: String(row.status || ''),
    creditsAwarded: Number(row.credits_awarded_referred || 0),
  };
}

export function normalizeReferralCodeInput(input: string): string {
  return sanitizeCode(input);
}
