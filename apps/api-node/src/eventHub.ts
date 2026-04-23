import Redis from "ioredis";
import { pool } from "./db"; // confirm import,  change if needed

const redis = new Redis("redis://redis:6379");

export async function emit(event: any) {
  // 1. persist
  await pool.query(
    "INSERT INTO events (id, job_id, type, payload, ts) VALUES ($1,$2,$3,$4,$5)",
    [event.id, event.job_id, event.type, event.payload, event.ts]
  );

  // 2. stream
  await redis.xadd("aivis_stream", "*", "data", JSON.stringify(event));

  // 3. pubsub for SSE
  await redis.publish("aivis_live", JSON.stringify(event));
}
