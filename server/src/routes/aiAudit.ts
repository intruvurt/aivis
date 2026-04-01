import express from "express";
import { body, param, validationResult } from "express-validator";
import { protect } from "../middleware/auth.ts";
import enforceFeature from "../middleware/usageEnforcement.ts";
import {
  startAiAudit,
  getAiAuditResult,
  getBuildSpecs,
} from "../controllers/aiAuditController.ts";

const router = express.Router();

function firstValidationError(req) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return null;
  return errors.array({ onlyFirstError: true })[0]?.msg || "Validation error";
}

function normalizeError(err) {
  if (!err) return "Unknown error";
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

/**
 * POST /ai-audit/run
 * Protected + tier-gated, since this can trigger expensive LLM calls.
 *
 * Body:
 * - prompts: array (min 1)
 * - blueprint: non-empty string
 *
 * Optional (recommended, if your controller can accept it later):
 * - options: object (model selection, provider preference, etc.)
 */
router.post(
  "/run",
  protect,
  enforceFeature("ai_audit"),
  body("prompts")
    .isArray({ min: 1 })
    .withMessage("prompts must be a non-empty array"),
  body("prompts.*")
    .isString()
    .trim()
    .isLength({ min: 1, max: 20000 })
    .withMessage("each prompt must be a non-empty string (max 20k chars)"),
  body("blueprint")
    .isString()
    .trim()
    .isLength({ min: 1, max: 200000 })
    .withMessage("blueprint is required (max 200k chars)"),
  async (req, res) => {
    const errMsg = firstValidationError(req);
    if (errMsg) {
      return res
        .status(400)
        .json({ success: false, error: errMsg, statusCode: 400 });
    }

    try {
      // If you later want per-user attribution:
      // const userId = req.user?.id;

      const out = await startAiAudit(req.body.prompts, req.body.blueprint);
      return res.json(out);
    } catch (e) {
      return res.status(500).json({
        success: false,
        error: normalizeError(e),
        statusCode: 500,
      });
    }
  }
);

/**
 * GET /ai-audit/result/:id
 * Protected + tier-gated.
 */
router.get(
  "/result/:id",
  protect,
  enforceFeature("ai_audit"),
  param("id")
    .isString()
    .trim()
    .isLength({ min: 10, max: 200 })
    .withMessage("Invalid audit id"),
  async (req, res) => {
    const errMsg = firstValidationError(req);
    if (errMsg) {
      return res
        .status(400)
        .json({ success: false, error: errMsg, statusCode: 400 });
    }

    try {
      const out = await getAiAuditResult(req.params.id);
      return res.json(out);
    } catch (e) {
      // Don’t swallow everything as 404 if the controller throws real errors.
      // If your controller already throws a NotFound error type, you can branch on it.
      return res.status(404).json({
        success: false,
        error: "Audit result not found",
        statusCode: 404,
      });
    }
  }
);

/**
 * GET /ai-audit/buildspecs
 * Read-only list; safe to leave public, but you can protect if needed.
 */
router.get("/buildspecs", async (req, res) => {
  try {
    const specs = await getBuildSpecs();
    return res.json(specs);
  } catch (e) {
    // Don’t pretend success with empty array if it’s a server error.
    return res.status(500).json({
      success: false,
      error: normalizeError(e),
      statusCode: 500,
    });
  }
});

export default router;
