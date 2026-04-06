import { redactSensitive } from '../lib/safeLogging.js';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const RESEND_KEY_VALID = RESEND_API_KEY.length > 0 && !RESEND_API_KEY.includes('replace_with') && RESEND_API_KEY.startsWith('re_');
const FROM_EMAIL = process.env.FROM_EMAIL || 'AiVIS <noreply@mailer.aivis.biz>';
// FRONTEND_URL may be comma-separated (dev). Take the first origin for email links.
const FRONTEND_URL = (process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || 'https://aivis.biz')
  .split(',')[0]
  .trim()
  .replace(/\/+$/, '');

// ─── Brand constants for email templates ──────────────────────────────────────
const BRAND = {
  name: 'AiVIS',
  tagline: 'AI Visibility & Citation Readiness Auditor',
  logoUrl: 'https://aivis.biz/aivis-logo.png',
  siteUrl: 'https://aivis.biz',
  supportEmail: 'support@aivis.biz',
  company: 'Intruvurt Labs',
  location: 'Georgia, USA',
  year: new Date().getFullYear(),
} as const;

// Only treat as dev mode if explicitly running locally - default to production behavior
const IS_DEV_MODE =
  FRONTEND_URL.includes('localhost') || process.env.NODE_ENV === 'development';

console.log(`[Email] FROM: ${FROM_EMAIL} | FRONTEND_URL: ${FRONTEND_URL} | DEV_MODE: ${IS_DEV_MODE} | API_KEY_SET: ${RESEND_KEY_VALID}`);
if (!RESEND_KEY_VALID) {
  console.warn('[Email] ⚠️  RESEND_API_KEY is missing or invalid - all emails will be logged to console only. Set a valid Resend API key (starts with re_) for production email delivery.');
}

// ─── Resend REST API helper ───────────────────────────────────────────────────
// Uses fetch (Node 18+) - no SMTP, no nodemailer, no port issues.

async function resendSend(payload: {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: Array<{
    filename: string;
    content: string;
  }>;
}): Promise<void> {
  if (!RESEND_KEY_VALID) {
    console.log(`[Email] No valid RESEND_API_KEY - console fallback: To: ${payload.to} | Subject: ${payload.subject}`);
    return;
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
  console.log(`[Email] Sent via Resend API - id: ${result?.id} | to: ${payload.to}`);
}

export async function sendAuditReportDeliveryEmail(args: {
  to: string;
  auditId: string;
  targetUrl: string;
  result: any;
  publicReportUrl?: string | null;
  pdfBuffer?: Buffer | null;
  pdfFilename?: string | null;
  branded?: boolean;
  brandName?: string | null;
}): Promise<void> {
  const score = Number(args.result?.visibility_score || 0);
  const summary = String(args.result?.summary || 'Evidence-backed AI visibility audit completed.').trim();
  const analyzedAt = String(args.result?.analyzed_at || '').trim();
  const label = args.branded && args.brandName ? args.brandName : BRAND.name;
  const topRecommendations: string[] = Array.isArray(args.result?.recommendations)
    ? args.result.recommendations.slice(0, 3).map((rec: any) => `• ${String(rec?.title || 'Recommendation').trim()}`)
    : [];
  const strictRubric = args.result?.strict_rubric as Record<string, unknown> | undefined;
  const failedGates: Array<Record<string, unknown>> = Array.isArray(strictRubric?.gates)
    ? (strictRubric.gates as Array<Record<string, unknown>>).filter((g) => g.status === 'fail').slice(0, 5)
    : [];
  const requiredFixpacks: Array<Record<string, unknown>> = Array.isArray(strictRubric?.required_fixpacks)
    ? (strictRubric.required_fixpacks as Array<Record<string, unknown>>).slice(0, 3)
    : [];

  const shareBlock = args.publicReportUrl
    ? `<p style="margin:16px 0 0;color:#cbd5e1;font-size:14px;line-height:1.7;">Public report link:<br/><a href="${encodeURI(args.publicReportUrl)}" style="color:#22d3ee;text-decoration:none;">${escapeEmailHtml(args.publicReportUrl)}</a></p>`
    : '';

  await resendSend({
    to: args.to,
    subject: `${label} audit report ready • ${score}/100`,
    html: `
      <div style="background:#0f172a;color:#e5e7eb;padding:24px;font-family:Arial,Helvetica,sans-serif;">
        <div style="max-width:680px;margin:0 auto;border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:24px;background:#111827;">
          <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.12em;color:#94a3b8;">Automated audit delivery</div>
          <h1 style="margin:10px 0 8px;font-size:28px;line-height:1.2;color:#ffffff;">${escapeEmailHtml(label)} report is ready</h1>
          <p style="margin:0;color:#cbd5e1;font-size:14px;line-height:1.7;">${escapeEmailHtml(args.targetUrl)}</p>
          <div style="margin-top:18px;display:flex;gap:12px;flex-wrap:wrap;">
            <div style="padding:10px 14px;border-radius:999px;border:1px solid rgba(34,211,238,0.35);color:#67e8f9;">Visibility ${score}/100</div>
            <div style="padding:10px 14px;border-radius:999px;border:1px solid rgba(255,255,255,0.12);color:#cbd5e1;">Audit ${args.auditId}</div>
          </div>
          <p style="margin:18px 0 0;color:#cbd5e1;font-size:14px;line-height:1.7;">${escapeEmailHtml(summary)}</p>
          ${shareBlock}
          ${topRecommendations.length ? `<div style="margin-top:18px;"><div style="font-size:12px;text-transform:uppercase;letter-spacing:0.12em;color:#94a3b8;">Top fixes</div><div style="margin-top:8px;color:#e5e7eb;font-size:14px;line-height:1.8;">${topRecommendations.map((item: string) => escapeEmailHtml(item)).join('<br/>')}</div></div>` : ''}
          ${failedGates.length ? `<div style="margin-top:18px;"><div style="font-size:12px;text-transform:uppercase;letter-spacing:0.12em;color:#ef4444;">Failed rubric gates</div><div style="margin-top:8px;color:#fca5a5;font-size:14px;line-height:1.8;">${failedGates.map((g) => escapeEmailHtml(`• ${String(g.label || '')} - score ${Number(g.score_0_100 ?? 0)}/100`)).join('<br/>')}</div></div>` : ''}
          ${requiredFixpacks.length ? `<div style="margin-top:18px;"><div style="font-size:12px;text-transform:uppercase;letter-spacing:0.12em;color:#f59e0b;">Required fixpacks</div><div style="margin-top:8px;color:#fde68a;font-size:14px;line-height:1.8;">${requiredFixpacks.map((fp) => escapeEmailHtml(`• ${String(fp.label || '')} (+${Number(fp.estimated_score_lift_min ?? 0)}–+${Number(fp.estimated_score_lift_max ?? 0)} projected)`)).join('<br/>')}</div></div>` : ''}
          <p style="margin:18px 0 0;color:#94a3b8;font-size:12px;line-height:1.7;">Analyzed ${analyzedAt || 'recently'}. ${args.pdfBuffer ? 'The PDF report is attached to this email.' : 'No PDF attachment was included for this destination.'}</p>
        </div>
      </div>
    `,
    text: [
      `${label} audit report ready`,
      '',
      `Target: ${args.targetUrl}`,
      `Visibility score: ${score}/100`,
      `Audit ID: ${args.auditId}`,
      `Summary: ${summary}`,
      ...(args.publicReportUrl ? ['', `Public report: ${args.publicReportUrl}`] : []),
      ...(topRecommendations.length ? ['', 'Top fixes:', ...topRecommendations] : []),
      '',
      args.pdfBuffer ? 'The PDF report is attached to this email.' : 'No PDF attachment was included for this destination.',
    ].join('\n'),
    attachments: args.pdfBuffer && args.pdfFilename
      ? [{ filename: args.pdfFilename, content: args.pdfBuffer.toString('base64') }]
      : undefined,
  });
}

function escapeEmailHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── Verification email ───────────────────────────────────────────────────────

type VerificationEmailOptions = {
  expirationMinutes?: number;
  reason?: 'signup' | 'oauth_signin' | 'resend';
};

function formatVerificationExpiryLabel(expirationMinutes: number): string {
  if (expirationMinutes < 60) return `${expirationMinutes} minutes`;
  const hours = expirationMinutes / 60;
  return Number.isInteger(hours) ? `${hours} hour${hours === 1 ? '' : 's'}` : `${hours.toFixed(1)} hours`;
}

export async function sendVerificationEmail(email: string, token: string, options?: VerificationEmailOptions): Promise<void> {
  const verificationUrl = `${FRONTEND_URL}/verify-email?token=${token}`;
  const expirationMinutes = Math.max(5, Number(options?.expirationMinutes || 24 * 60));
  const expiryLabel = formatVerificationExpiryLabel(expirationMinutes);
  const reason = options?.reason || 'signup';

  if (!RESEND_KEY_VALID) {
    console.log('[Email] Verification link (set RESEND_API_KEY to send for real):');
    console.log(`  To:  ${email}`);
    console.log(`  URL: ${verificationUrl}`);
    return;
  }

  try {
    await resendSend({
      to: email,
      subject: `Verify your ${BRAND.name} account`,
      html: verificationHtml(verificationUrl, email, expiryLabel, reason),
      text: [
        `Welcome to ${BRAND.name}.`,
        ``,
        `Please verify your email to activate your account:`,
        `${verificationUrl}`,
        ``,
        `This verification link expires in ${expiryLabel}.`,
        `If you did not create an account, you can safely ignore this email.`,
        ``,
        `After verification, your Observer plan includes 3 audits per month with evidence-backed scoring and practical recommendations.`,
        ``,
        `Privacy: ${BRAND.siteUrl}/privacy`,
        `Terms: ${BRAND.siteUrl}/terms`,
        `Compliance: ${BRAND.siteUrl}/compliance`,
        ``,
        `${BRAND.name} - ${BRAND.tagline}`,
        `${BRAND.company} • ${BRAND.location}`,
        `${BRAND.supportEmail}`,
      ].join('\n'),
    });
  } catch (err: any) {
    console.error('[Email] Failed to send verification email:', err?.message);
    if (IS_DEV_MODE) {
      console.log(`[Email] Dev fallback - URL: ${verificationUrl}`);
      return;
    }
    throw err;
  }
}

// ─── Password reset email ─────────────────────────────────────────────────────

export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const resetUrl = `${FRONTEND_URL}/reset-password?token=${token}`;

  if (!RESEND_KEY_VALID) {
    console.log('[Email] Password reset link (set RESEND_API_KEY to send for real):');
    console.log(`  To:  ${email}`);
    console.log(`  URL: ${resetUrl}`);
    return;
  }

  try {
    await resendSend({
      to: email,
      subject: `Reset your ${BRAND.name} password`,
      html: resetHtml(resetUrl, email),
      text: `Password Reset Request\n\nReset your password by visiting: ${resetUrl}\n\nThis link expires in 1 hour. If you did not request a reset, ignore this email and your password stays the same.\n\n${BRAND.name} - ${BRAND.tagline}\n${BRAND.company} • ${BRAND.location}\n${BRAND.supportEmail}`,
    });
  } catch (err: any) {
    console.error('[Email] Failed to send password reset email:', err?.message);
    if (IS_DEV_MODE) {
      console.log(`[Email] Dev fallback - URL: ${resetUrl}`);
      return;
    }
    throw err;
  }
}

