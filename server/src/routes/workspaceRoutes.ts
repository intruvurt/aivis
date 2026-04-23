import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authRequired } from '../middleware/authRequired.js';
import { workspaceRequired } from '../middleware/workspaceRequired.js';
import { requireWorkspacePermission } from '../middleware/workspacePermission.js';
import {
  addWorkspaceMember,
  createOrganizationWorkspace,
  listWorkspaceMembers,
  listWorkspacesForUser,
  updateWorkspaceMemberRole,
  removeWorkspaceMember,
  createWorkspaceInvite,
  acceptWorkspaceInvite,
  listWorkspaceInvites,
  revokeWorkspaceInvite,
  getWorkspaceMemberCount,
  renameWorkspace,
  getWorkspaceOwnerTier,
} from '../services/tenantService.js';
import { getUserByEmail } from '../models/User.js';
import { TIER_LIMITS, uiTierFromCanonical, type CanonicalTier } from '../../../shared/types.js';
import { sendWorkspaceInviteEmail } from '../services/emailService.js';
import { getPool } from '../services/postgresql.js';
import { listWorkspaceActivity, logWorkspaceActivity } from '../services/workspaceActivityService.js';

const router = Router();

function internalServerError(res: Response, fallback: string) {
  return res.status(500).json({
    success: false,
    error: fallback,
    code: 'INTERNAL_ERROR',
  });
}

function getUserTierLimits(req: Request) {
  const canonical = (req.user?.tier || 'observer') as CanonicalTier;
  const uiTier = uiTierFromCanonical(canonical);
  return TIER_LIMITS[uiTier];
}

function getOwnerTierLimits(ownerTier: string) {
  const uiTier = uiTierFromCanonical((ownerTier || 'observer') as CanonicalTier);
  return TIER_LIMITS[uiTier];
}

router.use(authRequired);
router.use('/:workspaceId', workspaceRequired);

router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = String(req.user?.id || '');
    const data = await listWorkspacesForUser(userId);
    res.json({ success: true, data });
  } catch (err: any) {
    internalServerError(res, 'Failed to list workspaces');
  }
});

router.post(
  '/',
  [
    body('organizationName').isString().isLength({ min: 2, max: 120 }),
    body('workspaceName').isString().isLength({ min: 2, max: 120 }),
  ],
  async (req: Request, res: Response) => {
    try {
      const limits = getUserTierLimits(req);
      if (!limits.hasTeamWorkspaces) {
        return res.status(403).json({
          success: false,
          error: 'Team workspaces require Signal or higher. Upgrade to create shared workspaces.',
          code: 'TIER_REQUIRED',
          requiredTier: 'signal',
        });
      }

      const userId = String(req.user?.id || '');
      const organizationName = String(req.body?.organizationName || '').trim();
      const workspaceName = String(req.body?.workspaceName || '').trim();

      if (!organizationName || !workspaceName) {
        return res.status(400).json({ success: false, error: 'organizationName and workspaceName are required' });
      }

      const created = await createOrganizationWorkspace(userId, organizationName, workspaceName);
      res.status(201).json({ success: true, data: created });
    } catch (err: any) {
      internalServerError(res, 'Failed to create workspace');
    }
  }
);

router.get('/:workspaceId/members', async (req: Request, res: Response) => {
  try {
    const workspaceId = String(req.params.workspaceId || '');
    const actorUserId = String(req.user?.id || '');
    const members = await listWorkspaceMembers(workspaceId, actorUserId);
    res.json({ success: true, data: members });
  } catch (err: any) {
    if (String(err?.message || '').includes('WORKSPACE_ACCESS_DENIED')) {
      return res.status(403).json({ success: false, error: 'You do not have access to this workspace' });
    }
    internalServerError(res, 'Failed to list workspace members');
  }
});

