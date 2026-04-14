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
    term: "Score Fix (AutoFix PR)",
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
      "Monitoring where a brand appears across web platforms including Reddit, Hacker News, Mastodon, GitHub, Quora, Product Hunt, and news sources. Brand mentions in community discussions, forums, and knowledge bases contribute to the entity presence that AI answer engines evaluate when selecting citation sources. AiVIS tracks mentions across 19 free sources without requiring API keys.",
    related: ["Citation Surface", "Entity Clarity", "Mention Velocity"],
  },
  {
    term: "AI Answer Assembly",
    definition:
      "The internal process by which a language model constructs a response from retrieved fragments, parametric memory, and structural signals. Answer assembly determines which sources are quoted, paraphrased, or omitted. Understanding assembly mechanics is essential for diagnosing why a page is cited, distorted, or ignored. AiVIS reverse-engineering tools decompose answer assembly paths to expose citation logic.",
    related: ["Retrieval Pipeline", "Distortion Map", "Reverse Engineering (AI Answers)"],
  },
  {
    term: "Answer Distortion",
    definition:
      "The measurable gap between what a web page actually states and what an AI answer engine reproduces when referencing that page. Distortion manifests as omission (missing key facts), misattribution (crediting the wrong source), entity confusion (conflating distinct entities), or rewriting (altering meaning). AiVIS quantifies answer distortion as a core dimension of the visibility score.",
    related: ["Distortion Map", "Omission Detection", "Misattribution Detection"],
  },
  {
    term: "Answer Engine",
    definition:
      "An AI system that generates direct responses to user queries rather than returning a list of links. Answer engines include ChatGPT, Perplexity, Gemini, Claude, Copilot, Brave Search AI, Grok, and others. Unlike traditional search engines, answer engines synthesize information from multiple sources into a single response, making citation readiness and content extractability critical for visibility.",
    related: ["AI Answer Assembly", "Citation Surface", "Retrieval Pipeline"],
  },
  {
    term: "Audit Ledger",
    definition:
      "A persistent, timestamped record of all visibility audits performed on a domain. The audit ledger tracks score progression, finding history, and remediation outcomes over time. It serves as the authoritative timeline for measuring whether structural changes improved AI extractability and citation presence. AiVIS maintains per-user audit ledgers with full evidence retention.",
    related: ["Visibility Audit", "Evidence Layer", "BRAG Trail"],
  },
  {
    term: "Author Entity",
    definition:
      "A structured representation of a content creator expressed through Person schema, consistent byline naming, and cross-platform identity signals. Author entities help AI systems attribute content to verifiable individuals with expertise. Strong author entity signals increase citation confidence because AI answer engines prefer sourcing from identifiable experts over anonymous content.",
    related: ["Publisher Entity", "Entity Clarity", "E-E-A-T"],
  },
  {
    term: "BRAG Evidence ID",
    definition:
      "A traceable identifier attached to each individual finding in an AiVIS audit. Every recommendation, score component, and structural gap links back to a BRAG Evidence ID that references the exact page element, schema property, or content fragment that triggered it. Evidence IDs make audits verifiable and reproducible rather than opaque.",
    related: ["BRAG Trail", "Evidence Layer", "Evidence-Backed Scoring"],
  },
  {
    term: "Citation Readiness",
    definition:
      "An estimated likelihood that a page can be accurately cited by an AI answer engine. Citation readiness combines content extractability, entity clarity, schema completeness, and trust signal strength into a single predictive metric. A page with high citation readiness has clear answer blocks, unambiguous entity references, and machine-readable structure that minimises the chance of distortion during answer assembly.",
    related: ["Citation Surface", "Content Extractability", "Answer Block Density"],
  },
  {
    term: "Content Depth Scoring",
    definition:
      "A metric evaluating how thoroughly a page covers its stated topic. Content depth scoring examines heading hierarchy, subtopic coverage, definition density, supporting evidence, and the presence of actionable detail. AI answer engines favour pages with high content depth because they provide more extractable knowledge fragments per retrieval, reducing the need to synthesise across multiple sources.",
    related: ["Content Extractability", "Answer Block Density", "Topical Authority"],
  },
  {
    term: "Content Freshness Signal",
    definition:
      "Temporal indicators that communicate how recently content was created or updated. Freshness signals include datePublished and dateModified in Article schema, visible last-updated timestamps, and changelog metadata. AI answer engines weight freshness when selecting citation sources for time-sensitive queries. Stale content with missing freshness signals risks being deprioritised in answer assembly.",
    related: ["Schema Completeness", "Trust Signals", "Machine Readability"],
  },
  {
    term: "Crawl Budget (AI)",
    definition:
      "The finite resources an AI training crawler or RAG retrieval system allocates to indexing a domain. AI crawl budgets are influenced by robots.txt directives, server response times, rendering requirements, and site structure. Unlike traditional search crawl budgets, AI crawl budgets must account for LLM-specific user agents (GPTBot, ClaudeBot, PerplexityBot) and may prioritise structurally rich pages over deeply nested ones.",
    related: ["Crawlability", "Machine Readability", "llms.txt"],
  },
  {
    term: "Crypto & Web3 Visibility",
    definition:
      "The specific AI visibility challenges facing cryptocurrency, blockchain, and decentralised web projects. Crypto entities face heightened entity confusion (token names conflating with common words), rapid content staleness (price and protocol changes), and trust signal deficits (anonymous teams, unverifiable claims). AiVIS addresses these with entity disambiguation auditing and structured schema recommendations tailored to Web3 naming conventions.",
    related: ["Entity Clarity", "Entity Confusion", "Distortion Resistance"],
  },
  {
    term: "Distortion Map",
    definition:
      "A visual and structural breakdown of how an AI answer engine misrepresents a page's content. A distortion map categorises errors into omission (key facts dropped), misattribution (wrong source credited), entity confusion (distinct entities merged), and semantic drift (meaning altered during paraphrase). AiVIS generates distortion maps as part of the evidence layer so users can see exactly where and how their content was distorted.",
    related: ["Answer Distortion", "Omission Detection", "Misattribution Detection"],
  },
  {
    term: "Distortion Resistance",
    definition:
      "A measure of how well a page's structure prevents AI answer engines from misrepresenting its content. High distortion resistance means explicit definitions, unambiguous entity names, consistent factual claims, and structured data that constrains AI interpretation. Distortion resistance is improved through schema completeness, answer block formatting, and entity clarity — not through content volume alone.",
    related: ["Distortion Map", "Entity Clarity", "Content Extractability"],
  },
  {
    term: "Entity Confusion",
    definition:
      "A distortion type where an AI answer engine conflates two or more distinct entities — merging a brand with a competitor, confusing an author with a similarly-named person, or attributing product features to the wrong company. Entity confusion is one of the most damaging forms of answer distortion because it erodes brand identity in AI-mediated discovery. AiVIS detects entity confusion through multi-model comparison and structured schema analysis.",
    related: ["Entity Clarity", "Entity Resolution (AI Context)", "Distortion Map"],
  },
  {
    term: "Entity Resolution (AI Context)",
    definition:
      "The ability of an AI system to disambiguate and correctly identify distinct entities that share similar names or attributes. In the AI visibility context, entity resolution determines whether an AI engine can tell your brand apart from competitors, similarly-named products, or generic concepts. Strong entity resolution depends on consistent naming in schema markup, unique identifiers (URLs, sameAs links), and coherent cross-reference patterns.",
    related: ["Entity Clarity", "Entity Confusion", "Knowledge Graph Coherence"],
  },
  {
    term: "Evidence-Backed Scoring",
    definition:
      "A scoring methodology where every point awarded or deducted is linked to a verifiable content signal, schema property, or structural finding. Evidence-backed scoring rejects opaque algorithms in favour of transparent, auditable scoring chains. Each component of the AiVIS visibility score traces to specific BRAG Evidence IDs, allowing users to understand exactly why they scored what they scored and what to fix.",
    related: ["BRAG Evidence ID", "Evidence Layer", "AI Visibility Score"],
  },
  {
    term: "Evidence Trail",
    definition:
      "The complete chain of provable findings that links an audit conclusion to the underlying page data. An evidence trail starts at the raw HTML and schema, passes through extraction analysis and multi-model validation, and terminates at a scored recommendation with a BRAG Evidence ID. Evidence trails make audits reproducible: a different auditor examining the same page should reach the same findings.",
    related: ["BRAG Trail", "Evidence-Backed Scoring", "Visibility Audit"],
  },
  {
    term: "Extraction Yield",
    definition:
      "The percentage of a page's meaningful content that an AI retrieval system can usably extract during answer assembly. Low extraction yield means the AI system cannot parse most of the page's value — often due to JavaScript-rendered content, images without alt text, or unstructured prose without headings. AiVIS measures extraction yield as part of the content extractability dimension and recommends structural changes to increase it.",
    related: ["Content Extractability", "Machine Readability", "Answer Block Density"],
  },
  {
    term: "Fix Protocol",
    definition:
      "A prioritised, evidence-linked remediation plan generated from audit findings. A fix protocol converts structural gaps into specific, actionable directives: add Organization JSON-LD, restructure H2 hierarchy, insert dateModified, create llms.txt, and so on. Each directive traces to the finding that triggered it. Fix protocols are the bridge between diagnosis and implementation, and they drive Score Fix automated PR generation.",
    related: ["Score Fix", "Automated Remediation", "Evidence Trail"],
  },
  {
    term: "Ghost Audit",
    definition:
      "A stealth analysis that reveals how AI answer engines currently render a brand without the brand's direct involvement. Ghost audits query multiple AI models with brand-related prompts and capture how the brand is described, attributed, or omitted. This surfaces distortions that the brand may not be aware of — misattribution, entity confusion, or complete invisibility. AiVIS provides ghost auditing as a reverse-engineering tool for Alignment+ tiers.",
    related: ["Reverse Engineering (AI Answers)", "Answer Distortion", "Model Diff"],
  },
  {
    term: "Knowledge Graph Coherence",
    definition:
      "How consistently and completely a website's structured data forms an interlinked entity graph. Coherent knowledge graphs have Organisation → Person → Article → Product relationships expressed through JSON-LD with matching identifiers, sameAs cross-references, and no orphaned entities. AI answer engines use knowledge graph coherence to evaluate whether a source represents a trustworthy, well-structured information domain.",
    related: ["Entity Clarity", "Schema Completeness", "JSON-LD"],
  },
  {
    term: "llms.txt",
    definition:
      "A machine-readable summary file placed at a website's root (similar to robots.txt) that provides large language models with a concise, structured overview of the site's identity, purpose, key pages, and capabilities. llms.txt helps AI systems understand a domain's scope without crawling every page. AiVIS recommends and can auto-generate llms.txt as part of the fix protocol for improving AI discoverability.",
    related: ["Machine Readability", "Crawl Budget (AI)", "Fix Protocol"],
  },
  {
    term: "Machine Legibility",
    definition:
      "The degree to which content is not just accessible to machines (machine readable) but actually comprehensible — meaning the machine can extract correct semantic meaning, entity relationships, and factual claims. Machine legibility goes beyond valid HTML: it requires explicit definitions, unambiguous pronoun references, consistent terminology, and structural cues that prevent misinterpretation during AI parsing.",
    related: ["Machine Readability", "Content Extractability", "Distortion Resistance"],
  },
  {
    term: "Mention Velocity",
    definition:
      "The rate at which new brand mentions appear across tracked platforms over a given time period. Mention velocity indicates whether a brand's entity presence is growing, stable, or declining in the community signals that AI answer engines index. A sustained increase in mention velocity across Reddit, Hacker News, GitHub, and news sources correlates with improved citation likelihood in AI-generated answers.",
    related: ["Brand Mention Tracking", "Citation Surface", "Topical Authority"],
  },
  {
    term: "Misattribution Detection",
    definition:
      "Identifying instances where an AI answer engine credits content, data, or expertise to the wrong source. Misattribution is a high-impact distortion type because it redirects citation equity to competitors or unrelated entities. AiVIS detects misattribution through multi-model comparison, entity schema analysis, and citation test verification across search and AI systems.",
    related: ["Answer Distortion", "Entity Confusion", "Citation Testing"],
  },
  {
    term: "Model Diff",
    definition:
      "A comparative analysis showing how different AI models (ChatGPT, Claude, Gemini, Perplexity) treat the same content. Model diffs reveal which models cite a source, which distort it, and which ignore it entirely. These cross-model comparisons expose model-specific blind spots and help prioritise structural fixes that improve visibility across the broadest set of answer engines.",
    related: ["Multi-Model Validation", "Ghost Audit", "Triple-Check Orchestration"],
  },
  {
    term: "Omission Detection",
    definition:
      "Identifying when an AI answer engine drops key facts, features, or claims from a page during answer assembly. Omission is the most common form of answer distortion — AI systems often extract a partial summary that leaves out critical differentiators. AiVIS flags omissions by comparing source content against AI-generated representations, highlighting exactly which information was lost.",
    related: ["Answer Distortion", "Distortion Map", "Content Depth Scoring"],
  },
  {
    term: "Prompt Intelligence",
    definition:
      "Understanding which user prompts and query patterns lead AI answer engines to cite (or skip) a given source. Prompt intelligence helps brands identify the query space where they are visible, invisible, or distorted. AiVIS uses prompt intelligence to power citation testing, ghost audits, and reverse-engineering tools that map the relationship between query intent and citation outcomes.",
    related: ["Citation Testing", "Ghost Audit", "Reverse Engineering (AI Answers)"],
  },
  {
    term: "Publisher Entity",
    definition:
      "A structured representation of the organisation responsible for publishing content, expressed through Organization schema, consistent branding, and verifiable contact information. Publisher entities anchor trust signals for AI answer engines. A strong publisher entity — with logo, address, founding date, sameAs social links, and linked author entities — signals to AI systems that content originates from a credible, identifiable source.",
    related: ["Author Entity", "Entity Clarity", "Trust Signals"],
  },
  {
    term: "Retrieval Pipeline",
    definition:
      "The technical chain an AI answer engine follows from receiving a user query to selecting source documents for answer assembly. Retrieval pipelines typically involve query embedding, vector similarity search, re-ranking, and source selection. Content that is structurally extractable, entity-coherent, and schema-rich is more likely to survive each stage of the retrieval pipeline and appear in the final answer.",
    related: ["RAG", "AI Answer Assembly", "Content Extractability"],
  },
  {
    term: "Reverse Engineering (AI Answers)",
    definition:
      "The practice of decompiling AI-generated answers to understand how the answer engine assembled them — which sources were used, how content was transformed, and what was omitted or distorted. AiVIS provides reverse-engineering tools (decompile, ghost audit, model diff, simulate) that let users trace backwards from an AI answer to the structural signals that influenced it.",
    related: ["Ghost Audit", "Model Diff", "AI Answer Assembly"],
  },
  {
    term: "Semantic Anchor",
    definition:
      "A content element — such as a named definition, a labelled statistic, or an explicit claim — that helps AI systems anchor meaning to a specific entity or fact. Semantic anchors reduce ambiguity during answer assembly by giving AI models concrete, extractable reference points. Pages rich in semantic anchors have higher extraction yield and lower distortion rates.",
    related: ["Answer Block Density", "Content Extractability", "Distortion Resistance"],
  },
  {
    term: "SERP Overlap Signal",
    definition:
      "The correlation between a page's performance in traditional search engine results pages (SERPs) and its citation presence in AI-generated answers. SERP overlap signals indicate whether search ranking strength translates to AI visibility. AiVIS uses SERP data (via SerpAPI for Alignment+ tiers) to enrich entity clarity and authority scoring with real-world ranking evidence.",
    related: ["Citation Surface", "Topical Authority", "AI Visibility Score"],
  },
  {
    term: "Signal-to-Noise Ratio (Content)",
    definition:
      "The ratio of substantive, citable content on a page to filler, boilerplate, or repetitive material. A high signal-to-noise ratio means AI systems can extract valuable knowledge fragments without wading through navigation chrome, cookie banners, or promotional copy. AiVIS evaluates signal-to-noise as part of content extractability, rewarding pages that present clear information with minimal distraction.",
    related: ["Content Extractability", "Answer Block Density", "Extraction Yield"],
  },
  {
    term: "SSFR (Source-Signal-Fact-Relationship)",
    definition:
      "A framework describing how AI answer engines evaluate content trustworthiness through four dimensions: Source identity (who published it), Signal strength (structural indicators of authority), Fact verifiability (whether claims can be cross-referenced), and Relationship coherence (how entities and claims connect). SSFR analysis underpins AiVIS's evidence-backed scoring model and explains why structurally equivalent content from different sources receives different citation treatment.",
    related: ["Evidence-Backed Scoring", "Trust Signals", "Entity Clarity"],
  },
  {
    term: "Structured Citation",
    definition:
      "A citation in an AI-generated answer that includes verifiable source attribution — a named entity, URL, or explicit reference that allows the reader to trace the claim back to its origin. Structured citations are the goal of AI visibility optimisation. They contrast with unattributed paraphrasing, where AI incorporates content without crediting the source. AiVIS measures whether structural signals make structured citations more likely.",
    related: ["Citation Readiness", "Citation Surface", "Evidence Trail"],
  },
  {
    term: "Topical Authority",
    definition:
      "The perceived expertise and depth a website demonstrates within a specific subject domain, as inferred by AI answer engines from content depth, internal linking, schema coverage, and external mention presence. Topical authority influences whether AI systems select a source for queries within that domain. Building topical authority requires consistent content production, comprehensive subtopic coverage, and entity-coherent structured data.",
    related: ["Topical Metrics", "E-E-A-T", "Content Depth Scoring"],
  },
  {
    term: "Topical Metrics",
    definition:
      "Quantitative measures of a website's depth and breadth within specific subject domains. Topical metrics include subtopic coverage ratio, content depth scoring, internal cross-linking density, and entity mention frequency. AiVIS uses topical metrics to assess whether a site has sufficient structural depth to be treated as an authoritative source for domain-specific AI queries.",
    related: ["Topical Authority", "Content Depth Scoring", "AI Visibility Score"],
  },
  {
    term: "Triple-Check Orchestration",
    definition:
      "The coordination layer that manages AiVIS's three-stage AI pipeline. Orchestration handles model selection, timeout budgets (57s total, 25s primary cap, 8s fallback floor), sequential stage execution (AI1 deep analysis → AI2 peer critique → AI3 validation gate), deadline propagation, and graceful degradation when individual models fail. Triple-check orchestration ensures the pipeline produces reliable, multi-perspective scores without single-point-of-failure risk.",
    related: ["Triple-Check Validation", "Multi-Model Validation", "Evidence-Backed Scoring"],
  },
  {
    term: "Agency Workspace",
    definition:
      "A multi-tenant environment within AiVIS designed for agencies managing AI visibility audits across multiple client domains. Agency workspaces provide isolated per-client audit ledgers, consolidated dashboards, cross-client benchmarking, and team-level access controls. They allow agencies to deliver AI visibility services at scale while maintaining client data separation and consistent reporting.",
    related: ["Audit Ledger", "Visibility Audit", "Competitor Tracking (AI Visibility)"],
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
      "60+ in-depth definitions for AI visibility, answer engine optimization (AEO), distortion mapping, evidence-backed scoring, BRAG evidence trails, SSFR analysis, triple-check orchestration, and citation readiness. The definitive reference for AI answer assembly, entity clarity, and structural extractability.",
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
            60+ in-depth definitions covering AI visibility auditing, answer engine optimization (AEO), distortion diagnostics, evidence-backed scoring, BRAG evidence trails, SSFR analysis, triple-check orchestration, and citation readiness engineering. These terms define the structural signals, measurement methods, and remediation protocols that determine whether AI answer engines can read, trust, and cite your website.
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
              <strong className="text-white">AiVIS</strong> is not an SEO tool. It is AI visibility infrastructure — the first platform built to measure and remediate how AI answer engines distort, misattribute, omit, and rewrite website content. This glossary defines the evidence-backed measurement methods, distortion diagnostics, and fix protocols that constitute the AI visibility category.
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
