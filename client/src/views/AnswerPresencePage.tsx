import React, { useState, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { useAnalysisStore } from "../stores/analysisStore";
import CitationTracker from "../components/CitationTracker";
import {
  Globe, Eye, Search, BarChart3, Target, TrendingUp,
  ArrowRight, Layers3, Sparkles, CheckCircle2, AlertTriangle,
  MessageSquare, Brain, Loader2, ExternalLink,
} from "lucide-react";
import { meetsMinimumTier } from "@shared/types";
import { usePageMeta } from "../hooks/usePageMeta";
import UpgradeWall from "../components/UpgradeWall";
import PlatformProofLoopCard from "../components/PlatformProofLoopCard";
import { normalizePublicUrlInput } from "../utils/targetKey";

/* ── Static data ────────────────────────────────────── */
const AI_PLATFORMS = [
  { name: "ChatGPT", color: "text-emerald-400", desc: "OpenAI conversational answers" },
  { name: "Perplexity", color: "text-cyan-400", desc: "Search-augmented AI answers" },
  { name: "Claude", color: "text-violet-400", desc: "Anthropic detailed responses" },
  { name: "Google AI", color: "text-amber-400", desc: "Gemini / AI Overview answers" },
];

const PRESENCE_SIGNALS = [
  { icon: Eye, label: "Direct Mention", detail: "Your brand name appears explicitly in the AI-generated answer." },
  { icon: ExternalLink, label: "Citation Link", detail: "The AI links to or references your domain as a source." },
  { icon: MessageSquare, label: "Contextual Reference", detail: "Your brand is described or paraphrased without direct naming." },
  { icon: AlertTriangle, label: "Competitor Displacement", detail: "A competitor appears in the answer space where you should be." },
];

const VALUE_CARDS = [
  {
    icon: Globe,
    title: "Track presence across AI platforms",
    detail: "See whether ChatGPT, Perplexity, Claude, and Google AI include your brand when users ask questions in your space.",
  },
  {
    icon: BarChart3,
    title: "Measure mention rates over time",
    detail: "Track how your AI answer presence changes as you improve content, schema, and entity signals.",
  },
  {
    icon: Target,
    title: "Find presence gaps",
    detail: "Identify the queries where competitors appear in AI answers but you do not — and understand why.",
  },
  {
    icon: TrendingUp,
    title: "Prove visibility improvements",
    detail: "After implementing recommendations, re-test to confirm your brand now appears where it was previously missing.",
  },
];

const WORKFLOW_STEPS = [
  { step: 1, label: "Enter your URL", detail: "Paste your page URL — AI generates realistic queries from your content, entities, and keywords." },
  { step: 2, label: "Multi-platform scan", detail: "Queries run across 4 AI platforms and 3 web search engines simultaneously to map your answer presence." },
  { step: 3, label: "Presence detection", detail: "Each response is analyzed for direct mentions, citations, contextual references, and competitor displacement." },
  { step: 4, label: "Gap analysis", detail: "See exactly where you are present, absent, or displaced — with actionable evidence for each finding." },
];

const TIER_PATH = [
  {
    tier: "Alignment",
    title: "Answer Presence tracking",
    detail: "Run AI answer presence scans across 4 platforms. See mention rates, competitor displacement, and citation evidence.",
  },
  {
    tier: "Signal",
    title: "Deep presence analytics",
    detail: "Triple-check validated presence data, trend tracking, co-occurrence analysis, and cross-platform consistency scoring.",
  },
  {
    tier: "Score Fix",
    title: "Automated presence remediation",
    detail: "Generate and push content patches that address presence gaps — schema claims, FAQ blocks, entity disambiguation — as evidence-linked PRs.",
  },
];

export default function AnswerPresencePage() {
  const navigate = useNavigate();
  const { token, isAuthenticated, user } = useAuthStore();
  const latestResult = useAnalysisStore((s) => s.result);

  usePageMeta({
    title: "Answer Presence Engine — AI Platform Visibility",
    description: "Track whether your brand appears in AI-generated answers across ChatGPT, Perplexity, Claude, and Google AI. Evidence-based presence detection.",
    path: "/answer-presence",
  });

  React.useEffect(() => {
    if (!isAuthenticated) navigate("/auth?mode=signin");
  }, [isAuthenticated, navigate]);

  const userTier = (user?.tier as any) || "observer";
  const hasAccess = meetsMinimumTier(userTier, "alignment");

  const defaultUrl = latestResult?.url || "";
  const [urlInput, setUrlInput] = useState(defaultUrl);
  const [activeUrl, setActiveUrl] = useState(defaultUrl);
  const trackerRef = useRef<HTMLDivElement>(null);

  const handleUrlSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    const normalized = normalizePublicUrlInput(urlInput.trim());
    if (!normalized) return;
    setActiveUrl(normalized);
    setTimeout(() => trackerRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, [urlInput]);

  /* ── Upgrade wall for observer tier ── */
  if (!hasAccess) {
    return (
      <div>
        <div className="max-w-4xl mx-auto py-16">
          <h1 className="text-2xl font-semibold text-white mb-4">
            Answer Presence Engine
          </h1>
          <p className="text-white/60 text-lg mb-8 max-w-2xl">
            Track whether AI-generated answers include your brand, cite your domain, or hand the answer to a competitor — across ChatGPT, Perplexity, Claude, and Google AI.
          </p>
          <UpgradeWall
            feature="Answer Presence Engine"
            description="Track whether AI answers include or cite your brand."
            requiredTier="alignment"
          />

          {/* AI Platforms */}
          <div className="mt-12">
            <h2 className="text-lg font-bold text-white mb-4">Platforms monitored</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {AI_PLATFORMS.map((platform) => (
                <div key={platform.name} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center">
                  <p className={`font-bold text-sm ${platform.color}`}>{platform.name}</p>
                  <p className="text-white/40 text-[11px] mt-1">{platform.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Presence signal types */}
          <div className="mt-10">
            <h2 className="text-lg font-bold text-white mb-4">Presence signals detected</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {PRESENCE_SIGNALS.map((signal) => (
                <div key={signal.label} className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <signal.icon className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-white font-semibold text-sm">{signal.label}</p>
                    <p className="text-white/45 text-xs leading-relaxed">{signal.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Value cards */}
          <div className="mt-10 grid sm:grid-cols-2 gap-6">
            {VALUE_CARDS.map((card) => (
              <div key={card.title} className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
                <card.icon className="w-8 h-8 text-cyan-400 mb-3" />
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
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-300 text-sm font-bold">
                    {i + 1}
                  </div>
                  <div>
                    <p className="text-white font-semibold">{t.tier} — {t.title}</p>
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
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-xl font-semibold text-white">
            Answer Presence Engine
          </h1>
          <span className="ml-auto px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-400/25 text-cyan-300 text-[10px] font-bold uppercase tracking-widest">
            Alignment+
          </span>
        </div>
        <p className="text-white/50 text-sm mb-8 max-w-2xl">
          Track whether AI answers include your brand, cite your domain, or displace you with a competitor — across all major AI platforms.
        </p>

        {/* Platform overview */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {AI_PLATFORMS.map((platform) => (
            <div key={platform.name} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className={`font-bold text-sm ${platform.color}`}>{platform.name}</p>
              <p className="text-white/40 text-[11px] mt-1">{platform.desc}</p>
            </div>
          ))}
        </div>

        {/* URL input form */}
        <form onSubmit={handleUrlSubmit} className="mb-10">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Enter URL to scan for AI answer presence..."
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-white/15 bg-white/[0.04] text-white placeholder-white/30 focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/25 transition"
              />
            </div>
            <button
              type="submit"
              disabled={!urlInput.trim()}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-emerald-600 text-white font-semibold hover:from-cyan-500 hover:to-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-2"
            >
              <Eye className="w-4 h-4" />
              Scan Presence
            </button>
          </div>
        </form>

        {/* Citation tracker (reuses existing component) */}
        {activeUrl && (
          <div ref={trackerRef} className="mb-10">
            <CitationTracker url={activeUrl} />
          </div>
        )}

        {/* Empty state */}
        {!activeUrl && (
          <div className="text-center py-16">
            <Globe className="w-12 h-12 text-cyan-400/40 mx-auto mb-4" />
            <h3 className="text-white/70 text-lg font-semibold mb-2">Enter a URL to scan answer presence</h3>
            <p className="text-white/40 text-sm max-w-md mx-auto">
              The Answer Presence Engine runs your URL through AI platforms and web search engines to detect where your brand is mentioned, cited, or displaced.
            </p>
          </div>
        )}

        {/* How it works */}
        <div className="mt-12">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <Layers3 className="w-5 h-5 text-cyan-400" />
            How Answer Presence works
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {WORKFLOW_STEPS.map((step) => (
              <div key={step.step} className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                <div className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-300 text-sm font-bold mb-3">
                  {step.step}
                </div>
                <h3 className="text-white font-semibold text-sm mb-1">{step.label}</h3>
                <p className="text-white/45 text-xs leading-relaxed">{step.detail}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Cross-links */}
        <div className="mt-10">
          <PlatformProofLoopCard />
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/prompt-intelligence"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-violet-400/20 bg-violet-500/10 text-violet-300 text-sm font-medium hover:bg-violet-500/20 transition"
          >
            <Brain className="w-4 h-4" /> Prompt Intelligence <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <Link
            to="/citations"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-violet-400/20 bg-violet-500/10 text-violet-300 text-sm font-medium hover:bg-violet-500/20 transition"
          >
            <Eye className="w-4 h-4" /> Citation Intelligence <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <Link
            to="/brand-integrity"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-400/20 bg-emerald-500/10 text-emerald-300 text-sm font-medium hover:bg-emerald-500/20 transition"
          >
            <CheckCircle2 className="w-4 h-4" /> Brand Integrity <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
