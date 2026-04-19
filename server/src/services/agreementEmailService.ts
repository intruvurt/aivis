/**
 * Email delivery for fully-signed partnership agreements.
 * Sends signed HTML copy to both parties after tamper-lock.
 */

import { getAgreementBySlug, generateAgreementHtml } from './agreementService.js';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const RESEND_KEY_VALID = RESEND_API_KEY.length > 0 && !RESEND_API_KEY.includes('replace_with') && RESEND_API_KEY.startsWith('re_');
const FROM_EMAIL = process.env.FROM_EMAIL || 'AiVIS.biz <noreply@mailer.aivis.biz>';

async function resendSend(payload: {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: Array<{ filename: string; content: string }>;
}): Promise<void> {
  if (!RESEND_KEY_VALID) {
    console.error(`[AgreementEmail] RESEND_API_KEY is missing or invalid — email NOT delivered. To: ${payload.to} | Subject: ${payload.subject}`);
    throw new Error('Email service is not configured. Please contact support if you are not receiving emails.');
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      attachments: payload.attachments,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as any;
    throw new Error(`Resend API error ${res.status}: ${body?.message || body?.name || res.statusText}`);
  }

  const result = await res.json() as any;
  console.log(`[AgreementEmail] Sent - id: ${result?.id} | to: ${payload.to}`);
}

/**
 * Sends signed agreement HTML copy to both Party A and Party B.
 * Called after the agreement reaches fully_signed + tamper-locked state.
 */
export async function sendAgreementSignedEmail(slug: string): Promise<void> {
  const agreement = await getAgreementBySlug(slug);
  if (!agreement || agreement.status !== 'fully_signed') {
    console.warn(`[AgreementEmail] Cannot send - agreement "${slug}" not fully signed.`);
    return;
  }

  const signedHtml = generateAgreementHtml(agreement);
  const filename = `${agreement.slug}-signed-agreement.html`;
  const subject = `Signed Agreement: ${agreement.title}`;

  const textBody = [
    `The partnership agreement "${agreement.title}" has been fully signed and tamper-locked.`,
    '',
    `Party A: ${agreement.party_a_name} (${agreement.party_a_org})`,
    `Signed: ${agreement.party_a_signed_at}`,
    '',
    `Party B: ${agreement.party_b_name} (${agreement.party_b_org})`,
    `Signed: ${agreement.party_b_signed_at}`,
    '',
    `Locked: ${agreement.locked_at}`,
    `Integrity Hash: ${agreement.locked_hash}`,
    `Valid Until: ${agreement.valid_until}`,
    '',
    'A signed HTML copy is attached to this email.',
    '',
    '- AiVIS.biz / Intruvurt Labs',
  ].join('\n');

  const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:40px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f7f7f8;color:#1a1a2e">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;padding:40px;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
    <h1 style="font-size:22px;margin:0 0 8px;color:#1a1a2e">Agreement Fully Signed</h1>
    <p style="font-size:15px;color:#555;margin:0 0 24px">The partnership agreement below has been signed by both parties and tamper-locked.</p>
    <table style="width:100%;font-size:14px;border-collapse:collapse;margin-bottom:24px">
      <tr><td style="padding:8px 0;color:#888;width:120px">Agreement</td><td style="padding:8px 0;font-weight:600">${escapeHtml(agreement.title)}</td></tr>
      <tr><td style="padding:8px 0;color:#888">Party A</td><td style="padding:8px 0">${escapeHtml(agreement.party_a_name)} - ${escapeHtml(agreement.party_a_org ?? '')}</td></tr>
      <tr><td style="padding:8px 0;color:#888">Signed</td><td style="padding:8px 0">${agreement.party_a_signed_at}</td></tr>
      <tr><td style="padding:8px 0;color:#888">Party B</td><td style="padding:8px 0">${escapeHtml(agreement.party_b_name)} - ${escapeHtml(agreement.party_b_org ?? '')}</td></tr>
      <tr><td style="padding:8px 0;color:#888">Signed</td><td style="padding:8px 0">${agreement.party_b_signed_at}</td></tr>
      <tr><td style="padding:8px 0;color:#888">Locked</td><td style="padding:8px 0">${agreement.locked_at}</td></tr>
      <tr><td style="padding:8px 0;color:#888">Valid Until</td><td style="padding:8px 0">${agreement.valid_until}</td></tr>
      <tr><td style="padding:8px 0;color:#888">Integrity Hash</td><td style="padding:8px 0;font-family:monospace;font-size:12px;word-break:break-all">${agreement.locked_hash}</td></tr>
    </table>
    <p style="font-size:14px;color:#555">A signed HTML copy is attached. You can verify integrity at any time by visiting the agreement verification page.</p>
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
    <p style="font-size:12px;color:#999;margin:0">AiVIS.biz / Intruvurt Labs - Georgia, USA</p>
  </div>
</body>
</html>`.trim();

  const recipients = [
    { email: agreement.party_a_email, name: agreement.party_a_name },
    { email: agreement.party_b_email, name: agreement.party_b_name },
  ].filter((r) => r.email);

  for (const recipient of recipients) {
    try {
      await resendSend({
        to: recipient.email,
        subject,
        html: emailHtml,
        text: textBody,
        attachments: [{ filename, content: Buffer.from(signedHtml, 'utf-8').toString('base64') }],
      });
    } catch (err) {
      console.error(`[AgreementEmail] Failed to send to ${recipient.email}:`, err);
    }
  }
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Sends a 6-digit OTP code to a party for email verification before signing.
 */
export async function sendAgreementOtpEmail(email: string, code: string, slug: string, party: string): Promise<void> {
  const partyLabel = party === 'a' ? 'Party A' : 'Party B';
  const subject = `Your signing verification code - AiVIS.biz Partnership`;

  const textBody = [
    `Your verification code for signing the AiVIS.biz partnership agreement is: ${code}`,
    '',
    `You are signing as ${partyLabel}.`,
    'This code expires in 10 minutes.',
    '',
    'If you did not request this, you can safely ignore this email.',
    '',
    '- AiVIS.biz / Intruvurt Labs',
  ].join('\n');

  const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:40px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f7f7f8;color:#1a1a2e">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:40px;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
    <h1 style="font-size:22px;margin:0 0 8px;color:#1a1a2e">Verification Code</h1>
    <p style="font-size:15px;color:#555;margin:0 0 24px">Enter this code on the partnership agreement page to verify your identity and sign as <strong>${escapeHtml(partyLabel)}</strong>.</p>
    <div style="background:#f0f4ff;border:2px solid #7c5cff;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
      <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#1a1a2e;font-family:monospace">${escapeHtml(code)}</span>
    </div>
    <p style="font-size:13px;color:#888;margin:0">This code expires in <strong>10 minutes</strong>. If you didn't request this, ignore this email.</p>
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
    <p style="font-size:12px;color:#999;margin:0">AiVIS.biz / Intruvurt Labs - Georgia, USA</p>
  </div>
</body>
</html>`.trim();

  // Let errors propagate — the caller (agreementRoutes.ts) catches and returns a 502
  // with a user-facing message. Swallowing the error here was causing silent failures
  // where the API returned { sent: true } but no email was ever delivered.
  await resendSend({ to: email, subject, html: emailHtml, text: textBody });
}

