/**
 * Security Audit Service — SOC1 Type 1 Compliance
 *
 * Persists privileged actions to the security_audit_log table for
 * tamper-evident audit trail. Covers:
 * - Admin operations (cache clear, user management)
 * - Tier/role changes (from Stripe webhooks)
 * - API key lifecycle (create, revoke, toggle)
 * - Account lifecycle (delete, data export)
 * - Webhook lifecycle (create, delete)
 * - Content integrity (audit content hashing)
 */

import crypto from 'crypto';
import { isDatabaseAvailable, getPool } from './postgresql.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export type AuditCategory =
  | 'admin'
  | 'auth'
  | 'tier_change'
  | 'api_key'
  | 'webhook'
  | 'account'
  | 'data_access'
  | 'rescan'
  | 'report_delivery'
  | 'compliance';

export interface AuditLogEntry {
  actorId?: string;
  actorEmail?: string;
  action: string;
  category: AuditCategory;
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

// ─── Core Logger ────────────────────────────────────────────────────────────

/**
 * Persist a security audit log entry.
 * Non-blocking — failures are logged but never crash the request.
 */
export async function recordAuditEvent(entry: AuditLogEntry): Promise<void> {
  if (!isDatabaseAvailable()) return;

  try {
    const pool = getPool();
    await pool.query(
      `INSERT INTO security_audit_log
        (actor_id, actor_email, action, category, target_type, target_id, details, ip, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        entry.actorId || null,
        entry.actorEmail || null,
        entry.action,
        entry.category,
        entry.targetType || null,
        entry.targetId || null,
        entry.details ? JSON.stringify(entry.details) : '{}',
        entry.ip || null,
        entry.userAgent || null,
      ]
    );
  } catch (err) {
    // Audit logging must never crash the request
    console.warn('[SecurityAudit] Failed to persist audit event:', (err as Error).message?.substring(0, 80));
  }
}

// ─── Content Integrity ──────────────────────────────────────────────────────

/**
 * Compute SHA-256 content hash over an audit result payload.
 * Used for tamper-evident storage of audit results.
 */
export function computeContentHash(payload: unknown): string {
  const serialized = JSON.stringify(payload);
  return crypto.createHash('sha256').update(serialized, 'utf8').digest('hex');
}

// ─── Convenience Helpers ────────────────────────────────────────────────────

export function logAdminAction(
  actorId: string,
  action: string,
  details?: Record<string, unknown>,
  ip?: string
): Promise<void> {
  return recordAuditEvent({
    actorId,
    action,
    category: 'admin',
    details,
    ip,
  });
}

export function logTierChange(
  userId: string,
  email: string,
  oldTier: string,
  newTier: string,
  source: string,
  details?: Record<string, unknown>
): Promise<void> {
  return recordAuditEvent({
    actorId: userId,
    actorEmail: email,
    action: 'tier.changed',
    category: 'tier_change',
    targetType: 'user',
    targetId: userId,
    details: { oldTier, newTier, source, ...details },
  });
}

export function logApiKeyEvent(
  actorId: string,
  action: 'api_key.created' | 'api_key.revoked' | 'api_key.toggled',
  keyId: string,
  details?: Record<string, unknown>,
  ip?: string
): Promise<void> {
  return recordAuditEvent({
    actorId,
    action,
    category: 'api_key',
    targetType: 'api_key',
    targetId: keyId,
    details,
    ip,
  });
}

export function logAccountEvent(
  actorId: string,
  actorEmail: string,
  action: 'account.deleted' | 'account.data_exported' | 'account.password_reset',
  ip?: string
): Promise<void> {
  return recordAuditEvent({
    actorId,
    actorEmail,
    action,
    category: 'account',
    targetType: 'user',
    targetId: actorId,
    ip,
  });
}

export function logWebhookEvent(
  actorId: string,
  action: 'webhook.created' | 'webhook.deleted' | 'webhook.toggled',
  webhookId: string,
  details?: Record<string, unknown>,
  ip?: string
): Promise<void> {
  return recordAuditEvent({
    actorId,
    action,
    category: 'webhook',
    targetType: 'webhook',
    targetId: webhookId,
    details,
    ip,
  });
}
