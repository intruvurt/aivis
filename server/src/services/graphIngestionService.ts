/**
 * graphIngestionService.ts
 *
 * Node-side orchestrator for the graph knowledge ingestion pipeline.
 *
 * Responsibilities:
 *   1. Create scan record in DB
 *   2. Call FastAPI /ingest to get chunks + entities + claims
 *   3. Resolve entities via ANN cosine query (upsert if new)
 *   4. Upsert claim clusters via stored procedure
 *   5. Insert claims + cluster_members
 *   6. Batch-generate conflict edges after all claims are inserted
 *   7. Emit PIPELINE_STAGE events at each step
 *
 * NEVER called per-claim — always batch-first.
 * Scan record is the traceability root for everything downstream.
 */

import crypto from 'node:crypto';
import { getPool } from './postgresql.js';
import { appendScanEvent } from './scanEventStream.js';
import type { ScanEvent, PipelineScanStage } from '../../../shared/types.js';

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://127.0.0.1:3002';
const PYTHON_INTERNAL_KEY = process.env.PYTHON_INTERNAL_KEY || '';
const ENTITY_SIMILARITY_THRESHOLD = 0.88; // cosine similarity cutoff for entity merge
const INGEST_TIMEOUT_MS = 60_000;

// ---------------------------------------------------------------------------
// Types (internal — not exported via shared/types to avoid coupling)
// ---------------------------------------------------------------------------

export interface GraphIngestionInput {
  url: string;
  html?: string;
  text?: string;
  auditId?: string;
  workspaceId?: string;
  executionClass?: 'observer' | 'starter' | 'alignment' | 'signal';
  modelCount?: number;
  tripleCheck?: boolean;
  /** If provided, SSE events are appended to this scan stream. */
  scanId?: string;
  /** Sequence counter for SSE events. Caller manages this. */
  seqRef?: { value: number };
}

export interface GraphIngestionResult {
  scanId: string;
  entityCount: number;
  claimCount: number;
  edgesGenerated: number;
  durationMs: number;
}

// ---------------------------------------------------------------------------
// FastAPI ingest call
// ---------------------------------------------------------------------------

interface IngestResponseChunk {
  index: number;
  text: string;
  embedding: number[];
}

interface IngestResponseEntity {
  name: string;
  type: string;
  embedding: number[];
  source_chunk_index: number;
}

interface IngestResponseClaim {
  subject_name: string;
  predicate: string;
  object_value: string;
  confidence: number;
  source_url: string;
  chunk_index: number;
  extraction_method: string;
  prompt_hash: string;
}

interface IngestResponse {
  scan_id: string;
  chunks: IngestResponseChunk[];
  entities: IngestResponseEntity[];
  claims: IngestResponseClaim[];
  model_used: string;
  total_chunks: number;
  total_entities: number;
  total_claims: number;
}

