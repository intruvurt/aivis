import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { API_URL } from "../config";
import { useAuthStore } from "../stores/authStore";
import { useSettingsStore } from "../stores/settingsStore";
import { apiFetch } from "../utils/api";
import usePageVisible from "./usePageVisible";

export type NotificationItem = {
  id: string;
  scope: "user" | "platform";
  event_type: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
};

/** Resolve a navigation path for a notification based on its event_type and metadata. */
export function getNotificationDestination(item: NotificationItem): string | null {
  const m = item.metadata ?? {};
  const auditId = typeof m.auditId === "string" ? m.auditId : undefined;
  const reportsPath = auditId ? `/app/reports?audit=${encodeURIComponent(auditId)}` : "/app/reports";

  switch (item.event_type) {
    case "audit_completed":
    case "scheduled_rescan_completed":
    case "auto_score_fix_rescan_completed":
    case "deploy_verification_completed":
    case "agent_task_completed":
      return reportsPath;
    case "scheduled_rescan_failed":
    case "scheduled_rescan_skipped":
    case "auto_score_fix_rescan_failed":
    case "deploy_verification_failed":
      return "/app/settings";
    case "auto_score_fix_rescan_scheduled":
      return reportsPath;
    case "plan_upgraded":
    case "plan_downgraded":
    case "plan_canceled":
      return "/app/settings";
    case "trial_started":
    case "trial_converted":
    case "trial_expired":
      return "/pricing";
    case "credit_added":
    case "credit_spent":
      return "/app/settings";
    default:
      return null;
  }
}

type NotificationResponse = {
  success?: boolean;
  data?: {
    unreadCount?: number;
    notifications?: NotificationItem[];
  };
};

function parseTimestamp(input: string | undefined): number {
  if (!input) return 0;
  const value = new Date(input).getTime();
  return Number.isFinite(value) ? value : 0;
}

