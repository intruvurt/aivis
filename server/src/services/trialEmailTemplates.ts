/**
 * Trial Email Templates — branded email payloads for the trial lifecycle.
 * Uses the existing resendSend() pattern from emailService.ts.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM_EMAIL = process.env.FROM_EMAIL || 'AiVIS <noreply@mailer.aivis.biz>';
const FRONTEND_URL = (process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || 'https://aivis.biz')
  .split(',')[0]
  .trim()
  .replace(/\/+$/, '');

const IS_DEV_MODE = FRONTEND_URL.includes('localhost') || process.env.NODE_ENV === 'development';

export type TrialEmailType =
  | 'trial_started'
  | 'trial_warning_day10'
  | 'trial_warning_day13'
  | 'trial_expired'
  | 'trial_converted';

interface TrialEmailContext {
  trialEndsAt?: string;
  daysLeft?: number;
  newTier?: string;
}

// ─── Resend helper (mirrors emailService pattern) ─────────────────────────────

async function resendSend(payload: { to: string; subject: string; html: string; text: string }): Promise<void> {
  if (!RESEND_API_KEY) {
    console.log(`[TrialEmail] No RESEND_API_KEY — console fallback: To: ${payload.to} | Subject: ${payload.subject}`);
    return;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    throw new Error(`Resend API error ${res.status}: ${(body?.message as string) || res.statusText}`);
  }

  const result = (await res.json()) as Record<string, unknown>;
  console.log(`[TrialEmail] Sent — id: ${result?.id} | to: ${payload.to}`);
}

// ─── Template builder ─────────────────────────────────────────────────────────

function buildTrialEmailPayload(
  emailType: TrialEmailType,
  ctx: TrialEmailContext,
): { subject: string; html: string; text: string } {
  switch (emailType) {
    case 'trial_started':
      return {
        subject: 'Your 14-day AiVIS Signal trial is active',
        text: `Your AiVIS Signal trial is now active. It expires on ${ctx.trialEndsAt || 'in 14 days'}. Log in at ${FRONTEND_URL} to run your first audit.`,
        html: wrap(`
          <h1 style="margin:0 0 12px;font-size:24px;color:#ffffff;">Your Signal trial is live</h1>
          <p style="color:#cbd5e1;font-size:15px;line-height:1.7;">
            You now have full access to Signal-tier features including the triple-check AI pipeline, fixpacks, and citation testing.
          </p>
          <p style="color:#cbd5e1;font-size:15px;line-height:1.7;">
            Your trial expires <strong style="color:#67e8f9;">${formatDate(ctx.trialEndsAt)}</strong>.
          </p>
          ${ctaButton('Run your first audit', `${FRONTEND_URL}/dashboard`)}
          <p style="margin:18px 0 0;color:#94a3b8;font-size:12px;">No credit card required during the trial.</p>
        `),
      };

    case 'trial_warning_day10':
      return {
        subject: `AiVIS Signal trial — ${ctx.daysLeft ?? 4} days remaining`,
        text: `Your AiVIS Signal trial has ${ctx.daysLeft ?? 4} days left. Upgrade to keep your features: ${FRONTEND_URL}/billing`,
        html: wrap(`
          <h1 style="margin:0 0 12px;font-size:24px;color:#ffffff;">${ctx.daysLeft ?? 4} days left on your Signal trial</h1>
          <p style="color:#cbd5e1;font-size:15px;line-height:1.7;">
            Your trial ends on <strong style="color:#f59e0b;">${formatDate(ctx.trialEndsAt)}</strong>.
            After that, your account will revert to the Observer (free) plan.
          </p>
          <p style="color:#cbd5e1;font-size:15px;line-height:1.7;">
            Upgrade now to keep triple-check audits, fixpacks, and citation testing.
          </p>
          ${ctaButton('Upgrade to Signal', `${FRONTEND_URL}/billing`)}
        `),
      };

    case 'trial_warning_day13':
      return {
        subject: 'AiVIS Signal trial expires tomorrow',
        text: `Your AiVIS Signal trial expires tomorrow. Upgrade now to avoid losing access: ${FRONTEND_URL}/billing`,
        html: wrap(`
          <h1 style="margin:0 0 12px;font-size:24px;color:#ef4444;">Your trial expires tomorrow</h1>
          <p style="color:#cbd5e1;font-size:15px;line-height:1.7;">
            This is your final reminder. After your trial ends, you'll lose access to Signal-exclusive features.
          </p>
          ${ctaButton('Upgrade now', `${FRONTEND_URL}/billing`)}
          <p style="margin:18px 0 0;color:#94a3b8;font-size:12px;">
            Questions? Reply to this email or contact support@aivis.biz.
          </p>
        `),
      };

    case 'trial_expired':
      return {
        subject: 'Your AiVIS Signal trial has ended',
        text: `Your 14-day AiVIS Signal trial has expired. Your account is now on the Observer (free) plan. Upgrade anytime at ${FRONTEND_URL}/billing`,
        html: wrap(`
          <h1 style="margin:0 0 12px;font-size:24px;color:#ffffff;">Trial ended</h1>
          <p style="color:#cbd5e1;font-size:15px;line-height:1.7;">
            Your 14-day Signal trial is over. Your account has been moved to the Observer (free) plan.
          </p>
          <p style="color:#cbd5e1;font-size:15px;line-height:1.7;">
            You can upgrade anytime to pick up where you left off.
          </p>
          ${ctaButton('View plans', `${FRONTEND_URL}/billing`)}
        `),
      };

    case 'trial_converted':
      return {
        subject: 'Welcome to AiVIS — subscription confirmed',
        text: `Congratulations! You've upgraded to the ${ctx.newTier || 'paid'} plan. Log in at ${FRONTEND_URL}/dashboard to continue.`,
        html: wrap(`
          <h1 style="margin:0 0 12px;font-size:24px;color:#22d3ee;">You're all set</h1>
          <p style="color:#cbd5e1;font-size:15px;line-height:1.7;">
            Your subscription to <strong style="color:#67e8f9;">${escapeHtml(ctx.newTier || 'a paid plan')}</strong> is confirmed.
            Your trial has been marked as converted — no interruption to your audits.
          </p>
          ${ctaButton('Go to dashboard', `${FRONTEND_URL}/dashboard`)}
        `),
      };

    default:
      return { subject: 'AiVIS notification', text: 'You have a new notification from AiVIS.', html: wrap('<p>You have a new notification from AiVIS.</p>') };
  }
}

// ─── Public send helper ───────────────────────────────────────────────────────

export async function sendTrialEmail(
  to: string,
  emailType: TrialEmailType,
  ctx: TrialEmailContext,
): Promise<void> {
  const payload = buildTrialEmailPayload(emailType, ctx);
  await resendSend({ to, ...payload });
}

// ─── HTML helpers ─────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDate(iso?: string): string {
  if (!iso) return 'soon';
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

function ctaButton(label: string, href: string): string {
  return `
    <div style="margin:20px 0;">
      <a href="${href}" style="display:inline-block;padding:12px 28px;background:#0ea5e9;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">${escapeHtml(label)}</a>
    </div>`;
}

function wrap(body: string): string {
  return `
    <div style="background:#0f172a;color:#e5e7eb;padding:24px;font-family:Arial,Helvetica,sans-serif;">
      <div style="max-width:600px;margin:0 auto;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:28px;background:#111827;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.12em;color:#94a3b8;margin-bottom:16px;">AiVIS — AI Visibility Engine</div>
        ${body}
        <div style="margin-top:28px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.06);color:#64748b;font-size:11px;line-height:1.6;">
          <p style="margin:0;">AiVIS by Intruvurt Labs · Georgia, USA</p>
          <p style="margin:4px 0 0;">
            <a href="https://aivis.biz" style="color:#64748b;text-decoration:none;">aivis.biz</a>
            &nbsp;·&nbsp;
            <a href="mailto:support@aivis.biz" style="color:#64748b;text-decoration:none;">support@aivis.biz</a>
          </p>
        </div>
      </div>
    </div>`;
}
