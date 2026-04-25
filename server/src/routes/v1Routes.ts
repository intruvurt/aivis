/**
 * V1 Internal API Routes - production-grade REST endpoints.
 *
 * POST   /v1/audit            - Enqueue a new audit
 * GET    /v1/audit/:id        - Get audit result
 * POST   /v1/fix              - Trigger fix for an issue
 * POST   /v1/pr               - Manually trigger PR creation
 * GET    /v1/projects         - List org projects
 * POST   /v1/projects         - Create a project
 * GET    /v1/timeline/:projectId - Score timeline
 * GET    /v1/audit/progress/:id  - SSE progress stream
 */
import { Router, Request, Response } from 'express';
import { authRequired } from '../middleware/authRequired.js';
import { tieredRateLimit } from '../middleware/tieredRateLimiter.js';
import { getPool } from '../services/postgresql.js';
import { enqueueAuditJob, getAuditJob } from '../infra/queues/auditQueue.js';
import { enqueueFixJob } from '../infra/queues/fixQueue.js';
import { enqueuePRJob } from '../infra/queues/prQueue.js';
import { normalizePublicHttpUrl, isPrivateOrLocalHost } from '../lib/urlSafety.js';
import { IS_PRODUCTION } from '../config/runtime.js';
import validator from 'validator';

const router = Router();

// All v1 routes require auth
router.use(authRequired);

// ── Helpers ──────────────────────────────────────────────────────────────────

function getOrgId(req: Request): string | null {
  // Pull org_id from the authenticated user's context
  return (req as any).user?.org_id || (req as any).workspace?.organization_id || null;
}

function getUserId(req: Request): string {
  return String((req as any).user?.id || '');
}

// RLS: every query scopes to org_id to prevent cross-org data leakage
function requireOrgId(req: Request, res: Response): string | null {
  const orgId = getOrgId(req);
  if (!orgId) {
    res.status(403).json({ error: 'Organization context required', code: 'NO_ORG' });
    return null;
  }
  return orgId;
}

// ── POST /v1/audit - Enqueue a new audit ─────────────────────────────────────

router.post('/audit', tieredRateLimit('analyze'), async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const projectId = String(req.body?.project_id || '').trim();
  const url = String(req.body?.url || '').trim();

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!url && !projectId) return res.status(400).json({ error: 'url or project_id required' });

  let targetUrl = url;

  // If project_id provided, look up domain
  if (projectId && !targetUrl) {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT domain FROM v1_projects WHERE id = $1`,
      [projectId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Project not found' });
    targetUrl = rows[0].domain;
  }

  // Validate URL
  const normalized = normalizePublicHttpUrl(targetUrl);
  if (!normalized.ok) {
    return res.status(400).json({ error: normalized.error || 'Invalid URL' });
  }
  if (IS_PRODUCTION && isPrivateOrLocalHost(normalized.hostname)) {
    return res.status(400).json({ error: 'Private/localhost URLs not allowed' });
  }

  const priority = req.body?.priority === 'high' ? 'high' : 'normal';
  const jobId = await enqueueAuditJob({
    url: normalized.url,
    userId,
    workspaceId: (req as any).workspace?.id,
    priority,
  });

  return res.json({ success: true, jobId });
});

// ── GET /v1/audit/:id - Get audit result ─────────────────────────────────────

router.get('/audit/:id', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const auditId = String(req.params.id || '');

  if (!auditId) return res.status(400).json({ error: 'Audit ID required' });

  // First check the queue (in-progress)
  const queueJob = await getAuditJob(auditId);
  if (queueJob) {
    return res.json({
      id: queueJob.id,
      status: queueJob.state,
      stage: queueJob.stage,
      progress: queueJob.progress,
      result: queueJob.result || null,
    });
  }

  // Then check DB (completed)
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id, user_id, url, visibility_score, result, status, created_at
     FROM audits WHERE id = $1 AND user_id = $2`,
    [auditId, userId]
  );

  if (!rows.length) return res.status(404).json({ error: 'Audit not found' });

  const audit = rows[0];
  return res.json({
    id: audit.id,
    status: audit.status || 'completed',
    score: audit.visibility_score,
    url: audit.url,
    result: audit.result,
    created_at: audit.created_at,
  });
});

// ── GET /v1/audit/progress/:id - SSE progress stream ─────────────────────────

