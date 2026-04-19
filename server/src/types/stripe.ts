/**
 * Stripe Configuration Types
 *
 * Enforces strict typing for Stripe pricing, checkout, and webhook handling.
 */

import type { CanonicalTier } from "../../../shared/types.js";

/**
 * Stripe pricing modes
 */
export type StripePricingMode = "freemium" | "subscription" | "payment" | null;

/**
 * Stripe billing period
 */
export type BillingPeriod = "monthly" | "yearly" | "one_time";

/**
 * Stripe subscription status (internal mapping)
 */
export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "unknown";

/**
 * Tier configuration with pricing and metadata
 */
export interface StripeTierConfig {
  name: string;
  mode: StripePricingMode;
  priceId: string | undefined;
  yearlyPriceId?: string | undefined;
  lookupKey: string | null;
  amountCents: number;
  yearlyAmountCents?: number;
  metadata: Record<string, any>;
}

/**
 * Tier limits as returned from getTierLimits()
 */
export interface TierLimitsResult {
  auditsPerMonth: number;
  projectsMax: number;
}

/**
 * Checkout options for Stripe session creation
 */
export interface CheckoutSessionOptions {
  payment_method_types: string[];
  mode: StripePricingMode;
  line_items: Array<{
    price: string;
    quantity: number;
  }>;
  success_url: string;
  cancel_url: string;
  metadata: Record<string, any>;
  customer_email?: string;
  allow_promotion_codes?: boolean;
  subscription_data?: {
    metadata: Record<string, any>;
  };
}

/**
 * Line item for checkout
 */
export interface LineItem {
  price: string;
  quantity: number;
}

/**
 * Checkout request parameters
 */
export interface CheckoutRequest {
  tierKey: string;
  userId?: string;
  customerEmail?: string;
  successUrl?: string;
  cancelUrl?: string;
  billingPeriod?: BillingPeriod;
}

/**
 * Metadata hash result (CITE LEDGER compatible)
 */
export interface MetadataHashResult {
  metadata_hash: string;
  user_id?: string;
  tier: string;
  billing: string;
  [key: string]: any;
}

/**
 * Webhook event types handled
 */
export const WEBHOOK_EVENT_TYPES = {
  CHECKOUT_COMPLETED: "checkout.session.completed",
  SUBSCRIPTION_CREATED: "customer.subscription.created",
  SUBSCRIPTION_UPDATED: "customer.subscription.updated",
  SUBSCRIPTION_DELETED: "customer.subscription.deleted",
  INVOICE_PAID: "invoice.paid",
  PAYMENT_FAILED: "invoice.payment_failed",
} as const;

export type WebhookEventType =
  (typeof WEBHOOK_EVENT_TYPES)[keyof typeof WEBHOOK_EVENT_TYPES];

/**
 * Webhook event payload (base)
 */
export interface WebhookEventPayload {
  type: WebhookEventType;
  data: {
    object: Record<string, any>;
  };
  timestamp: number;
}

/**
 * Checkout session completed payload
 */
export interface CheckoutSessionCompletedPayload extends WebhookEventPayload {
  type: "checkout.session.completed";
  data: {
    object: {
      id: string;
      customer_email?: string;
      customer?: string;
      metadata: Record<string, any>;
      subscription?: string;
      payment_intent?: string;
      status: string;
    };
  };
}

/**
 * Subscription created/updated payload
 */
export interface SubscriptionEventPayload extends WebhookEventPayload {
  type:
    | "customer.subscription.created"
    | "customer.subscription.updated"
    | "customer.subscription.deleted";
  data: {
    object: {
      id: string;
      customer: string;
      status: string;
      current_period_start: number;
      current_period_end: number;
      metadata: Record<string, any>;
      items: {
        data: Array<{
          price: {
            id: string;
            lookup_key?: string;
          };
        }>;
      };
    };
  };
}

/**
 * Invoice event payload
 */
export interface InvoiceEventPayload extends WebhookEventPayload {
  type: "invoice.paid" | "invoice.payment_failed";
  data: {
    object: {
      id: string;
      customer: string;
      subscription?: string;
      status: string;
      paid: boolean;
      amount_paid: number;
      metadata: Record<string, any>;
    };
  };
}
