/**
 * Entity Service — manages the `entities` table and drift score history.
 *
 * Entities are the hard anchor that binds audits, cite-ledger entries,
 * evidence items, and drift scores to a single canonical identity.
 *
 * Entity ID format: `ent-{domain}` (deterministic, domain-scoped).
 * One entity per (user, domain) pair.
 *
 * Entity OS Core: The entities table is extended with vector embeddings,
 * collision/clarity/authority scores, and linked to entity_variants,
 * entity_evidence, and entity_collisions tables.
 */

import { getPool } from './postgresql.js';

// ─── Entity OS Core types ─────────────────────────────────────────────────────

export type EntityType = 'saas' | 'tool' | 'protocol' | 'concept' | 'brand' | 'person' | 'organization';
export type CollisionType = 'name' | 'semantic' | 'category';
export type EvidenceType = 'reddit' | 'html' | 'schema' | 'directory' | 'llm' | 'citation' | 'serp' | 'mention';

export interface VectorPoint {
    id: string;
    entity_id: string;
    type: 'entity' | 'variant' | 'evidence';
    embedding: number[];
    weight: number;
    similarity: number;
    metadata: Record<string, unknown>;
}

export interface EntityOsRecord {
    id: string;
    name: string;
    canonical_name: string | null;
    normalized_name: string | null;
    domain: string | null;
    description: string | null;
    entity_type: EntityType | null;
    collision_score: number;
    clarity_score: number;
    authority_score: number;
    status: string;
    created_at: string;
    updated_at: string | null;
}

// ─── Entity resolution ────────────────────────────────────────────────────────

/**
 * Find or create the entity for a given user + domain pair.
 * Returns the entity ID (deterministic from domain).
 * Populates Entity OS Core columns (canonical_name, normalized_name, status) on creation.
 */
export async function resolveEntity(
    userId: string,
    domain: string,
    name?: string,
): Promise<string> {
    const pool = getPool();
    const normalizedDomain = domain.toLowerCase().replace(/^www\./, '');
    const entityId = `ent-${normalizedDomain}`;
    const displayName = name || normalizedDomain;

    await pool.query(
        `INSERT INTO entities (id, name, canonical_name, normalized_name, domain, user_id, status, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'active', NOW())
         ON CONFLICT (id) DO UPDATE SET
           updated_at = NOW(),
           canonical_name = COALESCE(entities.canonical_name, EXCLUDED.canonical_name),
           normalized_name = COALESCE(entities.normalized_name, EXCLUDED.normalized_name)`,
        [entityId, displayName, displayName, normalizedDomain, normalizedDomain, userId],
    );

    return entityId;
}

/**
 * Get entity by ID (includes all Entity OS Core columns).
 */
export async function getEntity(entityId: string): Promise<EntityOsRecord | null> {
    const pool = getPool();
    const { rows } = await pool.query(
        `SELECT id, name, canonical_name, normalized_name, domain, description,
                entity_type, collision_score, clarity_score, authority_score,
                status, user_id, created_at, updated_at
         FROM entities WHERE id = $1`,
        [entityId],
    );
    return rows[0] || null;
}

/**
 * Get all entities for a user (newest first).
 */
