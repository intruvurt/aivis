import { create } from "zustand";
import { API_URL } from "../config";
import { buildBearerHeader, normalizeAuthToken } from "../utils/authToken";

export type AuthTier = "observer" | "starter" | "alignment" | "signal" | "scorefix";

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
    is_verified?: boolean;
    verification_grace_active?: boolean;
    verification_grace_until?: string | null;
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
const AUTH_TOKEN_STORAGE_KEY = "aivis_auth_session_token";

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

function readPersistedToken() {
    if (!canUseStorage()) return null;
    try {
        return normalizeAuthToken(window.sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY));
    } catch {
        return null;
    }
}

function writePersistedToken(token: string | null) {
    if (!canUseStorage()) return;
    try {
        const normalized = normalizeAuthToken(token);
        if (normalized) {
            window.sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, normalized);
        } else {
            window.sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
        }
    } catch {
        // ignore storage failures
    }
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs = 15000) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(input, { ...init, signal: controller.signal });
    } finally {
        window.clearTimeout(timeout);
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
        is_verified: raw.is_verified === true,
        verification_grace_active: raw.verification_grace_active === true,
        verification_grace_until: raw.verification_grace_until ?? null,
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
        writePersistedToken(normalizedToken);
        set({ token: normalizedToken, isAuthenticated: !!normalizedToken || !!get().user });
    },

    login: (user, token) => {
        clearLegacyAuthStorage();
        const normalizedToken = normalizeAuthToken(token);
        writePersistedToken(normalizedToken);
        set({
            user,
            token: normalizedToken,
            isAuthenticated: true,
            isHydrated: true,
        });
    },

    logout: () => {
        writePersistedToken(null);
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
            const currentToken = get().token;
            const headers: Record<string, string> = { "Content-Type": "application/json" };
            if (currentToken) headers["Authorization"] = `Bearer ${currentToken}`;

            const response = await fetchWithTimeout(`${API_URL}/api/user/refresh`, {
                method: "POST",
                headers,
                credentials: "include",
            });

            if (!response.ok) {
                writePersistedToken(null);
                set({ user: null, token: null, isAuthenticated: false, isHydrated: true });
                return false;
            }

            const data = await response.json().catch(() => null);
            const nextUser = normalizeAuthUser(data?.user ?? data?.data?.user ?? null);
            const nextToken = normalizeAuthToken(data?.token ?? data?.data?.token ?? null) ?? currentToken;

            writePersistedToken(nextToken);

            set({
                user: nextUser,
                token: nextToken,
                isAuthenticated: !!nextUser,
                isHydrated: true,
            });

            return !!nextUser;
        } catch {
            writePersistedToken(null);
            set({ user: null, token: null, isAuthenticated: false, isHydrated: true });
            return false;
        }
    },

    hydrate: () => {
        clearLegacyAuthStorage();
        const savedToken = get().token ?? readPersistedToken();

        if (!savedToken) {
            set({ isHydrated: true, user: null, token: null, isAuthenticated: false });
            return;
        }

        set({ isHydrated: false, user: null, token: savedToken, isAuthenticated: false });
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