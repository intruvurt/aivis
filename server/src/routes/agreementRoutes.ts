/**
 * Partnership agreement routes - signing, verification, export, and email delivery.
 *
 * Access model:
 *   - invite token gates agreement access
 *   - party email must match one of the agreement signers for protected actions
 *   - OTP is required before signing
 *
 * Protected endpoints:
 *   GET  /api/agreements/:slug          - view agreement status + terms
 *   POST /api/agreements/:slug/request-otp - send OTP to authorized signer email
 *   POST /api/agreements/:slug/sign     - sign as the authorized party
 *   GET  /api/agreements/:slug/verify   - tamper-proof integrity check
 *   GET  /api/agreements/:slug/export   - download signed HTML copy
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { getPool } from '../services/postgresql.js';
import {
  getPayPalAccessToken,
} from '../services/paypalService.js';
import {
  getAgreementBySlug,
  signAgreement,
  verifyIntegrity,
  generateAgreementHtml,
  createAgreement,
  hashContent,
  requestOtp,
  verifyOtp,
  createReferralLink,
  trackReferralVisit,
  getReferralStats,
  getExpiryInfo,
  checkAndRecordReminder,
} from '../services/agreementService.js';

const router = Router();

/** Timing-safe admin key check to prevent timing attacks */
function isValidAdminKey(key: string | undefined): boolean {
  const expected = process.env.ADMIN_KEY;
  if (!key || !expected) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(key), Buffer.from(expected));
  } catch {
    return false;
  }
}

const FRONTEND_URL = (process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || 'https://aivis.biz')
  .split(',')[0].trim().replace(/\/+$/, '');

function normalizeEmail(value: string | undefined): string | null {
  const trimmed = String(value || '').trim().toLowerCase();
  return trimmed || null;
}

function getAgreementAccessParams(req: Request): { token: string | null; email: string | null } {
  const body = (req.body || {}) as Record<string, unknown>;
  return {
    token: String(req.query.token || body.token || '').trim() || null,
    email: normalizeEmail((req.query.email as string | undefined) || (body.email as string | undefined)),
  };
}

function canAccessAgreement(agreement: Awaited<ReturnType<typeof getAgreementBySlug>>, token: string | null, email: string | null): boolean {
  if (!agreement) return false;
  if (agreement.access_token && token !== agreement.access_token) return false;
  const partyAEmail = normalizeEmail(agreement.party_a_email);
  const partyBEmail = normalizeEmail(agreement.party_b_email);
  if (!email || (email !== partyAEmail && email !== partyBEmail)) return false;
  return true;
}

function getAuthorizedParty(agreement: NonNullable<Awaited<ReturnType<typeof getAgreementBySlug>>>, email: string | null): 'a' | 'b' | null {
  const normalized = normalizeEmail(email || undefined);
  if (!normalized) return null;
  if (normalized === normalizeEmail(agreement.party_a_email)) return 'a';
  if (normalized === normalizeEmail(agreement.party_b_email)) return 'b';
  return null;
}

