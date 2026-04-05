// client/src/views/KeywordsPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAnalysisStore } from "../stores/analysisStore";
import { useAuthStore } from "../stores/authStore";
import type { KeywordIntelligence } from "../../../shared/types";
import {
  ArrowLeft,
  Search,
  TrendingUp,
  TrendingDown,
  Minus,
  Star,
  Download,
  Target,
  ChevronDown,
  Sparkles,
  Globe,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  ChevronRight,
} from "lucide-react";
import { appInputSurfaceClass, appSelectSurfaceClass } from "../lib/formStyles";
import { usePageMeta } from "../hooks/usePageMeta";
import apiFetch from "../utils/api";

// ─── UI config ────────────────────────────────────────────────────────────────

const INTENT_CONFIG = {
  informational: { label: "Informational", color: "bg-blue-500/15 text-blue-300 border-blue-400/25" },
  commercial:    { label: "Commercial",    color: "bg-emerald-500/15 text-emerald-300 border-emerald-400/25" },
  navigational:  { label: "Navigational",  color: "bg-violet-500/15 text-violet-300 border-violet-400/25" },
  transactional: { label: "Transactional", color: "bg-amber-500/15 text-amber-300 border-amber-400/25" },
};

const VOLUME_CONFIG = {
  low:       { label: "< 1K/mo",     color: "text-white/50" },
  medium:    { label: "1K–10K/mo",   color: "text-cyan-300" },
  high:      { label: "10K–100K/mo", color: "text-amber-300" },
  very_high: { label: "100K+/mo",    color: "text-orange-300 font-semibold" },
};

const COMPETITION_CONFIG = {
  low:    { label: "Low",    dot: "bg-emerald-400" },
  medium: { label: "Medium", dot: "bg-amber-400" },
  high:   { label: "High",   dot: "bg-rose-400" },
};

function TrendIcon({ trend }: { trend: KeywordIntelligence["trend"] }) {
  if (trend === "rising")    return <TrendingUp   className="w-4 h-4 text-emerald-400" />;
  if (trend === "declining") return <TrendingDown className="w-4 h-4 text-rose-400" />;
  return <Minus className="w-4 h-4 text-white/40" />;
}

