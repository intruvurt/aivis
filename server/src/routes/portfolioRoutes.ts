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

export default router;
