import { Router, type Request, type Response } from 'express';
import { authRequired } from '../middleware/authRequired.js';
import { workspaceRequired } from '../middleware/workspaceRequired.js';
import { meetsMinimumTier } from '../../../shared/types.js';
import type { CanonicalTier, LegacyTier } from '../../../shared/types.js';
import {
  buildOutreachPreview,
  buildViralReportSnippet,
  getDailyGrowthDigest,
  redeemReferralBonus,
  runAutoLeadEngine,
} from '../services/growthEngineService.js';

const router = Router();
router.use(authRequired);
router.use(workspaceRequired);

function requireGrowthTier(req: Request, res: Response): boolean {
  const userTier = ((req as any).user?.tier || 'observer') as CanonicalTier | LegacyTier;
  if (!meetsMinimumTier(userTier, 'alignment')) {
    res.status(403).json({
      success: false,
      error: 'Growth engine automation requires Alignment or higher.',
      requiredTier: 'alignment',
    });
    return false;
  }
  return true;
}

router.post('/lead-engine/run', async (req: Request, res: Response) => {
  if (!requireGrowthTier(req, res)) return;
  const userId = String((req as any).user?.id || '').trim();
  const targets = Array.isArray(req.body?.targets) ? req.body.targets : [];
  if (!targets.length) return res.status(400).json({ success: false, error: 'targets array is required' });

  const normalized = targets
    .map((t: any) => ({
      domain: String(t?.domain || '').trim(),
      source: (['saas_directory', 'local_business', 'startup_list', 'manual'].includes(String(t?.source || 'manual'))
        ? String(t?.source || 'manual')
        : 'manual') as 'saas_directory' | 'local_business' | 'startup_list' | 'manual',
    }))
    .filter((t: any) => !!t.domain);

  const result = await runAutoLeadEngine(userId, normalized);
  return res.json({ success: true, ...result });
});

router.post('/outreach/preview', async (req: Request, res: Response) => {
  if (!requireGrowthTier(req, res)) return;
  const domain = String(req.body?.domain || '').trim();
  const reportUrl = String(req.body?.reportUrl || '').trim();
  if (!domain || !reportUrl) return res.status(400).json({ success: false, error: 'domain and reportUrl are required' });

  const message = await buildOutreachPreview(domain, reportUrl);
  return res.json({ success: true, message });
});

router.get('/digest/daily', async (req: Request, res: Response) => {
  if (!requireGrowthTier(req, res)) return;
  const limit = Number(req.query.limit || 10);
  const digest = await getDailyGrowthDigest(limit);
  return res.json({ success: true, ...digest });
});

router.post('/referrals/redeem', async (req: Request, res: Response) => {
  const userId = String((req as any).user?.id || '').trim();
  const referralCode = String(req.body?.referralCode || '').trim();
  const convertedUserId = String(req.body?.convertedUserId || '').trim();

  if (!referralCode || !convertedUserId) {
    return res.status(400).json({ success: false, error: 'referralCode and convertedUserId are required' });
  }

  const result = await redeemReferralBonus({ userId, referralCode, convertedUserId });
  return res.json({ success: true, ...result });
});

router.post('/viral/snippet', async (req: Request, res: Response) => {
  if (!requireGrowthTier(req, res)) return;
  const domain = String(req.body?.domain || '').trim();
  const score = Number(req.body?.score || 0);
  const competitorScore = Number(req.body?.competitorScore || 0);
  if (!domain) return res.status(400).json({ success: false, error: 'domain is required' });

  return res.json({
    success: true,
    snippet: buildViralReportSnippet({ domain, score, competitorScore }),
  });
});

export default router;
