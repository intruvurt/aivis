/// <reference types="vite/client" />

declare global {
  interface ImportMetaEnv {
    readonly 'VITE_API_URL': string;
    readonly 'VITE_SENTRY_DSN': string;
    readonly 'VITE_NEON_AUTH_URL': string;
    readonly 'VITE_CLARITY_ENABLED'?: string;
    readonly 'VITE_GA_ENABLED'?: string;
    readonly 'VITE_POSTHOG_ENABLED'?: string;
    readonly 'VITE_BROWSER_RUN_MODE'?: string;
    readonly 'VITE_NOTIFICATIONS_SSE_ENABLED'?: string;
    readonly 'VITE_NOTIFICATIONS_SSE_CROSS_ORIGIN'?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }

  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
    __AIVIS_GA_DISABLED?: boolean;
    AiVisConsent?: {
      get: () => unknown;
      set: (next: unknown) => unknown;
      open: () => void;
      reset: () => void;
    };
  }
}

export { };
