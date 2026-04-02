import React from "react";
import { Activity, ChevronUp, Bell, CalendarClock, Loader2 } from "lucide-react";

interface AuditProgressBannerProps {
  isVisible: boolean;
  url: string;
  percent: number;
  onExpand: () => void;
  isFinished: boolean;
}

/**
 * Soft floating banner that appears when user minimizes the full-screen audit
 * overlay. Lets users know the audit is running in the background and they'll
 * receive a notification when it completes. Clicking expands the full overlay.
 */
export default function AuditProgressBanner({
  isVisible,
  url,
  percent,
  onExpand,
  isFinished,
}: AuditProgressBannerProps) {
  if (!isVisible) return null;

  const clamped = Math.min(100, Math.max(0, Math.round(percent)));
  const displayUrl = (() => {
    try {
      const u = new URL(url.startsWith("http") ? url : `https://${url}`);
      return u.hostname + (u.pathname !== "/" ? u.pathname : "");
    } catch {
      return url;
    }
  })();

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[90] w-[95vw] max-w-lg animate-slideUp">
      <button
        type="button"
        onClick={onExpand}
        className="w-full text-left rounded-2xl border border-white/[0.12] bg-[#1a1f2e]/95 shadow-[0_12px_48px_rgba(0,0,0,0.5)] px-4 py-3.5 transition-all hover:border-cyan-400/25 hover:shadow-[0_12px_48px_rgba(6,182,212,0.12)] group"
      >
        {/* Progress bar */}
        <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl overflow-hidden bg-white/[0.06]">
          <div
            className="h-full bg-gradient-to-r from-cyan-400 via-violet-500 to-cyan-400 transition-all duration-700 ease-out"
            style={{ width: `${clamped}%` }}
          />
        </div>

        <div className="flex items-center gap-3">
          {/* Spinner / done icon */}
          <div className="relative flex-shrink-0">
            {isFinished ? (
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
                <Bell className="w-4 h-4 text-emerald-400" />
              </div>
            ) : (
              <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
              </div>
            )}
          </div>

          {/* Text content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[13px] font-semibold text-white truncate">
                {isFinished ? "Audit Complete" : "Audit Running in Background"}
              </p>
              <span className="flex-shrink-0 text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded bg-white/[0.06] text-white/60">
                {clamped}%
              </span>
            </div>
            <p className="text-[11px] text-white/45 truncate mt-0.5">
              {isFinished ? (
                "Tap to view your results"
              ) : (
                <>
                  <span className="font-mono text-white/55">{displayUrl}</span>
                  {" — you'll get a notification when it's done"}
                </>
              )}
            </p>
          </div>

          {/* Expand arrow */}
          <div className="flex-shrink-0 opacity-50 group-hover:opacity-100 transition-opacity">
            <ChevronUp className="w-4 h-4 text-white/60" />
          </div>
        </div>

        {/* Footer tips */}
        {!isFinished && (
          <div className="mt-2.5 pt-2 border-t border-white/[0.06] flex flex-wrap items-center gap-3 text-[10px] text-white/35">
            <span className="flex items-center gap-1">
              <Activity className="w-3 h-3 text-cyan-400/60" />
              Continue browsing — audit runs server-side
            </span>
            <span className="flex items-center gap-1">
              <CalendarClock className="w-3 h-3 text-violet-400/60" />
              Schedule recurring audits from Settings
            </span>
          </div>
        )}
      </button>

      <style>{`
        @keyframes slideUp {
          from { transform: translateX(-50%) translateY(24px); opacity: 0; }
          to   { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
        .animate-slideUp { animation: slideUp 0.35s ease-out; }
      `}</style>
    </div>
  );
}
