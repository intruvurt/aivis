import express from "express";
import { analyzeWebsite } from "../controllers/aiController.ts";
import { protect } from "../middleware/auth.ts";

const router = express.Router();

router.post("/analyze", protect, analyzeWebsite);

export default router;