router.post(
  '/:workspaceId/members',
  requireWorkspacePermission('team:manage'),
  [
    body('email').isEmail(),
    body('role').isIn(['admin', 'member', 'viewer']),
  ],
  async (req: Request, res: Response) => {
    try {
      const workspaceId = String(req.params.workspaceId || '');
      const ownerTier = await getWorkspaceOwnerTier(workspaceId);
      const limits = getOwnerTierLimits(ownerTier);
      if (!limits.hasTeamWorkspaces) {
        return res.status(403).json({
          success: false,
          error: 'Team workspaces require Signal or higher.',
          code: 'TIER_REQUIRED',
          requiredTier: 'signal',
        });
      }

      const actorUserId = String(req.user?.id || '');
      const email = String(req.body?.email || '').toLowerCase().trim();
      const role = req.body?.role as 'admin' | 'member' | 'viewer';

      // Enforce seat limit based on workspace owner's tier
      const maxSeats = limits.maxTeamMembers;
      if (maxSeats !== -1) {
        const currentCount = await getWorkspaceMemberCount(workspaceId);
        if (currentCount >= maxSeats) {
          return res.status(403).json({
            success: false,
            error: `This workspace allows a maximum of ${maxSeats} team members. The workspace owner needs to upgrade to add more.`,
            code: 'SEAT_LIMIT_REACHED',
            maxSeats,
            currentCount,
          });
        }
      }

      const target = await getUserByEmail(email);
      if (!target?.id) {
        return res.status(404).json({ success: false, error: 'User not found for provided email' });
      }

      const member = await addWorkspaceMember(workspaceId, actorUserId, target.id, role);
      await logWorkspaceActivity({
        workspaceId,
        userId: actorUserId,
        type: 'workspace.member_added',
        metadata: { targetUserId: target.id, targetEmail: email, role },
      });
      res.status(201).json({ success: true, data: member });
    } catch (err: any) {
      const msg = String(err?.message || '');
      if (msg.includes('WORKSPACE_ROLE_INSUFFICIENT')) {
        return res.status(403).json({ success: false, error: 'Only owners/admins can manage members' });
      }
      if (msg.includes('CANNOT_CHANGE_OWNER_ROLE')) {
        return res.status(403).json({ success: false, error: 'Cannot change the workspace owner role' });
      }
      if (msg.includes('WORKSPACE_ACCESS_DENIED')) {
        return res.status(403).json({ success: false, error: 'You do not have access to this workspace' });
      }
      internalServerError(res, 'Failed to add workspace member');
    }
  }
);

// Update member role
router.patch(
  '/:workspaceId/members/:userId',
  requireWorkspacePermission('team:manage'),
  [body('role').isIn(['admin', 'member', 'viewer'])],
  async (req: Request, res: Response) => {
    try {
      const workspaceId = String(req.params.workspaceId || '');
      const targetUserId = String(req.params.userId || '');
      const actorUserId = String(req.user?.id || '');
      const role = req.body?.role as 'admin' | 'member' | 'viewer';

      const updated = await updateWorkspaceMemberRole(workspaceId, actorUserId, targetUserId, role);
      await logWorkspaceActivity({
        workspaceId,
        userId: actorUserId,
        type: 'workspace.member_role_updated',
        metadata: { targetUserId, role },
      });
      res.json({ success: true, data: updated });
    } catch (err: any) {
      const msg = String(err?.message || '');
      if (msg.includes('WORKSPACE_ROLE_INSUFFICIENT')) {
        return res.status(403).json({ success: false, error: 'Only owners/admins can change roles' });
      }
      if (msg.includes('CANNOT_CHANGE_OWNER_ROLE')) {
        return res.status(403).json({ success: false, error: 'Cannot change the owner role' });
      }
      if (msg.includes('MEMBER_NOT_FOUND')) {
        return res.status(404).json({ success: false, error: 'Member not found' });
      }
      internalServerError(res, 'Failed to update member role');
    }
  }
);

// Remove member
router.delete('/:workspaceId/members/:userId', requireWorkspacePermission('team:manage'), async (req: Request, res: Response) => {
  try {
    const workspaceId = String(req.params.workspaceId || '');
    const targetUserId = String(req.params.userId || '');
    const actorUserId = String(req.user?.id || '');

    await removeWorkspaceMember(workspaceId, actorUserId, targetUserId);
    await logWorkspaceActivity({
      workspaceId,
      userId: actorUserId,
      type: 'workspace.member_removed',
      metadata: { targetUserId },
    });
    res.json({ success: true });
  } catch (err: any) {
    const msg = String(err?.message || '');
    if (msg.includes('WORKSPACE_ROLE_INSUFFICIENT')) {
      return res.status(403).json({ success: false, error: 'Only owners/admins can remove members' });
    }
    if (msg.includes('CANNOT_REMOVE_OWNER')) {
      return res.status(403).json({ success: false, error: 'Cannot remove the workspace owner' });
    }
    if (msg.includes('MEMBER_NOT_FOUND')) {
      return res.status(404).json({ success: false, error: 'Member not found' });
    }
    internalServerError(res, 'Failed to remove member');
  }
});

