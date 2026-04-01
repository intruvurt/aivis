/**
 * ssfrRuleEngine.ts — Deterministic rule evaluation engine for
 * Source-Signal-Fact-Relationship audit dimensions.
 *
 * Rules are evaluated against extracted evidence items.
 * Failed rules with is_hard_blocker=true impose score caps.
 */

import type { SSFREvidenceItem, SSFRRuleResult, SSFRFamily, SSFRRuleSeverity } from '../../../shared/types.js';

// ─── Rule definition ────────────────────────────────────────────────────────

interface SSFRRule {
  id: string;
  family: SSFRFamily;
  title: string;
  severity: SSFRRuleSeverity;
  is_hard_blocker: boolean;
  score_cap?: number;
  /** Returns true if the rule PASSES (evidence is sufficient). */
  evaluate: (evidence: SSFREvidenceItem[]) => { passed: boolean; details?: Record<string, unknown>; evidence_ids: string[] };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function findEvidence(items: SSFREvidenceItem[], key: string): SSFREvidenceItem | undefined {
  return items.find(e => e.evidence_key === key);
}

function findEvidenceByFamily(items: SSFREvidenceItem[], family: SSFRFamily): SSFREvidenceItem[] {
  return items.filter(e => e.family === family);
}

function isPresent(item: SSFREvidenceItem | undefined): boolean {
  return item?.status === 'present';
}

function isNotMissing(item: SSFREvidenceItem | undefined): boolean {
  return !!item && item.status !== 'missing';
}

// ─── Rule definitions ───────────────────────────────────────────────────────

const RULES: SSFRRule[] = [
  // ════════ SOURCE rules ════════

  {
    id: 'source_org_schema',
    family: 'source',
    title: 'Organization or LocalBusiness schema present',
    severity: 'high',
    is_hard_blocker: true,
    score_cap: 75,
    evaluate(evidence) {
      const item = findEvidence(evidence, 'organization_schema');
      return { passed: isPresent(item), evidence_ids: ['organization_schema'] };
    },
  },

  {
    id: 'source_same_as',
    family: 'source',
    title: 'sameAs social verification links present',
    severity: 'medium',
    is_hard_blocker: false,
    evaluate(evidence) {
      const item = findEvidence(evidence, 'same_as_links');
      const links = Array.isArray(item?.value) ? item.value : [];
      return {
        passed: links.length >= 2,
        evidence_ids: ['same_as_links'],
        details: { count: links.length, minimum: 2 },
      };
    },
  },

  {
    id: 'source_author_entity',
    family: 'source',
    title: 'Author entity present in structured data',
    severity: 'medium',
    is_hard_blocker: false,
    evaluate(evidence) {
      const item = findEvidence(evidence, 'author_entity');
      return { passed: isPresent(item), evidence_ids: ['author_entity'] };
    },
  },

  {
    id: 'source_canonical',
    family: 'source',
    title: 'Canonical URL declared',
    severity: 'high',
    is_hard_blocker: false,
    evaluate(evidence) {
      const item = findEvidence(evidence, 'canonical_url');
      return { passed: isPresent(item), evidence_ids: ['canonical_url'] };
    },
  },

  {
    id: 'source_robots_txt',
    family: 'source',
    title: 'robots.txt accessible',
    severity: 'high',
    is_hard_blocker: true,
    score_cap: 80,
    evaluate(evidence) {
      const item = findEvidence(evidence, 'robots_txt');
      return { passed: isPresent(item), evidence_ids: ['robots_txt'] };
    },
  },

  {
    id: 'source_ai_crawler_access',
    family: 'source',
    title: 'AI crawlers not blocked',
    severity: 'critical',
    is_hard_blocker: true,
    score_cap: 60,
    evaluate(evidence) {
      const item = findEvidence(evidence, 'ai_crawler_access');
      if (!item) return { passed: false, evidence_ids: ['ai_crawler_access'] };
      const access = item.value as Record<string, boolean> | undefined;
      if (!access || Object.keys(access).length === 0) {
        return { passed: true, evidence_ids: ['ai_crawler_access'], details: { note: 'No AI crawler directives found (default allow)' } };
      }
      const blocked = Object.entries(access).filter(([, v]) => v === false).map(([k]) => k);
      return {
        passed: blocked.length === 0,
        evidence_ids: ['ai_crawler_access'],
        details: { blocked_crawlers: blocked },
      };
    },
  },

  {
    id: 'source_llms_txt',
    family: 'source',
    title: 'llms.txt file present',
    severity: 'low',
    is_hard_blocker: false,
    evaluate(evidence) {
      const item = findEvidence(evidence, 'llms_txt');
      return { passed: isPresent(item), evidence_ids: ['llms_txt'] };
    },
  },

  // ════════ SIGNAL rules ════════

  {
    id: 'signal_title_quality',
    family: 'signal',
    title: 'Title tag present and optimal length (20-70 chars)',
    severity: 'high',
    is_hard_blocker: true,
    score_cap: 70,
    evaluate(evidence) {
      const item = findEvidence(evidence, 'title_tag');
      return { passed: isPresent(item), evidence_ids: ['title_tag'] };
    },
  },

  {
    id: 'signal_meta_description',
    family: 'signal',
    title: 'Meta description present and optimal length',
    severity: 'high',
    is_hard_blocker: false,
    evaluate(evidence) {
      const item = findEvidence(evidence, 'meta_description');
      return { passed: isPresent(item), evidence_ids: ['meta_description'] };
    },
  },

  {
    id: 'signal_og_tags',
    family: 'signal',
    title: 'Open Graph tags complete (title, description, image)',
    severity: 'medium',
    is_hard_blocker: false,
    evaluate(evidence) {
      const item = findEvidence(evidence, 'og_tags');
      return { passed: isPresent(item), evidence_ids: ['og_tags'] };
    },
  },

  {
    id: 'signal_json_ld',
    family: 'signal',
    title: 'At least one JSON-LD schema block present',
    severity: 'high',
    is_hard_blocker: true,
    score_cap: 75,
    evaluate(evidence) {
      const item = findEvidence(evidence, 'json_ld_schemas');
      const types = Array.isArray(item?.value) ? item.value : [];
      return { passed: types.length > 0, evidence_ids: ['json_ld_schemas'], details: { count: types.length } };
    },
  },

  {
    id: 'signal_h1_heading',
    family: 'signal',
    title: 'Exactly one H1 heading present',
    severity: 'high',
    is_hard_blocker: false,
    evaluate(evidence) {
      const item = findEvidence(evidence, 'h1_heading');
      const h1s = Array.isArray(item?.value) ? item.value : [];
      return {
        passed: h1s.length === 1,
        evidence_ids: ['h1_heading'],
        details: { count: h1s.length, ideal: 1 },
      };
    },
  },

  {
    id: 'signal_heading_hierarchy',
    family: 'signal',
    title: 'Proper heading hierarchy (H1 > H2 > H3)',
    severity: 'medium',
    is_hard_blocker: false,
    evaluate(evidence) {
      const item = findEvidence(evidence, 'heading_hierarchy');
      if (!item || typeof item.value !== 'object') return { passed: false, evidence_ids: ['heading_hierarchy'] };
      const v = item.value as Record<string, number>;
      return {
        passed: (v.h1 ?? 0) >= 1 && (v.h2 ?? 0) >= 2,
        evidence_ids: ['heading_hierarchy'],
        details: v,
      };
    },
  },

  {
    id: 'signal_sitemap',
    family: 'signal',
    title: 'Sitemap.xml present and accessible',
    severity: 'medium',
    is_hard_blocker: false,
    evaluate(evidence) {
      const item = findEvidence(evidence, 'sitemap');
      return { passed: isPresent(item), evidence_ids: ['sitemap'] };
    },
  },

  {
    id: 'signal_lang',
    family: 'signal',
    title: 'Language attribute declared in HTML',
    severity: 'low',
    is_hard_blocker: false,
    evaluate(evidence) {
      const item = findEvidence(evidence, 'lang_attribute');
      return { passed: isPresent(item), evidence_ids: ['lang_attribute'] };
    },
  },

  // ════════ FACT rules ════════

  {
    id: 'fact_word_count',
    family: 'fact',
    title: 'Content depth: minimum 800 words',
    severity: 'high',
    is_hard_blocker: true,
    score_cap: 65,
    evaluate(evidence) {
      const item = findEvidence(evidence, 'word_count');
      const wc = typeof item?.value === 'number' ? item.value : 0;
      return { passed: wc >= 800, evidence_ids: ['word_count'], details: { word_count: wc, minimum: 800 } };
    },
  },

  {
    id: 'fact_question_headings',
    family: 'fact',
    title: 'At least 3 question-format headings',
    severity: 'medium',
    is_hard_blocker: false,
    evaluate(evidence) {
      const item = findEvidence(evidence, 'question_headings');
      const count = (item?.value as Record<string, unknown>)?.count;
      const n = typeof count === 'number' ? count : 0;
      return { passed: n >= 3, evidence_ids: ['question_headings'], details: { count: n, minimum: 3 } };
    },
  },

  {
    id: 'fact_tldr',
    family: 'fact',
    title: 'TL;DR or summary block present',
    severity: 'low',
    is_hard_blocker: false,
    evaluate(evidence) {
      const item = findEvidence(evidence, 'tldr_block');
      const val = item?.value as Record<string, unknown> | undefined;
      return { passed: val?.present === true, evidence_ids: ['tldr_block'] };
    },
  },

  {
    id: 'fact_image_alt',
    family: 'fact',
    title: 'Image alt text coverage >= 90%',
    severity: 'medium',
    is_hard_blocker: false,
    evaluate(evidence) {
      const item = findEvidence(evidence, 'image_alt_coverage');
      const val = item?.value as Record<string, number> | undefined;
      const coverage = val?.coverage ?? 0;
      return { passed: coverage >= 0.9, evidence_ids: ['image_alt_coverage'], details: { coverage_pct: Math.round(coverage * 100) } };
    },
  },

  {
    id: 'fact_internal_links',
    family: 'fact',
    title: 'At least 3 internal links',
    severity: 'medium',
    is_hard_blocker: false,
    evaluate(evidence) {
      const item = findEvidence(evidence, 'internal_links');
      const n = typeof item?.value === 'number' ? item.value : 0;
      return { passed: n >= 3, evidence_ids: ['internal_links'], details: { count: n, minimum: 3 } };
    },
  },

  {
    id: 'fact_external_links',
    family: 'fact',
    title: 'At least 2 external reference links',
    severity: 'low',
    is_hard_blocker: false,
    evaluate(evidence) {
      const item = findEvidence(evidence, 'external_links');
      const n = typeof item?.value === 'number' ? item.value : 0;
      return { passed: n >= 2, evidence_ids: ['external_links'], details: { count: n, minimum: 2 } };
    },
  },

  // ════════ RELATIONSHIP rules ════════

  {
    id: 'rel_schema_depth',
    family: 'relationship',
    title: 'Multiple schema types (>= 3) for rich entity connections',
    severity: 'medium',
    is_hard_blocker: false,
    evaluate(evidence) {
      const item = findEvidence(evidence, 'schema_depth');
      const types = Array.isArray(item?.value) ? item.value : [];
      return { passed: types.length >= 3, evidence_ids: ['schema_depth'], details: { count: types.length, minimum: 3 } };
    },
  },

  {
    id: 'rel_link_diversity',
    family: 'relationship',
    title: 'Balanced internal/external link mix',
    severity: 'low',
    is_hard_blocker: false,
    evaluate(evidence) {
      const item = findEvidence(evidence, 'link_diversity');
      const val = item?.value as Record<string, number> | undefined;
      return { passed: (val?.ratio ?? 0) >= 0.15, evidence_ids: ['link_diversity'], details: val || {} };
    },
  },

  {
    id: 'rel_performance',
    family: 'relationship',
    title: 'Page LCP under 2500ms (good Core Web Vital)',
    severity: 'high',
    is_hard_blocker: false,
    evaluate(evidence) {
      const item = findEvidence(evidence, 'performance');
      const val = item?.value as Record<string, number> | undefined;
      const lcp = val?.lcp_ms ?? 0;
      return {
        passed: lcp > 0 && lcp < 2500,
        evidence_ids: ['performance'],
        details: { lcp_ms: lcp, threshold: 2500 },
      };
    },
  },

  {
    id: 'rel_contradiction_clean',
    family: 'relationship',
    title: 'No critical contradictions in content',
    severity: 'critical',
    is_hard_blocker: true,
    score_cap: 55,
    evaluate(evidence) {
      const item = findEvidence(evidence, 'contradiction_status');
      if (!item) return { passed: true, evidence_ids: ['contradiction_status'], details: { note: 'No contradiction data available' } };
      return {
        passed: item.value !== 'critical',
        evidence_ids: ['contradiction_status'],
        details: { status: item.value },
      };
    },
  },

  {
    id: 'rel_geo_source',
    family: 'relationship',
    title: 'GEO source verification passed',
    severity: 'medium',
    is_hard_blocker: false,
    evaluate(evidence) {
      const item = findEvidence(evidence, 'geo_source_verified');
      if (!item) return { passed: true, evidence_ids: ['geo_source_verified'], details: { note: 'GEO data not available' } };
      return { passed: item.value === true, evidence_ids: ['geo_source_verified'] };
    },
  },
];

// ─── Main evaluation function ───────────────────────────────────────────────

export function evaluateSSFRRules(evidence: SSFREvidenceItem[]): SSFRRuleResult[] {
  return RULES.map(rule => {
    const result = rule.evaluate(evidence);
    return {
      family: rule.family,
      rule_id: rule.id,
      title: rule.title,
      passed: result.passed,
      severity: rule.severity,
      is_hard_blocker: rule.is_hard_blocker,
      score_cap: rule.is_hard_blocker && !result.passed ? rule.score_cap : undefined,
      evidence_ids: result.evidence_ids,
      details: result.details,
    };
  });
}

/**
 * Compute the effective score cap from rule results.
 * Returns null if no hard blockers are triggered (no cap applies).
 */
export function computeEffectiveScoreCap(ruleResults: SSFRRuleResult[]): number | null {
  const failedBlockers = ruleResults.filter(r => r.is_hard_blocker && !r.passed && r.score_cap != null);
  if (failedBlockers.length === 0) return null;
  return Math.min(...failedBlockers.map(r => r.score_cap!));
}

/**
 * Build the summary stats from rule results.
 */
export function buildSSFRSummary(ruleResults: SSFRRuleResult[]): {
  total_rules: number;
  passed_rules: number;
  failed_rules: number;
  hard_blockers: number;
  effective_score_cap: number | null;
  families: Record<string, { passed: number; failed: number; blockers: number }>;
} {
  const families: Record<string, { passed: number; failed: number; blockers: number }> = {
    source: { passed: 0, failed: 0, blockers: 0 },
    signal: { passed: 0, failed: 0, blockers: 0 },
    fact: { passed: 0, failed: 0, blockers: 0 },
    relationship: { passed: 0, failed: 0, blockers: 0 },
  };

  let passedRules = 0;
  let failedRules = 0;
  let hardBlockers = 0;

  for (const r of ruleResults) {
    const fam = families[r.family];
    if (!fam) continue;
    if (r.passed) {
      passedRules++;
      fam.passed++;
    } else {
      failedRules++;
      fam.failed++;
      if (r.is_hard_blocker) {
        hardBlockers++;
        fam.blockers++;
      }
    }
  }

  return {
    total_rules: ruleResults.length,
    passed_rules: passedRules,
    failed_rules: failedRules,
    hard_blockers: hardBlockers,
    effective_score_cap: computeEffectiveScoreCap(ruleResults),
    families,
  };
}
