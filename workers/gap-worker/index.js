import Redis from "ioredis";
import axios from "axios";

const redisUrl = process.env.REDIS_URL || "redis://redis:6379";
const streamKey = process.env.AIVIS_STREAM_KEY || "aivis_stream";
const groupName = process.env.GAP_WORKER_GROUP || "gap-workers";
const consumerName = process.env.WORKER_CONSUMER || `gap-${process.pid}`;
const pythonIntelUrl =
  process.env.PYTHON_INTEL_URL || "http://python-intel:8000";

const redis = new Redis(redisUrl);

async function ensureGroup() {
  try {
    await redis.xgroup("CREATE", streamKey, groupName, "$", "MKSTREAM");
  } catch (error) {
    if (!String(error?.message || "").includes("BUSYGROUP")) {
      throw error;
    }
  }
}

async function publish(event) {
  await redis.xadd(streamKey, "*", "data", JSON.stringify(event));
}

async function loop() {
  await ensureGroup();
  console.log(
    `[gap-worker] listening on ${streamKey} (${groupName}/${consumerName})`,
  );

  while (true) {
    const data = await redis.xreadgroup(
      "GROUP",
      groupName,
      consumerName,
      "BLOCK",
      5000,
      "COUNT",
      10,
      "STREAMS",
      streamKey,
      ">",
    );

    if (!data) {
      continue;
    }

    for (const [, messages] of data) {
      for (const [messageId, fields] of messages) {
        try {
          const payloadIndex = fields.findIndex((v) => v === "data");
          if (payloadIndex === -1) {
            await redis.xack(streamKey, groupName, messageId);
            continue;
          }

          const event = JSON.parse(fields[payloadIndex + 1]);
          if (event.type === "ENTITIES_RESOLVED") {
            const res = await axios.post(
              `${pythonIntelUrl}/gap-score`,
              {
                entities: event?.payload?.entities || [],
              },
              {
                timeout: 20000,
              },
            );

            await publish({
              id: crypto.randomUUID(),
              job_id: event.job_id,
              type: "GAPS_DETECTED",
              payload: res.data,
              ts: Date.now(),
            });
          }

          await redis.xack(streamKey, groupName, messageId);
        } catch (error) {
          console.error("[gap-worker] message failed", error);
        }
      }
    }
  }
}

loop().catch((error) => {
  console.error("[gap-worker] fatal error", error);
  process.exit(1);
});
