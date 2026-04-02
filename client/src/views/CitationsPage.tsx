import React, { useState, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { useAnalysisStore } from "../stores/analysisStore";
import CitationTracker from "../components/CitationTracker";
import NicheRankingPanel from "../components/NicheRankingPanel";
import CitationTrendSparkline from "../components/CitationTrendSparkline";
import CompetitorShareTable from "../components/CompetitorShareTable";
import ConsistencyMatrix from "../components/ConsistencyMatrix";
import DropAlertBanner from "../components/DropAlertBanner";
import CoOccurrencePanel from "../components/CoOccurrencePanel";
import {
  ArrowLeft,
  Eye,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  BarChart3,
  Search,
  Quote,
  TrendingUp,
  ArrowRight,
  Globe,
  Layers3,
  Zap,
  Clock,
  Users,
  FileText,
  RefreshCw,
  AlertTriangle,
  Target,
  Loader2,
} from "lucide-react";
import { meetsMinimumTier } from "@shared/types";
import { usePageMeta } from "../hooks/usePageMeta";
import PlatformProofLoopCard from "../components/PlatformProofLoopCard";
import UpgradeWall from "../components/UpgradeWall";
import { normalizePublicUrlInput } from "../utils/targetKey";

/* ── Tab IDs ─────────────────────────────────────────────────────────────── */
type CitationTab = "engine" | "intelligence" | "automation";

/* ── Static data ─────────────────────────────────────────────────────────── */
const QUICK_STATS = [
  { icon: Search, label: "AI Platforms", value: "4", sublabel: "ChatGPT · Perplexity · Claude · Google AI" },
  { icon: Globe, label: "Web Verification", value: "4", sublabel: "DuckDuckGo + Bing + Brave + DDG Instant" },
  { icon: BarChart3, label: "Queries / Test", value: "20–400", sublabel: "Scaled by tier" },
  { icon: TrendingUp, label: "Trend Window", value: "30d", sublabel: "Rolling mention history" },
];

const WORKFLOW_STEPS = [
  { step: 1, label: "Enter URL", detail: "Paste any URL — queries are generated from page content, entities, and keywords." },
  { step: 2, label: "AI generates queries", detail: "Realistic prompts are built from your audited entity profile and topic signals." },
  { step: 3, label: "Multi-platform test", detail: "Each query runs across 4 AI platforms + 3 web search engines simultaneously." },
  { step: 4, label: "Review & act", detail: "See mention rates, excerpts, competitor presence, and diagnostic fixes." },
];

const AGENCY_FEATURES = [
  { icon: Users, label: "Client query packs", detail: "Save reusable query packs per client, execute them on schedule, and compare results over time." },
  { icon: Clock, label: "Scheduled ranking jobs", detail: "Set recurring niche-ranking tests that run automatically and alert on position drops." },
  { icon: FileText, label: "CSV + evidence exports", detail: "Export full citation test data, evidence panels, and diagnostic reports for client deliverables." },
  { icon: RefreshCw, label: "Before/after validation", detail: "Re-run the same query set after content fixes to prove citation share improvement with evidence." },
  { icon: Target, label: "Niche competitive ranking", detail: "AI-powered competitive positioning scorer that ranks your brand against the top 50–100 in your niche." },
  { icon: AlertTriangle, label: "Drop alert monitoring", detail: "Get notified when mention rate drops ≥15 percentage points. Email alerts included for Signal+." },
];

export default function CitationsPage() {
  const navigate = useNavigate();
  const { token, isAuthenticated, user } = useAuthStore();
  const latestResult = useAnalysisStore((s) => s.result);

  usePageMeta({
    title: "AI Citation Tracker",
    description: "Generate citation queries from any URL and test whether AI platforms like ChatGPT, Perplexity, and Claude mention your brand.",
    path: "/citations",
  });

  React.useEffect(() => {
    if (!isAuthenticated) navigate("/auth?mode=signin");
  }, [isAuthenticated, navigate]);

  const userTier = (user?.tier as any) || "observer";
  const hasAccess = meetsMinimumTier(userTier, "alignment");
  const hasSignal = meetsMinimumTier(userTier, "signal");

  /* URL input state — defaults to latest audited URL if available */
  const defaultUrl = latestResult?.url || "";
  const [urlInput, setUrlInput] = useState(defaultUrl);
  const [activeUrl, setActiveUrl] = useState(defaultUrl);
  const [activeTab, setActiveTab] = useState<CitationTab>("engine");
  const engineRef = useRef<HTMLDivElement>(null);

  const handleUrlSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    const normalized = normalizePublicUrlInput(urlInput.trim());
    if (!normalized) return;
    setActiveUrl(normalized);
    setActiveTab("engine");
    // Scroll to engine section
    setTimeout(() => engineRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  }, [urlInput]);

  React.useEffect(() => {
    if (defaultUrl && !activeUrl) {
      setUrlInput(defaultUrl);
      setActiveUrl(defaultUrl);
    }
  }, [defaultUrl, activeUrl]);

  const TABS: { id: CitationTab; label: string; icon: React.ElementType; minTier: string }[] = [
    { id: "engine", label: "Citation Engine", icon: Zap, minTier: "alignment" },
    { id: "intelligence", label: "Intelligence", icon: BarChart3, minTier: "alignment" },
    { id: "automation", label: "Automation & Agency", icon: Users, minTier: "signal" },
  ];

  return (
    <div className="min-h-screen page-splash-bg flex flex-col bg-[#2e3646] text-white">
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-white/16 to-white dark:bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] dark:from-white/20 dark:via-white/16 dark:to-black" />
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="border-b border-white/10 bg-charcoal-deep">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <button onClick={() => navigate("/")} className="rounded-full p-2 transition-colors hover:bg-charcoal" type="button">
            <ArrowLeft className="h-5 w-5 text-white/55" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 text-lg font-semibold sm:text-xl brand-title">
              <Eye className="h-5 w-5 text-orange-400 shrink-0" />
              AI Citation Tracker
            </h1>
            <p className="text-xs text-white/55 sm:text-sm">Generate citation queries from any URL and test where AI platforms mention you.</p>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-charcoal px-3 py-1 text-[11px] uppercase tracking-wide text-white/60">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {userTier}
          </span>
        </div>
      </header>

      <main className="mx-auto flex-1 w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* ── Hero: URL input ────────────────────────────────────────────── */}
        <section className="brand-bar-top rounded-2xl border border-white/10 bg-gradient-to-br from-white/8 via-charcoal to-charcoal-deep p-5 shadow-2xl sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-8">
            <div className="flex-1 min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-charcoal-deep px-3 py-1 text-[10px] uppercase tracking-wide text-white/60">
                <Sparkles className="h-3 w-3" />
                Content-aware citation engine
              </div>
              <h2 className="mt-3 text-2xl font-bold leading-tight sm:text-3xl brand-title">
                Enter any URL to generate citation queries
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/55">
                Queries are generated from the page's actual content, entities, keywords, and structure — not generic templates. Each URL produces a unique set of realistic AI-answer prompts.
              </p>

              <form onSubmit={handleUrlSubmit} className="mt-5">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative flex-1">
                    <Globe className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                    <input
                      type="url"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="https://example.com/your-page"
                      enterKeyHint="go"
                      className="field-vivid w-full pl-10 pr-4 py-3 rounded-xl border border-white/12 text-white text-sm placeholder-white/40"
                      autoComplete="url"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!urlInput.trim() || !hasAccess}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-white/25 to-white/12 px-5 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40 shrink-0"
                  >
                    <Search className="h-4 w-4" />
                    <span className="hidden sm:inline">Generate Queries</span>
                    <span className="sm:hidden">Go</span>
                  </button>
                </div>
                {defaultUrl && urlInput !== defaultUrl && (
                  <button
                    type="button"
                    onClick={() => { setUrlInput(defaultUrl); setActiveUrl(defaultUrl); }}
                    className="mt-2 text-xs text-cyan-400/70 hover:text-cyan-300 transition-colors"
                  >
                    ← Use latest audited URL: {defaultUrl}
                  </button>
                )}
              </form>
            </div>

            {/* Quick stats sidebar */}
            <div className="grid grid-cols-2 gap-2 lg:w-72 lg:shrink-0">
              {QUICK_STATS.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className="rounded-xl border border-white/8 bg-charcoal-deep/60 p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon className="h-3 w-3 text-white/50" />
                      <span className="text-[10px] uppercase tracking-wide text-white/45">{stat.label}</span>
                    </div>
                    <div className="text-lg font-bold text-white/90 leading-none">{stat.value}</div>
                    <div className="text-[10px] text-white/40 mt-0.5 leading-tight">{stat.sublabel}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Workflow steps — collapsed on mobile */}
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {WORKFLOW_STEPS.map((item) => (
              <div key={item.step} className="flex items-start gap-2 rounded-xl border border-white/6 bg-charcoal/40 p-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/15 text-[10px] font-bold text-white/60">{item.step}</span>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-white/80">{item.label}</div>
                  <div className="text-[10px] leading-relaxed text-white/45 hidden sm:block">{item.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Upgrade wall for observer ──────────────────────────────────── */}
        {!hasAccess && (
          <div className="mt-6">
            <UpgradeWall
              feature="Citation & Authority Testing"
              description="Test whether AI platforms cite your brand and track mention quality across ChatGPT, Perplexity, and Claude."
              requiredTier="alignment"
              icon={<Quote className="w-12 h-12 text-white/80" />}
              featurePreview={[
                "Live query testing across ChatGPT, Perplexity, Claude, and Gemini",
                "Citation rate %, mention context, and citation strength per platform",
                "Drop alerts when your mention rate falls ≥15 percentage points",
              ]}
            />
          </div>
        )}

        {/* ── Tab navigation ─────────────────────────────────────────────── */}
        {hasAccess && activeUrl && (
          <>
            <div className="mt-6 flex items-center gap-1 overflow-x-auto rounded-xl border border-white/8 bg-charcoal-deep p-1">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const locked = !meetsMinimumTier(userTier, tab.minTier as any);
                return (
                  <button
                    key={tab.id}
                    onClick={() => !locked && setActiveTab(tab.id)}
                    className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-medium transition-colors shrink-0 ${
                      activeTab === tab.id
                        ? "bg-white/10 text-white"
                        : locked
                          ? "text-white/30 cursor-not-allowed"
                          : "text-white/55 hover:text-white/80 hover:bg-white/5"
                    }`}
                    type="button"
                    disabled={locked}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {tab.label}
                    {locked && <span className="text-[9px] uppercase tracking-wider text-white/25 ml-1">Signal+</span>}
                  </button>
                );
              })}
            </div>

            {/* Active target pill */}
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/8 bg-charcoal-deep/50 px-4 py-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span className="text-xs text-white/55">Active target:</span>
              <span className="text-xs font-medium text-white/85 truncate">{activeUrl}</span>
              <button
                type="button"
                onClick={() => { setActiveUrl(""); setUrlInput(""); }}
                className="ml-auto text-[10px] text-white/40 hover:text-white/70 transition-colors shrink-0"
              >
                Change
              </button>
            </div>

            {/* ── Tab: Citation Engine ──────────────────────────────────── */}
            {activeTab === "engine" && (
              <div ref={engineRef} className="mt-4 space-y-4">
                <CitationTracker url={activeUrl} token={token} userTier={userTier} />

                <PlatformProofLoopCard
                  url={activeUrl}
                  title="Citation validation loop"
                  subtitle="Run citation tests before and after remediation to verify mention-share movement with evidence."
                  compact
                />
              </div>
            )}

            {/* ── Tab: Intelligence ────────────────────────────────────── */}
            {activeTab === "intelligence" && (
              <div className="mt-4 space-y-4">
                <DropAlertBanner url={activeUrl} />

                <div className="grid gap-4 lg:grid-cols-2">
                  <CitationTrendSparkline url={activeUrl} />
                  <CompetitorShareTable url={activeUrl} />
                </div>

                <ConsistencyMatrix url={activeUrl} />

                {hasSignal && <CoOccurrencePanel url={activeUrl} />}

                {!hasSignal && (
                  <div className="rounded-2xl border border-white/8 bg-charcoal-deep p-5 text-center">
                    <p className="text-sm text-white/55">Co-occurrence scanning and niche ranking require <strong className="text-white/80">Signal</strong> tier.</p>
                    <Link to="/pricing" className="mt-2 inline-flex items-center gap-1 text-xs text-cyan-400/70 hover:text-cyan-300">
                      View plans <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* ── Tab: Automation & Agency ──────────────────────────────── */}
            {activeTab === "automation" && (
              <div className="mt-4 space-y-5">
                {/* Agency features overview */}
                <section className="rounded-2xl border border-white/10 bg-charcoal p-5 sm:p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Zap className="h-4 w-4 text-amber-400" />
                    <h3 className="text-base font-semibold text-white">Agency & automation toolkit</h3>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {AGENCY_FEATURES.map((item) => {
                      const Icon = item.icon;
                      return (
                        <div key={item.label} className="rounded-xl border border-white/8 bg-charcoal-deep p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Icon className="h-4 w-4 text-white/60" />
                            <span className="text-sm font-medium text-white/85">{item.label}</span>
                          </div>
                          <p className="text-xs leading-relaxed text-white/50">{item.detail}</p>
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* Niche ranking — the main automation tool */}
                <NicheRankingPanel targetUrl={activeUrl} showScheduler={true} />
              </div>
            )}
          </>
        )}

        {/* ── No URL selected prompt (when access but no URL) ────────── */}
        {hasAccess && !activeUrl && (
          <section className="mt-6 rounded-2xl border border-white/10 bg-charcoal p-6 shadow-2xl sm:p-8 text-center">
            <Globe className="h-10 w-10 text-white/30 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-white">Enter a URL above to begin</h3>
            <p className="mt-2 max-w-md mx-auto text-sm text-white/55">
              Citation queries are uniquely generated from each URL's content, entities, and structural signals. Paste any URL to start.
            </p>
            {defaultUrl && (
              <button
                type="button"
                onClick={() => { setUrlInput(defaultUrl); setActiveUrl(defaultUrl); }}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-white/20 to-white/10 px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                <ArrowRight className="h-4 w-4" />
                Use latest audited URL
              </button>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
