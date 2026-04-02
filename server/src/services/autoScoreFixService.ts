/**
 * Auto Score Fix Service
 *
 * Generates evidence-backed code fixes from audit data using LLM analysis,
 * then creates real pull requests on GitHub, GitLab, or Bitbucket via REST API.
 * No git binary required — all PR operations use provider REST APIs.
 *
 * Credit model:
 *   - Cost: AUTO_SCORE_FIX_CREDIT_COST credits per job
 *   - Minimum balance required: AUTO_SCORE_FIX_CREDIT_COST
 *   - PR expires after 48 hours
 *   - No response by hour 49: 80% refund, 20% service fee retained
 */

import crypto from 'crypto';
import { getPool, executeTransaction } from './postgresql.js';
import { consumePackCredits } from './scanPackCredits.js';
import { callAIProvider, SIGNAL_AI1 } from './aiProviders.js';
import { isGitHubAppConfigured, getInstallationForUser, createPRViaApp } from './githubAppService.js';

// ─── Constants ────────────────────────────────────────────────────────────────

export const AUTO_SCORE_FIX_CREDIT_COST = 10;
export const AUTO_SCORE_FIX_EXPIRY_HOURS = 48;
export const AUTO_SCORE_FIX_REFUND_PERCENT = 0.80;
export const AUTO_SCORE_FIX_FEE_PERCENT = 0.20;

export type VcsProvider = 'github' | 'gitlab' | 'bitbucket';
export type JobStatus =
  | 'pending'
  | 'generating'
  | 'creating_pr'
  | 'pending_approval'
  | 'cancelled'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'failed';

export interface AutoScoreFixJobInput {
  userId: string;
  workspaceId: string;
  auditId?: string;
  targetUrl: string;
  vcsProvider: VcsProvider;
  repoOwner: string;
  repoName: string;
  repoBranch: string;
  encryptedToken: string;
  auditEvidence: {
    visibility_score: number;
    recommendations: Array<{
      title: string;
      description: string;
      priority: string;
      category: string;
      implementation?: string;
      evidence_ids?: string[];
    }>;
    technical_signals?: Record<string, unknown>;
    schema_markup?: Record<string, unknown>;
    content_analysis?: Record<string, unknown>;
    private_exposure_scan?: {
      summary?: {
        exposure_surface_score?: number;
        score_band?: string;
        verdict?: string;
        top_priorities?: string[];
      };
      findings?: Array<{
        title?: string;
        domain?: string;
        severity?: string;
        what_was_observed?: string;
        fix_path?: string[];
      }>;
    };
  };
}

export interface FileChange {
  path: string;
  content: string;
  operation: 'create' | 'update';
  justification: string;
}

export interface AutoScoreFixPlan {
  summary: string;
  score_before: number;
  projected_score_lift: string;
  evidence_count: number;
  file_changes: FileChange[];
  pr_title: string;
  pr_body: string;
}

type JobExecutionRow = {
  id: string;
  user_id: string;
  workspace_id: string;
  audit_id: string | null;
  target_url: string;
  vcs_provider: VcsProvider;
  repo_owner: string;
  repo_name: string;
  repo_branch: string;
  pr_number: number | null;
  status: JobStatus;
  fix_plan: AutoScoreFixPlan | null;
  evidence_snapshot: AutoScoreFixJobInput['auditEvidence'];
  encrypted_token: string | null;
  created_at: string;
};

