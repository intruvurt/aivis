/**
 * Webhook Service
 * Manages user-defined webhook endpoints that receive POST notifications
 * when audits complete. Signal-tier only.
 */
import { randomBytes, createHmac } from 'crypto';
import { getPool } from './postgresql.js';
import { IS_PRODUCTION } from '../config/runtime.js';
import { TIER_LIMITS, uiTierFromCanonical } from '../../../shared/types.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface Webhook {
  id: string;
  user_id: string;
  workspace_id: string;
  provider: IntegrationProvider;
  display_name: string | null;
  url: string;
  events: string[];
  secret: string;
  enabled: boolean;
  last_triggered_at: string | null;
  failure_count: number;
  created_at: string;
  updated_at: string;
}

export type IntegrationProvider = 'generic' | 'slack' | 'discord' | 'zapier' | 'notion' | 'teams' | 'google_chat';

export type WebhookEvent =
  | 'audit.completed'
  | 'competitor.updated'
  | 'citation.completed'
  | 'rescan.completed'
  | 'rescan.failed';

const ALLOWED_WEBHOOK_EVENTS: WebhookEvent[] = [
  'audit.completed',
  'competitor.updated',
  'citation.completed',
  'rescan.completed',
  'rescan.failed',
];

const ALLOWED_PROVIDERS: IntegrationProvider[] = ['generic', 'slack', 'discord', 'zapier', 'notion', 'teams', 'google_chat'];

function isPrivateOrLocalHost(hostname: string): boolean {
  const lower = String(hostname || '').toLowerCase();
  if (!lower) return true;
  if (lower === 'localhost' || lower.endsWith('.localhost') || lower.endsWith('.local')) return true;
  if (lower === '127.0.0.1' || lower === '::1' || lower === '0.0.0.0') return true;
  if (/^10\./.test(lower)) return true;
  if (/^192\.168\./.test(lower)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(lower)) return true;
  return false;
}

function normalizeWebhookEvents(events: string[] | undefined): WebhookEvent[] {
  const input = Array.isArray(events) ? events : ['audit.completed'];
  const normalized = Array.from(
    new Set(input.map((event) => String(event || '').trim()).filter(Boolean))
  );
  if (!normalized.length) return ['audit.completed'];
  const invalid = normalized.filter((event) => !ALLOWED_WEBHOOK_EVENTS.includes(event as WebhookEvent));
  if (invalid.length) {
    throw new Error(`Invalid webhook event(s): ${invalid.join(', ')}`);
  }
  return normalized as WebhookEvent[];
}

function normalizeProvider(provider: unknown, url: string): IntegrationProvider {
  const raw = String(provider || '').trim().toLowerCase();
  if (raw && ALLOWED_PROVIDERS.includes(raw as IntegrationProvider)) {
    return raw as IntegrationProvider;
  }

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname.toLowerCase();
    if (host === 'hooks.slack.com' && pathname.startsWith('/services/')) return 'slack';
    if ((host === 'discord.com' || host === 'discordapp.com') && pathname.startsWith('/api/webhooks/')) return 'discord';
    if (host === 'hooks.zapier.com' && pathname.includes('/hooks/catch/')) return 'zapier';
    if (host.endsWith('.webhook.office.com') || (host.endsWith('.logic.azure.com') && pathname.includes('/workflows/'))) return 'teams';
    if (host === 'chat.googleapis.com' && pathname.startsWith('/v1/spaces/')) return 'google_chat';
    if (host === 'api.notion.com' || (host.endsWith('.notion.site') && pathname.includes('/automations/'))) return 'notion';
  } catch {
    return 'generic';
  }

  return 'generic';
}

