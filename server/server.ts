// server/server.ts
import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import validator from "validator";
import * as Sentry from "@sentry/node";

import { AnalysisCacheService } from "../services/analysisCacheService";
import { scrapeWebsite } from "../services/scraper";
import { PROVIDERS, callAIProvider } from "../services/aiProviders";
import { authRequired } from "../middleware/authRequired";
import { usageGate } from "../middleware/usageGate";
import { incrementUsage } from "../middleware/incrementUsage";
import { closePool, runMigrations } from "../services/postgresql";
import authRoutes from "../routes/authRoutes";

const app = express();
const PORT = Number(process.env.PORT || 3001);

/**
 * Comma-separated list:
 * VITE_FRONTEND_URL="http://localhost:5173,http://localhost:4565"
 */
const FRONTEND_URL =
  process.env.VITE_FRONTEND_URL ||
  "http://localhost:5173,http://localhost:3000,http://localhost:4565";

const ALLOWED_ORIGINS = String(FRONTEND_URL)
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

/* -------------------- SENTRY -------------------- */
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: 1.0,
  });
}

/* -------------------- MIDDLEWARE -------------------- */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

const corsMiddleware = cors({
  origin(origin, cb) {
    // Allow curl/postman/server-to-server (no Origin header)
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    return cb(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
});

app.use(corsMiddleware);

// Avoid app.options("*") path-to-regexp crash.
// Handle OPTIONS globally through middleware.
app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    // Ensure CORS headers are applied, then end fast.
    corsMiddleware(req, res, () => res.sendStatus(204));
    return;
  }
  next();
});

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
<<<<<<< HEAD
  }),
=======
  })
>>>>>>> 924924e57549acaf9d858f77fa106c7b59d8d0b3
);

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30, // 10 was a bit tight for dev + retries
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, slow down", retryAfter: 60 },
});

// apply limiter to API only
app.use("/api", limiter);

/* -------------------- ROUTES -------------------- */

// Auth should be under /api/auth because your UI calls /api/auth/login etc.
app.use("/api/auth", authRoutes);

app.get("/api/health", (_req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    allowed_origins: ALLOWED_ORIGINS,
  });
});

/* -------------------- HELPERS -------------------- */
function isPrivateOrLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase();

  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host === "127.0.0.1" || host === "0.0.0.0") return true;

  if (host.startsWith("10.")) return true;
  if (host.startsWith("192.168.")) return true;

  if (host.startsWith("172.")) {
    const parts = host.split(".");
    const second = Number(parts[1]);
    if (Number.isFinite(second) && second >= 16 && second <= 31) return true;
  }

  if (host.startsWith("169.254.")) return true;

  return false;
}

<<<<<<< HEAD
function validateUrl(urlString: string): {
  valid: boolean;
  error?: string;
  url?: string;
} {
=======
function validateUrl(urlString: string): { valid: boolean; error?: string; url?: string } {
>>>>>>> 924924e57549acaf9d858f77fa106c7b59d8d0b3
  if (!urlString || typeof urlString !== "string") {
    return { valid: false, error: "URL must be a string" };
  }

  const trimmed = urlString.trim();
<<<<<<< HEAD
  const normalized = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
=======
  const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
>>>>>>> 924924e57549acaf9d858f77fa106c7b59d8d0b3

  if (
    !validator.isURL(normalized, {
      protocols: ["http", "https"],
      require_protocol: true,
    })
  ) {
    return { valid: false, error: "Invalid URL format" };
  }

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return { valid: false, error: "Invalid URL structure" };
  }

  if (isPrivateOrLocalHost(parsed.hostname)) {
    return { valid: false, error: "Private/internal URLs blocked" };
  }

  return { valid: true, url: normalized };
}

function getServerApiKey(): string | null {
<<<<<<< HEAD
  return (
    process.env.OPEN_ROUTER_API_KEY || process.env.OPEN_ROUTER_API_KEY || null
  );
}

function safeJsonParse<T = any>(
  raw: string,
): { ok: true; value: T } | { ok: false; error: string } {
=======
  return process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_API_KEY || null;
}

function safeJsonParse<T = any>(raw: string): { ok: true; value: T } | { ok: false; error: string } {
>>>>>>> 924924e57549acaf9d858f77fa106c7b59d8d0b3
  try {
    return { ok: true, value: JSON.parse(raw) as T };
  } catch {
    return { ok: false, error: "Invalid JSON" };
  }
}

