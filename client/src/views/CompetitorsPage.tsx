import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { useAnalysisStore } from "../stores/analysisStore";
import CompetitorManager from "../components/CompetitorManager";
import CompetitorComparison from "../components/CompetitorComparison";
import UpgradeWall from "../components/UpgradeWall";
import { meetsMinimumTier } from "@shared/types";
import {
  ArrowLeft,
  TrendingUp,
  CheckCircle2,
  ArrowRight,
  Layers3,
  Sparkles,
  Globe,
  ChevronDown,
} from "lucide-react";
import { CompetitorRadarIcon, TrustGraphIcon, AuditEngineIcon, ScoreFixIcon } from "../components/icons";
import { usePageMeta } from "../hooks/usePageMeta";
import { API_URL } from "../config";
import apiFetch from "../utils/api";
import PlatformProofLoopCard from "../components/PlatformProofLoopCard";

const COMPETITOR_TARGET_URL_KEY = "aivis-competitor-target-url";

const VALUE_CARDS = [
  {
    icon: CompetitorRadarIcon,
    label: "See who owns the answer space",
    detail:
      "Compare your visibility against competitors instead of judging your score in isolation.",
  },
  {
    icon: AuditEngineIcon,
    label: "Find where you disappear",
    detail:
      "Spot the gaps where competitor pages are being understood, cited, or surfaced while yours is skipped.",
  },
  {
    icon: TrustGraphIcon,
    label: "Pressure-test your authority",
    detail:
      "See whether stronger trust, structure, or evidence layers are giving rivals the edge.",
  },
  {
    icon: ScoreFixIcon,
    label: "Track movement after fixes",
    detail:
      "Revisit the same competitor set after changes to see whether your visibility position improves.",
  },
] as const;

const USE_CASES = [
  {
    title: "Weekly position tracking",
    detail:
      "Audit your tracked set each week and compare score deltas instead of relying on hunches.",
  },
  {
    title: "Gap-focused backlog",
    detail:
      "Use comparison gaps to prioritize your next visibility sprint instead of fixing random surface issues.",
  },
  {
    title: "Competitor pressure watch",
    detail:
      "Track the same set over time to see whether your changes narrow or widen the spread.",
  },
] as const;

const TIER_PATH = [
  {
    tier: "Alignment",
    title: "Competitor intelligence unlocked",
    detail: "Start adding most relevant competitors and comparing visibility side by side.",
  },
  {
    tier: "Signal",
    title: "Stronger strategic workflows",
    detail:
      "Use evidence-driven citable comparison insights with richer downstream tools and cross-feature pre-filled workflows.",
  },
  {
    tier: "Score Fix via bRAG",
    title: "Turn gaps into evidence, turn evidence into real fixes",
    detail:
      "Use the comparison data to guide what gets frequently monitored or 'update-fixed' implemented first and why it matters",
  },
] as const;

type AuditListResponse = {
  audits?: Array<{
    url?: string;
  }>;
};

function normalizeUrlInput(raw: string): string {
  const value = raw.trim();
  if (!value) return "";
  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  const parsed = new URL(candidate);

  if (
    parsed.hostname === "localhost" ||
    parsed.hostname === "127.0.0.1" ||
    parsed.hostname === "0.0.0.0"
  ) {
    throw new Error("Invalid host");
  }

  return parsed.href;
}

