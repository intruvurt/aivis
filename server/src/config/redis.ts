import { Redis } from 'ioredis';
import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

const REDIS_URL = process.env.REDIS_URL ?? '';

const redis = new Redis(REDIS_URL);

redis.on('connect', () => {
  console.log('Redis connected successfully');
});

redis.on('error', (err: Error) => {
  console.error('Redis connection error', err);
});

export default redis;
