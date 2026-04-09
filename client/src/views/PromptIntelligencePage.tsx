import React, { useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { useAnalysisStore } from "../stores/analysisStore";
import {
  Sparkles, Search, Target, Zap, Globe, BarChart3, Eye,
  ArrowRight, Layers3, MessageSquare, Brain, FileText, TrendingUp,
  CheckCircle2, AlertTriangle, RefreshCw, Loader2,
} from "lucide-react";
import { meetsMinimumTier } from "@shared/types";
import { usePageMeta } from "../hooks/usePageMeta";
import UpgradeWall from "../components/UpgradeWall";
import PlatformProofLoopCard from "../components/PlatformProofLoopCard";
import { normalizePublicUrlInput } from "../utils/targetKey";
import apiFetch from "../utils/api";
import { API_URL } from "../config";

/* ── Static data ────────────────────────────────────── */
const QUICK_STATS = [
  { icon: Brain, label: "AI Platforms Analyzed", value: "4+", sublabel: "ChatGPT · Perplexity · Claude · Google AI" },
  { icon: MessageSquare, label: "Query Types", value: "6", sublabel: "Informational · Navigational · Transactional · Comparison · Problem · Entity" },
  { icon: Target, label: "Entity Extraction", value: "Live", sublabel: "Scraped from your page content" },
  { icon: TrendingUp, label: "Pattern Detection", value: "Real-time", sublabel: "Prompt phrasing → inclusion correlation" },
];

const VALUE_CARDS = [
  {
    icon: Brain,
    title: "Understand how AI interprets your brand",
    detail: "See which query phrasing causes AI to include, exclude, or misrepresent your business in generated answers.",
  },
  {
    icon: Search,
    title: "Map prompt patterns to outcomes",
    detail: "Track which prompt structures consistently surface your brand versus handing the answer to competitors.",
  },
  {
    icon: Target,
    title: "Build entity-aware content",
    detail: "Identify the entities, relationships, and claims AI models expect before they decide to cite you.",
  },
  {
    icon: Zap,
    title: "Close prompt coverage gaps",
    detail: "Find the question types where you are invisible and build content that fills those gaps before competitors do.",
  },
];

const WORKFLOW_STEPS = [
  { step: 1, label: "Enter your URL", detail: "Paste any page URL - entities and keywords are extracted from your actual content." },
  { step: 2, label: "AI generates prompt variants", detail: "Prompt Intelligence builds realistic queries across informational, transactional, comparison, and problem-solving categories." },
  { step: 3, label: "Multi-platform execution", detail: "Each prompt variant runs across AI platforms to see which phrasing triggers your brand mention." },
  { step: 4, label: "Pattern analysis", detail: "See which prompt types surface you, which skip you, and which hand wins to competitors." },
];

const TIER_PATH = [
  {
    tier: "Alignment",
    title: "Prompt Intelligence unlocked",
    detail: "Generate AI query variants from any URL and see which prompt types trigger brand mentions across platforms.",
  },
  {
    tier: "Signal",
    title: "Deep prompt pattern analysis",
    detail: "Triple-check validation, competitor prompt comparison, and trend tracking on prompt coverage over time.",
  },
  {
    tier: "Score Fix",
    title: "Automated prompt remediation",
    detail: "Generate content patches that address prompt coverage gaps and push them to your repo as evidence-linked PRs.",
  },
];

export default function PromptIntelligencePage() {
  const navigate = useNavigate();
  const { token, isAuthenticated, user } = useAuthStore();
  const latestResult = useAnalysisStore((s) => s.result);

  usePageMeta({
    title: "Prompt Intelligence - AI Query Analysis",
    description: "Understand how AI models interpret queries about your brand. Map prompt patterns to inclusion, exclusion, and competitor displacement outcomes.",
    path: "/prompt-intelligence",
  });

  React.useEffect(() => {
    if (!isAuthenticated) navigate("/auth?mode=signin");
  }, [isAuthenticated, navigate]);

  const userTier = (user?.tier as any) || "observer";
  const hasAccess = meetsMinimumTier(userTier, "alignment");

  const defaultUrl = latestResult?.url || "";
  const [urlInput, setUrlInput] = useState(defaultUrl);
  const [loading, setLoading] = useState(false);
  const [queryResults, setQueryResults] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    const normalized = normalizePublicUrlInput(urlInput.trim());
    if (!normalized || !token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`${API_URL}/api/citations/generate-queries`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ url: normalized }),
      });
      if (!res.ok) throw new Error("Failed to generate prompt variants");
      const data = await res.json();
      setQueryResults(data.queries || data.results || []);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [urlInput, token]);

  /* ── Upgrade wall for observer tier ── */
  if (!hasAccess) {
    return (
      <div>
        <div className="py-16">
          <h1 className="text-2xl font-semibold text-white mb-4">
            Prompt Intelligence
          </h1>
          <p className="text-white/60 text-lg mb-8 max-w-2xl">
            Understand how AI models interpret questions about your brand. See which query phrasings trigger mentions, which get skipped, and which hand the answer to competitors.
          </p>
          <UpgradeWall
            feature="Prompt Intelligence"
            description="Map AI query patterns to brand inclusion outcomes."
            requiredTier="alignment"
          />

          {/* Value proposition cards */}
          <div className="mt-12 grid sm:grid-cols-2 gap-6">
            {VALUE_CARDS.map((card) => (
              <div key={card.title} className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
                <card.icon className="w-8 h-8 text-violet-400 mb-3" />
                <h3 className="text-white font-semibold mb-2">{card.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{card.detail}</p>
              </div>
            ))}
          </div>

          {/* Tier progression */}
          <div className="mt-12">
            <h2 className="text-xl font-bold text-white mb-6">Tier progression</h2>
            <div className="space-y-4">
              {TIER_PATH.map((t, i) => (
                <div key={t.tier} className="flex gap-4 items-start">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-500/20 border border-violet-400/30 flex items-center justify-center text-violet-300 text-sm font-bold">
                    {i + 1}
                  </div>
                  <div>
                    <p className="text-white font-semibold">{t.tier} - {t.title}</p>
                    <p className="text-white/50 text-sm">{t.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Main page for Alignment+ ── */
  return (
    <div className="space-y-6">
      <div>
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-xl font-semibold text-white">
            Prompt Intelligence
          </h1>
          <span className="ml-auto px-2 py-0.5 rounded-full bg-violet-500/15 border border-violet-400/25 text-violet-300 text-[10px] font-bold uppercase tracking-widest">
            Alignment+
          </span>
        </div>
        <p className="text-white/50 text-sm mb-8 max-w-2xl">
          Understand how AI models interpret questions about your brand. Map prompt patterns to inclusion outcomes.
        </p>

        {/* Quick stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {QUICK_STATS.map((stat) => (
            <div key={stat.label} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-2 mb-2">
                <stat.icon className="w-4 h-4 text-violet-400" />
                <span className="text-white/40 text-xs font-medium uppercase tracking-wider">{stat.label}</span>
              </div>
              <p className="text-white text-xl font-bold">{stat.value}</p>
              <p className="text-white/40 text-[11px] mt-0.5">{stat.sublabel}</p>
            </div>
          ))}
        </div>

        {/* URL input form */}
        <form onSubmit={handleAnalyze} className="mb-10">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                enterKeyHint="go"
                placeholder="Enter URL to analyze prompt patterns..."
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-white/15 bg-white/[0.04] text-white placeholder-white/30 focus:outline-none focus:border-violet-400/50 focus:ring-1 focus:ring-violet-400/25 transition"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !urlInput.trim()}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold hover:from-violet-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
              Analyze Prompts
            </button>
          </div>
        </form>

        {/* Error state */}
        {error && (
          <div className="mb-6 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Results */}
        {queryResults && queryResults.length > 0 && (
          <div className="mb-10">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-violet-400" />
              Generated Prompt Variants
              <span className="text-white/40 text-sm font-normal">({queryResults.length} queries)</span>
            </h2>
            <div className="space-y-3">
              {queryResults.map((q: any, i: number) => (
                <div key={i} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:border-violet-400/20 transition">
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-violet-500/20 text-violet-300 text-xs font-bold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium">{typeof q === "string" ? q : q.query || q.text || JSON.stringify(q)}</p>
                      {q.category && (
                        <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full bg-white/[0.06] text-white/50 text-[10px] font-medium uppercase tracking-wider">
                          {q.category}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!queryResults && !loading && (
          <div className="text-center py-16">
            <Brain className="w-12 h-12 text-violet-400/40 mx-auto mb-4" />
            <h3 className="text-white/70 text-lg font-semibold mb-2">Enter a URL to begin</h3>
            <p className="text-white/40 text-sm max-w-md mx-auto">
              Prompt Intelligence extracts entities and keywords from your page, then generates query variants to test how AI models interpret questions about your brand.
            </p>
          </div>
        )}

        {/* How it works */}
        <div className="mt-12">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <Layers3 className="w-5 h-5 text-violet-400" />
            How Prompt Intelligence works
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {WORKFLOW_STEPS.map((step) => (
              <div key={step.step} className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                <div className="w-8 h-8 rounded-full bg-violet-500/20 border border-violet-400/30 flex items-center justify-center text-violet-300 text-sm font-bold mb-3">
                  {step.step}
                </div>
                <h3 className="text-white font-semibold text-sm mb-1">{step.label}</h3>
                <p className="text-white/45 text-xs leading-relaxed">{step.detail}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Cross-link to Citations */}
        <div className="mt-10">
          <PlatformProofLoopCard />
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/app/citations"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-violet-400/20 bg-violet-500/10 text-violet-300 text-sm font-medium hover:bg-violet-500/20 transition"
          >
            <Eye className="w-4 h-4" /> Citation Intelligence <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <Link
            to="/app/answer-presence"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-300 text-sm font-medium hover:bg-cyan-500/20 transition"
          >
            <Globe className="w-4 h-4" /> Answer Presence <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <Link
            to="/app/brand-integrity"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-400/20 bg-emerald-500/10 text-emerald-300 text-sm font-medium hover:bg-emerald-500/20 transition"
          >
            <CheckCircle2 className="w-4 h-4" /> Brand Integrity <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
