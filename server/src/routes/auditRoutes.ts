// @ts-nocheck
import express from "express";
import { body } from "express-validator";
import {
  createAudit,
  getAudits,
  getAuditById,
  updateAuditStatus
} from "../controllers/auditController.ts";
import { authRequired } from "../middleware/authRequired.js";

const router = express.Router();

router.post(
  "/",
  authRequired,
  [
    body("url").isURL().withMessage("Valid URL is required")
  ],
  createAudit
);

router.get("/", authRequired, getAudits);
router.get("/:id", authRequired, getAuditById);
router.put("/:id", authRequired, updateAuditStatus);

export default router;