/* -------------------- ANALYZE ENDPOINT -------------------- */
app.post(
  "/api/analyze",
  authRequired,
  usageGate,
  incrementUsage,
  async (req: Request, res: Response) => {
    const start = Date.now();

    try {
<<<<<<< HEAD
      const { url, apiKey: clientApiKey } = (req.body ?? {}) as {
        url?: string;
        apiKey?: string;
      };
=======
      const { url, apiKey: clientApiKey } = (req.body ?? {}) as { url?: string; apiKey?: string };
>>>>>>> 924924e57549acaf9d858f77fa106c7b59d8d0b3

      // Never allow browser to bring keys to your server.
      if (clientApiKey) {
        return res.status(400).json({
          error:
            "Client-provided API keys are not allowed. All AI requests use server-side authentication.",
          code: "CLIENT_KEY_REJECTED",
        });
      }

      const validation = validateUrl(url || "");
      if (!validation.valid || !validation.url) {
        return res.status(400).json({
          error: validation.error || "Invalid URL",
          code: "INVALID_URL",
        });
      }

      const targetUrl = validation.url;

      // Cache first
      const cached = await AnalysisCacheService.get(targetUrl);
      if (cached) {
        return res.json({
          ...cached,
          cached: true,
          processing_time_ms: Date.now() - start,
        });
      }

      const apiKey = getServerApiKey();
      if (!apiKey) {
        return res.status(500).json({
          error: "Server is missing AI provider API key",
          code: "MISSING_AI_KEY",
        });
      }

      // Scrape
      const scraped = await scrapeWebsite(targetUrl);

      // Pick first 3 providers (or fewer if you configured less)
      const selectedProviders = PROVIDERS.slice(0, 3);
      if (selectedProviders.length < 1) {
<<<<<<< HEAD
        return res
          .status(500)
          .json({ error: "No AI providers configured", code: "NO_PROVIDERS" });
=======
        return res.status(500).json({ error: "No AI providers configured", code: "NO_PROVIDERS" });
>>>>>>> 924924e57549acaf9d858f77fa106c7b59d8d0b3
      }

      // AI1: create the primary JSON analysis
      const prompt1 = `You are an AI Search Visibility analyst.
Return ONLY valid JSON (no markdown, no extra text).
Use the website data below to produce a strict AnalysisResponse object.

Website data:
${JSON.stringify(scraped?.data ?? {}, null, 0)}
`;

      const ai1Raw = await callAIProvider({
        provider: selectedProviders[0].provider,
        model: selectedProviders[0].model,
        prompt: prompt1,
        apiKey,
        endpoint: selectedProviders[0].endpoint,
      });

      if (!ai1Raw) {
<<<<<<< HEAD
        return res
          .status(500)
          .json({ error: "AI1 did not return output", code: "AI1_EMPTY" });
=======
        return res.status(500).json({ error: "AI1 did not return output", code: "AI1_EMPTY" });
>>>>>>> 924924e57549acaf9d858f77fa106c7b59d8d0b3
      }

      const parsed1 = safeJsonParse(ai1Raw);
      if (!parsed1.ok) {
        return res.status(500).json({
          error: "AI1 output was not valid JSON",
          code: "AI1_OUTPUT_ERROR",
          details: ai1Raw,
        });
      }

      const analysis1: any = parsed1.value;

      // AI2: critique (plain text)
      let ai2Raw = "";
      if (selectedProviders[1]) {
        const prompt2 = `Strictly critique and fact-check the following AI-generated JSON analysis.
Focus on: factual accuracy, missing technical signals (robots.txt, sitemap.xml, canonical, meta, schema), and actionable visibility reasons.
Output ONLY plain text.

AI1 JSON:
${ai1Raw}
`;
        try {
          ai2Raw =
            (await callAIProvider({
              provider: selectedProviders[1].provider,
              model: selectedProviders[1].model,
              prompt: prompt2,
              apiKey,
              endpoint: selectedProviders[1].endpoint,
            })) || "";
        } catch (e: any) {
          ai2Raw = `AI2 failed: ${String(e?.message || e)}`;
        }
      }

      // AI3: validator (minified JSON)
      let ai3Raw = "";
      let ai3Validation: any = null;
      if (selectedProviders[2]) {
        const prompt3 = `Return ONLY minified JSON with this schema:
{"final_visibility_score":number,"validation_notes":string,"summary_verdict":string,"validated_visibility_reasons":string[]}

Rules:
- Must be valid JSON
- validated_visibility_reasons must be specific and actionable

Website data:
${JSON.stringify(scraped?.data ?? {})}

AI1 JSON:
${ai1Raw}

AI2 critique:
${ai2Raw}
`;
        try {
          ai3Raw =
            (await callAIProvider({
              provider: selectedProviders[2].provider,
              model: selectedProviders[2].model,
              prompt: prompt3,
              apiKey,
              endpoint: selectedProviders[2].endpoint,
            })) || "";
          const parsed3 = safeJsonParse(ai3Raw);
<<<<<<< HEAD
          ai3Validation = parsed3.ok
            ? parsed3.value
            : { error: "AI3 returned invalid JSON", raw: ai3Raw };
=======
          ai3Validation = parsed3.ok ? parsed3.value : { error: "AI3 returned invalid JSON", raw: ai3Raw };
>>>>>>> 924924e57549acaf9d858f77fa106c7b59d8d0b3
        } catch (e: any) {
          ai3Validation = { error: `AI3 failed: ${String(e?.message || e)}` };
        }
      }

      const result = {
        ...analysis1,
        url: analysis1?.url || targetUrl,
        analyzed_at: analysis1?.analyzed_at || new Date().toISOString(),
        analyzed_at_timestamp: Date.now(),
        processing_time_ms: Date.now() - start,
        cached: false,
        triple_check: {
          ai1: { model: selectedProviders[0]?.model, output: ai1Raw },
          ai2: { model: selectedProviders[1]?.model, output: ai2Raw },
<<<<<<< HEAD
          ai3: {
            model: selectedProviders[2]?.model,
            output: ai3Raw,
            validation: ai3Validation,
          },
=======
          ai3: { model: selectedProviders[2]?.model, output: ai3Raw, validation: ai3Validation },
>>>>>>> 924924e57549acaf9d858f77fa106c7b59d8d0b3
        },
        validated_visibility_reasons:
          ai3Validation?.validated_visibility_reasons ??
          analysis1?.visibility_reasons ??
          [],
      };

      await AnalysisCacheService.set(targetUrl, result as any);
      return res.json(result);
    } catch (err: any) {
      console.error("Analyze error:", err);
      if (process.env.SENTRY_DSN) Sentry.captureException(err);

      return res.status(500).json({
        error: "Analysis failed",
        code: "INTERNAL_ERROR",
<<<<<<< HEAD
        message:
          process.env.NODE_ENV === "development"
            ? String(err?.message || err)
            : undefined,
      });
    }
  },
=======
        message: process.env.NODE_ENV === "development" ? String(err?.message || err) : undefined,
      });
    }
  }
