import { getPool } from './postgresql.js';
import { consumePackCredits, getAvailablePackCredits } from './scanPackCredits.js';
import {
  TOOL_CREDIT_COSTS,
  type ToolAction,
  type CanonicalTier,
  uiTierFromCanonical,
} from '../../../shared/types.js';

/* ────────── helpers ────────── */

function currentMonthKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/* ────────── public API ────────── */

/**
 * Get how many times a user has used a tool this month.
 */
export async function getToolUsageThisMonth(
  userId: string,
  action: ToolAction,
): Promise<number> {
  const pool = getPool();
  const monthKey = currentMonthKey();
  const { rows } = await pool.query(
    `SELECT usage_count FROM tool_usage_monthly
     WHERE user_id = $1 AND tool_action = $2 AND month_key = $3`,
    [userId, action, monthKey],
  );
  return Number(rows[0]?.usage_count || 0);
}

/**
 * Increment tool usage counter for the current month.
 */
export async function incrementToolUsage(
  userId: string,
  action: ToolAction,
): Promise<number> {
  const pool = getPool();
  const monthKey = currentMonthKey();
  const { rows } = await pool.query(
    `INSERT INTO tool_usage_monthly (user_id, tool_action, month_key, usage_count)
     VALUES ($1, $2, $3, 1)
     ON CONFLICT (user_id, tool_action, month_key)
     DO UPDATE SET usage_count = tool_usage_monthly.usage_count + 1,
                   updated_at = NOW()
     RETURNING usage_count`,
    [userId, action, monthKey],
  );
  return Number(rows[0]?.usage_count || 1);
}

export interface ToolGateResult {
  allowed: boolean;
  /** 0 if within free allowance, otherwise the credit cost */
  creditCost: number;
  /** Credits remaining after deduction (or current balance if no deduction) */
  creditsRemaining: number;
  /** How many free uses remain this month */
  freeUsesRemaining: number;
  /** Reason for denial if not allowed */
  reason?: string;
}

/**
 * Check if a user can use a tool and deduct credits if needed.
 * This is the single entry point for tool gating.
 *
 * Usage:
 *   const gate = await gateToolAction(userId, 'citation_query', userTier);
 *   if (!gate.allowed) return res.status(402).json({ error: gate.reason });
 *   // proceed with tool action
 */
export async function gateToolAction(
  userId: string,
  action: ToolAction,
  rawTier: string,
): Promise<ToolGateResult> {
  const rule = TOOL_CREDIT_COSTS[action];
  if (!rule) {
    return { allowed: true, creditCost: 0, creditsRemaining: 0, freeUsesRemaining: 0 };
  }

  const tier = (uiTierFromCanonical(rawTier as any) || 'observer') as CanonicalTier;
  const usedThisMonth = await getToolUsageThisMonth(userId, action);
  const freeAllowance = rule.freeMonthly[tier] ?? 0;
  const freeUsesRemaining = Math.max(0, freeAllowance - usedThisMonth);

  // Still within free allowance
  if (usedThisMonth < freeAllowance) {
    await incrementToolUsage(userId, action);
    const credits = await getAvailablePackCredits(userId);
    return {
      allowed: true,
      creditCost: 0,
      creditsRemaining: credits,
      freeUsesRemaining: freeUsesRemaining - 1,
    };
  }

  // Need to consume credits
  const creditCost = rule.creditCost;
  const available = await getAvailablePackCredits(userId);

  if (available < creditCost) {
    return {
      allowed: false,
      creditCost,
      creditsRemaining: available,
      freeUsesRemaining: 0,
      reason: `Insufficient credits. This action costs ${creditCost} credits. You have ${available.toFixed(2)} credits remaining. Free monthly allowance exhausted (${freeAllowance} uses/month).`,
    };
  }

  const result = await consumePackCredits(userId, creditCost, `tool_${action}`, {
    action,
    tier,
    monthlyUsage: usedThisMonth + 1,
  });

  if (!result.consumed) {
    return {
      allowed: false,
      creditCost,
      creditsRemaining: result.remaining,
      freeUsesRemaining: 0,
      reason: `Could not deduct ${creditCost} credits. Current balance: ${result.remaining.toFixed(2)}.`,
    };
  }

  await incrementToolUsage(userId, action);
  return {
    allowed: true,
    creditCost,
    creditsRemaining: result.remaining,
    freeUsesRemaining: 0,
  };
}

/**
 * Get a summary of all tool usage and remaining free allowances for a user.
 */
export async function getToolUsageSummary(
  userId: string,
  rawTier: string,
): Promise<Record<ToolAction, { used: number; freeAllowance: number; freeRemaining: number; creditCost: number }>> {
  const tier = (uiTierFromCanonical(rawTier as any) || 'observer') as CanonicalTier;
  const pool = getPool();
  const monthKey = currentMonthKey();

  const { rows } = await pool.query(
    `SELECT tool_action, usage_count FROM tool_usage_monthly
     WHERE user_id = $1 AND month_key = $2`,
    [userId, monthKey],
  );

  const usageMap: Record<string, number> = {};
  for (const r of rows) {
    usageMap[r.tool_action] = Number(r.usage_count || 0);
  }

  const result: any = {};
  for (const [action, rule] of Object.entries(TOOL_CREDIT_COSTS)) {
    const used = usageMap[action] || 0;
    const freeAllowance = rule.freeMonthly[tier] ?? 0;
    result[action] = {
      used,
      freeAllowance,
      freeRemaining: Math.max(0, freeAllowance - used),
      creditCost: rule.creditCost,
    };
  }
  return result;
}
