import React, { useState, useRef, useCallback, useEffect } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { useSettingsStore } from "../stores/settingsStore";
import useFeatureStatus from "../hooks/useFeatureStatus";
import AdvancedFeaturesPanel from "../components/AdvancedFeaturesPanel";
import { hasConsent, revokeConsent, setConsentValue } from "../components/CookieConsent";
import { resetOnboarding } from "../components/OnboardingModal";
import { API_URL } from "../config";
import { apiFetch } from "../utils/api";
import NotificationPreferencesPanel from "../components/NotificationPreferencesPanel";
import toast from "react-hot-toast";
import {
  Zap,
  Shield,
  Download,
  Trash2,
  Settings as SettingsIcon,
  Moon,
  Sun,
  Monitor,
  ChevronLeft,
  ArrowLeft,
  User,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Activity,
  RotateCcw,
  Upload,
  Loader2,
  Link2,
  Play,
  Trophy,
  Target,
  Gift,
  type LucideIcon,
} from "lucide-react";

/* ================================================================== */
/*  Toggle switch                                                      */
/* ================================================================== */
const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({
  checked,
  onChange,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35 focus-visible:ring-offset-2 focus-visible:ring-offset-white/0 ${
      checked ? "bg-gradient-to-r from-white/28 to-white/15" : "bg-charcoal/80"
    }`}
  >
    <span
      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-charcoal shadow-lg ring-0 transition duration-200 ease-in-out ${
        checked ? "translate-x-5" : "translate-x-0"
      }`}
    />
  </button>
);

/* ================================================================== */
/*  Styled building blocks                                             */
/* ================================================================== */

const noiseUrl = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23n)' opacity='0.015'/%3E%3C/svg%3E")`;

const SteelCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
}> = ({ children, className = "", glow = false }) => (
  <div
    className={`relative overflow-hidden rounded-2xl border border-white/14 bg-charcoal shadow-steel transition-all duration-300 ${
      glow ? "ring-1 ring-white/35/20" : ""
    } ${className}`}
    style={{ backgroundImage: noiseUrl }}
  >
    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    <div className="relative p-6 md:p-8">{children}</div>
  </div>
);

const SectionHeading: React.FC<{
  title: string;
  description: string;
  icon?: LucideIcon;
}> = ({ title, description, icon: Icon }) => (
  <div className="mb-6 flex items-start gap-3">
    {Icon && (
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-white/28/20 to-white/15/20 ring-1 ring-white/35/20">
        <Icon className="h-5 w-5 text-white/85" />
      </div>
    )}
    <div>
      <h2 className="text-lg font-semibold text-white tracking-tight">{title}</h2>
      <p className="text-sm text-white/60 mt-0.5">{description}</p>
    </div>
  </div>
);

const SettingRow: React.FC<{
  label: string;
  description?: string;
  children: React.ReactNode;
}> = ({ label, description, children }) => (
  <div className="flex items-center justify-between py-3.5 border-b border-white/10 last:border-0">
    <div className="pr-4">
      <div className="text-sm font-medium text-white">{label}</div>
      {description && <div className="text-xs text-white/60 mt-0.5">{description}</div>}
    </div>
    {children}
  </div>
);

const Divider: React.FC = () => (
  <div className="my-5 h-px bg-gradient-to-r from-transparent via-white/16 to-transparent" />
);

const SteelInput: React.FC<
  React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }
> = ({ label, hint, className = "", ...props }) => (
  <div>
    <label className="block text-sm font-medium text-white/80 mb-1.5">{label}</label>
    <input
      {...props}
      className={`w-full px-4 py-2.5 rounded-xl border border-white/12 bg-charcoal text-white placeholder:text-white/55 focus:ring-2 focus:ring-white/35/40 focus:border-white/12 transition-all duration-200 text-sm ${className}`}
    />
    {hint && <p className="text-xs text-white/55 mt-1">{hint}</p>}
  </div>
);

const SteelSelect: React.FC<
  React.SelectHTMLAttributes<HTMLSelectElement> & { label: string }
> = ({ label, children, className = "", ...props }) => (
  <div>
    <label className="block text-sm font-medium text-white/80 mb-1.5">{label}</label>
    <select
      {...props}
      className={`w-full px-4 py-2.5 rounded-xl border border-white/12 bg-charcoal text-white focus:ring-2 focus:ring-white/35/40 focus:border-white/12 transition-all duration-200 text-sm ${className}`}
    >
      {children}
    </select>
  </div>
);

/* ================================================================== */
/*  Sections — only what actually works                                */
/* ================================================================== */
const sections = [
  { id: "profile", label: "Profile", icon: User },
  { id: "usage", label: "Usage & Plan", icon: Activity },
  { id: "appearance", label: "Appearance", icon: Monitor },
  { id: "privacy", label: "Privacy & Data", icon: Shield },
  { id: "advanced", label: "Advanced", icon: Zap },
] as const;

type SectionId = (typeof sections)[number]["id"];

