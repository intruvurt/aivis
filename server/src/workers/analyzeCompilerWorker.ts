import { Worker } from 'bullmq';
import { getBullMQConnection } from '../infra/queues/connection.js';
import { enqueueAnalyzeCompilerJob, type AnalyzeCompilerJobData } from '../infra/queues/analyzeCompilerQueue.js';
import {
    failAnalyzeCompilerJob,
    runStageCommand,
} from '../services/pageCompiler/compilerService.js';
import type { AnalyzeStageCommand } from '../services/pageCompiler/types.js';

let workerInstance: Worker<AnalyzeCompilerJobData> | null = null;

const NEXT_STAGE: Record<AnalyzeStageCommand, AnalyzeStageCommand | null> = {
    scan: 'entities',
    entities: 'gaps',
    gaps: 'pagespec',
    pagespec: 'compile',
    compile: 'schema',
    schema: 'graph',
    graph: null,
};

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
                await runStageCommand(job.data.jobId, job.data.stage);
                const next = NEXT_STAGE[job.data.stage];
                if (next) {
                    await enqueueAnalyzeCompilerJob({
                        jobId: job.data.jobId,
                        stage: next,
                    });
                }
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
