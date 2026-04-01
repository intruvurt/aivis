/**
 * Organization/team types
 */

import type { CanonicalTier } from '../types.js';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  tier: CanonicalTier;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrganizationRole;
  joined_at: string;
}

export type OrganizationRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface OrganizationInvite {
  id: string;
  organization_id: string;
  email: string;
  role: OrganizationRole;
  invited_by: string;
  expires_at: string;
  accepted_at?: string;
}

export interface CreateOrganizationRequest {
  name: string;
  slug?: string;
}

export interface InviteMemberRequest {
  email: string;
  role: OrganizationRole;
}