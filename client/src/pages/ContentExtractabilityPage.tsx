import { useState, useCallback, FormEvent } from "react";
import { motion } from "framer-motion";
import { checkContentExtractability } from "../api";
import { usePageMeta } from "../hooks/usePageMeta";

const HISTORY_KEY = "aivis-content-extractability";

interface ContentResult {
  url: string;
  status: number;
  responseTimeMs: number;
  score: number;
  grade: string;
  headings: {
    h1: string[];
    h2: string[];
    h3: string[];
    h4: string[];
    hierarchyScore: number;
  };
  content: {
    wordCount: number;
    paragraphCount: number;
    answerBlocks: number;
    avgSentenceWords: number;
    orderedLists: number;
    unorderedLists: number;
    tables: number;
    faqPatterns: number;
    definitionLists: number;
    detailsElements: number;
    contentScore: number;
  };
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

function Stat({ label, value, unit }: { label: string; value: number | string; unit?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center">
      <p className="text-white/50 text-xs mb-1">{label}</p>
      <p className="text-white font-bold text-lg">{value}{unit && <span className="text-xs text-white/40 ml-0.5">{unit}</span>}</p>
    </div>
  );
}

export default function ContentExtractabilityPage() {
  usePageMeta({
    title: "Content Extractability Grader \u2014 AI Answer Block Analysis",
    description: "Free tool to grade how well AI models can extract answers from your page. Analyzes heading hierarchy, FAQ patterns, answer-block density, and content structure.",
    path: "/tools/content-extractability",
  });

  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ContentResult | null>(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<ContentResult[]>(() => {
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
      const resp = await checkContentExtractability({ url: trimmed });
      if (!resp.success) throw new Error((resp as any).error || "Check failed");
      setResult(resp.result);
      const updated = [resp.result, ...history.filter((h) => h.url !== resp.result.url)].slice(0, 20);
      setHistory(updated);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    } catch (err: any) {
      setError(err?.message || "Failed to analyze content structure");
    } finally {
      setLoading(false);
    }
  }, [url, history]);

  const exportJson = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `content-extractability-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>

      <div>
        {/* Hero */}
        <section className="relative py-16 px-4 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-amber-600/8 via-transparent to-transparent" />
          <div className="relative text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-500/10 px-4 py-1.5 text-sm text-amber-300 mb-6">
              Free Tool - No Account Required
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Content<br />
              <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">Extractability Grader</span>
            </h1>
            <p className="text-lg text-white/60 max-w-2xl mx-auto">
              See how well AI answer engines can extract information from your page. Analyze heading structure, FAQ patterns, answer-block density, and content depth.
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
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-amber-400/50 focus:ring-1 focus:ring-amber-400/30"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 font-semibold text-white shadow-lg hover:shadow-amber-500/25 disabled:opacity-50 transition-all"
            >
              {loading ? "Analyzing…" : "Grade Content"}
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
                  <p className="text-sm text-white/50 mb-1">AI Extractability</p>
                  <div className="flex items-baseline gap-3">
                    <span className={`text-5xl font-black ${gradeColor(result.grade)}`}>{result.grade}</span>
                    <span className="text-2xl font-bold text-white">{result.score}/100</span>
                  </div>
                  <p className="text-sm text-white/50 mt-2">{result.url}</p>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <Stat label="Words" value={result.content.wordCount.toLocaleString()} />
                  <Stat label="Answer Blocks" value={result.content.answerBlocks} />
                  <Stat label="Response" value={result.responseTimeMs} unit="ms" />
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

            {/* Heading structure */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">Heading Hierarchy</h2>
                <span className={`text-sm font-bold ${result.headings.hierarchyScore >= 50 ? "text-emerald-400" : result.headings.hierarchyScore >= 30 ? "text-amber-400" : "text-red-400"}`}>
                  {result.headings.hierarchyScore}/75
                </span>
              </div>
              <div className="space-y-3">
                {[
                  { level: "H1", items: result.headings.h1, ideal: "1" },
                  { level: "H2", items: result.headings.h2, ideal: "2+" },
                  { level: "H3", items: result.headings.h3, ideal: "1+" },
                  { level: "H4", items: result.headings.h4, ideal: "optional" },
                ].map(({ level, items, ideal }) => (
                  <div key={level}>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-sm font-mono text-white/50 w-8">{level}</span>
                      <span className="text-sm text-white/80 font-semibold">{items.length} found</span>
                      <span className="text-xs text-white/30">ideal: {ideal}</span>
                    </div>
                    {items.length > 0 && (
                      <div className="ml-11 space-y-1">
                        {items.slice(0, 8).map((h, i) => (
                          <p key={i} className="text-xs text-white/50 truncate">{h}</p>
                        ))}
                        {items.length > 8 && <p className="text-xs text-white/30">+{items.length - 8} more</p>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Content metrics */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">Content Metrics</h2>
                <span className={`text-sm font-bold ${result.content.contentScore >= 50 ? "text-emerald-400" : result.content.contentScore >= 30 ? "text-amber-400" : "text-red-400"}`}>
                  {result.content.contentScore}/75
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Stat label="Paragraphs" value={result.content.paragraphCount} />
                <Stat label="Answer Blocks" value={result.content.answerBlocks} />
                <Stat label="FAQ Patterns" value={result.content.faqPatterns} />
                <Stat label="Avg Sentence" value={result.content.avgSentenceWords} unit="words" />
                <Stat label="Ordered Lists" value={result.content.orderedLists} />
                <Stat label="Unordered Lists" value={result.content.unorderedLists} />
                <Stat label="Tables" value={result.content.tables} />
                <Stat label="Details/DL" value={result.content.definitionLists + result.content.detailsElements} />
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
                    <span className="text-xs text-white/40">{h.content.wordCount.toLocaleString()} words</span>
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
