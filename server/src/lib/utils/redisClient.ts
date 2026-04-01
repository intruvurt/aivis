import redis from "../../config/redis.js";

export async function cacheSet<T>(
  key: string,
  value: T,
  expireSeconds = 3600
): Promise<void> {
  try {
    await redis.set(key, JSON.stringify(value), "EX", expireSeconds);
  } catch (err) {
    console.error("Redis Set Error:", err);
    throw err;
  }
}

export async function cacheGet<T = unknown>(key: string): Promise<T | null> {
  try {
    const raw = await redis.get(key);
    if (raw == null) return null;

    try {
      return JSON.parse(raw) as T;
    } catch {
      // if someone wrote a plain string into this key
      return raw as unknown as T;
    }
  } catch (err) {
    console.error("Redis Get Error:", err);
    throw err;
  }
}

export async function cacheDel(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch (err) {
    console.error("Redis Delete Error:", err);
    throw err;
  }
}

export async function cacheExists(key: string): Promise<boolean> {
  try {
    const exists = await redis.exists(key);
    return exists === 1;
  } catch (err) {
    console.error("Redis Exists Error:", err);
    throw err;
  }
}
