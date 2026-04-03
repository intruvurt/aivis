/**
 * V1 Webhook Routes — handles inbound webhooks from GitHub and deploy platforms.
 *
 * POST /v1/webhooks/github   — GitHub App webhook events
 * POST /v1/webhooks/deploy   — Deploy hook (Vercel/Render)
 */
import { Router, Request, Response } from 'express';
import { verifyWebhookSignature } from '../services/githubAppService.js';
import { handlePRMerged, handleDeployHook } from '../services/scheduler.js';
import { getPool } from '../services/postgresql.js';

const router = Router();

// ── GitHub Webhooks ──────────────────────────────────────────────────────────

router.post('/github', async (req: Request, res: Response) => {
  const signature = String(req.headers['x-hub-signature-256'] || '');
  const event = String(req.headers['x-github-event'] || '');
  const rawBody = (req as any).rawBody || JSON.stringify(req.body);

  // Verify signature
  if (!verifyWebhookSignature(rawBody, signature)) {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  const payload = req.body;

  try {
    switch (event) {
      case 'pull_request': {
        if (payload.action === 'closed' && payload.pull_request?.merged) {
          // PR merged → find project by repo and trigger re-audit
          const repoFullName = payload.repository?.full_name || '';
          const [repoOwner, repoName] = repoFullName.split('/');

          if (repoOwner && repoName) {
            const pool = getPool();
            const { rows } = await pool.query(
              `SELECT id FROM v1_projects WHERE repo_owner = $1 AND repo_name = $2 LIMIT 1`,
              [repoOwner, repoName]
            );

            if (rows.length) {
              await handlePRMerged({
                projectId: rows[0].id,
                prUrl: payload.pull_request.html_url,
                mergedBy: payload.pull_request.merged_by?.login,
              });
            }
          }
        }
        break;
      }

      case 'installation': {
        // Handle app install/uninstall
        console.log(`[Webhook] GitHub installation event: ${payload.action}`);
        break;
      }

      default:
        // Acknowledge but don't process
        break;
    }
  } catch (err: any) {
    console.error(`[Webhook] GitHub event processing error (${event}):`, err.message);
  }

  return res.json({ received: true });
});

// ── Deploy Hooks (Vercel / Render) ───────────────────────────────────────────

router.post('/deploy', async (req: Request, res: Response) => {
  const domain = String(req.body?.domain || req.body?.url || '').trim();
  const source = String(req.body?.source || req.headers['x-deploy-source'] || 'unknown').trim();

  if (!domain) {
    return res.status(400).json({ error: 'domain required' });
  }

  try {
    await handleDeployHook({ domain, source });
  } catch (err: any) {
    console.error('[Webhook] Deploy hook processing error:', err.message);
  }

  return res.json({ received: true });
});

export default router;
