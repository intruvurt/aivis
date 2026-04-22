import type { Request, Response, NextFunction } from "express";
import { executeTransaction } from "../services/postgresql.ts";

function getUserId(req: Request): string | null {
  const u = (req as Request & { user?: { userId?: string; id?: string; sub?: string } }).user;
  return u?.userId || u?.id || u?.sub || null;
}

export function incrementUsage(req: Request, res: Response, next: NextFunction) {
  res.on("finish", () => {
    if (res.statusCode >= 400) return;

    const userId = getUserId(req);
    if (!userId) return;

    if (
      process.env.NODE_ENV !== "production" &&
      userId === "00000000-0000-0000-0000-000000000000"
    ) {
      return;
    }

    void (async () => {
      try {
        await executeTransaction(async (client: any) => {
          await client.query(
            `
            INSERT INTO usage_daily (user_id, date, requests)
            VALUES ($1, CURRENT_DATE, 1)
            ON CONFLICT (user_id, date)
            DO UPDATE SET requests = usage_daily.requests + 1
            `,
            [userId],
          );
        });
      } catch {
        // Metering failures should not block successful requests.
      }
    })();
  });

  next();
}
