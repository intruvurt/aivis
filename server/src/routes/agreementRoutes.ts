/**
 * Partnership agreement routes — signing, verification, PDF export, email delivery.
 *
 * Public endpoints (no auth required — parties sign via slug + exact name match):
 *   GET  /api/agreements/:slug          — view agreement status + terms
 *   POST /api/agreements/:slug/sign     — sign as party a or b
 *   GET  /api/agreements/:slug/verify   — tamper-proof integrity check
 *   GET  /api/agreements/:slug/export   — download signed HTML copy
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  getAgreementBySlug,
  signAgreement,
  verifyIntegrity,
  generateAgreementHtml,
  createAgreement,
} from '../services/agreementService.js';

const router = Router();

/* ── GET /:slug — view agreement ───────────────────────────────────────────── */
router.get('/:slug', async (req: Request, res: Response) => {
  try {
    const agreement = await getAgreementBySlug(req.params.slug);
    if (!agreement) return res.status(404).json({ error: 'Agreement not found.' });

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
    };

    return res.json(safeView);
  } catch (err) {
    console.error('[Agreements] GET error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/* ── POST /:slug/sign — sign the agreement ─────────────────────────────────── */
const signSchema = z.object({
  party: z.enum(['a', 'b']),
  signature: z.string().min(2).max(200),
});

router.post('/:slug/sign', async (req: Request, res: Response) => {
  try {
    const parsed = signSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request. Provide party ("a" or "b") and signature (your full legal name).' });
    }

    const { party, signature } = parsed.data;
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
    const ua = (req.headers['user-agent'] as string) || 'unknown';

    const result = await signAgreement(req.params.slug, party, signature, ip, ua);

    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }

    // If fully locked, send confirmation emails to both parties
    if (result.fullyLocked) {
      // Fire-and-forget email delivery
      sendSignedCopies(req.params.slug).catch((err) =>
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

/* ── GET /:slug/verify — integrity check ───────────────────────────────────── */
router.get('/:slug/verify', async (req: Request, res: Response) => {
  try {
    const result = await verifyIntegrity(req.params.slug);
    return res.json(result);
  } catch (err) {
    console.error('[Agreements] Verify error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/* ── GET /:slug/export — download signed HTML ──────────────────────────────── */
router.get('/:slug/export', async (req: Request, res: Response) => {
  try {
    const agreement = await getAgreementBySlug(req.params.slug);
    if (!agreement) return res.status(404).json({ error: 'Agreement not found.' });
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
  // Dynamic import to avoid circular dependency at module load
  const { sendAgreementSignedEmail } = await import('../services/agreementEmailService.js');
  await sendAgreementSignedEmail(slug);
}

/* ── POST /seed — create the AiVIS × Zeeniith agreement (admin only) ──────── */
router.post('/seed', async (req: Request, res: Response) => {
  const adminKey = req.headers['x-admin-key'] as string | undefined;
  if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'Forbidden.' });
  }

  try {
    const agreement = await createAgreement({
      slug: 'aivis-zeeniith-referral-delivery-2026',
      title: 'Referral and Delivery Partnership Terms — AiVIS × Zeeniith',
      termsHtml: AIVIS_ZEENIITH_TERMS_HTML,
      partyA: {
        name: 'Ryan Mason',
        email: process.env.PARTY_A_EMAIL || 'partners@aivis.biz',
        phone: '706-907-5299',
        org: 'AiVIS / Intruvurt Labs',
      },
      partyB: {
        name: 'Dharmik Suthar',
        email: process.env.PARTY_B_EMAIL || 'zeeniithinfo@gmail.com',
        phone: '+91 6357 120 971',
        org: 'Zeeniith',
      },
      signingDeadlineHours: 24,
    });
    return res.json({ ok: true, id: agreement.id, slug: agreement.slug });
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
<p><strong>Party A (AiVIS / Intruvurt Labs):</strong></p>
<ul>
  <li>Sources and introduces leads and clients</li>
  <li>May support positioning, discovery, and sales conversations</li>
  <li>May handle payment collection from the client unless otherwise agreed in writing</li>
  <li>Retains the commission defined in these terms</li>
</ul>
<p><strong>Party B (Zeeniith):</strong></p>
<ul>
  <li>Scopes the technical work and delivery approach</li>
  <li>Builds, tests, and delivers the approved scope</li>
  <li>Communicates blockers, dependencies, and delivery timing promptly</li>
  <li>Remains responsible for delivery quality and fulfillment of approved scope</li>
</ul>

<h2>3. Lead ownership</h2>
<p>A lead is deemed owned by Party A if Party A first introduced the client to Party B through email, message, call, document, meeting, website form, or any other verifiable written or recorded communication. In the event of a dispute, the earliest verifiable record controls.</p>

<h2>4. Closing</h2>
<p>Closing may be handled by Party A, Party B, or both parties together. Regardless of who closes the deal, if the lead originated from Party A, the commission terms in this agreement apply in full.</p>

<h2>5. Commission and revenue split</h2>
<p>For every client introduced by Party A that becomes a signed and paid project, Party A earns a fixed commission of <strong>10 percent of the total gross project value</strong>. Party B receives <strong>90 percent of the total gross project value</strong>.</p>
<p>The 10 percent commission applies to:</p>
<ul>
  <li>Initial project value</li>
  <li>Approved scope increases</li>
  <li>Upsells tied to the same client relationship during the protected period</li>
  <li>Recurring retainer work derived from the same introduced client during the protected period</li>
</ul>

<h2>6. Payment handling</h2>
<p>Unless otherwise agreed in writing, Party A may collect payment from the client. Party A retains the 10 percent commission and remits 90 percent to Party B from each cleared client payment.</p>
<p>Where possible, payments should be milestone based rather than only final delivery based. That means the 10 percent and 90 percent split applies to each milestone payment as received.</p>
<p>Party B shall be paid within <strong>3 business days</strong> after Party A receives cleared funds from the client for the relevant milestone or project payment.</p>

<h2>7. Deposit rule</h2>
<p>No development work begins until the client has paid a non-refundable upfront deposit of at least <strong>50 percent</strong>, unless both parties approve a different structure in writing.</p>

<h2>8. Scope control</h2>
<p>Before work starts, the parties must have written agreement on project scope, deliverables, pricing, timeline, assumptions, and exclusions. Any change outside approved scope must be approved in writing and priced separately.</p>

<h2>9. Non-circumvention and client protection</h2>
<p>Party B shall not bypass Party A or contract directly with any client introduced by Party A except through Party A's written consent. This protection remains in effect during the active relationship and for <strong>12 months</strong> after the last active project, invoice, or commercial discussion involving that client.</p>
<p>If Party B directly accepts work from a protected client introduced by Party A during that protected period, Party A remains entitled to the 10 percent commission on all resulting work from that client during that period.</p>

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
<p>These terms shall be governed by the laws of <strong>United States — Georgia, Hall Co.</strong>, unless replaced by a later written agreement signed by both parties.</p>

<h2>16. Platform consistency and accountability</h2>
<p>Both parties commit to maintaining their respective platforms (AiVIS and Zeeniith) in a functional, professional, and accessible state for clients referred under this agreement. If a referred client reports platform outages, broken functionality, misleading information, or unprofessional presentation on either party's platform, the responsible party must address the issue within 48 hours of notice. Repeated platform neglect (3 or more substantiated complaints within 90 days) constitutes a material breach.</p>

<h2>17. Protection against malicious conduct</h2>
<p>Neither party shall engage in, facilitate, or knowingly tolerate any of the following through their platforms, services, or client-facing materials: scam, phishing, spyware, malware distribution, deceptive billing, identity misrepresentation, unauthorized data harvesting, or any conduct that could expose the other party to legal, regulatory, or reputational liability. Discovery of such conduct by either party is grounds for immediate termination of this agreement, forfeiture of unpaid commissions, and entitlement of the non-breaching party to pursue damages.</p>

<h2>18. Consumer protection and anti-manipulation</h2>
<p>All client-facing communications, proposals, and marketing materials used in connection with leads generated under this agreement must be truthful, non-deceptive, and compliant with applicable consumer protection laws. Neither party shall use dark patterns, hidden fees, misleading urgency, fake testimonials, bait-and-switch pricing, or any form of B2C manipulation in the acquisition, closing, or servicing of referred clients. Violation of this clause constitutes a material breach.</p>

<h2>19. Cross-referral protocol</h2>
<p>The parties agree to a reciprocal, non-competing referral relationship. AiVIS specializes in AI visibility auditing, AI search optimization, and machine-legibility consulting. Zeeniith specializes in web development, IT troubleshooting, and technical consulting. When a referred client's needs fall outside the referring party's core competency, the referring party shall route the client to the other party through the agreed lead introduction process, and the standard commission terms apply. Neither party shall compete with the other in their designated specialization for referred clients.</p>

<h2>20. Acceptance</h2>
<p>These terms become effective when both parties sign electronically. Each party must enter their full legal name exactly as specified in the agreement. Signatures are timestamped, IP-logged, and the full agreement is SHA-256 tamper-locked upon both signatures. The agreement is valid for <strong>1 year</strong> from the date of the final signature.</p>
`.trim();

export default router;
