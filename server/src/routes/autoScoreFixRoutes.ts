/**
 * Auto Score Fix Routes
 *
 * VCS token management + job submission/management for automated PR generation.
 * All routes require authentication.
 * Job submission additionally requires: alignment+ tier AND ≥10 pack credits.
 *
 * FEATURE LOCKED - GitHub remediation mechanism is being redesigned.
 * All endpoints return 503 until the lock is lifted.
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authRequired } from '../middleware/authRequired.js';
import { workspaceRequired } from '../middleware/workspaceRequired.js';
import { meetsMinimumTier } from '../../../shared/types.js';
import type { CanonicalTier, LegacyTier } from '../../../shared/types.js';
import { getAvailablePackCredits } from '../services/scanPackCredits.js';
import {
  AUTO_SCORE_FIX_CREDIT_COST,
  VcsProvider,
  saveVcsToken,
  getVcsToken,
  decryptVcsToken,
  listVcsTokens,
  deleteVcsToken,
  submitAutoScoreFixJob,
  getJobsForUser,
  getJobById,
  approveJob,
  rejectJob,
  cancelJob,
} from '../services/AutoScoreFixService.js';

const router = Router();
const VALID_PROVIDERS: VcsProvider[] = ['github', 'gitlab', 'bitbucket'];

// ── Feature lock ─────────────────────────────────────────────────────────────
// Set to false to re-enable Auto Score Fix once the GitHub remediation flow is ready.
const AUTO_SCORE_FIX_LOCKED = true;

router.use(authRequired);

// When locked, short-circuit all requests with 503
router.use((_req: Request, res: Response, next: NextFunction) => {
  if (AUTO_SCORE_FIX_LOCKED) {
    return res.status(503).json({
      error: 'Auto Score Fix is temporarily unavailable while the remediation pipeline is being upgraded.',
      locked: true,
      retry_after: null,
    });
  }
  next();
});

async function fetchGitHubApi(path: string, token: string) {
  const response = await fetch(`https://api.github.com${path}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'AiVIS-AutoScoreFix/1.0',
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`GitHub API ${response.status}: ${body.slice(0, 240)}`);
  }

  return response.json();
}

// ─── VCS Token Management ─────────────────────────────────────────────────────

/** POST /api/auto-score-fix/tokens - save or update a VCS token (alignment+) */
router.post('/tokens', async (req: Request, res: Response) => {
  const user = (req as any).user;
  const userId = String(user?.id || '');
  const userTier = (user?.tier || 'observer') as CanonicalTier | LegacyTier;

  if (!meetsMinimumTier(userTier, 'alignment')) {
    return res.status(403).json({
      error: 'VCS integration requires Alignment or higher.',
      code: 'TIER_INSUFFICIENT',
      requiredTier: 'alignment',
    });
  }

  const { provider, token } = (req.body || {}) as { provider?: string; token?: string };
  if (!provider || !VALID_PROVIDERS.includes(provider as VcsProvider)) {
    return res.status(400).json({ error: `provider must be one of: ${VALID_PROVIDERS.join(', ')}` });
  }
  if (!token || typeof token !== 'string' || token.trim().length < 8) {
    return res.status(400).json({ error: 'token must be a non-empty string (min 8 chars)' });
  }

  try {
    await saveVcsToken(userId, provider as VcsProvider, token.trim());
    return res.json({ ok: true, provider, hint: token.slice(0, 4) + '****' + token.slice(-4) });
  } catch (err: any) {
    console.error('[AutoScoreFix] Save token error:', err?.message);
    return res.status(500).json({ error: 'Failed to save token' });
  }
});

/** GET /api/auto-score-fix/tokens - list connected providers (hints only) */
router.get('/tokens', async (req: Request, res: Response) => {
  const userId = String((req as any).user?.id || '');
  try {
    const tokens = await listVcsTokens(userId);
    return res.json({ tokens });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to list tokens' });
  }
});

/** DELETE /api/auto-score-fix/tokens/:provider - remove a VCS token */
router.delete('/tokens/:provider', async (req: Request, res: Response) => {
  const userId = String((req as any).user?.id || '');
  const provider = req.params.provider as VcsProvider;
  if (!VALID_PROVIDERS.includes(provider)) {
    return res.status(400).json({ error: 'Invalid provider' });
  }
  try {
    await deleteVcsToken(userId, provider);
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete token' });
  }
});

