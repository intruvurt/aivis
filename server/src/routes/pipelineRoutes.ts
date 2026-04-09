/**
 * Pipeline Routes (Self-Healing Audit Pipeline)
 *
 * POST   /api/pipeline/run            - Execute a new pipeline run (scan → score → classify → fixpacks)
 * GET    /api/pipeline                 - List pipeline runs for the current user
 * GET    /api/pipeline/:id             - Get details of a specific pipeline run
 * POST   /api/pipeline/:id/approve     - Approve fixpacks for application
 * POST   /api/pipeline/:id/rescan      - Trigger a verification rescan after fixes applied
 * GET    /api/pipeline/:id/uplift      - Get uplift proof for a completed rescan
 */

import { Router, type Request, type Response } from 'express';
import { authRequired } from '../middleware/authRequired.js';
import { enforceFeatureGate } from '../middleware/featureGate.js';
import { normalizePublicHttpUrl } from '../lib/urlSafety.js';
import {
  executePipeline,
  getPipelineRun,
  listPipelineRuns,
} from '../services/pipelineOrchestrator.js';
import { verifyRescan } from '../services/rescanVerificationService.js';
import { scrapeWebsite } from '../services/scraper.js';
import type { RemediationMode } from '../../../shared/types.js';

const VALID_MODES = new Set<RemediationMode>(['advisory', 'assisted', 'autonomous']);

const router = Router();
router.use(authRequired);
// Pipeline requires at least Alignment tier
router.use(enforceFeatureGate('alignment'));

// ─── POST /api/pipeline/run ─────────────────────────────────────────────────

router.post('/run', async (req: Request, res: Response) => {
  const userId = String((req as any).user?.id || '').trim();
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const rawUrl = req.body?.url;
  const mode = String(req.body?.mode || 'advisory') as RemediationMode;
  const auditId = req.body?.audit_id ? String(req.body.audit_id) : undefined;
  const workspaceId = req.body?.workspace_id ? String(req.body.workspace_id) : undefined;

  if (!rawUrl || typeof rawUrl !== 'string') {
    return res.status(400).json({ error: 'url is required' });
  }

  if (!VALID_MODES.has(mode)) {
    return res.status(400).json({ error: `Invalid mode. Must be one of: ${[...VALID_MODES].join(', ')}` });
  }

  // URL validation (SSRF protection)
  const urlResult = normalizePublicHttpUrl(String(rawUrl).trim(), {
    allowPrivate: process.env.NODE_ENV !== 'production',
  });
  if (!urlResult.ok) {
    return res.status(400).json({ error: urlResult.error, code: 'URL_VALIDATION_FAILED' });
  }

  try {
    // Scrape the target URL
    const scrapeResult = await scrapeWebsite(urlResult.url);

    // Execute the pipeline
    const output = await executePipeline({
      userId,
      workspaceId,
      targetUrl: urlResult.url,
      auditId,
      mode,
      scrapeResult,
    });

    return res.json({
      success: true,
      run: output.run,
      scoring: output.scoring,
      classification: output.classification,
      fixpacks: output.fixpacks,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Pipeline execution failed';
    return res.status(500).json({ error: message });
  }
});

// ─── GET /api/pipeline ──────────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response) => {
  const userId = String((req as any).user?.id || '').trim();
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const limit = Math.min(Math.max(1, Number(String(req.query.limit)) || 20), 100);
  const offset = Math.max(0, Number(String(req.query.offset)) || 0);

  try {
    const result = await listPipelineRuns(userId, limit, offset);
    return res.json({ success: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to list pipeline runs';
    return res.status(500).json({ error: message });
  }
});

// ─── GET /api/pipeline/:id ──────────────────────────────────────────────────

router.get('/:id', async (req: Request, res: Response) => {
  const userId = String((req as any).user?.id || '').trim();
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const runId = String(req.params.id);
  if (!runId) return res.status(400).json({ error: 'Run ID is required' });

  try {
    const run = await getPipelineRun(runId, userId);
    if (!run) return res.status(404).json({ error: 'Pipeline run not found' });
    return res.json({ success: true, run });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to get pipeline run';
    return res.status(500).json({ error: message });
  }
});

// ─── POST /api/pipeline/:id/approve ─────────────────────────────────────────

router.post('/:id/approve', async (req: Request, res: Response) => {
  const userId = String((req as any).user?.id || '').trim();
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const runId = String(req.params.id);
  if (!runId) return res.status(400).json({ error: 'Run ID is required' });

  try {
    const run = await getPipelineRun(runId, userId);
    if (!run) return res.status(404).json({ error: 'Pipeline run not found' });

    if (run.status !== 'awaiting_approval') {
      return res.status(409).json({
        error: 'Run is not awaiting approval',
        current_status: run.status,
      });
    }

    // For now, approve transitions the run to completed
    // In future phases, this would trigger PR generation or auto-apply
    const { getPool } = await import('../services/postgresql.js');
    await getPool().query(
      `UPDATE pipeline_runs SET status = 'applying', updated_at = NOW() WHERE id = $1`,
      [runId],
    );

    return res.json({ success: true, status: 'applying' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to approve pipeline run';
    return res.status(500).json({ error: message });
  }
});

// ─── POST /api/pipeline/:id/rescan ──────────────────────────────────────────

router.post('/:id/rescan', async (req: Request, res: Response) => {
  const userId = String((req as any).user?.id || '').trim();
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const runId = String(req.params.id);
  if (!runId) return res.status(400).json({ error: 'Run ID is required' });

  try {
    const run = await getPipelineRun(runId, userId);
    if (!run) return res.status(404).json({ error: 'Pipeline run not found' });

    if (!['completed', 'applying'].includes(run.status)) {
      return res.status(409).json({
        error: 'Run must be completed or applying before rescanning',
        current_status: run.status,
      });
    }

    const uplift = await verifyRescan(runId, userId);
    return res.json({ success: true, uplift });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Rescan verification failed';
    return res.status(500).json({ error: message });
  }
});

// ─── GET /api/pipeline/:id/uplift ───────────────────────────────────────────

router.get('/:id/uplift', async (req: Request, res: Response) => {
  const userId = String((req as any).user?.id || '').trim();
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const runId = String(req.params.id);
  if (!runId) return res.status(400).json({ error: 'Run ID is required' });

  try {
    const run = await getPipelineRun(runId, userId);
    if (!run) return res.status(404).json({ error: 'Pipeline run not found' });

    if (!run.rescan_uplift) {
      return res.status(404).json({ error: 'No rescan uplift data available yet' });
    }

    return res.json({ success: true, uplift: run.rescan_uplift });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to get uplift data';
    return res.status(500).json({ error: message });
  }
});

export default router;
