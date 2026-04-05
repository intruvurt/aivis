// server/src/middleware/authRequired.ts
import type { Request, Response, NextFunction } from 'express';
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

export async function authRequired(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    // Suppress log noise from our own internal scanner bot
    const ua = req.headers['user-agent'] || '';
    if (!ua.includes('AiVIS-PrivateExposureScan')) {
      logMissingToken(req);
    }
    return res.status(401).json({
      error: 'Not authenticated. Please log in.',
      code: 'NO_TOKEN'
    });
  }

  try {
    const token = auth.slice('Bearer '.length);
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

    // Auto-elevate role to 'admin' for allowlisted emails
    const allowlisted = getAllowlistedElevatedEmails();
    const effectiveRole = (allowlisted.has(String(user.email || '').trim().toLowerCase()))
      ? 'admin'
      : (user.role || 'user');

    // Set both formats for compatibility:
    // – req.user           = full DB user (used by route handlers, getMe, etc.)
    // – req.userId / .tier = flat fields (used by usageGate, incrementUsage)
    req.user = { ...user, tier: effectiveTier as any, role: effectiveRole as any };
    req.userId = user.id;
    req.tier   = effectiveTier;

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
