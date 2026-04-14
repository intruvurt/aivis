/**
 * Alert Service - Level 4 Self-Healing System
 * Fans alert notifications out to all channels configured by the user:
 *   email, slack, discord, webhook, in_app
 *
 * Tables:
 *   alert_subscriptions  - per-user channel configuration
 *   alert_notifications  - in-app notification log
 */

import { getPool } from './postgresql.js';

// ── Types ────────────────────────────────────────────────────────────────────

export type AlertType =
  | 'score_regression'
  | 'score_improvement'
  | 'opportunity'
  | 'competitor_gap'
  | 'fix_applied'
  | 'fix_merged'
  | 'deploy_regression';

export type AlertChannel = 'email' | 'slack' | 'discord' | 'webhook' | 'in_app';

export interface AlertSubscription {
  id: string;
  user_id: string;
  channel: AlertChannel;
  /** JSON blob: { url } for slack/discord/webhook, { address } for email */
  channel_config: Record<string, string>;
  alert_types: AlertType[];
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface AlertNotification {
  id: string;
  user_id: string;
  alert_type: AlertType;
  title: string;
  body: string;
  metadata: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export interface AlertPayload {
  type: AlertType;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
  /** Optional email address override (uses account email when not set) */
  toEmail?: string;
}

// ── Subscription CRUD ────────────────────────────────────────────────────────

export async function getAlertSubscriptions(userId: string): Promise<AlertSubscription[]> {
  const { rows } = await getPool().query(
    `SELECT * FROM alert_subscriptions WHERE user_id = $1 ORDER BY created_at ASC`,
    [userId],
  );
  return rows;
}

export async function upsertAlertSubscription(
  userId: string,
  channel: AlertChannel,
  channelConfig: Record<string, string>,
  alertTypes: AlertType[],
  enabled: boolean,
): Promise<AlertSubscription> {
  const { rows } = await getPool().query(
    `INSERT INTO alert_subscriptions (user_id, channel, channel_config, alert_types, enabled)
     VALUES ($1, $2, $3::jsonb, $4, $5)
     ON CONFLICT (user_id, channel) DO UPDATE
       SET channel_config = $3::jsonb,
           alert_types = $4,
           enabled = $5,
           updated_at = NOW()
     RETURNING *`,
    [userId, channel, JSON.stringify(channelConfig), alertTypes, enabled],
  );
  return rows[0];
}

export async function deleteAlertSubscription(userId: string, channel: AlertChannel): Promise<boolean> {
  const { rowCount } = await getPool().query(
    `DELETE FROM alert_subscriptions WHERE user_id = $1 AND channel = $2`,
    [userId, channel],
  );
  return (rowCount ?? 0) > 0;
}

// ── In-app notification CRUD ─────────────────────────────────────────────────

export async function getAlertNotifications(
  userId: string,
  limit = 50,
  unreadOnly = false,
): Promise<AlertNotification[]> {
  const { rows } = await getPool().query(
    `SELECT * FROM alert_notifications
     WHERE user_id = $1 ${unreadOnly ? 'AND read_at IS NULL' : ''}
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit],
  );
  return rows;
}

export async function markNotificationsRead(userId: string, ids: string[]): Promise<void> {
  if (!ids.length) return;
  await getPool().query(
    `UPDATE alert_notifications SET read_at = NOW()
     WHERE user_id = $1 AND id = ANY($2::uuid[]) AND read_at IS NULL`,
    [userId, ids],
  );
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await getPool().query(
    `UPDATE alert_notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL`,
    [userId],
  );
}

// ── Channel dispatch helpers ─────────────────────────────────────────────────

async function dispatchEmail(toEmail: string, payload: AlertPayload): Promise<void> {
  const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
  const FROM_EMAIL = process.env.FROM_EMAIL || 'AiVIS <noreply@mailer.aivis.biz>';

  if (!RESEND_API_KEY.startsWith('re_')) {
    console.log(`[AlertService] email fallback (no key): ${toEmail} - ${payload.title}`);
    return;
  }

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
      <h2 style="color:#4f46e5;margin-bottom:8px">${escapeHtml(payload.title)}</h2>
      <p style="color:#374151;line-height:1.6">${escapeHtml(payload.body)}</p>
      ${payload.metadata?.url ? `<p style="margin-top:16px"><a href="${escapeHtml(String(payload.metadata.url))}" style="color:#4f46e5">View Audit</a></p>` : ''}
      <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb">
      <p style="color:#9ca3af;font-size:12px">Evidence-backed site analysis for AI answers Platform - disable or manage alerts from your dashboard settings.</p>
    </div>
  `;
  const text = `${payload.title}\n\n${payload.body}`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to: toEmail, subject: payload.title, html, text }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as any;
    throw new Error(`Resend error ${res.status}: ${body?.message || res.statusText}`);
  }
}

async function dispatchWebhook(url: string, payload: AlertPayload): Promise<void> {
  const body = JSON.stringify({
    type: payload.type,
    title: payload.title,
    body: payload.body,
    metadata: payload.metadata ?? {},
    timestamp: new Date().toISOString(),
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'AiVIS-AlertService/1.0' },
    body,
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    throw new Error(`Webhook ${url} returned ${res.status}`);
  }
}

async function dispatchSlack(webhookUrl: string, payload: AlertPayload): Promise<void> {
  const emojiMap: Record<AlertType, string> = {
    score_regression: '🔴',
    score_improvement: '🟢',
    opportunity: '💡',
    competitor_gap: '⚔️',
    fix_applied: '🔧',
    fix_merged: '✅',
    deploy_regression: '🚨',
  };
  const emoji = emojiMap[payload.type] ?? '📊';

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `${emoji} *${payload.title}*`,
      blocks: [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `${emoji} *${payload.title}*\n${payload.body}` },
        },
      ],
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    throw new Error(`Slack webhook returned ${res.status}`);
  }
}

