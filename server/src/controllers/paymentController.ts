import { validationResult } from 'express-validator';
import { Request, Response } from 'express';
import { getStripeInstance } from '../lib/utils/stripe.js';
import Payment from '../models/Payment.js';
import User from '../models/User.js';
import {
  STRIPE_PRICING,
  getTierConfig,
  getTierFromPriceId,
  getTierLimits,
  buildCheckoutOptions,
  mapSubscriptionStatus,
  WEBHOOK_EVENTS,
} from '../config/stripeConfig.js';
import { CANONICAL_TIER_PRICING, TIER_LIMITS, meetsMinimumTier } from '../../../shared/types.js';
import type { CanonicalTier, LegacyTier, TierBillingModel } from '../../../shared/types.js';
import {
  SCAN_PACKS,
  getAvailablePackCredits,
  getEffectivePackScans,
  getPackBonusPercentForTier,
  getScanPackByKey,
  grantPackCreditsFromCheckoutSession,
} from '../services/scanPackCredits.js';
import { settleReferralCreditsIfEligible } from '../services/referralCredits.js';
import { handleTrialConversionFromStripe } from '../services/trialService.js';
import { createUserNotification } from '../services/notificationService.js';
import { getPool } from '../services/postgresql.js';
import { logWebhookSignatureFailure, sanitizeAndLogError } from '../lib/securityEventLogger.js';

// FRONTEND_URL may be comma-separated (for CORS). Take the first origin for Stripe redirects.
const FRONTEND_URL = (process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || 'https://aivis.biz')
  .split(',')[0].trim();

const TIER_INITIAL_BONUS_PERCENT: Record<string, { monthly: number; yearly: number }> = {
  signal: { monthly: 14, yearly: 30 },
  scorefix: { monthly: 30, yearly: 59 },
};

const MILESTONE_WINDOW_MINUTES = 120;

type InitialBonusGrantResult = {
  granted: boolean;
  bonusPercent: number;
  baseCredits: number;
  bonusCredits: number;
  totalCreditsAdded: number;
  milestoneQualified: boolean;
  milestoneWindowMinutes: number;
  billingPeriod: 'monthly' | 'yearly';
};

async function getUsageSnapshot(userId: string, tierOverride?: string): Promise<{ monthlyLimit: number; usedThisMonth: number; remainingThisMonth: number }> {
  let tierKey: string;
  if (tierOverride) {
    tierKey = String(tierOverride).toLowerCase();
  } else {
    const user = await User.findById(userId);
    tierKey = String(user?.tier || 'observer').toLowerCase();
  }
  const limits = getTierLimits(tierKey);
  const monthlyLimit = Math.max(0, Number(limits?.auditsPerMonth || 0));

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  const usageRes = await getPool().query(
    `SELECT COALESCE(SUM(requests), 0) AS total_requests
     FROM usage_daily
     WHERE user_id = $1 AND date >= $2 AND date <= $3`,
    [userId, monthStart, monthEnd]
  );

  const usedThisMonth = Math.max(0, Number(usageRes.rows?.[0]?.total_requests || 0));
  const remainingThisMonth = Math.max(0, monthlyLimit - usedThisMonth);
  return { monthlyLimit, usedThisMonth, remainingThisMonth };
}

async function getReferralCreditsEarnedTotal(userId: string): Promise<number> {
  const result = await getPool().query(
    `SELECT COALESCE(SUM(credits_awarded_referrer), 0) AS total_earned
     FROM referral_attributions
     WHERE referrer_user_id = $1 AND status = 'granted'`,
    [userId]
  );
  return Math.max(0, Number(result.rows?.[0]?.total_earned || 0));
}