function OpportunityBar({ score }: { score: number }) {
  const color = score >= 70 ? "bg-emerald-400" : score >= 40 ? "bg-amber-400" : "bg-rose-400";
  return (
    <div className="flex items-center gap-2 w-full min-w-[100px]">
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-xs w-7 text-right shrink-0 ${score >= 70 ? "text-emerald-300" : score >= 40 ? "text-amber-300" : "text-rose-300"}`}>{score}</span>
    </div>
  );
}

type IntentFilter = "all" | KeywordIntelligence["intent"];
type SortKey = "opportunity" | "volume" | "competition" | "keyword";
type OpportunityFilter = "all" | "40" | "70";
type PlanStatus = "todo" | "in-progress" | "published";

interface KeywordPlan {
  targetUrl?: string;
  status: PlanStatus;
  updatedAt: string;
}

const VOLUME_ORDER   = { low: 0, medium: 1, high: 2, very_high: 3 } as const;
const COMP_ORDER     = { low: 0, medium: 1, high: 2 } as const;

interface EnrichedKeyword {
  keyword: string;
  search_verified: boolean;
  real_suggestions: string[];
  related_queries: string[];
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function KeywordsPage() {
  const navigate  = useNavigate();
  const { history } = useAnalysisStore();
  const { isAuthenticated } = useAuthStore();

  usePageMeta({
    title: 'Keywords',
    description: 'Keyword intelligence and intent analysis from your AI visibility audits.',
    path: '/keywords',
  });

  // Redirect to auth if not authenticated
  React.useEffect(() => {
    if (!isAuthenticated) {
      navigate("/auth?mode=signin");
    }
  }, [isAuthenticated, navigate]);

  // ─── Fetch keywords from server audits ────────────────────────────────────
  const [serverHosts, setServerHosts] = useState<Record<string, { keywords: any[]; auditCount: number; latestUrl: string }>>({});

  useEffect(() => {
    if (!isAuthenticated) return;
    apiFetch('/api/keywords/from-audits')
      .then(r => r.json())
      .then(d => { if (d.success && d.hosts) setServerHosts(d.hosts); })
      .catch(() => {});
  }, [isAuthenticated]);

  // ─── Build per-host keyword map from local history + server audits ────────
  const hostMap = useMemo(() => {
    const map = new Map<string, { keywords: Map<string, KeywordIntelligence>; latestUrl: string; auditCount: number; latestTimestamp: number }>();
    for (const entry of history) {
      if (!entry.result?.keyword_intelligence?.length) continue;
      let host: string;
      try { host = new URL(entry.result.url).hostname; } catch { continue; }
      if (!map.has(host)) map.set(host, { keywords: new Map(), latestUrl: entry.result.url, auditCount: 0, latestTimestamp: 0 });
      const record = map.get(host)!;
      record.auditCount++;
      const ts = entry.timestamp || 0;
      if (ts > record.latestTimestamp) { record.latestTimestamp = ts; record.latestUrl = entry.result.url; }
      for (const kw of entry.result.keyword_intelligence) {
        if (!record.keywords.has(kw.keyword) || ts > record.latestTimestamp) {
          record.keywords.set(kw.keyword, kw);
        }
      }
    }
    // Merge server-side keywords (fills gaps for audits not in localStorage)
    for (const [host, data] of Object.entries(serverHosts)) {
      if (!map.has(host)) {
        map.set(host, { keywords: new Map(), latestUrl: data.latestUrl, auditCount: data.auditCount, latestTimestamp: 0 });
      }
      const record = map.get(host)!;
      record.auditCount = Math.max(record.auditCount, data.auditCount);
      for (const kw of data.keywords) {
        if (!record.keywords.has(kw.keyword)) {
          record.keywords.set(kw.keyword, kw);
        }
      }
    }
    return map;
  }, [history, serverHosts]);

  const availableHosts = useMemo(() => [...hostMap.keys()].sort(), [hostMap]);
  const [selectedHost, setSelectedHost] = useState<string>("");
  const [showHostDropdown, setShowHostDropdown] = useState(false);

  // Auto-select first available host
  useEffect(() => {
    if (!selectedHost && availableHosts.length > 0) setSelectedHost(availableHosts[0]);
    if (selectedHost && !availableHosts.includes(selectedHost) && availableHosts.length > 0) setSelectedHost(availableHosts[0]);
  }, [availableHosts, selectedHost]);

  const hostData = hostMap.get(selectedHost);

  const keywords: KeywordIntelligence[] = useMemo(() => {
    if (!hostData) return [];
    return [...hostData.keywords.values()];
  }, [hostData]);

  // Count keywords that only appeared in the latest audit for this host
  const newKeywordCount = useMemo(() => {
    if (!selectedHost || !history.length) return 0;
    // Find the two most recent audits for this host
    const hostAudits = history
      .filter((e) => { try { return new URL(e.result?.url || "").hostname === selectedHost; } catch { return false; } })
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    if (hostAudits.length < 2) return keywords.length; // All are "new" if first audit
    const latestKws = new Set((hostAudits[0].result?.keyword_intelligence || []).map((k) => k.keyword));
    const prevKws = new Set((hostAudits[1].result?.keyword_intelligence || []).map((k) => k.keyword));
    let count = 0;
    latestKws.forEach((kw) => { if (!prevKws.has(kw)) count++; });
    return count;
  }, [selectedHost, history, keywords.length]);

  const hasData = keywords.length > 0;
  const activeHost = selectedHost || "global";
  const starStorageKey = `aivis.keywordStars.${activeHost}`;
  const planStorageKey = `aivis.keywordPlans.${activeHost}`;

  const [search,       setSearch]       = useState("");
  const [intentFilter, setIntentFilter] = useState<IntentFilter>("all");
  const [opportunityFilter, setOpportunityFilter] = useState<OpportunityFilter>("all");
  const [sortKey,      setSortKey]      = useState<SortKey>("opportunity");
  const [sortDir,      setSortDir]      = useState<"asc" | "desc">("desc");
  const [starred,      setStarred]      = useState<Set<string>>(new Set());
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const [keywordPlans, setKeywordPlans] = useState<Record<string, KeywordPlan>>({});

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(starStorageKey);
      if (!raw) {
        setStarred(new Set());
        return;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setStarred(new Set(parsed.filter((item) => typeof item === "string")));
      }
    } catch {
      setStarred(new Set());
    }
  }, [starStorageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(starStorageKey, JSON.stringify(Array.from(starred)));
    } catch {
      // no-op
    }
  }, [starStorageKey, starred]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(planStorageKey);
      if (!raw) {
        setKeywordPlans({});
        return;
      }
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        setKeywordPlans(parsed as Record<string, KeywordPlan>);
      }
    } catch {
      setKeywordPlans({});
    }
  }, [planStorageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(planStorageKey, JSON.stringify(keywordPlans));
    } catch {
      // no-op
    }
  }, [planStorageKey, keywordPlans]);

  // ─── Keyword enrichment (real search verification) ────────────────────────
  const [enrichmentMap, setEnrichmentMap] = useState<Map<string, EnrichedKeyword>>(new Map());
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const [expandedEnrich, setExpandedEnrich] = useState<string | null>(null);

  const enrichKeywords = async () => {
    if (!keywords.length || isEnriching) return;
    setIsEnriching(true);
    setEnrichError(null);
    try {
      const kwStrings = keywords.map(k => k.keyword).slice(0, 20);
      const res = await apiFetch('/api/keywords/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: kwStrings }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.enriched)) {
        const map = new Map<string, EnrichedKeyword>();
        for (const ek of data.enriched) {
          map.set(ek.keyword.toLowerCase(), ek);
        }
        setEnrichmentMap(map);
      } else {
        setEnrichError(data.error || 'Enrichment failed');
      }
    } catch {
      setEnrichError('Failed to verify keywords');
    } finally {
      setIsEnriching(false);
    }
  };

  const hasEnrichment = enrichmentMap.size > 0;
  const verifiedCount = hasEnrichment ? [...enrichmentMap.values()].filter(e => e.search_verified).length : 0;

  const toggleStar = (kw: string) =>
    setStarred((prev) => {
      const next = new Set(prev);
      next.has(kw) ? next.delete(kw) : next.add(kw);
      return next;
    });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const updateKeywordPlan = (keyword: string, patch: Partial<KeywordPlan>) => {
    setKeywordPlans((prev) => ({
      ...prev,
      [keyword]: {
        status: prev[keyword]?.status || "todo",
        ...prev[keyword],
        ...patch,
        updatedAt: new Date().toISOString(),
      },
    }));
  };

  const filtered: KeywordIntelligence[] = useMemo(() => {
    let list = [...keywords];
    if (intentFilter !== "all") list = list.filter((k) => k.intent === intentFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((k) => k.keyword.toLowerCase().includes(q));
    }
    if (showStarredOnly) {
      list = list.filter((k) => starred.has(k.keyword));
    }
    if (opportunityFilter !== "all") {
      const threshold = Number(opportunityFilter);
      list = list.filter((k) => (k.opportunity ?? 0) >= threshold);
    }
    list.sort((a, b) => {
      let diff = 0;
      if (sortKey === "opportunity")  diff = (a.opportunity ?? 0) - (b.opportunity ?? 0);
      else if (sortKey === "volume")  diff = (VOLUME_ORDER[a.volume_tier] ?? 0) - (VOLUME_ORDER[b.volume_tier] ?? 0);
      else if (sortKey === "competition") diff = (COMP_ORDER[a.competition] ?? 0) - (COMP_ORDER[b.competition] ?? 0);
      else diff = a.keyword.localeCompare(b.keyword);
      return sortDir === "desc" ? -diff : diff;
    });
    return list;
  }, [keywords, intentFilter, search, sortKey, sortDir, showStarredOnly, starred, opportunityFilter]);

  const exportCSV = () => {
    if (!filtered.length) return;
    const header = "Keyword,Intent,Volume Tier,Competition,Opportunity,Trend";
    const rows = filtered.map(
      (k) => `"${k.keyword}",${k.intent},${k.volume_tier},${k.competition},${k.opportunity},${k.trend}`
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `keywords-${activeHost}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const counts = useMemo(() => {
    const c = { all: keywords.length, informational: 0, commercial: 0, navigational: 0, transactional: 0 };
    keywords.forEach((k) => { (c as any)[k.intent] = ((c as any)[k.intent] || 0) + 1; });
    return c;
  }, [keywords]);

  const avgOpportunity  = keywords.length ? Math.round(keywords.reduce((s, k) => s + k.opportunity, 0) / keywords.length) : 0;
  const risingCount     = keywords.filter((k) => k.trend === "rising").length;
  const highVolumeCount = keywords.filter((k) => k.volume_tier === "high" || k.volume_tier === "very_high").length;
  const starredCount = keywords.filter((k) => starred.has(k.keyword)).length;
  const topOpportunityKeyword = useMemo(() => {
    if (!keywords.length) return null;
    return [...keywords].sort((a, b) => (b.opportunity ?? 0) - (a.opportunity ?? 0))[0] || null;
  }, [keywords]);

  const executionQueue = useMemo(() => {
    const rankScore = (keyword: KeywordIntelligence) => {
      const intentBoost = keyword.intent === "transactional" || keyword.intent === "commercial" ? 8 : 4;
      const trendBoost = keyword.trend === "rising" ? 14 : keyword.trend === "stable" ? 5 : 0;
      const competitionBoost = keyword.competition === "low" ? 12 : keyword.competition === "medium" ? 6 : 0;
      return (keyword.opportunity ?? 0) + intentBoost + trendBoost + competitionBoost;
    };

    return [...keywords]
      .map((keyword) => ({ keyword, rankScore: rankScore(keyword), plan: keywordPlans[keyword.keyword] }))
      .sort((a, b) => b.rankScore - a.rankScore)
      .slice(0, 6);
  }, [keywords, keywordPlans]);

  const completedPlans = useMemo(
    () => Object.values(keywordPlans).filter((plan) => plan.status === "published").length,
    [keywordPlans]
  );

  const applyQuickFocus = (mode: "winners" | "rising" | "starred") => {
    if (mode === "winners") {
      setOpportunityFilter("70");
      setSortKey("opportunity");
      setSortDir("desc");
      setIntentFilter("all");
      setShowStarredOnly(false);
      return;
    }
    if (mode === "rising") {
      setSearch("");
      setSortKey("opportunity");
      setSortDir("desc");
      return;
    }

    setShowStarredOnly(true);
    setSortKey("keyword");
    setSortDir("asc");
  };

  const SortHeader = ({ label, col }: { label: string; col: SortKey }) => (
    <button
      onClick={() => toggleSort(col)}
      className={`flex items-center gap-1 text-xs font-medium uppercase tracking-wide transition-colors whitespace-nowrap ${
        sortKey === col ? "text-white/85" : "text-white/60 hover:text-white/75"
      }`}
      type="button"
    >
      {label}
      {sortKey === col && <span className="text-[10px]">{sortDir === "desc" ? "↓" : "↑"}</span>}
    </button>
  );

  return (
    <div className="space-y-6">

      {/* Heading + export */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white flex items-center gap-2">
            <Target className="w-5 h-5 text-slate-400" />
            Keywords
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {hasData
              ? `${keywords.length} keywords aggregated from ${hostData?.auditCount ?? 1} audit${(hostData?.auditCount ?? 1) > 1 ? "s" : ""}`
              : "AI-extracted topical keyword signals from your audits"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!hasData && history.length > 0 && (
            <span className="text-xs text-slate-500 hidden sm:inline">Re-run analysis for keyword data</span>
          )}
          <button
            onClick={exportCSV}
            disabled={!filtered.length}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.06] border border-white/10 hover:bg-white/[0.10] text-white/75 text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            type="button"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Empty state */}
        {!history.length && (
          <div className="text-center py-20">
            <Target className="w-14 h-14 text-slate-600 mx-auto mb-4" />
            <p className="text-white text-lg font-medium">No analysis yet</p>
            <p className="text-slate-400 text-sm mt-2 mb-6">Run an analysis on your website to discover your topical keywords.</p>
            <button onClick={() => navigate("/app/analyze")} className="px-6 py-2.5 bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500/20 text-cyan-400 rounded-lg text-sm font-medium transition-colors" type="button">
              Analyze a Website
            </button>
          </div>
        )}

        {history.length > 0 && (
          <>
            {/* Site selector + new keyword badge */}
            {availableHosts.length > 0 && (
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative">
                  <button
                    onClick={() => setShowHostDropdown((v) => !v)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/12 bg-white/5 hover:bg-white/8 transition-colors text-sm text-white"
                    type="button"
                  >
                    <Globe className="w-4 h-4 text-cyan-400" />
                    {selectedHost || "Select site"}
                    <ChevronDown className={`w-4 h-4 text-white/50 transition-transform ${showHostDropdown ? "rotate-180" : ""}`} />
                  </button>
                  {showHostDropdown && (
                    <div className="absolute top-full mt-1 left-0 z-50 min-w-[220px] rounded-xl border border-white/12 bg-[#151a2a] shadow-2xl py-1 max-h-60 overflow-y-auto">
                      {availableHosts.map((host) => {
                        const hd = hostMap.get(host);
                        return (
                          <button
                            key={host}
                            onClick={() => { setSelectedHost(host); setShowHostDropdown(false); }}
                            className={`w-full text-left px-4 py-2.5 text-sm hover:bg-white/8 transition-colors flex items-center justify-between gap-3 ${
                              host === selectedHost ? "text-cyan-300 bg-cyan-500/8" : "text-white/80"
                            }`}
                            type="button"
                          >
                            <span className="truncate">{host}</span>
                            <span className="text-xs text-white/40 shrink-0">{hd?.keywords.size ?? 0} kw · {hd?.auditCount ?? 0} audits</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                {newKeywordCount > 0 && hostData && hostData.auditCount > 1 && (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/12 border border-emerald-400/20 text-xs text-emerald-300">
                    <Sparkles className="w-3.5 h-3.5" />
                    {newKeywordCount} new since last audit
                  </span>
                )}
                {hostData && (
                  <span className="text-xs text-white/40">{hostData.auditCount} audit{hostData.auditCount > 1 ? "s" : ""} analyzed</span>
                )}
              </div>
            )}

            {/* No keyword data notice */}
            {!hasData && (
              <div className="text-center py-16">
                <Target className="w-12 h-12 text-white/80 mx-auto mb-4" />
                <p className="text-white/75 text-lg font-medium">No keyword intelligence yet</p>
                <p className="text-white/60 text-sm mt-2 mb-6 max-w-md mx-auto">
                  Your audits didn't include keyword intelligence data. Run a new analysis to discover AI-identified keywords with intent, volume, and opportunity scoring.
                </p>
                <button onClick={() => navigate("/")} className="px-6 py-2.5 bg-charcoal hover:bg-charcoal text-white rounded-full text-sm font-medium transition-colors" type="button">
                  Run New Analysis
                </button>
              </div>
            )}

            {hasData && (
            <>
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              {[
                { label: "Keywords", value: keywords.length, color: "text-white" },
                { label: "Avg Opportunity", value: avgOpportunity, color: avgOpportunity >= 60 ? "text-emerald-300" : avgOpportunity >= 40 ? "text-amber-300" : "text-rose-300" },
                { label: "Rising Trends", value: risingCount, color: risingCount > 0 ? "text-emerald-300" : "text-white/50" },
                { label: hasEnrichment ? "Search Verified" : "High Volume", value: hasEnrichment ? verifiedCount : highVolumeCount, color: hasEnrichment ? (verifiedCount > 0 ? "text-cyan-300" : "text-white/50") : (highVolumeCount > 0 ? "text-amber-300" : "text-white/50") },
                { label: "Starred", value: starredCount, color: starredCount > 0 ? "text-yellow-300" : "text-white/50" },
              ].map(({ label, value, color }) => (
                <div key={label} className="card-charcoal/50 rounded-xl p-4">
                  <p className="text-white/55 text-xs uppercase tracking-wide mb-1">{label}</p>
                  <p className={`text-2xl font-bold ${color}`}>{value}</p>
                </div>
              ))}
            </div>

            {/* Keyword enrichment / verification */}
            <div className="rounded-2xl border border-white/10 bg-charcoal-deep/60 p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h3 className="text-sm font-medium text-white flex items-center gap-2">
                    <Search className="w-4 h-4 text-cyan-400" />
                    Real Search Verification
                  </h3>
                  <p className="text-xs text-white/55 mt-1">
                    {hasEnrichment
                      ? `${verifiedCount} of ${enrichmentMap.size} keywords match real search engine suggestions`
                      : "Verify audit keywords against DuckDuckGo & Bing autocomplete to confirm real search demand"}
                  </p>
                </div>
                <button
                  onClick={enrichKeywords}
                  disabled={isEnriching || !keywords.length}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/25 hover:bg-cyan-500/20 text-cyan-300 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  type="button"
                >
                  {isEnriching ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</>
                  ) : hasEnrichment ? (
                    <><RefreshCw className="w-4 h-4" /> Re-verify</>
                  ) : (
                    <><CheckCircle className="w-4 h-4" /> Verify Keywords</>
                  )}
                </button>
              </div>
              {enrichError && (
                <p className="text-xs text-rose-400 mt-2">{enrichError}</p>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-charcoal-deep p-5">
              <div className="flex items-center justify-between mb-4 gap-3">
                <div>
                  <h3 className="text-sm brand-title-muted">Keyword Execution Queue</h3>
                  <p className="text-xs text-white/60">Prioritized by opportunity, trend, intent, and competition</p>
                </div>
                <span className="text-xs text-white/70 bg-charcoal px-2.5 py-1 rounded-full">
                  Published: {completedPlans}
                </span>
              </div>

              <div className="space-y-3">
                {executionQueue.map(({ keyword, rankScore, plan }) => (
                  <div key={`queue-${keyword.keyword}`} className="rounded-xl border border-white/10 bg-charcoal p-3">
                    <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{keyword.keyword}</p>
                        <p className="text-xs text-white/60 mt-1">
                          Priority {Math.round(rankScore)} • {INTENT_CONFIG[keyword.intent].label} • Opportunity {keyword.opportunity}
                        </p>
                      </div>

                      <input
                        value={plan?.targetUrl || ""}
                        onChange={(e) => updateKeywordPlan(keyword.keyword, { targetUrl: e.target.value })}
                        placeholder="Target page URL"
                        className={`w-full lg:w-[280px] px-3 py-2 rounded-lg text-xs text-white/85 ${appInputSurfaceClass}`}
                      />

                      <select
                        value={plan?.status || "todo"}
                        onChange={(e) => updateKeywordPlan(keyword.keyword, { status: e.target.value as PlanStatus })}
                        className={`px-3 py-2 rounded-lg text-xs ${appSelectSurfaceClass}`}
                      >
                        <option value="todo">To Do</option>
                        <option value="in-progress">In Progress</option>
                        <option value="published">Published</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <button
                onClick={() => applyQuickFocus("winners")}
                type="button"
                className="rounded-xl border border-white/10 bg-gradient-to-br from-white/12 via-charcoal to-charcoal p-4 text-left hover:border-white/20 transition-colors"
              >
                <p className="text-xs uppercase tracking-wide text-white/60">Focus</p>
                <p className="text-sm font-semibold text-white mt-1">Top Opportunity Keywords</p>
                <p className="text-xs text-white/60 mt-1">Show keywords with opportunity 70+</p>
              </button>
              <button
                onClick={() => applyQuickFocus("starred")}
                type="button"
                className="rounded-xl border border-white/10 bg-gradient-to-br from-white/12 via-charcoal to-charcoal p-4 text-left hover:border-white/20 transition-colors"
              >
                <p className="text-xs uppercase tracking-wide text-white/60">Workflow</p>
                <p className="text-sm font-semibold text-white mt-1">Review Starred Keywords</p>
                <p className="text-xs text-white/60 mt-1">Prioritize saved targets for content updates</p>
              </button>
              <button
                onClick={() => applyQuickFocus("rising")}
                type="button"
                className="rounded-xl border border-white/10 bg-gradient-to-br from-white/12 via-charcoal to-charcoal p-4 text-left hover:border-white/20 transition-colors"
              >
                <p className="text-xs uppercase tracking-wide text-white/60">Trend Focus</p>
                <p className="text-sm font-semibold text-white mt-1 truncate">
                  {topOpportunityKeyword?.keyword || "Rising Opportunities"}
                </p>
                <p className="text-xs text-white/60 mt-1">
                  Sort by opportunity and prioritize rising trends
                </p>
              </button>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter keywords..."
                  className={`w-full pl-9 pr-3 py-2 rounded-lg text-sm text-white/85 ${appInputSurfaceClass}`}
                />
              </div>

              <div className="flex bg-charcoal rounded-lg p-1 gap-0.5 flex-wrap">
                {(["all", "informational", "commercial", "navigational", "transactional"] as const).map((intent) => (
                  <button
                    key={intent}
                    onClick={() => setIntentFilter(intent)}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-medium capitalize transition-all whitespace-nowrap ${
                      intentFilter === intent
                        ? "bg-charcoal/20 text-white/85 border border-white/12/30"
                        : "text-white/55 hover:text-white"
                    }`}
                    type="button"
                  >
                    {intent === "all" ? `All (${counts.all})` : `${intent.slice(0, 4)}. (${(counts as any)[intent]})`}
                  </button>
                ))}
              </div>

              <div className="flex bg-charcoal rounded-lg p-1 gap-0.5 flex-wrap">
                {([
                  { label: "All", value: "all" },
                  { label: "40+", value: "40" },
                  { label: "70+", value: "70" },
                ] as const).map((item) => (
                  <button
                    key={item.value}
                    onClick={() => setOpportunityFilter(item.value)}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                      opportunityFilter === item.value
                        ? "bg-charcoal/20 text-white/85 border border-white/12/30"
                        : "text-white/55 hover:text-white"
                    }`}
                    type="button"
                  >
                    Opp {item.label}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setShowStarredOnly((v) => !v)}
                className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                  showStarredOnly
                    ? "border-white/12/30 bg-charcoal/20 text-white/85"
                    : "border-white/10 bg-charcoal text-white/60 hover:text-white"
                }`}
                type="button"
              >
                Starred only
              </button>
            </div>

            {/* Table */}
            <div className="card-charcoal/50 rounded-2xl overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b border-white/10 bg-charcoal">
                    <th className="text-left px-5 py-3"><SortHeader label="Keyword" col="keyword" /></th>
                    <th className="text-left px-4 py-3"><span className="text-xs font-medium uppercase tracking-wide text-white/60">Intent</span></th>
                    <th className="text-left px-4 py-3"><SortHeader label="Volume" col="volume" /></th>
                    <th className="text-left px-4 py-3"><SortHeader label="Competition" col="competition" /></th>
                    <th className="text-left px-4 py-3 w-40"><SortHeader label="Opportunity" col="opportunity" /></th>
                    <th className="text-left px-4 py-3"><span className="text-xs font-medium uppercase tracking-wide text-white/60">Trend</span></th>
                    {hasEnrichment && (
                      <th className="text-left px-4 py-3"><span className="text-xs font-medium uppercase tracking-wide text-white/60">Verified</span></th>
                    )}
                    <th className="px-4 py-3 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/20">
                  {filtered.map((kw) => {
                    const ic = INTENT_CONFIG[kw.intent];
                    const vc = VOLUME_CONFIG[kw.volume_tier];
                    const cc = COMPETITION_CONFIG[kw.competition];
                    const isStarred = starred.has(kw.keyword);
                    const enrichData = enrichmentMap.get(kw.keyword.toLowerCase());
                    const isExpanded = expandedEnrich === kw.keyword;
                    return (
                      <React.Fragment key={kw.keyword}>
                      <tr className="hover:bg-charcoal transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            {hasEnrichment && enrichData?.real_suggestions?.length ? (
                              <button
                                onClick={() => setExpandedEnrich(isExpanded ? null : kw.keyword)}
                                className="text-white/40 hover:text-white/70 transition-colors"
                                type="button"
                                title="Show real search suggestions"
                              >
                                <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                              </button>
                            ) : null}
                            <span className="text-sm font-medium text-white">{kw.keyword}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full border whitespace-nowrap ${ic.color}`}>{ic.label}</span>
                        </td>
                        <td className={`px-4 py-3.5 text-xs font-medium whitespace-nowrap ${vc.color}`}>{vc.label}</td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cc.dot}`} />
                            <span className="text-xs text-white/55">{cc.label}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5"><OpportunityBar score={kw.opportunity} /></td>
                        <td className="px-4 py-3.5"><TrendIcon trend={kw.trend} /></td>
                        {hasEnrichment && (
                          <td className="px-4 py-3.5">
                            {enrichData ? (
                              enrichData.search_verified ? (
                                <span className="flex items-center gap-1 text-xs text-emerald-300" title="Matches real search engine autocomplete">
                                  <CheckCircle className="w-3.5 h-3.5" /> Real
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-xs text-white/35" title="Not found in search autocomplete">
                                  <XCircle className="w-3.5 h-3.5" /> Unverified
                                </span>
                              )
                            ) : (
                              <span className="text-xs text-white/25">-</span>
                            )}
                          </td>
                        )}
                        <td className="px-4 py-3.5 text-center">
                          <button
                            onClick={() => toggleStar(kw.keyword)}
                            className={`transition-colors ${isStarred ? "text-white/80" : "text-white/70 hover:text-white/55"}`}
                            type="button"
                            title={isStarred ? "Unstar" : "Star keyword"}
                          >
                            <Star className="w-4 h-4" fill={isStarred ? "currentColor" : "none"} />
                          </button>
                        </td>
                      </tr>
                      {isExpanded && enrichData && (enrichData.real_suggestions.length > 0 || enrichData.related_queries.length > 0) && (
                        <tr className="bg-charcoal-deep/40">
                          <td colSpan={hasEnrichment ? 8 : 7} className="px-5 py-3">
                            <div className="space-y-2 pl-5">
                              {enrichData.related_queries.length > 0 && (
                                <div>
                                  <p className="text-[10px] uppercase tracking-wide text-cyan-400/70 mb-1">Real multi-word searches people use</p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {enrichData.related_queries.map(q => (
                                      <span key={q} className="px-2 py-0.5 rounded-full border border-cyan-500/20 bg-cyan-500/8 text-xs text-cyan-200">{q}</span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {enrichData.real_suggestions.filter(s => !enrichData.related_queries.includes(s)).length > 0 && (
                                <div>
                                  <p className="text-[10px] uppercase tracking-wide text-white/40 mb-1">Other autocomplete suggestions</p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {enrichData.real_suggestions.filter(s => !enrichData.related_queries.includes(s)).slice(0, 8).map(s => (
                                      <span key={s} className="px-2 py-0.5 rounded-full border border-white/10 bg-white/4 text-xs text-white/55">{s}</span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={hasEnrichment ? 8 : 7} className="text-center py-12 text-white/60 text-sm">
                        No keywords match your current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-white/60 px-1">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400" />Low competition</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400" />Medium competition</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-400" />High competition</span>
              <span className="flex items-center gap-1.5"><TrendingUp className="w-3 h-3 text-emerald-400" />Rising</span>
              <span className="flex items-center gap-1.5"><Minus className="w-3 h-3 text-white/40" />Stable</span>
              <span className="flex items-center gap-1.5"><TrendingDown className="w-3 h-3 text-rose-400" />Declining</span>
              {hasEnrichment && <>
                <span className="flex items-center gap-1.5"><CheckCircle className="w-3 h-3 text-emerald-400" />Real search term</span>
                <span className="flex items-center gap-1.5"><XCircle className="w-3 h-3 text-white/35" />Not in autocomplete</span>
              </>}
              <span>Opportunity 0–100: higher = better ROI potential</span>
            </div>
            </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
