// server/server.ts
import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import validator from "validator";
import * as Sentry from "@sentry/node";

import { AnalysisCacheService } from "./services/analysisCacheService.js";
import { scrapeWebsite } from "./services/scraper.js";
import { PROVIDERS, callAIProvider } from "./services/aiProviders.js";
import { authRequired } from "./middleware/authRequired.js";
import { usageGate } from "./middleware/usageGate.js";
import { incrementUsage } from "./middleware/incrementUsage.js";
import { closePool, runMigrations } from "./services/postgresql.js";
import authRoutes from "./routes/authRoutes.js";

const app = express();
const PORT = Number(process.env.PORT || 3001);

/* -------------------- ROLE CONTROL (NEW) -------------------- */
const RUN_API = process.env.RUN_API !== "false"; // default ON

/* -------------------- TRUST PROXY (FIX) -------------------- */
app.set("trust proxy", 1);

/* -------------------- FRONTEND ORIGINS -------------------- */
const FRONTEND_URL =
  process.env.VITE_FRONTEND_URL ||
  "https://aivis.biz,http://localhost:5173,http://localhost:3000,http://localhost:4565";

const ALLOWED_ORIGINS = String(FRONTEND_URL)
  .split(",")
  .map((o) => o.trim().replace(/\/$/, "")) // 🔥 FIX trailing slash
  .filter(Boolean);

/* -------------------- SENTRY -------------------- */
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: 0.2, // 🔥 reduce cost
  });
}

/* -------------------- MIDDLEWARE -------------------- */
app.use(express.json({ limit: "2mb" })); // 🔥 reduced
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

const corsMiddleware = cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true);

    const normalized = origin.replace(/\/$/, "");
    if (ALLOWED_ORIGINS.includes(normalized)) return cb(null, true);

    return cb(null, false);
  },
  credentials: true,
});

app.use(corsMiddleware);

app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    corsMiddleware(req, res, () => res.sendStatus(204));
    return;
  }
  next();
});

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);

app.use(
  "/api",
  rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

/* -------------------- ROUTES -------------------- */
app.use("/api/auth", authRoutes);

app.get("/api/health", (_req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});

/* -------------------- HELPERS -------------------- */
function validateUrl(urlString: string) {
  if (!urlString || typeof urlString !== "string") {
    return { valid: false, error: "URL must be a string" };
  }

  const normalized = /^https?:\/\//i.test(urlString)
    ? urlString
    : `https://${urlString}`;

  if (
    !validator.isURL(normalized, {
      protocols: ["http", "https"],
      require_protocol: true,
    })
  ) {
    return { valid: false, error: "Invalid URL format" };
  }

  const parsed = new URL(normalized);

  if (
    parsed.hostname === "localhost" ||
    parsed.hostname.startsWith("127.") ||
    parsed.hostname.startsWith("192.168.") ||
    parsed.hostname.startsWith("10.")
  ) {
    return { valid: false, error: "Private URLs blocked" };
  }

  return { valid: true, url: normalized };
}

function safeJsonParse(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/* -------------------- ANALYZE -------------------- */
app.post(
  "/api/analyze",
  authRequired,
  usageGate,
  incrementUsage,
  async (req: Request, res: Response) => {
    const start = Date.now();

    try {
      const { url } = req.body ?? {};
      const validation = validateUrl(url);

      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }

      const targetUrl = validation.url!;

      // 🔥 CACHE FIRST
      const cached = await AnalysisCacheService.get(targetUrl);
      if (cached) {
        return res.json({ ...cached, cached: true });
      }

      // 🔥 HARD TIMEOUT
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), 20000),
      );

      const result = await Promise.race([
        (async () => {
          const scraped = await scrapeWebsite(targetUrl);

          const prompt = JSON.stringify(
            scraped?.success ? scraped.data : {},
          ).slice(0, 15000); // 🔥 cap size

          const aiRaw = await callAIProvider({
            provider: PROVIDERS[0].provider,
            model: PROVIDERS[0].model,
            prompt,
            apiKey: process.env.OPEN_ROUTER_API_KEY!,
          });

          const parsed = safeJsonParse(aiRaw);
          if (!parsed) throw new Error("Invalid AI JSON");

          const final = {
            ...parsed,
            processing_time_ms: Date.now() - start,
          };

          await AnalysisCacheService.set(targetUrl, final);
          return final;
        })(),
        timeout,
      ]);

      return res.json(result);
    } catch (err: any) {
      console.error("Analyze error:", err);
      if (process.env.SENTRY_DSN) Sentry.captureException(err);

      return res.status(500).json({
        error: "Analysis failed",
        message:
          process.env.NODE_ENV === "development" ? err.message : undefined,
      });
    }
  },
);

/* -------------------- ERRORS -------------------- */
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  if (process.env.SENTRY_DSN) Sentry.captureException(err);
  res.status(500).json({ error: "Internal server error" });
});

/* -------------------- START -------------------- */
async function start() {
  if (!RUN_API) {
    console.log("[Startup] API disabled via RUN_API");
    return;
  }

  try {
    await runMigrations();
  } catch (err) {
    console.error("Migration failed:", err);
  }

  app.listen(PORT, () => {
    console.log(`Server running on :${PORT}`);
  });
}

start();

/* -------------------- SHUTDOWN -------------------- */
process.on("SIGTERM", async () => {
  await closePool();
  process.exit(0);
});