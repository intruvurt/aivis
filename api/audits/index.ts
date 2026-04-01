// api/audits/index.ts
// Render/Express-friendly version (no @vercel/node types, no VERCEL_URL)

import type { Request, Response } from "express";
import { verifyUserToken } from "../../server/src/lib/utils/jwt.js";
import { getPool } from "../../server/src/services/postgresql.js";
import { TIER_LIMITS, uiTierFromCanonical } from "../../shared/types.js";

type ErrorResponse = { error?: string };

function setCors(res: Response) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function getBearerToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

function apiBaseUrlFromEnv(req: Request): string {
  // Prefer explicit base URL for the API service (Render)
  // Set on Render: API_BASE_URL=https://your-api-service.onrender.com
  if (process.env.API_BASE_URL) return process.env.API_BASE_URL;

  // Or point to your frontend domain if it reverse-proxies /api to this service
  if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL;

  // Last resort: derive from request host/proto (works if behind a proxy correctly)
  const proto =
    (req.headers["x-forwarded-proto"] as string | undefined) ||
    (req.protocol as string | undefined) ||
    "https";
  const host =
    (req.headers["x-forwarded-host"] as string | undefined) ||
    (req.headers.host as string | undefined) ||
    "https://aivis.biz";
  return `${proto}://${host}`;
}

export default async function handler(req: Request, res: Response) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Verify auth for all methods
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ success: false, error: "No token provided" });
  }

  let decoded: any;
  try {
    decoded = verifyUserToken(token);
  } catch {
    return res.status(401).json({ success: false, error: "Invalid token" });
  }

  const pool = getPool();

  const userResult = await pool.query("SELECT id, tier FROM users WHERE id = $1", [
    decoded.userId,
  ]);

  if (!userResult.rows[0]) {
    return res.status(404).json({ success: false, error: "User not found" });
  }

  const userId = decoded.userId as string;
  const dbTier = uiTierFromCanonical(userResult.rows[0].tier || "observer");

  // GET - List user's audits
  if (req.method === "GET") {
    try {
      const result = await pool.query(
        "SELECT id, user_id, url, visibility_score, result, created_at FROM audits WHERE user_id = $1 ORDER BY created_at DESC",
        [userId]
      );
      return res.status(200).json({ success: true, data: result.rows });
    } catch (error: any) {
      console.error("List audits error:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch audits" });
    }
  }

  // POST - Create new audit
  if (req.method === "POST") {
    try {
      const { url } = (req.body || {}) as { url?: string };

      if (!url) {
        return res.status(400).json({ success: false, error: "URL is required" });
      }

      // Validate URL
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(url);
        if (!["http:", "https:"].includes(parsedUrl.protocol)) throw new Error("Invalid protocol");
      } catch {
        return res.status(400).json({ success: false, error: "Invalid URL format" });
      }

      // Check monthly usage limits using canonical tier from DB
      const tierLimits = (TIER_LIMITS as any)[dbTier];
      const limit: number = tierLimits?.scansPerMonth ?? 3;

      const usageResult = await pool.query(
        `SELECT COALESCE(SUM(requests), 0)::int AS total
         FROM usage_daily
         WHERE user_id = $1
           AND date >= date_trunc('month', now())::date
           AND date < (date_trunc('month', now()) + interval '1 month')::date`,
        [userId]
      );

      const monthlyUsed = usageResult.rows[0]?.total ?? 0;
      const remaining = Math.max(0, limit - monthlyUsed);
      const allowed = monthlyUsed < limit;

      if (!allowed) {
        return res.status(403).json({
          success: false,
          error: "Monthly audit limit reached",
          limit,
          remaining: 0,
        });
      }

      // Create audit record
      const insertResult = await pool.query(
        "INSERT INTO audits (user_id, url) VALUES ($1, $2) RETURNING id, user_id, url, visibility_score, result, created_at",
        [userId, parsedUrl.href]
      );
      const audit = insertResult.rows[0];

      try {
        // Mark as processing
        await pool.query(
          "UPDATE audits SET result = COALESCE(result, '{}'::jsonb) || '{\"status\":\"processing\"}'::jsonb WHERE id = $1",
          [audit.id]
        );

        const startTime = Date.now();

        const apiBase = apiBaseUrlFromEnv(req);
        const analyzeResponse = await fetch(`${apiBase}/api/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: parsedUrl.href }),
        });

        const analysisResult = (await analyzeResponse.json().catch(() => null)) as any;
        const processingTime = Date.now() - startTime;

        if (analysisResult?.overallScore !== undefined) {
          const resultData = {
            status: "completed",
            categoryScores: Array.isArray(analysisResult.categories)
              ? analysisResult.categories.reduce((acc: any, cat: any) => {
                  acc[cat.name] = cat.score;
                  return acc;
                }, {})
              : {},
            visibilityStatus: analysisResult.verdict,
            evidence: analysisResult.categories,
            processingTimeMs: processingTime,
          };

          await pool.query("UPDATE audits SET visibility_score = $1, result = $2 WHERE id = $3", [
            analysisResult.overallScore,
            JSON.stringify(resultData),
            audit.id,
          ]);
        } else {
          await pool.query("UPDATE audits SET result = $1 WHERE id = $2", [
            JSON.stringify({
              status: "failed",
              error: analysisResult?.error || "Analysis failed",
            }),
            audit.id,
          ]);
        }
      } catch (analysisError: any) {
        console.error("Analysis error:", analysisError);
        await pool.query("UPDATE audits SET result = $1 WHERE id = $2", [
          JSON.stringify({
            status: "failed",
            error: analysisError?.message || "Analysis failed",
          }),
          audit.id,
        ]);
      }

      // Fetch the updated audit
      const updatedResult = await pool.query(
        "SELECT id, user_id, url, visibility_score, result, created_at FROM audits WHERE id = $1",
        [audit.id]
      );

      return res.status(201).json({
        success: true,
        data: updatedResult.rows[0],
        usage: { remaining: remaining - 1, limit },
      });
    } catch (error: any) {
      console.error("Create audit error:", error);
      return res.status(500).json({ success: false, error: "Failed to create audit" });
    }
  }

  return res.status(405).json({ success: false, error: "Method not allowed" });
}