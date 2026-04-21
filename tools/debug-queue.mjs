import 'dotenv/config';
import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  console.error('[queue:debug] REDIS_URL is not configured');
  process.exit(1);
}

const redis = new Redis(redisUrl, { maxRetriesPerRequest: 1, lazyConnect: true });

try {
  await redis.connect();
  const [highLen, normalLen] = await Promise.all([
    redis.llen('queue:audit:pending:high'),
    redis.llen('queue:audit:pending:normal'),
  ]);

  console.log(JSON.stringify({
    auditQueue: {
      highPriority: Number(highLen),
      normalPriority: Number(normalLen),
      total: Number(highLen) + Number(normalLen),
    },
  }, null, 2));
} catch (err) {
  console.error('[queue:debug] Failed:', err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
} finally {
  await redis.quit().catch(() => {});
}
