import React from "react";
import { Link } from "react-router-dom";
import { usePageMeta } from "../hooks/usePageMeta";
import { BRAG_ACRONYM, BRAG_EXPANSION, BRAG_TRAIL_LABEL } from "@shared/types";

const BRAG_PROTOCOL_LABEL = `${BRAG_TRAIL_LABEL} protocol`;

const DIMENSIONS = [
  {
    name: "Content Depth & Quality",
    weight: "20%",
    barWidth: "100%",
    signals:
      "Word count, topical coverage breadth, factual claim density, example and evidence presence, section-level explanatory depth, absence of thin filler content",
  },
  {
    name: "Schema & Structured Data",
    weight: "20%",
    barWidth: "100%",
    signals:
      "JSON-LD presence, schema type appropriateness for page context, relationship completeness, entity reference accuracy, FAQPage and HowTo block validity, absence of schema errors",
  },
  {
    name: "AI Readability & Citability",
    weight: "20%",
    barWidth: "100%",
    signals:
      "Direct answer block density, Q&A formatted sections, concise factual statements, extractable claim units, passive filler ratio, sentence-level answer completeness",
  },
  {
    name: "Technical SEO",
    weight: "15%",
    barWidth: "75%",
    signals:
      "robots.txt accessibility, sitemap presence, canonical correctness, HTTPS enforcement, internal link graph density, llms.txt governance file presence",
  },
  {
    name: "Meta Tags & Open Graph",
    weight: "13%",
    barWidth: "65%",
    signals:
      "Title tag specificity, meta description length and content match (120–155 chars), Open Graph completeness, canonical tag correctness, image alt text coverage",
  },
  {
    name: "Heading Structure & H1",
    weight: "12%",
    barWidth: "60%",
    signals:
      "Single H1 presence, H1-to-title alignment, H2/H3 hierarchy logic, heading density relative to content length, keyword-bearing headings vs. generic labels",
  },
] as const;

const SCORE_TIERS = [
  {
    badge: "A — Excellent",
    range: "80–100",
    tone: "bg-emerald-500/15 text-emerald-300 border-emerald-400/20",
    description:
      "Consistently cited across answer engines. Strong entity clarity, complete schema, extractable answer blocks.",
  },
  {
    badge: "B — Good",
    range: "60–79",
    tone: "bg-green-500/15 text-green-300 border-green-400/20",
    description:
      "Citation-ready for most queries. Minor gaps in schema relationships or content depth. Competes well.",
  },
  {
    badge: "C — Fair",
    range: "40–59",
    tone: "bg-amber-500/15 text-amber-300 border-amber-400/20",
    description:
      "Parseable but deprioritized. Cited only on low-competition queries or when competitors are weaker.",
  },
  {
    badge: "D — Poor",
    range: "20–39",
    tone: "bg-orange-500/15 text-orange-300 border-orange-400/20",
    description:
      "Structural barriers present. Answer engines can reach the page but extraction confidence is low.",
  },
  {
    badge: "F — Critical",
    range: "0–19",
    tone: "bg-red-500/15 text-red-300 border-red-400/20",
    description:
      "Critical failures across multiple dimensions. Not practically citable in current state.",
  },
] as const;

const BRAG_STEPS = [
  {
    letter: "B",
    title: "Build from observed fields",
    text:
      "Every finding originates from a specific crawl-observable element: a missing JSON-LD block, a duplicate H1, an absent meta description. If the finding cannot be traced to a concrete page field, it is not included in the report.",
  },
  {
    letter: "R",
    title: "Reference explicit evidence",
    text:
      "Each finding includes a direct excerpt or field reference from the crawled page. Teams can verify the finding independently without re-running the audit. The evidence is attached to the finding, not implied.",
  },
  {
    letter: "A",
    title: "Audit recommendation linkage",
    text:
      "Recommendations must map to the specific finding they address. A schema recommendation links to schema evidence. A content depth recommendation links to the content fields evaluated. No recommendation is orphaned from its finding.",
  },
  {
    letter: "G",
    title: "Ground claims in stored outputs",
    text:
      "Findings and scores are stored per-scan so every future audit can compare against a prior baseline. Score movement is measured against stored crawl outputs, not recalculated from memory, ensuring comparison stability across weeks and model updates.",
  },
] as const;

