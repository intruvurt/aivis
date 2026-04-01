import React, { useCallback, useEffect, useState } from "react";
import {
  Bell,
  BellOff,
  Volume2,
  VolumeX,
  Mail,
  MailX,
  Monitor,
  Settings2,
  Loader2,
  Check,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { API_URL } from "../config";
import { useAuthStore } from "../stores/authStore";
import { useSettingsStore, type NotificationCategory } from "../stores/settingsStore";
import { apiFetch } from "../utils/api";

type CategoryMeta = {
  key: NotificationCategory;
  label: string;
  description: string;
};

type ServerPreferences = {
  emailNotifications: boolean;
  inAppEnabled: boolean;
  soundEnabled: boolean;
  browserEnabled: boolean;
  mutedCategories: NotificationCategory[];
};

export default function NotificationPreferencesPanel() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const s = useSettingsStore();

  const [categories, setCategories] = useState<CategoryMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load preferences from server on mount
  const fetchPreferences = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const base = (API_URL || "").replace(/\/+$/, "");
      const res = await apiFetch(`${base}/api/features/notifications/preferences`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to load preferences");
      const payload = await res.json();
      const prefs = payload?.data?.preferences as ServerPreferences | undefined;
      const cats = payload?.data?.categories as CategoryMeta[] | undefined;

      if (prefs) {
        s.setEmailNotifications(prefs.emailNotifications);
        s.setInAppEnabled(prefs.inAppEnabled);
        s.setSoundEnabled(prefs.soundEnabled);
        s.setBrowserNotifications(prefs.browserEnabled);
        s.setMutedCategories(prefs.mutedCategories || []);
      }
      if (Array.isArray(cats)) {
        setCategories(cats);
      }
    } catch {
      // Fall back to local state
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void fetchPreferences();
  }, [fetchPreferences]);

  const savePreferences = useCallback(
    async (updates: Partial<ServerPreferences>) => {
      if (!isAuthenticated) return;
      setSaving(true);
      try {
        const base = (API_URL || "").replace(/\/+$/, "");
        const res = await apiFetch(`${base}/api/features/notifications/preferences`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(updates),
        });

        if (!res.ok) throw new Error("Failed to save preference");
        toast.success("Notification preference saved", { duration: 2000 });
      } catch {
        toast.error("Failed to save notification preference");
      } finally {
        setSaving(false);
      }
    },
    [isAuthenticated],
  );

  const handleToggleInApp = (enabled: boolean) => {
    s.setInAppEnabled(enabled);
    void savePreferences({ inAppEnabled: enabled });
  };

  const handleToggleEmail = (enabled: boolean) => {
    s.setEmailNotifications(enabled);
    void savePreferences({ emailNotifications: enabled });
  };

  const handleToggleSound = (enabled: boolean) => {
    s.setSoundEnabled(enabled);
    void savePreferences({ soundEnabled: enabled });
  };

  const handleToggleBrowser = (enabled: boolean) => {
    s.setBrowserNotifications(enabled);
    if (enabled && typeof window.Notification !== "undefined" && window.Notification.permission === "default") {
      window.Notification.requestPermission().catch(() => {});
    }
    void savePreferences({ browserEnabled: enabled });
  };

  const handleToggleCategory = (category: NotificationCategory, muted: boolean) => {
    const current = s.mutedCategories || [];
    const next = muted
      ? [...current.filter((c) => c !== category), category]
      : current.filter((c) => c !== category);
    s.setMutedCategories(next);
    void savePreferences({ mutedCategories: next });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-white/50 text-sm gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading notification preferences…
      </div>
    );
  }

  const isCategoryMuted = (key: NotificationCategory) => (s.mutedCategories || []).includes(key);

  return (
    <div className="space-y-6">
      {/* ── Global Channel Toggles ─────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Settings2 className="w-4 h-4 text-white/80" />
          <h3 className="text-sm font-semibold text-white">Notification Channels</h3>
          {saving && <Loader2 className="w-3 h-3 animate-spin text-cyan-300 ml-auto" />}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <ChannelToggle
            icon={s.inAppEnabled ? Bell : BellOff}
            label="In-App Notifications"
            description="Bell icon, toasts, and notification feed"
            enabled={s.inAppEnabled}
            onToggle={handleToggleInApp}
          />
          <ChannelToggle
            icon={s.emailNotifications ? Mail : MailX}
            label="Email Notifications"
            description="Platform newsletters and product updates"
            enabled={s.emailNotifications}
            onToggle={handleToggleEmail}
          />
          <ChannelToggle
            icon={s.soundEnabled ? Volume2 : VolumeX}
            label="Notification Sounds"
            description="Play a tone when new notifications arrive"
            enabled={s.soundEnabled}
            onToggle={handleToggleSound}
          />
          <ChannelToggle
            icon={Monitor}
            label="Browser Notifications"
            description="OS-level notifications when tab is in background"
            enabled={s.browserNotifications}
            onToggle={handleToggleBrowser}
          />
        </div>
      </div>

      {/* ── Per-Category Toggles ───────────────────────────────────── */}
      {s.inAppEnabled && categories.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-4 h-4 text-white/80" />
            <h3 className="text-sm font-semibold text-white">Notification Categories</h3>
          </div>
          <p className="text-xs text-white/50 mb-3">
            Muted categories won&apos;t generate in-app notifications. You can unmute anytime.
          </p>

          <div className="space-y-2">
            {categories.map((cat) => {
              const muted = isCategoryMuted(cat.key);
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => handleToggleCategory(cat.key, !muted)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                    muted
                      ? "border-white/10 bg-charcoal-light/30 text-white/50"
                      : "border-cyan-300/20 bg-cyan-500/5 text-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{cat.label}</p>
                      <p className="text-xs text-white/50 mt-0.5">{cat.description}</p>
                    </div>
                    <div className="flex-shrink-0 ml-3">
                      {muted ? (
                        <span className="text-[11px] px-2.5 py-1 rounded-full border border-white/15 bg-charcoal text-white/45">
                          Muted
                        </span>
                      ) : (
                        <span className="text-[11px] px-2.5 py-1 rounded-full border border-cyan-300/30 bg-cyan-500/10 text-cyan-200 inline-flex items-center gap-1">
                          <Check className="w-3 h-3" /> Active
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!s.inAppEnabled && (
        <p className="text-xs text-white/40 italic">
          In-app notifications are turned off. Category settings will take effect when you re-enable them.
        </p>
      )}
    </div>
  );
}

// ── Channel toggle card ────────────────────────────────────────────────────

function ChannelToggle({
  icon: Icon,
  label,
  description,
  enabled,
  onToggle,
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  enabled: boolean;
  onToggle: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(!enabled)}
      className={`text-left w-full px-4 py-3.5 rounded-xl border transition-colors ${
        enabled
          ? "border-cyan-300/20 bg-cyan-500/5 hover:bg-cyan-500/10"
          : "border-white/10 bg-charcoal-light/30 hover:bg-charcoal-light/50"
      }`}
    >
      <div className="flex items-start gap-3">
        <Icon
          className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
            enabled ? "text-cyan-300" : "text-white/35"
          }`}
        />
        <div className="min-w-0">
          <p className={`text-sm font-medium ${enabled ? "text-white" : "text-white/55"}`}>
            {label}
          </p>
          <p className="text-xs text-white/45 mt-0.5">{description}</p>
        </div>
        <div className="ml-auto flex-shrink-0">
          <div
            className={`w-9 h-5 rounded-full transition-colors relative ${
              enabled ? "bg-cyan-500" : "bg-white/15"
            }`}
          >
            <div
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                enabled ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </div>
        </div>
      </div>
    </button>
  );
}
