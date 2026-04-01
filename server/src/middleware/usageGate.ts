import type { Request, Response, NextFunction } from 'express';
import { pool } from '../services/postgresql.js';
import { TIER_LIMITS, uiTierFromCanonical } from '../../../shared/types.js';
import type { CanonicalTier, LegacyTier } from '../../../shared/types.js';
import { getAvailablePackCredits } from '../services/scanPackCredits.js';

function getAllowlistedEmails(): Set<string> {
  const raw = String(process.env.ELEVATED_TIER_ALLOWLIST_EMAILS || process.env.ADMIN_ELEVATED_ALLOWLIST_EMAILS || '');
  return new Set(
    raw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
  );
}

async function getUserUsageThisMonth(userId: string): Promise<number> {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(requests), 0) AS used
     FROM usage_daily
     WHERE user_id = $1
       AND date >= $2::date
       AND date < $3::date`,
    [userId, monthStart.toISOString().slice(0, 10), monthEnd.toISOString().slice(0, 10)]
  );

  return Number(rows[0]?.used || 0);
}

export async function usageGate(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.id) {
    return res.status(401).json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' });
  }

  // Allowlisted emails bypass usage limits but still set context for downstream credit gate
  const email = (req.user.email || '').trim().toLowerCase();
  if (email && getAllowlistedEmails().has(email)) {
    const normalizedTier = uiTierFromCanonical((req.user.tier || 'observer') as CanonicalTier | LegacyTier);
    req.monthlyLimit = TIER_LIMITS[normalizedTier].scansPerMonth;
    req.currentUsage = 0;
    return next();
  }

  try {
    const normalizedTier = uiTierFromCanonical((req.user.tier || 'observer') as CanonicalTier | LegacyTier);
    const monthlyLimit = TIER_LIMITS[normalizedTier].scansPerMonth;

    if (monthlyLimit < 0) return next();

    const currentUsage = await getUserUsageThisMonth(req.user.id);
    if (currentUsage < monthlyLimit) {
      req.currentUsage = currentUsage;
      req.monthlyLimit = monthlyLimit;
      return next();
    }

    const packCredits = await getAvailablePackCredits(req.user.id);
    if (packCredits > 0) {
      req.currentUsage = currentUsage;
      req.monthlyLimit = monthlyLimit;
      req.usingPackCredits = true;
      return next();
    }

    return res.status(403).json({
      error: 'Monthly scan limit reached',
      code: 'USAGE_LIMIT_REACHED',
      limit: monthlyLimit,
      current: currentUsage,
      tier: normalizedTier,
      pack_credits_available: 0,
    });
  } catch (error) {
    console.error('[usageGate] failed:', error);
    return res.status(500).json({ error: 'Usage check failed', code: 'USAGE_GATE_FAILED' });
  }
}
