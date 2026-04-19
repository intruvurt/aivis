/**
 * Query → Scan Pipeline Mapping
 *
 * Deterministic mapping of query intent to system capabilities
 * Pre-computed cache to populate pages immediately without forcing scan
 */

import type { Query } from './queries.js';

export interface PrecomputedCache {
  slug: string;
  title: string;
  description: string;
  summary: string;
  citeRefs: string[];
  insights: string[];
  recommendedChecks: string[];
  expectedScore: {
    min: number;
    max: number;
    typical: number;
  };
}

// Precomputed insights (deterministic per query class)
const CACHE: Record<string, Omit<PrecomputedCache, 'slug'>> = {
  // AI Visibility focused queries
  'ai-visibility-audit': {
    title: 'AI Visibility Audit | AIVIS',
    description:
      "Comprehensive audit of your site's machine-readability and citation-readiness for AI-generated answers.",
    summary:
      'AI visibility measures whether AI systems can extract, understand, and cite your content accurately. Most audits reveal structural gaps in entity definition, schema coverage, and content extraction boundaries.',
    citeRefs: ['entity-clarity-importance', 'schema-impact-study', 'citation-readiness-framework'],
    insights: [
      'Entity ambiguity is the #1 reason sites fail AI visibility tests',
      "Schema.org coverage alone doesn't guarantee AI readability",
      'Content extraction depends on semantic HTML structure',
      'Privacy policies and security signals boost trust scores',
      'Internal linking clarity improves entity resolution',
    ],
    recommendedChecks: [
      'Entity Clarity Scan',
      'Schema Coverage Analysis',
      'Citation Readiness Test',
      'Machine Readability Score',
      'Extractability Framework Check',
    ],
    expectedScore: { min: 25, max: 95, typical: 62 },
  },

  'entity-seo-checker': {
    title: 'Entity SEO Checker | AIVIS',
    description:
      'Verify that your primary entity is clearly defined, consistently referenced, and machine-readable.',
    summary:
      "Entity clarity is foundational. If AI systems can't identify who or what you are, they can't cite you accurately. This checker validates your entity definition across markup, metadata, and content.",
    citeRefs: ['entity-definition-standard', 'entity-consistency-metric'],
    insights: [
      'Entity definitions matter more than keyword density',
      'About pages and contact info reinforce identity',
      'Structured naming improves entity resolution',
      'Alternative names (aliases) must be explicitly marked',
      'Entity relationships strengthen knowledge graph position',
    ],
    recommendedChecks: [
      'Entity Presence Validation',
      'Alias Coverage Check',
      'Contact Info Audit',
      'Knowledge Graph Alignment',
    ],
    expectedScore: { min: 30, max: 98, typical: 71 },
  },

  'schema-validation-ai': {
    title: 'Schema Validation for AI | AIVIS',
    description:
      'Detect schema.org markup errors, coverage gaps, and optimization opportunities for AI systems.',
    summary:
      'Schema.org validation ensures your structured data is syntactically correct and semantically meaningful. AI systems rely on schema to extract relationships, definitions, and context.',
    citeRefs: ['schema-validation-standard', 'schema-ai-impact'],
    insights: [
      'Incomplete schema is worse than no schema',
      "Schema errors don't prevent AI indexing but reduce accuracy",
      'Multiple schema types on same entity can confuse AI',
      'Nested schema hierarchy matters for complex entities',
    ],
    recommendedChecks: [
      'JSON-LD Syntax Check',
      'Schema Completeness Audit',
      'Conflicting Schema Detection',
      'AI-Specific Markup Validation',
    ],
    expectedScore: { min: 40, max: 100, typical: 75 },
  },

  'citation-readiness-test': {
    title: 'Citation Readiness Test | AIVIS',
    description:
      'Measure whether AI systems can quote and cite your content accurately in generated responses.',
    summary:
      'Citation readiness means your content is structured so AI can extract quotable sections and link back to their sources. This is critical for credibility and traffic.',
    citeRefs: ['citation-extraction-study', 'quotability-index'],
    insights: [
      'Extractable sections must be >50 words to be reliably cited',
      'Clear answer blocks (Q&A schema) simplify citation extraction',
      'Privacy policies reduce citation confidence',
      'Ambiguous sources hurt citation attribution',
    ],
    recommendedChecks: [
      'Quotability Index Calc',
      'Answer Block Detection',
      'Citation Blocker Scan',
      'Source Attribution Clarity',
    ],
    expectedScore: { min: 35, max: 92, typical: 68 },
  },

  'machine-readability-score': {
    title: 'Machine Readability Score | AIVIS',
    description:
      'Get a quantified measure of how easily AI systems can read and understand your content.',
    summary:
      'Machine readability combines schema coverage, HTML structure, metadata completeness, and entity clarity. A higher score means better AI compatibility.',
    citeRefs: ['readability-algorithm', 'ai-parsing-framework'],
    insights: [
      'Semantic HTML5 improves readability by 15-25%',
      'Character encoding errors tank readability scores',
      'Hidden or script-generated content confuses AI',
      "Readability and human readability aren't the same",
    ],
    recommendedChecks: [
      'HTML Structure Audit',
      'Metadata Completeness',
      'Content Visibility Analysis',
      'AI Parsing Simulation',
    ],
    expectedScore: { min: 40, max: 96, typical: 70 },
  },

  'visibility-in-claude-ai': {
    title: 'Claude AI Visibility | AIVIS',
    description: 'Check how your site appears in Claude AI training data and inference responses.',
    summary:
      "Claude's training cutoff and knowledge graph determine what it knows about your site. This checker assesses inference-time visibility.",
    citeRefs: ['claude-training-sources', 'llm-data-currency'],
    insights: [
      "Claude's training data has a knowledge cutoff",
      'Real-time vector indexing is different from training data',
      'Domain authority influences Claude citation likelihood',
      'Structured data helps Claude build knowledge graphs',
    ],
    recommendedChecks: [
      'Training Data Likelihood',
      'Real-Time Index Coverage',
      'Citation Bias Prediction',
    ],
    expectedScore: { min: 25, max: 90, typical: 58 },
  },

  'visibility-in-chatgpt': {
    title: 'ChatGPT Visibility | AIVIS',
    description: "Measure your site's likelihood of appearing in ChatGPT responses.",
    summary:
      'ChatGPT uses Bing Search integration, training data, and real-time retrieval. Your visibility depends on search ranking, content quality, and entity clarity.',
    citeRefs: ['chatgpt-retrieval-method', 'search-ranking-influence'],
    insights: [
      'ChatGPT prefers highly-ranked search results',
      'Citation format affects likelihood of being quoted',
      'Entity clarity improves ChatGPT knowledge graph placement',
      'Recent content gets priority in real-time retrieval',
    ],
    recommendedChecks: [
      'Search Ranking Check',
      'Content Freshness Audit',
      'Citation Format Validation',
    ],
    expectedScore: { min: 30, max: 94, typical: 65 },
  },

  'visibility-in-google-ai-search': {
    title: 'Google AI Overview Visibility | AIVIS',
    description: "Check your eligibility and visibility in Google's AI-generated responses.",
    summary:
      "Google's AI Overviews pull from top search results and featured snippets. High visibility requires search ranking excellence plus clear, extractable answers.",
    citeRefs: ['google-ai-overview-method', 'featured-snippet-strategy'],
    insights: [
      'Position 1-3 search ranking is baseline for AI visibility',
      'Featured snippets give 3x likelihood of AI inclusion',
      'Answer clarity matters more than length',
      'Entity brand signals influence inclusion confidence',
    ],
    recommendedChecks: [
      'Google Search Ranking',
      'Featured Snippet Opportunity',
      'Answer Clarity Analysis',
      'SERP Visibility Index',
    ],
    expectedScore: { min: 20, max: 98, typical: 72 },
  },
};

