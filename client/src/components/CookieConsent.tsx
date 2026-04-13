import React, { useState, useEffect } from "react";
import { Button } from "./ui/Button";

const KEY = "cookie-consent";

function safeGet(key: string): string | null {
  try {
    if (typeof window !== "undefined") {
      return localStorage.getItem(key);
    }
  } catch {
    // Ignore storage failures (private mode, blocked storage, etc.)
  }
  return null;
}

function safeSet(key: string, value: string) {
  try {
    if (typeof window !== "undefined") {
      localStorage.setItem(key, value);
    }
  } catch {
    // Ignore storage failures
  }
}

/** Check whether the user has accepted cookies */
export function hasConsent(): boolean {
  return safeGet(KEY) === "accepted";
}

/** Revoke cookie consent */
export function revokeConsent(): void {
  try { if (typeof window !== "undefined") localStorage.removeItem(KEY); } catch { /* noop */ }
}

/** Set cookie consent to a specific value */
export function setConsentValue(value: string): void {
  safeSet(KEY, value);
}

export function CookieConsent() {
  const [show, setShow] = useState(false);

  // Check consent status after component mounts on client
  useEffect(() => {
    const consent = safeGet(KEY);
    // Show banner only if no prior consent exists
    setShow(!consent);
  }, []);

  const accept = () => {
    safeSet(KEY, "accepted");
    setShow(false);
  };

  const dismiss = () => {
    safeSet(KEY, "dismissed");
    setShow(false);
  };

  if (!show) return null;

  return (
    <div 
role="dialog" 
    aria-labelledby="cookie-consent-heading"
    className="fixed bottom-0 left-0 right-0 bg-slate-900 text-white p-4 z-50 animate-in slide-in-from-bottom-2 no-print"
  >
    <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
      <div id="cookie-consent-heading" className="text-sm text-center sm:text-left text-slate-300">
        We use browser storage to remember your session in this tab and optional analytics after consent.
        Your consent choice is stored locally in this browser.
      </div>
      <div className="flex flex-wrap justify-center sm:justify-start gap-3">
        <Button
          onClick={dismiss}
          variant="ghost"
          className="text-slate-400 hover:text-white hover:bg-white/10"
          aria-label="Dismiss cookie consent banner"
        >
          Close
        </Button>
        <Button
          onClick={accept}
          className="bg-indigo-600 text-white hover:bg-indigo-500 border border-indigo-500 shadow-lg shadow-indigo-900/50"
          aria-label="Accept cookies"
        >
          Accept
        </Button>
      </div>
    </div>
    </div>
  );
}