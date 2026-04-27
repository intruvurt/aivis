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

async function fetchWithTimeout(input: string | URL | Request, init: RequestInit, timeoutMs = 15000) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(input, { ...init, signal: controller.signal });
    } finally {
        window.clearTimeout(timeout);
    }
}

function normalizeAuthUser(raw: unknown): AuthUser | null {
    if (!raw || typeof raw !== "object") return null;

    const source = raw as Record<string, unknown>;

    const user: AuthUser = {
        id: String(source.id ?? ""),
        email: String(source.email ?? ""),
        name: typeof source.name === "string" ? source.name : undefined,
        role: typeof source.role === "string" ? source.role : undefined,
        tier: (source.tier as AuthTier) ?? "observer",
        trial_ends_at:
            typeof source.trial_ends_at === "string" || source.trial_ends_at === null
                ? (source.trial_ends_at as string | null)
                : null,
        trial_active: source.trial_active === true,
        trial_used: source.trial_used === true,
        full_name: (source.full_name as string | undefined) ?? (source.name as string | undefined) ?? undefined,
        display_name:
            (source.display_name as string | undefined) ?? (source.name as string | undefined) ?? undefined,
        created_at: source.created_at as string | undefined,
        avatar_url: source.avatar_url as string | undefined,
        org_logo_url: source.org_logo_url as string | undefined,
        org_favicon_url: source.org_favicon_url as string | undefined,
        company: source.company as string | undefined,
        website: source.website as string | undefined,
        is_verified: source.is_verified === true,
        verification_grace_active: source.verification_grace_active === true,
        verification_grace_until:
            typeof source.verification_grace_until === "string" || source.verification_grace_until === null
                ? (source.verification_grace_until as string | null)
                : null,
    };

    if (!user.id || !user.email) return null;
    return user;
}

let refreshUserInFlight: Promise<boolean> | null = null;

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
        if (refreshUserInFlight) return refreshUserInFlight;

        refreshUserInFlight = (async () => {
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
                    if (response.status === 401) {
                        writePersistedToken(null);
                        set({ user: null, token: null, isAuthenticated: false, isHydrated: true });
                        return false;
                    }

                    const snapshot = get();
                    set({
                        isHydrated: true,
                        isAuthenticated: !!snapshot.user || !!snapshot.token,
                    });
                    return false;
                }

                const data = await response.json().catch(() => null);
                if (!data?.success || !data?.user) {
                    writePersistedToken(null);
                    set({
                        user: null,
                        token: null,
                        isAuthenticated: false,
                        isHydrated: true,
                    });
                    return false;
                }

                const nextUser = normalizeAuthUser(data?.user ?? data?.data?.user ?? null);
                const nextToken = normalizeAuthToken(data?.token ?? data?.data?.token ?? null) ?? currentToken;

                writePersistedToken(nextToken);

                set({
                    user: nextUser,
                    token: nextToken,
                    isAuthenticated: !!nextUser || !!nextToken,
                    isHydrated: true,
                });

                return !!nextUser || !!nextToken;
            } catch {
                const snapshot = get();
                set({
                    isHydrated: true,
                    isAuthenticated: !!snapshot.user || !!snapshot.token,
                });
                return false;
            } finally {
                refreshUserInFlight = null;
            }
        })();

        return refreshUserInFlight;
    },

    hydrate: () => {
        clearLegacyAuthStorage();
        const savedToken = get().token ?? readPersistedToken();

        // Always attempt a refresh so cookie-backed sessions survive new tabs,
        // browser restarts, and OAuth returns even when sessionStorage is empty.
        set({
            isHydrated: false,
            user: null,
            token: savedToken,
            isAuthenticated: !!savedToken,
        });
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