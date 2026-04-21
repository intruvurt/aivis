import 'dotenv/config';

const report = {
  node: process.version,
  env: process.env.NODE_ENV || 'development',
  queueMode: process.env.QUEUE_MODE || 'redis',
  bixEnabled: process.env.BIX_ENABLED !== 'false',
  redisConfigured: Boolean(process.env.REDIS_URL || process.env.REDIS_HOST),
  openRouterConfigured: Boolean(process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_API_KEY),
  dbConfigured: Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL),
};

console.log(JSON.stringify(report, null, 2));
