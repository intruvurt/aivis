import { getPool } from './postgresql.js';

let workspaceActivityTableReady = false;

async function ensureWorkspaceActivityTable(): Promise<void> {
  if (workspaceActivityTableReady) return;

  const pool = getPool();
  await pool.query(
    `CREATE TABLE IF NOT EXISTS workspace_activity_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      type VARCHAR(80) NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`
  );
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_workspace_activity_ws ON workspace_activity_log(workspace_id, created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_workspace_activity_user ON workspace_activity_log(user_id, created_at DESC)`);

  workspaceActivityTableReady = true;
}

async function queryWorkspaceActivity<T = any>(sql: string, params: unknown[]): Promise<{ rows: T[] }> {
  const pool = getPool();

  try {
    return (await pool.query(sql, params)) as unknown as { rows: T[] };
  } catch (error: any) {
    if (error?.code !== '42P01') throw error;
    await ensureWorkspaceActivityTable();
    return (await pool.query(sql, params)) as unknown as { rows: T[] };
  }
}

export interface WorkspaceActivityEntry {
  id: string;
  workspace_id: string;
  user_id: string | null;
  type: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export async function logWorkspaceActivity(args: {
  workspaceId: string;
  userId?: string | null;
  type: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await queryWorkspaceActivity(
    `INSERT INTO workspace_activity_log (workspace_id, user_id, type, metadata)
     VALUES ($1, $2, $3, $4)`,
    [
      args.workspaceId,
      args.userId ?? null,
      args.type,
      JSON.stringify(args.metadata || {}),
    ],
  );
}

export async function listWorkspaceActivity(
  workspaceId: string,
  limit = 25,
): Promise<WorkspaceActivityEntry[]> {
  const cappedLimit = Math.min(100, Math.max(1, Number(limit || 25)));
  const { rows } = await queryWorkspaceActivity<WorkspaceActivityEntry>(
    `SELECT id, workspace_id, user_id, type, metadata, created_at
     FROM workspace_activity_log
     WHERE workspace_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [workspaceId, cappedLimit],
  );
  return rows.map((row) => ({
    id: String(row.id),
    workspace_id: String(row.workspace_id),
    user_id: row.user_id ? String(row.user_id) : null,
    type: String(row.type),
    metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata as Record<string, unknown> : {},
    created_at: String(row.created_at),
  }));
}