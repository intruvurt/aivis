/**
 * Policy and permissions types
 */

export interface Policy {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  created_at: string;
  updated_at: string;
}

export interface Permission {
  resource: ResourceType;
  actions: ActionType[];
}

export type ResourceType =
  | 'audit'
  | 'report'
  | 'user'
  | 'organization'
  | 'integration'
  | 'billing';

export type ActionType = 'create' | 'read' | 'update' | 'delete' | 'manage';

export interface RolePolicy {
  role: string;
  policies: string[];
}

export function hasPermission(
  userPolicies: Policy[],
  resource: ResourceType,
  action: ActionType
): boolean {
  return userPolicies.some((policy) =>
    policy.permissions.some(
      (perm) => perm.resource === resource && perm.actions.includes(action)
    )
  );
}