/* ── GET /:slug - view agreement (gated by access token + party email) ──────── */
router.get('/:slug', async (req: Request, res: Response) => {
  try {
    const agreement = await getAgreementBySlug(req.params.slug as string);
    if (!agreement) return res.status(404).json({ error: 'Agreement not found.' });

    const { token, email } = getAgreementAccessParams(req);
    if (!agreement.access_token || token !== agreement.access_token) {
      return res.status(403).json({ error: 'Access denied. A valid access token is required.' });
    }

    if (!canAccessAgreement(agreement, token, email)) {
      return res.status(403).json({
        error: 'Access denied. A valid party email is required.',
        email_required: true,
      });
    }

    // Lazy expiry reminder check (fire-and-forget)
    checkAndRecordReminder(agreement.slug).then((result) => {
      if (result?.shouldSend) {
        sendExpiryReminder(agreement.slug, result.milestone).catch((err) =>
          console.error('[Agreements] Expiry reminder error:', err),
        );
      }
    }).catch(() => { });

    // Compute expiry info
    const expiryInfo = getExpiryInfo(agreement);

    // Never expose IP/UA forensics to the public
    const safeView = {
      id: agreement.id,
      slug: agreement.slug,
      title: agreement.title,
      terms_html: agreement.terms_html,
      terms_hash: agreement.terms_hash,
      party_a_name: agreement.party_a_name,
      party_a_org: agreement.party_a_org,
      party_a_phone: agreement.party_a_phone,
      party_b_name: agreement.party_b_name,
      party_b_org: agreement.party_b_org,
      party_b_phone: agreement.party_b_phone,
      status: agreement.status,
      signing_deadline: agreement.signing_deadline,
      valid_until: agreement.valid_until,
      party_a_signed_at: agreement.party_a_signed_at,
      party_a_signature: agreement.party_a_signature,
      party_b_signed_at: agreement.party_b_signed_at,
      party_b_signature: agreement.party_b_signature,
      locked_at: agreement.locked_at,
      locked_hash: agreement.locked_hash,
      created_at: agreement.created_at,
      // Expiry info for client banner
      days_until_expiry: expiryInfo.days_until_expiry,
      expiry_warning: expiryInfo.expiry_warning,
    };

    return res.json(safeView);
  } catch (err) {
    console.error('[Agreements] GET error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/* ── POST /:slug/request-otp - send email verification code ────────────────── */
const otpSchema = z.object({
  party: z.enum(['a', 'b']),
  token: z.string().min(8),
  email: z.string().email(),
});

/** In-memory OTP rate limit: max 3 requests per email per 15 minutes */
const otpRateMap = new Map<string, number[]>();
const OTP_RATE_WINDOW_MS = 15 * 60 * 1000;
const OTP_RATE_MAX = 3;

function isOtpRateLimited(email: string): boolean {
  const now = Date.now();
  const key = email.toLowerCase();
  const timestamps = (otpRateMap.get(key) || []).filter(t => now - t < OTP_RATE_WINDOW_MS);
  if (timestamps.length >= OTP_RATE_MAX) {
    otpRateMap.set(key, timestamps);
    return true;
  }
  timestamps.push(now);
  otpRateMap.set(key, timestamps);
  return false;
}

router.post('/:slug/request-otp', async (req: Request, res: Response) => {
  try {
    const parsed = otpSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Provide party ("a" or "b").' });
    }

    // Per-email rate limit: 3 OTP requests per 15 min window
    if (isOtpRateLimited(parsed.data.email)) {
      return res.status(429).json({ error: 'Too many OTP requests. Please wait 15 minutes before trying again.' });
    }

    const agreement = await getAgreementBySlug(req.params.slug as string);
    if (!agreement) return res.status(404).json({ error: 'Agreement not found.' });

    if (!canAccessAgreement(agreement, parsed.data.token, normalizeEmail(parsed.data.email))) {
      return res.status(403).json({ error: 'Access denied. Valid agreement token and party email required.' });
    }

    const authorizedParty = getAuthorizedParty(agreement, parsed.data.email);
    if (authorizedParty !== parsed.data.party) {
      return res.status(403).json({ error: 'Selected signing party does not match the verified email for this agreement.' });
    }

    const result = await requestOtp(req.params.slug as string, parsed.data.party);
    if (!result.ok) return res.status(400).json({ error: result.error });

    // Send OTP email — awaited so we can surface delivery failures to the user
    const otpResult = result as { ok: boolean; email: string; otp: string };
    try {
      await sendOtpEmail(otpResult.email, otpResult.otp, req.params.slug as string, parsed.data.party);
    } catch (err) {
      console.error('[Agreements] OTP email delivery failed:', err);
      return res.status(502).json({ error: 'Failed to send verification email. Please try again in a moment, or contact support@aivis.biz.' });
    }

    // Mask email for response
    const parts = otpResult.email.split('@');
    const masked = parts[0].slice(0, 2) + '***@' + parts[1];

    return res.json({ sent: true, email: masked, expires_in_seconds: 600 });
  } catch (err) {
    console.error('[Agreements] OTP request error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/* ── POST /:slug/sign - sign the agreement (OTP required) ─────────────────── */
const signSchema = z.object({
  party: z.enum(['a', 'b']),
  signature: z.string().min(2).max(200),
  otp: z.string().length(6),
  token: z.string().min(8),
  email: z.string().email(),
});

router.post('/:slug/sign', async (req: Request, res: Response) => {
  try {
    const parsed = signSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Provide party, signature (full legal name), and 6-digit OTP code.' });
    }

    const { party, signature, otp } = parsed.data;

    const agreement = await getAgreementBySlug(req.params.slug as string);
    if (!agreement) return res.status(404).json({ error: 'Agreement not found.' });

    if (!canAccessAgreement(agreement, parsed.data.token, normalizeEmail(parsed.data.email))) {
      return res.status(403).json({ error: 'Access denied. Valid agreement token and party email required.' });
    }

    const authorizedParty = getAuthorizedParty(agreement, parsed.data.email);
    if (authorizedParty !== party) {
      return res.status(403).json({ error: 'Selected signing party does not match the verified email for this agreement.' });
    }

    // Verify OTP first
    const otpCheck = await verifyOtp(req.params.slug as string, party, otp);
    if (!otpCheck.ok) {
      return res.status(400).json({ error: otpCheck.error });
    }

    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
    const ua = (req.headers['user-agent'] as string) || 'unknown';

    const result = await signAgreement(req.params.slug as string, party, signature, ip, ua);

    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }

    // If fully locked, send confirmation emails to both parties
    if (result.fullyLocked) {
      sendSignedCopies(req.params.slug as string).catch((err) =>
        console.error('[Agreements] Email delivery error:', err),
      );
    }

    return res.json({
      signed: true,
      fully_locked: result.fullyLocked ?? false,
      message: result.fullyLocked
        ? 'Agreement fully signed and locked. Signed copies are being sent to both parties.'
        : 'Signature recorded. Waiting for the other party to sign.',
    });
  } catch (err) {
    console.error('[Agreements] Sign error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/* ── GET /:slug/verify - integrity check ───────────────────────────────────── */
router.get('/:slug/verify', async (req: Request, res: Response) => {
  try {
    const agreement = await getAgreementBySlug(req.params.slug as string);
    if (!agreement) {
      return res.json({
        found: false, locked: false, terms_intact: false, lock_intact: false,
        status: 'not_found',
      });
    }

    const { token, email } = getAgreementAccessParams(req);
    if (!canAccessAgreement(agreement, token, email)) {
      return res.status(403).json({ error: 'Access denied. Valid agreement token and party email required.' });
    }

    // Check terms hash integrity
    const termsIntact = hashContent(agreement.terms_html) === agreement.terms_hash;

    // Check lock hash integrity (only meaningful when fully signed)
    const locked = !!agreement.locked_hash;
    let lockIntact = false;
    if (locked) {
      const fullResult = await verifyIntegrity(agreement.slug);
      lockIntact = fullResult.valid;
    }

    return res.json({
      found: true,
      locked,
      terms_intact: termsIntact,
      lock_intact: lockIntact,
      status: agreement.status,
      locked_at: agreement.locked_at ?? undefined,
      locked_hash: agreement.locked_hash ?? undefined,
    });
  } catch (err) {
    console.error('[Agreements] Verify error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/* ── GET /:slug/export - download signed HTML ──────────────────────────────── */
router.get('/:slug/export', async (req: Request, res: Response) => {
  try {
    const agreement = await getAgreementBySlug(req.params.slug as string);
    if (!agreement) return res.status(404).json({ error: 'Agreement not found.' });
    const { token, email } = getAgreementAccessParams(req);
    if (!canAccessAgreement(agreement, token, email)) {
      return res.status(403).json({ error: 'Access denied. Valid agreement token and party email required.' });
    }
    if (agreement.status !== 'fully_signed') {
      return res.status(400).json({ error: 'Agreement must be fully signed before export.' });
    }

    const html = generateAgreementHtml(agreement);
    const filename = `${agreement.slug}-signed-agreement.html`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(html);
  } catch (err) {
    console.error('[Agreements] Export error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/* ── Email delivery helper ─────────────────────────────────────────────────── */
async function sendSignedCopies(slug: string): Promise<void> {
  const { sendAgreementSignedEmail } = await import('../services/agreementEmailService.js');
  await sendAgreementSignedEmail(slug);
}

/* ── OTP email helper ──────────────────────────────────────────────────────── */
async function sendOtpEmail(email: string, code: string, slug: string, party: string): Promise<void> {
  const { sendAgreementOtpEmail } = await import('../services/agreementEmailService.js');
  await sendAgreementOtpEmail(email, code, slug, party);
}

/* ── Expiry reminder email helper ──────────────────────────────────────────── */
async function sendExpiryReminder(slug: string, milestone: number): Promise<void> {
  const { sendAgreementExpiryReminder } = await import('../services/agreementEmailService.js');
  await sendAgreementExpiryReminder(slug, milestone);
}

/* ── POST /:slug/create-invite - create trackable referral link (admin) ────── */
router.post('/:slug/create-invite', async (req: Request, res: Response) => {
  if (!isValidAdminKey(req.headers['x-admin-key'] as string | undefined)) {
    return res.status(403).json({ error: 'Forbidden.' });
  }

  try {
    const createdBy = (req.body as any)?.created_by as string | undefined;
    const result = await createReferralLink(req.params.slug as string, createdBy);
    const agreement = await getAgreementBySlug(req.params.slug as string);
    const inviteUrl = `${FRONTEND_URL}/partnership-terms?token=${agreement?.access_token ?? ''}&ref=${result.code}`;

    return res.json({
      ok: true,
      code: result.code,
      invite_url: inviteUrl,
      expires_at: result.expires_at,
    });
  } catch (err) {
    console.error('[Agreements] Create invite error:', err);
    return res.status(500).json({ error: 'Failed to create invite link.' });
  }
});

/* ── GET /:slug/referral-stats - view referral link metrics (admin) ────────── */
router.get('/:slug/referral-stats', async (req: Request, res: Response) => {
  if (!isValidAdminKey(req.headers['x-admin-key'] as string | undefined)) {
    return res.status(403).json({ error: 'Forbidden.' });
  }

  try {
    const stats = await getReferralStats(req.params.slug as string);
    return res.json({ links: stats });
  } catch (err) {
    console.error('[Agreements] Referral stats error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/* ── GET /r/:code - trackable referral link (tracks visit, returns redirect info) */
router.get('/r/:code', async (req: Request, res: Response) => {
  try {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
    const ua = (req.headers['user-agent'] as string) || 'unknown';
    const referrer = (req.headers['referer'] as string) || undefined;

    const result = await trackReferralVisit(req.params.code as string, ip, ua, referrer);
    if (!result) return res.status(404).json({ error: 'Invite link not found or expired.' });

    const redirectUrl = `${FRONTEND_URL}/partnership-terms?token=${encodeURIComponent(result.access_token ?? '')}&ref=${encodeURIComponent(String(req.params.code))}`;

    // If request accepts JSON (client fetch), return JSON. Otherwise 302 redirect (direct browser navigation).
    if (req.headers.accept?.includes('application/json')) {
      return res.json({ redirect_url: redirectUrl });
    }
    return res.redirect(302, redirectUrl);
  } catch (err) {
    console.error('[Agreements] Referral redirect error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/* ── POST /:slug/extend - reset signing deadline + status (admin only) ─────── */
router.post('/:slug/extend', async (req: Request, res: Response) => {
  if (!isValidAdminKey(req.headers['x-admin-key'] as string | undefined)) {
    return res.status(403).json({ error: 'Forbidden.' });
  }

  try {
    const hours = Number((req.body as any)?.hours ?? 48);
    if (!Number.isFinite(hours) || hours < 1 || hours > 720) {
      return res.status(400).json({ error: 'hours must be a number between 1 and 720.' });
    }

    const pool = getPool();
    const newDeadline = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

    // Reset deadline AND flip status back to pending/partially_signed as appropriate.
    // If one party already signed we keep it as partially_signed so they don't need to re-sign.
    const { rows } = await pool.query(
      `UPDATE partnership_agreements
       SET signing_deadline = $1,
           status = CASE
             WHEN party_a_signed_at IS NOT NULL OR party_b_signed_at IS NOT NULL
             THEN 'partially_signed'
             ELSE 'pending'
           END,
           updated_at = NOW()
       WHERE slug = $2
       RETURNING id, slug, status, signing_deadline`,
      [newDeadline, req.params.slug],
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Agreement not found.' });
    }

    return res.json({
      ok: true,
      slug: rows[0].slug,
      status: rows[0].status,
      signing_deadline: rows[0].signing_deadline,
      hours_extended: hours,
    });
  } catch (err) {
    console.error('[Agreements] Extend deadline error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/* ── POST /seed - create the AiVIS.biz × Zeeniith agreement (admin only) ──────── */
router.post('/seed', async (req: Request, res: Response) => {
  if (!isValidAdminKey(req.headers['x-admin-key'] as string | undefined)) {
    return res.status(403).json({ error: 'Forbidden.' });
  }

  try {
    const agreement = await createAgreement({
      slug: 'aivis-zeeniith-referral-delivery-2026',
      title: 'Referral and Delivery Partnership Terms - AiVIS.biz × Zeeniith',
      termsHtml: AIVIS_ZEENIITH_TERMS_HTML,
      partyA: {
        name: 'Ryan Mason',
        email: process.env.PARTY_A_EMAIL || 'partners@aivis.biz',
        phone: '706-907-5299',
        org: 'AiVIS.biz.biz / Intruvurt Labs',
      },
      partyB: {
        name: 'Dharmik Suthar',
        email: process.env.PARTY_B_EMAIL || 'zeeniithinfo@gmail.com',
        phone: '+91 6357 120 971',
        org: 'Zeeniith.in',
      },
      signingDeadlineHours: 48,
    });
    return res.json({ ok: true, id: agreement.id, slug: agreement.slug, access_token: agreement.access_token });
  } catch (err) {
    console.error('[Agreements] Seed error:', err);
    return res.status(500).json({ error: 'Failed to seed agreement.' });
  }
});

/* ── Contract terms HTML ───────────────────────────────────────────────────── */
const AIVIS_ZEENIITH_TERMS_HTML = `
<h2>1. Purpose</h2>
<p>Party A introduces clients and commercial opportunities. Party B provides the development, implementation, technical execution, testing, and delivery for accepted projects. These terms define ownership of leads, how compensation is earned, how payments are handled, and how both parties are protected.</p>

<h2>2. Roles</h2>
<p><strong>Party A (AiVIS.biz.biz / Intruvurt Labs):</strong></p>
<ul>
  <li>Sources and introduces leads and clients</li>
  <li>May support positioning, discovery, and sales conversations</li>
  <li>May handle payment collection from the client unless otherwise agreed in writing</li>
  <li>Retains the commission defined in these terms</li>
</ul>
<p><strong>Party B (Zeeniith.in):</strong></p>
<ul>
  <li>Scopes the technical work and delivery approach</li>
  <li>Builds, tests, and delivers the approved scope</li>
  <li>Communicates blockers, dependencies, and delivery timing promptly</li>
  <li>Remains responsible for delivery quality and fulfillment of approved scope</li>
</ul>

<h2>3. Lead ownership</h2>
<p>A lead is deemed owned by Party A if Party A first introduced the client to Party B through email, message, call, document, meeting, website form, or any other verifiable written or recorded communication. In the event of a dispute, the earliest verifiable record controls.</p>

<h2>4. Closing</h2>
<p>Closing may be handled by Party A, Party B, or both parties together. Regardless of who closes the deal, if the lead originated from Party A, the commission terms in this agreement apply in full. Where Party B receives client funds directly, Party B remains responsible for timely remittance of Party A's commission under Section 6.</p>

<h2>5. Commission and revenue split</h2>
<p>For every client introduced by Party A that becomes a signed and paid project, Party A earns a commission of <strong>10 percent to 18.5 percent of the total gross project value</strong>, depending on the rate agreed in writing for that client, project, or referral category. Party B receives the remaining <strong>81.5 percent to 90 percent</strong>.</p>
<p>The applicable commission rate must be confirmed in writing prior to project commencement through proposal, invoice, message, or other verifiable record. If no rate is explicitly defined, the default commission payable to Party A shall be <strong>10 percent</strong> of the total gross project value.</p>
<p>The commission applies to:</p>
<ul>
  <li>Initial project value</li>
  <li>Approved scope increases</li>
  <li>Upsells tied to the same client relationship during the protected period</li>
  <li>Recurring or retainer work derived from the same introduced client during the protected period</li>
</ul>

<h2>6. Payment handling</h2>
<p>Party B shall act as the sole payment controller for all referred projects and is responsible for collecting all client payments.</p>
<p>Party B shall calculate and remit Party A's agreed commission of <strong>10 percent to 18.5 percent</strong> from the total gross project value for each introduced client.</p>
<p>Payment to Party A must be made within <strong>3 business days</strong> of the earliest of:</p>
<ul>
  <li>Final project completion</li>
  <li>Client acceptance of deliverables</li>
  <li>Delivery of the agreed scope</li>
  <li>Receipt of the final cleared client payment</li>
</ul>
<p>Party B may not delay payment by:</p>
<ul>
  <li>Withholding completion designation</li>
  <li>Extending delivery beyond agreed scope without written approval</li>
  <li>Reclassifying completed work as ongoing to defer commission</li>
</ul>
<p>If the project is structured in milestones, the parties may agree in writing that commission is paid proportionally within <strong>3 business days</strong> of each cleared milestone payment.</p>
<p>Party B shall maintain complete and accurate records of:</p>
<ul>
  <li>Client invoices</li>
  <li>Payments received</li>
  <li>Scope approvals and changes</li>
  <li>Project completion status</li>
</ul>
<p>Such records must be provided to Party A upon request.</p>
<p>Failure to remit commission within the required timeframe constitutes a <strong>material breach</strong> of this agreement.</p>

<h2>7. Deposit rule</h2>
<p>No development work begins until the client has paid a non-refundable upfront deposit of at least <strong>50 percent</strong>, unless otherwise agreed in writing.</p>

<h2>8. Scope control</h2>
<p>Before work starts, the parties must have written agreement on project scope, deliverables, pricing, timeline, assumptions, and exclusions. Any change outside approved scope must be approved in writing and priced separately.</p>

<h2>9. Non-circumvention and client protection</h2>
<p>Party B shall not bypass Party A or contract directly with any client introduced by Party A except with written consent.</p>
<p>This protection remains in effect during the active relationship and for <strong>12 months</strong> after the last commercial interaction with that client.</p>
<p>If Party B accepts work directly from a protected client during this period, Party A remains entitled to the full commission on all resulting work.</p>

<h2>10. Client-facing position</h2>
<p>Projects may be white label or openly collaborative depending on the deal. If the work is white label, Party B agrees not to identify itself to the client as the primary commercial counterparty unless Party A approves it in writing.</p>

<h2>11. Refunds, disputes, and chargebacks</h2>
<p>Both parties agree to cooperate in good faith if a client requests a refund, disputes payment, or files a chargeback. Delivery-related failures sit with Party B. Misrepresentation or payment handling failures caused by Party A sit with Party A. Any refund allocation should follow the actual cause of the dispute and the amounts already paid out.</p>

<h2>12. Evidence and records</h2>
<p>All lead introductions, scope approvals, pricing approvals, invoices, payment confirmations, revision approvals, and delivery acceptances should be kept in written or electronic records. Email trails, signed proposals, messaging screenshots, invoice receipts, and timestamped project records are all valid business records for determining ownership, payment entitlement, and performance history.</p>

<h2>13. Confidentiality</h2>
<p>Both parties agree to keep confidential any client data, pricing, business strategy, code, technical methods, access credentials, and non-public commercial information shared under this agreement.</p>

<h2>14. Independent contractors</h2>
<p>The parties are independent contractors. Nothing in these terms creates an employer relationship, equity relationship, or general partnership beyond the limited commercial structure described here.</p>

<h2>15. Governing law</h2>
<p>These terms shall be governed by the laws of <strong>United States - Georgia, Hall Co.</strong>, unless replaced by a later written agreement signed by both parties.</p>

<h2>16. Platform consistency and accountability</h2>
<p>Both parties commit to maintaining their respective platforms (AiVIS.biz and Zeeniith) in a functional, professional, and accessible state for clients referred under this agreement. If a referred client reports platform outages, broken functionality, misleading information, or unprofessional presentation on either party's platform, the responsible party must address the issue within 48 hours of notice. Repeated platform neglect (3 or more substantiated complaints within 90 days) constitutes a material breach.</p>

<h2>17. Protection against malicious conduct</h2>
<p>Neither party shall engage in, facilitate, or knowingly tolerate any of the following through their platforms, services, or client-facing materials: scam, phishing, spyware, malware distribution, deceptive billing, identity misrepresentation, unauthorized data harvesting, or any conduct that could expose the other party to legal, regulatory, or reputational liability. Discovery of such conduct by either party is grounds for immediate termination of this agreement, forfeiture of unpaid commissions, and entitlement of the non-breaching party to pursue damages.</p>

<h2>18. Consumer protection and anti-manipulation</h2>
<p>All client-facing communications, proposals, and marketing materials used in connection with leads generated under this agreement must be truthful, non-deceptive, and compliant with applicable consumer protection laws. Neither party shall use dark patterns, hidden fees, misleading urgency, fake testimonials, bait-and-switch pricing, or any form of B2C manipulation in the acquisition, closing, or servicing of referred clients. Violation of this clause constitutes a material breach.</p>

<h2>19. Cross-referral protocol</h2>
<p>The parties agree to a reciprocal, non-competing referral relationship. AiVIS.biz specializes in AI visibility auditing, AI search optimization, and machine-legibility consulting. Zeeniith specializes in web development, IT troubleshooting, and technical consulting. When a referred client's needs fall outside the referring party's core competency, the referring party shall route the client to the other party through the agreed lead introduction process, and the standard commission terms apply. Neither party shall compete with the other in their designated specialization for referred clients.</p>

<h2>20. Traffic referral model (not lead generation)</h2>
<p>AiVIS.biz operates as a traffic and exposure platform. It does not act as a broker, sales agent, or lead generator on behalf of Party B.</p>
<p>All inquiries originate from user-initiated interactions within the AiVIS.biz platform, including but not limited to banners, embedded content, or outbound links. AiVIS.biz does not guarantee lead quality, intent, or conversion outcomes.</p>
<p>Party B acknowledges that all traffic is provided on a non-exclusive, pass-through basis and is responsible for its own sales process, qualification, and conversion.</p>

<h2>21. Attribution and tracking</h2>
<p>All referral activity must be tracked using AiVIS.biz-controlled mechanisms including:</p>
<ul>
  <li>Unique tracking links</li>
  <li>Query parameters</li>
  <li>Redirect logging</li>
  <li>Timestamped click events</li>
</ul>
<p>AiVIS.biz logs constitute the <strong>primary source of truth</strong> for referral delivery.</p>
<p>Party B is responsible for maintaining accurate internal records of:</p>
<ul>
  <li>Inquiries received</li>
  <li>Engagement status</li>
  <li>Deal progression</li>
  <li>Closed transactions</li>
</ul>

<h2>22. Verification and reporting</h2>
<p>Party B agrees to provide transparent and verifiable reporting for all referred activity upon request, including:</p>
<ul>
  <li>Confirmation of inquiry receipt</li>
  <li>Status (unresponsive, active, closed, rejected)</li>
  <li>Engagement timestamps</li>
  <li>Payment and completion records</li>
</ul>
<p>Party B must provide verifiable proof of:</p>
<ul>
  <li>Invoice issuance</li>
  <li>Payment receipt</li>
  <li>Project completion</li>
  <li>Commission calculation</li>
</ul>
<p>In the absence of verifiable records, any reasonable commission claim by Party A supported by referral and project evidence may be presumed valid pending rebuttal.</p>

<h2>23. Performance threshold and termination</h2>
<p>If AiVIS.biz delivers a minimum of <strong>5 to 10</strong> tracked referral inquiries within a reasonable timeframe and:</p>
<ul>
  <li>Party B fails to convert any of them, or</li>
  <li>Party B cannot provide verifiable status for those inquiries, or</li>
  <li>Reporting is inconsistent, delayed, or disputed</li>
</ul>
<p>then AiVIS.biz may determine, at its sole discretion, that the partnership is commercially unviable.</p>
<p>Upon such determination:</p>
<ul>
  <li>The agreement may be terminated immediately</li>
  <li>All Party B links, banners, and content will be removed from the AiVIS.biz platform</li>
  <li>No further obligations will remain on either party</li>
</ul>
<p>This termination is non-negotiable and carries no liability to AiVIS.biz.</p>

<h2>24. No guarantee of conversion</h2>
<p>AiVIS.biz makes no guarantees regarding:</p>
<ul>
  <li>Lead quality</li>
  <li>Conversion rate</li>
  <li>Revenue outcomes</li>
</ul>
<p>Party B accepts full responsibility for its ability to convert incoming traffic into customers. Failure to convert referred traffic does not constitute failure on the part of AiVIS.biz.</p>

<h2>25. Anti-dispute clause</h2>
<p>In the event of a dispute:</p>
<ul>
  <li>AiVIS.biz tracking logs remain authoritative for referral delivery</li>
  <li>Party B must provide verifiable evidence for any claim of non-receipt, non-conversion, or non-payment</li>
  <li>Absence of Party B-side records defaults in favor of Party A's evidence</li>
</ul>

<h2>26. Acceptance</h2>
<p>These terms become effective when both parties sign electronically. Each party must enter their full legal name exactly as specified in the agreement. Signatures are timestamped, IP-logged, and the full agreement is SHA-256 tamper-locked upon both signatures. The agreement is valid for <strong>1 year</strong> from the date of the final signature.</p>
`.trim();

// ═══════════════════════════════════════════════════════════════════════════
// Partnership Invoice / Payment routes (private PayPal portal)
// ═══════════════════════════════════════════════════════════════════════════

const PAYPAL_BASE = process.env.NODE_ENV === 'production'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

const invoiceCreateSchema = z.object({
  description: z.string().min(3).max(500),
  amount_usd: z.number().positive().max(100_000),
});

/** Helper: validate token + email access for an agreement, return agreement row or null */
async function gateInvoiceAccess(
  slug: string,
  token: string | undefined,
  email: string | undefined,
): Promise<{ agreement: any; email: string } | null> {
  const agreement = await getAgreementBySlug(slug);
  if (!agreement) return null;
  if (agreement.access_token && token !== agreement.access_token) return null;
  const e = email?.trim().toLowerCase();
  if (!e) return null;
  const pa = agreement.party_a_email?.toLowerCase();
  const pb = agreement.party_b_email?.toLowerCase();
  if (e !== pa && e !== pb) return null;
  return { agreement, email: e };
}

/* ── POST /:slug/invoices - create invoice (admin only) ───────────────────── */
router.post('/:slug/invoices', async (req: Request, res: Response) => {
  if (!isValidAdminKey(req.headers['x-admin-key'] as string | undefined)) {
    return res.status(403).json({ error: 'Forbidden.' });
  }

  const parsed = invoiceCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Provide description (3-500 chars) and amount_usd (positive number).' });
  }

  try {
    const agreement = await getAgreementBySlug(req.params.slug as string);
    if (!agreement) return res.status(404).json({ error: 'Agreement not found.' });

    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO partnership_invoices (agreement_slug, description, amount_usd, created_by, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING id, agreement_slug, description, amount_usd, status, created_at`,
      [req.params.slug, parsed.data.description, parsed.data.amount_usd, agreement.party_a_email || 'admin'],
    );

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[Invoices] Create error:', err);
    return res.status(500).json({ error: 'Failed to create invoice.' });
  }
});

/* ── GET /:slug/invoices - list invoices (gated by token + email) ─────────── */
router.get('/:slug/invoices', async (req: Request, res: Response) => {
  try {
    const gate = await gateInvoiceAccess(
      req.params.slug as string,
      req.query.token as string | undefined,
      req.query.email as string | undefined,
    );
    if (!gate) return res.status(403).json({ error: 'Access denied.' });

    const pool = getPool();
    const result = await pool.query(
      `SELECT id, agreement_slug, description, amount_usd, status, paypal_order_id, paid_by_email, paid_at, created_at, updated_at
       FROM partnership_invoices
       WHERE agreement_slug = $1
       ORDER BY created_at DESC`,
      [req.params.slug],
    );

    return res.json({ invoices: result.rows });
  } catch (err) {
    console.error('[Invoices] List error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/* ── POST /:slug/invoices/:invoiceId/pay - create PayPal order for invoice ── */
router.post('/:slug/invoices/:invoiceId/pay', async (req: Request, res: Response) => {
  try {
    const gate = await gateInvoiceAccess(
      req.params.slug as string,
      req.query.token as string | undefined,
      (req.body as any)?.email || req.query.email as string | undefined,
    );
    if (!gate) return res.status(403).json({ error: 'Access denied.' });

    const pool = getPool();
    const inv = await pool.query(
      `SELECT id, amount_usd, description, status FROM partnership_invoices WHERE id = $1 AND agreement_slug = $2`,
      [req.params.invoiceId, req.params.slug],
    );
    if (!inv.rows[0]) return res.status(404).json({ error: 'Invoice not found.' });
    if (inv.rows[0].status === 'paid') return res.status(400).json({ error: 'Invoice already paid.' });

    const invoice = inv.rows[0];
    const slug = String(req.params.slug);
    const returnUrl = `${FRONTEND_URL}/partnership-payments?slug=${encodeURIComponent(slug)}&invoice=${encodeURIComponent(invoice.id)}&capture=true`;
    const cancelUrl = `${FRONTEND_URL}/partnership-payments?slug=${encodeURIComponent(slug)}&cancelled=true`;

    // Create PayPal order with custom amount
    const token = await getPayPalAccessToken();
    const orderRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: 'USD',
              value: Number(invoice.amount_usd).toFixed(2),
            },
            description: `Partnership Invoice: ${invoice.description}`.slice(0, 127),
            custom_id: `partnership|${invoice.id}`,
            invoice_id: invoice.id,
          },
        ],
        application_context: {
          brand_name: 'AiVIS.biz Partnership',
          landing_page: 'LOGIN',
          user_action: 'PAY_NOW',
          return_url: returnUrl,
          cancel_url: cancelUrl,
        },
      }),
    });

    if (!orderRes.ok) {
      const text = await orderRes.text();
      throw new Error(`PayPal create order failed (${orderRes.status}): ${text}`);
    }

    const order = (await orderRes.json()) as { id: string; links: Array<{ href: string; rel: string }> };
    const approvalLink = order.links?.find((l) => l.rel === 'approve');
    if (!approvalLink) throw new Error('PayPal order missing approval URL.');

    // Store PayPal order ID on the invoice
    await pool.query(
      `UPDATE partnership_invoices SET paypal_order_id = $1, updated_at = NOW() WHERE id = $2`,
      [order.id, invoice.id],
    );

    return res.json({ orderId: order.id, approvalUrl: approvalLink.href });
  } catch (err) {
    console.error('[Invoices] Pay error:', err);
    return res.status(500).json({ error: 'Failed to create payment.' });
  }
});

/* ── POST /:slug/invoices/:invoiceId/capture - capture PayPal payment ─────── */
router.post('/:slug/invoices/:invoiceId/capture', async (req: Request, res: Response) => {
  try {
    const gate = await gateInvoiceAccess(
      req.params.slug as string,
      req.query.token as string | undefined,
      (req.body as any)?.email || req.query.email as string | undefined,
    );
    if (!gate) return res.status(403).json({ error: 'Access denied.' });

    const pool = getPool();
    const inv = await pool.query(
      `SELECT id, paypal_order_id, status FROM partnership_invoices WHERE id = $1 AND agreement_slug = $2`,
      [req.params.invoiceId, req.params.slug],
    );
    if (!inv.rows[0]) return res.status(404).json({ error: 'Invoice not found.' });
    if (inv.rows[0].status === 'paid') return res.json({ captured: true, already_paid: true });

    const paypalOrderId = inv.rows[0].paypal_order_id;
    if (!paypalOrderId) return res.status(400).json({ error: 'No PayPal order associated with this invoice.' });

    // Capture the order
    const token = await getPayPalAccessToken();
    const captureRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!captureRes.ok) {
      const text = await captureRes.text();
      throw new Error(`PayPal capture failed (${captureRes.status}): ${text}`);
    }

    const capture = (await captureRes.json()) as { status: string };
    if (capture.status === 'COMPLETED') {
      await pool.query(
        `UPDATE partnership_invoices
         SET status = 'paid', paid_by_email = $1, paid_at = NOW(), updated_at = NOW()
         WHERE id = $2`,
        [gate.email, inv.rows[0].id],
      );
      return res.json({ captured: true });
    }

    return res.json({ captured: false, paypal_status: capture.status });
  } catch (err) {
    console.error('[Invoices] Capture error:', err);
    return res.status(500).json({ error: 'Failed to capture payment.' });
  }
});

export default router;
