import { randomUUID } from 'crypto';
import { getPool } from './postgresql.js';
import { hashNormalizedUrl } from '../utils/urlHash.js';
import {
  computeDeterministicDelta,
  recordStageEvent,
  ensureDeterministicContractTables,
} from './deterministicContractService.js';

type JobRow = { id: string; url_hash: string; run_id: string };

type EntityCandidate = {
  entityType: string;
  entityValue: string;
  confidence: number;
  context: string | null;
};

function hashUrl(url: string): string {
  return hashNormalizedUrl(url);
}

function toEntityCandidates(source: any): EntityCandidate[] {
  const values = new Map<string, EntityCandidate>();

  const add = (type: string, value: unknown, confidence: number, context?: string | null) => {
    const text = String(value || '').trim();
    if (!text || text.length < 2) return;
    const key = `${type}:${text.toLowerCase()}`;
    if (values.has(key)) return;
    values.set(key, {
      entityType: type,
      entityValue: text.slice(0, 250),
      confidence,
      context: context ? String(context).slice(0, 4000) : null,
    });
  };

  const data = source?.data || source || {};
  add('title', data.title, 0.9, 'page_title');

  const headings = Array.isArray(data.headings) ? data.headings : [];
  for (const heading of headings.slice(0, 20)) {
    add('heading', heading, 0.7, 'heading');
  }

  const keywords = Array.isArray(data.keywords) ? data.keywords : [];
  for (const keyword of keywords.slice(0, 30)) {
    add('keyword', keyword, 0.6, 'keyword');
  }

  const entities = Array.isArray(data.entities) ? data.entities : [];
  for (const entity of entities.slice(0, 40)) {
    if (typeof entity === 'string') {
      add('entity', entity, 0.75, 'entity');
    } else if (entity && typeof entity === 'object') {
      add(String(entity.type || 'entity'), entity.value || entity.name, Number(entity.confidence || 0.75), entity.context || null);
    }
  }

  return Array.from(values.values()).slice(0, 80);
}

function deriveVisibilityScore(result: any, explicitScore?: number): number | null {
  if (typeof explicitScore === 'number' && Number.isFinite(explicitScore)) return explicitScore;
  const value = result?.visibility_score;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
}

async function safeQuery(sql: string, params: unknown[]): Promise<any[]> {
  try {
    const res = await getPool().query(sql, params);
    return res.rows || [];
  } catch (err: any) {
    const msg = String(err?.message || err || '');
    if (msg.includes('does not exist') || msg.includes('column') || msg.includes('permission denied')) return [];
    throw err;
  }
}

export async function startIngestionJob(url: string, priority: number = 0): Promise<JobRow> {
  await ensureDeterministicContractTables();
  const urlHash = hashUrl(url);
  const runId = randomUUID();
  const rows = await safeQuery(
    `INSERT INTO ingestion_jobs (url, url_hash, run_id, status, priority, retry_count, scheduled_at, started_at, updated_at)
     VALUES ($1, $2, $3::uuid, 'processing', $4, 0, NOW(), NOW(), NOW())
     ON CONFLICT (url_hash)
     DO UPDATE SET
       url = EXCLUDED.url,
       run_id = EXCLUDED.run_id,
       status = 'processing',
       priority = GREATEST(ingestion_jobs.priority, EXCLUDED.priority),
       retry_count = CASE
         WHEN ingestion_jobs.status = 'failed' THEN COALESCE(ingestion_jobs.retry_count, 0) + 1
         ELSE COALESCE(ingestion_jobs.retry_count, 0)
       END,
       started_at = COALESCE(ingestion_jobs.started_at, NOW()),
       completed_at = NULL,
       last_error = NULL,
       updated_at = NOW()
     RETURNING id, url_hash, run_id`,
    [url, urlHash, runId, priority],
  );

  const row = rows[0] as JobRow | undefined;
  const out = row || { id: randomUUID(), url_hash: urlHash, run_id: runId };

  try {
    await recordStageEvent({ runId: out.run_id, stage: 'queued', status: 'complete', payload: { url } });
  } catch {
    // best-effort append-only event
  }

  return out;
}

