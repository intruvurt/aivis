import { useState, useCallback, FormEvent } from "react";
import { motion } from "framer-motion";
import { checkRobotsAccess } from "../api";
import { usePageMeta } from "../hooks/usePageMeta";

const HISTORY_KEY = "aivis-robots-checks";

interface BotDirective {
  name: string;
  owner: string;
  status: "allowed" | "blocked" | "not-specified";
  critical: boolean;
}

interface RobotsResult {
  url: string;
  robotsUrl: string;
  robotsFound: boolean;
  robots: BotDirective[];
  meta: {
    metaRobots: string;
    xRobotsTag: string;
    metaNoindex: boolean;
    metaNofollow: boolean;
    headerNoindex: boolean;
    headerNofollow: boolean;
  };
  summary: {
    totalBots: number;
    allowed: number;
    blocked: number;
    notSpecified: number;
    criticalAllowed: number;
    criticalBlocked: number;
  };
  score: number;
  grade: string;
  issues: string[];
  checkedAt: string;
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

function statusColor(s: string) {
  if (s === "allowed") return "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
  if (s === "blocked") return "text-red-400 border-red-500/30 bg-red-500/10";
  return "text-white/40 border-white/10 bg-white/5";
}

function statusIcon(s: string) {
  if (s === "allowed") return "✓";
  if (s === "blocked") return "✗";
  return "?";
}

export default function RobotsCheckerPage() {
  usePageMeta({
    title: "AI Crawler Access Checker \u2014 Robots.txt Audit for AI Bots",
    description: "Free tool to check if GPTBot, ClaudeBot, Googlebot, and 12 other AI crawlers can access your site. Audit robots.txt, meta robots, and X-Robots-Tag directives.",
    path: "/tools/robots-checker",
  });

  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RobotsResult | null>(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<RobotsResult[]>(() => {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); } catch { return []; }
  });

