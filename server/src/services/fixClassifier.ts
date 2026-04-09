/**
 * Fix Classifier - Maps failed SSFR rule results to canonical fix classes.
 *
 * Standardises every audit finding into one of 11 fix classes with
 * severity, auto-fixability, expected uplift, and affected file hints.
 */

import type {
  SSFRRuleResult,
  SSFREvidenceItem,
  FixClass,
  ClassifiedFinding,
  ClassificationResult,
} from '../../../shared/types.js';

// ─── Rule → Fix Class mapping ───────────────────────────────────────────────

interface ClassificationRule {
  fix_class: FixClass;
  auto_fixable: boolean;
  /** Expected uplift range per instance (points out of 100) */
  uplift_min: number;
  uplift_max: number;
  /** Hint at which files are typically affected */
  affected_files_hint: string[];
}

const RULE_CLASSIFICATION: Record<string, ClassificationRule> = {
  // SOURCE fixes
  source_org_schema: {
    fix_class: 'SCHEMA_INSERT',
    auto_fixable: true,
    uplift_min: 3,
    uplift_max: 8,
    affected_files_hint: ['index.html', 'layout.tsx', '_document.tsx'],
  },
  source_same_as: {
    fix_class: 'SCHEMA_REPAIR',
    auto_fixable: false,
    uplift_min: 1,
    uplift_max: 4,
    affected_files_hint: ['schema.json', 'index.html'],
  },
  source_author_entity: {
    fix_class: 'SCHEMA_REPAIR',
    auto_fixable: true,
    uplift_min: 1,
    uplift_max: 3,
    affected_files_hint: ['index.html', 'article.tsx'],
  },
  source_canonical: {
    fix_class: 'TECHNICAL_CONFIG_PATCH',
    auto_fixable: true,
    uplift_min: 2,
    uplift_max: 5,
    affected_files_hint: ['index.html', 'head.tsx', '_document.tsx'],
  },
  source_robots_txt: {
    fix_class: 'CRAWLABILITY_REPAIR',
    auto_fixable: true,
    uplift_min: 5,
    uplift_max: 15,
    affected_files_hint: ['public/robots.txt'],
  },
  source_ai_crawler_access: {
    fix_class: 'CRAWLABILITY_REPAIR',
    auto_fixable: true,
    uplift_min: 5,
    uplift_max: 12,
    affected_files_hint: ['public/robots.txt'],
  },
  source_llms_txt: {
    fix_class: 'LLMS_TXT_CREATE',
    auto_fixable: true,
    uplift_min: 2,
    uplift_max: 6,
    affected_files_hint: ['public/llms.txt'],
  },

  // SIGNAL fixes
  signal_title_quality: {
    fix_class: 'META_REWRITE',
    auto_fixable: false,
    uplift_min: 3,
    uplift_max: 8,
    affected_files_hint: ['index.html', 'head.tsx'],
  },
  signal_meta_description: {
    fix_class: 'META_REWRITE',
    auto_fixable: false,
    uplift_min: 2,
    uplift_max: 5,
    affected_files_hint: ['index.html', 'head.tsx'],
  },
  signal_og_tags: {
    fix_class: 'META_REWRITE',
    auto_fixable: true,
    uplift_min: 1,
    uplift_max: 4,
    affected_files_hint: ['index.html', 'head.tsx'],
  },
  signal_json_ld: {
    fix_class: 'SCHEMA_INSERT',
    auto_fixable: true,
    uplift_min: 4,
    uplift_max: 10,
    affected_files_hint: ['index.html', 'layout.tsx'],
  },
  signal_h1_heading: {
    fix_class: 'HEADING_RESTRUCTURE',
    auto_fixable: false,
    uplift_min: 2,
    uplift_max: 5,
    affected_files_hint: ['index.html', 'page.tsx'],
  },
  signal_heading_hierarchy: {
    fix_class: 'HEADING_RESTRUCTURE',
    auto_fixable: false,
    uplift_min: 2,
    uplift_max: 5,
    affected_files_hint: ['index.html', 'page.tsx'],
  },
  signal_sitemap: {
    fix_class: 'TECHNICAL_CONFIG_PATCH',
    auto_fixable: true,
    uplift_min: 1,
    uplift_max: 4,
    affected_files_hint: ['public/sitemap.xml'],
  },
  signal_lang: {
    fix_class: 'META_REWRITE',
    auto_fixable: true,
    uplift_min: 1,
    uplift_max: 2,
    affected_files_hint: ['index.html'],
  },

  // FACT fixes
  fact_word_count: {
    fix_class: 'CONTENT_REWRITE',
    auto_fixable: false,
    uplift_min: 3,
    uplift_max: 10,
    affected_files_hint: ['content pages'],
  },
  fact_question_headings: {
    fix_class: 'CONTENT_REWRITE',
    auto_fixable: false,
    uplift_min: 2,
    uplift_max: 5,
    affected_files_hint: ['content pages'],
  },
  fact_tldr: {
    fix_class: 'CONTENT_REWRITE',
    auto_fixable: false,
    uplift_min: 1,
    uplift_max: 3,
    affected_files_hint: ['content pages'],
  },
  fact_image_alt: {
    fix_class: 'CONTENT_REWRITE',
    auto_fixable: false,
    uplift_min: 1,
    uplift_max: 3,
    affected_files_hint: ['image elements'],
  },
  fact_internal_links: {
    fix_class: 'INTERNAL_LINK_PATCH',
    auto_fixable: false,
    uplift_min: 1,
    uplift_max: 4,
    affected_files_hint: ['content pages', 'navigation'],
  },
  fact_external_links: {
    fix_class: 'INTERNAL_LINK_PATCH',
    auto_fixable: false,
    uplift_min: 1,
    uplift_max: 3,
    affected_files_hint: ['content pages'],
  },

  // RELATIONSHIP fixes
  rel_schema_depth: {
    fix_class: 'SCHEMA_INSERT',
    auto_fixable: true,
    uplift_min: 2,
    uplift_max: 5,
    affected_files_hint: ['index.html', 'layout.tsx'],
  },
  rel_link_diversity: {
    fix_class: 'INTERNAL_LINK_PATCH',
    auto_fixable: false,
    uplift_min: 1,
    uplift_max: 3,
    affected_files_hint: ['content pages'],
  },
  rel_performance: {
    fix_class: 'TECHNICAL_CONFIG_PATCH',
    auto_fixable: false,
    uplift_min: 1,
    uplift_max: 4,
    affected_files_hint: ['build config', 'assets'],
  },
  rel_contradiction_clean: {
    fix_class: 'CONTENT_REWRITE',
    auto_fixable: false,
    uplift_min: 2,
    uplift_max: 6,
    affected_files_hint: ['content pages'],
  },
  rel_geo_source: {
    fix_class: 'TRUST_BLOCK_ADD',
    auto_fixable: false,
    uplift_min: 1,
    uplift_max: 4,
    affected_files_hint: ['content pages'],
  },
};