export function getPrecomputedCache(slug: string): PrecomputedCache | null {
  const base = CACHE[slug];
  if (!base) return null;

  return {
    slug,
    ...base,
  };
}

export function getRelatedQueries(slug: string): string[] {
  // Semantic clustering - queries that share intent patterns
  const clusters: string[][] = [
    [
      'ai-visibility-audit',
      'entity-seo-checker',
      'schema-validation-ai',
      'citation-readiness-test',
    ],
    ['machine-readability-score', 'ai-crawl-audit', 'content-structuring-audit'],
    ['visibility-in-claude-ai', 'visibility-in-chatgpt', 'visibility-in-google-ai-search'],
  ];

  const cluster = clusters.find((c) => c.includes(slug));
  if (!cluster) return [];

  return cluster.filter((q) => q !== slug).slice(0, 3);
}

export function mapQueryToScanIntent(
  slug: string,
  seed?: string
): {
  scanType: 'audit' | 'entity-check' | 'schema-validation' | 'citation-test';
  priority: 'high' | 'normal';
  autoTrigger: boolean;
} {
  // Map query intent to scan pipeline
  if (slug.includes('audit')) {
    return { scanType: 'audit', priority: 'high', autoTrigger: true };
  }
  if (slug.includes('entity') || slug.includes('seo')) {
    return { scanType: 'entity-check', priority: 'high', autoTrigger: false };
  }
  if (slug.includes('schema') || slug.includes('validation')) {
    return { scanType: 'schema-validation', priority: 'normal', autoTrigger: false };
  }
  if (slug.includes('citation') || slug.includes('readiness')) {
    return { scanType: 'citation-test', priority: 'high', autoTrigger: false };
  }

  return { scanType: 'audit', priority: 'normal', autoTrigger: false };
}
