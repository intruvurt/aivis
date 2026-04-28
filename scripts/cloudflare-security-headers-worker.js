const BASE_SECURITY_HEADERS = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), " +
    "magnetometer=(), gyroscope=(), accelerometer=(), " +
    "ambient-light-sensor=(), battery=(), display-capture=(), " +
    "document-domain=(), fullscreen=(self), idle-detection=(), " +
    "screen-wake-lock=(), serial=(), web-share=(self), xr-spatial-tracking=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "cross-origin", // allows api.aivis.biz
};

// Only applied to HTML documents
function buildDocumentHeaders(nonce) {
  return {
    "Content-Security-Policy":
      "default-src 'self'; " +
      `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ` +
      "https://www.googletagmanager.com https://www.google-analytics.com " +
      "https://www.clarity.ms https://static.cloudflareinsights.com " +
      "https://recaptcha.google.com https://www.google.com " +
      "https://cdn-cgi.octolane.com https://www.gstatic.com " +
      "https://js.stripe.com; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "img-src 'self' data: blob: " +
      "https://*.google-analytics.com https://*.googletagmanager.com " +
      "https://www.google.com https://stats.g.doubleclick.net " +
      "https://codetrendy.com; " +
      "connect-src 'self' " +
      "https://api.aivis.biz " +
      "https://*.google-analytics.com https://*.analytics.google.com " +
      "https://*.googletagmanager.com " +
      "https://c.clarity.ms https://d.clarity.ms " +
      "https://*.sentry.io https://*.ingest.sentry.io " +
      "https://www.google.com https://cloudflareinsights.com " +
      "https://api.stripe.com; " +
      "font-src 'self' data: https://fonts.gstatic.com; " +
      "frame-src https://www.google.com https://recaptcha.google.com " +
      "https://js.stripe.com https://hooks.stripe.com; " +
      "worker-src 'self' blob:; " +
      "frame-ancestors 'none'; " +
      "base-uri 'self'; " +
      "form-action 'self' https://api.aivis.biz; " +
      "upgrade-insecure-requests; " +
      "report-uri https://YOUR_SENTRY_REPORT_URI",
  };
}

const REMOVE_HEADERS = [
  "X-Powered-By",
  "Server",
  "X-Aspnet-Version",
  "X-Aspnetmvc-Version",
];

function generateNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

export default {
  async fetch(request) {
    let response;
    try {
      response = await fetch(request);
    } catch {
      return new Response("Origin unavailable", { status: 502 });
    }

    const newResponse = new Response(response.body, response);
    const contentType = newResponse.headers.get("Content-Type") || "";
    const isHtml = contentType.includes("text/html");

    for (const header of REMOVE_HEADERS) {
      newResponse.headers.delete(header);
    }

    // Apply base headers to all responses
    for (const [key, value] of Object.entries(BASE_SECURITY_HEADERS)) {
      newResponse.headers.set(key, value);
    }

    // Apply document-only headers (CSP with nonce) to HTML only
    if (isHtml) {
      const nonce = generateNonce();
      for (const [key, value] of Object.entries(buildDocumentHeaders(nonce))) {
        newResponse.headers.set(key, value);
      }
      // Expose nonce via header so SSR/edge can inject it into <script> tags
      newResponse.headers.set("X-CSP-Nonce", nonce);
    }

    return newResponse;
  },
};
