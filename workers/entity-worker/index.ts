import Redis from "ioredis";
import axios from "axios";

const redis = new Redis("redis://redis:6379");

async function loop() {
  while (true) {
    const data = await redis.xread("BLOCK", 0, "STREAMS", "aivis_stream", "$");
    if (!data) continue;

    const raw = data[0][1][0][1][1];
    const event = JSON.parse(raw);

    if (event.type === "SCAN_DONE") {
      const res = await axios.post("http://python-intel:8000/entities", {
        text: event.payload.text
      });

      await redis.xadd("aivis_stream", "*", "data", JSON.stringify({
        id: crypto.randomUUID(),
        job_id: event.job_id,
        type: "ENTITIES_RESOLVED",
        payload: res.data,
        ts: Date.now()
      }));
    }
  }
}

loop();
