import { useState, useCallback, FormEvent } from "react";
import { motion } from "framer-motion";
import { checkLanguage } from "../api";
import { usePageMeta } from "../hooks/usePageMeta";
import FeatureInstruction from "../components/FeatureInstruction";
import ConversionCTA from "../components/ConversionCTA";

const HISTORY_KEY = "aivis-language-checks";

interface HreflangTag {
  lang: string;
  href: string;
  validLang: boolean;
}

interface LangResult {
  url: string;
  status: number;
  responseTimeMs: number;
  score: number;
  grade: string;
  htmlLang: string | null;
  htmlLangValid: boolean;
  charset: string | null;
  contentLanguageHeader: string | null;
  dir: string | null;
  isRtl: boolean;
  hreflang: {
    count: number;
    tags: HreflangTag[];
    hasXDefault: boolean;
    selfReferencing: boolean;
    languages: string[];
    invalidCodes: string[];
  };
  issues: string[];
  checkedAt: string;
}

function gradeColor(g: string) {
  if (g === "A") return "text-emerald-400";
  if (g === "B") return "text-sky-400";
  if (g === "C") return "text-violet-400";
  if (g === "D") return "text-amber-400";
  return "text-red-400";
}

function gradeBg(g: string) {
  if (g === "A") return "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30";
  if (g === "B") return "from-sky-500/20 to-sky-500/5 border-sky-500/30";
  if (g === "C") return "from-violet-500/20 to-violet-500/5 border-violet-500/30";
  if (g === "D") return "from-amber-500/20 to-amber-500/5 border-amber-500/30";
  return "from-red-500/20 to-red-500/5 border-red-500/30";
}

function BoolBadge({ ok, yes, no }: { ok: boolean; yes: string; no: string }) {
  return ok ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs text-emerald-400 border border-emerald-500/25">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> {yes}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs text-red-400 border border-red-500/25">
      <span className="h-1.5 w-1.5 rounded-full bg-red-400" /> {no}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <p className="text-white/50 text-xs mb-1">{label}</p>
      <p className="text-white font-semibold text-sm font-mono">{value ?? <span className="text-white/30 italic">none</span>}</p>
    </div>
  );
}