function validateProviderUrl(provider: IntegrationProvider, parsed: URL): void {
  const host = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname.toLowerCase();

  if (provider === 'slack') {
    if (!(host === 'hooks.slack.com' && pathname.startsWith('/services/'))) {
      throw new Error('Slack webhook URL must match https://hooks.slack.com/services/...');
    }
  }

  if (provider === 'discord') {
    const hostValid = host === 'discord.com' || host === 'discordapp.com';
    if (!(hostValid && pathname.startsWith('/api/webhooks/'))) {
      throw new Error('Discord webhook URL must match https://discord.com/api/webhooks/...');
    }
  }

  if (provider === 'zapier') {
    if (!(host === 'hooks.zapier.com' && pathname.includes('/hooks/catch/'))) {
      throw new Error('Zapier webhook URL must match https://hooks.zapier.com/hooks/catch/...');
    }
  }

  if (provider === 'teams') {
    const validTeams = host.endsWith('.webhook.office.com') || (host.endsWith('.logic.azure.com') && pathname.includes('/workflows/'));
    if (!validTeams) {
      throw new Error('Microsoft Teams webhook URL must be from *.webhook.office.com or *.logic.azure.com/workflows/...');
    }
  }

  if (provider === 'google_chat') {
    if (!(host === 'chat.googleapis.com' && pathname.startsWith('/v1/spaces/'))) {
      throw new Error('Google Chat webhook URL must match https://chat.googleapis.com/v1/spaces/...');
    }
  }

  if (provider === 'notion') {
    const validNotion = host === 'api.notion.com' || host.endsWith('.notion.site');
    if (!validNotion) {
      throw new Error('Notion webhook URL must be from api.notion.com or *.notion.site');
    }
  }
}

function summarizeEvent(event: WebhookEvent, data: Record<string, any>): string {
  const url = String(data?.url || '').trim();
  const score = typeof data?.visibility_score === 'number' ? data.visibility_score : null;
  if (event === 'audit.completed') {
    if (url && score !== null) {
      return `AiVIS audited "${url}" and returned a "${score}/100" AI Visibility score.\nSee how ChatGPT and Perplexity likely interpret the site, what they may miss, and where the biggest visibility gaps are:`;
    }
    return `Audit completed${score !== null ? ` • score ${score}` : ''}${url ? ` • ${url}` : ''}`;
  }
  if (event === 'rescan.completed') {
    return `Scheduled rescan completed${score !== null ? ` • score ${score}` : ''}${url ? ` • ${url}` : ''}`;
  }
  if (event === 'rescan.failed') {
    return `Scheduled rescan failed${url ? ` • ${url}` : ''}`;
  }
  if (event === 'competitor.updated') return 'Competitor update available';
  return 'Citation test completed';
}

function buildProviderPayload(hook: Webhook, event: WebhookEvent, data: Record<string, any>, timestampIso: string, test = false) {
  const summary = summarizeEvent(event, data);

  if (hook.provider === 'slack') {
    return {
      text: `[AiVIS] ${summary}`,
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: `AiVIS • ${event}`, emoji: true },
        },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `${summary}\n\nWorkspace: ${hook.workspace_id}` },
        },
      ],
      aivis_event: event,
      aivis_timestamp: timestampIso,
      test,
      data,
    };
  }

  if (hook.provider === 'discord') {
    return {
      content: `[AiVIS] ${summary}`,
      embeds: [
        {
          title: `AiVIS ${event}`,
          description: summary,
          timestamp: timestampIso,
          fields: [
            { name: 'Workspace', value: hook.workspace_id, inline: true },
            { name: 'Webhook', value: hook.display_name || hook.id, inline: true },
          ],
        },
      ],
      aivis_event: event,
      test,
      data,
    };
  }

  if (hook.provider === 'teams') {
    return {
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor: '6366f1',
      summary: `AiVIS • ${event}`,
      sections: [
        {
          activityTitle: `AiVIS • ${event}`,
          activitySubtitle: summary,
          facts: [
            { name: 'Event', value: event },
            { name: 'Workspace', value: hook.workspace_id },
            { name: 'Time', value: timestampIso },
          ],
          markdown: true,
        },
      ],
      aivis_event: event,
      test,
      data,
    };
  }

  if (hook.provider === 'google_chat') {
    return {
      text: `*AiVIS • ${event}*\n${summary}`,
      cards: [
        {
          header: { title: 'AiVIS Notification', subtitle: event },
          sections: [
            {
              widgets: [
                { textParagraph: { text: summary } },
                { keyValue: { topLabel: 'Workspace', content: hook.workspace_id } },
                { keyValue: { topLabel: 'Time', content: timestampIso } },
              ],
            },
          ],
        },
      ],
      aivis_event: event,
      test,
      data,
    };
  }

  if (hook.provider === 'notion') {
    return {
      event,
      timestamp: timestampIso,
      provider: 'notion',
      summary,
      workspace: hook.workspace_id,
      test,
      data,
    };
  }

  return {
    event,
    timestamp: timestampIso,
    provider: hook.provider,
    test,
    data,
  };
}

