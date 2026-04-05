/**
 * Stripe Configuration for AiVIS
 * 
 * This file contains all Stripe-related configuration including:
 * - Price IDs and lookup keys
 * - Tier metadata and limits
 * - Checkout session helpers
 */

import { TIER_LIMITS, uiTierFromCanonical, type CanonicalTier, type LegacyTier } from '../../../shared/types.js';

// ============================================================================
// STRIPE PRICE CONFIGURATION
// ============================================================================

/**
 * All available pricing tiers with their Stripe configuration.
 * Amounts are in cents (USD).
 */
export const STRIPE_PRICING = {
  // FREE TIER (no Stripe involvement)
  free: {
    name: 'Free',
    lookupKey: null,
    priceId: null,
    amountCents: 0,
    mode: null,
    metadata: {
      tier_key: 'free',
      audits_per_month: 3,
      projects_max: 1,
    },
  },

  // OBSERVER TIER (Free - new naming)
  observer: {
    name: 'Observer',
    lookupKey: null,
    priceId: null,
    amountCents: 0,
    mode: 'freemium',
    metadata: {
      tier_key: 'observer',
      audits_per_month: 3,
      competitors: 0,
      citation_queries: 10,
    },
  },

  // ALIGNMENT TIER - $49/month or $348/year (40% off)
  alignment: {
    name: 'Alignment',
    lookupKey: 'alignment_monthly',
    priceId: process.env.STRIPE_ALIGNMENT_MONTHLY_PRICE_ID,
    amountCents: 4900, // $49/month
    yearlyPriceId: process.env.STRIPE_ALIGNMENT_YEARLY_PRICE_ID,
    yearlyAmountCents: 34800, // $348/year (40% off annual billing)
    mode: 'subscription',
    metadata: {
      tier_key: 'alignment',
      audits_per_month: 60,
      competitors: 2,
      citation_queries: 100,
      mention_digests: true,
      reverse_engineer: true,
      niche_discovery: true,
    },
  },

  // SIGNAL TIER - $149/month or $1,068/year (40% off)
  signal: {
    name: 'Signal',
    lookupKey: 'signal_monthly',
    priceId: process.env.STRIPE_SIGNAL_MONTHLY_PRICE_ID,
    amountCents: 14900, // $149/month
    yearlyPriceId: process.env.STRIPE_SIGNAL_YEARLY_PRICE_ID,
    yearlyAmountCents: 106800, // $1,068/year ($89/mo, saves $720 - 40% off)
    mode: 'subscription',
    metadata: {
      tier_key: 'signal',
      audits_per_month: 110,
      competitors: 5,
      citation_queries: 200,
      api_access: true,
      white_label: true,
      triple_check: true,
      alert_integrations: true,
      automation_workflows: true,
      priority_queue: true,
    },
  },

  // SCORE FIX TIER - one-time $299 remediation purchase
  scorefix: {
    name: 'Score Fix',
    lookupKey: 'scorefix_monthly',
    priceId: process.env.STRIPE_SCOREFIX_PRICE_ID || process.env.STRIPE_SCOREFIX_MONTHLY_PRICE_ID,
    amountCents: 29900,
    mode: 'payment',
    metadata: {
      tier_key: 'scorefix',
      audits_per_month: 15,
      competitors: 10,
      citation_queries: 400,
      api_access: true,
      white_label: true,
      scorefix_mode: true,
      auto_pr: true,
      batch_remediation: true,
      evidence_linked_prs: true,
    },
  },

  // PRO TIER (legacy starter subscription)
  pro: {
    name: 'Ai Visibility Intelligence Audits – Pro',
    lookupKey: 'pro_monthly',
    priceId: process.env.STRIPE_PRO_PRICE_ID,
    amountCents: 4900,
    mode: 'subscription',
    metadata: {
      tier_key: 'pro',
      audits_per_month: 300,
      projects_max: 5,
    },
  },

  // BUSINESS TIER - $149/month
  business: {
    name: 'Ai Visibility Intelligence Audits – Business',
    lookupKey: 'business_monthly',
    priceId: process.env.STRIPE_BUSINESS_PRICE_ID,
    amountCents: 14900,
    mode: 'subscription',
    metadata: {
      tier_key: 'business',
      audits_per_month: 600,
      projects_max: 20,
    },
  },
// ENTERPRISE TIER - removed (not an active tier)
};

