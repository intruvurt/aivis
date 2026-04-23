import { executeTransaction, getPool } from './postgresql.js';
import { createUserNotification } from './notificationService.js';
import { appendCreditLedgerEvent, getCreditLedgerBalance, withCreditDecisionLock } from './creditLedger.js';
import crypto from 'crypto';

function roundCredits(value: number): number {
  return Math.round(Math.max(0, Number(value || 0)) * 100) / 100;
}

function toReadableReason(input: string): string {
  const cleaned = String(input || 'usage')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return 'usage';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export type ScanPackKey = 'scan_pack_75' | 'scan_pack_200';

export const SCAN_PACKS: Record<ScanPackKey, { key: ScanPackKey; scans: number; amountCents: number; priceId?: string; allowedTiers: readonly string[] }> = {
  scan_pack_75: {
    key: 'scan_pack_75',
    scans: 75,
    amountCents: 2900,
    priceId: process.env.STRIPE_SCAN_PACK_75_PRICE_ID || process.env.STRIPE_SCAN_PACK_70_PRICE_ID || process.env.STRIPE_SCAN_PACK_25_PRICE_ID || 'price_1T8RiVRYzQALwOPq3NPWHQrQ',
    allowedTiers: ['alignment', 'signal', 'scorefix'],
  },
  scan_pack_200: {
    key: 'scan_pack_200',
    scans: 200,
    amountCents: 8900,
    priceId: process.env.STRIPE_SCAN_PACK_200_PRICE_ID || process.env.STRIPE_SCAN_PACK_175_PRICE_ID || process.env.STRIPE_SCAN_PACK_100_PRICE_ID || 'price_1T8RotRYzQALwOPqzBrektqy',
    allowedTiers: ['signal', 'scorefix'],
  },
};

const PACK_BONUS_PERCENT_BY_TIER: Record<string, number> = {
  signal: 10,
  alignment: 15,
  scorefix: 10,
};

export function getPackBonusPercentForTier(tier: string | null | undefined): number {
  const normalized = String(tier || '').trim().toLowerCase();
  return Math.max(0, Number(PACK_BONUS_PERCENT_BY_TIER[normalized] || 0));
}

export function getEffectivePackScans(baseScans: number, bonusPercent: number): number {
  const safeBase = Math.max(0, Number(baseScans || 0));
  const safeBonus = Math.max(0, Number(bonusPercent || 0));
  if (safeBase <= 0) return 0;
  if (safeBonus <= 0) return safeBase;
  return Math.max(safeBase, Math.round(safeBase * (1 + safeBonus / 100)));
}

export function getScanPackByKey(key: string): (typeof SCAN_PACKS)[ScanPackKey] | null {
  const raw = String(key || '').trim().toLowerCase();
  const normalized = (raw === 'scan_pack_25' ? 'scan_pack_75' : raw) as ScanPackKey;
  return SCAN_PACKS[normalized] || null;
}

export function getScanPacksForTier(tier: string): (typeof SCAN_PACKS)[ScanPackKey][] {
  const normalized = String(tier || '').trim().toLowerCase();
  return Object.values(SCAN_PACKS).filter(pack => pack.allowedTiers.includes(normalized));
}

export function isTierEligibleForPack(tier: string, packKey: string): boolean {
  const pack = getScanPackByKey(packKey);
  if (!pack) return false;
  const normalized = String(tier || '').trim().toLowerCase();
  return pack.allowedTiers.includes(normalized);
}

export function getScanPackByPriceId(priceId?: string | null): (typeof SCAN_PACKS)[ScanPackKey] | null {
  if (!priceId) return null;
  return Object.values(SCAN_PACKS).find((pack) => pack.priceId === priceId) || null;
}

export async function getAvailablePackCredits(userId: string): Promise<number> {
  return getCreditLedgerBalance(userId);
}

export async function consumeOnePackCredit(userId: string): Promise<{ consumed: boolean; remaining: number }> {
  return consumePackCredits(userId, 1, 'single_credit_consumption');
}

export async function consumePackCredits(
  userId: string,
  amount: number,
  reason: string,
  metadata?: Record<string, unknown>
): Promise<{ consumed: boolean; remaining: number }> {
  const roundedAmount = roundCredits(amount);
  if (roundedAmount <= 0) {
    return { consumed: false, remaining: await getAvailablePackCredits(userId) };
  }

  const requestId = String((metadata as any)?.requestId || (metadata as any)?.idempotencyKey || crypto.randomUUID());

  return withCreditDecisionLock(userId, requestId, async () =>
    executeTransaction(async (client: any) => {
      const normalizedReason = String(reason || 'usage');
      const existing = await client.query(
        `SELECT id FROM credit_ledger WHERE user_id = $1 AND request_id = $2 LIMIT 1`,
        [userId, requestId],
      );
      if (existing.rows.length > 0) {
        const remaining = await getCreditLedgerBalance(userId, client);
        return { consumed: true, remaining };
      }

      const balanceBefore = await getCreditLedgerBalance(userId, client);
      if (balanceBefore < roundedAmount) {
        return { consumed: false, remaining: balanceBefore };
      }

      await client.query(
        `INSERT INTO scan_pack_credits (user_id, credits_remaining)
         VALUES ($1, 0)
         ON CONFLICT (user_id) DO NOTHING`,
        [userId],
      );

      const { rows } = await client.query(
        `UPDATE scan_pack_credits
         SET credits_remaining = ROUND((GREATEST(credits_remaining - $2, 0))::numeric, 2),
             updated_at = NOW()
         WHERE user_id = $1
         RETURNING credits_remaining`,
        [userId, roundedAmount]
      );

      const projectionRemaining = roundCredits(Number(rows[0]?.credits_remaining || 0));
      await appendCreditLedgerEvent({
        userId,
        type: 'usage',
        delta: -roundedAmount,
        source: String((metadata as any)?.source || 'api') as any,
        requestId,
        metadata: {
          ...(metadata || {}),
          reason: normalizedReason,
          purpose: normalizedReason,
          amount: roundedAmount,
          trackedAt: new Date().toISOString(),
        },
        client,
      });

      const remaining = await getCreditLedgerBalance(userId, client);
      await client.query(
        `INSERT INTO credit_usage_ledger (user_id, delta_credits, balance_after, reason, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          userId,
          -roundedAmount,
          remaining,
          normalizedReason,
          JSON.stringify({
            ...(metadata || {}),
            purpose: normalizedReason,
            amount: roundedAmount,
            trackedAt: new Date().toISOString(),
            projectionRemaining,
          }),
        ]
      );

      await createUserNotification({
        userId,
        eventType: 'credit_spent',
        title: 'Credits used',
        message: `${roundedAmount.toFixed(2)} credits used for ${toReadableReason(normalizedReason)}.`,
        metadata: {
          amount: roundedAmount,
          remaining,
          reason: normalizedReason,
          ...(metadata || {}),
        },
      }).catch(() => { });

      return { consumed: true, remaining };
    })
  );
}

export async function grantPackCreditsFromCheckoutSession(args: {
  userId: string;
  packKey: string;
  stripeSessionId: string;
  stripePaymentIntentId?: string | null;
  amountCents?: number | null;
  currency?: string | null;
  bonusPercent?: number;
  bonusSource?: string | null;
}): Promise<{ granted: boolean; creditsAdded: number; totalRemaining: number }> {
  const pack = getScanPackByKey(args.packKey);
  if (!pack) {
    throw new Error(`Unknown scan pack key: ${args.packKey}`);
  }

  const bonusPercent = Math.max(0, Number(args.bonusPercent || 0));
  const creditsToAdd = roundCredits(getEffectivePackScans(pack.scans, bonusPercent));

  return executeTransaction(async (client: any) => {
    const ledgerRequestId = `stripe:checkout:${args.stripeSessionId}`;
    const existing = await client.query(
      `SELECT id FROM credit_ledger WHERE user_id = $1 AND request_id = $2 LIMIT 1`,
      [args.userId, ledgerRequestId],
    );
    if (existing.rows.length > 0) {
      const balance = await getCreditLedgerBalance(args.userId, client);
      return { granted: false, creditsAdded: 0, totalRemaining: balance };
    }

    const txInsert = await client.query(
      `INSERT INTO scan_pack_transactions
         (user_id, pack_key, credits_added, amount_cents, currency, stripe_session_id, stripe_payment_intent_id, status, bonus_percent, bonus_source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'completed', $8, $9)
       ON CONFLICT (stripe_session_id) DO NOTHING
       RETURNING id`,
      [
        args.userId,
        pack.key,
        creditsToAdd,
        args.amountCents ?? pack.amountCents,
        String(args.currency || 'usd'),
        args.stripeSessionId,
        args.stripePaymentIntentId ?? null,
        bonusPercent,
        args.bonusSource ? String(args.bonusSource) : null,
      ]
    );

    if (!txInsert.rows.length) {
      const snapshot = await client.query(
        'SELECT credits_remaining FROM scan_pack_credits WHERE user_id = $1',
        [args.userId]
      );
      return { granted: false, creditsAdded: 0, totalRemaining: roundCredits(Number(snapshot.rows[0]?.credits_remaining || 0)) };
    }

    const upsert = await client.query(
      `INSERT INTO scan_pack_credits (user_id, credits_remaining)
       VALUES ($1, $2)
       ON CONFLICT (user_id)
       DO UPDATE SET credits_remaining = ROUND((scan_pack_credits.credits_remaining + EXCLUDED.credits_remaining)::numeric, 2),
                     updated_at = NOW()
       RETURNING credits_remaining`,
      [args.userId, creditsToAdd]
    );

    await appendCreditLedgerEvent({
      userId: args.userId,
      type: 'topup',
      delta: creditsToAdd,
      source: 'stripe',
      requestId: ledgerRequestId,
      metadata: {
        packKey: pack.key,
        stripeSessionId: args.stripeSessionId,
        stripePaymentIntentId: args.stripePaymentIntentId || null,
        bonusPercent,
      },
      client,
    });

    const totalRemaining = await getCreditLedgerBalance(args.userId, client);
    await client.query(
      `INSERT INTO credit_usage_ledger (user_id, delta_credits, balance_after, reason, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        args.userId,
        creditsToAdd,
        totalRemaining,
        'pack_credit_purchase',
        JSON.stringify({
          packKey: pack.key,
          stripeSessionId: args.stripeSessionId,
          bonusPercent,
          purpose: 'pack_credit_purchase',
          amount: creditsToAdd,
          trackedAt: new Date().toISOString(),
        }),
      ]
    );

    await createUserNotification({
      userId: args.userId,
      eventType: 'credit_added',
      title: 'Credits added',
      message: `${creditsToAdd.toFixed(2)} credits added from ${toReadableReason(pack.key)} purchase.`,
      metadata: {
        creditsAdded: creditsToAdd,
        totalRemaining,
        packKey: pack.key,
        stripeSessionId: args.stripeSessionId,
        bonusPercent,
      },
    }).catch(() => { });

    return {
      granted: true,
      creditsAdded: creditsToAdd,
      totalRemaining,
    };
  });
}
