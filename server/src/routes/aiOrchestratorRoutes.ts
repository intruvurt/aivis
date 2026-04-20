// @ts-nocheck
import express from "express";
import { runAnalysisPipeline } from "../controllers/aiOrchestratorController.ts";
import { authRequired } from "../middleware/authRequired.js";

const router = express.Router();

router.post("/analyze", authRequired, runAnalysisPipeline);

export default router;
