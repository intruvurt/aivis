/**
 * PayPal REST API service for AiVIS.
 *
 * Uses PayPal Orders v2 API for one-time payments and Subscriptions API
 * for recurring billing. Requires PAYPAL_API_KEY (client_id) and
 * PAYPAL_SECRET env vars.
 *
 * Works alongside the existing Stripe integration - either payment
 * method can be selected at checkout.
 */

import { getPool } from './postgresql.js';
import { PRICING } from '../../../shared/types.js';

// ── Environment ─────────────────────────────────────────────────────────────

const PAYPAL_CLIENT_ID = process.env.PAYPAL_API_KEY || process.env.PAYPAL_CLIENT_ID || '';
const PAYPAL_SECRET = process.env.PAYPAL_SECRET || '';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const PAYPAL_BASE = IS_PRODUCTION
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

// ── Access token cache ──────────────────────────────────────────────────────

let cachedToken: { token: string; expiresAt: number } | null = null;

/** Obtain an OAuth2 access token (cached until near-expiry). */
export async function getPayPalAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 30_000) {
    return cachedToken.token;
  }

  if (!PAYPAL_CLIENT_ID || !PAYPAL_SECRET) {
    throw new Error('Missing PAYPAL_API_KEY / PAYPAL_SECRET environment variables.');
  }

  const credentials = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString('base64');

  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal auth failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cachedToken.token;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

async function paypalFetch<T = Record<string, unknown>>(
  path: string,
  opts: { method?: string; body?: unknown } = {},
): Promise<T> {
  const token = await getPayPalAccessToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const res = await fetch(`${PAYPAL_BASE}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal API error (${res.status} ${path}): ${text}`);
  }

  // 204 = no content
  if (res.status === 204) return {} as T;
  return (await res.json()) as T;
}

// ── Tier → amount mapping ───────────────────────────────────────────────────

export interface PayPalTierConfig {
  name: string;
  amountUsd: string; // e.g. "49.00"
  mode: 'subscription' | 'payment';
  description: string;
}

export const PAYPAL_TIER_PRICING: Record<string, PayPalTierConfig> = {
  alignment: {
    name: PRICING.alignment.name,
    amountUsd: PRICING.alignment.billing.monthly.toFixed(2),
    mode: 'subscription',
    description: `AiVIS ${PRICING.alignment.name} plan – ${PRICING.alignment.limits.scans} audits/month`,
  },
  signal: {
    name: PRICING.signal.name,
    amountUsd: PRICING.signal.billing.monthly.toFixed(2),
    mode: 'subscription',
    description: `AiVIS ${PRICING.signal.name} plan – ${PRICING.signal.limits.scans} audits/month, Triple-Check AI`,
  },
  scorefix: {
    name: PRICING.scorefix.name,
    amountUsd: PRICING.scorefix.billing.oneTime.toFixed(2),
    mode: 'payment',
    description: 'AiVIS Score Fix – one-time AI remediation package',
  },
};

// ── Orders (one-time payments) ──────────────────────────────────────────────

export interface CreateOrderResult {
  orderId: string;
  approvalUrl: string;
}

/** Create a PayPal order for one-time purchase (e.g. Score Fix, scan packs). */
export async function createPayPalOrder(
  userId: string,
  tier: string,
  returnUrl: string,
  cancelUrl: string,
): Promise<CreateOrderResult> {
  const config = PAYPAL_TIER_PRICING[tier];
  if (!config) throw new Error(`Unknown PayPal tier: ${tier}`);

  const order = await paypalFetch<{
    id: string;
    links: Array<{ href: string; rel: string }>;
  }>('/v2/checkout/orders', {
    method: 'POST',
    body: {
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            currency_code: 'USD',
            value: config.amountUsd,
          },
          description: config.description,
          custom_id: `${userId}|${tier}`,
        },
      ],
      application_context: {
        brand_name: 'AiVIS',
        landing_page: 'LOGIN',
        user_action: 'PAY_NOW',
        return_url: returnUrl,
        cancel_url: cancelUrl,
      },
    },
  });

  const approvalLink = order.links?.find((l) => l.rel === 'approve');
  if (!approvalLink) throw new Error('PayPal order missing approval URL.');

  // Persist pending payment
  const pool = getPool();
  await pool.query(
    `INSERT INTO payments (user_id, tier, method, status, metadata)
     VALUES ($1, $2, 'paypal', 'pending', $3)`,
    [userId, tier, JSON.stringify({ paypal_order_id: order.id })],
  );

  return { orderId: order.id, approvalUrl: approvalLink.href };
}

/** Capture a previously approved PayPal order. */
export async function capturePayPalOrder(
  orderId: string,
): Promise<{ captured: boolean; userId: string; tier: string }> {
  const capture = await paypalFetch<{
    id: string;
    status: string;
    purchase_units: Array<{
      payments?: { captures?: Array<{ id: string; status: string }> };
      custom_id?: string;
    }>;
  }>(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: 'POST',
  });

  const customId = capture.purchase_units?.[0]?.custom_id ?? '';
  const [userId, tier] = customId.split('|');

  if (capture.status === 'COMPLETED') {
    // Update payment record
    const pool = getPool();
    await pool.query(
      `UPDATE payments SET status = 'completed', updated_at = NOW()
       WHERE method = 'paypal' AND metadata->>'paypal_order_id' = $1`,
      [orderId],
    );

    // Upgrade user tier
    if (userId && tier) {
      await pool.query(
        `UPDATE users SET tier = $1, updated_at = NOW() WHERE id = $2`,
        [tier, userId],
      );
    }
  }

  return { captured: capture.status === 'COMPLETED', userId: userId ?? '', tier: tier ?? '' };
}

