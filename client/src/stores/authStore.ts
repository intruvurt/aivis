import { create } from "zustand";
import { API_URL } from "../config";
import { buildBearerHeader, normalizeAuthToken } from "../utils/authToken";

export type AuthTier = "observer" | "alignment" | "signal" | "scorefix";

export type AuthUser = {
    id: string;
    email: string;
    name?: string;
    role?: string;
    full_name?: string;
    display_name?: string;
    tier?: AuthTier;
    trial_ends_at?: string | null;
    trial_active?: boolean;
    trial_used?: boolean;
    created_at?: string;
    avatar_url?: string;
    org_logo_url?: string;
    org_favicon_url?: string;
    company?: string;
    website?: string;
};

export type AuthState = {
    isHydrated: boolean;
    isAuthenticated: boolean;
    user: AuthUser | null;
    token: string | null;
    setUser: (user: AuthUser | null) => void;
    setToken: (token: string | null) => void;
    login: (user: AuthUser, token?: string | null) => void;
    logout: () => void;
    refreshUser: () => Promise<boolean>;
    hydrate: () => void;
    getAuthHeader: () => Record<string, string>;
};

const LEGACY_KEYS = ["aivis_auth_v2", "auth-storage", "aivis_auth_v1"];

function canUseStorage() {
    return typeof window !== "undefined" && !!window.sessionStorage;
}

function clearLegacyAuthStorage() {
    if (!canUseStorage()) return;
    try {
        for (const key of LEGACY_KEYS) {
            window.sessionStorage.removeItem(key);
            window.localStorage.removeItem(key);
        }
        window.sessionStorage.removeItem("aivis-analysis");
        window.localStorage.removeItem("aivis-analysis");
    } catch {
        // ignore storage cleanup failures
    }
}

function normalizeAuthUser(raw: any): AuthUser | null {
    if (!raw || typeof raw !== "object") return null;

    const user: AuthUser = {
        id: String(raw.id ?? ""),
        email: String(raw.email ?? ""),
        name: typeof raw.name === "string" ? raw.name : undefined,
        role: typeof raw.role === "string" ? raw.role : undefined,
        tier: (raw.tier as AuthTier) ?? "observer",
        trial_ends_at: raw.trial_ends_at ?? null,
        trial_active: raw.trial_active === true,
        trial_used: raw.trial_used === true,
        full_name: raw.full_name ?? raw.name ?? undefined,
        display_name: raw.display_name ?? raw.name ?? undefined,
        created_at: raw.created_at ?? undefined,
        avatar_url: raw.avatar_url ?? undefined,
        org_logo_url: raw.org_logo_url ?? undefined,
        org_favicon_url: raw.org_favicon_url ?? undefined,
        company: raw.company ?? undefined,
        website: raw.website ?? undefined,
    };

    if (!user.id || !user.email) return null;
    return user;
}

export const useAuthStore = create<AuthState>((set, get) => ({
    isHydrated: false,
    isAuthenticated: false,
    user: null,
    token: null,

    setUser: (user) => {
        set({ user, isAuthenticated: !!user || !!get().token });
    },

    setToken: (token) => {
        const normalizedToken = normalizeAuthToken(token);
        set({ token: normalizedToken, isAuthenticated: !!normalizedToken || !!get().user });
    },

    login: (user, token) => {
        clearLegacyAuthStorage();
        set({
            user,
            token: normalizeAuthToken(token),
            isAuthenticated: true,
            isHydrated: true,
        });
    },

    logout: () => {
        set({ user: null, token: null, isAuthenticated: false, isHydrated: true });
        clearLegacyAuthStorage();

        if (typeof window !== "undefined") {
            void fetch(`${API_URL}/api/auth/logout`, {
                method: "POST",
                credentials: "include",
            }).catch(() => undefined);
        }
    },

    refreshUser: async () => {
        try {
            const response = await fetch(`${API_URL}/api/user/refresh`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
            });

            if (!response.ok) {
                set({ user: null, token: null, isAuthenticated: false, isHydrated: true });
                return false;
            }

            const data = await response.json().catch(() => null);
            const nextUser = normalizeAuthUser(data?.user ?? data?.data?.user ?? null);
            const nextToken = normalizeAuthToken(data?.token ?? data?.data?.token ?? null);

            set({
                user: nextUser,
                token: nextToken,
                isAuthenticated: !!nextUser,
                isHydrated: true,
            });

            return !!nextUser;
        } catch {
            set({ user: null, token: null, isAuthenticated: false, isHydrated: true });
            return false;
        }
    },

    hydrate: () => {
        clearLegacyAuthStorage();
        set({ isHydrated: false, user: null, token: null, isAuthenticated: false });
        void get().refreshUser();
    },

    getAuthHeader: () => {
        const authHeader = buildBearerHeader(get().token);
        return authHeader ? { Authorization: authHeader } : {};
    },
}));

export default useAuthStore;

export const selectUser = (s: AuthState) => s.user;
export const selectIsAuthed = (s: AuthState) => s.isAuthenticated;
export const selectLogout = (s: AuthState) => s.logout;