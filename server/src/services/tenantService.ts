import { getPool } from './postgresql.js';
import { randomBytes } from 'crypto';

export type WorkspaceContext = {
  workspaceId: string;
  workspaceName: string;
  organizationId: string;
  organizationName: string;
  membershipRole: 'owner' | 'admin' | 'member' | 'viewer';
  isDefaultWorkspace: boolean;
};

export type WorkspaceMemberView = {
  workspaceId: string;
  workspaceName: string;
  organizationId: string;
  organizationName: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  isDefaultWorkspace: boolean;
};

function safeSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'workspace';
}

export async function ensureDefaultWorkspaceForUser(userId: string, preferredLabel?: string): Promise<WorkspaceContext> {
  const pool = getPool();

  const existing = await resolveWorkspaceForUser(userId, undefined);
  if (existing) return existing;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orgName = preferredLabel?.trim() ? `${preferredLabel.trim()} Personal Org` : 'Personal Organization';
    const orgSlug = `personal-${safeSlug(userId).slice(0, 24)}`;

    const orgInsert = await client.query(
      `INSERT INTO organizations (name, slug, owner_user_id, is_personal)
       VALUES ($1, $2, $3, TRUE)
       RETURNING id, name`,
      [orgName, orgSlug, userId]
    );

    const organizationId = orgInsert.rows[0].id as string;
    const organizationName = orgInsert.rows[0].name as string;

    const workspaceInsert = await client.query(
      `INSERT INTO workspaces (organization_id, name, slug, created_by_user_id, is_default)
       VALUES ($1, $2, 'default', $3, TRUE)
       RETURNING id, name`,
      [organizationId, 'Personal Workspace', userId]
    );

    const workspaceId = workspaceInsert.rows[0].id as string;
    const workspaceName = workspaceInsert.rows[0].name as string;

    await client.query(
      `INSERT INTO workspace_members (workspace_id, user_id, role)
       VALUES ($1, $2, 'owner')
       ON CONFLICT (workspace_id, user_id) DO NOTHING`,
      [workspaceId, userId]
    );

    await client.query('COMMIT');

    return {
      workspaceId,
      workspaceName,
      organizationId,
      organizationName,
      membershipRole: 'owner',
      isDefaultWorkspace: true,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function resolveWorkspaceForUser(userId: string, requestedWorkspaceId?: string): Promise<WorkspaceContext | null> {
  const pool = getPool();
  const workspaceFilter = requestedWorkspaceId?.trim() || null;

  const { rows } = await pool.query(
    `SELECT
       w.id AS workspace_id,
       w.name AS workspace_name,
       w.is_default,
       o.id AS organization_id,
       o.name AS organization_name,
       wm.role AS membership_role
     FROM workspace_members wm
     JOIN workspaces w ON w.id = wm.workspace_id
     JOIN organizations o ON o.id = w.organization_id
     WHERE wm.user_id = $1
       AND ($2::uuid IS NULL OR w.id = $2::uuid)
     ORDER BY w.is_default DESC, wm.joined_at ASC
     LIMIT 1`,
    [userId, workspaceFilter]
  );

  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    workspaceId: row.workspace_id,
    workspaceName: row.workspace_name,
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    membershipRole: row.membership_role,
    isDefaultWorkspace: row.is_default === true,
  };
}

export async function listWorkspacesForUser(userId: string): Promise<WorkspaceMemberView[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT
       w.id AS workspace_id,
       w.name AS workspace_name,
       w.is_default,
       o.id AS organization_id,
       o.name AS organization_name,
       wm.role
     FROM workspace_members wm
     JOIN workspaces w ON w.id = wm.workspace_id
     JOIN organizations o ON o.id = w.organization_id
     WHERE wm.user_id = $1
     ORDER BY w.is_default DESC, w.created_at ASC`,
    [userId]
  );

  return rows.map((row) => ({
    workspaceId: row.workspace_id,
    workspaceName: row.workspace_name,
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    role: row.role,
    isDefaultWorkspace: row.is_default === true,
  }));
}

export async function createOrganizationWorkspace(
  ownerUserId: string,
  organizationName: string,
  workspaceName: string
): Promise<WorkspaceContext> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orgSlug = `${safeSlug(organizationName)}-${safeSlug(ownerUserId).slice(0, 8)}`;
    const wsSlug = safeSlug(workspaceName) || 'workspace';

    const orgInsert = await client.query(
      `INSERT INTO organizations (name, slug, owner_user_id, is_personal)
       VALUES ($1, $2, $3, FALSE)
       RETURNING id, name`,
      [organizationName.trim(), orgSlug, ownerUserId]
    );

    const organizationId = orgInsert.rows[0].id as string;
    const organizationNameSaved = orgInsert.rows[0].name as string;

    const wsInsert = await client.query(
      `INSERT INTO workspaces (organization_id, name, slug, created_by_user_id, is_default)
       VALUES ($1, $2, $3, $4, FALSE)
       RETURNING id, name`,
      [organizationId, workspaceName.trim(), wsSlug, ownerUserId]
    );

    const workspaceId = wsInsert.rows[0].id as string;
    const workspaceNameSaved = wsInsert.rows[0].name as string;

    await client.query(
      `INSERT INTO workspace_members (workspace_id, user_id, role)
       VALUES ($1, $2, 'owner')`,
      [workspaceId, ownerUserId]
    );

    await client.query('COMMIT');

    return {
      workspaceId,
      workspaceName: workspaceNameSaved,
      organizationId,
      organizationName: organizationNameSaved,
      membershipRole: 'owner',
      isDefaultWorkspace: false,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function listWorkspaceMembers(workspaceId: string, actorUserId: string) {
  const pool = getPool();

  const actorCheck = await pool.query(
    `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
    [workspaceId, actorUserId]
  );
  if (actorCheck.rows.length === 0) {
    throw new Error('WORKSPACE_ACCESS_DENIED');
  }

  const { rows } = await pool.query(
    `SELECT wm.user_id, wm.role, wm.joined_at, u.email, u.name
     FROM workspace_members wm
     JOIN users u ON u.id = wm.user_id
     WHERE wm.workspace_id = $1
     ORDER BY wm.joined_at ASC`,
    [workspaceId]
  );
  return rows;
}

