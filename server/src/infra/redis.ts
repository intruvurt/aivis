import { Redis } from 'ioredis';

const redisUrl = process.env.REDIS_URL;
const redisHost = process.env.REDIS_HOST;
const redisPort = Number(process.env.REDIS_PORT || 6379);

/**
 * Only connect to Redis when explicitly configured via REDIS_URL or REDIS_HOST.
 * Without either env var, Redis is unavailable and all consumers degrade gracefully.
 */
let redisInstance: Redis | null = null;

const MAX_RETRIES = 3;

function createRedis(): Redis | null {
  const opts = {
    maxRetriesPerRequest: null as null,
    enableReadyCheck: true,
    retryStrategy(times: number) {
      if (times > MAX_RETRIES) return null;
      return Math.min(times * 500, 2000);
    },
  };
  if (redisUrl) return new Redis(redisUrl, opts);
  if (redisHost) return new Redis({ host: redisHost, port: redisPort, ...opts });
  return null;
}

redisInstance = createRedis();

if (redisInstance) {
  let errorCount = 0;
  redisInstance.on('error', (err: unknown) => {
    errorCount++;
    if (errorCount === 1) {
      const e = err as { message?: string };
      console.warn('[Redis] connection error:', e?.message || String(err));
    }
  });
  redisInstance.on('end', () => {
    if (errorCount > 0) {
      console.warn(`[Redis] gave up after ${errorCount} failed attempt(s) — running without Redis`);
      redisInstance = null;
    }
  });
  redisInstance.on('connect', () => {
    errorCount = 0;
    console.log('[Redis] connected');
  });
} else {
  console.log('[Redis] no REDIS_URL or REDIS_HOST configured — running without Redis');
}

/**
 * Backwards-compatible export. Consumers that import `redisConnection` directly
 * and call methods on it will get errors if Redis is unavailable — prefer `getRedis()`.
 */
export const redisConnection = redisInstance as Redis;

export function getRedis(): Redis | null {
  return redisInstance;
}
