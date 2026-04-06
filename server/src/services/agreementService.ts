/**
 * Partnership Agreement Service - dual-party signing, tamper-lock, PDF generation, email delivery.
 *
 * Flow:
 *   1. Agreement created with terms + party info → SHA-256 content hash stored
 *   2. Each party signs within 24h deadline by entering their exact full name
 *   3. After both sign → agreement locked (locked_hash = SHA-256 of all fields)
 *   4. PDF generated server-side and emailed to both parties via Resend
 *   5. Agreement valid for 1 year after lock
 *   6. No edits allowed after lock - any tampering breaks the hash
 */

import crypto from 'crypto';
import { getPool } from './postgresql.js';

/* ── Types ─────────────────────────────────────────────────────────────────── */

export interface AgreementRow {
  id: string;
  slug: string;
  title: string;
  terms_html: string;
  terms_hash: string;
  party_a_name: string;
  party_a_email: string;
  party_a_phone: string | null;
  party_a_org: string | null;
  party_b_name: string;
  party_b_email: string;
  party_b_phone: string | null;
  party_b_org: string | null;
  status: 'pending' | 'partially_signed' | 'fully_signed' | 'expired' | 'revoked';
  valid_until: string | null;
  signing_deadline: string;
  party_a_signed_at: string | null;
  party_a_signature: string | null;
  party_b_signed_at: string | null;
  party_b_signature: string | null;
  locked_at: string | null;
  locked_hash: string | null;
  access_token: string | null;
  otp_code_hash: string | null;
  otp_party: string | null;
  otp_expires_at: string | null;
  otp_attempts: number;
  reminders_sent: number[];
  created_at: string;
  updated_at: string;
}

export interface SignResult {
  ok: boolean;
  error?: string;
  fullyLocked?: boolean;
}

/* ── Content hashing ───────────────────────────────────────────────────────── */

export function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf-8').digest('hex');
}

/* ── Access token & OTP helpers ────────────────────────────────────────────── */

export function generateAccessToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function generateOtp(): string {
  // 6-digit numeric OTP
  return String(crypto.randomInt(100000, 999999));
}

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_OTP_ATTEMPTS = 5;

