/**
 * deterministicPatchBuilder.ts - Builds complete file patches without LLM.
 *
 * For every FixIntent with `canFixDeterministically = true`:
 *   1. Generates exact patch content via the rule template registry
 *   2. Uses cheerio to do DOM-aware injection into HTML files
 *   3. Validates the generated content before returning
 *   4. Produces a before/after line diff for preview
 *
 * If existingContent is provided for an HTML file, cheerio injects into
 * the real DOM. If not, the patch is returned as a standalone snippet
 * (suitable for appending to <head> / inserting before </head>).
 *
 * "Deterministic first, AI second." — no LLM is ever called from this file.
 */

import * as cheerio from 'cheerio';

import type { SSFREvidenceItem } from '../../../shared/types.js';
import { getTemplateByRuleId } from './fixpackGenerator.js';
import { generateLineDiff, type FileDiff } from './fixDiffService.js';
import { validatePatch, validateJsonLdSchema, type ValidationResult } from './fixValidationService.js';
import type { FixIntent } from './fixIntentMapper.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DeterministicPatch {
    ruleId: string;
    intentType: FixIntent['type'];
    targetFile: string;
    operation: 'create' | 'update';
    /** Full new file content to commit */
    content: string;
    /** Original file content used as base (empty string for creates) */
    before: string;
    /** Line-level diff for preview */
    diff: FileDiff;
    /** One-sentence reason shown in the PR body */
    justification: string;
    /** Validation result — callers should discard if !valid */
    validation: ValidationResult;
    is_deterministic: true;
}

// ─── HTML DOM operations via cheerio ─────────────────────────────────────────

/**
 * Inject an HTML snippet before </head>. If the snippet is already present
 * (checked via the first 60 chars), it is not inserted twice.
 */
function injectBeforeHead(html: string, snippet: string): string {
    const $ = cheerio.load(html, { xml: { decodeEntities: false } });
    const normalised = snippet.trim();

    // Deduplicate by checking a fingerprint from the snippet
    const fingerprint = normalised.slice(0, 60);
    if ($.html().includes(fingerprint)) {
        return html; // already present
    }

    $('head').append(`\n  ${normalised}`);
    return $.html();
}

/**
 * Set or update the `lang` attribute on the root <html> element.
 */
function setHtmlLang(html: string, lang: string): string {
    const $ = cheerio.load(html, { xml: { decodeEntities: false } });
    $('html').attr('lang', lang);
    return $.html();
}

/**
 * Update the <title> tag, creating it if absent.
 */
function setTitle(html: string, title: string): string {
    const $ = cheerio.load(html, { xml: { decodeEntities: false } });
    const existing = $('title');
    if (existing.length > 0) {
        existing.text(title);
    } else {
        $('head').prepend(`<title>${title}</title>`);
    }
    return $.html();
}

// ─── Content generators for non-HTML files ───────────────────────────────────

function buildRobotsTxt(targetUrl: string, existingContent?: string): string {
    // If there's existing content, unblock AI crawlers and ensure Allow: / is present
    if (existingContent) {
        let updated = existingContent;

        // Remove any Disallow lines for known AI crawlers
        const aiCrawlers = ['GPTBot', 'Google-Extended', 'ClaudeBot', 'PerplexityBot', 'anthropic-ai', 'Applebot-Extended', 'Bytespider', 'cohere-ai', 'meta-externalagent', 'OAI-SearchBot'];
        for (const bot of aiCrawlers) {
            updated = updated.replace(new RegExp(`(User-agent: ${bot}\\s*\\n)Disallow: \\/`, 'gi'), `$1Allow: /`);
        }

        // Ensure there's a global Allow: / entry
        if (!updated.match(/^User-agent: \*[\s\S]*Allow: \//m)) {
            updated = `User-agent: *\nAllow: /\n\n${updated}`;
        }

        // Add AI crawler blocks if not already present
        const missing = aiCrawlers.filter(
            bot => !updated.includes(`User-agent: ${bot}`)
        );
        if (missing.length > 0) {
            const additions = missing.map(bot => `User-agent: ${bot}\nAllow: /`).join('\n\n');
            updated = updated + `\n\n${additions}`;
        }

        return updated.trim();
    }

    // Fresh robots.txt
    const { hostname: domain } = (() => {
        try { return new URL(targetUrl); } catch { return { hostname: 'example.com' }; }
    })();

    return [
        'User-agent: *',
        'Allow: /',
        '',
        'User-agent: GPTBot',
        'Allow: /',
        '',
        'User-agent: Google-Extended',
        'Allow: /',
        '',
        'User-agent: ClaudeBot',
        'Allow: /',
        '',
        'User-agent: PerplexityBot',
        'Allow: /',
        '',
        'User-agent: anthropic-ai',
        'Allow: /',
        '',
        'User-agent: OAI-SearchBot',
        'Allow: /',
        '',
        `Sitemap: https://${domain}/sitemap.xml`,
    ].join('\n');
}

function buildLlmsTxt(targetUrl: string): string {
    const { hostname: domain } = (() => {
        try { return new URL(targetUrl); } catch { return { hostname: 'example.com' }; }
    })();

    return [
        `# ${domain}`,
        '',
        '> A brief description of this site or organization.',
        '',
        '## Docs',
        '',
        `- [Homepage](https://${domain}/)`,
        `- [About](https://${domain}/about)`,
        '',
        '## Optional',
        '',
        `- [Blog](https://${domain}/blog)`,
    ].join('\n');
}

function buildSitemapXml(targetUrl: string): string {
    const { hostname: domain } = (() => {
        try { return new URL(targetUrl); } catch { return { hostname: 'example.com' }; }
    })();
    const today = new Date().toISOString().split('T')[0];

    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        '  <url>',
        `    <loc>https://${domain}/</loc>`,
        `    <lastmod>${today}</lastmod>`,
        '    <changefreq>weekly</changefreq>',
        '    <priority>1.0</priority>',
        '  </url>',
        '</urlset>',
    ].join('\n');
}

