/**
 * Scoring Engine - Deterministic evidence-based scoring.
 *
 * Maps SSFR evidence items to 7 scoring categories with weights,
 * producing a reproducible overall score, per-category breakdown,
 * hard-blocker detection, and score caps.
 *
 * No AI calls - purely deterministic based on evidence status.
 */

import type {
  SSFREvidenceItem,
  SSFREvidenceStatus,
  ScoringCategory,
  ScoringResult,
  CategoryScore,
  FixClass,
} from '../../../shared/types.js';

// ─── Category weights (sum = 1.0) ──────────────────────────────────────────

const CATEGORY_WEIGHTS: Record<ScoringCategory, number> = {
  content_depth: 0.18,
  heading_structure: 0.10,
  schema_structured_data: 0.20,
  meta_tags_og: 0.15,
  technical_seo: 0.15,
  ai_readability: 0.12,
  security_trust: 0.10,
};

// ─── Evidence key → category mapping ────────────────────────────────────────

const CATEGORY_EVIDENCE_KEYS: Record<ScoringCategory, string[]> = {
  content_depth: [
    'word_count', 'question_headings', 'tldr_block',
    'external_links', 'image_alt_coverage',
  ],
  heading_structure: [
    'h1_heading', 'heading_hierarchy',
  ],
  schema_structured_data: [
    'organization_schema', 'json_ld_schemas', 'faq_schema',
    'author_entity', 'same_as_links', 'schema_depth',
  ],
  meta_tags_og: [
    'title_tag', 'meta_description', 'og_tags',
    'twitter_card', 'lang_attribute', 'canonical_url',
  ],
  technical_seo: [
    'robots_txt', 'sitemap', 'canonical_url', 'performance', 'hreflang',
  ],
  ai_readability: [
    'llms_txt', 'ai_crawler_access', 'question_headings',
    'tldr_block', 'heading_hierarchy',
  ],
  security_trust: [
    'robots_txt', 'ai_crawler_access', 'same_as_links',
    'author_entity', 'link_diversity',
  ],
};

// ─── Evidence key → fix class mapping ───────────────────────────────────────

const EVIDENCE_FIX_CLASS: Record<string, FixClass> = {
  word_count: 'CONTENT_REWRITE',
  question_headings: 'CONTENT_REWRITE',
  tldr_block: 'CONTENT_REWRITE',
  external_links: 'INTERNAL_LINK_PATCH',
  image_alt_coverage: 'CONTENT_REWRITE',
  h1_heading: 'HEADING_RESTRUCTURE',
  heading_hierarchy: 'HEADING_RESTRUCTURE',
  organization_schema: 'SCHEMA_INSERT',
  json_ld_schemas: 'SCHEMA_INSERT',
  faq_schema: 'SCHEMA_INSERT',
  author_entity: 'SCHEMA_REPAIR',
  same_as_links: 'SCHEMA_REPAIR',
  schema_depth: 'SCHEMA_INSERT',
  title_tag: 'META_REWRITE',
  meta_description: 'META_REWRITE',
  og_tags: 'META_REWRITE',
  twitter_card: 'META_REWRITE',
  lang_attribute: 'META_REWRITE',
  canonical_url: 'TECHNICAL_CONFIG_PATCH',
  robots_txt: 'CRAWLABILITY_REPAIR',
  sitemap: 'TECHNICAL_CONFIG_PATCH',
  performance: 'TECHNICAL_CONFIG_PATCH',
  hreflang: 'TECHNICAL_CONFIG_PATCH',
  llms_txt: 'LLMS_TXT_CREATE',
  ai_crawler_access: 'CRAWLABILITY_REPAIR',
  internal_links: 'INTERNAL_LINK_PATCH',
  link_diversity: 'INTERNAL_LINK_PATCH',
};

// ─── Hard blockers: evidence keys whose absence caps overall score ──────────

const HARD_BLOCKERS: Array<{ key: string; cap: number; reason: string }> = [
  { key: 'robots_txt', cap: 30, reason: 'Missing robots.txt - crawlers cannot verify access permissions' },
  { key: 'ai_crawler_access', cap: 35, reason: 'AI crawlers are blocked - content is invisible to AI models' },
  { key: 'organization_schema', cap: 50, reason: 'No Organization schema - entity identity unverifiable' },
  { key: 'title_tag', cap: 40, reason: 'Missing or malformed title tag - AI cannot identify page topic' },
  { key: 'json_ld_schemas', cap: 50, reason: 'No JSON-LD structured data - AI cannot extract entities' },
];

