import { Router, type Request, type Response } from 'express';
import { authRequired } from '../middleware/authRequired.js';
import { workspaceRequired } from '../middleware/workspaceRequired.js';
import { usageGate } from '../middleware/usageGate.js';
import { enqueueAnalyzeCompilerJob } from '../infra/queues/analyzeCompilerQueue.js';
import {
    createAnalyzeCompilerJob,
    getAnalyzeCompilerJob,
    publishAnalyzeCompilerJob,
    rescanAnalyzeCompilerJob,
} from '../services/pageCompiler/compilerService.js';

const router = Router();

router.post(
    '/compiler',
    authRequired,
    workspaceRequired,
    usageGate,
    async (req: Request, res: Response) => {
        try {
            const userId = String((req as any).user?.id || '').trim();
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const payload = {
                input: String(req.body?.input || '').trim(),
                source: req.body?.source,
                mode: req.body?.mode,
                depth: req.body?.depth,
                idempotencyKey: req.body?.idempotencyKey,
            };

            const created = await createAnalyzeCompilerJob({
                userId,
                workspaceId: (req as any).workspace?.id || null,
                payload,
            });

            if (created.queued) {
                await enqueueAnalyzeCompilerJob({ jobId: created.jobId, stage: 'scan' });
            }

            return res.status(202).json({
                job_id: created.jobId,
                status: created.queued ? 'queued' : 'existing',
                next: `/api/analyze/compiler/${created.jobId}`,
            });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            return res.status(400).json({ error: message });
        }
    },
);

router.get(
    '/compiler/:jobId',
    authRequired,
    workspaceRequired,
    async (req: Request, res: Response) => {
        const job = await getAnalyzeCompilerJob(String(req.params.jobId || ''));
        if (!job) return res.status(404).json({ error: 'Job not found' });
        return res.json(job);
    },
);

router.post(
    '/compiler/:jobId/publish',
    authRequired,
    workspaceRequired,
    async (req: Request, res: Response) => {
        const jobId = String(req.params.jobId || '');
        await publishAnalyzeCompilerJob(jobId);
        const job = await getAnalyzeCompilerJob(jobId);
        return res.json({ success: true, job });
    },
);

router.post(
    '/compiler/:jobId/rescan',
    authRequired,
    workspaceRequired,
    async (req: Request, res: Response) => {
        const result = await rescanAnalyzeCompilerJob(String(req.params.jobId || ''));
        return res.json({ success: true, ...result });
    },
);

export default router;
