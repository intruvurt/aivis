/**
 * visibilityEventLedger.ts
 *
 * Immutable VisibilityEvent persistence layer for the AiVIS pipeline.
 *
 * Records every LLM probe result as structured data — transforming
 * one-time model responses into a durable retrieval behavior record.
 *
 * ARCHITECTURE RULE (AGENTS.md §1):
 *   - Every event must be traceable to a scan_id
 *   - Once written, rows are never mutated (append-only)
 *   - cited_sources and missing_sources MUST reference real retrieved
 *     evidence — never synthetic values
 *
 * Each VisibilityEvent captures:
 *   - which prompt was used
 *   - which model responded
 *   - which sources were cited by that model
 *   - whether the target entity appeared in the answer
 *   - its rank position if present
 *
 * This ledger feeds:
 *   1. Gap detection (entities consistently absent → gaps)
 *   2. Comparison page generation (competitors consistently cited)
 *   3. RSS event feed (new citation failures)
 */

import { getPool } from './postgresql.js';
import { sanitizePromptInput } from '../utils/sanitize.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface VisibilityEvent {
    scan_id: string | null;
    entity: string;
    prompt: string;
    model_used: string;
    cited_sources: string[];
    missing_sources: string[];
    /** 1-based rank if entity appeared in answer, null if absent */
    position_rank: number | null;
    entity_present: boolean;
    /** raw answer text — stored for future re-analysis */
    raw_answer?: string;
}

export interface VisibilityEventRow extends VisibilityEvent {
    id: string;
    probed_at: string;
}

export interface BulkWriteResult {
    written: number;
    skipped: number;
}

// ── Write ─────────────────────────────────────────────────────────────────────

/**
 * Persist a single VisibilityEvent to the immutable ledger.
 */
export async function writeVisibilityEvent(event: VisibilityEvent): Promise<string | null> {
    const pool = getPool();

    const entity = sanitizePromptInput(event.entity ?? '').slice(0, 500);
    const prompt = sanitizePromptInput(event.prompt ?? '').slice(0, 2000);
    const model = (event.model_used ?? '').slice(0, 120);

    if (!entity || !prompt || !model) return null;

    const cited = Array.isArray(event.cited_sources)
        ? event.cited_sources.map((s) => String(s).slice(0, 2000))
        : [];
    const missing = Array.isArray(event.missing_sources)
        ? event.missing_sources.map((s) => String(s).slice(0, 2000))
        : [];
    const rank = typeof event.position_rank === 'number' && event.position_rank >= 1
        ? event.position_rank
        : null;
    const rawAnswer = typeof event.raw_answer === 'string'
        ? event.raw_answer.slice(0, 8000)
        : null;

    try {
        const result = await pool.query(
            `INSERT INTO visibility_events
                (scan_id, entity, prompt, model_used, cited_sources, missing_sources,
                 position_rank, entity_present, raw_answer)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING id`,
            [
                event.scan_id ?? null,
                entity,
                prompt,
                model,
                cited,
                missing,
                rank,
                event.entity_present,
                rawAnswer,
            ],
        );

        const eventId = result.rows[0]?.id as string | undefined;

        // Emit RSS event for citation failures (entity absent from response)
        if (eventId && !event.entity_present) {
            void emitCitationFailureRssEvent(entity, prompt, model, event.scan_id);
        }

        return eventId ?? null;
    } catch {
        return null;
    }
}

/**
 * Persist multiple VisibilityEvents in a single transaction batch.
 * Skips individual rows that fail validation — never throws.
 */
export async function bulkWriteVisibilityEvents(
    events: VisibilityEvent[],
): Promise<BulkWriteResult> {
    let written = 0;
    let skipped = 0;

    for (const event of events) {
        const id = await writeVisibilityEvent(event);
        if (id) written++;
        else skipped++;
    }

    return { written, skipped };
}

// ── RSS emission ──────────────────────────────────────────────────────────────

async function emitCitationFailureRssEvent(
    entity: string,
    prompt: string,
    model: string,
    scan_id: string | null,
): Promise<void> {
    try {
        const pool = getPool();
        const title = `Citation failure: "${entity}" absent from ${model} response`;
        const description = `Probe prompt: "${prompt.slice(0, 200)}" — ${entity} was not cited by ${model}.`;
        await pool.query(
            `INSERT INTO rss_events (event_type, title, description, entity, scan_id)
             VALUES ('citation_failure', $1, $2, $3, $4)`,
            [title, description, entity, scan_id],
        );
    } catch {
        // supplementary — swallow
    }
}

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * Fetch visibility events for a given entity, most recent first.
 */
export async function getVisibilityEventsForEntity(
    entity: string,
    limit = 100,
): Promise<VisibilityEventRow[]> {
    const pool = getPool();
    try {
        const result = await pool.query(
            `SELECT id, scan_id, entity, prompt, model_used, cited_sources,
                    missing_sources, position_rank, entity_present, probed_at
             FROM visibility_events
             WHERE LOWER(entity) = LOWER($1)
             ORDER BY probed_at DESC
             LIMIT $2`,
            [entity, limit],
        );
        return result.rows as VisibilityEventRow[];
    } catch {
        return [];
    }
}

/**
 * Fetch all visibility events tied to a scan_id.
 */
export async function getVisibilityEventsForScan(
    scan_id: string,
): Promise<VisibilityEventRow[]> {
    const pool = getPool();
    try {
        const result = await pool.query(
            `SELECT id, scan_id, entity, prompt, model_used, cited_sources,
                    missing_sources, position_rank, entity_present, probed_at
             FROM visibility_events
             WHERE scan_id = $1
             ORDER BY probed_at ASC`,
            [scan_id],
        );
        return result.rows as VisibilityEventRow[];
    } catch {
        return [];
    }
}

/**
 * Compute entity presence rate across all probes — proportion of prompts
 * where the entity was cited. Used by gap detection and scoring engines.
 */
export async function computeEntityPresenceRate(
    entity: string,
    since?: Date,
): Promise<{ total: number; cited: number; rate: number }> {
    const pool = getPool();
    try {
        const params: (string | Date)[] = [entity];
        const timeClause = since ? `AND probed_at >= $2` : '';
        if (since) params.push(since);

        const result = await pool.query(
            `SELECT COUNT(*) AS total, SUM(CASE WHEN entity_present THEN 1 ELSE 0 END) AS cited
             FROM visibility_events
             WHERE LOWER(entity) = LOWER($1) ${timeClause}`,
            params,
        );

        const total = parseInt(result.rows[0]?.total ?? '0', 10);
        const cited = parseInt(result.rows[0]?.cited ?? '0', 10);
        const rate = total > 0 ? cited / total : 0;
        return { total, cited, rate };
    } catch {
        return { total: 0, cited: 0, rate: 0 };
    }
}

/**
 * Return the top sources cited in responses about an entity — competitors
 * that consistently appear when this entity is missing.
 */
export async function getTopCitedCompetitors(
    entity: string,
    limit = 10,
): Promise<Array<{ source: string; count: number }>> {
    const pool = getPool();
    try {
        const result = await pool.query(
            `SELECT UNNEST(cited_sources) AS source, COUNT(*) AS count
             FROM visibility_events
             WHERE LOWER(entity) = LOWER($1)
               AND NOT entity_present
             GROUP BY source
             ORDER BY count DESC
             LIMIT $2`,
            [entity, limit],
        );
        return result.rows.map((r: any) => ({ source: r.source as string, count: parseInt(r.count, 10) }));
    } catch {
        return [];
    }
}
