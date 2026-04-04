/**
 * API Key Service
 * Manages API keys for API-entitled tiers to access the read-only external API.
 * Keys are stored as SHA-256 hashes; the plaintext key is only returned once at creation.
 */
import { randomBytes, createHmac } from 'crypto';
import { getPool } from './postgresql.js';
import { logApiKeyEvent } from './securityAuditService.js';
import { TIER_LIMITS, uiTierFromCanonical } from '../../../shared/types.js';
import type { CanonicalTier, LegacyTier } from '../../../shared/types.js';
import { IS_PRODUCTION } from '../config/runtime.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ApiKey {
  id: string;
  user_id: string;
  workspace_id: string;
  key_prefix: string;
  name: string;
  scopes: string[];
  last_used_at: string | null;
  expires_at: string | null;
  enabled: boolean;
  created_at: string;
}

export interface ApiKeyWithPlaintext extends ApiKey {
  /** The full key — only available immediately after creation */
  plaintext_key: string;
}

export type ApiKeyValidationFailureReason = 'invalid' | 'expired' | 'tier_blocked';

export type ApiKeyValidationResult =
  | {
      ok: true;
      keyId: string;
      userId: string;
      workspaceId: string;
      scopes: string[];
      reason?: undefined;
    }
  | {
      ok: false;
      reason: ApiKeyValidationFailureReason;
      keyId?: undefined;
      userId?: undefined;
      workspaceId?: undefined;
      scopes?: undefined;
    };

const ALLOWED_API_SCOPES = ['read:audits', 'read:analytics'] as const;
type ApiScope = (typeof ALLOWED_API_SCOPES)[number];

// ── Helpers ──────────────────────────────────────────────────────────────────

function hashKey(key: string): string {
  const pepper = String(process.env.API_KEY_PEPPER || '').trim();
  if (!pepper) {
    if (IS_PRODUCTION) {
      throw new Error('API_KEY_PEPPER is required in production');
    }
    return createHmac('sha256', 'aivis-dev-only-pepper').update(key).digest('hex');
  }
  return createHmac('sha256', pepper).update(key).digest('hex');
}

function generateKey(): { plaintext: string; prefix: string; hash: string } {
  const raw = randomBytes(32).toString('hex'); // 64 chars
  const plaintext = `avis_${raw}`;
  const prefix = `avis_${raw.slice(0, 6)}`;
  const hash = hashKey(plaintext);
  return { plaintext, prefix, hash };
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

/** Create a new API key. Returns the plaintext key ONCE. */
export async function createApiKey(
  userId: string,
  workspaceId: string,
  name: string = 'Default',
  scopes: string[] = ['read:audits', 'read:analytics'],
  userTier: string = 'observer'
): Promise<ApiKeyWithPlaintext> {
  const pool = getPool();
  const { plaintext, prefix, hash } = generateKey();
  const safeName = String(name || 'Default').trim().slice(0, 120) || 'Default';
  const normalizedScopes = Array.from(
    new Set((Array.isArray(scopes) ? scopes : []).map((scope) => String(scope || '').trim()).filter(Boolean))
  );
  const effectiveScopes = (normalizedScopes.length ? normalizedScopes : ['read:audits', 'read:analytics']) as string[];
  const invalidScopes = effectiveScopes.filter((scope) => !ALLOWED_API_SCOPES.includes(scope as ApiScope));
  if (invalidScopes.length) {
    throw new Error(`Invalid API key scope(s): ${invalidScopes.join(', ')}`);
  }

  // Enforce per-tier API key limit
  const tier = uiTierFromCanonical(userTier as any);
  const maxKeys = TIER_LIMITS[tier].maxApiKeys;
  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*)::int AS cnt FROM api_keys WHERE user_id = $1 AND workspace_id = $2`,
    [userId, workspaceId]
  );
  if (countRows[0].cnt >= maxKeys) {
    throw new Error(`Maximum ${maxKeys} API keys on your plan`);
  }

  const { rows } = await pool.query(
    `INSERT INTO api_keys (user_id, workspace_id, key_hash, key_prefix, name, scopes)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, user_id, workspace_id, key_prefix, name, scopes, last_used_at, expires_at, enabled, created_at`,
    [userId, workspaceId, hash, prefix, safeName, effectiveScopes]
  );

  logApiKeyEvent(userId, 'api_key.created', rows[0]?.id, { name: safeName, scopes: effectiveScopes }).catch(() => {});
  return { ...rows[0], plaintext_key: plaintext };
}

/** List all API keys for a user (no hashes or plaintexts). */
export async function listApiKeys(userId: string, workspaceId: string): Promise<ApiKey[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id, user_id, workspace_id, key_prefix, name, scopes, last_used_at, expires_at, enabled, created_at
     FROM api_keys WHERE user_id = $1 AND workspace_id = $2 ORDER BY created_at DESC`,
    [userId, workspaceId]
  );
  return rows;
}

/** Revoke (delete) an API key. */
export async function revokeApiKey(id: string, userId: string, workspaceId: string): Promise<boolean> {
  const pool = getPool();
  const { rowCount } = await pool.query(
    `DELETE FROM api_keys WHERE id = $1 AND user_id = $2 AND workspace_id = $3`,
    [id, userId, workspaceId]
  );
  const deleted = (rowCount ?? 0) > 0;
  if (deleted) {
    logApiKeyEvent(userId, 'api_key.revoked', id).catch(() => {});
  }
  return deleted;
}

/** Toggle enabled state. */
export async function toggleApiKey(id: string, userId: string, workspaceId: string, enabled: boolean): Promise<ApiKey | null> {
  const pool = getPool();
  const { rows } = await pool.query(
    `UPDATE api_keys SET enabled = $1 WHERE id = $2 AND user_id = $3 AND workspace_id = $4
     RETURNING id, user_id, workspace_id, key_prefix, name, scopes, last_used_at, expires_at, enabled, created_at`,
    [enabled, id, userId, workspaceId]
  );
  return rows[0] || null;
}

// ── Authentication ───────────────────────────────────────────────────────────

/** Validate an API key and return the user_id + scopes, or null. */
export async function validateApiKey(
  key: string
): Promise<ApiKeyValidationResult> {
  if (!key || !key.startsWith('avis_')) return { ok: false, reason: 'invalid' };

  const pool = getPool();
  const hash = hashKey(key);

  const { rows } = await pool.query(
    `SELECT ak.id, ak.user_id, ak.workspace_id, ak.scopes, ak.expires_at, u.tier
     FROM api_keys ak
     JOIN users u ON u.id = ak.user_id
     WHERE ak.key_hash = $1 AND ak.enabled = TRUE`,
    [hash]
  );

  if (rows.length === 0) return { ok: false, reason: 'invalid' };

  const row = rows[0];

  const normalizedTier = uiTierFromCanonical(
    (String(row.tier || 'observer').toLowerCase() as CanonicalTier | LegacyTier)
  );
  if (!TIER_LIMITS[normalizedTier].hasApiAccess) return { ok: false, reason: 'tier_blocked' };

  // Check expiry
  if (row.expires_at && new Date(row.expires_at) < new Date()) return { ok: false, reason: 'expired' };

  // Update last_used_at
  await pool.query(
    `UPDATE api_keys SET last_used_at = NOW() WHERE key_hash = $1`,
    [hash]
  ).catch(() => {}); // non-critical

  return { ok: true, keyId: row.id, userId: row.user_id, workspaceId: row.workspace_id, scopes: row.scopes };
}
