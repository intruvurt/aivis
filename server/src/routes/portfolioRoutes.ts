import { Router, type Request, type Response } from 'express';
import { authRequired } from '../middleware/authRequired.js';
import { workspaceRequired } from '../middleware/workspaceRequired.js';
import { meetsMinimumTier } from '../../../shared/types.js';
import type { CanonicalTier, LegacyTier } from '../../../shared/types.js';
import {
  createPortfolioProject,
  getPortfolioOverview,
  listPortfolioProjects,
  listPortfolioTasks,
  runPortfolioDailyAutomation,
  updatePortfolioTaskStatus,
  runBulkFix,
  getBulkFixJob,
} from '../services/agencyAutomationService.js';

const router = Router();
router.use(authRequired);
router.use(workspaceRequired);

function requirePortfolioTier(req: Request, res: Response): boolean {
  const userTier = ((req as any).user?.tier || 'observer') as CanonicalTier | LegacyTier;
  if (!meetsMinimumTier(userTier, 'alignment')) {
    res.status(403).json({
      success: false,
      error: 'Portfolio automation requires Alignment or higher.',
      requiredTier: 'alignment',
    });
    return false;
  }
  return true;
}

function requireAgencyTier(req: Request, res: Response): boolean {
  const userTier = ((req as any).user?.tier || 'observer') as CanonicalTier | LegacyTier;
  if (!meetsMinimumTier(userTier, 'signal')) {
    res.status(403).json({
      success: false,
      error: 'Bulk fix and agency features require Signal tier or higher.',
      requiredTier: 'signal',
    });
    return false;
  }
  return true;
}

router.get('/overview', async (req: Request, res: Response) => {
  if (!requirePortfolioTier(req, res)) return;
  const userId = String((req as any).user?.id || '').trim();
  const portfolio = await getPortfolioOverview(userId);
  return res.json({ success: true, portfolio });
});

router.get('/projects', async (req: Request, res: Response) => {
  if (!requirePortfolioTier(req, res)) return;
  const userId = String((req as any).user?.id || '').trim();
  const projects = await listPortfolioProjects(userId);
  return res.json({ success: true, projects });
});

router.post('/projects', async (req: Request, res: Response) => {
  if (!requirePortfolioTier(req, res)) return;
  const userId = String((req as any).user?.id || '').trim();
  const organizationName = String(req.body?.organization_name || '').trim();
  const domain = String(req.body?.domain || '').trim();
  const plan = String(req.body?.plan || 'observer').trim();

  if (!organizationName || !domain) {
    return res.status(400).json({ success: false, error: 'organization_name and domain are required' });
  }

  const project = await createPortfolioProject({ userId, organizationName, domain, plan });
  return res.json({ success: true, project });
});

router.post('/run-daily', async (req: Request, res: Response) => {
  if (!requirePortfolioTier(req, res)) return;
  const userId = String((req as any).user?.id || '').trim();
  const queued = await runPortfolioDailyAutomation(userId);
  return res.json({ success: true, ...queued });
});

router.get('/tasks', async (req: Request, res: Response) => {
  if (!requirePortfolioTier(req, res)) return;
  const userId = String((req as any).user?.id || '').trim();
  const tasks = await listPortfolioTasks(userId);
  return res.json({ success: true, tasks });
});

router.patch('/tasks/:id', async (req: Request, res: Response) => {
  if (!requirePortfolioTier(req, res)) return;
  const userId = String((req as any).user?.id || '').trim();
  const taskId = String(req.params.id || '').trim();
  const status = String(req.body?.status || '').trim();
  if (!taskId || !status) return res.status(400).json({ success: false, error: 'task id and status are required' });

  const updated = await updatePortfolioTaskStatus(userId, taskId, status);
  if (!updated) return res.status(404).json({ success: false, error: 'task not found' });
  return res.json({ success: true, task: updated });
});

// ── Agency-tier: Bulk fix ─────────────────────────────────────────────────────

/**
 * POST /api/portfolio/bulk-fix
 * Enqueues a bulk fix job across multiple portfolio projects.
 * Body: { project_ids: string[], fix_type: string }
 */
router.post('/bulk-fix', async (req: Request, res: Response) => {
  if (!requireAgencyTier(req, res)) return;
  const userId = String((req as any).user?.id || '').trim();
  const workspaceId = String((req as any).workspace?.id || '').trim();
  const projectIds: string[] = Array.isArray(req.body?.project_ids) ? req.body.project_ids : [];
  const fixType = String(req.body?.fix_type || 'schema').trim();

  if (!projectIds.length) {
    return res.status(400).json({ success: false, error: 'project_ids array is required and must not be empty' });
  }
  if (projectIds.length > 200) {
    return res.status(400).json({ success: false, error: 'Maximum 200 projects per bulk-fix job' });
  }

  const job = await runBulkFix({ userId, workspaceId, projectIds, fixType });
  return res.status(202).json({ success: true, job });
});

/**
 * GET /api/portfolio/bulk-fix/:jobId - Poll bulk-fix job progress
 */
router.get('/bulk-fix/:jobId', async (req: Request, res: Response) => {
  if (!requireAgencyTier(req, res)) return;
  const userId = String((req as any).user?.id || '').trim();
  const jobId = String(req.params.jobId || '').trim();

  const job = await getBulkFixJob(userId, jobId);
  if (!job) return res.status(404).json({ success: false, error: 'Bulk fix job not found' });
  return res.json({ success: true, job });
});

export default router;
