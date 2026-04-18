import React from "react";
import { Link } from "react-router-dom";
import { ChevronDown, FlaskConical, ShieldCheck, Sparkles, AlertTriangle, CheckCircle2, Search, FileCode2, BarChart3, Layers } from "lucide-react";
import { usePageMeta } from "../hooks/usePageMeta";
import PublicPageFrame from "../components/PublicPageFrame";
import { BRAG_ACRONYM, BRAG_EXPANSION, BRAG_TRAIL_LABEL } from "@shared/types";
import {
  buildWebPageSchema,
  buildBreadcrumbSchema,
  buildFaqSchema,
} from "../lib/seoSchema";

const BRAG_PROTOCOL_LABEL = `${BRAG_TRAIL_LABEL} protocol`;

/* ─── Scoring dimensions ─────────────────────────────────────────────── */

const dimensions = [
  {
    name: "Content Depth & Quality",
    weight: "20 %",
    icon: Layers,
    signals:
      "Word count, topical coverage breadth, factual claim density, evidence presence, explanatory depth, and originality of claims. AI models compress pages into latent representations — a page with shallow content produces a weak, easily overridden representation.",
    whyItMatters:
      "When two sources cover the same topic, AI models preferentially extract from the source with denser, more specific claims. Thin pages are treated as confirmatory noise, not primary sources.",
  },
  {
    name: "Schema & Structured Data",
    weight: "20 %",
    icon: FileCode2,
    signals:
      "JSON-LD presence, type appropriateness (Organization, Article, FAQ, Product, HowTo), relationship completeness, entity references, and schema validity. AiVIS.biz evaluates over 18 schema.org types.",
    whyItMatters:
      "Structured data is the only machine-readable declaration of what a page is, who published it, and when. Without JSON-LD, AI models must infer entity identity from context — and they frequently infer incorrectly.",
  },
  {
    name: "AI Readability & Citability",
    weight: "20 %",
    icon: Search,
    signals:
      "Direct answer density, Q&A structure, extractable factual claims, concise phrasing, answer completeness, and resistance to hallucination triggers.",
    whyItMatters:
      "AI answer engines extract fragments, not full pages. Content that embeds clear, atomic claims surrounded by supporting context is extracted more faithfully than prose-heavy narrative.",
  },
  {
    name: "Technical SEO",
    weight: "15 %",
    icon: ShieldCheck,
    signals:
      "Robots.txt crawler access (GPTBot, ClaudeBot, PerplexityBot, Googlebot, Applebot-Extended), sitemap presence, canonical correctness, HTTPS enforcement, and crawl governance files including llms.txt.",
    whyItMatters:
      "If an AI crawler is blocked at the robots.txt level, the rest of the audit is irrelevant. Technical access is the floor on which all other signals stand.",
  },
  {
    name: "Meta Tags & Open Graph",
    weight: "13 %",
    icon: BarChart3,
    signals:
      "Title specificity, meta description quality, Open Graph completeness, canonical URL consistency, hreflang presence, and image metadata.",
    whyItMatters:
      "AI models use meta descriptions and OG tags as pre-compressed summaries. A missing or generic description forces the model to generate its own — introducing distortion risk.",
  },
  {
    name: "Heading Structure & H1",
    weight: "12 %",
    icon: AlertTriangle,
    signals:
      "Single H1 presence, title-H1 alignment, heading hierarchy logic, section density, specificity of sub-headings, and question-oriented structure.",
    whyItMatters:
      "Headings are the primary structural signal for AI extraction. A page with a logical H1 → H2 → H3 hierarchy is parsed into a coherent outline; a flat or duplicated heading structure produces fragmented, unreliable extraction.",
  },
] as const;

/* ─── Score bands ────────────────────────────────────────────────────── */

const scoreBands = [
  {
    badge: "A — Excellent",
    range: "80 – 100",
    tone: "bg-emerald-500/15 text-emerald-300 border-emerald-400/20",
    description: "Consistently citable, structurally strong, and accurately extractable across major AI answer engines. Content at this level is routinely used as a primary source.",
  },
  {
    badge: "B — Good",
    range: "60 – 79",
    tone: "bg-green-500/15 text-green-300 border-green-400/20",
    description: "Generally citation-ready with a small number of structural or trust gaps. Typically fixable with targeted schema, heading, or metadata improvements.",
  },
  {
    badge: "C — Fair",
    range: "40 – 59",
    tone: "bg-amber-500/15 text-amber-300 border-amber-400/20",
    description: "Parseable but frequently deprioritized by AI models against structurally stronger competitors. Extraction errors and entity confusion are common.",
  },
  {
    badge: "D — Poor",
    range: "20 – 39",
    tone: "bg-orange-500/15 text-orange-300 border-orange-400/20",
    description: "Significant structural barriers reduce AI trust and extraction quality. Most findings at this level are high-confidence, high-impact issues.",
  },
  {
    badge: "F — Critical",
    range: "0 – 19",
    tone: "bg-red-500/15 text-red-300 border-red-400/20",
    description: "The page is not practically citable in its current state. AI models either cannot access the content or cannot reliably extract any usable claims.",
  },
] as const;