export async function requestOtp(slug: string, party: 'a' | 'b'): Promise<{ ok: boolean; email?: string; error?: string }> {
  const pool = getPool();
  const agreement = await getAgreementBySlug(slug);
  if (!agreement) return { ok: false, error: 'Agreement not found.' };
  if (agreement.status === 'fully_signed') return { ok: false, error: 'Agreement already fully signed.' };
  if (agreement.status === 'expired') return { ok: false, error: 'Agreement has expired.' };
  if (agreement.status === 'revoked') return { ok: false, error: 'Agreement has been revoked.' };

  const signedField = party === 'a' ? 'party_a_signed_at' : 'party_b_signed_at';
  if (agreement[signedField]) return { ok: false, error: `Party ${party.toUpperCase()} has already signed.` };

  const code = generateOtp();
  const codeHash = hashContent(code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();
  const email = party === 'a' ? agreement.party_a_email : agreement.party_b_email;

  await pool.query(
    `UPDATE partnership_agreements
     SET otp_code_hash = $1, otp_party = $2, otp_expires_at = $3, otp_attempts = 0, updated_at = NOW()
     WHERE slug = $4`,
    [codeHash, party, expiresAt, slug],
  );

  return { ok: true, email, otp: code } as { ok: boolean; email: string; otp: string };
}

export async function verifyOtp(slug: string, party: 'a' | 'b', code: string): Promise<{ ok: boolean; error?: string }> {
  const pool = getPool();
  const agreement = await getAgreementBySlug(slug);
  if (!agreement) return { ok: false, error: 'Agreement not found.' };

  if (agreement.otp_party !== party) return { ok: false, error: 'No OTP requested for this party.' };
  if (!agreement.otp_expires_at || new Date(agreement.otp_expires_at) < new Date()) {
    return { ok: false, error: 'OTP has expired. Please request a new one.' };
  }
  if (agreement.otp_attempts >= MAX_OTP_ATTEMPTS) {
    return { ok: false, error: 'Too many failed attempts. Please request a new OTP.' };
  }

  const codeHash = hashContent(code);
  if (codeHash !== agreement.otp_code_hash) {
    await pool.query(
      `UPDATE partnership_agreements SET otp_attempts = otp_attempts + 1, updated_at = NOW() WHERE slug = $1`,
      [slug],
    );
    return { ok: false, error: 'Invalid OTP code.' };
  }

  // Clear OTP after successful verification
  await pool.query(
    `UPDATE partnership_agreements SET otp_code_hash = NULL, otp_party = NULL, otp_expires_at = NULL, otp_attempts = 0, updated_at = NOW() WHERE slug = $1`,
    [slug],
  );

  return { ok: true };
}

/* ── Referral link helpers ─────────────────────────────────────────────────── */

export async function createReferralLink(slug: string, createdBy?: string): Promise<{ code: string; expires_at: string | null }> {
  const pool = getPool();
  const agreement = await getAgreementBySlug(slug);
  if (!agreement) throw new Error('Agreement not found.');

  const code = crypto.randomBytes(6).toString('base64url'); // ~8 chars
  const expiresAt = agreement.valid_until;

  await pool.query(
    `INSERT INTO agreement_referral_links (agreement_slug, code, created_by, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [slug, code, createdBy ?? null, expiresAt],
  );

  return { code, expires_at: expiresAt };
}

export async function trackReferralVisit(code: string, ip: string, ua: string, referrer?: string): Promise<{ slug: string; access_token: string | null } | null> {
  const pool = getPool();

  const { rows: links } = await pool.query(
    `SELECT * FROM agreement_referral_links WHERE code = $1`,
    [code],
  );
  const link = links[0] as any;
  if (!link) return null;

  if (link.expires_at && new Date(link.expires_at) < new Date()) return null;

  // Track visit
  const visitorHash = hashContent(`${ip}:${ua}`);
  await pool.query(
    `INSERT INTO agreement_referral_visits (link_code, visitor_hash, referrer) VALUES ($1, $2, $3)`,
    [code, visitorHash, referrer ?? null],
  );

  // Increment clicks
  await pool.query(`UPDATE agreement_referral_links SET clicks = clicks + 1 WHERE code = $1`, [code]);

  // Get the agreement access token
  const { rows: agreements } = await pool.query(
    `SELECT slug, access_token FROM partnership_agreements WHERE slug = $1`,
    [link.agreement_slug],
  );
  const agr = agreements[0] as { slug: string; access_token: string | null } | undefined;
  return agr ?? null;
}

export async function getReferralStats(slug: string): Promise<any[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT l.code, l.created_by, l.expires_at, l.clicks, l.created_at,
            (SELECT COUNT(DISTINCT visitor_hash) FROM agreement_referral_visits WHERE link_code = l.code) AS unique_visitors
     FROM agreement_referral_links l
     WHERE l.agreement_slug = $1
     ORDER BY l.created_at DESC`,
    [slug],
  );
  return rows;
}

/* ── Expiry helpers ────────────────────────────────────────────────────────── */

const REMINDER_MILESTONES = [45, 30, 14, 7];

export function getExpiryInfo(agreement: AgreementRow): { days_until_expiry: number | null; expiry_warning: boolean; expiry_milestone: number | null } {
  if (!agreement.valid_until) return { days_until_expiry: null, expiry_warning: false, expiry_milestone: null };

  const now = Date.now();
  const expiry = new Date(agreement.valid_until).getTime();
  const daysLeft = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));

  const milestone = REMINDER_MILESTONES.find(m => daysLeft <= m) ?? null;

  return {
    days_until_expiry: daysLeft,
    expiry_warning: daysLeft <= 7,
    expiry_milestone: milestone,
  };
}