export async function addWorkspaceMember(
  workspaceId: string,
  actorUserId: string,
  targetUserId: string,
  role: 'admin' | 'member' | 'viewer'
) {
  const pool = getPool();

  const actorCheck = await pool.query(
    `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
    [workspaceId, actorUserId]
  );

  const actorRole = actorCheck.rows[0]?.role as string | undefined;
  if (!actorRole || (actorRole !== 'owner' && actorRole !== 'admin')) {
    throw new Error('WORKSPACE_ROLE_INSUFFICIENT');
  }

  // Protect the owner: never allow downgrading the owner via direct member add
  const existingCheck = await pool.query(
    `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
    [workspaceId, targetUserId]
  );
  if (existingCheck.rows[0]?.role === 'owner') {
    throw new Error('CANNOT_CHANGE_OWNER_ROLE');
  }

  const { rows } = await pool.query(
    `INSERT INTO workspace_members (workspace_id, user_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role
     RETURNING workspace_id, user_id, role, joined_at`,
    [workspaceId, targetUserId, role]
  );

  return rows[0];
}

export async function updateWorkspaceMemberRole(
  workspaceId: string,
  actorUserId: string,
  targetUserId: string,
  newRole: 'admin' | 'member' | 'viewer'
) {
  const pool = getPool();

  const actorCheck = await pool.query(
    `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
    [workspaceId, actorUserId]
  );
  const actorRole = actorCheck.rows[0]?.role as string | undefined;
  if (!actorRole || (actorRole !== 'owner' && actorRole !== 'admin')) {
    throw new Error('WORKSPACE_ROLE_INSUFFICIENT');
  }

  // Cannot change the owner's role
  const targetCheck = await pool.query(
    `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
    [workspaceId, targetUserId]
  );
  if (targetCheck.rows[0]?.role === 'owner') {
    throw new Error('CANNOT_CHANGE_OWNER_ROLE');
  }

  const { rows } = await pool.query(
    `UPDATE workspace_members SET role = $1
     WHERE workspace_id = $2 AND user_id = $3
     RETURNING workspace_id, user_id, role, joined_at`,
    [newRole, workspaceId, targetUserId]
  );

  if (rows.length === 0) throw new Error('MEMBER_NOT_FOUND');
  return rows[0];
}

export async function removeWorkspaceMember(
  workspaceId: string,
  actorUserId: string,
  targetUserId: string
) {
  const pool = getPool();

  const actorCheck = await pool.query(
    `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
    [workspaceId, actorUserId]
  );
  const actorRole = actorCheck.rows[0]?.role as string | undefined;
  if (!actorRole || (actorRole !== 'owner' && actorRole !== 'admin')) {
    throw new Error('WORKSPACE_ROLE_INSUFFICIENT');
  }

  // Cannot remove the owner
  const targetCheck = await pool.query(
    `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
    [workspaceId, targetUserId]
  );
  if (targetCheck.rows[0]?.role === 'owner') {
    throw new Error('CANNOT_REMOVE_OWNER');
  }

  const result = await pool.query(
    `DELETE FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
    [workspaceId, targetUserId]
  );

  if (result.rowCount === 0) throw new Error('MEMBER_NOT_FOUND');
  return { removed: true };
}

export async function createWorkspaceInvite(
  workspaceId: string,
  actorUserId: string,
  email: string,
  role: 'admin' | 'member' | 'viewer'
) {
  const pool = getPool();

  const actorCheck = await pool.query(
    `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
    [workspaceId, actorUserId]
  );
  const actorRole = actorCheck.rows[0]?.role as string | undefined;
  if (!actorRole || (actorRole !== 'owner' && actorRole !== 'admin')) {
    throw new Error('WORKSPACE_ROLE_INSUFFICIENT');
  }

  // Remove any existing pending invite for this email in this workspace before re-inviting
  // so duplicate inserts never cause a generic 500 when a user clicks invite twice
  await pool.query(
    `DELETE FROM workspace_invites WHERE workspace_id = $1 AND email = $2 AND accepted_at IS NULL`,
    [workspaceId, email.toLowerCase().trim()]
  );

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const { rows } = await pool.query(
    `INSERT INTO workspace_invites (workspace_id, email, role, token, expires_at, invited_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, workspace_id, email, role, token, expires_at`,
    [workspaceId, email.toLowerCase().trim(), role, token, expiresAt.toISOString(), actorUserId]
  );

  return rows[0];
}