// ============================================================================
// TIER LOOKUP HELPERS
// ============================================================================

/**
 * Get tier configuration by tier key
 */
export function getTierConfig(tierKey: string): any {
  const normalizedKey = tierKey?.toLowerCase();
  return STRIPE_PRICING[normalizedKey as keyof typeof STRIPE_PRICING] || null;
}

/**
 * Get tier key from Stripe price ID
 */
export function getTierFromPriceId(priceId: string) {
  for (const [tierKey, config] of Object.entries(STRIPE_PRICING)) {
    if (
      (config as any).priceId === priceId ||
      (config as any).yearlyPriceId === priceId ||
      (config as any).setupPriceId === priceId
    ) {
      return tierKey;
    }
  }
  return null;
}

/**
 * Get tier key from Stripe lookup key
 */
export function getTierFromLookupKey(lookupKey: string) {
  for (const [tierKey, config] of Object.entries(STRIPE_PRICING)) {
    if ((config as any).lookupKey === lookupKey || (config as any).setupLookupKey === lookupKey) {
      return tierKey;
    }
  }
  return null;
}

/**
 * Check if a tier requires a subscription
 */
export function isSubscriptionTier(tierKey: string) {
  const config = getTierConfig(tierKey);
  return config?.mode === 'subscription';
}

/**
 * Check if a tier is a one-time payment
 */
export function isOneTimePayment(tierKey: string) {
  const config = getTierConfig(tierKey);
  return config?.mode === 'payment';
}

// ============================================================================
// CHECKOUT SESSION BUILDERS
// ============================================================================

/**
 * Build line items for Stripe Checkout based on tier
 */
export function buildLineItems(tierKey: string, billingPeriod = 'monthly') {
  const config = getTierConfig(tierKey) as any;
  if (!config) {
    throw new Error(`Invalid tier: ${tierKey}`);
  }

  // Determine which price ID to use based on billing period
  let priceId;
  if (config.mode === 'payment') {
    priceId = config.priceId;
  } else if (billingPeriod === 'yearly' && config.yearlyPriceId) {
    priceId = config.yearlyPriceId;
  } else {
    priceId = config.priceId;
  }

  if (!priceId) {
    throw new Error(`Missing price ID for tier ${tierKey} with billing period ${billingPeriod}`);
  }

  const lineItems = [];

  // For whitelabel, add both setup fee and recurring
  if (tierKey === 'whitelabel') {
    if (config.setupPriceId) {
      lineItems.push({
        price: config.setupPriceId,
        quantity: 1,
      });
    }
    lineItems.push({
      price: priceId,
      quantity: 1,
    });
  } else {
    // Standard single line item
    lineItems.push({
      price: priceId,
      quantity: 1,
    });
  }

  return lineItems;
}

/**
 * Build checkout session options
 */