export async function getUserEntities(userId: string): Promise<EntityOsRecord[]> {
    const pool = getPool();
    const { rows } = await pool.query(
        `SELECT id, name, canonical_name, normalized_name, domain, description,
                entity_type, collision_score, clarity_score, authority_score,
                status, created_at, updated_at
         FROM entities WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId],
    );
    return rows;
}

// ─── Drift score tracking ─────────────────────────────────────────────────────

/**
 * Record a drift score snapshot after an audit completes.
 */
export async function recordDriftScore(
    entityId: string,
    score: number,
    evidenceCount: number,
    scoreSource: string,
): Promise<void> {
    const pool = getPool();
    await pool.query(
        `INSERT INTO drift_scores (entity_id, score, evidence_count, score_source)
         VALUES ($1, $2, $3, $4)`,
        [entityId, Math.round(score), evidenceCount, scoreSource],
    );
}

/**
 * Get drift score history for an entity (newest first).
 */
export async function getDriftHistory(entityId: string, limit = 50) {
    const pool = getPool();
    const { rows } = await pool.query(
        `SELECT id, score, evidence_count, score_source, computed_at
         FROM drift_scores
         WHERE entity_id = $1
         ORDER BY computed_at DESC
         LIMIT $2`,
        [entityId, limit],
    );
    return rows;
}

/**
 * Get latest drift score for an entity (or null).
 */
export async function getLatestDriftScore(entityId: string) {
    const pool = getPool();
    const { rows } = await pool.query(
        `SELECT score, evidence_count, score_source, computed_at
         FROM drift_scores
         WHERE entity_id = $1
         ORDER BY computed_at DESC
         LIMIT 1`,
        [entityId],
    );
    return rows[0] || null;
}

// ─── Entity OS Core: audit linkage ───────────────────────────────────────────

/**
 * Bind an audit record to the Entity OS identity layer by setting entity_id.
 */
export async function linkAuditToEntity(auditId: string, entityId: string): Promise<void> {
    const pool = getPool();
    await pool.query(
        `UPDATE audits SET entity_id = $1 WHERE id = $2`,
        [entityId, auditId],
    );
}

// ─── Entity OS Core: score updates ───────────────────────────────────────────

/**
 * Write computed collision/clarity/authority scores back to an entity.
 * Called from the audit pipeline or a background scoring job.
 */
export async function updateEntityScores(
    entityId: string,
    scores: { collision_score?: number; clarity_score?: number; authority_score?: number },
): Promise<void> {
    const pool = getPool();
    const sets: string[] = ['updated_at = NOW()'];
    const values: (string | number)[] = [entityId];
    let idx = 2;

    if (scores.collision_score !== undefined) { sets.push(`collision_score = $${idx++}`); values.push(scores.collision_score); }
    if (scores.clarity_score !== undefined) { sets.push(`clarity_score = $${idx++}`); values.push(scores.clarity_score); }
    if (scores.authority_score !== undefined) { sets.push(`authority_score = $${idx++}`); values.push(scores.authority_score); }

    if (sets.length === 1) return;
    await pool.query(`UPDATE entities SET ${sets.join(', ')} WHERE id = $1`, values);
}

/**
 * Update entity_type and description.
 */
export async function updateEntityMeta(
    entityId: string,
    meta: { entity_type?: EntityType; description?: string },
): Promise<void> {
    const pool = getPool();
    await pool.query(
        `UPDATE entities SET
           entity_type = COALESCE($2, entity_type),
           description = COALESCE($3, description),
           updated_at = NOW()
         WHERE id = $1`,
        [entityId, meta.entity_type ?? null, meta.description ?? null],
    );
}

// ─── Entity OS Core: variants ────────────────────────────────────────────────

/**
 * Record a surface-name variant for an entity.
 * Captures name collisions and aliasing across different sources.
 * Silently skips duplicates.
 */
export async function upsertEntityVariant(
    entityId: string,
    variant: {
        surface_name: string;
        source_url?: string;
        context_snippet?: string;
        confidence?: number;
        is_conflict?: boolean;
        embedding?: number[];
    },
): Promise<string> {
    const pool = getPool();
    const { rows } = await pool.query(
        `INSERT INTO entity_variants
           (entity_id, surface_name, source_url, context_snippet, confidence, is_conflict, embedding)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [
            entityId,
            variant.surface_name,
            variant.source_url ?? null,
            variant.context_snippet ?? null,
            variant.confidence ?? 0,
            variant.is_conflict ?? false,
            variant.embedding ? JSON.stringify(variant.embedding) : null,
        ],
    );
    return rows[0]?.id ?? '';
}

/**
 * Get all surface-name variants for an entity.
 */
export async function getEntityVariants(entityId: string) {
    const pool = getPool();
    const { rows } = await pool.query(
        `SELECT id, surface_name, source_url, context_snippet, confidence, is_conflict, created_at
         FROM entity_variants WHERE entity_id = $1 ORDER BY confidence DESC`,
        [entityId],
    );
    return rows;
}

// ─── Entity OS Core: evidence ────────────────────────────────────────────────