  const run = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const resp = await checkRobotsAccess({ url: trimmed });
      if (!resp.success) throw new Error((resp as any).error || "Check failed");
      setResult(resp.result);
      const updated = [resp.result, ...history.filter((h) => h.url !== resp.result.url)].slice(0, 20);
      setHistory(updated);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    } catch (err: any) {
      setError(err?.message || "Failed to check robots access");
    } finally {
      setLoading(false);
    }
  }, [url, history]);

  const exportJson = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `robots-checker-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>
      <div>
        {/* Hero */}
        <section className="relative py-16 px-4 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-cyan-600/8 via-transparent to-transparent" />
          <div className="relative text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-4 py-1.5 text-sm text-cyan-300 mb-6">
              Free Tool — No Account Required
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              AI Crawler<br />
              <span className="bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">Access Checker</span>
            </h1>
            <p className="text-lg text-white/60 max-w-2xl mx-auto">
              Find out which AI bots can access your content. Audit robots.txt for GPTBot, ClaudeBot, Google-Extended, PerplexityBot, and 11 more AI crawlers.
            </p>
          </div>
        </section>

        {/* Form */}
        <section className="px-4 pb-8">
          <form onSubmit={run} className="flex gap-3">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/30"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 px-6 py-3 font-semibold text-white shadow-lg hover:shadow-cyan-500/25 disabled:opacity-50 transition-all"
            >
              {loading ? "Checking…" : "Check Access"}
            </button>
          </form>
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        </section>

        {/* Results */}
        {result && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-4 pb-16 space-y-8"
          >
            {/* Score hero */}
            <div className={`rounded-2xl border bg-gradient-to-br p-6 ${gradeBg(result.grade)}`}>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <p className="text-sm text-white/50 mb-1">AI Crawler Accessibility</p>
                  <div className="flex items-baseline gap-3">
                    <span className={`text-5xl font-black ${gradeColor(result.grade)}`}>{result.grade}</span>
                    <span className="text-2xl font-bold text-white">{result.score}/100</span>
                  </div>
                  <p className="text-sm text-white/50 mt-2">{result.url}</p>
                </div>
                <div className="flex gap-3 text-sm">
                  <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 text-center">
                    <p className="text-white/50 text-xs">Allowed</p>
                    <p className="text-emerald-400 font-bold text-lg">{result.summary.allowed}</p>
                  </div>
                  <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-2 text-center">
                    <p className="text-white/50 text-xs">Blocked</p>
                    <p className="text-red-400 font-bold text-lg">{result.summary.blocked}</p>
                  </div>
                  <div className="rounded-lg bg-white/5 border border-white/10 px-4 py-2 text-center">
                    <p className="text-white/50 text-xs">Unspecified</p>
                    <p className="text-white/40 font-bold text-lg">{result.summary.notSpecified}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Issues */}
            {result.issues.length > 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
                <h2 className="text-lg font-bold text-white mb-4">Issues Found ({result.issues.length})</h2>
                <ul className="space-y-2">
                  {result.issues.map((issue, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <span className="mt-0.5 w-5 h-5 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 text-xs font-bold shrink-0">!</span>
                      <span className="text-white/70">{issue}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Bot directory */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
              <h2 className="text-lg font-bold text-white mb-4">AI Crawler Directory ({result.robots.length} bots)</h2>
              <div className="space-y-2">
                {/* Critical bots first */}
                {result.robots
                  .sort((a, b) => (b.critical ? 1 : 0) - (a.critical ? 1 : 0))
                  .map((bot, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-4 rounded-xl border px-4 py-3 ${statusColor(bot.status)}`}
                    >
                      <span className="text-lg font-bold w-6 text-center">{statusIcon(bot.status)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">
                          {bot.name}
                          {bot.critical && <span className="ml-2 text-xs opacity-60 font-normal">Critical</span>}
                        </p>
                        <p className="text-xs opacity-60 truncate">{bot.owner}</p>
                      </div>
                      <span className="text-xs font-mono uppercase opacity-70">{bot.status}</span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Meta directives */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
              <h2 className="text-lg font-bold text-white mb-4">Page-Level Directives</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs text-white/50 mb-2">Meta Robots</p>
                  <p className="text-sm text-white/80 font-mono">{result.meta.metaRobots || "Not set"}</p>
                  <div className="mt-2 flex gap-2">
                    {result.meta.metaNoindex && <span className="text-xs rounded bg-red-500/20 text-red-400 px-2 py-0.5">noindex</span>}
                    {result.meta.metaNofollow && <span className="text-xs rounded bg-orange-500/20 text-orange-400 px-2 py-0.5">nofollow</span>}
                    {!result.meta.metaNoindex && !result.meta.metaNofollow && result.meta.metaRobots && (
                      <span className="text-xs rounded bg-emerald-500/20 text-emerald-400 px-2 py-0.5">OK</span>
                    )}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs text-white/50 mb-2">X-Robots-Tag Header</p>
                  <p className="text-sm text-white/80 font-mono">{result.meta.xRobotsTag || "Not set"}</p>
                  <div className="mt-2 flex gap-2">
                    {result.meta.headerNoindex && <span className="text-xs rounded bg-red-500/20 text-red-400 px-2 py-0.5">noindex</span>}
                    {result.meta.headerNofollow && <span className="text-xs rounded bg-orange-500/20 text-orange-400 px-2 py-0.5">nofollow</span>}
                    {!result.meta.headerNoindex && !result.meta.headerNofollow && result.meta.xRobotsTag && (
                      <span className="text-xs rounded bg-emerald-500/20 text-emerald-400 px-2 py-0.5">OK</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button onClick={exportJson} className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm text-white/70 hover:bg-white/10 transition">
                Export JSON
              </button>
            </div>
          </motion.section>
        )}

        {/* History */}
        {history.length > 0 && !loading && (
          <section className="px-4 pb-16">
            <h2 className="text-lg font-bold text-white mb-4">Recent Checks</h2>
            <div className="space-y-2">
              {history.slice(0, 10).map((h, i) => (
                <button
                  key={i}
                  onClick={() => { setUrl(h.url); setResult(h); }}
                  className="w-full flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-left hover:bg-white/5 transition"
                >
                  <span className="text-white/70 text-sm truncate">{h.url}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-white/40">{h.summary.blocked} blocked</span>
                    <span className={`font-bold text-lg ${gradeColor(h.grade)}`}>{h.grade}</span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
