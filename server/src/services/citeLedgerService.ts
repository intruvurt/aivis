/**
 * Cite Ledger Service — Express-equivalent of the Cloudflare Worker queue pipeline.
 *
 * Architecture mapping:
 *   CF Worker fetch()   → enqueueJob()      (job_queue_log INSERT)
 *   CF Worker queue()   → processJob()      (evidence extraction + cite ledger write)
 *   CF EVIDENCE_QUEUE   → job_queue_log     (PostgreSQL-backed queue)
 *   CF BROWSER binding  → existing scraper  (Puppeteer)
 *
 * Key invariants (from Worker spec):
 *   1. No score without evidence (hard guard)
 *   2. Entity anchor on every write (no entity drift)
 *   3. Job tracking for every pipeline run
 *   4. Deterministic evidence IDs at extraction time
 */

import { createHash } from 'crypto';
import { getPool } from './postgresql.js';
import { resolveEntity, recordDriftScore } from './entityService.js';
import type { AuditEvidenceEntry } from '../../../shared/types.js';
import type { PoolClient } from 'pg';

// ─── Job queue operations (Express equivalent of CF Queue) ────────────────────

type JobStatus = 'queued' | 'processing' | 'completed' | 'failed';

/**
 * Enqueue a new audit job. Returns the job ID.
 * Express equivalent of `env.EVIDENCE_QUEUE.send()`.
 */
export async function enqueueJob(
  url: string,
  entityId: string | null,
): Promise<string> {
  const pool = getPool();
  const { rows } = await pool.query(
    `INSERT INTO job_queue_log (url, entity_id, status)
     VALUES ($1, $2, 'queued')
     RETURNING id`,
    [url, entityId],
  );
  return rows[0].id;
}

/**
 * Transition job status. Used by the pipeline to track progress.
 */
export async function updateJobStatus(
  jobId: string,
  status: JobStatus,
  errorMessage?: string,
): Promise<void> {
  const pool = getPool();
  const completedAt = status === 'completed' || status === 'failed'
    ? new Date().toISOString()
    : null;

  await pool.query(
    `UPDATE job_queue_log
     SET status = $1, error_message = $2, completed_at = $3
     WHERE id = $4`,
    [status, errorMessage || null, completedAt, jobId],
  );
}

/**
 * Get recent jobs for an entity (newest first).
 */
export async function getEntityJobs(entityId: string, limit = 20) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id, url, status, error_message, created_at, completed_at
     FROM job_queue_log
     WHERE entity_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [entityId, limit],
  );
  return rows;
}

// ─── Cite Ledger queries ──────────────────────────────────────────────────────

/**
 * Get cite ledger entries for a specific audit run.
 * Each entry has a cryptographic chain hash linking it to the previous.
 */
export async function getCiteLedgerForRun(auditRunId: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id, sequence, brag_id, content_hash, previous_hash,
            chain_hash, entity_id, evidence_id, created_at
     FROM cite_ledger
     WHERE audit_run_id = $1
     ORDER BY sequence ASC`,
    [auditRunId],
  );
  return rows;
}

/**
 * Get cite ledger summary for an entity across all runs.
 */
export async function getEntityCiteLedgerSummary(entityId: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT cl.audit_run_id, COUNT(*)::int AS entry_count,
            MIN(cl.created_at) AS first_entry, MAX(cl.created_at) AS last_entry
     FROM cite_ledger cl
     WHERE cl.entity_id = $1
     GROUP BY cl.audit_run_id
     ORDER BY MAX(cl.created_at) DESC
     LIMIT 50`,
    [entityId],
  );
  return rows;
}

// ─── Entity-anchored cite ledger write ────────────────────────────────────────

/**
 * Stamp entity_id onto cite_ledger entries for a given audit run.
 * Called after entity resolution, after persistCiteLedger has written the rows.
 */
export async function anchorCiteLedgerToEntity(
  auditRunId: string,
  entityId: string,
): Promise<void> {
  const pool = getPool();
  await pool.query(
    `UPDATE cite_ledger SET entity_id = $1 WHERE audit_run_id = $2 AND entity_id IS NULL`,
    [entityId, auditRunId],
  );
}

