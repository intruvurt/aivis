import { getPool, isDatabaseAvailable } from './postgresql.js';

export interface InfluenceSummaryRow {
    entity_id: string;
    canonical_name: string;
    signal_count: number;
    influence_score: number;
    last_seen_at: string | null;
    source_count: number;
}

export interface EntityInfluenceTopology {
    entity_id: string;
    canonical_name: string;
    nodes: Array<{
        id: string;
        node_type: 'entity' | 'claim' | 'source';
        label: string;
        weight: number;
        source_url?: string;
    }>;
    edges: Array<{
        from: string;
        to: string;
        edge_type: 'emits' | 'asserted_in';
        weight: number;
    }>;
    conflict_count: number;
    latest_resolution: Array<{
        value: string;
        probability: number;
        status: 'VERIFIED' | 'DEGRADED' | 'CONTRADICTORY';
    }>;
}

function toSourceNodeId(url: string): string {
    const cleaned = String(url || '').trim().toLowerCase();
    return `source:${cleaned.replace(/[^a-z0-9:/._-]+/g, '_').slice(0, 180)}`;
}

export async function getInfluenceSummary(limit = 20): Promise<InfluenceSummaryRow[]> {
    if (!isDatabaseAvailable()) return [];

    const cappedLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
    const pool = getPool();
    const result = await pool.query<InfluenceSummaryRow>(
        `SELECT
            e.id AS entity_id,
            e.canonical_name,
            COUNT(c.id)::int AS signal_count,
            COALESCE(SUM(COALESCE(c.confidence, 0) * COALESCE(c.domain_authority, 0) * COALESCE(c.freshness, 0)), 0)::float AS influence_score,
            MAX(c.created_at)::text AS last_seen_at,
            COUNT(DISTINCT COALESCE(c.source_url, ''))::int AS source_count
         FROM entities e
         LEFT JOIN claims c ON c.subject_id = e.id
         GROUP BY e.id, e.canonical_name
         HAVING COUNT(c.id) > 0
         ORDER BY influence_score DESC, signal_count DESC
         LIMIT $1`,
        [cappedLimit],
    );

    return result.rows;
}

export async function getEntityInfluenceTopology(entityId: string, limit = 80): Promise<EntityInfluenceTopology | null> {
    if (!isDatabaseAvailable()) return null;

    const cappedLimit = Math.max(1, Math.min(Number(limit) || 80, 250));
    const pool = getPool();

    const entityResult = await pool.query<{ id: string; canonical_name: string }>(
        `SELECT id, canonical_name FROM entities WHERE id = $1 LIMIT 1`,
        [entityId],
    );
    if (!entityResult.rowCount || !entityResult.rows[0]) return null;

    const entity = entityResult.rows[0];
    const claimsResult = await pool.query<{
        id: string;
        object_value: string | null;
        confidence: number | null;
        source_url: string | null;
        created_at: string;
    }>(
        `SELECT id, object_value, confidence, source_url, created_at::text
         FROM claims
         WHERE subject_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [entityId, cappedLimit],
    );

    const conflictResult = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM claim_edges ce
         JOIN claims c ON c.id = ce.claim_a
         WHERE c.subject_id = $1
           AND ce.edge_type = 'CONFLICTS'`,
        [entityId],
    );

    const resolutionResult = await pool.query<{
        value: string;
        probability: number;
        status: 'VERIFIED' | 'DEGRADED' | 'CONTRADICTORY';
    }>(
        `SELECT r.value, r.probability, r.status
         FROM claim_clusters cc
         JOIN resolutions r ON r.cluster_id = cc.id
         WHERE cc.subject_id = $1
           AND cc.predicate = 'citation_signal'
         ORDER BY r.probability DESC, r.created_at DESC
         LIMIT 10`,
        [entityId],
    );

    const entityNodeId = `entity:${entity.id}`;
    const nodes: EntityInfluenceTopology['nodes'] = [
        {
            id: entityNodeId,
            node_type: 'entity',
            label: entity.canonical_name,
            weight: 1,
        },
    ];
    const edges: EntityInfluenceTopology['edges'] = [];
    const sourceNodes = new Set<string>();

    for (const claim of claimsResult.rows) {
        const claimNodeId = `claim:${claim.id}`;
        const sourceNodeId = claim.source_url ? toSourceNodeId(claim.source_url) : '';
        const confidence = Number.isFinite(Number(claim.confidence)) ? Number(claim.confidence) : 0;

        nodes.push({
            id: claimNodeId,
            node_type: 'claim',
            label: claim.object_value || 'citation_signal',
            weight: Number(confidence.toFixed(4)),
            source_url: claim.source_url || undefined,
        });

        edges.push({
            from: entityNodeId,
            to: claimNodeId,
            edge_type: 'emits',
            weight: Number(confidence.toFixed(4)),
        });

        if (sourceNodeId && !sourceNodes.has(sourceNodeId)) {
            sourceNodes.add(sourceNodeId);
            nodes.push({
                id: sourceNodeId,
                node_type: 'source',
                label: claim.source_url || 'source',
                weight: 0.5,
                source_url: claim.source_url || undefined,
            });
        }

        if (sourceNodeId) {
            edges.push({
                from: claimNodeId,
                to: sourceNodeId,
                edge_type: 'asserted_in',
                weight: Number(confidence.toFixed(4)),
            });
        }
    }

    return {
        entity_id: entity.id,
        canonical_name: entity.canonical_name,
        nodes,
        edges,
        conflict_count: Number(conflictResult.rows[0]?.count || 0),
        latest_resolution: resolutionResult.rows.map((row) => ({
            value: row.value,
            probability: Number(Number(row.probability || 0).toFixed(4)),
            status: row.status,
        })),
    };
}