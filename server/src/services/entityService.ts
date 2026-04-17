/**
 * Entity Service — manages the `entities` table and drift score history.
 *
 * Entities are the hard anchor that binds audits, cite-ledger entries,
 * evidence items, and drift scores to a single canonical identity.
 *
 * Entity ID format: `ent-{domain}` (deterministic, domain-scoped).
 * One entity per (user, domain) pair.
 */

import { getPool } from './postgresql.js';

// ─── Entity resolution ────────────────────────────────────────────────────────

/**
 * Find or create the entity for a given user + domain pair.
 * Returns the entity ID (deterministic from domain).
 */
export async function resolveEntity(
    userId: string,
    domain: string,
    name?: string,
): Promise<string> {
    const pool = getPool();
    const entityId = `ent-${domain.toLowerCase().replace(/^www\./, '')}`;
    const displayName = name || domain;

    await pool.query(
        `INSERT INTO entities (id, name, domain, user_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO NOTHING`,
        [entityId, displayName, domain.toLowerCase(), userId],
    );

    return entityId;
}

/**
 * Get entity by ID.
 */
export async function getEntity(entityId: string) {
    const pool = getPool();
    const { rows } = await pool.query(
        `SELECT id, name, domain, user_id, created_at FROM entities WHERE id = $1`,
        [entityId],
    );
    return rows[0] || null;
}

/**
 * Get all entities for a user.
 */
export async function getUserEntities(userId: string) {
    const pool = getPool();
    const { rows } = await pool.query(
        `SELECT id, name, domain, created_at FROM entities WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId],
    );
    return rows;
}

// ─── Drift score tracking ─────────────────────────────────────────────────────

/**
 * Record a drift score snapshot after an audit completes.
 * This creates a time-series of evidence-derived scores per entity.
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