/**
 * Upsert a CITE-backbone evidence record for an entity.
 * `hash` is the deduplication key — duplicate hashes are silently skipped.
 */
export async function upsertEntityEvidence(
    entityId: string,
    evidence: {
        evidence_type: EvidenceType;
        source: string;
        snippet?: string;
        hash: string;
        weight?: number;
        embedding?: number[];
    },
): Promise<string> {
    const pool = getPool();
    const { rows } = await pool.query(
        `INSERT INTO entity_evidence
           (entity_id, evidence_type, source, snippet, hash, weight, embedding)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (hash) DO NOTHING
         RETURNING id`,
        [
            entityId,
            evidence.evidence_type,
            evidence.source,
            evidence.snippet ?? null,
            evidence.hash,
            evidence.weight ?? 1.0,
            evidence.embedding ? JSON.stringify(evidence.embedding) : null,
        ],
    );
    return rows[0]?.id ?? '';
}

/**
 * Get all evidence for an entity (newest first).
 */
export async function getEntityEvidence(entityId: string, limit = 50) {
    const pool = getPool();
    const { rows } = await pool.query(
        `SELECT id, evidence_type, source, snippet, hash, weight, created_at
         FROM entity_evidence WHERE entity_id = $1 ORDER BY created_at DESC LIMIT $2`,
        [entityId, limit],
    );
    return rows;
}

// ─── Entity OS Core: collision graph ─────────────────────────────────────────

/**
 * Record or update a collision between two entities.
 * Pairs are stored in canonical order (LEAST/GREATEST) to prevent duplicate rows.
 */
export async function upsertEntityCollision(
    entityA: string,
    entityB: string,
    collision: {
        collision_type: CollisionType;
        severity: number;
        shared_signals?: Record<string, unknown>;
    },
): Promise<string> {
    const pool = getPool();
    const [a, b] = [entityA, entityB].sort();
    const { rows } = await pool.query(
        `INSERT INTO entity_collisions
           (entity_a, entity_b, collision_type, severity, shared_signals)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (LEAST(entity_a, entity_b), GREATEST(entity_a, entity_b), collision_type)
         DO UPDATE SET
           severity = EXCLUDED.severity,
           shared_signals = EXCLUDED.shared_signals
         RETURNING id`,
        [a, b, collision.collision_type, collision.severity, JSON.stringify(collision.shared_signals ?? {})],
    );
    return rows[0]?.id ?? '';
}

/**
 * Dismiss a resolved collision record.
 */
export async function resolveEntityCollision(collisionId: string): Promise<void> {
    const pool = getPool();
    await pool.query(
        `UPDATE entity_collisions SET resolved = TRUE WHERE id = $1`,
        [collisionId],
    );
}

/**
 * Get all unresolved collisions for an entity (highest severity first).
 */
export async function getEntityCollisions(entityId: string) {
    const pool = getPool();
    const { rows } = await pool.query(
        `SELECT id, entity_a, entity_b, collision_type, severity, shared_signals, created_at
         FROM entity_collisions
         WHERE (entity_a = $1 OR entity_b = $1) AND resolved = FALSE
         ORDER BY severity DESC`,
        [entityId],
    );
    return rows;
}

// ─── Entity OS Core: vector similarity search ────────────────────────────────

/**
 * Find the closest entities by cosine similarity on embedding vector.
 * Requires pgvector; returns empty array if the extension is unavailable.
 */
export async function findSimilarEntities(
    embedding: number[],
    limit = 10,
): Promise<Array<{ id: string; name: string; domain: string | null; similarity: number }>> {
    const pool = getPool();
    try {
        const { rows } = await pool.query(
            `SELECT id, name, domain,
                    1 - (embedding <=> $1::vector) AS similarity
             FROM entities
             WHERE embedding IS NOT NULL
             ORDER BY embedding <=> $1::vector
             LIMIT $2`,
            [JSON.stringify(embedding), limit],
        );
        return rows;
    } catch {
        return [];
    }
}

/**
 * Find similar evidence records by vector cosine distance.
 * Returns empty array if pgvector is unavailable.
 */
