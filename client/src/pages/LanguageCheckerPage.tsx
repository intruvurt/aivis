import { useState, useCallback, FormEvent } from "react";
import { motion } from "framer-motion";
import { checkLanguage } from "../api";
import { usePageMeta } from "../hooks/usePageMeta";
import FeatureInstruction from "../components/FeatureInstruction";
import ConversionCTA from "../components/ConversionCTA";
import PageQASection from "../components/PageQASection";
import { buildFaqSchema, buildWebPageSchema } from "../lib/seoSchema";

const LANGUAGE_CHECKER_FAQ = [
  {
    question: "Why does html[lang] matter for AI answer visibility?",
    answer: "The html[lang] attribute tells AI crawlers, screen readers, and search engines what language your page is written in. AI models use language metadata to match your content to locale-specific queries — a page without a lang attribute is more likely to be misclassified and served to the wrong language audience or excluded from language-filtered retrievals. For multilingual sites, missing or incorrect lang attributes mean pages may not appear in the AI-generated answers for their target language market even when the content quality is high.",
  },
  {
    question: "What is hreflang and when do I need it?",
    answer: "Hreflang tags (<link rel='alternate' hreflang='...'>) tell search engines and AI crawlers that multiple URL versions of the same content exist for different languages or regions, and specify which URL is canonical for each locale. You need hreflang if your site serves the same content in multiple languages (e.g., en, fr, de versions of the same page) or if you serve regionally different content to the same language audience (e.g., en-US vs en-GB). Without hreflang, AI models may cite the wrong regional version of your page or dilute citation signals across your language variants.",
  },
  {
    question: "What is the x-default hreflang tag?",
    answer: "The x-default hreflang value specifies which page should be served to users whose language or region doesn't match any defined hreflang variant. This is typically the language selector page or the default-language version of your content. AI models use x-default as a fallback resolution path when the user's detected locale doesn't match an explicit hreflang pair. Without x-default, international citation events may send users to the wrong regional version or encounter a 404 on a mismatched locale URL.",
  },
  {
    question: "How does charset declaration affect content parsing?",
    answer: "The Content-Type charset declaration (e.g., charset=UTF-8 in the HTTP header or <meta charset='utf-8'> in the HTML head) tells parsers how to decode byte sequences into characters. An incorrect or missing charset causes malformed text rendering in AI parser outputs, especially for content that includes special characters, diacritics, or non-ASCII punctuation. UTF-8 should be declared universally. If your charset is mismatched between the HTTP header and the HTML meta tag, behavior is browser-dependent and can produce parsing artifacts that reduce extraction confidence.",
  },
  {
    question: "Can RTL language content be extracted by AI models?",
    answer: "Yes, provided the RTL direction is properly declared via dir='rtl' on the html element and the language is specified in html[lang] with an appropriate BCP 47 language tag (e.g., lang='ar' for Arabic, lang='he' for Hebrew). AI models trained on multilingual data can extract and cite RTL content. The main failure mode is content that sets dir='rtl' but uses lang='en', causing language-model mismatch and reduced citation relevance for the intended locale. Consistent lang + dir + charset declaration is the minimum requirement for reliable multilingual extraction.",
  },
];

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
    structuredData: [
      buildWebPageSchema({
        path: "/tools/language-checker",
        name: "Language & Hreflang Checker \u2014 Multilingual AI Visibility | AiVIS.biz",
        description: "Audit html[lang], hreflang, x-default, charset, and RTL language signals for multilingual AI visibility. Free language and internationalization checker.",
      }),
      buildFaqSchema(LANGUAGE_CHECKER_FAQ, { path: "/tools/language-checker" }),
    ],
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

        {/* Educational: Language, Locale & AI Extraction */}
        <section aria-label="About Language Checker" className="px-4 pb-6 space-y-6 mt-8">
          <div className="rounded-2xl border border-white/10 bg-charcoal-deep p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white">Why Language Signals Determine AI Citation Targeting</h2>
            <p className="text-sm text-white/75 leading-relaxed">
              This tool inspects four internationalisation signals that directly control how AI language models
              classify, route, and extract content for language-specific answer generation: the{" "}
              <code className="text-white/85 bg-white/10 px-1 rounded text-xs">html[lang]</code>{" "}
              attribute on the root element, BCP 47 language tag validity, hreflang annotations for
              multi-regional content, and character encoding declaration. When these signals are absent or
              malformed, AI systems must guess the language and locale of a page from statistical inference
              alone — a process that introduces classification errors and reduces citation confidence for
              non-English or multilingual content.
            </p>
            <p className="text-sm text-white/75 leading-relaxed">
              The <code className="text-white/85 bg-white/10 px-1 rounded text-xs">html[lang]</code> attribute is
              the primary language declaration parsed by AI crawlers. A valid BCP 47 tag such as{" "}
              <code className="text-white/85 bg-white/10 px-1 rounded text-xs">en-US</code> or{" "}
              <code className="text-white/85 bg-white/10 px-1 rounded text-xs">fr-FR</code> tells the AI which
              linguistic model to apply when extracting and understanding the content. Values like{" "}
              <code className="text-white/85 bg-white/10 px-1 rounded text-xs">english</code> or{" "}
              <code className="text-white/85 bg-white/10 px-1 rounded text-xs">en_US</code> (underscore instead of
              hyphen) are invalid under BCP 47 and are treated as unknown locale, degrading extraction quality.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.04] p-5 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-rose-400">Failing Example — F grade</p>
              <p className="text-sm text-white/70 leading-relaxed">
                A multilingual site with{" "}
                <code className="text-white/85 bg-white/10 px-1 rounded text-xs">&lt;html lang=&quot;english&quot;&gt;</code>{" "}
                (invalid BCP 47), no hreflang annotations, and{" "}
                <code className="text-white/85 bg-white/10 px-1 rounded text-xs">charset=&quot;ISO-8859-1&quot;</code>.
                AI models misclassify the language, cannot determine the canonical locale for multilingual
                queries, and risk character-encoding corruption when extracting non-ASCII text.
              </p>
              <ul className="text-xs text-rose-300/80 space-y-1 list-disc pl-4">
                <li>Invalid lang tag — AI language classifier falls back to probabilistic inference</li>
                <li>No hreflang — AI cannot determine which locale serves which region</li>
                <li>Non-UTF-8 charset — risk of extraction corruption for accented characters</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Passing Example — A grade</p>
              <p className="text-sm text-white/70 leading-relaxed">
                <code className="text-white/85 bg-white/10 px-1 rounded text-xs">&lt;html lang=&quot;en-US&quot;&gt;</code>,{" "}
                <code className="text-white/85 bg-white/10 px-1 rounded text-xs">&lt;meta charset=&quot;UTF-8&quot;&gt;</code>,
                and hreflang annotations covering all language variants including a self-referencing tag and an
                <code className="text-white/85 bg-white/10 px-1 rounded text-xs">x-default</code> fallback. AI
                models correctly identify the language, map locale-specific content to the right user context,
                and extract content without encoding issues.
              </p>
              <ul className="text-xs text-emerald-300/80 space-y-1 list-disc pl-4">
                <li>Valid BCP 47 lang tag — AI language classifier is deterministic</li>
                <li>Self-referencing hreflang + x-default — canonical locale unambiguous</li>
                <li>UTF-8 charset — full Unicode range extractable without corruption</li>
              </ul>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-charcoal-deep p-6 space-y-4">
            <h3 className="text-base font-semibold text-white">Language Signal Checklist for AI Citation Readiness</h3>
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="text-white/85 font-medium">Missing <code className="bg-white/10 px-1 rounded text-xs">html[lang]</code></dt>
                <dd className="text-white/60 mt-1">Add <code className="text-xs bg-white/10 px-1 rounded">&lt;html lang=&quot;en-US&quot;&gt;</code> (or the appropriate region-subtag) to every page. This single attribute is the most impactful language signal and is read by every major AI crawler before any page content is parsed.</dd>
              </div>
              <div>
                <dt className="text-white/85 font-medium">Missing <code className="bg-white/10 px-1 rounded text-xs">x-default</code> hreflang</dt>
                <dd className="text-white/60 mt-1">For multilingual sites, <code className="text-xs bg-white/10 px-1 rounded">&lt;link rel=&quot;alternate&quot; hreflang=&quot;x-default&quot;&gt;</code> signals the fallback page for users whose language is not explicitly covered. Without it, AI models cannot determine the canonical URL for ambiguous locale queries.</dd>
              </div>
              <div>
                <dt className="text-white/85 font-medium">Self-referencing hreflang omitted</dt>
                <dd className="text-white/60 mt-1">Every hreflang implementation must include a tag pointing back to the current page&apos;s own URL and language. Without the self-reference, some AI crawlers treat the hreflang set as incomplete and fall back to inference rather than using your declared locale mapping.</dd>
              </div>
              <div>
                <dt className="text-white/85 font-medium">RTL language without <code className="bg-white/10 px-1 rounded text-xs">dir=&quot;rtl&quot;</code></dt>
                <dd className="text-white/60 mt-1">Right-to-left languages (Arabic, Hebrew, Farsi) require <code className="text-xs bg-white/10 px-1 rounded">dir=&quot;rtl&quot;</code> on the html element alongside the lang tag. Without it, AI extraction order may be reversed, corrupting extracted text sequences in summarisation tasks.</dd>
              </div>
            </dl>
          </div>
        </section>

        <ConversionCTA variant="free-tool" />
      </div>
      <PageQASection
        items={LANGUAGE_CHECKER_FAQ}
        heading="Understanding language signals for multilingual AI visibility"
        className="mt-6"
      />
    </>
  );
}
