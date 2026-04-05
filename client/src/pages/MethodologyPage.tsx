import React from "react";
import { Link } from "react-router-dom";
import { ChevronDown, FlaskConical, ShieldCheck, Sparkles } from "lucide-react";
import { usePageMeta } from "../hooks/usePageMeta";
import PublicPageFrame from "../components/PublicPageFrame";
import { BRAG_ACRONYM, BRAG_EXPANSION, BRAG_TRAIL_LABEL } from "@shared/types";

const BRAG_PROTOCOL_LABEL = `${BRAG_TRAIL_LABEL} protocol`;

const dimensions = [
  {
    name: "Content Depth & Quality",
    weight: "20%",
    signals:
      "Word count, topical coverage breadth, factual claim density, examples, evidence presence, and explanatory depth.",
  },
  {
    name: "Schema & Structured Data",
    weight: "20%",
    signals:
      "JSON-LD presence, type appropriateness, relationship completeness, entity references, and schema validity.",
  },
  {
    name: "AI Readability & Citability",
    weight: "20%",
    signals:
      "Direct answer density, Q&A structure, extractable claims, concise factual phrasing, and answer completeness.",
  },
  {
    name: "Technical SEO",
    weight: "15%",
    signals:
      "Robots accessibility, sitemap presence, canonical correctness, HTTPS enforcement, and crawl governance files.",
  },
  {
    name: "Meta Tags & Open Graph",
    weight: "13%",
    signals:
      "Title specificity, description quality, Open Graph completeness, canonical consistency, and image metadata.",
  },
  {
    name: "Heading Structure & H1",
    weight: "12%",
    signals:
      "Single H1 presence, title alignment, heading hierarchy logic, section density, and heading specificity.",
  },
] as const;

const scoreBands = [
  {
    badge: "A - Excellent",
    range: "80–100",
    tone: "bg-emerald-500/15 text-emerald-300 border-emerald-400/20",
    description: "Consistently citable, structurally strong, and readable across answer engines.",
  },
  {
    badge: "B - Good",
    range: "60–79",
    tone: "bg-green-500/15 text-green-300 border-green-400/20",
    description: "Generally citation-ready with a small number of structural or trust gaps left to close.",
  },
  {
    badge: "C - Fair",
    range: "40–59",
    tone: "bg-amber-500/15 text-amber-300 border-amber-400/20",
    description: "Parseable but often deprioritized against stronger competitors or clearer sources.",
  },
  {
    badge: "D - Poor",
    range: "20–39",
    tone: "bg-orange-500/15 text-orange-300 border-orange-400/20",
    description: "Significant structural barriers reduce answer-engine trust and extraction quality.",
  },
  {
    badge: "F - Critical",
    range: "0–19",
    tone: "bg-red-500/15 text-red-300 border-red-400/20",
    description: "The page is not practically citable in its current state.",
  },
] as const;

const bragSteps = [
  {
    letter: "B",
    title: "Build from observed fields",
    text: "Every finding starts from a crawl-observable field or element. If it cannot be traced to an observed page signal, it is not part of the report.",
  },
  {
    letter: "R",
    title: "Reference explicit evidence",
    text: "Each finding links to the exact evidence that produced it so a team can verify the issue independently.",
  },
  {
    letter: "A",
    title: "Audit recommendation linkage",
    text: "Recommendations map back to the specific finding they are intended to fix. No orphaned advice.",
  },
  {
    letter: "G",
    title: "Ground claims in stored outputs",
    text: "Score movement is compared against stored prior outputs, which keeps historical comparisons stable and reproducible.",
  },
] as const;

const pipelineSteps = [
  {
    title: "Crawl and extraction",
    text: "The target URL is fetched and rendered. HTML structure, JSON-LD blocks, metadata, headings, and raw text are extracted into the audit baseline.",
  },
  {
    title: "Dimension scoring",
    text: "Each dimension is scored independently against the extracted fields before weighting into the final composite score.",
  },
  {
    title: "Evidence mapping",
    text: "Low-scoring items are mapped to concrete page evidence instead of generalized best-practice language.",
  },
  {
    title: "AI model validation",
    text: "Paid tiers add critique and validation layers to surface advisory issues the crawl can detect but cannot fully interpret on its own.",
  },
  {
    title: "Confidence classification",
    text: "Findings are classified by confidence so teams can act on the most deterministic issues first.",
  },
  {
    title: "Score storage and baseline commit",
    text: "The final report and score are stored so future re-audits can compare against a stable historical baseline.",
  },
] as const;

