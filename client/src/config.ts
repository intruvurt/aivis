/**
 * Central runtime configuration.
 * VITE_API_URL is baked in at build time. Falls back to api.aivis.biz (confirmed live).
 */
export const API_URL =
  // Prefer explicit env var; otherwise use localhost during development
  (() => {
    const envUrl = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "");
    if (envUrl) return envUrl;
    // If running in a browser on localhost, default to the local server port used by the dev server
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      if (host === 'localhost' || host === '127.0.0.1') {
        return 'http://localhost:3001';
      }
      // Production fallback: prefer same-origin API to avoid stale hardcoded hostnames.
      return window.location.origin.replace(/\/$/, '');
    }
    // SSR/build fallback only (browser path above should handle runtime)
    return 'https://aivis.biz';
  })();

export const PUBLIC_APP_ORIGIN =
  (() => {
    const envOrigin =
      ((import.meta.env.VITE_PUBLIC_APP_ORIGIN as string | undefined)
        || (import.meta.env.VITE_APP_URL as string | undefined)
      )?.replace(/\/$/, "");
    if (envOrigin) return envOrigin;

    if (typeof window !== 'undefined' && /^https?:$/i.test(window.location.protocol)) {
      return window.location.origin.replace(/\/$/, '');
    }

    try {
      const api = new URL(API_URL);
      if (api.hostname.startsWith('api.')) {
        return `${api.protocol}//${api.hostname.slice(4)}`;
      }
    } catch {
      // no-op
    }

    return 'https://aivis.biz';
  })();

export const STRIPE_PUBLISHABLE_KEY =
  (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined) || "";