export async function checkAndRecordReminder(slug: string): Promise<{ shouldSend: boolean; milestone: number } | null> {
  const pool = getPool();
  const agreement = await getAgreementBySlug(slug);
  if (!agreement || agreement.status !== 'fully_signed' || !agreement.valid_until) return null;

  const { days_until_expiry } = getExpiryInfo(agreement);
  if (days_until_expiry === null || days_until_expiry > 45 || days_until_expiry <= 0) return null;

  const sent: number[] = Array.isArray(agreement.reminders_sent) ? agreement.reminders_sent : [];
  const dueMilestone = REMINDER_MILESTONES.find(m => days_until_expiry <= m && !sent.includes(m));
  if (!dueMilestone) return null;

  // Record that we've handled this milestone
  const updated = [...sent, dueMilestone];
  await pool.query(
    `UPDATE partnership_agreements SET reminders_sent = $1::jsonb, updated_at = NOW() WHERE slug = $2`,
    [JSON.stringify(updated), slug],
  );

  return { shouldSend: true, milestone: dueMilestone };
}

function buildLockPayload(row: AgreementRow): string {
  return JSON.stringify({
    id: row.id,
    terms_hash: row.terms_hash,
    party_a_name: row.party_a_name,
    party_a_signature: row.party_a_signature,
    party_a_signed_at: row.party_a_signed_at,
    party_b_name: row.party_b_name,
    party_b_signature: row.party_b_signature,
    party_b_signed_at: row.party_b_signed_at,
  });
}

/* ── Fetch ─────────────────────────────────────────────────────────────────── */

export async function getAgreementBySlug(slug: string): Promise<AgreementRow | null> {
  const pool = getPool();
  const { rows } = await pool.query('SELECT * FROM partnership_agreements WHERE slug = $1', [slug]);
  const row = (rows[0] as AgreementRow) ?? null;
  if (!row) return null;

  // Auto-expire: if valid_until has passed and status is still fully_signed, flip to expired
  if (
    row.status === 'fully_signed' &&
    row.valid_until &&
    new Date(row.valid_until) < new Date()
  ) {
    await pool.query(
      `UPDATE partnership_agreements SET status = 'expired', updated_at = NOW() WHERE slug = $1 AND status = 'fully_signed'`,
      [slug],
    );
    row.status = 'expired';
  }

  // Auto-expire: if signing deadline passed and still pending/partially_signed
  if (
    (row.status === 'pending' || row.status === 'partially_signed') &&
    row.signing_deadline &&
    new Date(row.signing_deadline) < new Date()
  ) {
    await pool.query(
      `UPDATE partnership_agreements SET status = 'expired', updated_at = NOW() WHERE slug = $1 AND status IN ('pending', 'partially_signed')`,
      [slug],
    );
    row.status = 'expired';
  }

  return row;
}

/* ── Create ────────────────────────────────────────────────────────────────── */

export interface CreateAgreementInput {
  slug: string;
  title: string;
  termsHtml: string;
  partyA: { name: string; email: string; phone?: string; org?: string };
  partyB: { name: string; email: string; phone?: string; org?: string };
  signingDeadlineHours?: number; // default 24
}

export async function createAgreement(input: CreateAgreementInput): Promise<AgreementRow> {
  const pool = getPool();
  const termsHash = hashContent(input.termsHtml);
  const deadlineHours = input.signingDeadlineHours ?? 24;
  const deadline = new Date(Date.now() + deadlineHours * 60 * 60 * 1000).toISOString();
  const accessToken = generateAccessToken();

  const { rows } = await pool.query(
    `INSERT INTO partnership_agreements
      (slug, title, terms_html, terms_hash,
       party_a_name, party_a_email, party_a_phone, party_a_org,
       party_b_name, party_b_email, party_b_phone, party_b_org,
       signing_deadline, status, access_token)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'pending',$14)
     ON CONFLICT (slug) DO UPDATE SET
       title = EXCLUDED.title,
       terms_html = EXCLUDED.terms_html,
       terms_hash = EXCLUDED.terms_hash,
       party_a_name = EXCLUDED.party_a_name,
       party_a_email = EXCLUDED.party_a_email,
       party_a_phone = EXCLUDED.party_a_phone,
       party_a_org = EXCLUDED.party_a_org,
       party_b_name = EXCLUDED.party_b_name,
       party_b_email = EXCLUDED.party_b_email,
       party_b_phone = EXCLUDED.party_b_phone,
       party_b_org = EXCLUDED.party_b_org,
       signing_deadline = EXCLUDED.signing_deadline,
       access_token = COALESCE(partnership_agreements.access_token, EXCLUDED.access_token),
       updated_at = NOW()
     WHERE partnership_agreements.status = 'pending'
     RETURNING *`,
    [
      input.slug, input.title, input.termsHtml, termsHash,
      input.partyA.name, input.partyA.email, input.partyA.phone ?? null, input.partyA.org ?? null,
      input.partyB.name, input.partyB.email, input.partyB.phone ?? null, input.partyB.org ?? null,
      deadline, accessToken,
    ],
  );
  return rows[0] as AgreementRow;
}

