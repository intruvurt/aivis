<<<<<<< HEAD
=======
<<<<<<< Updated upstream
<<<<<<< Updated upstream
>>>>>>> 924924e57549acaf9d858f77fa106c7b59d8d0b3
/**
 * Stripe Configuration for Vercel Serverless Functions
 * AiVIS 3-Tier Pricing Model
 */

import Stripe from 'stripe';

// Initialize Stripe
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  console.warn('STRIPE_SECRET_KEY not configured');
}

export const stripe = stripeSecretKey 
  ? new Stripe(stripeSecretKey, { apiVersion: '2025-08-27.basil' as any })
  : null;

export function getStripe(): Stripe {
  if (!stripe) {
    throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY environment variable.');
  }
  return stripe;
}

// ============================================================================
// AiVIS 3-TIER PRICING MODEL
// ============================================================================

export const STRIPE_PRICING = {
  // TIER 1: OBSERVER (Free)
  // "see what machines can and cannot understand about you"
  observer: {
    name: 'Observer',
    displayName: 'Observer (Free)',
    priceId: null,
    yearlyPriceId: null,
    amountCents: 0,
    yearlyAmountCents: 0,
    mode: null as 'subscription' | null,
    limits: {
      scans_per_month: 3,
      pages_per_scan: 1,       // single page only
      competitors: 0,
      cache_days: 7,
      exports: false,
      force_refresh: false,
      api_access: false,
      white_label: false,
    },
    features: [
      'Single page analysis (homepage or URL)',
      'Visibility score + category breakdown',
      'Evidence ledger (read only)',
      '7-day cache',
    ],
  },

  // TIER 2: ALIGNMENT (Core) - $65/year or $9/month
  // "turn unknowns into structure and proof"
  alignment: {
    name: 'Alignment',
    displayName: 'Alignment (Core)',
    priceId: process.env.STRIPE_ALIGNMENT_MONTHLY_PRICE_ID,
    yearlyPriceId: process.env.STRIPE_ALIGNMENT_YEARLY_PRICE_ID,
    amountCents: 900,           // $9/month
    yearlyAmountCents: 6500,    // $65/year
    mode: 'subscription' as const,
    limits: {
      scans_per_month: 30,
      pages_per_scan: 5,        // light multi-page crawl
      competitors: 1,
      cache_days: 30,
      exports: true,
      force_refresh: true,
      api_access: false,
      white_label: false,
    },
    features: [
      'Light multi-page crawl',
      'Force refresh anytime',
      'PDF export',
      'Shareable report link',
      '1 competitor comparison',
      'Report history',
    ],
  },

  // TIER 3: SIGNAL (Pro) - $29/month or $290/year
  // "machines don't guess. neither should you."
  signal: {
    name: 'Signal',
    displayName: 'Signal (Pro)',
    priceId: process.env.STRIPE_SIGNAL_MONTHLY_PRICE_ID,
    yearlyPriceId: process.env.STRIPE_SIGNAL_YEARLY_PRICE_ID,
    amountCents: 2900,          // $29/month
    yearlyAmountCents: 29000,   // $290/year
    mode: 'subscription' as const,
    limits: {
      scans_per_month: 150,
      pages_per_scan: 20,       // deep crawl
      competitors: 3,
      cache_days: 90,
      exports: true,
      force_refresh: true,
      api_access: true,         // read-only API/webhooks
      white_label: true,        // white-label export option
    },
    features: [
      'Deep crawl analysis',
      'Full evidence ledger',
      'Up to 3 competitors',
      'Scheduled rescans',
      'Webhooks / API (read only)',
      'White-label export option',
    ],
  },
} as const;

export type TierKey = keyof typeof STRIPE_PRICING;

// Legacy tier mapping (for backwards compatibility)
export const TIER_ALIASES: Record<string, TierKey> = {
  'free': 'observer',
  'core': 'alignment', 
  'pro': 'signal',
  // Old tier names
  'business': 'signal',
  'enterprise': 'signal',
};

export function getTierConfig(tier: string) {
  const normalizedTier = TIER_ALIASES[tier] || tier;
  return STRIPE_PRICING[normalizedTier as TierKey] || null;
}

