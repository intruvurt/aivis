import express from "express";
import { getStripeInstance } from "../utils/stripe";
import { getUserById, getUserByStripeCustomerId, updateUserById, User } from "../models/User";

const router = express.Router();

/**
 * Map Stripe Price IDs -> your internal tier string.
 * IMPORTANT: Set these env vars in your server environment.
 *
 * STRIPE_PRO_PRICE_ID
 * STRIPE_BUSINESS_PRICE_ID
 * STRIPE_ENTERPRISE_PRICE_ID
 * STRIPE_WHITELABEL_MONTHLY_PRICE_ID
 *
 * Optional (one-time):
 * STRIPE_BUYOUT_PRICE_ID
 */
function tierFromPriceId(priceId: string): string | null {
  const map: Record<string, string> = {};
  if (typeof process.env.STRIPE_PRO_PRICE_ID === 'string') map[String(process.env.STRIPE_PRO_PRICE_ID)] = "Pro";
  if (typeof process.env.STRIPE_BUSINESS_PRICE_ID === 'string') map[String(process.env.STRIPE_BUSINESS_PRICE_ID)] = "Business";
  if (typeof process.env.STRIPE_ENTERPRISE_PRICE_ID === 'string') map[String(process.env.STRIPE_ENTERPRISE_PRICE_ID)] = "Enterprise";
  if (typeof process.env.STRIPE_WHITELABEL_MONTHLY_PRICE_ID === 'string') map[String(process.env.STRIPE_WHITELABEL_MONTHLY_PRICE_ID)] = "WhiteLabel";
  return map[String(priceId)] || null;
}

function getUserIdFromSession(session: any): string | null {
  return session?.metadata?.userId || session?.metadata?.user_id || null;
}

function normalizeErr(err: unknown): string {
  if (!err) return "Unknown error";
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

// Stripe webhook endpoint
router.post(
  "/stripe",
  express.raw({ type: "application/json" }),
  async (req: express.Request, res: express.Response) => {
    const stripe = getStripeInstance();

    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error("STRIPE_WEBHOOK_SECRET is missing");
      return res.status(500).json({ success: false, error: "Webhook misconfigured" });
    }

    if (!sig) {
      console.error("Missing stripe-signature header");
      return res.status(400).json({ success: false, error: "Missing signature" });
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", normalizeErr(err));
      return res.status(400).send(`Webhook Error: ${normalizeErr(err)}`);
    }

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object;
          await handleCheckoutComplete(session);
          break;
        }

        case "customer.subscription.created":
        case "customer.subscription.updated": {
          const subscription = event.data.object;
          await handleSubscriptionUpdate(subscription);
          break;
        }

        case "customer.subscription.deleted": {
          const subscription = event.data.object;
          await handleSubscriptionCancellation(subscription);
          break;
        }

        case "invoice.payment_failed": {
          const invoice = event.data.object;
          await handlePaymentFailure(invoice);
          break;
        }

        case "payment_intent.succeeded": {
          const paymentIntent = event.data.object;
          console.log("Payment intent succeeded:", paymentIntent?.id);
          break;
        }

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      return res.json({ received: true, success: true });
    } catch (error) {
      console.error("Webhook handler error:", normalizeErr(error));
      return res.status(500).json({ success: false, error: normalizeErr(error) });
    }
  }
);

// Referral webhook endpoint
router.post("/referral", express.json(), async (req: express.Request, res: express.Response) => {
  try {
    const { referrer_id, referred_email, referral_code } = req.body as any;
    // TODO:
    // - Validate referral code
    // - Credit referrer account
    // - Track conversion
    // - Send notification
    res.json({ success: true, message: "Referral processed successfully" });
  } catch (error) {
    console.error("Referral webhook error:", normalizeErr(error));
    res.status(500).json({ success: false, error: normalizeErr(error) });
  }
});

/**
 * Helper functions
 *
 * NOTE: These updates assume User has at least `tier` and `lastResetDate`.
 * If you also want to persist stripeCustomerId / stripeSubscriptionId / subscriptionStatus, etc,
 * you must add those fields to your User table/schema (PostgreSQL will ignore unknown keys if not mapped).
 */

