import { useState, useCallback, FormEvent } from "react";
import { motion } from "framer-motion";
import { checkContentExtractability } from "../api";
import { usePageMeta } from "../hooks/usePageMeta";
import FeatureInstruction from "../components/FeatureInstruction";
import ConversionCTA from "../components/ConversionCTA";
import PageQASection from "../components/PageQASection";
import { buildFaqSchema, buildWebPageSchema } from "../lib/seoSchema";

const CONTENT_EXTRACTABILITY_FAQ = [
  {
    question: "What makes content extractable by AI answer engines?",
    answer: "Content extractability depends on five structural factors: answer-block density (sections that contain a direct question followed by a 40-120 word answer), heading hierarchy (H1/H2/H3 that signal topic organization without excessive nesting), paragraph brevity (claims expressed in 1-3 sentences rather than multi-paragraph blocks), evidence specificity (concrete numbers, comparisons, and named examples rather than vague generalities), and semantic HTML (proper use of <p>, <ul>, <section>, and <article> rather than div-heavy layouts that obscure content structure from parsers).",
  },
  {
    question: "Why does AI extraction differ from search engine crawling?",
    answer: "Search engines primarily look at link signals, keyword density, and domain authority to rank pages. AI answer engines extract content differently: they parse for direct answer patterns, entity definitions, and evidence-backed claims that can be surfaced in a conversational response. A page that ranks well in Google Search but scores poorly on extractability may do so because it is optimized for keyword placement and link acquisition rather than structured, citable information architecture. The two optimization goals increasingly diverge as AI-generated answers handle more query types.",
  },
  {
    question: "What is an answer-block and how do I create one?",
    answer: "An answer-block is a section of content structured to directly answer a specific question. The minimum viable template is: (1) an H2 or H3 heading phrased as the question, (2) a 60-100 word paragraph that answers it directly with a concrete claim in the first sentence, (3) optional supporting evidence such as a list, comparison, or example. Pages with 3-5 well-formed answer blocks per 1000 words of content consistently outperform those without in AI citation rate comparisons, because they reduce the inference work the model must do to determine what the page is claiming.",
  },
  {
    question: "Does content length affect extractability scores?",
    answer: "Raw length does not improve extractability — density does. A 600-word page with three well-formed answer blocks scores higher than a 3000-word page with the same information buried in discursive prose. The extractability grader evaluates the ratio of citable content to total content length, heading-to-paragraph ratio, and the presence of structured lists and definition patterns, not total word count. Over-long content that frontloads generalities before getting to the answer typically scores poorly on direct answer confidence.",
  },
  {
    question: "How does FAQ section structure affect AI citation rates?",
    answer: "FAQ sections dramatically improve extractability scores because they already mirror the question-answer extraction pattern AI models use. FAQs should be: implemented as real HTML heading+paragraph pairs (not just visual styling), covered by FAQPage JSON-LD schema, placed in page sections that are early in the DOM and not hidden behind tabs or accordions that require JavaScript interaction, and written with direct answers in the first sentence rather than preamble-heavy responses. FAQ sections implemented this way can generate direct citation events for the specific questions users ask AI platforms.",
  },
];

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
    structuredData: [
      buildWebPageSchema({
        path: "/tools/content-extractability",
        name: "Content Extractability Grader \u2014 AI Answer Block Analysis | AiVIS",
        description: "Grade how well AI models can extract answers from your page. Free analysis of heading hierarchy, FAQ structure, answer-block density, and content extractability for AI citations.",
      }),
      buildFaqSchema(CONTENT_EXTRACTABILITY_FAQ, { path: "/tools/content-extractability" }),
    ],
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

        <div className="px-4 pb-4">
          <FeatureInstruction
            headline="How to use Content Extractability Grader"
            steps={[
              "Enter a page URL to analyze its content structure",
              "Review heading hierarchy, FAQ patterns, and answer blocks",
              "Check the issues list for structural improvements",
              "Restructure content so AI models can extract clear, citable answers",
            ]}
            benefit="AI models prefer content with clear headings, FAQ blocks, and concise answer paragraphs — structured content gets cited more."
            accentClass="text-amber-400 border-amber-500/30 bg-amber-500/[0.06]"
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
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-amber-400/50 focus:ring-1 focus:ring-amber-400/30"
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

        {/* Educational: Content Structure & AI Extractability */}
        <section aria-label="About Content Extractability" className="px-4 pb-6 space-y-6 mt-8">
          <div className="rounded-2xl border border-white/10 bg-charcoal-deep p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white">How Content Structure Determines AI Extraction Quality</h2>
            <p className="text-sm text-white/75 leading-relaxed">
              This tool measures five structural dimensions that govern how reliably AI language models can
              extract, summarise, and cite your content: heading hierarchy conformance (H1 → H2 → H3 depth
              and order), total word count, paragraph density, list-element presence (ordered and unordered),
              and answer-block patterns — structured question-answer pairs that AI models preferentially extract
              for featured snippets and direct answers. A page that scores poorly on these dimensions forces
              AI into probabilistic summarisation, which often produces generic or inaccurate paraphrases
              rather than authoritative direct-answer citations.
            </p>
            <p className="text-sm text-white/75 leading-relaxed">
              Word count thresholds reflect minimum extractable substance: pages under 300 words are classified
              as thin content and are routinely skipped by AI answer engines that require sufficient context
              depth. Pages between 600 and 1200 words hit the core extractability window, where AI models can
              identify a primary claim, supporting evidence, and a conclusion — the three-part structure
              required for a coherent answer citation. Pages above 1200 words with clean heading hierarchy are
              treated as authoritative sources and are disproportionately cited in long-form AI answers.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.04] p-5 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-rose-400">Failing Example — F grade (score: 15)</p>
              <p className="text-sm text-white/70 leading-relaxed">
                A 200-word page consisting of a single H1 followed by one unbroken paragraph. No sub-headings,
                no lists, no question-answer pairs. AI models classify this as thin content. The lack of
                structural anchors means the AI cannot identify which sentence represents the key claim versus
                supporting context, resulting in low-confidence extraction or a full skip.
              </p>
              <ul className="text-xs text-rose-300/80 space-y-1 list-disc pl-4">
                <li>200 words — below the 300-word thin-content threshold</li>
                <li>No H2/H3 sub-headings — AI cannot segment content into extractable units</li>
                <li>Wall-of-text paragraph — no structural signal for primary claim location</li>
                <li>Zero answer blocks — AI cannot produce a direct-answer citation</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Passing Example — A grade (score: 85)</p>
              <p className="text-sm text-white/70 leading-relaxed">
                An 850-word page with one H1, four H2 section sub-headings, two ordered lists, and a
                dedicated FAQ section using question-phrased H3 headings each followed by a direct-answer
                paragraph. AI models can segment this page into five discrete extractable units, identify the
                primary claim from the H1, and cite specific FAQ answers verbatim in direct-answer responses.
              </p>
              <ul className="text-xs text-emerald-300/80 space-y-1 list-disc pl-4">
                <li>850 words — above the 600-word core extractability threshold</li>
                <li>H1 → H2 → H3 hierarchy — clean content segmentation for AI</li>
                <li>FAQ with H3 + answer paragraphs — directly extractable for featured snippets</li>
                <li>Ordered lists — step-by-step processes are numbered and easily cited</li>
              </ul>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-charcoal-deep p-6 space-y-4">
            <h3 className="text-base font-semibold text-white">Content Structure Fixes for AI Citation Readiness</h3>
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="text-white/85 font-medium">Break content into H2-headed sections</dt>
                <dd className="text-white/60 mt-1">Each major topic cluster should have its own H2 heading. AI extraction algorithms use heading tags as section anchors. A flat, heading-free page forces the AI to segment by sentence heuristics, which is far less accurate than semantic heading boundaries.</dd>
              </div>
              <div>
                <dt className="text-white/85 font-medium">Add at least one FAQ-style section</dt>
                <dd className="text-white/60 mt-1">Question-phrased H3 headings (<em>What is X? How does Y work?</em>) immediately followed by a direct-answer paragraph are the most reliably cited content format across ChatGPT, Perplexity, and Gemini. Pair with FAQPage JSON-LD for double coverage.</dd>
              </div>
              <div>
                <dt className="text-white/85 font-medium">Replace walls of text with structured paragraphs</dt>
                <dd className="text-white/60 mt-1">Limit each paragraph to 3–5 sentences that address a single sub-point. Paragraphs over 150 words are harder for AI to extract cleanly — the model must decide where the main claim begins, increasing paraphrase error rate in citations.</dd>
              </div>
              <div>
                <dt className="text-white/85 font-medium">Use ordered lists for processes, unordered for features</dt>
                <dd className="text-white/60 mt-1">Ordered lists signal step-by-step procedures that AI citation engines reproduce in sequence. Unordered lists are used for parallel feature sets. Mixing them (numbered lists for features, bullet lists for steps) confuses AI sequence extraction and reduces citation usefulness.</dd>
              </div>
            </dl>
          </div>
        </section>

        <ConversionCTA variant="free-tool" />
      </div>
      <PageQASection
        items={CONTENT_EXTRACTABILITY_FAQ}
        heading="Understanding content extractability for AI answers"
        className="mt-6"
      />
    </>
  );
}
