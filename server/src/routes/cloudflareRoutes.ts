import { Router, type Request, type Response } from 'express';
import { authRequired } from '../middleware/authRequired.js';
import {
  getLatestCloudflareSignal,
  ingestCloudflareMetrics,
  listCloudflareSignalHistory,
} from '../services/cloudflareMetricsService.js';

const router = Router();
router.use(authRequired);

router.post('/ingest', async (req: Request, res: Response) => {
  try {
    const userId = String((req as any).user?.id || '').trim();
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const url = String(req.body?.url || '').trim();
    const workspaceId = req.body?.workspace_id ? String(req.body.workspace_id) : null;
    const lookbackMinutes = Number(req.body?.lookback_minutes || 60);

    if (!url) return res.status(400).json({ success: false, error: 'url is required' });

    const metric = await ingestCloudflareMetrics({
      url,
      userId,
      workspaceId,
      lookbackMinutes,
    });

    return res.json({ success: true, metric });
  } catch (err: any) {
    const message = String(err?.message || err || 'Unable to ingest Cloudflare metrics');
    return res.status(500).json({ success: false, error: message });
  }
});

router.get('/signals', async (req: Request, res: Response) => {
  try {
    const url = String(req.query.url || '').trim();
    const workspaceId = req.query.workspace_id ? String(req.query.workspace_id) : null;
    if (!url) return res.status(400).json({ success: false, error: 'url is required' });

    const signal = await getLatestCloudflareSignal(url, workspaceId);
    if (!signal) return res.status(404).json({ success: false, error: 'No Cloudflare metrics found for this url yet' });

    return res.json({ success: true, signal });
  } catch (err: any) {
    const message = String(err?.message || err || 'Unable to read Cloudflare signals');
    return res.status(500).json({ success: false, error: message });
  }
});

router.get('/history', async (req: Request, res: Response) => {
  try {
    const url = String(req.query.url || '').trim();
    const workspaceId = req.query.workspace_id ? String(req.query.workspace_id) : null;
    const limit = Number(req.query.limit || 24);

    if (!url) return res.status(400).json({ success: false, error: 'url is required' });

    const history = await listCloudflareSignalHistory(url, workspaceId, limit);
    return res.json({ success: true, history });
  } catch (err: any) {
    const message = String(err?.message || err || 'Unable to read Cloudflare signal history');
    return res.status(500).json({ success: false, error: message });
  }
});

export default router;
