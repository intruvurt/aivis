import React from "react";
import { usePageMeta } from "../hooks/usePageMeta";
import { buildTechArticleSchema, buildBreadcrumbSchema } from "../lib/seoSchema";

const PAGE_TITLE = "Machine-First Content Formatting Guidelines";
const PAGE_DESCRIPTION =
  "How to structure web content for AI answer engines. Covers heading hierarchy, definition-first sections, retrieval-friendly blocks, schema alignment, and the formatting patterns AiVIS.biz uses to audit citation readiness.";

const Documentation = () => {
  usePageMeta({
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    path: "/documentation",
    structuredData: [
      buildTechArticleSchema({
        title: PAGE_TITLE,
        description: PAGE_DESCRIPTION,
        path: "/documentation",
      }),
      buildBreadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "Documentation", path: "/documentation" },
      ]),
    ],
  });

  return (
    <div className="max-w-4xl mx-auto p-8 bg-gray-800 text-gray-100 rounded-lg shadow-lg my-8">
      <h1 className="text-4xl font-bold mb-6 text-accent">
        Machine-First Content Formatting Guidelines
      </h1>

      <h2 className="text-2xl font-semibold mt-8 mb-3 text-gray-200">
        Definition
      </h2>
      <p className="mb-4 text-gray-300 leading-relaxed">
        Machine-first formatting optimizes content for AI and algorithmic readability by prioritizing
        structure and clarity over stylistic prose. When AI answer engines like ChatGPT, Perplexity,
        or Google AI Overviews extract information from a page, they rely on consistent heading
        hierarchies, concise answer blocks, and explicit definitions — not on marketing copy or
        creative phrasing.
      </p>
      <p className="mb-4 text-gray-300 leading-relaxed">
        For AI ingestion, format beats style. AiVIS.biz audits every page against these patterns
        and scores how likely the content is to be extracted, summarized, and cited by large language
        models.
      </p>

      <h2 className="text-2xl font-semibold mt-8 mb-3 text-gray-200">
        Key Rules
      </h2>
      <ul className="list-disc ml-6 mb-4 text-gray-300 space-y-2">
        <li>Clear heading hierarchy (H1 → H2 → H3) — one H1 per page, nested sections under H2/H3</li>
        <li>Short paragraphs (1–3 sentences) — each paragraph should express exactly one idea</li>
        <li>Definition-first in every section — lead with the answer, then expand with evidence</li>
        <li>Use lists instead of prose when possible — bullet points are more extractable than run-on paragraphs</li>
        <li>Front-load entities — name the subject, service, or concept within the first sentence of each section</li>
        <li>Include structured data (JSON-LD) — align schema markup with visible page content</li>
      </ul>

      <h2 className="text-2xl font-semibold mt-8 mb-3 text-gray-200">
        Patterns That Hurt AI Readability
      </h2>
      <ul className="list-disc ml-6 mb-4 text-gray-300 space-y-2">
        <li>Poetic hero copy with no concrete definition</li>
        <li>Clever metaphors that require human interpretation</li>
        <li>Implied meaning — if the page never says what the product does, the model cannot extract it</li>
        <li>Buried answers — key facts hidden deep inside long-form prose without a heading</li>
        <li>Schema-content mismatch — JSON-LD that describes something different from the visible text</li>
      </ul>

      <h2 className="text-2xl font-semibold mt-8 mb-3 text-gray-200">
        Patterns That Help AI Readability
      </h2>
      <div className="mb-6 bg-gray-700 p-4 rounded-lg">
        <h3 className="text-xl font-bold mb-3 text-accent">
          How AiVIS.biz Audits Content
        </h3>
        <ul className="list-disc ml-6 text-gray-300 space-y-2">
          <li>Scans page structure, headings, and metadata for extraction clarity</li>
          <li>Evaluates entity resolution — can AI identify what the page is about?</li>
          <li>Checks answer blocks — are buyer questions answered in concise, retrievable sections?</li>
          <li>Measures evidence depth — are claims backed by visible proof?</li>
          <li>Validates schema alignment — does JSON-LD match the visible content?</li>
          <li>Scores internal link support — is the topic graph reinforced across related pages?</li>
        </ul>
      </div>

      <h2 className="text-2xl font-semibold mt-8 mb-3 text-gray-200">
        Formatting Example
      </h2>
      <ol className="list-decimal ml-6 mb-4 text-gray-300 space-y-2">
        <li>Start with a clear H1 that names the topic exactly.</li>
        <li>Break down sections under H2/H3 — each heading should be a self-contained unit.</li>
        <li>Use short lists or bullet points where possible.</li>
        <li>Avoid unfamiliar idioms or unnecessary adjectives.</li>
        <li>Add an FAQ section with direct question-answer pairs.</li>
        <li>Include JSON-LD that references the same entities and claims visible on the page.</li>
      </ol>

      <h2 className="text-2xl font-semibold mt-8 mb-3 text-gray-200">
        Why This Matters for Citation Readiness
      </h2>
      <p className="mb-4 text-gray-300 leading-relaxed">
        AI answer engines do not cite pages because they rank well — they cite pages because the
        content is structurally extractable and the claims are evidence-backed. Machine-first
        formatting increases the probability that a page's information is selected for summarization,
        attributed correctly, and linked as a source in AI-generated answers.
      </p>
      <p className="mb-4 text-gray-300 leading-relaxed">
        AiVIS.biz scores every audited page on entity clarity, heading structure, answer blocks,
        evidence depth, schema alignment, internal support, freshness, and trust signals. These
        guidelines reflect the same patterns the scoring engine evaluates.
      </p>

      <div className="mt-12 pt-6 border-t border-gray-600 text-xs text-gray-400">
        <p>
          © {new Date().getFullYear()} AiVIS.biz. All rights reserved.
          <br />
          Powered by icōd.ai
        </p>
      </div>
    </div>
  );
};

export default Documentation;