/* ─── BRAG protocol steps ────────────────────────────────────────────── */

const bragSteps = [
  {
    letter: "B",
    title: "Build from observed fields",
    text: "Every finding starts from a crawl-observable field — HTML element, JSON-LD block, meta tag, or server response header. If a signal cannot be traced to an observed artifact on the page, it is excluded from the audit report. This eliminates speculative recommendations.",
  },
  {
    letter: "R",
    title: "Reference explicit evidence",
    text: "Each finding includes a BRAG Evidence ID that links directly to the source signal, the extraction rule that triggered the finding, and the scoring dimension it affects. Teams can independently verify every issue without re-running the audit.",
  },
  {
    letter: "A",
    title: "Audit recommendation linkage",
    text: "Recommendations are never orphaned. Every suggested fix maps back to the specific finding it addresses, the evidence that produced the finding, and the expected score impact. This prevents the common failure mode of generic advice disconnected from actual page state.",
  },
  {
    letter: "G",
    title: "Ground claims in stored outputs",
    text: "Final scores and extraction snapshots are stored as immutable baselines. When a page is re-audited, score movement is computed against the prior stored output — not against a re-calculated reconstruction. This keeps historical comparisons stable and reproducible across audit sessions.",
  },
] as const;

/* ─── Execution pipeline ─────────────────────────────────────────────── */

const pipelineSteps = [
  {
    title: "Crawl and extraction",
    text: "The target URL is fetched via a headless browser that executes JavaScript. AiVIS.biz extracts the full HTML structure, all JSON-LD blocks, meta tags, Open Graph data, heading hierarchy, robots directives, canonical signals, and raw text content. This extraction baseline is the foundation for every downstream finding.",
  },
  {
    title: "Dimension scoring",
    text: "Each of the seven dimensions is scored independently against the extracted fields. Weights are applied after individual scoring, not before. This prevents a strong performance in one area from masking a critical failure in another.",
  },
  {
    title: "Evidence mapping",
    text: "Low-scoring items are mapped to concrete page evidence — the specific HTML element, the missing JSON-LD property, or the malformed meta tag. AiVIS.biz does not generate recommendations from generic best-practice databases. Every finding is grounded in what was actually observed on the page.",
  },
  {
    title: "AI model analysis",
    text: "Paid tiers send the extraction baseline through the AI analysis pipeline. Starter and Alignment tiers receive single-model analysis. Signal tier activates the triple-check pipeline: GPT-5 Mini deep analysis → Claude Sonnet 4.6 peer critique (score adjustment −15 to +10) → Grok 4.1 Fast validation gate. Each model operates on the same extraction baseline.",
  },
  {
    title: "Confidence classification",
    text: "Every finding is tagged with a confidence level: deterministic (crawl-verifiable), high-confidence (model-validated), or advisory (model-suggested, not crawl-deterministic). Teams can filter by confidence to focus effort on the most actionable issues first.",
  },
  {
    title: "Score storage and baseline commit",
    text: "The complete audit report — score, dimension breakdown, evidence IDs, recommendations, and extraction snapshot — is persisted to the analysis cache. Future re-audits compare against this stored baseline, enabling precise delta tracking: which findings were fixed, which regressed, and which are new.",
  },
] as const;

/* ─── CITE LEDGER evidence pipeline ──────────────────────────────────── */

const citeLedgerPhases = [
  {
    phase: "Extraction",
    input: "Raw DOM / HTML",
    transformation:
      "Denoising — ML identifies non-content elements (ads, sidebars, boilerplate) based on patterns learned from previous audit removals. Elements that were consistently excluded in historical audits are deprioritized automatically.",
    output: "Cleaned Data Packet",
  },
  {
    phase: "Alignment",
    input: "Cleaned Packet",
    transformation:
      "Semantic Mapping — ML aligns extracted text to known entity schemas found in historically successful citations. Extracted fragments are matched against structural patterns that produced citable evidence in prior audits.",
    output: "Structured JSON-LD",
  },
  {
    phase: "Validation",
    input: "Structured Data",
    transformation:
      "Hallucination Scoring — Cross-references the citation coordinates with the stable DOM anchor. Every structured claim is validated against the immutable extraction snapshot to confirm it was actually observed on the page.",
    output: "Citable Evidence",
  },
] as const;

