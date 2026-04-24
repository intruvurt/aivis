import Redis from "ioredis";
import axios from "axios";

const redisUrl = process.env.REDIS_URL || "redis://redis:6379";
const streamKey = process.env.AIVIS_STREAM_KEY || "aivis_stream";
const groupName = process.env.VISIBILITY_WORKER_GROUP || "visibility-workers";
const consumerName = process.env.WORKER_CONSUMER || `visibility-${process.pid}`;
const openAiUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const openAiModel = process.env.OPENAI_MODEL || "gpt-4o-mini";

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

function detect(text) {
  const t = String(text || "").toLowerCase();
  return t.includes("aivis") || t.includes("aivis.biz");
}

async function probe(query) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return "";
  }

  const res = await axios.post(
    `${openAiUrl}/responses`,
    {
      model: openAiModel,
      input: query,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      timeout: 20000,
    },
  );

  const output = res?.data?.output;
  if (!Array.isArray(output) || output.length === 0) {
    return "";
  }

  const first = output[0]?.content;
  if (!Array.isArray(first) || first.length === 0) {
    return "";
  }

  return String(first[0]?.text || "");
}

async function loop() {
  await ensureGroup();
  console.log(
    `[visibility-worker] listening on ${streamKey} (${groupName}/${consumerName})`,
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
          if (event.type === "PUBLISHED") {
            const entity = event?.payload?.url || "";
            const queries = [`What is ${entity}?`, `How does ${entity} work?`];
            let hits = 0;

            for (const q of queries) {
              const response = await probe(q);
              if (detect(response)) {
                hits += 1;
              }
            }

            const score = queries.length ? hits / queries.length : 0;

            await publish({
              id: crypto.randomUUID(),
              job_id: event.job_id,
              type: "FEEDBACK_TRIGGERED",
              payload: { entity, score, sourceType: "visibility" },
              ts: Date.now(),
            });
          }

          await redis.xack(streamKey, groupName, messageId);
        } catch (error) {
          console.error("[visibility-worker] message failed", error);
        }
      }
    }
  }
}

loop().catch((error) => {
  console.error("[visibility-worker] fatal error", error);
  process.exit(1);
});
