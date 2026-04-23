import { Request, Response } from "express";
import Redis from "ioredis";

export function sseHandler(req: Request, res: Response) {
  const jobId = req.params.jobId;

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive"
  });

  const redis = new Redis("redis://redis:6379");

  redis.subscribe("aivis_live");

  redis.on("message", (_, msg) => {
    const event = JSON.parse(msg);

    if (event.job_id !== jobId) return;

    res.write(`data: ${JSON.stringify(event)}\n\n`);
  });

  req.on("close", () => {
    redis.disconnect();
  });
}
