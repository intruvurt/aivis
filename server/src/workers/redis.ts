import { Redis } from 'ioredis';

/**
 * Single shared Redis instance
 * - used by workers
 * - used by event hub
 * - no re-instantiation per worker loop
 */
export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  lazyConnect: false,
});

redis.on('connect', () => {
  console.log('[redis] connected');
});

redis.on('error', (err) => {
  console.error('[redis] error', err);
});
