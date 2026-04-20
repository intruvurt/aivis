import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowRight, X, FlaskConical } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

const DISMISSED_KEY = 'sfb_dismissed_v1';

/**
 * Phase 2 migration nudge: shown once to users who have an account
 * but land on routes that are part of the old dashboard mental model.
 *
 * Conditions for display:
 * - User is authenticated
 * - Not already dismissed (localStorage flag)
 * - Currently on /app/overview (legacy dashboard)
 *
 * Dismissed permanently per-browser with no server round-trip.
 */
export default function ScanFlowBanner() {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISSED_KEY) === '1');

  if (!user || dismissed) return null;

  // Only show on the legacy overview route
  if (location.pathname !== '/app/overview') return null;

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1');
    setDismissed(true);
  }

  function goToScan() {
    dismiss();
    navigate('/app/scan');
  }

  return (
    <div className="w-full px-4 py-2.5 flex items-center justify-between gap-3 bg-gradient-to-r from-violet-600/80 to-blue-600/70 text-white text-sm">
      <div className="flex items-center gap-2 min-w-0">
        <FlaskConical className="w-4 h-4 shrink-0 opacity-80" />
        <span className="truncate">
          The system now runs a citation ledger pipeline.{' '}
          <strong>Scan → Evidence → Registry</strong> is the new flow.
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={goToScan}
          type="button"
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 transition-colors text-xs font-semibold whitespace-nowrap"
        >
          Run a scan <ArrowRight className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={dismiss}
          type="button"
          aria-label="Dismiss"
          className="p-1 rounded hover:bg-white/20 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