async function handleCheckoutComplete(session: any): Promise<void> {
  const stripe = getStripeInstance();

  const userId = getUserIdFromSession(session);
  if (!userId) {
    console.warn("checkout.session.completed missing userId metadata", {
      sessionId: session?.id,
      metadata: session?.metadata,
    });
    return;
  }

  // SUBSCRIPTION checkout: derive tier from the subscription's recurring price
  if (session?.mode === "subscription" && session?.subscription) {
    const sub = await stripe.subscriptions.retrieve(session.subscription, {
      expand: ["items.data.price"],
    });

    const recurringPriceId = sub?.items?.data?.[0]?.price?.id || null;
    const tier = recurringPriceId ? tierFromPriceId(recurringPriceId) : null;

    if (!tier) {
      console.warn("No tier mapping for subscription price", {
        subscriptionId: sub?.id,
        recurringPriceId,
      });
      return;
    }

    await updateUserById(userId, {
      internal_tier_key: String(tier),
      last_reset_date: new Date(),
      // Add other fields as needed
    });

    return;
  }

  // PAYMENT (one-time) checkout: optional handling (buyout etc.)
  // If you sell a one-time product, you can read line items here.
  if (session?.mode === "payment") {
    try {
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
        limit: 25,
      });

      const priceIds =
        lineItems?.data
          ?.map((li: any) => li?.price?.id)
          ?.filter(Boolean) || [];

      const buyoutPriceId = process.env.STRIPE_BUYOUT_PRICE_ID;
      if (buyoutPriceId && priceIds.includes(buyoutPriceId)) {
        // Optional: mark a buyout entitlement (requires schema fields).
        // await updateUserById(userId, { has_buyout: true });
        console.log("Buyout paid:", { userId, sessionId: session.id });
      }
    } catch (e) {
      console.warn("Failed to read payment line items:", normalizeErr(e));
    }

    return;
  }

  console.log("Checkout completed (unhandled mode):", {
    sessionId: session?.id,
    mode: session?.mode,
  });
}

async function handleSubscriptionUpdate(subscription: any): Promise<void> {
  const stripe = getStripeInstance();

  const customerId = subscription?.customer;
  if (!customerId) {
    console.warn("subscription event missing customer id", subscription?.id);
    return;
  }

  // Best practice: look up user by stripeCustomerId.
  // If you don’t store stripeCustomerId yet, you’ll need to add it to User schema
  // and set it during checkout.session.completed.
  const user = await getUserByStripeCustomerId(customerId);
  if (!user) {
    console.warn("No user found for stripe customer", { customerId, subId: subscription?.id });
    return;
  }

  const recurringPriceId = subscription?.items?.data?.[0]?.price?.id || null;
  const tier = recurringPriceId ? tierFromPriceId(recurringPriceId) : null;

  if (!tier) {
    console.warn("Unknown subscription price, not updating tier", {
      customerId,
      recurringPriceId,
      subId: subscription?.id,
    });
    return;
  }

  if (user) {
    await updateUserById(user.id, {
      internal_tier_key: String(tier),
      // Add other fields as needed
    });
  }

  // You can choose when to reset monthly usage counters.
  // Safer: do it in a scheduled job keyed to billing cycle.
}

async function handleSubscriptionCancellation(subscription: any): Promise<void> {
  const customerId = subscription?.customer;
  if (!customerId) return;

  const user = await getUserByStripeCustomerId(customerId);
  if (!user) return;

  if (user) {
    await updateUserById(user.id, {
      internal_tier_key: "free",
      // Add other fields as needed
    });
  }
}

async function handlePaymentFailure(invoice: any): Promise<void> {
  const customerId = invoice?.customer;
  if (!customerId) return;

  const user = await getUserByStripeCustomerId(customerId);
  if (!user) return;

  // Don’t instantly downgrade if you want retention.
  // Mark “past_due” and enforce a grace window in your auth/usage gates.
  if (user) {
    await updateUserById(user.id, {
      // Add other fields as needed
    });
  }

  console.log("Payment failed for invoice:", invoice?.id);
}

export default router;