>>>>>>> 924924e57549acaf9d858f77fa106c7b59d8d0b3
);

/* -------------------- ADMIN CACHE CLEAR -------------------- */
app.post("/api/cache/clear", async (req, res) => {
  if (req.body?.adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  await AnalysisCacheService.clearAll();
  return res.json({ success: true });
});

/* -------------------- 404 + ERROR -------------------- */
app.use((_req, res) => {
  res.status(404).json({
    error: "Not found",
    available: [
      "/api/health",
      "/api/analyze",
      "/api/cache/clear",
      "/api/payment/pricing",
      "/api/payment/checkout",
      "/api/payment/portal",
      "/api/user/usage",
      "/api/user/entitlements",
      "/api/user/refresh",
      "/api/auth/*",
    ],
  });
});

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled:", err);
  if (process.env.SENTRY_DSN) Sentry.captureException(err);
  res.status(500).json({ error: "Internal server error" });
});

/* -------------------- SHUTDOWN -------------------- */
const shutdown = async () => {
  console.log("Shutting down gracefully...");
  await closePool();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

/* -------------------- START -------------------- */
async function start() {
  try {
    await runMigrations();
  } catch (err) {
    console.error("Failed to run migrations, continuing anyway:", err);
  }

  app.listen(PORT, () => {
    console.log(`Server running on :${PORT}`);
    console.log(`Allowed origins: ${ALLOWED_ORIGINS.join(", ")}`);
  });
}

start();

export default app;
