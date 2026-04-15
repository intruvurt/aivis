import React, { useState, useCallback, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, CheckCircle2, XCircle, Loader2, RefreshCw, Globe, ChevronDown,
  Play, Search, BarChart3, TrendingDown, TrendingUp, Shuffle, Layers, Grid3X3,
  AlertTriangle, Unplug, ExternalLink, Bookmark, Download, Copy,
} from "lucide-react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { usePageMeta } from "../hooks/usePageMeta";
import { useAuthStore } from "../stores/authStore";
import { meetsMinimumTier, type CanonicalTier } from "@shared/types";
import UpgradeWall from "../components/UpgradeWall";
import FeatureInstruction from "../components/FeatureInstruction";
import apiFetch from "../utils/api";
import PageQASection from "../components/PageQASection";
import { buildFaqSchema, buildWebPageSchema } from "../lib/seoSchema";

const GSC_FAQ = [
  {
    question: "What is Search Console Intelligence and how is it different from Google Search Console?",
    answer: "Google Search Console shows you raw performance data: impressions, clicks, CTR, and position for your pages in Google Search. AiVIS Search Console Intelligence takes that same data and runs it through a pattern analysis layer that identifies: pages with declining CTR that need answer-block optimization, queries where your page ranks highly but doesn't drive clicks (a sign that a featured snippet or AI Overview is intercepting traffic before the click), keyword clusters where your content ranks but competitors' AI-optimized content is outperforming you, and structural gaps between your GSC performance profile and AI citation readiness benchmarks.",
  },
  {
    question: "What does 'declining CTR' in the GSC analysis mean for AI visibility?",
    answer: "Declining CTR means your page is appearing in search results but fewer people are clicking it over time. This is often an early signal that an AI Overview, featured snippet, or competitor's direct answer result is satisfying the user intent before they need to click through. For AI visibility strategy, declining CTR pages are high-priority candidates for answer-block restructuring — if your content structure is improved, your page may be selected as the AI Overview source rather than being bypassed by it.",
  },
  {
    question: "What is a CTR opportunity and how is it detected?",
    answer: "A CTR opportunity is a query where your page ranks in the top 10 but has a CTR significantly below the average for that rank position. This typically means your title tag and meta description are not compelling the click, or that an AI-generated result is handling the query without a click. The GSC Intelligence tool surfaces these by comparing your actual CTR to rank-position benchmarks and flagging gaps of more than 1.5 standard deviations. These queries are candidates for content refreshes with stronger direct answers that may improve both CTR and AI citation probability.",
  },
  {
    question: "What does 'AI Overview intercept' mean?",
    answer: "An AI Overview intercept is a query where your page appears in regular search results but an AI-generated answer box (from Google's AI Overview, formerly SGE) appears above it and answers the query directly. This suppresses your CTR because users get their answer without clicking through. Paradoxically, the way to recover is to make your content the source of that AI Overview — improving your page's answer-block structure, entity clarity, and citation eligibility so that when the AI Overview generates, it cites your page.",
  },
  {
    question: "Does connecting Google Search Console require sharing login credentials?",
    answer: "No. The AiVIS GSC integration uses Google's OAuth 2.0 flow — you authorize access through Google's official permission screen, and AiVIS receives a read-only access token that never touches your Google login credentials. AiVIS only reads performance data (queries, pages, CTR, impressions, position) and never modifies any Search Console settings or property data. You can revoke access from your Google account settings at any time independently of your AiVIS account.",
  },
];

import { API_URL } from "../config";

/* ── Types ─────────────────────────────────────────────────────── */

interface GscProperty {
  id: string;
  site_url: string;
  permission_level: string;
  is_selected: boolean;
}

interface GscConnectionStatus {
  connected: boolean;
  email?: string;
  properties_count?: number;
}

interface ToolResult {
  tool: string;
  output: unknown;
  duration_ms?: number;
  error?: string;
}

interface PlanResult {
  toolName: string;
  confidence: number;
  args: Record<string, unknown>;
}
type GscToolName =
  | "declining_pages"
  | "low_ctr_opportunities"
  | "winners_losers_summary"
  | "query_gap_finder"
  | "page_decay_detector"
  | "cannibalization_detector"
  | "page_query_matrix"
  | "audit_joined_recommendations";

