import { useCallback, useEffect, useMemo, useState } from "react";
import { API_URL } from "../config";
import { useAuthStore } from "../stores/authStore";
import { apiFetch } from "../utils/api";
import usePageVisible from "./usePageVisible";

const FEATURE_STATUS_CACHE_TTL_MS = 30_000;
const FEATURE_STATUS_POLL_MS = 90_000;

let sharedFeatureStatusCache: FeatureStatusData | null = null;
let sharedFeatureStatusCacheAt = 0;
let sharedFeatureStatusInflight: Promise<FeatureStatusData> | null = null;

export interface FeatureStatusData {
  generatedAt?: string;
  tier?: string;
  capabilities?: {
    pagesPerScan?: number;
    competitors?: number;
    hasExports?: boolean;
    hasReportHistory?: boolean;
    hasApiAccess?: boolean;
    hasScheduledRescans?: boolean;
    hasShareableLink?: boolean;
  };
  usage?: {
    monthlyLimit?: number;
    usedThisMonth?: number;
    remainingThisMonth?: number;
  };
  credits?: {
    packCreditsRemaining?: number;
    referralCreditsEarnedTotal?: number;
  };
  trial?: {
    active?: boolean;
    endsAt?: string | null;
    daysRemaining?: number;
    used?: boolean;
  };
  features?: {
    notifications?: {
      unreadCount?: number;
    };
    scheduledRescans?: {
      available?: boolean;
      count?: number;
    };
    apiAccess?: {
      available?: boolean;
      keyCount?: number;
    };
    webhooks?: {
      available?: boolean;
      count?: number;
    };
  };
  milestones?: {
    unlocked?: { key: string; creditsAwarded: number; unlockedAt: string }[];
    next?: { key: string; label: string; description: string; creditReward: number; icon: string }[];
    totalCreditsEarned?: number;
  };
  toolUsage?: Record<string, { used: number; freeAllowance: number; freeRemaining: number; creditCost: number }>;
}

interface FeatureStatusResponse {
  success?: boolean;
  data?: FeatureStatusData;
}

const formatUpdatedTime = (input: string | undefined): string | null => {
  if (!input) return null;
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export default function useFeatureStatus() {
  const token = useAuthStore((s) => s.token);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);

  const [status, setStatus] = useState<FeatureStatusData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async (forceRefresh = false) => {
    if (!isAuthenticated) {
      setStatus(null);
      setError(null);
      return;
    }

    const cacheAge = Date.now() - sharedFeatureStatusCacheAt;
    if (!forceRefresh && sharedFeatureStatusCache && cacheAge < FEATURE_STATUS_CACHE_TTL_MS) {
      setStatus(sharedFeatureStatusCache);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (!sharedFeatureStatusInflight) {
        sharedFeatureStatusInflight = (async () => {
          const base = (API_URL || "").replace(/\/+$/, "");
          const res = await apiFetch(`${base}/api/features/status`, {
            method: "GET",
            credentials: "include",
          });

          if (!res.ok) {
            if (res.status === 401) {
              const payload = await res.json().catch(() => ({} as { code?: string }));
              const code = String(payload?.code || "").toUpperCase();
              if (code === "TOKEN_EXPIRED" || code === "INVALID_TOKEN" || code === "NO_TOKEN") {
                logout();
                throw new Error("Session expired. Please sign in again.");
              }
            }
            throw new Error(`Feature status unavailable (${res.status})`);
          }

          const payload = (await res.json().catch(() => ({}))) as FeatureStatusResponse;
          const data = payload?.data ?? null;
          if (!data || typeof data !== "object") {
            throw new Error("Invalid feature status response");
          }

          sharedFeatureStatusCache = data;
          sharedFeatureStatusCacheAt = Date.now();
          return data;
        })().finally(() => {
          sharedFeatureStatusInflight = null;
        });
      }

      const data = await sharedFeatureStatusInflight;
      setStatus(data);
    } catch (err: any) {
      setStatus(null);
      setError(err?.message || "Failed to load feature status");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, logout]);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  const pageVisible = usePageVisible();

  useEffect(() => {
    if (!isAuthenticated) return;
    // Pause timer-based polling when the tab is hidden.
    if (!pageVisible) return;

    let pollMs = FEATURE_STATUS_POLL_MS;
    let timerId: ReturnType<typeof setTimeout> | null = null;

    // Refresh once when tab becomes visible again.
    void fetchStatus(false);

    const schedulePoll = () => {
      timerId = setTimeout(async () => {
        try {
          await fetchStatus(true);
          pollMs = FEATURE_STATUS_POLL_MS; // reset on success
        } catch {
          pollMs = Math.min(pollMs * 2, 180_000); // backoff on failure, max 3 min
        }
        schedulePoll();
      }, pollMs);
    };
    schedulePoll();

    const onUsageUpdated = () => {
      void fetchStatus(true);
    };

    window.addEventListener("aivis-usage-updated", onUsageUpdated as EventListener);

    return () => {
      if (timerId) clearTimeout(timerId);
      window.removeEventListener("aivis-usage-updated", onUsageUpdated as EventListener);
    };
  }, [fetchStatus, isAuthenticated, pageVisible]);

  const updatedAtLabel = useMemo(() => {
    return formatUpdatedTime(status?.generatedAt);
  }, [status?.generatedAt]);

  return {
    status,
    loading,
    error,
    updatedAtLabel,
    refresh: fetchStatus,
  };
}
