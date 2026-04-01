import Stripe from "stripe";

let stripeInstance: Stripe | null = null;

export function getStripeInstance(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");

  if (!stripeInstance) {
    stripeInstance = new Stripe(key, {
      typescript: true
      // apiVersion: omit to avoid type/version mismatches
    });
  }

  return stripeInstance;
}

export async function createStripeConnectAccount(
  tenantId: string,
  email: string
): Promise<Stripe.Account> {
  const stripe = getStripeInstance();

  try {
    return await stripe.accounts.create({
      type: "express",
      email,
      metadata: { tenantId },
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true }
      }
    });
  } catch (err) {
    console.error("Stripe Connect account creation error:", err);
    throw err;
  }
}

export async function createAccountLink(
  accountId: string,
  refreshUrl: string,
  returnUrl: string
): Promise<Stripe.AccountLink> {
  const stripe = getStripeInstance();

  try {
    return await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding"
    });
  } catch (err) {
    console.error("Stripe account link creation error:", err);
    throw err;
  }
}

type Brand = {
  tenant_id: string;
  customDomain?: string | null;
  platformFee?: number; // 0.1 = 10%
  stripeAccount?: string | null; // connected acct id: acct_...
};

type User = {
  email: string;
  _id: string | { toString(): string };
};

export async function createCheckoutSessionWithPlatformFee(params: {
  brand: Brand;
  user: User;
  priceId: string;
}): Promise<Stripe.Checkout.Session> {
  const stripe = getStripeInstance();
  const { brand, user, priceId } = params;

  const baseUrl =
    brand.customDomain?.trim() ||
    process.env.APP_URL ||
    process.env.VITE_API_URL ||
    "https://aivis.biz";

  const connectedAccount = brand.stripeAccount?.trim() || null;

  // Stripe requires percent as a number like 10 for 10%
  const feePercent =
    typeof brand.platformFee === "number"
      ? Math.max(0, Math.min(100, brand.platformFee * 100))
      : 0;

  try {
    const session = await stripe.checkout.sessions.create(
      {
        mode: "subscription",
        payment_method_types: ["card"],
        customer_email: user.email,

        line_items: [
          {
            price: priceId,
            quantity: 1
          }
        ],

        success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/cancel`,

        // For subscriptions, platform fee is handled here (NOT payment_intent_data)
        subscription_data:
          connectedAccount && feePercent > 0
            ? {
                application_fee_percent: feePercent,
                transfer_data: { destination: connectedAccount }
              }
            : undefined,

        metadata: {
          tenant_id: brand.tenant_id,
          user_id: typeof user._id === "string" ? user._id : user._id.toString()
        }
      },
      // If you want the Checkout Session itself created “on behalf of” the connected acct,
      // you can also pass stripeAccount option here. But for a platform subscription flow,
      // using subscription_data.transfer_data is usually the right move.
      undefined
    );

    return session;
  } catch (err) {
    console.error("Stripe checkout session creation error:", err);
    throw err;
  }
}