async function sendWithRetries(
  hook: Webhook,
  payloadBody: string,
  event: WebhookEvent,
  signature: string,
  signatureV1: string,
  timestamp: number,
  maxAttempts = 3,
): Promise<{ ok: boolean; status?: number; attempts: number; error?: string }> {
  let lastStatus: number | undefined;
  let lastError = '';

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      const res = await fetch(hook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-AiVIS-Signature': signature,
          'X-AiVIS-Signature-V1': signatureV1,
          'X-AiVIS-Event': event,
          'X-AiVIS-Timestamp': String(timestamp),
          'X-AiVIS-Provider': hook.provider,
        },
        body: payloadBody,
        signal: controller.signal,
      });

      clearTimeout(timeout);
      lastStatus = res.status;

      if (res.ok) {
        return { ok: true, status: res.status, attempts: attempt };
      }

      if (res.status >= 500 && attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
        continue;
      }

      return { ok: false, status: res.status, attempts: attempt, error: `Webhook returned ${res.status}` };
    } catch (err: any) {
      lastError = err?.message || 'delivery error';
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
        continue;
      }
    }
  }

  return { ok: false, status: lastStatus, attempts: maxAttempts, error: lastError || 'delivery failed' };
}

export function getWebhookIntegrationCatalog() {
  return {
    providers: [
      {
        key: 'slack',
        label: 'Slack Incoming Webhook',
        url_pattern: 'https://hooks.slack.com/services/...',
        supports_events: ALLOWED_WEBHOOK_EVENTS,
      },
      {
        key: 'discord',
        label: 'Discord Webhook',
        url_pattern: 'https://discord.com/api/webhooks/...',
        supports_events: ALLOWED_WEBHOOK_EVENTS,
      },
      {
        key: 'zapier',
        label: 'Zapier Catch Hook',
        url_pattern: 'https://hooks.zapier.com/hooks/catch/...',
        supports_events: ALLOWED_WEBHOOK_EVENTS,
      },
      {
        key: 'notion',
        label: 'Notion Automation',
        url_pattern: 'https://api.notion.com/...',
        supports_events: ALLOWED_WEBHOOK_EVENTS,
      },
      {
        key: 'teams',
        label: 'Microsoft Teams Incoming Webhook',
        url_pattern: 'https://*.webhook.office.com/...',
        supports_events: ALLOWED_WEBHOOK_EVENTS,
      },
      {
        key: 'google_chat',
        label: 'Google Chat Webhook',
        url_pattern: 'https://chat.googleapis.com/v1/spaces/...',
        supports_events: ALLOWED_WEBHOOK_EVENTS,
      },
      {
        key: 'generic',
        label: 'Generic HTTPS Webhook',
        url_pattern: 'https://example.com/webhook',
        supports_events: ALLOWED_WEBHOOK_EVENTS,
      },
    ],
    events: ALLOWED_WEBHOOK_EVENTS,
  };
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

export async function createWebhook(
  userId: string,
  workspaceId: string,
  url: string,
  events: string[] = ['audit.completed'],
  options?: { provider?: IntegrationProvider; displayName?: string },
  userTier: string = 'observer'
): Promise<Webhook> {
  const pool = getPool();
  const secret = `whsec_${randomBytes(24).toString('hex')}`;
  const normalizedEvents = normalizeWebhookEvents(events);

  // Enforce per-tier webhook limit
  const tier = uiTierFromCanonical((userTier || 'observer') as any);
  const maxWebhooks = TIER_LIMITS[tier].maxWebhooks;
  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*)::int AS cnt FROM webhooks WHERE user_id = $1 AND workspace_id = $2`,
    [userId, workspaceId]
  );
  if (countRows[0].cnt >= maxWebhooks) {
    throw new Error(`Maximum ${maxWebhooks} webhooks on your plan`);
  }

  // Validate URL
  const normalizedUrl = String(url || '').trim();
  if (!normalizedUrl || normalizedUrl.length > 2048) {
    throw new Error('Invalid webhook URL');
  }
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(normalizedUrl);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Webhook URL must be HTTP or HTTPS');
    }
    if (isPrivateOrLocalHost(parsedUrl.hostname)) {
      throw new Error('Private and localhost webhook URLs are not allowed');
    }
    if (IS_PRODUCTION && parsedUrl.protocol !== 'https:') {
      throw new Error('HTTPS webhook URL is required in production');
    }
  } catch (err: any) {
    throw new Error(err?.message || 'Invalid webhook URL');
  }

  const provider = normalizeProvider(options?.provider, normalizedUrl);
  validateProviderUrl(provider, parsedUrl);
  const displayName = String(options?.displayName || '').trim().slice(0, 120) || null;

  const { rows } = await pool.query(
    `INSERT INTO webhooks (user_id, workspace_id, provider, display_name, url, events, secret)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [userId, workspaceId, provider, displayName, normalizedUrl, normalizedEvents, secret]
  );
  return rows[0];
}

