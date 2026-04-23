import { randomUUID } from 'crypto';
import { getPool } from './postgresql.js';
import { enqueueAuditJob } from '../infra/queues/auditQueue.js';
import { appendCreditLedgerEvent } from './creditLedger.js';

export type LeadTarget = {
  domain: string;
  source: 'saas_directory' | 'local_business' | 'startup_list' | 'manual';
};

function normalizeDomain(input: string): string {
  const text = String(input || '').trim().toLowerCase();
  if (!text) return '';
  const withProtocol = /^https?:\/\//.test(text) ? text : `https://${text}`;
  try {
    return new URL(withProtocol).hostname.toLowerCase();
  } catch {
    return '';
  }
}

export async function runAutoLeadEngine(userId: string, targets: LeadTarget[]): Promise<{ queued: number; leads: number }> {
  let queued = 0;
  let leads = 0;

  for (const target of targets) {
    const domain = normalizeDomain(target.domain);
    if (!domain) continue;

    await getPool().query(
      `INSERT INTO growth_leads (id, owner_user_id, domain, source, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'queued', NOW(), NOW())
       ON CONFLICT (owner_user_id, domain)
       DO UPDATE SET source = EXCLUDED.source, updated_at = NOW()`,
      [randomUUID(), userId, domain, target.source]
    );
    leads += 1;

    await enqueueAuditJob({ url: domain, userId, priority: 'normal' });
    queued += 1;
  }

  return { queued, leads };
}

export async function buildOutreachPreview(domain: string, reportUrl: string): Promise<string> {
  const host = normalizeDomain(domain);
  return `We ran your site (${host}) through an AI visibility check.\n\nAI can read your site, but it is not choosing it consistently in answers.\n\nHere is your report:\n${reportUrl}\n\nIf you want, we can also send the top 3 fixes we’d apply first.`;
}

export async function getDailyGrowthDigest(limit = 10): Promise<{
  biggestDrops: any[];
  biggestWins: any[];
}> {
  const safeLimit = Math.max(1, Math.min(50, Number(limit) || 10));

  const drops = await getPool().query(
    `WITH ranked AS (
       SELECT
         user_id,
         url,
         visibility_score::float AS score,
         created_at,
         ROW_NUMBER() OVER (PARTITION BY user_id, url ORDER BY created_at DESC) AS rn
       FROM audits
       WHERE status = 'completed'
         AND created_at >= NOW() - INTERVAL '7 days'
     )
     SELECT l.url,
            (p.score - l.score) AS delta,
            l.score AS current_score,
            p.score AS previous_score
     FROM ranked l
     JOIN ranked p ON p.user_id = l.user_id AND p.url = l.url AND p.rn = 2
     WHERE l.rn = 1
     ORDER BY delta DESC
     LIMIT $1`,
    [safeLimit]
  );

  const wins = await getPool().query(
    `WITH ranked AS (
       SELECT
         user_id,
         url,
         visibility_score::float AS score,
         created_at,
         ROW_NUMBER() OVER (PARTITION BY user_id, url ORDER BY created_at DESC) AS rn
       FROM audits
       WHERE status = 'completed'
         AND created_at >= NOW() - INTERVAL '7 days'
     )
     SELECT l.url,
            (l.score - p.score) AS delta,
            l.score AS current_score,
            p.score AS previous_score
     FROM ranked l
     JOIN ranked p ON p.user_id = l.user_id AND p.url = l.url AND p.rn = 2
     WHERE l.rn = 1
     ORDER BY delta DESC
     LIMIT $1`,
    [safeLimit]
  );

  return {
    biggestDrops: drops.rows,
    biggestWins: wins.rows,
  };
}

export async function redeemReferralBonus(args: {
  userId: string;
  referralCode: string;
  convertedUserId: string;
}): Promise<{ granted: boolean; creditsAdded: number }> {
  const code = String(args.referralCode || '').trim().toLowerCase();
  if (!code) return { granted: false, creditsAdded: 0 };

  const existing = await getPool().query(
    `SELECT id FROM growth_referrals
      WHERE owner_user_id = $1 AND referral_code = $2 AND converted_user_id = $3
      LIMIT 1`,
    [args.userId, code, args.convertedUserId]
  );
  if (existing.rows.length) return { granted: false, creditsAdded: 0 };

  await getPool().query(
    `INSERT INTO growth_referrals (
      id, owner_user_id, referral_code, converted_user_id, bonus_credits, created_at
    ) VALUES ($1, $2, $3, $4, 5, NOW())`,
    [randomUUID(), args.userId, code, args.convertedUserId]
  );

  await getPool().query(
    `INSERT INTO scan_pack_credits (user_id, credits_remaining, updated_at)
     VALUES ($1, 5, NOW())
     ON CONFLICT (user_id)
     DO UPDATE SET credits_remaining = scan_pack_credits.credits_remaining + 5, updated_at = NOW()`,
    [args.userId]
  );

  await appendCreditLedgerEvent({
    userId: args.userId,
    type: 'adjustment',
    delta: 5,
    source: 'system',
    requestId: `growth-referral:${args.userId}:${code}:${args.convertedUserId}`,
    metadata: {
      referralCode: code,
      convertedUserId: args.convertedUserId,
      reason: 'growth_referral_bonus',
    },
  });

  return { granted: true, creditsAdded: 5 };
}

export function buildViralReportSnippet(args: {
  domain: string;
  score: number;
  competitorScore: number;
}): string {
  return `This site vs competitors\n\nYou: ${Math.round(args.score)}\nCompetitor: ${Math.round(args.competitorScore)}\n\nSee if your site is being ignored too.`;
}