export async function markFetched(jobId: string, urlHash: string, scrapeResult: any): Promise<string | null> {
  const snapshots = await safeQuery(
    `INSERT INTO crawl_snapshots (ingestion_job_id, url_hash, final_url, http_status, headers, html, text_content, fetched_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, NOW())
     RETURNING id`,
    [
      jobId,
      urlHash,
      String(scrapeResult?.url || ''),
      Number.isFinite(Number(scrapeResult?.httpStatus)) ? Number(scrapeResult.httpStatus) : null,
      JSON.stringify(scrapeResult?.headers || {}),
      typeof scrapeResult?.html === 'string' ? scrapeResult.html : null,
      typeof scrapeResult?.data?.text === 'string' ? scrapeResult.data.text : null,
    ],
  );

  await safeQuery(
    `UPDATE ingestion_jobs
        SET status = 'fetched',
            updated_at = NOW()
      WHERE id = $1`,
    [jobId],
  );

  const runRow = await safeQuery(`SELECT run_id FROM ingestion_jobs WHERE id = $1`, [jobId]);
  const runId = String(runRow[0]?.run_id || '').trim();
  if (runId) {
    try {
      await recordStageEvent({
        runId,
        stage: 'fetched',
        status: 'complete',
        payload: { final_url: String(scrapeResult?.url || ''), http_status: Number(scrapeResult?.httpStatus || 0) || null },
      });
    } catch {
      // best-effort
    }
  }

  return snapshots[0]?.id ? String(snapshots[0].id) : null;
}

export async function markParsed(jobId: string, urlHash: string, source: any, snapshotId?: string | null): Promise<number> {
  const entities = toEntityCandidates(source);
  const runRow = await safeQuery(`SELECT run_id FROM ingestion_jobs WHERE id = $1`, [jobId]);
  const runId = String(runRow[0]?.run_id || '').trim();

  for (const entity of entities) {
    await safeQuery(
      `INSERT INTO extracted_entities (crawl_snapshot_id, run_id, url_hash, entity_type, entity_value, confidence, context, extracted_at)
       VALUES ($1, $2::uuid, $3, $4, $5, $6, $7, NOW())`,
      [snapshotId || null, runId || null, urlHash, entity.entityType, entity.entityValue, entity.confidence, entity.context],
    );
  }

  await safeQuery(
    `UPDATE ingestion_jobs
        SET status = 'parsed',
            updated_at = NOW()
      WHERE id = $1`,
    [jobId],
  );

  if (runId) {
    try {
      await recordStageEvent({ runId, stage: 'parsed', status: 'complete', payload: { entity_candidates: entities.length } });
      await recordStageEvent({ runId, stage: 'entities', status: 'complete', payload: { entity_count: entities.length } });
    } catch {
      // best-effort
    }
  }

  return entities.length;
}

export async function markAnalyzed(jobId: string, urlHash: string, result: any, score?: number): Promise<void> {
  const visibilityScore = deriveVisibilityScore(result, score);
  const analyzedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await safeQuery(
    `INSERT INTO analysis_results (url_hash, score, visibility_score, result, model_version, analyzed_at, expires_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, NOW(), NOW())
     ON CONFLICT (url_hash)
     DO UPDATE SET
       score = EXCLUDED.score,
       visibility_score = EXCLUDED.visibility_score,
       result = EXCLUDED.result,
       model_version = EXCLUDED.model_version,
       analyzed_at = EXCLUDED.analyzed_at,
       expires_at = EXCLUDED.expires_at,
       updated_at = NOW()`,
    [
      urlHash,
      visibilityScore,
      visibilityScore,
      JSON.stringify(result || {}),
      'audit-worker-v1',
      analyzedAt,
      expiresAt,
    ],
  );

  await safeQuery(
    `UPDATE ingestion_jobs
        SET status = 'analyzed',
            updated_at = NOW()
      WHERE id = $1`,
    [jobId],
  );

  const runRow = await safeQuery(`SELECT run_id FROM ingestion_jobs WHERE id = $1`, [jobId]);
  const runId = String(runRow[0]?.run_id || '').trim();
  if (runId) {
    try {
      await recordStageEvent({
        runId,
        stage: 'scored',
        status: 'complete',
        payload: { score: visibilityScore ?? 0 },
      });
    } catch {
      // best-effort
    }
  }
}