async function dispatchDiscord(webhookUrl: string, payload: AlertPayload): Promise<void> {
  const colorMap: Record<AlertType, number> = {
    score_regression: 0xef4444,   // red
    score_improvement: 0x22c55e,  // green
    opportunity: 0x3b82f6,        // blue
    competitor_gap: 0xf97316,     // orange
    fix_applied: 0xa855f7,        // purple
    fix_merged: 0x22c55e,         // green
    deploy_regression: 0xef4444,  // red
  };

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      embeds: [
        {
          title: payload.title,
          description: payload.body,
          color: colorMap[payload.type] ?? 0x6366f1,
          timestamp: new Date().toISOString(),
          footer: { text: 'Evidence-backed site analysis for AI answers Platform' },
        },
      ],
    }),
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    throw new Error(`Discord webhook returned ${res.status}`);
  }
}

async function recordInApp(userId: string, payload: AlertPayload): Promise<void> {
  await getPool().query(
    `INSERT INTO alert_notifications (user_id, alert_type, title, body, metadata)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [userId, payload.type, payload.title, payload.body, JSON.stringify(payload.metadata ?? {})],
  );
}

// ── Main dispatch ────────────────────────────────────────────────────────────

/**
 * Send an alert to all active channels the user has configured for this alert type.
 * Always writes an in-app notification. Failures per channel are logged + swallowed.
 */
export async function sendAlert(userId: string, payload: AlertPayload): Promise<void> {
  const subscriptions = await getAlertSubscriptions(userId);

  // Always store in-app
  await recordInApp(userId, payload).catch((err) =>
    console.warn(`[AlertService] in_app insert failed: ${err?.message}`),
  );

  for (const sub of subscriptions) {
    if (!sub.enabled) continue;
    if (!sub.alert_types.includes(payload.type)) continue;
    if (sub.channel === 'in_app') continue; // already handled above

    try {
      switch (sub.channel) {
        case 'email': {
          const email = sub.channel_config?.address || payload.toEmail;
          if (email) await dispatchEmail(email, payload);
          break;
        }
        case 'slack':
          await dispatchSlack(sub.channel_config.url, payload);
          break;
        case 'discord':
          await dispatchDiscord(sub.channel_config.url, payload);
          break;
        case 'webhook':
          await dispatchWebhook(sub.channel_config.url, payload);
          break;
      }
    } catch (err: any) {
      console.warn(`[AlertService] channel ${sub.channel} dispatch failed: ${err?.message}`);
    }
  }
}

/** Send a test alert on a specific channel without DB lookup. */
export async function sendTestAlert(channel: AlertChannel, channelConfig: Record<string, string>): Promise<void> {
  const payload: AlertPayload = {
    type: 'score_improvement',
    title: 'Evidence-backed site analysis for AI answers Platform - Test Alert',
    body: 'This is a test notification from AiVIS. Your alert channel is configured correctly.',
  };

  switch (channel) {
    case 'slack': return dispatchSlack(channelConfig.url, payload);
    case 'discord': return dispatchDiscord(channelConfig.url, payload);
    case 'webhook': return dispatchWebhook(channelConfig.url, payload);
    case 'email': return dispatchEmail(channelConfig.address, payload);
    default: break;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