async function getLatestInitialTierBonusGrant(userId: string): Promise<any | null> {
  const result = await getPool().query(
    `SELECT tier_key, billing_period, bonus_percent, base_credits, bonus_credits, total_credits_added,
            milestone_qualified, milestone_window_minutes, created_at
     FROM tier_credit_bonus_grants
     WHERE user_id = $1 AND reason = 'initial_tier_bonus'
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );
  return result.rows?.[0] || null;
}

async function grantInitialTierBonusIfEligible(args: {
  userId: string;
  canonicalTier: string;
  billingPeriod?: string | null;
}): Promise<InitialBonusGrantResult> {
  const tier = String(args.canonicalTier || '').toLowerCase();
  const billingPeriod = String(args.billingPeriod || 'monthly').toLowerCase() === 'yearly' ? 'yearly' : 'monthly';
  const policy = TIER_INITIAL_BONUS_PERCENT[tier];
  if (!policy) {
    return {
      granted: false,
      bonusPercent: 0,
      baseCredits: 0,
      bonusCredits: 0,
      totalCreditsAdded: 0,
      milestoneQualified: false,
      milestoneWindowMinutes: MILESTONE_WINDOW_MINUTES,
      billingPeriod,
    };
  }

  const bonusPercent = Math.max(0, Number(policy[billingPeriod] || 0));
  const baseCredits = Math.max(0, Number(getTierLimits(tier)?.auditsPerMonth || 0));
  const bonusCredits = Math.max(0, Math.round(baseCredits * (bonusPercent / 100)));
  const totalCreditsAdded = baseCredits + bonusCredits;
  if (totalCreditsAdded <= 0) {
    return {
      granted: false,
      bonusPercent,
      baseCredits,
      bonusCredits,
      totalCreditsAdded,
      milestoneQualified: false,
      milestoneWindowMinutes: MILESTONE_WINDOW_MINUTES,
      billingPeriod,
    };
  }

  const user = await User.findById(args.userId);
  const firstSeen = user?.created_at ? new Date(user.created_at) : new Date();
  const elapsedMinutes = Math.max(0, Math.round((Date.now() - firstSeen.getTime()) / 60000));
  const milestoneQualified = billingPeriod === 'yearly' && elapsedMinutes <= MILESTONE_WINDOW_MINUTES;

  const result = await getPool().query(
    `INSERT INTO tier_credit_bonus_grants
      (user_id, tier_key, billing_period, base_credits, bonus_percent, bonus_credits, total_credits_added, milestone_qualified, milestone_window_minutes, reason)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'initial_tier_bonus')
     ON CONFLICT (user_id, tier_key, billing_period, reason) DO NOTHING
     RETURNING id`,
    [args.userId, tier, billingPeriod, baseCredits, bonusPercent, bonusCredits, totalCreditsAdded, milestoneQualified, MILESTONE_WINDOW_MINUTES]
  );

  if (!result.rows?.length) {
    return {
      granted: false,
      bonusPercent,
      baseCredits,
      bonusCredits,
      totalCreditsAdded,
      milestoneQualified,
      milestoneWindowMinutes: MILESTONE_WINDOW_MINUTES,
      billingPeriod,
    };
  }

  await getPool().query(
    `INSERT INTO scan_pack_credits (user_id, credits_remaining)
     VALUES ($1, $2)
     ON CONFLICT (user_id)
     DO UPDATE SET credits_remaining = scan_pack_credits.credits_remaining + EXCLUDED.credits_remaining,
                   updated_at = NOW()`,
    [args.userId, totalCreditsAdded]
  );

  await getPool().query(
    `INSERT INTO scan_pack_transactions
      (user_id, pack_key, credits_added, amount_cents, currency, status, bonus_percent, bonus_source)
     VALUES ($1, $2, $3, 0, 'usd', 'completed', $4, $5)`,
    [args.userId, `tier_initial_bonus_${tier}`, totalCreditsAdded, bonusPercent, milestoneQualified ? 'tier-initial-bonus-milestone' : 'tier-initial-bonus']
  );

  return {
    granted: true,
    bonusPercent,
    baseCredits,
    bonusCredits,
    totalCreditsAdded,
    milestoneQualified,
    milestoneWindowMinutes: MILESTONE_WINDOW_MINUTES,
    billingPeriod,
  };
}

// ============================================================================
// CHECKOUT SESSION CREATION
// ============================================================================

export const createStripeCheckout = async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({
        success: false,
        error: errors.array()[0].msg,
        statusCode: 422,
      });
    }

    const { tier, brandDomain, billingPeriod = 'monthly' } = req.body;
    const normalizedBillingPeriod = String(billingPeriod || 'monthly').toLowerCase() === 'yearly' ? 'yearly' : 'monthly';
    const userId = req.user?.id;
    const userEmail = req.user?.email;

    // Get tier configuration
    const tierConfig = getTierConfig(tier);

    if (!tierConfig) {
      return res.status(400).json({
        success: false,
        error: `Invalid tier: ${tier}`,
        statusCode: 400,
      });
    }

    // Free tier doesn't need Stripe
    if (tier === 'free' || tier === 'observer') {
      return res.status(400).json({
        success: false,
        error: 'Observer/free tier does not require payment',
        statusCode: 400,
      });
    }

    // Check if the effective price ID is configured for requested billing period
    const checkoutMode = String(tierConfig.mode || '').toLowerCase();
    const effectivePriceId = checkoutMode === 'payment'
      ? tierConfig.priceId
      : normalizedBillingPeriod === 'yearly'
        ? (tierConfig.yearlyPriceId || tierConfig.priceId)
        : tierConfig.priceId;

    if (!effectivePriceId) {
      return res.status(500).json({
        success: false,
        error: `Stripe price ID not configured for tier: ${tier} (${normalizedBillingPeriod})`,
        statusCode: 500,
      });
    }

    // For whitelabel, setup price is also required
    if (tier === 'whitelabel' && !tierConfig.setupPriceId) {
      return res.status(500).json({
        success: false,
        error: 'Stripe setup price ID not configured for white label',
        statusCode: 500,
      });
    }

    const stripe = getStripeInstance();

    // Build checkout options
    const checkoutOptions = buildCheckoutOptions({
      tierKey: tier,
      userId: userId,
      customerEmail: userEmail,
      brandDomain: brandDomain,
      billingPeriod: normalizedBillingPeriod,
      successUrl: `${FRONTEND_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${FRONTEND_URL}/payment-canceled`,
    });

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create(checkoutOptions);

    // Calculate total amount for the payment record
    const isOneTimeTier = String(tierConfig.mode || '').toLowerCase() === 'payment';
    let totalAmountCents = isOneTimeTier
      ? tierConfig.amountCents
      : billingPeriod === 'yearly' && tierConfig.yearlyAmountCents
        ? tierConfig.yearlyAmountCents
        : tierConfig.amountCents;
    if (tier === 'whitelabel' && tierConfig.setupAmountCents) {
      totalAmountCents += tierConfig.setupAmountCents;
    }

    // Create payment record
    await Payment.create({
      user: userId!,
      tier: tier,
      method: 'stripe',
      status: 'pending',
      stripeSessionId: session.id,
      stripePriceId: tierConfig.priceId ?? undefined,
      amountCents: totalAmountCents,
      currency: 'usd',
      metadata: {
        checkoutMode: tierConfig.mode,
        brandDomain: brandDomain || null,
      },
    });

    res.json({
      success: true,
      data: session.url,
      sessionId: session.id,
    });
  } catch (error: any) {
    console.error('Stripe checkout error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create checkout session',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      statusCode: 500,
    });
  }
};

// ============================================================================
// CUSTOMER PORTAL (for managing subscriptions)
// ============================================================================

export const createCustomerPortal = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const userEmail = req.user?.email;

    // Find user's Stripe customer ID
    const payment = await Payment.findLatestByUser(userId!);
    let stripeCustomerId = payment?.stripe_customer_id;

    // If no stored customer ID, try to find or create the Stripe customer by email
    if (!stripeCustomerId && userEmail) {
      const stripe = getStripeInstance();
      const existing = await stripe.customers.list({ email: userEmail, limit: 1 });
      if (existing.data.length > 0) {
        stripeCustomerId = existing.data[0].id;
        // Backfill the customer ID for future lookups
        if (payment) {
          await Payment.findOneAndUpdate(
            { stripeSessionId: payment.stripe_session_id },
            { stripeCustomerId }
          );
        }
      }
    }

    if (!stripeCustomerId) {
      return res.status(404).json({
        success: false,
        error: 'No active subscription found',
        statusCode: 404,
      });
    }

    const stripe = getStripeInstance();

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${FRONTEND_URL}/dashboard`,
    });

    res.json({
      success: true,
      data: portalSession.url,
    });
  } catch (error: any) {
    console.error('Customer portal error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create customer portal session',
      statusCode: 500,
    });
  }
};

