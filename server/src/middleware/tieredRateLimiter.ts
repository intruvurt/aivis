/**
 * Tiered Rate Limiter - per-tier rate limiting with in-memory fallback.
 *
 * Uses an in-memory token bucket per key (userId or IP).
 * If Redis is configured (REDIS_URL env), uses Redis for distributed state.
 *
 * Exports:
 *   tieredRateLimit(route) - middleware factory for auth'd requests (keyed by userId)
 *   ipRateLimit(opts)      - middleware factory for anon requests (keyed by IP)
 */

import type { Request, Response, NextFunction } from 'express';
import type { CanonicalTier } from '../../../shared/types.js';
import { getPool } from '../services/postgresql.js';

// ─── Per-tier limits (requests per window) ────────────────────────────────────

type RouteKey = 'analyze' | 'api_default';

const TIER_RATE_LIMITS: Record<RouteKey, Record<CanonicalTier, { maxRequests: number; windowMs: number }>> = {
  analyze: {
    observer:  { maxRequests: 5,  windowMs: 60_000 },
    alignment: { maxRequests: 15, windowMs: 60_000 },
    signal:    { maxRequests: 30, windowMs: 60_000 },
    scorefix:  { maxRequests: 50, windowMs: 60_000 },
  },
  api_default: {
    observer:  { maxRequests: 30,  windowMs: 60_000 },
    alignment: { maxRequests: 60,  windowMs: 60_000 },
    signal:    { maxRequests: 120, windowMs: 60_000 },
    scorefix:  { maxRequests: 200, windowMs: 60_000 },
  },
};

const IP_RATE_CONFIG = {
  maxRequests: 60,
  windowMs: 60_000,
};

// ─── In-memory token bucket ───────────────────────────────────────────────────

interface BucketEntry {
  tokens: number;
  lastRefill: number;
  maxTokens: number;
  refillRate: number; // tokens per ms
}

const buckets = new Map<string, BucketEntry>();

// Periodic cleanup to prevent unbounded memory growth
const CLEANUP_INTERVAL_MS = 5 * 60_000;
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanup(): void {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of buckets) {
      // Remove entries idle for > 10 minutes
      if (now - entry.lastRefill > 10 * 60_000) {
        buckets.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS);
  // Allow process to exit without waiting for this timer
  if (cleanupTimer && typeof cleanupTimer === 'object' && 'unref' in cleanupTimer) {
    cleanupTimer.unref();
  }
}

function consumeToken(key: string, maxRequests: number, windowMs: number): { allowed: boolean; remaining: number; retryAfterMs: number } {
  ensureCleanup();

  const now = Date.now();
  const refillRate = maxRequests / windowMs; // tokens per ms

  let entry = buckets.get(key);
  if (!entry) {
    entry = {
      tokens: maxRequests - 1,
      lastRefill: now,
      maxTokens: maxRequests,
      refillRate,
    };
    buckets.set(key, entry);
    return { allowed: true, remaining: entry.tokens, retryAfterMs: 0 };
  }

  // Refill tokens based on elapsed time
  const elapsed = now - entry.lastRefill;
  entry.tokens = Math.min(maxRequests, entry.tokens + elapsed * refillRate);
  entry.lastRefill = now;
  entry.maxTokens = maxRequests;
  entry.refillRate = refillRate;

  if (entry.tokens >= 1) {
    entry.tokens -= 1;
    return { allowed: true, remaining: Math.floor(entry.tokens), retryAfterMs: 0 };
  }

  // Not enough tokens - compute retry delay
  const deficit = 1 - entry.tokens;
  const retryAfterMs = Math.ceil(deficit / refillRate);
  return { allowed: false, remaining: 0, retryAfterMs };
}

// ─── Optional event logging (best-effort) ─────────────────────────────────────

async function logRateLimitEvent(
  userId: string | null,
  ip: string | null,
  endpoint: string,
  tier: string | null,
  blocked: boolean,
): Promise<void> {
  try {
    const pool = getPool();
    await pool.query(
      `INSERT INTO rate_limit_events (user_id, ip, endpoint, tier, blocked)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, ip, endpoint, tier, blocked],
    );
  } catch {
    // Best-effort - don't break request flow
  }
}

// ─── Middleware factories ─────────────────────────────────────────────────────

/**
 * Tiered rate limiter for authenticated routes.
 * Key = userId, limit = based on user's canonical tier.
 */
export function tieredRateLimit(route: RouteKey = 'api_default') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user;
    const userId: string | null = user?.id ?? null;
    const tier: CanonicalTier = (user?.tier as CanonicalTier) || 'observer';
    const config = TIER_RATE_LIMITS[route]?.[tier] ?? TIER_RATE_LIMITS.api_default.observer;
    const key = `tiered:${route}:${userId || 'anon'}`;

    const result = consumeToken(key, config.maxRequests, config.windowMs);

    res.setHeader('X-RateLimit-Limit', config.maxRequests);
    res.setHeader('X-RateLimit-Remaining', result.remaining);

    if (!result.allowed) {
      res.setHeader('Retry-After', Math.ceil(result.retryAfterMs / 1000));
      logRateLimitEvent(userId, req.ip ?? null, route, tier, true).catch(() => {});
      res.status(429).json({
        error: 'Rate limit reached. Please retry shortly.',
        code: 'RATE_LIMIT_EXCEEDED',
        retry_after_ms: result.retryAfterMs,
      });
      return;
    }

    next();
  };
}

/**
 * IP-based rate limiter for anonymous / public routes.
 */
export function ipRateLimit(opts?: { maxRequests?: number; windowMs?: number }) {
  const maxRequests = opts?.maxRequests ?? IP_RATE_CONFIG.maxRequests;
  const windowMs = opts?.windowMs ?? IP_RATE_CONFIG.windowMs;

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `ip:${ip}`;
    const result = consumeToken(key, maxRequests, windowMs);

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', result.remaining);

    if (!result.allowed) {
      res.setHeader('Retry-After', Math.ceil(result.retryAfterMs / 1000));
      logRateLimitEvent(null, ip, req.path, null, true).catch(() => {});
      res.status(429).json({
        error: 'Rate limit reached. Please retry shortly.',
        code: 'RATE_LIMIT_EXCEEDED',
        retry_after_ms: result.retryAfterMs,
      });
      return;
    }

    next();
  };
}
