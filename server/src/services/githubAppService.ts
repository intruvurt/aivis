/**
 * GitHub App Service
 *
 * Manages GitHub App authentication (JWT + installation tokens),
 * installation lifecycle, and repository access for AiVIS.biz AutoFix Engine.
 *
 * GitHub App ≠ OAuth: acts as a system identity with fine-grained per-repo permissions.
 * Uses RS256 JWT signed with the app's private key to obtain short-lived installation tokens.
 *
 * Env vars:
 *   GITHUB_APP_ID              - numeric App ID
 *   GITHUB_APP_PRIVATE_KEY     - PEM-encoded RSA private key (newlines as \n)
 *   GITHUB_APP_WEBHOOK_SECRET  - webhook signature secret
 *   GITHUB_APP_CLIENT_ID       - OAuth client ID for the GitHub App (install flow)
 *   GITHUB_APP_SLUG            - e.g. "aivis-autofix-engine" (for install URL)
 */

import crypto from 'crypto';
import { getPool } from './postgresql.js';

let githubInstallationsTableReady = false;

async function ensureGitHubInstallationsTable(): Promise<void> {
  if (githubInstallationsTableReady) return;

  const pool = getPool();
  await pool.query(
    `CREATE TABLE IF NOT EXISTS github_app_installations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR(255) NOT NULL,
      workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
      installation_id INTEGER NOT NULL UNIQUE,
      account_login VARCHAR(255) NOT NULL,
      account_type VARCHAR(20) NOT NULL DEFAULT 'User',
      permissions JSONB NOT NULL DEFAULT '{}',
      repo_selection VARCHAR(20) NOT NULL DEFAULT 'all',
      suspended_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`
  );
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_github_app_inst_user ON github_app_installations(user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_github_app_inst_workspace ON github_app_installations(workspace_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_github_app_inst_id ON github_app_installations(installation_id)`);

  githubInstallationsTableReady = true;
}

async function queryGitHubInstallations<T = any>(sql: string, params: unknown[]): Promise<{ rows: T[] }> {
  const pool = getPool();

  try {
    return await pool.query(sql, params);
  } catch (error: any) {
    if (error?.code !== '42P01') throw error;
    await ensureGitHubInstallationsTable();
    return await pool.query(sql, params);
  }
}

// ─── Env ──────────────────────────────────────────────────────────────────────

function requireEnv(name: string): string {
  const val = (process.env[name] || '').trim();
  if (!val) throw new Error(`[GitHubApp] Missing required env var: ${name}`);
  return val;
}

function getPrivateKey(): string {
  const raw = (process.env.GITHUB_APP_PRIVATE_KEY || '').trim();
  if (!raw) throw new Error('[GitHubApp] GITHUB_APP_PRIVATE_KEY is not configured');
  // Support env strings with literal \n
  return raw.replace(/\\n/g, '\n');
}

export function isGitHubAppConfigured(): boolean {
  return !!(
    process.env.GITHUB_APP_ID?.trim() &&
    process.env.GITHUB_APP_PRIVATE_KEY?.trim()
  );
}

// ─── JWT Generation (RS256) ──────────────────────────────────────────────────

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Create a short-lived JWT (max 10 min) to authenticate as the GitHub App.
 * Per GitHub docs: iat can be up to 60s in the past, exp max 10 min from now.
 */
export function createAppJWT(): string {
  const appId = requireEnv('GITHUB_APP_ID');
  const privateKey = getPrivateKey();

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iat: now - 60,  // 60s clock skew allowance
    exp: now + 600, // 10 minutes
    iss: appId,
  };

  const encHeader = base64url(Buffer.from(JSON.stringify(header)));
  const encPayload = base64url(Buffer.from(JSON.stringify(payload)));
  const signingInput = `${encHeader}.${encPayload}`;

  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signingInput);
  sign.end();
  const signature = base64url(sign.sign(privateKey));

  return `${signingInput}.${signature}`;
}

// ─── Installation Token ──────────────────────────────────────────────────────

const tokenCache = new Map<number, { token: string; expiresAt: number }>();

/**
 * Get a short-lived installation access token from GitHub.
 * Caches tokens until 5 min before expiry.
 */
export async function getInstallationToken(installationId: number): Promise<string> {
  const cached = tokenCache.get(installationId);
  if (cached && cached.expiresAt > Date.now() + 5 * 60 * 1000) {
    return cached.token;
  }

  const jwt = createAppJWT();
  const res = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'AiVIS.biz-AutoFix-Engine/1.0',
      },
    }
  );

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`[GitHubApp] Failed to get installation token (${res.status}): ${body.slice(0, 200)}`);
  }

  const data = await res.json() as { token: string; expires_at: string };
  const expiresAt = new Date(data.expires_at).getTime();

  tokenCache.set(installationId, { token: data.token, expiresAt });
  return data.token;
}

// ─── Installation DB Operations ──────────────────────────────────────────────

export interface GitHubAppInstallation {
  id: string;
  user_id: string;
  workspace_id?: string | null;
  installation_id: number;
  account_login: string;
  account_type: string; // 'User' | 'Organization'
  permissions: Record<string, string>;
  repo_selection: string; // 'all' | 'selected'
  created_at: string;
  updated_at: string;
}

/**
 * Store or update a GitHub App installation for a user.
 */
export async function saveInstallation(
  userId: string,
  workspaceId: string | null,
  installationId: number,
  accountLogin: string,
  accountType: string,
  permissions: Record<string, string>,
  repoSelection: string,
): Promise<void> {
  await queryGitHubInstallations(
    `INSERT INTO github_app_installations
       (user_id, workspace_id, installation_id, account_login, account_type, permissions, repo_selection, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (installation_id) DO UPDATE
       SET user_id = $1,
           workspace_id = COALESCE($2, github_app_installations.workspace_id),
           account_login = $4,
           account_type = $5,
           permissions = $6,
           repo_selection = $7,
           suspended_at = NULL,
           updated_at = NOW()`,
    [userId, workspaceId, installationId, accountLogin, accountType, JSON.stringify(permissions), repoSelection]
  );
}

export async function getInstallationForWorkspace(
  workspaceId: string,
): Promise<GitHubAppInstallation | null> {
  const { rows } = await queryGitHubInstallations<GitHubAppInstallation>(
    `SELECT * FROM github_app_installations
     WHERE workspace_id = $1 AND suspended_at IS NULL
     ORDER BY updated_at DESC LIMIT 1`,
    [workspaceId]
  );
  return rows[0] || null;
}

/**
 * Get installation for a specific user.
 */
export async function getInstallationForUser(
  userId: string,
): Promise<GitHubAppInstallation | null> {
  const { rows } = await queryGitHubInstallations<GitHubAppInstallation>(
    `SELECT * FROM github_app_installations
     WHERE user_id = $1 AND suspended_at IS NULL
     ORDER BY updated_at DESC LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

/**
 * Get installation by installation_id.
 */
export async function getInstallationById(
  installationId: number,
): Promise<GitHubAppInstallation | null> {
  const { rows } = await queryGitHubInstallations<GitHubAppInstallation>(
    'SELECT * FROM github_app_installations WHERE installation_id = $1 LIMIT 1',
    [installationId]
  );
  return rows[0] || null;
}

/**
 * Mark installation as suspended (GitHub sends this when user suspends the app).
 */
export async function suspendInstallation(installationId: number): Promise<void> {
  await queryGitHubInstallations(
    `UPDATE github_app_installations SET suspended_at = NOW(), updated_at = NOW()
     WHERE installation_id = $1`,
    [installationId]
  );
  tokenCache.delete(installationId);
}

/**
 * Remove installation (GitHub sends this when user uninstalls the app).
 */
export async function removeInstallation(installationId: number): Promise<void> {
  await queryGitHubInstallations('DELETE FROM github_app_installations WHERE installation_id = $1', [installationId]);
  tokenCache.delete(installationId);
}

/**
 * Unsuspend installation.
 */
export async function unsuspendInstallation(installationId: number): Promise<void> {
  await queryGitHubInstallations(
    `UPDATE github_app_installations SET suspended_at = NULL, updated_at = NOW()
     WHERE installation_id = $1`,
    [installationId]
  );
}

// ─── Repository Operations via Installation Token ────────────────────────────

/**
 * List repos accessible to the installation.
 */
export async function listInstallationRepos(
  installationId: number,
  page = 1,
  perPage = 30,
): Promise<{ repos: Array<{ full_name: string; name: string; owner: string; default_branch: string; private: boolean }>; total: number }> {
  const token = await getInstallationToken(installationId);
  const res = await fetch(
    `https://api.github.com/installation/repositories?page=${page}&per_page=${perPage}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'AiVIS.biz-AutoFix-Engine/1.0',
      },
    }
  );

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`[GitHubApp] Failed to list repos (${res.status}): ${body.slice(0, 200)}`);
  }

  const data = await res.json() as { total_count: number; repositories: any[] };
  return {
    total: data.total_count,
    repos: (data.repositories || []).map((r: any) => ({
      full_name: r.full_name,
      name: r.name,
      owner: r.owner?.login || '',
      default_branch: r.default_branch || 'main',
      private: !!r.private,
    })),
  };
}

/**
 * List branches for a repo via installation token.
 */
export async function listInstallationBranches(
  installationId: number,
  owner: string,
  repo: string,
): Promise<Array<{ name: string; protected: boolean }>> {
  const token = await getInstallationToken(installationId);
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/branches?per_page=100`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'AiVIS.biz-AutoFix-Engine/1.0',
      },
    }
  );

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`[GitHubApp] Failed to list branches (${res.status}): ${body.slice(0, 200)}`);
  }

  const data = await res.json() as any[];
  return (data || []).map((b: any) => ({ name: b.name, protected: !!b.protected }));
}

