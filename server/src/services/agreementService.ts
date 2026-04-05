/**
 * Partnership Agreement Service — dual-party signing, tamper-lock, PDF generation, email delivery.
 *
 * Flow:
 *   1. Agreement created with terms + party info → SHA-256 content hash stored
 *   2. Each party signs within 24h deadline by entering their exact full name
 *   3. After both sign → agreement locked (locked_hash = SHA-256 of all fields)
 *   4. PDF generated server-side and emailed to both parties via Resend
 *   5. Agreement valid for 1 year after lock
 *   6. No edits allowed after lock — any tampering breaks the hash
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
  return (rows[0] as AgreementRow) ?? null;
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

  const { rows } = await pool.query(
    `INSERT INTO partnership_agreements
      (slug, title, terms_html, terms_hash,
       party_a_name, party_a_email, party_a_phone, party_a_org,
       party_b_name, party_b_email, party_b_phone, party_b_org,
       signing_deadline, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'pending')
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
       updated_at = NOW()
     WHERE partnership_agreements.status = 'pending'
     RETURNING *`,
    [
      input.slug, input.title, input.termsHtml, termsHash,
      input.partyA.name, input.partyA.email, input.partyA.phone ?? null, input.partyA.org ?? null,
      input.partyB.name, input.partyB.email, input.partyB.phone ?? null, input.partyB.org ?? null,
      deadline,
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
    return { valid: false, reason: 'TAMPER DETECTED — lock hash does not match stored fields.' };
  }

  const termsHash = hashContent(agreement.terms_html);
  if (termsHash !== agreement.terms_hash) {
    return { valid: false, reason: 'TAMPER DETECTED — terms content has been modified after creation.' };
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
  <p><strong>Party A:</strong> ${escapeHtml(agreement.party_a_name)} (${escapeHtml(agreement.party_a_org ?? '')}) — ${escapeHtml(agreement.party_a_email)}</p>
  <p><strong>Party B:</strong> ${escapeHtml(agreement.party_b_name)} (${escapeHtml(agreement.party_b_org ?? '')}) — ${escapeHtml(agreement.party_b_email)}</p>
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
  <p>AiVIS Partnership Agreement — Generated ${new Date().toISOString()}</p>
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