const PIPELINE_STEPS = [
  {
    title: "Crawl and extraction",
    text:
      "The target URL is fetched and rendered. HTML structure, JSON-LD blocks, meta fields, heading hierarchy, internal link topology, and raw text content are extracted and stored as the crawl baseline for this scan.",
  },
  {
    title: "Dimension scoring",
    text:
      "Each of the six dimensions is scored independently against the extracted fields. Crawl-derived dimension scoring is deterministic: the same page input produces the same dimension scores across re-runs, enabling reliable before/after comparison. AI model validation (paid tiers) may introduce bounded variance.",
  },
  {
    title: "Evidence mapping",
    text:
      "Low-scoring dimension items are mapped to specific crawl evidence. A heading structure score of 30 references the exact H1 and H2 fields observed, not a generic statement about heading importance.",
  },
  {
    title: "AI model validation (paid tiers)",
    text:
      "Eligible tiers include a secondary pass where an AI critique model reviews content against the observed dimension scores. This surfaces advisory findings — issues the crawl can detect but cannot fully evaluate, such as whether a FAQ answer is factually complete or merely present.",
  },
  {
    title: "Confidence classification",
    text:
      "Each finding is classified as high-confidence (directly crawl-observable), medium-confidence (pattern-based), or advisory (model-evaluated). Teams should prioritize high-confidence findings first — these have the most predictable score impact.",
  },
  {
    title: "Score storage and baseline commit",
    text:
      "The composite score, dimension scores, and finding set are committed to the report history store. All future audits on the same URL compare delta against this committed baseline.",
  },
] as const;

const METHODOLOGY_FAQ = [
  {
    question: "What does the AiVIS score measure?",
    answer:
      "The AiVIS score measures how confidently an AI answer engine can parse, trust, and cite a page. It is a composite 0-100 score across six weighted dimensions: Content Depth & Quality, Schema & Structured Data, AI Readability & Citability, Technical SEO, Meta Tags & Open Graph, and Heading Structure & H1. In production, this composite score is paired with a truth layer (`analysis_integrity.execution_class`, `geo_signal_profile`, and `contradiction_report`) so operators can verify execution mode and consistency signals directly.",
  },
  {
    question: "How is the AiVIS 0-100 score calculated?",
    answer:
      "The score is a weighted sum: Content Depth & Quality (20%) + Schema & Structured Data (20%) + AI Readability & Citability (20%) + Technical SEO (15%) + Meta Tags & Open Graph (13%) + Heading Structure & H1 (12%). Each dimension is scored 0-100 independently before weighting. The composite final score is the weighted average rounded to the nearest integer.",
  },
  {
    question: `What is a ${BRAG_TRAIL_LABEL} in AiVIS?`,
    answer:
      `${BRAG_ACRONYM} stands for ${BRAG_EXPANSION}. It is AiVIS's protocol for ensuring every recommendation is grounded in observed crawl evidence rather than generic advice. Each finding references the specific page element it came from, ensuring teams can verify and act on every recommendation.`,
  },
  {
    question: "What score is needed to be citation-ready for AI answer engines?",
    answer:
      "Pages scoring 70 or above are generally citation-ready. Pages between 40–69 are parseable but often deprioritized by answer engines. Pages below 40 face major structural barriers that prevent consistent citation regardless of content quality. Most competitive queries are won by pages scoring 75 or higher.",
  },
] as const;

const RELATED_LINKS = [
  { label: "Pricing", to: "/pricing" },
  { label: "Guide", to: "/guide" },
  { label: "Workflow", to: "/workflow" },
  { label: "Insights", to: "/insights" },
  { label: "FAQ", to: "/faq" },
  { label: "Reports", to: "/reports" },
] as const;

