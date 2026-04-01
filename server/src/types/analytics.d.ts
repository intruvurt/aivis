// types/analytics.d.ts
declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

// xml2js ships without bundled .d.ts types
declare module 'xml2js';

export {};
