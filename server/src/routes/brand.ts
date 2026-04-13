import express from "express";
import { getBrand, createBrand, updateBrand, deleteBrand, getAllBrands } from "../controllers/brandController.ts";
import { body } from "express-validator";
import { authRequired, requireRole } from "../middleware/authRequired.js";

const router = express.Router();

// Public route - get brand by tenant_id
router.get("/:tenant_id", getBrand);

// Protected admin routes
router.get("/", authRequired, requireRole(["admin"]), getAllBrands);

router.post(
  "/",
  authRequired,
  requireRole(["admin"]),
  [
    body("tenant_id").notEmpty().trim().withMessage("Tenant ID is required"),
    body("brandName").notEmpty().trim().withMessage("Brand name is required"),
    body("tier").optional().isInt({ min: 1, max: 4 }).withMessage("Tier must be between 1 and 4"),
    body("customDomain").optional().isFQDN().withMessage("Invalid domain format"),
    body("platformFee").optional().isFloat({ min: 0, max: 1 }).withMessage("Platform fee must be between 0 and 1")
  ],
  createBrand
);

router.put(
  "/:tenant_id",
  authRequired,
  requireRole(["admin"]),
  [
    body("brandName").optional().trim(),
    body("tier").optional().isInt({ min: 1, max: 4 }),
    body("customDomain").optional().isFQDN(),
    body("platformFee").optional().isFloat({ min: 0, max: 1 })
  ],
  updateBrand
);

router.delete("/:tenant_id", authRequired, requireRole(["admin"]), deleteBrand);

export default router;