export async function updateWebhook(
  id: string,
  userId: string,
  workspaceId: string,
  updates: {
    enabled?: boolean;
    events?: string[];
    url?: string;
    provider?: IntegrationProvider;
    displayName?: string;
  }
): Promise<Webhook | null> {
  const pool = getPool();

  const existingRows = await pool.query(
    `SELECT * FROM webhooks WHERE id = $1 AND user_id = $2 AND workspace_id = $3 LIMIT 1`,
    [id, userId, workspaceId]
  );
  const existing = existingRows.rows[0] as Webhook | undefined;
  if (!existing) return null;

  const nextUrl = typeof updates.url === 'string' ? updates.url.trim() : existing.url;
  const nextEvents = Array.isArray(updates.events) ? normalizeWebhookEvents(updates.events) : existing.events;
  const nextProvider = normalizeProvider(updates.provider || existing.provider, nextUrl);
  const displayName =
    typeof updates.displayName === 'string'
      ? updates.displayName.trim().slice(0, 120) || null
      : existing.display_name;

  let parsed: URL;
  try {
    parsed = new URL(nextUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Webhook URL must be HTTP or HTTPS');
    if (isPrivateOrLocalHost(parsed.hostname)) throw new Error('Private and localhost webhook URLs are not allowed');
    if (IS_PRODUCTION && parsed.protocol !== 'https:') throw new Error('HTTPS webhook URL is required in production');
    validateProviderUrl(nextProvider, parsed);
  } catch (err: any) {
    throw new Error(err?.message || 'Invalid webhook URL');
  }

  const enabled = typeof updates.enabled === 'boolean' ? updates.enabled : existing.enabled;

  const { rows } = await pool.query(
    `UPDATE webhooks
     SET provider = $1,
         display_name = $2,
         url = $3,
         events = $4,
         enabled = $5,
         updated_at = NOW()
     WHERE id = $6 AND user_id = $7 AND workspace_id = $8
     RETURNING *`,
    [nextProvider, displayName, nextUrl, nextEvents, enabled, id, userId, workspaceId]
  );

  return rows[0] || null;
}

export async function listWebhooks(userId: string, workspaceId: string): Promise<Webhook[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT * FROM webhooks WHERE user_id = $1 AND workspace_id = $2 ORDER BY created_at DESC`,
    [userId, workspaceId]
  );
  return rows;
}

export async function deleteWebhook(id: string, userId: string, workspaceId: string): Promise<boolean> {
  const pool = getPool();
  const { rowCount } = await pool.query(
    `DELETE FROM webhooks WHERE id = $1 AND user_id = $2 AND workspace_id = $3`,
    [id, userId, workspaceId]
  );
  return (rowCount ?? 0) > 0;
}

export async function toggleWebhook(id: string, userId: string, workspaceId: string, enabled: boolean): Promise<Webhook | null> {
  return updateWebhook(id, userId, workspaceId, { enabled });
}

// ── Dispatch ─────────────────────────────────────────────────────────────────

/**
 * Sign payload with HMAC-SHA256 using the webhook secret.
 */
function signPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

function buildSignatureHeader(payload: string, secret: string, timestamp: number): string {
  const base = `${timestamp}.${payload}`;
  const digest = createHmac('sha256', secret).update(base).digest('hex');
  return `t=${timestamp},v1=${digest}`;
}

/**
 * Fire all enabled webhooks for a user that subscribe to the given event.
 * Non-blocking — errors are logged but do not throw.
 */
export async function dispatchWebhooks(
  userId: string,
  workspaceId: string,
  event: WebhookEvent,
  data: Record<string, any>
): Promise<void> {
  const pool = getPool();

  try {
    const { rows: hooks } = await pool.query(
      `SELECT * FROM webhooks
       WHERE user_id = $1 AND workspace_id = $2 AND enabled = TRUE AND $3 = ANY(events)`,
      [userId, workspaceId, event]
    );

    for (const hook of hooks) {
      const timestamp = Math.floor(Date.now() / 1000);
      const timestampIso = new Date().toISOString();
      const payload = buildProviderPayload(hook as Webhook, event, data, timestampIso, false);
      const payloadBody = JSON.stringify(payload);

      const signature = signPayload(payloadBody, hook.secret);
      const signatureV1 = buildSignatureHeader(payloadBody, hook.secret, timestamp);

      try {
        const delivery = await sendWithRetries(hook as Webhook, payloadBody, event, signature, signatureV1, timestamp, 3);

        if (delivery.ok) {
          await pool.query(
            `UPDATE webhooks SET last_triggered_at = NOW(), failure_count = 0, updated_at = NOW() WHERE id = $1`,
            [hook.id]
          );
        } else {
          console.warn(`[webhook] ${hook.url} delivery failed (${delivery.status || 'n/a'}) after ${delivery.attempts} attempt(s)`);
          await pool.query(
            `UPDATE webhooks SET failure_count = failure_count + 1, updated_at = NOW() WHERE id = $1`,
            [hook.id]
          );
        }
      } catch (err: any) {
        console.warn(`[webhook] Failed to deliver to ${hook.url}: ${err.message}`);
        await pool.query(
          `UPDATE webhooks SET failure_count = failure_count + 1, updated_at = NOW() WHERE id = $1`,
          [hook.id]
        );

        // Auto-disable after 10 consecutive failures
        if (hook.failure_count >= 9) {
          await pool.query(
            `UPDATE webhooks SET enabled = FALSE, updated_at = NOW() WHERE id = $1`,
            [hook.id]
          );
          console.warn(`[webhook] Auto-disabled ${hook.url} after 10 consecutive failures`);
        }
      }
    }
  } catch (err: any) {
    console.error(`[webhook] dispatchWebhooks error: ${err.message}`);
  }
}

/**
 * Trigger a single webhook test delivery.
 * Returns delivery status and response metadata for UI feedback.
 */
export async function testWebhook(
  id: string,
  userId: string,
  workspaceId: string,
  event: WebhookEvent = 'audit.completed'
): Promise<{ ok: boolean; status?: number; message: string }> {
  const pool = getPool();

  const { rows } = await pool.query(
    `SELECT * FROM webhooks WHERE id = $1 AND user_id = $2 AND workspace_id = $3 LIMIT 1`,
    [id, userId, workspaceId]
  );

  const hook = rows[0] as Webhook | undefined;
  if (!hook) return { ok: false, message: 'Webhook not found' };
  if (!hook.enabled) return { ok: false, message: 'Webhook is disabled' };

  const timestampIso = new Date().toISOString();
  const payloadBody = JSON.stringify(
    buildProviderPayload(hook, event, {
      message: 'AiVIS webhook connectivity test',
      source: 'settings.integrations',
      webhook_id: hook.id,
      webhook_url: hook.url,
    }, timestampIso, true)
  );

  const signature = signPayload(payloadBody, hook.secret);
  const timestamp = Math.floor(Date.now() / 1000);
  const signatureV1 = buildSignatureHeader(payloadBody, hook.secret, timestamp);

  try {
    const delivery = await sendWithRetries(hook, payloadBody, event, signature, signatureV1, timestamp, 3);

    if (delivery.ok) {
      await pool.query(
        `UPDATE webhooks SET last_triggered_at = NOW(), failure_count = 0, updated_at = NOW() WHERE id = $1`,
        [hook.id]
      );
      return { ok: true, status: delivery.status, message: 'Test event delivered successfully' };
    }

    await pool.query(
      `UPDATE webhooks SET failure_count = failure_count + 1, updated_at = NOW() WHERE id = $1`,
      [hook.id]
    );

    return {
      ok: false,
      status: delivery.status,
      message: delivery.error || `Webhook returned ${delivery.status || 'n/a'}`,
    };
  } catch (err: any) {
    await pool.query(
      `UPDATE webhooks SET failure_count = failure_count + 1, updated_at = NOW() WHERE id = $1`,
      [hook.id]
    );
    return { ok: false, message: err?.message || 'Test delivery failed' };
  }
}
