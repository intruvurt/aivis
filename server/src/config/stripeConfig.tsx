/**
 * Stripe Configuration for AI Visibility Engine
 * 
 * This file contains all Stripe-related configuration including:
 * - Price IDs and lookup keys
 * - Tier metadata and limits
 * - Checkout session helpers
 */

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
      audits_per_month: 10,
      projects_max: 1,
    },
  },

  // PRO TIER (Starter subscription) - $29/month
  pro: {
    name: 'AI Visibility Engine – Pro',
    lookupKey: 'pro_monthly',
    priceId: process.env.STRIPE_PRO_PRICE_ID,
    amountCents: 10680,
    mode: 'subscription',
    metadata: {
      tier_key: 'pro',
      audits_per_month: 100,
      projects_max: 5,
    },
  },

  // BUSINESS TIER - $149/month
  business: {
    name: 'AI Visibility Engine – Business',
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

  // ENTERPRISE TIER - $399/month
  enterprise: {
    name: 'AI Visibility Engine – Enterprise',
    lookupKey: 'enterprise_monthly',
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID,
    amountCents: 39900,
    mode: 'subscription',
    metadata: {
      tier_key: 'enterprise',
      audits_per_month: 2000,
      projects_max: 100,
      includes_sla: true,
    },
  },

  // WHITE LABEL - $2,500 setup + $199/month
  whitelabel: {
    name: 'White Label Launch',
    lookupKey: 'whitelabel_monthly', // Primary recurring price
    setupLookupKey: 'whitelabel_setup',
    priceId: process.env.STRIPE_WHITELABEL_MONTHLY_PRICE_ID,
    setupPriceId: process.env.STRIPE_WHITELABEL_SETUP_PRICE_ID,
    amountCents: 19900, // Monthly recurring
    setupAmountCents: 250000, // One-time setup fee
    mode: 'subscription', // Checkout mode (includes one-time + recurring)
    metadata: {
      tier_key: 'whitelabel',
      audits_per_month: 1000,
      projects_max: 50,
      white_label: true,
      custom_domain: true,
    },
  },

  // SOURCE CODE BUYOUT - $15,000 one-time
  buyout: {
    name: 'Source Code Buyout',
    lookupKey: 'buyout_15000',
    priceId: process.env.STRIPE_BUYOUT_PRICE_ID,
    amountCents: 1500000,
    mode: 'payment', // One-time payment
    metadata: {
      tier_key: 'buyout',
      audits_per_month: -1, // Unlimited
      projects_max: -1, // Unlimited
      source_code_access: true,
    },
  },
};

// ============================================================================
// TIER LOOKUP HELPERS
// ============================================================================

/**
 * Get tier configuration by tier key
 */
export function getTierConfig(tierKey) {
  const normalizedKey = tierKey?.toLowerCase();
  return STRIPE_PRICING[normalizedKey] || null;
}

/**
 * Get tier key from Stripe price ID
 */
export function getTierFromPriceId(priceId) {
  for (const [tierKey, config] of Object.entries(STRIPE_PRICING)) {
    if (config.priceId === priceId || config.setupPriceId === priceId) {
      return tierKey;
    }
  }
  return null;
}

/**
 * Get tier key from Stripe lookup key
 */
export function getTierFromLookupKey(lookupKey) {
  for (const [tierKey, config] of Object.entries(STRIPE_PRICING)) {
    if (config.lookupKey === lookupKey || config.setupLookupKey === lookupKey) {
      return tierKey;
    }
  }
  return null;
}

/**
 * Check if a tier requires a subscription
 */
export function isSubscriptionTier(tierKey) {
  const config = getTierConfig(tierKey);
  return config?.mode === 'subscription';
}

/**
 * Check if a tier is a one-time payment
 */
export function isOneTimePayment(tierKey) {
  const config = getTierConfig(tierKey);
  return config?.mode === 'payment';
}

// ============================================================================
// CHECKOUT SESSION BUILDERS
// ============================================================================

/**
 * Build line items for Stripe Checkout based on tier
 */
export function buildLineItems(tierKey) {
  const config = getTierConfig(tierKey);
  if (!config || !config.priceId) {
    throw new Error(`Invalid tier or missing price ID: ${tierKey}`);
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
      price: config.priceId,
      quantity: 1,
    });
  } else {
    // Standard single line item
    lineItems.push({
      price: config.priceId,
      quantity: 1,
    });
  }

  return lineItems;
}

/**
 * Build checkout session options
 */
export function buildCheckoutOptions({ tierKey, userId, customerEmail, brandDomain, successUrl, cancelUrl }) {
  const config = getTierConfig(tierKey);
  if (!config) {
    throw new Error(`Invalid tier: ${tierKey}`);
  }

  const options = {
    payment_method_types: ['card'],
    line_items: buildLineItems(tierKey),
    mode: config.mode,
    success_url: successUrl || `${process.env.FRONTEND_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl || `${process.env.FRONTEND_URL}/payment-canceled`,
    client_reference_id: userId,
    metadata: {
      userId: userId,
      tier_key: tierKey,
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
        tier_key: tierKey,
      },
    };
  }

  return options;
}

// ============================================================================
// TIER LIMITS FOR ENFORCEMENT
// ============================================================================

/**
 * Get usage limits for a tier
 */
export function getTierLimits(tierKey) {
  const config = getTierConfig(tierKey);
  if (!config) {
    // Default to free tier limits
    return {
      auditsPerMonth: 10,
      projectsMax: 1,
      includesSla: false,
      whiteLabel: false,
      sourceCodeAccess: false,
    };
  }

  return {
    auditsPerMonth: config.metadata.audits_per_month,
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
  
  // Payment intent events (for one-time payments)
  PAYMENT_INTENT_SUCCEEDED: 'payment_intent.succeeded',
  PAYMENT_INTENT_FAILED: 'payment_intent.payment_failed',
};

/**
 * Map subscription status to internal tier status
 */
export function mapSubscriptionStatus(stripeStatus) {
  const statusMap = {
    active: 'active',
    trialing: 'active',
    past_due: 'past_due',
    canceled: 'canceled',
    unpaid: 'suspended',
    incomplete: 'pending',
    incomplete_expired: 'expired',
    paused: 'paused',
  };
  return statusMap[stripeStatus] || 'unknown';
}

export default STRIPE_PRICING;
