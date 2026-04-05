import type { Request, Response, NextFunction } from 'express';
import { executeTransaction } from '../services/postgresql.js';
import { IS_PRODUCTION } from '../config/runtime.js';

function getUserId(req: Request): string | null {
  return req.user?.id || req.userId || null;
}

/**
 * Increment usage synchronously before the handler runs.
 * This ensures usage is always counted - never lost in fire-and-forget.
 * If the DB write fails we still allow the request through but log loudly.
 */
export async function incrementUsage(req: Request, res: Response, next: NextFunction) {
  if (req.usageSkipIncrement) return next();
  if (req.usingPackCredits) return next();

  const userId = getUserId(req);
  if (!userId) return next();

  if (
    !IS_PRODUCTION &&
    userId === '00000000-0000-0000-0000-000000000000'
  ) {
    return next();
  }

  try {
    await executeTransaction(async (client: any) => {
      await client.query(
        `
        INSERT INTO usage_daily (user_id, date, requests)
        VALUES ($1, CURRENT_DATE, 1)
        ON CONFLICT (user_id, date)
        DO UPDATE SET requests = usage_daily.requests + 1
        `,
        [userId]
      );
    });
  } catch (err: any) {
    console.error('[incrementUsage] CRITICAL: Metering write failed:', err?.message || err);
    return res.status(503).json({
      error: 'Usage metering temporarily unavailable. Please try again.',
      code: 'METERING_UNAVAILABLE',
    });
  }

  next();
}
