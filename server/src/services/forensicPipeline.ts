/**
 * forensicPipeline.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Event-driven forensic pipeline for the CITE LEDGER system.
 *
 * Architecture:
 *   EVENT LOG (append-only truth)
 *       ↓
 *   LEDGER (normalized evidence — citation_ledger rows)
 *       ↓
 *   REGISTRY (derived queryable state — visibility_registry, query_coverage, authority_registry)
 *
 * Usage:
 *   import { pipeline } from './forensicPipeline';
 *   await pipeline.emit('CITATION_FOUND', { scanId, queryId, sourceId, ... });
 */

import { getPool } from './postgresql.js';

// ── Event Type Map ────────────────────────────────────────────────────────────

export type ForensicEventType =
    | 'SCAN_STARTED'
    | 'ENTITY_EXTRACTED'
    | 'QUERY_GENERATED'
    | 'QUERY_EXECUTED'
    | 'CITATION_FOUND'
    | 'ENTITY_MENTION_LINKED'
    | 'REGISTRY_UPDATED'
    | 'SCAN_COMPLETED';

export interface ForensicEvent<T = Record<string, unknown>> {
    type: ForensicEventType;
    scanId: string;
    payload: T;
}

// ── Event Payloads ────────────────────────────────────────────────────────────

export interface ScanStartedPayload {
    url: string;
    domain: string;
    inputBrand?: string;
    auditId?: string;
}

export interface EntityExtractedPayload {
    name: string;
    entityType?: string;
    confidence?: number;
    source?: string;
    entityId?: string;
}

export interface QueryGeneratedPayload {
    query: string;
    queryType?: string;
    priority?: number;
    queryId?: string;
}

export interface CitationFoundPayload {
    queryId?: string;
    sourceId?: string;
    sourceDomain?: string;
    sourceUrl?: string;
    position?: number;
    mentioned: boolean;
    cited: boolean;
    context?: string;
    sentiment?: string;
    confidence?: number;
    model?: string;
}

export interface EntityMentionLinkedPayload {
    entityId: string;
    citationId: string;
    relevance?: number;
}

// ── Core Pipeline Class ───────────────────────────────────────────────────────

class ForensicPipeline {
    /**
     * Emit a forensic event. Persists to scan_events log, then routes to the
     * appropriate ledger/registry handler.
     */
    async emit<T extends Record<string, unknown>>(
        type: ForensicEventType,
        scanId: string,
        payload: T,
    ): Promise<void> {
        const pool = getPool();

        // 1. Append to immutable event log
        try {
            await pool.query(
                `INSERT INTO scan_events (scan_id, event_type, payload) VALUES ($1, $2, $3)`,
                [scanId, type, JSON.stringify(payload)],
            );
        } catch (err: any) {
            console.warn(`[forensicPipeline] Event log write failed for ${type}: ${err?.message}`);
        }

        // 2. Route to handler
        try {
            switch (type) {
                case 'SCAN_STARTED':
                    await this._onScanStarted(scanId, payload as unknown as ScanStartedPayload);
                    break;
                case 'ENTITY_EXTRACTED':
                    await this._onEntityExtracted(scanId, payload as unknown as EntityExtractedPayload);
                    break;
                case 'QUERY_GENERATED':
                    await this._onQueryGenerated(scanId, payload as unknown as QueryGeneratedPayload);
                    break;
                case 'CITATION_FOUND':
                    await this._onCitationFound(scanId, payload as unknown as CitationFoundPayload);
                    break;
                case 'ENTITY_MENTION_LINKED':
                    await this._onEntityMentionLinked(payload as unknown as EntityMentionLinkedPayload);
                    break;
                case 'REGISTRY_UPDATED':
                    await this._onRegistryUpdated(scanId);
                    break;
                case 'SCAN_COMPLETED':
                    await this._onScanCompleted(scanId);
                    break;
            }
        } catch (err: any) {
            console.warn(`[forensicPipeline] Handler failed for ${type}: ${err?.message}`);
        }
    }

    // ── Handlers ───────────────────────────────────────────────────────────────

    private async _onScanStarted(scanId: string, p: ScanStartedPayload): Promise<void> {
        const pool = getPool();
        await pool.query(
            `INSERT INTO scan_runs (id, audit_id, url, domain, input_brand, status)
       VALUES ($1, $2, $3, $4, $5, 'running')
       ON CONFLICT (id) DO UPDATE SET status = 'running'`,
            [scanId, p.auditId ?? null, p.url, p.domain, p.inputBrand ?? null],
        );
    }

    private async _onEntityExtracted(scanId: string, p: EntityExtractedPayload): Promise<void> {
        if (!p.entityId) return;
        const pool = getPool();
        // entities table already managed by Entity OS; just ensure scan link exists
        await pool.query(
            `UPDATE entities SET updated_at = NOW() WHERE id = $1`,
            [p.entityId],
        ).catch(() => { });
    }