router.get('/audit/progress/:id', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const jobId = String(req.params.id || '');
  const job = await getAuditJob(jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (!userId || String(job.payload?.userId || '') !== userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const send = async () => {
    const latest = await getAuditJob(jobId);
    if (!latest) return;

    const event = latest.stage || latest.state;
    const payload = {
      jobId: String(latest.id),
      state: latest.state,
      stage: latest.stage,
      progress: latest.progress || 0,
      score_partial: latest.result && typeof latest.result === 'object'
        ? (latest.result as any).score || null
        : null,
      failedReason: latest.error || null,
      hints: latest.hints || [],
      result: latest.state === 'completed' ? latest.result : null,
    };

    res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);

    if (latest.state === 'completed' || latest.state === 'failed') {
      res.write(`event: complete\ndata: ${JSON.stringify(payload)}\n\n`);
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

// ── POST /v1/fix - Trigger fix for an issue ──────────────────────────────────

router.post('/fix', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const orgId = requireOrgId(req, res);
  if (!orgId) return;

  const issueId = String(req.body?.issue_id || '').trim();
  const projectId = String(req.body?.project_id || '').trim();
  const expectedDelta = Number(req.body?.expected_delta || 5);

  if (!issueId) return res.status(400).json({ error: 'issue_id required' });
  if (!projectId) return res.status(400).json({ error: 'project_id required' });

  const pool = getPool();

  // Verify issue belongs to org's project (RLS)
  const { rows: issueCheck } = await pool.query(
    `SELECT i.id FROM v1_issues i
     JOIN v1_audits a ON a.id = i.audit_id
     JOIN v1_projects p ON p.id = a.project_id
     WHERE i.id = $1 AND p.org_id = $2`,
    [issueId, orgId]
  );
  if (!issueCheck.length) return res.status(404).json({ error: 'Issue not found' });

  // Create fix record
  await pool.query(
    `INSERT INTO v1_fixes (issue_id, status, expected_delta, created_at, updated_at)
     VALUES ($1, 'pending', $2, NOW(), NOW())`,
    [issueId, expectedDelta]
  );

  // Enqueue fix job
  const jobId = await enqueueFixJob({
    issueId,
    projectId,
    orgId,
    userId,
    expectedDelta,
  });

  return res.json({ success: true, jobId });
});

// ── POST /v1/pr - Manually trigger PR creation ──────────────────────────────

router.post('/pr', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const orgId = requireOrgId(req, res);
  if (!orgId) return;

  const fixId = String(req.body?.fix_id || '').trim();
  const projectId = String(req.body?.project_id || '').trim();

  if (!fixId) return res.status(400).json({ error: 'fix_id required' });
  if (!projectId) return res.status(400).json({ error: 'project_id required' });

  const pool = getPool();

  // Load project (RLS)
  const { rows: projRows } = await pool.query(
    `SELECT id, repo_owner, repo_name, repo_installation_id FROM v1_projects
     WHERE id = $1 AND org_id = $2`,
    [projectId, orgId]
  );
  if (!projRows.length) return res.status(404).json({ error: 'Project not found' });

  const project = projRows[0];
  if (!project.repo_owner || !project.repo_name || !project.repo_installation_id) {
    return res.status(400).json({ error: 'Project has no GitHub repo connected' });
  }

  // Load fix details
  const { rows: fixRows } = await pool.query(
    `SELECT f.*, i.title AS issue_title, i.severity
     FROM v1_fixes f
     JOIN v1_issues i ON i.id = f.issue_id
     WHERE f.id = $1`,
    [fixId]
  );
  if (!fixRows.length) return res.status(404).json({ error: 'Fix not found' });

  const fix = fixRows[0];

  const jobId = await enqueuePRJob({
    fixId,
    projectId,
    orgId,
    userId,
    repoOwner: project.repo_owner,
    repoName: project.repo_name,
    installationId: Number(project.repo_installation_id),
    baseBranch: String(req.body?.base_branch || 'main'),
    files: Array.isArray(req.body?.files) ? req.body.files : [],
    title: `fix(aivis): ${fix.issue_title?.slice(0, 60) || 'AI visibility fix'}`,
    body: `AiVIS.biz AutoFix - severity: ${fix.severity || 'medium'}`,
  });

  return res.json({ success: true, jobId });
});

// ── GET /v1/projects - List org projects ─────────────────────────────────────

router.get('/projects', async (req: Request, res: Response) => {
  const orgId = requireOrgId(req, res);
  if (!orgId) return;

  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id, org_id, domain, repo_owner, repo_name, created_at
     FROM v1_projects WHERE org_id = $1 ORDER BY created_at DESC`,
    [orgId]
  );

  return res.json({ projects: rows });
});

// ── POST /v1/projects - Create a project ─────────────────────────────────────

router.post('/projects', async (req: Request, res: Response) => {
  const orgId = requireOrgId(req, res);
  if (!orgId) return;

  const rawDomain = req.body?.domain;
  const domain = typeof rawDomain === 'string' ? rawDomain.trim().toLowerCase() : '';
  const repoOwner = String(req.body?.repo_owner || '').trim();
  const repoName = String(req.body?.repo_name || '').trim();
  const repoInstallationId = String(req.body?.repo_installation_id || '').trim();

  if (!domain) return res.status(400).json({ error: 'domain required' });
  if (!validator.isURL(domain, { require_protocol: false })) {
    return res.status(400).json({ error: 'Invalid domain' });
  }

  const pool = getPool();

  // Check for duplicate domain within org
  const { rows: existing } = await pool.query(
    `SELECT id FROM v1_projects WHERE org_id = $1 AND domain = $2`,
    [orgId, domain]
  );
  if (existing.length) return res.status(409).json({ error: 'Project with this domain already exists' });

  const { rows } = await pool.query(
    `INSERT INTO v1_projects (org_id, domain, repo_owner, repo_name, repo_installation_id, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     RETURNING *`,
    [orgId, domain, repoOwner || null, repoName || null, repoInstallationId || null]
  );

  return res.status(201).json({ project: rows[0] });
});

// ── GET /v1/timeline/:projectId - Score timeline ─────────────────────────────

router.get('/timeline/:projectId', async (req: Request, res: Response) => {
  const orgId = requireOrgId(req, res);
  if (!orgId) return;

  const projectId = req.params.projectId;
  const pool = getPool();

  // Verify project belongs to org (RLS)
  const { rows: projCheck } = await pool.query(
    `SELECT id FROM v1_projects WHERE id = $1 AND org_id = $2`,
    [projectId, orgId]
  );
  if (!projCheck.length) return res.status(404).json({ error: 'Project not found' });

  const { rows } = await pool.query(
    `SELECT a.id, a.score, a.delta, a.status, a.created_at,
            json_agg(json_build_object('name', ac.name, 'score', ac.score)) AS categories
     FROM v1_audits a
     LEFT JOIN v1_audit_categories ac ON ac.audit_id = a.id
     WHERE a.project_id = $1
     GROUP BY a.id
     ORDER BY a.created_at DESC
     LIMIT 100`,
    [projectId]
  );

  return res.json({ timeline: rows });
});

export default router;
