/**
 * Trend Alert Emails - sends score drop notifications to users
 * after scheduled rescans detect a significant visibility decrease.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM_EMAIL = process.env.FROM_EMAIL || 'AiVIS.biz <noreply@mailer.aivis.biz>';
const FRONTEND_URL = (process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || 'https://aivis.biz')
  .split(',')[0]
  .trim()
  .replace(/\/+$/, '');

async function resendSend(payload: { to: string; subject: string; html: string; text: string }): Promise<void> {
  if (!RESEND_API_KEY) {
    console.log(`[TrendAlert] No RESEND_API_KEY - console fallback: To: ${payload.to} | Subject: ${payload.subject}`);
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
  console.log(`[TrendAlert] Sent - id: ${result?.id} | to: ${payload.to}`);
}

interface ScoreDropAlertPayload {
  to: string;
  url: string;
  previousScore: number;
  currentScore: number;
  drop: number;
}

export async function sendScoreDropAlert(payload: ScoreDropAlertPayload): Promise<void> {
  const { to, url, previousScore, currentScore, drop } = payload;
  const dashboardUrl = `${FRONTEND_URL}/analytics`;

  const subject = `⚠️ Visibility score dropped ${drop} points for ${url}`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #1e2330; color: #e0e0e0; border-radius: 12px;">
      <h2 style="color: #f5a623; margin: 0 0 16px 0; font-size: 20px;">Score Drop Alert</h2>
      <p style="margin: 0 0 12px 0; line-height: 1.6;">
        Your AI visibility score for <strong style="color: #ffffff;">${url}</strong> has dropped by <strong style="color: #ef4444;">${drop} points</strong>.
      </p>
      <div style="display: flex; gap: 16px; margin: 16px 0; padding: 16px; background: #2a3040; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
        <div style="text-align: center; flex: 1;">
          <div style="font-size: 28px; font-weight: 700; color: #ffffff;">${previousScore}</div>
          <div style="font-size: 11px; color: #999; text-transform: uppercase;">Previous</div>
        </div>
        <div style="text-align: center; flex: 0; font-size: 24px; color: #ef4444; align-self: center;">→</div>
        <div style="text-align: center; flex: 1;">
          <div style="font-size: 28px; font-weight: 700; color: #ef4444;">${currentScore}</div>
          <div style="font-size: 11px; color: #999; text-transform: uppercase;">Current</div>
        </div>
      </div>
      <p style="margin: 12px 0; line-height: 1.6; font-size: 14px; color: #aab;">
        This usually means the page content, structure, or schema changed in a way that reduces AI extractability. Check the latest audit for specific recommendations.
      </p>
      <a href="${dashboardUrl}" style="display: inline-block; margin-top: 12px; padding: 10px 20px; background: #f5a623; color: #1e2330; font-weight: 600; border-radius: 8px; text-decoration: none; font-size: 14px;">View Analytics Dashboard</a>
      <p style="margin-top: 20px; font-size: 11px; color: #666;">This alert was triggered by a scheduled rescan in AiVIS.biz.</p>
    </div>
  `;

  const text = `Score Drop Alert\n\nYour AI visibility score for ${url} dropped by ${drop} points (${previousScore} → ${currentScore}).\n\nCheck your dashboard: ${dashboardUrl}\n\nThis alert was triggered by a scheduled rescan in AiVIS.biz.`;

  await resendSend({ to, subject, html, text });
}

interface CitationDropAlertPayload {
  to: string;
  url: string;
  previousMentionRate: number;
  currentMentionRate: number;
  drop: number;
}

export async function sendCitationDropAlert(payload: CitationDropAlertPayload): Promise<void> {
  const { to, url, previousMentionRate, currentMentionRate, drop } = payload;
  const dashboardUrl = `${FRONTEND_URL}/citations`;

  const subject = `\u26A0\uFE0F Citation mention rate dropped ${drop.toFixed(0)}% for ${url}`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #1e2330; color: #e0e0e0; border-radius: 12px;">
      <h2 style="color: #f5a623; margin: 0 0 16px 0; font-size: 20px;">Citation Drop Alert</h2>
      <p style="margin: 0 0 12px 0; line-height: 1.6;">
        The AI citation mention rate for <strong style="color: #ffffff;">${url}</strong> has dropped by <strong style="color: #ef4444;">${drop.toFixed(0)} percentage points</strong>.
      </p>
      <div style="display: flex; gap: 16px; margin: 16px 0; padding: 16px; background: #2a3040; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
        <div style="text-align: center; flex: 1;">
          <div style="font-size: 28px; font-weight: 700; color: #ffffff;">${previousMentionRate.toFixed(0)}%</div>
          <div style="font-size: 11px; color: #999; text-transform: uppercase;">Previous</div>
        </div>
        <div style="text-align: center; flex: 0; font-size: 24px; color: #ef4444; align-self: center;">&rarr;</div>
        <div style="text-align: center; flex: 1;">
          <div style="font-size: 28px; font-weight: 700; color: #ef4444;">${currentMentionRate.toFixed(0)}%</div>
          <div style="font-size: 11px; color: #999; text-transform: uppercase;">Current</div>
        </div>
      </div>
      <p style="margin: 12px 0; line-height: 1.6; font-size: 14px; color: #aab;">
        This typically means competing content has displaced your brand in AI-generated answers, or your content structure has changed. Review your citation tracker for query-level detail.
      </p>
      <a href="${dashboardUrl}" style="display: inline-block; margin-top: 12px; padding: 10px 20px; background: #f5a623; color: #1e2330; font-weight: 600; border-radius: 8px; text-decoration: none; font-size: 14px;">Open Citation Tracker</a>
      <p style="margin-top: 20px; font-size: 11px; color: #666;">This alert was triggered by a scheduled citation ranking job in AiVIS.biz.</p>
    </div>
  `;

  const text = `Citation Drop Alert\n\nThe AI mention rate for ${url} dropped by ${drop.toFixed(0)} percentage points (${previousMentionRate.toFixed(0)}% -> ${currentMentionRate.toFixed(0)}%).\n\nOpen your citation tracker: ${dashboardUrl}\n\nThis alert was triggered by a scheduled citation ranking job in AiVIS.biz.`;

  await resendSend({ to, subject, html, text });
}
