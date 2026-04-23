import Redis from "ioredis";
import axios from "axios";

const redis = new Redis("redis://redis:6379");

async function run() {
  while (true) {
    const data = await redis.xread("BLOCK", 0, "STREAMS", "aivis_stream", "$");
    if (!data) continue;

    const raw = data[0][1][0][1][1];
    const event = JSON.parse(raw);

    if (event.type === "ENTITIES_RESOLVED") {
      const res = await axios.post("http://python-intel:8000/gap-score", {
        entities: event.payload.entities
      });

      await redis.xadd("aivis_stream", "*", "data", JSON.stringify({
        id: crypto.randomUUID(),
        job_id: event.job_id,
        type: "GAPS_DETECTED",
        payload: res.data,
        ts: Date.now()
      }));
    }
  }
}

run();