export default function MethodologyPage() {
  usePageMeta({
    title: 'AiVIS Methodology | How AI Visibility Scoring Works',
    description:
      `How AiVIS scores AI visibility: 6-category evidence model covering content, schema, headings, metadata, and technical SEO with ${BRAG_TRAIL_LABEL} docs.`,
    path: "/methodology",
    ogTitle: 'AiVIS Methodology - Evidence Grounded AI Visibility Scoring',
    ogDescription:
      `The complete scoring framework behind AiVIS audits: dimension weights, validation logic, ${BRAG_PROTOCOL_LABEL}, and how scores translate to real citation improvements.`,
    ogType: 'article',
    structuredData: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'TechArticle',
          '@id': 'https://aivis.biz/methodology#article',
          headline: 'AiVIS Methodology: Evidence-Grounded AI Visibility Scoring',
          description:
            `The complete scoring framework behind AiVIS audits: 6 weighted dimensions, validation logic, ${BRAG_PROTOCOL_LABEL}, and how scores translate to citation improvements in answer engines.`,
          url: 'https://aivis.biz/methodology',
          publisher: {
            '@type': 'Organization',
            '@id': 'https://aivis.biz/#organization',
            name: 'AiVIS',
            url: 'https://aivis.biz',
            logo: 'https://aivis.biz/aivis-logo.png',
          },
          about: {
            '@type': 'SoftwareApplication',
            name: 'AiVIS',
            url: 'https://aivis.biz',
          },
          keywords: [
            'AI visibility scoring',
            'generative engine optimization',
            'answer engine optimization',
            'AEO audit methodology',
            'LLM citability',
            'AI search scoring',
          ],
        },
        {
          '@type': 'FAQPage',
          mainEntity: METHODOLOGY_FAQ.map((item) => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: {
              '@type': 'Answer',
              text: item.answer,
            },
          })),
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://aivis.biz' },
            { '@type': 'ListItem', position: 2, name: 'Methodology', item: 'https://aivis.biz/methodology' },
          ],
        },
      ],
    },
  });

  return (
    <div className="min-h-screen bg-[#2e3646] text-white flex flex-col">
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-[#232a38] via-[#2b3343] to-[#222a38]" />
      </div>
      <nav className="border-b border-white/10 bg-white/[0.02] backdrop-blur px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center gap-6 text-sm text-white/75">
          <Link to="/" className="text-base font-bold tracking-tight text-white">AiVIS</Link>
          <div className="ml-auto flex flex-wrap items-center gap-4">
            {RELATED_LINKS.map((link) => (
              <Link key={link.to} to={link.to} className="text-white/75 transition hover:text-white">
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>

      <main className="relative z-0 mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <header className="border-b border-white/10 pb-10">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-400/80">Methodology</p>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-5xl">
            How AiVIS scores AI visibility
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-white/75">
            AiVIS measures whether answer engines — ChatGPT, Perplexity, Gemini, and Claude — can parse,
            trust, and cite a page with confidence. Every score is grounded in observable page evidence,
            not heuristics or black-box models. This document explains the full scoring framework,
            dimension weights, validation pipeline, and the {BRAG_PROTOCOL_LABEL} that connects every
            finding to a specific crawl observation.
          </p>
          <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-white/55 mb-1">Commercial policy alignment</p>
            <p className="text-sm text-white/75">
              Observer is intentionally limited to verdict + top blockers + competitor gap preview. Full evidence and
              competitor source intelligence are unlocked on paid tiers so the pricing page, FAQ, and methodology all
              describe the same product contract.
            </p>
          </div>
        </header>

        <section className="mt-12">
          <h2 className="text-2xl font-bold tracking-tight text-white">The scoring formula</h2>
          <p className="mt-4 leading-8 text-white/70">
            The AiVIS composite score is a <strong className="text-white">weighted average of six independent dimensions</strong>,
            each scored on a 0–100 scale. Weights were derived from observed citation patterns across major
            answer engines and reflect how heavily each signal influences whether a page gets extracted and
            quoted in a generated response.
          </p>

          <div className="mt-8 rounded-xl border border-white/10 border-l-4 border-l-cyan-400 bg-white/[0.04] p-6">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-400/80">
              Composite score formula
            </div>
            <div className="flex flex-wrap items-center gap-2 leading-8 text-white/85">
              <span>Score =</span>
              <span className="rounded border border-white/10 bg-white/5 px-2 py-1 text-sm font-semibold">Content Depth</span>
              <span className="font-semibold text-cyan-300">× 0.25</span>
              <span>+</span>
              <span className="rounded border border-white/10 bg-white/5 px-2 py-1 text-sm font-semibold">Schema Coverage</span>
              <span className="font-semibold text-cyan-300">× 0.22</span>
              <span>+</span>
              <span className="rounded border border-white/10 bg-white/5 px-2 py-1 text-sm font-semibold">AI Readability</span>
              <span className="font-semibold text-cyan-300">× 0.20</span>
              <span className="rounded border border-white/10 bg-white/5 px-2 py-1 text-sm font-semibold">Content Depth</span>
              <span className="font-semibold text-cyan-300">× 0.25</span>
              <span>+</span>
              <span className="rounded border border-white/10 bg-white/5 px-2 py-1 text-sm font-semibold">Schema Coverage</span>
              <span className="font-semibold text-cyan-300">× 0.22</span>
              <span>+</span>
              <span className="rounded border border-white/10 bg-white/5 px-2 py-1 text-sm font-semibold">AI Readability</span>
              <span className="font-semibold text-cyan-300">× 0.20</span>
              <span>+</span>
              <span className="rounded border border-white/10 bg-white/5 px-2 py-1 text-sm font-semibold">Metadata Quality</span>
              <span className="font-semibold text-cyan-300">× 0.15</span>
              <span>+</span>
              <span className="rounded border border-white/10 bg-white/5 px-2 py-1 text-sm font-semibold">Heading Structure</span>
              <span className="font-semibold text-cyan-300">× 0.10</span>
              <span>+</span>
              <span className="rounded border border-white/10 bg-white/5 px-2 py-1 text-sm font-semibold">Technical SEO</span>
              <span className="font-semibold text-cyan-300">× 0.08</span>
            </div>
          </div>

          <p className="mt-6 leading-8 text-white/70">
            Each dimension score is computed independently before weighting. A page that scores 90 on
            content depth but 0 on schema still achieves only a composite of roughly 52 — illustrating
            why one-dimensional optimization consistently underperforms balanced improvements.
          </p>
        </section>

        <section className="mt-14">
          <h2 className="text-2xl font-bold tracking-tight text-black">Dimension weights and signals</h2>
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-black/15 text-xs uppercase tracking-[0.12em] text-black/45">
                  <th className="px-3 py-3 font-semibold">Dimension</th>
                  <th className="px-3 py-3 font-semibold">Weight</th>
                  <th className="px-3 py-3 font-semibold">Primary signals evaluated</th>
                </tr>
              </thead>
              <tbody>
                {DIMENSIONS.map((dimension) => (
                  <tr key={dimension.name} className="border-b border-black/10 align-top">
                    <td className="px-3 py-4 font-semibold text-black">{dimension.name}</td>
                    <td className="px-3 py-4">
                      <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/85">
                        {dimension.weight}
                      </span>
                      <div className="mt-2 h-1.5 w-24 overflow-hidden rounded-full bg-black/10">
                        <div className="h-full rounded-full bg-blue-700" style={{ width: dimension.barWidth }} />
                      </div>
                    </td>
                    <td className="px-3 py-4 leading-7 text-black/65">{dimension.signals}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 rounded-xl border border-blue-200 bg-blue-50 p-5 text-sm leading-7 text-blue-950">
            <p>
              <strong>Why schema outweighs technical SEO:</strong> In generative engine pipelines, structured
              data provides machine-readable entity relationships that directly inform knowledge graph
              construction. A technically clean page with no schema is functionally opaque to extraction
              models. Schema errors score near zero regardless of other dimension performance.
            </p>
          </div>
        </section>

        <section className="mt-14">
          <h2 className="text-2xl font-bold tracking-tight text-black">Score tiers and citation readiness</h2>
          <p className="mt-4 leading-8 text-black/70">
            AiVIS maps composite scores to five citation readiness tiers. These thresholds reflect observed
            behavior across Perplexity, ChatGPT Browse, and Google AI Overviews — not theoretical ideals.
            Pages below 40 face structural extraction barriers that content improvements alone cannot resolve.
          </p>
          <div className="mt-6 rounded-2xl border border-black/10 bg-white">
            {SCORE_TIERS.map((tier) => (
              <div key={tier.badge} className="flex flex-col gap-3 border-b border-black/10 px-5 py-4 last:border-b-0 sm:flex-row sm:items-center">
                <span className={`inline-flex min-w-[92px] items-center justify-center rounded-md border px-3 py-1 text-xs font-bold ${tier.tone}`}>
                  {tier.badge}
                </span>
                <p className="flex-1 text-sm leading-7 text-black/65">{tier.description}</p>
                <span className="text-xs font-medium text-black/45">{tier.range}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-14">
          <h2 className="text-2xl font-bold tracking-tight text-black">The {BRAG_PROTOCOL_LABEL}</h2>
          <p className="mt-4 leading-8 text-black/70">
            {BRAG_ACRONYM} is AiVIS&apos;s internal evidence chain standard. Every finding in an AiVIS audit report must
            pass a four-step {BRAG_ACRONYM} verification before it is surfaced as a recommendation. This prevents
            generic advice — the kind that applies to every site and helps none of them — from appearing
            alongside evidence-grounded findings.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {BRAG_STEPS.map((step) => (
              <div key={step.letter} className="rounded-2xl border border-black/10 bg-white p-5">
                <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-black text-sm font-bold text-white">
                  {step.letter}
                </div>
                <h3 className="text-sm font-bold uppercase tracking-[0.08em] text-black/70">{step.title}</h3>
                <p className="mt-3 text-sm leading-7 text-black/65">{step.text}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 leading-8 text-black/70">
            In practice, the {BRAG_TRAIL_LABEL} means every recommendation in an AiVIS report answers three
            questions simultaneously: <strong className="text-black">what exactly is wrong</strong> on this
            specific page, <strong className="text-black">where is the evidence</strong> in the crawl output,
            and <strong className="text-black">what specific change</strong> will move the score. Teams that
            implement fixes without this chain typically address symptoms while missing root causes.
          </p>
        </section>

        <section className="mt-14">
          <h2 className="text-2xl font-bold tracking-tight text-black">Validation pipeline</h2>
          <p className="mt-4 leading-8 text-black/70">
            AiVIS audits run through a multi-stage validation pipeline before scores are finalized. The
            pipeline is designed to distinguish high-confidence findings — those grounded in directly
            observable page structure — from advisory findings that reflect best practice patterns but
            cannot be verified by crawl alone.
          </p>
          <div className="mt-6 space-y-5">
            {PIPELINE_STEPS.map((step, index) => (
              <div key={step.title} className="flex gap-4">
                <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/20 text-xs font-bold text-black">
                  {index + 1}
                </div>
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-[0.08em] text-black/70">{step.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-black/65">{step.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-14">
          <h2 className="text-2xl font-bold tracking-tight text-black">The optimization loop</h2>
          <p className="mt-4 leading-8 text-black/70">
            A single audit is a diagnostic, not a solution. AiVIS is designed for iterative improvement cycles
            where teams fix a cluster of related findings, re-audit, and measure category-level delta rather
            than overall score movement alone. Overall score can mask improvement in one dimension while
            another degrades — category tracking prevents this.
          </p>
          <div className="mt-6 rounded-2xl border border-black/10 bg-[#f0efe9] p-6">
            <div className="mb-4 text-xs font-bold uppercase tracking-[0.12em] text-black/45">Recommended cycle</div>
            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-black/75">
              {['Baseline audit', 'Fix high-confidence cluster', 'Re-audit', 'Compare category delta', 'Log change', 'Repeat'].map((label, index, arr) => (
                <React.Fragment key={label}>
                  <span className="rounded-md bg-black px-3 py-2 text-white">{label}</span>
                  {index < arr.length - 1 ? <span className="px-1 text-black/45">→</span> : null}
                </React.Fragment>
              ))}
            </div>
          </div>
          <p className="mt-6 leading-8 text-black/70">
            The most common optimization failure mode is fixing all technical issues first while leaving
            content depth and schema untouched. Technical SEO accounts for only 8% of the composite score.
            A page can achieve a perfect technical score and still sit at 30 overall if content depth and
            schema coverage are near zero. Always prioritize dimension weight when sequencing fixes.
          </p>
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-900">
            <p>
              <strong>Score inflation warning:</strong> Adding schema markup without validating relationship
              completeness can produce a misleading score increase. AiVIS distinguishes between schema presence
              (any JSON-LD block exists) and schema quality (relationships are complete, entity references are
              accurate, type matches page context). The schema dimension weight applies to quality, not presence.
            </p>
          </div>
        </section>

        <section className="mt-14">
          <h2 className="text-2xl font-bold tracking-tight text-black">What answer engines actually extract</h2>
          <p className="mt-4 leading-8 text-black/70">
            AiVIS scoring is grounded in the extraction behavior of retrieval-augmented generation pipelines.
            When Perplexity, ChatGPT, or Gemini answers a question using web sources, the selection and
            extraction process follows a predictable pattern:
          </p>
          <p className="mt-5 leading-8 text-black/70">
            <strong className="text-black">Entity resolution first.</strong> The model identifies what the page
            is about by reading the title, H1, first paragraph, and any schema with a <code className="rounded bg-black/5 px-1 py-0.5 text-sm">name</code>
            or <code className="rounded bg-black/5 px-1 py-0.5 text-sm">description</code> field. Pages with
            ambiguous or inconsistent entity signals are assigned lower retrieval priority regardless of content quality.
          </p>
          <p className="mt-5 leading-8 text-black/70">
            <strong className="text-black">Passage extraction second.</strong> The model scans for short,
            self-contained answer units — sentences or paragraphs that fully answer a question without requiring
            surrounding context. This is why direct answer blocks and FAQ-style sections outperform long narrative
            content in citation selection even when the narrative is higher quality.
          </p>
          <p className="mt-5 leading-8 text-black/70">
            <strong className="text-black">Trust verification third.</strong> The model cross-references the
            source against signals that indicate authority: presence of a methodology or about page, internal links
            to trust documents like privacy and terms, external corroboration from other indexed sources, and schema
            that asserts organizational identity. Pages without these signals are cited less frequently on contested
            or consequential queries.
          </p>
          <p className="mt-5 leading-8 text-black/70">
            AiVIS scores each of these extraction phases through its dimension framework. Content depth and AI
            readability measure extractability. Schema and heading structure measure entity resolution quality.
            Metadata and technical SEO measure trust and accessibility. Improving all six dimensions together is
            the only reliable path to consistent citation across answer engines.
          </p>
        </section>

        <section className="mt-14">
          <h2 className="text-2xl font-bold tracking-tight text-black">Threat detection</h2>
          <p className="mt-4 leading-8 text-black/70">
            Every audit includes a real-time threat intelligence scan (up to three layers) that runs in
            parallel with the visibility analysis. This protects teams from auditing domains that may be
            compromised or flagged by security providers.
          </p>
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-black/10 bg-white p-5">
              <h3 className="text-sm font-bold uppercase tracking-[0.08em] text-black/70">URLhaus (abuse.ch)</h3>
              <p className="mt-3 text-sm leading-7 text-black/65">
                Checks the target URL against the abuse.ch malicious URL database — a community-driven
                feed of known malware distribution, phishing, and botnet command-and-control endpoints.
              </p>
            </div>
            <div className="rounded-2xl border border-black/10 bg-white p-5">
              <h3 className="text-sm font-bold uppercase tracking-[0.08em] text-black/70">Google Safe Browsing API v4</h3>
              <p className="mt-3 text-sm leading-7 text-black/65">
                Checks for social engineering, malware, unwanted software, and potentially harmful
                applications using Google&apos;s continuously updated threat list. Requires a server-configured
                API key; if not configured, this layer is skipped without affecting the audit.
              </p>
            </div>
            <div className="rounded-2xl border border-black/10 bg-white p-5">
              <h3 className="text-sm font-bold uppercase tracking-[0.08em] text-black/70">Hostname heuristics</h3>
              <p className="mt-3 text-sm leading-7 text-black/65">
                Detects punycode/IDN homograph attacks, raw IP hosting, suspicious URL patterns, and risky
                top-level domains (.tk, .ml, .cf, .gq, .zip, .mov). This layer runs without external
                dependencies and covers threats that database lookups may miss.
              </p>
            </div>
          </div>
          <p className="mt-6 leading-8 text-black/70">
            Results appear as a Threat Intel banner on the audit report with composite risk levels from
            Low to Critical. A high-risk result does not block the audit but is prominently surfaced so
            teams can investigate before implementing any recommendations.
          </p>
        </section>

        <section className="mt-14">
          <h2 className="text-2xl font-bold tracking-tight text-black">Methodology FAQ</h2>
          <div className="mt-6 space-y-4">
            {METHODOLOGY_FAQ.map((item) => (
              <div key={item.question} className="rounded-2xl border border-black/10 bg-white p-5">
                <h3 className="text-sm font-bold uppercase tracking-[0.08em] text-black/70">{item.question}</h3>
                <p className="mt-3 text-sm leading-7 text-black/65">{item.answer}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-14 border-t border-black/10 pt-10">
          <h2 className="text-2xl font-bold tracking-tight text-black">Related documentation</h2>
          <p className="mt-4 leading-8 text-black/70">
            The <Link to="/guide" className="text-blue-700 underline hover:text-blue-900">AiVIS Guide</Link> covers how to interpret audit output and sequence implementation.
            The <Link to="/faq" className="ml-1 text-white underline hover:text-white/80">FAQ</Link> addresses common questions about score interpretation,
            category grades, and optimization sequencing. The <Link to="/compliance" className="ml-1 text-blue-700 underline hover:text-blue-900">Compliance</Link> page documents data handling
            and crawl governance policies. Teams running the full optimization loop can track progress in <Link to="/reports" className="ml-1 text-blue-700 underline hover:text-blue-900">Report History</Link>.
          </p>
        </section>
      </main>
    </div>
  );
}
