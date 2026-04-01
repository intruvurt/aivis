import React, { useState } from "react";
import { X, Server, Gift } from "lucide-react";
import { useAuthStore } from "../stores/authStore";

const DISMISS_KEY = "aivis_infra_banner_dismissed";
const BANNER_VERSION = "2026-03-20"; // bump this to re-show after updates

/** Accounts created before this date were on the old DB and may have been affected. */
const MIGRATION_CUTOFF = new Date("2026-03-19T00:00:00Z");

/**
 * Infrastructure notice banner — only shown to returning users
 * whose accounts predate the DB migration. New signups never see this.
 * Dismissible via localStorage.
 */
export default function InfraNoticeBanner() {
  const user = useAuthStore((s) => s.user);

  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === BANNER_VERSION;
    } catch {
      return false;
    }
  });

  // Only show to authenticated users whose account predates the migration
  if (!user?.created_at) return null;
  const accountDate = new Date(user.created_at);
  if (accountDate >= MIGRATION_CUTOFF) return null;

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, BANNER_VERSION);
    } catch {
      /* storage unavailable */
    }
  };

  return (
    <div className="w-full bg-gradient-to-r from-indigo-600/90 via-cyan-600/85 to-indigo-600/90 text-white relative">
      <div className="max-w-5xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center gap-2 text-sm">
        <Server className="w-4 h-4 shrink-0 mt-0.5 sm:mt-0" />
        <div className="flex-1 leading-relaxed">
          <strong>Infrastructure upgrade in progress.</strong>{" "}
          Due to rapid growth in platform usage, we're scaling to larger infrastructure.
          Your data is safe — all accounts, audits, and payment history are fully preserved.
          Some features may be briefly limited during the transition.
          <span className="inline-flex items-center gap-1 ml-1.5">
            <Gift className="w-3.5 h-3.5 inline" />
            <strong>As a thank-you for your patience:</strong> all active users will receive an extended trial or a loyalty discount on their next billing cycle.
          </span>
        </div>
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 sm:static sm:ml-2 p-1 rounded hover:bg-white/20 transition-colors shrink-0"
          aria-label="Dismiss notice"
          type="button"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
