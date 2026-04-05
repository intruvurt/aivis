import express from "express";
import jwt from "jsonwebtoken";
import { protect } from "../middleware/auth.ts";
import enforceFeature from "../middleware/usageEnforcement.ts";
import Audit from "../models/Audit.ts";

const router = express.Router();

const SHARE_TTL_DAYS = 30;

/**
 * NOTE ON PDF EXPORT
 * You do NOT have a server-side PDF generator dependency wired here (puppeteer/pdfkit).
 * Instead of pretending it exists, this route now returns a stable response that lets
 * the client export PDF reliably using html2canvas + jspdf (already in your client deps)
 * by fetching the HTML endpoint below.
 */

function normalizeError(err) {
  if (!err) return "Unknown error";
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function getShareSecret() {
  // Prefer a dedicated secret, fall back to your normal JWT secret
  return (
    process.env.SHARE_TOKEN_SECRET ||
    process.env.JWT_SECRET ||
    process.env.AUTH_JWT_SECRET ||
    ""
  );
}

function getPublicAppBaseUrl(req) {
  // This should be your FRONTEND URL (where /shared/:token lives)
  // Example: https://app.yourdomain.com
  const envUrl =
    process.env.PUBLIC_APP_URL ||
    process.env.APP_PUBLIC_URL ||
    process.env.VITE_PUBLIC_APP_URL;

  if (envUrl && typeof envUrl === "string") return envUrl.replace(/\/+$/, "");

  // Fallback to request origin if you didn't set env var
  const origin = req.get("origin") || `${req.protocol}://${req.get("host")}`;
  return origin.replace(/\/+$/, "");
}

function getPublicApiBaseUrl(req) {
  // This should be your API base (where this router is mounted)
  // Example: https://api.yourdomain.com
  const envUrl = process.env.PUBLIC_API_URL || process.env.API_PUBLIC_URL;
  if (envUrl && typeof envUrl === "string") return envUrl.replace(/\/+$/, "");

  const origin = `${req.protocol}://${req.get("host")}`;
  return origin.replace(/\/+$/, "");
}

function safeAuditPayload(auditDoc) {
  // Don’t leak internal fields blindly.
  // Prefer commonly-used fields, but fall back safely if your schema differs.
  const a = auditDoc?.toObject ? auditDoc.toObject() : auditDoc;

  const result =
    a?.result ||
    a?.analysis ||
    a?.analysisResult ||
    a?.data ||
    a?.payload ||
    null;

  // If you already store a snapshot, prefer it for universal share/export
  const snapshot = a?.report_snapshot || a?.snapshot || a?.reportSnapshot || null;

  return {
    auditId: String(a?._id || ""),
    url: a?.url || result?.url || "",
    analyzed_at: a?.analyzed_at || result?.analyzed_at || a?.createdAt || null,
    visibility_score:
      result?.visibility_score ??
      result?.overallScore ??
      a?.visibility_score ??
      a?.overallScore ??
      null,
    // keep the “best available” body while still allowing your UI to render
    snapshot,
    result,
  };
}

/**
 * POST /export/pdf/:auditId
 * Returns stable info for client-side PDF export.
 * Client should:
 * - call GET /export/html/:auditId
 * - render HTML in a hidden container
 * - use html2canvas + jsPDF to generate the PDF
 */
router.post(
  "/pdf/:auditId",
  protect,
  enforceFeature("export"),
  async (req, res) => {
    try {
      const { auditId } = req.params;
      const userId = req.user.id;

      const audit = await Audit.findOne({ _id: auditId, userId });
      if (!audit) {
        return res.status(404).json({
          success: false,
          error: "Audit not found",
          statusCode: 404,
        });
      }

      const apiBase = getPublicApiBaseUrl(req);

      return res.json({
        success: true,
        message:
          "PDF export is generated client-side. Fetch the HTML endpoint and render it to PDF using html2canvas + jsPDF.",
        data: {
          auditId,
          format: "pdf",
          htmlUrl: `${apiBase}/export/html/${auditId}`,
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: normalizeError(error),
        statusCode: 500,
      });
    }
  }
);

/**
 * GET /export/html/:auditId
 * Authenticated HTML view used for client-side PDF export.
 */
router.get(
  "/html/:auditId",
  protect,
  enforceFeature("export"),
  async (req, res) => {
    try {
      const { auditId } = req.params;
      const userId = req.user.id;

      const audit = await Audit.findOne({ _id: auditId, userId });
      if (!audit) {
        return res.status(404).send("Audit not found");
      }

      const payload = safeAuditPayload(audit);

      // Minimal, universal HTML. Your React app can also render a nicer version,
      // but this keeps PDF exports consistent even if UI changes.
      const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>AI Visibility Report</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; padding: 24px; }
    h1 { font-size: 20px; margin: 0 0 8px; }
    .meta { color: #444; font-size: 12px; margin-bottom: 16px; }
    .box { border: 1px solid #ddd; border-radius: 10px; padding: 14px; margin: 12px 0; }
    pre { white-space: pre-wrap; word-break: break-word; font-size: 12px; }
  </style>
</head>
<body>
  <h1>AI Visibility Report</h1>
  <div class="meta">
    <div><strong>URL:</strong> ${String(payload.url || "").replaceAll("<", "&lt;")}</div>
    <div><strong>Analyzed:</strong> ${payload.analyzed_at ? String(payload.analyzed_at) : "-"}</div>
    <div><strong>Score:</strong> ${payload.visibility_score ?? "-"}</div>
  </div>

  ${
    payload.snapshot
      ? `<div class="box"><strong>Snapshot</strong><pre>${String(
          JSON.stringify(payload.snapshot, null, 2)
        ).replaceAll("<", "&lt;")}</pre></div>`
      : ""
  }

  ${
    payload.result
      ? `<div class="box"><strong>Result</strong><pre>${String(
          JSON.stringify(payload.result, null, 2)
        ).replaceAll("<", "&lt;")}</pre></div>`
      : `<div class="box"><strong>Result</strong><pre>No result payload found on this audit record.</pre></div>`
  }
</body>
</html>`;

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.status(200).send(html);
    } catch (error) {
      return res.status(500).send(normalizeError(error));
    }
  }
);

/**
 * GET /export/json/:auditId
 * Download a universal JSON payload (keeps context).
 */
router.get(
  "/json/:auditId",
  protect,
  enforceFeature("export"),
  async (req, res) => {
    try {
      const { auditId } = req.params;
      const userId = req.user.id;

      const audit = await Audit.findOne({ _id: auditId, userId });
      if (!audit) {
        return res.status(404).json({
          success: false,
          error: "Audit not found",
          statusCode: 404,
        });
      }

      const payload = safeAuditPayload(audit);

      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="audit-${auditId}.json"`
      );
      return res.status(200).send(JSON.stringify({ success: true, data: payload }, null, 2));
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: normalizeError(error),
        statusCode: 500,
      });
    }
  }
);

