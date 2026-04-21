/**
 * Stripe Configuration for AiVIS.biz
 * 
 * This file contains all Stripe-related configuration including:
 * - Price IDs and lookup keys
 * - Tier metadata and limits
 * - Checkout session helpers
 */

import { PRICING, TIER_LIMITS, uiTierFromCanonical, type CanonicalTier, type LegacyTier } from '../../../shared/types.js';

// ============================================================================
// STRIPE PRICE CONFIGURATION  (all amounts derived from PRICING contract)
// ============================================================================

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
      audits_per_month: PRICING.observer.limits.scans,
      projects_max: TIER_LIMITS.observer.maxProjects,
    },
  },

  // OBSERVER TIER (Free)
  observer: {
    name: PRICING.observer.name,
    lookupKey: null,
    priceId: null,
    amountCents: 0,
    mode: 'freemium',
    metadata: {
      tier_key: 'observer',
      audits_per_month: PRICING.observer.limits.scans,
      competitors: PRICING.observer.limits.competitors,
      citation_queries: PRICING.observer.limits.citations,
      projects_max: TIER_LIMITS.observer.maxProjects,
    },
  },

  // STARTER TIER — $15/month or $140/year (22% off)
  starter: {
    name: PRICING.starter.name,
    lookupKey: 'starter_monthly',
    priceId: process.env.STRIPE_STARTER_MONTHLY_PRICE_ID,
    amountCents: PRICING.starter.billing.monthly * 100,
    yearlyPriceId: process.env.STRIPE_STARTER_YEARLY_PRICE_ID,
    yearlyAmountCents: PRICING.starter.billing.yearly * 100,
    mode: 'subscription',
    metadata: {
      tier_key: 'starter',
      audits_per_month: PRICING.starter.limits.scans,
      competitors: PRICING.starter.limits.competitors,
      citation_queries: PRICING.starter.limits.citations,
      projects_max: TIER_LIMITS.starter.maxProjects,
      report_history: TIER_LIMITS.starter.hasReportHistory,
      shareable_link: TIER_LIMITS.starter.hasShareableLink,
    },
  },

  // ALIGNMENT TIER — $49/month or $458/year (22% off)
  alignment: {
    name: PRICING.alignment.name,
    lookupKey: 'alignment_monthly',
    priceId: process.env.STRIPE_ALIGNMENT_MONTHLY_PRICE_ID,
    amountCents: PRICING.alignment.billing.monthly * 100,
    yearlyPriceId: process.env.STRIPE_ALIGNMENT_YEARLY_PRICE_ID,
    yearlyAmountCents: PRICING.alignment.billing.yearly * 100,
    mode: 'subscription',
    metadata: {
      tier_key: 'alignment',
      audits_per_month: PRICING.alignment.limits.scans,
      competitors: PRICING.alignment.limits.competitors,
      citation_queries: PRICING.alignment.limits.citations,
      projects_max: TIER_LIMITS.alignment.maxProjects,
      team_members: TIER_LIMITS.alignment.maxTeamMembers,
      mention_digests: true,
      reverse_engineer: true,
      niche_discovery: true,
    },
  },

  // SIGNAL TIER — $149/month or $1394/year (22% off)
  signal: {
    name: PRICING.signal.name,
    lookupKey: 'signal_monthly',
    priceId: process.env.STRIPE_SIGNAL_MONTHLY_PRICE_ID,
    amountCents: PRICING.signal.billing.monthly * 100,
    yearlyPriceId: process.env.STRIPE_SIGNAL_YEARLY_PRICE_ID,
    yearlyAmountCents: PRICING.signal.billing.yearly * 100,
    mode: 'subscription',
    metadata: {
      tier_key: 'signal',
      audits_per_month: PRICING.signal.limits.scans,
      competitors: PRICING.signal.limits.competitors,
      citation_queries: PRICING.signal.limits.citations,
      projects_max: TIER_LIMITS.signal.maxProjects,
      team_members: TIER_LIMITS.signal.maxTeamMembers,
      api_access: true,
      white_label: true,
      triple_check: true,
      alert_integrations: true,
      automation_workflows: true,
      priority_queue: true,
    },
  },

  // SCOREFIX — $299/month continuous evidence repair subscription
  scorefix: {
    name: PRICING.scorefix.name,
    lookupKey: 'scorefix_monthly',
    priceId: process.env.STRIPE_SCOREFIX_MONTHLY_PRICE_ID || process.env.STRIPE_SCOREFIX_PRICE_ID,
    amountCents: PRICING.scorefix.billing.monthly * 100,
    yearlyPriceId: process.env.STRIPE_SCOREFIX_YEARLY_PRICE_ID,
    yearlyAmountCents: PRICING.scorefix.billing.yearly * 100,
    mode: 'subscription',
    metadata: {
      tier_key: 'scorefix',
      audits_per_month: PRICING.scorefix.limits.scans,
      competitors: PRICING.scorefix.limits.competitors,
      citation_queries: PRICING.scorefix.limits.citations,
      projects_max: TIER_LIMITS.scorefix.maxProjects,
      team_members: TIER_LIMITS.scorefix.maxTeamMembers,
      api_access: true,
      white_label: TIER_LIMITS.scorefix.hasWhiteLabel,
      scorefix_mode: true,
      continuous_ledger_repair: true,
      ledger_watch_mode: true,
      evidence_delta_tracking: true,
      auto_pr: true,
      batch_remediation: true,
      evidence_linked_prs: true,
      repair_interval_hours: 6,
      max_prs_per_week: 5,
    },
  },
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

  return [
    {
      price: priceId,
      quantity: 1,
    },
  ];
}

/**
 * Build checkout session options
 */
export function buildCheckoutOptions({ tierKey, userId, customerEmail, brandDomain, successUrl, cancelUrl, billingPeriod = 'monthly' }: { tierKey: string; userId?: string; customerEmail?: string; brandDomain?: string; successUrl?: string; cancelUrl?: string; billingPeriod?: string }) {
  const config = getTierConfig(tierKey) as any;
  if (!config) {
    throw new Error(`Invalid tier: ${tierKey}`);
  }
  const normalizedBillingPeriod = String(billingPeriod || 'monthly').toLowerCase() === 'yearly'
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
    projectsMax: canonicalLimits.maxProjects,
    includesSla: config.metadata.includes_sla || false,
    whiteLabel: canonicalLimits.hasWhiteLabel,
    sourceCodeAccess: config.metadata.source_code_access || false,
    customDomain: canonicalLimits.hasCustomDomain,
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
