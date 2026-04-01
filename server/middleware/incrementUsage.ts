import type { Request, Response, NextFunction } from "express";
<<<<<<< HEAD
import { executeTransaction } from "../services/postgresql.ts";

function getUserId(req: Request): string | null {
  const u = (req as Request & { user?: { userId?: string; id?: string; sub?: string } }).user;
  return u?.userId || u?.id || u?.sub || null;
}

=======
import { executeTransaction } from "../services/postgresql";

type UsageAction =
  | "request"
  | "scan"
  | "export"
  | "competitor_add"
  | "competitor_metrics";

function getUserId(req: Request): string | null {
  // Your authRequired sets req.user; keep fallback just in case.
  const u = req.user as any;
  return u?.userId || u?.id || u?.sub || null;
}

function getAction(req: Request): UsageAction {
  // Prefer explicit tag set by route handler/middleware.
  const tagged = (req as any).usageAction as UsageAction | undefined;
  if (tagged) return tagged;

  // Default to request if nothing else is set.
  return "request";
}

function isDevBypassUser(userId: string) {
  return process.env.NODE_ENV !== "production" && userId === "00000000-0000-0000-0000-000000000000";
}

>>>>>>> 924924e57549acaf9d858f77fa106c7b59d8d0b3
export function incrementUsage(req: Request, res: Response, next: NextFunction) {
  res.on("finish", () => {
    if (res.statusCode >= 400) return;

    const userId = getUserId(req);
    if (!userId) return;
<<<<<<< HEAD

    // Skip incrementing for dev user
    if (process.env.NODE_ENV !== 'production' &&
        userId === '00000000-0000-0000-0000-000000000000') {
      return;
    }
=======
    if (isDevBypassUser(userId)) return;

    const action = getAction(req);
>>>>>>> 924924e57549acaf9d858f77fa106c7b59d8d0b3

    // Fire-and-forget metering; never block the response pipeline.
    void (async () => {
      try {
        await executeTransaction(async (client: any) => {
<<<<<<< HEAD
          // Ensure table exists (idempotent)
          await client.query(`
            CREATE TABLE IF NOT EXISTS usage_daily (
              user_id TEXT NOT NULL,
              date DATE NOT NULL,
              requests INTEGER NOT NULL DEFAULT 0,
              PRIMARY KEY (user_id, date)
            );
          `);

          await client.query(
            `
            INSERT INTO usage_daily (user_id, date, requests)
            VALUES ($1, CURRENT_DATE, 1)
            ON CONFLICT (user_id, date)
            DO UPDATE SET requests = usage_daily.requests + 1
            `,
            [userId]
=======
          await client.query(
            `
            INSERT INTO usage_daily (user_id, date, action, count)
            VALUES ($1, CURRENT_DATE, $2, 1)
            ON CONFLICT (user_id, date, action)
            DO UPDATE SET count = usage_daily.count + 1
            `,
            [userId, action]
>>>>>>> 924924e57549acaf9d858f77fa106c7b59d8d0b3
          );
        });
      } catch {
        // Intentionally swallow metering errors.
      }
    })();
  });

  next();
}
