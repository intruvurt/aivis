// @ts-nocheck
import express from "express";
import { analyzeWebsite } from "../controllers/aiController.ts";
import { authRequired } from "../middleware/authRequired.js";

const router = express.Router();

router.post("/analyze", authRequired, analyzeWebsite);

export default router;
