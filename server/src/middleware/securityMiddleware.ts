/**
 * Drop-in Express security middleware for AiVIS.
 *
 * Usage in server.ts:
 *   import { applySecurityMiddleware } from './middleware/securityMiddleware.js';
 *   applySecurityMiddleware(app);        // BEFORE any route registration
 */

import type { Express, Request, Response, NextFunction } from "express";
import helmet from "helmet";
import crypto from "crypto";
import DOMPurify from "dompurify";
import { z } from "zod";

/* ────────────────────────────────────────────────────────────────────────────
 * Server-side DOMPurify instance (JSDOM-backed, lazy-loaded)
 * Lazy-load to avoid ES module conflicts at startup
 * ──────────────────────────────────────────────────────────────────────────── */
let purify: any = null;

async function initDOMPurify() {
  if (purify) return purify;

  try {
    const { parseHTML } = await import("linkedom");
    const { window } = parseHTML("<!DOCTYPE html><html><head></head><body></body></html>");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    purify = DOMPurify(window as any);
    return purify;
  } catch (err) {
    console.warn(
      "[DOMPurify] Failed to initialize linkedom, using in-memory fallback:",
      (err as any)?.message,
    );
    // Fallback: assign module-level purify so sanitizeHtmlServer doesn't crash on null
    purify = DOMPurify;
    return purify;
  }
}

// Pre-initialize asynchronously after a short delay to avoid blocking startup
let purifyReady = false;
setTimeout(() => {
  initDOMPurify()
    .then(() => {
      purifyReady = true;
    })
    .catch(() => {
      purifyReady = true; // Mark ready even if failed, fallback will be used
    });
}, 100);

/* ────────────────────────────────────────────────────────────────────────────
 * applySecurityMiddleware - call once before any route registration
 * ──────────────────────────────────────────────────────────────────────────── */
export function applySecurityMiddleware(app: Express): void {
  /* ── Body-size limits - handled by server.ts route-specific parsers ──── */

  /* ── Helmet (CSP disabled here - set manually below) ─────────────────── */
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      // Allow cross-origin reads for CORS-enabled API endpoints.
      // CORP: same-origin (Helmet default) would block cross-origin API responses
      // even when Access-Control-Allow-Origin grants access.
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );

  /* ── Per-request CSP nonce + Content-Security-Policy header ──────────── */
  /* Strict nonce-based CSP per Chrome Lighthouse best practices:
     - 'nonce-{random}' is the primary defence (CSP2+)
     - 'strict-dynamic' allows scripts loaded by nonced scripts (CSP3)
     - 'unsafe-inline' is a backward-compat fallback (ignored by CSP2+ when nonce present)
     - https: is a backward-compat scheme fallback (ignored by CSP3 with strict-dynamic)
     The SPA fallback injects the nonce into every <script> tag via sendHtmlWithNonce(). */
  app.use((_req: Request, res: Response, next: NextFunction) => {
    const nonce = crypto.randomUUID();
    res.locals.nonce = nonce;

    const directives = [
      "default-src 'self'",
      `script-src 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline' https:`,
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "img-src 'self' data: https:",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "connect-src 'self' https:",
      "font-src 'self' data: https: https://fonts.gstatic.com",
      "form-action 'self'",
      "frame-src 'self' https: https://www.google.com https://js.stripe.com",
      "upgrade-insecure-requests",
    ];

    res.setHeader("Content-Security-Policy", directives.join("; "));
    next();
  });

  /* ── Additional security headers ─────────────────────────────────────── */
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=()",
    );
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload",
    );
    res.setHeader("X-Frame-Options", "DENY");
    next();
  });
}

/* ────────────────────────────────────────────────────────────────────────────
 * sendHtmlWithNonce - read an HTML file, inject the per-request CSP nonce into
 * every <script> tag, and send it.  This is what makes the nonce-based CSP work
 * in practice: without this, <script> tags in the static build never carry the
 * nonce and inline scripts are blocked by CSP2+ browsers.
 * ──────────────────────────────────────────────────────────────────────────── */