    private async _onQueryGenerated(scanId: string, p: QueryGeneratedPayload): Promise<void> {
        const pool = getPool();
        if (p.queryId) {
            await pool.query(
                `INSERT INTO scan_queries (id, scan_id, query, query_type, priority)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO NOTHING`,
                [p.queryId, scanId, p.query, p.queryType ?? null, p.priority ?? 0],
            );
        } else {
            await pool.query(
                `INSERT INTO scan_queries (scan_id, query, query_type, priority)
         VALUES ($1, $2, $3, $4)`,
                [scanId, p.query, p.queryType ?? null, p.priority ?? 0],
            );
        }
    }

    private async _onCitationFound(scanId: string, p: CitationFoundPayload): Promise<void> {
        const pool = getPool();
        let sourceId = p.sourceId ?? null;

        // Upsert source if URL provided but no sourceId
        if (!sourceId && p.sourceUrl) {
            const domain = p.sourceDomain ?? new URL(p.sourceUrl).hostname;
            const res = await pool.query(
                `INSERT INTO citation_sources (domain, url)
         VALUES ($1, $2)
         ON CONFLICT (url) DO UPDATE SET domain = EXCLUDED.domain
         RETURNING id`,
                [domain, p.sourceUrl],
            );
            sourceId = res.rows[0]?.id ?? null;
        }

        // Append to immutable citation ledger
        await pool.query(
            `INSERT INTO citation_ledger
         (scan_id, query_id, source_id, position, mentioned, cited, context, sentiment, confidence, model)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
                scanId,
                p.queryId ?? null,
                sourceId,
                p.position ?? null,
                p.mentioned,
                p.cited,
                p.context ?? null,
                p.sentiment ?? null,
                p.confidence ?? 1.0,
                p.model ?? null,
            ],
        );
    }

    private async _onEntityMentionLinked(p: EntityMentionLinkedPayload): Promise<void> {
        const pool = getPool();
        await pool.query(
            `INSERT INTO entity_mention_links (entity_id, citation_id, relevance)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
            [p.entityId, p.citationId, p.relevance ?? 1.0],
        );
    }

    private async _onRegistryUpdated(scanId: string): Promise<void> {
        await this._computeAndUpsertRegistry(scanId);
    }

    private async _onScanCompleted(scanId: string): Promise<void> {
        const pool = getPool();
        // Mark scan run complete
        await pool.query(
            `UPDATE scan_runs SET status = 'complete' WHERE id = $1`,
            [scanId],
        ).catch(() => { });
        // Compute full registry
        await this._computeAndUpsertRegistry(scanId);
        // Detect gaps
        await this._detectGaps(scanId);
    }

    // ── Registry Computation ───────────────────────────────────────────────────

    private async _computeAndUpsertRegistry(scanId: string): Promise<void> {
        const pool = getPool();

        // Fetch all ledger rows for this scan
        const ledgerRes = await pool.query(
            `SELECT query_id, source_id, mentioned, cited, position, confidence
       FROM citation_ledger WHERE scan_id = $1`,
            [scanId],
        );
        const rows = ledgerRes.rows as Array<{
            query_id: string | null;
            source_id: string | null;
            mentioned: boolean;
            cited: boolean;
            position: number | null;
            confidence: number;
        }>;

        if (rows.length === 0) return;

        // citation_coverage: fraction of rows where brand was mentioned
        const citationCoverage = rows.filter(r => r.mentioned).length / rows.length;

        // answer_presence: fraction of rows where brand was actually cited
        const answerPresence = rows.filter(r => r.cited).length / rows.length;

        // authority_alignment: confidence-weighted average for cited rows
        const citedRows = rows.filter(r => r.cited);
        const authorityAlignment = citedRows.length > 0
            ? citedRows.reduce((sum, r) => sum + (r.confidence ?? 1.0), 0) / citedRows.length
            : 0;

        // Upsert visibility registry
        await pool.query(
            `INSERT INTO visibility_registry
         (scan_id, citation_coverage, answer_presence, authority_alignment, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (scan_id) DO UPDATE SET
         citation_coverage = EXCLUDED.citation_coverage,
         answer_presence = EXCLUDED.answer_presence,
         authority_alignment = EXCLUDED.authority_alignment,
         updated_at = NOW()`,
            [scanId, citationCoverage, answerPresence, authorityAlignment],
        );

        // Upsert query coverage — group by query_id
        const queryMap = new Map<string, { cited: number; total: number; positions: number[] }>();
        for (const row of rows) {
            const qid = row.query_id ?? '__unlinked__';
            const entry = queryMap.get(qid) ?? { cited: 0, total: 0, positions: [] };
            entry.total++;
            if (row.cited) entry.cited++;
            if (row.position != null) entry.positions.push(row.position);
            queryMap.set(qid, entry);
        }

        for (const [queryId, stats] of queryMap) {
            if (queryId === '__unlinked__') continue;
            const avgPos = stats.positions.length > 0
                ? stats.positions.reduce((a, b) => a + b, 0) / stats.positions.length
                : null;
            await pool.query(
                `INSERT INTO query_coverage (scan_id, query_id, appears, citation_count, avg_position, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (scan_id, query_id) DO UPDATE SET
           appears = EXCLUDED.appears,
           citation_count = EXCLUDED.citation_count,
           avg_position = EXCLUDED.avg_position,
           updated_at = NOW()`,
                [scanId, queryId, stats.cited > 0, stats.cited, avgPos],
            ).catch(() => { });
        }

        // Upsert authority registry — group by source_id
        const sourceMap = new Map<string, { mentions: number; citations: number; totalConf: number }>();
        for (const row of rows) {
            if (!row.source_id) continue;
            const entry = sourceMap.get(row.source_id) ?? { mentions: 0, citations: 0, totalConf: 0 };
            if (row.mentioned) entry.mentions++;
            if (row.cited) { entry.citations++; entry.totalConf += row.confidence ?? 1.0; }
            sourceMap.set(row.source_id, entry);
        }

        for (const [sourceId, stats] of sourceMap) {
            const alignmentScore = stats.citations > 0 ? stats.totalConf / stats.citations : 0;
            await pool.query(
                `INSERT INTO authority_registry (scan_id, source_id, mentions, citations, alignment_score)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (scan_id, source_id) DO UPDATE SET
           mentions = EXCLUDED.mentions,
           citations = EXCLUDED.citations,
           alignment_score = EXCLUDED.alignment_score`,
                [scanId, sourceId, stats.mentions, stats.citations, alignmentScore],
            ).catch(() => { });
        }
    }

