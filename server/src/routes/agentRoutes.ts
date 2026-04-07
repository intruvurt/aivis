// server/src/routes/agentRoutes.ts
import { Router, type Request, type Response } from 'express';
import { authRequired } from '../middleware/authRequired.js';
import {
  createTask,
  getUserTasks,
  cancelTask,
  type AgentTaskType,
} from '../services/agentTaskService.js';
import type { CanonicalTier } from '../../../shared/types.js';

const VALID_TASK_TYPES: AgentTaskType[] = [
  'schedule_audits',
  'run_citation_test',
  'add_competitor',
  'scan_mentions',
  'schedule_rescan',
];

const router = Router();

// GET /api/agent/tasks - list user's tasks
router.get('/tasks', authRequired, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const limit = Math.min(Math.max(1, Number(req.query.limit) || 20), 50);
    const tasks = await getUserTasks(userId, limit);
    return res.json({ tasks });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// POST /api/agent/tasks - create a new task
router.post('/tasks', authRequired, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const tier = ((req as any).user?.tier || 'observer') as CanonicalTier;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { task_type, payload } = req.body || {};
    if (!task_type || !VALID_TASK_TYPES.includes(task_type)) {
      return res.status(400).json({ error: `Invalid task_type. Must be one of: ${VALID_TASK_TYPES.join(', ')}` });
    }

    const task = await createTask(userId, task_type, payload || {}, tier);
    return res.status(201).json({ task });
  } catch (err: any) {
    const status = err.message?.includes('limit reached') ? 429 : 500;
    return res.status(status).json({ error: 'Failed to create task' });
  }
});

// DELETE /api/agent/tasks/:id - cancel a pending task
router.delete('/tasks/:id', authRequired, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const cancelled = await cancelTask(userId, String(req.params.id));
    if (!cancelled) {
      return res.status(404).json({ error: 'Task not found or not cancellable' });
    }
    return res.json({ cancelled: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to cancel task' });
  }
});

export default router;
