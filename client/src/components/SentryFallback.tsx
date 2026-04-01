// client/src/components/SentryFallback.tsx
import React from "react";
import type { FallbackRender } from "@sentry/react";

const SentryFallback: FallbackRender = ({ error, resetError, eventId }) => {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Something went wrong.";

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="card card--neo fx-grid max-w-[720px] w-full">
        <div className="holo-text text-2xl font-semibold">system hit turbulence</div>
        <div className="text-muted mt-3">{message}</div>

        {eventId ? (
          <div className="text-muted mt-2">
            event id <span className="text-accent">{eventId}</span>
          </div>
        ) : null}

        <div className="mt-5 flex items-center gap-4">
          <button className="btn-primary" onClick={resetError}>
            retry
          </button>
          <a href="/help" className="text-sm text-muted hover:text-accent transition-colors">
            Contact Support
          </a>
        </div>
      </div>
    </div>
  );
};

export default SentryFallback;