export const createScanPackCheckout = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const userEmail = req.user?.email;
    const userTier = String(req.user?.tier || 'observer');
    const normalizedTier = String(userTier || 'observer').trim().toLowerCase();
    const packKey = String((req.body as any)?.packKey || '').trim().toLowerCase();

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized', statusCode: 401 });
    }

    if (normalizedTier === 'observer' || normalizedTier === 'free') {
      return res.status(403).json({
        success: false,
        error: 'Observer tier is not eligible to purchase extra audit credits',
        code: 'OBSERVER_SCAN_PACK_BLOCKED',
        statusCode: 403,
      });
    }

    const pack = getScanPackByKey(packKey);
    if (!pack) {
      return res.status(400).json({ success: false, error: 'Invalid scan pack', statusCode: 400 });
    }
    if (!pack.priceId) {
      return res.status(500).json({ success: false, error: `Stripe price ID not configured for ${pack.key}`, statusCode: 500 });
    }

    const bonusPercent = getPackBonusPercentForTier(userTier);
    const effectiveScans = getEffectivePackScans(pack.scans, bonusPercent);

    const stripe = getStripeInstance();
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{ price: pack.priceId, quantity: 1 }],
      success_url: `${FRONTEND_URL}/billing?pack=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${FRONTEND_URL}/billing?pack=cancel`,
      customer_email: userEmail,
      client_reference_id: userId,
      metadata: {
        userId,
        purchase_type: 'scan_pack',
        pack_key: pack.key,
        scans_added: String(pack.scans),
        bonus_percent: String(bonusPercent),
        effective_scans: String(effectiveScans),
      },
    });

    await Payment.create({
      user: userId,
      tier: 'scan_pack',
      method: 'stripe',
      status: 'pending',
      stripeSessionId: session.id,
      stripePriceId: pack.priceId,
      amountCents: pack.amountCents,
      currency: 'usd',
      metadata: {
        purchase_type: 'scan_pack',
        pack_key: pack.key,
        scans_added: pack.scans,
      },
    });

    return res.json({ success: true, data: session.url, sessionId: session.id, pack: { key: pack.key, scans: pack.scans } });
  } catch (error: any) {
    console.error('Stripe scan pack checkout error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create scan pack checkout session',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      statusCode: 500,
    });
  }
};

export const getCurrentSubscription = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const userTier = req.user?.tier || 'observer';

    const planNameMap: Record<string, string> = {
      observer: 'Observer [Free]',
      alignment: 'Alignment [Core]',
      signal: 'Signal [Premium]',
      scorefix: 'Score Fix [AutoPR]',
    };

    const normalizedTier = String(userTier).toLowerCase();
    const planName =
      planNameMap[normalizedTier] ||
      normalizedTier.charAt(0).toUpperCase() + normalizedTier.slice(1);

    const payment = await Payment.findLatestByUser(userId!);

    const packCredits = userId ? await getAvailablePackCredits(userId) : 0;
    const usage = userId ? await getUsageSnapshot(userId, normalizedTier) : { monthlyLimit: 0, usedThisMonth: 0, remainingThisMonth: 0 };
    const referralCreditsEarnedTotal = userId ? await getReferralCreditsEarnedTotal(userId) : 0;
    const scanPackBonusPercent = getPackBonusPercentForTier(userTier);
    const latestInitialBonusGrant = userId ? await getLatestInitialTierBonusGrant(userId) : null;

    const creditBonusPolicy = {
      scanPackTierBoost: {
        signalPercent: 20,
        scorefixPercent: 40,
      },
      initialTierBonus: {
        signal: { monthlyPercent: 14, yearlyPercent: 30 },
        scorefix: { monthlyPercent: 30, yearlyPercent: 59 },
        milestoneWindowHours: 2,
      },
    };

    const canBuyScanPacks = normalizedTier !== 'observer' && normalizedTier !== 'free';

    // Fetch trial state from user row
    const trialRow = userId
      ? await getPool().query(`SELECT trial_ends_at, trial_used FROM users WHERE id = $1`, [userId])
      : null;
    const trialEndsAt = trialRow?.rows[0]?.trial_ends_at || null;
    const trialUsed = trialRow?.rows[0]?.trial_used === true;
    const trialActive = Boolean(trialEndsAt && new Date(trialEndsAt) > new Date());
    const trialDaysRemaining = trialActive
      ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86_400_000))
      : 0;

    const scanPacksWithBoost = canBuyScanPacks
      ? Object.values(SCAN_PACKS).map((pack) => ({
          key: pack.key,
          scans: pack.scans,
          amountCents: pack.amountCents,
          amountUsd: pack.amountCents / 100,
          bonusPercent: scanPackBonusPercent,
          effectiveScans: getEffectivePackScans(pack.scans, scanPackBonusPercent),
        }))
      : [];

    const totalAuditCreditsAvailable = Math.max(0, Number(usage.remainingThisMonth || 0) + Number(packCredits || 0));

    const initialTierBonus = latestInitialBonusGrant
      ? {
          tier: String(latestInitialBonusGrant.tier_key || ''),
          billingPeriod: String(latestInitialBonusGrant.billing_period || 'monthly'),
          bonusPercent: Number(latestInitialBonusGrant.bonus_percent || 0),
          baseCredits: Number(latestInitialBonusGrant.base_credits || 0),
          bonusCredits: Number(latestInitialBonusGrant.bonus_credits || 0),
          totalCreditsAdded: Number(latestInitialBonusGrant.total_credits_added || 0),
          milestoneQualified: Boolean(latestInitialBonusGrant.milestone_qualified),
          milestoneWindowMinutes: Number(latestInitialBonusGrant.milestone_window_minutes || MILESTONE_WINDOW_MINUTES),
          grantedAt: latestInitialBonusGrant.created_at,
        }
      : null;

    if (!payment?.stripe_subscription_id) {
      return res.json({
        planName,
        status: trialActive ? 'trialing' : 'active',
        currentPeriodEnd: null,
        packCreditsRemaining: packCredits,
        referralCreditsEarnedTotal,
        totalAuditCreditsAvailable,
        usage,
        creditBonusPolicy,
        initialTierBonus,
        scanPacks: scanPacksWithBoost,
        trial: {
          active: trialActive,
          endsAt: trialEndsAt,
          daysRemaining: trialDaysRemaining,
          used: trialUsed,
        },
      });
    }

    return res.json({
      planName,
      status: (payment.subscription_status || (trialActive ? 'trialing' : 'active')) as
        | 'active'
        | 'trialing'
        | 'past_due'
        | 'canceled'
        | 'incomplete',
      currentPeriodEnd: payment.current_period_end || payment.updated_at,
      packCreditsRemaining: packCredits,
      referralCreditsEarnedTotal,
      totalAuditCreditsAvailable,
      usage,
      creditBonusPolicy,
      initialTierBonus,
      scanPacks: scanPacksWithBoost,
      trial: {
        active: trialActive,
        endsAt: trialEndsAt,
        daysRemaining: trialDaysRemaining,
        used: trialUsed,
      },
    });
  } catch (error: any) {
    console.error('Get subscription error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch subscription',
      statusCode: 500,
    });
  }
};

// ============================================================================
// WEBHOOK HANDLER
// ============================================================================

