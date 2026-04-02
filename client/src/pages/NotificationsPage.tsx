import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Bell, Filter, RefreshCw, CheckCheck, Settings2, ChevronDown, ChevronUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { API_URL } from "../config";
import { useAuthStore } from "../stores/authStore";
import { usePageMeta } from "../hooks/usePageMeta";
import { getNotificationDestination } from "../hooks/useNotifications";
import NotificationPreferencesPanel from "../components/NotificationPreferencesPanel";

type NotificationItem = {
  id: string;
  scope: "user" | "platform";
  event_type: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
};

type ScopeFilter = "all" | "account" | "platform";

export default function NotificationsPage() {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("all");
  const [creditOnly, setCreditOnly] = useState(false);
  const [working, setWorking] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);

  usePageMeta({
    title: "Notifications",
    description: "Track account and platform notifications, scheduled events, and credit activity in one place.",
    path: "/notifications",
    ogTitle: "AiVIS Notifications",
  });

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const base = (API_URL || "").replace(/\/+$/, "");
      const res = await fetch(`${base}/api/features/notifications?limit=120`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(`Unable to load notifications (${res.status})`);
      }

      const payload = (await res.json().catch(() => ({}))) as {
        data?: { notifications?: NotificationItem[]; unreadCount?: number };
      };

      const nextItems = Array.isArray(payload?.data?.notifications) ? payload.data!.notifications! : [];
      const nextUnread = Math.max(0, Number(payload?.data?.unreadCount || 0));

      setNotifications(nextItems);
      setUnreadCount(nextUnread);
    } catch (err: any) {
      setError(err?.message || "Failed to load notifications");
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, token]);

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  const markRead = useCallback(
    async (id: string) => {
      if (!id || !isAuthenticated) return;
      try {
        const base = (API_URL || "").replace(/\/+$/, "");
        const res = await fetch(`${base}/api/features/notifications/${encodeURIComponent(id)}/read`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: "include",
        });

        if (!res.ok) return;

        setNotifications((prev) => prev.map((entry) => (entry.id === id ? { ...entry, is_read: true } : entry)));
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch {
        // no-op
      }
    },
    [isAuthenticated, token]
  );

  const markAllRead = useCallback(async () => {
    if (!isAuthenticated) return;
    setWorking(true);
    try {
      const base = (API_URL || "").replace(/\/+$/, "");
      const res = await fetch(`${base}/api/features/notifications/read-all`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
      });

      if (!res.ok) return;

      setNotifications((prev) => prev.map((entry) => ({ ...entry, is_read: true })));
      setUnreadCount(0);
    } finally {
      setWorking(false);
    }
  }, [isAuthenticated, token]);

  const filteredItems = useMemo(() => {
    return notifications.filter((item) => {
      if (scopeFilter === "account" && item.scope !== "user") return false;
      if (scopeFilter === "platform" && item.scope !== "platform") return false;
      if (creditOnly && !String(item.event_type || "").includes("credit")) return false;
      return true;
    });
  }, [notifications, scopeFilter, creditOnly]);

  return (
    <div className="min-h-screen text-white">

      <header className="border-b border-white/10 bg-charcoal-deep relative z-10">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-4 sm:px-6">
          <button
            onClick={() => navigate("/")}
            className="rounded-full p-2 transition-colors hover:bg-white/8"
            type="button"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5 text-white/55" />
          </button>
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-xl brand-title">
              <Bell className="h-5 w-5 text-cyan-300" />
              Notifications
            </h1>
            <p className="text-sm text-white/60 leading-relaxed">
              Monitor background actions, scheduled events, and credit activity.
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPrefs((p) => !p)}
              className="rounded-full p-2 transition-colors hover:bg-white/8"
              aria-label="Notification settings"
            >
              <Settings2 className="h-4.5 w-4.5 text-white/55" />
            </button>
            <div className="text-xs px-3 py-1 rounded-full border border-white/10 bg-charcoal-light text-white/75">
              {unreadCount} unread
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 space-y-4">
        {/* ── Notification Preferences (collapsible) ──────────────── */}
        {showPrefs && (
          <div className="rounded-xl border border-white/10 bg-charcoal p-5">
            <button
              type="button"
              onClick={() => setShowPrefs(false)}
              className="mb-4 flex items-center gap-2 text-xs text-white/55 hover:text-white transition-colors"
            >
              <ChevronUp className="w-3.5 h-3.5" /> Hide notification settings
            </button>
            <NotificationPreferencesPanel />
          </div>
        )}

        <div className="rounded-xl border border-white/10 bg-charcoal p-4 flex flex-wrap items-center gap-2.5">
          <div className="inline-flex items-center gap-2 text-xs text-white/70 mr-2">
            <Filter className="w-3.5 h-3.5" /> Filters
          </div>

          <button
            type="button"
            onClick={() => setScopeFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
              scopeFilter === "all"
                ? "border-cyan-300/40 bg-cyan-500/10 text-cyan-100"
                : "border-white/10 bg-charcoal-light text-white/70 hover:text-white"
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setScopeFilter("account")}
            className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
              scopeFilter === "account"
                ? "border-cyan-300/40 bg-cyan-500/10 text-cyan-100"
                : "border-white/10 bg-charcoal-light text-white/70 hover:text-white"
            }`}
          >
            Account
          </button>
          <button
            type="button"
            onClick={() => setScopeFilter("platform")}
            className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
              scopeFilter === "platform"
                ? "border-cyan-300/40 bg-cyan-500/10 text-cyan-100"
                : "border-white/10 bg-charcoal-light text-white/70 hover:text-white"
            }`}
          >
            Platform
          </button>
          <button
            type="button"
            onClick={() => setCreditOnly((prev) => !prev)}
            className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
              creditOnly
                ? "border-amber-300/40 bg-amber-500/10 text-amber-100"
                : "border-white/10 bg-charcoal-light text-white/70 hover:text-white"
            }`}
          >
            Credit activity only
          </button>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => void fetchNotifications()}
              className="px-3 py-1.5 rounded-lg text-xs border border-white/10 bg-charcoal-light text-white/75 hover:text-white inline-flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
            <button
              type="button"
              disabled={working || unreadCount <= 0}
              onClick={() => void markAllRead()}
              className="px-3 py-1.5 rounded-lg text-xs border border-white/10 bg-charcoal-light text-white/75 hover:text-white inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <CheckCheck className="w-3.5 h-3.5" /> Mark all read
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-charcoal p-2">
          {loading ? (
            <p className="px-4 py-8 text-sm text-white/60">Loading notifications…</p>
          ) : error ? (
            <p className="px-4 py-8 text-sm text-red-300">{error}</p>
          ) : filteredItems.length === 0 ? (
            <p className="px-4 py-8 text-sm text-white/60">No notifications for this filter yet.</p>
          ) : (
            <div className="space-y-2">
              {filteredItems.map((item) => {
                const ts = new Date(item.created_at);
                const createdLabel = Number.isNaN(ts.getTime()) ? "Unknown time" : ts.toLocaleString();

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      void markRead(item.id);
                      const dest = getNotificationDestination(item);
                      if (dest) navigate(dest);
                    }}
                    className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${
                      item.is_read
                        ? "border-white/10 bg-charcoal-light/35 text-white/80 hover:bg-charcoal-light/50"
                        : "border-cyan-300/30 bg-cyan-500/10 text-white hover:bg-cyan-500/15"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2 justify-between">
                      <p className="text-sm font-semibold">{item.title}</p>
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className={`px-2 py-0.5 rounded-full border ${item.scope === "platform" ? "border-violet-300/40 text-violet-200" : "border-white/20 text-white/70"}`}>
                          {item.scope === "platform" ? "Platform" : "Account"}
                        </span>
                        {!item.is_read && <span className="text-cyan-200">Unread</span>}
                      </div>
                    </div>

                    <p className="text-sm text-white/80 mt-1">{item.message}</p>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-white/50">{createdLabel} • {item.event_type}</p>
                      {getNotificationDestination(item) && (
                        <span className="text-[10px] text-cyan-300/70">View →</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
