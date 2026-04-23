import { Router, type Request, type Response } from 'express';
import {
    runStageCommand,
} from '../services/pageCompiler/compilerService.js';
import type { AnalyzeStageCommand } from '../services/pageCompiler/types.js';

const router = Router();

function authorizeInternal(req: Request): boolean {
    const required = String(process.env.INTERNAL_PIPELINE_KEY || '').trim();
    if (!required) return true;
    const provided = String(req.headers['x-internal-key'] || '').trim();
    return provided.length > 0 && provided === required;
}

async function handleStage(req: Request, res: Response, command: AnalyzeStageCommand): Promise<Response> {
    if (!authorizeInternal(req)) {
        return res.status(401).json({ error: 'Unauthorized internal request' });
    }

    const jobId = String(req.body?.jobId || req.params.jobId || '').trim();
    if (!jobId) {
        return res.status(400).json({ error: 'jobId is required' });
    }

    try {
        await runStageCommand(jobId, command);
        return res.json({ success: true, jobId, stage: command });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return res.status(409).json({ success: false, jobId, stage: command, error: message });
    }
}

router.post('/scan', async (req, res) => handleStage(req, res, 'scan'));
router.post('/entities/resolve', async (req, res) => handleStage(req, res, 'entities'));
router.post('/visibility/gaps', async (req, res) => handleStage(req, res, 'gaps'));
router.post('/pages/spec', async (req, res) => handleStage(req, res, 'pagespec'));
router.post('/pages/compile', async (req, res) => handleStage(req, res, 'compile'));
router.post('/schema/bind', async (req, res) => handleStage(req, res, 'schema'));
router.post('/graph/link', async (req, res) => handleStage(req, res, 'graph'));

// Optional direct job routes for operators
router.post('/scan/:jobId', async (req, res) => handleStage(req, res, 'scan'));
router.post('/entities/resolve/:jobId', async (req, res) => handleStage(req, res, 'entities'));
router.post('/visibility/gaps/:jobId', async (req, res) => handleStage(req, res, 'gaps'));
router.post('/pages/spec/:jobId', async (req, res) => handleStage(req, res, 'pagespec'));
router.post('/pages/compile/:jobId', async (req, res) => handleStage(req, res, 'compile'));
router.post('/schema/bind/:jobId', async (req, res) => handleStage(req, res, 'schema'));
router.post('/graph/link/:jobId', async (req, res) => handleStage(req, res, 'graph'));

export default router;
