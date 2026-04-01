const normalizedNodeEnv = String(process.env.NODE_ENV || '').trim().toLowerCase();
const normalizedAppEnv = String(process.env.APP_ENV || '').trim().toLowerCase();

const isHostedRuntime = Boolean(
  process.env.RENDER ||
  process.env.RAILWAY_ENVIRONMENT ||
  process.env.VERCEL ||
  process.env.FLY_APP_NAME
);

const inferredHostedProduction =
  isHostedRuntime && normalizedNodeEnv !== 'development' && normalizedNodeEnv !== 'test';

export const NODE_ENV = normalizedNodeEnv || (inferredHostedProduction ? 'production' : 'development');
export const IS_PRODUCTION = NODE_ENV === 'production' || normalizedAppEnv === 'production' || inferredHostedProduction;
export const IS_DEVELOPMENT = NODE_ENV === 'development' && !IS_PRODUCTION;
export const IS_TEST = NODE_ENV === 'test';
