/**
 * OAuth-related types
 */

export type OAuthProvider = 'google' | 'github' | 'microsoft';

export interface OAuthState {
  provider: OAuthProvider;
  redirect_url: string;
  nonce: string;
  created_at: number;
}

export interface OAuthTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

export interface OAuthUserInfo {
  provider: OAuthProvider;
  provider_user_id: string;
  email: string;
  name?: string;
  avatar_url?: string;
}

export interface LinkedAccount {
  id: string;
  user_id: string;
  provider: OAuthProvider;
  provider_user_id: string;
  email: string;
  linked_at: string;
}