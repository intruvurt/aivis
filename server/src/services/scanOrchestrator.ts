/**
 * scanOrchestrator.ts
 *
 * Runs the live streaming scan pipeline, emitting ScanEvent objects at each
 * stage so callers can forward them over SSE or any other transport.
 *
 * Flow:
 *   SCAN_STARTED → HTML_FETCHED → DOM_PARSED → CITE_FOUND* →
 *   ENTITY_EXTRACTED* → INTERPRETATION → SCORE_UPDATED* → SCAN_COMPLETED
 */

import crypto from 'node:crypto';
import { scrapeWebsite } from './scraper.js';
import { extractEvidenceFromScrape } from './evidenceExtractor.js';
import { scoreEvidence } from './scoringEngine.js';
import { buildPreviewResult } from './previewScanner.js';
import type {
    ScanEvent,
    CiteEntry,
    EntityRef,
    ScoringCategory,
} from '../../../shared/types.js';

// Categories that contribute to each display layer
const CRAWL_CATEGORIES: ScoringCategory[] = ['technical_seo'];
const AUTHORITY_CATEGORIES: ScoringCategory[] = ['security_trust'];
const SEMANTIC_CATEGORIES: ScoringCategory[] = [
    'content_depth',
    'heading_structure',
    'schema_structured_data',
    'meta_tags_og',
    'ai_readability',
];

function avgScore(cats: ScoringCategory[], categoryMap: Map<ScoringCategory, number>): number {
    const vals = cats.map((c) => categoryMap.get(c) ?? 50);
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

/** Derive a stable ID for a cite entry from its evidence key and source */
function citeId(evidenceKey: string, source: string): string {
    return crypto
        .createHash('sha1')
        .update(`${evidenceKey}:${source}`)
        .digest('hex')
        .slice(0, 16);
}

/** Convert an evidence item's value to a human-readable signal string */
function toSignal(evidenceKey: string, value: unknown): string {
    if (typeof value === 'string') return value.slice(0, 120);
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) return `${value.length} item(s)`;
    if (value && typeof value === 'object') {
        const keys = Object.keys(value as object).join(', ');
        return keys ? `{${keys.slice(0, 80)}}` : 'structured data present';
    }
    return 'present';
}

/** Evidence family → entity type label */
const FAMILY_ENTITY_MAP: Record<string, string> = {
    source: 'Source',
    signal: 'Signal',
    fact: 'Fact',
    relationship: 'Relationship',
};

/** Friendly interpretation messages keyed by SSFF family */
const FAMILY_MESSAGES: Record<string, string> = {
    source: 'Verifying source authority and provenance anchors',
    signal: 'Extracting semantic signal density and keyword coverage',
    fact: 'Mapping factual claims against verifiable evidence',
    relationship: 'Resolving entity relationships and citation graph edges',
};

export async function runScan(
    url: string,
    emit: (event: ScanEvent) => void,
): Promise<void> {
    const startMs = Date.now();

    emit({ type: 'SCAN_STARTED', url, ts: startMs });

    // ── Stage 1: Fetch HTML ───────────────────────────────────────────────────
    let scrapeResult: Awaited<ReturnType<typeof scrapeWebsite>>;
    try {
        scrapeResult = await scrapeWebsite(url);
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Could not fetch page';
        emit({ type: 'ERROR', stage: 'HTML_FETCH', message: msg });
        return;
    }

    const htmlBytes = scrapeResult.data.html?.length ?? 0;
    emit({ type: 'HTML_FETCHED', bytes: htmlBytes });

    // Approximate DOM node count from the raw HTML length (one tag ≈ 80 bytes)
    const estimatedNodes = Math.max(10, Math.round(htmlBytes / 80));
    emit({ type: 'DOM_PARSED', nodes: estimatedNodes });

    // ── Stage 2: Extract evidence / cites ────────────────────────────────────
    let evidence: ReturnType<typeof extractEvidenceFromScrape>;
    try {
        evidence = extractEvidenceFromScrape(scrapeResult);
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Evidence extraction failed';
        emit({ type: 'ERROR', stage: 'CITE_EXTRACT', message: msg });
        return;
    }

    // Emit each cite entry (cap at 30 to keep the stream lightweight)
    const capped = evidence.slice(0, 30);
    for (const item of capped) {
        const cite: CiteEntry = {
            id: citeId(item.evidence_key, item.source),
            raw_evidence: toSignal(item.evidence_key, item.value),
            extracted_signal: `${item.evidence_key} — ${item.status}`,
            evidence_key: item.evidence_key,
            timestamp: Date.now(),
        };
        emit({ type: 'CITE_FOUND', cite });
    }

    // ── Stage 3: Entity extraction ────────────────────────────────────────────
    // Derive entity refs from the unique SSFF families present in evidence
    const seenFamilies = new Set<string>();
    const entities: EntityRef[] = [];

    for (const item of evidence) {
        if (seenFamilies.has(item.family)) continue;
        seenFamilies.add(item.family);

        const entity: EntityRef = {
            name: item.source || url,
            type: FAMILY_ENTITY_MAP[item.family] ?? item.family,
            confidence: item.confidence,
        };
        entities.push(entity);
        emit({ type: 'ENTITY_EXTRACTED', entity });
    }

    // ── Stage 4: Interpretation pass ─────────────────────────────────────────
    const interpretedFamilies = new Set<string>();
    for (const item of evidence) {
        if (interpretedFamilies.has(item.family)) continue;
        interpretedFamilies.add(item.family);

        const msg = FAMILY_MESSAGES[item.family] ?? `Analysing ${item.family} signals`;
        const cite_ids = evidence
            .filter((e) => e.family === item.family)
            .slice(0, 3)
            .map((e) => citeId(e.evidence_key, e.source));

        emit({ type: 'INTERPRETATION', message: msg, cite_ids });
    }

    // ── Stage 5: Score ────────────────────────────────────────────────────────
    let scoring: ReturnType<typeof scoreEvidence>;
    try {
        scoring = scoreEvidence(evidence);
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Scoring failed';
        emit({ type: 'ERROR', stage: 'SCORE', message: msg });
        return;
    }

    // Build a category → score lookup
    const catMap = new Map<ScoringCategory, number>();
    for (const cat of scoring.categories) {
        catMap.set(cat.category, cat.score_0_100);
    }

    emit({ type: 'SCORE_UPDATED', layer: 'crawl', value: avgScore(CRAWL_CATEGORIES, catMap) });
    emit({ type: 'SCORE_UPDATED', layer: 'semantic', value: avgScore(SEMANTIC_CATEGORIES, catMap) });
    emit({ type: 'SCORE_UPDATED', layer: 'authority', value: avgScore(AUTHORITY_CATEGORIES, catMap) });

    // ── Stage 6: Finalise ─────────────────────────────────────────────────────
    const preview = buildPreviewResult(url, evidence, scoring);

    emit({
        type: 'SCAN_COMPLETED',
        summary: {
            url,
            score: scoring.overall_score,
            cite_count: evidence.length,
            entity_count: entities.length,
            processing_ms: Date.now() - startMs,
            status_line: preview.status_line,
            findings: preview.findings,
            recommendation: preview.recommendation,
            hard_blockers: preview.hard_blockers,
            scanned_at: preview.scanned_at,
        },
    });
}
