/**
 * AutoScoreFixWidget — inline launcher card for Auto Score Fix.
 *
 * FEATURE LOCKED — shows "Coming Soon" while GitHub remediation mechanism is redesigned.
 */

import React from "react";

interface AutoScoreFixWidgetProps {
  auditResult: {
    url?: string;
    visibility_score?: number;
    audit_id?: string;
    [k: string]: unknown;
  };
  onOpen: () => void;
}

export const AutoScoreFixWidget: React.FC<AutoScoreFixWidgetProps> = () => {
  return (
    <div
      className="rounded-2xl border border-violet-300/10 bg-gradient-to-br from-violet-500/5 via-[#13182a] to-cyan-500/5 p-4 opacity-60"
      title="Auto Score Fix is being upgraded — coming soon"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-violet-200/60">Auto Score Fix</div>
          <p className="mt-1 text-xs leading-6 text-white/50">
            Automated GitHub remediation pipeline — coming soon.
          </p>
        </div>
        <div className="rounded-full border border-violet-300/15 bg-violet-400/8 px-2.5 py-1 text-[11px] text-violet-200/60">
          Coming Soon
        </div>
      </div>
      <button
        disabled
        className="mt-3 w-full rounded-xl py-2.5 px-3 text-sm font-semibold tracking-tight bg-slate-700/40 text-slate-500 cursor-not-allowed opacity-60"
      >
        ⚡ Auto Score Fix (Upgrading)
      </button>
      <p className="mt-2 text-[11px] leading-5 text-white/35">
        The remediation pipeline is being redesigned for better GitHub integration. Check back soon.
      </p>
    </div>
  );
};

export default AutoScoreFixWidget;