// ─── Webhook Signature Verification ──────────────────────────────────────────

/**
 * Verify GitHub webhook signature (HMAC-SHA256).
 * Returns true if signature is valid.
 */
export function verifyWebhookSignature(payload: string | Buffer, signatureHeader: string): boolean {
  const secret = (process.env.GITHUB_APP_WEBHOOK_SECRET || '').trim();
  if (!secret) {
    console.warn('[GitHubApp] GITHUB_APP_WEBHOOK_SECRET not set - cannot verify webhook');
    return false;
  }

  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'utf8'),
      Buffer.from(signatureHeader, 'utf8'),
    );
  } catch {
    return false;
  }
}

// ─── Create PR via Installation Token ────────────────────────────────────────

export interface GitHubPRInput {
  installationId: number;
  owner: string;
  repo: string;
  baseBranch: string;
  title: string;
  body: string;
  files: Array<{ path: string; content: string; operation: 'create' | 'update'; justification: string }>;
}

/**
 * Create a branch, commit files, and open a PR using a GitHub App installation token.
 * This is the GitHub App equivalent of the OAuth-based createGitHubPR in AutoScoreFixService.
 */
export async function createPRViaApp(input: GitHubPRInput): Promise<{ pr_number: number; pr_url: string; branch: string }> {
  const token = await getInstallationToken(input.installationId);
  const baseUrl = `https://api.github.com/repos/${input.owner}/${input.repo}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'AiVIS.biz-AutoFix-Engine/1.0',
  };

  // 1. Get base branch SHA
  const refRes = await fetch(`${baseUrl}/git/refs/heads/${input.baseBranch}`, { headers });
  if (!refRes.ok) {
    const err = await refRes.text().catch(() => '');
    throw new Error(`[GitHubApp] Failed to get base ref: ${err.slice(0, 200)}`);
  }
  const refData = await refRes.json() as any;
  const baseSha = refData.object?.sha;
  if (!baseSha) throw new Error('[GitHubApp] Could not read base branch SHA');

  // 2. Create fix branch
  const fixBranch = `aivis-autofix-${Date.now()}`;
  const createBranchRes = await fetch(`${baseUrl}/git/refs`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ref: `refs/heads/${fixBranch}`, sha: baseSha }),
  });
  if (!createBranchRes.ok) {
    const err = await createBranchRes.text().catch(() => '');
    throw new Error(`[GitHubApp] Failed to create branch: ${err.slice(0, 200)}`);
  }

  // 3. Commit each file
  for (const file of input.files) {
    const contentB64 = Buffer.from(file.content, 'utf8').toString('base64');

    let existingSha: string | undefined;
    try {
      const existRes = await fetch(`${baseUrl}/contents/${file.path}?ref=${fixBranch}`, { headers });
      if (existRes.ok) {
        const existData = await existRes.json() as any;
        existingSha = existData.sha;
      }
    } catch {
      // file doesn't exist - will create
    }

    const body: Record<string, unknown> = {
      message: `fix(aivis): ${file.justification.slice(0, 72)}`,
      content: contentB64,
      branch: fixBranch,
    };
    if (existingSha) body.sha = existingSha;

    const putRes = await fetch(`${baseUrl}/contents/${file.path}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    });
    if (!putRes.ok) {
      const err = await putRes.text().catch(() => '');
      throw new Error(`[GitHubApp] Failed to commit ${file.path}: ${err.slice(0, 200)}`);
    }
  }

  // 4. Create PR
  const prRes = await fetch(`${baseUrl}/pulls`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: input.title,
      body: input.body,
      head: fixBranch,
      base: input.baseBranch,
      draft: false,
    }),
  });
  if (!prRes.ok) {
    const err = await prRes.text().catch(() => '');
    throw new Error(`[GitHubApp] Failed to create PR: ${err.slice(0, 300)}`);
  }
  const prData = await prRes.json() as any;
  return {
    pr_number: prData.number,
    pr_url: prData.html_url,
    branch: fixBranch,
  };
}
