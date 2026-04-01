import { createHash, timingSafeEqual, randomBytes } from 'crypto';
import { getPool } from './postgresql.js';

export type DeployHookProvider = 'generic' | 'vercel' | 'netlify';

export interface DeployHookEndpoint {
  id: string;
  user_id: string;
  workspace_id: string;
  provider: DeployHookProvider;
  name: string;
  secret_hint: string;
  default_url: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

function normalizeProvider(provider: unknown): DeployHookProvider {
  const value = String(provider || '').trim().toLowerCase();
  if (value === 'vercel' || value === 'netlify') return value;
  return 'generic';
}

export async function listDeployHookEndpoints(userId: string, workspaceId: string): Promise<DeployHookEndpoint[]> {
  const { rows } = await getPool().query(
    `SELECT id, user_id, workspace_id, provider, name, secret_hint, default_url, enabled, created_at, updated_at
     FROM deploy_hook_endpoints
     WHERE user_id = $1 AND workspace_id = $2
     ORDER BY created_at DESC`,
    [userId, workspaceId]
  );
  return rows;
}

export async function createDeployHookEndpoint(args: {
  userId: string;
  workspaceId: string;
  name: string;
  provider?: unknown;
  defaultUrl?: string | null;
}): Promise<{ endpoint: DeployHookEndpoint; plaintextSecret: string }> {
  const provider = normalizeProvider(args.provider);
  const plaintextSecret = randomBytes(24).toString('base64url');
  const secretHint = plaintextSecret.slice(-6);
  const { rows } = await getPool().query(
    `INSERT INTO deploy_hook_endpoints (user_id, workspace_id, provider, name, secret_hash, secret_hint, default_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, user_id, workspace_id, provider, name, secret_hint, default_url, enabled, created_at, updated_at`,
    [args.userId, args.workspaceId, provider, args.name.trim().slice(0, 120), hashSecret(plaintextSecret), secretHint, args.defaultUrl || null]
  );
  return { endpoint: rows[0], plaintextSecret };
}

export async function updateDeployHookEndpoint(
  id: string,
  userId: string,
  workspaceId: string,
  updates: { enabled?: boolean; defaultUrl?: string | null; name?: string; provider?: unknown }
): Promise<DeployHookEndpoint | null> {
  const sets: string[] = ['updated_at = NOW()'];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (typeof updates.enabled === 'boolean') {
    sets.push(`enabled = $${paramIndex}`);
    values.push(updates.enabled);
    paramIndex += 1;
  }
  if (typeof updates.defaultUrl !== 'undefined') {
    sets.push(`default_url = $${paramIndex}`);
    values.push(updates.defaultUrl || null);
    paramIndex += 1;
  }
  if (typeof updates.name === 'string') {
    sets.push(`name = $${paramIndex}`);
    values.push(updates.name.trim().slice(0, 120));
    paramIndex += 1;
  }
  if (typeof updates.provider !== 'undefined') {
    sets.push(`provider = $${paramIndex}`);
    values.push(normalizeProvider(updates.provider));
    paramIndex += 1;
  }

  values.push(id, userId, workspaceId);
  const { rows } = await getPool().query(
    `UPDATE deploy_hook_endpoints
     SET ${sets.join(', ')}
     WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1} AND workspace_id = $${paramIndex + 2}
     RETURNING id, user_id, workspace_id, provider, name, secret_hint, default_url, enabled, created_at, updated_at`,
    values
  );
  return rows[0] || null;
}

export async function deleteDeployHookEndpoint(id: string, userId: string, workspaceId: string): Promise<boolean> {
  const { rowCount } = await getPool().query(
    `DELETE FROM deploy_hook_endpoints WHERE id = $1 AND user_id = $2 AND workspace_id = $3`,
    [id, userId, workspaceId]
  );
  return (rowCount || 0) > 0;
}

export async function resolveDeployHookBySecret(id: string, providedSecret: string): Promise<(DeployHookEndpoint & { user_id: string; workspace_id: string }) | null> {
  const { rows } = await getPool().query(
    `SELECT id, user_id, workspace_id, provider, name, secret_hash, secret_hint, default_url, enabled, created_at, updated_at
     FROM deploy_hook_endpoints
     WHERE id = $1 AND enabled = TRUE
     LIMIT 1`,
    [id]
  );
  const row = rows[0];
  if (!row) return null;
  const expected = Buffer.from(String(row.secret_hash), 'utf8');
  const actual = Buffer.from(hashSecret(providedSecret), 'utf8');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }
  return row;
}

export function extractDeployHookPayload(provider: DeployHookProvider, body: Record<string, unknown>): {
  url: string | null;
  deploymentId: string | null;
  commitSha: string | null;
  environment: string | null;
  triggerMetadata: Record<string, unknown>;
} {
  const urlCandidates = [
    body.url,
    body.target_url,
    body.deploy_url,
    body.alias,
    body['url'],
    (body.deployment as Record<string, unknown> | undefined)?.url,
    (body.links as Record<string, unknown> | undefined)?.alias,
  ];
  const url = urlCandidates.find((value) => typeof value === 'string' && String(value).trim().length > 0);

  const deploymentId = [body.id, body.deployment_id, (body.deployment as Record<string, unknown> | undefined)?.id]
    .find((value) => typeof value === 'string' && String(value).trim().length > 0);
  const commitSha = [body.commit_sha, body.commitSha, body.sha, (body.commit_ref as Record<string, unknown> | undefined)?.sha]
    .find((value) => typeof value === 'string' && String(value).trim().length > 0);
  const environment = [body.environment, body.context, (body.deployment as Record<string, unknown> | undefined)?.target]
    .find((value) => typeof value === 'string' && String(value).trim().length > 0);

  return {
    url: typeof url === 'string' ? url : null,
    deploymentId: typeof deploymentId === 'string' ? deploymentId : null,
    commitSha: typeof commitSha === 'string' ? commitSha : null,
    environment: typeof environment === 'string' ? environment : provider,
    triggerMetadata: body,
  };
}
