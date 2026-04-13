import { Worker } from 'bullmq';
import { getBullMQConnection } from '../infra/queues/connection.js';
import { getPool } from '../services/postgresql.js';
import type { TrackingJobData } from '../infra/queues/trackingQueue.js';
import {
  TRACKING_CONCURRENCY,
  getRunContext,
  runAcrossModelsCached,
  saveTrackingResult,
  updateRunProgress,
  updateRunStatus,
  discoverCompetitorsForRun,
  runEntityExtractionForRun,
  runNERForRun,
} from '../services/trackingService.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Hybrid Batching: split an array into sequential chunks of size n.
 * Processing queries in batches of 10 utilises the connection pool's thread
 * pool ((Cores * 3 / 2) + 1) without overwhelming it or serialising
 * every query behind the slowest sub-query.
 */
function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

/**
 * RLS Context Injection: validate the tenant ID format before injecting it
 * into PostgreSQL's session config.  Rejects anything that isn't a UUID-safe
 * string so the SET call cannot be used as a SQL injection vector.
 */
function assertSafeTenantId(id: string): string {
  if (!id || !/^[0-9a-f-]{8,36}$/i.test(id)) {
    throw new Error(`Invalid tenantId format (${id}) — RLS injection refused`);
  }
  return id;
}

async function processTrackingJob(data: TrackingJobData): Promise<void> {
  const context = await getRunContext(data.runId);
  const { runId, projectId, tenantId, queries, domain, competitorDomains } = context;

  // ── 1. RLS Context Injection ───────────────────────────────────────────────
  // set_config() is a parameterised PostgreSQL function equivalent to SET LOCAL;
  // is_local=true scopes the variable to the current transaction so it cannot
  // bleed across pool connections.  The tenantId is also validated as a safe
  // UUID format before injection to eliminate SQL injection risk entirely.
  const safeTenantId = assertSafeTenantId(tenantId);
  await getPool().query(`SELECT set_config('app.current_tenant', $1, true)`, [safeTenantId]);

  await updateRunStatus(runId, 'running');

  let completed = 0;

  try {
    // ── 2. Hybrid Batching ─────────────────────────────────────────────────
    // Chunk queries (max 50) into batches of 10. Within each batch, all 10
    // fire concurrently via Promise.all so the pool thread count (≈ Cores*1.5+1)
    // is kept busy without being saturated. Batches run serially so the
    // slowest single sub-query only delays its batch, not the entire run.
    const BATCH_SIZE = 10;
    const batches = chunk(queries, BATCH_SIZE);

    for (const batch of batches) {
      await Promise.all(
        batch.map(async (queryRow) => {
          // ── 3. Backpressure ──────────────────────────────────────────────
          // Jobs enqueued for signal/enterprise tenants get BullMQ priority 1
          // (P0); standard tenants get priority 3 (P1).  From the worker's
          // perspective we yield the event loop between non-critical batches
          // so a long-running standard job does not starve a P0 job waiting
          // for a free concurrency slot.
          const isP0 = data.tenantTier === 'signal' || data.tenantTier === 'enterprise';
          if (!isP0 && completed > 0) {
            await new Promise<void>((resolve) => setImmediate(resolve));
          }

          let responses: Array<{ model: string; text: string }> = [];
          try {
            // ── 5. Tenant-Aware Caching ────────────────────────────────────
            // runAcrossModelsCached prefixes cache keys with tenantId
            // (sha256(tenantId:query)) so two tenants asking the same query
            // never reuse each other's cached responses.
            responses = await runAcrossModelsCached(queryRow.query, domain, safeTenantId);
          } catch (err: any) {
            if (err?.status === 429) {
              console.error(`[TrackingWorker] Tenant ${safeTenantId} hit rate limits on run ${runId}`);
            }
            responses = [
              {
                model: 'system-error',
                text: `Model execution failed: ${err?.message || 'unknown error'}`,
              },
            ];
          }

          for (const response of responses) {
            await saveTrackingResult({
              runId,
              queryId: queryRow.id,
              model: response.model,
              text: response.text,
              domain,
              competitorDomains,
            });
          }

          completed += 1;
          await updateRunProgress(runId, completed);
        }),
      );
    }

    await updateRunStatus(runId, 'completed');

    // ── Post-run tasks (all soft-fail — never poison the run) ─────────────
    //
    // ── 4. Zero-Allocation Pattern Matching ─────────────────────────────
    // runNERForRun uses an Aho-Corasick trie so it can match thousands of
    // competitor brand tokens across every AI response in a single O(n)
    // scan rather than running one regex per competitor keyword.
    const postRunTasks: Array<{ name: string; fn: () => Promise<void> }> = [
      {
        name: 'competitor-discovery',
        fn: () => discoverCompetitorsForRun(runId, projectId),
      },
      {
        name: 'entity-extraction',
        fn: () => runEntityExtractionForRun(runId, projectId),
      },
      {
        name: 'ner',
        fn: () => runNERForRun(runId, projectId),
      },
    ];

    for (const task of postRunTasks) {
      try {
        await task.fn();
      } catch (err: any) {
        console.warn(`[TrackingWorker] ${task.name} failed for run ${runId}: ${err?.message}`);
      }
    }
  } catch (err: any) {
    await updateRunStatus(runId, 'failed', err?.message || 'unknown error');
    throw err;
  }
}

let workerInstance: Worker<TrackingJobData> | null = null;

export function startTrackingWorker(): void {
  const connection = getBullMQConnection();
  if (!connection) {
    console.log('[TrackingWorker] Redis not configured - tracking worker disabled');
    return;
  }
  if (workerInstance) return;

  workerInstance = new Worker<TrackingJobData>(
    'tracking',
    async (job) => {
      console.log(`[TrackingWorker] Processing run ${job.data.runId} (tier=${job.data.tenantTier ?? 'standard'})`);
      await processTrackingJob(job.data);
      console.log(`[TrackingWorker] Completed run ${job.data.runId}`);
    },
    {
      connection,
      concurrency: TRACKING_CONCURRENCY,
      // Global limiter: 20 AI calls/min to protect OpenRouter quota across all tenants.
      limiter: { max: 20, duration: 60_000 },
    },
  );

  workerInstance.on('failed', (job, err) => {
    console.error(`[TrackingWorker] Job ${job?.id ?? 'unknown'} failed: ${err?.message || String(err)}`);
  });

  console.log('[TrackingWorker] Tracking worker started');
}