    // ── Gap Detection ──────────────────────────────────────────────────────────

    private async _detectGaps(scanId: string): Promise<void> {
        const pool = getPool();

        // Remove prior gaps for this scan (re-detection is idempotent)
        await pool.query(`DELETE FROM scan_gaps WHERE scan_id = $1`, [scanId]).catch(() => { });

        // Query absence: queries where the brand never appeared
        const absentRes = await pool.query(
            `SELECT sq.id AS query_id, sq.query
       FROM scan_queries sq
       LEFT JOIN query_coverage qc ON qc.scan_id = $1 AND qc.query_id = sq.id
       WHERE sq.scan_id = $1 AND (qc.appears IS NULL OR qc.appears = FALSE)`,
            [scanId],
        );

        for (const row of absentRes.rows) {
            await pool.query(
                `INSERT INTO scan_gaps (scan_id, gap_type, description, related_query_id, severity)
         VALUES ($1, 'query_absence', $2, $3, 0.9)`,
                [scanId, `Brand not present in results for: "${row.query}"`, row.query_id],
            ).catch(() => { });
        }

        // Citation gap: mentioned but never cited
        const mentionedNotCitedRes = await pool.query(
            `SELECT COUNT(*) AS cnt FROM citation_ledger
       WHERE scan_id = $1 AND mentioned = TRUE AND cited = FALSE`,
            [scanId],
        );
        const mentionedNotCited = parseInt(mentionedNotCitedRes.rows[0]?.cnt ?? '0', 10);
        if (mentionedNotCited > 0) {
            await pool.query(
                `INSERT INTO scan_gaps (scan_id, gap_type, description, severity)
         VALUES ($1, 'citation_gap', $2, 0.75)`,
                [
                    scanId,
                    `Brand mentioned in ${mentionedNotCited} result(s) but never cited — trust deficit detected`,
                ],
            ).catch(() => { });
        }

        // Authority gap: zero citation sources with high alignment score
        const authRes = await pool.query(
            `SELECT COUNT(*) AS cnt FROM authority_registry
       WHERE scan_id = $1 AND alignment_score > 0.7`,
            [scanId],
        );
        const highAlignSources = parseInt(authRes.rows[0]?.cnt ?? '0', 10);
        if (highAlignSources === 0) {
            await pool.query(
                `INSERT INTO scan_gaps (scan_id, gap_type, description, severity)
         VALUES ($1, 'authority_gap', 'No high-alignment authority sources found in citation set', 0.8)`,
                [scanId],
            ).catch(() => { });
        }
    }
}

// ── Singleton export ──────────────────────────────────────────────────────────

export const pipeline = new ForensicPipeline();

// ── Convenience helper: start a scan run and return its ID ───────────────────
export async function startScanRun(
    auditId: string | null,
    url: string,
    domain: string,
    inputBrand?: string,
): Promise<string> {
    const { v4: uuidv4 } = await import('uuid');
    const scanId = uuidv4();
    await pipeline.emit('SCAN_STARTED', scanId, {
        url,
        domain,
        inputBrand,
        auditId: auditId ?? undefined,
    });
    return scanId;
}