import { readFile } from "fs/promises";

export async function sendHtmlWithNonce(
  res: Response,
  htmlPath: string,
): Promise<void> {
  const nonce = (res.locals.nonce as string) ?? "";
  let html = await readFile(htmlPath, "utf-8");
  // Inject nonce="..." into every <script …> opener (incl. ld+json - harmless)
  html = html.replace(/<script(?=[\s>])/gi, `<script nonce="${nonce}"`);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.send(html);
}

/* ────────────────────────────────────────────────────────────────────────────
 * sanitizeHtmlServer - strip dangerous tags/attributes from user-supplied HTML
 * ──────────────────────────────────────────────────────────────────────────── */
export function sanitizeHtmlServer(input: string): string {
  try {
    if (purify && typeof purify.sanitize === "function") {
      return purify.sanitize(input, {
        USE_PROFILES: { html: true },
        FORBID_TAGS: ["script", "style", "iframe", "object", "embed"],
        FORBID_ATTR: ["onerror", "onload", "onclick", "style"],
      });
    }
  } catch {
    // DOMPurify unavailable (no DOM in this environment) — fall through
  }
  // Strip all HTML tags as a safe baseline when DOMPurify has no DOM to work with
  return String(input).replace(/<[^>]+>/g, "");
}

/* ────────────────────────────────────────────────────────────────────────────
 * escapeBootstrapState - safe JSON for embedding in <script> tags
 * ──────────────────────────────────────────────────────────────────────────── */
export function escapeBootstrapState(state: unknown): string {
  return JSON.stringify(state).replace(/</g, "\\u003c");
}

/* ────────────────────────────────────────────────────────────────────────────
 * isSafeExternalUrl - protocol allowlist + SSRF protection for user-supplied URLs
 * ──────────────────────────────────────────────────────────────────────────── */
export function isSafeExternalUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }
    // Block SSRF: reject private/loopback/internal hostnames
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "0.0.0.0" ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal") ||
      /^10\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^169\.254\./.test(hostname) ||
      /^0[0-7]+\./.test(hostname) ||
      /^0x[0-9a-f]+$/i.test(hostname) ||
      hostname.startsWith("::ffff:") ||
      /^\[.*\]$/.test(hostname)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Zod schemas for highest-risk input surfaces
 * ──────────────────────────────────────────────────────────────────────────── */
export const profileUpdateSchema = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email().max(320).optional(),
  website: z.string().url().max(500).optional().nullable(),
  bio: z.string().max(5000).optional().nullable(),
  company: z.string().max(200).optional().nullable(),
  timezone: z.string().max(100).optional().nullable(),
  language: z.string().max(32).optional().nullable(),
  avatar_url: z.string().url().max(2048).optional().nullable(),
  avatar_data_url: z.string().max(800000).optional().nullable(),
  org_logo_url: z.string().url().max(2048).optional().nullable(),
  org_logo_data_url: z.string().max(800000).optional().nullable(),
  clear_avatar: z.boolean().optional(),
  clear_org_logo: z.boolean().optional(),
  auto_enrich: z.boolean().optional(),
  email_notifications: z.boolean().optional(),
  share_link_expiration_days: z.number().int().min(0).max(365).optional(),
});

export const analyzeRequestSchema = z.object({
  url: z.string().url().max(2000),
  forceRefresh: z.boolean().optional(),
  pageCount: z.number().int().min(1).max(50).optional(),
  retryRequested: z.boolean().optional(),
  requireLiveAi: z.boolean().optional(),
  requestId: z.string().max(200).optional(),
  findabilityGoals: z.string().max(5000).optional(),
  scanMockData: z.boolean().optional(),
});

export const feedbackSchema = z.object({
  message: z.string().min(1).max(10000),
  category: z.enum(["bug", "feature", "other"]),
  email: z.string().email().optional(),
});