/**
 * Stamp entity_id onto audit_evidence entries for a given audit run.
 */
export async function anchorEvidenceToEntity(
  auditRunId: string,
  entityId: string,
): Promise<void> {
  const pool = getPool();
  await pool.query(
    `UPDATE audit_evidence SET entity_id = $1 WHERE audit_run_id = $2 AND entity_id IS NULL`,
    [entityId, auditRunId],
  );
}

// ─── Full pipeline orchestration ──────────────────────────────────────────────

/**
 * Run the cite-ledger pipeline for an audit:
 *   1. Resolve entity (find or create)
 *   2. Anchor cite ledger + evidence to entity
 *   3. Record drift score (and detect if score dropped >10 points)
 *
 * This is fire-and-forget — errors are logged, not thrown.
 * Note: job_queue_log is observability-only (no background consumer).
 */
export async function runCiteLedgerPipeline(opts: {
  userId: string;
  domain: string;
  url: string;
  auditRunId: string;
  score: number;
  evidenceCount: number;
  scoreSource: string;
  brandName?: string;
}): Promise<void> {
  try {
    // 1. Resolve entity
    const entityId = await resolveEntity(
      opts.userId,
      opts.domain,
      opts.brandName,
    );

    // 2. Anchor existing cite_ledger + evidence rows to this entity
    await anchorCiteLedgerToEntity(opts.auditRunId, entityId);
    await anchorEvidenceToEntity(opts.auditRunId, entityId);

    // 3. Record drift score snapshot and detect drift
    const driftDelta = await recordDriftScore(
      entityId,
      opts.score,
      opts.evidenceCount,
      opts.scoreSource,
    );

    // Log drift warning if score dropped significantly
    if (driftDelta !== null && driftDelta < -10) {
      console.warn(
        `[cite-ledger] Drift warning: entity=${entityId}, score dropped ${Math.abs(driftDelta).toFixed(1)} points (audit=${opts.auditRunId})`,
      );
    }

    console.log(
      `[cite-ledger] Pipeline complete: entity=${entityId}, audit=${opts.auditRunId}, score=${opts.score}, drift=${driftDelta !== null ? driftDelta.toFixed(1) : 'N/A'}`,
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[cite-ledger] Pipeline error: audit=${opts.auditRunId}, ${msg}`);
  }
}

// ─── Evidence-only score derivation (matches Worker spec) ─────────────────────

/**
 * Compute score strictly from evidence count.
 * If evidenceCount <= 0, score is always 0 (hard guard).
 */
export function computeEvidenceScore(evidenceCount: number): number {
  if (evidenceCount <= 0) return 0;
  return Math.min(100, evidenceCount * 5);
}

// ─── Deterministic evidence hash (matches Worker cryptoId) ────────────────────

/**
 * Generate a deterministic cite-ledger evidence ID.
 * Uses SHA-256 for collision resistance (Worker spec used djb2 — we upgrade).
 */
export function citeLedgerHash(input: string): string {
  return 'ev_' + createHash('sha256').update(input).digest('hex').slice(0, 12);
}

// ─── Audit Evidence Entry write (Truth Contract) ──────────────────────────────

/**
 * Create an AuditEvidenceEntry row in the audit_evidence_entries table.
 *
 * This is the canonical write path for all engine outputs. Nothing may influence
 * a score or response unless it first passes through this function.
 *
 * Chain integrity:
 *   raw_evidence_hash = SHA-256(raw_evidence)
 *   ledger_hash = SHA-256(previous_ledger_hash + raw_evidence_hash)
 *
 * Pass a pg PoolClient to participate in an outer transaction, or pass null
 * to use the pool directly (auto-commit).
 */
export async function createAuditEvidenceEntry(
  client: PoolClient | null,
  input: Omit<AuditEvidenceEntry, 'id' | 'raw_evidence_hash' | 'ledger_hash' | 'created_at' | 'updated_at'>,
): Promise<AuditEvidenceEntry> {
  const pool = getPool();
  const db = client ?? pool;

  // Derive hashes deterministically
  const raw_evidence_hash = createHash('sha256').update(input.raw_evidence).digest('hex');

  // Get previous ledger hash for this audit (for chain integrity)
  const prevRow = await (client ? client : pool).query(
    `SELECT ledger_hash FROM audit_evidence_entries
     WHERE audit_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [input.audit_id],
  );
  const previousHash: string = prevRow.rows[0]?.ledger_hash ?? '0'.repeat(64);
  const ledger_hash = createHash('sha256').update(previousHash + raw_evidence_hash).digest('hex');

  const { rows } = await db.query(
    `INSERT INTO audit_evidence_entries (
      url, audit_id, source_type, source_metadata,
      raw_evidence, raw_evidence_hash,
      extracted_signal, confidence_score, confidence_basis,
      interpretation, entity_refs,
      related_findings, tags, ledger_hash
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
    RETURNING *`,
    [
      input.url,
      input.audit_id,
      input.source_type,
      JSON.stringify(input.source_metadata),
      input.raw_evidence,
      raw_evidence_hash,
      input.extracted_signal,
      input.confidence_score,
      input.confidence_basis,
      input.interpretation,
      JSON.stringify(input.entity_refs),
      JSON.stringify(input.related_findings ?? []),
      JSON.stringify(input.tags),
      ledger_hash,
    ],
  );

  const row = rows[0];
  return {
    id: row.id,
    url: row.url,
    audit_id: row.audit_id,
    source_type: row.source_type,
    source_metadata: typeof row.source_metadata === 'string' ? JSON.parse(row.source_metadata) : row.source_metadata,
    raw_evidence: row.raw_evidence,
    raw_evidence_hash: row.raw_evidence_hash,
    extracted_signal: row.extracted_signal,
    confidence_score: Number(row.confidence_score),
    confidence_basis: row.confidence_basis,
    interpretation: row.interpretation,
    entity_refs: typeof row.entity_refs === 'string' ? JSON.parse(row.entity_refs) : (row.entity_refs ?? []),
    related_findings: typeof row.related_findings === 'string' ? JSON.parse(row.related_findings) : (row.related_findings ?? []),
    tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : (row.tags ?? []),
    ledger_hash: row.ledger_hash,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  } satisfies AuditEvidenceEntry;
}

/**
 * Retrieve all AuditEvidenceEntry rows for a given audit, ordered by chain sequence.
 */
export async function getAuditEvidenceEntries(auditId: string): Promise<AuditEvidenceEntry[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT * FROM audit_evidence_entries WHERE audit_id = $1 ORDER BY created_at ASC`,
    [auditId],
  );
  return rows.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    url: row.url as string,
    audit_id: row.audit_id as string,
    source_type: row.source_type as AuditEvidenceEntry['source_type'],
    source_metadata: typeof row.source_metadata === 'string' ? JSON.parse(row.source_metadata as string) : (row.source_metadata as Record<string, unknown>),
    raw_evidence: row.raw_evidence as string,
    raw_evidence_hash: row.raw_evidence_hash as string,
    extracted_signal: row.extracted_signal as string,
    confidence_score: Number(row.confidence_score),
    confidence_basis: row.confidence_basis as string,
    interpretation: row.interpretation as string,
    entity_refs: typeof row.entity_refs === 'string' ? JSON.parse(row.entity_refs as string) : ((row.entity_refs as Array<{ name: string; type: string }>) ?? []),
    related_findings: typeof row.related_findings === 'string' ? JSON.parse(row.related_findings as string) : ((row.related_findings as string[]) ?? []),
    tags: typeof row.tags === 'string' ? JSON.parse(row.tags as string) : ((row.tags as string[]) ?? []),
    ledger_hash: row.ledger_hash as string,
    created_at: row.created_at instanceof Date ? (row.created_at as Date).toISOString() : row.created_at as string,
    updated_at: row.updated_at instanceof Date ? (row.updated_at as Date).toISOString() : row.updated_at as string,
  }));
}
