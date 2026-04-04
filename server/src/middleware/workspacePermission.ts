import type { NextFunction, Request, Response } from 'express';

export type WorkspaceAction =
  | 'audit:run'
  | 'audit:view'
  | 'fix:execute'
  | 'fix:view'
  | 'team:manage'
  | 'integrations:manage';

const ROLE_PERMISSIONS: Readonly<Record<'owner' | 'admin' | 'member' | 'viewer', readonly string[]>> = {
  owner: ['*'],
  admin: ['audit:run', 'audit:view', 'fix:execute', 'fix:view', 'team:manage', 'integrations:manage'],
  member: ['audit:run', 'audit:view', 'fix:view'],
  viewer: ['audit:view', 'fix:view'],
};

export function hasWorkspacePermission(req: Request, action: WorkspaceAction): boolean {
  const role = req.workspace?.role;
  if (!role) return false;
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes('*') || permissions.includes(action);
}

export function requireWorkspacePermission(action: WorkspaceAction) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (hasWorkspacePermission(req, action)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: 'Forbidden for this workspace role',
      code: 'WORKSPACE_PERMISSION_DENIED',
      requiredAction: action,
      workspaceRole: req.workspace?.role || null,
    });
  };
}