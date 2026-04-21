import { Worker } from 'bullmq';
import { getBullMQConnection } from '../infra/queues/connection.js';
import type { RawDocumentEvent } from '../infra/queues/rawDocumentQueue.js';
import { processRawDocumentEvent } from '../services/deepAnalysisClient.js';
import { persistRawDocumentEdges } from '../services/citationGraphPersistence.js';

let workerInstance: Worker<RawDocumentEvent> | null = null;

async function processJob(data: RawDocumentEvent): Promise<{
    docId: string;
    scanId?: string;
    persistedEntityIds: string[];
    persistedClaimIds: string[];
    touchedClusterIds: string[];
    conflictEdgesCreated: number;
    edgesCreated: number;
    entitiesUpdated: string[];
}> {
    const result = await processRawDocumentEvent(data);
    if (!result) {
        console.warn(`[RawDocumentWorker] Python unavailable for doc ${data.docId}`);
        return {
            docId: data.docId,
            persistedEntityIds: [],
            persistedClaimIds: [],
            touchedClusterIds: [],
            conflictEdgesCreated: 0,
            edgesCreated: 0,
            entitiesUpdated: [],
        };
    }

    const persisted = await persistRawDocumentEdges(data, result.edges || []);

    console.log(
        `[RawDocumentWorker] doc=${data.docId} edges=${result.edgesCreated} entities=${result.entitiesUpdated.length} claims=${persisted.persistedClaims} clusters=${persisted.touchedClusters}`
    );

    return {
        docId: data.docId,
        scanId: persisted.scanId,
        persistedEntityIds: persisted.persistedEntityIds,
        persistedClaimIds: persisted.persistedClaimIds,
        touchedClusterIds: persisted.touchedClusterIds,
        conflictEdgesCreated: persisted.conflictEdgesCreated,
        edgesCreated: result.edgesCreated,
        entitiesUpdated: result.entitiesUpdated,
    };
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
