/**
 * graphResolutionService.ts
 *
 * Resolution engine: reads committed claims from the DB, computes weighted
 * probability distributions per cluster, and writes to the `resolutions` table.
 *
 * Algorithm per cluster (subject_id + predicate):
 *   1. Fetch all claims for the cluster
 *   2. Fetch edges (SUPPORTS / CONFLICTS) touching those claims
 *   3. Compute base weight per claim:
 *        weight = confidence × domain_authority × freshness_decay
 *   4. Apply edge adjustments:
 *        SUPPORTS edge  → weight += edge_weight × 0.20
 *        CONFLICTS edge → weight -= edge_weight × 0.30
 *      (clamp to 0.01 minimum so no claim disappears entirely)
 *   5. Group claims by normalised object_value, sum weights → value_score
 *   6. Softmax-normalize value_scores → probabilities
 *   7. Classify cluster:
 *        top_prob > 0.75   → VERIFIED
 *        top_prob 0.40–0.75 → DEGRADED
 *        top_prob < 0.40   → CONTRADICTORY
 *   8. Upsert resolution rows (one per candidate value)
 *
 * Temporal decay:
 *   freshness_score = e^(-λ × age_days)   where λ = 0.005 (≈ 3-month half-life)
 *   freshness column in claims overrides if present; otherwise computed from created_at.
 */

import { getPool } from './postgresql.js';

const LAMBDA = 0.005;          // temporal decay constant (3-month half-life ≈ 0.00231)
const SUPPORTS_BONUS = 0.20;   // weight multiplier bonus per SUPPORTS edge
const CONFLICTS_PENALTY = 0.30; // weight multiplier penalty per CONFLICTS edge
const MIN_WEIGHT = 0.01;       // floor — no claim weight goes to zero
const SOFTMAX_TEMPERATURE = 1.0;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClusterResolution {
  clusterId: string;
  subjectId: string;
  predicate: string;
  candidates: ResolutionCandidate[];
  status: 'VERIFIED' | 'DEGRADED' | 'CONTRADICTORY';
  topValue: string;
  topProbability: number;
}

export interface ResolutionCandidate {
  value: string;
  probability: number;
  support: number;
  claimCount: number;
}

export interface ResolutionRunResult {
  scanId: string;
  clustersProcessed: number;
  resolutionsWritten: number;
  durationMs: number;
}

// ---------------------------------------------------------------------------
// DB row shapes
// ---------------------------------------------------------------------------

interface ClaimRow {
  id: string;
  object_value: string | null;
  object_number: number | null;
  confidence: number | null;
  domain_authority: number | null;
  freshness: number | null;
  created_at: Date;
}

interface EdgeRow {
  claim_a: string;
  claim_b: string;
  edge_type: 'SUPPORTS' | 'CONFLICTS' | 'DUPLICATE';
  weight: number;
}

interface ClusterRow {
  id: string;
  subject_id: string;
  predicate: string;
}

// ---------------------------------------------------------------------------
// Temporal decay
// ---------------------------------------------------------------------------

function computeFreshness(row: ClaimRow): number {
  if (row.freshness !== null && row.freshness >= 0) {
    return row.freshness;
  }
  const ageMs = Date.now() - new Date(row.created_at).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return Math.exp(-LAMBDA * ageDays);
}

// ---------------------------------------------------------------------------
// Per-cluster resolution
// ---------------------------------------------------------------------------

function normalizeValue(row: ClaimRow): string {
  if (row.object_value !== null) return row.object_value.trim().toLowerCase();
  if (row.object_number !== null) return String(row.object_number);
  return '__unknown__';
}