export function buildCheckoutOptions({ tierKey, userId, customerEmail, brandDomain, successUrl, cancelUrl, billingPeriod = 'monthly' }: { tierKey: string; userId?: string; customerEmail?: string; brandDomain?: string; successUrl?: string; cancelUrl?: string; billingPeriod?: string }) {
  const config = getTierConfig(tierKey) as any;
  if (!config) {
    throw new Error(`Invalid tier: ${tierKey}`);
  }
  const normalizedBillingPeriod = config.mode === 'payment'
    ? 'one_time'
    : String(billingPeriod || 'monthly').toLowerCase() === 'yearly'
      ? 'yearly'
      : 'monthly';

  const options: Record<string, any> = {
    payment_method_types: ['card'],
    line_items: buildLineItems(tierKey, normalizedBillingPeriod),
    mode: config.mode,
    success_url: successUrl || `${process.env.FRONTEND_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl || `${process.env.FRONTEND_URL}/payment-canceled`,
    client_reference_id: userId,
    metadata: {
      userId: userId,
      tier: tierKey,
      tier_key: tierKey,
      billing_period: normalizedBillingPeriod,
      ...config.metadata,
    },
  };

  // Add customer email if provided
  if (customerEmail) {
    options.customer_email = customerEmail;
  }

  // Add brand domain for white label purchases
  if (tierKey === 'whitelabel' && brandDomain) {
    options.metadata.brand_domain = brandDomain;
  }

  // For subscriptions, allow promotion codes and set billing
  if (config.mode === 'subscription') {
    options.allow_promotion_codes = true;
    options.billing_address_collection = 'auto';
    options.subscription_data = {
      metadata: {
        userId: userId,
        tier: tierKey,
        tier_key: tierKey,
        billing_period: normalizedBillingPeriod,
      },
    };

    if (String(tierKey || '').toLowerCase() === 'signal') {
      options.subscription_data.trial_period_days = 14;
    }
  }

  return options;
}

// ============================================================================
// TIER LIMITS FOR ENFORCEMENT
// ============================================================================

/**
 * Get usage limits for a tier
 */
export function getTierLimits(tierKey: string) {
  const normalizedTier = uiTierFromCanonical((String(tierKey || 'observer').toLowerCase() as CanonicalTier | LegacyTier));
  const canonicalLimits = TIER_LIMITS[normalizedTier];
  const config = getTierConfig(normalizedTier);
  if (!config || !canonicalLimits) {
    // Default to free tier limits
    return {
      auditsPerMonth: 3,
      projectsMax: 1,
      includesSla: false,
      whiteLabel: false,
      sourceCodeAccess: false,
    };
  }

  return {
    auditsPerMonth: canonicalLimits.scansPerMonth,
    projectsMax: config.metadata.projects_max,
    includesSla: config.metadata.includes_sla || false,
    whiteLabel: config.metadata.white_label || false,
    sourceCodeAccess: config.metadata.source_code_access || false,
    customDomain: config.metadata.custom_domain || false,
  };
}

// ============================================================================
// WEBHOOK EVENT TYPES
// ============================================================================

/**
 * Stripe webhook events we handle
 */
export const WEBHOOK_EVENTS = {
  // Checkout events
  CHECKOUT_COMPLETED: 'checkout.session.completed',
  CHECKOUT_EXPIRED: 'checkout.session.expired',
  
  // Subscription events
  SUBSCRIPTION_CREATED: 'customer.subscription.created',
  SUBSCRIPTION_UPDATED: 'customer.subscription.updated',
  SUBSCRIPTION_DELETED: 'customer.subscription.deleted',
  
  // Invoice events
  INVOICE_PAID: 'invoice.paid',
  INVOICE_PAYMENT_FAILED: 'invoice.payment_failed',

  // Connect/common payout events
  PAYOUT_FAILED: 'payout.failed',
  
  // Payment intent events (for one-time payments)
  PAYMENT_INTENT_SUCCEEDED: 'payment_intent.succeeded',
  PAYMENT_INTENT_FAILED: 'payment_intent.payment_failed',

  // Connect Accounts v2 events
  CONNECT_V2_ACCOUNT_CLOSED: 'v2.core.account.closed',
  CONNECT_V2_ACCOUNT_UPDATED: 'v2.core.account.updated',
  CONNECT_V2_ACCOUNT_MERCHANT_CAPABILITY_STATUS_UPDATED: 'v2.core.account[configuration.merchant].capability_status_updated',
  CONNECT_V2_ACCOUNT_CUSTOMER_CAPABILITY_STATUS_UPDATED: 'v2.core.account[configuration.customer].capability_status_updated',
  CONNECT_V2_ACCOUNT_RECIPIENT_CAPABILITY_STATUS_UPDATED: 'v2.core.account[configuration.recipient].capability_status_updated',
  CONNECT_V2_ACCOUNT_PERSON_UPDATED: 'v2.core.account_person.updated',
};

/**
 * Map subscription status to internal tier status
 */
export function mapSubscriptionStatus(stripeStatus: string) {
  const statusMap: Record<string, string> = {
    active: 'active',
    trialing: 'trialing',
    past_due: 'past_due',
    canceled: 'canceled',
    unpaid: 'suspended',
    incomplete: 'pending',
    incomplete_expired: 'expired',
    paused: 'paused',
  };
  return statusMap[stripeStatus] || 'unknown';
}

export type TierKey = keyof typeof STRIPE_PRICING;

export default STRIPE_PRICING;