const citeLedgerPrinciples = [
  {
    title: "Lock the upstream",
    text: "The SERP fetch → Cloudflare Render path is the only source of truth. No extraction bypasses, no manual content injection. The pipeline is deterministic from crawl to evidence.",
  },
  {
    title: "Audit-integrated scoring",
    text: "ML scoring runs after DOM stabilization but before citation finalization. Evidence that passes the reliability threshold (≥ 0.98) earns a citation handle. Evidence below the threshold is flagged as volatile and excluded from the citable record.",
  },
  {
    title: "Fix-cycle training",
    text: "Every manual correction to a citation produces a delta between the scraped value and the fixed value. That delta is fed back into the ML model to refine future extraction — turning each audit-fix cycle into a training signal.",
  },
  {
    title: "Deterministic mapping",
    text: "Every citation contains a unique hash that resolves back to the original rendered HTML source. The audit trail is fully reversible: from final citation handle → structured evidence → cleaned extraction → raw DOM snapshot.",
  },
] as const;

/* ─── Methodology FAQ ────────────────────────────────────────────────── */

const methodologyFaq = [
  {
    question: "What does the AiVIS.biz score actually measure?",
    answer:
      "The AiVIS.biz score measures how confidently AI answer engines can parse, trust, extract from, and cite a page. It is a weighted composite across seven evidence-backed dimensions: schema coverage (20%), content depth (18%), metadata quality (15%), technical SEO (15%), AI readability (12%), heading structure (10%), and security & trust (10%). The score is not a generic SEO grade — it is specific to AI extraction fidelity.",
  },
  {
    question: `What is the ${BRAG_TRAIL_LABEL}?`,
    answer:
      `${BRAG_ACRONYM} stands for ${BRAG_EXPANSION}. It is the evidence protocol that ensures every finding and recommendation in an AiVIS.biz audit maps back to a crawl-observable signal. The protocol eliminates speculative recommendations and makes every finding independently verifiable.`,
  },
  {
    question: "What score is usually required to be citation-ready?",
    answer:
      "Pages scoring above 70 are generally in strong shape for AI citation. Most competitive situations reward pages in the mid-to-high 70s or above. However, citation eligibility also depends on the competitive landscape — a page scoring 75 may be outperformed by a competitor scoring 85 on the same topic.",
  },
  {
    question: "Why are some findings marked advisory instead of deterministic?",
    answer:
      "Deterministic findings are crawl-verifiable — the evidence exists directly in page source. Advisory findings are surfaced by AI model analysis and represent likely issues that cannot be confirmed from the crawl alone. Both are useful, but advisory findings carry lower confidence and should be evaluated case by case.",
  },
  {
    question: "How does AiVIS.biz differ from traditional SEO audit tools?",
    answer:
      "Traditional SEO tools measure rank position, backlink profiles, and keyword density. AiVIS.biz measures whether AI answer engines can structurally extract, trust, and accurately cite a page. The audit surfaces extraction failures — missing schema, blocked crawlers, entity ambiguity, shallow content — not ranking signals.",
  },
  {
    question: "What is the triple-check pipeline?",
    answer:
      "Signal tier activates a three-model consensus pipeline: (1) GPT-5 Mini performs deep analysis, (2) Claude Sonnet 4.6 runs a peer critique that can adjust the score by −15 to +10 points and add additional recommendations, (3) Grok 4.1 Fast validates or overrides the final score. This reduces single-model bias and improves scoring reliability for high-stakes audits.",
  },
  {
    question: "Can the score change without any page modifications?",
    answer:
      "AI model behavior and extraction patterns evolve. A page that was once well-extracted may score differently as model architecture changes. AiVIS.biz stores baseline snapshots to track this drift — if a score changes without page modifications, the delta report shows which model-side factors shifted.",
  },
  {
    question: "Does AiVIS.biz guarantee citation by ChatGPT, Perplexity, or other models?",
    answer:
      "No. AiVIS.biz measures structural readiness for citation — whether a page provides the signals AI models need to extract and cite content accurately. Actual citation depends on query relevance, competitive content, and model-specific behavior. AiVIS.biz improves the probability of accurate citation, not the certainty of it.",
  },
  {
    question: "What is the CITE LEDGER?",
    answer:
      "CITE LEDGER is a structured attribution system developed by AiVIS that tracks how AI models interpret, reference, and cite web content across answer engines like ChatGPT, Perplexity, Google AI Overviews, and Claude. Every validated audit finding is recorded in a sequential, verifiable evidence chain where each entry carries a BRAG ID, content fingerprint, and traceability link connecting it to its predecessor. The pipeline uses three phases: Extraction (denoising raw DOM), Alignment (semantic mapping to entity schemas), and Validation (hallucination scoring against stable DOM anchors). Only evidence scoring above a 0.98 reliability threshold earns a citation handle.",
  },
] as const;

/* ─── Platform aggregate stats ───────────────────────────────────────── */

