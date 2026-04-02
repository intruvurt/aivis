import { Router, Request, Response } from 'express';
import { authRequired } from '../middleware/authRequired.js';
import { enqueueAuditJob, getAuditJob } from '../infra/queues/auditQueue.js';

const router = Router();

router.post('/audit', authRequired, async (req: Request, res: Response) => {
  const userId = String((req as any).user?.id || '');
  const url = String(req.body?.url || '').trim();
  const priority = req.body?.priority === 'high' || req.body?.repeatAudit === true ? 'high' : 'normal';
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
  if (!url) return res.status(400).json({ success: false, error: 'url is required' });

  const job = await enqueueAuditJob({ url, userId, workspaceId: (req as any).workspace?.id, priority });
  return res.json({ success: true, jobId: String(job) });
});

router.get('/audit/progress/:jobId', authRequired, async (req: Request, res: Response) => {
  const jobId = String(req.params.jobId || '');
  const job = await getAuditJob(jobId);
  if (!job) return res.status(404).json({ success: false, error: 'Job not found' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const send = async () => {
    const latest = await getAuditJob(jobId);
    if (!latest) return;
    const payload = {
      jobId: String(latest.id),
      state: latest.state,
      stage: latest.stage,
      progress: latest.progress || 0,
      failedReason: latest.error || null,
      hints: latest.hints || [],
      result: latest.result || null,
    };
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
    if (latest.state === 'completed' || latest.state === 'failed') {
      clearInterval(tick);
      res.end();
    }
  };

  const tick = setInterval(send, 1000);
  void send();

  req.on('close', () => {
    clearInterval(tick);
  });
});

export default router;