async function refundFailureCredits(userId: string, jobId: string, amount: number): Promise<void> {
  const pool = getPool();
  const refundAmount = Math.round(Math.max(0, Number(amount || 0)) * 100) / 100;
  if (refundAmount <= 0) return;

  await executeTransaction(async (client: any) => {
    await client.query(
      `INSERT INTO scan_pack_credits (user_id, credits_remaining, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE
         SET credits_remaining = ROUND((scan_pack_credits.credits_remaining + $2)::numeric, 2),
             updated_at = NOW()`,
      [userId, refundAmount]
    );

    const { rows } = await client.query(
      'SELECT credits_remaining FROM scan_pack_credits WHERE user_id = $1',
      [userId]
    );
    const balanceAfter = Math.round(Math.max(0, Number(rows[0]?.credits_remaining || 0)) * 100) / 100;

    await client.query(
      `INSERT INTO credit_usage_ledger (user_id, delta_credits, balance_after, reason, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        userId,
        refundAmount,
        balanceAfter,
        'auto_score_fix_refund_failure',
        JSON.stringify({ jobId, reason: 'Job failed — full refund' }),
      ]
    );
  });
}

// ─── Token Encryption ─────────────────────────────────────────────────────────

const ENCRYPTION_KEY_MATERIAL = (() => {
  const key = (process.env.JWT_SECRET || '').trim();
  if (!key && process.env.NODE_ENV === 'production') {
    throw new Error('VCS token encryption requires JWT_SECRET in production');
  }
  return key || 'aivis-default-key-dev-only';
})();

function deriveKey(): Buffer {
  return crypto.createHash('sha256').update(ENCRYPTION_KEY_MATERIAL).digest();
}

export function encryptVcsToken(plainToken: string): string {
  const key = deriveKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plainToken, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':');
}

export function decryptVcsToken(stored: string): string {
  const parts = stored.split(':');
  if (parts.length !== 3) throw new Error('Invalid token format');
  const [ivHex, authTagHex, encryptedHex] = parts;
  const key = deriveKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

export function tokenHint(plain: string): string {
  if (plain.length <= 8) return '****';
  return plain.slice(0, 4) + '****' + plain.slice(-4);
}

// ─── VCS Token Store ─────────────────────────────────────────────────────────

export async function saveVcsToken(
  userId: string,
  provider: VcsProvider,
  plainToken: string
): Promise<void> {
  const pool = getPool();
  const enc = encryptVcsToken(plainToken);
  const hint = tokenHint(plainToken);
  const scopeHint = provider === 'github' ? ['repo', 'pull_request'] : ['api', 'merge_request'];
  await pool.query(
    `INSERT INTO vcs_tokens (user_id, provider, encrypted_token, token_hint, scopes, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (user_id, provider) DO UPDATE
       SET encrypted_token = $3, token_hint = $4, scopes = $5, updated_at = NOW()`,
    [userId, provider, enc, hint, scopeHint]
  );
}

export async function getVcsToken(
  userId: string,
  provider: VcsProvider
): Promise<{ encrypted: string; hint: string } | null> {
  const pool = getPool();
  const { rows } = await pool.query(
    'SELECT encrypted_token, token_hint FROM vcs_tokens WHERE user_id = $1 AND provider = $2',
    [userId, provider]
  );
  if (!rows.length) return null;
  return { encrypted: rows[0].encrypted_token, hint: rows[0].token_hint };
}

export async function listVcsTokens(
  userId: string
): Promise<Array<{ provider: string; hint: string; updated_at: string }>> {
  const pool = getPool();
  const { rows } = await pool.query(
    'SELECT provider, token_hint, updated_at FROM vcs_tokens WHERE user_id = $1 ORDER BY provider',
    [userId]
  );
  return rows.map((r) => ({ provider: r.provider, hint: r.token_hint, updated_at: r.updated_at }));
}

export async function deleteVcsToken(userId: string, provider: VcsProvider): Promise<void> {
  const pool = getPool();
  await pool.query('DELETE FROM vcs_tokens WHERE user_id = $1 AND provider = $2', [userId, provider]);
}

// ─── LLM Fix Plan Generation ──────────────────────────────────────────────────

export async function generateFixPlan(input: AutoScoreFixJobInput): Promise<AutoScoreFixPlan> {
  const topRecs = (input.auditEvidence.recommendations || [])
    .filter((r) => r.priority === 'high' || r.priority === 'medium')
    .slice(0, 8);

  const evidenceJson = JSON.stringify(
    {
      target_url: input.targetUrl,
      current_score: input.auditEvidence.visibility_score,
      top_recommendations: topRecs,
      technical_signals: input.auditEvidence.technical_signals || {},
      schema_markup: input.auditEvidence.schema_markup || {},
      private_exposure_scan: input.auditEvidence.private_exposure_scan
        ? {
            summary: input.auditEvidence.private_exposure_scan.summary || {},
            findings: Array.isArray(input.auditEvidence.private_exposure_scan.findings)
              ? input.auditEvidence.private_exposure_scan.findings.slice(0, 15)
              : [],
          }
        : null,
    },
    null,
    2
  );

  const systemPrompt = `You are an expert web engineer specializing in AI visibility optimization (AEO/GEO/SEO).
You analyze structured audit evidence and produce precise, evidence-backed code file changes.
You respond ONLY with valid JSON. No markdown. No prose outside JSON.
Your code changes must be exact, production-ready, and directly derived from the evidence provided.
Never invent problems not in the evidence. Every change must cite which recommendation it resolves.`;

  const prompt = `Analyze this AI visibility audit and produce a precise code fix plan.

AUDIT EVIDENCE:
${evidenceJson}

Produce a JSON response with this exact structure:
{
  "summary": "One sentence describing the primary fix strategy",
  "score_before": ${input.auditEvidence.visibility_score},
  "projected_score_lift": "e.g. +12 to +18 points",
  "evidence_count": <number of recommendations addressed>,
  "pr_title": "fix: AiVIS Score Fix — evidence-backed visibility improvements for ${input.targetUrl}",
  "pr_body": "<full PR description in markdown with evidence citations, before/after summary, and implementation notes>",
  "file_changes": [
    {
      "path": "relative/file/path.ext",
      "operation": "create" | "update",
      "justification": "Which recommendation this resolves and why",
      "content": "<complete file content or targeted patch content>"
    }
  ]
}

Requirements:
- Target schema.org JSON-LD files, meta tag files, robots.txt, sitemap hints, or structured HTML sections
- If private_exposure_scan findings exist, prioritize concrete fixes for secret leakage, route protection, session hardening, and header hardening.
- Each file_change must be complete and self-contained (not a diff — full replacement content for the relevant file)
- path must be relative to repo root (e.g. "public/schema/organization.json", "public/robots.txt", "src/seo/structured-data.ts")
- Limit to 5 most impactful file changes
- PR body must include: Score context, Evidence summary, Per-file change rationale, Implementation verification steps`;

  const raw = await callAIProvider({
    provider: SIGNAL_AI1.provider,
    model: SIGNAL_AI1.model,
    prompt,
    apiKey: process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_API_KEY || '',
    opts: {
      systemPrompt,
      max_tokens: 4000,
      temperature: 0.15,
      responseFormat: 'json_object',
      timeoutMs: 45_000,
    },
  });

  let parsed: AutoScoreFixPlan;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Attempt to extract JSON from prose output
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('LLM did not return parseable JSON for fix plan');
    parsed = JSON.parse(match[0]);
  }

  if (!parsed.file_changes || !Array.isArray(parsed.file_changes)) {
    throw new Error('Fix plan missing file_changes array');
  }

  return parsed;
}

// ─── GitHub PR Creation (REST only) ──────────────────────────────────────────

async function createGitHubPR(
  token: string,
  repoOwner: string,
  repoName: string,
  baseBranch: string,
  plan: AutoScoreFixPlan
): Promise<{ pr_number: number; pr_url: string }> {
  const baseUrl = `https://api.github.com/repos/${repoOwner}/${repoName}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'AiVIS-AutoScoreFix/1.0',
  };

  // 1. Get base branch SHA
  const refRes = await fetch(`${baseUrl}/git/refs/heads/${baseBranch}`, { headers });
  if (!refRes.ok) {
    const err = await refRes.text();
    throw new Error(`GitHub: failed to get base branch ref: ${err.slice(0, 200)}`);
  }
  const refData = await refRes.json() as any;
  const baseSha = refData.object?.sha;
  if (!baseSha) throw new Error('GitHub: could not read base branch SHA');

  // 2. Create fix branch
  const fixBranch = `aivis-scorefix-${Date.now()}`;
  const createBranchRes = await fetch(`${baseUrl}/git/refs`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ref: `refs/heads/${fixBranch}`, sha: baseSha }),
  });
  if (!createBranchRes.ok) {
    const err = await createBranchRes.text();
    throw new Error(`GitHub: failed to create fix branch: ${err.slice(0, 200)}`);
  }

  // 3. Commit each file
  for (const change of plan.file_changes) {
    const contentB64 = Buffer.from(change.content, 'utf8').toString('base64');
    // Check if file exists for SHA (needed for update)
    let existingSha: string | undefined;
    try {
      const existRes = await fetch(`${baseUrl}/contents/${change.path}?ref=${fixBranch}`, { headers });
      if (existRes.ok) {
        const existData = await existRes.json() as any;
        existingSha = existData.sha;
      }
    } catch {
      // file doesn't exist — create
    }

    const body: Record<string, unknown> = {
      message: `fix(aivis): ${change.justification.slice(0, 72)}`,
      content: contentB64,
      branch: fixBranch,
    };
    if (existingSha) body.sha = existingSha;

    const putRes = await fetch(`${baseUrl}/contents/${change.path}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    });
    if (!putRes.ok) {
      const err = await putRes.text();
      throw new Error(`GitHub: failed to commit ${change.path}: ${err.slice(0, 200)}`);
    }
  }

  // 4. Create PR
  const prRes = await fetch(`${baseUrl}/pulls`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: plan.pr_title,
      body: plan.pr_body,
      head: fixBranch,
      base: baseBranch,
      draft: false,
    }),
  });
  if (!prRes.ok) {
    const err = await prRes.text();
    throw new Error(`GitHub: failed to create PR: ${err.slice(0, 300)}`);
  }
  const prData = await prRes.json() as any;
  return { pr_number: prData.number, pr_url: prData.html_url };
}

// ─── GitLab MR Creation (REST only) ──────────────────────────────────────────

async function createGitLabMR(
  token: string,
  repoOwner: string,
  repoName: string,
  baseBranch: string,
  plan: AutoScoreFixPlan
): Promise<{ pr_number: number; pr_url: string }> {
  const projectPath = encodeURIComponent(`${repoOwner}/${repoName}`);
  const baseUrl = `https://gitlab.com/api/v4/projects/${projectPath}`;
  const headers = {
    'PRIVATE-TOKEN': token,
    'Content-Type': 'application/json',
    'User-Agent': 'AiVIS-AutoScoreFix/1.0',
  };

  const fixBranch = `aivis-scorefix-${Date.now()}`;

  // Create branch first
  const branchRes = await fetch(`${baseUrl}/repository/branches`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ branch: fixBranch, ref: baseBranch }),
  });
  if (!branchRes.ok) {
    const err = await branchRes.text();
    throw new Error(`GitLab: failed to create branch: ${err.slice(0, 200)}`);
  }

  // Commit all files in a single API call (GitLab supports multi-file commits)
  const actions = plan.file_changes.map((change) => ({
    action: change.operation === 'create' ? 'create' : 'update',
    file_path: change.path,
    content: change.content,
    encoding: 'text',
  }));

  const commitRes = await fetch(`${baseUrl}/repository/commits`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      branch: fixBranch,
      commit_message: `fix(aivis): Auto Score Fix — evidence-backed visibility improvements\n\n${plan.summary}`,
      actions,
    }),
  });
  if (!commitRes.ok) {
    const err = await commitRes.text();
    throw new Error(`GitLab: failed to commit files: ${err.slice(0, 200)}`);
  }

  // Create MR
  const mrRes = await fetch(`${baseUrl}/merge_requests`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      source_branch: fixBranch,
      target_branch: baseBranch,
      title: plan.pr_title,
      description: plan.pr_body,
      remove_source_branch: true,
    }),
  });
  if (!mrRes.ok) {
    const err = await mrRes.text();
    throw new Error(`GitLab: failed to create MR: ${err.slice(0, 300)}`);
  }
  const mrData = await mrRes.json() as any;
  return { pr_number: mrData.iid, pr_url: mrData.web_url };
}

