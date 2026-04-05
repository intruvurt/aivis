import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Search, BookOpen } from "lucide-react";
import { usePageMeta } from "../hooks/usePageMeta";
import { buildBreadcrumbSchema } from "../lib/seoSchema";

interface Term {
  term: string;
  definition: string;
  related?: string[];
}

const GLOSSARY_TERMS: Term[] = [
  {
    term: "AI Visibility Score",
    definition:
      "A quantified metric (0–100) indicating how effectively a website's content can be discovered, extracted, and cited by AI answer engines like ChatGPT, Perplexity, Claude, and Gemini. AiVIS calculates this by auditing content extractability, entity clarity, schema completeness, trust signals, and answer block density.",
    related: ["Content Extractability", "Entity Clarity", "Trust Signals"],
  },
  {
    term: "Answer Engine Optimization (AEO)",
    definition:
      "The practice of structuring website content so that AI answer engines can extract, trust, and cite it when generating responses. AEO differs from SEO because AI systems evaluate content extractability and entity coherence rather than backlink authority and keyword density. AEO is not a replacement for SEO - it is an additional optimization layer for AI-driven discovery channels.",
    related: ["AI Visibility Score", "Content Extractability", "GEO"],
  },
  {
    term: "Answer Block Density",
    definition:
      "The proportion of a page's content that is structured as concise, self-contained answer fragments suitable for AI extraction. High answer block density means AI models can pull clear, citable statements without needing to parse long unstructured paragraphs. Pages with low answer block density force AI systems to infer answers, which reduces citation likelihood.",
    related: ["Content Extractability", "Citation Surface"],
  },
  {
    term: "BRAG Trail (Bibliography-Referenced Audit Graph)",
    definition:
      "An evidence trail linking each audit finding to the specific page element, schema property, or structural pattern that generated it. BRAG trails allow users to verify why a recommendation was made. AiVIS attaches BRAG references to audit outputs so findings are traceable, not opaque.",
    related: ["Evidence Layer", "Triple-Check Validation"],
  },
  {
    term: "Citation Surface",
    definition:
      "The aggregate presence of a brand, product, or author across AI-generated answers. Citation surface measures how frequently and consistently a source appears when AI answer engines respond to relevant queries. Expanding citation surface requires structural content optimization, entity clarity, and cross-platform presence.",
    related: ["AI Visibility Score", "Answer Block Density", "Entity Clarity"],
  },
  {
    term: "Citation Testing",
    definition:
      "The process of verifying whether a brand or URL actually appears in results returned by search engines and AI answer systems. AiVIS runs citation tests across DuckDuckGo HTML, Bing HTML, and DDG Instant Answer API in parallel to provide evidence-backed verification rather than estimates.",
    related: ["Citation Surface", "Evidence Layer"],
  },
  {
    term: "Content Extractability",
    definition:
      "A measure of how easily an AI system can parse a web page into usable knowledge fragments. High extractability means clear headings, explicit definitions, structured data (JSON-LD), consistent entity references, and minimal ambiguity. Low extractability means the AI system must infer meaning from unstructured text, which reduces the probability of citation.",
    related: ["Answer Block Density", "Schema Completeness", "Machine Readability"],
  },
  {
    term: "Crawlability (AI Context)",
    definition:
      "Whether AI training crawlers and retrieval-augmented generation (RAG) systems can access and index your content. This includes robots.txt configuration for AI-specific user agents (GPTBot, ClaudeBot, PerplexityBot), crawl budget allocation, and content accessibility behind JavaScript rendering barriers.",
    related: ["Machine Readability", "Content Extractability"],
  },
  {
    term: "Entity Clarity",
    definition:
      "How coherently a website establishes its brand, author, and organizational identity through structured data and consistent references. High entity clarity means AI systems can confidently attribute content to a specific, verifiable source. Entity clarity is measured by evaluating JSON-LD organization and person schemas, consistent naming, and cross-reference coherence.",
    related: ["Schema Completeness", "Trust Signals", "E-E-A-T"],
  },
  {
    term: "E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness)",
    definition:
      "Google's quality evaluation framework that assesses content credibility. In the AI visibility context, E-E-A-T signals - author credentials, organizational authority, verifiable claims, and transparent sourcing - influence whether AI answer engines consider content trustworthy enough to cite. AiVIS audits structural E-E-A-T signals including author schema, organization schema, and policy page presence.",
    related: ["Entity Clarity", "Trust Signals"],
  },
  {
    term: "Evidence Layer",
    definition:
      "The component of an AI visibility audit that links each finding to verifiable evidence. Rather than presenting recommendations as opinions, the evidence layer shows exactly which page elements, schema properties, or structural gaps triggered each recommendation. AiVIS uses evidence layers to make audits reproducible and credible.",
    related: ["BRAG Trail", "Triple-Check Validation"],
  },
  {
    term: "GEO (Generative Engine Optimization)",
    definition:
      "A research-backed framework for optimizing content to appear in AI-generated answers. GEO encompasses techniques like adding authoritative citations, using statistical evidence, including quotation-ready passages, and structuring content with clear entity definitions. GEO and AEO are closely related - GEO focuses on content characteristics, AEO focuses on structural readiness.",
    related: ["Answer Engine Optimization", "Citation Surface", "Answer Block Density"],
  },
  {
    term: "JSON-LD (JavaScript Object Notation for Linked Data)",
    definition:
      "A structured data format embedded in web pages that provides machine-readable metadata about entities, relationships, and content properties. In AI visibility, JSON-LD helps AI systems understand what a page is about, who created it, and how entities relate to each other. Schema.org vocabulary in JSON-LD is the primary language AI answer engines use to parse structured knowledge from web pages.",
    related: ["Schema Completeness", "Entity Clarity", "Machine Readability"],
  },
  {
    term: "Machine Readability",
    definition:
      "The degree to which a web page's content and metadata can be consumed by automated systems (AI models, search engine crawlers, RAG pipelines) without human interpretation. Machine readability encompasses valid HTML structure, proper heading hierarchy, JSON-LD structured data, explicit alt text, and content that does not require visual context to understand.",
    related: ["Content Extractability", "Crawlability", "JSON-LD"],
  },
  {
    term: "MCP (Model Context Protocol)",
    definition:
      "An open protocol that allows AI agents to invoke external tools programmatically. AiVIS exposes MCP endpoints so that AI coding agents, workflow automation systems, and custom integrations can trigger audits, retrieve results, and execute remediation without manual browser interaction.",
    related: ["Score Fix", "Automated Remediation"],
  },
  {
    term: "Multi-Model Validation",
    definition:
      "The practice of running the same audit through multiple AI models to reduce single-model bias. AiVIS implements this via its Triple-Check pipeline, where three independent AI models analyze, critique, and validate findings before producing a final score. This catches hallucinations, scoring inconsistencies, and model-specific blind spots.",
    related: ["Triple-Check Validation", "AI Visibility Score"],
  },
  {
    term: "Retrieval-Augmented Generation (RAG)",
    definition:
      "An AI architecture where a language model retrieves relevant documents from an external knowledge base before generating a response. RAG systems power AI answer engines like Perplexity and Gemini's grounded mode. Content that is structurally extractable and entity-coherent is more likely to be retrieved and cited by RAG pipelines.",
    related: ["Content Extractability", "Citation Surface", "AI Visibility Score"],
  },
  {
    term: "Schema Completeness",
    definition:
      "The extent to which a website implements structured data (JSON-LD) covering its key entities: organization, authors, products, articles, FAQs, and breadcrumbs. Complete schema coverage gives AI systems explicit machine-readable context about what the site contains, who created it, and how content relates to the entity graph. AiVIS audits schema completeness as a core component of AI visibility.",
    related: ["JSON-LD", "Entity Clarity", "Machine Readability"],
  },
  {
    term: "Score Fix (AutoPR)",
    definition:
      "AiVIS's automated remediation tier that converts audit findings into executable GitHub pull requests. Score Fix analyzes the structural gaps identified during an audit, generates code changes (schema additions, heading corrections, content restructuring), and opens PRs with evidence-linked explanations. This closes the loop between diagnosis and implementation.",
    related: ["Evidence Layer", "MCP", "Automated Remediation"],
  },
  {
    term: "Triple-Check Validation",
    definition:
      "AiVIS's multi-stage audit pipeline where three independent AI models process the same content. AI1 performs the primary analysis and scoring. AI2 acts as a peer critic that can adjust scores and add missing recommendations. AI3 validates the final output for consistency and accuracy. This eliminates single-model bias and produces more reliable visibility scores.",
    related: ["Multi-Model Validation", "AI Visibility Score", "Evidence Layer"],
  },
  {
    term: "Trust Signals",
    definition:
      "Structural indicators that help AI systems assess whether content is credible enough to cite. Trust signals include: named authors with verifiable credentials, organization schema with contact information, privacy policy and terms of service pages, HTTPS enforcement, consistent entity references, and transparent sourcing. AiVIS evaluates trust signals as one of five core audit dimensions.",
    related: ["E-E-A-T", "Entity Clarity", "Schema Completeness"],
  },
  {
    term: "Visibility Audit",
    definition:
      "A comprehensive analysis of a website's readiness for AI answer engine discovery and citation. A visibility audit evaluates crawlability, content extractability, entity clarity, trust signals, and answer block structure. AiVIS produces visibility audits with quantified scores, evidence-linked recommendations, and (on paid tiers) multi-model validation and automated fixes.",
    related: ["AI Visibility Score", "Content Extractability", "Triple-Check Validation"],
  },
  {
    term: "Automated Remediation",
    definition:
      "The process of automatically implementing fixes for structural issues identified during an AI visibility audit. Rather than only listing recommendations, automated remediation generates code changes - schema additions, heading restructures, entity annotations - and delivers them as pull requests. AiVIS's Score Fix tier provides this capability via GitHub MCP integration.",
    related: ["Score Fix", "MCP", "Evidence Layer"],
  },
  {
    term: "AI Platform Scores",
    definition:
      "Individual scores estimating how well-optimized content is for specific AI answer engines: ChatGPT, Perplexity, Claude, and Gemini. Each platform weighs different structural signals differently, and platform-specific scores help users prioritize optimizations for the AI systems their audience uses most.",
    related: ["AI Visibility Score", "Multi-Model Validation"],
  },
  {
    term: "Competitor Tracking (AI Visibility)",
    definition:
      "Monitoring how competing websites perform on AI visibility metrics over time. AiVIS's competitor tracking compares extractability, entity clarity, and citation presence across competitors, identifying specific opportunities where structural improvements could shift citation share from competitors to your content.",
    related: ["Citation Surface", "AI Visibility Score"],
  },
  {
    term: "Brand Mention Tracking",
    definition:
      "Monitoring where a brand appears across web platforms including Reddit, Hacker News, Mastodon, GitHub, Quora, Product Hunt, and news sources. Brand mentions in community discussions, forums, and knowledge bases contribute to the entity presence that AI answer engines evaluate when selecting citation sources. AiVIS tracks mentions across 9 free sources.",
    related: ["Citation Surface", "Entity Clarity"],
  },
];

