import { Router, Request, Response } from "express";
import { authRequired } from "../middleware/authRequired.js";
import { workspaceRequired } from "../middleware/workspaceRequired.js";
import { tieredRateLimit } from "../middleware/tieredRateLimiter.js";
import { enqueueAuditJob, getAuditJob } from "../infra/queues/auditQueue.js";

const router = Router();

// Apply rate limiting specifically to the analyze endpoint (5-50 req/min by tier)
router.post(
  "/audit",
  authRequired,
  workspaceRequired,
  tieredRateLimit("analyze"),
  async (req: Request, res: Response) => {
    const userId = String((req as any).user?.id || "");
    const url = String(req.body?.url || "").trim();
    const priority =
      req.body?.priority === "high" || req.body?.repeatAudit === true
        ? "high"
        : "normal";
    if (!userId)
      return res.status(401).json({ success: false, error: "Unauthorized" });
    if (!url)
      return res.status(400).json({ success: false, error: "url is required" });

    const job = await enqueueAuditJob({
      url,
      userId,
      workspaceId: (req as any).workspace?.id,
      priority,
    });
    return res.json({ success: true, jobId: String(job) });
  },
);

// CORS preflight
router.options("/audit/progress/:jobId", (req: Request, res: Response) => {
  res.setHeader("Access-Control-Allow-Origin", String(req.headers.origin || "*"));
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "3600");
  res.setHeader("Vary", "Origin");
  res.status(204).end();
});

router.get(
  "/audit/progress/:jobId",
  authRequired,
  async (req: Request, res: Response) => {
    const jobId = String(req.params.jobId || "");
    const job = await getAuditJob(jobId);
    if (!job) {
      res.setHeader("Access-Control-Allow-Origin", String(req.headers.origin || "*"));
      return res.status(404).json({ success: false, error: "Job not found" });
    }

    // Set up SSE headers and send response
    const origin = String(req.headers.origin || "*");
    const headers = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "3600",
      "Vary": "Origin",
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-store, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no", /* CRITICAL: Disables Cloudflare buffering */
    };

    res.writeHead(200, headers);

    const send = async () => {
      const latest = await getAuditJob(jobId);
      if (!latest) return;
      const payload = {
        jobId: String(latest.id),
        state: latest.state,
        stage: latest.stage,
        progress: latest.progress || 0,
        failedReason: latest.error || null,
        hints: latest.hints || [],
        result: latest.result || null,
      };
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
      if (latest.state === "completed" || latest.state === "failed") {
        clearInterval(tick);
        res.end();
      }
    };

    const tick = setInterval(send, 1000);
    void send();

    req.on("close", () => {
      clearInterval(tick);
    });
  },
);

export default router;
