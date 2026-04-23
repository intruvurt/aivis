import express from "express";
import { publish } from "./bus";

const app = express();
app.use(express.json());

app.post("/api/analyze", async (req, res) => {
  const jobId = crypto.randomUUID();

  await publish({
    id: crypto.randomUUID(),
    job_id: jobId,
    type: "ANALYZE_CREATED",
    payload: req.body,
    ts: Date.now()
  });

  res.json({ jobId, status: "queued" });
});

app.listen(3000, () => {
  console.log("API running on :3000");
});