export async function findSimilarEvidence(
    embedding: number[],
    limit = 10,
): Promise<Array<{ id: string; entity_id: string; source: string; snippet: string | null; similarity: number }>> {
    const pool = getPool();
    try {
        const { rows } = await pool.query(
            `SELECT id, entity_id, source, snippet,
                    1 - (embedding <=> $1::vector) AS similarity
             FROM entity_evidence
             WHERE embedding IS NOT NULL
             ORDER BY embedding <=> $1::vector
             LIMIT $2`,
            [JSON.stringify(embedding), limit],
        );
        return rows;
    } catch {
        return [];
    }
}

// ─── Entity OS Core: conflict + audit helpers ───────────────────────────────

function normalizeLooseEntityName(input: string): string {
    return String(input || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 160);
}

/**
 * Search for likely conflicting entities by normalized name/domain similarity.
 * This is the lexical fallback when vector embeddings are not yet populated.
 */
export async function searchPotentialEntityConflicts(args: {
    name: string;
    domain?: string | null;
    excludeEntityId?: string | null;
    limit?: number;
}): Promise<Array<{ id: string; name: string; domain: string | null; collision_type: CollisionType; severity: number }>> {
    const pool = getPool();
    const normalizedName = normalizeLooseEntityName(args.name);
    const normalizedDomain = String(args.domain || '').toLowerCase().replace(/^www\./, '');
    const limit = Math.min(Math.max(Number(args.limit || 5), 1), 20);

    const { rows } = await pool.query(
        `SELECT id, name, domain,
                CASE
                  WHEN domain = $2 AND $2 <> '' THEN 'name'
                  WHEN normalized_name = $1 AND $1 <> '' THEN 'semantic'
                  WHEN normalized_name LIKE ($1 || '%') OR $1 LIKE (normalized_name || '%') THEN 'category'
                  ELSE 'name'
                END AS collision_type,
                CASE
                  WHEN domain = $2 AND $2 <> '' THEN 0.95
                  WHEN normalized_name = $1 AND $1 <> '' THEN 0.85
                  WHEN normalized_name LIKE ($1 || '%') OR $1 LIKE (normalized_name || '%') THEN 0.6
                  ELSE 0.35
                END AS severity
         FROM entities
         WHERE ($3::text IS NULL OR id <> $3)
           AND (
             (domain = $2 AND $2 <> '') OR
             (normalized_name = $1 AND $1 <> '') OR
             (normalized_name LIKE ($1 || '%') AND $1 <> '') OR
             ($1 LIKE (normalized_name || '%') AND normalized_name IS NOT NULL)
           )
         ORDER BY severity DESC, updated_at DESC NULLS LAST, created_at DESC
         LIMIT $4`,
        [normalizedName, normalizedDomain, args.excludeEntityId ?? null, limit],
    );

    return rows;
}

/**
 * Get the latest audit linked to an entity.
 */
export async function getLatestEntityAudit(entityId: string): Promise<Record<string, unknown> | null> {
    const pool = getPool();
    const { rows } = await pool.query(
        `SELECT id, url, visibility_score, result, created_at, tier_at_analysis
         FROM audits
         WHERE entity_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [entityId],
    );
    return rows[0] || null;
}

/**
 * Get recent audits linked to an entity.
 */
export async function listEntityAudits(entityId: string, limit = 10): Promise<Array<Record<string, unknown>>> {
    const pool = getPool();
    const boundedLimit = Math.min(Math.max(limit, 1), 50);
    const { rows } = await pool.query(
        `SELECT id, url, visibility_score, result, created_at, tier_at_analysis
         FROM audits
         WHERE entity_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [entityId, boundedLimit],
    );
    return rows;
}

// ─── Entity OS Core: embedding write operations ─────────────────────────────

export async function setEntityEmbedding(entityId: string, embedding: number[]): Promise<void> {
    const pool = getPool();
    await pool.query(
        `UPDATE entities SET embedding = $2::vector, updated_at = NOW() WHERE id = $1`,
        [entityId, JSON.stringify(embedding)],
    );
}

