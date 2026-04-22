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
import { filterCitations, hashHtmlSnapshot } from './citationFilter.js';
import { runGraphIngestion } from './graphIngestionService.js';
import { runResolution } from './graphResolutionService.js';
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
    emit({
        type: 'PIPELINE_STAGE',
        stage: 'ingesting',
        progress: 0.05,
        payload: { url },
        timestamp: Date.now(),
    });

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
    emit({
        type: 'PIPELINE_STAGE',
        stage: 'ingesting',
        progress: 1,
        payload: { bytes: htmlBytes },
        timestamp: Date.now(),
    });

    // Approximate DOM node count from the raw HTML length (one tag ≈ 80 bytes)
    const estimatedNodes = Math.max(10, Math.round(htmlBytes / 80));
    emit({ type: 'DOM_PARSED', nodes: estimatedNodes });
    emit({
        type: 'PIPELINE_STAGE',
        stage: 'chunking',
        progress: 0.3,
        payload: { estimated_nodes: estimatedNodes },
        timestamp: Date.now(),
    });

    // ── Stage 2: Extract evidence / cites ────────────────────────────────────
    let evidence: ReturnType<typeof extractEvidenceFromScrape>;
    try {
        evidence = extractEvidenceFromScrape(scrapeResult);
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Evidence extraction failed';
        emit({ type: 'ERROR', stage: 'CITE_EXTRACT', message: msg });
        return;
    }

    emit({
        type: 'PIPELINE_STAGE',
        stage: 'chunking',
        progress: 1,
        payload: { chunks: evidence.length },
        timestamp: Date.now(),
    });

    // ── Stage 2b: Citation filter ─────────────────────────────────────────────
    // Hash the raw HTML once — this is the immutable upstream anchor for all
    // cites produced from this page render.
    const htmlHash = hashHtmlSnapshot(scrapeResult.data.html ?? '');

    // Run every evidence item through the deterministic reliability scorer.
    // Only items with reliability_score >= 0.98 are granted a Citation Handle
    // and emitted to the stream — this is the single-writer commit gate.
    const filterResults = filterCitations(evidence, { htmlHash });
    const accepted = filterResults.filter((r) => r.accepted);
    const rejectedCount = filterResults.length - accepted.length;
    emit({
        type: 'PIPELINE_STAGE',
        stage: 'embedding',
        progress: 1,
        payload: {
            candidate_chunks: filterResults.length,
            accepted_chunks: accepted.length,
            rejected_chunks: rejectedCount,
        },
        timestamp: Date.now(),
    });

    if (rejectedCount > 0) {
        // Emit a single diagnostic event so operators can see the rejection rate
        // without exposing individual rejected items to the client stream.
        emit({
            type: 'INTERPRETATION',
            message: `Citation filter: ${accepted.length} accepted, ${rejectedCount} rejected (reliability < 0.98)`,
            cite_ids: [],
        });
    }

    // Emit each accepted cite (cap at 30 to keep the stream lightweight)
    const cappedCites = accepted.slice(0, 30);
    for (const { cite } of cappedCites) {
        emit({ type: 'CITE_FOUND', cite });
    }

    // ── Stage 3: Entity extraction ────────────────────────────────────────────
    // Derive entity refs from the unique SSFF families present in evidence
    const seenFamilies = new Set<string>();
    const entities: EntityRef[] = [];

    emit({
        type: 'PIPELINE_STAGE',
        stage: 'entity_resolving',
        progress: 0,
        payload: { resolved_entities: 0 },
        timestamp: Date.now(),
    });

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
        emit({
            type: 'PIPELINE_STAGE',
            stage: 'entity_resolving',
            progress: entities.length / Math.max(1, seenFamilies.size),
            payload: { resolved_entities: entities.length },
            timestamp: Date.now(),
        });
    }

    emit({
        type: 'PIPELINE_STAGE',
        stage: 'entity_resolving',
        progress: 1,
        payload: { resolved_entities: entities.length },
        timestamp: Date.now(),
    });

    // ── Stage 4: Interpretation pass ─────────────────────────────────────────
    const interpretedFamilies = new Set<string>();
    emit({
        type: 'PIPELINE_STAGE',
        stage: 'edge_building',
        progress: 0,
        payload: { interpreted_families: 0, cite_ids: 0 },
        timestamp: Date.now(),
    });
    for (const item of evidence) {
        if (interpretedFamilies.has(item.family)) continue;
        interpretedFamilies.add(item.family);

        const msg = FAMILY_MESSAGES[item.family] ?? `Analysing ${item.family} signals`;
        const cite_ids = evidence
            .filter((e) => e.family === item.family)
            .slice(0, 3)
            .map((e) => citeId(e.evidence_key, e.source));

        emit({ type: 'INTERPRETATION', message: msg, cite_ids });
        emit({
            type: 'PIPELINE_STAGE',
            stage: 'edge_building',
            progress: interpretedFamilies.size / Math.max(1, seenFamilies.size),
            payload: {
                interpreted_families: interpretedFamilies.size,
                cite_ids: cite_ids.length,
            },
            timestamp: Date.now(),
        });
    }

    emit({
        type: 'PIPELINE_STAGE',
        stage: 'edge_building',
        progress: 1,
        payload: {
            interpreted_families: interpretedFamilies.size,
        },
        timestamp: Date.now(),
    });

    // ── Stage 5: Score ────────────────────────────────────────────────────────
    let scoring: ReturnType<typeof scoreEvidence>;
    try {
        scoring = scoreEvidence(evidence);
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Scoring failed';
        emit({ type: 'ERROR', stage: 'SCORE', message: msg });
        return;
    }

    emit({
        type: 'PIPELINE_STAGE',
        stage: 'scoring',
        progress: 0.7,
        payload: { categories: scoring.categories.length },
        timestamp: Date.now(),
    });

    // Build a category → score lookup
    const catMap = new Map<ScoringCategory, number>();
    for (const cat of scoring.categories) {
        catMap.set(cat.category, cat.score_0_100);
    }

    emit({ type: 'SCORE_UPDATED', layer: 'crawl', value: avgScore(CRAWL_CATEGORIES, catMap) });
    emit({ type: 'SCORE_UPDATED', layer: 'semantic', value: avgScore(SEMANTIC_CATEGORIES, catMap) });
    emit({ type: 'SCORE_UPDATED', layer: 'authority', value: avgScore(AUTHORITY_CATEGORIES, catMap) });
    emit({
        type: 'PIPELINE_STAGE',
        stage: 'scoring',
        progress: 1,
        payload: { overall_score: scoring.overall_score },
        timestamp: Date.now(),
    });

    // ── Stage 6: Finalise ─────────────────────────────────────────────────────
    const preview = buildPreviewResult(url, evidence, scoring);

    // ── Stage 6b: Graph ingestion + resolution (fire-and-forget) ─────────────
    // Runs in background — does not block SCAN_COMPLETED emission.
    // Failures are logged but do not degrade the scan response.
    void runGraphIngestion({
        url,
        html: scrapeResult.data.html ?? '',
    })
        .then(async (ingestion) => {
            if (ingestion.claimCount > 0) {
                await runResolution({ scanId: ingestion.scanId });
            }
        })
        .catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err);
            console.warn('[scanOrchestrator] graph ingestion failed (non-fatal):', msg);
        });

    emit({
        type: 'PIPELINE_STAGE',
        stage: 'complete',
        progress: 1,
        payload: {
            score: scoring.overall_score,
            cites: evidence.length,
            entities: entities.length,
        },
        timestamp: Date.now(),
    });

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
