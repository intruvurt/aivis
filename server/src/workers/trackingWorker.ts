import { Worker } from 'bullmq';
import { getBullMQConnection } from '../infra/queues/connection.js';
import type { TrackingJobData } from '../infra/queues/trackingQueue.js';
import {
  TRACKING_CONCURRENCY,
  getRunContext,
  mapWithConcurrency,
  runAcrossModelsCached,
  saveTrackingResult,
  updateRunProgress,
  updateRunStatus,
} from '../services/trackingService.js';

let workerInstance: Worker<TrackingJobData> | null = null;

async function processTrackingJob(data: TrackingJobData): Promise<void> {
  const context = await getRunContext(data.runId);
  await updateRunStatus(context.runId, 'running');

  let completed = 0;

  try {
    await mapWithConcurrency(context.queries, TRACKING_CONCURRENCY, async (queryRow) => {
      let responses = [] as Array<{ model: string; text: string }>;
      try {
        responses = await runAcrossModelsCached(queryRow.query, context.domain);
      } catch (err: any) {
        responses = [
          {
            model: 'system-error',
            text: `Model execution failed: ${err?.message || 'unknown error'}`,
          },
        ];
      }

      for (const response of responses) {
        await saveTrackingResult({
          runId: context.runId,
          queryId: queryRow.id,
          model: response.model,
          text: response.text,
          domain: context.domain,
          competitorDomains: context.competitorDomains,
        });
      }

      completed += 1;
      await updateRunProgress(context.runId, completed);
    });

    await updateRunStatus(context.runId, 'completed');
  } catch (err: any) {
    await updateRunStatus(context.runId, 'failed', err?.message || 'unknown error');
    throw err;
  }
}

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
      console.log(`[TrackingWorker] Processing run ${job.data.runId}`);
      await processTrackingJob(job.data);
      console.log(`[TrackingWorker] Completed run ${job.data.runId}`);
    },
    {
      connection,
      concurrency: 2,
      limiter: { max: 20, duration: 60_000 },
    },
  );

  workerInstance.on('failed', (job, err) => {
    console.error(`[TrackingWorker] Job ${job?.id || 'unknown'} failed: ${err?.message || String(err)}`);
  });

  console.log('[TrackingWorker] Tracking worker started');
}