// Rename workspace
router.patch(
  '/:workspaceId',
  requireWorkspacePermission('team:manage'),
  [body('name').isString().isLength({ min: 2, max: 120 })],
  async (req: Request, res: Response) => {
    try {
      const workspaceId = String(req.params.workspaceId || '');
      const actorUserId = String(req.user?.id || '');
      const name = String(req.body?.name || '').trim();

      const updated = await renameWorkspace(workspaceId, actorUserId, name);
      await logWorkspaceActivity({
        workspaceId,
        userId: actorUserId,
        type: 'workspace.renamed',
        metadata: { name },
      });
      res.json({ success: true, data: updated });
    } catch (err: any) {
      const msg = String(err?.message || '');
      if (msg.includes('WORKSPACE_ROLE_INSUFFICIENT')) {
        return res.status(403).json({ success: false, error: 'Only owners/admins can rename' });
      }
      internalServerError(res, 'Failed to rename workspace');
    }
  }
);

// Create invite
router.post(
  '/:workspaceId/invites',
  requireWorkspacePermission('team:manage'),
  [
    body('email').isEmail(),
    body('role').isIn(['admin', 'member', 'viewer']),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Invalid email or role', details: errors.array() });
    }
    try {
      const workspaceId = String(req.params.workspaceId || '');
      const ownerTier = await getWorkspaceOwnerTier(workspaceId);
      const limits = getOwnerTierLimits(ownerTier);
      if (!limits.hasTeamWorkspaces) {
        return res.status(403).json({
          success: false,
          error: 'Team workspaces require Signal or higher.',
          code: 'TIER_REQUIRED',
          requiredTier: 'signal',
        });
      }

      const actorUserId = String(req.user?.id || '');
      const email = String(req.body?.email || '').toLowerCase().trim();
      const role = req.body?.role as 'admin' | 'member' | 'viewer';

      // Enforce seat limit based on workspace owner's tier
      const maxSeats = limits.maxTeamMembers;
      if (maxSeats !== -1) {
        const currentCount = await getWorkspaceMemberCount(workspaceId);
        if (currentCount >= maxSeats) {
          return res.status(403).json({
            success: false,
            error: `This workspace allows a maximum of ${maxSeats} team members. The workspace owner needs to upgrade to invite more.`,
            code: 'SEAT_LIMIT_REACHED',
            maxSeats,
            currentCount,
          });
        }
      }

      const invite = await createWorkspaceInvite(workspaceId, actorUserId, email, role);
      await logWorkspaceActivity({
        workspaceId,
        userId: actorUserId,
        type: 'workspace.invite_created',
        metadata: { email, role, inviteId: invite.id },
      });

      // Send invite email (best-effort - don't fail the request if email fails)
      try {
        const pool = getPool();
        const wsRow = await pool.query<{ name: string }>(
          'SELECT name FROM workspaces WHERE id = $1', [workspaceId]
        );
        const senderRow = await pool.query<{ name: string; email: string }>(
          'SELECT name, email FROM users WHERE id = $1', [actorUserId]
        );
        const workspaceName = wsRow.rows[0]?.name || 'a workspace';
        const senderName = senderRow.rows[0]?.name || senderRow.rows[0]?.email || 'A teammate';
        await sendWorkspaceInviteEmail({
          to: email,
          inviteToken: invite.token,
          senderName,
          workspaceName,
          role,
        });
      } catch (emailErr: any) {
        console.warn('[workspace invite] Email send failed (non-fatal):', emailErr?.message);
      }

      res.status(201).json({ success: true, data: invite });
    } catch (err: any) {
      const msg = String(err?.message || '');
      if (msg.includes('WORKSPACE_ROLE_INSUFFICIENT')) {
        return res.status(403).json({ success: false, error: 'Only owners/admins can invite' });
      }
      console.error('[workspace invite error]', err);
      // Surface the DB/runtime error so the developer can diagnose exactly what failed
      const detail = msg.includes('does not exist') || msg.includes('violates') || msg.includes('syntax')
        ? msg.substring(0, 200)
        : undefined;
      return res.status(500).json({
        success: false,
        error: 'Failed to create invite',
        code: 'INTERNAL_ERROR',
        ...(detail ? { detail } : {}),
      });
    }
  }
);

