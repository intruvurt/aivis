/**
 * OAuth 2.0 Authorization Code Flow
 *
 * Allows third-party applications to access AiVIS API on behalf of users.
 * Implements RFC 6749 Authorization Code Grant.
 *
 * Routes:
 *   POST /api/oauth/clients           - Register a new OAuth client (auth required)
 *   GET  /api/oauth/clients           - List user's OAuth clients (auth required)
 *   DELETE /api/oauth/clients/:id     - Revoke an OAuth client (auth required)
 *   GET  /api/oauth/authorize         - Authorization endpoint (renders consent)
 *   POST /api/oauth/authorize         - User grants/denies consent
 *   POST /api/oauth/token             - Token exchange (public, client-authenticated)
 *   POST /api/oauth/revoke            - Revoke a token
 */
import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { getPool } from '../services/postgresql.js';
import { authRequired } from '../middleware/authRequired.js';
import { TIER_LIMITS, uiTierFromCanonical, meetsMinimumTier, type CanonicalTier, type LegacyTier } from '../../../shared/types.js';

const router = Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateSecret(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

function hashSecret(secret: string): string {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

const VALID_SCOPES = ['read:audits', 'read:analytics'];
const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function validateScopes(requested: string[]): string[] {
  return requested.filter((s) => VALID_SCOPES.includes(s));
}

function validateRedirectUri(uri: string): boolean {
  try {
    const parsed = new URL(uri);
    // Must be HTTPS in production, or http://localhost for dev
    return parsed.protocol === 'https:' || parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

// ── Client Registration (authenticated user) ────────────────────────────────

router.post('/clients', authRequired, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const normalizedTier = uiTierFromCanonical((user.tier || 'observer') as CanonicalTier | LegacyTier);
    if (!meetsMinimumTier((user.tier || 'observer') as CanonicalTier | LegacyTier, 'signal')) {
      return res.status(403).json({ error: 'OAuth 2.0 client registration requires a Signal or higher plan.' });
    }
    const { name, redirect_uris, scopes } = req.body || {};

    if (!name || typeof name !== 'string' || name.length < 2 || name.length > 120) {
      return res.status(400).json({ error: 'Client name must be 2–120 characters' });
    }

    const uris: string[] = Array.isArray(redirect_uris) ? redirect_uris : [];
    if (uris.length === 0 || uris.length > 5) {
      return res.status(400).json({ error: 'Provide 1–5 redirect URIs' });
    }
    for (const uri of uris) {
      if (!validateRedirectUri(uri)) {
        return res.status(400).json({ error: `Invalid redirect URI: ${uri}. Must be HTTPS (or localhost for dev).` });
      }
    }

    const validScopes = validateScopes(Array.isArray(scopes) ? scopes : VALID_SCOPES);
    if (validScopes.length === 0) {
      return res.status(400).json({ error: `Invalid scopes. Valid: ${VALID_SCOPES.join(', ')}` });
    }

    const clientId = `aivis_${generateSecret(16)}`;
    const clientSecret = `aivisc_${generateSecret(32)}`;
    const secretHash = hashSecret(clientSecret);

    const pool = getPool();
    const { rows } = await pool.query(
      `INSERT INTO oauth_clients (client_id, client_secret_hash, user_id, name, redirect_uris, scopes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, client_id, name, redirect_uris, scopes, created_at`,
      [clientId, secretHash, user.id, name.trim(), JSON.stringify(uris), JSON.stringify(validScopes)]
    );

    return res.status(201).json({
      success: true,
      data: {
        ...rows[0],
        client_secret: clientSecret, // Only returned once at creation
      },
      warning: 'Store client_secret securely. It will not be shown again.',
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.get('/clients', authRequired, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT id, client_id, name, redirect_uris, scopes, enabled, created_at
       FROM oauth_clients
       WHERE user_id = $1 AND enabled = TRUE
       ORDER BY created_at DESC`,
      [user.id]
    );
    return res.json({ success: true, data: rows });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.delete('/clients/:id', authRequired, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const pool = getPool();
    const { rowCount } = await pool.query(
      `UPDATE oauth_clients SET enabled = FALSE WHERE id = $1 AND user_id = $2 AND enabled = TRUE`,
      [req.params.id, user.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Client not found' });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ── Authorization Endpoint ───────────────────────────────────────────────────

router.get('/authorize', authRequired, async (req: Request, res: Response) => {
  try {
    const { client_id, redirect_uri, scope, state, response_type } = req.query as Record<string, string>;

    if (response_type !== 'code') {
      return res.status(400).json({ error: 'response_type must be "code"' });
    }
    if (!client_id || !redirect_uri) {
      return res.status(400).json({ error: 'client_id and redirect_uri are required' });
    }

    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT id, name, redirect_uris, scopes FROM oauth_clients WHERE client_id = $1 AND enabled = TRUE`,
      [client_id]
    );
    if (!rows.length) {
      return res.status(400).json({ error: 'Unknown client_id' });
    }

    const client = rows[0];
    const allowedUris: string[] = typeof client.redirect_uris === 'string' ? JSON.parse(client.redirect_uris) : client.redirect_uris;
    if (!allowedUris.includes(redirect_uri)) {
      return res.status(400).json({ error: 'redirect_uri not registered for this client' });
    }

    const requestedScopes = scope ? scope.split(' ').filter(Boolean) : [];
    const clientScopes: string[] = typeof client.scopes === 'string' ? JSON.parse(client.scopes) : client.scopes;
    const grantableScopes = requestedScopes.length > 0
      ? requestedScopes.filter((s: string) => clientScopes.includes(s))
      : clientScopes;

    // Return authorization consent metadata (frontend renders the consent UI)
    return res.json({
      success: true,
      consent: {
        client_name: client.name,
        scopes: grantableScopes,
        redirect_uri,
        client_id,
        state: state || '',
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.post('/authorize', authRequired, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const normalizedTier = uiTierFromCanonical((user.tier || 'observer') as CanonicalTier | LegacyTier);
    if (!meetsMinimumTier((user.tier || 'observer') as CanonicalTier | LegacyTier, 'signal')) {
      return res.status(403).json({ error: 'OAuth 2.0 access requires a Signal or higher plan.' });
    }
    const { client_id, redirect_uri, scopes, state, approved } = req.body || {};

    if (!approved) {
      const deny = new URL(redirect_uri);
      deny.searchParams.set('error', 'access_denied');
      if (state) deny.searchParams.set('state', state);
      return res.json({ success: true, redirect: deny.toString() });
    }

    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT id, redirect_uris, scopes FROM oauth_clients WHERE client_id = $1 AND enabled = TRUE`,
      [client_id]
    );
    if (!rows.length) return res.status(400).json({ error: 'Unknown client_id' });

    const client = rows[0];
    const allowedUris: string[] = typeof client.redirect_uris === 'string' ? JSON.parse(client.redirect_uris) : client.redirect_uris;
    if (!allowedUris.includes(redirect_uri)) {
      return res.status(400).json({ error: 'redirect_uri mismatch' });
    }

    const clientScopes: string[] = typeof client.scopes === 'string' ? JSON.parse(client.scopes) : client.scopes;
    const grantedScopes = validateScopes(
      (Array.isArray(scopes) ? scopes : []).filter((s: string) => clientScopes.includes(s))
    );
    if (grantedScopes.length === 0) {
      return res.status(400).json({ error: 'No valid scopes to grant' });
    }

    const code = generateSecret(32);
    const codeHash = hashSecret(code);

    await pool.query(
      `INSERT INTO oauth_authorization_codes (code_hash, client_id, user_id, redirect_uri, scopes, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [codeHash, client_id, user.id, redirect_uri, JSON.stringify(grantedScopes), new Date(Date.now() + CODE_TTL_MS)]
    );

    const callback = new URL(redirect_uri);
    callback.searchParams.set('code', code);
    if (state) callback.searchParams.set('state', state);

    return res.json({ success: true, redirect: callback.toString() });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ── Token Exchange ───────────────────────────────────────────────────────────

router.post('/token', async (req: Request, res: Response) => {
  try {
    const { grant_type, code, redirect_uri, client_id, client_secret } = req.body || {};

    if (grant_type !== 'authorization_code') {
      return res.status(400).json({ error: 'unsupported_grant_type', error_description: 'Only authorization_code is supported' });
    }
    if (!code || !redirect_uri || !client_id || !client_secret) {
      return res.status(400).json({ error: 'invalid_request', error_description: 'code, redirect_uri, client_id, and client_secret are required' });
    }

    // Verify client credentials
    const pool = getPool();
    const clientSecretHash = hashSecret(client_secret);
    const { rows: clientRows } = await pool.query(
      `SELECT id, client_id FROM oauth_clients WHERE client_id = $1 AND client_secret_hash = $2 AND enabled = TRUE`,
      [client_id, clientSecretHash]
    );
    if (!clientRows.length) {
      return res.status(401).json({ error: 'invalid_client' });
    }

    // Verify authorization code
    const codeHash = hashSecret(code);
    const { rows: codeRows } = await pool.query(
      `SELECT id, user_id, redirect_uri, scopes, expires_at, redeemed
       FROM oauth_authorization_codes
       WHERE code_hash = $1 AND client_id = $2`,
      [codeHash, client_id]
    );
    if (!codeRows.length) {
      return res.status(400).json({ error: 'invalid_grant', error_description: 'Authorization code not found' });
    }

    const authCode = codeRows[0];
    if (authCode.redeemed) {
      return res.status(400).json({ error: 'invalid_grant', error_description: 'Authorization code already used' });
    }
    if (new Date(authCode.expires_at) < new Date()) {
      return res.status(400).json({ error: 'invalid_grant', error_description: 'Authorization code expired' });
    }
    if (authCode.redirect_uri !== redirect_uri) {
      return res.status(400).json({ error: 'invalid_grant', error_description: 'redirect_uri mismatch' });
    }

    // Verify user's tier still has API access at token exchange time
    const { rows: userRows } = await pool.query(`SELECT tier FROM users WHERE id = $1`, [authCode.user_id]);
    const tokenTier = uiTierFromCanonical(((userRows[0]?.tier || 'observer') as CanonicalTier | LegacyTier));
    if (!TIER_LIMITS[tokenTier]?.hasApiAccess) {
      return res.status(403).json({ error: 'invalid_grant', error_description: 'User plan does not include API access' });
    }

    // Mark code as redeemed
    await pool.query(`UPDATE oauth_authorization_codes SET redeemed = TRUE WHERE id = $1`, [authCode.id]);

    // Issue access token
    const accessToken = `avist_${generateSecret(32)}`;
    const tokenHash = hashSecret(accessToken);
    const expiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_MS);
    const scopes: string[] = typeof authCode.scopes === 'string' ? JSON.parse(authCode.scopes) : authCode.scopes;

    await pool.query(
      `INSERT INTO oauth_tokens (token_hash, client_id, user_id, scopes, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [tokenHash, client_id, authCode.user_id, JSON.stringify(scopes), expiresAt]
    );

    return res.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
      scope: scopes.join(' '),
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'server_error', error_description: 'Internal error' });
  }
});

// ── Token Revocation ─────────────────────────────────────────────────────────

router.post('/revoke', async (req: Request, res: Response) => {
  try {
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ error: 'Token required' });

    const tokenHash = hashSecret(token);
    const pool = getPool();
    await pool.query(`UPDATE oauth_tokens SET revoked = TRUE WHERE token_hash = $1`, [tokenHash]);

    // RFC 7009: always return 200 regardless of whether token existed
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