/**
 * Sends an expiry reminder email to both parties.
 */
export async function sendAgreementExpiryReminder(slug: string, daysRemaining: number): Promise<void> {
  const agreement = await getAgreementBySlug(slug);
  if (!agreement || !agreement.valid_until) return;

  const expiryDate = new Date(agreement.valid_until).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const subject = `Partnership agreement expires in ${daysRemaining} days - AiVIS.biz × ${escapeHtml(agreement.party_b_org ?? 'Partner')}`;
  const urgency = daysRemaining <= 7 ? 'urgent' : daysRemaining <= 14 ? 'important' : 'notice';
  const urgencyColor = urgency === 'urgent' ? '#dc2626' : urgency === 'important' ? '#d97706' : '#2563eb';

  const textBody = [
    `Your partnership agreement "${agreement.title}" expires on ${expiryDate} (${daysRemaining} days).`,
    '',
    `Party A: ${agreement.party_a_name} (${agreement.party_a_org})`,
    `Party B: ${agreement.party_b_name} (${agreement.party_b_org})`,
    '',
    daysRemaining <= 7
      ? 'ACTION REQUIRED: Please discuss renewal immediately.'
      : 'Please plan for renewal or discuss next steps with your partner.',
    '',
    '- AiVIS.biz / Intruvurt Labs',
  ].join('\n');

  const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:40px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f7f7f8;color:#1a1a2e">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;padding:40px;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
    <div style="background:${urgencyColor};color:#fff;border-radius:8px;padding:12px 20px;margin-bottom:24px;font-weight:600;font-size:14px">
      ${urgency === 'urgent' ? '⚠️ URGENT' : urgency === 'important' ? '⏰ IMPORTANT' : '📋 NOTICE'}: Agreement expires in ${daysRemaining} days
    </div>
    <h1 style="font-size:20px;margin:0 0 8px;color:#1a1a2e">Partnership Agreement Expiry Notice</h1>
    <p style="font-size:15px;color:#555;margin:0 0 20px">The following agreement will expire on <strong>${expiryDate}</strong>.</p>
    <table style="width:100%;font-size:14px;border-collapse:collapse;margin-bottom:24px">
      <tr><td style="padding:8px 0;color:#888;width:120px">Agreement</td><td style="padding:8px 0;font-weight:600">${escapeHtml(agreement.title)}</td></tr>
      <tr><td style="padding:8px 0;color:#888">Party A</td><td style="padding:8px 0">${escapeHtml(agreement.party_a_name)} - ${escapeHtml(agreement.party_a_org ?? '')}</td></tr>
      <tr><td style="padding:8px 0;color:#888">Party B</td><td style="padding:8px 0">${escapeHtml(agreement.party_b_name)} - ${escapeHtml(agreement.party_b_org ?? '')}</td></tr>
      <tr><td style="padding:8px 0;color:#888">Expires</td><td style="padding:8px 0;font-weight:600;color:${urgencyColor}">${expiryDate} (${daysRemaining} days)</td></tr>
    </table>
    <p style="font-size:14px;color:#555">Please coordinate with your partner to discuss renewal, renegotiation, or natural expiration.</p>
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
    <p style="font-size:12px;color:#999;margin:0">AiVIS.biz / Intruvurt Labs - Georgia, USA</p>
  </div>
</body>
</html>`.trim();

  const recipients = [
    { email: agreement.party_a_email, name: agreement.party_a_name },
    { email: agreement.party_b_email, name: agreement.party_b_name },
  ].filter((r) => r.email);

  for (const recipient of recipients) {
    try {
      await resendSend({ to: recipient.email, subject, html: emailHtml, text: textBody });
    } catch (err) {
      console.error(`[AgreementEmail] Expiry reminder failed for ${recipient.email}:`, err);
    }
  }
}
