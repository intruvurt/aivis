/**
 * GitHub App Routes
 *
 * Handles GitHub App installation lifecycle, webhooks, and repo introspection
 * for the AiVIS AutoFix Engine.
 *
 * Webhook endpoint is unauthenticated (verified via HMAC-SHA256 signature).
 * All other endpoints require user authentication.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import express from 'express';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { authRequired } from '../middleware/authRequired.js';
import { workspaceRequired } from '../middleware/workspaceRequired.js';
import { requireWorkspacePermission } from '../middleware/workspacePermission.js';
import {
  isGitHubAppConfigured,
  verifyWebhookSignature,
  saveInstallation,
  getInstallationForUser,
  getInstallationForWorkspace,
  getInstallationById,
  suspendInstallation,
  removeInstallation,
  unsuspendInstallation,
  listInstallationRepos,
  listInstallationBranches,
} from '../services/githubAppService.js';
import { logWorkspaceActivity } from '../services/workspaceActivityService.js';

// ─── Signed state for install callback (mirrors authRoutes OAuth pattern) ────

interface GitHubAppState {
  userId: string;
  workspaceId?: string | null;
  nonce: string;
  ts: number;
}

function getStateSecret(): string {
  const secret = String(process.env.JWT_SECRET || process.env.SESSION_SECRET || '').trim();
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('GitHub App state secret missing: set JWT_SECRET or SESSION_SECRET');
    }
    return 'aivis-github-app-state-dev-only';
  }
  return secret;
}

function encodeAppState(payload: GitHubAppState): string {
  const json = JSON.stringify(payload);
  const base = Buffer.from(json, 'utf8').toString('base64url');
  const sig = createHmac('sha256', getStateSecret()).update(base).digest('base64url');
  return `${base}.${sig}`;
}

function decodeAppState(raw: string): GitHubAppState | null {
  const [base, sig] = String(raw || '').split('.');
  if (!base || !sig) return null;
  const expected = createHmac('sha256', getStateSecret()).update(base).digest('base64url');
  const sigBuf = Buffer.from(sig, 'utf8');
  const expectedBuf = Buffer.from(expected, 'utf8');
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(base, 'base64url').toString('utf8')) as GitHubAppState;
    if (!parsed?.userId || !parsed?.nonce || typeof parsed?.ts !== 'number') return null;
    // 15 min expiry — GitHub App installation flow can take a while
    if (Date.now() - parsed.ts > 15 * 60 * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}

const router = Router();

// ─── Webhook (unauthenticated — signature-verified) ──────────────────────────

/**
 * POST /api/github-app/webhook
 *
 * GitHub sends events here when installations are created, deleted, suspended,
 * unsuspended, or when PRs are merged.
 *
 * Body must be raw for HMAC verification.
 */
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response) => {
    const signature = req.headers['x-hub-signature-256'] as string | undefined;
    if (!signature) {
      return res.status(401).json({ error: 'Missing signature header' });
    }

    const rawBody = req.body instanceof Buffer ? req.body : Buffer.from(String(req.body || ''));
    if (!verifyWebhookSignature(rawBody, signature)) {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return res.status(400).json({ error: 'Invalid JSON payload' });
    }

    const event = req.headers['x-github-event'] as string;
    const action = payload?.action as string;

    try {
      if (event === 'installation') {
        const installationId = payload.installation?.id;
        const accountLogin = payload.installation?.account?.login || '';
        const accountType = payload.installation?.account?.type || 'User';
        const permissions = payload.installation?.permissions || {};
        const repoSelection = payload.installation?.repository_selection || 'all';
        const senderId = String(payload.sender?.id || '');

        if (!installationId) {
          return res.status(400).json({ error: 'Missing installation id' });
        }

        if (action === 'created') {
          // Note: senderId from GitHub is the GitHub user ID, not our user ID.
          // The actual association happens in the /callback route when the user
          // returns to our app after installing. We store with a placeholder
          // user_id that gets updated on callback. For webhook-first flows,
          // we save with the GitHub sender ID as a lookup key.
          await saveInstallation(
            senderId, // temporary — updated when user hits /callback
            null,
            installationId,
            accountLogin,
            accountType,
            permissions,
            repoSelection,
          );
          console.log(`[GitHubApp] Installation created: ${installationId} (${accountLogin})`);
        } else if (action === 'deleted') {
          await removeInstallation(installationId);
          console.log(`[GitHubApp] Installation removed: ${installationId}`);
        } else if (action === 'suspend') {
          await suspendInstallation(installationId);
          console.log(`[GitHubApp] Installation suspended: ${installationId}`);
        } else if (action === 'unsuspend') {
          await unsuspendInstallation(installationId);
          console.log(`[GitHubApp] Installation unsuspended: ${installationId}`);
        }
      }

      // PR merge events — trigger post-merge verification rescan
      if (event === 'pull_request' && action === 'closed' && payload.pull_request?.merged) {
        const prNumber = payload.pull_request?.number;
        const repoFullName = payload.repository?.full_name || '';
        console.log(`[GitHubApp] PR #${prNumber} merged in ${repoFullName} — post-merge rescan will pick this up`);
        // The existing startAutoScoreFixPostMergeLoop() polls for merged PRs,
        // so we don't need to trigger anything extra here. This log confirms delivery.
      }

      return res.status(200).json({ ok: true });
    } catch (err: any) {
      console.error('[GitHubApp] Webhook processing error:', err?.message || err);
      return res.status(500).json({ error: 'Webhook processing failed' });
    }
  }
);

