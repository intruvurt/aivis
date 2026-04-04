import { getPool } from './postgresql.js';

function normalizeDomain(input: string): string | null {
  try {
    const parsed = new URL(input);
    return parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
}

export async function ensureWorkspaceProjectForUrl(workspaceId: string, url: string): Promise<string | null> {
  const domain = normalizeDomain(url);
  if (!domain) return null;

  const pool = getPool();
  const workspaceResult = await pool.query<{ organization_id: string }>(
    `SELECT organization_id FROM workspaces WHERE id = $1 LIMIT 1`,
    [workspaceId],
  );
  const organizationId = workspaceResult.rows[0]?.organization_id;
  if (!organizationId) return null;

  const existing = await pool.query<{ id: string }>(
    `SELECT id FROM v1_projects WHERE org_id = $1 AND domain = $2 LIMIT 1`,
    [organizationId, domain],
  );
  if (existing.rows[0]?.id) {
    return String(existing.rows[0].id);
  }

  const inserted = await pool.query<{ id: string }>(
    `INSERT INTO v1_projects (org_id, domain, created_at, updated_at)
     VALUES ($1, $2, NOW(), NOW())
     ON CONFLICT (org_id, domain) DO UPDATE SET updated_at = NOW()
     RETURNING id`,
    [organizationId, domain],
  );
  return inserted.rows[0]?.id ? String(inserted.rows[0].id) : null;
}