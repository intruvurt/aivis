import { Worker } from 'bullmq';
import { getBullMQConnection } from '../infra/queues/connection.js';
import type { AnalyzeCompilerJobData } from '../infra/queues/analyzeCompilerQueue.js';
import {
    failAnalyzeCompilerJob,
    runAnalyzeCompilerPipeline,
} from '../services/pageCompiler/compilerService.js';

let workerInstance: Worker<AnalyzeCompilerJobData> | null = null;

export function startAnalyzeCompilerWorker(): void {
    const connection = getBullMQConnection();
    if (!connection) {
        console.log('[AnalyzeCompilerWorker] Redis not configured - worker disabled');
        return;
    }
    if (workerInstance) return;

    workerInstance = new Worker<AnalyzeCompilerJobData>(
        'analyze-compiler',
        async (job) => {
            try {
                await runAnalyzeCompilerPipeline(job.data.jobId);
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                await failAnalyzeCompilerJob(job.data.jobId, message);
                throw err;
            }
        },
        {
            connection,
            concurrency: 4,
            limiter: { max: 20, duration: 60_000 },
        },
    );

    workerInstance.on('failed', (job, err) => {
        console.error(`[AnalyzeCompilerWorker] Job ${job?.id ?? 'unknown'} failed: ${err?.message || String(err)}`);
    });

    console.log('[AnalyzeCompilerWorker] started');
}
