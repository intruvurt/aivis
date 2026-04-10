// server/src/routes/paymentRoutes.ts
import express from "express";
import { Router } from "express";
import { body } from "express-validator";
import {
  createStripeCheckout,
  createScanPackCheckout,
  createCustomerPortal,
  getCurrentSubscription,
  getScanPackStatus,
  handleStripeWebhook,
  getPricingInfo,
  startFreeTrial,
} from "../controllers/paymentController.js";
import { authRequired } from "../middleware/authRequired.js";

const router = Router();

/**
 * Stripe webhook requirements:
 * - This route MUST receive the RAW request body (Buffer) for signature verification.
 * - server.ts MUST NOT run express.json() or express.urlencoded() on /api/payment/webhook.
 *   (server.ts now conditionally bypasses both for that path.)
 */

// Keep tier keys strict + predictable (match backend tiers)
const ALLOWED_TIERS = ["observer", "starter", "alignment", "signal"] as const;

// ============================================================================
// PUBLIC ROUTES
// ============================================================================

// Get pricing information (no auth required)
router.get("/pricing", getPricingInfo);

// Stripe webhook (NO auth, RAW body)
router.post(
  "/webhook",
  express.raw({
    type: "application/json",
    limit: "2mb",
    verify: (req: any, _res, buf) => {
      // Keep a copy for Stripe signature verification downstream
      req.rawBody = buf?.toString("utf8") || "";
    },
  }),
  handleStripeWebhook
);

// ============================================================================
// PROTECTED ROUTES (require authentication)
// ============================================================================

const checkoutValidation = [
  body("tier")
    .isString()
    .trim()
    .toLowerCase()
    .isIn(ALLOWED_TIERS as unknown as string[])
    .withMessage(`Tier must be one of: ${ALLOWED_TIERS.join(", ")}`),

  body("brandDomain")
    .optional()
    .isString()
    .trim()
    .isFQDN()
    .withMessage("Brand domain must be a valid domain name"),
];

// Create Stripe checkout session
router.post("/stripe", authRequired, checkoutValidation, createStripeCheckout);
router.post("/checkout", authRequired, checkoutValidation, createStripeCheckout); // Alias
router.post('/scan-pack/checkout', authRequired, createScanPackCheckout);
router.get('/scan-pack/status', authRequired, getScanPackStatus);

// Create Stripe Customer Portal session (for managing subscriptions)
router.post("/portal", authRequired, createCustomerPortal);

// Read current subscription details for billing page
router.get('/subscription', authRequired, getCurrentSubscription);

// Start a 14-day Signal trial (no credit card required, one-time only)
router.post('/start-trial', authRequired, startFreeTrial);

export default router;