/* ── Sign ──────────────────────────────────────────────────────────────────── */

export async function signAgreement(
  slug: string,
  party: 'a' | 'b',
  signature: string,
  ip: string,
  userAgent: string,
): Promise<SignResult> {
  const pool = getPool();
  const agreement = await getAgreementBySlug(slug);

  if (!agreement) return { ok: false, error: 'Agreement not found.' };

  // Already fully locked
  if (agreement.status === 'fully_signed') return { ok: false, error: 'Agreement already fully signed and locked.' };
  if (agreement.status === 'expired') return { ok: false, error: 'Signing deadline has passed.' };
  if (agreement.status === 'revoked') return { ok: false, error: 'Agreement has been revoked.' };

  // Check deadline
  if (new Date(agreement.signing_deadline) < new Date()) {
    await pool.query(
      `UPDATE partnership_agreements SET status = 'expired', updated_at = NOW() WHERE slug = $1`,
      [slug],
    );
    return { ok: false, error: 'Signing deadline has passed.' };
  }

  // Validate exact name match
  const expectedName = party === 'a' ? agreement.party_a_name : agreement.party_b_name;
  if (signature.trim() !== expectedName.trim()) {
    return { ok: false, error: `Signature must exactly match your full legal name: "${expectedName}".` };
  }

  // Already signed this party
  const signedField = party === 'a' ? 'party_a_signed_at' : 'party_b_signed_at';
  if (agreement[signedField]) return { ok: false, error: `Party ${party.toUpperCase()} has already signed.` };

  // Record signature
  const now = new Date().toISOString();
  const col = party === 'a' ? 'party_a' : 'party_b';
  await pool.query(
    `UPDATE partnership_agreements
     SET ${col}_signature = $1, ${col}_signed_at = $2, ${col}_ip = $3, ${col}_ua = $4,
         status = CASE
           WHEN ${party === 'a' ? 'party_b' : 'party_a'}_signed_at IS NOT NULL THEN 'fully_signed'
           ELSE 'partially_signed'
         END,
         updated_at = NOW()
     WHERE slug = $5`,
    [signature, now, ip, userAgent, slug],
  );

  // Check if now fully signed
  const updated = await getAgreementBySlug(slug);
  if (updated && updated.status === 'fully_signed') {
    // Lock the agreement
    const lockedHash = hashContent(buildLockPayload(updated));
    const validUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    await pool.query(
      `UPDATE partnership_agreements
       SET locked_at = NOW(), locked_hash = $1, valid_until = $2, updated_at = NOW()
       WHERE slug = $3`,
      [lockedHash, validUntil, slug],
    );
    return { ok: true, fullyLocked: true };
  }

  return { ok: true, fullyLocked: false };
}

/* ── Integrity verification ────────────────────────────────────────────────── */

export async function verifyIntegrity(slug: string): Promise<{ valid: boolean; reason?: string }> {
  const agreement = await getAgreementBySlug(slug);
  if (!agreement) return { valid: false, reason: 'Agreement not found.' };
  if (agreement.status !== 'fully_signed') return { valid: false, reason: `Agreement status is "${agreement.status}".` };
  if (!agreement.locked_hash) return { valid: false, reason: 'Agreement not locked.' };

  const expectedHash = hashContent(buildLockPayload(agreement));
  if (expectedHash !== agreement.locked_hash) {
    return { valid: false, reason: 'TAMPER DETECTED - lock hash does not match stored fields.' };
  }

  const termsHash = hashContent(agreement.terms_html);
  if (termsHash !== agreement.terms_hash) {
    return { valid: false, reason: 'TAMPER DETECTED - terms content has been modified after creation.' };
  }

  if (agreement.valid_until && new Date(agreement.valid_until) < new Date()) {
    return { valid: false, reason: 'Agreement has expired.' };
  }

  return { valid: true };
}