// ─── Per-intent build logic ───────────────────────────────────────────────────

/**
 * Build a deterministic patch for a given FixIntent.
 *
 * @param intent     The normalised fix intent from mapRuleResultsToIntents()
 * @param evidence   SSFR evidence items from the audit
 * @param targetUrl  The analysed URL (used in schema and canonical links)
 * @param existingContent  Current content of the target file from the repo (optional)
 */
export function buildDeterministicPatch(
    intent: FixIntent,
    evidence: SSFREvidenceItem[],
    targetUrl: string,
    existingContent?: string,
): DeterministicPatch | null {
    if (!intent.canFixDeterministically) return null;

    const template = getTemplateByRuleId(intent.ruleId);
    if (!template) return null;

    const before = existingContent ?? '';
    let after: string;
    let operation: DeterministicPatch['operation'] = existingContent ? 'update' : 'create';

    try {
        switch (intent.type) {
            case 'schema_insert': {
                const assets = template.generate(evidence, targetUrl);
                const asset = assets.find(a => a.type === 'json_ld') ?? assets[0];
                if (!asset) return null;

                if (existingContent && existingContent.includes('</head>')) {
                    after = injectBeforeHead(existingContent, asset.content);
                } else if (existingContent) {
                    // No </head>, append
                    after = existingContent + '\n' + asset.content;
                } else {
                    // No existing content → return snippet only (PR creates new file)
                    after = asset.content;
                    operation = 'create';
                }
                break;
            }

            case 'meta_update': {
                const assets = template.generate(evidence, targetUrl);
                const asset = assets.find(a => a.type === 'meta_tag' || a.type === 'html_block') ?? assets[0];
                if (!asset) return null;

                // Special handling for lang attribute
                if (intent.ruleId === 'signal_lang') {
                    const lang = asset.content.match(/lang="([^"]+)"/)?.[1] ?? 'en';
                    if (existingContent) {
                        after = setHtmlLang(existingContent, lang);
                    } else {
                        after = asset.content;
                        operation = 'create';
                    }
                    break;
                }

                if (existingContent && existingContent.includes('</head>')) {
                    after = injectBeforeHead(existingContent, asset.content);
                } else if (existingContent) {
                    after = existingContent + '\n' + asset.content;
                } else {
                    after = asset.content;
                    operation = 'create';
                }
                break;
            }

            case 'file_create': {
                switch (intent.ruleId) {
                    case 'source_robots_txt':
                        after = buildRobotsTxt(targetUrl, existingContent);
                        break;
                    case 'source_llms_txt':
                        after = buildLlmsTxt(targetUrl);
                        break;
                    case 'signal_sitemap':
                        after = buildSitemapXml(targetUrl);
                        break;
                    default: {
                        const assets = template.generate(evidence, targetUrl);
                        after = assets[0]?.content ?? '';
                    }
                }
                operation = existingContent ? 'update' : 'create';
                break;
            }

            case 'file_update': {
                // e.g. source_ai_crawler_access — unblock existing robots.txt
                if (intent.ruleId === 'source_ai_crawler_access') {
                    after = buildRobotsTxt(targetUrl, before || undefined);
                    operation = before ? 'update' : 'create';
                    break;
                }
                const assets = template.generate(evidence, targetUrl);
                after = assets[0]?.content ?? '';
                operation = before ? 'update' : 'create';
                break;
            }

            default:
                return null;
        }
    } catch {
        return null;
    }

    if (!after || after === before) return null;

    const diff = generateLineDiff(before, after);
    if (!diff.has_changes) return null;

    // Validate the patch content
    let validation: ValidationResult;
    if (intent.type === 'schema_insert') {
        // Extract JSON from the script tag for validation
        const jsonMatch = after.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
        validation = jsonMatch
            ? validateJsonLdSchema(jsonMatch[1])
            : validatePatch({ type: 'json_ld', content: after, path: intent.targetFile, operation: 'update' });
    } else {
        validation = validatePatch({ type: 'meta_tag', content: after, path: intent.targetFile, operation: 'update' });
    }

    return {
        ruleId: intent.ruleId,
        intentType: intent.type,
        targetFile: intent.targetFile,
        operation,
        content: after,
        before,
        diff,
        justification: `Automated fix for rule "${intent.ruleId}": ${intent.description}`,
        validation,
        is_deterministic: true,
    };
}

/**
 * Build deterministic patches for all eligible intents in a batch.
 * Skips intents that fail validation or produce no change.
 */
export function buildDeterministicPatches(
    intents: FixIntent[],
    evidence: SSFREvidenceItem[],
    targetUrl: string,
    existingContentMap: Record<string, string> = {},
): DeterministicPatch[] {
    const patches: DeterministicPatch[] = [];

    for (const intent of intents) {
        if (!intent.canFixDeterministically) continue;
        const existing = existingContentMap[intent.targetFile];
        const patch = buildDeterministicPatch(intent, evidence, targetUrl, existing);
        if (patch && patch.validation.valid) {
            patches.push(patch);
        }
    }

    return patches;
}