function resolveCluster(
  cluster: ClusterRow,
  claims: ClaimRow[],
  edges: EdgeRow[],
): ClusterResolution {
  if (claims.length === 0) {
    return {
      clusterId: cluster.id,
      subjectId: cluster.subject_id,
      predicate: cluster.predicate,
      candidates: [],
      status: 'CONTRADICTORY',
      topValue: '',
      topProbability: 0,
    };
  }

  // Build claim id → base weight map
  const baseWeight = new Map<string, number>();
  for (const c of claims) {
    const conf = c.confidence ?? 0.5;
    const auth = c.domain_authority ?? 0.5;
    const fresh = computeFreshness(c);
    baseWeight.set(c.id, conf * auth * fresh);
  }

  // Apply edge adjustments
  const adjustedWeight = new Map<string, number>(baseWeight);
  for (const edge of edges) {
    const wa = adjustedWeight.get(edge.claim_a);
    const wb = adjustedWeight.get(edge.claim_b);

    if (edge.edge_type === 'SUPPORTS') {
      if (wa !== undefined) adjustedWeight.set(edge.claim_a, wa + edge.weight * SUPPORTS_BONUS);
      if (wb !== undefined) adjustedWeight.set(edge.claim_b, wb + edge.weight * SUPPORTS_BONUS);
    } else if (edge.edge_type === 'CONFLICTS') {
      if (wa !== undefined) adjustedWeight.set(edge.claim_a, Math.max(MIN_WEIGHT, wa - edge.weight * CONFLICTS_PENALTY));
      if (wb !== undefined) adjustedWeight.set(edge.claim_b, Math.max(MIN_WEIGHT, wb - edge.weight * CONFLICTS_PENALTY));
    }
  }

  // Group by canonical value → aggregate weight + count
  const valueScore = new Map<string, { scoreSum: number; count: number }>();
  for (const c of claims) {
    const val = normalizeValue(c);
    const w = adjustedWeight.get(c.id) ?? MIN_WEIGHT;
    const existing = valueScore.get(val);
    if (existing) {
      existing.scoreSum += w;
      existing.count++;
    } else {
      valueScore.set(val, { scoreSum: w, count: 1 });
    }
  }

  // Softmax over value scores
  const entries = Array.from(valueScore.entries());
  const maxScore = Math.max(...entries.map(([, v]) => v.scoreSum));
  const expScores = entries.map(([val, v]) => ({
    val,
    exp: Math.exp((v.scoreSum - maxScore) / SOFTMAX_TEMPERATURE),
    raw: v.scoreSum,
    count: v.count,
  }));
  const expSum = expScores.reduce((s, e) => s + e.exp, 0);

  const candidates: ResolutionCandidate[] = expScores
    .map((e) => ({
      value: e.val,
      probability: expSum > 0 ? e.exp / expSum : 0,
      support: e.raw,
      claimCount: e.count,
    }))
    .sort((a, b) => b.probability - a.probability);

  const topProb = candidates[0]?.probability ?? 0;
  const status: ClusterResolution['status'] =
    topProb > 0.75 ? 'VERIFIED' : topProb >= 0.40 ? 'DEGRADED' : 'CONTRADICTORY';

  return {
    clusterId: cluster.id,
    subjectId: cluster.subject_id,
    predicate: cluster.predicate,
    candidates,
    status,
    topValue: candidates[0]?.value ?? '',
    topProbability: topProb,
  };
}

// ---------------------------------------------------------------------------
// DB I/O
// ---------------------------------------------------------------------------

async function fetchClustersForScan(
  pool: import('pg').Pool,
  scanId: string,
): Promise<ClusterRow[]> {
  const result = await pool.query<ClusterRow>(
    `SELECT DISTINCT cc.id, cc.subject_id, cc.predicate
     FROM claim_clusters cc
     JOIN cluster_members cm ON cm.cluster_id = cc.id
     JOIN claims c ON c.id = cm.claim_id
     WHERE c.scan_id = $1`,
    [scanId],
  );
  return result.rows;
}

async function fetchClaimsForCluster(
  pool: import('pg').Pool,
  clusterId: string,
): Promise<ClaimRow[]> {
  const result = await pool.query<ClaimRow>(
    `SELECT c.id, c.object_value, c.object_number, c.confidence,
            c.domain_authority, c.freshness, c.created_at
     FROM claims c
     JOIN cluster_members cm ON cm.claim_id = c.id
     WHERE cm.cluster_id = $1`,
    [clusterId],
  );
  return result.rows;
}

