import type { PoolClient } from 'pg';
import { embedText } from './embeddingService.js';
import { getPool, isDatabaseAvailable } from './postgresql.js';
import type { RawDocumentEventPayload } from './deepAnalysisClient.js';

const VECTOR_DIMS = 768;

export interface ProcessedCitationEdge {
    entityId: string;
    chunkId: string;
    docId: string;
    type: 'direct' | 'semantic' | 'paraphrase' | 'ai_summary';
    similarity: number;
    confidence: number;
    sourceAuthority: number;
    engagementScore: number;
    timestamp: number;
}

export interface PersistedCitationResult {
    scanId?: string;
    persistedEntityIds: string[];
    persistedClaimIds: string[];
    touchedClusterIds: string[];
    persistedClaims: number;
    touchedEntities: number;
    touchedClusters: number;
    conflictEdgesCreated: number;
    skippedReason?: string;
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function normalizeVectorDimensions(vector: number[]): number[] {
    const out = new Array<number>(VECTOR_DIMS).fill(0);
    const len = Math.min(VECTOR_DIMS, vector.length);
    for (let i = 0; i < len; i += 1) {
        out[i] = Number.isFinite(vector[i]) ? vector[i] : 0;
    }
    const norm = Math.sqrt(out.reduce((sum, v) => sum + v * v, 0));
    if (norm <= 1e-9) return out;
    return out.map((v) => Number((v / norm).toFixed(6)));
}

function toVectorLiteral(vector: number[]): string {
    return `[${vector.map((v) => Number(v).toFixed(6)).join(',')}]`;
}

function parsePgVector(raw: unknown): number[] | null {
    if (typeof raw !== 'string' || raw.trim().length < 2) return null;
    const inner = raw.trim().replace(/^\[/, '').replace(/\]$/, '');
    if (!inner) return null;
    const values = inner
        .split(',')
        .map((part) => Number(part.trim()))
        .filter((v) => Number.isFinite(v));
    if (values.length === 0) return null;
    return normalizeVectorDimensions(values);
}

function freshnessFromTimestamp(timestampMs: number): number {
    const ageMs = Math.max(0, Date.now() - timestampMs);
    const freshness = Math.exp(-ageMs / (1000 * 60 * 60 * 24 * 30));
    return Number(clamp(freshness, 0, 1).toFixed(6));
}

async function ensureEntity(client: PoolClient, canonicalName: string): Promise<string> {
    const existing = await client.query<{ id: string; embedding_text: string | null }>(
        `SELECT id, embedding::text AS embedding_text
         FROM entities
         WHERE lower(canonical_name) = lower($1)
         ORDER BY created_at ASC
         LIMIT 1`,
        [canonicalName],
    );

    if (existing.rowCount && existing.rows[0]) {
        const row = existing.rows[0];
        const parsed = parsePgVector(row.embedding_text);
        if (!parsed) {
            try {
                const embedded = await embedText(canonicalName);
                const vector = normalizeVectorDimensions(embedded.embedding);
                await client.query(
                    `UPDATE entities SET embedding = $2::vector WHERE id = $1`,
                    [row.id, toVectorLiteral(vector)],
                );
            } catch (err) {
                console.warn('[CitationGraphPersistence] Failed to backfill entity embedding:', (err as Error).message);
            }
        }
        return row.id;
    }

    let vectorLiteral: string | null = null;
    try {
        const embedded = await embedText(canonicalName);
        vectorLiteral = toVectorLiteral(normalizeVectorDimensions(embedded.embedding));
    } catch (err) {
        console.warn('[CitationGraphPersistence] Failed to embed entity, creating without vector:', (err as Error).message);
    }

    const inserted = await client.query<{ id: string }>(
        `INSERT INTO entities (canonical_name, type, embedding)
         VALUES ($1, 'concept', $2::vector)
         RETURNING id`,
        [canonicalName, vectorLiteral],
    );

    return inserted.rows[0].id;
}

async function ensureCluster(client: PoolClient, subjectId: string, predicate: string): Promise<string> {
    const inserted = await client.query<{ id: string }>(
        `INSERT INTO claim_clusters (subject_id, predicate)
         VALUES ($1, $2)
         ON CONFLICT (subject_id, predicate) DO NOTHING
         RETURNING id`,
        [subjectId, predicate],
    );

    if (inserted.rowCount && inserted.rows[0]) {
        return inserted.rows[0].id;
    }

    const existing = await client.query<{ id: string }>(
        `SELECT id FROM claim_clusters WHERE subject_id = $1 AND predicate = $2 LIMIT 1`,
        [subjectId, predicate],
    );

    if (!existing.rowCount || !existing.rows[0]) {
        throw new Error('Unable to resolve claim cluster after upsert');
    }

    return existing.rows[0].id;
}

async function rebuildClusterResolution(client: PoolClient, clusterId: string): Promise<void> {
    await client.query(`DELETE FROM resolutions WHERE cluster_id = $1`, [clusterId]);

    await client.query(
        `WITH cluster_claims AS (
            SELECT
                COALESCE(c.object_value, 'unknown') AS value,
                COUNT(*)::float AS cnt,
                AVG(COALESCE(c.confidence, 0))::float AS avg_conf,
                AVG(COALESCE(c.domain_authority, 0))::float AS avg_auth
            FROM cluster_members cm
            JOIN claims c ON c.id = cm.claim_id
            WHERE cm.cluster_id = $1
            GROUP BY COALESCE(c.object_value, 'unknown')
        ),
        totals AS (
            SELECT
                COALESCE(SUM(cnt), 0)::float AS total,
                COUNT(*)::int AS variants
            FROM cluster_claims
        )
        INSERT INTO resolutions (cluster_id, value, probability, support, status)
        SELECT
            $1,
            cc.value,
            CASE WHEN t.total <= 0 THEN 0 ELSE cc.cnt / t.total END,
            (cc.cnt * cc.avg_conf * (0.5 + cc.avg_auth / 2.0)),
            CASE
                WHEN t.variants = 1 THEN 'VERIFIED'
                WHEN (cc.cnt / NULLIF(t.total, 0)) >= 0.6 THEN 'DEGRADED'
                ELSE 'CONTRADICTORY'
            END
        FROM cluster_claims cc
        CROSS JOIN totals t`,
        [clusterId],
    );
}

async function createClaimEdgesForBatch(client: PoolClient, claimIds: string[]): Promise<number> {
    if (claimIds.length < 2) return 0;

    const inserted = await client.query<{ count: string }>(
        `WITH selected AS (
            SELECT id, subject_id, predicate, object_value
            FROM claims
            WHERE id = ANY($1::uuid[])
        ),
        pairs AS (
            SELECT
                LEAST(a.id, b.id) AS claim_a,
                GREATEST(a.id, b.id) AS claim_b,
                CASE
                    WHEN a.object_value IS NOT DISTINCT FROM b.object_value THEN 'DUPLICATE'
                    ELSE 'CONFLICTS'
                END AS edge_type,
                CASE
                    WHEN a.object_value IS NOT DISTINCT FROM b.object_value THEN 0.7
                    ELSE 1.0
                END::real AS weight
            FROM selected a
            JOIN selected b
              ON a.subject_id = b.subject_id
             AND a.predicate = b.predicate
             AND a.id < b.id
        )
        INSERT INTO claim_edges (claim_a, claim_b, edge_type, weight)
        SELECT p.claim_a, p.claim_b, p.edge_type, p.weight
        FROM pairs p
        WHERE NOT EXISTS (
            SELECT 1
            FROM claim_edges ce
            WHERE ce.claim_a = p.claim_a
              AND ce.claim_b = p.claim_b
              AND ce.edge_type = p.edge_type
        )
        RETURNING 1`,
        [claimIds],
    );

    return inserted.rowCount || 0;
}

export async function persistRawDocumentEdges(
    event: RawDocumentEventPayload,
    edges: ProcessedCitationEdge[],
): Promise<PersistedCitationResult> {
    if (!isDatabaseAvailable()) {
        return {
            persistedEntityIds: [],
            persistedClaimIds: [],
            touchedClusterIds: [],
            persistedClaims: 0,
            touchedEntities: 0,
            touchedClusters: 0,
            conflictEdgesCreated: 0,
            skippedReason: 'database_unavailable',
        };
    }

    if (!Array.isArray(edges) || edges.length === 0) {
        return {
            persistedEntityIds: [],
            persistedClaimIds: [],
            touchedClusterIds: [],
            persistedClaims: 0,
            touchedEntities: 0,
            touchedClusters: 0,
            conflictEdgesCreated: 0,
            skippedReason: 'no_edges',
        };
    }

    const pool = getPool();
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const scan = await client.query<{ id: string }>(
            `INSERT INTO scans (url, status, execution_class, model_count, triple_check, created_at)
             VALUES ($1, 'complete', 'alignment', 1, FALSE, to_timestamp($2::double precision / 1000.0))
             RETURNING id`,
            [event.url, event.timestamp],
        );
        const scanId = scan.rows[0].id;

        const touchedEntities = new Set<string>();
        const touchedClusters = new Set<string>();
        const claimIds: string[] = [];

        for (const edge of edges) {
            const subjectId = await ensureEntity(client, edge.entityId);
            touchedEntities.add(subjectId);

            const confidence = clamp(Number(edge.confidence || 0), 0, 1);
            const authority = clamp(Number(edge.sourceAuthority || 0), 0, 1);
            const freshness = freshnessFromTimestamp(Number(edge.timestamp || event.timestamp || Date.now()));
            const sourceUrl = event.url;
            const objectValue = `${edge.type}:${event.source}`;
            const objectRaw = `${event.url}#${edge.chunkId}`;

            const insertedClaim = await client.query<{ id: string }>(
                `INSERT INTO claims (
                    scan_id,
                    subject_id,
                    predicate,
                    object_value,
                    object_raw,
                    value_type,
                    confidence,
                    domain_authority,
                    freshness,
                    source_url,
                    created_at
                 )
                 VALUES (
                    $1,
                    $2,
                    'citation_signal',
                    $3,
                    $4,
                    'string',
                    $5,
                    $6,
                    $7,
                    $8,
                    to_timestamp($9::double precision / 1000.0)
                 )
                 RETURNING id`,
                [
                    scanId,
                    subjectId,
                    objectValue,
                    objectRaw,
                    confidence,
                    authority,
                    freshness,
                    sourceUrl,
                    edge.timestamp || event.timestamp,
                ],
            );

            const claimId = insertedClaim.rows[0].id;
            claimIds.push(claimId);

            const clusterId = await ensureCluster(client, subjectId, 'citation_signal');
            touchedClusters.add(clusterId);
            await client.query(
                `INSERT INTO cluster_members (cluster_id, claim_id)
                 VALUES ($1, $2)
                 ON CONFLICT DO NOTHING`,
                [clusterId, claimId],
            );
        }

        const conflictEdgesCreated = await createClaimEdgesForBatch(client, claimIds);

        for (const clusterId of touchedClusters) {
            await rebuildClusterResolution(client, clusterId);
        }

        await client.query('COMMIT');

        return {
            scanId,
            persistedEntityIds: Array.from(touchedEntities),
            persistedClaimIds: claimIds,
            touchedClusterIds: Array.from(touchedClusters),
            persistedClaims: claimIds.length,
            touchedEntities: touchedEntities.size,
            touchedClusters: touchedClusters.size,
            conflictEdgesCreated,
        };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}