// ─── Bitbucket PR Creation (REST only) ───────────────────────────────────────

async function createBitbucketPR(
  token: string,
  repoOwner: string,
  repoName: string,
  baseBranch: string,
  plan: AutoScoreFixPlan
): Promise<{ pr_number: number; pr_url: string }> {
  const baseUrl = `https://api.bitbucket.org/2.0/repositories/${repoOwner}/${repoName}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    'User-Agent': 'AiVIS-AutoScoreFix/1.0',
  };

  const fixBranch = `aivis-scorefix-${Date.now()}`;

  // Bitbucket: create branch + files via /src with form-data
  const formData = new FormData();
  formData.append('branch', fixBranch);
  formData.append('message', `fix(aivis): Auto Score Fix — ${plan.summary}`);
  formData.append('parents', baseBranch);

  for (const change of plan.file_changes) {
    formData.append(change.path, new Blob([change.content], { type: 'text/plain' }), change.path);
  }

  const srcRes = await fetch(`${baseUrl}/src`, {
    method: 'POST',
    headers,
    body: formData,
  });
  if (!srcRes.ok) {
    const err = await srcRes.text();
    throw new Error(`Bitbucket: failed to create branch/files: ${err.slice(0, 200)}`);
  }

  // Create PR
  const prRes = await fetch(`${baseUrl}/pullrequests`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: plan.pr_title,
      description: plan.pr_body,
      source: { branch: { name: fixBranch } },
      destination: { branch: { name: baseBranch } },
      close_source_branch: true,
    }),
  });
  if (!prRes.ok) {
    const err = await prRes.text();
    throw new Error(`Bitbucket: failed to create PR: ${err.slice(0, 300)}`);
  }
  const prData = await prRes.json() as any;
  return { pr_number: prData.id, pr_url: prData.links?.html?.href || '' };
}

// ─── Main Job Submission ──────────────────────────────────────────────────────

export async function submitAutoScoreFixJob(input: AutoScoreFixJobInput): Promise<string> {
  const pool = getPool();

  // 1. Deduct credits upfront (atomic)
  const { consumed } = await consumePackCredits(
    input.userId,
    AUTO_SCORE_FIX_CREDIT_COST,
    'auto_score_fix',
    { targetUrl: input.targetUrl, vcsProvider: input.vcsProvider }
  );
  if (!consumed) {
    throw new Error(
      `Insufficient credits. Auto Score Fix requires ${AUTO_SCORE_FIX_CREDIT_COST} credits.`
    );
  }

  // 2. Create job record
  const expiresAt = new Date(Date.now() + AUTO_SCORE_FIX_EXPIRY_HOURS * 60 * 60 * 1000);
  const { rows } = await pool.query(
    `INSERT INTO auto_score_fix_jobs
       (user_id, workspace_id, audit_id, target_url, vcs_provider, repo_owner, repo_name, repo_branch,
        status, credits_spent, expires_at, evidence_snapshot)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'generating',$9,$10,$11)
     RETURNING id`,
    [
      input.userId,
      input.workspaceId,
      input.auditId || null,
      input.targetUrl,
      input.vcsProvider,
      input.repoOwner,
      input.repoName,
      input.repoBranch,
      AUTO_SCORE_FIX_CREDIT_COST,
      expiresAt.toISOString(),
      JSON.stringify(input.auditEvidence),
    ]
  );
  const jobId: string = rows[0].id;

  // 3. Attempt immediate execution; durable worker loop will retry/resume if interrupted.
  void processAutoScoreFixJob(jobId).catch((err: any) => {
    console.error(`[AutoScoreFix] Immediate execution failed for ${jobId}:`, err?.message || err);
  });

  return jobId;
}

async function loadJobExecutionRow(jobId: string): Promise<JobExecutionRow | null> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT j.id, j.user_id, j.workspace_id, j.audit_id, j.target_url, j.vcs_provider, j.repo_owner, j.repo_name, j.repo_branch,
            j.pr_number, j.status, j.fix_plan, j.evidence_snapshot, j.created_at, t.encrypted_token
     FROM auto_score_fix_jobs j
     LEFT JOIN vcs_tokens t ON t.user_id = j.user_id AND t.provider = j.vcs_provider
     WHERE j.id = $1
     LIMIT 1`,
    [jobId]
  );
  if (!rows.length) return null;

  const raw = rows[0] as any;
  return {
    id: raw.id,
    user_id: raw.user_id,
    workspace_id: raw.workspace_id,
    audit_id: raw.audit_id || null,
    target_url: raw.target_url,
    vcs_provider: raw.vcs_provider,
    repo_owner: raw.repo_owner,
    repo_name: raw.repo_name,
    repo_branch: raw.repo_branch,
    pr_number: raw.pr_number != null ? Number(raw.pr_number) : null,
    status: raw.status,
    fix_plan: raw.fix_plan || null,
    evidence_snapshot: raw.evidence_snapshot || { visibility_score: 0, recommendations: [] },
    encrypted_token: raw.encrypted_token || null,
    created_at: raw.created_at,
  };
}

