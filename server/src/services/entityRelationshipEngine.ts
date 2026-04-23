/**
 * entityRelationshipEngine.ts
 *
 * Semantic relationship engine for the AiVIS graph expansion pipeline.
 *
 * Builds and persists typed edges between entity nodes extracted from
 * scan results. This transforms the entity graph from flat nodes into
 * a structured semantic network that mirrors how LLMs reason about entities.
 *
 * Relationship types (canonical):
 *   mentions        – entity A references entity B
 *   competes_with   – same solution space, competing alternatives
 *   explains        – entity A provides definitional coverage of concept B
 *   fails_at        – entity A has documented failures/gaps in area B
 *   improves        – entity A addresses a deficiency of entity B
 *   is_part_of      – entity A is a component/feature of entity B
 *   replaces        – entity A is a successor/alternative to entity B
 *
 * ARCHITECTURE RULE: Every edge written here must be traceable to a scan_id.
 * No synthetic or hallucinated relationships — all edges come from:
 *   1. AI model response analysis
 *   2. Explicit competitor signals from citationTester
 *   3. Content extraction (mentions, is_part_of)
 */

import crypto from 'node:crypto';
import { getPool } from './postgresql.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export type SemanticRelationshipType =
    | 'mentions'
    | 'competes_with'
    | 'explains'
    | 'fails_at'
    | 'improves'
    | 'is_part_of'
    | 'replaces';

export interface RelationshipEdge {
    from_canonical: string;
    to_canonical: string;
    relationship_type: SemanticRelationshipType;
    /** 0–1 confidence weight */
    strength: number;
    evidence_url: string;
}