export const handleStripeWebhook = async (req: Request, res: Response) => {
  const stripe = getStripeInstance();
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

  if (!webhookSecret) {
    console.error('[Stripe Webhook] STRIPE_WEBHOOK_SECRET is not set — all webhook events will be rejected. Configure this env var in your deployment.');
    return res.status(500).json({ success: false, error: 'Webhook endpoint misconfigured — missing secret' });
  }

  if (!sig) {
    logWebhookSignatureFailure(req, 'stripe');
    return res.status(400).json({ success: false, error: 'Missing stripe-signature header' });
  }

  let event;

  // Verify webhook signature
  // The global express.json() skips /api/payment/webhook, so express.raw() on the route
  // delivers the raw Buffer as req.body — exactly what Stripe needs.
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    logWebhookSignatureFailure(req, 'stripe');
    return res.status(400).json({
      success: false,
      error: 'Webhook Error: invalid signature',
    });
  }

  const connectedAccountId = getConnectedAccountId(event);
  const webhookMode = getStripeWebhookMode();
  const livemode = event?.livemode === true;

  console.log(
    `[Stripe Webhook] Received event: ${event.type} | livemode=${livemode} | scope=${connectedAccountId ? `connected:${connectedAccountId}` : 'platform'}`
  );

  if (!shouldProcessByWebhookMode(webhookMode, livemode)) {
    console.log(
      `[Stripe Webhook] Skipping event ${event.type} due to STRIPE_WEBHOOK_MODE=${webhookMode} (event.livemode=${livemode})`
    );
    return res.json({
      received: true,
      skipped: true,
      reason: `webhook_mode_${webhookMode}_mismatch`,
      livemode,
      eventType: event.type,
      scope: connectedAccountId ? 'connected_account' : 'platform',
    });
  }

  try {
    // Route to appropriate handler
    switch (event.type) {
      // ---- Checkout Events ----
      case WEBHOOK_EVENTS.CHECKOUT_COMPLETED:
        await handleCheckoutCompleted(event.data.object);
        break;

      case WEBHOOK_EVENTS.CHECKOUT_EXPIRED:
        await handleCheckoutExpired(event.data.object);
        break;

      // ---- Subscription Events ----
      case WEBHOOK_EVENTS.SUBSCRIPTION_CREATED:
        await handleSubscriptionCreated(event.data.object);
        break;

      case WEBHOOK_EVENTS.SUBSCRIPTION_UPDATED:
        await handleSubscriptionUpdated(event.data.object);
        break;

      case WEBHOOK_EVENTS.SUBSCRIPTION_DELETED:
        await handleSubscriptionDeleted(event.data.object);
        break;

      // ---- Invoice Events ----
      case WEBHOOK_EVENTS.INVOICE_PAID:
        await handleInvoicePaid(event.data.object);
        break;

      case WEBHOOK_EVENTS.INVOICE_PAYMENT_FAILED:
        await handleInvoicePaymentFailed(event.data.object);
        break;

      // ---- Payment Intent Events (for one-time payments like buyout) ----
      case WEBHOOK_EVENTS.PAYMENT_INTENT_SUCCEEDED:
        if (connectedAccountId) {
          await handleConnectPaymentIntentSucceeded(event.data.object, connectedAccountId, livemode);
        } else {
          await handlePaymentIntentSucceeded(event.data.object);
        }
        break;

      case WEBHOOK_EVENTS.PAYMENT_INTENT_FAILED:
        await handlePaymentIntentFailed(event.data.object);
        break;

      // ---- Connect events ----
      case WEBHOOK_EVENTS.PAYOUT_FAILED:
        await handleConnectPayoutFailed(event.data.object, connectedAccountId, livemode);
        break;

      case WEBHOOK_EVENTS.CONNECT_V2_ACCOUNT_CLOSED:
        await handleConnectAccountClosed(event.data.object, connectedAccountId, livemode);
        break;

      case WEBHOOK_EVENTS.CONNECT_V2_ACCOUNT_UPDATED:
        await handleConnectAccountUpdated(event.data.object, connectedAccountId, livemode);
        break;

      case WEBHOOK_EVENTS.CONNECT_V2_ACCOUNT_MERCHANT_CAPABILITY_STATUS_UPDATED:
      case WEBHOOK_EVENTS.CONNECT_V2_ACCOUNT_CUSTOMER_CAPABILITY_STATUS_UPDATED:
      case WEBHOOK_EVENTS.CONNECT_V2_ACCOUNT_RECIPIENT_CAPABILITY_STATUS_UPDATED:
        await handleConnectCapabilityStatusUpdated(event.type, event.data.object, connectedAccountId, livemode);
        break;

      case WEBHOOK_EVENTS.CONNECT_V2_ACCOUNT_PERSON_UPDATED:
        await handleConnectAccountPersonUpdated(event.data.object, connectedAccountId, livemode);
        break;

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error: any) {
    sanitizeAndLogError(`[Stripe Webhook] Error handling ${event.type}`, error, req);
    // Return 200 to acknowledge receipt (Stripe will retry on 5xx)
    res.status(200).json({
      received: true,
      error: 'Handler error logged',
    });
  }
};

function getStripeWebhookMode(): 'all' | 'live' | 'test' {
  const raw = String(process.env.STRIPE_WEBHOOK_MODE || 'all').trim().toLowerCase();
  if (raw === 'live' || raw === 'test' || raw === 'all') return raw;
  return 'all';
}

function shouldProcessByWebhookMode(mode: 'all' | 'live' | 'test', livemode: boolean): boolean {
  if (mode === 'all') return true;
  if (mode === 'live') return livemode;
  if (mode === 'test') return !livemode;
  return true;
}

function getConnectedAccountId(event: any): string | null {
  const fromClassicConnect = typeof event?.account === 'string' ? event.account : null;
  if (fromClassicConnect) return fromClassicConnect;
  const fromV2RelatedObject =
    typeof event?.related_object?.id === 'string'
      ? event.related_object.id
      : typeof event?.data?.object?.related_object?.id === 'string'
        ? event.data.object.related_object.id
        : null;
  return fromV2RelatedObject;
}

// ============================================================================
// WEBHOOK EVENT HANDLERS
// ============================================================================

/**
 * Handle successful checkout completion
 */
