import { redis } from "./redis.js";

/**
 * Ensure consumer group exists safely
 * (Redis throws if group already exists — we swallow that)
 */
export async function ensureConsumerGroup(stream, group) {
  try {
    await redis.xgroup("CREATE", stream, group, "$", "MKSTREAM");
    console.log(`[consumer-group] created ${group} on ${stream}`);
  } catch (err) {
    // BUSYGROUP = already exists → safe to ignore
    if (!String(err).includes("BUSYGROUP")) {
      console.error("[consumer-group] error creating group", err);
    }
  }
}

/**
 * Read from stream as consumer group
 * This is the ONLY safe pattern for workers
 */
export async function readGroup({
  stream,
  group,
  consumer,
  block = 5000,
  count = 10
}) {
  const data = await redis.xreadgroup(
    "GROUP",
    group,
    consumer,
    "BLOCK",
    block,
    "COUNT",
    count,
    "STREAMS",
    stream,
    ">"
  );

  if (!data) return [];

  const [, messages] = data[0];

  return messages.map(([id, fields]) => {
    const obj = {};

    for (let i = 0; i < fields.length; i += 2) {
      obj[fields[i]] = fields[i + 1];
    }

    return {
      id,
      data: obj
    };
  });
}

/**
 * Acknowledge processed message
 */
export async function ack(stream, group, messageId) {
  await redis.xack(stream, group, messageId);
}

/**
 * Dead-letter helper (optional but recommended)
 */
export async function deadLetter(stream, payload) {
  await redis.xadd(
    `${stream}:dead`,
    "*",
    "data",
    JSON.stringify(payload)
  );
}
