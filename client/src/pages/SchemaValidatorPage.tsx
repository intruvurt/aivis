import { useState, useCallback, FormEvent } from "react";
import { motion } from "framer-motion";
import { checkSchemaMarkup } from "../api";
import { usePageMeta } from "../hooks/usePageMeta";

const HISTORY_KEY = "aivis-schema-checks";

interface SchemaResult {
  url: string;
  status: number;
  responseTimeMs: number;
  score: number;
  grade: string;
  jsonLd: { count: number; types: string[]; raw: any[] };
  openGraph: Record<string, string>;
  twitterCard: Record<string, string>;
  metaDescription: string;
  canonical: string;
  signals: Record<string, boolean>;
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

function signalLabel(key: string): string {
  const map: Record<string, string> = {
    hasFAQ: "FAQ Schema",
    hasArticle: "Article / BlogPosting",
    hasHowTo: "HowTo Schema",
    hasOrg: "Organization",
    hasPerson: "Person",
    hasProduct: "Product",
    hasBreadcrumb: "BreadcrumbList",
    hasWebSite: "WebSite",
    hasWebPage: "WebPage",
  };
  return map[key] || key;
}

export default function SchemaValidatorPage() {
  usePageMeta({
    title: "Schema Markup Validator \u2014 AI Citation Readiness Check",
    description: "Free tool to validate your structured data (JSON-LD, OpenGraph, Twitter Cards) for AI citation readiness. See what AI models can extract from your page.",
    path: "/tools/schema-validator",
  });

  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SchemaResult | null>(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<SchemaResult[]>(() => {
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
      const resp = await checkSchemaMarkup({ url: trimmed });
      if (!resp.success) throw new Error((resp as any).error || "Check failed");
      setResult(resp.result);
      const updated = [resp.result, ...history.filter((h) => h.url !== resp.result.url)].slice(0, 20);
      setHistory(updated);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    } catch (err: any) {
      setError(err?.message || "Failed to check schema markup");
    } finally {
      setLoading(false);
    }
  }, [url, history]);

  const exportJson = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `schema-validator-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>

      <div>
        {/* Hero */}
        <section className="relative py-16 px-4 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-violet-600/8 via-transparent to-transparent" />
          <div className="relative max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-500/10 px-4 py-1.5 text-sm text-violet-300 mb-6">
              Free Tool — No Account Required
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Schema Markup<br />
              <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">Validator</span>
            </h1>
            <p className="text-lg text-white/60 max-w-2xl mx-auto">
              Check your structured data for AI citation readiness. See exactly what JSON-LD, OpenGraph, and meta signals AI models can extract from your page.
            </p>
          </div>
        </section>

        {/* Form */}
        <section className="max-w-4xl mx-auto px-4 pb-8">
          <form onSubmit={run} className="flex gap-3">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-violet-400/50 focus:ring-1 focus:ring-violet-400/30"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-6 py-3 font-semibold text-white shadow-lg hover:shadow-violet-500/25 disabled:opacity-50 transition-all"
            >
              {loading ? "Checking…" : "Validate"}
            </button>
          </form>
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        </section>

        {/* Results */}
        {result && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-5xl mx-auto px-4 pb-16 space-y-8"
          >
            {/* Score hero */}
            <div className={`rounded-2xl border bg-gradient-to-br p-6 ${gradeBg(result.grade)}`}>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <p className="text-sm text-white/50 mb-1">AI Citation Readiness</p>
                  <div className="flex items-baseline gap-3">
                    <span className={`text-5xl font-black ${gradeColor(result.grade)}`}>{result.grade}</span>
                    <span className="text-2xl font-bold text-white">{result.score}/100</span>
                  </div>
                  <p className="text-sm text-white/50 mt-2">{result.url}</p>
                </div>
                <div className="flex gap-3 text-sm">
                  <div className="rounded-lg bg-white/5 border border-white/10 px-4 py-2 text-center">
                    <p className="text-white/50 text-xs">JSON-LD</p>
                    <p className="text-white font-bold text-lg">{result.jsonLd.count}</p>
                  </div>
                  <div className="rounded-lg bg-white/5 border border-white/10 px-4 py-2 text-center">
                    <p className="text-white/50 text-xs">OG Tags</p>
                    <p className="text-white font-bold text-lg">{Object.keys(result.openGraph).length}</p>
                  </div>
                  <div className="rounded-lg bg-white/5 border border-white/10 px-4 py-2 text-center">
                    <p className="text-white/50 text-xs">Response</p>
                    <p className="text-white font-bold text-lg">{result.responseTimeMs}ms</p>
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

            {/* Schema signals */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
              <h2 className="text-lg font-bold text-white mb-4">Schema Signals Detected</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Object.entries(result.signals).map(([key, val]) => (
                  <div
                    key={key}
                    className={`rounded-xl border px-4 py-3 text-sm ${val ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-white/10 bg-white/5 text-white/40"}`}
                  >
                    <span className="mr-2">{val ? "✓" : "✗"}</span>
                    {signalLabel(key)}
                  </div>
                ))}
              </div>
            </div>

            {/* JSON-LD types */}
            {result.jsonLd.types.length > 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
                <h2 className="text-lg font-bold text-white mb-4">JSON-LD Types ({result.jsonLd.types.length})</h2>
                <div className="flex flex-wrap gap-2">
                  {result.jsonLd.types.map((t, i) => (
                    <span key={i} className="rounded-full bg-violet-500/15 border border-violet-400/25 px-3 py-1 text-sm text-violet-300">{t}</span>
                  ))}
                </div>
              </div>
            )}

            {/* OpenGraph */}
            {Object.keys(result.openGraph).length > 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
                <h2 className="text-lg font-bold text-white mb-4">OpenGraph Tags</h2>
                <div className="space-y-2">
                  {Object.entries(result.openGraph).map(([k, v]) => (
                    <div key={k} className="flex gap-3 text-sm">
                      <span className="text-white/50 font-mono w-40 shrink-0">{k}</span>
                      <span className="text-white/80 break-all">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Meta */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
              <h2 className="text-lg font-bold text-white mb-4">Meta Signals</h2>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-white/50 text-xs mb-1">Meta Description</p>
                  <p className="text-white/80">{result.metaDescription || <span className="text-red-400/70 italic">Not found</span>}</p>
                </div>
                <div>
                  <p className="text-white/50 text-xs mb-1">Canonical URL</p>
                  <p className="text-white/80 font-mono text-xs">{result.canonical || <span className="text-red-400/70 italic">Not found</span>}</p>
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
          <section className="max-w-5xl mx-auto px-4 pb-16">
            <h2 className="text-lg font-bold text-white mb-4">Recent Checks</h2>
            <div className="space-y-2">
              {history.slice(0, 10).map((h, i) => (
                <button
                  key={i}
                  onClick={() => { setUrl(h.url); setResult(h); }}
                  className="w-full flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-left hover:bg-white/5 transition"
                >
                  <span className="text-white/70 text-sm truncate">{h.url}</span>
                  <span className={`font-bold text-lg ${gradeColor(h.grade)}`}>{h.grade}</span>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
