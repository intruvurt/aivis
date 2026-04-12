/**
 * Cloudflare Worker: Security Headers for aivis.biz
 *
 * Deploy this Worker and attach it to your aivis.biz zone via
 * Workers Routes: https://aivis.biz/* → this worker
 *
 * This injects all security headers at the Cloudflare edge so they
 * survive caching and are always visible to browsers and audit tools.
 *
 * Setup:
 * 1. Go to Cloudflare Dashboard → Workers & Pages → Create Worker
 * 2. Paste this script
 * 3. Go to Websites → aivis.biz → Workers Routes
 * 4. Add route: aivis.biz/* → select this worker
 */

const SECURITY_HEADERS = {
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'Content-Security-Policy':
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://www.google.com https://www.gstatic.com; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: blob: https://*.google-analytics.com https://*.googletagmanager.com https://codetrendy.com; " +
    "connect-src 'self' https://api.aivis.biz https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://*.sentry.io https://*.ingest.sentry.io; " +
    "font-src 'self' data:; " +
    "frame-src https://www.google.com https://recaptcha.google.com https://js.stripe.com; " +
    "frame-ancestors 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self'; " +
    'upgrade-insecure-requests',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy':
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-site',
  'Cross-Origin-Embedder-Policy': 'credentialless',
};

// Headers to remove for security hardening
const REMOVE_HEADERS = ['X-Powered-By', 'Server'];

export default {
  async fetch(request) {
    const response = await fetch(request);
    const newResponse = new Response(response.body, response);

    // Remove revealing headers
    for (const header of REMOVE_HEADERS) {
      newResponse.headers.delete(header);
    }

    // Set all security headers (overwrite if already present)
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
      newResponse.headers.set(key, value);
    }

    return newResponse;
  },
};