/* ================================================================== */
/*  MAIN COMPONENT                                                     */
/* ================================================================== */
const SettingsPage: React.FC = () => {
  const { user, token, logout, setUser } = useAuthStore();
  const s = useSettingsStore();
  const { status: featureStatus, loading: featureStatusLoading } = useFeatureStatus();
  const [searchParams] = useSearchParams();
  const [activeSection, setActiveSection] = useState<SectionId>("profile");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [gdprLoading, setGdprLoading] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [analyticsConsent, setAnalyticsConsent] = useState<boolean>(hasConsent());

  // Local draft for profile fields — only committed on explicit Save
  const [profileDraft, setProfileDraft] = useState(() => ({ ...s.profile }));
  const updateDraft = (patch: Partial<typeof s.profile>) =>
    setProfileDraft((prev) => ({ ...prev, ...patch }));

  // Re-sync draft when store profile changes from external source (e.g. server load)
  const storeProfileRef = useRef(s.profile);
  useEffect(() => {
    if (storeProfileRef.current !== s.profile) {
      storeProfileRef.current = s.profile;
      setProfileDraft((prev) => ({ ...s.profile, ...prev }));
    }
  }, [s.profile]);

  useEffect(() => {
    const requested = (searchParams.get("section") || "").toLowerCase();
    if (requested === "advanced") {
      setActiveSection("advanced");
    }
  }, [searchParams]);

  useEffect(() => {
    const onStorage = (event: StorageEvent): void => {
      if (event.key === "cookie-consent") {
        setAnalyticsConsent(hasConsent());
      }
    };

    const onConsentChanged = (): void => {
      setAnalyticsConsent(hasConsent());
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("aivis-consent-change", onConsentChanged);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("aivis-consent-change", onConsentChanged);
    };
  }, []);

  useEffect(() => {
    if (!token) return;

    const loadServerProfile = async () => {
      try {
        const base = (API_URL || "").replace(/\/+$/, "");
        const response = await apiFetch(`${base}/api/auth/profile`, {
          credentials: "include",
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) return;

        const profile = payload?.data || {};
        const nextProfile: Partial<typeof s.profile> = {};

        if (typeof profile.name === "string" && profile.name.trim()) {
          nextProfile.displayName = profile.name.trim();
        }
        if (typeof profile.company === "string") {
          nextProfile.company = profile.company;
        }
        if (typeof profile.website === "string") {
          nextProfile.website = profile.website;
        }
        if (typeof profile.bio === "string") {
          nextProfile.bio = profile.bio;
        }
        if (typeof profile.timezone === "string") {
          nextProfile.timezone = profile.timezone;
        }
        if (typeof profile.language === "string") {
          nextProfile.language = profile.language;
        }

        if (typeof profile.avatar_url === "string" && profile.avatar_url.trim()) {
          nextProfile.avatarUrl = profile.avatar_url;
        } else if (typeof profile.org_logo_url === "string" && profile.org_logo_url.trim()) {
          nextProfile.avatarUrl = profile.org_logo_url;
        } else if (typeof profile.org_favicon_url === "string" && profile.org_favicon_url.trim()) {
          nextProfile.avatarUrl = profile.org_favicon_url;
        }

        if (Object.keys(nextProfile).length > 0) {
          s.updateProfile(nextProfile);
        }

        if (typeof profile.email_notifications === "boolean") {
          s.setEmailNotifications(profile.email_notifications);
        }
        if (typeof profile.share_link_expiration_days === "number") {
          s.setShareLinkExpirationDays(profile.share_link_expiration_days);
        }
      } catch {
        // Non-blocking: keep local preferences if profile fetch fails.
      }
    };

    void loadServerProfile();
  }, [token, s]);

  /* Debounced "saved" toast */
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notifySaved = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      toast.success("Preferences saved", {
        icon: "",
        style: {
          background: "rgba(22,26,38,0.92)",
          color: "#e2e8f0",
          border: "1px solid rgba(255,255,255,0.22)",
        },
      });
    }, 700);
  }, []);

  /* Export / Import — only real settings */
  const exportSettings = (): void => {
    const state = useSettingsStore.getState();
    const exportData = {
      theme: state.theme,
      fontSize: state.fontSize,
      compactMode: state.compactMode,
      showAnimations: state.showAnimations,
      profile: state.profile,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aivis-settings-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Settings exported");
  };

  const importSettings = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        if (parsed.theme !== undefined) s.setTheme(parsed.theme);
        if (parsed.fontSize !== undefined) s.setFontSize(parsed.fontSize);
        if (parsed.compactMode !== undefined) s.setCompactMode(parsed.compactMode);
        if (parsed.showAnimations !== undefined) s.setShowAnimations(parsed.showAnimations);
        if (parsed.profile) s.updateProfile(parsed.profile);
        toast.success("Settings imported");
      } catch {
        toast.error("Invalid settings file");
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be re-imported
    event.target.value = "";
  };

  /* GDPR: Download all user data */
  const handleDataExport = async () => {
    setGdprLoading("export");
    try {
      const base = (API_URL || "").replace(/\/+$/, "");
      const res = await apiFetch(`${base}/api/auth/data-export`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text().catch(() => "Export failed"));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `aivis-data-export-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Data exported. Check your downloads.");
    } catch (err: any) {
      toast.error(err.message || "Failed to export data");
    } finally {
      setGdprLoading(null);
    }
  };

  const handleAccountDelete = async () => {
    if (deleteConfirmText.trim().toUpperCase() !== "DELETE") {
      toast.error('You must type "DELETE" exactly to confirm');
      return;
    }
    setGdprLoading("delete");
    try {
      const base = (API_URL || "").replace(/\/+$/, "");
      const res = await apiFetch(`${base}/api/auth/account`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        let msg = "Deletion failed";
        try { const parsed = JSON.parse(body); msg = parsed.error || parsed.message || msg; } catch { if (body) msg = body; }
        throw new Error(msg);
      }
      toast.success("Account deleted. Goodbye.");
      logout();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete account");
      setGdprLoading(null);
      setShowDeleteConfirm(false);
      setDeleteConfirmText("");
    }
  };

  const saveProfileToServer = async (): Promise<void> => {
    if (!token) {
      toast.error("You must be signed in to save profile changes");
      return;
    }

    const name = (profileDraft.displayName || "").trim();
    if (!name) {
      toast.error("Display Name is required");
      return;
    }

    setSavingProfile(true);
    try {
      const base = (API_URL || "").replace(/\/+$/, "");
      const response = await apiFetch(`${base}/api/auth/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          name,
          email: user?.email,
          company: (profileDraft.company || "").trim() || null,
          website: (profileDraft.website || "").trim() || null,
          bio: (profileDraft.bio || "").trim() || null,
          avatar_url: (profileDraft.avatarUrl || "").trim() || null,
          timezone: (profileDraft.timezone || "").trim() || null,
          language: (profileDraft.language || "").trim() || null,
          auto_enrich: true,
          email_notifications: s.emailNotifications,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 429) {
          const retryAfter = response.headers.get('retry-after') || '60';
          throw new Error(`Rate limited — please wait ${retryAfter}s and try again`);
        }
        throw new Error(payload?.error || "Failed to save profile");
      }

      const updatedProfile = payload?.data || {};
      const updatedName = typeof updatedProfile?.name === "string" ? updatedProfile.name : name;
      const mergedProfile: Partial<typeof s.profile> = {
        displayName: updatedName,
        company: typeof updatedProfile?.company === "string" ? updatedProfile.company : s.profile.company,
        website: typeof updatedProfile?.website === "string" ? updatedProfile.website : s.profile.website,
        bio: typeof updatedProfile?.bio === "string" ? updatedProfile.bio : s.profile.bio,
        timezone: typeof updatedProfile?.timezone === "string" ? updatedProfile.timezone : s.profile.timezone,
        language: typeof updatedProfile?.language === "string" ? updatedProfile.language : s.profile.language,
      };

      const resolvedAvatar =
        (typeof updatedProfile?.avatar_url === "string" && updatedProfile.avatar_url.trim()
          ? updatedProfile.avatar_url
          : null) ||
        (typeof updatedProfile?.org_logo_url === "string" && updatedProfile.org_logo_url.trim()
          ? updatedProfile.org_logo_url
          : null) ||
        (typeof updatedProfile?.org_favicon_url === "string" && updatedProfile.org_favicon_url.trim()
          ? updatedProfile.org_favicon_url
          : null) ||
        s.profile.avatarUrl;

      mergedProfile.avatarUrl = resolvedAvatar;
      s.updateProfile(mergedProfile);
      setProfileDraft((prev) => ({ ...prev, ...mergedProfile }));

      if (user) {
        setUser({
          ...user,
          full_name: updatedName,
          display_name: updatedName,
          avatar_url: resolvedAvatar || undefined,
          company: typeof updatedProfile?.company === "string" ? updatedProfile.company : user.company,
          website: typeof updatedProfile?.website === "string" ? updatedProfile.website : user.website,
        });
      }

      const enrichment = updatedProfile?.enrichment;
      const compSuggestions = updatedProfile?.competitor_suggestions;

      if (enrichment?.verified === true) {
        toast.success(`Profile saved and business verified (${enrichment.confidence_score}% confidence)`);
      } else {
        toast.success("Profile saved");
      }

      if (compSuggestions && compSuggestions.new_count > 0) {
        toast.success(
          `Found ${compSuggestions.new_count} potential competitor${compSuggestions.new_count === 1 ? "" : "s"} from your audit history! Check Competitor Tracking to review.`,
          { duration: 6000 },
        );
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to save profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const saveEmailNotificationPreference = async (enabled: boolean): Promise<void> => {
    if (!token) {
      toast.error("You must be signed in to update notification settings");
      return;
    }

    const fallbackName = (user?.display_name || user?.full_name || user?.email?.split("@")[0] || "User").trim();
    const name = (s.profile.displayName || fallbackName).trim();

    try {
      const base = (API_URL || "").replace(/\/+$/, "");
      const response = await apiFetch(`${base}/api/auth/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          name,
          email: user?.email,
          email_notifications: enabled,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Failed to save notification preference");

      s.setEmailNotifications(enabled);
      toast.success(enabled ? "Email updates enabled" : "Email updates paused");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save notification preference");
    }
  };

  const saveShareLinkExpirationPreference = async (days: number): Promise<void> => {
    if (!token) {
      toast.error("You must be signed in to update share-link settings");
      return;
    }

    const fallbackName = (user?.display_name || user?.full_name || user?.email?.split("@")[0] || "User").trim();
    const name = (s.profile.displayName || fallbackName).trim();
    const previousDays = s.shareLinkExpirationDays;
    s.setShareLinkExpirationDays(days);

    try {
      const base = (API_URL || "").replace(/\/+$/, "");
      const response = await apiFetch(`${base}/api/auth/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          name,
          email: user?.email,
          share_link_expiration_days: days,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Failed to save share-link expiration setting");

      const resolvedDays = typeof payload?.data?.share_link_expiration_days === "number"
        ? payload.data.share_link_expiration_days
        : days;
      s.setShareLinkExpirationDays(resolvedDays);
      toast.success("Share-link expiration updated");
    } catch (err: any) {
      s.setShareLinkExpirationDays(previousDays);
      toast.error(err?.message || "Failed to save share-link expiration setting");
    }
  };

  const navigate = useNavigate();

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */
  return (
    <div className="min-h-screen page-splash-bg bg-[#2e3646] text-white">
      <header className="border-b border-white/10 bg-charcoal-deep">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <button onClick={() => navigate("/")} className="rounded-full p-2 transition-colors hover:bg-white/8" type="button" aria-label="Go back">
            <ArrowLeft className="h-5 w-5 text-white/55" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 text-xl brand-title">
              <SettingsIcon className="h-5 w-5 text-orange-400" />
              Settings
            </h1>
            <p className="text-sm text-white/60 leading-relaxed">Customize your AiVIS experience</p>
          </div>
          <div className="hidden md:block ml-auto shrink-0 overflow-hidden rounded-xl border border-white/10">
            <img src="/gear.jpeg" alt="Settings gear icon" className="h-12 w-16 object-cover object-center opacity-70" aria-hidden="true" loading="lazy" />
          </div>
        </div>
      </header>
      <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">

        {/* Two-column layout */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* ─── LEFT: Nav sidebar ─── */}
          <div className="lg:w-56 flex-shrink-0">
            <div
              className="rounded-2xl border border-white/14 bg-charcoal shadow-steel p-4 sticky top-8"
              style={{ backgroundImage: noiseUrl }}
            >
              {/* User mini-card */}
              <div className="flex items-center gap-3 px-3 py-3 mb-3 rounded-xl bg-charcoal-light border border-white/10">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-white/28 to-white/15 text-white text-sm font-bold shadow-md">
                  {s.profile.avatarUrl ? (
                    <img
                      src={s.profile.avatarUrl}
                      alt="Profile photo"
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    (s.profile.displayName || user?.email || "U").charAt(0).toUpperCase()
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {s.profile.displayName || user?.full_name || "User"}
                  </p>
                  <p className="text-xs text-white/55 truncate">{user?.email}</p>
                </div>
              </div>

              <nav className="space-y-0.5">
                {sections.map((section) => {
                  const Icon = section.icon;
                  const active = activeSection === section.id;
                  return (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-200 text-left text-sm ${
                        active
                          ? "bg-gradient-to-r from-white/28/10 to-white/15/10 text-white/85 font-semibold ring-1 ring-white/35/20"
                          : "text-white/70 hover:bg-charcoal-light hover:text-white"
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${active ? "text-white/85" : ""}`} />
                      {section.label}
                    </button>
                  );
                })}
              </nav>

              {/* Utility actions */}
              <div className="mt-5 pt-5 border-t border-white/14 space-y-1">
                <button
                  onClick={exportSettings}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-white/70 hover:bg-charcoal-light hover:text-white rounded-xl transition-colors"
                >
                  <Download className="w-4 h-4" /> Export Settings
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-white/70 hover:bg-charcoal-light hover:text-white rounded-xl transition-colors"
                >
                  <Upload className="w-4 h-4" /> Import Settings
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={importSettings}
                    className="hidden"
                  />
                </button>
                <button
                  onClick={() => {
                    if (confirm("Reset all settings to defaults?")) {
                      s.resetSettings();
                      toast.success("Settings reset to defaults");
                    }
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-white/80 hover:bg-charcoal rounded-xl transition-colors"
                >
                  <RotateCcw className="w-4 h-4" /> Reset All
                </button>
              </div>
            </div>
          </div>

          {/* ─── RIGHT: Content ─── */}
          <div className="flex-1 min-w-0 space-y-6">
            {/* ============================== USAGE & PLAN ============================== */}
            {activeSection === "usage" && (
              <>
                <SteelCard glow>
                  <SectionHeading
                    icon={Activity}
                    title="Usage & Plan"
                    description="Your current plan, monthly scan usage, and available credits"
                  />

                  {/* Current plan */}
                  <div className="mb-6 flex items-center justify-between rounded-xl border border-white/10 bg-charcoal-deep px-5 py-4">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-white/45 mb-1">Current Plan</p>
                      <p className="text-base font-semibold text-white capitalize">
                        {featureStatus?.tier ?? user?.tier ?? "observer"}
                      </p>
                    </div>
                    <Link
                      to="/billing"
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors"
                    >
                      <Zap className="h-3.5 w-3.5 text-amber-400" />
                      Manage Plan
                    </Link>
                  </div>

                  {/* Monthly scan usage */}
                  <div className="mb-5">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-white/80">Monthly Scans</p>
                      <p className="text-sm font-semibold text-white">
                        {featureStatus?.usage?.usedThisMonth ?? 0}
                        <span className="text-white/45 font-normal">
                          /{featureStatus?.usage?.monthlyLimit ?? "—"}
                        </span>
                      </p>
                    </div>
                    <div className="h-2 rounded-full bg-charcoal-deep overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-white/40 to-white/20 transition-all duration-500"
                        style={{
                          width: `${featureStatus?.usage?.monthlyLimit
                            ? Math.min(100, Math.round(((featureStatus.usage.usedThisMonth ?? 0) / featureStatus.usage.monthlyLimit) * 100))
                            : 0}%`,
                        }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-white/45">
                      {featureStatus?.usage?.remainingThisMonth ?? "—"} scans remaining this month
                    </p>
                  </div>

                  {/* Pack credits */}
                  <div className="rounded-xl border border-white/10 bg-charcoal px-5 py-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-white/45 mb-1">Pack Credits</p>
                      <p className="text-2xl font-bold text-white">
                        {featureStatus?.credits?.packCreditsRemaining ?? 0}
                      </p>
                      <p className="text-xs text-white/45 mt-0.5">Roll over — never expire</p>
                    </div>
                    <Link
                      to="/pricing?intent=credits"
                      className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-xs font-medium text-amber-200 hover:bg-amber-400/20 transition-colors"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Buy Credits
                    </Link>
                  </div>

                  {/* Referral credits */}
                  {(featureStatus?.credits?.referralCreditsEarnedTotal ?? 0) > 0 && (
                    <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-3 flex items-center gap-3">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                      <p className="text-sm text-white/75">
                        <span className="font-semibold text-emerald-300">{featureStatus?.credits?.referralCreditsEarnedTotal}</span> referral credits earned in total
                      </p>
                    </div>
                  )}
                </SteelCard>

                {/* ── Milestones ── */}
                <SteelCard>
                  <SectionHeading
                    icon={Trophy}
                    title="Milestones"
                    description="Earn free credits by reaching platform milestones"
                  />

                  {/* Unlocked milestones */}
                  {(featureStatus?.milestones?.unlocked?.length ?? 0) > 0 && (
                    <div className="mb-5">
                      <p className="text-xs uppercase tracking-wider text-white/45 mb-3">Unlocked</p>
                      <div className="space-y-2">
                        {featureStatus!.milestones!.unlocked!.map((m) => {
                          const def = featureStatus?.milestones?.next?.find((n) => n.key === m.key);
                          return (
                            <div
                              key={m.key}
                              className="flex items-center gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-2.5"
                            >
                              <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">
                                  {def?.label || m.key.replace(/_/g, " ")}
                                </p>
                              </div>
                              <span className="text-xs font-semibold text-emerald-300">+{m.creditsAwarded} credits</span>
                            </div>
                          );
                        })}
                      </div>
                      {(featureStatus?.milestones?.totalCreditsEarned ?? 0) > 0 && (
                        <p className="mt-2 text-xs text-emerald-300/70">
                          Total milestone credits earned: <span className="font-semibold">{featureStatus?.milestones?.totalCreditsEarned}</span>
                        </p>
                      )}
                    </div>
                  )}

                  {/* Next milestones */}
                  {(featureStatus?.milestones?.next?.length ?? 0) > 0 && (
                    <div>
                      <p className="text-xs uppercase tracking-wider text-white/45 mb-3">
                        {(featureStatus?.milestones?.unlocked?.length ?? 0) > 0 ? "Up Next" : "Available Milestones"}
                      </p>
                      <div className="space-y-2">
                        {featureStatus!.milestones!.next!.slice(0, 5).map((m) => (
                          <div
                            key={m.key}
                            className="flex items-center gap-3 rounded-lg border border-white/8 bg-charcoal-deep px-4 py-2.5"
                          >
                            <Target className="h-4 w-4 text-white/30 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-white/80 truncate">{m.label}</p>
                              <p className="text-xs text-white/40 truncate">{m.description}</p>
                            </div>
                            <span className="flex items-center gap-1 text-xs font-semibold text-amber-300/80">
                              <Gift className="h-3 w-3" />
                              +{m.creditReward}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!(featureStatus?.milestones?.unlocked?.length) && !(featureStatus?.milestones?.next?.length) && (
                    <p className="text-sm text-white/40 text-center py-4">
                      {featureStatusLoading ? "Loading milestones\u2026" : "No milestones unlocked yet. Keep using the platform to earn credits!"}
                    </p>
                  )}
                </SteelCard>

                {/* ── Tool Credit Costs ── */}
                {featureStatus?.toolUsage && (
                  <SteelCard>
                    <SectionHeading
                      icon={Zap}
                      title="Tool Credits"
                      description="Free monthly allowances and per-use credit costs"
                    />
                    <div className="space-y-2">
                      {Object.entries(featureStatus.toolUsage).map(([action, info]) => {
                        const label = action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                        const pctUsed = info.freeAllowance > 0 ? Math.min(100, Math.round((info.used / info.freeAllowance) * 100)) : 100;
                        return (
                          <div key={action} className="rounded-lg border border-white/8 bg-charcoal-deep px-4 py-3">
                            <div className="flex items-center justify-between mb-1.5">
                              <p className="text-sm font-medium text-white/80">{label}</p>
                              <div className="flex items-center gap-3 text-xs">
                                {info.freeAllowance > 0 && (
                                  <span className="text-white/50">
                                    {info.freeRemaining}/{info.freeAllowance} free
                                  </span>
                                )}
                                <span className="text-amber-300/80 font-semibold">
                                  {info.creditCost} credit{info.creditCost !== 1 ? "s" : ""}/use
                                </span>
                              </div>
                            </div>
                            {info.freeAllowance > 0 && (
                              <div className="h-1.5 rounded-full bg-charcoal overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    pctUsed >= 100 ? "bg-amber-400/60" : "bg-white/25"
                                  }`}
                                  style={{ width: `${pctUsed}%` }}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <p className="mt-3 text-xs text-white/40">
                      Free uses reset monthly. After exhaustion, credits are deducted per use.
                    </p>
                  </SteelCard>
                )}
              </>
            )}

            {/* ============================== PROFILE ============================== */}
            {activeSection === "profile" && (
              <>
                <SteelCard glow>
                  <SectionHeading
                    icon={User}
                    title="Profile"
                    description="Your identity across the platform"
                  />

                  <div className="mb-6 flex justify-end">
                    <button
                      onClick={() => {
                        void saveProfileToServer();
                      }}
                      disabled={savingProfile}
                      className="text-sm px-4 py-2.5 rounded-full bg-charcoal border border-white/10 text-white/80 hover:bg-charcoal-deep hover:text-white transition-colors font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {savingProfile ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      Save Profile
                    </button>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start gap-6 mb-6">
                    {/* Avatar */}
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-white/28 to-white/15 text-white text-2xl font-bold shadow-xl shadow-white/20 ring-2 ring-white/10 overflow-hidden">
                        {profileDraft.avatarUrl ? (
                          <img
                            src={profileDraft.avatarUrl}
                            alt="Avatar"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          (profileDraft.displayName || user?.email || "U")
                            .charAt(0)
                            .toUpperCase()
                        )}
                      </div>
                    </div>

                    <div className="flex-1 grid gap-4 sm:grid-cols-2 w-full">
                      <SteelInput
                        label="Display Name"
                        placeholder="Your name"
                        value={profileDraft.displayName}
                        onChange={(e) => updateDraft({ displayName: e.target.value })}
                      />
                      <SteelInput
                        label="Company"
                        placeholder="Company or brand"
                        value={profileDraft.company}
                        onChange={(e) => updateDraft({ company: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-white/80 mb-1.5">
                        Bio
                      </label>
                      <textarea
                        value={profileDraft.bio}
                        onChange={(e) => updateDraft({ bio: e.target.value })}
                        placeholder="A brief bio about yourself or your brand…"
                        rows={3}
                        className="w-full px-4 py-2.5 rounded-xl border border-white/12 bg-charcoal text-white placeholder:text-white/55 focus:ring-2 focus:ring-white/35/40 focus:border-white/12 transition-all duration-200 text-sm resize-none"
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <SteelInput
                        label="Website"
                        placeholder="https://yoursite.com"
                        type="url"
                        value={profileDraft.website}
                        onChange={(e) => updateDraft({ website: e.target.value })}
                      />
                      <SteelInput
                        label="Avatar URL"
                        placeholder="https://example.com/avatar.jpg"
                        type="url"
                        hint="Direct link to your profile image"
                        value={profileDraft.avatarUrl || ""}
                        onChange={(e) => updateDraft({ avatarUrl: e.target.value || null })}
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <SteelSelect
                        label="Timezone"
                        value={profileDraft.timezone}
                        onChange={(e) => updateDraft({ timezone: e.target.value })}
                      >
                        {[
                          "UTC",
                          "America/New_York",
                          "America/Chicago",
                          "America/Denver",
                          "America/Los_Angeles",
                          "America/Anchorage",
                          "Pacific/Honolulu",
                          "Europe/London",
                          "Europe/Berlin",
                          "Europe/Paris",
                          "Europe/Moscow",
                          "Asia/Dubai",
                          "Asia/Kolkata",
                          "Asia/Shanghai",
                          "Asia/Tokyo",
                          "Asia/Seoul",
                          "Australia/Sydney",
                          "Pacific/Auckland",
                        ].map((tz) => (
                          <option key={tz} value={tz}>
                            {tz.replace(/_/g, " ")}
                          </option>
                        ))}
                      </SteelSelect>
                      <SteelSelect
                        label="Language"
                        value={profileDraft.language}
                        onChange={(e) => updateDraft({ language: e.target.value })}
                      >
                        {[
                          { code: "en-US", name: "English (US)" },
                          { code: "en-GB", name: "English (UK)" },
                          { code: "es-ES", name: "Español" },
                          { code: "fr-FR", name: "Français" },
                          { code: "de-DE", name: "Deutsch" },
                          { code: "pt-BR", name: "Português (BR)" },
                          { code: "ja-JP", name: "日本語" },
                          { code: "zh-CN", name: "中文 (简体)" },
                          { code: "ko-KR", name: "한국어" },
                        ].map((lang) => (
                          <option key={lang.code} value={lang.code}>
                            {lang.name}
                          </option>
                        ))}
                      </SteelSelect>
                    </div>
                  </div>
                </SteelCard>

                {/* Account Info */}
                <SteelCard>
                  <SectionHeading
                    icon={Shield}
                    title="Account"
                    description="Your account details and subscription"
                  />
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-charcoal-light border border-white/10">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-charcoal">
                        <Sparkles className="w-5 h-5 text-white/85" />
                      </div>
                      <div>
                        <p className="text-xs text-white/60 uppercase tracking-wider font-medium">
                          Email
                        </p>
                        <p className="text-sm font-medium text-white truncate max-w-[160px]">
                          {user?.email || "N/A"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-4 rounded-xl bg-charcoal-light border border-white/10">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-charcoal">
                        <Sparkles className="w-5 h-5 text-white/80" />
                      </div>
                      <div>
                        <p className="text-xs text-white/60 uppercase tracking-wider font-medium">
                          Plan
                        </p>
                        <p className="text-sm font-semibold text-white capitalize">
                          {user?.tier || "Observer"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-4 rounded-xl bg-charcoal-light border border-white/10">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-charcoal">
                        <Activity className="w-5 h-5 text-white/80" />
                      </div>
                      <div>
                        <p className="text-xs text-white/60 uppercase tracking-wider font-medium">
                          Status
                        </p>
                        <p className="text-sm font-medium text-white flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-white/80" /> Active
                        </p>
                      </div>
                    </div>
                  </div>
                </SteelCard>
              </>
            )}

            {/* ============================== APPEARANCE ============================== */}
            {activeSection === "appearance" && (
              <SteelCard glow>
                <SectionHeading
                  icon={Monitor}
                  title="Appearance"
                  description="Theme, font size, and visual preferences"
                />

                {/* Theme picker */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-white/80 mb-3">
                    Theme
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {(
                      [
                        { value: "light" as const, label: "Light", icon: Sun, desc: "Bright & clean" },
                        { value: "dark" as const, label: "Dark", icon: Moon, desc: "Easy on eyes" },
                        { value: "system" as const, label: "System", icon: Monitor, desc: "Follows OS" },
                      ] as const
                    ).map((t) => {
                      const Icon = t.icon;
                      const active = s.theme === t.value;
                      return (
                        <button
                          key={t.value}
                          onClick={() => {
                            s.setTheme(t.value);
                            notifySaved();
                          }}
                          className={`relative flex flex-col items-center gap-2 p-5 rounded-xl border-2 transition-all duration-200 ${
                            active
                              ? "border-white/12 bg-gradient-to-b from-white/28 to-white/15 ring-1 ring-white/35/30 shadow-md shadow-white/20"
                              : "border-white/14 hover:border-white/12 hover:bg-charcoal-light"
                          }`}
                        >
                          {active && (
                            <div className="absolute top-2 right-2">
                              <CheckCircle2 className="w-4 h-4 text-white/85" />
                            </div>
                          )}
                          <Icon
                            className={`w-7 h-7 ${active ? "text-white/85" : "text-white/55"}`}
                          />
                          <span
                            className={`text-sm font-semibold ${active ? "text-white/85" : "text-white/70"}`}
                          >
                            {t.label}
                          </span>
                          <span className="text-xs text-white/55">{t.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <Divider />

                {/* Font size */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-white/80 mb-3">
                    Font Size
                  </label>
                  <div className="flex gap-2">
                    {(
                      [
                        { size: "small" as const, label: "Sm", sample: "Aa" },
                        { size: "medium" as const, label: "Md", sample: "Aa" },
                        { size: "large" as const, label: "Lg", sample: "Aa" },
                      ] as const
                    ).map((f) => {
                      const active = s.fontSize === f.size;
                      return (
                        <button
                          key={f.size}
                          onClick={() => {
                            s.setFontSize(f.size);
                            notifySaved();
                          }}
                          className={`flex flex-col items-center gap-1 px-5 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                            active
                              ? "bg-gradient-to-r from-white/28 to-white/15 text-white shadow-md shadow-white/20"
                              : "bg-charcoal-light text-white/70 hover:bg-charcoal-light/60 border border-transparent hover:border-white/12"
                          }`}
                        >
                          <span
                            className={
                              f.size === "small"
                                ? "text-xs"
                                : f.size === "large"
                                  ? "text-lg"
                                  : "text-sm"
                            }
                          >
                            {f.sample}
                          </span>
                          <span className="text-xs opacity-80">{f.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <Divider />

                <SettingRow label="Compact Mode" description="Reduce spacing for denser layouts">
                  <Toggle
                    checked={s.compactMode}
                    onChange={(v) => {
                      s.setCompactMode(v);
                      notifySaved();
                    }}
                  />
                </SettingRow>
                <SettingRow label="Show Animations" description="Enable smooth transitions and effects">
                  <Toggle
                    checked={s.showAnimations}
                    onChange={(v) => {
                      s.setShowAnimations(v);
                      notifySaved();
                    }}
                  />
                </SettingRow>
              </SteelCard>
            )}

            {/* ============================== PRIVACY & DATA ============================== */}
            {activeSection === "privacy" && (
              <SteelCard glow>
                <SectionHeading
                  icon={Shield}
                  title="Privacy & Data"
                  description="Data management, export, and account controls"
                />

                <div className="p-5 rounded-xl bg-gradient-to-r from-white/5 to-white/[0.02] border border-white/10 mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="w-4 h-4 text-white/80" />
                    <h3 className="text-sm font-semibold text-white">Analytics Consent</h3>
                  </div>
                  <p className="text-xs text-white/60 mb-4 leading-relaxed">
                    Consent status: {analyticsConsent ? "Accepted (analytics enabled)" : "Essential only (analytics disabled)"}.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => {
                        setConsentValue("accepted");
                        setAnalyticsConsent(true);
                        s.setShareAnalytics(true);
                        toast.success("Analytics consent enabled");
                      }}
                      className="text-sm px-4 py-2.5 rounded-full bg-charcoal border border-white/10 text-white/80 hover:bg-charcoal-deep hover:text-white transition-colors font-medium"
                    >
                      Enable Analytics
                    </button>
                    <button
                      onClick={() => {
                        setConsentValue("dismissed");
                        setAnalyticsConsent(false);
                        s.setShareAnalytics(false);
                        toast.success("Analytics disabled (essential only)");
                      }}
                      className="text-sm px-4 py-2.5 rounded-full bg-charcoal border border-white/10 text-white/80 hover:bg-charcoal-deep hover:text-white transition-colors font-medium"
                    >
                      Essential Only
                    </button>
                    <button
                      onClick={() => {
                        revokeConsent();
                        setAnalyticsConsent(false);
                        s.setShareAnalytics(false);
                        window.AiVisConsent?.open?.();
                        toast.success("Consent reset. Choose again from the banner.");
                      }}
                      className="text-sm px-4 py-2.5 rounded-full bg-charcoal border border-white/10 text-white/80 hover:bg-charcoal-deep hover:text-white transition-colors font-medium"
                    >
                      Reset Consent
                    </button>
                  </div>
                </div>

                {/* GDPR Actions */}
                <div className="p-5 rounded-xl bg-gradient-to-r from-white/5 to-white/[0.02] border border-white/10 mb-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Link2 className="w-4 h-4 text-white/80" />
                    <h3 className="text-sm font-semibold text-white">Public Share Link Expiration</h3>
                  </div>
                  <p className="text-xs text-white/60 mb-4 leading-relaxed">
                    Each time you copy a public share link, a new link is generated and the previous one is superseded.
                    Choose how long previously issued links remain accessible before they expire.
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    {([
                      { label: "Never expire", value: 0 },
                      { label: "7 days", value: 7 },
                      { label: "14 days", value: 14 },
                      { label: "30 days", value: 30 },
                      { label: "90 days", value: 90 },
                    ] as const).map((opt) => {
                      const active = s.shareLinkExpirationDays === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            void saveShareLinkExpirationPreference(opt.value);
                          }}
                          className={`text-sm px-3.5 py-2 rounded-full border font-medium transition-colors ${
                            active
                              ? "border-white/30 bg-white/15 text-white shadow-sm"
                              : "border-white/10 bg-charcoal text-white/65 hover:text-white hover:bg-charcoal-deep"
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-3 text-[11px] text-white/45">
                    {s.shareLinkExpirationDays === 0
                      ? "Previously issued links will remain valid indefinitely until you generate a new one."
                      : `Previously issued links will expire ${s.shareLinkExpirationDays} days after being superseded by a new copy.`}
                  </p>
                </div>

                {/* GDPR Actions (legacy label kept for existing DOM structure) */}
                <div className="p-5 rounded-xl bg-gradient-to-r from-white/5 to-white/[0.02] border border-white/10 mb-6">
                  <div className="mb-5">
                    <NotificationPreferencesPanel />
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="w-4 h-4 text-white/80" />
                    <h3 className="text-sm font-semibold text-white">
                      Data Management (GDPR)
                    </h3>
                  </div>
                  <p className="text-xs text-white/60 mb-4 leading-relaxed">
                    Download a complete copy of all your data (audits, analytics,
                    competitors, citations, settings), or permanently delete your
                    account and all associated data. Account deletion cannot be
                    undone.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={handleDataExport}
                      disabled={gdprLoading === "export"}
                      className="text-sm px-4 py-2.5 rounded-full bg-charcoal border border-white/10 text-white/80 hover:bg-charcoal-deep hover:text-white transition-colors font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {gdprLoading === "export" ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      Download My Data
                    </button>
                    {!showDeleteConfirm ? (
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        disabled={gdprLoading === "delete"}
                        className="text-sm px-4 py-2.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete Account & All Data
                      </button>
                    ) : (
                      <div className="w-full mt-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30">
                        <p className="text-xs text-red-400 font-semibold mb-2">This will permanently delete your account and ALL data. This cannot be undone.</p>
                        <p className="text-xs text-white/60 mb-3">Type <span className="font-mono font-bold text-white">DELETE</span> to confirm:</p>
                        <input
                          type="text"
                          value={deleteConfirmText}
                          onChange={(e) => setDeleteConfirmText(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleAccountDelete(); }}
                          placeholder="Type DELETE here"
                          autoFocus
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="none"
                          spellCheck={false}
                          className="w-full mb-3 px-3 py-2 rounded-lg bg-charcoal border border-white/10 text-white text-sm placeholder-white/30 focus:outline-none focus:border-red-500/50"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); }}
                            disabled={gdprLoading === "delete"}
                            className="text-xs px-3 py-1.5 rounded-full border border-white/10 text-white/60 hover:text-white transition-colors disabled:opacity-50"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleAccountDelete}
                            disabled={gdprLoading === "delete" || deleteConfirmText.trim().toUpperCase() !== "DELETE"}
                            className="text-xs px-3 py-1.5 rounded-full bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                          >
                            {gdprLoading === "delete" ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Trash2 className="w-3 h-3" />
                            )}
                            Confirm Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <Divider />

                <p className="text-xs text-white/50 leading-relaxed">
                  Visual preferences (theme, font size, compact mode, animations)
                  are stored locally in your browser. Audit history, account data,
                  and feature configurations are stored server-side and included in
                  GDPR data exports. Email update preference and public share-link
                  expiration policy are persisted server-side.
                </p>
              </SteelCard>
            )}

            {/* ============================== ADVANCED ============================== */}
            {activeSection === "advanced" && (
              <SteelCard glow>
                <SectionHeading
                  icon={Zap}
                  title="Advanced Features"
                  description="Scheduled rescans, API keys, webhooks, and white-label branding"
                />
                <AdvancedFeaturesPanel />

                <Divider />

                <SectionHeading
                  icon={Play}
                  title="Onboarding Tour"
                  description="Replay the platform walkthrough to discover all features"
                />
                <button
                  onClick={() => {
                    resetOnboarding();
                    toast.success("Tour reset — navigate to the Dashboard to start it");
                    navigate("/");
                  }}
                  className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-white/12 bg-charcoal hover:bg-charcoal-light text-sm text-white/80 hover:text-white transition-all"
                >
                  <Play className="w-4 h-4" />
                  Replay Onboarding Tour
                </button>
              </SteelCard>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