export default function CompetitorsPage() {
  const navigate = useNavigate();
  const { token, isAuthenticated, user } = useAuthStore();
  const hasAccess = meetsMinimumTier(user?.tier || "observer", "alignment");
  const latestResult = useAnalysisStore((s) => s.result);

  usePageMeta({
    title: "Competitors",
    description:
      "Track competitors and compare search answer-style visibility side by side to see who owns that answer space.",
    path: "/competitors",
  });

  const [refreshKey, setRefreshKey] = useState(0);
  const [comparisonUrl, setComparisonUrl] = useState("");
  const [comparisonUrlInput, setComparisonUrlInput] = useState("");
  const [comparisonUrlError, setComparisonUrlError] = useState<string | null>(
    null
  );
  const [recentAuditUrls, setRecentAuditUrls] = useState<string[]>([]);
  const [recentAuditLoading, setRecentAuditLoading] = useState(false);

  React.useEffect(() => {
    if (!isAuthenticated) {
      navigate("/auth?mode=signin");
    }
  }, [isAuthenticated, navigate]);

  React.useEffect(() => {
    if (!isAuthenticated) return;

    const stored = window.localStorage.getItem(COMPETITOR_TARGET_URL_KEY) || "";

    if (stored) {
      setComparisonUrl(stored);
      setComparisonUrlInput(stored);
      return;
    }

    if (latestResult?.url) {
      setComparisonUrl(latestResult.url);
      setComparisonUrlInput(latestResult.url);
    }
  }, [isAuthenticated, latestResult?.url]);

  React.useEffect(() => {
    if (!token || !hasAccess || !isAuthenticated) return;

    let isMounted = true;

    const loadRecentAuditUrls = async () => {
      try {
        setRecentAuditLoading(true);

        const response = await apiFetch(`${API_URL}/api/audits?limit=100`);
        const data = (await response.json().catch(() => ({}))) as AuditListResponse;

        const urls = Array.isArray(data?.audits)
          ? data.audits
              .map((audit) => String(audit?.url || "").trim())
              .filter(Boolean)
          : [];

        const seen = new Set<string>();
        const deduped: string[] = [];

        for (const url of urls) {
          try {
            const normalized = normalizeUrlInput(url);
            if (!seen.has(normalized)) {
              seen.add(normalized);
              deduped.push(normalized);
            }
          } catch {
            // ignore malformed historical URLs
          }

          if (deduped.length >= 20) break;
        }

        if (isMounted) {
          setRecentAuditUrls(deduped);
        }
      } catch {
        if (isMounted) {
          setRecentAuditUrls([]);
        }
      } finally {
        if (isMounted) {
          setRecentAuditLoading(false);
        }
      }
    };

    void loadRecentAuditUrls();

    return () => {
      isMounted = false;
    };
  }, [token, hasAccess, isAuthenticated, latestResult?.url]);

  function applyComparisonUrl() {
    try {
      const normalized = normalizeUrlInput(comparisonUrlInput);

      setComparisonUrl(normalized);
      setComparisonUrlInput(normalized);
      setComparisonUrlError(null);
      window.localStorage.setItem(COMPETITOR_TARGET_URL_KEY, normalized);
      setRefreshKey((k) => k + 1);
    } catch {
      setComparisonUrl("");
      setComparisonUrlError("Enter a valid URL, e.g. https://example.com");
    }
  }

  function useLatestAuditUrl() {
    const url = latestResult?.url || "";
    if (!url) return;

    setComparisonUrl(url);
    setComparisonUrlInput(url);
    setComparisonUrlError(null);
    window.localStorage.setItem(COMPETITOR_TARGET_URL_KEY, url);
    setRefreshKey((k) => k + 1);
  }

  function useRecentAuditUrl(url: string) {
    if (!url) return;

    setComparisonUrl(url);
    setComparisonUrlInput(url);
    setComparisonUrlError(null);
    window.localStorage.setItem(COMPETITOR_TARGET_URL_KEY, url);
    setRefreshKey((k) => k + 1);
  }

  function handleCompetitorScanComplete(scannedUrl: string) {
    if (!scannedUrl) return;
    setComparisonUrl(scannedUrl);
    setComparisonUrlInput(scannedUrl);
    setComparisonUrlError(null);
    window.localStorage.setItem(COMPETITOR_TARGET_URL_KEY, scannedUrl);
    setRefreshKey((k) => k + 1);
  }

  const userTier = user?.tier || "observer";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-white">
          <CompetitorRadarIcon className="h-5 w-5 text-slate-400" />
          Competitor Intelligence
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Track competitors and compare your AI visibility side by side.
        </p>
      </div>

      <div className="space-y-6">
        {!hasAccess ? (
          <UpgradeWall
            feature="Competitor Intelligence"
            description="Track competitors and compare AI visibility side by side to see who is winning the answer space."
            requiredTier="alignment"
            icon={<CompetitorRadarIcon className="h-12 w-12 text-white/80" />}
            featurePreview={[
              "Side-by-side AI visibility scores vs. named competitors",
              "See which competitor content structures AI models prefer",
              "Track how your gap closes (or opens) across re-audits",
            ]}
          />
        ) : (
          <>
            <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/10 via-charcoal to-charcoal p-6 shadow-2xl sm:p-8">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-charcoal-deep px-3 py-1 text-[11px] uppercase tracking-wide text-white/70">
                  <Sparkles className="h-3.5 w-3.5" />
                  Competitor Intelligence
                </div>
                <h2 className="mt-4 text-3xl brand-title text-white/90 sm:text-4xl">
                  See who owns the AI answer space in your market
                </h2>
                <p className="mt-4 max-w-3xl text-sm leading-8 text-white/60 sm:text-base">
                  Track your competitors, compare visibility side by side, and
                  find the structural or authority gaps that explain why some
                  brands get surfaced while others stay invisible.
                </p>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {VALUE_CARDS.map((item) => {
                    const IconComponent = item.icon;
                    return (
                      <div
                        key={item.label}
                        className="rounded-2xl border border-white/10 bg-charcoal-deep p-4"
                      >
                        <div className="flex items-start gap-3">
                          <div className="rounded-xl border border-white/10 bg-charcoal p-2.5">
                            <IconComponent className="h-4 w-4 text-white/75" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-white/85">
                              {item.label}
                            </div>
                            <div className="mt-1 text-xs leading-6 text-white/55">
                              {item.detail}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <aside className="rounded-xl border border-white/10 bg-charcoal p-6 shadow-2xl sm:p-8">
                <div className="flex items-center gap-2">
                  <Layers3 className="h-4 w-4 text-white/75" />
                  <h2 className="text-sm font-semibold text-white/85">
                    How to use this page
                  </h2>
                </div>

                <div className="mt-5 space-y-3">
                  {[
                    "Add direct competitors or brands occupying the same answer space",
                    "Compare their visibility posture against your audited URL",
                    "Use the gap to decide what needs fixing first",
                    "Re-check after changes to see whether the spread improves",
                  ].map((item) => (
                    <div
                      key={item}
                      className="flex items-start gap-2 rounded-2xl border border-white/10 bg-charcoal-deep px-4 py-3 text-sm text-white/70"
                    >
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-white/75" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-2xl border border-white/10 bg-charcoal-deep p-4">
                  <div className="text-xs uppercase tracking-wide text-white/45">
                    Current access
                  </div>
                  <div className="mt-2 text-sm font-semibold capitalize text-white/85">
                    {userTier}
                  </div>
                  <div className="mt-2 text-xs leading-6 text-white/55">
                    Alignment unlocks competitor comparison. Stronger downstream
                    planning happens when these gaps feed into audit and
                    remediation workflows.
                  </div>
                </div>
              </aside>
            </section>

            <section className="grid gap-4 lg:grid-cols-3">
              {USE_CASES.map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 via-charcoal to-charcoal p-5"
                >
                  <p className="text-xs uppercase tracking-wide text-white/45">
                    Use case
                  </p>
                  <p className="mt-1 text-sm font-semibold text-white">
                    {item.title}
                  </p>
                  <p className="mt-2 text-xs leading-6 text-white/60">
                    {item.detail}
                  </p>
                </div>
              ))}
            </section>

            <section className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="rounded-xl border border-white/10 bg-charcoal p-6 shadow-2xl sm:p-8">
                <div className="flex items-center gap-2">
                  <CompetitorRadarIcon className="h-4 w-4 text-white/75" />
                  <h2 className="text-lg font-semibold text-white">
                    Comparison target
                  </h2>
                </div>

                <div className="mt-5 rounded-2xl border border-white/10 bg-charcoal-deep p-4">
                  <div className="text-xs uppercase tracking-wide text-white/45">
                    Current site
                  </div>
                  <div className="mt-2 truncate text-sm font-semibold text-white">
                    {comparisonUrl || "Set your site URL"}
                  </div>
                  <div className="mt-2 flex items-center gap-1 text-xs text-white/60">
                    <TrendingUp className="h-3.5 w-3.5" />
                    Target +5 score points month-over-month
                  </div>
                </div>

                <div className="mt-5 flex flex-col gap-3">
                  <label className="text-xs text-white/60">
                    Comparison target URL
                  </label>

                  <div className="flex flex-col gap-2 md:flex-row">
                    <input
                      type="text"
                      value={comparisonUrlInput}
                      onChange={(e) => setComparisonUrlInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && comparisonUrlInput.trim() && applyComparisonUrl()}
                      enterKeyHint="done"
                      placeholder="https://your-site.com"
                      className="flex-1 rounded-lg border border-white/10 bg-charcoal px-3 py-2 text-sm text-white placeholder:text-white/50"
                    />
                    <button
                      onClick={applyComparisonUrl}
                      className="rounded-lg bg-charcoal px-3 py-2 text-sm text-white/85 transition-colors hover:bg-charcoal-light"
                      type="button"
                    >
                      Apply
                    </button>
                  </div>

                  <div className="flex flex-col gap-2 md:flex-row md:items-center">
                    <button
                      onClick={useLatestAuditUrl}
                      disabled={!latestResult?.url}
                      className="rounded-lg border border-white/10 bg-charcoal-light px-3 py-2 text-sm text-white/75 disabled:opacity-40"
                      type="button"
                    >
                      Use Latest Audit
                    </button>

                    <div className="relative flex-1">
                      <select
                        value=""
                        onChange={(e) => useRecentAuditUrl(e.target.value)}
                        disabled={
                          recentAuditLoading || recentAuditUrls.length === 0
                        }
                        className="w-full appearance-none rounded-lg border border-white/10 bg-charcoal-light px-3 py-2 pr-10 text-sm text-white/75 disabled:opacity-40"
                      >
                        <option value="">
                          {recentAuditLoading
                            ? "Loading recent audits..."
                            : recentAuditUrls.length > 0
                            ? "Pick from recent audits"
                            : "No recent audits found"}
                        </option>
                        {recentAuditUrls.map((url) => (
                          <option key={url} value={url}>
                            {url}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
                    </div>
                  </div>

                  {comparisonUrlError && (
                    <p className="text-xs text-white/80">
                      {comparisonUrlError}
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-charcoal p-6 shadow-2xl sm:p-8">
                <div className="flex items-center gap-2">
                  <TrustGraphIcon className="h-4 w-4 text-white/75" />
                  <h2 className="text-lg font-semibold text-white">
                    Tier path
                  </h2>
                </div>
                <div className="mt-5 grid gap-4">
                  {TIER_PATH.map((item) => (
                    <div
                      key={item.tier}
                      className="rounded-2xl border border-white/10 bg-charcoal-deep p-5"
                    >
                      <div className="text-xs uppercase tracking-wide text-white/45">
                        {item.tier}
                      </div>
                      <div className="mt-2 text-sm font-semibold text-white">
                        {item.title}
                      </div>
                      <div className="mt-2 text-xs leading-6 text-white/60">
                        {item.detail}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {comparisonUrl ? (
              <section className="space-y-6">
                <div className="rounded-2xl border border-white/10 bg-charcoal p-5 shadow-2xl sm:p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] uppercase tracking-wide text-emerald-200">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Comparison ready
                      </div>
                      <h3 className="mt-3 text-xl font-semibold text-white">
                        Your baseline is ready for competitor comparison
                      </h3>
                      <p className="mt-2 text-sm leading-7 text-white/65">
                        Current baseline:{" "}
                        <span className="font-medium text-white/85">
                          {comparisonUrl}
                        </span>
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <Link
                        to="/app/reverse-engineer"
                        className="rounded-2xl border border-white/10 bg-charcoal-deep px-4 py-3 text-sm text-white/75 transition-colors hover:text-white"
                      >
                        Reverse Engineer
                      </Link>
                      <Link
                        to="/app/score-fix"
                        className="rounded-2xl border border-white/10 bg-charcoal-deep px-4 py-3 text-sm text-white/75 transition-colors hover:text-white"
                      >
                        Score Fix
                      </Link>
                    </div>
                  </div>
                </div>

                <PlatformProofLoopCard
                  url={comparisonUrl}
                  title="Competitor validation loop"
                  subtitle="Use the same target URL for each competitor run, then re-audit after fixes so movement is attributable and defensible."
                  compact
                />

                <CompetitorManager
                  token={token}
                  comparisonUrl={comparisonUrl}
                  onCompetitorsChange={() => setRefreshKey((k) => k + 1)}
                  onScanComplete={handleCompetitorScanComplete}
                />

                <CompetitorComparison
                  key={`${refreshKey}:${comparisonUrl}`}
                  yourUrl={comparisonUrl}
                  token={token}
                />
              </section>
            ) : (
              <section className="rounded-xl border border-white/10 bg-charcoal p-6 shadow-2xl sm:p-8">
                <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr] lg:items-center">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[11px] uppercase tracking-wide text-amber-200">
                      <Globe className="h-3.5 w-3.5" />
                      Baseline required first
                    </div>
                    <h3 className="mt-4 text-2xl font-semibold text-white">
                      Set your site URL before comparing competitors
                    </h3>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-white/65">
                      Competitor comparison works best when it starts from your
                      real domain baseline. Use your latest audit, select a
                      recent audit, or manually set the exact target URL above.
                    </p>
                    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                      <button
                        onClick={() => navigate("/app/analyze")}
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-white/28 to-white/14 px-6 py-3 font-medium text-white transition-opacity hover:opacity-90"
                        type="button"
                      >
                        Run an audit
                        <ArrowRight className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => navigate("/app")}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-surface-raised px-6 py-3 text-sm text-white/75 transition-colors hover:text-white"
                        type="button"
                      >
                        Go to Dashboard
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-charcoal-deep p-5">
                    <div className="text-xs uppercase tracking-wide text-white/45">
                      Why the baseline comes first
                    </div>
                    <div className="mt-4 space-y-3">
                      {[
                        "Creates a real comparison target for your domain",
                        "Makes competitor gaps more interpretable",
                        "Connects comparison insights to actual fixes",
                      ].map((item) => (
                        <div
                          key={item}
                          className="flex items-start gap-2 text-sm text-white/70"
                        >
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-white/75" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
