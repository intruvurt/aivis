/**
 * fixIntentMapper.ts - Maps SSFR audit rule results to typed FixIntents.
 *
 * Bridges the SSFR rule engine output (SSFRRuleResult[]) and the
 * deterministic patch builder. Each failed rule becomes a FixIntent
 * that describes: what to fix, where in the repo, and how urgently.
 *
 * Rules that have `auto_generatable = true` templates are marked
 * `canFixDeterministically = true` — they will be patched without LLM.
 * All others are left to the constrained LLM rewrite step.
 */

import type { SSFRRuleResult, SSFREvidenceItem, SSFRRuleSeverity } from '../../../shared/types.js';
import { getTemplateByRuleId } from './fixpackGenerator.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type FixIntentType =
    | 'schema_insert'   // Add JSON-LD <script> block to <head>
    | 'meta_update'     // Add or update meta tags in <head>
    | 'file_create'     // Create a new file (robots.txt, llms.txt, sitemap.xml)
    | 'file_update'     // Update an existing file (robots.txt unblocking)
    | 'content_rewrite' // LLM-assisted content rewrite for a body section
    | 'html_block'      // Insert an HTML content block in <body>
    | 'insight';        // Non-actionable insight — no patch generated

export interface FixIntent {
    id: string;                        // deterministic ID: rule_id + derived suffix
    ruleId: string;                    // SSFR rule_id e.g. 'source_org_schema'
    type: FixIntentType;
    severity: SSFRRuleSeverity;
    isHardBlocker: boolean;
    targetFile: string;                // repo-relative path e.g. 'index.html'
    domSelector?: string;              // cheerio selector for HTML injection
    evidenceKeys: string[];            // which evidence items feed this fix
    description: string;
    canFixDeterministically: boolean;  // true = no LLM needed
    expectedUpliftMin: number;         // score points — rough estimate
    expectedUpliftMax: number;
}

// ─── Rule → intent mapping table ──────────────────────────────────────────────

interface IntentDescriptor {
    type: FixIntentType;
    targetFile: string;
    domSelector?: string;
    upliftMin: number;
    upliftMax: number;
}

const RULE_INTENT_MAP: Record<string, IntentDescriptor> = {
    source_org_schema: { type: 'schema_insert', targetFile: 'index.html', domSelector: 'head', upliftMin: 8, upliftMax: 15 },
    source_same_as: { type: 'schema_insert', targetFile: 'index.html', domSelector: 'head', upliftMin: 4, upliftMax: 8 },
    source_author_entity: { type: 'schema_insert', targetFile: 'index.html', domSelector: 'head', upliftMin: 3, upliftMax: 7 },
    source_canonical: { type: 'meta_update', targetFile: 'index.html', domSelector: 'head', upliftMin: 2, upliftMax: 5 },
    source_robots_txt: { type: 'file_create', targetFile: 'public/robots.txt', upliftMin: 8, upliftMax: 14 },
    source_ai_crawler_access: { type: 'file_update', targetFile: 'public/robots.txt', upliftMin: 5, upliftMax: 12 },
    source_llms_txt: { type: 'file_create', targetFile: 'public/llms.txt', upliftMin: 3, upliftMax: 6 },
    signal_title_quality: { type: 'meta_update', targetFile: 'index.html', domSelector: 'title', upliftMin: 3, upliftMax: 7 },
    signal_meta_description: { type: 'meta_update', targetFile: 'index.html', domSelector: 'head', upliftMin: 3, upliftMax: 6 },
    signal_og_tags: { type: 'meta_update', targetFile: 'index.html', domSelector: 'head', upliftMin: 2, upliftMax: 5 },
    signal_json_ld: { type: 'schema_insert', targetFile: 'index.html', domSelector: 'head', upliftMin: 6, upliftMax: 12 },
    signal_h1_heading: { type: 'html_block', targetFile: 'index.html', domSelector: 'body', upliftMin: 2, upliftMax: 4 },
    signal_heading_hierarchy: { type: 'content_rewrite', targetFile: 'index.html', upliftMin: 1, upliftMax: 3 },
    signal_sitemap: { type: 'file_create', targetFile: 'public/sitemap.xml', upliftMin: 3, upliftMax: 7 },
    signal_lang: { type: 'meta_update', targetFile: 'index.html', domSelector: 'html', upliftMin: 1, upliftMax: 3 },
    fact_word_count: { type: 'content_rewrite', targetFile: 'index.html', upliftMin: 2, upliftMax: 5 },
    fact_question_headings: { type: 'content_rewrite', targetFile: 'index.html', upliftMin: 1, upliftMax: 4 },
    fact_tldr: { type: 'html_block', targetFile: 'index.html', domSelector: 'body', upliftMin: 2, upliftMax: 5 },
    fact_image_alt: { type: 'content_rewrite', targetFile: 'index.html', upliftMin: 1, upliftMax: 3 },
    fact_internal_links: { type: 'insight', targetFile: 'index.html', upliftMin: 1, upliftMax: 3 },
    fact_external_links: { type: 'insight', targetFile: 'index.html', upliftMin: 1, upliftMax: 2 },
    rel_schema_depth: { type: 'schema_insert', targetFile: 'index.html', domSelector: 'head', upliftMin: 3, upliftMax: 7 },
    rel_link_diversity: { type: 'insight', targetFile: 'index.html', upliftMin: 1, upliftMax: 2 },
    rel_performance: { type: 'insight', targetFile: 'index.html', upliftMin: 1, upliftMax: 4 },
    rel_contradiction_clean: { type: 'content_rewrite', targetFile: 'index.html', upliftMin: 2, upliftMax: 5 },
    rel_geo_source: { type: 'insight', targetFile: 'index.html', upliftMin: 1, upliftMax: 3 },
};

