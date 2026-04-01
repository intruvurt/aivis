import { createHmac, randomUUID } from 'node:crypto';
import type { Request } from 'express';

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo';
const OAUTH_FETCH_TIMEOUT_MS = 15_000;

const GSC_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/webmasters.readonly',
];

function getOAuthConfig() {
  const clientId = process.env.GSC_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GSC_GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '';
  const stateSecret = process.env.GSC_OAUTH_STATE_SECRET || process.env.JWT_SECRET || '';

  if (!clientId || !clientSecret || !stateSecret) {
    throw new Error('GSC OAuth is not configured (set GSC_GOOGLE_CLIENT_ID, GSC_GOOGLE_CLIENT_SECRET, and GSC_OAUTH_STATE_SECRET/JWT_SECRET)');
  }

  return { clientId, clientSecret, stateSecret };
}

function normalizeOrigin(url: string): string {
  return String(url || '').trim().replace(/\/+$/, '');
}

function getApiBase(req?: Request): string {
  const explicit = normalizeOrigin(process.env.GSC_BACKEND_URL || process.env.BACKEND_URL || process.env.API_URL || process.env.VITE_API_URL || '');
  if (explicit) return explicit;

  if (req) {
    const forwardedProto = String(req.get('x-forwarded-proto') || '').split(',')[0]?.trim();
    const forwardedHost = String(req.get('x-forwarded-host') || '').split(',')[0]?.trim();
    const host = forwardedHost || req.get('host') || '';
    const proto = forwardedProto || req.protocol || 'http';
    if (host) return normalizeOrigin(`${proto}://${host}`);
  }

  return `http://localhost:${process.env.PORT || 10000}`;
}

function getFrontendBase(req?: Request): string {
  const explicit = normalizeOrigin(process.env.GSC_FRONTEND_URL || process.env.FRONTEND_URL || process.env.CLIENT_URL || '');
  if (explicit) return explicit;

  if (req) {
    const forwardedProto = String(req.get('x-forwarded-proto') || '').split(',')[0]?.trim();
    const forwardedHost = String(req.get('x-forwarded-host') || '').split(',')[0]?.trim();
    const host = forwardedHost || req.get('host') || '';
    const proto = forwardedProto || req.protocol || 'http';
    if (host) return normalizeOrigin(`${proto}://${host}`);
  }

  return 'http://localhost:5173';
}

function getCallbackUrl(req?: Request): string {
  const explicit = normalizeOrigin(process.env.GSC_OAUTH_CALLBACK_URL || '');
  if (explicit) return explicit;
  return `${getApiBase(req)}/api/integrations/gsc/oauth/callback`;
}

function signStatePayload(payloadBase64: string, secret: string): string {
  return createHmac('sha256', secret).update(payloadBase64).digest('base64url');
}

export function buildOAuthState(userId: string): string {
  const { stateSecret } = getOAuthConfig();
  const payload = {
    userId,
    nonce: randomUUID(),
    ts: Date.now(),
  };
  const base = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = signStatePayload(base, stateSecret);
  return `${base}.${sig}`;
}

export function verifyOAuthState(state: string): { userId: string } {
  const { stateSecret } = getOAuthConfig();
  const [base, sig] = String(state || '').split('.');
  if (!base || !sig) throw new Error('Invalid OAuth state');

  const expected = signStatePayload(base, stateSecret);
  if (expected !== sig) throw new Error('OAuth state signature mismatch');

  const payload = JSON.parse(Buffer.from(base, 'base64url').toString('utf8')) as { userId?: string; ts?: number };
  if (!payload.userId || !payload.ts) throw new Error('OAuth state payload invalid');
  if (Date.now() - payload.ts > 15 * 60 * 1000) throw new Error('OAuth state expired');

  return { userId: payload.userId };
}

export function buildGoogleAuthUrl(userId: string, req?: Request): string {
  const { clientId } = getOAuthConfig();
  const callbackUrl = getCallbackUrl(req);
  const state = buildOAuthState(userId);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    scope: GSC_SCOPES.join(' '),
    state,
  });
  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string, req?: Request): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date | null }> {
  const { clientId, clientSecret } = getOAuthConfig();
  const callbackUrl = getCallbackUrl(req);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OAUTH_FETCH_TIMEOUT_MS);
  let response: Response;
  try {
  response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    signal: controller.signal,
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: callbackUrl,
      grant_type: 'authorization_code',
    }),
  });
  } finally { clearTimeout(timer); }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to exchange Google OAuth code (${response.status}): ${text}`);
  }

  const data = await response.json() as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  if (!data.access_token) throw new Error('Google token response missing access_token');
  if (!data.refresh_token) throw new Error('Google token response missing refresh_token (re-consent required)');

  const expiresAt = Number.isFinite(Number(data.expires_in))
    ? new Date(Date.now() + Number(data.expires_in) * 1000)
    : null;

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
  };
}

export async function refreshGoogleAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: Date | null }> {
  const { clientId, clientSecret } = getOAuthConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OAUTH_FETCH_TIMEOUT_MS);
  let response: Response;
  try {
  response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    signal: controller.signal,
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  });
  } finally { clearTimeout(timer); }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to refresh Google token (${response.status}): ${text}`);
  }

  const data = await response.json() as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error('Google refresh response missing access_token');

  const expiresAt = Number.isFinite(Number(data.expires_in))
    ? new Date(Date.now() + Number(data.expires_in) * 1000)
    : null;

  return { accessToken: data.access_token, expiresAt };
}

export async function getGoogleProfile(accessToken: string): Promise<{ email: string; sub: string; name?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OAUTH_FETCH_TIMEOUT_MS);
  let response: Response;
  try {
  response = await fetch(GOOGLE_USERINFO_ENDPOINT, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    signal: controller.signal,
  });
  } finally { clearTimeout(timer); }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch Google profile (${response.status}): ${text}`);
  }

  const profile = await response.json() as { email?: string; sub?: string; name?: string };
  if (!profile.email || !profile.sub) {
    throw new Error('Google profile response missing email/sub');
  }

  return { email: profile.email, sub: profile.sub, name: profile.name };
}

export function getGscFrontendSuccessUrl(req?: Request): string {
  return `${getFrontendBase(req)}/gsc?gsc=connected`;
}

export function getGscFrontendErrorUrl(message: string, req?: Request): string {
  const base = `${getFrontendBase(req)}/gsc`;
  const params = new URLSearchParams({ gsc: 'error', message });
  return `${base}?${params.toString()}`;
}