// ─── Magic link email ─────────────────────────────────────────────────────────

export async function sendMagicLinkEmail(email: string, magicLink: string): Promise<void> {
  if (!RESEND_KEY_VALID) {
    console.log('[Email] Magic link (set RESEND_API_KEY to send for real):');
    console.log(`  To:  ${email}`);
    console.log(`  URL: ${magicLink}`);
    return;
  }

  try {
    await resendSend({
      to: email,
      subject: `Your ${BRAND.name} sign-in link`,
      html: magicLinkHtml(magicLink, email),
      text: `Sign in to ${BRAND.name}\n\nClick this link to sign in: ${magicLink}\n\nThis link expires in 15 minutes.\n\nIf you didn't request this, just ignore this email.\n\n${BRAND.name} - ${BRAND.tagline}\n${BRAND.company} • ${BRAND.location}\n${BRAND.supportEmail}`,
    });
  } catch (err: any) {
    console.error('[Email] Failed to send magic link email:', err?.message);
    if (IS_DEV_MODE) {
      console.log(`[Email] Dev fallback - URL: ${magicLink}`);
      return;
    }
    throw err;
  }
}

// ─── Welcome onboarding email (after email verification) ──────────────────────

export async function sendWelcomeOnboardingEmail(email: string, userName: string): Promise<void> {
  if (!RESEND_KEY_VALID) {
    console.log(`[Email] Welcome onboarding (set RESEND_API_KEY to send for real): To: ${email}`);
    return;
  }

  try {
    await resendSend({
      to: email,
      subject: `Welcome to AiVIS - Your AI Visibility Audit Guide`,
      html: welcomeOnboardingHtml(email, userName),
      text: [
        `Welcome to AiVIS, ${userName || 'there'}!`,
        ``,
        `Your account is verified and ready to go. AiVIS measures how well AI search engines like ChatGPT, Perplexity, Google AI Overviews, and Claude can understand, extract, and cite your website.`,
        ``,
        `HOW TO USE AiVIS:`,
        `1. Run your first audit - paste any URL at ${FRONTEND_URL}/ and click Analyze`,
        `2. Understand your AI Visibility Score (0-100) across 6 categories`,
        `3. Follow the 8-12 AI-generated recommendations ranked by priority`,
        `4. Track your progress over time on the Analytics page`,
        `5. Export PDF & CSV reports to share with your team`,
        ``,
        `THE 6 CATEGORIES:`,
        `- Content Depth & Quality`,
        `- Heading Structure`,
        `- Schema & Structured Data`,
        `- Meta Tags & Open Graph`,
        `- Technical SEO`,
        `- AI Readability & Citability`,
        ``,
        `HELPFUL RESOURCES:`,
        `- Getting Started Guide: ${FRONTEND_URL}/guide`,
        `- FAQ (27 answers): ${FRONTEND_URL}/faq`,
        `- Why AI Visibility Matters: ${FRONTEND_URL}/why-ai-visibility`,
        `- AEO Playbook 2026: ${FRONTEND_URL}/aeo-playbook-2026`,
        `- GEO & AI Ranking 2026: ${FRONTEND_URL}/geo-ai-ranking-2026`,
        `- Insights Hub: ${FRONTEND_URL}/insights`,
        `- Plans & Pricing: ${FRONTEND_URL}/pricing`,
        ``,
        `Questions? Reply to this email or reach us at ${BRAND.supportEmail}.`,
        ``,
        `${BRAND.name} - ${BRAND.tagline}`,
        `${BRAND.company} • ${BRAND.location}`,
      ].join('\n'),
    });
  } catch (err: any) {
    // Non-critical: don't crash the verification flow if welcome email fails
    console.error('[Email] Failed to send welcome onboarding email:', err?.message);
  }
}

