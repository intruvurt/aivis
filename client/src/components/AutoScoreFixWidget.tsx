/**
 * AutoScoreFixWidget — inline launcher card for Auto Score Fix.
 *
 * Supports both GitHub App installation flow and legacy OAuth token flow.
 */

import React, { useEffect, useState } from "react";
import { API_URL } from "../config";
import { buildBearerHeader } from "../utils/authToken";
import { useAuthStore } from "../stores/authStore";
import type { AnalysisResponse } from "@shared/types";

interface AutoScoreFixWidgetProps {
  auditResult: Pick<AnalysisResponse, "url" | "visibility_score" | "audit_id">;
  onOpen: () => void;
}

interface InstallationStatus {
  configured: boolean;
  installed: boolean;
  installation: {
    installation_id: number;
    account_login: string;
    account_type: string;
    repo_selection: string;
    created_at: string;
  } | null;
}

export const AutoScoreFixWidget: React.FC<AutoScoreFixWidgetProps> = ({ auditResult, onOpen }) => {
  const [status, setStatus] = useState<InstallationStatus | null>(null);
  const [installUrl, setInstallUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const token = useAuthStore((state) => state.token);

  useEffect(() => {
    const base = (API_URL || "").replace(/\/+$/, "");
    const authHeader = buildBearerHeader(token);
    const headers = authHeader ? { Authorization: authHeader } : undefined;

    Promise.all([
      fetch(`${base}/api/github-app/status`, { headers }).then(r => r.ok ? r.json() : null),
      fetch(`${base}/api/github-app/install-url`, { headers }).then(r => r.ok ? r.json() : null),
    ])
      .then(([s, u]) => {
        setStatus(s);
        setInstallUrl(u?.url || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const score = auditResult?.visibility_score ?? 0;
  const isInstalled = status?.installed;

  if (loading) {
    return (
      <div className="rounded-2xl border border-violet-300/10 bg-gradient-to-br from-violet-500/5 via-[#13182a] to-cyan-500/5 p-4 animate-pulse">
        <div className="h-4 w-24 bg-violet-300/10 rounded mb-2" />
        <div className="h-3 w-40 bg-violet-300/5 rounded" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-violet-300/10 bg-gradient-to-br from-violet-500/5 via-[#13182a] to-cyan-500/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-violet-200/60">Auto Score Fix</div>
          <p className="mt-1 text-xs leading-6 text-white/50">
            {isInstalled
              ? `Connected to GitHub as ${status?.installation?.account_login}. AI-generated PRs fix visibility issues automatically.`
              : "Install the AiVIS AutoFix Engine on GitHub to enable automated code-level visibility fixes."}
          </p>
        </div>
        {isInstalled ? (
          <div className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] text-emerald-200/80">
            Connected
          </div>
        ) : (
          <div className="rounded-full border border-amber-300/15 bg-amber-400/8 px-2.5 py-1 text-[11px] text-amber-200/60">
            Not Connected
          </div>
        )}
      </div>
      {isInstalled ? (
        <button
          onClick={onOpen}
          className="mt-3 w-full rounded-xl py-2.5 px-3 text-sm font-semibold tracking-tight bg-gradient-to-r from-violet-600 to-cyan-600 text-white hover:from-violet-500 hover:to-cyan-500 transition-all"
        >
          ⚡ Auto Score Fix {score ? `(Score: ${score})` : ""}
        </button>
      ) : installUrl ? (
        <a
          href={installUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 block w-full rounded-xl py-2.5 px-3 text-sm font-semibold tracking-tight text-center bg-gradient-to-r from-violet-600 to-cyan-600 text-white hover:from-violet-500 hover:to-cyan-500 transition-all"
        >
          Install AiVIS AutoFix Engine
        </a>
      ) : (
        <button
          onClick={onOpen}
          className="mt-3 w-full rounded-xl py-2.5 px-3 text-sm font-semibold tracking-tight bg-gradient-to-r from-violet-600 to-cyan-600 text-white hover:from-violet-500 hover:to-cyan-500 transition-all"
        >
          ⚡ Auto Score Fix
        </button>
      )}
      {!isInstalled && (
        <p className="mt-2 text-[11px] leading-5 text-white/35">
          The GitHub App uses fine-grained permissions — no personal access tokens needed.
        </p>
      )}
    </div>
  );
};

export default AutoScoreFixWidget;
