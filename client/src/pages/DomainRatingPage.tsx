import { useState, useCallback, FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, ExternalLink, AlertTriangle, CheckCircle2, TrendingUp, Search } from "lucide-react";
import { usePageMeta } from "../hooks/usePageMeta";
import FeatureInstruction, { InfoTip } from "../components/FeatureInstruction";
import { authorityCheck } from "../api";
import type { AuthorityCheckResponse, AuthorityPlatform, ContentNature } from "@shared/types";

/* ── helpers ──────────────────────────────────────────────────────────── */

function scoreGrade(score: number): string {
  if (score >= 80) return "A";
  if (score >= 60) return "B";
  if (score >= 40) return "C";
  if (score >= 20) return "D";
  return "F";
}

function gradeColor(g: string) {
  if (g === "A") return "text-emerald-400";
  if (g === "B") return "text-sky-400";
  if (g === "C") return "text-amber-400";
  if (g === "D") return "text-orange-400";
  return "text-red-400";
}

function gradeBg(g: string) {
  if (g === "A") return "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30";
  if (g === "B") return "from-sky-500/20 to-sky-500/5 border-sky-500/30";
  if (g === "C") return "from-amber-500/20 to-amber-500/5 border-amber-500/30";
  if (g === "D") return "from-orange-500/20 to-orange-500/5 border-orange-500/30";
  return "from-red-500/20 to-red-500/5 border-red-500/30";
}

function platformLabel(p: AuthorityPlatform): string {
  const labels: Record<AuthorityPlatform, string> = {
    reddit: "Reddit",
    linkedin: "LinkedIn",
    substack: "Substack",
    medium: "Medium",
    github: "GitHub",
    stackoverflow: "Stack Overflow",
    wikipedia: "Wikipedia",
    youtube: "YouTube",
    g2: "G2",
    trustpilot: "Trustpilot",
    crunchbase: "Crunchbase",
    producthunt: "Product Hunt",
    techcrunch: "TechCrunch",
    blogger: "Blogger",
    facebook: "Facebook",
    devpost: "Devpost",
    hackernews: "Hacker News",
    chrome_web_store: "Chrome Web Store",
  };
  return labels[p] || p;
}

function natureColor(n: ContentNature): string {
  if (n === "organic_pain_solution") return "text-emerald-400";
  if (n === "direct_promo") return "text-sky-400";
  if (n === "neutral") return "text-white/60";
  return "text-red-400";
}

function natureLabel(n: ContentNature): string {
  if (n === "organic_pain_solution") return "Organic";
  if (n === "direct_promo") return "Promo";
  if (n === "neutral") return "Neutral";
  return "Spammy";
}

/* ── component ────────────────────────────────────────────────────────── */