export async function acceptWorkspaceInvite(inviteToken: string, userId: string) {
  const pool = getPool();

  const { rows } = await pool.query(
    `SELECT id, workspace_id, email, role, expires_at, accepted_at
     FROM workspace_invites
     WHERE token = $1`,
    [inviteToken]
  );

  if (rows.length === 0) throw new Error('INVITE_NOT_FOUND');
  const invite = rows[0];

  if (invite.accepted_at) throw new Error('INVITE_ALREADY_ACCEPTED');
  if (new Date(invite.expires_at) < new Date()) throw new Error('INVITE_EXPIRED');

  // Security: verify the accepting user's email matches the invite target email
  const userRows = await pool.query(`SELECT email FROM users WHERE id = $1`, [userId]);
  const userEmail = String(userRows.rows[0]?.email || '').toLowerCase().trim();
  const inviteEmail = String(invite.email || '').toLowerCase().trim();
  if (userEmail !== inviteEmail) throw new Error('INVITE_EMAIL_MISMATCH');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO workspace_members (workspace_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
      [invite.workspace_id, userId, invite.role]
    );

    await client.query(
      `UPDATE workspace_invites SET accepted_at = NOW() WHERE id = $1`,
      [invite.id]
    );

    await client.query('COMMIT');

    return { workspaceId: invite.workspace_id, role: invite.role };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function listWorkspaceInvites(workspaceId: string, actorUserId: string) {
  const pool = getPool();

  const actorCheck = await pool.query(
    `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
    [workspaceId, actorUserId]
  );
  if (actorCheck.rows.length === 0) throw new Error('WORKSPACE_ACCESS_DENIED');

  const { rows } = await pool.query(
    `SELECT id, email, role, expires_at, accepted_at, created_at
     FROM workspace_invites
     WHERE workspace_id = $1
     ORDER BY created_at DESC`,
    [workspaceId]
  );

  return rows;
}

export async function revokeWorkspaceInvite(
  workspaceId: string,
  inviteId: string,
  actorUserId: string
): Promise<void> {
  const pool = getPool();

  const actorCheck = await pool.query(
    `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
    [workspaceId, actorUserId]
  );
  const actorRole = actorCheck.rows[0]?.role as string | undefined;
  if (!actorRole || (actorRole !== 'owner' && actorRole !== 'admin')) {
    throw new Error('WORKSPACE_ROLE_INSUFFICIENT');
  }

  const result = await pool.query(
    `DELETE FROM workspace_invites WHERE id = $1 AND workspace_id = $2 AND accepted_at IS NULL`,
    [inviteId, workspaceId]
  );
  if ((result.rowCount ?? 0) === 0) throw new Error('INVITE_NOT_FOUND');
}

export async function getWorkspaceMemberCount(workspaceId: string): Promise<number> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT COUNT(*) AS cnt FROM workspace_members WHERE workspace_id = $1`,
    [workspaceId]
  );
  return Number(rows[0]?.cnt ?? 0);
}

export async function renameWorkspace(workspaceId: string, actorUserId: string, newName: string) {
  const pool = getPool();

  const actorCheck = await pool.query(
    `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
    [workspaceId, actorUserId]
  );
  const actorRole = actorCheck.rows[0]?.role as string | undefined;
  if (!actorRole || (actorRole !== 'owner' && actorRole !== 'admin')) {
    throw new Error('WORKSPACE_ROLE_INSUFFICIENT');
  }

  const { rows } = await pool.query(
    `UPDATE workspaces SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name`,
    [newName.trim(), workspaceId]
  );

  if (rows.length === 0) throw new Error('WORKSPACE_NOT_FOUND');
  return rows[0];
}

/**
 * Return the canonical tier of the workspace owner (the member with role='owner').
 * Falls back to 'observer' if the workspace or owner is not found.
 */
export async function getWorkspaceOwnerTier(workspaceId: string): Promise<string> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT u.tier FROM workspace_members wm
     JOIN users u ON u.id = wm.user_id
     WHERE wm.workspace_id = $1 AND wm.role = 'owner'
     LIMIT 1`,
    [workspaceId],
  );
  return rows[0]?.tier || 'observer';
}