export function getTierFromPriceId(priceId: string): TierKey | null {
  for (const [key, config] of Object.entries(STRIPE_PRICING)) {
    if (config.priceId === priceId || config.yearlyPriceId === priceId) {
      return key as TierKey;
    }
  }
  return null;
}

export function getTierLimits(tier: string) {
  const config = getTierConfig(tier);
  return config?.limits || STRIPE_PRICING.observer.limits;
}

export function getTierFeatures(tier: string) {
  const config = getTierConfig(tier);
  return config?.features || STRIPE_PRICING.observer.features;
}

export interface CheckoutOptions {
  tierKey: TierKey;
  billingPeriod: 'monthly' | 'yearly';
  userId: string;
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
}

export function buildCheckoutParams(options: CheckoutOptions): Stripe.Checkout.SessionCreateParams {
  const config = getTierConfig(options.tierKey);
  if (!config || config.mode === null) {
    throw new Error(`Invalid tier or free tier selected: ${options.tierKey}`);
  }

  const priceId = options.billingPeriod === 'yearly' 
    ? config.yearlyPriceId 
    : config.priceId;

  if (!priceId) {
    throw new Error(`Price not configured for ${options.tierKey} (${options.billingPeriod})`);
  }

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: options.successUrl,
    cancel_url: options.cancelUrl,
    metadata: {
      user_id: options.userId,
      tier: options.tierKey,
      billing_period: options.billingPeriod,
    },
    subscription_data: {
      metadata: {
        user_id: options.userId,
        tier: options.tierKey,
      },
    },
  };

  if (options.customerEmail) {
    params.customer_email = options.customerEmail;
  }

  return params;
}

// Webhook event types we handle
export const WEBHOOK_EVENTS = [
  'checkout.session.completed',
  'checkout.session.expired',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
] as const;
<<<<<<< HEAD
=======
=======
=======
>>>>>>> Stashed changes
import pg from "pg";

const { Pool } = pg;

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

/**
 * Neon/PG URLs usually look like:
 * postgres://USER:PASSWORD@HOST/DB?sslmode=require
 */
export const dbConfigured = Boolean(process.env.DATABASE_URL);

export const pool = dbConfigured
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      // Neon requires TLS; "rejectUnauthorized: false" is common in managed PG
      // If you have proper CA chain you can tighten this later.
      ssl: { rejectUnauthorized: false },
      max: Number(process.env.PG_POOL_MAX ?? 10),
      idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS ?? 30_000),
      connectionTimeoutMillis: Number(process.env.PG_CONN_TIMEOUT_MS ?? 10_000),
      keepAlive: true,
    })
  : null;

/**
 * Basic health check you can call at boot.
 */
export async function pingDb(): Promise<boolean> {
  if (!pool) return false;
  const res = await pool.query("SELECT 1 as ok");
  return res.rows?.[0]?.ok === 1;
}

/**
 * Execute a function inside a real SQL transaction.
 * - Automatically commits/rolls back
 * - Never leaks a client
 * - Optional isolation level
 */
export async function executeTransaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>,
  opts?: {
    isolation?:
      | "READ COMMITTED"
      | "REPEATABLE READ"
      | "SERIALIZABLE";
    statementTimeoutMs?: number;
  }
): Promise<T> {
  if (!pool) throw new Error("Database not configured");

  const client = await pool.connect();
  try {
    // Set per-tx statement timeout if you want (prevents hung queries)
    if (opts?.statementTimeoutMs && Number.isFinite(opts.statementTimeoutMs)) {
      await client.query(`SET LOCAL statement_timeout = $1`, [
        String(opts.statementTimeoutMs),
      ]);
    }

    await client.query("BEGIN");

    if (opts?.isolation) {
      await client.query(`SET TRANSACTION ISOLATION LEVEL ${opts.isolation}`);
    }

    const result = await fn(client);

    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore rollback failures; original error matters
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Non-transaction helper for single queries when you don't need BEGIN/COMMIT.
 */
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<pg.QueryResult<T>> {
  if (!pool) throw new Error("Database not configured");
  return pool.query<T>(text, params);
}

/**
 * Clean shutdown (important for tests + graceful exit).
 */
export async function closeDb(): Promise<void> {
  if (!pool) return;
  await pool.end();
}
<<<<<<< Updated upstream
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
>>>>>>> 924924e57549acaf9d858f77fa106c7b59d8d0b3
