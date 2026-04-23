import express from "express";
import { publishEvent } from "@aivis/event-bus";

const app = express();
app.use(express.json());

app.post("/api/analyze", async (req, res) => {
  const jobId = crypto.randomUUID();

  await publishEvent({
    type: "ANALYZE_CREATED",
    job_id: jobId,
    payload: req.body,
    timestamp: Date.now()
  });

  res.json({ jobId, status: "queued" });
});

app.listen(3000, () => {
  console.log("API running on :3000");
});
