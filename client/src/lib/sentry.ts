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
    // Strip tokens, secrets, and OTPs from URLs before sending to Sentry
    beforeSend(event) {
      if (event.request?.url) {
        event.request.url = event.request.url.replace(
          /([?&])(token|access_token|password|secret|otp|reset_code|api_key|ref)=[^&]*/gi,
          '$1$2=[REDACTED]',
        );
      }
      // Also strip from breadcrumbs
      if (event.breadcrumbs) {
        for (const bc of event.breadcrumbs) {
          if (typeof bc.data?.url === 'string') {
            bc.data.url = bc.data.url.replace(
              /([?&])(token|access_token|password|secret|otp|reset_code|api_key|ref)=[^&]*/gi,
              '$1$2=[REDACTED]',
            );
          }
        }
      }
      return event;
    },
  });

  sentryInitialized = true;
}