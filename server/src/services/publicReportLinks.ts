import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { getPool } from './postgresql.js';

const FRONTEND_URL = (process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || 'https://aivis.biz')
  .split(',')[0]
  .trim()
  .replace(/\/+$/, '');
const PUBLIC_REPORT_SIGNING_SECRET = process.env.PUBLIC_REPORT_SIGNING_SECRET || process.env.JWT_SECRET || '';

export type PublicReportTokenPayload = {
  auditId: string;
  exp: number;
};

function normalizeShareLinkExpirationDays(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (numeric === 0 || numeric === 7 || numeric === 14 || numeric === 30 || numeric === 90) return numeric;
  return 30;
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function getPublicReportCipherKey(): Buffer {
  return createHash('sha256').update(PUBLIC_REPORT_SIGNING_SECRET).digest();
}

function slugify(input: string): string {
  return String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 96);
}

function extractDomainSlug(targetUrl: string): string {
  try {
    const parsed = new URL(/^https?:\/\//i.test(targetUrl) ? targetUrl : `https://${targetUrl}`);
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const parts = hostname.split('.').filter(Boolean);
    const base = parts.length >= 2 ? parts[parts.length - 2] : hostname;
    return slugify(base);
  } catch {
    return '';
  }
}

function buildBaseSlug(targetUrl: string, scanOrdinal?: number): string {
  const domainSlug = extractDomainSlug(targetUrl);
  const base = domainSlug ? `${domainSlug}-ai-visibility-audit` : 'evidence-backed-visibility-analysis';
  if (!scanOrdinal || scanOrdinal <= 1) return base;
  return `${base}-scan-${scanOrdinal}`;
}

async function generateUniqueSlug(targetUrl: string, scanOrdinal?: number): Promise<string> {
  const pool = getPool();
  const baseSlug = buildBaseSlug(targetUrl, scanOrdinal);
  const attempts = [
    baseSlug,
    `${baseSlug}-${randomBytes(2).toString('hex')}`,
    `${baseSlug}-${randomBytes(3).toString('hex')}`,
  ];

  for (const candidate of attempts) {
    const { rows } = await pool.query(
      `SELECT 1 FROM public_report_links WHERE slug = $1 LIMIT 1`,
      [candidate]
    );
    if (!rows[0]) {
      return candidate;
    }
  }

  return `${baseSlug}-${randomBytes(4).toString('hex')}`;
}

export async function getShareLinkExpirationDaysPreference(userId: string): Promise<number> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT share_link_expiration_days
     FROM user_notification_preferences
     WHERE user_id = $1
     LIMIT 1`,
    [userId]
  );
  return normalizeShareLinkExpirationDays(rows[0]?.share_link_expiration_days);
}

export function signPublicReportToken(payload: PublicReportTokenPayload): string {
  const iv = randomBytes(12);
  const key = getPublicReportCipherKey();
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const plaintext = JSON.stringify(payload);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64url');
}

function verifyLegacyPublicReportToken(token: string): PublicReportTokenPayload | null {
  const [payloadPart, signaturePart] = token.split('.');
  if (!payloadPart || !signaturePart) return null;

  const expectedSig = createHmac('sha256', PUBLIC_REPORT_SIGNING_SECRET).update(payloadPart).digest('base64url');
  const actual = Buffer.from(signaturePart);
  const expected = Buffer.from(expectedSig);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  const payload = JSON.parse(base64UrlDecode(payloadPart)) as PublicReportTokenPayload;
  if (!payload?.auditId || typeof payload.auditId !== 'string') return null;
  if (!payload?.exp || typeof payload.exp !== 'number') return null;
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export function verifyPublicReportToken(token: string): PublicReportTokenPayload | null {
  try {
    if (token.includes('.')) {
      return verifyLegacyPublicReportToken(token);
    }

    const key = getPublicReportCipherKey();
    const blob = Buffer.from(token, 'base64url');
    if (blob.length < 29) return null;

    const iv = blob.subarray(0, 12);
    const tag = blob.subarray(12, 28);
    const ciphertext = blob.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    const payload = JSON.parse(plaintext) as PublicReportTokenPayload;
    if (!payload?.auditId || typeof payload.auditId !== 'string') return null;
    if (!payload?.exp || typeof payload.exp !== 'number') return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function createOrRefreshPublicReportLink(args: {
  auditId: string;
  userId: string;
  workspaceId?: string | null;
  targetUrl: string;
  scanOrdinal?: number;
  shareLinkExpirationDays?: number;
}): Promise<{
  token: string;
  slug: string;
  expiresAt: string;
  sharePath: string;
  legacySharePath: string;
  publicUrl: string;
  shareLinkExpirationDays: number;
}> {
  if (!PUBLIC_REPORT_SIGNING_SECRET) {
    throw new Error('Public report signing secret is not configured');
  }

  const shareLinkExpirationDays = args.shareLinkExpirationDays ?? await getShareLinkExpirationDaysPreference(args.userId);
  const ageSecs = shareLinkExpirationDays === 0
    ? 60 * 60 * 24 * 3650
    : Math.min(Math.max(1, shareLinkExpirationDays), 365) * 60 * 60 * 24;
  const exp = Math.floor(Date.now() / 1000) + ageSecs;
  const token = signPublicReportToken({ auditId: args.auditId, exp });
  const expiresAt = new Date(exp * 1000).toISOString();
  const pool = getPool();

  const { rows: existingRows } = await pool.query(
    `SELECT slug FROM public_report_links WHERE audit_id = $1 LIMIT 1`,
    [args.auditId]
  );

  const slug = String(existingRows[0]?.slug || await generateUniqueSlug(args.targetUrl, args.scanOrdinal));

  await pool.query(
    `INSERT INTO public_report_links (
       audit_id, user_id, workspace_id, slug, public_token, expires_at, is_active
     ) VALUES ($1, $2, $3, $4, $5, $6, TRUE)
     ON CONFLICT (audit_id)
     DO UPDATE SET
       user_id = EXCLUDED.user_id,
       workspace_id = EXCLUDED.workspace_id,
       public_token = EXCLUDED.public_token,
       expires_at = EXCLUDED.expires_at,
       is_active = TRUE,
       updated_at = NOW()`,
    [args.auditId, args.userId, args.workspaceId || null, slug, token, expiresAt]
  );

  const sharePath = `/reports/public/${slug}`;
  return {
    token,
    slug,
    expiresAt,
    sharePath,
    legacySharePath: `/report/public/${token}`,
    publicUrl: `${FRONTEND_URL}${sharePath}`,
    shareLinkExpirationDays,
  };
}

export async function resolvePublicReportReference(reference: string): Promise<{
  auditId: string;
  slug: string | null;
  expiresAt: string | null;
  resolvedBy: 'token' | 'slug';
} | null> {
  const decoded = verifyPublicReportToken(reference);
  if (decoded) {
    return {
      auditId: decoded.auditId,
      slug: null,
      expiresAt: new Date(decoded.exp * 1000).toISOString(),
      resolvedBy: 'token',
    };
  }

  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT audit_id, slug, expires_at
     FROM public_report_links
     WHERE slug = $1 AND is_active = TRUE
     LIMIT 1`,
    [reference]
  );

  const match = rows[0];
  if (!match?.audit_id) return null;

  const expiresAt = match.expires_at ? new Date(match.expires_at).toISOString() : null;
  if (expiresAt && new Date(expiresAt).getTime() < Date.now()) {
    return null;
  }

  await pool.query(
    `UPDATE public_report_links
     SET last_accessed_at = NOW(), updated_at = NOW()
     WHERE slug = $1`,
    [reference]
  ).catch(() => undefined);

  return {
    auditId: String(match.audit_id),
    slug: String(match.slug || reference),
    expiresAt,
    resolvedBy: 'slug',
  };
}