import { Redis } from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || '';

let _redis: Redis | null = null;
let _warned = false;

function createConnection(): Redis | null {
  if (!REDIS_URL) {
    if (!_warned) {
      console.warn('[Redis] REDIS_URL not set — queue features disabled');
      _warned = true;
    }
    return null;
  }
  const conn = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    retryStrategy(times) {
      if (times > 5) return null;          // stop after 5 retries
      return Math.min(times * 500, 3000);  // back off up to 3 s
    },
  });
  conn.on('error', (err: unknown) => {
    if (!_warned) {
      const e = err as { message?: string };
      console.warn('[Redis] connection error:', e?.message || String(err));
      _warned = true;
    }
  });
  return conn;
}

/** Returns the shared Redis connection, or `null` when Redis is unavailable. */
export function getRedis(): Redis | null {
  if (_redis === null && REDIS_URL) _redis = createConnection();
  return _redis;
}

/**
 * Legacy export kept for existing callers that destructure `redisConnection`.
 * Falls back to a dummy that rejects every command so callers degrade gracefully.
 */
export const redisConnection: Redis = (getRedis() ?? new Proxy({} as Redis, {
  get(_target, prop) {
    if (typeof prop === 'string' && ['on', 'once', 'removeListener', 'off', 'addListener'].includes(prop)) {
      return () => {};                     // no-op for event methods
    }
    return () => Promise.reject(new Error('Redis unavailable'));
  },
})) as Redis;