export default function LanguageCheckerPage() {
  usePageMeta({
    title: "Language & Hreflang Checker \u2014 Multilingual AI Visibility Audit",
    description: "Free tool to audit your page's language signals for AI models. Checks html[lang], hreflang tags, x-default, charset, RTL direction, and Content-Language headers.",
    path: "/tools/language-checker",
  });

  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LangResult | null>(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<LangResult[]>(() => {
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
      const resp = await checkLanguage({ url: trimmed });
      if (!resp.success) throw new Error((resp as any).error || "Check failed");
      setResult(resp.result);
      const updated = [resp.result, ...history.filter((h: LangResult) => h.url !== resp.result.url)].slice(0, 20);
      setHistory(updated);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    } catch (err: any) {
      setError(err?.message || "Failed to check language signals");
    } finally {
      setLoading(false);
    }
  }, [url, history]);

  const exportJson = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `language-check-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>
      <div>
        {/* Hero */}
        <section className="relative py-16 px-4 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-violet-600/8 via-transparent to-transparent" />
          <div className="relative text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-500/10 px-4 py-1.5 text-sm text-violet-300 mb-6">
              Free Tool — No Account Required
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Language &amp;<br />
              <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">Hreflang Checker</span>
            </h1>
            <p className="text-lg text-white/60 max-w-2xl mx-auto">
              Audit your page's multilingual signals for AI crawler readiness. Checks html[lang], hreflang tags, x-default, charset encoding, RTL direction, and Content-Language headers.
            </p>
          </div>
        </section>

        <div className="px-4 pb-4">
          <FeatureInstruction
            headline="How to use the Language Checker"
            steps={[
              "Enter a page URL to audit its language and internationalisation signals",
              "Review the html[lang] value and BCP 47 validity",
              "Check hreflang tags for x-default and self-referencing entries",
              "Fix issues so AI models can route queries to the correct language version",
            ]}
            benefit="AI models serve answers in the user's language. Correct lang declarations and hreflang tags ensure they find and cite your content instead of a competitor's translation."
            accentClass="text-violet-400 border-violet-500/30 bg-violet-500/[0.06]"
            defaultCollapsed
          />
        </div>

        {/* Form */}
        <section className="px-4 pb-8">
          <form onSubmit={run} className="flex gap-3">
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://yourdomain.com"
              required
              className="flex-1 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3 text-white placeholder-white/30 outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/40 transition-all text-sm"
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 px-5 py-3 text-white font-semibold text-sm transition-colors whitespace-nowrap"
            >
              {loading ? "Checking…" : "Check Language"}
            </button>
          </form>
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        </section>

        {/* Result */}
        {result && (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-4 pb-12 space-y-6"
          >
            {/* Score card */}
            <div className={`rounded-2xl border bg-gradient-to-br p-6 ${gradeBg(result.grade)}`}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-white/50 text-xs uppercase tracking-wider mb-1">Language Signal Score</p>
                  <div className="flex items-end gap-3">
                    <span className={`text-6xl font-black ${gradeColor(result.grade)}`}>{result.grade}</span>
                    <span className="text-2xl font-bold text-white/70 mb-1">{result.score}/100</span>
                  </div>
                  <p className="text-white/40 text-xs mt-1.5 font-mono">{result.url}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="text-white/40 text-xs">{result.responseTimeMs}ms · HTTP {result.status}</span>
                  <button
                    onClick={exportJson}
                    className="text-xs text-violet-400 hover:text-violet-300 border border-violet-500/30 rounded-lg px-3 py-1.5 transition-colors"
                  >
                    Export JSON
                  </button>
                </div>
              </div>
            </div>

            {/* Core language signals */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Language Signals</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
                <Stat label="html[lang]" value={result.htmlLang} />
                <Stat label="Charset" value={result.charset} />
                <Stat label="Content-Language Header" value={result.contentLanguageHeader} />
                <Stat label="dir attribute" value={result.dir} />
              </div>
              <div className="flex flex-wrap gap-2">
                <BoolBadge ok={!!result.htmlLang} yes="lang declared" no="lang missing" />
                <BoolBadge ok={result.htmlLangValid} yes="Valid BCP 47" no="Invalid BCP 47" />
                {result.htmlLang && ['ar','he','fa','ur'].includes(result.htmlLang.split('-')[0]) && (
                  <BoolBadge ok={result.isRtl} yes="RTL set" no="RTL missing" />
                )}
                <BoolBadge
                  ok={result.charset === 'utf-8' || result.charset === 'utf8'}
                  yes="UTF-8 charset"
                  no={result.charset ? `Charset: ${result.charset}` : "No charset"}
                />
              </div>
            </div>

            {/* Hreflang section */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-white font-semibold mb-1 text-sm uppercase tracking-wider">
                Hreflang Tags
                <span className="ml-2 text-white/40 font-normal normal-case text-xs">({result.hreflang.count} found)</span>
              </h2>
              <p className="text-white/40 text-xs mb-4">Every page in a multilingual set must include hreflang entries referencing all language versions plus an x-default fallback.</p>

              {result.hreflang.count > 0 ? (
                <>
                  <div className="flex flex-wrap gap-2 mb-4">
                    <BoolBadge ok={result.hreflang.hasXDefault} yes="x-default present" no="x-default missing" />
                    <BoolBadge ok={result.hreflang.selfReferencing} yes="Self-referencing" no="No self-reference" />
                    {result.hreflang.invalidCodes.length === 0
                      ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs text-emerald-400 border border-emerald-500/25"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Valid lang codes</span>
                      : <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs text-red-400 border border-red-500/25"><span className="h-1.5 w-1.5 rounded-full bg-red-400" /> Invalid codes: {result.hreflang.invalidCodes.join(', ')}</span>
                    }
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-white/10">
                          <th className="text-left text-white/40 font-medium pb-2 pr-4">Lang</th>
                          <th className="text-left text-white/40 font-medium pb-2 pr-4">Valid</th>
                          <th className="text-left text-white/40 font-medium pb-2">href</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.hreflang.tags.map((t, i) => (
                          <tr key={i} className="border-b border-white/5">
                            <td className="py-1.5 pr-4 font-mono text-white/80">{t.lang}</td>
                            <td className="py-1.5 pr-4">
                              {t.validLang
                                ? <span className="text-emerald-400">✓</span>
                                : <span className="text-red-400">✗</span>
                              }
                            </td>
                            <td className="py-1.5 text-white/40 truncate max-w-xs">{t.href || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p className="text-white/40 text-sm italic">
                  No hreflang tags found. If this is a single-language site, none are needed. For multilingual sites, add hreflang tags with an x-default entry.
                </p>
              )}
            </div>

            {/* Issues */}
            {result.issues.length > 0 && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.04] p-6">
                <h2 className="text-white font-semibold mb-3 text-sm uppercase tracking-wider">Issues ({result.issues.length})</h2>
                <ul className="space-y-2">
                  {result.issues.map((issue, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-white/70">
                      <span className="text-red-400 mt-0.5 shrink-0">•</span>
                      {issue}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.issues.length === 0 && (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4 text-center text-sm text-emerald-400">
                No language signal issues detected — this page is well-configured for multilingual AI routing.
              </div>
            )}
          </motion.section>
        )}

        {/* History */}
        {history.length > 0 && !result && (
          <section className="px-4 pb-12">
            <h2 className="text-white/50 text-xs uppercase tracking-wider mb-3">Recent checks</h2>
            <div className="space-y-2">
              {history.slice(0, 10).map((h, i) => (
                <button
                  key={i}
                  onClick={() => { setUrl(h.url); setResult(h); }}
                  className="w-full flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 hover:bg-white/[0.06] transition-colors text-left"
                >
                  <span className="text-white/70 text-sm truncate">{h.url}</span>
                  <span className={`shrink-0 ml-3 font-bold text-sm ${gradeColor(h.grade)}`}>{h.grade}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        <ConversionCTA />
      </div>
    </>
  );
}