/* ── Tool definitions ──────────────────────────────────────────── */

const GSC_TOOLS = [
  { name: "declining_pages",         label: "Declining Pages",          icon: TrendingDown,  description: "Find pages losing clicks or impressions over time" },
  { name: "low_ctr_opportunities",   label: "Low CTR Opportunities",    icon: TrendingUp,    description: "Pages ranking well but with below-average click-through rate" },
  { name: "winners_losers_summary",  label: "Winners & Losers",         icon: Shuffle,       description: "Quick summary of biggest movers in your search performance" },
  { name: "query_gap_finder",        label: "Query Gap Finder",         icon: Search,        description: "Discover queries your competitors rank for that you don't" },
  { name: "page_decay_detector",     label: "Page Decay Detector",      icon: AlertTriangle, description: "Detect pages showing gradual performance decline" },
  { name: "cannibalization_detector",label: "Cannibalization Detector",  icon: Layers,        description: "Find queries where multiple pages compete against each other" },
  { name: "page_query_matrix",       label: "Page–Query Matrix",        icon: Grid3X3,       description: "Cross-reference pages with their top queries and metrics" },
  { name: "audit_joined_recommendations", label: "Audit-Joined Recs",   icon: Bookmark,      description: "Merge GSC data with recent audit recommendations" },
] as const;

/* ── Component ─────────────────────────────────────────────────── */

