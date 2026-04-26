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
  CitationDivergenceSignal,
  AnswerPresenceResult,
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

// ─── Blocker deductions: soft penalties that reduce score without hard caps ──
//
// These replace the old hard-cap system that could destroy a score entirely.
// Each missing blocker deducts a fixed amount from the final score.
// Maximum total deduction: 64 pts. Score floored at 5 (never total zero).
//
// User principle: "conflicts reduce, not destroy."

const BLOCKER_DEDUCTIONS: Array<{ key: string; deduction: number; reason: string }> = [
  {
    key: 'robots_txt',
    deduction: 12,
    reason: 'Missing robots.txt — crawlers cannot verify access permissions',
  },
  {
    key: 'ai_crawler_access',
    deduction: 15,
    reason: 'AI crawlers are blocked — content is invisible to AI models',
  },
  {
    key: 'organization_schema',
    deduction: 12,
    reason: 'No Organization schema — entity identity unverifiable',
  },
  {
    key: 'title_tag',
    deduction: 10,
    reason: 'Missing or malformed title tag — AI cannot identify page topic',
  },
  {
    key: 'json_ld_schemas',
    deduction: 15,
    reason: 'No JSON-LD structured data — AI cannot extract entities',
  },
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

  // Apply soft blocker deductions — conflicts reduce, not destroy
  const hardBlockers: string[] = [];
  let totalDeduction = 0;

  for (const blocker of BLOCKER_DEDUCTIONS) {
    const item = evidenceMap.get(blocker.key);
    if (!item || item.status === 'missing' || item.status === 'invalid') {
      hardBlockers.push(blocker.reason);
      totalDeduction += blocker.deduction;
    }
  }

  if (totalDeduction > 0) {
    overallScore = Math.max(5, overallScore - totalDeduction);
  }

  return {
    overall_score: overallScore,
    categories,
    hard_blockers: hardBlockers,
    // score_cap repurposed: total deduction applied (null if none)
    score_cap: totalDeduction > 0 ? totalDeduction : null,
    score_cap_reason: hardBlockers.length > 0 ? `${hardBlockers.length} blocker${hardBlockers.length > 1 ? 's' : ''} detected` : null,
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

// ─── Citation Divergence ───────────────────────────────────────────────────
//
// Measures the gap between on-page technical extractability (schema, structure,
// meta tags) and actual off-page citation behaviour observed in AI systems.
//
// The "Peec.ai effect": a brand with near-zero on-page schema can still appear
// in top-10 AI answers because AI models synthesise brand identity from the
// aggregate external web footprint — G2, LinkedIn, press, community —
// not exclusively from the homepage itself.

const DIVERGENCE_THRESHOLD = 20; // pts — below this = "aligned"

/**
 * Compute a citation divergence signal from the on-page technical score
 * and the off-page answer presence evidence.
 *
 * Pure function — no side effects, no I/O.
 */
export function computeCitationDivergence(
  onPageScore: number,
  answerPresence: AnswerPresenceResult,
): CitationDivergenceSignal {
  // Off-page score: weighted composite from three answer_presence sub-scores.
  //   authority_alignment (0.40) — presence in authoritative, high-rank sources
  //   citation_coverage   (0.40) — fraction of queries where entity has a citation
  //   answer_presence     (0.20) — composite AI answer presence
  const offPageScore = Math.round(
    answerPresence.authority_alignment_score * 0.40 +
    answerPresence.citation_coverage_score * 0.40 +
    answerPresence.answer_presence_score * 0.20,
  );

  const delta = offPageScore - onPageScore;

  // Confidence: higher when more queries tested and mentions found.
  // Drops towards 0 if we have very few data points.
  const queriesTested = answerPresence.queries_tested ?? 0;
  const mentionsFraction = queriesTested > 0
    ? (answerPresence.mentions_found ?? 0) / queriesTested
    : 0;
  const confidence = Math.min(
    1,
    Math.max(0, (queriesTested / 10) * 0.6 + mentionsFraction * 0.4),
  );

  // Direction classification
  let direction: CitationDivergenceSignal['direction'];
  if (delta >= DIVERGENCE_THRESHOLD) {
    direction = 'off_page_dominant';
  } else if (delta <= -DIVERGENCE_THRESHOLD) {
    direction = 'on_page_dominant';
  } else {
    direction = 'aligned';
  }

  // Dominant signal
  let dominantSignal: CitationDivergenceSignal['dominant_signal'];
  if (direction === 'off_page_dominant') {
    dominantSignal = 'external_authority';
  } else if (onPageScore >= 60 && direction === 'on_page_dominant') {
    dominantSignal = 'structured_data';
  } else if (onPageScore >= 60) {
    dominantSignal = 'content_quality';
  } else {
    dominantSignal = 'mixed';
  }

  // Plain-language explanation
  let explanation: string;
  if (direction === 'off_page_dominant') {
    const absDelta = Math.abs(delta);
    if (absDelta >= 40) {
      explanation =
        `This site is being cited in AI answers despite weak on-page structure. ` +
        `Off-page authority (press coverage, review platforms, community mentions) is ` +
        `overriding the ${onPageScore}/100 technical score by a large margin. ` +
        `AI models are synthesising its identity from the external web footprint, not the homepage.`;
    } else {
      explanation =
        `Off-page signals are outperforming on-page structure by ${absDelta} points. ` +
        `The site has meaningful external visibility (reviews, mentions, press) that ` +
        `AI systems are picking up despite gaps in schema and structured data.`;
    }
  } else if (direction === 'on_page_dominant') {
    explanation =
      `On-page structure is strong but external citation signals are weak. ` +
      `The technical foundation is in place — focus now shifts to building the ` +
      `external footprint (reviews, press, community) that drives AI citation frequency.`;
  } else {
    explanation =
      `On-page and off-page signals are roughly aligned. ` +
      `Citation behaviour is consistent with what the technical score would predict.`;
  }

  // Scoring context note
  let scoringContext: string | undefined;
  if (direction === 'off_page_dominant') {
    scoringContext =
      `The technical score (${onPageScore}/100) accurately reflects on-page extractability ` +
      `but understates real-world AI citation frequency. A separate off-page confidence ` +
      `score (${offPageScore}/100) better reflects how often this brand appears in AI answers. ` +
      `Both scores are useful: on-page shows what to fix structurally; off-page shows ` +
      `the citation reality AI systems are operating with today.`;
  }

  return {
    on_page_score: onPageScore,
    off_page_score: offPageScore,
    divergence_delta: delta,
    direction,
    confidence: Math.round(confidence * 100) / 100,
    explanation,
    dominant_signal: dominantSignal,
    ...(scoringContext ? { scoring_context: scoringContext } : {}),
  };
}
