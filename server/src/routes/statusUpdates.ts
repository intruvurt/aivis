import express from "express";
import { createStatusUpdate, getStatusUpdates, deleteStatusUpdate } from "../controllers/statusUpdateController.ts";

const router = express.Router();

router.get("/", getStatusUpdates);
router.post("/", createStatusUpdate);
router.delete("/:id", deleteStatusUpdate);

export default router;
