import type { Request, Response, NextFunction } from 'express';
import { ensureDefaultWorkspaceForUser, resolveWorkspaceForUser, getWorkspaceOwnerTier } from '../services/tenantService.js';
import { meetsMinimumTier, type CanonicalTier } from '../../../shared/types.js';

export async function workspaceRequired(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = String(req.user?.id || '').trim();
    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required for workspace access',
        code: 'AUTH_REQUIRED',
      });
    }

    const requestedWorkspaceId = String(req.headers['x-workspace-id'] || '').trim() || undefined;

    let ctx = await resolveWorkspaceForUser(userId, requestedWorkspaceId);
    if (!ctx) {
      const userLabel = req.user?.name || req.user?.email || 'User';
      await ensureDefaultWorkspaceForUser(userId, userLabel);
      ctx = await resolveWorkspaceForUser(userId, requestedWorkspaceId);
    }

    // Recover from stale workspace headers by falling back to any accessible workspace.
    if (!ctx && requestedWorkspaceId) {
      ctx = await resolveWorkspaceForUser(userId, undefined);
    }

    if (!ctx) {
      return res.status(403).json({
        error: 'No accessible workspace found for this account',
        code: 'WORKSPACE_ACCESS_DENIED',
      });
    }

    req.workspace = {
      id: ctx.workspaceId,
      name: ctx.workspaceName,
      role: ctx.membershipRole,
      isDefault: ctx.isDefaultWorkspace,
    };
    req.organization = {
      id: ctx.organizationId,
      name: ctx.organizationName,
    };

    // Tier inheritance: if the workspace owner has a higher tier, elevate
    // the requesting user's effective tier for this request so team members
    // can access features covered by the workspace owner's subscription.
    if (!ctx.isDefaultWorkspace && req.user) {
      const ownerTier = await getWorkspaceOwnerTier(ctx.workspaceId);
      const userTier = (req.user.tier || 'observer') as CanonicalTier;
      if (meetsMinimumTier(ownerTier as CanonicalTier, userTier)) {
        req.user.tier = ownerTier as CanonicalTier;
      }
    }

    res.setHeader('X-Workspace-Id', ctx.workspaceId);
    next();
  } catch (err: any) {
    console.error('[workspaceRequired] failed:', err?.message || err);
    return res.status(500).json({
      error: 'Failed to resolve workspace context',
      code: 'WORKSPACE_CONTEXT_ERROR',
    });
  }
}
