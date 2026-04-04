import { getPool } from './postgresql.js';

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
  const pool = getPool();
  await pool.query(
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
  const pool = getPool();
  const cappedLimit = Math.min(100, Math.max(1, Number(limit || 25)));
  const { rows } = await pool.query(
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