// ─── Main classifier ────────────────────────────────────────────────────────

/**
 * Classify failed rule results into canonical fix classes with
 * severity, auto-fix eligibility, and expected uplift.
 */
export function classifyFindings(
  ruleResults: SSFRRuleResult[],
  _evidence: SSFREvidenceItem[],
): ClassificationResult {
  const failed = ruleResults.filter(r => !r.passed);
  const findings: ClassifiedFinding[] = [];

  for (const rule of failed) {
    const classification = RULE_CLASSIFICATION[rule.rule_id];
    if (!classification) {
      // Unknown rule - classify as generic content fix
      findings.push({
        id: rule.rule_id,
        rule_id: rule.rule_id,
        fix_class: 'CONTENT_REWRITE',
        title: rule.title,
        severity: rule.severity,
        auto_fixable: false,
        expected_uplift_min: 1,
        expected_uplift_max: 3,
        affected_files: ['unknown'],
        evidence_ids: rule.evidence_ids,
        reasoning: `Unclassified rule "${rule.rule_id}" - defaulting to content rewrite.`,
      });
      continue;
    }

    findings.push({
      id: rule.rule_id,
      rule_id: rule.rule_id,
      fix_class: classification.fix_class,
      title: rule.title,
      severity: rule.severity,
      auto_fixable: classification.auto_fixable,
      expected_uplift_min: classification.uplift_min,
      expected_uplift_max: classification.uplift_max,
      affected_files: classification.affected_files_hint,
      evidence_ids: rule.evidence_ids,
      reasoning: `Classified as ${classification.fix_class} (auto: ${classification.auto_fixable}).`,
    });
  }

  // Sort: critical first, then by expected uplift descending
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  findings.sort((a, b) => {
    const sevDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (sevDiff !== 0) return sevDiff;
    return b.expected_uplift_max - a.expected_uplift_max;
  });

  const autoFixable = findings.filter(f => f.auto_fixable);
  const manualOnly = findings.filter(f => !f.auto_fixable);

  return {
    findings,
    auto_fixable_count: autoFixable.length,
    manual_only_count: manualOnly.length,
    total_expected_uplift_min: findings.reduce((s, f) => s + f.expected_uplift_min, 0),
    total_expected_uplift_max: findings.reduce((s, f) => s + f.expected_uplift_max, 0),
  };
}

/**
 * Given a rule_id, return its fix class (or null if unknown).
 */
export function getFixClassForRule(ruleId: string): FixClass | null {
  return RULE_CLASSIFICATION[ruleId]?.fix_class ?? null;
}

/**
 * Return all known rule IDs and their classification metadata.
 */
export function getAllClassifications(): Record<string, ClassificationRule> {
  return { ...RULE_CLASSIFICATION };
}