const platformStats = [
  { value: "14,200+", label: "Audits run", note: "All-time across all platform tiers" },
  { value: "39 / 100", label: "Average visibility score", note: "Median composite across all audited pages" },
  { value: "71%", label: "Fail structured data checks", note: "Missing or invalid JSON-LD on crawl" },
  { value: "58%", label: "Block at least one AI crawler", note: "GPTBot, ClaudeBot, or PerplexityBot disallowed in robots.txt" },
  { value: "67%", label: "Missing a clean H1 hierarchy", note: "No H1, duplicate H1, or H1/title mismatch" },
  { value: "+18 pts", label: "Avg score lift after first fix cycle", note: "Based on pages re-audited after applying BRAG recommendations" },
] as const;

/* ─── 7 most common extraction failures ─────────────────────────────── */

const failureModes = [
  {
    rank: "01",
    title: "Crawler blocked before extraction begins",
    stat: "58% of audited pages",
    detail: "A robots.txt Disallow for GPTBot, ClaudeBot, or PerplexityBot terminates the extraction pipeline at step one. The page is permanently invisible to that AI engine regardless of content quality. This is the most silent failure — no error is surfaced to the site owner.",
    fix: "Add explicit Allow directives for known AI crawlers in robots.txt. Verify with: User-agent: GPTBot / Allow: /",
  },
  {
    rank: "02",
    title: "No JSON-LD — entity identity is unknown to the model",
    stat: "71% of audited pages",
    detail: "Without Organization or Article schema, AI models cannot determine who published the content, when it was written, or whether it is still accurate. Unnamed sources are deprioritized during answer reconstruction. The model treats the page as an anonymous fragment.",
    fix: "Add Organization schema with name, url, sameAs, and description. Add Article schema with datePublished and author on all content pages.",
  },
  {
    rank: "03",
    title: "Client-side-only rendering returns an empty HTML shell",
    stat: "~22% of SPA pages",
    detail: "AI crawlers do not execute JavaScript. React, Vue, and Angular apps without SSR or static generation serve an empty document to the crawler. The model receives no content to extract — the page effectively does not exist in the AI index.",
    fix: "Enable SSR or static generation (Next.js, Nuxt, Astro). Confirm by fetching the page with curl — if the response body lacks real content, the crawler sees nothing.",
  },
  {
    rank: "04",
    title: "Content too shallow to compress into a strong representation",
    stat: "43% of audited pages under 600 words",
    detail: "AI models compress pages into dense latent representations. Pages with fewer than 500–600 words of substantive text produce weak representations that are outcompeted by denser sources covering the same topic. The page is accessed and parsed — then overridden.",
    fix: "Target 800–1,500 words minimum on topical pages. Each section should lead with a claim, follow with supporting context, and close with a verifiable source signal.",
  },
  {
    rank: "05",
    title: "Heading hierarchy is flat, skipped, or duplicated",
    stat: "67% missing a clean H1→H2→H3 structure",
    detail: "AI extraction segments content into chunks using heading boundaries. A flat structure (all H2, no H3) produces undifferentiated chunks. Duplicate H1s force the model to arbitrarily choose which heading represents the page's primary claim. Both patterns reduce extraction accuracy.",
    fix: "One H1 per page, matching the title tag. H2s for major topics. H3s for sub-topics. Never skip levels (H1 → H3 with no H2 is an extraction hazard).",
  },
  {
    rank: "06",
    title: "Meta description is generic, templated, or absent",
    stat: "52% absent or generic filler",
    detail: "AI models use meta descriptions as pre-compressed page summaries during initial retrieval scoring. A missing or generic description forces the model to generate its own summary, introducing distortion risk — the generated summary may not match the page's actual claims.",
    fix: "Write a specific 120–155 character meta description containing the primary claim, entity name, and the exact topic addressed. Do not use the same description across multiple pages.",
  },
  {
    rank: "07",
    title: "Content structure buries claims in prose rather than exposing them",
    stat: "61% of D-grade and F-grade pages",
    detail: "Prose-heavy narrative that embeds claims inside long sentences compresses poorly. AI models extract from pages that lead with atomic, independently verifiable claims supported by context. Pages written as essays produce weaker, less faithful reconstructions than pages written as claim-first structured content.",
    fix: "Lead every section with a direct answer or claim. Follow with supporting evidence. Use FAQ blocks, numbered steps, and definition callouts to surface extractable claims at the paragraph boundary.",
  },
] as const;

/* ─── Component ──────────────────────────────────────────────────────── */

