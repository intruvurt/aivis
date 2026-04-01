/**
 * Drop-in Express security middleware for AiVIS.
 *
 * Usage in server.ts:
 *   import { applySecurityMiddleware } from './middleware/securityMiddleware.js';
 *   applySecurityMiddleware(app);        // BEFORE any route registration
 */

import type { Express, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import crypto from 'crypto';
import { JSDOM } from 'jsdom';
import DOMPurify from 'dompurify';
import { z } from 'zod';

/* ────────────────────────────────────────────────────────────────────────────
 * Server-side DOMPurify instance (JSDOM-backed, created once)
 * ──────────────────────────────────────────────────────────────────────────── */
const window = new JSDOM('').window;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const purify = DOMPurify(window as any);

/* ────────────────────────────────────────────────────────────────────────────
 * applySecurityMiddleware — call once before any route registration
 * ──────────────────────────────────────────────────────────────────────────── */
export function applySecurityMiddleware(app: Express): void {
  /* ── Body-size limits — handled by server.ts route-specific parsers ──── */

  /* ── Helmet (CSP disabled here — set manually below) ─────────────────── */
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  /* ── Per-request CSP nonce + Content-Security-Policy header ──────────── */
  app.use((_req: Request, res: Response, next: NextFunction) => {
    const nonce = crypto.randomUUID();
    res.locals.nonce = nonce;

    const directives = [
      "default-src 'self'",
      `script-src 'self' 'nonce-${nonce}'`,
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "img-src 'self' data: https:",
      "style-src 'self' 'unsafe-inline'",
      "connect-src 'self' https:",
      "font-src 'self' data: https:",
      "form-action 'self'",
      "frame-src 'self' https:",
      'upgrade-insecure-requests',
    ];

    res.setHeader('Content-Security-Policy', directives.join('; '));
    next();
  });

  /* ── Additional security headers ─────────────────────────────────────── */
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    next();
  });
}

/* ────────────────────────────────────────────────────────────────────────────
 * sanitizeHtmlServer — strip dangerous tags/attributes from user-supplied HTML
 * ──────────────────────────────────────────────────────────────────────────── */
export function sanitizeHtmlServer(input: string): string {
  return purify.sanitize(input, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'style'],
  });
}

/* ────────────────────────────────────────────────────────────────────────────
 * escapeBootstrapState — safe JSON for embedding in <script> tags
 * ──────────────────────────────────────────────────────────────────────────── */
export function escapeBootstrapState(state: unknown): string {
  return JSON.stringify(state).replace(/</g, '\\u003c');
}

/* ────────────────────────────────────────────────────────────────────────────
 * isSafeExternalUrl — protocol allowlist + SSRF protection for user-supplied URLs
 * ──────────────────────────────────────────────────────────────────────────── */
export function isSafeExternalUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:' && parsed.protocol !== 'mailto:') {
      return false;
    }
    // Block SSRF: reject private/loopback/internal hostnames
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '0.0.0.0' ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      /^10\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^169\.254\./.test(hostname)
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
  auto_enrich: z.boolean().optional(),
  email_notifications: z.boolean().optional(),
  share_link_expiration_days: z.number().int().min(1).max(365).optional(),
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
  category: z.enum(['bug', 'feature', 'other']),
  email: z.string().email().optional(),
});