async function fetchEdgesForClaims(
  pool: import('pg').Pool,
  claimIds: string[],
): Promise<EdgeRow[]> {
  if (claimIds.length === 0) return [];
  const result = await pool.query<EdgeRow>(
    `SELECT claim_a, claim_b, edge_type, weight
     FROM claim_edges
     WHERE claim_a = ANY($1::uuid[]) OR claim_b = ANY($1::uuid[])`,
    [claimIds],
  );
  return result.rows;
}

async function upsertResolutions(
  pool: import('pg').Pool,
  resolution: ClusterResolution,
): Promise<number> {
  if (resolution.candidates.length === 0) return 0;

  // Delete existing resolutions for this cluster (idempotent re-run)
  await pool.query(`DELETE FROM resolutions WHERE cluster_id = $1`, [resolution.clusterId]);

  let written = 0;
  for (const candidate of resolution.candidates) {
    await pool.query(
      `INSERT INTO resolutions (cluster_id, value, probability, support, status)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        resolution.clusterId,
        candidate.value,
        candidate.probability,
        candidate.support,
        resolution.status,  // same status tag on every candidate row
      ],
    );
    written++;
  }
  return written;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Run the resolution engine for all clusters produced by a given scan.
 *
 * Safe to call multiple times (idempotent — deletes + rewrites resolution rows).
 *
 * Usage:
 *   const result = await runResolution({ scanId });
 */
export async function runResolution(input: {
  scanId: string;
}): Promise<ResolutionRunResult> {
  const startMs = Date.now();
  const pool = getPool();

  const clusters = await fetchClustersForScan(pool, input.scanId);

  let resolutionsWritten = 0;
  const resolutions: ClusterResolution[] = [];

  for (const cluster of clusters) {
    const claims = await fetchClaimsForCluster(pool, cluster.id);
    const claimIds = claims.map((c) => c.id);
    const edges = await fetchEdgesForClaims(pool, claimIds);

    const resolution = resolveCluster(cluster, claims, edges);
    resolutions.push(resolution);

    const written = await upsertResolutions(pool, resolution);
    resolutionsWritten += written;
  }

  return {
    scanId: input.scanId,
    clustersProcessed: clusters.length,
    resolutionsWritten,
    durationMs: Date.now() - startMs,
  };
}

/**
 * Fetch computed resolutions for a scan (read path — for UI + API).
 *
 * Returns clusters ordered by predicate, candidates by probability DESC.
 */
export async function getResolutionsForScan(
  scanId: string,
): Promise<ClusterResolution[]> {
  const pool = getPool();

  const rows = await pool.query<{
    cluster_id: string;
    subject_id: string;
    predicate: string;
    value: string;
    probability: number;
    support: number;
    status: string;
  }>(
    `SELECT cc.id AS cluster_id, cc.subject_id, cc.predicate,
            r.value, r.probability, r.support, r.status
     FROM claim_clusters cc
     JOIN cluster_members cm ON cm.cluster_id = cc.id
     JOIN claims c ON c.id = cm.claim_id
     JOIN resolutions r ON r.cluster_id = cc.id
     WHERE c.scan_id = $1
     ORDER BY cc.predicate, r.probability DESC`,
    [scanId],
  );

  // Group by cluster_id
  const clusterMap = new Map<string, ClusterResolution>();
  for (const row of rows.rows) {
    if (!clusterMap.has(row.cluster_id)) {
      clusterMap.set(row.cluster_id, {
        clusterId: row.cluster_id,
        subjectId: row.subject_id,
        predicate: row.predicate,
        candidates: [],
        status: row.status as ClusterResolution['status'],
        topValue: '',
        topProbability: 0,
      });
    }
    const res = clusterMap.get(row.cluster_id)!;
    res.candidates.push({
      value: row.value,
      probability: row.probability,
      support: row.support,
      claimCount: 0, // not stored — would need a join
    });
  }

  return Array.from(clusterMap.values()).map((r) => ({
    ...r,
    topValue: r.candidates[0]?.value ?? '',
    topProbability: r.candidates[0]?.probability ?? 0,
  }));
}
