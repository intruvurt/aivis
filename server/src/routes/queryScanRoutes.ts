/**
 * Query Scan Route
 *
 * Handles POST /api/query-scan
 * Receives query context and triggers appropriate analysis engine
 * Records query metadata in audit and cite entries
 */

import { Router, Request, Response } from "express";
import { authRequired } from "../middleware/authRequired.js";
import { intelligenceAnalyzeHandler } from "../controllers/intelligenceAnalyzeController.js";
import { getPool, getConnection } from "../services/postgresql.js";

const router = Router();

declare global {
  namespace Express {
    interface Request {
      queryContext?: {
        query_slug: string;
        query_intent: string;
        query_priority: "high" | "normal";
      };
    }
  }
}

/**
 * POST /api/query-scan
 *
 * Request body:
 * {
 *   url: string,
 *   query_slug: string,
 *   query_intent: string,
 *   priority: 'high' | 'normal'
 * }
 */
router.post(
  "/query-scan",
  authRequired,
  async (req: Request, res: Response) => {
    const { url, query_slug, query_intent, priority } = req.body || {};

    if (!url || !query_slug) {
      return res.status(400).json({
        error: "Missing url or query_slug",
        code: "INVALID_REQUEST",
      });
    }

    try {
      // Attach query context to request
      const queryPriority: "high" | "normal" =
        priority === "high" ? "high" : "normal";
      (req as any).queryContext = {
        query_slug: String(query_slug).trim(),
        query_intent: String(query_intent || query_slug).trim(),
        query_priority: queryPriority,
      };

      // route through standard intelligence analyze
      // (which now records cite entries)
      req.body = { url };
      await intelligenceAnalyzeHandler(req, res);
    } catch (err) {
      console.error("[QueryScan] Error:", err);
      return res.status(500).json({
        error: "Query scan failed",
        code: "QUERY_SCAN_ERROR",
      });
    }
  },
);

/**
 * Log query interaction for analytics + feedback loop
 * POST /api/events/query
 */
router.post("/events/query", async (req: Request, res: Response) => {
  const { query_slug, event, url, audit_id } = req.body || {};

  if (!query_slug || !event) {
    return res.status(400).json({ error: "Missing query_slug or event" });
  }

  try {
    const userId = (req as any).user?.id || "anonymous";
    const pool = getPool();

    // Create table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS query_analytics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        query_slug VARCHAR(255) NOT NULL,
        event VARCHAR(50) NOT NULL,
        user_id UUID,
        url TEXT,
        audit_id UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Log event
    await pool.query(
      `INSERT INTO query_analytics (query_slug, event, user_id, url, audit_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [query_slug, event, userId || null, url || null, audit_id || null],
    );

    res.json({ success: true });
  } catch (err) {
    console.error("[QueryAnalytics] Error:", err);
    res.status(500).json({ error: "Failed to log event" });
  }
});

/**
 * GET /api/query/:slug/insights
 * Get precomputed insights for a query (for server-side rendering)
 */
router.get("/query/:slug/insights", async (req: Request, res: Response) => {
  const slug = String(req.params.slug || "").trim();

  // This would load from queryCache.ts or database
  // For now, return minimal response
  res.json({
    slug,
    status: "ready",
    timestamp: Date.now(),
  });
});

export const queryScanRoutes = router;