async function markJobFailedWithRefund(jobId: string, userId: string, reason: string): Promise<void> {
  const pool = getPool();
  const safeReason = String(reason || 'Unknown error').slice(0, 500);

  const { rows } = await pool.query(
    `UPDATE auto_score_fix_jobs
     SET status='failed',
         error_message=$1,
         updated_at=NOW()
     WHERE id=$2
       AND status IN ('pending', 'generating', 'creating_pr')
     RETURNING id, refund_processed_at` ,
    [safeReason, jobId]
  );

  if (!rows.length) return;
  const alreadyRefunded = Boolean(rows[0]?.refund_processed_at);
  if (alreadyRefunded) return;

  await refundFailureCredits(userId, jobId, AUTO_SCORE_FIX_CREDIT_COST);
  await pool.query(
    `UPDATE auto_score_fix_jobs
     SET refund_processed_at = NOW(),
         refund_credits = $1,
         updated_at = NOW()
     WHERE id = $2 AND refund_processed_at IS NULL`,
    [AUTO_SCORE_FIX_CREDIT_COST, jobId]
  );
}

async function processAutoScoreFixJob(jobId: string): Promise<void> {
  const pool = getPool();
  const row = await loadJobExecutionRow(jobId);
  if (!row) return;
  if (!['pending', 'generating', 'creating_pr'].includes(row.status)) return;

  try {
    let plan = row.fix_plan;

    if (!plan || row.status === 'pending' || row.status === 'generating') {
      await pool.query(
        `UPDATE auto_score_fix_jobs SET status='generating', updated_at=NOW() WHERE id=$1`,
        [jobId]
      );

      const planInput: AutoScoreFixJobInput = {
        userId: row.user_id,
        workspaceId: '',
        targetUrl: row.target_url,
        vcsProvider: row.vcs_provider,
        repoOwner: row.repo_owner,
        repoName: row.repo_name,
        repoBranch: row.repo_branch,
        encryptedToken: row.encrypted_token || '',
        auditEvidence: row.evidence_snapshot,
      };

      plan = await generateFixPlan(planInput);
      await pool.query(
        `UPDATE auto_score_fix_jobs
         SET status='creating_pr', fix_plan=$1, pr_title=$2, pr_body=$3, updated_at=NOW()
         WHERE id=$4`,
        [JSON.stringify(plan), plan.pr_title, plan.pr_body, jobId]
      );
    }

    let prResult: { pr_number: number; pr_url: string };
    if (!row.encrypted_token) {
      // For GitHub: try GitHub App installation before failing
      if (row.vcs_provider === 'github' && isGitHubAppConfigured()) {
        const installation = await getInstallationForUser(row.user_id);
        if (installation) {
          // Use GitHub App to create PR
          const appResult = await createPRViaApp({
            installationId: installation.installation_id,
            owner: row.repo_owner,
            repo: row.repo_name,
            baseBranch: row.repo_branch,
            title: plan!.pr_title,
            body: plan!.pr_body,
            files: plan!.file_changes.map(f => ({
              path: f.path,
              content: f.content,
              operation: f.operation as 'create' | 'update',
              justification: f.justification,
            })),
          });
          prResult = { pr_number: appResult.pr_number, pr_url: appResult.pr_url };
        } else {
          throw new Error(`No ${row.vcs_provider} token or GitHub App installation found for this job owner.`);
        }
      } else {
        throw new Error(`No ${row.vcs_provider} token found for this job owner.`);
      }
    } else {
      const plainToken = decryptVcsToken(row.encrypted_token);
      if (row.vcs_provider === 'github') {
        // Prefer GitHub App installation if available
        if (isGitHubAppConfigured()) {
          const installation = await getInstallationForUser(row.user_id);
          if (installation) {
            const appResult = await createPRViaApp({
              installationId: installation.installation_id,
              owner: row.repo_owner,
              repo: row.repo_name,
              baseBranch: row.repo_branch,
              title: plan!.pr_title,
              body: plan!.pr_body,
              files: plan!.file_changes.map(f => ({
                path: f.path,
                content: f.content,
                operation: f.operation as 'create' | 'update',
                justification: f.justification,
              })),
            });
            prResult = { pr_number: appResult.pr_number, pr_url: appResult.pr_url };
          } else {
            prResult = await createGitHubPR(plainToken, row.repo_owner, row.repo_name, row.repo_branch, plan!);
          }
        } else {
          prResult = await createGitHubPR(plainToken, row.repo_owner, row.repo_name, row.repo_branch, plan!);
        }
      } else if (row.vcs_provider === 'gitlab') {
        prResult = await createGitLabMR(plainToken, row.repo_owner, row.repo_name, row.repo_branch, plan!);
      } else {
        prResult = await createBitbucketPR(plainToken, row.repo_owner, row.repo_name, row.repo_branch, plan!);
      }
    }

    await pool.query(
      `UPDATE auto_score_fix_jobs
       SET status='pending_approval', pr_number=$1, pr_url=$2,
           implementation_duration_minutes = COALESCE(
             implementation_duration_minutes,
             GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - created_at)) / 60)::INT)
           ),
           score_before = COALESCE(
             score_before,
             CASE
               WHEN COALESCE(evidence_snapshot->>'visibility_score', '') ~ '^[0-9]+(\\.[0-9]+)?$'
                 THEN (evidence_snapshot->>'visibility_score')::numeric
               ELSE NULL
             END
           ),
           updated_at=NOW()
       WHERE id=$3`,
      [prResult.pr_number, prResult.pr_url, jobId]
    );

    console.log(`[AutoScoreFix] Job ${jobId}: PR created — ${prResult.pr_url}`);
  } catch (err: any) {
    const msg = String(err?.message || 'Unknown error');
    console.error(`[AutoScoreFix] Job ${jobId} failed:`, msg);
    await markJobFailedWithRefund(jobId, row.user_id, msg);
  }
}

