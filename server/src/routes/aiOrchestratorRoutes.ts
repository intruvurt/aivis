import express from "express";
import { runAnalysisPipeline } from "../controllers/aiOrchestratorController.ts";
import { protect } from "../middleware/auth.ts";

const router = express.Router();

router.post("/analyze", protect, runAnalysisPipeline);

export default router;