// ─── Workspace invite email ───────────────────────────────────────────────────

export async function sendWorkspaceInviteEmail(args: {
  to: string;
  inviteToken: string;
  senderName: string;
  workspaceName: string;
  role: string;
}): Promise<void> {
  const acceptUrl = `${FRONTEND_URL}/invite/${args.inviteToken}`;

  const body = `
          <tr>
            <td style="padding:40px;">
              <h1 style="margin:0 0 12px;font-size:24px;font-weight:700;color:#ffffff;">You've been invited!</h1>
              <p style="margin:0 0 24px;color:#cbd5e1;font-size:15px;line-height:1.6;">
                <strong style="color:#22d3ee;">${escapeEmailHtml(args.senderName)}</strong> invited you to join
                <strong style="color:#22d3ee;">${escapeEmailHtml(args.workspaceName)}</strong> as a
                <strong style="color:#ffffff;">${escapeEmailHtml(args.role)}</strong> on ${BRAND.name}.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 32px;">
                    <a href="${acceptUrl}"
                       style="display:inline-block;background:linear-gradient(135deg,#06b6d4,#22d3ee);color:#0f172a;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:10px;box-shadow:0 4px 14px rgba(6,182,212,0.4);">
                      Accept Invitation
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;color:#64748b;font-size:13px;">Or copy this link into your browser:</p>
              <p style="margin:0 0 24px;word-break:break-all;color:#22d3ee;font-size:12px;font-family:monospace;background:#0f172a;padding:12px;border-radius:8px;border:1px solid #334155;">${acceptUrl}</p>
              <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.6;">This invitation expires in <strong style="color:#cbd5e1;">7 days</strong>. If you didn't expect this, you can safely ignore it.</p>
            </td>
          </tr>`;

  try {
    await resendSend({
      to: args.to,
      subject: `${args.senderName} invited you to ${args.workspaceName} on ${BRAND.name}`,
      html: emailWrap(
        `Workspace Invitation - ${BRAND.name}`,
        emailHeader() + body + emailFooter(args.to),
        `You received this email because you were invited to a workspace on aivis.biz`,
      ),
      text: [
        `${args.senderName} invited you to ${args.workspaceName} on ${BRAND.name}`,
        `Role: ${args.role}`,
        `Accept: ${acceptUrl}`,
        `This link expires in 7 days.`,
      ].join('\n\n'),
    });
  } catch (err: any) {
    console.error('[Email] Failed to send workspace invite:', err?.message);
  }
}

// ─── Usage cap upgrade email ──────────────────────────────────────────────────

export async function sendUsageCapEmail(
  email: string,
  userName: string,
  tierName: string,
  limit: number,
  resetsAt: string,
): Promise<void> {
  if (!RESEND_KEY_VALID) {
    console.log(`[Email] Usage cap (set RESEND_API_KEY to send for real): To: ${email} | Tier: ${tierName} | Limit: ${limit}`);
    return;
  }

  try {
    await resendSend({
      to: email,
      subject: `You've used all ${limit} ${BRAND.name} scans this month - here's what's next`,
      html: usageCapHtml(email, userName, tierName, limit, resetsAt),
      text: [
        `You've used all ${limit} scans this month, ${userName || 'there'}.`,
        `Your ${tierName} plan resets on ${new Date(resetsAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.`,
        ``,
        `WHY UPGRADING CHANGES THE GAME:`,
        ``,
        `1. AI search is replacing traditional search - ChatGPT, Perplexity, and Google AI Overviews are answering queries that used to drive organic clicks.`,
        `2. Competitor tracking shows you exactly who's winning in AI visibility.`,
        `3. Citation testing proves whether AI actually mentions your brand.`,
        `4. Reverse engineering reveals how AI models build their answers.`,
        `5. Triple-Check AI (Signal tier) validates every scan with 3 independent models.`,
        ``,
        `YOUR OPTIONS:`,
        `- Alignment: $9/month - 60 scans, competitor tracking, reverse engineering, exports`,
        `- Signal: $29/month - 110 scans, Triple-Check AI, citation testing, API, white-label`,
        ``,
        `View plans: ${FRONTEND_URL}/pricing`,
        ``,
        `WHILE YOU WAIT:`,
        `- Getting Started Guide: ${FRONTEND_URL}/guide`,
        `- AEO Playbook 2026: ${FRONTEND_URL}/aeo-playbook-2026`,
        `- Why AI Visibility Matters: ${FRONTEND_URL}/why-ai-visibility`,
        `- FAQ: ${FRONTEND_URL}/faq`,
        ``,
        `${BRAND.name} - ${BRAND.tagline}`,
        `${BRAND.company} • ${BRAND.location}`,
      ].join('\n'),
    });
  } catch (err: any) {
    // Non-critical: don't block the 429 response if email fails
    console.error('[Email] Failed to send usage cap email:', err?.message);
  }
}

export type PlatformNewsletterEmailArgs = {
  to: string;
  userName?: string;
  tierLabel: string;
  editionLabel: string;
  snapshot: {
    auditCount: number;
    latestScore: number | null;
  };
  pricingSummary: string[];
  referralSummary: string[];
  toolsSummary: string[];
};

export function renderPlatformNewsletterEmail(args: PlatformNewsletterEmailArgs): { subject: string; html: string; text: string } {

  const firstName = String(args.userName || '').trim() || 'there';
  const scoreLine = Number.isFinite(args.snapshot.latestScore as number)
    ? `Latest visibility score: ${args.snapshot.latestScore}`
    : 'Run your next audit to capture your latest visibility score.';

  const html = newsletterHtml(args);
  const text = [
    `AiVIS Weekly Newsletter - ${args.editionLabel}`,
    `Hi ${firstName},`,
    '',
    `Your tier: ${args.tierLabel}`,
    `Audits completed: ${args.snapshot.auditCount}`,
    scoreLine,
    '',
    'PRICING SNAPSHOT:',
    ...args.pricingSummary.map((line) => `- ${line}`),
    '',
    'REFERRAL UPDATE:',
    ...args.referralSummary.map((line) => `- ${line}`),
    '',
    'TOOLS IN FOCUS:',
    ...args.toolsSummary.map((line) => `- ${line}`),
    '',
    `Open app: ${FRONTEND_URL}/`,
    `Pricing: ${FRONTEND_URL}/pricing`,
    `FAQ: ${FRONTEND_URL}/faq`,
    `Billing & referrals: ${FRONTEND_URL}/billing#referrals`,
    '',
    `${BRAND.name} - ${BRAND.tagline}`,
    `${BRAND.company} • ${BRAND.location}`,
  ].join('\n');

  return {
    subject: `${BRAND.name} Weekly - ${args.editionLabel} | Pricing, referrals, and tool deep-dives`,
    html,
    text,
  };
}

export async function sendPlatformNewsletterEmail(args: PlatformNewsletterEmailArgs): Promise<void> {
  if (!RESEND_KEY_VALID) {
    console.log(`[Email] Newsletter (set RESEND_API_KEY to send for real): To: ${args.to} | Edition: ${args.editionLabel}`);
    return;
  }

  const rendered = renderPlatformNewsletterEmail(args);

  await resendSend({
    to: args.to,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
  });
}

