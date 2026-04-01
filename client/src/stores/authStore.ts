// client/src/stores/authStore.ts
import { create } from "zustand";
import { API_URL } from "../config";
import { buildBearerHeader, normalizeAuthToken } from "../utils/authToken";

export type AuthTier = "observer" | "alignment" | "signal" | "scorefix";

export type AuthUser = {
  id: string;
  email: string;
  role?: string;
  full_name?: string;
  display_name?: string;
  tier?: AuthTier;
  trial_ends_at?: string | null;
  trial_active?: boolean;
  trial_used?: boolean;
  created_at?: string;
  avatar_url?: string;
  company?: string;
  website?: string;
};

export type AuthState = {
  isHydrated: boolean;
  isAuthenticated: boolean;

  user: AuthUser | null;
  token: string | null;

  // actions
  setUser: (user: AuthUser | null) => void;
  setToken: (token: string | null) => void;

  login: (user: AuthUser, token: string) => void;
  logout: () => void;
  refreshUser: () => Promise<boolean>;

  hydrate: () => void;

  // helpers
  getAuthHeader: () => Record<string, string>;
};

const KEY_V2 = "aivis_auth_v2";
const OLD_KEYS = ["auth-storage", "aivis_auth_v1"];

function canUseStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeV2(payload: { user: AuthUser | null; token: string | null }) {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(KEY_V2, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

function clearAllAuthKeys() {
  if (!canUseStorage()) return;
  try {
    window.localStorage.removeItem(KEY_V2);
    for (const k of OLD_KEYS) window.localStorage.removeItem(k);
    // Clear persisted analysis data so a new session never sees a previous user's results
    window.localStorage.removeItem('aivis-analysis');
  } catch {
    // ignore
  }
}

type OldShape =
  | { user?: any; token?: any; isAuthenticated?: any; entitlements?: any }
  | { user?: any; session?: { access_token?: any } | any };

function extractFromAny(raw: any): { user: AuthUser | null; token: string | null } {
  if (!raw || typeof raw !== "object") return { user: null, token: null };

  // possible shapes:
  // { token, user }
  // { session: { access_token }, user }
  // { state: { token, user } } (persist middleware style)
  const state = raw.state && typeof raw.state === "object" ? raw.state : raw;

  const token =
    typeof state.token === "string"
      ? state.token
      : typeof state.session?.access_token === "string"
        ? state.session.access_token
        : null;
  const normalizedToken = normalizeAuthToken(token);

  const u = state.user && typeof state.user === "object" ? state.user : null;

  const user: AuthUser | null = u
    ? {
        id: String(u.id ?? ""),
        email: String(u.email ?? ""),
        role: typeof u.role === "string" ? u.role : undefined,
        tier: (u.tier as AuthTier) ?? "observer",
        trial_ends_at: u.trial_ends_at ?? null,
        trial_active: u.trial_active === true,
        trial_used: u.trial_used === true,
        full_name: u.full_name ?? u.name ?? undefined,
        display_name: u.display_name ?? undefined,
        created_at: u.created_at ?? undefined,
        avatar_url: u.avatar_url ?? undefined,
        company: u.company ?? undefined,
        website: u.website ?? undefined,
      }
    : null;

  // minimal validity: must have id+email to count
  if (!user?.id || !user?.email) return { user: null, token: normalizedToken };
  return { user, token: normalizedToken };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isHydrated: false,
  isAuthenticated: false,

  user: null,
  token: null,

  setUser: (user) => {
    set({ user, isAuthenticated: !!get().token });
    writeV2({ user, token: get().token });
  },

  setToken: (token) => {
    const normalizedToken = normalizeAuthToken(token);
    set({ token: normalizedToken, isAuthenticated: !!normalizedToken });
    writeV2({ user: get().user, token: normalizedToken });
  },

  login: (user, token) => {
    const normalizedToken = normalizeAuthToken(token);
    // Clear any persisted analysis belonging to a previous user before setting the new session
    if (canUseStorage()) {
      try { window.localStorage.removeItem('aivis-analysis'); } catch { /* ignore */ }
    }
    set({ user, token: normalizedToken, isAuthenticated: !!normalizedToken });
    writeV2({ user, token: normalizedToken });
  },

  logout: () => {
    set({ user: null, token: null, isAuthenticated: false });
    clearAllAuthKeys();
  },

  refreshUser: async () => {
    const token = normalizeAuthToken(get().token);
    if (!token) return false;

    const authHeader = buildBearerHeader(token);
    if (!authHeader) return false;

    try {
      const response = await fetch(`${API_URL}/api/user/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json().catch(() => null);
      const nextUser = data?.user ?? data?.data?.user ?? null;

      set({
        user: nextUser,
        isAuthenticated: true,
      });

      writeV2({ user: nextUser, token });
      return true;
    } catch {
      return false;
    }
  },

  hydrate: () => {
    if (!canUseStorage()) {
      set({ isHydrated: true });
      return;
    }

    // 1) Prefer v2
    const v2 = safeParse<{ user: AuthUser | null; token: string | null }>(
      window.localStorage.getItem(KEY_V2)
    );

    if (v2 && (v2.token || v2.user)) {
      const user = v2.user ?? null;
      const token = normalizeAuthToken(v2.token);
      set({
        isHydrated: true,
        user,
        token,
        isAuthenticated: !!token,
      });

      if (token && !user) {
        void get().refreshUser();
      }
      return;
    }

    // 2) Attempt migrate old keys
    for (const k of OLD_KEYS) {
      const old = safeParse<OldShape>(window.localStorage.getItem(k));
      const extracted = extractFromAny(old);
      if (extracted.user || extracted.token) {
        writeV2({ user: extracted.user, token: extracted.token });
        set({
          isHydrated: true,
          user: extracted.user,
          token: extracted.token,
          isAuthenticated: !!extracted.token,
        });
        if (extracted.token && !extracted.user) {
          void get().refreshUser();
        }
        return;
      }
    }

    // 3) Nothing usable
    set({ isHydrated: true, user: null, token: null, isAuthenticated: false });
  },

  getAuthHeader: () => {
    const authHeader = buildBearerHeader(get().token);
    return authHeader ? { Authorization: authHeader } : {};
  },
}));

export default useAuthStore;

// optional selectors
export const selectUser = (s: AuthState) => s.user;
export const selectIsAuthed = (s: AuthState) => s.isAuthenticated;
export const selectLogout = (s: AuthState) => s.logout;