let workerRunning = false;

async function claimNextAutoScoreFixJobId(): Promise<string | null> {
  return executeTransaction(async (client: any) => {
    const { rows } = await client.query(
      `SELECT id
       FROM auto_score_fix_jobs
       WHERE status IN ('pending', 'generating', 'creating_pr')
       ORDER BY created_at ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED`
    );
    if (!rows.length) return null;

    const jobId = String(rows[0].id);
    await client.query(
      `UPDATE auto_score_fix_jobs
       SET status = CASE WHEN status = 'pending' THEN 'generating' ELSE status END,
           updated_at = NOW()
       WHERE id = $1`,
      [jobId]
    );
    return jobId;
  });
}

export function startAutoScoreFixWorkerLoop(): void {
  const globalDisable = process.env.DISABLE_BACKGROUND_JOBS === 'true';
  const loopDisable = process.env.DISABLE_AUTOSCOREFIX === 'true';
  if (globalDisable || loopDisable) {
    console.log('[AutoScoreFix] Worker loop disabled via env (DISABLE_AUTOSCOREFIX or DISABLE_BACKGROUND_JOBS)');
    return;
  }

  const CHECK_INTERVAL_MS = 15 * 1000;

  const tick = async () => {
    if (workerRunning) return;
    workerRunning = true;
    try {
      while (true) {
        const jobId = await claimNextAutoScoreFixJobId();
        if (!jobId) break;
        await processAutoScoreFixJob(jobId);
      }
    } catch (err: any) {
      console.error('[AutoScoreFix] Worker loop error:', err?.message || err);
    } finally {
      workerRunning = false;
    }
  };

  void tick();
  _asfWorkerIntervalId = setInterval(() => {
    void tick();
  }, CHECK_INTERVAL_MS);
  console.log('[AutoScoreFix] Worker loop started (interval: 15s)');
}

let _asfWorkerIntervalId: ReturnType<typeof setInterval> | null = null;

// ─── Job Management ───────────────────────────────────────────────────────────

