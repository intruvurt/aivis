/**
 * Session-related types
 */

export interface Session {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
  ip_address?: string;
  user_agent?: string;
}

export interface SessionInfo {
  id: string;
  created_at: string;
  expires_at: string;
  ip_address?: string;
  user_agent?: string;
  is_current: boolean;
}

export interface CreateSessionRequest {
  user_id: string;
  ip_address?: string;
  user_agent?: string;
}

export interface RefreshTokenPayload {
  session_id: string;
  user_id: string;
}