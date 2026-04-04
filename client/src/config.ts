/**
 * Central runtime configuration.
 * VITE_API_URL is baked in at build time. Falls back to api.aivis.biz (confirmed live).
 */
export const API_URL =
  (() => {
    const envUrl = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "");
    if (envUrl) return envUrl;

    if (typeof window !== 'undefined' && /^https?:$/i.test(window.location.protocol)) {
      const host = window.location.hostname;
      if (host === 'localhost' || host === '127.0.0.1') {
        return 'http://localhost:3001';
      }

      if (host === 'aivis.biz' || host === 'www.aivis.biz') {
        return 'https://api.aivis.biz';
      }

      if (host === 'api.aivis.biz') {
        return window.location.origin.replace(/\/$/, '');
      }

      return window.location.origin.replace(/\/$/, '');
    }

    return 'https://api.aivis.biz';
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