const methodologyFaq = [
  {
    question: "What does the AiVIS score actually measure?",
    answer:
      "It measures how confidently answer engines can parse, trust, and cite a page. The score is a weighted composite across six evidence-based dimensions.",
  },
  {
    question: `What is the ${BRAG_TRAIL_LABEL}?`,
    answer:
      `${BRAG_ACRONYM} stands for ${BRAG_EXPANSION}. It is the protocol that ensures every finding and recommendation maps back to observed crawl evidence.`,
  },
  {
    question: "What score is usually citation-ready?",
    answer:
      "Pages above 70 are generally in strong shape. Most competitive situations still reward pages scoring in the mid-to-high 70s or above.",
  },
  {
    question: "Why are some findings marked advisory?",
    answer:
      "Some issues are visible to validation models but not deterministic from the crawl alone. Those are surfaced as advisory instead of stated as hard fact.",
  },
] as const;

export default function MethodologyPage() {
  usePageMeta({
    title: "AiVIS Methodology | How AI Visibility Scoring Works",
    description:
      `How AiVIS scores AI visibility: six weighted dimensions covering content, schema, readability, metadata, and technical structure with ${BRAG_PROTOCOL_LABEL} support.`,
    path: "/methodology",
    ogTitle: "AiVIS Methodology - Evidence Grounded AI Visibility Scoring",
    ogDescription:
      `The complete scoring framework behind AiVIS audits: dimension weights, validation logic, ${BRAG_PROTOCOL_LABEL}, and how scores translate to real citation improvements.`,
    ogType: "article",
  });

  return (
    <PublicPageFrame
      icon={FlaskConical}
      title="How AiVIS scores AI visibility"
      subtitle="Readable methodology, trust points, and scoring logic without the full-width slab treatment."
      backTo="/"
      maxWidthClass="max-w-5xl"
    >
      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-5">
          <p className="text-lg leading-8 text-white/72">
            AiVIS measures whether answer engines can parse, trust, and cite a page. The score is not a vibe check and not a generic SEO grade. It is a weighted model built from crawl-observable evidence.
          </p>
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300/70">Composite formula</p>
            <p className="mt-3 text-sm leading-7 text-white/66">
              Score = Content Depth × 0.20 + Schema Coverage × 0.20 + AI Readability × 0.20 + Technical SEO × 0.15 + Metadata Quality × 0.13 + Heading Structure × 0.12
            </p>
          </div>
        </div>
        <div className="grid gap-3">
          <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-white"><ShieldCheck className="h-4 w-4 text-emerald-300" /> Trust point</div>
            <p className="mt-3 text-sm leading-6 text-white/64">Every recommendation is tied back to crawl evidence. If we cannot observe it, we do not claim it.</p>
          </article>
          <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-white"><Sparkles className="h-4 w-4 text-orange-300" /> Commercial policy</div>
            <p className="mt-3 text-sm leading-6 text-white/64">Observer is intentionally limited to verdict-first outputs. Full evidence and deeper source intelligence live on paid tiers.</p>
          </article>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight text-white">Dimension weights</h2>
        <div className="mt-6 grid gap-4">
          {dimensions.map((dimension) => (
            <article key={dimension.name} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">{dimension.name}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/64">{dimension.signals}</p>
                </div>
                <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-cyan-200">{dimension.weight}</div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-12 grid gap-10 lg:grid-cols-2">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-white">{BRAG_TRAIL_LABEL} protocol</h2>
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

      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight text-white">Score bands</h2>
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

      <section className="mt-12">
        <h2 className="text-lg font-semibold text-white/80 mb-4">Related Resources</h2>
        <div className="flex flex-wrap gap-3">
          <Link to="/compliance" className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/[0.06] transition">Compliance</Link>
          <Link to="/glossary" className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/[0.06] transition">Glossary</Link>
          <Link to="/pricing" className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/[0.06] transition">Pricing</Link>
          <Link to="/why-ai-visibility" className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/[0.06] transition">Why AI Visibility?</Link>
          <Link to="/guide" className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/[0.06] transition">Implementation Guide</Link>
        </div>
      </section>
    </PublicPageFrame>
  );
}