export interface RelationshipWriteResult {
    written: number;
    skipped: number;
    scan_id: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Resolve or create an entity record by canonical name.
 * Returns entity UUID. Uses lowercase match to prevent duplicates.
 */
async function resolveEntityId(canonical_name: string): Promise<string | null> {
    const pool = getPool();
    const name = canonical_name.trim().slice(0, 250);
    if (!name) return null;

    try {
        // Try to find existing entity
        const existing = await pool.query(
            `SELECT id FROM entities WHERE LOWER(canonical_name) = LOWER($1) LIMIT 1`,
            [name],
        );
        if (existing.rows.length > 0) return existing.rows[0].id as string;

        // Insert new entity node
        const inserted = await pool.query(
            `INSERT INTO entities (canonical_name, type)
             VALUES ($1, 'concept')
             ON CONFLICT DO NOTHING
             RETURNING id`,
            [name],
        );
        if (inserted.rows.length > 0) return inserted.rows[0].id as string;

        // Race: another concurrent insert won — fetch the winner
        const fallback = await pool.query(
            `SELECT id FROM entities WHERE LOWER(canonical_name) = LOWER($1) LIMIT 1`,
            [name],
        );
        return fallback.rows[0]?.id ?? null;
    } catch {
        return null;
    }
}

/**
 * Emit a single RSS event for a new relationship discovery.
 * Fire-and-forget — errors are swallowed to avoid blocking the write path.
 */
async function emitRelationshipRssEvent(
    from_canonical: string,
    to_canonical: string,
    type: SemanticRelationshipType,
    scan_id: string | null,
): Promise<void> {
    try {
        const pool = getPool();
        const title = `New relationship discovered: "${from_canonical}" ${type.replace(/_/g, ' ')} "${to_canonical}"`;
        const description = `Graph edge added: ${from_canonical} → [${type}] → ${to_canonical}`;
        await pool.query(
            `INSERT INTO rss_events (event_type, title, description, entity, scan_id)
             VALUES ('graph_updated', $1, $2, $3, $4)`,
            [title, description, from_canonical, scan_id],
        );
    } catch {
        // swallow — RSS is supplementary
    }
}

// ── Core write function ───────────────────────────────────────────────────────

/**
 * Persist a batch of semantic relationship edges.
 * Upserts on (from_entity_id, to_entity_id, relationship_type) —
 * re-running a scan updates the strength but does not duplicate rows.
 */
export async function writeRelationshipEdges(
    edges: RelationshipEdge[],
    scan_id: string | null,
): Promise<RelationshipWriteResult> {
    if (!edges.length) return { written: 0, skipped: 0, scan_id };

    const pool = getPool();
    let written = 0;
    let skipped = 0;

    for (const edge of edges) {
        const fromId = await resolveEntityId(edge.from_canonical);
        const toId = await resolveEntityId(edge.to_canonical);

        if (!fromId || !toId || fromId === toId) {
            skipped++;
            continue;
        }

        const strength = Math.max(0, Math.min(1, edge.strength));

        try {
            const result = await pool.query(
                `INSERT INTO entity_relationships
                    (from_entity_id, to_entity_id, relationship_type, strength, evidence_url, scan_id)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (from_entity_id, to_entity_id, relationship_type)
                 DO UPDATE SET
                     strength     = GREATEST(entity_relationships.strength, EXCLUDED.strength),
                     evidence_url = EXCLUDED.evidence_url,
                     scan_id      = EXCLUDED.scan_id,
                     updated_at   = NOW()
                 RETURNING id`,
                [fromId, toId, edge.relationship_type, strength, edge.evidence_url ?? null, scan_id],
            );

            if (result.rows.length > 0) {
                written++;
                // Emit RSS event for new relationships (graph_updated)
                void emitRelationshipRssEvent(
                    edge.from_canonical,
                    edge.to_canonical,
                    edge.relationship_type,
                    scan_id,
                );
            }
        } catch {
            skipped++;
        }
    }

    return { written, skipped, scan_id };
}

// ── Inference helpers ─────────────────────────────────────────────────────────

/**
 * Infer relationship edges from competitor names extracted by the
 * citation tester. Competitors are always typed as `competes_with`.
 */
export function inferCompetitorEdges(
    primaryEntity: string,
    competitors: string[],
    evidence_url: string,
): RelationshipEdge[] {
    return competitors
        .filter((c) => c && c.trim() && c.trim().toLowerCase() !== primaryEntity.toLowerCase())
        .map((competitor) => ({
            from_canonical: primaryEntity.trim(),
            to_canonical: competitor.trim(),
            relationship_type: 'competes_with' as SemanticRelationshipType,
            strength: 0.8,
            evidence_url,
        }));
}

/**
 * Infer `explains` edges from query topics that the entity's content
 * addresses. Uses topic-entity co-occurrence from the gap detection output.
 */
export function inferExplainsEdges(
    primaryEntity: string,
    topics: string[],
    evidence_url: string,
): RelationshipEdge[] {
    return topics
        .filter((t) => t && t.trim().length >= 4)
        .slice(0, 20)
        .map((topic) => ({
            from_canonical: primaryEntity.trim(),
            to_canonical: topic.trim(),
            relationship_type: 'explains' as SemanticRelationshipType,
            strength: 0.6,
            evidence_url,
        }));
}

/**
 * Infer `fails_at` edges from detected visibility gaps.
 * A gap where the entity is uncited in a query cluster → the entity
 * fails_at that query topic (useful for content targeting).
 */
export function inferFailsAtEdges(
    primaryEntity: string,
    failureTopics: string[],
    evidence_url: string,
): RelationshipEdge[] {
    return failureTopics
        .filter((t) => t && t.trim().length >= 4)
        .slice(0, 15)
        .map((topic) => ({
            from_canonical: primaryEntity.trim(),
            to_canonical: topic.trim(),
            relationship_type: 'fails_at' as SemanticRelationshipType,
            strength: 0.7,
            evidence_url,
        }));
}

// ── Query functions ───────────────────────────────────────────────────────────

export interface EntityRelationshipRow {
    id: string;
    from_canonical: string;
    to_canonical: string;
    relationship_type: SemanticRelationshipType;
    strength: number;
    evidence_url: string | null;
    scan_id: string | null;
    created_at: string;
}

/**
 * Fetch all outbound relationships for a canonical entity name.
 */
export async function getEntityRelationships(
    canonical_name: string,
    types?: SemanticRelationshipType[],
): Promise<EntityRelationshipRow[]> {
    const pool = getPool();
    try {
        const query = types && types.length
            ? `SELECT er.id, fe.canonical_name AS from_canonical, te.canonical_name AS to_canonical,
                      er.relationship_type, er.strength, er.evidence_url, er.scan_id, er.created_at
               FROM entity_relationships er
               JOIN entities fe ON fe.id = er.from_entity_id
               JOIN entities te ON te.id = er.to_entity_id
               WHERE LOWER(fe.canonical_name) = LOWER($1)
                 AND er.relationship_type = ANY($2::text[])
               ORDER BY er.strength DESC, er.created_at DESC
               LIMIT 200`
            : `SELECT er.id, fe.canonical_name AS from_canonical, te.canonical_name AS to_canonical,
                      er.relationship_type, er.strength, er.evidence_url, er.scan_id, er.created_at
               FROM entity_relationships er
               JOIN entities fe ON fe.id = er.from_entity_id
               JOIN entities te ON te.id = er.to_entity_id
               WHERE LOWER(fe.canonical_name) = LOWER($1)
               ORDER BY er.strength DESC, er.created_at DESC
               LIMIT 200`;

        const params = types && types.length ? [canonical_name, types] : [canonical_name];
        const result = await pool.query(query, params);
        return result.rows as EntityRelationshipRow[];
    } catch {
        return [];
    }
}

/**
 * Fetch relationships for a scan — used for graph export.
 */
export async function getRelationshipsForScan(
    scan_id: string,
): Promise<EntityRelationshipRow[]> {
    const pool = getPool();
    try {
        const result = await pool.query(
            `SELECT er.id, fe.canonical_name AS from_canonical, te.canonical_name AS to_canonical,
                    er.relationship_type, er.strength, er.evidence_url, er.scan_id, er.created_at
             FROM entity_relationships er
             JOIN entities fe ON fe.id = er.from_entity_id
             JOIN entities te ON te.id = er.to_entity_id
             WHERE er.scan_id = $1
             ORDER BY er.strength DESC`,
            [scan_id],
        );
        return result.rows as EntityRelationshipRow[];
    } catch {
        return [];
    }
}