/* ── PDF generation (pure HTML → PDF via Puppeteer-free approach) ──────────── */

export function generateAgreementHtml(agreement: AgreementRow): string {
  const lockDate = agreement.locked_at ? new Date(agreement.locked_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';
  const validUntil = agreement.valid_until ? new Date(agreement.valid_until).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';
  const partyADate = agreement.party_a_signed_at ? new Date(agreement.party_a_signed_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }) : 'Not signed';
  const partyBDate = agreement.party_b_signed_at ? new Date(agreement.party_b_signed_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }) : 'Not signed';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(agreement.title)}</title>
<style>
  body { font-family: 'Segoe UI', system-ui, sans-serif; color: #1a1a2e; max-width: 800px; margin: 0 auto; padding: 40px 32px; line-height: 1.6; }
  h1 { font-size: 24px; border-bottom: 2px solid #0891b2; padding-bottom: 12px; }
  h2 { font-size: 18px; margin-top: 28px; }
  .meta { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; margin: 20px 0; }
  .meta p { margin: 4px 0; font-size: 14px; }
  .sig-block { display: flex; gap: 32px; margin-top: 32px; }
  .sig-box { flex: 1; border: 1px solid #d1d5db; border-radius: 8px; padding: 20px; }
  .sig-box h3 { margin: 0 0 12px; font-size: 14px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.08em; }
  .sig-name { font-size: 18px; font-weight: 600; margin-bottom: 8px; }
  .sig-line { border-bottom: 1px solid #9ca3af; height: 24px; margin-bottom: 8px; font-style: italic; color: #374151; }
  .sig-date { font-size: 13px; color: #6b7280; }
  .integrity { background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 16px; margin-top: 32px; }
  .integrity h3 { margin: 0 0 8px; color: #166534; }
  .integrity code { font-size: 11px; word-break: break-all; display: block; background: #fff; padding: 8px; border-radius: 4px; margin-top: 4px; }
  .footer { margin-top: 40px; font-size: 12px; color: #9ca3af; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 16px; }
</style>
</head>
<body>
<h1>${escapeHtml(agreement.title)}</h1>

<div class="meta">
  <p><strong>Agreement ID:</strong> ${escapeHtml(agreement.id)}</p>
  <p><strong>Executed:</strong> ${lockDate}</p>
  <p><strong>Valid until:</strong> ${validUntil}</p>
  <p><strong>Party A:</strong> ${escapeHtml(agreement.party_a_name)} (${escapeHtml(agreement.party_a_org ?? '')}) - ${escapeHtml(agreement.party_a_email)}</p>
  <p><strong>Party B:</strong> ${escapeHtml(agreement.party_b_name)} (${escapeHtml(agreement.party_b_org ?? '')}) - ${escapeHtml(agreement.party_b_email)}</p>
</div>

${agreement.terms_html}

<div class="sig-block">
  <div class="sig-box">
    <h3>Party A</h3>
    <div class="sig-name">${escapeHtml(agreement.party_a_name)}</div>
    <div class="sig-line">${escapeHtml(agreement.party_a_signature ?? '')}</div>
    <div class="sig-date">${partyADate}</div>
  </div>
  <div class="sig-box">
    <h3>Party B</h3>
    <div class="sig-name">${escapeHtml(agreement.party_b_name)}</div>
    <div class="sig-line">${escapeHtml(agreement.party_b_signature ?? '')}</div>
    <div class="sig-date">${partyBDate}</div>
  </div>
</div>

<div class="integrity">
  <h3>Tamper-proof integrity record</h3>
  <p>This agreement was digitally signed and locked. Any modification after execution will invalidate the integrity hash below.</p>
  <code>Terms hash (SHA-256): ${escapeHtml(agreement.terms_hash)}</code>
  <code>Lock hash (SHA-256): ${escapeHtml(agreement.locked_hash ?? 'N/A')}</code>
</div>

<div class="footer">
  <p>AiVIS Partnership Agreement - Generated ${new Date().toISOString()}</p>
  <p>This document is a machine-verifiable signed copy. Verify integrity at https://aivis.biz/partnership-terms/${escapeHtml(agreement.slug)}</p>
</div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
