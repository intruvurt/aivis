/**
 * User-related types
 */

import type { CanonicalTier } from '../types.js';

export interface User {
  id: string;
  email: string;
  tier: CanonicalTier;
  full_name?: string;
  avatar_url?: string;
  company?: string;
  website?: string;
  created_at: string;
  updated_at: string;
}

export interface UserPreferences {
  user_id: string;
  email_notifications: boolean;
  weekly_reports: boolean;
  dark_mode: boolean;
  timezone: string;
}

export interface UserUsage {
  user_id: string;
  period_start: string;
  period_end: string;
  scans_used: number;
  scans_limit: number;
}

export interface UpdateUserRequest {
  full_name?: string;
  company?: string;
  website?: string;
  avatar_url?: string;
}