async function handleCheckoutCompleted(session: any) {
  console.log(`[Checkout Completed] Session: ${session.id}`);

  const userId = session.metadata?.userId || session.client_reference_id;
  const tierKey = session.metadata?.tier_key;
  const purchaseType = session.metadata?.purchase_type;

  if (!userId) {
    console.error('[Checkout Completed] Missing userId in session metadata');
    return;
  }

  if (session.customer) {
    await getPool().query(
      `UPDATE users
       SET stripe_customer_id = COALESCE(stripe_customer_id, $2),
           updated_at = NOW()
       WHERE id = $1`,
      [userId, String(session.customer)]
    );
  }

  // Update payment record if it exists; otherwise create it (webhook can arrive before our DB write)
  const existing = await Payment.findBySessionId(session.id);
  if (existing) {
    await Payment.findOneAndUpdate(
      { stripeSessionId: session.id },
      {
        status: 'completed',
        stripeCustomerId: session.customer,
        stripeSubscriptionId: session.subscription,
        completedAt: new Date(),
      }
    );
  } else {
    await Payment.create({
      user: userId,
      tier: tierKey || 'unknown',
      method: 'stripe',
      status: 'completed',
      stripeSessionId: session.id,
      stripeCustomerId: session.customer,
      stripeSubscriptionId: session.subscription,
      amountCents: session.amount_total,
      currency: session.currency,
      completedAt: new Date(),
    });
      tier: tierKey || 'unknown',
      method: 'stripe',
      status: 'completed',
      stripeSessionId: session.id,
      stripeCustomerId: session.customer,
      stripeSubscriptionId: session.subscription,
      amountCents: session.amount_total,
      currency: session.currency,
      completedAt: new Date(),
    });
  }

  // One-time scan pack purchase (credit grant, no tier change)
  if (purchaseType === 'scan_pack') {
    const packKey = String(session.metadata?.pack_key || '');
    const userRecord = await User.findById(userId);
    const currentTier = String(userRecord?.tier || 'observer').toLowerCase();
    const bonusPercent = getPackBonusPercentForTier(currentTier);
    const grant = await grantPackCreditsFromCheckoutSession({
      userId,
      packKey,
      stripeSessionId: session.id,
      stripePaymentIntentId: session.payment_intent || null,
      amountCents: typeof session.amount_total === 'number' ? session.amount_total : null,
      currency: session.currency || 'usd',
      bonusPercent,
      bonusSource: bonusPercent > 0 ? `tier-pack-boost:${currentTier}` : 'standard-pack',
    });

    console.log(
      `[Checkout Completed] Scan pack processed for user ${userId}: granted=${grant.granted} +${grant.creditsAdded}, remaining=${grant.totalRemaining}`
    );
    return;
  }

  // Update user tier for subscription checkout
  if (tierKey) {
    const billingPeriod = String(session.metadata?.billing_period || 'monthly');
    await updateUserTier(userId, tierKey, session.subscription, billingPeriod);

    // Mark trial as converted if user was on a trial
    handleTrialConversionFromStripe(userId, tierKey).catch((err: any) => {
      console.warn(`[Checkout Completed] Trial conversion tracking failed (non-fatal):`, err?.message);
    });
  }

  console.log(`[Checkout Completed] User ${userId} upgraded to ${tierKey}`);

  if (userId && tierKey) {
    createUserNotification({
      userId,
      eventType: 'plan_upgraded',
      title: `Upgraded to ${tierKey.charAt(0).toUpperCase() + tierKey.slice(1)}`,
      message: `Your plan has been upgraded to ${tierKey}. Enjoy your new features!`,
      metadata: { tier: tierKey, stripeSessionId: session.id },
    }).catch(() => {});
  }
}

/**
 * Handle expired checkout session
 */
async function handleCheckoutExpired(session: any) {
  console.log(`[Checkout Expired] Session: ${session.id}`);

  await Payment.findOneAndUpdate(
    { stripeSessionId: session.id },
    { status: 'failed', failedAt: new Date() }
  );
}

/**
 * Handle new subscription created
 */
async function handleSubscriptionCreated(subscription: any) {
  console.log(`[Subscription Created] ID: ${subscription.id}`);

  const userId = subscription.metadata?.userId;
  const tierKey =
    subscription.metadata?.tier_key || getTierFromPriceId(subscription.items.data[0]?.price?.id);
  const priceId = String(subscription.items?.data?.[0]?.price?.id || '');
  const stripeCustomerId = String(subscription.customer || '');

  if (userId && stripeCustomerId) {
    await getPool().query(
      `UPDATE users
       SET stripe_customer_id = COALESCE(stripe_customer_id, $2),
           stripe_subscription_id = $3,
           updated_at = NOW()
       WHERE id = $1`,
      [userId, stripeCustomerId, String(subscription.id)]
    );
  }

  if (userId) {
    await upsertSubscriptionRecord({
      userId,
      stripeSubscriptionId: String(subscription.id),
      status: mapSubscriptionStatus(subscription.status),
      priceId: priceId || null,
      currentPeriodEnd: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null,
    });
  }

  if (userId && tierKey) {
    const billingPeriod = String(subscription.metadata?.billing_period || 'monthly');
    await updateUserTier(userId, tierKey, subscription.id, billingPeriod);

    // If the subscription starts in a trial, record trial_ends_at so the entitlement
    // guard can enforce the 14-day deadline.
    if (subscription.status === 'trialing' && subscription.trial_end) {
      const trialEndsAt = new Date(subscription.trial_end * 1000);
      await getPool().query(
        `UPDATE users SET trial_ends_at = $2, trial_used = TRUE, updated_at = NOW() WHERE id = $1`,
        [userId, trialEndsAt.toISOString()]
      );
      console.log(`[Subscription Created] User ${userId} started trial until ${trialEndsAt.toISOString()}`);
    }

    await Payment.findOneAndUpdate(
      { stripeSubscriptionId: subscription.id },
      {
        subscriptionStatus: mapSubscriptionStatus(subscription.status),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      }
    );
  }
}

/**
 * Handle subscription updates (upgrade, downgrade, status change)
 */
async function handleSubscriptionUpdated(subscription: any) {
  console.log(`[Subscription Updated] ID: ${subscription.id}, Status: ${subscription.status}`);

  const userId = subscription.metadata?.userId;

  // Get the new tier from the subscription's price
  const priceId = subscription.items.data[0]?.price?.id;
  const newTierKey = subscription.metadata?.tier_key || getTierFromPriceId(priceId);
  const stripeCustomerId = String(subscription.customer || '');

  if (userId && stripeCustomerId) {
    await getPool().query(
      `UPDATE users
       SET stripe_customer_id = COALESCE(stripe_customer_id, $2),
           stripe_subscription_id = $3,
           updated_at = NOW()
       WHERE id = $1`,
      [userId, stripeCustomerId, String(subscription.id)]
    );
  }

  if (userId) {
    await upsertSubscriptionRecord({
      userId,
      stripeSubscriptionId: String(subscription.id),
      status: mapSubscriptionStatus(subscription.status),
      priceId: priceId || null,
      currentPeriodEnd: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null,
    });
  }

  // Update payment record
  await Payment.findOneAndUpdate(
    { stripeSubscriptionId: subscription.id },
    {
      subscriptionStatus: mapSubscriptionStatus(subscription.status),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    }
  );

  // Handle status-based tier changes
  if (subscription.status === 'active' && userId && newTierKey) {
    );
    await updateUserTier(userId, 'free', null, null);
    // Also clear trial state
    await getPool().query(
      `UPDATE users SET trial_ends_at = NULL, updated_at = NOW() WHERE id = $1`,
      [userId]
    );

    createUserNotification({
      userId,
      eventType: 'plan_downgraded',
      title: 'Plan Downgraded',
      message: `Your subscription status changed to ${subscription.status}. You\'ve been moved to the Observer plan.`,
      metadata: { reason: subscription.status },
    }).catch(() => {});
  }
}