/**
 * GET /export/csv/:auditId?kind=recommendations|evidence
 * Lightweight CSV exports that won’t break if your schema changes.
 */
router.get(
  "/csv/:auditId",
  protect,
  enforceFeature("export"),
  async (req, res) => {
    try {
      const { auditId } = req.params;
      const userId = req.user.id;
      const kind = String(req.query.kind || "recommendations").toLowerCase();

      const audit = await Audit.findOne({ _id: auditId, userId });
      if (!audit) {
        return res.status(404).json({
          success: false,
          error: "Audit not found",
          statusCode: 404,
        });
      }

      const payload = safeAuditPayload(audit);
      const result = payload.result || {};
      const snapshot = payload.snapshot || {};

      let rows = [];
      let header = [];

      if (kind === "evidence") {
        const evidence =
          snapshot?.evidence ||
          result?.evidence ||
          result?.evidence_objects ||
          [];

        header = ["id", "title", "source_url", "excerpt", "retrieved_at"];
        rows = Array.isArray(evidence)
          ? evidence.map((e) => [
              e?.id ?? "",
              e?.title ?? "",
              e?.sourceUrl ?? e?.source_url ?? "",
              e?.excerpt ?? "",
              e?.retrievedAt ?? e?.retrieved_at ?? "",
            ])
          : [];
      } else {
        const recs =
          snapshot?.findings ||
          result?.recommendations ||
          result?.criticalFixes ||
          result?.quickWins ||
          [];

        // Normalize to a list of strings or objects
        header = ["item", "category", "severity", "why", "recommendation"];
        rows = Array.isArray(recs)
          ? recs.map((r) => {
              if (typeof r === "string") return [r, "", "", "", ""];
              return [
                r?.claim ?? r?.item ?? r?.finding ?? "",
                r?.category ?? "",
                r?.severity ?? r?.status ?? "",
                r?.whyItMatters ?? r?.why ?? "",
                r?.recommendation ?? r?.fix ?? "",
              ];
            })
          : [];
      }

      const escape = (v) => {
        const s = String(v ?? "");
        if (s.includes('"') || s.includes(",") || s.includes("\n")) {
          return `"${s.replaceAll('"', '""')}"`;
        }
        return s;
      };

      const csv =
        [header.map(escape).join(",")]
          .concat(rows.map((r) => r.map(escape).join(",")))
          .join("\n") + "\n";

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="audit-${auditId}-${kind}.csv"`
      );
      return res.status(200).send(csv);
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: normalizeError(error),
        statusCode: 500,
      });
    }
  }
);

/**
 * POST /export/share/:auditId
 * Generates a share link (JWT token) that expires in 30 days.
 * No DB needed, no hallucinated “expiresIn” without enforcement.
 *
 * body: { visibility?: "summary" | "full" }
 */
router.post(
  "/share/:auditId",
  protect,
  enforceFeature("share"),
  async (req, res) => {
    try {
      const { auditId } = req.params;
      const userId = req.user.id;

      const audit = await Audit.findOne({ _id: auditId, userId });
      if (!audit) {
        return res.status(404).json({
          success: false,
          error: "Audit not found",
          statusCode: 404,
        });
      }

      const secret = getShareSecret();
      if (!secret) {
        return res.status(500).json({
          success: false,
          error:
            "Share token secret is not configured. Set SHARE_TOKEN_SECRET or JWT_SECRET.",
          statusCode: 500,
        });
      }

      const visibility =
        (req.body?.visibility && String(req.body.visibility).toLowerCase()) ||
        "summary";

      const allowed = visibility === "full" ? "full" : "summary";

      const expiresAt = new Date(Date.now() + SHARE_TTL_DAYS * 24 * 60 * 60 * 1000);

      const token = jwt.sign(
        {
          auditId: String(auditId),
          userId: String(userId),
          visibility: allowed,
          v: 1,
        },
        secret,
        { expiresIn: `${SHARE_TTL_DAYS}d` }
      );

      const appBase = getPublicAppBaseUrl(req);

      return res.json({
        success: true,
        data: {
          shareUrl: `${appBase}/shared/${token}`,
          visibility: allowed,
          expiresAt: expiresAt.toISOString(),
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: normalizeError(error),
        statusCode: 500,
      });
    }
  }
);

/**
 * GET /export/shared/:token
 * Public endpoint that returns a sanitized payload based on the token visibility.
 * This is what your frontend /shared/:token page can call.
 */
router.get("/shared/:token", async (req, res) => {
  try {
    const { token } = req.params;

    const secret = getShareSecret();
    if (!secret) {
      return res.status(500).json({
        success: false,
        error:
          "Share token secret is not configured. Set SHARE_TOKEN_SECRET or JWT_SECRET.",
        statusCode: 500,
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, secret);
    } catch (e) {
      return res.status(401).json({
        success: false,
        error: "Invalid or expired share token",
        statusCode: 401,
      });
    }

    const { auditId, userId, visibility } = decoded || {};
    if (!auditId || !userId) {
      return res.status(400).json({
        success: false,
        error: "Malformed share token",
        statusCode: 400,
      });
    }

    const audit = await Audit.findOne({ _id: auditId, userId });
    if (!audit) {
      return res.status(404).json({
        success: false,
        error: "Audit not found",
        statusCode: 404,
      });
    }

    const payload = safeAuditPayload(audit);

    // Summary mode: strip deep raw result if you want. Keep snapshot if present.
    const isFull = String(visibility).toLowerCase() === "full";

    const responseData = isFull
      ? payload
      : {
          auditId: payload.auditId,
          url: payload.url,
          analyzed_at: payload.analyzed_at,
          visibility_score: payload.visibility_score,
          snapshot: payload.snapshot, // best universal summary container
        };

    return res.json({ success: true, data: responseData });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: normalizeError(error),
      statusCode: 500,
    });
  }
});

export default router;