function newsletterHtml(args: PlatformNewsletterEmailArgs): string {
  const firstName = String(args.userName || '').trim() || 'there';
  const scoreLine = Number.isFinite(args.snapshot.latestScore as number)
    ? `Latest visibility score: <strong>${args.snapshot.latestScore}</strong>`
    : 'Run your next audit to capture your latest visibility score.';

  const list = (items: string[]) => items.map((line) => `<li style="margin:0 0 8px;">${line}</li>`).join('');
  
  // Escape HTML special characters to prevent email injection
  const escapeHtml = (text: string): string => {
    const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return text.replace(/[&<>"']/g, (c) => map[c]);
  };
  
  const safeFirstName = escapeHtml(firstName);

  const body = `
          ${emailHeader('linear-gradient(135deg,#0ea5e9,#8b5cf6)')}
          <tr>
            <td style="padding:28px 36px 10px;background:#111827;color:#e5e7eb;">
              <p style="margin:0 0 8px;font-size:14px;">Hi ${safeFirstName},</p>
              <h1 style="margin:0 0 10px;font-size:22px;line-height:1.25;color:#ffffff;">${BRAND.name} Weekly - ${args.editionLabel}</h1>
              <p style="margin:0 0 8px;font-size:14px;color:#cbd5e1;">Tier: <strong>${args.tierLabel}</strong> • Audits completed: <strong>${args.snapshot.auditCount}</strong></p>
              <p style="margin:0 0 8px;font-size:14px;color:#cbd5e1;">${scoreLine}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 36px 26px;background:#111827;color:#cbd5e1;">
              <div style="border:1px solid #334155;border-radius:12px;padding:16px;background:#0f172a;margin-bottom:12px;">
                <h2 style="margin:0 0 10px;font-size:14px;color:#f8fafc;letter-spacing:.4px;text-transform:uppercase;">Pricing Snapshot</h2>
                <ul style="padding-left:18px;margin:0;line-height:1.5;">${list(args.pricingSummary)}</ul>
              </div>
              <div style="border:1px solid #334155;border-radius:12px;padding:16px;background:#0f172a;margin-bottom:12px;">
                <h2 style="margin:0 0 10px;font-size:14px;color:#f8fafc;letter-spacing:.4px;text-transform:uppercase;">Referral Update</h2>
                <ul style="padding-left:18px;margin:0;line-height:1.5;">${list(args.referralSummary)}</ul>
              </div>
              <div style="border:1px solid #334155;border-radius:12px;padding:16px;background:#0f172a;">
                <h2 style="margin:0 0 10px;font-size:14px;color:#f8fafc;letter-spacing:.4px;text-transform:uppercase;">Tools Deep-Dive</h2>
                <ul style="padding-left:18px;margin:0;line-height:1.5;">${list(args.toolsSummary)}</ul>
              </div>
              <p style="margin:14px 0 0;font-size:13px;line-height:1.6;">
                Open app: <a href="${FRONTEND_URL}/" style="color:#22d3ee;text-decoration:none;">Dashboard</a>
                &nbsp;•&nbsp;
                <a href="${FRONTEND_URL}/pricing" style="color:#22d3ee;text-decoration:none;">Pricing</a>
                &nbsp;•&nbsp;
                <a href="${FRONTEND_URL}/faq" style="color:#22d3ee;text-decoration:none;">FAQ</a>
                &nbsp;•&nbsp;
                <a href="${FRONTEND_URL}/billing#referrals" style="color:#22d3ee;text-decoration:none;">Referrals</a>
              </p>
            </td>
          </tr>
          ${emailFooter(args.to)}
  `;

  return emailWrap(
    `${BRAND.name} Weekly Newsletter`,
    body,
    `You are receiving this update because you created a ${BRAND.name} account at ${BRAND.siteUrl}.`
  );
}

// ─── Shared email building blocks ─────────────────────────────────────────────

/** Branded header with logo - reused across all emails */
function emailHeader(accentGradient: string = 'linear-gradient(135deg,#06b6d4,#8b5cf6)'): string {
  return `
          <!-- Header with logo -->
          <tr>
            <td style="background:${accentGradient};padding:32px 40px;text-align:center;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${BRAND.siteUrl}" style="text-decoration:none;">
                      <img src="${BRAND.logoUrl}" alt="${BRAND.name}" width="56" height="56"
                           style="width:56px;height:56px;border-radius:14px;border:2px solid rgba(255,255,255,0.25);display:block;margin:0 auto;" />
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top:14px;">
                    <a href="${BRAND.siteUrl}" style="text-decoration:none;">
                      <span style="font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">${BRAND.name}</span>
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top:4px;">
                    <span style="font-size:11px;color:rgba(255,255,255,0.75);letter-spacing:1.5px;text-transform:uppercase;font-weight:500;">${BRAND.tagline}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
}

/** Branded footer - reused across all emails */
function emailFooter(recipientEmail: string): string {
  return `
          <!-- Footer -->
          <tr>
            <td style="padding:28px 40px;border-top:1px solid #334155;background:#0f172a;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:16px;">
                    <a href="${BRAND.siteUrl}" style="text-decoration:none;">
                      <img src="${BRAND.logoUrl}" alt="${BRAND.name}" width="28" height="28"
                           style="width:28px;height:28px;border-radius:7px;display:inline-block;vertical-align:middle;" />
                      <span style="font-size:14px;font-weight:700;color:#94a3b8;vertical-align:middle;margin-left:8px;letter-spacing:-0.3px;">${BRAND.name}</span>
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="color:#64748b;font-size:12px;line-height:1.6;text-align:center;">
                    <p style="margin:0 0 6px;">Sent to <span style="color:#94a3b8;">${escapeEmailHtml(recipientEmail)}</span></p>
                    <p style="margin:0 0 6px;">${BRAND.company} &bull; ${BRAND.location}</p>
                    <p style="margin:0;">
                      <a href="mailto:${BRAND.supportEmail}" style="color:#22d3ee;text-decoration:none;">${BRAND.supportEmail}</a>
                      &nbsp;&middot;&nbsp;
                      <a href="${BRAND.siteUrl}" style="color:#22d3ee;text-decoration:none;">aivis.biz</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
}

/** Outer email wrapper - dark bg, centered card */
function emailWrap(title: string, innerRows: string, antiSpamText: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:16px;border:1px solid #334155;overflow:hidden;max-width:560px;">
          ${innerRows}
        </table>
        <!-- Anti-spam footer -->
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;">
          <tr>
            <td style="padding:24px 16px;text-align:center;">
              <p style="margin:0;color:#475569;font-size:11px;">${antiSpamText}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── HTML templates ───────────────────────────────────────────────────────────

function verificationHtml(
  verificationUrl: string,
  email: string,
  expiryLabel: string,
  reason: VerificationEmailOptions['reason'] = 'signup'
): string {
  const reasonLabel = reason === 'oauth_signin'
    ? 'OAuth sign-in verification'
    : reason === 'resend'
      ? 'Requested verification resend'
      : 'New account verification';
  const body = `
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h1 style="margin:0 0 12px;font-size:24px;font-weight:700;color:#ffffff;">Verify your account</h1>
              <p style="margin:0 0 10px;color:#94a3b8;font-size:12px;letter-spacing:1px;text-transform:uppercase;">${reasonLabel}</p>
              <p style="margin:0 0 24px;color:#cbd5e1;font-size:15px;line-height:1.6;">
                Thank you for registering with <strong style="color:#22d3ee;">${BRAND.name}</strong>.
                Please confirm your email address to activate your account and continue securely.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 32px;">
                    <a href="${verificationUrl}"
                       style="display:inline-block;background:linear-gradient(135deg,#06b6d4,#8b5cf6);color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:10px;box-shadow:0 4px 14px rgba(6,182,212,0.4);">
                      Verify Email
                    </a>
                  </td>
                </tr>
              </table>
              <!-- What you get -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border:1px solid #334155;border-radius:12px;margin-bottom:28px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 12px;color:#94a3b8;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Enterprise trust and governance</p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr><td style="padding:4px 0;color:#cbd5e1;font-size:14px;">&nbsp; Identity-verified session start with expiring verification link</td></tr>
                      <tr><td style="padding:4px 0;color:#cbd5e1;font-size:14px;">&nbsp; Structured audit evidence with recommendation traceability</td></tr>
                      <tr><td style="padding:4px 0;color:#cbd5e1;font-size:14px;">&nbsp; Security and compliance docs for stakeholder review</td></tr>
                      <tr><td style="padding:4px 0;color:#cbd5e1;font-size:14px;">&nbsp; Support escalation path: <a href="mailto:${BRAND.supportEmail}" style="color:#22d3ee;text-decoration:none;">${BRAND.supportEmail}</a></td></tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b1220;border:1px solid #1e293b;border-radius:12px;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 20px;color:#cbd5e1;">
                    <p style="margin:0 0 6px;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:.8px;">Verification window</p>
                    <p style="margin:0;font-size:14px;line-height:1.6;">This secure link expires in <strong style="color:#ffffff;">${expiryLabel}</strong>. If it expires, request a new verification email from the sign-in page.</p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;color:#64748b;font-size:13px;">Or copy this link into your browser:</p>
              <p style="margin:0 0 24px;word-break:break-all;color:#22d3ee;font-size:12px;font-family:monospace;background:#0f172a;padding:12px;border-radius:8px;border:1px solid #334155;">${verificationUrl}</p>
              <p style="margin:0 0 12px;color:#94a3b8;font-size:13px;line-height:1.6;">This link expires in <strong style="color:#cbd5e1;">${expiryLabel}</strong>. If you did not sign up for ${BRAND.name}, you can safely ignore this message.</p>
              <p style="margin:0;color:#64748b;font-size:12px;line-height:1.7;">Review our <a href="${BRAND.siteUrl}/privacy" style="color:#22d3ee;text-decoration:none;">Privacy Policy</a>, <a href="${BRAND.siteUrl}/terms" style="color:#22d3ee;text-decoration:none;">Terms</a>, and <a href="${BRAND.siteUrl}/compliance" style="color:#22d3ee;text-decoration:none;">Compliance page</a> for platform security and governance details.</p>
            </td>
          </tr>`;

  return emailWrap(
    `Verify your ${BRAND.name} account`,
    emailHeader() + body + emailFooter(email),
    `You received this email because you created an account at aivis.biz`
  );
}

function resetHtml(resetUrl: string, email: string): string {
  const body = `
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#ffffff;">Reset your password</h1>
              <p style="margin:0 0 24px;color:#cbd5e1;font-size:15px;line-height:1.6;">
                We got a request to reset your <strong style="color:#22d3ee;">${BRAND.name}</strong> password.
                If that was you, click below to set a new one. If you didn't ask for this, just ignore this email and nothing changes.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 32px;">
                    <a href="${resetUrl}"
                       style="display:inline-block;background:#ef4444;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:10px;box-shadow:0 4px 14px rgba(239,68,68,0.3);">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 24px;color:#475569;font-size:13px;">This link expires in <strong style="color:#94a3b8;">1 hour</strong> for security reasons.</p>
              <p style="margin:0 0 8px;color:#64748b;font-size:13px;">Or copy this link:</p>
              <p style="margin:0;word-break:break-all;color:#f87171;font-size:12px;font-family:monospace;background:#0f172a;padding:12px;border-radius:8px;border:1px solid #334155;">${resetUrl}</p>
            </td>
          </tr>`;

  return emailWrap(
    `Reset your ${BRAND.name} password`,
    emailHeader('linear-gradient(135deg,#ef4444,#b91c1c)') + body + emailFooter(email),
    `You received this because a password reset was requested for this email at aivis.biz`
  );
}

function magicLinkHtml(magicLink: string, email: string): string {
  const body = `
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#ffffff;">Sign in to ${BRAND.name}</h1>
              <p style="margin:0 0 24px;color:#cbd5e1;font-size:15px;line-height:1.6;">
                Click the button below to sign in to your <strong style="color:#22d3ee;">${BRAND.name}</strong> account.
                This link expires in 15 minutes.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 32px;">
                    <a href="${magicLink}"
                       style="display:inline-block;background:linear-gradient(135deg,#06b6d4,#8b5cf6);color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:10px;box-shadow:0 4px 14px rgba(6,182,212,0.3);">
                      Sign In
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;color:#64748b;font-size:13px;">Or copy this link:</p>
              <p style="margin:0;word-break:break-all;color:#22d3ee;font-size:12px;font-family:monospace;background:#0f172a;padding:12px;border-radius:8px;border:1px solid #334155;">${magicLink}</p>
            </td>
          </tr>`;

  return emailWrap(
    `Sign in to ${BRAND.name}`,
    emailHeader() + body + emailFooter(email),
    `You received this because a sign-in was requested for this email at aivis.biz`
  );
}

// ─── Welcome onboarding email (sent after email verification) ─────────────────

function welcomeOnboardingHtml(email: string, userName: string): string {
  const dashboardUrl = `${FRONTEND_URL}/`;
  const analyzeUrl = `${FRONTEND_URL}/analyze`;
  const guideUrl = `${FRONTEND_URL}/guide`;
  const faqUrl = `${FRONTEND_URL}/faq`;
  const analyticsUrl = `${FRONTEND_URL}/analytics`;
  const pricingUrl = `${FRONTEND_URL}/pricing`;
  const whyUrl = `${FRONTEND_URL}/why-ai-visibility`;
  const insightsUrl = `${FRONTEND_URL}/insights`;
  const aeoUrl = `${FRONTEND_URL}/aeo-playbook-2026`;
  const geoUrl = `${FRONTEND_URL}/geo-ai-ranking-2026`;

  const greeting = userName ? userName.split(' ')[0] : 'there';

  const body = `
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h1 style="margin:0 0 8px;font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Welcome to AiVIS, ${greeting}.</h1>
              <p style="margin:0 0 28px;color:#94a3b8;font-size:14px;font-weight:500;">Your account is verified and ready to go.</p>

              <p style="margin:0 0 20px;color:#cbd5e1;font-size:15px;line-height:1.7;">
                AiVIS is the <strong style="color:#22d3ee;">Ai Visibility Intelligence Audits</strong> - the only platform
                that measures how well AI search engines like ChatGPT, Perplexity, Google AI Overviews, and Claude
                can understand, cite, and recommend your website. This is not traditional SEO. This is the citation layer -
                whether your content is structured, deep, and trustworthy enough for AI systems to confidently include in
                their generated answers.
              </p>

              <!-- Divider -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
                <tr><td style="border-top:1px solid #334155;"></td></tr>
              </table>

              <h2 style="margin:0 0 20px;font-size:18px;font-weight:700;color:#ffffff;">How to use AiVIS - Step by step</h2>

              <!-- Step 1 -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td width="36" valign="top" style="padding-right:14px;">
                    <div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#06b6d4,#8b5cf6);text-align:center;line-height:32px;font-size:14px;font-weight:700;color:#fff;">1</div>
                  </td>
                  <td>
                    <p style="margin:0 0 6px;color:#ffffff;font-size:15px;font-weight:600;">Run your first AI visibility audit</p>
                    <p style="margin:0;color:#94a3b8;font-size:14px;line-height:1.6;">
                      Head to your <a href="${dashboardUrl}" style="color:#22d3ee;text-decoration:underline;">Dashboard</a>
                      and paste any URL into the analyzer. AiVIS will crawl the live page in real time and score it across
                      six AI-visibility categories using frontier AI models. Your first scan takes about 15–25 seconds.
                      You get 10 free scans per month on the Observer plan.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Step 2 -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td width="36" valign="top" style="padding-right:14px;">
                    <div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#06b6d4,#8b5cf6);text-align:center;line-height:32px;font-size:14px;font-weight:700;color:#fff;">2</div>
                  </td>
                  <td>
                    <p style="margin:0 0 6px;color:#ffffff;font-size:15px;font-weight:600;">Understand your AI Visibility Score</p>
                    <p style="margin:0;color:#94a3b8;font-size:14px;line-height:1.6;">
                      Your score (0–100) tells you how well AI platforms can parse and recommend your site. It's graded A through F
                      across six categories: <strong style="color:#cbd5e1;">Content Depth</strong>, <strong style="color:#cbd5e1;">Heading Structure</strong>,
                      <strong style="color:#cbd5e1;">Schema &amp; Structured Data</strong>, <strong style="color:#cbd5e1;">Meta Tags</strong>,
                      <strong style="color:#cbd5e1;">Technical SEO</strong>, and <strong style="color:#cbd5e1;">AI Readability &amp; Citability</strong>.
                      Most websites score C or D on their first audit - that's normal and exactly why you're here.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Step 3 -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td width="36" valign="top" style="padding-right:14px;">
                    <div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#06b6d4,#8b5cf6);text-align:center;line-height:32px;font-size:14px;font-weight:700;color:#fff;">3</div>
                  </td>
                  <td>
                    <p style="margin:0 0 6px;color:#ffffff;font-size:15px;font-weight:600;">Follow the AI-generated recommendations</p>
                    <p style="margin:0;color:#94a3b8;font-size:14px;line-height:1.6;">
                      Every audit generates 8–12 actionable, evidence-linked recommendations ranked by priority and estimated impact.
                      These are not generic tips - they're specific to the page you scanned, referencing the actual content,
                      headings, schema, and markup found on your site. Implement the top 3 and re-scan to see your score climb.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Step 4 -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td width="36" valign="top" style="padding-right:14px;">
                    <div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#06b6d4,#8b5cf6);text-align:center;line-height:32px;font-size:14px;font-weight:700;color:#fff;">4</div>
                  </td>
                  <td>
                    <p style="margin:0 0 6px;color:#ffffff;font-size:15px;font-weight:600;">Track your progress over time</p>
                    <p style="margin:0;color:#94a3b8;font-size:14px;line-height:1.6;">
                      The <a href="${analyticsUrl}" style="color:#22d3ee;text-decoration:underline;">Analytics page</a>
                      shows your score history, category breakdowns, and trend charts so you can see exactly what's improving
                      and where you still need work. This is the proof that your changes are working.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Step 5 -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td width="36" valign="top" style="padding-right:14px;">
                    <div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#06b6d4,#8b5cf6);text-align:center;line-height:32px;font-size:14px;font-weight:700;color:#fff;">5</div>
                  </td>
                  <td>
                    <p style="margin:0 0 6px;color:#ffffff;font-size:15px;font-weight:600;">Export PDF &amp; CSV reports</p>
                    <p style="margin:0;color:#94a3b8;font-size:14px;line-height:1.6;">
                      Every audit can be downloaded as a full PDF report or CSV data export - perfect for sharing with
                      your team, clients, or stakeholders. The report includes your score, category grades, evidence, and
                      all recommendations with implementation steps.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 28px;">
                <tr><td style="border-top:1px solid #334155;"></td></tr>
              </table>

              <!-- What's scored -->
              <h2 style="margin:0 0 16px;font-size:18px;font-weight:700;color:#ffffff;">The 6 categories AiVIS scores</h2>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border:1px solid #334155;border-radius:12px;margin-bottom:28px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr><td style="padding:5px 0;color:#cbd5e1;font-size:14px;line-height:1.6;"> &nbsp;<strong style="color:#22d3ee;">Content Depth &amp; Quality</strong> - word count, topical coverage, authority signals</td></tr>
                      <tr><td style="padding:5px 0;color:#cbd5e1;font-size:14px;line-height:1.6;"> &nbsp;<strong style="color:#22d3ee;">Heading Structure</strong> - H1 presence, H2/H3 hierarchy, keyword alignment</td></tr>
                      <tr><td style="padding:5px 0;color:#cbd5e1;font-size:14px;line-height:1.6;"> &nbsp;<strong style="color:#22d3ee;">Schema &amp; Structured Data</strong> - JSON-LD markup types and completeness</td></tr>
                      <tr><td style="padding:5px 0;color:#cbd5e1;font-size:14px;line-height:1.6;"> &nbsp;<strong style="color:#22d3ee;">Meta Tags &amp; Open Graph</strong> - title, description, OG/Twitter cards</td></tr>
                      <tr><td style="padding:5px 0;color:#cbd5e1;font-size:14px;line-height:1.6;"> &nbsp;<strong style="color:#22d3ee;">Technical SEO</strong> - HTTPS, canonical tags, internal/external links</td></tr>
                      <tr><td style="padding:5px 0;color:#cbd5e1;font-size:14px;line-height:1.6;"> &nbsp;<strong style="color:#22d3ee;">AI Readability &amp; Citability</strong> - FAQ structure, definitions, extractability</td></tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Unlock more -->
              <h2 style="margin:0 0 16px;font-size:18px;font-weight:700;color:#ffffff;">What you can unlock next</h2>

              <p style="margin:0 0 16px;color:#94a3b8;font-size:14px;line-height:1.6;">
                Your free Observer plan gets you started - but the real competitive advantage comes from the full platform.
                Here's what Alignment ($9/mo) and Signal ($29/mo) subscribers get access to:
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border:1px solid #334155;border-radius:12px;margin-bottom:28px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr><td style="padding:5px 0;color:#cbd5e1;font-size:14px;line-height:1.6;"> &nbsp;<strong style="color:#f59e0b;">Competitor Tracking</strong> - benchmark your AI visibility against any competitor in real time</td></tr>
                      <tr><td style="padding:5px 0;color:#cbd5e1;font-size:14px;line-height:1.6;"> &nbsp;<strong style="color:#f59e0b;">Citation Testing</strong> - run live queries against ChatGPT, Perplexity, and Claude to see if they mention your brand</td></tr>
                      <tr><td style="padding:5px 0;color:#cbd5e1;font-size:14px;line-height:1.6;"> &nbsp;<strong style="color:#f59e0b;">Reverse Engineering</strong> - deconstruct how AI models build answers, then engineer your content to match</td></tr>
                      <tr><td style="padding:5px 0;color:#cbd5e1;font-size:14px;line-height:1.6;"> &nbsp;<strong style="color:#f59e0b;">Triple-Check AI</strong> - Signal tier scans are validated by 3 independent AI models, eliminating single-model bias</td></tr>
                      <tr><td style="padding:5px 0;color:#cbd5e1;font-size:14px;line-height:1.6;"> &nbsp;<strong style="color:#f59e0b;">100–200-400+ scans/month</strong> - enough to audit your entire site, track changes weekly, and monitor competitors</td></tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 32px;">
                    <a href="${analyzeUrl}"
                       style="display:inline-block;background:linear-gradient(135deg,#06b6d4,#8b5cf6);color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:16px 40px;border-radius:10px;box-shadow:0 4px 14px rgba(6,182,212,0.4);">
                      Run Your First Audit →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Resources -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 0;">
                <tr><td style="border-top:1px solid #334155;padding-top:24px;"></td></tr>
              </table>

              <h2 style="margin:0 0 16px;font-size:16px;font-weight:700;color:#ffffff;">Helpful resources</h2>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr><td style="padding:4px 0;font-size:14px;"><a href="${guideUrl}" style="color:#22d3ee;text-decoration:underline;">Getting Started Guide</a> <span style="color:#64748b;">- 8-step walkthrough of every feature</span></td></tr>
                <tr><td style="padding:4px 0;font-size:14px;"><a href="${faqUrl}" style="color:#22d3ee;text-decoration:underline;">FAQ (27 answers)</a> <span style="color:#64748b;">- scoring methodology, grading, and platform details</span></td></tr>
                <tr><td style="padding:4px 0;font-size:14px;"><a href="${whyUrl}" style="color:#22d3ee;text-decoration:underline;">Why AI Visibility Matters</a> <span style="color:#64748b;">- the case for optimizing for AI search engines</span></td></tr>
                <tr><td style="padding:4px 0;font-size:14px;"><a href="${aeoUrl}" style="color:#22d3ee;text-decoration:underline;">AEO Playbook 2026</a> <span style="color:#64748b;">- answer engine optimization strategies and tactics</span></td></tr>
                <tr><td style="padding:4px 0;font-size:14px;"><a href="${geoUrl}" style="color:#22d3ee;text-decoration:underline;">GEO &amp; AI Ranking 2026</a> <span style="color:#64748b;">- how generative AI ranking works</span></td></tr>
                <tr><td style="padding:4px 0;font-size:14px;"><a href="${insightsUrl}" style="color:#22d3ee;text-decoration:underline;">Insights Hub</a> <span style="color:#64748b;">- deep dives, research, and analysis</span></td></tr>
                <tr><td style="padding:4px 0;font-size:14px;"><a href="${pricingUrl}" style="color:#22d3ee;text-decoration:underline;">Plans &amp; Pricing</a> <span style="color:#64748b;">- see what each tier unlocks</span></td></tr>
              </table>

              <p style="margin:24px 0 0;color:#64748b;font-size:13px;line-height:1.6;">
                If you have any questions, reply to this email or reach us at
                <a href="mailto:${BRAND.supportEmail}" style="color:#22d3ee;text-decoration:none;">${BRAND.supportEmail}</a>.
                We read every message.
              </p>
            </td>
          </tr>`;

  return emailWrap(
    `Welcome to ${BRAND.name} - How to Use the Ai Visibility Intelligence Audits`,
    emailHeader() + body + emailFooter(email),
    `You received this because you verified your email at aivis.biz`
  );
}

// ─── Usage cap / upgrade email (sent when free tier hits monthly limit) ───────

function usageCapHtml(email: string, userName: string, tierName: string, limit: number, resetsAt: string): string {
  const pricingUrl = `${FRONTEND_URL}/pricing`;
  const guideUrl = `${FRONTEND_URL}/guide`;
  const faqUrl = `${FRONTEND_URL}/faq`;
  const whyUrl = `${FRONTEND_URL}/why-ai-visibility`;
  const insightsUrl = `${FRONTEND_URL}/insights`;
  const aeoUrl = `${FRONTEND_URL}/aeo-playbook-2026`;

  const greeting = userName ? userName.split(' ')[0] : 'there';
  const resetDate = new Date(resetsAt);
  const resetFormatted = resetDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const body = `
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h1 style="margin:0 0 8px;font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">You've used all ${limit} scans this month, ${greeting}.</h1>
              <p style="margin:0 0 28px;color:#94a3b8;font-size:14px;font-weight:500;">Your ${tierName} plan resets on ${resetFormatted}.</p>

              <p style="margin:0 0 24px;color:#cbd5e1;font-size:15px;line-height:1.7;">
                You hit your monthly audit limit; which means you're actively using AiVIS to improve your AI visibility.
                That's a good sign. The fact that you need more scans means your site is in active optimization, and that's
                exactly where the higher tiers pay for themselves.
              </p>

              <!-- Divider -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
                <tr><td style="border-top:1px solid #334155;"></td></tr>
              </table>

              <h2 style="margin:0 0 20px;font-size:18px;font-weight:700;color:#ffffff;">Why upgrading changes the game</h2>

              <!-- Reason 1 -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px;">
                <tr>
                  <td width="36" valign="top" style="padding-right:14px;">
                    <div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#f59e0b,#ef4444);text-align:center;line-height:32px;font-size:16px;"></div>
                  </td>
                  <td>
                    <p style="margin:0 0 4px;color:#ffffff;font-size:15px;font-weight:600;">AI search is replacing traditional search - right now</p>
                    <p style="margin:0;color:#94a3b8;font-size:14px;line-height:1.6;">
                      ChatGPT, Perplexity, Google AI Overviews, and Claude are answering questions that used to drive organic clicks.
                      If your content isn't structured for AI citation, you're becoming invisible to the fastest-growing discovery channel.
                      3 scans per month gives you a snapshot. 60 or 110 gives you a systematic optimization workflow.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Reason 2 -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px;">
                <tr>
                  <td width="36" valign="top" style="padding-right:14px;">
                    <div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#f59e0b,#ef4444);text-align:center;line-height:32px;font-size:16px;"></div>
                  </td>
                  <td>
                    <p style="margin:0 0 4px;color:#ffffff;font-size:15px;font-weight:600;">Competitor tracking shows you exactly who's winning</p>
                    <p style="margin:0;color:#94a3b8;font-size:14px;line-height:1.6;">
                      Alignment and Signal tiers unlock <strong style="color:#cbd5e1;">Competitor Tracking</strong> - benchmark your AI visibility
                      score against any competitor's page, side by side, across all six categories. You see exactly where they're ahead
                      and what specific content changes would close the gap. This feature alone has helped early users identify
                      schema gaps and content opportunities they'd completely missed.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Reason 3 -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px;">
                <tr>
                  <td width="36" valign="top" style="padding-right:14px;">
                    <div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#f59e0b,#ef4444);text-align:center;line-height:32px;font-size:16px;"></div>
                  </td>
                  <td>
                    <p style="margin:0 0 4px;color:#ffffff;font-size:15px;font-weight:600;">Citation testing proves whether AI actually mentions you</p>
                    <p style="margin:0;color:#94a3b8;font-size:14px;line-height:1.6;">
                      Signal tier includes <strong style="color:#cbd5e1;">Citation Testing</strong> - you submit real queries and AiVIS checks
                      whether ChatGPT, Perplexity, and Claude mention your brand, link to your site, or recommend you in their answers.
                      This is the ultimate validation: not just "is my content AI-ready" but "is AI actually citing me?"
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Reason 4 -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px;">
                <tr>
                  <td width="36" valign="top" style="padding-right:14px;">
                    <div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#f59e0b,#ef4444);text-align:center;line-height:32px;font-size:16px;"></div>
                  </td>
                  <td>
                    <p style="margin:0 0 4px;color:#ffffff;font-size:15px;font-weight:600;">Reverse engineering reveals how AI builds its answers</p>
                    <p style="margin:0;color:#94a3b8;font-size:14px;line-height:1.6;">
                      The <strong style="color:#cbd5e1;">Reverse Engineer</strong> toolset lets you deconstruct how AI models
                      assemble their responses; which sources they pull quickly from, how they weigh different content types, and some of the unique/common
                      patterns they favor. Then you engineer your content to match those patterns. It's the difference between
                      guessing and knowing evidence.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Reason 5 -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px;">
                <tr>
                  <td width="36" valign="top" style="padding-right:14px;">
                    <div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#f59e0b,#ef4444);text-align:center;line-height:32px;font-size:16px;"></div>
                  </td>
                  <td>
                    <p style="margin:0 0 4px;color:#ffffff;font-size:15px;font-weight:600;">Triple-Check AI eliminates single-model bias</p>
                    <p style="margin:0;color:#94a3b8;font-size:14px;line-height:1.6;">
                      On the Signal plan, every scan is reviewed by 3 independent AI models in sequence: deep analysis, peer critique,
                      and validation gate. This catches inflated or deflated scores that a single model might produce. Your final score
                      is real and battle tested across three different perspectives, giving you the most reliable, honest, no-fluff AI visibility measurement and real score fixes and improvement available.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 28px;">
                <tr><td style="border-top:1px solid #334155;"></td></tr>
              </table>

              <!-- Pricing comparison -->
              <h2 style="margin:0 0 16px;font-size:18px;font-weight:700;color:#ffffff;">Your options</h2>

              <!-- Alignment tier -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border:1px solid #334155;border-radius:12px;margin-bottom:14px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td>
                          <span style="font-size:16px;font-weight:700;color:#22d3ee;">Alignment</span>
                          <span style="color:#94a3b8;font-size:14px;"> - $9/month</span>
                        </td>
                      </tr>
                      <tr><td style="padding:6px 0 0;color:#cbd5e1;font-size:13px;line-height:1.6;">60 scans/month &bull; Competitor tracking &bull; Reverse engineering tools &bull; PDF &amp; CSV exports</td></tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Signal tier -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border:2px solid #f59e0b;border-radius:12px;margin-bottom:28px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td>
                          <span style="font-size:16px;font-weight:700;color:#f59e0b;">Signal</span>
                          <span style="color:#94a3b8;font-size:14px;"> - $29/month</span>
                          <span style="display:inline-block;background:#f59e0b;color:#0f172a;font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;margin-left:8px;vertical-align:middle;">MOST POPULAR</span>
                        </td>
                      </tr>
                      <tr><td style="padding:6px 0 0;color:#cbd5e1;font-size:13px;line-height:1.6;">110 scans/month &bull; Triple-Check AI (3 models) &bull; Citation testing &bull; All Alignment features &bull; API access &bull; White-label reports</td></tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:0 0 32px;">
                    <a href="${pricingUrl}"
                       style="display:inline-block;background:linear-gradient(135deg,#f59e0b,#ef4444);color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:16px 40px;border-radius:10px;box-shadow:0 4px 14px rgba(245,158,11,0.4);">
                      View Plans &amp; Upgrade →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Resources -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 0;">
                <tr><td style="border-top:1px solid #334155;padding-top:24px;"></td></tr>
              </table>

              <h2 style="margin:0 0 16px;font-size:16px;font-weight:700;color:#ffffff;">While you wait for your scans to reset</h2>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr><td style="padding:4px 0;font-size:14px;"><a href="${guideUrl}" style="color:#22d3ee;text-decoration:underline;">Getting Started Guide</a> <span style="color:#64748b;">- review the 8-step walkthrough to maximize your next scans</span></td></tr>
                <tr><td style="padding:4px 0;font-size:14px;"><a href="${aeoUrl}" style="color:#22d3ee;text-decoration:underline;">AEO Playbook 2026</a> <span style="color:#64748b;">- answer engine optimization strategies to implement today</span></td></tr>
                <tr><td style="padding:4px 0;font-size:14px;"><a href="${whyUrl}" style="color:#22d3ee;text-decoration:underline;">Why AI Visibility Matters</a> <span style="color:#64748b;">- share with your team to build the case internally</span></td></tr>
                <tr><td style="padding:4px 0;font-size:14px;"><a href="${insightsUrl}" style="color:#22d3ee;text-decoration:underline;">Insights Hub</a> <span style="color:#64748b;">- research and deep dives on AI search optimization</span></td></tr>
                <tr><td style="padding:4px 0;font-size:14px;"><a href="${faqUrl}" style="color:#22d3ee;text-decoration:underline;">FAQ</a> <span style="color:#64748b;">- 27 answers about scoring, methodology, and platform features</span></td></tr>
              </table>

              <p style="margin:24px 0 0;color:#64748b;font-size:13px;line-height:1.6;">
                Your scans reset automatically on <strong style="color:#94a3b8;">${resetFormatted}</strong>.
                If you have questions about which plan fits your workflow, just reply to this email - we'll help you figure it out.
              </p>
            </td>
          </tr>`;

  return emailWrap(
    `You've hit your scan limit - here's what's next`,
    emailHeader('linear-gradient(135deg,#f59e0b,#ef4444)') + body + emailFooter(email),
    `You received this because your ${tierName} plan reached its monthly scan limit at aivis.biz`
  );
}

// ─── Admin broadcast email - custom one-off announcements ─────────────────────

export interface BroadcastEmailArgs {
  subject: string;
  headline: string;
  body: string;       // plain text body (paragraphs separated by \n\n)
  ctaLabel?: string;
  ctaUrl?: string;
}

export function renderBroadcastEmail(args: BroadcastEmailArgs, recipientEmail: string): { subject: string; html: string; text: string } {
  const paragraphs = String(args.body || '').split(/\n\n+/).filter(Boolean);
  const htmlParagraphs = paragraphs
    .map((p) => `<p style="margin:0 0 14px;color:#cbd5e1;font-size:15px;line-height:1.7;">${escapeEmailHtml(p)}</p>`)
    .join('\n              ');

  const ctaBlock = args.ctaLabel && args.ctaUrl
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 16px;">
                <tr>
                  <td align="center">
                    <a href="${encodeURI(args.ctaUrl)}" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#22d3ee,#6366f1);color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;border-radius:10px;">${escapeEmailHtml(args.ctaLabel)}</a>
                  </td>
                </tr>
              </table>`
    : '';

  const html = emailWrap(
    escapeEmailHtml(args.subject),
    emailHeader('linear-gradient(135deg,#6366f1,#22d3ee)') +
    `<tr>
            <td style="padding:28px 32px 32px;">
              <h2 style="margin:0 0 18px;font-size:22px;font-weight:700;color:#ffffff;">${escapeEmailHtml(args.headline)}</h2>
              ${htmlParagraphs}
              ${ctaBlock}
            </td>
          </tr>` +
    emailFooter(recipientEmail),
    `You received this because you have an account at aivis.biz`
  );

  const textLines = [
    args.headline,
    '',
    ...paragraphs,
    '',
    ...(args.ctaLabel && args.ctaUrl ? [`${args.ctaLabel}: ${args.ctaUrl}`, ''] : []),
    `${BRAND.name} - ${BRAND.tagline}`,
    `${BRAND.company} • ${BRAND.location}`,
  ];

  return { subject: args.subject, html, text: textLines.join('\n') };
}

export async function sendBroadcastEmail(args: BroadcastEmailArgs, recipientEmail: string): Promise<void> {
  const rendered = renderBroadcastEmail(args, recipientEmail);
  await resendSend({ to: recipientEmail, subject: rendered.subject, html: rendered.html, text: rendered.text });
}