export default function GlossaryPage() {
  const [filter, setFilter] = useState("");

  const sortedTerms = useMemo(
    () =>
      [...GLOSSARY_TERMS]
        .sort((a, b) => a.term.localeCompare(b.term))
        .filter(
          (t) =>
            !filter ||
            t.term.toLowerCase().includes(filter.toLowerCase()) ||
            t.definition.toLowerCase().includes(filter.toLowerCase())
        ),
    [filter]
  );

  const definedTermSchema = GLOSSARY_TERMS.map((t) => ({
    "@type": "DefinedTerm",
    name: t.term,
    description: t.definition,
    inDefinedTermSet: {
      "@type": "DefinedTermSet",
      name: "AI Visibility & Answer Engine Optimization Glossary",
      url: "https://aivis.biz/glossary",
    },
  }));

  usePageMeta({
    title: "AI Visibility & AEO Glossary - Key Terms Defined | AiVIS",
    description:
      "Comprehensive glossary of AI visibility, answer engine optimization (AEO), and AI citation readiness terms. Definitions for AI Visibility Score, content extractability, entity clarity, Triple-Check validation, and more.",
    path: "/glossary",
    structuredData: [
      {
        "@context": "https://schema.org",
        "@type": "DefinedTermSet",
        name: "AI Visibility & Answer Engine Optimization Glossary",
        description:
          "Comprehensive glossary covering AI visibility, answer engine optimization (AEO), generative engine optimization (GEO), and AI citation readiness terminology. Published by AiVIS.",
        url: "https://aivis.biz/glossary",
        publisher: { "@id": "https://aivis.biz/#organization" },
        hasDefinedTerm: definedTermSchema,
      },
      buildBreadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "Glossary", path: "/glossary" },
      ]),
    ],
  });

  return (
    <div className="text-white py-10">
      <section className="max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 pb-12">
        <div className="card-charcoal rounded-2xl p-8 border border-white/10">
          {/* ── Header ── */}
          <div className="flex items-center gap-3 mb-2">
            <BookOpen className="h-8 w-8 text-cyan-400" />
            <p className="text-sm font-semibold uppercase tracking-wider text-cyan-400">
              Reference
            </p>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-violet-400">
            AI Visibility &amp; AEO Glossary
          </h1>

          <p className="text-lg text-white/75 mb-6 leading-relaxed">
            Definitions for the key concepts in AI visibility auditing, answer engine optimization (AEO), and generative engine optimization (GEO). These terms describe the structural signals that determine whether AI answer engines can read, trust, and cite your website.
          </p>

          {/* ── Filter ── */}
          <div className="relative mb-8">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
            <input
              type="text"
              placeholder="Filter terms..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-white/[0.04] py-2.5 pl-10 pr-4 text-sm text-white placeholder-white/40 focus:border-cyan-400/50 focus:outline-none focus:ring-1 focus:ring-cyan-400/30"
            />
          </div>

          {/* ── Term count ── */}
          <p className="text-xs text-white/45 mb-6">
            {sortedTerms.length} term{sortedTerms.length !== 1 ? "s" : ""}{filter ? " matching filter" : ""}
          </p>

          {/* ── Terms ── */}
          <div className="space-y-6">
            {sortedTerms.map((t, i) => (
              <article
                key={i}
                id={t.term
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, "-")
                  .replace(/(^-|-$)/g, "")}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-5"
              >
                <h2 className="text-lg font-bold text-white mb-2">{t.term}</h2>
                <p className="text-sm text-white/70 leading-relaxed">{t.definition}</p>
                {t.related && t.related.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="text-xs text-white/40">Related:</span>
                    {t.related.map((r) => (
                      <a
                        key={r}
                        href={`#${r
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, "-")
                          .replace(/(^-|-$)/g, "")}`}
                        className="text-xs text-cyan-400/70 hover:text-cyan-300 transition"
                      >
                        {r}
                      </a>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>

          {sortedTerms.length === 0 && (
            <p className="text-center text-white/50 py-8">
              No terms match &ldquo;{filter}&rdquo;
            </p>
          )}

          {/* ── Category Claim Footer ── */}
          <div className="mt-10 rounded-xl border border-cyan-400/15 bg-cyan-500/[0.04] p-6">
            <p className="text-sm text-white/65 leading-relaxed">
              <strong className="text-white">AiVIS</strong> is not an SEO tool. It is the first platform built specifically to measure and improve whether AI answer engines can read, trust, and cite your website. The terms in this glossary describe the structural signals and measurement methods that define the AI visibility category.
            </p>
          </div>

          <div className="mt-8">
            <h3 className="text-lg font-semibold text-white/80 mb-4">Related Pages</h3>
            <div className="flex flex-wrap gap-3">
              <Link to="/methodology" className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/[0.06] transition">Methodology</Link>
              <Link to="/why-ai-visibility" className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/[0.06] transition">Why AI Visibility?</Link>
              <Link to="/blogs" className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/[0.06] transition">Blog</Link>
              <Link to="/guide" className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/[0.06] transition">Implementation Guide</Link>
              <Link to="/compliance" className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/[0.06] transition">Compliance</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