// ─── Evidence key extraction per rule ─────────────────────────────────────────

const RULE_EVIDENCE_KEYS: Record<string, string[]> = {
    source_org_schema: ['same_as_links', 'schema_depth'],
    source_same_as: ['same_as_links'],
    source_author_entity: ['author_entity'],
    source_canonical: ['canonical_url'],
    source_robots_txt: ['robots_txt_accessible'],
    source_ai_crawler_access: ['ai_crawler_access'],
    source_llms_txt: ['llms_txt'],
    signal_title_quality: ['title_tag'],
    signal_meta_description: ['meta_description'],
    signal_og_tags: ['og_tags'],
    signal_json_ld: ['schema_depth', 'same_as_links'],
    signal_h1_heading: ['h1_heading'],
    signal_heading_hierarchy: ['heading_hierarchy'],
    signal_sitemap: ['sitemap'],
    signal_lang: ['lang_attribute'],
    fact_word_count: ['word_count'],
    fact_question_headings: ['question_headings'],
    fact_tldr: [],
    fact_image_alt: ['image_alt_coverage'],
    fact_internal_links: ['internal_links'],
    fact_external_links: ['external_links'],
    rel_schema_depth: ['schema_depth'],
    rel_link_diversity: ['link_diversity'],
    rel_performance: ['performance'],
    rel_contradiction_clean: ['contradiction_status'],
    rel_geo_source: [],
};

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Convert SSFR rule results to FixIntents.
 *
 * Only failed rules with known intent mappings are included.
 * Results are sorted: hard blockers first, then by severity.
 */
export function mapRuleResultsToIntents(
    ruleResults: SSFRRuleResult[],
    _evidence: SSFREvidenceItem[],
    _targetUrl: string,
): FixIntent[] {
    const severityOrder: Record<SSFRRuleSeverity, number> = {
        critical: 0, high: 1, medium: 2, low: 3,
    };

    const failed = ruleResults
        .filter(r => !r.passed)
        .sort((a, b) => {
            if (a.is_hard_blocker !== b.is_hard_blocker) return a.is_hard_blocker ? -1 : 1;
            return severityOrder[a.severity] - severityOrder[b.severity];
        });

    const intents: FixIntent[] = [];

    for (const rule of failed) {
        const descriptor = RULE_INTENT_MAP[rule.rule_id];
        if (!descriptor) continue; // unknown rule - skip

        const template = getTemplateByRuleId(rule.rule_id);
        const canFixDeterministically = !!(
            template?.auto_generatable
            && descriptor.type !== 'content_rewrite'
            && descriptor.type !== 'insight'
        );

        intents.push({
            id: `intent_${rule.rule_id}`,
            ruleId: rule.rule_id,
            type: descriptor.type,
            severity: rule.severity,
            isHardBlocker: rule.is_hard_blocker,
            targetFile: descriptor.targetFile,
            domSelector: descriptor.domSelector,
            evidenceKeys: RULE_EVIDENCE_KEYS[rule.rule_id] ?? [],
            description: rule.title,
            canFixDeterministically,
            expectedUpliftMin: descriptor.upliftMin,
            expectedUpliftMax: descriptor.upliftMax,
        });
    }

    return intents;
}

/**
 * Filter intents to only those that can be auto-patched deterministically.
 * These are safe to include in a PR without LLM involvement.
 */
export function getDeterministicIntents(intents: FixIntent[]): FixIntent[] {
    return intents.filter(i => i.canFixDeterministically);
}

/**
 * Filter intents that need LLM assistance (content rewrites and complex blocks).
 */
export function getLlmIntents(intents: FixIntent[]): FixIntent[] {
    return intents.filter(
        i => !i.canFixDeterministically && i.type !== 'insight',
    );
}
