/**
 * PayPal payment routes for AiVIS.
 *
 * Provides an alternative payment method alongside Stripe.
 * Routes mirror the Stripe flow: create checkout → PayPal approval → capture/activate.
 *
 * Public:
 *   POST /api/paypal/webhook  – PayPal webhook receiver (raw body)
 *   GET  /api/paypal/status   – Check if PayPal is configured
 *
 * Protected:
 *   POST /api/paypal/checkout     – Create PayPal order or subscription
 *   GET  /api/paypal/capture      – Capture order after approval redirect
 *   GET  /api/paypal/activate     – Activate subscription after approval
 */

import express, { Router, Request, Response } from 'express';
import { authRequired } from '../middleware/authRequired.js';
import {
  isPayPalConfigured,
  createPayPalOrder,
  capturePayPalOrder,
  createPayPalSubscription,
  activatePayPalSubscription,
  verifyPayPalWebhook,
  PAYPAL_TIER_PRICING,
} from '../services/paypalService.js';
import { createUserNotification } from '../services/notificationService.js';
import { getPool } from '../services/postgresql.js';

const router = Router();

const FRONTEND_URL = (process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || 'https://aivis.biz')
  .split(',')[0].trim().replace(/\/+$/, '');

const ALLOWED_TIERS = ['alignment', 'signal', 'scorefix'] as const;

// ── Public: PayPal availability check ─────────────────────────────────────

router.get('/status', (_req: Request, res: Response) => {
  return res.json({ available: isPayPalConfigured() });
});

// ── Protected: Create PayPal checkout ─────────────────────────────────────

router.post('/checkout', authRequired, async (req: Request, res: Response) => {
  try {
    if (!isPayPalConfigured()) {
      return res.status(503).json({ error: 'PayPal payments are not configured.' });
    }

    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ error: 'Authentication required.' });

    const tier = String(req.body?.tier ?? '').toLowerCase().trim();
    if (!ALLOWED_TIERS.includes(tier as any)) {
      return res.status(400).json({ error: `Tier must be one of: ${ALLOWED_TIERS.join(', ')}` });
    }

    const config = PAYPAL_TIER_PRICING[tier];
    if (!config) return res.status(400).json({ error: `Tier "${tier}" not available via PayPal.` });

    const returnUrl = `${FRONTEND_URL}/payment/paypal/return?tier=${tier}`;
    const cancelUrl = `${FRONTEND_URL}/payment/paypal/cancel`;

    if (config.mode === 'subscription') {
      // Recurring subscription
      const result = await createPayPalSubscription(user.id, tier, returnUrl, cancelUrl);
      return res.json({
        method: 'paypal',
        type: 'subscription',
        subscriptionId: result.subscriptionId,
        approvalUrl: result.approvalUrl,
      });
    } else {
      // One-time payment
      const result = await createPayPalOrder(user.id, tier, returnUrl, cancelUrl);
      return res.json({
        method: 'paypal',
        type: 'order',
        orderId: result.orderId,
        approvalUrl: result.approvalUrl,
      });
    }
  } catch (err: any) {
    console.error('[PayPal] Checkout error:', err);
    return res.status(500).json({ error: 'PayPal checkout failed.' });
  }
});

// ── Protected: Capture order after approval redirect ──────────────────────

router.get('/capture', authRequired, async (req: Request, res: Response) => {
  try {
    const orderId = req.query.order_id as string;
    if (!orderId) return res.status(400).json({ error: 'Missing order_id query param.' });

    const result = await capturePayPalOrder(orderId);

    if (result.captured) {
      // Notify user
      try {
        await createUserNotification({
          userId: result.userId,
          eventType: 'payment',
          title: 'Payment received',
          message: `Your PayPal payment for ${result.tier} has been processed successfully.`,
        });
      } catch {}
    }

    return res.json({
      captured: result.captured,
      tier: result.tier,
      redirectUrl: result.captured
        ? `${FRONTEND_URL}/dashboard?upgraded=true&tier=${result.tier}`
        : `${FRONTEND_URL}/pricing?error=capture_failed`,
    });
  } catch (err: any) {
    console.error('[PayPal] Capture error:', err);
    return res.status(500).json({ error: 'Failed to capture PayPal payment.' });
  }
});

