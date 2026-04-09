/**
 * previewScanner.ts — Generates a mini audit result from deterministic
 * evidence extraction + scoring. No AI call needed.
 *
 * Used by the public /api/analyze/preview endpoint to give cold visitors
 * a real slice of value before auth.
 */

import type { SSFREvidenceItem } from '../../../shared/types.js';
import type { ScoringResult } from '../../../shared/types.js';

// ─── Human-readable finding descriptions per evidence key ───────────────────

const FINDING_DESCRIPTIONS: Record<string, { missing: string; partial: string; invalid: string }> = {
  organization_schema: {
    missing: 'No Organization schema detected — AI cannot verify your entity identity',
    partial: 'Organization schema is incomplete — entity signals are weak',
    invalid: 'Organization schema is malformed — AI parsers may ignore it',
  },
  json_ld_schemas: {
    missing: 'No JSON-LD structured data found — AI cannot extract typed entities from this page',
    partial: 'Limited structured data — only basic schema types detected',
    invalid: 'Structured data is present but malformed',
  },
  title_tag: {
    missing: 'Missing or empty title tag — AI cannot identify the page topic',
    partial: 'Title tag exists but is too short or too long for optimal AI extraction',
    invalid: 'Title tag is malformed — AI parsers may misread page intent',
  },
  meta_description: {
    missing: 'No meta description — AI has no summary to extract or cite',
    partial: 'Meta description exists but length is suboptimal for AI extraction',
    invalid: 'Meta description is malformed',
  },
  h1_heading: {
    missing: 'No H1 heading — page purpose is unclear to AI parsers',
    partial: 'Multiple H1 tags detected — conflicting primary topic signals',
    invalid: 'H1 heading is present but malformed',
  },
  heading_hierarchy: {
    missing: 'No heading structure — content is unnavigable for AI extraction',
    partial: 'Heading hierarchy is shallow — AI may struggle to identify content sections',
    invalid: 'Heading hierarchy has structural issues',
  },
  robots_txt: {
    missing: 'No robots.txt found — crawlers cannot verify access permissions',
    partial: 'robots.txt is incomplete',
    invalid: 'robots.txt exists but contains errors',
  },
  ai_crawler_access: {
    missing: 'AI crawler access is not configured — bots cannot verify if they are allowed',
    partial: 'Some AI crawlers are blocked — content is partially invisible to AI models',
    invalid: 'AI crawler directives are misconfigured',
  },
  llms_txt: {
    missing: 'No llms.txt file — AI models have no machine-readable site guide',
    partial: 'llms.txt is present but incomplete',
    invalid: 'llms.txt is present but malformed',
  },
  og_tags: {
    missing: 'No Open Graph tags — AI and social platforms cannot preview this page',
    partial: 'Open Graph tags are incomplete — missing title, description, or image',
    invalid: 'Open Graph tags are malformed',
  },
  faq_schema: {
    missing: 'No FAQ schema — question-answer content is invisible to AI extractors',
    partial: 'FAQ schema is incomplete',
    invalid: 'FAQ schema is malformed',
  },
  word_count: {
    missing: 'Very thin content (under 300 words) — insufficient depth for AI citation',
    partial: 'Content depth is moderate — may lack enough detail for comprehensive AI extraction',
    invalid: 'Content measurement returned unexpected values',
  },
  question_headings: {
    missing: 'No question-formatted headings — missing conversational entry points for AI',
    partial: 'Few question headings — limited conversational hooks for AI answers',
    invalid: 'Question heading detection issue',
  },
  sitemap: {
    missing: 'No sitemap.xml found — AI crawlers cannot discover your content structure',
    partial: 'Sitemap exists but may be incomplete',
    invalid: 'Sitemap is present but contains errors',
  },
  canonical_url: {
    missing: 'No canonical URL set — AI may index duplicate versions of this page',
    partial: 'Canonical URL is set but may not match the primary URL',
    invalid: 'Canonical URL is malformed',
  },
  same_as_links: {
    missing: 'No sameAs links in schema — entity cannot be cross-referenced across platforms',
    partial: 'Limited sameAs links',
    invalid: 'sameAs links are malformed',
  },
  author_entity: {
    missing: 'No author entity in structured data — content authorship is unverifiable',
    partial: 'Author entity is incomplete',
    invalid: 'Author entity is malformed',
  },
  twitter_card: {
    missing: 'No Twitter Card meta tags — social/AI preview is unsupported',
    partial: 'Twitter Card tags are incomplete',
    invalid: 'Twitter Card tags are malformed',
  },
  lang_attribute: {
    missing: 'No lang attribute — AI cannot determine content language',
    partial: 'Language attribute may be incomplete',
    invalid: 'Language attribute is malformed',
  },
  tldr_block: {
    missing: 'No TL;DR or summary block — AI has no quick-extract passage',
    partial: 'Summary block exists but is not in optimal position',
    invalid: 'Summary block detection issue',
  },
  schema_depth: {
    missing: 'No schema type diversity — limited entity relationship signals',
    partial: 'Some schema types present but insufficient depth',
    invalid: 'Schema depth measurement issue',
  },
};

