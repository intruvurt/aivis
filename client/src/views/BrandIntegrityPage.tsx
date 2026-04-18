import React, { useState, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { useAnalysisStore } from "../stores/analysisStore";
import {
  ShieldCheck, Eye, Search, BarChart3, Target, TrendingUp,
  ArrowRight, Layers3, Sparkles, CheckCircle2, AlertTriangle,
  Brain, Globe, Loader2, XCircle, RefreshCw, FileText, Users,
} from "lucide-react";
import { meetsMinimumTier } from "@shared/types";
import { usePageMeta } from "../hooks/usePageMeta";
import UpgradeWall from "../components/UpgradeWall";
import PlatformProofLoopCard from "../components/PlatformProofLoopCard";
import { normalizePublicUrlInput } from "../utils/targetKey";
import apiFetch from "../utils/api";
import { API_URL } from "../config";
import type { BrandMentionScanResponse } from "../../../shared/types";
import PageQASection from "../components/PageQASection";
import { buildFaqSchema, buildWebPageSchema } from "../lib/seoSchema";

/* ── Static data ────────────────────────────────────── */
const MENTION_SOURCES = [
  { name: "Reddit", desc: "Community discussion threads" },
  { name: "Hacker News", desc: "Tech community mentions" },
  { name: "Mastodon", desc: "Federated social discussion" },
  { name: "DuckDuckGo", desc: "Web search dork results" },
  { name: "Bing", desc: "Web search dork results" },
  { name: "Google News", desc: "News source mentions" },
  { name: "GitHub", desc: "Open-source references" },
  { name: "Quora", desc: "Q&A platform mentions" },
  { name: "Product Hunt", desc: "Product launch mentions" },
  { name: "Stack Overflow", desc: "Developer Q&A mentions" },
  { name: "Wikipedia", desc: "Encyclopedia references" },
  { name: "Dev.to", desc: "Developer blog mentions" },
  { name: "Medium", desc: "Publishing platform articles" },
  { name: "YouTube", desc: "Video content mentions" },
  { name: "Lobsters", desc: "Tech link aggregator" },
  { name: "Bluesky", desc: "Decentralised social posts" },
  { name: "Twitter / X", desc: "Social media mentions" },
  { name: "Lemmy", desc: "Federated community discussions" },
  { name: "GitHub Discussions", desc: "Product and repo discussion threads" },
];

const INTEGRITY_SIGNALS = [
  { icon: CheckCircle2, label: "Accurate mention", color: "text-emerald-400", detail: "Brand described correctly with factual claims." },
  { icon: AlertTriangle, label: "Misrepresentation risk", color: "text-amber-400", detail: "Brand mentioned with potentially inaccurate context or outdated information." },
  { icon: XCircle, label: "Absence", color: "text-red-400", detail: "Brand not found where it should appear based on query relevance." },
  { icon: Users, label: "Competitor substitution", color: "text-violet-400", detail: "A competitor appears in the answer space that should reference your brand." },
];

const VALUE_CARDS = [
  {
    icon: ShieldCheck,
    title: "Monitor brand accuracy across AI",
    detail: "Track what AI platforms and public sources actually say about your business - and whether it is factually correct.",
  },
  {
    icon: Eye,
    title: "Detect misrepresentations early",
    detail: "Catch inaccurate claims, outdated information, or incorrect associations before they propagate through AI training data.",
  },
  {
    icon: Search,
    title: "Scan 19 public sources",
    detail: "Brand mentions are tracked across Reddit, Hacker News, Mastodon, DuckDuckGo, Bing, Google News, GitHub, Quora, Product Hunt, Stack Overflow, Wikipedia, Dev.to, Medium, YouTube, Lobsters, Bluesky, Twitter/X, Lemmy, and GitHub Discussions - no API keys needed.",
  },
  {
    icon: TrendingUp,
    title: "Track integrity over time",
    detail: "See how brand accuracy and mention sentiment change as you publish corrections, update schema, and improve content.",
  },
];

const WORKFLOW_STEPS = [
  { step: 1, label: "Enter your brand URL", detail: "Paste your business URL - brand name, domain, and entity signals are extracted automatically." },
  { step: 2, label: "Multi-source scan", detail: "19 public sources are queried simultaneously for recent brand mentions and references." },
  { step: 3, label: "Integrity analysis", detail: "Each mention is classified: accurate, potentially inaccurate, absent, or displaced by a competitor." },
  { step: 4, label: "Timeline tracking", detail: "View mention history, detect emerging issues, and verify that corrections are propagating." },
];

const TIER_PATH = [
  {
    tier: "Alignment",
    title: "Brand Integrity monitoring",
    detail: "Run brand mention scans across 19 public sources. See mention history, source breakdown, and integrity timeline.",
  },
  {
    tier: "Signal",
    title: "Deep integrity analytics",
    detail: "Cross-reference brand mentions with AI citation data. Detect consistency gaps between what AI says and what public sources confirm.",
  },
  {
    tier: "Score Fix",
    title: "Automated integrity remediation",
    detail: "Generate schema corrections, entity disambiguation patches, and factual claim updates - pushed as evidence-linked PRs.",
  },
];

export default function BrandIntegrityPage() {
  const navigate = useNavigate();
  const { token, isAuthenticated, user } = useAuthStore();
  const latestResult = useAnalysisStore((s) => s.result);

  usePageMeta({
    title: "Brand Integrity Monitor - AI Accuracy Tracking",
    description: "Monitor what AI platforms and public sources say about your brand. Detect misrepresentations, track accuracy over time, and protect brand integrity.",
    path: "/brand-integrity",
    structuredData: [
      buildWebPageSchema({
        path: "/brand-integrity",
        name: "Brand Integrity Monitor | AiVIS.biz",
        description: "Monitor what AI platforms and public sources say about your brand. Detect misrepresentations, track accuracy over time across 19 sources including Reddit, Hacker News, Google News, and GitHub.",
      }),
      buildFaqSchema(BRAND_INTEGRITY_FAQ, { path: "/brand-integrity" }),
    ],
  });

  React.useEffect(() => {
    if (!isAuthenticated) navigate("/auth?mode=signin");
  }, [isAuthenticated, navigate]);

  const userTier = (user?.tier as any) || "observer";
  const hasAccess = meetsMinimumTier(userTier, "alignment");

  const defaultUrl = latestResult?.url || "";
  const [urlInput, setUrlInput] = useState(defaultUrl);
  const [brandInput, setBrandInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [scanResult, setScanResult] = useState<BrandMentionScanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const handleScan = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    const brand = brandInput.trim();
    if (!brand || brand.length < 2) {
      setError("Brand name is required (at least 2 characters)");
      return;
    }
    const normalized = normalizePublicUrlInput(urlInput.trim());
    if (!token) return;
    // Extract domain from URL input (optional but helpful)
    let domain = "";
    if (normalized) {
      try {
        domain = new URL(normalized.startsWith("http") ? normalized : `https://${normalized}`).hostname;
      } catch {
        domain = normalized;
      }
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`${API_URL}/api/mentions/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ brand, domain }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || "Brand mention scan failed");
      }
      const data: BrandMentionScanResponse = await res.json();
      setScanResult(data);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
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
            Brand Integrity Monitor
          </h1>
          <p className="text-white/60 text-lg mb-8 max-w-2xl">
            Monitor what AI platforms and public sources say about your business. Detect misrepresentations, track accuracy, and protect your brand narrative across 19 free sources.
          </p>
          <UpgradeWall
            feature="Brand Integrity Monitor"
            description="Monitor brand accuracy across public sources."
            requiredTier="alignment"
          />

          {/* Sources grid */}
          <div className="mt-12">
            <h2 className="text-lg font-bold text-white mb-4">19 sources monitored</h2>
            <div className="grid grid-cols-3 gap-3">
              {MENTION_SOURCES.map((source) => (
                <div key={source.name} className="rounded-xl border border-slate-700 bg-slate-900 p-3 text-center">
                  <p className="text-white text-sm font-semibold">{source.name}</p>
                  <p className="text-white/40 text-[10px] mt-0.5">{source.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Integrity signal types */}
          <div className="mt-10">
            <h2 className="text-lg font-bold text-white mb-4">Integrity signals</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {INTEGRITY_SIGNALS.map((signal) => (
                <div key={signal.label} className="flex gap-3 rounded-xl border border-slate-700 bg-slate-900 p-4">
                  <signal.icon className={`w-5 h-5 ${signal.color} flex-shrink-0 mt-0.5`} />
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
              <div key={card.title} className="rounded-xl border border-slate-700 bg-slate-900 p-6">
                <card.icon className="w-8 h-8 text-emerald-400 mb-3" />
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
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300 text-sm font-bold">
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
            Brand Integrity Monitor
          </h1>
          <span className="ml-auto px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/25 text-emerald-300 text-[10px] font-bold uppercase tracking-widest">
            Alignment+
          </span>
        </div>
        <p className="text-white/50 text-sm mb-8 max-w-2xl">
          Monitor what AI and public sources say about your brand. Detect inaccuracies, track mention history, and protect your brand narrative.
        </p>

        {/* Source badges */}
        <div className="flex flex-wrap gap-2 mb-8">
          {MENTION_SOURCES.map((source) => (
            <span key={source.name} className="px-2.5 py-1 rounded-full border border-slate-700 bg-slate-900 text-white/60 text-xs font-medium">
              {source.name}
            </span>
          ))}
        </div>

        {/* Scan form */}
        <form onSubmit={handleScan} className="mb-10 space-y-3">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Brain className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                value={brandInput}
                onChange={(e) => setBrandInput(e.target.value)}
                enterKeyHint="go"
                placeholder="Brand name (e.g. AiVIS.biz, Stripe, Notion)..."
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-700 bg-slate-950 text-white placeholder-white/30 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400/25 transition"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Domain (optional, e.g. aivis.biz)..."
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-700 bg-slate-950 text-white placeholder-white/30 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400/25 transition"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !brandInput.trim()}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 text-white font-semibold hover:from-emerald-500 hover:to-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              Scan Brand
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
        {scanResult && (
          <div ref={resultsRef} className="mb-10">
            {/* Summary stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
                <p className="text-white/40 text-xs font-medium uppercase tracking-wider mb-1">Total Mentions</p>
                <p className="text-white text-2xl font-bold">{scanResult.mentions?.length ?? 0}</p>
              </div>
              <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
                <p className="text-white/40 text-xs font-medium uppercase tracking-wider mb-1">Sources Found</p>
                <p className="text-white text-2xl font-bold">{scanResult.sources_checked?.length ?? 0}</p>
              </div>
              <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
                <p className="text-white/40 text-xs font-medium uppercase tracking-wider mb-1">Brand Name</p>
                <p className="text-emerald-300 text-lg font-bold truncate">{scanResult.brand || "-"}</p>
              </div>
              <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
                <p className="text-white/40 text-xs font-medium uppercase tracking-wider mb-1">Scan Status</p>
                <p className="text-emerald-400 text-sm font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Complete
                </p>
              </div>
            </div>

            {/* Mentions list */}
            {scanResult.mentions && scanResult.mentions.length > 0 ? (
              <div className="space-y-3">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-400" />
                  Brand Mentions ({scanResult.mentions.length})
                </h2>
                {scanResult.mentions.map((mention: any, i: number) => (
                  <div key={i} className="rounded-xl border border-slate-700 bg-slate-900 p-4 hover:border-orange-400/30 transition">
                    <div className="flex items-start gap-3">
                      <span className="flex-shrink-0 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 text-[10px] font-bold uppercase">
                        {mention.source || "unknown"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">
                          {mention.title || mention.url || "Untitled mention"}
                        </p>
                        {mention.snippet && (
                          <p className="text-white/45 text-xs mt-1 line-clamp-2">{mention.snippet}</p>
                        )}
                        {mention.url && (
                          <a
                            href={mention.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cyan-400/70 text-xs hover:text-cyan-300 mt-1 inline-block truncate max-w-md"
                          >
                            {mention.url}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 rounded-xl border border-slate-700 bg-slate-900">
                <AlertTriangle className="w-8 h-8 text-amber-400/50 mx-auto mb-3" />
                <p className="text-white/60 text-sm">No brand mentions found across scanned sources.</p>
                <p className="text-white/40 text-xs mt-1">This may indicate your brand has low public discussion presence.</p>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!scanResult && !loading && (
          <div className="text-center py-16">
            <ShieldCheck className="w-12 h-12 text-emerald-400/40 mx-auto mb-4" />
            <h3 className="text-white/70 text-lg font-semibold mb-2">Enter a URL to scan brand integrity</h3>
            <p className="text-white/40 text-sm max-w-md mx-auto">
              The Brand Integrity Monitor scans 17 public sources for mentions of your brand and analyzes accuracy, sentiment, and competitor displacement.
            </p>
          </div>
        )}

        {/* How it works */}
        <div className="mt-12">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <Layers3 className="w-5 h-5 text-emerald-400" />
            How Brand Integrity works
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {WORKFLOW_STEPS.map((step) => (
              <div key={step.step} className="rounded-xl border border-slate-700 bg-slate-900 p-5">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300 text-sm font-bold mb-3">
                  {step.step}
                </div>
                <h3 className="text-white font-semibold text-sm mb-1">{step.label}</h3>
                <p className="text-white/45 text-xs leading-relaxed">{step.detail}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Proof loop + cross-links */}
        <div className="mt-10">
          <PlatformProofLoopCard />
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/app/prompt-intelligence"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-violet-400/20 bg-violet-500/10 text-violet-300 text-sm font-medium hover:bg-violet-500/20 transition"
          >
            <Brain className="w-4 h-4" /> Prompt Intelligence <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <Link
            to="/app/answer-presence"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-300 text-sm font-medium hover:bg-cyan-500/20 transition"
          >
            <Globe className="w-4 h-4" /> Answer Presence <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <Link
            to="/app/citations"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-violet-400/20 bg-violet-500/10 text-violet-300 text-sm font-medium hover:bg-violet-500/20 transition"
          >
            <Eye className="w-4 h-4" /> Citation Intelligence <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      <PageQASection
        items={BRAND_INTEGRITY_FAQ}
        heading="Understanding brand integrity monitoring for AI"
        className="mt-6"
      />
    </div>
  );
}
