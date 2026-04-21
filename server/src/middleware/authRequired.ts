// server/src/middleware/authRequired.ts
import type { Request, Response, NextFunction } from 'express';
import { getRequestAuthToken } from '../lib/authSession.js';
import { verifyUserToken } from '../lib/utils/jwt.js';
import { getUserById } from '../models/User.js';
import { redactSensitive, sanitizeError } from '../lib/safeLogging.js';
import {
  logMissingToken,
  logInvalidToken,
  logEmailUnverified,
  sanitizeAndLogError
} from '../lib/securityEventLogger.js';
import { enforceEffectiveTier, getAllowlistedElevatedEmails } from '../services/entitlementGuard.js';

/**
 * Role-based access control middleware.
 * Must be placed AFTER authRequired in the middleware chain.
 */
export function requireRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = (req as any).user?.role;
    if (!role || !allowedRoles.includes(role)) {
      res.status(403).json({ error: 'Insufficient permissions', code: 'FORBIDDEN' });
      return;
    }
    next();
  };
}

export async function authRequired(req: Request, res: Response, next: NextFunction) {
  const token = getRequestAuthToken(req);
  if (!token) {
    // Suppress log noise from our own internal scanner bot
    const ua = req.headers['user-agent'] || '';
    if (!ua.includes('AiVIS.biz-PrivateExposureScan')) {
      logMissingToken(req);
    }
    return res.status(401).json({
      error: 'Not authenticated. Please log in.',
      code: 'NO_TOKEN'
    });
  }

  try {
    const decoded = verifyUserToken(token);

    // Look up the user in the database for tier / existence check
    const user = await getUserById(decoded.userId);

    if (!user) {
      logInvalidToken(req, decoded.userId);
      return res.status(401).json({
        error: 'User not found. Token may be invalid.',
        code: 'USER_NOT_FOUND'
      });
    }

    // Enforce email verification - Resend is now wired up.
    if (!user.is_verified) {
      logEmailUnverified(req, user.id, user.email);
      return res.status(403).json({
        error: 'Email verification required. Please check your email for the verification link.',
        code: 'EMAIL_NOT_VERIFIED',
        requiresVerification: true,
        userEmail: user.email,
      });
    }

    const effectiveTier = await enforceEffectiveTier(user);

    // Detect active trial: user has trial_ends_at in the future and no confirmed stripe subscription
    const isTrialing = !!(user.trial_ends_at && new Date(user.trial_ends_at) > new Date() && !user.stripe_subscription_id);

    // Auto-elevate role to 'admin' for allowlisted emails
    const allowlisted = getAllowlistedElevatedEmails();
    const effectiveRole = (allowlisted.has(String(user.email || '').trim().toLowerCase()))
      ? 'admin'
      : (user.role || 'user');

    // Set both formats for compatibility:
    // – req.user           = full DB user (used by route handlers, getMe, etc.)
    // – req.userId / .tier = flat fields (used by usageGate, incrementUsage)
    req.user = { ...user, tier: effectiveTier as any, role: effectiveRole as any, isTrialing };
    req.userId = user.id;
    req.tier = effectiveTier;

    next();
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired. Please sign in again.',
        code: 'TOKEN_EXPIRED',
      });
    }

    sanitizeAndLogError('[Auth Required] Token verification failed', err, req);
    return res.status(401).json({
      error: 'Invalid or expired token',
      code: 'INVALID_TOKEN'
    });
  }
}

/**
 * Tier gate — ScoreFix only.
 * Must be placed AFTER authRequired in the middleware chain.
 * Apply only to /api/scorefix/run, /api/scorefix/ledger-sync, /api/scorefix/pr-status.
 */
export function requireScoreFixTier(req: Request, res: Response, next: NextFunction): void {
  if ((req as any).user?.tier !== 'scorefix') {
    res.status(403).json({
      error: 'Score Fix tier required. Subscribe at /pricing#scorefix to unlock continuous evidence repair.',
      code: 'SCOREFIX_TIER_REQUIRED',
    });
    return;
  }
  next();
}