/** GET /api/auto-score-fix/github/repos - list GitHub repos for connected token */
router.get('/github/repos', async (req: Request, res: Response) => {
  const userId = String((req as any).user?.id || '');
  const perPage = Math.min(100, Math.max(10, Number(req.query.per_page || 50)));

  try {
    const storedToken = await getVcsToken(userId, 'github');
    if (!storedToken) {
      return res.status(400).json({
        error: 'No GitHub token found. Connect GitHub first.',
        code: 'NO_GITHUB_TOKEN',
      });
    }

    const plainToken = decryptVcsToken(storedToken.encrypted);
    const payload = await fetchGitHubApi(`/user/repos?sort=updated&per_page=${perPage}&affiliation=owner,collaborator,organization_member`, plainToken);
    const repos = Array.isArray(payload)
      ? payload.map((repo: any) => ({
          id: repo.id,
          full_name: repo.full_name,
          owner: repo?.owner?.login || '',
          name: repo.name,
          default_branch: repo.default_branch || 'main',
          private: Boolean(repo.private),
          permissions: repo.permissions || {},
          pushed_at: repo.pushed_at || null,
          html_url: repo.html_url || null,
        }))
      : [];

    return res.json({ repos, count: repos.length });
  } catch (err: any) {
    console.error('[AutoScoreFix] GitHub repo list error:', err?.message);
    return res.status(500).json({ error: 'Failed to list GitHub repositories' });
  }
});

