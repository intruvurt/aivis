import { Redis } from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || '';

let _redis: Redis | null = null;
let _connected = false;

function createConnection(): Redis | null {
  if (!REDIS_URL) {
    console.warn('[Redis] REDIS_URL not set — Redis features disabled');
    return null;
  }
  const conn = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,        // required by queue consumers (BullMQ pattern)
    enableReadyCheck: true,
    lazyConnect: false,
    retryStrategy(times) {
      if (times > 10) {
        console.error('[Redis] giving up after 10 reconnect attempts');
        return null;
      }
      return Math.min(times * 500, 5000);
    },
    reconnectOnError(err) {
      // Reconnect on READONLY errors (failover scenarios)
      return err.message.includes('READONLY');
    },
  });

  conn.on('connect', () => {
    _connected = true;
    console.log('[Redis] connected to', REDIS_URL.replace(/:\/\/.*@/, '://***@'));
  });

  conn.on('ready', () => {
    console.log('[Redis] ready');
  });

  conn.on('error', (err: unknown) => {
    const e = err as { message?: string };
    // Log errors but don't spam — ioredis reconnect handles retries
    if (_connected) {
      console.warn('[Redis] error:', e?.message || String(err));
      _connected = false;
    }
  });

  conn.on('close', () => {
    _connected = false;
  });

  return conn;
}

/** Returns the shared Redis connection, or `null` when REDIS_URL is not set. */
export function getRedis(): Redis | null {
  if (_redis === null && REDIS_URL) _redis = createConnection();
  return _redis;
}

/** Whether the connection is currently in a usable state. */
export function isRedisReady(): boolean {
  return _redis?.status === 'ready';
}

/**
 * Legacy export for callers that use `redisConnection` directly.
 * Fully lazy — connection created on first actual command.
 */
export const redisConnection: Redis = new Proxy({} as Redis, {
  get(_target, prop) {
    const real = getRedis();
    if (real) {
      const v = (real as any)[prop];
      return typeof v === 'function' ? v.bind(real) : v;
    }
    if (typeof prop === 'string' && ['on', 'once', 'removeListener', 'off', 'addListener', 'emit'].includes(prop)) {
      return () => {};
    }
    return () => Promise.reject(new Error('Redis unavailable — REDIS_URL not set'));
  },
}) as Redis;
