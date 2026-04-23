import Redis from "ioredis";

const redis = new Redis("redis://localhost:6379");

export async function publishEvent(event: any) {
  await redis.xadd(
    "aivis-events",
    "*",
    "data",
    JSON.stringify(event)
  );
}