export default function DomainRatingPage() {
  usePageMeta({
    title: "Domain Authority Checker \u2014 AiVIS BRA Rating",
    description:
      "Measure your brand's citation authority across 18 platforms. See backlinks, content nature, authority scores, and trust signals in one evidence-backed report.",
    path: "/app/domain-rating",
  });

  const [target, setTarget] = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<AuthorityCheckResponse | null>(null);
  const [error, setError] = useState("");
  const [expandedPlatform, setExpandedPlatform] = useState<AuthorityPlatform | null>(null);

  const run = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const trimmed = target.trim();
      if (!trimmed) return;
      setLoading(true);
      setError("");
      setReport(null);
      try {
        const res = await authorityCheck({ target: trimmed });
        if (!res.success) throw new Error("Authority check failed");
        setReport(res.report);
      } catch (err: any) {
        setError(err?.message || "Something went wrong");
      } finally {
        setLoading(false);
      }
    },
    [target]
  );

  const grade = report ? scoreGrade(report.overall.authority_index) : "";

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-10">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Domain Authority Checker
        </h1>
        <p className="mt-2 text-white/60">
          Evidence-backed authority rating across 18 platforms. Enter a URL or brand name.
        </p>
      </div>

      <FeatureInstruction
        headline="How to use Domain Authority Checker"
        steps={[
          "Enter a URL or brand name in the search box below",
          "Review your overall authority score and letter grade",
          "Check platform-by-platform presence across 18 sources",
          "Focus on platforms where your brand is missing or weak",
        ]}
        benefit="Discover where your brand has the strongest third-party signals — the same signals AI models use to decide who to cite."
        accentClass="text-cyan-400 border-cyan-500/30 bg-cyan-500/[0.06]"
        defaultCollapsed
      />

      {/* Input form */}
      <form onSubmit={run} className="flex gap-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="https://example.com or Brand Name"
            className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-white placeholder:text-white/30 focus:border-cyan-400/40 focus:outline-none focus:ring-1 focus:ring-cyan-400/20"
            disabled={loading}
          />
        </div>
        <button
          type="submit"
          disabled={loading || !target.trim()}
          className="rounded-xl bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-400/30 px-6 py-3 font-semibold text-cyan-200 transition hover:border-cyan-400/50 disabled:opacity-40"
        >
          {loading ? "Scanning\u2026" : "Check Authority"}
        </button>
      </form>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-red-300">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center gap-4 py-16">
          <img src="/aivis-progress-spinner.png" alt="" className="h-10 w-10 animate-spin" />
          <p className="text-sm text-white/50">Scanning platforms… this may take 30–60 seconds.</p>
        </div>
      )}

      {/* Report */}
      <AnimatePresence>
        {report && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            {/* Overall score card */}
            <div className={`rounded-2xl border bg-gradient-to-br p-6 ${gradeBg(grade)}`}>
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
                <div className="flex items-center gap-5">
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/10 bg-black/30">
                    <span className={`text-4xl font-bold ${gradeColor(grade)}`}>{grade}</span>
                  </div>
                  <div>
                    <p className="text-sm text-white/50">Authority Index <InfoTip text="Composite score from citations, backlinks, and trust signals across 18 platforms. Higher = more likely to be cited by AI." /></p>
                    <p className="text-3xl font-bold text-white">{report.overall.authority_index}<span className="text-lg text-white/40">/100</span></p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-6 text-center">
                  <div>
                    <p className="text-2xl font-bold text-white">{report.overall.total_citations}</p>
                    <p className="text-xs text-white/50">Citations</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{report.overall.total_backlinks}</p>
                    <p className="text-xs text-white/50">Backlinks</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{report.platforms.filter((p) => p.citation_count > 0).length}</p>
                    <p className="text-xs text-white/50">Platforms</p>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3 text-xs">
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-emerald-300">
                  Organic: {report.overall.organic_pain_solution_count}
                </span>
                <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-sky-300">
                  Promo: {report.overall.direct_promo_count}
                </span>
                <span className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-red-300">
                  Spammy: {report.overall.spammy_count}
                </span>
              </div>

              <p className="mt-4 text-xs text-white/40">
                Checked: {new Date(report.checked_at).toLocaleString()} &middot; Target: {report.target} &middot; Mode: {report.mode}
              </p>
            </div>

            {/* Platform breakdown */}
            <div>
              <h2 className="mb-4 text-lg font-semibold text-white">Platform Breakdown</h2>
              <div className="space-y-3">
                {report.platforms
                  .sort((a, b) => b.authority_score - a.authority_score)
                  .map((p) => {
                    const pGrade = scoreGrade(p.authority_score);
                    const isExpanded = expandedPlatform === p.platform;
                    return (
                      <div key={p.platform} className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
                        <button
                          type="button"
                          className="flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-white/[0.03]"
                          onClick={() => setExpandedPlatform(isExpanded ? null : p.platform)}
                        >
                          <div className="flex items-center gap-4">
                            <span className={`text-lg font-bold ${gradeColor(pGrade)}`}>{p.authority_score}</span>
                            <span className="font-medium text-white">{platformLabel(p.platform)}</span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-white/50">
                            <span>{p.citation_count} citations</span>
                            {p.backlink_count > 0 && (
                              <span className="text-emerald-400">{p.backlink_count} backlink{p.backlink_count > 1 ? "s" : ""}</span>
                            )}
                            <span className="text-white/30">{isExpanded ? "\u25B2" : "\u25BC"}</span>
                          </div>
                        </button>

                        <AnimatePresence>
                          {isExpanded && p.items.length > 0 && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="border-t border-white/5"
                            >
                              <div className="space-y-2 p-4">
                                {p.items.map((item, idx) => (
                                  <div key={idx} className="flex items-start gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3">
                                    <div className="min-w-0 flex-1">
                                      <a
                                        href={item.source_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="line-clamp-1 text-sm font-medium text-cyan-200 hover:text-cyan-100"
                                      >
                                        {item.title} <ExternalLink className="mb-0.5 inline h-3 w-3" />
                                      </a>
                                      <p className="mt-1 line-clamp-2 text-xs text-white/50">{item.snippet}</p>
                                      <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
                                        <span className={`${natureColor(item.content_nature)} rounded-full border border-white/10 px-2 py-0.5`}>
                                          {natureLabel(item.content_nature)}
                                        </span>
                                        <span className="rounded-full border border-white/10 px-2 py-0.5 text-white/40">
                                          Score: {item.authority_score}
                                        </span>
                                        {item.backlink_found && (
                                          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-400">
                                            <CheckCircle2 className="mr-0.5 inline h-3 w-3" /> Backlink
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {isExpanded && p.items.length === 0 && (
                          <div className="border-t border-white/5 px-5 py-4 text-xs text-white/40">
                            No citations found on this platform.
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Audit notes */}
            {report.audit.notes.length > 0 && (
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/80">
                  <Shield className="h-4 w-4" /> Methodology
                </h3>
                <ul className="space-y-1.5 text-xs text-white/50">
                  {report.audit.notes.map((note, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-0.5 text-white/30">&bull;</span>
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-white/30">
                  Citation density: {report.audit.citation_density} &middot; Policy: {report.audit.policy}
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {!loading && !report && !error && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <TrendingUp className="h-12 w-12 text-white/15" />
          <p className="text-white/40">Enter a URL or brand name to check authority across 18 platforms.</p>
          <p className="text-xs text-white/25">Results include citations, backlinks, content nature, and trust signals.</p>
        </div>
      )}
    </div>
  );
}