/**
 * Handle subscription deletion/cancellation
 */
async function handleSubscriptionDeleted(subscription: any) {
  console.log(`[Subscription Deleted] ID: ${subscription.id}`);

  const userId = subscription.metadata?.userId;
  const priceId = String(subscription.items?.data?.[0]?.price?.id || '');

  // Update payment record
  await Payment.findOneAndUpdate(
    { stripeSubscriptionId: subscription.id },
    {
      subscriptionStatus: 'canceled',
      canceledAt: new Date(),
    }
  );

  // Downgrade user to free tier
  if (userId) {
    await upsertSubscriptionRecord({
      userId,
      stripeSubscriptionId: String(subscription.id),
      status: 'canceled',
      priceId: priceId || null,
      currentPeriodEnd: null,
    });
    await updateUserTier(userId, 'free', null, null);
    await getPool().query(
      `UPDATE users SET trial_ends_at = NULL, updated_at = NOW() WHERE id = $1`,
      [userId]
    );
    console.log(`[Subscription Deleted] User ${userId} downgraded to free tier`);

    createUserNotification({
      userId,
      eventType: 'plan_canceled',
      title: 'Subscription Canceled',
      message: 'Your subscription has been canceled. You\'ve been moved to the free Observer plan.',
      metadata: { subscriptionId: subscription.id },
    }).catch(() => {});
  }
}

async function upsertSubscriptionRecord(args: {
  userId: string;
  stripeSubscriptionId: string;
  status: string;
  priceId: string | null;
  currentPeriodEnd: string | null;
}) {
  await getPool().query(
    `INSERT INTO subscriptions (user_id, stripe_subscription_id, status, price_id, current_period_end, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (stripe_subscription_id)
     DO UPDATE SET status = EXCLUDED.status,
                   price_id = EXCLUDED.price_id,
                   current_period_end = EXCLUDED.current_period_end,
                   updated_at = NOW()`,
    [args.userId, args.stripeSubscriptionId, args.status, args.priceId, args.currentPeriodEnd]
  );
}

/**
 * Handle successful invoice payment
 */
async function handleInvoicePaid(invoice: any) {
  console.log(`[Invoice Paid] ID: ${invoice.id}, Subscription: ${invoice.subscription}`);

  if (!invoice.subscription) return; // Skip one-time invoices

  // Record the successful payment
  await Payment.findOneAndUpdate(
    { stripeSubscriptionId: invoice.subscription },
    {
      lastPaymentAt: new Date(),
      lastInvoiceId: invoice.id,
      subscriptionStatus: 'active',
    }
  );
}

/**
 * Handle failed invoice payment
 */
async function handleInvoicePaymentFailed(invoice: any) {
  console.log(`[Invoice Payment Failed] ID: ${invoice.id}, Subscription: ${invoice.subscription}`);

      metadata: { reason: subscription.status },
    }).catch(() => {});
  }
}

/**
 * Handle subscription deletion/cancellation
 */
async function handleSubscriptionDeleted(subscription: any) {
  console.log(`[Subscription Deleted] ID: ${subscription.id}`);

  const userId = subscription.metadata?.userId;
  const priceId = String(subscription.items?.data?.[0]?.price?.id || '');

  // Update payment record
  await Payment.findOneAndUpdate(
    { stripeSubscriptionId: subscription.id },
    {
      subscriptionStatus: 'canceled',
      canceledAt: new Date(),
    }
  );

  // Downgrade user to free tier
  if (userId) {
    await upsertSubscriptionRecord({
      userId,
      stripeSubscriptionId: String(subscription.id),
      status: 'canceled',
      priceId: priceId || null,
      currentPeriodEnd: null,
    });
    await updateUserTier(userId, 'free', null, null);
    await getPool().query(
      `UPDATE users SET trial_ends_at = NULL, updated_at = NOW() WHERE id = $1`,
      [userId]
    );
    console.log(`[Subscription Deleted] User ${userId} downgraded to free tier`);

    createUserNotification({
      userId,
      eventType: 'plan_canceled',
      title: 'Subscription Canceled',
      message: 'Your subscription has been canceled. You\'ve been moved to the free Observer plan.',
      metadata: { subscriptionId: subscription.id },
    }).catch(() => {});
  }
}

async function upsertSubscriptionRecord(args: {
  userId: string;
  stripeSubscriptionId: string;
  status: string;
  priceId: string | null;
  currentPeriodEnd: string | null;
}) {
  await getPool().query(
    `INSERT INTO subscriptions (user_id, stripe_subscription_id, status, price_id, current_period_end, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (stripe_subscription_id)
     DO UPDATE SET status = EXCLUDED.status,
                   price_id = EXCLUDED.price_id,
                   current_period_end = EXCLUDED.current_period_end,
                   updated_at = NOW()`,
    [args.userId, args.stripeSubscriptionId, args.status, args.priceId, args.currentPeriodEnd]
  );
}

/**
 * Handle successful invoice payment
 */
async function handleInvoicePaid(invoice: any) {
  console.log(`[Invoice Paid] ID: ${invoice.id}, Subscription: ${invoice.subscription}`);

  if (!invoice.subscription) return; // Skip one-time invoices

  // Record the successful payment
  await Payment.findOneAndUpdate(
    { stripeSubscriptionId: invoice.subscription },
    {
      lastPaymentAt: new Date(),
      lastInvoiceId: invoice.id,
      subscriptionStatus: 'active',
    }
  );
}

/**
 * Handle failed invoice payment
 */
async function handleInvoicePaymentFailed(invoice: any) {
  console.log(`[Invoice Payment Failed] ID: ${invoice.id}, Subscription: ${invoice.subscription}`);

  const subscriptionId = invoice.subscription;
  if (!subscriptionId) return;

  // Update payment record
  const payment = await Payment.findOneAndUpdate(
    { stripeSubscriptionId: subscriptionId },
    {
      subscriptionStatus: 'past_due',
      lastFailedPaymentAt: new Date(),
      failedInvoiceId: invoice.id,
    }
  );

  // Optionally restrict user access after failed payment
  if (payment?.user_id) {
    // You could implement a "restricted" status here
    console.log(`[Invoice Failed] User ${payment.user_id} has a failed payment`);
    // await User.findByIdAndUpdate(payment.user, { paymentStatus: 'past_due' });
  }
}

/**
 * Handle successful one-time payment (e.g., buyout)
 */
