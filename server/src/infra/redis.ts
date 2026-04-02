import { Redis } from 'ioredis';

const redisUrl = process.env.REDIS_URL;
const redisHost = process.env.REDIS_HOST;
const redisPort = Number(process.env.REDIS_PORT || 6379);

/**
 * Only connect to Redis when explicitly configured via REDIS_URL or REDIS_HOST.
 * Without either env var, Redis is unavailable and all consumers degrade gracefully.
 */
let redisInstance: Redis | null = null;
let loggedSkip = false;

function createRedis(): Redis | null {
  if (redisUrl) {
    return new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      retryStrategy(times) {
        if (times > 5) return null; // stop retrying after 5 attempts
        return Math.min(times * 500, 3000);
      },
    });
  }
  if (redisHost) {
    return new Redis({
      host: redisHost,
      port: redisPort,
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      retryStrategy(times) {
        if (times > 5) return null;
        return Math.min(times * 500, 3000);
      },
    });
  }
  return null;
}

redisInstance = createRedis();

if (redisInstance) {
  redisInstance.on('error', (err: unknown) => {
    const e = err as { message?: string };
    console.warn('[Redis] connection error:', e?.message || String(err));
  });
  redisInstance.on('connect', () => {
    console.log('[Redis] connected');
  });
} else if (!loggedSkip) {
  loggedSkip = true;
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
