import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://redis:6379";
const streamKey = process.env.AIVIS_STREAM_KEY || "aivis_stream";
const groupName = process.env.PUBLISH_WORKER_GROUP || "publish-workers";
const consumerName = process.env.WORKER_CONSUMER || `publish-${process.pid}`;

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
    `[publish-worker] listening on ${streamKey} (${groupName}/${consumerName})`,
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
          if (event.type === "PAGE_GENERATED") {
            const pages = Array.isArray(event.payload) ? event.payload : [];
            for (const page of pages) {
              console.log("[publish-worker] publish", page.title);
              await publish({
                id: crypto.randomUUID(),
                job_id: event.job_id,
                type: "PUBLISHED",
                payload: { url: `/pages/${page.entity}`, title: page.title },
                ts: Date.now(),
              });
            }
          }

          await redis.xack(streamKey, groupName, messageId);
        } catch (error) {
          console.error("[publish-worker] message failed", error);
        }
      }
    }
  }
}

loop().catch((error) => {
  console.error("[publish-worker] fatal error", error);
  process.exit(1);
});
