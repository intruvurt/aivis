// server/src/routes/reports.ts
import { Router } from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";

type AuthedRequest = any; // replace with your actual typed Request if you have it

// You must already have this in your project (JWT middleware)
import { requireAuth } from "./middleware/requireAuth";

// If you have a DB, replace these with real queries.
// The route contract stays the same.
type ReportRow = {
  id: string;
  userId: string;
  name: string;
  url: string;
  createdAt: string;
  // either a stored file path or stored json path
  filePath?: string | null;
  jsonPath?: string | null;
};

// Simple in-memory stores (replace with DB tables)
const reportStore = new Map<string, ReportRow>();
const shareStore = new Map<
  string,
  { token: string; reportId: string; userId: string; expiresAt: number | null; createdAt: number; revoked: boolean }
>();

function ensureReportOwned(reportId: string, userId: string) {
  const row = reportStore.get(reportId);
  if (!row) return { ok: false as const, status: 404, error: "Report not found" };
  if (row.userId !== userId) return { ok: false as const, status: 403, error: "Forbidden" };
  return { ok: true as const, row };
}

function pickExistingFile(row: ReportRow) {
  // preference: pdf filePath, else jsonPath
  const candidate = row.filePath || row.jsonPath;
  if (!candidate) return null;
  const abs = path.isAbsolute(candidate) ? candidate : path.join(process.cwd(), candidate);
  if (!fs.existsSync(abs)) return null;
  return abs;
}

function safeFilename(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export const reportsRouter = Router();

/**
 * GET /api/reports/:id/download
 * Returns report PDF (preferred) or JSON file.
 */
reportsRouter.get("/:id/download", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user?.id;
  const reportId = String(req.params.id || "");

  const owned = ensureReportOwned(reportId, userId);
  if (!owned.ok) return res.status(owned.status).json({ success: false, error: owned.error });

  const row = owned.row;
  const abs = pickExistingFile(row);

  if (!abs) {
    return res.status(404).json({
      success: false,
      error: "Report file missing. Generate report output before downloading.",
    });
  }

  const isPdf = abs.toLowerCase().endsWith(".pdf");
  const isJson = abs.toLowerCase().endsWith(".json");

  const ext = isPdf ? "pdf" : isJson ? "json" : "bin";
  const filename = `${safeFilename(row.name) || "report"}-${row.id}.${ext}`;

  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Type", isPdf ? "application/pdf" : isJson ? "application/json" : "application/octet-stream");

  const stream = fs.createReadStream(abs);
  stream.on("error", () => res.status(500).end());
  stream.pipe(res);
});

/**
 * POST /api/reports/:id/share
 * Creates (or returns) a share link. Default expiry 30 days (frontend sends it).
 */
reportsRouter.post("/:id/share", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user?.id;
  const reportId = String(req.params.id || "");
  const expiresInDays = Number(req.body?.expiresInDays ?? 30);

  const owned = ensureReportOwned(reportId, userId);
  if (!owned.ok) return res.status(owned.status).json({ success: false, error: owned.error });

  // create token
  const token = crypto.randomBytes(24).toString("hex");
  const now = Date.now();
  const expiresAt =
    Number.isFinite(expiresInDays) && expiresInDays > 0 ? now + expiresInDays * 24 * 60 * 60 * 1000 : null;

  shareStore.set(token, {
    token,
    reportId,
    userId,
    expiresAt,
    createdAt: now,
    revoked: false,
  });

  const baseUrl =
    process.env.PUBLIC_APP_URL?.replace(/\/$/, "") ||
    `${req.protocol}://${req.get("host")}`;

  // this points to a public endpoint below
  const url = `${baseUrl}/api/share/${token}`;

  return res.json({ success: true, url, expiresAt });
});

/**
 * GET /api/share/:token
 * Public endpoint. Returns report metadata + (optionally) the report JSON.
 * If you want a pretty public page, make this redirect to your frontend route.
 */
reportsRouter.get("/share/:token", async (req, res) => {
  const token = String(req.params.token || "");
  const entry = shareStore.get(token);

  if (!entry || entry.revoked) {
    return res.status(404).json({ success: false, error: "Share link not found" });
  }
  if (entry.expiresAt && Date.now() > entry.expiresAt) {
    return res.status(410).json({ success: false, error: "Share link expired" });
  }

  const row = reportStore.get(entry.reportId);
  if (!row) return res.status(404).json({ success: false, error: "Report not found" });

  // If you have a stored JSON output, you can expose it here safely.
  // If not, just return metadata and let your frontend call a different endpoint.
  let reportJson: any = null;
  if (row.jsonPath) {
    const abs = path.isAbsolute(row.jsonPath) ? row.jsonPath : path.join(process.cwd(), row.jsonPath);
    if (fs.existsSync(abs)) {
      try {
        reportJson = JSON.parse(fs.readFileSync(abs, "utf8"));
      } catch {
        reportJson = null;
      }
    }
  }

  return res.json({
    success: true,
    report: {
      id: row.id,
      name: row.name,
      url: row.url,
      createdAt: row.createdAt,
    },
    data: reportJson,
  });
});