export default function useNotifications() {
  const token = useAuthStore((s) => s.token);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);
  const browserNotificationsEnabled = useSettingsStore((s) => s.browserNotifications);
  const soundEnabled = useSettingsStore((s) => s.soundEnabled);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const initializedRef = useRef(false);
  const latestSeenMsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const [streamConnected, setStreamConnected] = useState(false);

  const playNotificationDing = useCallback(() => {
    try {
      const AudioContextCtor = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextCtor) return;
      const context = new AudioContextCtor();
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(660, context.currentTime + 0.12);

      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.018, context.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.18);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(context.currentTime);
      oscillator.stop(context.currentTime + 0.2);
      oscillator.onended = () => {
        if (typeof context.close === "function") context.close().catch(() => { });
      };
    } catch {
      // keep notification flow silent on audio failures
    }
  }, []);

  const lastFetchAtRef = useRef(0);

  const fetchNotifications = useCallback(async () => {
    // Minimum 8s gap between fetches to avoid spamming the server
    const now = Date.now();
    if (now - lastFetchAtRef.current < 8_000) return;
    lastFetchAtRef.current = now;

    if (!isAuthenticated) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const base = (API_URL || "").replace(/\/+$/, "");
      const res = await apiFetch(`${base}/api/features/notifications?limit=25`, {
        method: "GET",
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 401) {
          const payload = await res.json().catch(() => ({} as { code?: string }));
          const code = String(payload?.code || "").toUpperCase();
          if (code === "TOKEN_EXPIRED" || code === "INVALID_TOKEN" || code === "NO_TOKEN") {
            logout();
          }
        }
        throw new Error(`Notification fetch failed (${res.status})`);
      }

      const payload = (await res.json().catch(() => ({}))) as NotificationResponse;
      const nextItems = Array.isArray(payload?.data?.notifications)
        ? payload.data!.notifications!
        : [];
      const nextUnread = Math.max(0, Number(payload?.data?.unreadCount || 0));

      if (initializedRef.current) {
        const newItems = nextItems.filter((item) => {
          const createdMs = parseTimestamp(item.created_at);
          return createdMs > latestSeenMsRef.current && !item.is_read;
        });

        if (newItems.length > 0 && soundEnabled) {
          playNotificationDing();
        }

        for (const item of newItems.slice(0, 2)) {
          toast(item.title || "New notification", {
            icon: item.scope === "platform" ? "📢" : "🔔",
          });

          if (
            browserNotificationsEnabled &&
            typeof Notification !== "undefined" &&
            Notification.permission === "granted"
          ) {
            try {
              const browserNotice = new Notification(item.title || "AiVIS.biz Notification", {
                body: item.message || "You have a new update.",
                tag: `aivis-notification-${item.id}`,
                silent: true,
              });
              window.setTimeout(() => browserNotice.close(), 8000);
            } catch {
              // Browser may block notification construction
            }
          }
        }
      }

      const latestMs = nextItems.reduce((max, item) => Math.max(max, parseTimestamp(item.created_at)), latestSeenMsRef.current);
      latestSeenMsRef.current = latestMs;
      initializedRef.current = true;

      setNotifications(nextItems);
      setUnreadCount(nextUnread);
    } catch {
      // Silent fail for background polling.
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, logout, browserNotificationsEnabled, soundEnabled, playNotificationDing]);

  const markRead = useCallback(
    async (id: string) => {
      if (!id || !isAuthenticated) return;
      const base = (API_URL || "").replace(/\/+$/, "");
      const res = await apiFetch(`${base}/api/features/notifications/${encodeURIComponent(id)}/read`, {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) return;

      setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, is_read: true } : item)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    },
    [isAuthenticated]
  );

  const markAllRead = useCallback(async () => {
    if (!isAuthenticated) return;
    const base = (API_URL || "").replace(/\/+$/, "");
    const res = await apiFetch(`${base}/api/features/notifications/read-all`, {
      method: "POST",
      credentials: "include",
    });

    if (!res.ok) return;

    // Clear the list entirely so the dropdown empties after mark-all-read
    setNotifications([]);
    setUnreadCount(0);
  }, [isAuthenticated]);

  const dismissAll = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  const pageVisible = usePageVisible();

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const closeStream = useCallback(() => {
    clearReconnectTimer();
    setStreamConnected(false);
    try {
      eventSourceRef.current?.close();
    } catch {
      // ignore close errors
    }
    eventSourceRef.current = null;
  }, [clearReconnectTimer]);

  // SSE real-time connection - pushes from server when notifications are created
  useEffect(() => {
    if (!isAuthenticated || !pageVisible) {
      closeStream();
      return;
    }

    const token = useAuthStore.getState().token;
    if (!token) {
      closeStream();
      return;
    }

    const base = (API_URL || "").replace(/\/+$/, "");
    let disposed = false;

    const connect = () => {
      if (disposed) return;
      closeStream();
      const url = `${base}/api/features/notifications/stream?token=${encodeURIComponent(token)}`;

      let es: EventSource;
      try {
        es = new EventSource(url);
      } catch {
        reconnectTimerRef.current = setTimeout(connect, 15000);
        return;
      }

      eventSourceRef.current = es;

      es.addEventListener("connected", () => {
        setStreamConnected(true);
        reconnectAttemptRef.current = 0; // reset backoff on successful connect
        clearReconnectTimer();
      });

      es.addEventListener("notification", () => {
        void fetchNotifications();
      });

      es.onerror = () => {
        setStreamConnected(false);
        try {
          es.close();
        } catch {
          // ignore close errors
        }
        if (!disposed) {
          clearReconnectTimer();
          // Exponential backoff: 15s → 30s → 60s → 120s (cap)
          const attempt = reconnectAttemptRef.current;
          const delay = Math.min(15_000 * Math.pow(2, attempt), 120_000);
          reconnectAttemptRef.current = attempt + 1;
          reconnectTimerRef.current = setTimeout(connect, delay);
        }
      };
    };

    connect();

    return () => {
      disposed = true;
      reconnectAttemptRef.current = 0;
      closeStream();
    };
  }, [isAuthenticated, pageVisible, fetchNotifications, closeStream, clearReconnectTimer]);

  // Fallback polling - only runs when SSE is NOT connected (avoids duplicate traffic)
  useEffect(() => {
    if (!isAuthenticated) return;
    if (!pageVisible) return;

    // SSE handles real-time when connected - skip polling entirely
    if (streamConnected) return;

    const basePollMs = 120_000; // 120s when SSE is down
    let pollMs = basePollMs;
    let timerId: ReturnType<typeof setTimeout> | null = null;

    // Fetch once when tab becomes visible again.
    void fetchNotifications();

    const schedulePoll = () => {
      timerId = setTimeout(async () => {
        // Re-check: if SSE reconnected, stop polling
        if (streamConnected) return;
        try {
          await fetchNotifications();
          pollMs = 120_000;
        } catch {
          pollMs = Math.min(pollMs * 2, 240_000);
        }
        schedulePoll();
      }, pollMs);
    };
    schedulePoll();

    return () => {
      if (timerId) clearTimeout(timerId);
    };
  }, [fetchNotifications, isAuthenticated, pageVisible, streamConnected]);

  // ── Browser tab title blinking when unread notifications exist ──
  const originalTitleRef = useRef(document.title);
  const blinkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Capture the base title once (before any blinking modifies it)
    if (!blinkIntervalRef.current) {
      originalTitleRef.current = document.title;
    }

    const shouldBlink = unreadCount > 0 && !pageVisible;

    if (shouldBlink) {
      let show = true;
      blinkIntervalRef.current = setInterval(() => {
        document.title = show
          ? `(${unreadCount}) New notification — AiVIS.biz`
          : originalTitleRef.current;
        show = !show;
      }, 1200);
    } else {
      // Restore original title and stop blinking
      if (blinkIntervalRef.current) {
        clearInterval(blinkIntervalRef.current);
        blinkIntervalRef.current = null;
      }
      document.title = originalTitleRef.current;
    }

    return () => {
      if (blinkIntervalRef.current) {
        clearInterval(blinkIntervalRef.current);
        blinkIntervalRef.current = null;
      }
      document.title = originalTitleRef.current;
    };
  }, [unreadCount, pageVisible]);

  const recent = useMemo(() => notifications.slice(0, 6), [notifications]);

  return {
    notifications: recent,
    unreadCount,
    loading,
    refresh: fetchNotifications,
    markRead,
    markAllRead,
    dismissAll,
  };
}
