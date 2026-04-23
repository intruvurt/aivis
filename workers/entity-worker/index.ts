import { createClient } from "redis";
import axios from "axios";

const redis = createClient();

async function run() {
  await redis.connect();

  while (true) {
    const data = await redis.xRead(
      { key: "aivis-events", id: "$" },
      { BLOCK: 0 }
    );

    if (!data) continue;

    const event = JSON.parse(data[0].messages[0].message.data);

    if (event.type === "SCAN_COMPLETE") {
      const result = await axios.post(
        "http://python-intel:8000/extract-entities",
        { text: event.payload.text }
      );

      await redis.xAdd("aivis-events", "*", {
        data: JSON.stringify({
          type: "ENTITIES_RESOLVED",
          job_id: event.job_id,
          payload: result.data,
          timestamp: Date.now()
        })
      });
    }
  }
}

run();
