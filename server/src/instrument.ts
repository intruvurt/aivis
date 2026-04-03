/**
 * Sentry ESM instrumentation — must be loaded via --import BEFORE the app.
 * This ensures Sentry can monkey-patch http/express before they're imported.
 *
 * Usage:
 *   node --import ./dist/server/src/instrument.js dist/server/src/server.js
 */
import * as Sentry from '@sentry/node';

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    integrations: [
      Sentry.httpIntegration(),
      Sentry.expressIntegration(),
    ],
  });
  console.log('[Sentry] Initialized via --import (ESM instrumentation)');
}
