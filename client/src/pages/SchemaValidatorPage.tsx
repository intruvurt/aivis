import { useState, useCallback, FormEvent } from "react";
import { motion } from "framer-motion";
import { checkSchemaMarkup } from "../api";
import { usePageMeta } from "../hooks/usePageMeta";
import FeatureInstruction from "../components/FeatureInstruction";
import ConversionCTA from "../components/ConversionCTA";
import PageQASection from "../components/PageQASection";
import { buildFaqSchema, buildWebPageSchema } from "../lib/seoSchema";

const SCHEMA_FAQ = [
  {
    question: "What structured data types matter most for AI citation eligibility?",
    answer: "The highest-impact schema types for AI citation are: FAQPage (enables direct FAQ extraction by AI answer engines), Article and BlogPosting (establishes content type and authorship for authority scoring), HowTo (structured step-by-step processes that AI models extract as procedural answers), Organization and Person (entity disambiguation for branded queries), Product and Service (used in commercial-intent AI responses), and BreadcrumbList (hierarchical context AI uses to situate page content within a site's topical structure). JSON-LD implementation is strongly preferred over Microdata or RDFa because it is machine-parseable without layout interference.",
  },
  {
    question: "Does schema markup directly cause AI citations?",
    answer: "Schema markup does not directly cause citations — but it significantly increases extraction confidence. AI answer engines use structured data as disambiguation and verification signals when determining if a page's claim is reliable enough to cite. A page with FAQPage schema expressing the same content as a competitor's unstructured paragraph will typically score higher on extraction confidence. The benefit is most measurable for entity-rich content: business information, product details, pricing, how-to instructions, and question-answer pairs.",
  },
  {
    question: "What does the schema validator check specifically?",
    answer: "This tool checks: JSON-LD presence and syntactic validity, schema type recognition against the AI-relevant subset of schema.org types, OpenGraph tag completeness (og:title, og:description, og:image, og:url), Twitter Card meta tags, and canonicalization signals. The report flags missing high-value types, broken JSON syntax, duplicate declarations, and OpenGraph property gaps that reduce AI platform sharing and extraction quality. Each finding is labeled with an impact level so you can prioritize which fixes to make first.",
  },
  {
    question: "How do I add schema markup to a page that already has content?",
    answer: "The fastest implementation method is to add a JSON-LD <script> tag to the <head> of your page. This doesn't require any changes to your visible HTML structure. In WordPress, plugins like Yoast SEO or Rank Math handle basic schema automatically. For custom sites, generate the JSON-LD object with your page's specific data and inject it server-side or via a script tag. For CMS-agnostic implementation, the minimum viable schema for most pages is a single FAQPage block with your three most-asked questions and direct answers in 40-80 words each.",
  },
  {
    question: "Why does OpenGraph data affect AI visibility?",
    answer: "OpenGraph metadata is used by AI platforms for link preview extraction and social entity resolution. When Perplexity, ChatGPT with browsing, and similar AI systems evaluate a page, they use og:title and og:description as secondary evidence for entity name and topic categorization — especially when the main content is difficult to parse. Missing og:image reduces the probability of platform-level link previews being generated, which limits the social distribution signals that contribute to authority scoring over time.",
  },
];

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
    structuredData: [
      buildWebPageSchema({
        path: "/tools/schema-validator",
        name: "Schema Markup Validator \u2014 AI Citation Readiness Check | AiVIS.biz",
        description: "Validate JSON-LD, OpenGraph, and Twitter Cards for AI citation readiness. Free tool to check what AI models can extract from your page's structured data.",
      }),
      buildFaqSchema(SCHEMA_FAQ, { path: "/tools/schema-validator" }),
    ],
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
          <div className="relative text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-500/10 px-4 py-1.5 text-sm text-violet-300 mb-6">
              Free Tool - No Account Required
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

        <div className="px-4 pb-4">
          <FeatureInstruction
            headline="How to use Schema Validator"
            steps={[
              "Enter any page URL to scan its structured data",
              "Review JSON-LD, OpenGraph, and Twitter Card signals found",
              "Check the issues list for missing or malformed markup",
              "Add recommended schema types to boost AI citation readiness",
            ]}
            benefit="Structured data is how AI models identify your content type, authorship, and key facts — the building blocks of citation."
            accentClass="text-violet-400 border-violet-500/30 bg-violet-500/[0.06]"
            defaultCollapsed
          />
        </div>

        {/* Form */}
        <section className="px-4 pb-8">
          <form onSubmit={run} className="flex gap-3">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="example.com"
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-violet-400/50 focus:ring-1 focus:ring-violet-400/30"
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
            className="px-4 pb-16 space-y-8"
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
                  <span className={`font-bold text-lg ${gradeColor(h.grade)}`}>{h.grade}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Educational: Structured Data & AI Citation Eligibility */}
        <section aria-label="About Schema Validator" className="px-4 pb-6 space-y-6 mt-8">
          <div className="rounded-2xl border border-white/10 bg-charcoal-deep p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white">How Structured Data Affects AI Citation Eligibility</h2>
            <p className="text-sm text-white/75 leading-relaxed">
              This tool evaluates nine categories of machine-readable structured data signals embedded in a
              webpage&apos;s HTML: Organization, Article, FAQ, HowTo, Product, Breadcrumb, WebSite, WebPage,
              and Person schemas. AI language models — including ChatGPT, Gemini, Perplexity, and Claude — use
              structured data to identify authorship, classify content type, extract entity relationships, and
              assess citation confidence. A page without JSON-LD schema forces AI systems to infer everything
              from raw text, which increases the probability of misattribution, partial citations, or being
              skipped entirely in favour of a competitor with cleaner structured signals.
            </p>
            <p className="text-sm text-white/75 leading-relaxed">
              Letter grades reflect schema coverage density and correctness. An{" "}
              <strong className="text-white">A grade</strong> means broad schema coverage with all required
              properties present. An <strong className="text-white">F grade</strong> indicates no detectable
              structured data — the page relies entirely on AI natural-language inference, making authoritative
              citation unlikely. Grades B through D represent partial implementations with missing required
              fields, incomplete author declarations, or schema blocks that exist but lack the properties AI
              parsers need to extract useful signal.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.04] p-5 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-rose-400">Failing Example — F grade</p>
              <p className="text-sm text-white/70 leading-relaxed">
                A product page with no JSON-LD. No{" "}
                <code className="text-white/85 bg-white/10 px-1 rounded text-xs">@type: &quot;Product&quot;</code>,
                no price, no publisher, no reviews. AI models cannot reliably attribute the product name to the
                brand. Perplexity is likely to surface a competitor&apos;s structured product page instead.
              </p>
              <ul className="text-xs text-rose-300/80 space-y-1 list-disc pl-4">
                <li>No Organization or author identity — entity is unresolvable</li>
                <li>No FAQPage — AI cannot extract Q&amp;A pairs for featured snippets</li>
                <li>Missing BreadcrumbList — AI cannot determine topic hierarchy</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Passing Example — A grade</p>
              <p className="text-sm text-white/70 leading-relaxed">
                The same page with{" "}
                <code className="text-white/85 bg-white/10 px-1 rounded text-xs">@type: &quot;Product&quot;</code>{" "}
                (name, brand, offers, aggregateRating), an{" "}
                <code className="text-white/85 bg-white/10 px-1 rounded text-xs">Organization</code> with{" "}
                <code className="text-white/85 bg-white/10 px-1 rounded text-xs">sameAs</code> links to
                authoritative profiles, and a{" "}
                <code className="text-white/85 bg-white/10 px-1 rounded text-xs">FAQPage</code> for common
                questions. AI models extract brand name, price range, and FAQ answers from structured sources —
                dramatically increasing citation accuracy and snippet frequency.
              </p>
              <ul className="text-xs text-emerald-300/80 space-y-1 list-disc pl-4">
                <li>Organization with sameAs — entity unambiguously identified</li>
                <li>FAQPage — Q&amp;A pairs directly extractable</li>
                <li>BreadcrumbList + Article — content type and hierarchy machine-readable</li>
              </ul>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-charcoal-deep p-6 space-y-4">
            <h3 className="text-base font-semibold text-white">Common Schema Errors &amp; How to Fix Them</h3>
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="text-white/85 font-medium">Missing <code className="bg-white/10 px-1 rounded text-xs">@type</code> property</dt>
                <dd className="text-white/60 mt-1">Every JSON-LD block must declare a type. Without it, validators and AI parsers ignore the entire block. Fix: add <code className="text-xs bg-white/10 px-1 rounded">&quot;@type&quot;: &quot;Article&quot;</code> (or the relevant type) as the first property.</dd>
              </div>
              <div>
                <dt className="text-white/85 font-medium">Organization missing <code className="bg-white/10 px-1 rounded text-xs">sameAs</code> links</dt>
                <dd className="text-white/60 mt-1">Without <code className="text-xs bg-white/10 px-1 rounded">sameAs</code> pointing to LinkedIn, Wikidata, or authoritative profiles, AI models cannot disambiguate your entity from others with the same name. Fix: add an array of confirmed external profile URLs.</dd>
              </div>
              <div>
                <dt className="text-white/85 font-medium">FAQPage with fewer than two Q&amp;A pairs</dt>
                <dd className="text-white/60 mt-1">A FAQ block with a single entry is unlikely to trigger AI extraction or Google FAQ rich results. Aim for 3–8 clearly written question-answer pairs that address real user intent.</dd>
              </div>
              <div>
                <dt className="text-white/85 font-medium">Article missing <code className="bg-white/10 px-1 rounded text-xs">author</code> and <code className="bg-white/10 px-1 rounded text-xs">datePublished</code></dt>
                <dd className="text-white/60 mt-1">AI models weigh recency and authorship heavily. An Article schema without a declared author and publish date is treated as anonymous, reducing citation trust signals for time-sensitive queries.</dd>
              </div>
            </dl>
          </div>
        </section>

        <ConversionCTA variant="free-tool" />
      </div>
      <PageQASection
        items={SCHEMA_FAQ}
        heading="Understanding schema markup for AI visibility"
        className="mt-6"
      />
    </>
  );
}
