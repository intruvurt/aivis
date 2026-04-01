import express from "express";
import { body } from "express-validator";
import {
  createAudit,
  getAudits,
  getAuditById,
  updateAuditStatus
} from "../controllers/auditController.ts";
import { protect } from "../middleware/auth.ts";

const router = express.Router();

router.post(
  "/",
  protect,
  [
    body("url").isURL().withMessage("Valid URL is required")
  ],
  createAudit
);

router.get("/", protect, getAudits);
router.get("/:id", protect, getAuditById);
router.put("/:id", protect, updateAuditStatus);

export default router;