async function handlePaymentIntentSucceeded(paymentIntent: any) {
  console.log(`[Payment Intent Succeeded] ID: ${paymentIntent.id}`);

  const userId = paymentIntent.metadata?.userId;
  const tierKey = paymentIntent.metadata?.tier_key;

  if (userId && tierKey === 'buyout') {
    await updateUserTier(userId, 'buyout', null, null);
    console.log(`[Buyout Complete] User ${userId} set to signal tier`);
  }
}

/**
 * Handle failed one-time payment
 */
async function handlePaymentIntentFailed(paymentIntent: any) {
  console.log(`[Payment Intent Failed] ID: ${paymentIntent.id}`);

  // Update any associated payment record
  await Payment.findOneAndUpdate(
    { 'metadata.paymentIntentId': paymentIntent.id },
    { status: 'failed', failedAt: new Date() }
  );
}

async function handleConnectAccountUpdated(accountEventObject: any, connectedAccountId: string | null, livemode: boolean) {
  const accountId = connectedAccountId || accountEventObject?.id || accountEventObject?.related_object?.id || 'unknown';
  console.log(
    `[Connect Webhook] account.updated | account=${accountId} | livemode=${livemode}`
  );
}

async function handleConnectCapabilityStatusUpdated(
  eventType: string,
  accountEventObject: any,
  connectedAccountId: string | null,
  livemode: boolean
) {
  const accountId = connectedAccountId || accountEventObject?.id || accountEventObject?.related_object?.id || 'unknown';
  console.log(
    `[Connect Webhook] capability_status_updated | event=${eventType} | account=${accountId} | livemode=${livemode}`
  );
}

async function handleConnectAccountClosed(accountEventObject: any, connectedAccountId: string | null, livemode: boolean) {
  const accountId = connectedAccountId || accountEventObject?.id || accountEventObject?.related_object?.id || 'unknown';
  console.log(
    `[Connect Webhook] account.closed | account=${accountId} | livemode=${livemode}`
  );
}

async function handleConnectAccountPersonUpdated(personEventObject: any, connectedAccountId: string | null, livemode: boolean) {
  const accountId = connectedAccountId || personEventObject?.account || personEventObject?.related_object?.id || 'unknown';
  const personId = personEventObject?.id || 'unknown';
  console.log(
    `[Connect Webhook] account_person.updated | account=${accountId} | person=${personId} | livemode=${livemode}`
  );
}

async function handleConnectPayoutFailed(payout: any, connectedAccountId: string | null, livemode: boolean) {
  const accountId = connectedAccountId || payout?.destination || payout?.account || 'unknown';
  console.warn(
    `[Connect Webhook] payout.failed | account=${accountId} | payout=${payout?.id || 'unknown'} | livemode=${livemode}`
  );
}

