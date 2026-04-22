/**
 * Context Extractor — Layer 2 of the AiVIS RAG Pipeline
 *
 * Deterministic, Geekflare-only extraction with format routing:
 *
 *   - markdown-llm: default cognition layer (chunking + graph)
 *   - text-llm:     semantic memory layer (embedding-like normalization)
 *   - html-llm:     forensic precision layer (numbers/tables/claims)
 *
 * Users do not select formats at runtime. The system decides format based on
 * query intent + content precision requirements.
 */

import * as cheerio from 'cheerio';
import type { ShapedIntent } from './intentShaper.js';
import type { RankedResult } from './searchRouter.js';
import { scrapeGeekflare } from './geekflareService.js';

export type ClaimType = 'stat' | 'opinion' | 'announcement' | 'comparison' | 'feature' | 'risk';

export interface ExtractedClaim {
    text: string;
    type: ClaimType;
    confidence: number;
    entities: string[];
    source_url: string;
}

export interface ExtractedPage {
    url: string;
    title: string;
    clean_text: string;
    entities: string[];
    claims: ExtractedClaim[];
    published_ms?: number;
    full_fetch: boolean;
    format_used: 'markdown-llm' | 'text-llm' | 'html-llm' | 'hybrid';
}

export interface ContextExtractionResult {
    pages: ExtractedPage[];
    total_claims: number;
    execution_ms: number;
}

const MAX_CLEAN_TEXT_CHARS = 10_000;
const MAX_PAGES_TO_FETCH = 12;

const CLAIM_PATTERNS: Array<{ type: ClaimType; pattern: RegExp }> = [
    { type: 'stat', pattern: /\b\d[\d,.%xX]*\s*(users?|customers?|clients?|revenue|growth|mrr|arr|%|billion|million|thousand|downloads?|installs?|employees?|headcount)\b/i },
    { type: 'announcement', pattern: /announc|launch(ed|ing)|introduc|release(d|s)|available now|new feature/i },
    { type: 'comparison', pattern: /better than|vs\.?|versus|compared (to|with)|outperform|faster than/i },
    { type: 'risk', pattern: /scam|fraud|breach|vulnerab|hack|exploit|unsafe|broken|bug|fail/i },
    { type: 'feature', pattern: /support(s|ed)?|integrat|export|import|dashboard|api|workflow|automat/i },
    { type: 'opinion', pattern: /think(s)?|believe(s)?|feel(s)?|love(s)?|hate(s)?|opinion|review/i },
];

function classifyClaim(sentence: string): { type: ClaimType; confidence: number } {
    for (const { type, pattern } of CLAIM_PATTERNS) {
        if (pattern.test(sentence)) {
            const hasNumber = /\d/.test(sentence);
            const confidence = type === 'stat'
                ? (hasNumber ? 0.88 : 0.60)
                : 0.68;
            return { type, confidence };
        }
    }
    return { type: 'opinion', confidence: 0.42 };
}

function extractEntitiesFromText(text: string): string[] {
    const entityRegex = /\b([A-Z][a-zA-Z0-9]{1,}(?:\s[A-Z][a-zA-Z0-9]{1,}){0,3})\b/g;
    const skip = new Set(['The', 'This', 'That', 'These', 'Those', 'They', 'Their', 'There', 'We', 'Our', 'You', 'Your', 'Its', 'It']);
    const found = new Set<string>();

    let m: RegExpExecArray | null;
    while ((m = entityRegex.exec(text)) !== null) {
        const token = m[1].trim();
        if (!skip.has(token) && token.length > 2 && token.length < 60) found.add(token);
    }
    return [...found].slice(0, 20);
}

function splitSentences(text: string): string[] {
    return text
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 30 && s.length < 800);
}

function htmlToText(html: string): string {
    const $ = cheerio.load(html || '');
    $('script,style,noscript,header,footer,nav,.nav,.navbar,.footer').remove();
    const body = $('main,article,[role="main"],.content,#content').first().text() || $('body').text() || $.root().text();
    return body.replace(/\s{2,}/g, ' ').trim();
}

function choosePrimaryFormat(intent: ShapedIntent, row: RankedResult): 'markdown-llm' | 'text-llm' | 'html-llm' {
    const precisionIntents = new Set(['growth_verification', 'pricing_research', 'technology_evaluation']);
    if (precisionIntents.has(intent.intent)) return 'html-llm';

    const semanticIntents = new Set(['sentiment_probe', 'product_discovery']);
    if (semanticIntents.has(intent.intent)) return 'text-llm';

    const numericSnippet = /\b\d[\d,.%]*\b/.test(row.snippet || '');
    if (numericSnippet) return 'html-llm';

    return 'markdown-llm';
}

async function extractOne(row: RankedResult, intent: ShapedIntent): Promise<ExtractedPage | null> {
    if (row.pre_decision === 'reject') {
        return null;
    }

    const primary = choosePrimaryFormat(intent, row);
    const selectedFormat = row.pre_decision === 'partial'
        ? 'markdown-llm'
        : primary;

    const main = await scrapeGeekflare(row.url, selectedFormat);
    if (!main?.content) return null;

    let formatUsed: ExtractedPage['format_used'] = selectedFormat;
    let cleanText = selectedFormat === 'html-llm' ? htmlToText(main.content) : main.content;

    // Hybrid forensic mode: html-llm + markdown-llm for precision + hierarchy.
    if (selectedFormat === 'html-llm' && row.pre_decision === 'accept') {
        const md = await scrapeGeekflare(row.url, 'markdown-llm');
        if (md?.content) {
            cleanText = `${md.content}\n\n${cleanText}`;
            formatUsed = 'hybrid';
        }
    }

    cleanText = cleanText.slice(0, MAX_CLEAN_TEXT_CHARS).trim();
    if (!cleanText) return null;

    const claims = splitSentences(cleanText)
        .map((sentence): ExtractedClaim => {
            const { type, confidence } = classifyClaim(sentence);
            return {
                text: sentence,
                type,
                confidence,
                entities: extractEntitiesFromText(sentence).slice(0, 6),
                source_url: row.url,
            };
        })
        .filter((c) => c.confidence >= 0.45)
        .slice(0, 40);

    return {
        url: row.url,
        title: main.title || row.title,
        clean_text: cleanText,
        entities: extractEntitiesFromText(cleanText),
        claims,
        published_ms: row.published_ms,
        full_fetch: true,
        format_used: formatUsed,
    };
}

export async function extractContext(
    results: RankedResult[],
    intent: ShapedIntent,
    maxPages = MAX_PAGES_TO_FETCH,
): Promise<ContextExtractionResult> {
    const t0 = Date.now();
    const targets = results.slice(0, maxPages);

    const settled = await Promise.allSettled(targets.map((row) => extractOne(row, intent)));

    const pages = settled
        .filter((s): s is PromiseFulfilledResult<ExtractedPage | null> => s.status === 'fulfilled')
        .map((s) => s.value)
        .filter((p): p is ExtractedPage => p !== null);

    return {
        pages,
        total_claims: pages.reduce((sum, p) => sum + p.claims.length, 0),
        execution_ms: Date.now() - t0,
    };
}