// ─── Authenticated routes ────────────────────────────────────────────────────

// Callback MUST be before authRequired — it's a browser redirect from GitHub
// with no Bearer token. User identity comes from the HMAC-signed state param.

/**
 * GET /api/github-app/callback
 *
 * After the user installs the GitHub App, GitHub redirects here with
 * ?installation_id=<id>&setup_action=install&state=<signed>.
 * We decode the state to identify the user (no auth header in browser redirects).
 */
router.get('/callback', async (req: Request, res: Response) => {
  const installationId = Number(req.query.installation_id);
  const setupAction = String(req.query.setup_action || '');
  const stateRaw = String(req.query.state || '');

  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');

  if (!installationId || isNaN(installationId)) {
    return res.redirect(`${frontendUrl}/scorefix?github_app=error&reason=missing_installation`);
  }

  const appState = decodeAppState(stateRaw);
  if (!appState) {
    return res.redirect(`${frontendUrl}/scorefix?github_app=error&reason=invalid_state`);
  }

  if (setupAction === 'install' || setupAction === 'update') {
    try {
      // The webhook may have already saved the installation with a placeholder user.
      // Update it with the real user ID from the signed state.
      const existing = await getInstallationById(installationId);
      await saveInstallation(
        appState.userId,
        appState.workspaceId || null,
        installationId,
        existing?.account_login || '',
        existing?.account_type || 'User',
        existing?.permissions || {},
        existing?.repo_selection || 'all',
      );
      if (appState.workspaceId) {
        await logWorkspaceActivity({
          workspaceId: appState.workspaceId,
          userId: appState.userId,
          type: 'integration.github.connected',
          metadata: {
            installationId,
            accountLogin: existing?.account_login || null,
            setupAction,
          },
        });
      }
      console.log(`[GitHubApp] Installation ${installationId} associated with user ${appState.userId}`);

      return res.redirect(`${frontendUrl}/scorefix?github_app=installed`);
    } catch (err: any) {
      console.error('[GitHubApp] Callback error:', err?.message);
      return res.redirect(`${frontendUrl}/scorefix?github_app=error&reason=save_failed`);
    }
  }

  return res.redirect(`${frontendUrl}/scorefix?github_app=error&reason=unsupported_action`);
});

router.use(authRequired);
router.use(workspaceRequired);

/**
 * GET /api/github-app/status
 *
 * Returns whether the GitHub App is configured and the user's installation status.
 */
router.get('/status', async (req: Request, res: Response) => {
  const userId = String((req as any).user?.id || '');
  const workspaceId = String(req.workspace?.id || '');
  const configured = isGitHubAppConfigured();

  if (!configured) {
    return res.json({ configured: false, installed: false, installation: null });
  }

  try {
    const installation = await getInstallationForWorkspace(workspaceId) || await getInstallationForUser(userId);
    return res.json({
      configured: true,
      installed: !!installation,
      workspace_id: workspaceId,
      installation: installation
        ? {
            workspace_id: installation.workspace_id ?? null,
            installation_id: installation.installation_id,
            account_login: installation.account_login,
            account_type: installation.account_type,
            repo_selection: installation.repo_selection,
            created_at: installation.created_at,
          }
        : null,
    });
  } catch (err: any) {
    console.error('[GitHubApp] Status check error:', err?.message);
    return res.status(500).json({ error: 'Failed to check installation status' });
  }
});