// ── Subscriptions ───────────────────────────────────────────────────────────

/**
 * PayPal subscriptions require pre-created Plans in the PayPal dashboard
 * (or via API). The plan IDs are stored as env vars.
 */
const PAYPAL_PLAN_IDS: Record<string, string | undefined> = {
  alignment: process.env.PAYPAL_PLAN_ID_ALIGNMENT,
  signal: process.env.PAYPAL_PLAN_ID_SIGNAL,
};

export interface CreateSubscriptionResult {
  subscriptionId: string;
  approvalUrl: string;
}

/** Create a PayPal subscription for recurring billing. */
export async function createPayPalSubscription(
  userId: string,
  tier: string,
  returnUrl: string,
  cancelUrl: string,
): Promise<CreateSubscriptionResult> {
  const planId = PAYPAL_PLAN_IDS[tier];
  if (!planId) {
    throw new Error(
      `No PayPal plan ID configured for tier "${tier}". Set PAYPAL_PLAN_ID_${tier.toUpperCase()} env var.`,
    );
  }

  const sub = await paypalFetch<{
    id: string;
    links: Array<{ href: string; rel: string }>;
  }>('/v1/billing/subscriptions', {
    method: 'POST',
    body: {
      plan_id: planId,
      custom_id: `${userId}|${tier}`,
      application_context: {
        brand_name: 'AiVIS',
        locale: 'en-US',
        user_action: 'SUBSCRIBE_NOW',
        return_url: returnUrl,
        cancel_url: cancelUrl,
      },
    },
  });

  const approvalLink = sub.links?.find((l) => l.rel === 'approve');
  if (!approvalLink) throw new Error('PayPal subscription missing approval URL.');

  // Persist pending payment
  const pool = getPool();
  await pool.query(
    `INSERT INTO payments (user_id, tier, method, status, metadata)
     VALUES ($1, $2, 'paypal', 'pending', $3)`,
    [userId, tier, JSON.stringify({ paypal_subscription_id: sub.id })],
  );

  return { subscriptionId: sub.id, approvalUrl: approvalLink.href };
}

/** Activate a subscription after PayPal approval redirect. */
export async function activatePayPalSubscription(subscriptionId: string): Promise<{
  active: boolean;
  userId: string;
  tier: string;
}> {
  const sub = await paypalFetch<{
    id: string;
    status: string;
    custom_id?: string;
  }>(`/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`);

  const customId = sub.custom_id ?? '';
  const [userId, tier] = customId.split('|');
  const isActive = sub.status === 'ACTIVE' || sub.status === 'APPROVED';

  if (isActive && userId && tier) {
    const pool = getPool();
    await pool.query(
      `UPDATE payments SET status = 'active', metadata = metadata || $1, updated_at = NOW()
       WHERE method = 'paypal' AND metadata->>'paypal_subscription_id' = $2`,
      [JSON.stringify({ paypal_status: sub.status }), subscriptionId],
    );
    await pool.query(
      `UPDATE users SET tier = $1, updated_at = NOW() WHERE id = $2`,
      [tier, userId],
    );
  }

  return { active: isActive, userId: userId ?? '', tier: tier ?? '' };
}

// ── Webhook verification ────────────────────────────────────────────────────

/**
 * Verify a PayPal webhook event signature.
 * Requires PAYPAL_WEBHOOK_ID env var (from PayPal dashboard webhook config).
 */
export async function verifyPayPalWebhook(
  headers: Record<string, string | string[] | undefined>,
  body: string,
): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) {
    console.warn('[PayPal] No PAYPAL_WEBHOOK_ID configured – skipping webhook verification in dev.');
    return !IS_PRODUCTION;
  }

  try {
    const result = await paypalFetch<{ verification_status: string }>(
      '/v1/notifications/verify-webhook-signature',
      {
        method: 'POST',
        body: {
          auth_algo: headers['paypal-auth-algo'] ?? '',
          cert_url: headers['paypal-cert-url'] ?? '',
          transmission_id: headers['paypal-transmission-id'] ?? '',
          transmission_sig: headers['paypal-transmission-sig'] ?? '',
          transmission_time: headers['paypal-transmission-time'] ?? '',
          webhook_id: webhookId,
          webhook_event: JSON.parse(body),
        },
      },
    );
    return result.verification_status === 'SUCCESS';
  } catch (err) {
    console.error('[PayPal] Webhook verification failed:', err);
    return false;
  }
}

/** Check if PayPal is configured (has credentials). */
export function isPayPalConfigured(): boolean {
  return !!(PAYPAL_CLIENT_ID && PAYPAL_SECRET);
}
