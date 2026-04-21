import { Worker } from 'bullmq';
import { getBullMQConnection } from '../infra/queues/connection.js';
import type { RawDocumentEvent } from '../infra/queues/rawDocumentQueue.js';
import { processRawDocumentEvent } from '../services/deepAnalysisClient.js';

let workerInstance: Worker<RawDocumentEvent> | null = null;

async function processJob(data: RawDocumentEvent): Promise<void> {
    const result = await processRawDocumentEvent(data);
    if (!result) {
        console.warn(`[RawDocumentWorker] Python unavailable for doc ${data.docId}`);
        return;
    }

    console.log(
        `[RawDocumentWorker] doc=${data.docId} edges=${result.edgesCreated} entities=${result.entitiesUpdated.length}`
    );
}

export function startRawDocumentWorker(): void {
    const connection = getBullMQConnection();
    if (!connection) {
        console.log('[RawDocumentWorker] Redis not configured - ingestion worker disabled');
        return;
    }
    if (workerInstance) return;

    workerInstance = new Worker<RawDocumentEvent>(
        'raw-document',
        async (job) => {
            await processJob(job.data);
        },
        {
            connection,
            concurrency: 8,
        }
    );

    workerInstance.on('failed', (job, err) => {
        console.error(`[RawDocumentWorker] Job ${job?.id ?? 'unknown'} failed: ${err?.message || String(err)}`);
    });

    console.log('[RawDocumentWorker] started');
}
