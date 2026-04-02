import express from "express";
import { updateStatus, getStatus } from "../controllers/statusController.js";
import { body } from "express-validator";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// All status routes require authentication
router.use(protect);

router.post(
  "/update",
  body("status").isIn(["active", "paused", "archived"]).withMessage("Invalid status value"),
  updateStatus
);

router.get("/", getStatus);

export default router;