export default function GscConsolePage() {
  usePageMeta({
    title: "Search Console Intelligence | AiVIS",
    description: "Connect Google Search Console to analyze real performance data, detect declining pages, find CTR opportunities, and generate evidence-backed recommendations.",
    path: "/gsc",
    structuredData: [
      buildWebPageSchema({
        path: "/gsc",
        name: "Search Console Intelligence | AiVIS",
        description: "Connect Google Search Console to detect declining CTR pages, AI Overview intercepts, and keyword opportunity gaps. Evidence-backed recommendations for AI visibility improvement.",
      }),
      buildFaqSchema(GSC_FAQ, { path: "/gsc" }),
    ],
  });

  const user = useAuthStore((s) => s.user);
  const tier = (user?.tier || "observer") as CanonicalTier;
  const hasAccess = meetsMinimumTier(tier, "alignment");
  const [searchParams, setSearchParams] = useSearchParams();

  /* ── State ─────────────────────────────────────── */
  const [connectionStatus, setConnectionStatus] = useState<GscConnectionStatus | null>(null);
  const [connectionLoading, setConnectionLoading] = useState(true);
  const [properties, setProperties] = useState<GscProperty[]>([]);
  const [selectedProperty, setSelectedPropertyState] = useState<GscProperty | null>(null);
  const [propertiesLoading, setPropertiesLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [propertyDropdownOpen, setPropertyDropdownOpen] = useState(false);

  // Tool execution
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [toolLoading, setToolLoading] = useState(false);
  const [toolResult, setToolResult] = useState<ToolResult | null>(null);

  // Natural language prompt
  const [prompt, setPrompt] = useState("");
  const [planResult, setPlanResult] = useState<PlanResult | null>(null);
  const [planLoading, setPlanLoading] = useState(false);

  const formatDate = (d: Date) => d.toISOString().slice(0, 10);

  const buildDefaultToolArgs = useCallback((toolName: GscToolName, propertyId: string): Record<string, unknown> => {
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() - 1); // GSC data is typically delayed ~1 day
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 28);

    const commonWindow = {
      propertyId,
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
      sourceMode: "live_gsc" as const,
    };

    switch (toolName) {
      case "declining_pages":
        return { propertyId, sourceMode: "live_gsc", currentWindowDays: 60, previousWindowDays: 60, minClicks: 10, minLossPct: 30 };
      case "low_ctr_opportunities":
        return { ...commonWindow, positionMin: 8, positionMax: 15, minImpressions: 100, maxCtr: 0.03 };
      case "winners_losers_summary":
        return { propertyId, sourceMode: "live_gsc", rangeDays: 28, minImpressions: 50 };
      case "query_gap_finder":
        return { ...commonWindow, minImpressions: 150, maxCtr: 0.02 };
      case "page_decay_detector":
        return { propertyId, sourceMode: "live_gsc", lookbackMonths: 6, minPeakClicks: 30, declineConsistencyThreshold: 0.6 };
      case "cannibalization_detector":
        return { ...commonWindow, minSharedQueries: 2, minOverlapScore: 1 };
      case "page_query_matrix":
      case "audit_joined_recommendations":
        return selectedProperty?.site_url
          ? { ...commonWindow, page: selectedProperty.site_url, ...(toolName === "audit_joined_recommendations" ? { compareWindowDays: 60 } : { limit: 100 }) }
          : {};
      default:
        return { propertyId, sourceMode: "live_gsc" };
    }
  }, [selectedProperty?.site_url]);

  /* ── Handle OAuth callback params ──────────────── */
  useEffect(() => {
    const gscParam = searchParams.get("gsc");
    if (gscParam === "connected") {
      toast.success("Google Search Console connected successfully!");
      searchParams.delete("gsc");
      setSearchParams(searchParams, { replace: true });
    } else if (gscParam === "error") {
      const msg = searchParams.get("message") || "Connection failed";
      toast.error(`GSC connection failed: ${msg}`);
      searchParams.delete("gsc");
      searchParams.delete("message");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  /* ── Check connection status ────────────────────── */
  const checkConnection = useCallback(async () => {
    setConnectionLoading(true);
    try {
      const res = await apiFetch(`${API_URL}/api/integrations/gsc/properties`);
      if (res.ok) {
        const data = await res.json();
        const props: GscProperty[] = Array.isArray(data?.properties) ? data.properties : Array.isArray(data) ? data : [];
        setProperties(props);
        const selected = props.find((p) => p.is_selected) || null;
        setSelectedPropertyState(selected);
        setConnectionStatus({ connected: true, email: data.email, properties_count: props.length });
      } else {
        // 404 = not connected, 401 = unauthorized - both mean "not connected"
        setConnectionStatus({ connected: false });
      }
    } catch {
      setConnectionStatus({ connected: false });
    } finally {
      setConnectionLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasAccess) checkConnection();
  }, [hasAccess, checkConnection]);

  /* ── Connect GSC ────────────────────────────────── */
  const handleConnect = useCallback(async () => {
    try {
      const res = await apiFetch(`${API_URL}/api/integrations/gsc/oauth/start`);
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
        }
      } else {
        toast.error("Failed to start GSC connection");
      }
    } catch {
      toast.error("Network error starting GSC connection");
    }
  }, []);

  /* ── Sync properties ────────────────────────────── */
  const handleSync = useCallback(async () => {
    setSyncLoading(true);
    try {
      const res = await apiFetch(`${API_URL}/api/integrations/gsc/properties/sync`, { method: "POST" });
      if (res.ok) {
        toast.success("Properties synced from Google");
        await checkConnection();
      } else {
        toast.error("Failed to sync properties");
      }
    } catch {
      toast.error("Network error syncing properties");
    } finally {
      setSyncLoading(false);
    }
  }, [checkConnection]);

  /* ── Select property ────────────────────────────── */
  const handleSelectProperty = useCallback(async (prop: GscProperty) => {
    setPropertyDropdownOpen(false);
    setPropertiesLoading(true);
    try {
      const res = await apiFetch(`${API_URL}/api/integrations/gsc/properties/${prop.id}/select`, { method: "POST" });
      if (res.ok) {
        setSelectedPropertyState(prop);
        setProperties((prev) => prev.map((p) => ({ ...p, is_selected: p.id === prop.id })));
        toast.success(`Selected: ${prop.site_url}`);
      } else {
        toast.error("Failed to select property");
      }
    } catch {
      toast.error("Network error selecting property");
    } finally {
      setPropertiesLoading(false);
    }
  }, []);

  /* ── Run a tool directly ────────────────────────── */
  const handleRunTool = useCallback(async (toolName: string, plannedArgs?: Record<string, unknown>) => {
    if (!selectedProperty) {
      toast.error("Select a property first");
      return;
    }
    setActiveTool(toolName);
    setToolLoading(true);
    setToolResult(null);

    const start = Date.now();
    try {
      const args = plannedArgs && Object.keys(plannedArgs).length
        ? plannedArgs
        : buildDefaultToolArgs(toolName as GscToolName, selectedProperty.id);
      const res = await apiFetch(`${API_URL}/api/integrations/gsc/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolName: toolName, args }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const message = (data && typeof data === "object" && "error" in data) ? String((data as { error?: string }).error || "Tool execution failed") : "Tool execution failed";
        setToolResult({
          tool: toolName,
          output: data,
          error: message,
          duration_ms: Date.now() - start,
        });
        return;
      }
      setToolResult({
        tool: toolName,
        output: data,
        duration_ms: Date.now() - start,
      });
    } catch {
      setToolResult({
        tool: toolName,
        output: null,
        error: "Network error running tool",
        duration_ms: Date.now() - start,
      });
    } finally {
      setToolLoading(false);
    }
  }, [buildDefaultToolArgs, selectedProperty]);

  /* ── Plan from prompt ───────────────────────────── */
  const handlePlan = useCallback(async () => {
    if (!prompt.trim()) return;
    setPlanLoading(true);
    setPlanResult(null);
    try {
      const res = await apiFetch(`${API_URL}/api/integrations/gsc/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        const plan = (data && typeof data === "object" && "plan" in data)
          ? (data as { plan?: PlanResult }).plan
          : null;
        if (plan?.toolName) {
          setPlanResult(plan);
        } else {
          toast.error("Planner returned an invalid tool response");
        }
      } else {
        toast.error("Planner could not determine a tool");
      }
    } catch {
      toast.error("Network error calling planner");
    } finally {
      setPlanLoading(false);
    }
  }, [prompt]);

  /* ── Execute planned tool ───────────────────────── */
  const handleExecutePlan = useCallback(async () => {
    if (!planResult || !selectedProperty) return;
    const args = {
      ...buildDefaultToolArgs(planResult.toolName as GscToolName, selectedProperty.id),
      ...(planResult.args || {}),
    };
    await handleRunTool(planResult.toolName, args);
    setPlanResult(null);
    setPrompt("");
  }, [buildDefaultToolArgs, handleRunTool, planResult, selectedProperty]);

  /* ── Tier gate ──────────────────────────────────── */
  if (!hasAccess) {
    return (
      <div className="text-white">
        <div className="px-4 py-16">
          <UpgradeWall
            feature="Search Console Intelligence"
            description="Connect Google Search Console to detect declining pages, find low-CTR opportunities, and merge real performance data with your AI visibility audits."
            requiredTier="alignment"
            icon={<BarChart3 className="h-6 w-6" />}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="text-white">
      <div className="max-w-6xl">

      {/* ── Header ────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="mb-8 flex items-start justify-between gap-4"
      >
        <div>
          <Link to="/" className="mb-3 inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white/70 transition">
            <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl flex items-center gap-3">
            <BarChart3 className="h-7 w-7 text-emerald-400" />
            Search Console Intelligence
          </h1>
          <p className="mt-1.5 text-sm text-white/50 max-w-2xl">
            Connect Google Search Console for real performance data. Detect declines, discover CTR opportunities,
            and merge GSC evidence with your AI visibility audits.
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
          Alignment+
        </span>
      </motion.div>
      <FeatureInstruction
        headline="How to use Search Console Intelligence"
        steps={[
          "Connect your Google Search Console account using the button below",
          "Select a property to view its search performance data",
          "Cross-reference GSC queries with your AI visibility scores",
          "Identify pages with high impressions but low AI citation potential",
        ]}
        benefit="Merge traditional search data with AI visibility metrics to find exactly where AI models are ignoring your best-performing content."
        accentClass="text-emerald-400 border-emerald-500/30 bg-emerald-500/[0.06]"
        defaultCollapsed
      />
      {/* ── Connection Status ─────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.05 }}
        className="mb-6 rounded-2xl border border-white/10 bg-[#111827]/90 p-5 sm:p-6"
      >
        {connectionLoading ? (
          <div className="flex items-center gap-3 py-4 justify-center text-white/40 text-sm">
            <img src="/aivis-progress-spinner.png" alt="" className="h-5 w-5 animate-spin" /> Checking GSC connection…
          </div>
        ) : connectionStatus?.connected ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">Google Search Console Connected</span>
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <p className="text-xs text-white/40 mt-0.5">
                  {connectionStatus.email && <span className="text-white/50">{connectionStatus.email} · </span>}
                  {properties.length} {properties.length === 1 ? "property" : "properties"} available
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSync}
                disabled={syncLoading}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 hover:text-white hover:bg-white/10 transition disabled:opacity-40"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${syncLoading ? "animate-spin" : ""}`} />
                Sync Properties
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="h-14 w-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
              <Unplug className="h-7 w-7 text-white/30" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-semibold text-white mb-1">Connect Google Search Console</h3>
              <p className="text-xs text-white/40 max-w-md">
                Link your GSC account to run performance analysis tools, detect declining content, and generate evidence-backed recommendations.
              </p>
            </div>
            <button
              onClick={handleConnect}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/15 border border-emerald-500/25 px-5 py-2.5 text-sm font-medium text-emerald-300 hover:bg-emerald-500/25 transition"
            >
              <Globe className="h-4 w-4" />
              Connect with Google
              <ExternalLink className="h-3.5 w-3.5 opacity-50" />
            </button>
          </div>
        )}
      </motion.div>

      {/* ── Property Selector ─────────────────────────────────────── */}
      {connectionStatus?.connected && properties.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="mb-6 rounded-2xl border border-white/10 bg-[#111827]/90 p-5 sm:p-6"
        >
          <div className="flex items-center justify-between gap-4 mb-3">
            <h2 className="text-sm font-semibold text-white">Active Property</h2>
          </div>
          <div className="relative">
            <button
              onClick={() => setPropertyDropdownOpen(!propertyDropdownOpen)}
              disabled={propertiesLoading}
              className="w-full flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left hover:bg-white/[0.07] transition disabled:opacity-40"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Globe className="h-4 w-4 text-emerald-400 shrink-0" />
                <span className="text-sm text-white truncate">
                  {selectedProperty ? selectedProperty.site_url : "Select a property…"}
                </span>
              </div>
              <ChevronDown className={`h-4 w-4 text-white/30 transition-transform ${propertyDropdownOpen ? "rotate-180" : ""}`} />
            </button>

            <AnimatePresence>
              {propertyDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute z-20 mt-2 w-full rounded-xl border border-white/10 bg-[#0f1629] shadow-2xl overflow-hidden"
                >
                  {properties.map((prop) => (
                    <button
                      key={prop.id}
                      onClick={() => handleSelectProperty(prop)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm hover:bg-white/5 transition ${
                        selectedProperty?.id === prop.id ? "bg-emerald-500/10 text-emerald-300" : "text-white/70"
                      }`}
                    >
                      <Globe className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{prop.site_url}</span>
                      {selectedProperty?.id === prop.id && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 ml-auto shrink-0" />
                      )}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}

      {/* ── Natural Language Prompt ────────────────────────────────── */}
      {connectionStatus?.connected && selectedProperty && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.15 }}
          className="mb-6 rounded-2xl border border-white/10 bg-[#111827]/90 p-5 sm:p-6"
        >
          <h2 className="text-sm font-semibold text-white mb-3">Ask a Question</h2>
          <p className="text-xs text-white/40 mb-4">
            Describe what you want to know and we'll pick the right tool. Try "Which pages are losing traffic?" or "Find cannibalization issues."
          </p>
          <div className="flex gap-3">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handlePlan(); }}
              enterKeyHint="send"
              placeholder='e.g. "Show me pages with declining clicks"'
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:border-emerald-500/30 focus:outline-none focus:ring-1 focus:ring-emerald-500/15"
            />
            <button
              onClick={handlePlan}
              disabled={planLoading || !prompt.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/15 border border-emerald-500/25 px-4 py-2.5 text-sm font-medium text-emerald-300 hover:bg-emerald-500/25 transition disabled:opacity-40"
            >
              {planLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Analyze
            </button>
          </div>

          {/* Quick prompt chips */}
          {!prompt && (
            <div className="flex flex-wrap gap-2 mt-3">
              {[
                "Which pages lost the most clicks?",
                "Find low CTR opportunities",
                "Detect cannibalization issues",
                "Show my biggest winners & losers",
              ].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => { setPrompt(chip); }}
                  className="text-[11px] px-2.5 py-1.5 rounded-full border border-white/8 bg-white/[0.03] text-white/50 hover:text-white/80 hover:border-emerald-500/20 hover:bg-emerald-500/5 transition"
                >
                  {chip}
                </button>
              ))}
            </div>
          )}

          {/* Plan result banner */}
          <AnimatePresence>
            {planResult && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="text-xs text-white/40">Suggested tool: </span>
                    <span className="text-sm font-semibold text-emerald-300">{planResult.toolName}</span>
                    <span className="ml-2 text-xs text-white/30">({Math.round(planResult.confidence * 100)}% confidence)</span>
                  </div>
                  <button
                    onClick={handleExecutePlan}
                    disabled={toolLoading}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/30 transition disabled:opacity-40"
                  >
                    {toolLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                    Run It
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* ── Tool Grid ─────────────────────────────────────────────── */}
      {connectionStatus?.connected && selectedProperty && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.2 }}
          className="mb-6 rounded-2xl border border-white/10 bg-[#111827]/90 p-5 sm:p-6"
        >
          <h2 className="text-sm font-semibold text-white mb-1">Intelligence Tools</h2>
          <p className="text-xs text-white/40 mb-5">Run any tool directly against your selected property</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {GSC_TOOLS.map((tool, idx) => {
              const Icon = tool.icon;
              const isActive = activeTool === tool.name && toolLoading;
              return (
                <motion.button
                  key={tool.name}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: 0.22 + idx * 0.04 }}
                  whileHover={{ y: -2, scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleRunTool(tool.name)}
                  disabled={toolLoading}
                  className={`rounded-xl border text-left p-4 transition group ${
                    activeTool === tool.name && toolResult
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : "border-white/8 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]"
                  } disabled:opacity-40`}
                >
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="h-8 w-8 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center shrink-0 group-hover:border-white/15 transition">
                      {isActive ? <Loader2 className="h-4 w-4 text-emerald-400 animate-spin" /> : <Icon className="h-4 w-4 text-emerald-400" />}
                    </div>
                    <span className="text-xs font-semibold text-white leading-tight">{tool.label}</span>
                  </div>
                  <p className="text-[11px] text-white/35 leading-relaxed line-clamp-2">{tool.description}</p>
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ── Tool Result ───────────────────────────────────────────── */}
      <AnimatePresence>
        {toolResult && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="mb-6 rounded-2xl border border-white/10 bg-[#111827]/90 overflow-hidden"
          >
            <div className="flex items-center justify-between p-5 sm:p-6 border-b border-white/5">
              <div>
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  {toolResult.error ? (
                    <XCircle className="h-4 w-4 text-red-400" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  )}
                  Result: {GSC_TOOLS.find((t) => t.name === toolResult.tool)?.label || toolResult.tool}
                </h2>
                {toolResult.duration_ms != null && (
                  <p className="text-[11px] text-white/30 mt-0.5">
                    Completed in {toolResult.duration_ms}ms
                    {Array.isArray(toolResult.output) && ` · ${(toolResult.output as unknown[]).length} rows`}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* Export CSV (for array results) */}
                {Array.isArray(toolResult.output) && (toolResult.output as unknown[]).length > 0 && (
                  <button
                    onClick={() => {
                      const rows = toolResult.output as Record<string, unknown>[];
                      const keys = Object.keys(rows[0]);
                      const csv = [keys.join(','), ...rows.map(r => keys.map(k => {
                        const val = r[k];
                        const str = typeof val === 'object' ? JSON.stringify(val) : String(val ?? '');
                        return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
                      }).join(','))].join('\n');
                      const blob = new Blob([csv], { type: 'text/csv' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `gsc-${toolResult.tool}-${new Date().toISOString().slice(0, 10)}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                      toast.success('CSV exported');
                    }}
                    className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition px-2 py-1 rounded-lg hover:bg-white/5"
                  >
                    <Download className="h-3 w-3" />
                    CSV
                  </button>
                )}
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(toolResult.output, null, 2));
                    toast.success("Copied result to clipboard");
                  }}
                  className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition px-2 py-1 rounded-lg hover:bg-white/5"
                >
                  <Copy className="h-3 w-3" />
                  JSON
                </button>
              </div>
            </div>

            {toolResult.error ? (
              <div className="p-5 sm:p-6">
                <p className="text-sm text-red-300">{toolResult.error}</p>
              </div>
            ) : (
              <div className="p-5 sm:p-6">
                {/* Table view for array results */}
                {Array.isArray(toolResult.output) && (toolResult.output as Record<string, unknown>[]).length > 0 ? (() => {
                  const rows = toolResult.output as Record<string, unknown>[];
                  const keys = Object.keys(rows[0]);
                  return (
                    <div className="overflow-x-auto -mx-5 sm:-mx-6 px-5 sm:px-6">
                      {/* Summary badges */}
                      <div className="flex flex-wrap gap-2 mb-4">
                        <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                          {rows.length} {rows.length === 1 ? 'result' : 'results'}
                        </span>
                        <span className="text-xs px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/50">
                          {keys.length} fields
                        </span>
                      </div>
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-white/10">
                            {keys.map((k) => (
                              <th key={k} className="text-left py-2.5 px-3 text-white/50 font-medium whitespace-nowrap first:pl-0">
                                {k.replace(/_/g, ' ')}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.slice(0, 100).map((row, i) => (
                            <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02] transition">
                              {keys.map((k) => {
                                const val = row[k];
                                const display = typeof val === 'object' ? JSON.stringify(val) : String(val ?? '-');
                                const isNegative = typeof val === 'number' && val < 0;
                                const isUrl = typeof val === 'string' && val.startsWith('http');
                                return (
                                  <td key={k} className={`py-2.5 px-3 whitespace-nowrap first:pl-0 max-w-[300px] truncate ${
                                    isNegative ? 'text-red-300' : typeof val === 'number' ? 'text-emerald-300 tabular-nums' : 'text-white/70'
                                  }`}>
                                    {isUrl ? (
                                      <a href={val as string} target="_blank" rel="noopener noreferrer" className="text-cyan-300 hover:text-cyan-200 underline underline-offset-2">
                                        {(val as string).replace(/^https?:\/\/(www\.)?/, '').slice(0, 50)}
                                      </a>
                                    ) : display}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {rows.length > 100 && (
                        <p className="text-xs text-white/30 text-center pt-3">
                          Showing 100 of {rows.length} rows · Export CSV for full data
                        </p>
                      )}
                    </div>
                  );
                })() : typeof toolResult.output === "object" && toolResult.output !== null ? (
                  /* Structured key-value for object results */
                  <div className="space-y-2">
                    {Object.entries(toolResult.output as Record<string, unknown>).map(([k, v]) => (
                      <div key={k} className="flex items-start gap-3 rounded-lg bg-white/[0.02] border border-white/5 px-3 py-2.5">
                        <span className="text-white/40 text-xs font-medium min-w-[140px] shrink-0">{k.replace(/_/g, ' ')}</span>
                        <span className="text-white/70 text-xs break-all">
                          {typeof v === 'object' ? (
                            <pre className="font-mono text-emerald-200/70 whitespace-pre-wrap">{JSON.stringify(v, null, 2)}</pre>
                          ) : String(v)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-white/60">{String(toolResult.output)}</p>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Link to MCP Console ───────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-center"
      >
        <Link
          to="/app/mcp"
          className="inline-flex items-center gap-2 text-xs text-white/30 hover:text-white/60 transition"
        >
          Looking for the MCP Server Console? <ExternalLink className="h-3 w-3" />
        </Link>
      </motion.div>
      </div>

      <PageQASection
        items={GSC_FAQ}
        heading="Understanding Search Console Intelligence for AI visibility"
        className="mt-6"
      />
    </div>
  );
}
