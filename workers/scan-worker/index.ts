import Redis from "ioredis";
import axios from "axios";

const redis = new Redis("redis://redis:6379");

async function run() {
  while (true) {
    const data = await redis.xread("BLOCK", 0, "STREAMS", "aivis_stream", "$");

    if (!data) continue;

    const raw = data[0][1][0][1][1];
    const event = JSON.parse(raw);

    if (event.type === "ANALYZE_CREATED") {
      const text = `sample crawl data for ${event.payload.source}`;

      await redis.xadd(
        "aivis_stream",
        "*",
        "data",
        JSON.stringify({
          id: crypto.randomUUID(),
          job_id: event.job_id,
          type: "SCAN_DONE",
          payload: { text },
          ts: Date.now()
        })
      );
    }
  }
}

run();