// ── Protected: Activate subscription after approval ───────────────────────

router.get('/activate', authRequired, async (req: Request, res: Response) => {
  try {
    const subId = req.query.subscription_id as string;
    if (!subId) return res.status(400).json({ error: 'Missing subscription_id query param.' });

    const result = await activatePayPalSubscription(subId);

    if (result.active) {
      try {
        await createUserNotification({
          userId: result.userId,
          eventType: 'payment',
          title: 'Subscription activated',
          message: `Your ${result.tier} subscription via PayPal is now active.`,
        });
      } catch {}
    }

    return res.json({
      active: result.active,
      tier: result.tier,
      redirectUrl: result.active
        ? `${FRONTEND_URL}/dashboard?upgraded=true&tier=${result.tier}`
        : `${FRONTEND_URL}/pricing?error=activation_failed`,
    });
  } catch (err: any) {
    console.error('[PayPal] Activation error:', err);
    return res.status(500).json({ error: 'Failed to activate subscription.' });
  }
});

// ── Public: PayPal webhook ────────────────────────────────────────────────

router.post(
  '/webhook',
  express.raw({ type: 'application/json', limit: '2mb' }),
  async (req: Request, res: Response) => {
    try {
      const rawBody = typeof req.body === 'string' ? req.body : req.body?.toString?.('utf8') ?? '';

      // Verify signature
      const verified = await verifyPayPalWebhook(req.headers as Record<string, string | undefined>, rawBody);
      if (!verified) {
        console.warn('[PayPal] Webhook signature verification failed.');
        return res.status(401).json({ error: 'Webhook verification failed.' });
      }

      const event = JSON.parse(rawBody) as { event_type: string; resource: Record<string, any> };
      console.log(`[PayPal] Webhook event: ${event.event_type}`);

      switch (event.event_type) {
        case 'PAYMENT.CAPTURE.COMPLETED': {
          const orderId = event.resource?.supplementary_data?.related_ids?.order_id;
          if (orderId) await capturePayPalOrder(orderId);
          break;
        }

        case 'BILLING.SUBSCRIPTION.ACTIVATED':
        case 'BILLING.SUBSCRIPTION.RENEWED': {
          const subId = event.resource?.id;
          if (subId) await activatePayPalSubscription(subId);
          break;
        }

        case 'BILLING.SUBSCRIPTION.CANCELLED':
        case 'BILLING.SUBSCRIPTION.SUSPENDED': {
          const subId = event.resource?.id;
          if (subId) {
            const pool = getPool();
            // Find the user and downgrade
            const paymentRow = await pool.query(
              `SELECT user_id FROM payments WHERE method = 'paypal' AND metadata->>'paypal_subscription_id' = $1 LIMIT 1`,
              [subId],
            );
            const userId = paymentRow.rows[0]?.user_id;
            if (userId) {
              await pool.query(`UPDATE users SET tier = 'observer', updated_at = NOW() WHERE id = $1`, [userId]);
              await pool.query(
                `UPDATE payments SET status = 'cancelled', updated_at = NOW()
                 WHERE method = 'paypal' AND metadata->>'paypal_subscription_id' = $1`,
                [subId],
              );
            }
          }
          break;
        }

        default:
          console.log(`[PayPal] Unhandled webhook event: ${event.event_type}`);
      }

      return res.status(200).json({ received: true });
    } catch (err: any) {
      console.error('[PayPal] Webhook error:', err);
      return res.status(500).json({ error: 'Webhook processing failed.' });
    }
  },
);

export default router;
