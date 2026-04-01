import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  PlugZap,
  ShieldCheck,
  CalendarClock,
  KeyRound,
  Webhook,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Wrench,
  ArrowRight,
  FileJson2,
  Lock,
  Bot,
  Zap,
} from "lucide-react";
import { API_URL } from "../config";
import { useAuthStore } from "../stores/authStore";
import useFeatureStatus from "../hooks/useFeatureStatus";
import AdvancedFeaturesPanel from "../components/AdvancedFeaturesPanel";
import { TIER_LIMITS, uiTierFromCanonical } from "../../../shared/types";

type EndpointCheck = {
  key: string;
  label: string;
  path: string;
  method: "GET" | "POST";
  status: "idle" | "ok" | "warn" | "fail";
  httpStatus?: number;
  note?: string;
};

function baseApi(path: string): string {
  const base = (API_URL || "").replace(/\/+$/, "");
  return `${base}${path}`;
}

export default function IntegrationsHubPage() {
  const { token, user, isAuthenticated } = useAuthStore();
  const { status: featureStatus, updatedAtLabel, refresh } = useFeatureStatus();

  const uiTier = uiTierFromCanonical((user?.tier || 'observer') as any);
  const tierLimits = TIER_LIMITS[uiTier];

  // Observer tier gate — integrations are Alignment+ only
  if (!tierLimits.hasApiAccess) {
    return (
      <div className="min-h-screen page-splash-bg bg-[#2e3646] text-white px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl mt-16">
          <div className="rounded-3xl border border-white/10 bg-[#111827]/90 p-10 text-center shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center mx-auto mb-5">
              <Lock className="w-7 h-7 text-violet-400" />
            </div>
            <h1 className="text-xl font-bold text-white mb-2">Integrations &amp; Automation</h1>
            <p className="text-sm text-white/55 max-w-md mx-auto mb-2">
              API access, webhooks, and scheduled rescans start on Alignment. OAuth 2.0 and MCP Server require Signal or higher.
            </p>
            <p className="text-xs text-white/35 mb-7">
              Observer [Free] includes manual audits only.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8 text-left">
              {[
                { label: 'Scheduled Rescans', tier: 'Alignment+' },
                { label: 'API Keys', tier: 'Alignment+' },
                { label: 'Webhooks', tier: 'Alignment+' },
                { label: 'OpenAPI Spec', tier: 'Alignment+' },
                { label: 'OAuth 2.0', tier: 'Signal+' },
                { label: 'MCP Server', tier: 'Signal+' },
              ].map((f) => (
                <div key={f.label} className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                  <p className="text-xs font-medium text-white/70">{f.label}</p>
                  <span className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                    f.tier === 'Signal+'
                      ? 'border-violet-400/30 bg-violet-500/10 text-violet-300'
                      : 'border-cyan-400/30 bg-cyan-500/10 text-cyan-300'
                  }`}>{f.tier}</span>
                </div>
              ))}
            </div>
            <a
              href="/pricing"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 text-white text-sm font-semibold hover:from-violet-600 hover:to-cyan-600 transition-all shadow-lg shadow-violet-500/20"
            >
              <Zap className="w-4 h-4" /> Upgrade to Alignment
            </a>
          </div>
        </div>
      </div>
    );
  }

  const [checks, setChecks] = useState<EndpointCheck[]>([
    { key: "features-status", label: "Feature Status", path: "/api/features/status", method: "GET", status: "idle" },
    { key: "webhooks-catalog", label: "Webhook Catalog", path: "/api/features/webhooks/catalog", method: "GET", status: "idle" },
    { key: "auto-score-fix-status", label: "Auto Score Fix Status", path: "/api/auto-score-fix/status", method: "GET", status: "idle" },
    { key: "openapi-spec", label: "OpenAPI 3.0 Spec", path: "/api/v1/openapi.json", method: "GET", status: "idle" },
    { key: "oauth-authorize", label: "OAuth 2.0 Provider", path: "/api/oauth/authorize", method: "GET", status: "idle" },
    { key: "mcp-server", label: "MCP Server", path: "/api/mcp/tools", method: "GET", status: "idle" },
  ]);
  const [runningChecks, setRunningChecks] = useState(false);

  const headers = useMemo(
    () => ({ "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }),
    [token]
  );

  const runChecks = useCallback(async () => {
    if (!isAuthenticated) return;
    setRunningChecks(true);

    const next = await Promise.all(
      checks.map(async (item) => {
        try {
          const res = await fetch(baseApi(item.path), {
            method: item.method,
            headers,
            credentials: "include",
          });

          const body = await res.json().catch(() => ({}));

          if (res.ok) {
            return {
              ...item,
              status: "ok" as const,
              httpStatus: res.status,
              note: body?.success === false ? "Route responded with success=false payload" : "Endpoint reachable and responded",
            };
          }

          if (res.status === 401 || res.status === 403 || res.status === 402) {
            return {
              ...item,
              status: "warn" as const,
              httpStatus: res.status,
              note: body?.error || "Endpoint reachable but gated by auth/tier/credits",
            };
          }

          if (res.status === 400) {
            return {
              ...item,
              status: "warn" as const,
              httpStatus: res.status,
              note: body?.error || "Endpoint reachable — requires parameters",
            };
          }

          if (res.status === 503) {
            return {
              ...item,
              status: "warn" as const,
              httpStatus: res.status,
              note: body?.error || "Endpoint reachable — feature temporarily locked",
            };
          }

          return {
            ...item,
            status: "fail" as const,
            httpStatus: res.status,
            note: body?.error || "Endpoint returned an error",
          };
        } catch (err: any) {
          return {
            ...item,
            status: "fail" as const,
            note: err?.message || "Network request failed",
          };
        }
      })
    );

    setChecks(next);
    setRunningChecks(false);
  }, [checks, headers, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    void runChecks();
  }, [isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  const statusCounts = useMemo(() => {
    return checks.reduce(
      (acc, c) => {
        acc[c.status] += 1;
        return acc;
      },
      { idle: 0, ok: 0, warn: 0, fail: 0 }
    );
  }, [checks]);

  return (
    <div className="min-h-screen page-splash-bg bg-[#2e3646] text-white px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-[#111827]/90 p-6 shadow-2xl sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-wide text-white/65">
                <PlugZap className="h-3.5 w-3.5" />
                Integration Hub
              </div>
              <h1 className="mt-4 text-2xl brand-title sm:text-3xl">Third-party integrations and automation tooling</h1>
              <p className="mt-3 max-w-4xl text-sm leading-7 text-white/65">
                This space exists to explain each integration’s purpose, validate API endpoint reachability,
                and keep automation setup discoverable outside Settings.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  void refresh();
                  void runChecks();
                }}
                disabled={runningChecks}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/75 hover:text-white transition disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${runningChecks ? "animate-spin" : ""}`} />
                Revalidate
              </button>
              <Link
                to="/settings?section=advanced"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/75 hover:text-white transition"
              >
                Settings
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-[#111827]/90 p-4">
            <div className="text-xs text-white/50">Tier</div>
            <div className="mt-1 text-lg font-semibold capitalize text-white">{featureStatus?.tier || user?.tier || "observer"}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#111827]/90 p-4">
            <div className="text-xs text-white/50">Automation & API</div>
            <div className="mt-1 text-lg font-semibold text-white">{featureStatus?.features?.apiAccess?.available ? "Enabled" : "Gated"}</div>
            <div className="text-xs text-white/50 mt-1">Updated {updatedAtLabel || "--:--"}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#111827]/90 p-4">
            <div className="text-xs text-white/50">Endpoint Checks</div>
            <div className="mt-1 text-lg font-semibold text-emerald-300">{statusCounts.ok} pass</div>
            <div className="text-xs text-amber-300 mt-1">{statusCounts.warn} gated</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#111827]/90 p-4">
            <div className="text-xs text-white/50">Endpoint Errors</div>
            <div className="mt-1 text-lg font-semibold text-red-300">{statusCounts.fail} fail</div>
            <div className="text-xs text-white/50 mt-1">Auth/tier gates count as “gated”, not failures</div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-[#111827]/90 p-6 shadow-2xl sm:p-8">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="h-4 w-4 text-white/75" />
            <h2 className="text-lg brand-title">Endpoint validation</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {checks.map((check) => (
              <div key={check.key} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-white">{check.label}</div>
                    <div className="text-xs text-white/50 mt-0.5">{check.method} {check.path}</div>
                  </div>
                  {check.status === "ok" && <CheckCircle2 className="h-4 w-4 text-emerald-300" />}
                  {check.status === "warn" && <AlertTriangle className="h-4 w-4 text-amber-300" />}
                  {check.status === "fail" && <XCircle className="h-4 w-4 text-red-300" />}
                  {check.status === "idle" && <Wrench className="h-4 w-4 text-white/45" />}
                </div>
                <div className="mt-2 text-xs text-white/65">{check.note || "Not checked yet"}</div>
                {typeof check.httpStatus === "number" && (
                  <div className="mt-2 text-[11px] text-white/45">HTTP {check.httpStatus}</div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Featured: MCP Console */}
        <section className="rounded-3xl border border-violet-500/20 bg-gradient-to-r from-[#111827]/95 to-[#1a1040]/90 p-6 shadow-2xl sm:p-8 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_80%_20%,rgba(139,92,246,0.08),transparent)]" />
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
                <Bot className="w-6 h-6 text-violet-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">MCP Console</h2>
                <p className="text-sm text-white/50 max-w-lg">
                  Connect AI agents like Claude Desktop and Cursor to your AiVIS account. 8 tools for auditing, analytics, and competitor tracking — all via Model Context Protocol.
                </p>
              </div>
            </div>
            <Link
              to="/mcp"
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 px-5 py-2.5 text-sm font-semibold text-white transition shadow-lg shadow-violet-500/15"
            >
              Open MCP Console
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-[#111827]/90 p-6 shadow-2xl sm:p-8">
          <div className="flex items-center gap-2 mb-4">
            <CalendarClock className="h-4 w-4 text-white/75" />
            <h2 className="text-lg brand-title">What each integration is for</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-2 text-white"><CalendarClock className="h-4 w-4" /> Scheduled rescans</div>
              <p className="mt-2 text-xs leading-6 text-white/60">Continuously re-audit critical URLs so score drift and content regressions are caught automatically.</p>
              <span className="mt-2 inline-block rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-300 uppercase tracking-wide">Alignment+</span>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-2 text-white"><KeyRound className="h-4 w-4" /> API keys</div>
              <p className="mt-2 text-xs leading-6 text-white/60">Programmatic access for CI/CD, internal dashboards, and agency workflows using scoped keys.</p>
              <span className="mt-2 inline-block rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-300 uppercase tracking-wide">Alignment+</span>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-2 text-white"><Webhook className="h-4 w-4" /> Webhooks</div>
              <p className="mt-2 text-xs leading-6 text-white/60">Push audit events to Slack, Zapier, Discord, and custom endpoints to trigger downstream automation.</p>
              <span className="mt-2 inline-block rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-300 uppercase tracking-wide">Alignment+</span>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-2 text-white"><PlugZap className="h-4 w-4" /> Auto Score Fix</div>
              <p className="mt-2 text-xs leading-6 text-white/60">Convert findings into evidence-linked PR changes against GitHub, GitLab, or Bitbucket repositories.</p>
              <span className="mt-2 inline-block rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300 uppercase tracking-wide">Coming soon</span>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-2 text-white"><FileJson2 className="h-4 w-4" /> OpenAPI 3.0 Spec</div>
              <p className="mt-2 text-xs leading-6 text-white/60">Machine-readable API spec at <code className="text-white/75">/api/v1/openapi.json</code> for SDK generation, Postman import, and CI integration.</p>
              <span className="mt-2 inline-block rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-300 uppercase tracking-wide">Alignment+</span>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-2 text-white"><Lock className="h-4 w-4" /> OAuth 2.0 Provider</div>
              <p className="mt-2 text-xs leading-6 text-white/60">Register OAuth clients for authorization-code flow. Enables third-party apps and CI pipelines to act on behalf of your account.</p>
              <span className="mt-2 inline-block rounded-full border border-violet-400/30 bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-300 uppercase tracking-wide">Signal+</span>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-2 text-white"><Bot className="h-4 w-4" /> MCP Server</div>
              <p className="mt-2 text-xs leading-6 text-white/60">Expose AiVIS tools to AI agents via Model Context Protocol. 8 tools including audit execution, history retrieval, and analytics queries.</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="inline-block rounded-full border border-violet-400/30 bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-300 uppercase tracking-wide">Signal+</span>
                <Link to="/mcp" className="text-[10px] text-violet-300 hover:text-violet-200 underline underline-offset-2">Open MCP Console →</Link>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-[#111827]/90 p-6 shadow-2xl sm:p-8">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-lg brand-title">Integration controls</h2>
            <span className="text-xs text-white/50">Moved from buried settings path for direct discoverability</span>
          </div>
          <AdvancedFeaturesPanel />
        </section>
      </div>
    </div>
  );
}