export async function setEntityVariantEmbedding(variantId: string, embedding: number[]): Promise<void> {
    const pool = getPool();
    await pool.query(
        `UPDATE entity_variants SET embedding = $2::vector WHERE id = $1`,
        [variantId, JSON.stringify(embedding)],
    );
}

export async function setEntityEvidenceEmbedding(evidenceId: string, embedding: number[]): Promise<void> {
    const pool = getPool();
    await pool.query(
        `UPDATE entity_evidence SET embedding = $2::vector WHERE id = $1`,
        [evidenceId, JSON.stringify(embedding)],
    );
}

function parsePgVector(vectorText: string | null | undefined): number[] {
    const raw = String(vectorText || '').trim();
    if (!raw) return [];

    const normalized = raw
        .replace(/^\[/, '')
        .replace(/\]$/, '')
        .trim();
    if (!normalized) return [];

    return normalized
        .split(',')
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isFinite(value));
}

/**
 * Unified retrieval surface for entity + variant + evidence vectors.
 */
export async function searchUnifiedVectorSurface(
    embedding: number[],
    options?: {
        limitEntities?: number;
        limitVariants?: number;
        limitEvidence?: number;
        minSimilarity?: number;
    },
): Promise<VectorPoint[]> {
    const pool = getPool();
    const limitEntities = Math.max(1, Math.min(Number(options?.limitEntities ?? 50), 250));
    const limitVariants = Math.max(1, Math.min(Number(options?.limitVariants ?? 100), 400));
    const limitEvidence = Math.max(1, Math.min(Number(options?.limitEvidence ?? 100), 400));
    const minSimilarity = Math.max(0, Math.min(Number(options?.minSimilarity ?? 0), 1));

    try {
        const [entities, variants, evidence] = await Promise.all([
            pool.query(
                `SELECT id, id AS entity_id, 'entity' AS point_type,
                        embedding::text AS embedding_text,
                        1 - (embedding <=> $1::vector) AS similarity,
                        1.0::float8 AS weight,
                        jsonb_build_object(
                          'name', name,
                          'domain', domain,
                          'entity_type', entity_type,
                          'status', status
                        ) AS metadata
                 FROM entities
                 WHERE embedding IS NOT NULL
                 ORDER BY embedding <=> $1::vector
                 LIMIT $2`,
                [JSON.stringify(embedding), limitEntities],
            ),
            pool.query(
                `SELECT id, entity_id, 'variant' AS point_type,
                        embedding::text AS embedding_text,
                        1 - (embedding <=> $1::vector) AS similarity,
                        COALESCE(confidence, 0.6)::float8 AS weight,
                        jsonb_build_object(
                          'surface_name', surface_name,
                          'source_url', source_url,
                          'is_conflict', is_conflict
                        ) AS metadata
                 FROM entity_variants
                 WHERE embedding IS NOT NULL
                 ORDER BY embedding <=> $1::vector
                 LIMIT $2`,
                [JSON.stringify(embedding), limitVariants],
            ),
            pool.query(
                `SELECT id, entity_id, 'evidence' AS point_type,
                        embedding::text AS embedding_text,
                        1 - (embedding <=> $1::vector) AS similarity,
                        COALESCE(weight, 0.7)::float8 AS weight,
                        jsonb_build_object(
                          'evidence_type', evidence_type,
                          'source', source,
                          'snippet', snippet
                        ) AS metadata
                 FROM entity_evidence
                 WHERE embedding IS NOT NULL
                 ORDER BY embedding <=> $1::vector
                 LIMIT $2`,
                [JSON.stringify(embedding), limitEvidence],
            ),
        ]);

        const combined = [...entities.rows, ...variants.rows, ...evidence.rows]
            .map((row: any): VectorPoint => ({
                id: String(row.id),
                entity_id: String(row.entity_id),
                type: row.point_type as 'entity' | 'variant' | 'evidence',
                embedding: parsePgVector(row.embedding_text),
                similarity: Number(row.similarity || 0),
                weight: Number(row.weight || 0),
                metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata : {},
            }))
            .filter((point) => point.embedding.length > 0)
            .filter((point) => point.similarity >= minSimilarity)
            .sort((a, b) => b.similarity - a.similarity);

        return combined;
    } catch {
        return [];
    }
}
