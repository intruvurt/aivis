import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, X } from "lucide-react";

const BANNER_DISMISS_KEY = "aivis_platform_update_banner_dismissed_v1";
const BANNER_EXPIRES_AT = new Date("2026-04-01T23:59:59Z").getTime();

export default function PlatformUpdateBanner() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(BANNER_DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });

  if (Date.now() > BANNER_EXPIRES_AT || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(BANNER_DISMISS_KEY, "1");
    } catch {
      return;
    }
  };

  return (
    <div className="relative z-20 w-full border-y border-indigo-300/25 bg-gradient-to-r from-slate-900/85 via-indigo-900/55 to-slate-900/85 text-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-3 sm:px-6 lg:px-8">
        <div className="inline-flex items-center gap-2 text-sm sm:text-[15px]">
          <Sparkles className="h-4 w-4 shrink-0 text-indigo-200" />
          <span className="text-white/95">
            We had brief server downtime while rolling out Team Workspaces + WebMCP. It&apos;s now live — take a look.
          </span>
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <Link
            to="/team"
            className="inline-flex items-center rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20 transition-colors"
          >
            Open Team Workspace
          </Link>
          <Link
            to="/mcp"
            className="inline-flex items-center rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20 transition-colors"
          >
            Open WebMCP
          </Link>
          <button
            type="button"
            onClick={handleDismiss}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white/75 hover:bg-white/15 hover:text-white transition-colors"
            aria-label="Dismiss platform update banner"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}