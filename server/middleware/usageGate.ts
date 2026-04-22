import type { Request, Response, NextFunction } from "express";
import { pool } from "../services/postgresql.ts";
import { TIER_LIMITS, uiTierFromCanonical } from "../../shared/types.ts";
import type { CanonicalTier, LegacyTier } from "../../shared/types.ts";

type UsageGateRequest = Request & {
  user?: { userId?: string; tier?: string };
  usage?: { used: number; limit: number; remaining: number };
};

function getMonthlyLimit(tier: string): number {
  const normalizedTier = uiTierFromCanonical((tier || "observer") as CanonicalTier | LegacyTier);
  return TIER_LIMITS[normalizedTier]?.scansPerMonth ?? 3;
}

export async function usageGate(req: Request, res: Response, next: NextFunction) {
  const typedReq = req as UsageGateRequest;
  const user = typedReq.user;
  if (!user) return res.status(500).json({ error: "Auth missing" });

  if (
    process.env.NODE_ENV !== "production" &&
    user.userId === "00000000-0000-0000-0000-000000000000"
  ) {
    typedReq.usage = {
      used: 0,
      limit: 999999,
      remaining: 999999,
    };
    return next();
  }

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
    .toISOString()
    .slice(0, 10);

  const result = await pool.query(
    `SELECT COALESCE(SUM(requests), 0) AS total_requests
     FROM usage_daily
     WHERE user_id = $1
       AND date >= $2
       AND date < $3`,
    [user.userId, monthStart, monthEnd],
  );

  const usedThisMonth = parseInt(String(result.rows[0]?.total_requests ?? 0), 10);
  const monthlyLimit = getMonthlyLimit(user.tier || "observer");

  if (usedThisMonth >= monthlyLimit) {
    return res.status(429).json({
      error: "Monthly scan limit reached",
      limit: monthlyLimit,
      used: usedThisMonth,
      tier: uiTierFromCanonical((user.tier || "observer") as CanonicalTier | LegacyTier),
      resetsAt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString(),
    });
  }

  typedReq.usage = {
    used: usedThisMonth,
    limit: monthlyLimit,
    remaining: monthlyLimit - usedThisMonth,
  };

  next();
}
