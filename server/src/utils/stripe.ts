import Stripe from "stripe";

let stripeInstance;

export const getStripeInstance = () => {
  if (!stripeInstance) {
    const stripeKey = process.env.STRIPE_SECRET_KEY || "";
    stripeInstance = new Stripe(stripeKey, {
      apiVersion: "2025-02-24.acacia"
    });
  }
  return stripeInstance;
};

export const createStripeConnectAccount = async (tenantId, email) => {
  const stripe = getStripeInstance();
  
  try {
    const account = await stripe.accounts.create({
      type: "express",
      email,
      metadata: { tenantId },
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true }
      }
    });
    
    return account;
  } catch (error) {
    console.error("Stripe Connect account creation error:", error);
    throw error;
  }
};

export const createAccountLink = async (accountId, refreshUrl, returnUrl) => {
  const stripe = getStripeInstance();
  
  try {
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding"
    });
    
    return accountLink;
  } catch (error) {
    console.error("Stripe account link creation error:", error);
    throw error;
  }
};

export const createCheckoutSessionWithPlatformFee = async (brand, user, priceId, amount) => {
  const stripe = getStripeInstance();
  
  try {
    const platformFeeAmount = Math.round(amount * brand.platformFee);
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      customer_email: user.email,
      line_items: [{
        price: priceId,
        quantity: 1
      }],
      mode: "subscription",
      success_url: `${brand.customDomain || process.env.VITE_API_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${brand.customDomain || process.env.VITE_API_URL}/cancel`,
      payment_intent_data: brand.stripeAccount ? {
        application_fee_amount: platformFeeAmount,
        transfer_data: {
          destination: brand.stripeAccount
        }
      } : undefined,
      metadata: {
        tenant_id: brand.tenant_id,
        user_id: user._id.toString()
      }
    });
    
    return session;
  } catch (error) {
    console.error("Stripe checkout session creation error:", error);
    throw error;
  }
};
