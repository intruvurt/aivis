/**
 * CITE LEDGER API ROUTES
 * =====================================================================
 * Exposes the cite ledger pipeline data for authenticated users.
 *
 * Routes:
 *   GET  /api/cite-ledger/user/summary         → entity-scoped summary (all runs)
 *   GET  /api/cite-ledger/audit/:auditRunId     → cite entries for one run
 *   GET  /api/cite-ledger/entity/:entityId/jobs → recent jobs for an entity
 *   POST /api/cite-ledger/pipeline/run          → trigger pipeline for an audit
 */

import { Router } from "express";
import {
  getCiteLedgerForRun,
  getEvidenceLedgerProjectionForAudit,
  getEntityCiteLedgerSummary,
  getEntityJobs,
  runCiteLedgerPipeline,
} from "../services/citeLedgerService.js";
import { authRequired } from "../middleware/authRequired.js";
import { getPool } from "../services/postgresql.js";

export const citeLedgerRoutes = Router();

async function userOwnsAudit(auditId: string, userId: string): Promise<boolean> {
  const pool = getPool();
  const { rows } = await pool.query(
    "SELECT id FROM audits WHERE id = $1 AND user_id = $2 LIMIT 1",
    [auditId, userId],
  );
  return rows.length > 0;
}

// ── GET /api/cite-ledger/audit/:auditRunId ────────────────────────────────────
citeLedgerRoutes.get(
  "/audit/:auditId/projection",
  authRequired,
  async (req, res) => {
    try {
      const userId = String((req as any).user?.id || "").trim();
      const auditId = String(req.params.auditId || "").trim();
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      if (!auditId) {
        return res.status(400).json({ error: "auditId is required" });
      }
      if (!(await userOwnsAudit(auditId, userId))) {
        return res.status(404).json({ error: "Audit not found" });
      }

      const projection = await getEvidenceLedgerProjectionForAudit(auditId);
      if (!projection) {
        return res.status(404).json({ error: "No ledger projection available for audit" });
      }

      return res.json({ success: true, projection });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fetch evidence ledger projection";
      return res.status(500).json({ error: msg });
    }
  },
);

citeLedgerRoutes.get(
  "/audit/:auditRunId",
  authRequired,
  async (req, res) => {
    try {
      const { auditRunId } = req.params;
      if (!auditRunId || typeof auditRunId !== "string") {
        return res.status(400).json({ error: "auditRunId is required" });
      }
      const entries = await getCiteLedgerForRun(auditRunId);
      return res.json({ auditRunId, entries, count: entries.length });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fetch cite ledger";
      return res.status(500).json({ error: msg });
    }
  },
);

// ── GET /api/cite-ledger/entity/:entityId/summary ─────────────────────────────
citeLedgerRoutes.get(
  "/entity/:entityId/summary",
  authRequired,
  async (req, res) => {
    try {
      const { entityId } = req.params;
      if (!entityId || typeof entityId !== "string") {
        return res.status(400).json({ error: "entityId is required" });
      }
      const summary = await getEntityCiteLedgerSummary(entityId);
      return res.json({ entityId, summary });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fetch entity summary";
      return res.status(500).json({ error: msg });
    }
  },
);

// ── GET /api/cite-ledger/entity/:entityId/jobs ────────────────────────────────
citeLedgerRoutes.get(
  "/entity/:entityId/jobs",
  authRequired,
  async (req, res) => {
    try {
      const { entityId } = req.params;
      const limit = Math.min(Number(req.query.limit) || 20, 100);
      if (!entityId || typeof entityId !== "string") {
        return res.status(400).json({ error: "entityId is required" });
      }
      const jobs = await getEntityJobs(entityId, limit);
      return res.json({ entityId, jobs, count: jobs.length });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fetch jobs";
      return res.status(500).json({ error: msg });
    }
  },
);

// ── POST /api/cite-ledger/pipeline/run ────────────────────────────────────────
citeLedgerRoutes.post(
  "/pipeline/run",
  authRequired,
  async (req, res) => {
    try {
      const { userId, domain, url, auditRunId, score, evidenceCount, scoreSource, brandName } =
        req.body as {
          userId: string;
          domain: string;
          url: string;
          auditRunId: string;
          score: number;
          evidenceCount: number;
          scoreSource: string;
          brandName?: string;
        };

      if (!userId || !domain || !url || !auditRunId || score === undefined || evidenceCount === undefined) {
        return res.status(400).json({ error: "Missing required fields: userId, domain, url, auditRunId, score, evidenceCount" });
      }

      // Fire-and-forget — pipeline logs internally
      runCiteLedgerPipeline({ userId, domain, url, auditRunId, score, evidenceCount, scoreSource: scoreSource || "manual", brandName }).catch(() => {});

      return res.json({ queued: true, auditRunId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Pipeline trigger failed";
      return res.status(500).json({ error: msg });
    }
  },
);

export default citeLedgerRoutes;