export async function markCompleted(jobId: string, urlHash: string, result: any, score?: number): Promise<void> {
  await ensureDeterministicContractTables();
  const visibilityScore = deriveVisibilityScore(result, score);
  const ingestionRows = await safeQuery(`SELECT run_id FROM ingestion_jobs WHERE id = $1`, [jobId]);
  const runId = String(ingestionRows[0]?.run_id || randomUUID());

  const previousRunRows = await safeQuery(
    `SELECT result_snapshot
       FROM analysis_runs
      WHERE url_hash = $1
      ORDER BY created_at DESC
      LIMIT 1`,
    [urlHash],
  );
  const previousSnapshot = previousRunRows[0]?.result_snapshot || null;
  const delta = previousSnapshot ? computeDeterministicDelta(result || {}, previousSnapshot) : {
    scoreDiff: 0,
    entityDiff: { added: [], removed: [], changed: [] },
    conflictsResolved: 0,
  };

  const analysisRunRows = await safeQuery(
    `INSERT INTO analysis_runs (url_hash, run_id, score, visibility_score, delta, result_snapshot, created_at)
     VALUES ($1, $2::uuid, $3, $4, $5::jsonb, $6::jsonb, NOW())
     RETURNING id`,
    [urlHash, runId, visibilityScore, visibilityScore, JSON.stringify(delta), JSON.stringify(result || {})],
  );

  const analysisRunId = analysisRunRows[0]?.id ? String(analysisRunRows[0].id) : null;
  if (analysisRunId) {
    const entityRows = await safeQuery(
      `SELECT id, entity_value, confidence
         FROM extracted_entities
        WHERE url_hash = $1
        ORDER BY extracted_at DESC
        LIMIT 8`,
      [urlHash],
    );

    for (const entity of entityRows) {
      await safeQuery(
        `INSERT INTO citations (
           analysis_run_id,
           extracted_entity_id,
           run_id,
           url_hash,
           source,
           target_entity,
           mention_count,
           confidence,
           context,
           created_at
         )
         VALUES ($1, $2, $3::uuid, $4, $5, $6, 1, $7, $8::jsonb, NOW())`,
        [
          analysisRunId,
          entity.id,
          runId,
          urlHash,
          'audit-worker',
          String(entity.entity_value || ''),
          Number(entity.confidence || 0.6),
          JSON.stringify({ reason: 'derived_from_extracted_entities' }),
        ],
      );
    }
  }

  await safeQuery(
    `UPDATE ingestion_jobs
        SET status = 'completed',
            completed_at = NOW(),
            last_error = NULL,
            updated_at = NOW()
      WHERE id = $1`,
    [jobId],
  );

  try {
    await recordStageEvent({
      runId,
      stage: 'citations',
      status: 'complete',
      payload: { citations_written: analysisRunId ? 1 : 0 },
    });
    await recordStageEvent({
      runId,
      stage: 'finalized',
      status: 'complete',
      payload: { score: visibilityScore ?? 0, delta },
    });
  } catch {
    // best-effort
  }
}

export async function markFailed(jobId: string, urlHash: string, errorMessage: string): Promise<void> {
  await ensureDeterministicContractTables();
  const ingestionRows = await safeQuery(`SELECT run_id FROM ingestion_jobs WHERE id = $1`, [jobId]);
  const runId = String(ingestionRows[0]?.run_id || randomUUID());

  await safeQuery(
    `UPDATE ingestion_jobs
        SET status = 'failed',
            completed_at = NOW(),
            last_error = LEFT($2, 4000),
            updated_at = NOW()
      WHERE id = $1`,
    [jobId, errorMessage || 'unknown_error'],
  );

  await safeQuery(
    `INSERT INTO analysis_runs (url_hash, run_id, score, visibility_score, delta, result_snapshot, created_at)
     VALUES ($1, $2::uuid, 0, 0, $3::jsonb, $4::jsonb, NOW())`,
    [
      urlHash,
      runId,
      JSON.stringify({ status: 'failed', error: errorMessage || 'unknown_error' }),
      JSON.stringify({ status: 'failed' }),
    ],
  );

  try {
    await recordStageEvent({
      runId,
      stage: 'finalized',
      status: 'failed',
      payload: { error: errorMessage || 'unknown_error' },
    });
  } catch {
    // best-effort
  }
}
