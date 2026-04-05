
/**
 * Shared BullMQ connection using the existing Redis instance.
 * Falls back gracefully when Redis is not configured.
 */
import { getRedis } from '../redis.js';
import type { ConnectionOptions } from 'bullmq';

export function getBullMQConnection(): ConnectionOptions | null {
  const redis = getRedis();
  if (!redis) return null;
  // BullMQ accepts an ioredis instance directly
  return redis as unknown as ConnectionOptions;
}

export function requireBullMQConnection(): ConnectionOptions {
  const conn = getBullMQConnection();
  if (!conn) throw new Error('Redis is not configured - BullMQ queues require REDIS_URL or REDIS_HOST');
  return conn;
}