export default function MethodologyPage() {
  usePageMeta({
    title: "AiVIS.biz Methodology | CITE LEDGER & BRAG Evidence Protocol",
    description:
      `How AiVIS.biz audits AI answer readiness: six weighted dimensions, the CITE LEDGER evidence pipeline, and the ${BRAG_PROTOCOL_LABEL} that ground every finding in crawl-observable data.`,
    path: "/methodology",
    ogTitle: "AiVIS.biz Methodology — CITE LEDGER & BRAG Evidence Protocol",
    ogDescription:
      `Complete scoring framework: CITE LEDGER pipeline, ${BRAG_PROTOCOL_LABEL}, six dimension weights, triple-check consensus, and methodology FAQ.`,
    ogType: "article",
    structuredData: [
      buildWebPageSchema({
        path: "/methodology",
        name: "AiVIS.biz Methodology — CITE LEDGER & BRAG Evidence Protocol",
        description:
          "CITE LEDGER evidence pipeline, BRAG protocol, six weighted dimensions, execution pipeline, triple-check consensus, score bands, and methodology FAQ.",
      }),
      buildBreadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "Methodology", path: "/methodology" },
      ]),
      buildFaqSchema(
        methodologyFaq.map((item) => ({ question: item.question, answer: item.answer })),
        { path: "/methodology" }
      ),
    ],
  });

  return (
    <PublicPageFrame
      icon={FlaskConical}
      title="How AiVIS.biz audits AI answer readiness"
      subtitle="Scoring methodology, evidence protocol, and the pipeline that turns extraction analysis into actionable fixes."
      backTo="/"
      maxWidthClass="max-w-5xl"
    >
      {/* ── Introduction ──────────────────────────────────────────────── */}
      <section className="space-y-6">
        {/* Answer-extractable direct definition */}
        <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/[0.04] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300/70 mb-3">What the AiVIS.biz score measures</p>
          <p className="text-base leading-7 text-white/88 font-medium">
            The AiVIS.biz score measures whether an AI answer engine can structurally access, parse, trust, and cite a page. It is not an SEO score. It does not measure rankings, backlinks, or keyword density. It measures extraction fidelity: can an AI model reproduce your content accurately when reconstructing an answer?
          </p>
        </div>

        <div className="space-y-4">
          <p className="text-base leading-7 text-white/64">
            AI answer engines do not rank pages — they extract fragments, compress them into internal representations, and reconstruct answers. A page that ranks #1 in Google may score below 30 in AiVIS.biz if the extraction pipeline fails silently.
          </p>
          <p className="text-base leading-7 text-white/64">
            Every AiVIS.biz finding traces back to a crawl-observable signal: an HTML element, JSON-LD block, meta tag, or server header. The audit score is a weighted composite across six dimensions, each targeting a distinct failure point in the AI extraction pipeline.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-white"><ShieldCheck className="h-4 w-4 text-emerald-300" /> Evidence-grounded</div>
            <p className="mt-3 text-sm leading-6 text-white/64">Every recommendation is tied back to crawl evidence. If AiVIS.biz cannot observe it on the page, it does not claim it as a finding.</p>
          </article>
          <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-white"><Sparkles className="h-4 w-4 text-orange-300" /> Extraction-first</div>
            <p className="mt-3 text-sm leading-6 text-white/64">A page can rank #1 in Google and score below 40 in AiVIS.biz. Traditional search ranking and AI extraction fidelity are independent problems with independent fixes.</p>
          </article>
        </div>
      </section>

      {/* ── Platform aggregate data ───────────────────────────────────── */}
      <section className="mt-12">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
          <h2 className="text-2xl font-semibold tracking-tight text-white">Platform aggregate data</h2>
          <span className="text-xs text-white/35 border border-white/10 rounded-full px-3 py-1">Aggregate only · No individual data exposed</span>
        </div>
        <p className="mb-5 text-sm leading-6 text-white/56">
          These figures are computed from audits run through AiVIS.biz. They reflect structural patterns across the full audited page set and are used to calibrate score band thresholds and dimension weightings. Individual results vary significantly.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {platformStats.map((stat) => (
            <div key={stat.label} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-2xl font-bold text-cyan-300 tabular-nums">{stat.value}</p>
              <p className="mt-1 text-sm font-semibold text-white">{stat.label}</p>
              <p className="mt-1 text-xs text-white/45">{stat.note}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Composite formula ────────────────────────────────────────── */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight text-white">Composite scoring formula</h2>
        <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300/70">Weighted model</p>
          <p className="mt-3 text-sm leading-7 text-white/66">
            Score = Content Depth × 0.20 + Schema Coverage × 0.20 + AI Readability × 0.20 + Technical SEO × 0.15 + Metadata Quality × 0.13 + Heading Structure × 0.12
          </p>
          <p className="mt-4 text-sm leading-7 text-white/54">
            Each dimension is scored independently from 0 to 100 before weighting is applied. Weights are calibrated from aggregate patterns across 14,000+ audits and reflect each dimension's measured impact on AI extraction fidelity. Content, schema, and readability carry the heaviest weights because they determine whether AI models can extract, attribute, and accurately cite content.
          </p>
        </div>
      </section>

      {/* ── 7 most common extraction failures ───────────────────────── */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight text-white">The 7 most common extraction failures</h2>
        <p className="mt-3 text-sm leading-6 text-white/60">
          Ranked by frequency across audited pages. Each failure mode suppresses AI citation probability without affecting traditional search rankings — sites experiencing them rarely know it until they audit.
        </p>
        <div className="mt-6 space-y-3">
          {failureModes.map((mode) => (
            <article key={mode.rank} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-start gap-4">
                <span className="text-xs font-mono font-bold text-white/22 shrink-0 pt-0.5 tabular-nums">{mode.rank}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h3 className="text-base font-semibold text-white">{mode.title}</h3>
                    <span className="text-xs font-semibold text-amber-300/80 bg-amber-400/10 border border-amber-400/20 rounded-full px-2 py-0.5 shrink-0">{mode.stat}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-white/60">{mode.detail}</p>
                  <p className="mt-2 text-xs leading-5 text-cyan-300/70"><span className="font-semibold text-cyan-300/90">Fix →</span> {mode.fix}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ── Dimension weights ────────────────────────────────────────────── */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight text-white">Dimension weights</h2>
        <p className="mt-3 text-base leading-7 text-white/60">
          Each dimension targets a specific failure point in the AI extraction pipeline. Strong performance across all six means AI models have everything they need to extract, attribute, and reproduce your content accurately.
        </p>
        <div className="mt-6 grid gap-4">
          {dimensions.map((dimension) => (
            <article key={dimension.name} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <dimension.icon className="h-4 w-4 text-cyan-300/60" />
                    <h3 className="text-lg font-semibold text-white">{dimension.name}</h3>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-white/64"><span className="text-white/50 font-medium">Signals:</span> {dimension.signals}</p>
                  <p className="mt-2 text-sm leading-6 text-white/54"><span className="text-white/50 font-medium">Why it matters:</span> {dimension.whyItMatters}</p>
                </div>
                <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-cyan-200 shrink-0">{dimension.weight}</div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ── BRAG protocol + Execution pipeline ───────────────────────── */}
      <section className="mt-12 grid gap-10 lg:grid-cols-2">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-white">{BRAG_TRAIL_LABEL} protocol</h2>
          <p className="mt-3 text-sm leading-7 text-white/56">
            {BRAG_ACRONYM} ({BRAG_EXPANSION}) is the evidence framework that governs every AiVIS.biz audit. It enforces a chain of traceability from raw page observation to final recommendation — eliminating the gap between "best practice advice" and "evidence-backed diagnosis."
          </p>
          <div className="mt-5 space-y-4">
            {bragSteps.map((step) => (
              <article key={step.letter} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-orange-400/12 text-sm font-semibold text-orange-200">{step.letter}</span>
                  <h3 className="text-base font-semibold text-white">{step.title}</h3>
                </div>
                <p className="mt-3 text-sm leading-6 text-white/64">{step.text}</p>
              </article>
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-white">Execution pipeline</h2>
          <p className="mt-3 text-sm leading-7 text-white/56">
            Every audit follows the same six-stage pipeline. The pipeline is deterministic through stage 3 (crawl evidence only). Stages 4–5 introduce AI model analysis on paid tiers. Stage 6 commits the result as an immutable baseline for future comparison.
          </p>
          <div className="mt-5 space-y-4">
            {pipelineSteps.map((step, index) => (
              <article key={step.title} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/42">Step {index + 1}</p>
                <h3 className="mt-2 text-base font-semibold text-white">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-white/64">{step.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── CITE LEDGER: from BRAG evidence to citable data ──────────── */}
      <section id="cite-ledger" className="mt-12 scroll-mt-24">
        <h2 className="text-2xl font-semibold tracking-tight text-white">CITE LEDGER — from BRAG evidence to citable data</h2>
        <p className="mt-3 text-base leading-7 text-white/64">
          <strong className="text-white/88">CITE LEDGER</strong> is a structured attribution system developed by AiVIS that tracks how AI models interpret, reference, and cite web content across answer engines like ChatGPT, Perplexity, Google AI Overviews, and Claude. BRAG ({BRAG_EXPANSION}) is the evidence protocol. CITE LEDGER is the structured record each audit produces — the transformation layer that converts messy scraped content into deterministic, citable ground truth. ML is not used as a generator. It operates as a <em>deterministic filter</em>: its job is to reject any scraped evidence that does not meet the structural requirements for a valid citation.
        </p>

        {/* Audit-Fix ML Feedback Loop */}
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-white mb-2">The audit-fix ML feedback loop</h3>
          <p className="text-sm leading-6 text-white/56 mb-5">
            The ML model is trained on audit failures (where citations were rejected or incorrect) and manual fixes (human corrections to data). Each phase transforms the data closer to citation-ready state.
          </p>
          <div className="space-y-3">
            {citeLedgerPhases.map((phase) => (
              <article key={phase.phase} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:gap-5">
                  <div className="shrink-0">
                    <span className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200">{phase.phase}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/45 mb-2">
                      <span><span className="font-medium text-white/55">Input:</span> {phase.input}</span>
                      <span><span className="font-medium text-white/55">Output:</span> {phase.output}</span>
                    </div>
                    <p className="text-sm leading-6 text-white/64">{phase.transformation}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        {/* Evidence transformation */}
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-white mb-2">Transforming scraped evidence into citations</h3>
          <p className="text-sm leading-6 text-white/56 mb-5">
            For data to be citable, it must transition from subjective interpretation to objective reference. The pipeline enforces this through three layers.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-300/70 mb-2">Upstream</p>
              <h4 className="text-base font-semibold text-white">Evidence capture</h4>
              <p className="mt-2 text-sm leading-6 text-white/64">The system captures the DOM snapshot and Computed CSS at the moment of extraction. This evidence is non-negotiable and forms the permanent base layer of every CITE LEDGER record.</p>
            </article>
            <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300/70 mb-2">ML Auditor</p>
              <h4 className="text-base font-semibold text-white">Stability classification</h4>
              <p className="mt-2 text-sm leading-6 text-white/64">A classifier trained on citable vs. non-citable data evaluates DOM element stability. If an element's ID or class varies too much across audit logs, the ML flags it as volatile and requests a more stable anchor.</p>
            </article>
            <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300/70 mb-2">Downstream</p>
              <h4 className="text-base font-semibold text-white">Reliability scoring</h4>
              <p className="mt-2 text-sm leading-6 text-white/64">ML generates a reliability score from 0.0 to 1.0. Only data scoring above 0.98 earns a citation handle — a unique, auditable reference that resolves back to the original rendered source.</p>
            </article>
          </div>
        </div>

        {/* Implementation principles */}
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-white mb-4">Pipeline principles</h3>
          <div className="space-y-3">
            {citeLedgerPrinciples.map((principle, i) => (
              <article key={principle.title} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                <div className="flex items-start gap-4">
                  <span className="text-xs font-mono font-bold text-white/22 shrink-0 pt-0.5 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-base font-semibold text-white">{principle.title}</h4>
                    <p className="mt-2 text-sm leading-6 text-white/64">{principle.text}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        {/* Callout */}
        <div className="mt-6 rounded-3xl border border-cyan-400/20 bg-cyan-400/[0.04] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300/70 mb-3">Design constraint</p>
          <p className="text-sm leading-7 text-white/80">
            ML in the CITE LEDGER pipeline is a <strong className="text-white">deterministic filter</strong>, not a generator. Its job is to say "no" to any scraped evidence that does not perfectly align with the structure required for a valid citation. By the time data reaches the user, it is not just scraped information — it is a verified asset backed by the history of the system's audits and fixes.
          </p>
        </div>
      </section>

      {/* ── How AI extracts a page ───────────────────────────────────── */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight text-white">How AI answer engines extract a page</h2>
        <div className="mt-5 space-y-5">
          <p className="text-base leading-7 text-white/64">
            AI and traditional search indexing are not the same pipeline. AI answer engines compress pages into internal representations and reconstruct answers from those representations — they do not surface links to keyword-matched pages. Each step below is a failure point the AiVIS.biz score is designed to detect.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <h3 className="text-base font-semibold text-white">1. Crawl and access</h3>
              <p className="mt-3 text-sm leading-6 text-white/64">The AI crawler (GPTBot, ClaudeBot, PerplexityBot) requests the page. If robots.txt blocks the crawler, or if a WAF/CDN rate-limits the request, extraction never begins. This is the most common and most silent failure mode.</p>
            </article>
            <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <h3 className="text-base font-semibold text-white">2. HTML parsing and rendering</h3>
              <p className="mt-3 text-sm leading-6 text-white/64">The crawler parses the HTML response. Client-side-only rendering (React, Vue, Angular without SSR) produces an empty shell. The model receives no content. Server-side rendering or static generation is required for extraction.</p>
            </article>
            <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <h3 className="text-base font-semibold text-white">3. Structured data extraction</h3>
              <p className="mt-3 text-sm leading-6 text-white/64">JSON-LD blocks are parsed to identify entities (Organization, Person, Article), relationships, dates, and claims. This is the primary mechanism for entity disambiguation — the model uses schema data to determine who published what and when.</p>
            </article>
            <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <h3 className="text-base font-semibold text-white">4. Content compression</h3>
              <p className="mt-3 text-sm leading-6 text-white/64">The content is compressed into a latent representation — a dense vector that captures the semantic fingerprint of the page. Pages with more specific, evidence-dense claims produce stronger representations that compete better against other sources on the same topic.</p>
            </article>
            <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <h3 className="text-base font-semibold text-white">5. Answer reconstruction</h3>
              <p className="mt-3 text-sm leading-6 text-white/64">When a user asks a question, the model retrieves relevant page representations and reconstructs an answer. If the source page had clear, atomic claims with supporting context, the reconstruction is faithful. If the source was vague, the model may hallucinate or attribute the claim to a competing source.</p>
            </article>
            <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <h3 className="text-base font-semibold text-white">6. Citation attribution</h3>
              <p className="mt-3 text-sm leading-6 text-white/64">Citation-capable engines (Perplexity, ChatGPT with browsing, Gemini) link claims back to source URLs. Pages with clear entity identity (Organization schema), verifiable dates (datePublished), and structured claims attract more attributions than unstructured content.</p>
            </article>
          </div>
          <p className="text-sm leading-7 text-white/50">
            Every AiVIS.biz scoring dimension maps to a specific failure point in this extraction chain. Content depth affects compression quality (step 4). Schema coverage affects entity disambiguation (step 3). AI readability affects reconstruction fidelity (step 5). Technical SEO affects access (step 1). Metadata affects classification (step 2). Heading structure affects extraction segmentation (step 4).
          </p>
        </div>
      </section>

      {/* ── Score bands ──────────────────────────────────────────────── */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight text-white">Score bands</h2>
        <p className="mt-3 text-base leading-7 text-white/60">
          Score bands translate the 0–100 composite into actionable tiers, calibrated from aggregate citation and extraction quality patterns across audited pages.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {scoreBands.map((tier) => (
            <article key={tier.badge} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${tier.tone}`}>{tier.badge}</div>
              <p className="mt-3 text-sm font-medium text-white">{tier.range}</p>
              <p className="mt-2 text-sm leading-6 text-white/64">{tier.description}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── What AiVIS.biz does not measure ──────────────────────────────── */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight text-white">What AiVIS.biz does not measure</h2>
        <p className="mt-3 text-base leading-7 text-white/60">
          AiVIS.biz does one thing: measure AI extraction readiness. It does not do the following.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <h3 className="text-base font-semibold text-white/80">Not a rank tracker</h3>
            <p className="mt-2 text-sm leading-6 text-white/56">AiVIS.biz does not measure or predict position in traditional search engine result pages. The score reflects AI extraction readiness, not Google ranking performance.</p>
          </article>
          <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <h3 className="text-base font-semibold text-white/80">Not a backlink tool</h3>
            <p className="mt-2 text-sm leading-6 text-white/56">Backlink volume and domain authority are not inputs to the AiVIS.biz score. A page with zero backlinks but excellent structured data and clear claims will outscore a page with strong backlinks but invisible content.</p>
          </article>
          <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <h3 className="text-base font-semibold text-white/80">Not a citation guarantee</h3>
            <p className="mt-2 text-sm leading-6 text-white/56">AiVIS.biz measures structural readiness for citation. Whether a specific AI model cites a specific page depends on query relevance, competitive content, and model-specific retrieval behavior — factors outside any audit tool's control.</p>
          </article>
          <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <h3 className="text-base font-semibold text-white/80">Not a compliance audit</h3>
            <p className="mt-2 text-sm leading-6 text-white/56">AiVIS.biz does not provide legal, regulatory, or compliance advice. Schema validity checking is a structural assessment, not a legal review.</p>
          </article>
        </div>
      </section>

      {/* ── Methodology FAQ ─────────────────────────────────────────── */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight text-white">Methodology FAQ</h2>
        <div className="mt-5 space-y-3">
          {methodologyFaq.map((item) => (
            <details key={item.question} className="group rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-base font-semibold text-white">
                <span>{item.question}</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-white/45 transition group-open:rotate-180" />
              </summary>
              <p className="mt-4 text-sm leading-7 text-white/64">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ── Related resources ────────────────────────────────────────── */}
      <section className="mt-12">
        <h2 className="text-lg font-semibold text-white/80 mb-4">Related Resources</h2>
        <div className="flex flex-wrap gap-3">
          <Link to="/triple-check-methodology" className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/[0.06] transition">Triple-Check Methodology</Link>
          <Link to="/compliance" className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/[0.06] transition">Compliance</Link>
          <Link to="/glossary" className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/[0.06] transition">Glossary</Link>
          <Link to="/pricing" className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/[0.06] transition">Pricing</Link>
          <Link to="/problems" className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/[0.06] transition">Problem Diagnostics</Link>
          <Link to="/guide" className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/[0.06] transition">Implementation Guide</Link>
        </div>
      </section>
    </PublicPageFrame>
  );
}