/** GET /api/auto-score-fix/github/branches?owner=:owner&repo=:repo */
router.get('/github/branches', async (req: Request, res: Response) => {
  const userId = String((req as any).user?.id || '');
  const owner = String(req.query.owner || '').trim();
  const repo = String(req.query.repo || '').trim();

  if (!owner || !repo) {
    return res.status(400).json({ error: 'owner and repo are required query params' });
  }

  try {
    const storedToken = await getVcsToken(userId, 'github');
    if (!storedToken) {
      return res.status(400).json({
        error: 'No GitHub token found. Connect GitHub first.',
        code: 'NO_GITHUB_TOKEN',
      });
    }

    const plainToken = decryptVcsToken(storedToken.encrypted);
    const payload = await fetchGitHubApi(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?per_page=100`, plainToken);
    const branches = Array.isArray(payload)
      ? payload.map((branch: any) => ({
          name: String(branch?.name || ''),
          sha: String(branch?.commit?.sha || ''),
          protected: Boolean(branch?.protected),
        }))
      : [];

    return res.json({ branches, count: branches.length });
  } catch (err: any) {
    console.error('[AutoScoreFix] GitHub branch list error:', err?.message);
    return res.status(500).json({ error: 'Failed to list GitHub branches' });
  }
});

// ─── Job Submission ───────────────────────────────────────────────────────────

/** POST /api/auto-score-fix/jobs - submit an Auto Score Fix job */
router.post('/jobs', workspaceRequired, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const userId = String(user?.id || '');
  const workspaceId = String((req as any).workspace?.id || '');
  const userTier = (user?.tier || 'observer') as CanonicalTier | LegacyTier;

  // Tier gate: alignment+
  if (!meetsMinimumTier(userTier, 'alignment')) {
    return res.status(403).json({
      error: 'Auto Score Fix requires Alignment or higher.',
      code: 'TIER_INSUFFICIENT',
      requiredTier: 'alignment',
    });
  }

  // Credit gate
  const availableCredits = await getAvailablePackCredits(userId);
  if (availableCredits < AUTO_SCORE_FIX_CREDIT_COST) {
    return res.status(402).json({
      error: `Auto Score Fix requires ${AUTO_SCORE_FIX_CREDIT_COST} credits. You have ${availableCredits.toFixed(2)}.`,
      code: 'INSUFFICIENT_CREDITS',
      required_credits: AUTO_SCORE_FIX_CREDIT_COST,
      available_credits: availableCredits,
    });
  }

  const body = (req.body || {}) as {
    audit_id?: string;
    target_url?: string;
    vcs_provider?: string;
    repo_owner?: string;
    repo_name?: string;
    repo_branch?: string;
    audit_evidence?: Record<string, unknown>;
  };

  const targetUrl = String(body.target_url || '').trim();
  const vcsProvider = String(body.vcs_provider || '').toLowerCase() as VcsProvider;
  const repoOwner = String(body.repo_owner || '').trim();
  const repoName = String(body.repo_name || '').trim();
  const repoBranch = String(body.repo_branch || 'main').trim();

  if (!targetUrl) return res.status(400).json({ error: 'target_url is required' });
  if (!VALID_PROVIDERS.includes(vcsProvider)) {
    return res.status(400).json({ error: `vcs_provider must be one of: ${VALID_PROVIDERS.join(', ')}` });
  }
  if (!repoOwner || !repoName) {
    return res.status(400).json({ error: 'repo_owner and repo_name are required' });
  }
  if (!body.audit_evidence || typeof body.audit_evidence !== 'object') {
    return res.status(400).json({ error: 'audit_evidence payload is required' });
  }

  // Retrieve encrypted token
  const storedToken = await getVcsToken(userId, vcsProvider);
  if (!storedToken) {
    return res.status(400).json({
      error: `No ${vcsProvider} token found. Connect your token first via POST /api/auto-score-fix/tokens.`,
      code: 'NO_VCS_TOKEN',
    });
  }

  try {
    const jobId = await submitAutoScoreFixJob({
      userId,
      workspaceId,
      auditId: body.audit_id,
      targetUrl,
      vcsProvider,
      repoOwner,
      repoName,
      repoBranch,
      encryptedToken: storedToken.encrypted,
      auditEvidence: body.audit_evidence as any,
    });

    return res.status(202).json({
      ok: true,
      job_id: jobId,
      message: 'Auto Score Fix job submitted. PR will be created within 60–90 seconds.',
      credits_reserved: AUTO_SCORE_FIX_CREDIT_COST,
      expires_in_hours: 48,
      refund_policy: 'Cancel before PR approval: 100% refund while generating, 80% refund once PR is pending approval (or after 49h expiry).',
    });
  } catch (err: any) {
    console.error('[AutoScoreFix] Job submission error:', err?.message);
    return res.status(500).json({ error: err?.message || 'Failed to submit job' });
  }
});

// ─── Job Retrieval ────────────────────────────────────────────────────────────

/** GET /api/auto-score-fix/jobs - list user's jobs */
router.get('/jobs', workspaceRequired, async (req: Request, res: Response) => {
  const userId = String((req as any).user?.id || '');
  const workspaceId = String((req as any).workspace?.id || '');
  const limit = Math.min(50, Math.max(1, Number(req.query.limit || 20)));
  try {
    const jobs = await getJobsForUser(userId, workspaceId, limit);
    return res.json({ jobs, count: jobs.length });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve jobs' });
  }
});

/** GET /api/auto-score-fix/jobs/:id - get a specific job */
router.get('/jobs/:id', workspaceRequired, async (req: Request, res: Response) => {
  const userId = String((req as any).user?.id || '');
  const workspaceId = String((req as any).workspace?.id || '');
  const jobId = String(req.params.id || '');
  try {
    const job = await getJobById(jobId, userId, workspaceId);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    return res.json({ job });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve job' });
  }
});

// ─── Job Actions ──────────────────────────────────────────────────────────────

/** POST /api/auto-score-fix/jobs/:id/approve */
router.post('/jobs/:id/approve', workspaceRequired, async (req: Request, res: Response) => {
  const userId = String((req as any).user?.id || '');
  const workspaceId = String((req as any).workspace?.id || '');
  const jobId = String(req.params.id || '');
  try {
    const result = await approveJob(jobId, userId, workspaceId);
    if (!result.ok) {
      return res.status(404).json({ error: 'Job not found or not in pending_approval state' });
    }
    return res.json({ ok: true, message: 'Job approved. Merge the PR at your convenience.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to approve job' });
  }
});

/** POST /api/auto-score-fix/jobs/:id/reject - 80% credit refund */
router.post('/jobs/:id/reject', workspaceRequired, async (req: Request, res: Response) => {
  const userId = String((req as any).user?.id || '');
  const workspaceId = String((req as any).workspace?.id || '');
  const jobId = String(req.params.id || '');
  try {
    const result = await rejectJob(jobId, userId, workspaceId);
    if (!result.ok) {
      return res.status(404).json({ error: 'Job not found or not in pending_approval state' });
    }
    return res.json({
      ok: true,
      refund_credits: result.refund,
      message: `Job rejected. ${result.refund} credits (80%) have been returned to your balance.`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to reject job' });
  }
});

/** POST /api/auto-score-fix/jobs/:id/cancel - cancel job with policy-based refund */
router.post('/jobs/:id/cancel', workspaceRequired, async (req: Request, res: Response) => {
  const userId = String((req as any).user?.id || '');
  const workspaceId = String((req as any).workspace?.id || '');
  const jobId = String(req.params.id || '');
  try {
    const result = await cancelJob(jobId, userId, workspaceId);
    if (!result.ok) {
      return res.status(404).json({ error: 'Job not found or not in a cancelable state' });
    }

    const policy = result.status === 'cancelled'
      ? 'Cancelled before PR approval - full refund applied.'
      : 'PR was pending approval - 80% rejection refund applied.';

    return res.json({
      ok: true,
      refund_credits: result.refund,
      status: result.status,
      message: `${policy} Refunded ${result.refund} credits.`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to cancel job' });
  }
});

export default router;
// ─── Status / Eligibility Check ──────────────────────────────────────────────

/** GET /api/auto-score-fix/status - credit balance + tier eligibility (no workspace required) */
router.get('/status', async (req: Request, res: Response) => {
  const user = (req as any).user;
  const userId = String(user?.id || '');
  const userTier = (user?.tier || 'observer') as CanonicalTier | LegacyTier;

  const tierEligible = meetsMinimumTier(userTier, 'alignment');

  let availableCredits = 0;
  try {
    availableCredits = await getAvailablePackCredits(userId);
  } catch { /* non-fatal */ }

  return res.json({
    tier: userTier,
    tier_eligible: tierEligible,
    available_credits: availableCredits,
    required_credits: AUTO_SCORE_FIX_CREDIT_COST,
    eligible: tierEligible && availableCredits >= AUTO_SCORE_FIX_CREDIT_COST,
  });
});
