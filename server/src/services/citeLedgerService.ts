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
import type {
  AuditEvidenceEntry,
  EvidenceLedgerClaimType,
  EvidenceLedgerEntry,
  EvidenceLedgerProjection,
  EvidenceRef,
} from '../../../shared/types.js';
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

type AuditProjectionRow = {
  audit_id: string;
  url: string;
  visibility_score: number | null;
  result: unknown;
  scan_id: string | null;
};

type ClaimProjectionRow = {
  id: string;
  canonical_name: string | null;
  subject_id: string | null;
  predicate: string;
  object_value: string | null;
  confidence: number | null;
  domain_authority: number | null;
  source_url: string | null;
  created_at: string;
};

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function roundImpact(value: number): number {
  return Math.round(value * 10) / 10;
}

function normalizeEntityId(name: string): string {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'unknown_entity';
}

function safeParseAuditResult(result: unknown): Record<string, unknown> {
  if (result && typeof result === 'object') return result as Record<string, unknown>;
  if (typeof result !== 'string') return {};
  try {
    const parsed = JSON.parse(result);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function buildEvidenceRef(entry: AuditEvidenceEntry): EvidenceRef {
  const locationParts: string[] = [entry.source_type];
  const heading = typeof entry.source_metadata?.section_heading === 'string'
    ? entry.source_metadata.section_heading
    : null;
  const page = typeof entry.source_metadata?.page === 'string' ? entry.source_metadata.page : null;
  if (heading) locationParts.push(heading);
  if (page) locationParts.push(page);

  return {
    type: entry.source_type === 'ai_provider' ? 'ai_chunk' : 'source_chunk',
    id: entry.id,
    excerpt: String(entry.raw_evidence || entry.extracted_signal || '').slice(0, 240),
    location: locationParts.join(' / '),
  };
}

function buildExternalEvidenceRef(claim: ClaimProjectionRow): EvidenceRef {
  return {
    type: 'external_url',
    id: claim.id,
    excerpt: String(claim.object_value || claim.predicate || 'external citation').slice(0, 240),
    location: String(claim.source_url || 'external_source'),
  };
}

function lexicalSimilarity(entityName: string, aiEntries: AuditEvidenceEntry[]): number {
  const needle = String(entityName || '').trim().toLowerCase();
  if (!needle || aiEntries.length === 0) return 0;

  let best = 0;
  const needleTokens = needle.split(/\s+/).filter(Boolean);

  for (const entry of aiEntries) {
    const haystack = `${entry.raw_evidence} ${entry.extracted_signal}`.toLowerCase();
    if (haystack.includes(needle)) return 1;

    const tokenHits = needleTokens.filter((token) => haystack.includes(token)).length;
    if (needleTokens.length > 0) {
      best = Math.max(best, tokenHits / needleTokens.length);
    }
  }

  return clampUnit(best);
}

function pushCount(
  counts: Partial<Record<EvidenceLedgerClaimType, number>>,
  claimType: EvidenceLedgerClaimType,
): void {
  counts[claimType] = Number(counts[claimType] || 0) + 1;
}

export async function getEvidenceLedgerProjectionForAudit(
  auditId: string,
): Promise<EvidenceLedgerProjection | null> {
  const pool = getPool();
  const auditResult = await pool.query<AuditProjectionRow>(
    `SELECT a.id AS audit_id, a.url, a.visibility_score, a.result, s.id AS scan_id
     FROM audits a
     LEFT JOIN scans s ON s.audit_id = a.id
     WHERE a.id = $1
     ORDER BY s.created_at DESC NULLS LAST
     LIMIT 1`,
    [auditId],
  );

  if (!auditResult.rowCount || !auditResult.rows[0]) return null;

  const audit = auditResult.rows[0];
  const parsedResult = safeParseAuditResult(audit.result);
  const evidenceEntries = await getAuditEvidenceEntries(auditId);
  const claimRows = audit.scan_id
    ? (
        await pool.query<ClaimProjectionRow>(
          `SELECT c.id,
                  e.canonical_name,
                  c.subject_id,
                  c.predicate,
                  c.object_value,
                  c.confidence,
                  c.domain_authority,
                  c.source_url,
                  c.created_at::text
           FROM claims c
           LEFT JOIN entities e ON e.id = c.subject_id
           WHERE c.scan_id = $1
           ORDER BY c.created_at ASC`,
          [audit.scan_id],
        )
      ).rows
    : [];

  const entries: EvidenceLedgerEntry[] = [];
  const seenIds = new Set<string>();
  const detectedEntityMap = new Map<string, AuditEvidenceEntry[]>();
  const aiEntries = evidenceEntries.filter((entry) => entry.source_type === 'ai_provider');
  const citationEntries = evidenceEntries.filter((entry) => entry.source_type === 'citation_engine');

  for (const entry of evidenceEntries) {
    for (const entityRef of entry.entity_refs || []) {
      const name = String(entityRef?.name || '').trim();
      if (!name) continue;
      const bucket = detectedEntityMap.get(name) || [];
      bucket.push(entry);
      detectedEntityMap.set(name, bucket);
    }
  }

  for (const [entityName, sourceEntries] of detectedEntityMap.entries()) {
    const avgConfidence = clampUnit(
      sourceEntries.reduce((sum, entry) => sum + Number(entry.confidence_score || 0), 0) /
        Math.max(1, sourceEntries.length),
    );
    const entryId = `ledger:${auditId}:entity-detected:${normalizeEntityId(entityName)}`;
    if (!seenIds.has(entryId)) {
      seenIds.add(entryId);
      entries.push({
        id: entryId,
        scanId: audit.scan_id,
        auditId,
        entityId: normalizeEntityId(entityName),
        entityName,
        claimType: 'ENTITY_DETECTED',
        claim: `${entityName} detected in source-backed evidence`,
        evidenceRefs: sourceEntries.slice(0, 3).map(buildEvidenceRef),
        computation: {
          similarityScore: avgConfidence,
          threshold: 0.75,
          matchType: avgConfidence >= 0.75 ? 'direct' : 'weak',
          weightingFactors: {
            evidenceCount: sourceEntries.length,
            avgConfidence,
          },
        },
        result: {
          status: avgConfidence >= 0.75 ? 'pass' : 'partial',
          impactScore: roundImpact(2 + sourceEntries.length * avgConfidence * 4),
        },
        confidence: avgConfidence,
        timestamp: sourceEntries[0]?.created_at || new Date().toISOString(),
      });
    }

    const similarityScore = lexicalSimilarity(entityName, aiEntries);
    if (similarityScore < 0.75) {
      const claimType: EvidenceLedgerClaimType = similarityScore <= 0.1 ? 'ENTITY_MISSING' : 'ENTITY_DISTORTED';
      const mismatchId = `ledger:${auditId}:${claimType.toLowerCase()}:${normalizeEntityId(entityName)}`;
      if (!seenIds.has(mismatchId)) {
        seenIds.add(mismatchId);
        const evidenceRefs = [...sourceEntries.slice(0, 2).map(buildEvidenceRef)];
        if (aiEntries[0]) evidenceRefs.push(buildEvidenceRef(aiEntries[0]));
        entries.push({
          id: mismatchId,
          scanId: audit.scan_id,
          auditId,
          entityId: normalizeEntityId(entityName),
          entityName,
          claimType,
          claim:
            claimType === 'ENTITY_MISSING'
              ? `${entityName} is present in source evidence but absent from AI interpretation`
              : `${entityName} is present in source evidence but distorted in AI interpretation`,
          evidenceRefs,
          computation: {
            similarityScore,
            threshold: 0.75,
            matchType: claimType === 'ENTITY_MISSING' ? 'missing' : 'distorted',
            weightingFactors: {
              sourceEvidenceCount: sourceEntries.length,
              aiEvidenceCount: aiEntries.length,
            },
          },
          result: {
            status: claimType === 'ENTITY_MISSING' ? 'fail' : 'partial',
            impactScore: roundImpact(-(0.75 - similarityScore) * 14),
          },
          confidence: roundImpact(Math.max(0.45, 1 - similarityScore)),
          timestamp: aiEntries[0]?.created_at || sourceEntries[0]?.created_at || new Date().toISOString(),
        });
      }
    }
  }

  if (citationEntries.length === 0 && detectedEntityMap.size > 0) {
    entries.push({
      id: `ledger:${auditId}:citation-missing`,
      scanId: audit.scan_id,
      auditId,
      claimType: 'CITATION_MISSING',
      claim: 'No citation evidence was captured for this audit projection',
      evidenceRefs: evidenceEntries.slice(0, 2).map(buildEvidenceRef),
      computation: {
        threshold: 0.75,
        matchType: 'missing',
        weightingFactors: {
          detectedEntities: detectedEntityMap.size,
        },
      },
      result: {
        status: 'fail',
        impactScore: -8,
      },
      confidence: 0.72,
      timestamp: evidenceEntries[0]?.created_at || new Date().toISOString(),
    });
  }

  for (const citationEntry of citationEntries) {
    const present = Number(citationEntry.confidence_score || 0) >= 0.75;
    entries.push({
      id: `ledger:${auditId}:${present ? 'citation-present' : 'citation-weak'}:${citationEntry.id}`,
      scanId: audit.scan_id,
      auditId,
      claimType: present ? 'CITATION_PRESENT' : 'CITATION_WEAK',
      claim: present
        ? 'Citation evidence cleared the readiness threshold'
        : 'Citation evidence exists but remains below the readiness threshold',
      evidenceRefs: [buildEvidenceRef(citationEntry)],
      computation: {
        similarityScore: clampUnit(Number(citationEntry.confidence_score || 0)),
        threshold: 0.75,
        matchType: present ? 'direct' : 'weak',
      },
      result: {
        status: present ? 'pass' : 'partial',
        impactScore: present ? roundImpact(4 + Number(citationEntry.confidence_score || 0) * 4) : -3,
      },
      confidence: clampUnit(Number(citationEntry.confidence_score || 0)),
      timestamp: citationEntry.created_at,
    });
  }

  const parsedStructureSignals = evidenceEntries.filter(
    (entry) => entry.source_type === 'trust_layer' || entry.source_type === 'rule_engine',
  );
  if (parsedStructureSignals.length > 0) {
    const avgStructureConfidence = clampUnit(
      parsedStructureSignals.reduce((sum, entry) => sum + Number(entry.confidence_score || 0), 0) /
        parsedStructureSignals.length,
    );
    entries.push({
      id: `ledger:${auditId}:structure-parsed`,
      scanId: audit.scan_id,
      auditId,
      claimType: 'STRUCTURE_PARSED',
      claim: 'Structural signals were parsed into evidence-backed machine-readable entries',
      evidenceRefs: parsedStructureSignals.slice(0, 3).map(buildEvidenceRef),
      computation: {
        similarityScore: avgStructureConfidence,
        threshold: 0.6,
        matchType: 'parsed',
        weightingFactors: {
          parsedSignals: parsedStructureSignals.length,
        },
      },
      result: {
        status: avgStructureConfidence >= 0.6 ? 'pass' : 'partial',
        impactScore: roundImpact(2 + avgStructureConfidence * 3),
      },
      confidence: avgStructureConfidence,
      timestamp: parsedStructureSignals[0]?.created_at || new Date().toISOString(),
    });
  }

  const numericScoreFields: Array<[string, number]> = [];
  const layerScores = parsedResult.scores;
  if (layerScores && typeof layerScores === 'object') {
    for (const [key, value] of Object.entries(layerScores as Record<string, unknown>)) {
      const num = Number(value);
      if (Number.isFinite(num)) numericScoreFields.push([key, num]);
    }
  }
  const overallScore = Number(
    audit.visibility_score ?? parsedResult.visibility_score ?? parsedResult.score ?? 0,
  );
  numericScoreFields.unshift(['overall', Number.isFinite(overallScore) ? overallScore : 0]);

  for (const [component, value] of numericScoreFields) {
    entries.push({
      id: `ledger:${auditId}:score:${component}`,
      scanId: audit.scan_id,
      auditId,
      claimType: 'SCORE_COMPONENT',
      claim: component === 'overall' ? 'Overall visibility score derived from ledger impact' : `Score component: ${component}`,
      evidenceRefs: claimRows.slice(0, 2).map(buildExternalEvidenceRef),
      computation: {
        matchType: 'aggregate',
        weightingFactors: {
          componentValue: value,
          claimCount: claimRows.length,
          evidenceCount: evidenceEntries.length,
        },
      },
      result: {
        status: value >= 70 ? 'pass' : value >= 45 ? 'partial' : 'fail',
        impactScore: roundImpact(component === 'overall' ? value - 50 : (value - 50) / 4),
      },
      confidence: clampUnit(component === 'overall' ? 0.92 : 0.78),
      timestamp: new Date().toISOString(),
    });
  }

  const claimTypeCounts: Partial<Record<EvidenceLedgerClaimType, number>> = {};
  let positiveImpact = 0;
  let negativeImpact = 0;
  for (const entry of entries) {
    pushCount(claimTypeCounts, entry.claimType);
    if (entry.result.impactScore >= 0) positiveImpact += entry.result.impactScore;
    else negativeImpact += entry.result.impactScore;
  }

  const entitySummaryMap = new Map<string, { entityName: string; entryIds: string[]; netImpactScore: number; strongestClaimType: EvidenceLedgerClaimType; strongestAbsImpact: number }>();
  for (const entry of entries) {
    if (!entry.entityId || !entry.entityName) continue;
    const current = entitySummaryMap.get(entry.entityId) || {
      entityName: entry.entityName,
      entryIds: [],
      netImpactScore: 0,
      strongestClaimType: entry.claimType,
      strongestAbsImpact: 0,
    };
    current.entryIds.push(entry.id);
    current.netImpactScore = roundImpact(current.netImpactScore + entry.result.impactScore);
    const absImpact = Math.abs(entry.result.impactScore);
    if (absImpact >= current.strongestAbsImpact) {
      current.strongestAbsImpact = absImpact;
      current.strongestClaimType = entry.claimType;
    }
    entitySummaryMap.set(entry.entityId, current);
  }

  return {
    auditId,
    scanId: audit.scan_id,
    url: audit.url,
    generatedAt: new Date().toISOString(),
    entries,
    entities: [...entitySummaryMap.entries()].map(([entityId, value]) => ({
      entityId,
      entityName: value.entityName,
      entryIds: value.entryIds,
      netImpactScore: value.netImpactScore,
      strongestClaimType: value.strongestClaimType,
    })),
    totals: {
      entryCount: entries.length,
      evidenceCount: evidenceEntries.length,
      positiveImpact: roundImpact(positiveImpact),
      negativeImpact: roundImpact(negativeImpact),
      netImpact: roundImpact(positiveImpact + negativeImpact),
      claimTypeCounts,
    },
  };
}
