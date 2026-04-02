/**
 * Re-exports the shared Redis connection from infra/redis.
 * Kept for backward compatibility with utils/redisClient imports.
 */
import { getRedis } from '../infra/redis.js';
import { Redis } from 'ioredis';

const redis: Redis = new Proxy({} as Redis, {
  get(_t, prop) {
    const real = getRedis();
    if (real) {
      const v = (real as any)[prop];
      return typeof v === 'function' ? v.bind(real) : v;
    }
    if (typeof prop === 'string' && ['on','once','off','removeListener','addListener','emit'].includes(prop))
      return () => {};
    return () => Promise.reject(new Error('Redis unavailable'));
  },
});

export default redis;
