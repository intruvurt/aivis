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
      "JSON-LD presence, type appropriateness (Organization, Article, FAQ, Product, HowTo), relationship completeness, entity references, and schema validity. AiVIS evaluates over 18 schema.org types.",
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
    text: "The target URL is fetched via a headless browser that executes JavaScript. AiVIS extracts the full HTML structure, all JSON-LD blocks, meta tags, Open Graph data, heading hierarchy, robots directives, canonical signals, and raw text content. This extraction baseline is the foundation for every downstream finding.",
  },
  {
    title: "Dimension scoring",
    text: "Each of the six dimensions is scored independently against the extracted fields. Weights are applied after individual scoring, not before. This prevents a strong performance in one area from masking a critical failure in another.",
  },
  {
    title: "Evidence mapping",
    text: "Low-scoring items are mapped to concrete page evidence — the specific HTML element, the missing JSON-LD property, or the malformed meta tag. AiVIS does not generate recommendations from generic best-practice databases. Every finding is grounded in what was actually observed on the page.",
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

/* ─── Methodology FAQ ────────────────────────────────────────────────── */

const methodologyFaq = [
  {
    question: "What does the AiVIS score actually measure?",
    answer:
      "The AiVIS score measures how confidently AI answer engines can parse, trust, extract from, and cite a page. It is a weighted composite across six evidence-backed dimensions: content depth (20%), schema coverage (20%), AI readability (20%), technical SEO (15%), metadata quality (13%), and heading structure (12%). The score is not a generic SEO grade — it is specific to AI extraction fidelity.",
  },
  {
    question: `What is the ${BRAG_TRAIL_LABEL}?`,
    answer:
      `${BRAG_ACRONYM} stands for ${BRAG_EXPANSION}. It is the evidence protocol that ensures every finding and recommendation in an AiVIS audit maps back to a crawl-observable signal. The protocol eliminates speculative recommendations and makes every finding independently verifiable.`,
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
    question: "How does AiVIS differ from traditional SEO audit tools?",
    answer:
      "Traditional SEO tools measure rank position, backlink profiles, and keyword density. AiVIS measures whether AI answer engines can structurally extract, trust, and accurately cite a page. The audit surfaces extraction failures — missing schema, blocked crawlers, entity ambiguity, shallow content — not ranking signals.",
  },
  {
    question: "What is the triple-check pipeline?",
    answer:
      "Signal tier activates a three-model consensus pipeline: (1) GPT-5 Mini performs deep analysis, (2) Claude Sonnet 4.6 runs a peer critique that can adjust the score by −15 to +10 points and add additional recommendations, (3) Grok 4.1 Fast validates or overrides the final score. This reduces single-model bias and improves scoring reliability for high-stakes audits.",
  },
  {
    question: "Can the score change without any page modifications?",
    answer:
      "AI model behavior and extraction patterns evolve. A page that was once well-extracted may score differently as model architecture changes. AiVIS stores baseline snapshots to track this drift — if a score changes without page modifications, the delta report shows which model-side factors shifted.",
  },
  {
    question: "Does AiVIS guarantee citation by ChatGPT, Perplexity, or other models?",
    answer:
      "No. AiVIS measures structural readiness for citation — whether a page provides the signals AI models need to extract and cite content accurately. Actual citation depends on query relevance, competitive content, and model-specific behavior. AiVIS improves the probability of accurate citation, not the certainty of it.",
  },
] as const;

/* ─── Component ──────────────────────────────────────────────────────── */

export default function MethodologyPage() {
  usePageMeta({
    title: "AiVIS Methodology | How AI Answer Audit Scoring Works",
    description:
      `How AiVIS audits AI answer readiness: six weighted dimensions covering content extraction, schema coverage, AI readability, metadata, and technical access. Every finding is grounded in the ${BRAG_PROTOCOL_LABEL}.`,
    path: "/methodology",
    ogTitle: "AiVIS Methodology — Evidence-backed AI Answer Audit Scoring",
    ogDescription:
      `The complete scoring framework behind AiVIS audits: six dimension weights, ${BRAG_PROTOCOL_LABEL}, triple-check pipeline, score bands, and methodology FAQ.`,
    ogType: "article",
    structuredData: [
      buildWebPageSchema({
        path: "/methodology",
        name: "AiVIS Methodology — How AI Answer Audit Scoring Works",
        description:
          "Complete audit scoring framework: six weighted dimensions, BRAG evidence protocol, execution pipeline, triple-check consensus, score bands, and methodology FAQ.",
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
      title="How AiVIS audits AI answer readiness"
      subtitle="Scoring methodology, evidence protocol, and the pipeline that turns extraction analysis into actionable fixes."
      backTo="/"
      maxWidthClass="max-w-5xl"
    >
      {/* ── Introduction ──────────────────────────────────────────────── */}
      <section className="space-y-6">
        <div className="space-y-5">
          <p className="text-lg leading-8 text-white/72">
            AI answer engines do not rank pages. They extract fragments, compress them into internal representations, and reconstruct answers. A page that ranks well in traditional search may still be invisible to AI — because the extraction fails silently.
          </p>
          <p className="text-base leading-7 text-white/64">
            AiVIS measures whether an AI model can structurally access a page, parse its content into a usable representation, identify the publishing entity, and reproduce claims with traceable attribution. The audit score is a weighted composite across six dimensions, each targeting a specific failure mode in the AI extraction pipeline.
          </p>
          <p className="text-base leading-7 text-white/64">
            This methodology page explains what the score measures, how each dimension is weighted, how the BRAG evidence protocol prevents speculative recommendations, and how the execution pipeline processes a page from raw URL to stored audit baseline.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-white"><ShieldCheck className="h-4 w-4 text-emerald-300" /> Evidence-grounded</div>
            <p className="mt-3 text-sm leading-6 text-white/64">Every recommendation is tied back to crawl evidence. If AiVIS cannot observe it on the page, it does not claim it as a finding.</p>
          </article>
          <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-white"><Sparkles className="h-4 w-4 text-orange-300" /> Extraction-first design</div>
            <p className="mt-3 text-sm leading-6 text-white/64">The score measures AI extraction fidelity, not traditional ranking signals. A page can rank #1 in Google and still score below 40 in AiVIS if AI models cannot reliably extract its content.</p>
          </article>
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
            Each dimension is scored independently from 0 to 100 before weighting. The weights reflect the relative impact each dimension has on AI extraction fidelity based on analysis of audit data across thousands of pages. Content, schema, and readability carry the heaviest weights because they are the primary determinants of whether AI models can extract, attribute, and cite content accurately.
          </p>
        </div>
      </section>

      {/* ── Dimension weights ────────────────────────────────────────── */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight text-white">Dimension weights</h2>
        <p className="mt-3 text-base leading-7 text-white/60">
          Each dimension targets a specific failure mode in the AI extraction pipeline. A page that scores well across all six dimensions provides AI models with everything they need to extract, attribute, and reproduce content accurately.
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
            {BRAG_ACRONYM} ({BRAG_EXPANSION}) is the evidence framework that governs every AiVIS audit. It enforces a chain of traceability from raw page observation to final recommendation — eliminating the gap between "best practice advice" and "evidence-backed diagnosis."
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

      {/* ── How AI extracts a page ───────────────────────────────────── */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight text-white">How AI answer engines extract a page</h2>
        <div className="mt-5 space-y-5">
          <p className="text-base leading-7 text-white/64">
            Understanding why AiVIS measures what it measures requires understanding how AI answer engines process web content. The extraction pipeline is fundamentally different from how search engines index pages for traditional ranking.
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
            Every AiVIS scoring dimension maps to a specific failure point in this extraction chain. Content depth affects compression quality (step 4). Schema coverage affects entity disambiguation (step 3). AI readability affects reconstruction fidelity (step 5). Technical SEO affects access (step 1). Metadata affects classification (step 2). Heading structure affects extraction segmentation (step 4).
          </p>
        </div>
      </section>

      {/* ── Score bands ──────────────────────────────────────────────── */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight text-white">Score bands</h2>
        <p className="mt-3 text-base leading-7 text-white/60">
          Score bands translate the 0–100 composite into actionable categories. The bands are calibrated against observed citation behavior: pages in the A band are routinely cited as primary sources, while pages in the D and F bands are rarely cited even when topically relevant.
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

      {/* ── What AiVIS does not measure ──────────────────────────────── */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight text-white">What AiVIS does not measure</h2>
        <p className="mt-3 text-base leading-7 text-white/60">
          AiVIS is a diagnostic and fix system for AI extraction readiness. Clearly stating what it does not do prevents misinterpretation of the score.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <h3 className="text-base font-semibold text-white/80">Not a rank tracker</h3>
            <p className="mt-2 text-sm leading-6 text-white/56">AiVIS does not measure or predict position in traditional search engine result pages. The score reflects AI extraction readiness, not Google ranking performance.</p>
          </article>
          <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <h3 className="text-base font-semibold text-white/80">Not a backlink tool</h3>
            <p className="mt-2 text-sm leading-6 text-white/56">Backlink volume and domain authority are not inputs to the AiVIS score. A page with zero backlinks but excellent structured data and clear claims will outscore a page with strong backlinks but invisible content.</p>
          </article>
          <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <h3 className="text-base font-semibold text-white/80">Not a citation guarantee</h3>
            <p className="mt-2 text-sm leading-6 text-white/56">AiVIS measures structural readiness for citation. Whether a specific AI model cites a specific page depends on query relevance, competitive content, and model-specific retrieval behavior — factors outside any audit tool's control.</p>
          </article>
          <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <h3 className="text-base font-semibold text-white/80">Not a compliance audit</h3>
            <p className="mt-2 text-sm leading-6 text-white/56">AiVIS does not provide legal, regulatory, or compliance advice. Schema validity checking is a structural assessment, not a legal review.</p>
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