// ─── Score helpers ──────────────────────────────────────────────────────────

function statusScore(status: SSFREvidenceStatus): number {
  switch (status) {
    case 'present': return 100;
    case 'partial': return 50;
    case 'missing': return 0;
    case 'invalid': return 10;
  }
}

function buildEvidenceMap(evidence: SSFREvidenceItem[]): Map<string, SSFREvidenceItem> {
  const map = new Map<string, SSFREvidenceItem>();
  for (const item of evidence) {
    // Keep the first item per key (typically the most reliable source)
    if (!map.has(item.evidence_key)) {
      map.set(item.evidence_key, item);
    }
  }
  return map;
}

// ─── Main scoring function ──────────────────────────────────────────────────

export function scoreEvidence(evidence: SSFREvidenceItem[]): ScoringResult {
  const evidenceMap = buildEvidenceMap(evidence);
  const categories: CategoryScore[] = [];

  for (const [category, weight] of Object.entries(CATEGORY_WEIGHTS) as Array<[ScoringCategory, number]>) {
    const keys = CATEGORY_EVIDENCE_KEYS[category];
    let totalScore = 0;
    let itemCount = 0;
    const evidenceKeys: string[] = [];
    const fixClasses = new Set<FixClass>();

    for (const key of keys) {
      const item = evidenceMap.get(key);
      if (item) {
        // Weight by confidence
        totalScore += statusScore(item.status) * item.confidence;
        evidenceKeys.push(key);
      } else {
        // Missing evidence = 0 score
        totalScore += 0;
        evidenceKeys.push(key);
      }
      itemCount++;

      // Map to fix class if not present/not full score
      const fixClass = EVIDENCE_FIX_CLASS[key];
      if (fixClass && (!item || item.status !== 'present')) {
        fixClasses.add(fixClass);
      }
    }

    const rawScore = itemCount > 0 ? Math.round(totalScore / itemCount) : 0;

    categories.push({
      category,
      score_0_100: rawScore,
      weight,
      weighted_contribution: Math.round(rawScore * weight * 100) / 100,
      evidence_keys: evidenceKeys,
      fix_classes: Array.from(fixClasses),
      reasoning: buildReasoning(category, rawScore, evidenceKeys, evidenceMap),
    });
  }

  // Calculate overall score
  let overallScore = Math.round(
    categories.reduce((sum, c) => sum + c.weighted_contribution, 0),
  );

  // Apply hard-blocker caps
  const hardBlockers: string[] = [];
  let scoreCap: number | null = null;
  let scoreCapReason: string | null = null;

  for (const blocker of HARD_BLOCKERS) {
    const item = evidenceMap.get(blocker.key);
    if (!item || item.status === 'missing' || item.status === 'invalid') {
      hardBlockers.push(blocker.reason);
      if (scoreCap === null || blocker.cap < scoreCap) {
        scoreCap = blocker.cap;
        scoreCapReason = blocker.reason;
      }
    }
  }

  if (scoreCap !== null && overallScore > scoreCap) {
    overallScore = scoreCap;
  }

  return {
    overall_score: overallScore,
    categories,
    hard_blockers: hardBlockers,
    score_cap: scoreCap,
    score_cap_reason: scoreCapReason,
  };
}

function buildReasoning(
  category: ScoringCategory,
  score: number,
  keys: string[],
  evidenceMap: Map<string, SSFREvidenceItem>,
): string {
  const present = keys.filter(k => evidenceMap.get(k)?.status === 'present').length;
  const total = keys.length;
  const missing = keys.filter(k => !evidenceMap.has(k) || evidenceMap.get(k)?.status === 'missing');

  if (score >= 90) return `Strong ${category.replace(/_/g, ' ')} - ${present}/${total} evidence items verified.`;
  if (score >= 60) return `Acceptable ${category.replace(/_/g, ' ')} - ${present}/${total} items present. Missing: ${missing.join(', ')}.`;
  return `Weak ${category.replace(/_/g, ' ')} - only ${present}/${total} items present. Critical gaps: ${missing.join(', ')}.`;
}
