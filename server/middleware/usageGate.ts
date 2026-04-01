import { Request, Response, NextFunction } from 'express'
import { pool } from "../services/postgresql.ts";
<<<<<<< HEAD
import { TIER_LIMITS, uiTierFromCanonical, type CanonicalTier, type LegacyTier } from "../types.ts";
=======
import { TIER_LIMITS, uiTierFromCanonical, type CanonicalTier, type LegacyTier } from "../src/types.ts";
>>>>>>> 924924e57549acaf9d858f77fa106c7b59d8d0b3

/**
 * Get monthly scan limit based on user tier
 * AiVIS 3-Tier Model:
 * - Observer (Free): 3 scans/month
 * - Alignment (Core): 30 scans/month
 * - Signal (Pro): 150 scans/month
 */
function getMonthlyLimit(tier: string): number {
  const normalizedTier = uiTierFromCanonical(tier as CanonicalTier | LegacyTier);
  return TIER_LIMITS[normalizedTier]?.scansPerMonth ?? 3;
}

export async function usageGate(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const user = (req as any).user
  if (!user) return res.status(500).json({ error: 'Auth missing' })

  // Dev bypass: skip usage checks for dev user
  if (process.env.NODE_ENV !== 'production' &&
      user.userId === '00000000-0000-0000-0000-000000000000') {
    (req as any).usage = {
      used: 0,
      limit: 999999,
      remaining: 999999,
    };
    return next();
  }

  // Get first day of current month for monthly tracking
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  const result = await pool.query(
    `SELECT COALESCE(SUM(requests), 0) as total_requests FROM usage_daily
     WHERE user_id=$1 AND date >= $2 AND date <= $3`,
    [user.userId, monthStart, monthEnd]
  )

  const usedThisMonth = parseInt(result.rows[0]?.total_requests ?? 0, 10);
  const monthlyLimit = getMonthlyLimit(user.tier || 'observer');

  if (usedThisMonth >= monthlyLimit) {
    return res.status(429).json({
      error: 'Monthly scan limit reached',
      limit: monthlyLimit,
      used: usedThisMonth,
      tier: uiTierFromCanonical(user.tier || 'observer'),
      resetsAt: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString(),
    })
  }

  // Attach usage info for downstream use
  (req as any).usage = {
    used: usedThisMonth,
    limit: monthlyLimit,
    remaining: monthlyLimit - usedThisMonth,
  };

  next()
}