async function handleConnectPaymentIntentSucceeded(paymentIntent: any, connectedAccountId: string | null, livemode: boolean) {
  console.log(
    `[Connect Webhook] payment_intent.succeeded | account=${connectedAccountId || 'unknown'} | payment_intent=${paymentIntent?.id || 'unknown'} | livemode=${livemode}`
  );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Update user's tier in the database
 */
async function updateUserTier(userId: string, tierKey: string, subscriptionId: string | null, billingPeriod: string | null = null) {
  // Map Stripe tier keys → canonical tiers stored in the users table.
  // 'observer' / 'free' → free tier
  // 'alignment' / 'pro' → alignment (paid, entry)
  // 'signal' / 'business' / 'enterprise' / 'whitelabel' / 'buyout' → signal
  // 'scorefix' → scorefix (AutoPR remediation tier)
  const tierMap: Record<string, string> = {
    free: 'observer',
    observer: 'observer',
    alignment: 'alignment',
    pro: 'alignment',
    signal: 'signal',
    scorefix: 'scorefix',
    business: 'signal',
    enterprise: 'signal',
    whitelabel: 'signal',
    buyout: 'signal',
  };

  const canonicalTier = tierMap[tierKey] ?? 'observer';

  await User.findByIdAndUpdate(userId, {
    tier: canonicalTier,
    stripe_subscription_id: subscriptionId,
  });

  if (!TIER_LIMITS[canonicalTier as CanonicalTier]?.hasApiAccess) {
    try {
      await getPool().query(
        `UPDATE api_keys
         SET enabled = FALSE,
             expires_at = COALESCE(expires_at, NOW())
         WHERE user_id = $1 AND enabled = TRUE`,
        [userId]
      );
    } catch (error: any) {
      console.error(`[API Key Disable] Failed for user ${userId}:`, error?.message || error);
    }
  }

  if (canonicalTier === 'signal' || canonicalTier === 'scorefix') {
    const bonus = await grantInitialTierBonusIfEligible({
      userId,
      canonicalTier,
      billingPeriod,
    });
    if (bonus.granted) {
      console.log(
        `[Tier Bonus] user=${userId} tier=${canonicalTier} period=${bonus.billingPeriod} +${bonus.totalCreditsAdded} (base=${bonus.baseCredits}, bonus=${bonus.bonusCredits}, pct=${bonus.bonusPercent}%, milestone=${bonus.milestoneQualified})`
      );
    }
  }

  settleReferralCreditsIfEligible(userId).catch((err: any) => {
    console.error(`[Referral Settlement] Failed for user ${userId}:`, err?.message || err);
  });

  console.log(`[User Tier Updated] User: ${userId}, tier_key=${tierKey} → canonical=${canonicalTier}`);

  // SOC1: persist tier change to audit log
  try {
    const { logTierChange } = await import('../services/securityAuditService.js');
    await logTierChange(userId, '', tierKey, canonicalTier, 'stripe', {
      subscriptionId: subscriptionId || undefined,
      billingPeriod: billingPeriod || undefined,
    });
  } catch { /* audit log is non-critical */ }
}

// ============================================================================
// PRICING INFO ENDPOINT (public)
// ============================================================================

export const getPricingInfo = async (req: Request, res: Response) => {
  try {
    // Only expose active consumer tiers
    const ACTIVE_TIERS = ['observer', 'alignment', 'signal', 'scorefix'] as const;
    const uploadFilesByTier: Record<CanonicalTier, number> = {
      observer: 0,
      alignment: 5,
      signal: 10,
      scorefix: 15,
    };

    const buildTierFeatures = (tier: CanonicalTier): string[] => {
      const limits = TIER_LIMITS[tier];
      const features: string[] = [];

      features.push(
        tier === 'scorefix'
          ? `${limits.scansPerMonth} included audit credits (one-time)`
          : `${limits.scansPerMonth} audits / month`
      );

      if (tier === 'observer') {
        features.push('AI visibility score');
        features.push('Schema markup audit');
        features.push('Core recommendations');
        features.push('Single-page audit');
        return features;
      }

      features.push(`Document upload audits (up to ${uploadFilesByTier[tier]} files/request)`);
      features.push(`Track ${limits.competitors} competitors`);
      features.push('BRA Authority Checker');
      features.push('Reverse Engineer tools');
      features.push('Analytics dashboard & trends');
      features.push('Brand mention tracking (15 sources)');
      features.push('Private exposure scan');
      features.push('Niche URL discovery');
      if (limits.pagesPerScan > 1) features.push(`Multi-page SEO crawl (${limits.pagesPerScan} pages)`);

      if (limits.hasExports) features.push('JSON / CSV / PDF exports');
      if (limits.hasReportHistory) features.push('Report history');
      if (limits.hasShareableLink) features.push('Shareable report links');
      if (limits.hasForceRefresh) features.push('Force-refresh (bypass cache)');

      if (meetsMinimumTier(tier as CanonicalTier | LegacyTier, 'signal')) {
        features.push('Citation testing workflows');
      }

      if (limits.hasApiAccess) {
        features.push('API access');
        features.push('Webhook automation');
      }

      if (limits.hasScheduledRescans) features.push('Scheduled re-audits');
      if (limits.hasWhiteLabel) features.push('White-label reports');

      if (tier === 'signal' || tier === 'scorefix') {
        features.push('Triple-check AI pipeline (3 models)');
      }

      if (tier === 'scorefix') {
        features.push('Everything in Signal, plus:');
        features.push('Automated GitHub PR remediation via MCP (10-25 credits per fix)');
        features.push('Thorough evidence audit mode');
        features.push('Actual Fix Plan (evidence-linked)');
        features.push('Issue-level validation checklist');
      }

      return features;
    };

    const publicPricing = ACTIVE_TIERS.map((key) => {
      const config = (STRIPE_PRICING as any)[key];
      if (!config) return null;
      const tier = key as CanonicalTier;
      const limits = TIER_LIMITS[tier];

      const baselinePricing = CANONICAL_TIER_PRICING[tier];
      const monthlyAmount = config.amountCents ? config.amountCents / 100 : (baselinePricing.monthlyUsd || 0);
      const yearlyAmount = config.yearlyAmountCents ? config.yearlyAmountCents / 100 : (baselinePricing.yearlyUsd || 0);
      const oneTimeAmount = config.mode === 'payment'
        ? (config.amountCents ? config.amountCents / 100 : (baselinePricing.oneTimeUsd || 0))
        : (baselinePricing.oneTimeUsd || 0);
      const billingModel: TierBillingModel = config.mode === 'payment'
        ? 'one_time'
        : config.mode === 'subscription'
          ? 'subscription'
          : baselinePricing.billingModel;
      const isPaid = billingModel !== 'free';

      return {
        key,
        name: config.name,
        displayName: config.name,
        billingModel,
        pricing: {
          monthly: billingModel === 'subscription' && monthlyAmount > 0 ? { amount: monthlyAmount, formatted: `$${monthlyAmount}` } : null,
          yearly: billingModel === 'subscription' && yearlyAmount > 0 ? { amount: yearlyAmount, formatted: `$${yearlyAmount}` } : null,
          one_time: billingModel === 'one_time' && oneTimeAmount > 0 ? { amount: oneTimeAmount, formatted: `$${oneTimeAmount}` } : null,
        },
        features: buildTierFeatures(tier),
        limits: {
          scans_per_month: limits.scansPerMonth,
          pages_per_scan: limits.pagesPerScan,
          competitors: limits.competitors,
          cache_days: limits.cacheDays,
          exports: limits.hasExports,
          force_refresh: limits.hasForceRefresh,
          api_access: limits.hasApiAccess,
          white_label: limits.hasWhiteLabel,
          scheduled_rescans: limits.hasScheduledRescans,
          report_history: limits.hasReportHistory,
          shareable_link: limits.hasShareableLink,
        },
        isPaid,
      };
    }).filter(Boolean);

    res.json({
      success: true,
      tiers: publicPricing,
      defaultTier: 'observer',
      scan_packs: Object.values(SCAN_PACKS).map((pack) => ({
        key: pack.key,
        scans: pack.scans,
        amount_cents: pack.amountCents,
        amount_usd: pack.amountCents / 100,
        stripe_configured: Boolean(pack.priceId),
      })),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pricing info',
      statusCode: 500,
    });
  }
};

export const getScanPackStatus = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const userTier = String(req.user?.tier || 'observer');
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized', statusCode: 401 });
    }

    const remaining = await getAvailablePackCredits(userId);
    const bonusPercent = getPackBonusPercentForTier(userTier);
    return res.json({
      success: true,
      packCreditsRemaining: remaining,
      scanPacks: Object.values(SCAN_PACKS).map((pack) => ({
        key: pack.key,
        scans: pack.scans,
        amountCents: pack.amountCents,
        amountUsd: pack.amountCents / 100,
        bonusPercent,
        effectiveScans: getEffectivePackScans(pack.scans, bonusPercent),
        stripeConfigured: Boolean(pack.priceId),
      })),
    });
  } catch (error: any) {
    console.error('Get scan pack status error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch scan pack status',
      statusCode: 500,
    });
  }
};

/**
 * Start a 14-day Signal trial without requiring a credit card.
 * - Only allowed once per user (trial_used flag).
 * - Sets tier to 'signal', trial_ends_at to NOW() + 14 days, trial_used = true.
 * - Allowlisted users don't need trials — they already have permanent access.
 */
export const startFreeTrial = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const pool = getPool();
    const userRow = await pool.query(
      `SELECT trial_used, trial_ends_at, tier FROM users WHERE id = $1`,
      [userId]
    );

    if (!userRow.rows[0]) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const { trial_used, trial_ends_at, tier } = userRow.rows[0];

    // If trial already used (even if expired), prevent repeat
    if (trial_used) {
      return res.status(409).json({
        success: false,
        error: 'Free trial has already been used. Please subscribe to continue with Signal.',
        code: 'TRIAL_ALREADY_USED',
      });
    }

    // If already on a paid tier with active subscription, no trial needed
    if (tier !== 'observer' && trial_ends_at === null) {
      return res.status(409).json({
        success: false,
        error: 'You already have an active subscription.',
        code: 'ALREADY_SUBSCRIBED',
      });
    }

    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    await pool.query(
      `UPDATE users
       SET tier = 'signal',
           trial_ends_at = $2,
           trial_used = TRUE,
           trial_tier = 'signal',
           trial_started_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [userId, trialEndsAt.toISOString()]
    );

    console.log(`[StartTrial] User ${userId} started 14-day Signal trial, expires ${trialEndsAt.toISOString()}`);

    return res.json({
      success: true,
      trial: {
        active: true,
        tier: 'signal',
        endsAt: trialEndsAt.toISOString(),
        daysRemaining: 14,
      },
    });
  } catch (error: any) {
    console.error('Start trial error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to start trial',
      statusCode: 500,
    });
  }
};