// Revoke invite
router.delete('/:workspaceId/invites/:inviteId', requireWorkspacePermission('team:manage'), async (req: Request, res: Response) => {
  try {
    const workspaceId = String(req.params.workspaceId || '');
    const inviteId = String(req.params.inviteId || '');
    const actorUserId = String(req.user?.id || '');

    await revokeWorkspaceInvite(workspaceId, inviteId, actorUserId);
    await logWorkspaceActivity({
      workspaceId,
      userId: actorUserId,
      type: 'workspace.invite_revoked',
      metadata: { inviteId },
    });
    res.json({ success: true });
  } catch (err: any) {
    const msg = String(err?.message || '');
    if (msg.includes('WORKSPACE_ROLE_INSUFFICIENT')) {
      return res.status(403).json({ success: false, error: 'Only owners/admins can revoke invites' });
    }
    if (msg.includes('INVITE_NOT_FOUND')) {
      return res.status(404).json({ success: false, error: 'Invite not found or already accepted' });
    }
    internalServerError(res, 'Failed to revoke invite');
  }
});

// List invites
router.get('/:workspaceId/invites', async (req: Request, res: Response) => {
  try {
    const workspaceId = String(req.params.workspaceId || '');
    const actorUserId = String(req.user?.id || '');
    const invites = await listWorkspaceInvites(workspaceId, actorUserId);
    res.json({ success: true, data: invites });
  } catch (err: any) {
    const msg = String(err?.message || '');
    if (msg.includes('WORKSPACE_ACCESS_DENIED')) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    internalServerError(res, 'Failed to list invites');
  }
});

router.get('/:workspaceId/activity', async (req: Request, res: Response) => {
  try {
    const workspaceId = String(req.params.workspaceId || '');
    const actorUserId = String(req.user?.id || '');
    const members = await listWorkspaceMembers(workspaceId, actorUserId);
    const userById = new Map(members.map((member: any) => [String(member.user_id), member]));

    // Safely extract a single limit param
    const limitParam = req.query.limit;
    const limit = Array.isArray(limitParam) ? Number(limitParam[0]) : Number(limitParam || 25);

    const activity = await listWorkspaceActivity(workspaceId, limit);

    res.json({
      success: true,
      data: activity.map((entry) => ({
        ...entry,
        actor: entry.user_id ? userById.get(entry.user_id) || null : null,
      })),
    });
  } catch (err: any) {
    const msg = String(err?.message || '');
    if (msg.includes('WORKSPACE_ACCESS_DENIED')) {
      return res.status(403).json({ success: false, error: 'You do not have access to this workspace' });
    }
    internalServerError(res, 'Failed to load workspace activity');
  }
});

// Accept invite
router.post('/invites/:token/accept', async (req: Request, res: Response) => {
  try {
    const token = String(req.params.token || '');
    const userId = String(req.user?.id || '');

    const result = await acceptWorkspaceInvite(token, userId);
    res.json({ success: true, data: result });
  } catch (err: any) {
    const msg = String(err?.message || '');
    if (msg.includes('INVITE_NOT_FOUND')) {
      return res.status(404).json({ success: false, error: 'Invite not found' });
    }
    if (msg.includes('INVITE_EXPIRED')) {
      return res.status(410).json({ success: false, error: 'Invite has expired' });
    }
    if (msg.includes('INVITE_ALREADY_ACCEPTED')) {
      return res.status(409).json({ success: false, error: 'Invite already accepted' });
    }
    if (msg.includes('INVITE_EMAIL_MISMATCH')) {
      return res.status(403).json({ success: false, error: 'This invite was sent to a different email address' });
    }
    internalServerError(res, 'Failed to accept invite');
  }
});

export default router;
