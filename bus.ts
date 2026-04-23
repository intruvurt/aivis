import Redis from "ioredis";

const redis = new Redis("redis://redis:6379");

export async function publish(event: any) {
  await redis.xadd(
    "aivis_stream",
    "*",
    "data",
    JSON.stringify(event)
  );
}