/**
 * GET /api/github-app/install-url
 *
 * Returns the URL the user should visit to install the GitHub App on their account/org.
 * Encodes a signed state param so the callback can identify the user without auth.
 */
router.get('/install-url', requireWorkspacePermission('integrations:manage'), (req: Request, res: Response) => {
  const slug = (process.env.GITHUB_APP_SLUG || '').trim();
  if (!slug) {
    return res.status(503).json({ error: 'GitHub App is not configured' });
  }
  const userId = String((req as any).user?.id || '');
  const workspaceId = String(req.workspace?.id || '');
  const state = encodeAppState({ userId, workspaceId, nonce: randomUUID(), ts: Date.now() });
  return res.json({
    url: `https://github.com/apps/${encodeURIComponent(slug)}/installations/new?state=${encodeURIComponent(state)}`,
  });
});

/**
 * GET /api/github-app/repos
 *
 * List repos accessible to the user's GitHub App installation.
 */
router.get('/repos', async (req: Request, res: Response) => {
  const userId = String((req as any).user?.id || '');
  const workspaceId = String(req.workspace?.id || '');
  const page = Math.max(1, Number(req.query.page) || 1);

  try {
    const installation = await getInstallationForWorkspace(workspaceId) || await getInstallationForUser(userId);
    if (!installation) {
      return res.status(404).json({ error: 'No GitHub App installation found. Install the app first.' });
    }

    const result = await listInstallationRepos(installation.installation_id, page);
    return res.json(result);
  } catch (err: any) {
    console.error('[GitHubApp] List repos error:', err?.message);
    return res.status(500).json({ error: 'Failed to list repositories' });
  }
});

/**
 * GET /api/github-app/branches?owner=…&repo=…
 *
 * List branches for a specific repo via the user's GitHub App installation.
 */
router.get('/branches', async (req: Request, res: Response) => {
  const userId = String((req as any).user?.id || '');
  const workspaceId = String(req.workspace?.id || '');
  const owner = String(req.query.owner || '').trim();
  const repo = String(req.query.repo || '').trim();

  if (!owner || !repo) {
    return res.status(400).json({ error: 'owner and repo query params are required' });
  }

  // Basic validation to prevent path traversal
  if (/[^a-zA-Z0-9._-]/.test(owner) || /[^a-zA-Z0-9._-]/.test(repo)) {
    return res.status(400).json({ error: 'Invalid owner or repo name' });
  }

  try {
    const installation = await getInstallationForWorkspace(workspaceId) || await getInstallationForUser(userId);
    if (!installation) {
      return res.status(404).json({ error: 'No GitHub App installation found. Install the app first.' });
    }

    const branches = await listInstallationBranches(installation.installation_id, owner, repo);
    return res.json({ branches });
  } catch (err: any) {
    console.error('[GitHubApp] List branches error:', err?.message);
    return res.status(500).json({ error: 'Failed to list branches' });
  }
});

/**
 * DELETE /api/github-app/installation
 *
 * Remove the user's GitHub App installation record (does NOT uninstall from GitHub).
 * User must uninstall via GitHub Settings separately.
 */
router.delete('/installation', requireWorkspacePermission('integrations:manage'), async (req: Request, res: Response) => {
  const userId = String((req as any).user?.id || '');
  const workspaceId = String(req.workspace?.id || '');

  try {
    const installation = await getInstallationForWorkspace(workspaceId) || await getInstallationForUser(userId);
    if (!installation) {
      return res.status(404).json({ error: 'No installation found' });
    }

    await removeInstallation(installation.installation_id);
    await logWorkspaceActivity({
      workspaceId,
      userId,
      type: 'integration.github.disconnected',
      metadata: { installationId: installation.installation_id, accountLogin: installation.account_login },
    });
    return res.json({ ok: true, message: 'Installation record removed. Uninstall the app from GitHub Settings to revoke access.' });
  } catch (err: any) {
    console.error('[GitHubApp] Remove installation error:', err?.message);
    return res.status(500).json({ error: 'Failed to remove installation' });
  }
});

export default router;
