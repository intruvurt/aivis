/// <reference types="vite/client" />

declare global {
  interface ImportMetaEnv {
    readonly 'VITE_API_URL': string;
    readonly 'VITE_SENTRY_DSN': string;
    readonly 'VITE_NEON_AUTH_URL': string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }

  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
    AiVisConsent?: {
      get: () => unknown;
      set: (next: unknown) => unknown;
      open: () => void;
      reset: () => void;
    };
  }
}

export {};
