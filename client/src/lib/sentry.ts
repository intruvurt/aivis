// client/src/lib/sentry.ts
import * as Sentry from "@sentry/react";

const KEY = "cookie-consent" as const;

let sentryInitialized = false;

export function hasConsent(): boolean {
  try {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(KEY) === "accepted";
  } catch {
    return false;
  }
}

export function initSentryIfConsented(): void {
  if (sentryInitialized) return;
  if (!hasConsent()) return;

  // IMPORTANT: set VITE_SENTRY_DSN in your env for this to actually send anything
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) {
    // no DSN configured, silently skip
    return;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    enabled: true,

    // keep this conservative for an “enterprise” feel
    tracesSampleRate: 0.05,
  });

  sentryInitialized = true;
}