async function callPythonIngest(
  scanId: string,
  url: string,
  html: string,
  text: string,
): Promise<IngestResponse | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), INGEST_TIMEOUT_MS);

  try {
    const resp = await fetch(`${PYTHON_SERVICE_URL}/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scan_id: scanId,
        url,
        html,
        text,
        internal_key: PYTHON_INTERNAL_KEY,
      }),
      signal: controller.signal,
    });
    if (!resp.ok) {
      const msg = await resp.text().catch(() => '');
      console.warn(`[graphIngest] Python /ingest returned ${resp.status}: ${msg.slice(0, 200)}`);
      return null;
    }
    return (await resp.json()) as IngestResponse;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[graphIngest] Python /ingest failed: ${msg}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Entity resolution (ANN via pgvector, upsert if below threshold)
// ---------------------------------------------------------------------------

/**
 * Resolve an entity name + embedding to a canonical entity UUID.
 * Searches the `entities` table for the nearest neighbor;
 * if similarity is above the threshold, reuse that entity.
 * Otherwise, insert a new row and return its UUID.
 */
async function resolveOrCreateEntity(
  client: import('pg').PoolClient,
  name: string,
  type: string,
  embedding: number[],
): Promise<string> {
  const embeddingLiteral = `[${embedding.join(',')}]`;

  // ANN search: find closest entity within similarity threshold
  const ann = await client.query<{ id: string; similarity: number }>(
    `SELECT id, 1 - (embedding <=> $1::vector) AS similarity
     FROM entities
     ORDER BY embedding <=> $1::vector
     LIMIT 1`,
    [embeddingLiteral],
  );

  if (ann.rows.length > 0 && ann.rows[0].similarity >= ENTITY_SIMILARITY_THRESHOLD) {
    return ann.rows[0].id;
  }

  // New entity — insert and return UUID
  const insert = await client.query<{ id: string }>(
    `INSERT INTO entities (canonical_name, type, embedding)
     VALUES ($1, $2, $3::vector)
     RETURNING id`,
    [name, type, embeddingLiteral],
  );
  return insert.rows[0].id;
}

// ---------------------------------------------------------------------------
// SSE event helper
// ---------------------------------------------------------------------------

function emitStage(
  scanId: string | undefined,
  seqRef: { value: number } | undefined,
  stage: PipelineScanStage,
  progress: number,
  payload: Record<string, unknown>,
): void {
  if (!scanId) return;
  const seq = seqRef ? seqRef.value++ : 0;
  const event: ScanEvent = {
    type: 'PIPELINE_STAGE',
    stage,
    progress,
    payload,
    timestamp: Date.now(),
  };
  // Fire-and-forget — ingestion should not block on SSE writes
  appendScanEvent(scanId, seq, event).catch((err: unknown) => {
    console.warn('[graphIngest] SSE append failed:', (err as Error)?.message);
  });
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Run the full graph ingestion pipeline for a single URL.
 *
 * Usage:
 *   const result = await runGraphIngestion({ url, html, auditId, workspaceId, scanId, seqRef });
 */
export async function runGraphIngestion(
  input: GraphIngestionInput,
): Promise<GraphIngestionResult> {
  const startMs = Date.now();
  const pool = getPool();
  const client = await pool.connect();

  try {
    // -------------------------------------------------------------------------
    // 1. Create scan record
    // -------------------------------------------------------------------------
    const scanInsert = await client.query<{ id: string }>(
      `INSERT INTO scans
         (audit_id, workspace_id, url, status, execution_class, model_count, triple_check)
       VALUES ($1, $2, $3, 'running', $4, $5, $6)
       RETURNING id`,
      [
        input.auditId ?? null,
        input.workspaceId ?? null,
        input.url,
        input.executionClass ?? 'observer',
        input.modelCount ?? 0,
        input.tripleCheck ?? false,
      ],
    );
    const scanId = scanInsert.rows[0].id;

    emitStage(input.scanId, input.seqRef, 'ingesting', 0.05, { url: input.url, scan_id: scanId });

    // -------------------------------------------------------------------------
    // 2. Call Python compute layer
    // -------------------------------------------------------------------------
    const pyResult = await callPythonIngest(
      scanId,
      input.url,
      input.html ?? '',
      input.text ?? '',
    );

    if (!pyResult || pyResult.total_chunks === 0) {
      await client.query(`UPDATE scans SET status='failed' WHERE id=$1`, [scanId]);
      emitStage(input.scanId, input.seqRef, 'ingestion_failed', 1.0, {
        reason: 'python_ingest_returned_no_chunks',
      });
      return { scanId, entityCount: 0, claimCount: 0, edgesGenerated: 0, durationMs: Date.now() - startMs };
    }

    emitStage(input.scanId, input.seqRef, 'chunked', 0.15, {
      chunks: pyResult.total_chunks,
      model: pyResult.model_used,
    });

    // -------------------------------------------------------------------------
    // 3. Resolve entities (ANN merge or insert)
    // -------------------------------------------------------------------------
    emitStage(input.scanId, input.seqRef, 'entity_resolving', 0.25, {
      candidate_count: pyResult.total_entities,
    });

    // Build name → UUID map to avoid redundant ANN queries in claim resolution
    const entityNameToUuid = new Map<string, string>();

    for (const ent of pyResult.entities) {
      const uuid = await resolveOrCreateEntity(client, ent.name, ent.type, ent.embedding);
      entityNameToUuid.set(ent.name.toLowerCase(), uuid);
    }

    emitStage(input.scanId, input.seqRef, 'entity_resolved', 0.40, {
      entities_detected: entityNameToUuid.size,
    });

    // -------------------------------------------------------------------------
    // 4. Upsert clusters + insert claims + cluster_members
    // -------------------------------------------------------------------------
    emitStage(input.scanId, input.seqRef, 'claim_writing', 0.55, {
      claim_count: pyResult.total_claims,
    });

    const insertedClaimIds: string[] = [];

    for (const claim of pyResult.claims) {
      const subjectId = entityNameToUuid.get(claim.subject_name.toLowerCase());
      if (!subjectId) continue; // skip claims whose subject couldn't be resolved

      // Upsert cluster
      const clusterResult = await client.query<{ id: string }>(
        `SELECT upsert_claim_cluster($1, $2) AS id`,
        [subjectId, claim.predicate],
      );
      const clusterId = clusterResult.rows[0].id;

      // Insert claim
      const claimResult = await client.query<{ id: string }>(
        `INSERT INTO claims
           (scan_id, workspace_id, subject_id, predicate, object_value, object_raw,
            confidence, source_url, extraction_method, prompt_hash)
         VALUES ($1, $2, $3, $4, $5, $5, $6, $7, $8, $9)
         RETURNING id`,
        [
          scanId,
          input.workspaceId ?? null,
          subjectId,
          claim.predicate,
          claim.object_value,
          claim.confidence,
          claim.source_url,
          claim.extraction_method,
          claim.prompt_hash,
        ],
      );
      const claimId = claimResult.rows[0].id;
      insertedClaimIds.push(claimId);

      // Link claim to cluster
      await client.query(
        `INSERT INTO cluster_members (cluster_id, claim_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [clusterId, claimId],
      );
    }

    // -------------------------------------------------------------------------
    // 5. Batch-generate conflict edges (never per-claim)
    // -------------------------------------------------------------------------
    emitStage(input.scanId, input.seqRef, 'edge_generation', 0.80, {
      claims_inserted: insertedClaimIds.length,
    });

    const edgeResult = await client.query<{ generate_conflict_edges: number }>(
      `SELECT generate_conflict_edges($1) AS edges_written`,
      [scanId],
    );
    const edgesGenerated = edgeResult.rows[0]?.generate_conflict_edges ?? 0;

    // -------------------------------------------------------------------------
    // 6. Mark scan complete
    // -------------------------------------------------------------------------
    await client.query(`UPDATE scans SET status='complete' WHERE id=$1`, [scanId]);

    emitStage(input.scanId, input.seqRef, 'ingestion_complete', 1.0, {
      scan_id: scanId,
      entities: entityNameToUuid.size,
      claims: insertedClaimIds.length,
      edges: edgesGenerated,
      duration_ms: Date.now() - startMs,
    });

    return {
      scanId,
      entityCount: entityNameToUuid.size,
      claimCount: insertedClaimIds.length,
      edgesGenerated,
      durationMs: Date.now() - startMs,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[graphIngest] pipeline error:', msg);
    emitStage(input.scanId, input.seqRef, 'ingestion_failed', 1.0, { error: msg });
    throw err;
  } finally {
    client.release();
  }
}
