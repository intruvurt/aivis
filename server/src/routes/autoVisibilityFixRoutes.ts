import { Router, type Request, type Response } from 'express';
import { authRequired } from '../middleware/authRequired.js';
import { buildFixPlan, verifyFixLoop } from '../services/autoVisibilityFixEngine.js';

const router = Router();
router.use(authRequired);

router.post('/plan', async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const domain = String(body.domain || '').trim();
    const issues = Array.isArray(body.issues) ? body.issues : [];

    if (!domain) return res.status(400).json({ success: false, error: 'domain is required' });
    if (!issues.length) return res.status(400).json({ success: false, error: 'issues array is required' });

    const plan = buildFixPlan({
      domain,
      issues,
      yourMentionRate: Number(body.yourMentionRate ?? 0),
      competitorMentionRate: Number(body.competitorMentionRate ?? 0.65),
      visibilityScore: Number(body.visibilityScore ?? 0),
    });

    return res.json({ success: true, ...plan });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err?.message || 'Failed to build fix plan' });
  }
});

router.post('/verify', async (req: Request, res: Response) => {
  const before = Number(req.body?.beforeScore ?? NaN);
  const after = Number(req.body?.afterScore ?? NaN);
  const changedEvidence = Number(req.body?.changedEvidence ?? 0);

  if (!Number.isFinite(before) || !Number.isFinite(after)) {
    return res.status(400).json({ success: false, error: 'beforeScore and afterScore are required numbers' });
  }

  return res.json({ success: true, verification: verifyFixLoop(before, after, changedEvidence) });
});

export default router;
