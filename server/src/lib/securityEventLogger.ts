/**
 * Security Event Logger
 *
 * Enterprise-grade threat logging for SMB/Agencies/SEO operators.
 * All logging is redacted to prevent accidental secret exposure.
 *
 * Use this for:
 * - Authentication failures / attempts
 * - Authorization violations
 * - Suspicious URL patterns
 * - Rate limit triggers
 * - Abuse patterns
 * - Invalid API key usage
 * - Malformed payloads
 */

import { Request } from 'express';
import { redactSensitive, sanitizeError } from './safeLogging.js';

export type SecurityEventLevel = 'info' | 'warn' | 'alert' | 'critical';
export type SecurityEventType =
  | 'auth.failed'
  | 'auth.invalid_token'
  | 'auth.missing_token'
  | 'auth.email_unverified'
  | 'auth.account_locked'
  | 'auth.password_reset_requested'
  | 'auth.invalid_credentials'
  | 'authz.forbidden'
  | 'authz.tier_insufficient'
  | 'usage.limit_exceeded'
  | 'usage.quota_exceeded'
  | 'api.invalid_key'
  | 'api.key_expired'
  | 'api.scope_insufficient'
  | 'url.private_host_attempted'
  | 'url.localhost_attempted'
  | 'url.invalid_format'
  | 'payload.malformed'
  | 'payload.validation_failed'
  | 'upload.size_exceeded'
  | 'upload.invalid_type'
  | 'rate.limit_triggered'
  | 'abuse.pattern_detected'
  | 'abuse.repeated_failures'
  | 'share.unauthorized_access'
  | 'webhook.invalid_signature'
  | 'webhook.delivery_failed'
  | 'external.service_error'
  | 'external.timeout'
  | 'external.invalid_response';

export interface SecurityEvent {
  level: SecurityEventLevel;
  type: SecurityEventType;
  timestamp: string;
  requestId?: string;
  userId?: string;
  email?: string; // Masked
  ip?: string;
  path?: string;
  method?: string;
  statusCode?: number;
  message: string;
  details?: Record<string, any>;
  userAgent?: string;
}

/**
 * Log a security event.
 * All sensitive data is automatically redacted.
 */
export function logSecurityEvent(
  level: SecurityEventLevel,
  type: SecurityEventType,
  message: string,
  req?: Request | null,
  details?: Record<string, any>,
  userId?: string,
  email?: string
): void {
  const event: SecurityEvent = {
    level,
    type,
    timestamp: new Date().toISOString(),
    requestId: req?.headers['x-request-id'] as string | undefined,
    userId,
    email, // Will be masked if present
    ip: req?.ip || req?.socket?.remoteAddress, // May be redacted if contains secrets
    path: req?.path,
    method: req?.method,
    message,
    details: details ? redactSensitive(details) : undefined,
    userAgent: req?.headers['user-agent'] as string | undefined,
  };

  // Redact everything before logging
  const safeEvent = redactSensitive(event);

  // Log with level-appropriate method
  const logger = console[level === 'critical' ? 'error' : level === 'alert' ? 'warn' : level === 'warn' ? 'warn' : 'info'];

  // Format for structured logging (JSON)
  logger(`[${type.toUpperCase()}] ${message}`, safeEvent);
}

/**
 * Auth failure: Invalid or missing token
 */
export function logAuthFailure(req: Request, reason: string, userId?: string): void {
  logSecurityEvent('warn', 'auth.failed', reason, req, { reason }, userId);
}

/**
 * Auth failure: Missing bearer token
 */
export function logMissingToken(req: Request): void {
  logSecurityEvent('warn', 'auth.missing_token', 'Missing bearer token in Authorization header', req);
}

/**
 * Auth failure: Invalid token format or signature
 */
export function logInvalidToken(req: Request, userId?: string): void {
  logSecurityEvent('warn', 'auth.invalid_token', 'Invalid or expired bearer token', req, undefined, userId);
}

/**
 * Auth failure: Email not verified
 */
export function logEmailUnverified(req: Request, userId: string, email: string): void {
  logSecurityEvent('info', 'auth.email_unverified', 'Email verification required', req, undefined, userId, email);
}

/**
 * Auth failure: Account locked
 */
export function logAccountLocked(req: Request, userId: string, email: string): void {
  logSecurityEvent('alert', 'auth.account_locked', 'Account locked after failed login attempts', req, undefined, userId, email);
}

/**
 * Authorization failure: Insufficient tier
 */
