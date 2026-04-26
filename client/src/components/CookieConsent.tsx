import React, { useState, useEffect } from 'react';
import { Button } from './ui/Button';

const KEY = 'cookie-consent';
const COOKIE_NAME = 'aivis_cookie_consent';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function readConsentCookie(): string | null {
  try {
    if (typeof document === 'undefined') return null;
    const prefix = `${COOKIE_NAME}=`;
    const match = document.cookie
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(prefix));

    if (!match) return null;
    return decodeURIComponent(match.slice(prefix.length));
  } catch {
    return null;
  }
}

function writeConsentCookie(value: string) {
  try {
    if (typeof document === 'undefined') return;
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(value)}; Max-Age=${COOKIE_MAX_AGE}; Path=/; SameSite=Lax`;
  } catch {
    // Ignore cookie write failures
  }
}

function clearConsentCookie() {
  try {
    if (typeof document === 'undefined') return;
    document.cookie = `${COOKIE_NAME}=; Max-Age=0; Path=/; SameSite=Lax`;
  } catch {
    // Ignore cookie clear failures
  }
}

function safeGet(key: string): string | null {
  try {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(key);
    }
  } catch {
    // Ignore storage failures (private mode, blocked storage, etc.)
  }
  return null;
}

function safeSet(key: string, value: string) {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, value);
    }
  } catch {
    // Ignore storage failures
  }
}

/** Check whether the user has accepted cookies */
export function hasConsent(): boolean {
  return safeGet(KEY) === 'accepted' || readConsentCookie() === 'accepted';
}

/** Revoke cookie consent */
export function revokeConsent(): void {
  try {
    if (typeof window !== 'undefined') localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
  clearConsentCookie();
}

/** Set cookie consent to a specific value */
export function setConsentValue(value: string): void {
  safeSet(KEY, value);
  writeConsentCookie(value);
}

export function CookieConsent() {
  const [show, setShow] = useState(false);

  // Check consent status after component mounts on client
  useEffect(() => {
    const consent = safeGet(KEY) || readConsentCookie();
    // Show banner only if no prior consent exists
    setShow(!consent);
  }, []);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== KEY) return;
      setShow(!event.newValue);
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const accept = () => {
    setConsentValue('accepted');
    setShow(false);
  };

  const dismiss = () => {
    setConsentValue('dismissed');
    setShow(false);
  };

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="cookie-consent-heading"
      className="fixed bottom-0 left-0 right-0 z-50 animate-in slide-in-from-bottom-2 no-print border-t border-[color:var(--border)] bg-[linear-gradient(180deg,rgba(8,12,10,0.96),rgba(13,18,16,0.98))] p-4 text-white shadow-[0_-24px_60px_rgba(0,0,0,0.38)] backdrop-blur-xl"
    >
      <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div
          id="cookie-consent-heading"
          className="text-sm text-center sm:text-left text-[color:var(--text-dim)]"
        >
          We use essential browser storage for authentication and settings. Optional analytics stay
          off until you accept, and your consent preference is persisted in local storage and a
          first-party cookie on this browser.
        </div>
        <div className="flex flex-wrap justify-center sm:justify-start gap-3">
          <Button
            onClick={dismiss}
            variant="ghost"
            className="text-[color:var(--text-muted)] hover:text-white hover:bg-white/10"
            aria-label="Dismiss cookie consent banner"
          >
            Close
          </Button>
          <Button
            onClick={accept}
            className="border border-[#22ff6e]/30 bg-[linear-gradient(135deg,#22ff6e,#b3ff61)] text-[#08110c] shadow-lg shadow-[#22ff6e]/20 hover:brightness-110"
            aria-label="Accept cookies"
          >
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
