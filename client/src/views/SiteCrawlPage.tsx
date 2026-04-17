import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { meetsMinimumTier, TIER_LIMITS, uiTierFromCanonical } from "@shared/types";
import type { CanonicalTier } from "@shared/types";
import { usePageMeta } from "../hooks/usePageMeta";
import UpgradeWall from "../components/UpgradeWall";
import FeatureInstruction from "../components/FeatureInstruction";
import { startSiteCrawl, listSiteCrawls, getSiteCrawl } from "../api";
import type { SiteCrawlResult, SiteCrawlSummary, SiteCrawlPage } from "../api";
import {
  Globe, ChevronDown, ChevronRight, ExternalLink, AlertTriangle,
  CheckCircle2, XCircle, Loader2, Clock, FileText, Link2,
} from "lucide-react";
import Spinner from '../components/Spinner';

/* ── Helpers ──────────────────────────────────────────── */

function statusBadge(status: string) {
  if (status === "pass") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />;
  if (status === "warn") return <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />;
  return <XCircle className="h-3.5 w-3.5 text-red-400" />;
}

function formatDuration(start: string, end: string) {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/* ── Page Detail View ─────────────────────────────────── */

function PageRow({ page, defaultOpen }: { page: SiteCrawlPage; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const diag = page.seo_diagnostics || {};
  const diagEntries = Object.entries(diag);
  const passCount = diagEntries.filter(([, v]) => v.status === "pass").length;
  const warnCount = diagEntries.filter(([, v]) => v.status === "warn").length;
  const failCount = diagEntries.filter(([, v]) => v.status === "fail").length;

  return (
    <div className="border border-white/[0.06] rounded-lg bg-white/[0.02]">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors"
      >
        {open ? <ChevronDown className="h-4 w-4 text-white/40 shrink-0" /> : <ChevronRight className="h-4 w-4 text-white/40 shrink-0" />}
        <div className="min-w-0 flex-1">
          <p className="text-sm text-white truncate">{page.title || page.url}</p>
          <p className="text-[11px] text-white/40 truncate">{page.url}</p>
        </div>
        <span className="text-[10px] text-white/30 shrink-0">d{page.depth}</span>
        {page.status === "error" ? (
          <span className="text-xs text-red-400 shrink-0">Error</span>
        ) : (
          <div className="flex items-center gap-2 shrink-0 text-[11px]">
            {passCount > 0 && <span className="text-emerald-400">{passCount}✓</span>}
            {warnCount > 0 && <span className="text-amber-400">{warnCount}⚠</span>}
            {failCount > 0 && <span className="text-red-400">{failCount}✗</span>}
          </div>
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/[0.06]">
          {page.error && (
            <p className="text-xs text-red-400 mt-2">{page.error}</p>
          )}

          <div className="flex flex-wrap gap-4 mt-2 text-[11px] text-white/50">
            {page.word_count != null && <span>Words: {page.word_count.toLocaleString()}</span>}
            <span>Links found: {page.links_discovered}</span>
            {page.canonical_url && <span className="truncate max-w-xs">Canonical: {page.canonical_url}</span>}
          </div>

          {diagEntries.length > 0 && (
            <div className="space-y-1 mt-2">
              <p className="text-[10px] uppercase tracking-wider text-white/30 mb-1">SEO Checks</p>
              {diagEntries.map(([key, check]) => (
                <div key={key} className="flex items-start gap-2 text-xs">
                  {statusBadge(check.status)}
                  <div className="min-w-0">
                    <span className="text-white/70">{check.label || key}</span>
                    {check.detail && <span className="text-white/40 ml-1">- {check.detail}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {page.issues.length > 0 && (
            <div className="mt-2">
              <p className="text-[10px] uppercase tracking-wider text-white/30 mb-1">Issues</p>
              <div className="flex flex-wrap gap-1">
                {page.issues.map((issue) => (
                  <span key={issue} className="px-2 py-0.5 text-[10px] rounded bg-red-500/10 text-red-300 border border-red-500/20">
                    {issue}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Crawl Result Detail ──────────────────────────────── */

function CrawlDetail({ data, onBack }: { data: SiteCrawlResult; onBack: () => void }) {
  const { pass, warn, fail } = data.issue_counts;
  const total = pass + warn + fail;

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-white/50 hover:text-white transition-colors">
        ← Back to crawl history
      </button>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Pages Crawled" value={data.total_pages_crawled} />
        <StatCard label="Avg Words" value={data.average_word_count} />
        <StatCard label="Errors" value={data.pages_with_errors} accent={data.pages_with_errors > 0 ? "text-red-400" : "text-emerald-400"} />
        <StatCard label="Duration" value={formatDuration(data.started_at, data.completed_at)} />
      </div>

      {total > 0 && (
        <div className="flex items-center gap-2 text-xs text-white/50">
          <span className="text-emerald-400">{pass} pass</span>
          <span className="text-white/20">·</span>
          <span className="text-amber-400">{warn} warn</span>
          <span className="text-white/20">·</span>
          <span className="text-red-400">{fail} fail</span>
          <span className="text-white/20">·</span>
          <span>across {data.total_pages_crawled} pages</span>
        </div>
      )}

      <div className="space-y-2">
        {data.pages.map((page, i) => (
          <PageRow key={page.url} page={page} defaultOpen={i === 0} />
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-center">
      <p className={`text-lg font-semibold ${accent || "text-white"}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-white/40">{label}</p>
    </div>
  );
}

/* ── Main Page ────────────────────────────────────────── */

export default function SiteCrawlPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const userTier = (user?.tier || "observer") as CanonicalTier;
  const uiTier = uiTierFromCanonical(userTier);
  const hasAccess = meetsMinimumTier(uiTier, "alignment");
  const limits = TIER_LIMITS[userTier] || TIER_LIMITS.observer;

  usePageMeta({
    title: "Site Crawl",
    description: "Crawl and audit multiple pages across your website for structural and AI citation issues.",
    path: "/site-crawl",
  });

  const [url, setUrl] = useState("");
  const [maxPages, setMaxPages] = useState(Math.min(50, limits.pagesPerScan));
  const [maxDepth, setMaxDepth] = useState(2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SiteCrawlResult | null>(null);
  const [history, setHistory] = useState<SiteCrawlSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [viewingCrawl, setViewingCrawl] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) navigate("/auth?mode=signin");
  }, [isAuthenticated, navigate]);

  const loadHistory = useCallback(async () => {
    if (!hasAccess) return;
    setHistoryLoading(true);
    try {
      const res = await listSiteCrawls();
      if (res.success) setHistory(res.data);
    } catch {
      // silent
    } finally {
      setHistoryLoading(false);
    }
  }, [hasAccess]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const handleCrawl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || loading) return;
    setError(null);
    setLoading(true);
    setResult(null);

    try {
      const res = await startSiteCrawl({ url: url.trim(), maxPages, maxDepth });
      if (res.success) {
        setResult(res.data);
        loadHistory(); // refresh history
      } else {
        setError((res as any).error || "Crawl failed");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to start crawl");
    } finally {
      setLoading(false);
    }
  };

  const viewCrawl = async (crawlId: string) => {
    setDetailLoading(true);
    setViewingCrawl(crawlId);
    try {
      const res = await getSiteCrawl(crawlId);
      if (res.success) setResult(res.data);
    } catch (err: any) {
      setError(err?.message || "Failed to load crawl");
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-white">
          <Globe className="h-5 w-5 text-cyan-400" />
          Site Crawl
        </h1>
        <p className="text-sm text-white/50 mt-1">
          Crawl your website and audit every discovered page for SEO, structure, and AI readiness.
        </p>
      </div>

      <FeatureInstruction
        headline="How to use Site Crawl"
        steps={[
          "Enter your root domain or a specific section URL to start the multi-page crawl.",
          "Set max pages and depth — crawl results scale with your tier.",
          "Review per-page SEO diagnostics: schema, canonical, heading structure, word count, and indexability.",
          "Fix the pages with the most warnings and failures first, then re-crawl to validate.",
        ]}
        benefit="Catch structural SEO and AI readability issues across your entire site instead of auditing one page at a time."
        accentClass="text-cyan-400 border-cyan-500/30 bg-cyan-500/[0.06]"
        defaultCollapsed
      />

      {!hasAccess ? (
        <UpgradeWall
          feature="Site Crawl"
          description="Crawl and audit multiple pages across your website to find structural and AI citation issues at scale."
          requiredTier="alignment"
          icon={<Globe className="h-12 w-12 text-white/80" />}
          featurePreview={[
            "BFS crawl discovers pages via internal links",
            "Per-page SEO diagnostics - schema, canonical, indexability",
            "Tier-based page caps: 50 (Alignment), 250 (Signal), 500 (Score Fix)",
            "Crawl history with pass/warn/fail breakdowns",
          ]}
        />
      ) : (
        <>
          {/* ── Crawl Form ─── */}
          {!viewingCrawl && !result && (
            <form onSubmit={handleCrawl} className="space-y-4">
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 space-y-4">
                <div>
                  <label htmlFor="crawl-url" className="block text-xs text-white/50 mb-1">Root URL</label>
                  <input
                    id="crawl-url"
                    type="text"
                    placeholder="example.com"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-white placeholder-white/30 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="crawl-max-pages" className="block text-xs text-white/50 mb-1">
                      Max Pages <span className="text-white/30">(limit: {limits.pagesPerScan})</span>
                    </label>
                    <input
                      id="crawl-max-pages"
                      type="number"
                      min={1}
                      max={limits.pagesPerScan}
                      value={maxPages}
                      onChange={(e) => setMaxPages(Math.min(limits.pagesPerScan, Math.max(1, Number(e.target.value) || 1)))}
                      className="w-full rounded-lg border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-white focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
                    />
                  </div>
                  <div>
                    <label htmlFor="crawl-max-depth" className="block text-xs text-white/50 mb-1">
                      Max Depth <span className="text-white/30">(1–4)</span>
                    </label>
                    <input
                      id="crawl-max-depth"
                      type="number"
                      min={1}
                      max={4}
                      value={maxDepth}
                      onChange={(e) => setMaxDepth(Math.min(4, Math.max(1, Number(e.target.value) || 1)))}
                      className="w-full rounded-lg border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-white focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
                    />
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-red-400">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading || !url.trim()}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Crawling…
                    </>
                  ) : (
                    <>
                      <Globe className="h-4 w-4" />
                      Start Crawl
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* ── Loading State ─── */}
          {(loading || detailLoading) && (
            <div className="flex items-center justify-center gap-3 py-12 text-white/50">
              <Spinner className="h-5 w-5" />
              <span className="text-sm">{loading ? "Crawling pages…" : "Loading crawl…"}</span>
            </div>
          )}

          {/* ── Result View ─── */}
          {result && !loading && !detailLoading && (
            <CrawlDetail
              data={result}
              onBack={() => {
                setResult(null);
                setViewingCrawl(null);
              }}
            />
          )}

          {/* ── History ─── */}
          {!result && !loading && !viewingCrawl && (
            <div className="space-y-3">
              <h2 className="text-sm font-medium text-white/60">Crawl History</h2>
              {historyLoading ? (
                <div className="flex items-center gap-2 py-4 text-white/40 text-sm">
                  <Spinner className="h-4 w-4" /> Loading…
                </div>
              ) : history.length === 0 ? (
                <p className="text-sm text-white/30 py-4">No crawls yet. Start your first crawl above.</p>
              ) : (
                <div className="space-y-2">
                  {history.map((crawl) => (
                    <button
                      key={crawl.crawl_id}
                      onClick={() => viewCrawl(crawl.crawl_id)}
                      className="w-full flex items-center gap-4 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-left hover:bg-white/[0.04] transition-colors"
                    >
                      <Globe className="h-4 w-4 text-cyan-400 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-white truncate">{crawl.root_url}</p>
                        <p className="text-[11px] text-white/40">
                          {new Date(crawl.created_at).toLocaleDateString()} · {crawl.total_pages_crawled} pages · {formatDuration(crawl.started_at, crawl.completed_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 text-[11px]">
                        <span className="text-emerald-400">{crawl.issue_counts.pass}✓</span>
                        <span className="text-amber-400">{crawl.issue_counts.warn}⚠</span>
                        <span className="text-red-400">{crawl.issue_counts.fail}✗</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-white/20 shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