export function logInsufficientTier(req: Request, userId: string, requiredTier: string, actualTier: string): void {
  logSecurityEvent(
    'warn',
    'authz.tier_insufficient',
    `Insufficient tier: required ${requiredTier}, user has ${actualTier}`,
    req,
    { requiredTier, actualTier },
    userId
  );
}

/**
 * Authorization failure: Access forbidden / not permitted
 */
export function logForbiddenAccess(req: Request, userId: string, resource: string, reason?: string): void {
  logSecurityEvent('warn', 'authz.forbidden', `Forbidden access to ${resource}: ${reason || 'no reason provided'}`, req, { resource, reason }, userId);
}

/**
 * Usage limit exceeded: Monthly scans or API calls
 */
export function logUsageExceeded(req: Request, userId: string, limit: number, current: number): void {
  logSecurityEvent('warn', 'usage.limit_exceeded', `Usage limit exceeded: ${current} / ${limit}`, req, { limit, current }, userId);
}

/**
 * API: Invalid API key
 */
export function logInvalidApiKey(req: Request, keyId?: string): void {
  logSecurityEvent('warn', 'api.invalid_key', 'Invalid or expired API key', req, { keyId });
}

/**
 * API: Key scope insufficient
 */
export function logApiScopeInsufficient(req: Request, keyId: string, requiredScope: string): void {
  logSecurityEvent('warn', 'api.scope_insufficient', `API key scope insufficient: required ${requiredScope}`, req, { keyId, requiredScope });
}

/**
 * URL Safety: Private/local host attempted in production
 */
export function logPrivateHostAttempt(req: Request, userId: string, targetUrl: string): void {
  logSecurityEvent(
    'alert',
    'url.private_host_attempted',
    'Attempted to audit private/local host in production',
    req,
    { suspectedUrl: targetUrl },
    userId
  );
}

/**
 * URL Safety: Localhost attempted
 */
export function logLocalhostAttempt(req: Request, userId: string, targetUrl: string): void {
  logSecurityEvent('info', 'url.localhost_attempted', 'Attempted to audit localhost (may be dev mode)', req, { suspectedUrl: targetUrl }, userId);
}

/**
 * Payload: Malformed JSON or missing required fields
 */
export function logMalformedPayload(req: Request, userId: string | undefined, error: string, details?: Record<string, any>): void {
  logSecurityEvent('warn', 'payload.malformed', `Malformed payload: ${error}`, req, details, userId);
}

/**
 * Upload: Size exceeded or invalid type
 */
export function logInvalidUpload(req: Request, userId: string, reason: string, details?: Record<string, any>): void {
  logSecurityEvent('warn', 'upload.invalid_type', `Invalid upload: ${reason}`, req, details, userId);
}

/**
 * Rate limit: Threshold triggered
 */
export function logRateLimitTriggered(req: Request, userId: string | undefined, limit: number, window: string): void {
  logSecurityEvent('warn', 'rate.limit_triggered', `Rate limit triggered: ${limit} requests per ${window}`, req, { limit, window }, userId);
}

/**
 * Abuse: Pattern detected (repeated failures, brute force, etc.)
 */
export function logAbusePattern(req: Request, userId: string | undefined, pattern: string, details?: Record<string, any>): void {
  logSecurityEvent('critical', 'abuse.pattern_detected', `Abuse pattern detected: ${pattern}`, req, details, userId);
}

/**
 * Webhook: Signature verification failed
 */
export function logWebhookSignatureFailure(req: Request, providerId: string): void {
  logSecurityEvent('alert', 'webhook.invalid_signature', 'Webhook signature verification failed', req, { provider: providerId });
}

/**
 * External service: Timeout or error
 */
export function logExternalServiceError(req: Request, userId: string | undefined, service: string, error: unknown): void {
  logSecurityEvent(
    'warn',
    'external.service_error',
    `External service error: ${service}`,
    req,
    { service, error: sanitizeError(error) },
    userId
  );
}

/**
 * Database operation: Error
 */
export function logDatabaseError(userId: string | undefined, operation: string, error: unknown): void {
  logSecurityEvent('critical', 'external.service_error', `Database error: ${operation}`, undefined, { operation, error: sanitizeError(error) }, userId);
}

/**
 * Password reset: Token generated
 */
export function logPasswordResetRequested(email: string, requestId: string): void {
  logSecurityEvent('info', 'auth.password_reset_requested', 'Password reset requested', undefined, { requestId }, undefined, email);
}

/**
 * Generic error wrapper: Log any error with redaction
 */
export function sanitizeAndLogError(context: string, err: unknown, req?: Request, userId?: string): void {
  const safeError = sanitizeError(err);
  logSecurityEvent('warn', 'external.service_error', context, req, { error: safeError }, userId);
}
