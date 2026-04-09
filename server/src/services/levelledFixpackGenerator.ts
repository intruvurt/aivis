/**
 * Levelled Fixpack Generator - Produces L1/L2/L3 fixpacks from classified findings.
 *
 * Level 1 (Instant): meta, canonical, headings, schema, OG, trust signals.
 *   Auto-applicable, safe to merge without code review.
 *
 * Level 2 (Structural): content blocks, internal links, summaries.
 *   Requires human review, generates concrete patch suggestions.
 *
 * Level 3 (Codebase): schema utils, route metadata, crawlability config.
 *   Requires developer involvement, produces implementation guides.
 *
 * Delegates to the existing fixpackGenerator for asset generation.
 */

import type {
  SSFREvidenceItem,
  SSFRRuleResult,
  FixClass,
  ClassifiedFinding,
  LevelledFixpack,
  FixpackLevel,
  PipelinePatch,
} from '../../../shared/types.js';
import { generateFixpacks } from './fixpackGenerator.js';

// ─── Fix class → level mapping ──────────────────────────────────────────────

const FIX_CLASS_LEVEL: Record<FixClass, FixpackLevel> = {
  META_REWRITE: 1,
  SCHEMA_INSERT: 1,
  SCHEMA_REPAIR: 1,
  CRAWLABILITY_REPAIR: 1,
  LLMS_TXT_CREATE: 1,
  HEADING_RESTRUCTURE: 2,
  TRUST_BLOCK_ADD: 2,
  INTERNAL_LINK_PATCH: 2,
  CONTENT_REWRITE: 2,
  TECHNICAL_CONFIG_PATCH: 3,
  SECURITY_HARDENING: 3,
};

// ─── Fix class → auto-applicable ────────────────────────────────────────────

const AUTO_APPLICABLE: ReadonlySet<FixClass> = new Set<FixClass>([
  'META_REWRITE',
  'SCHEMA_INSERT',
  'SCHEMA_REPAIR',
  'CRAWLABILITY_REPAIR',
  'LLMS_TXT_CREATE',
]);

// ─── Fix class → target file paths ─────────────────────────────────────────

function inferFilePath(fixClass: FixClass, targetUrl?: string): string {
  const domain = (() => {
    if (!targetUrl) return 'site';
    try { return new URL(targetUrl).hostname.replace(/^www\./, ''); } catch { return 'site'; }
  })();

  switch (fixClass) {
    case 'META_REWRITE': return 'index.html';
    case 'SCHEMA_INSERT': return 'index.html';
    case 'SCHEMA_REPAIR': return 'index.html';
    case 'CRAWLABILITY_REPAIR': return 'public/robots.txt';
    case 'LLMS_TXT_CREATE': return 'public/llms.txt';
    case 'HEADING_RESTRUCTURE': return 'index.html';
    case 'TRUST_BLOCK_ADD': return 'index.html';
    case 'INTERNAL_LINK_PATCH': return 'index.html';
    case 'CONTENT_REWRITE': return 'content.md';
    case 'TECHNICAL_CONFIG_PATCH': return `public/sitemap.xml`;
    case 'SECURITY_HARDENING': return 'server/config.ts';
  }
}

// ─── Main function ──────────────────────────────────────────────────────────

/**
 * Generate levelled fixpacks from classified findings.
 * Uses the existing fixpackGenerator for asset generation,
 * then wraps results with level metadata and patch info.
 */
export function generateLevelledFixpacks(
  findings: ClassifiedFinding[],
  ruleResults: SSFRRuleResult[],
  evidence: SSFREvidenceItem[],
  targetUrl?: string,
): LevelledFixpack[] {
  // Generate base fixpacks from the existing template system
  const baseFixpacks = generateFixpacks(ruleResults, evidence, targetUrl);

  // Build a lookup: rule_id → base fixpack
  const fixpackByRule = new Map<string, typeof baseFixpacks[number]>();
  for (const fp of baseFixpacks) {
    for (const ruleId of fp.based_on_rule_ids) {
      fixpackByRule.set(ruleId, fp);
    }
  }

  const levelled: LevelledFixpack[] = [];

  for (const finding of findings) {
    const baseFp = fixpackByRule.get(finding.rule_id);
    const level = FIX_CLASS_LEVEL[finding.fix_class];
    const autoApplicable = AUTO_APPLICABLE.has(finding.fix_class) && finding.auto_fixable;

    // Convert base fixpack assets to patches
    const patches: PipelinePatch[] = [];
    if (baseFp) {
      for (const asset of baseFp.assets) {
        patches.push({
          file_path: inferFilePath(finding.fix_class, targetUrl),
          operation: finding.fix_class === 'LLMS_TXT_CREATE' ? 'create' : 'update',
          content: asset.content,
          fix_class: finding.fix_class,
          justification: `${asset.label}: ${baseFp.summary}`,
        });
      }
    } else {
      // No template match - generate a guidance patch
      patches.push({
        file_path: inferFilePath(finding.fix_class, targetUrl),
        operation: 'update',
        content: `<!-- ${finding.fix_class}: ${finding.title} -->\n<!-- ${finding.reasoning} -->`,
        fix_class: finding.fix_class,
        justification: finding.reasoning,
      });
    }

    levelled.push({
      level,
      fix_class: finding.fix_class,
      title: baseFp?.title ?? finding.title,
      summary: baseFp?.summary ?? finding.reasoning,
      patches,
      auto_applicable: autoApplicable,
      expected_uplift_min: finding.expected_uplift_min,
      expected_uplift_max: finding.expected_uplift_max,
      based_on_finding_ids: [finding.id],
    });
  }

  // Sort: L1 first, then L2, then L3; within level sort by uplift desc
  levelled.sort((a, b) => {
    if (a.level !== b.level) return a.level - b.level;
    return b.expected_uplift_max - a.expected_uplift_max;
  });

  return levelled;
}

/**
 * Filter fixpacks to only auto-applicable L1 items.
 * These are safe to apply without human review.
 */
export function getAutoApplicableFixpacks(fixpacks: LevelledFixpack[]): LevelledFixpack[] {
  return fixpacks.filter(fp => fp.level === 1 && fp.auto_applicable);
}

/**
 * Get fixpacks grouped by level.
 */
export function groupByLevel(fixpacks: LevelledFixpack[]): Record<FixpackLevel, LevelledFixpack[]> {
  return {
    1: fixpacks.filter(fp => fp.level === 1),
    2: fixpacks.filter(fp => fp.level === 2),
    3: fixpacks.filter(fp => fp.level === 3),
  };
}
