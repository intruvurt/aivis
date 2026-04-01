/**
 * authService – thin wrapper around /api/auth endpoints.
 *
 * The canonical auth state is handled by `stores/authStore.ts`
 * (Zustand + persist), but we still expose fetch-based helpers here
 * so legacy pages don't break on import resolution.
 */

import { API_URL } from '../config';
import { useAuthStore } from '../stores/authStore';

function authHeaders(): Record<string, string> {
  const token = useAuthStore.getState().token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(options.headers as Record<string, string> ?? {}),
    },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err: any = new Error(body.error || body.message || res.statusText);
    err.response = { data: body, status: res.status };
    throw err;
  }

  return res.json() as Promise<T>;
}

export const authService = {
  /* ── auth flows ────────────────────────────────────────────── */

  login(email: string, password: string) {
    return request<{ user: any; token: string }>('/api/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  register(name: string, email: string, password: string) {
    return request<{ user: any; token: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
  },

  getProfile(_token?: string) {
    return request<any>('/api/auth/profile');
  },

  /* ── profile management ───────────────────────────────────── */

  updateProfile(name: string, email: string) {
    return request<any>('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify({ name, email }),
    });
  },

  changePassword(currentPassword: string, newPassword: string) {
    return request<any>('/api/auth/change-password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  deactivateAccount() {
    return request<any>('/api/auth/account', {
      method: 'DELETE',
    });
  },

  /* ── magic-link / OAuth (used by AuthContext) ──────────────── */

  verifyMagicLink(token: string, email: string) {
    return request<{ user: any; token: string }>('/api/auth/magic-link/verify', {
      method: 'POST',
      body: JSON.stringify({ token, email }),
    });
  },

  oauthLogin(provider: string, profile: any) {
    return request<{ user: any; token: string }>('/api/auth/oauth', {
      method: 'POST',
      body: JSON.stringify({ provider, profile }),
    });
  },

  /* ── password reset (used by ResetPassword.tsx) ──────────── */

  requestPasswordReset(email: string) {
    return request<any>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  resetPassword(token: string, newPassword: string) {
    return request<any>('/api/auth/reset-password/confirm', {
      method: 'POST',
      // Server expects { token, password } — map correctly
      body: JSON.stringify({ token, password: newPassword }),
    });
  },

  /**
   * Attempt server-side token validation if endpoint exists.
   * Falls back to optimistic { valid: true } so the reset form always renders.
   */
  async verifyPasswordResetToken(token: string, _email: string): Promise<{ valid: boolean }> {
    try {
      const res = await fetch(`${API_URL}/api/auth/reset-password/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (res.ok) return res.json();
      if (res.status === 404) return { valid: true }; // endpoint not deployed yet
      return { valid: false };
    } catch {
      // Network error — let user try submitting the form anyway
      return { valid: true };
    }
  },
};

export default authService;