// ─── Recommendation templates per fix priority ──────────────────────────────

const RECOMMENDATION_MAP: Record<string, string> = {
  organization_schema: 'Add Organization schema (JSON-LD) to establish entity identity — this is the single highest-lift fix for AI citation readiness',
  json_ld_schemas: 'Add structured data (JSON-LD) with at least Organization and primary content type schemas',
  title_tag: 'Write a clear, specific title tag (30–60 chars) that declares the page\'s primary topic',
  h1_heading: 'Set one clear H1 heading that matches the page\'s core purpose and title tag',
  meta_description: 'Add a meta description (120–155 chars) that summarizes what this page offers',
  robots_txt: 'Create a robots.txt that explicitly allows AI crawlers (GPTBot, ClaudeBot, PerplexityBot)',
  ai_crawler_access: 'Update robots.txt to allow all major AI crawlers access to your content',
  heading_hierarchy: 'Restructure headings into a clear H1 → H2 → H3 hierarchy that maps your content sections',
  word_count: 'Expand content depth to at least 800 words with specific, citable claims',
  og_tags: 'Add complete Open Graph tags (og:title, og:description, og:image) for proper AI/social previews',
  llms_txt: 'Create an llms.txt file at your domain root to guide AI models through your site structure',
  faq_schema: 'Add FAQPage schema for any Q&A content to enable direct AI answer extraction',
};

// ─── Priority order for evidence keys (most impactful first) ────────────────

const EVIDENCE_PRIORITY: string[] = [
  'organization_schema',
  'json_ld_schemas',
  'title_tag',
  'h1_heading',
  'meta_description',
  'robots_txt',
  'ai_crawler_access',
  'heading_hierarchy',
  'word_count',
  'og_tags',
  'faq_schema',
  'llms_txt',
  'sitemap',
  'canonical_url',
  'same_as_links',
  'author_entity',
  'question_headings',
  'twitter_card',
  'lang_attribute',
  'tldr_block',
  'schema_depth',
];

// ─── Status line generator ──────────────────────────────────────────────────

function getStatusLine(score: number): string {
  if (score >= 80) return 'Strong AI visibility — this page is well-positioned for citation';
  if (score >= 60) return 'Moderate AI visibility — some gaps are limiting citation readiness';
  if (score >= 40) return 'Weak AI visibility — significant structural issues are blocking citation';
  if (score >= 20) return 'Poor AI visibility — major gaps make this page nearly invisible to AI';
  return 'Critical AI visibility issues — AI models will struggle to read, trust, or cite this page';
}

// ─── Main preview result builder ────────────────────────────────────────────

export interface PreviewResult {
  url: string;
  score: number;
  status_line: string;
  findings: string[];
  recommendation: string;
  hard_blockers: string[];
  scanned_at: string;
}

export function buildPreviewResult(
  url: string,
  evidence: SSFREvidenceItem[],
  scoring: ScoringResult,
): PreviewResult {
  const evidenceMap = new Map<string, SSFREvidenceItem>();
  for (const item of evidence) {
    if (!evidenceMap.has(item.evidence_key)) {
      evidenceMap.set(item.evidence_key, item);
    }
  }

  // Collect findings: walk priority list, pick items that are missing/partial/invalid
  const findings: string[] = [];
  let topRecommendationKey: string | null = null;

  for (const key of EVIDENCE_PRIORITY) {
    if (findings.length >= 3) break;

    const item = evidenceMap.get(key);
    const descriptions = FINDING_DESCRIPTIONS[key];
    if (!descriptions) continue;

    if (!item || item.status === 'missing') {
      findings.push(descriptions.missing);
      if (!topRecommendationKey) topRecommendationKey = key;
    } else if (item.status === 'partial') {
      findings.push(descriptions.partial);
      if (!topRecommendationKey) topRecommendationKey = key;
    } else if (item.status === 'invalid') {
      findings.push(descriptions.invalid);
      if (!topRecommendationKey) topRecommendationKey = key;
    }
  }

  // Fallback if somehow everything is perfect
  if (findings.length === 0) {
    findings.push('Page structure meets baseline AI extraction requirements');
  }

  const recommendation = topRecommendationKey && RECOMMENDATION_MAP[topRecommendationKey]
    ? RECOMMENDATION_MAP[topRecommendationKey]
    : 'Strengthen structured page purpose and align visible claims with machine-readable signals';

  return {
    url,
    score: scoring.overall_score,
    status_line: getStatusLine(scoring.overall_score),
    findings,
    recommendation,
    hard_blockers: scoring.hard_blockers,
    scanned_at: new Date().toISOString(),
  };
}