export async function getJobsForUser(
  userId: string,
  workspaceId: string,
  limit = 20
): Promise<unknown[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id, target_url, vcs_provider, repo_owner, repo_name, repo_branch,
            status, credits_spent, pr_number, pr_url, pr_title,
            fix_plan, error_message, expires_at, approved_at, rejected_at,
            refund_processed_at, refund_credits,
            implementation_duration_minutes, checks_status, github_pr_merged_at,
            rescan_status, rescan_scheduled_for, rescan_started_at, rescan_completed_at,
            rescan_audit_id, score_before, score_after, score_delta,
            created_at, updated_at
     FROM auto_score_fix_jobs
     WHERE user_id = $1 AND workspace_id = $2
     ORDER BY created_at DESC
     LIMIT $3`,
    [userId, workspaceId, limit]
  );
  return rows;
}

type PostMergeRescanRunner = (userId: string, workspaceId: string, url: string) => Promise<string | null>;

type PostMergeHooks = {
  onScheduled?: (payload: { userId: string; workspaceId: string; jobId: string; url: string; runAt: string }) => Promise<void> | void;
  onCompleted?: (payload: {
    userId: string;
    workspaceId: string;
    jobId: string;
    url: string;
    auditId: string;
    scoreBefore: number;
    scoreAfter: number;
    scoreDelta: number;
  }) => Promise<void> | void;
  onFailed?: (payload: { userId: string; workspaceId: string; jobId: string; url: string; reason: string }) => Promise<void> | void;
};

async function fetchGitHubPrState(
  owner: string,
  repo: string,
  prNumber: number,
  token: string
): Promise<{ mergedAt: string | null; checksStatus: string }> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'aivis-auto-score-fix',
    },
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`GitHub PR check failed (${res.status}): ${String(err).slice(0, 180)}`);
  }

  const data = (await res.json()) as any;
  const mergedAt = data?.merged_at ? String(data.merged_at) : null;
  const mergeableState = String(data?.mergeable_state || '').toLowerCase();
  const state = String(data?.state || '').toLowerCase();

  let checksStatus = 'pending';
  if (mergedAt) checksStatus = 'passed';
  else if (state === 'closed') checksStatus = 'closed_unmerged';
  else if (mergeableState === 'clean' || mergeableState === 'has_hooks') checksStatus = 'checks_ready';
  else if (mergeableState) checksStatus = mergeableState;

  return { mergedAt, checksStatus };
}

function inferScoreBefore(row: any): number {
  const direct = Number(row?.score_before);
  if (Number.isFinite(direct) && direct >= 0) return direct;

  const snapshot = row?.evidence_snapshot as any;
  const fromSnapshot = Number(snapshot?.visibility_score);
  if (Number.isFinite(fromSnapshot) && fromSnapshot >= 0) return fromSnapshot;

  return 0;
}

let postMergeLoopRunning = false;

export function startAutoScoreFixPostMergeLoop(
  runRescan: PostMergeRescanRunner,
  hooks?: PostMergeHooks
): void {
  const globalDisable = process.env.DISABLE_BACKGROUND_JOBS === 'true';
  const loopDisable = process.env.DISABLE_AUTOSCOREFIX === 'true';
  if (globalDisable || loopDisable) {
    console.log('[AutoScoreFix] Post-merge loop disabled via env (DISABLE_AUTOSCOREFIX or DISABLE_BACKGROUND_JOBS)');
    return;
  }

  const CHECK_INTERVAL_MS = 60 * 1000;

  const tick = async () => {
    if (postMergeLoopRunning) return;
    postMergeLoopRunning = true;
    const pool = getPool();

    try {
      const { rows } = await pool.query(
        `SELECT j.id, j.user_id, j.workspace_id, j.target_url, j.repo_owner, j.repo_name,
                j.pr_number, j.status, j.checks_status, j.github_pr_merged_at,
                j.rescan_status, j.rescan_scheduled_for, j.rescan_started_at,
                j.score_before, j.evidence_snapshot, t.encrypted_token
         FROM auto_score_fix_jobs j
         LEFT JOIN vcs_tokens t ON t.user_id = j.user_id AND t.provider = j.vcs_provider
         WHERE j.vcs_provider = 'github'
           AND j.status = 'approved'
           AND j.pr_number IS NOT NULL
           AND COALESCE(j.rescan_status, 'not_scheduled') IN ('not_scheduled', 'scheduled', 'running', 'failed')
         ORDER BY j.updated_at ASC
         LIMIT 25`
      );

      for (const row of rows as any[]) {
        const jobId = String(row.id);
        const userId = String(row.user_id);
        const workspaceId = String(row.workspace_id || '');
        const targetUrl = String(row.target_url || '');
        const prNumber = Number(row.pr_number || 0);
        const encrypted = row.encrypted_token ? String(row.encrypted_token) : '';

        if (!workspaceId || !targetUrl || !prNumber || !encrypted) continue;

        if (!row.github_pr_merged_at) {
          try {
            const plain = decryptVcsToken(encrypted);
            const prState = await fetchGitHubPrState(String(row.repo_owner), String(row.repo_name), prNumber, plain);

            if (!prState.mergedAt) {
              await pool.query(
                `UPDATE auto_score_fix_jobs
                 SET checks_status = $1,
                     updated_at = NOW()
                 WHERE id = $2`,
                [prState.checksStatus, jobId]
              );
              continue;
            }

            const mergedAt = new Date(prState.mergedAt);
            const runAt = new Date(mergedAt.getTime() + 5 * 60 * 1000);
            await pool.query(
              `UPDATE auto_score_fix_jobs
               SET checks_status = $1,
                   github_pr_merged_at = $2,
                   rescan_status = 'scheduled',
                   rescan_scheduled_for = $3,
                   updated_at = NOW()
               WHERE id = $4`,
              ['passed', mergedAt.toISOString(), runAt.toISOString(), jobId]
            );

            await hooks?.onScheduled?.({
              userId,
              workspaceId,
              jobId,
              url: targetUrl,
              runAt: runAt.toISOString(),
            });
          } catch (err: any) {
            const reason = String(err?.message || 'Failed to check GitHub PR state').slice(0, 300);
            await pool.query(
              `UPDATE auto_score_fix_jobs
               SET checks_status = 'check_error',
                   error_message = COALESCE(error_message, $1),
                   updated_at = NOW()
               WHERE id = $2`,
              [reason, jobId]
            );
          }
          continue;
        }

        const scheduledFor = row.rescan_scheduled_for ? new Date(String(row.rescan_scheduled_for)).getTime() : 0;
        if (!scheduledFor || Date.now() < scheduledFor) continue;

        const claimed = await pool.query(
          `UPDATE auto_score_fix_jobs
           SET rescan_status = 'running',
               rescan_started_at = COALESCE(rescan_started_at, NOW()),
               updated_at = NOW()
           WHERE id = $1
             AND COALESCE(rescan_status, 'not_scheduled') IN ('scheduled', 'failed', 'running')
           RETURNING id`,
          [jobId]
        );
        if (!claimed.rowCount) continue;

        const auditId = await runRescan(userId, workspaceId, targetUrl);
        if (!auditId) {
          const reason = 'Post-fix verification rescan did not return an audit ID';
          await pool.query(
            `UPDATE auto_score_fix_jobs
             SET rescan_status = 'failed',
                 error_message = COALESCE(error_message, $2),
                 updated_at = NOW()
             WHERE id = $1`,
            [jobId, reason]
          );
          await hooks?.onFailed?.({ userId, workspaceId, jobId, url: targetUrl, reason });
          continue;
        }

        const scoreRow = await pool.query(
          `SELECT visibility_score FROM audits WHERE id = $1 LIMIT 1`,
          [auditId]
        );
        const scoreAfter = Number(scoreRow.rows[0]?.visibility_score || 0);
        const scoreBefore = inferScoreBefore(row);
        const scoreDelta = Math.round((scoreAfter - scoreBefore) * 100) / 100;

        await pool.query(
          `UPDATE auto_score_fix_jobs
           SET rescan_status = 'completed',
               rescan_completed_at = NOW(),
               rescan_audit_id = $2,
               score_before = COALESCE(score_before, $3),
               score_after = $4,
               score_delta = $5,
               updated_at = NOW()
           WHERE id = $1`,
          [jobId, auditId, scoreBefore, scoreAfter, scoreDelta]
        );

        await hooks?.onCompleted?.({
          userId,
          workspaceId,
          jobId,
          url: targetUrl,
          auditId,
          scoreBefore,
          scoreAfter,
          scoreDelta,
        });
      }
    } catch (err: any) {
      console.error('[AutoScoreFix] Post-merge loop error:', err?.message || err);
    } finally {
      postMergeLoopRunning = false;
    }
  };

  void tick();
  _asfPostMergeIntervalId = setInterval(() => {
    void tick();
  }, CHECK_INTERVAL_MS);
  console.log('[AutoScoreFix] Post-merge rescan loop started (interval: 60s)');
}

let _asfPostMergeIntervalId: ReturnType<typeof setInterval> | null = null;

export async function getJobById(jobId: string, userId: string, workspaceId?: string): Promise<unknown | null> {
  const pool = getPool();
  const useWorkspaceScope = typeof workspaceId === 'string' && workspaceId.trim().length > 0;
  const query = useWorkspaceScope
    ? `SELECT * FROM auto_score_fix_jobs WHERE id = $1 AND user_id = $2 AND workspace_id = $3`
    : `SELECT * FROM auto_score_fix_jobs WHERE id = $1 AND user_id = $2`;
  const params = useWorkspaceScope ? [jobId, userId, workspaceId] : [jobId, userId];
  const { rows } = await pool.query(query, params);
  return rows[0] || null;
}

export async function approveJob(jobId: string, userId: string, workspaceId?: string): Promise<{ ok: boolean }> {
  const pool = getPool();
  const useWorkspaceScope = typeof workspaceId === 'string' && workspaceId.trim().length > 0;
  const query = useWorkspaceScope
    ? `UPDATE auto_score_fix_jobs
       SET status='approved', approved_at=NOW(), updated_at=NOW()
       WHERE id=$1 AND user_id=$2 AND workspace_id=$3 AND status='pending_approval'`
    : `UPDATE auto_score_fix_jobs
       SET status='approved', approved_at=NOW(), updated_at=NOW()
       WHERE id=$1 AND user_id=$2 AND status='pending_approval'`;
  const params = useWorkspaceScope ? [jobId, userId, workspaceId] : [jobId, userId];
  const { rowCount } = await pool.query(query, params);
  return { ok: (rowCount ?? 0) > 0 };
}

export async function rejectJob(jobId: string, userId: string, workspaceId?: string): Promise<{ ok: boolean; refund: number }> {
  const pool = getPool();
  const useWorkspaceScope = typeof workspaceId === 'string' && workspaceId.trim().length > 0;
  const selectQuery = useWorkspaceScope
    ? `SELECT credits_spent FROM auto_score_fix_jobs
       WHERE id=$1 AND user_id=$2 AND workspace_id=$3 AND status='pending_approval'`
    : `SELECT credits_spent FROM auto_score_fix_jobs
       WHERE id=$1 AND user_id=$2 AND status='pending_approval'`;
  const selectParams = useWorkspaceScope ? [jobId, userId, workspaceId] : [jobId, userId];
  const { rows } = await pool.query(selectQuery, selectParams);
  if (!rows.length) return { ok: false, refund: 0 };

  const creditsSpent = Number(rows[0].credits_spent || 0);
  const refundAmount = Math.round(creditsSpent * AUTO_SCORE_FIX_REFUND_PERCENT * 100) / 100;

  await executeTransaction(async (client: any) => {
    await client.query(
      `UPDATE auto_score_fix_jobs
       SET status='rejected', rejected_at=NOW(), refund_processed_at=NOW(),
           refund_credits=$1, updated_at=NOW()
       WHERE id=$2`,
      [refundAmount, jobId]
    );
    // Refund credits
    await client.query(
      `INSERT INTO scan_pack_credits (user_id, credits_remaining, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE
         SET credits_remaining = ROUND((scan_pack_credits.credits_remaining + $2)::numeric, 2),
             updated_at = NOW()`,
      [userId, refundAmount]
    );
    await client.query(
      `INSERT INTO credit_usage_ledger (user_id, delta_credits, balance_after, reason, metadata)
       SELECT $1, $2, credits_remaining, 'auto_score_fix_rejection_refund', $3
       FROM scan_pack_credits WHERE user_id = $1`,
      [userId, refundAmount, JSON.stringify({ jobId, refund_percent: 80 })]
    );
  });

  return { ok: true, refund: refundAmount };
}

export async function cancelJob(
  jobId: string,
  userId: string,
  workspaceId?: string
): Promise<{ ok: boolean; refund: number; status: 'cancelled' | 'rejected' }> {
  const pool = getPool();
  const useWorkspaceScope = typeof workspaceId === 'string' && workspaceId.trim().length > 0;

  const selectQuery = useWorkspaceScope
    ? `SELECT status, credits_spent, refund_processed_at
       FROM auto_score_fix_jobs
       WHERE id = $1 AND user_id = $2 AND workspace_id = $3`
    : `SELECT status, credits_spent, refund_processed_at
       FROM auto_score_fix_jobs
       WHERE id = $1 AND user_id = $2`;
  const selectParams = useWorkspaceScope ? [jobId, userId, workspaceId] : [jobId, userId];
  const { rows } = await pool.query(selectQuery, selectParams);
  if (!rows.length) return { ok: false, refund: 0, status: 'cancelled' };

  const row = rows[0] as { status: JobStatus; credits_spent: string | number; refund_processed_at?: string | null };
  if (row.status === 'approved' || row.status === 'rejected' || row.status === 'expired' || row.status === 'failed' || row.status === 'cancelled') {
    return { ok: false, refund: 0, status: 'cancelled' };
  }

  if (row.status === 'pending_approval') {
    const rejected = await rejectJob(jobId, userId, workspaceId);
    return { ok: rejected.ok, refund: rejected.refund, status: 'rejected' };
  }

  const creditsSpent = Number(row.credits_spent || 0);
  const refundAmount = Math.round(creditsSpent * 100) / 100;

  await executeTransaction(async (client: any) => {
    const updateQuery = useWorkspaceScope
      ? `UPDATE auto_score_fix_jobs
         SET status='cancelled',
             error_message = 'Cancelled by user before PR approval',
             rejected_at=NOW(),
             refund_processed_at=NOW(),
             refund_credits=$1,
             updated_at=NOW()
         WHERE id=$2 AND user_id=$3 AND workspace_id=$4 AND status IN ('pending','generating','creating_pr')`
      : `UPDATE auto_score_fix_jobs
         SET status='cancelled',
             error_message = 'Cancelled by user before PR approval',
             rejected_at=NOW(),
             refund_processed_at=NOW(),
             refund_credits=$1,
             updated_at=NOW()
         WHERE id=$2 AND user_id=$3 AND status IN ('pending','generating','creating_pr')`;
    const updateParams = useWorkspaceScope
      ? [refundAmount, jobId, userId, workspaceId]
      : [refundAmount, jobId, userId];
    const updateResult = await client.query(updateQuery, updateParams);
    if ((updateResult.rowCount ?? 0) === 0) {
      throw new Error('Job is no longer cancelable');
    }

    await client.query(
      `INSERT INTO scan_pack_credits (user_id, credits_remaining, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE
         SET credits_remaining = ROUND((scan_pack_credits.credits_remaining + $2)::numeric, 2),
             updated_at = NOW()`,
      [userId, refundAmount]
    );
    await client.query(
      `INSERT INTO credit_usage_ledger (user_id, delta_credits, balance_after, reason, metadata)
       SELECT $1, $2, credits_remaining, 'auto_score_fix_cancel_refund', $3
       FROM scan_pack_credits WHERE user_id = $1`,
      [userId, refundAmount, JSON.stringify({ jobId, refund_percent: 100, reason: 'User cancelled before PR approval' })]
    );
  });

  return { ok: true, refund: refundAmount, status: 'cancelled' };
}

// ─── Expiry Loop (call once from server startup) ──────────────────────────────

export function startAutoScoreFixExpiryLoop(): void {
  const CHECK_INTERVAL_MS = 10 * 60 * 1000; // every 10 minutes

  const runExpiry = async () => {
    const pool = getPool();
    try {
      // Find jobs that have passed the 49-hour threshold (1 hour grace after 48hr expiry)
      const { rows: expired } = await pool.query(
        `SELECT id, user_id, credits_spent
         FROM auto_score_fix_jobs
         WHERE status = 'pending_approval'
           AND expires_at < (NOW() - INTERVAL '1 hour')
           AND refund_processed_at IS NULL`
      );

      for (const job of expired) {
        const creditsSpent = Number(job.credits_spent || 0);
        const refundAmount = Math.round(creditsSpent * AUTO_SCORE_FIX_REFUND_PERCENT * 100) / 100;
        try {
          await executeTransaction(async (client: any) => {
            await client.query(
              `UPDATE auto_score_fix_jobs
               SET status='expired', refund_processed_at=NOW(), refund_credits=$1, updated_at=NOW()
               WHERE id=$2`,
              [refundAmount, job.id]
            );
            await client.query(
              `INSERT INTO scan_pack_credits (user_id, credits_remaining, updated_at)
               VALUES ($1, $2, NOW())
               ON CONFLICT (user_id) DO UPDATE
                 SET credits_remaining = ROUND((scan_pack_credits.credits_remaining + $2)::numeric, 2),
                     updated_at = NOW()`,
              [job.user_id, refundAmount]
            );
            await client.query(
              `INSERT INTO credit_usage_ledger (user_id, delta_credits, balance_after, reason, metadata)
               SELECT $1, $2, credits_remaining, 'auto_score_fix_expiry_refund', $3
               FROM scan_pack_credits WHERE user_id = $1`,
              [
                job.user_id,
                refundAmount,
                JSON.stringify({
                  jobId: job.id,
                  refund_percent: 80,
                  fee_percent: 20,
                  reason: 'No approval received within 49 hours',
                }),
              ]
            );
          });
          console.log(`[AutoScoreFix] Job ${job.id} expired — ${refundAmount} credits refunded (80%)`);
        } catch (err: any) {
          console.error(`[AutoScoreFix] Expiry refund failed for job ${job.id}:`, err?.message);
        }
      }
    } catch (err: any) {
      console.error('[AutoScoreFix] Expiry loop error:', err?.message);
    }
  };

  const globalDisable = process.env.DISABLE_BACKGROUND_JOBS === 'true';
  const loopDisable = process.env.DISABLE_AUTOSCOREFIX === 'true';
  if (globalDisable || loopDisable) {
    console.log('[AutoScoreFix] Expiry loop disabled via env (DISABLE_AUTOSCOREFIX or DISABLE_BACKGROUND_JOBS)');
    return;
  }

  // Run immediately and then on interval
  runExpiry();
  _asfExpiryIntervalId = setInterval(runExpiry, CHECK_INTERVAL_MS);
  console.log('[AutoScoreFix] Expiry loop started (interval: 10 min)');
}

let _asfExpiryIntervalId: ReturnType<typeof setInterval> | null = null;

export function stopAllAutoScoreFixLoops(): void {
  if (_asfWorkerIntervalId) { clearInterval(_asfWorkerIntervalId); _asfWorkerIntervalId = null; }
  if (_asfPostMergeIntervalId) { clearInterval(_asfPostMergeIntervalId); _asfPostMergeIntervalId = null; }
  if (_asfExpiryIntervalId) { clearInterval(_asfExpiryIntervalId); _asfExpiryIntervalId = null; }
  console.log('[AutoScoreFix] All loops stopped');
}
