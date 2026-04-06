/**
 * AdvancedFeaturesPanel
 * Manages Scheduled Rescans, API Keys, Webhooks, and White-Label Branding.
 * Signal+ tiers (Signal and Score Fix). Rendered inside SettingsPage "Advanced" tab.
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  Globe,
  Link as LinkIcon,
  FileText,
  Building2,
  Mail,
  Plus,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  RefreshCw,
  Calendar,
  Key,
  Webhook,
  Palette,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ToggleLeft,
  ToggleRight,
  Upload,
  MessageSquare,
  Workflow,
  ShieldCheck,
} from "lucide-react";
import { useAuthStore } from "../stores/authStore";
import { API_URL } from "../config";
import { appInputSurfaceClass, appSelectSurfaceClass } from "../lib/formStyles";
import toast from "react-hot-toast";
import { meetsMinimumTier, TIER_LIMITS, uiTierFromCanonical } from "@shared/types";
import type { CanonicalTier } from "@shared/types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function useTierLimits() {
  const user = useAuthStore((s) => s.user);
  const tier = uiTierFromCanonical((user?.tier as CanonicalTier) || "observer");
  return TIER_LIMITS[tier];
}

function LimitBadge({ used, max }: { used: number; max: number }) {
  const atCap = used >= max;
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${atCap ? "bg-red-500/20 text-red-300" : "bg-white/10 text-white/60"}`}>
      {used}/{max}
    </span>
  );
}

function authHeaders(token: string | null): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h.Authorization = `Bearer ${token}`;
  const wsId = window.localStorage.getItem("aivis_active_workspace_id");
  if (wsId) h["X-Workspace-Id"] = wsId;
  return h;
}

function apiUrl(path: string) {
  const base = (API_URL || "").replace(/\/+$/, "");
  return base ? `${base}${path}` : path;
}

async function apiFetch(path: string, token: string | null, opts: RequestInit = {}) {
  const res = await fetch(apiUrl(path), {
    ...opts,
    headers: { ...authHeaders(token), ...(opts.headers || {}) },
    credentials: "include",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

type IntegrationPreset = {
  key: "slack" | "zapier" | "discord" | "notion" | "teams" | "google_chat";
  label: string;
  hint: string;
  placeholder: string;
  docsUrl: string;
  validator: (url: string) => boolean;
  icon: React.ReactNode;
};

type WorkspaceOption = {
  workspaceId: string;
  workspaceName: string;
  organizationName: string;
  role: "owner" | "admin" | "member" | "viewer";
};

type ReportDeliveryProvider = "email" | "generic" | "slack" | "discord" | "zapier" | "notion" | "teams" | "google_chat";

type ReportDeliveryTarget = {
  id: string;
  provider: ReportDeliveryProvider;
  display_name?: string | null;
  target: string;
  branded: boolean;
  include_pdf: boolean;
  include_share_link: boolean;
  enabled: boolean;
  failure_count: number;
  last_triggered_at?: string | null;
};

function IntegrationBrandIcon({ brand }: { brand: IntegrationPreset["key"] | "custom" }) {
  if (brand === "slack") {
    return (
      <svg className="w-4 h-4" viewBox="0 0 122.8 122.8" aria-hidden="true">
        <path fill="#36C5F0" d="M30.7 77.1a15.4 15.4 0 1 1-15.4-15.4h15.4v15.4z"/>
        <path fill="#36C5F0" d="M38.5 77.1a15.4 15.4 0 0 1 30.7 0v38.4a15.4 15.4 0 1 1-30.7 0V77.1z"/>
        <path fill="#2EB67D" d="M45.6 30.7a15.4 15.4 0 1 1 15.4-15.4v15.4H45.6z"/>
        <path fill="#2EB67D" d="M45.6 38.5a15.4 15.4 0 0 1 0 30.7H7.2a15.4 15.4 0 1 1 0-30.7h38.4z"/>
        <path fill="#ECB22E" d="M92.1 45.6a15.4 15.4 0 1 1 15.4 15.4H92.1V45.6z"/>
        <path fill="#ECB22E" d="M84.3 45.6a15.4 15.4 0 0 1-30.7 0V7.2a15.4 15.4 0 1 1 30.7 0v38.4z"/>
        <path fill="#E01E5A" d="M77.1 92.1a15.4 15.4 0 1 1-15.4 15.4V92.1h15.4z"/>
        <path fill="#E01E5A" d="M77.1 84.3a15.4 15.4 0 0 1 0-30.7h38.4a15.4 15.4 0 1 1 0 30.7H77.1z"/>
      </svg>
    );
  }

  if (brand === "zapier") {
    return (
      <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#FF4F00" d="M10.2 1h3.6v6.2H10.2V1zm0 15.8h3.6V23h-3.6v-6.2zM1 10.2h6.2v3.6H1v-3.6zm15.8 0H23v3.6h-6.2v-3.6zM4.5 4.5l2.5-2.5 4.4 4.4-2.5 2.5-4.4-4.4zm10.1 10.1 2.5-2.5 4.4 4.4-2.5 2.5-4.4-4.4zM15.9 8.9l-2.5-2.5L17.8 2l2.5 2.5-4.4 4.4zM8.9 15.9l-2.5-2.5L2 17.8l2.5 2.5 4.4-4.4z"/>
      </svg>
    );
  }

  if (brand === "discord") {
    return (
      <svg className="w-4 h-4" viewBox="0 0 127.14 96.36" aria-hidden="true">
        <path fill="#5865F2" d="M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83 97.68 97.68 0 0 0-29.09 0A72.37 72.37 0 0 0 45.64 0 105.89 105.89 0 0 0 19.39 8.09C2.79 32.65-1.72 56.6.54 80.2a105.73 105.73 0 0 0 32.17 16.16 77.7 77.7 0 0 0 6.89-11.3 68.42 68.42 0 0 1-10.84-5.18c.91-.66 1.8-1.34 2.66-2.04 20.87 9.53 43.53 9.53 64.16 0 .87.71 1.76 1.39 2.66 2.04a68.68 68.68 0 0 1-10.85 5.19 76.72 76.72 0 0 0 6.9 11.29A105.25 105.25 0 0 0 126.6 80.2c2.65-27.38-4.52-51.12-18.9-72.13zM42.45 65.69c-6.27 0-11.44-5.75-11.44-12.81S36.08 40 42.45 40s11.53 5.81 11.43 12.87c0 7.06-5.06 12.82-11.43 12.82zm42.24 0c-6.27 0-11.43-5.75-11.43-12.81S78.32 40 84.69 40s11.53 5.81 11.43 12.87c0 7.06-5.06 12.82-11.43 12.82z"/>
      </svg>
    );
  }

  if (brand === "notion") {
    return (
      <svg className="w-4 h-4" viewBox="0 0 100 100" aria-hidden="true">
        <path fill="#fff" d="M6.017 4.313l55.333-4.087c6.797-.583 8.543-.19 12.817 2.917l17.663 12.443c2.913 2.14 3.883 2.723 3.883 5.053v68.243c0 4.277-1.553 6.807-6.99 7.193L24.467 99.967c-4.08.193-6.023-.39-8.16-3.113L3.3 79.94c-2.333-3.113-3.3-5.443-3.3-8.167V11.113c0-3.497 1.553-6.413 6.017-6.8z"/>
        <path fill="#000" fillRule="evenodd" d="M61.35.227L6.017 4.313C1.553 4.7 0 7.617 0 11.113v60.66c0 2.723.967 5.053 3.3 8.167l12.81 16.913c2.137 2.723 4.08 3.307 8.16 3.113l64.257-3.89c5.433-.387 6.99-2.917 6.99-7.193V20.64c0-2.21-.873-2.847-3.443-4.733L74.167 3.143C69.893.033 68.147-.357 61.35.227zM25.5 19.22c-5.2.33-6.38.4-9.34-2.01L8.927 11.507c-.78-.78-.39-1.753 1.163-1.95l52.533-3.887c4.467-.387 6.8 1.167 8.54 2.527l9.123 6.61c.39.193 1.36 1.36.193 1.36l-54.2 3.24-.78-.19zM19.803 88.3V30.367c0-2.53.78-3.697 3.107-3.893l58.147-3.497c2.14-.193 3.107 1.167 3.107 3.693v57.547c0 2.53-.39 4.67-3.883 4.863l-55.727 3.31c-3.497.193-4.75-1.007-4.75-3.887zm54.943-54.627c.39 1.75 0 3.5-1.75 3.7l-2.723.53v42.767c-2.333 1.36-4.473 2.14-6.223 2.14-2.917 0-3.69-.973-5.83-3.503L38.437 46.66v30.637l5.637 1.167S44.073 82.93 39.6 82.93c-4.473 0-5.83-1.36-5.83-1.36S32.21 78.46 32.21 74.37V35.423c0-2.723 2.723-3.307 2.723-3.307 2.14-.773 5.247.97 6.61 2.72l21 33.167V37.753l-4.86-.583s-.39-3.887 3.5-3.887c2.53 0 4.277 1.167 4.277 1.167l.973-1.36c3.497-.387 5.053 1.753 5.437 4.667z"/>
      </svg>
    );
  }

  if (brand === "teams") {
    return (
      <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#5059C9" d="M20.625 6.75a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0z"/>
        <path fill="#5059C9" d="M22.5 10.5h-4.875a.375.375 0 0 0-.375.375v5.625a3.75 3.75 0 0 1-1.125 2.625A2.625 2.625 0 0 0 22.5 16.5v-6z"/>
        <path fill="#7B83EB" d="M15.375 6a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0z"/>
        <path fill="#7B83EB" d="M18 10.5H6a.75.75 0 0 0-.75.75V18a5.25 5.25 0 1 0 10.5 0h2.25a.75.75 0 0 0 .75-.75v-6a.75.75 0 0 0-.75-.75z"/>
        <path fill="#4B53BC" d="M12.375 10.5H5.25V18a5.25 5.25 0 0 0 7.125-4.875V10.5z" opacity=".1"/>
      </svg>
    );
  }

  if (brand === "google_chat") {
    return (
      <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#00AC47" d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0z"/>
        <path fill="#fff" d="M17 8h-4V6h4a2 2 0 0 1 2 2v4h-2V8zM7 16h4v2H7a2 2 0 0 1-2-2v-4h2v4zM7 6a1 1 0 0 0-1 1v3h2V8h3V6H7zm10 12a1 1 0 0 0 1-1v-3h-2v2h-3v2h4z"/>
      </svg>
    );
  }

  // Default: custom / generic 
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
    </svg>
  );
}

const INTEGRATION_PRESETS: IntegrationPreset[] = [
  {
    key: "slack",
    label: "Slack",
    hint: "Incoming Webhook URL",
    placeholder: "https://hooks.slack.com/services/...",
    docsUrl: "https://api.slack.com/messaging/webhooks",
    validator: (url) => /^https:\/\/hooks\.slack\.com\/services\//i.test(url),
    icon: <IntegrationBrandIcon brand="slack" />,
  },
  {
    key: "notion",
    label: "Notion",
    hint: "Notion automation webhook URL - no API key needed",
    placeholder: "https://api.notion.com/...",
    docsUrl: "https://www.notion.so/help/automations",
    validator: (url) => /^https:\/\/(api\.notion\.com|[\w-]+\.notion\.site)\//i.test(url),
    icon: <IntegrationBrandIcon brand="notion" />,
  },
  {
    key: "teams",
    label: "MS Teams",
    hint: "Incoming Webhook connector URL",
    placeholder: "https://outlook.webhook.office.com/...",
    docsUrl: "https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook",
    validator: (url) => /^https:\/\/([\w-]+\.webhook\.office\.com|[\w-]+\.logic\.azure\.com\/workflows\/)/i.test(url),
    icon: <IntegrationBrandIcon brand="teams" />,
  },
  {
    key: "google_chat",
    label: "Google Chat",
    hint: "Space webhook URL",
    placeholder: "https://chat.googleapis.com/v1/spaces/...",
    docsUrl: "https://developers.google.com/workspace/chat/quickstart/webhooks",
    validator: (url) => /^https:\/\/chat\.googleapis\.com\/v1\/spaces\//i.test(url),
    icon: <IntegrationBrandIcon brand="google_chat" />,
  },
  {
    key: "zapier",
    label: "Zapier",
    hint: "Catch Hook URL",
    placeholder: "https://hooks.zapier.com/hooks/catch/...",
    docsUrl: "https://zapier.com/apps/webhook/help",
    validator: (url) => /^https:\/\/hooks\.zapier\.com\/hooks\/catch\//i.test(url),
    icon: <IntegrationBrandIcon brand="zapier" />,
  },
  {
    key: "discord",
    label: "Discord",
    hint: "Channel Webhook URL",
    placeholder: "https://discord.com/api/webhooks/...",
    docsUrl: "https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks",
    validator: (url) => /^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\//i.test(url),
    icon: <IntegrationBrandIcon brand="discord" />,
  },
];

const PROVIDER_SETUP_STEPS: Record<IntegrationPreset["key"] | "custom", string[]> = {
  slack: [
    "Open your Slack workspace in a browser",
    "Go to Apps \u2192 search \"Incoming Webhooks\" \u2192 Add to Slack",
    "Choose a channel, then click \"Add Incoming Webhooks Integration\"",
    "Copy the Webhook URL and paste it below",
  ],
  notion: [
    "Open Notion \u2192 go to the page or database you want to connect",
    "Click \u22EF (menu) \u2192 Automations \u2192 New Automation",
    "Set trigger to \"When webhook received\" and copy the URL",
    "Paste the automation webhook URL below",
  ],
  teams: [
    "Open MS Teams \u2192 go to the channel you want notifications in",
    "Click \u22EF (More options) \u2192 Connectors \u2192 Incoming Webhook",
    "Name it (e.g. \"AiVIS\"), optionally add an icon, then click Create",
    "Copy the webhook URL and paste it below",
  ],
  google_chat: [
    "Open Google Chat \u2192 go to the Space you want notifications in",
    "Click the Space name \u2192 Apps & integrations \u2192 Add webhooks",
    "Name it (e.g. \"AiVIS Alerts\") and click Save",
    "Copy the webhook URL and paste it below",
  ],
  zapier: [
    "Create a new Zap in Zapier",
    "Choose \"Webhooks by Zapier\" as the trigger \u2192 select \"Catch Hook\"",
    "Copy the custom webhook URL Zapier provides",
    "Paste it below, then configure your Zap actions (email, Sheets, etc.)",
  ],
  discord: [
    "Open Discord \u2192 go to Server Settings \u2192 Integrations \u2192 Webhooks",
    "Click \"New Webhook\" and choose the channel for notifications",
    "Click \"Copy Webhook URL\"",
    "Paste the URL below",
  ],
  custom: [
    "Use any HTTPS endpoint that accepts POST requests",
    "AiVIS sends a signed JSON payload with an X-AiVIS-Signature header",
    "Paste your endpoint URL below",
  ],
};

function detectIntegration(url: string): IntegrationPreset["key"] | "custom" {
  if (/^https:\/\/hooks\.slack\.com\/services\//i.test(url)) return "slack";
  if (/^https:\/\/hooks\.zapier\.com\/hooks\/catch\//i.test(url)) return "zapier";
  if (/^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\//i.test(url)) return "discord";
  if (/^https:\/\/(api\.notion\.com|[\w-]+\.notion\.site)\//i.test(url)) return "notion";
  if (/^https:\/\/([\w-]+\.webhook\.office\.com|[\w-]+\.logic\.azure\.com\/workflows\/)/i.test(url)) return "teams";
  if (/^https:\/\/chat\.googleapis\.com\/v1\/spaces\//i.test(url)) return "google_chat";
  return "custom";
}

// ── Sub-components ───────────────────────────────────────────────────────────

const SectionCard: React.FC<{
  icon: React.ElementType;
  title: string;
  badge?: string;
  counter?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}> = ({ icon: Icon, title, badge, counter, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-white/10 bg-charcoal-light dark:bg-charcoal overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-charcoal dark:hover:bg-charcoal-deep transition-colors"
      >
        <Icon className="w-5 h-5 text-white/60" />
        <span className="flex-1 text-left text-sm font-medium text-white">{title}</span>
        {counter}
        {badge && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-gradient-to-r from-white/22 to-white/14 text-white/80 font-semibold ring-1 ring-white/30">
            {badge}
          </span>
        )}
        <svg
          className={`w-4 h-4 text-white/50 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  );
};

function TeamsFocusFrameworkPanel() {
  const pillars = [
    {
      title: "Focus",
      detail: "Choose one primary KPI per cycle (coverage, citation rate, or score delta).",
    },
    {
      title: "Flow",
      detail: "Run weekly audits + alerts so every role sees the same evidence quickly.",
    },
    {
      title: "Feedback",
      detail: "Convert failed checks into assigned tasks with owners and due dates.",
    },
    {
      title: "Forward",
      detail: "Review trend movement every 2 weeks and tighten next sprint scope.",
    },
  ];

  return (
    <div className="space-y-3">
      <div className="p-3 rounded-lg bg-charcoal-deep border border-white/8">
        <p className="text-xs text-white/60 leading-relaxed">
          Operating model for cross-functional teams shipping AI-visibility improvements with clear ownership,
          measurable outcomes, and fast iteration loops.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {pillars.map((pillar) => (
          <div key={pillar.title} className="rounded-lg border border-white/8 bg-charcoal-deep px-3 py-2.5">
            <p className="text-sm font-semibold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-white/70" />
              {pillar.title}
            </p>
            <p className="text-xs text-white/55 mt-1 leading-relaxed">{pillar.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEDULED RESCANS
// ═══════════════════════════════════════════════════════════════════════════════

function ScheduledRescansPanel() {
  const token = useAuthStore((s) => s.token);
  const limits = useTierLimits();
  const [rescans, setRescans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState("");
  const allowedFreqs = limits.allowedRescanFrequencies as readonly string[];
  const [freq, setFreq] = useState(allowedFreqs[0] || "weekly");
  const atCap = rescans.length >= limits.maxScheduledRescans;

  const load = useCallback(async () => {
    try {
      const data = await apiFetch("/api/features/scheduled-rescans", token);
      setRescans(data.data || []);
    } catch {
      /* empty */
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!url.trim()) return;
    try {
      await apiFetch("/api/features/scheduled-rescans", token, {
        method: "POST",
        body: JSON.stringify({ url: url.trim(), frequency: freq }),
      });
      setUrl("");
      toast.success("Scheduled rescan created");
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/api/features/scheduled-rescans/${id}`, token, { method: "DELETE" });
      toast.success("Rescan deleted");
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await apiFetch(`/api/features/scheduled-rescans/${id}`, token, {
        method: "PATCH",
        body: JSON.stringify({ enabled: !enabled }),
      });
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (loading) return <Loader2 className="w-4 h-4 animate-spin text-white/50 mx-auto" />;

  return (
    <div className="space-y-3">
      {/* Add form */}
      <div className="flex gap-2">
        <input
          type="url"
          placeholder="https://example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && url.trim() && !atCap && handleAdd()}
          enterKeyHint="done"
          className={`flex-1 text-sm px-3 py-2 rounded-lg ${appInputSurfaceClass}`}
        />
        <select
          value={freq}
          onChange={(e) => setFreq(e.target.value)}
          className={`text-sm px-2 py-2 rounded-lg text-white/80 ${appSelectSurfaceClass}`}
        >
          {allowedFreqs.includes("daily") && <option value="daily">Daily</option>}
          {allowedFreqs.includes("weekly") && <option value="weekly">Weekly</option>}
          {allowedFreqs.includes("biweekly") && <option value="biweekly">Biweekly</option>}
          {allowedFreqs.includes("monthly") && <option value="monthly">Monthly</option>}
        </select>
        <button
          onClick={handleAdd}
          disabled={atCap}
          title={atCap ? `Limit: ${limits.maxScheduledRescans} on your plan` : "Add scheduled rescan"}
          className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {atCap && (
        <p className="text-xs text-amber-400/80">Plan limit reached ({limits.maxScheduledRescans} scheduled rescans). Upgrade for more.</p>
      )}

      {/* List */}
      {rescans.length === 0 && (
        <p className="text-xs text-white/50 text-center py-2">No scheduled rescans yet</p>
      )}
      {rescans.map((r) => (
        <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg bg-charcoal-deep border border-white/8">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white truncate">{r.url}</p>
            <p className="text-xs text-white/50">
              {r.frequency} &bull; Next: {r.next_run_at ? new Date(r.next_run_at).toLocaleDateString() : "N/A"}
              {r.last_run_at && <> &bull; Last: {new Date(r.last_run_at).toLocaleDateString()}</>}
            </p>
          </div>
          <button
            onClick={() => handleToggle(r.id, r.enabled)}
            className={`p-1 rounded ${r.enabled ? "text-green-400" : "text-white/40"}`}
            title={r.enabled ? "Disable" : "Enable"}
          >
            {r.enabled ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
          </button>
          <button
            onClick={() => handleDelete(r.id)}
            className="p-1 rounded text-white/40 hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

function ThirdPartyIntegrationsPanel() {
  const token = useAuthStore((s) => s.token);
  const limits = useTierLimits();
  const [hooks, setHooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<IntegrationPreset["key"] | "custom" | null>(null);
  const [url, setUrl] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem("aivis_active_workspace_id") || "";
  });

  const preset = selected && selected !== "custom"
    ? INTEGRATION_PRESETS.find((item) => item.key === selected) || null
    : null;

  const integrationFetch = useCallback(
    async (path: string, opts: RequestInit = {}) => {
      const headers: Record<string, string> = {
        ...authHeaders(token),
        ...(opts.headers as Record<string, string> | undefined),
      };
      if (selectedWorkspaceId) {
        headers["X-Workspace-Id"] = selectedWorkspaceId;
      }

      const res = await fetch(apiUrl(path), {
        ...opts,
        headers,
        credentials: "include",
      });

      const resolvedWorkspace = res.headers.get("x-workspace-id");
      if (resolvedWorkspace && resolvedWorkspace !== selectedWorkspaceId) {
        setSelectedWorkspaceId(resolvedWorkspace);
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      return data;
    },
    [token, selectedWorkspaceId]
  );

  const loadWorkspaces = useCallback(async () => {
    try {
      const data = await integrationFetch("/api/workspaces");
      const rows = Array.isArray(data?.data) ? data.data : [];
      const options: WorkspaceOption[] = rows.map((row: any) => ({
        workspaceId: String(row.workspaceId),
        workspaceName: String(row.workspaceName || "Workspace"),
        organizationName: String(row.organizationName || "Organization"),
        role: row.role,
      }));
      setWorkspaces(options);

      if (!selectedWorkspaceId && options[0]?.workspaceId) {
        setSelectedWorkspaceId(options[0].workspaceId);
      }
    } catch {
      setWorkspaces([]);
    }
  }, [integrationFetch, selectedWorkspaceId]);

  const load = useCallback(async () => {
    try {
      const data = await integrationFetch("/api/features/webhooks");
      setHooks(data.data || []);
    } catch {
      setHooks([]);
    } finally {
      setLoading(false);
    }
  }, [integrationFetch]);

  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  useEffect(() => {
    if (selectedWorkspaceId && typeof window !== "undefined") {
      window.localStorage.setItem("aivis_active_workspace_id", selectedWorkspaceId);
    }
    load();
  }, [load, selectedWorkspaceId]);

  const handleAdd = async () => {
    const value = url.trim();
    if (!value) return;

    // For known providers, validate URL format
    if (preset && !preset.validator(value)) {
      toast.error(`That doesn\u2019t look like a valid ${preset.label} webhook URL. Check the URL and try again.`);
      return;
    }

    // For custom webhooks, just require https
    if (selected === "custom" && !/^https:\/\/.+/i.test(value)) {
      toast.error("Custom webhooks require an HTTPS URL");
      return;
    }

    try {
      await integrationFetch("/api/features/webhooks", {
        method: "POST",
        body: JSON.stringify({
          url: value,
          events: ["audit.completed", "audit.failed", "score.changed"],
        }),
      });
      setUrl("");
      const label = preset?.label || "Custom webhook";
      toast.success(`${label} connected successfully!`);
      setSelected(null);
      setShowCustom(false);
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await integrationFetch(`/api/features/webhooks/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: !enabled }),
      });
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await integrationFetch(`/api/features/webhooks/${id}`, { method: "DELETE" });
      toast.success("Integration removed");
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    try {
      await integrationFetch(`/api/features/webhooks/${id}/test`, { method: "POST" });
      toast.success("Test event sent - check your destination!");
      load();
    } catch (err: any) {
      toast.error(err.message || "Failed to send test event");
    } finally {
      setTestingId(null);
    }
  };

  const webhookAtCap = hooks.length >= limits.maxWebhooks;

  if (loading) return <Loader2 className="w-4 h-4 animate-spin text-white/50 mx-auto" />;

  const setupSteps = selected ? PROVIDER_SETUP_STEPS[selected] || [] : [];

  return (
    <div className="space-y-4">
      {/* Workspace selector - compact, only shown if user has multiple */}
      {workspaces.length > 1 && (
        <div>
          <label className="text-xs text-white/50 mb-1 block">Workspace</label>
          <select
            value={selectedWorkspaceId}
            onChange={(e) => setSelectedWorkspaceId(e.target.value)}
            className={`w-full text-sm px-3 py-1.5 rounded-lg bg-charcoal-deep ${appSelectSurfaceClass}`}
          >
            {workspaces.map((workspace) => (
              <option key={workspace.workspaceId} value={workspace.workspaceId}>
                {workspace.workspaceName} · {workspace.organizationName}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Connected integrations */}
      {hooks.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-white/70 uppercase tracking-wider">Connected</p>
          {hooks.map((hook) => {
            const integration = detectIntegration(String(hook.url || ""));
            const presetItem = INTEGRATION_PRESETS.find((item) => item.key === integration);
            const label = presetItem ? presetItem.label : "Custom Webhook";
            return (
              <div key={hook.id} className="flex items-center gap-3 p-3 rounded-lg bg-charcoal-deep border border-white/8">
                {presetItem ? presetItem.icon : <Webhook className="w-4 h-4 text-white/40 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white flex items-center gap-2">
                    {label}
                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${hook.enabled ? "bg-green-400" : "bg-white/30"}`} />
                  </p>
                  <p className="text-xs text-white/40 truncate">{hook.url}</p>
                  {hook.failure_count > 0 && (
                    <p className="text-xs text-red-400">{hook.failure_count} delivery failures</p>
                  )}
                </div>
                <button
                  onClick={() => handleTest(hook.id)}
                  className="px-2.5 py-1 rounded text-[11px] bg-white/10 hover:bg-white/20 text-white/80 transition-colors disabled:opacity-60"
                  type="button"
                  disabled={testingId === hook.id}
                  title="Send a test event to verify it works"
                >
                  {testingId === hook.id ? "Sending..." : "Test"}
                </button>
                <button
                  onClick={() => handleToggle(hook.id, hook.enabled)}
                  className={`p-1 rounded ${hook.enabled ? "text-green-400" : "text-white/40"}`}
                  type="button"
                  title={hook.enabled ? "Pause this integration" : "Resume this integration"}
                >
                  {hook.enabled ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                </button>
                <button
                  onClick={() => handleDelete(hook.id)}
                  className="p-1 rounded text-white/40 hover:text-red-400 transition-colors"
                  type="button"
                  title="Remove this integration"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Cap warning */}
      {webhookAtCap && (
        <p className="text-xs text-amber-400/80 flex items-center gap-1.5">
          <AlertCircle className="w-3 h-3 shrink-0" />
          Webhook limit reached ({hooks.length}/{limits.maxWebhooks}). Upgrade your plan for more.
        </p>
      )}

      {/* Add new integration flow */}
      {!webhookAtCap && (
        <div className="space-y-3">
          {/* Step 1: Choose a service */}
          <div>
            <p className="text-xs font-medium text-white/70 mb-2">
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-white/10 text-[10px] text-white/80 mr-1.5">1</span>
              Choose a service to connect
            </p>
            <div className="flex flex-wrap gap-2">
              {INTEGRATION_PRESETS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => { setSelected(item.key); setShowCustom(false); setUrl(""); }}
                  className={`px-3 py-2 rounded-lg text-xs border transition-all ${
                    selected === item.key
                      ? "bg-white/14 border-white/30 text-white ring-1 ring-white/20"
                      : "bg-charcoal-deep border-white/10 text-white/60 hover:text-white hover:border-white/20"
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {item.icon}
                    {item.label}
                  </span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => { setSelected("custom"); setShowCustom(true); setUrl(""); }}
                className={`px-3 py-2 rounded-lg text-xs border transition-all ${
                  showCustom
                    ? "bg-white/14 border-white/30 text-white ring-1 ring-white/20"
                    : "bg-charcoal-deep border-white/10 text-white/60 hover:text-white hover:border-white/20"
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <IntegrationBrandIcon brand="custom" />
                  Custom URL
                </span>
              </button>
            </div>
          </div>

          {/* Step 2: Setup instructions - shown when a provider is selected */}
          {selected && setupSteps.length > 0 && (
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <p className="text-xs font-medium text-white/70 mb-2">
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-white/10 text-[10px] text-white/80 mr-1.5">2</span>
                Get your {preset?.label || "webhook"} URL
              </p>
              <ol className="space-y-1.5 ml-6">
                {setupSteps.map((step, i) => (
                  <li key={i} className="text-xs text-white/60 list-decimal">
                    {step}
                  </li>
                ))}
              </ol>
              {preset?.docsUrl && (
                <a
                  href={preset.docsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 mt-2 ml-6"
                >
                  Open {preset.label} docs &rarr;
                </a>
              )}
            </div>
          )}

          {/* Step 3: Paste URL - shown when a provider is selected */}
          {selected && (
            <div>
              <p className="text-xs font-medium text-white/70 mb-2">
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-white/10 text-[10px] text-white/80 mr-1.5">3</span>
                Paste the webhook URL
              </p>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder={preset?.placeholder || "https://your-server.com/webhook"}
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && url.trim() && handleAdd()}
                  className={`flex-1 text-sm px-3 py-2 rounded-lg ${appInputSurfaceClass}`}
                  autoFocus
                />
                <button
                  onClick={handleAdd}
                  disabled={!url.trim()}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  type="button"
                >
                  Connect
                </button>
              </div>
              {selected !== "custom" && (
                <p className="text-[11px] text-white/40 mt-1.5">
                  {preset?.hint}
                </p>
              )}
              {selected === "custom" && (
                <p className="text-[11px] text-white/40 mt-1.5">
                  Receives <code className="text-white/60">POST</code> with <code className="text-white/60">X-AiVIS-Signature</code> HMAC header on audit events.
                </p>
              )}
            </div>
          )}

          {/* Empty state - no provider selected and no hooks */}
          {!selected && hooks.length === 0 && (
            <div className="text-center py-4 px-3 rounded-lg border border-dashed border-white/10">
              <MessageSquare className="w-5 h-5 text-white/30 mx-auto mb-2" />
              <p className="text-xs text-white/50">
                Get notified when audits complete. Select a service above to connect it in under a minute.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Event info footer */}
      <p className="text-[11px] text-white/35 border-t border-white/5 pt-3">
        Triggers on: audit completed, audit failed, score changed, competitor updated, citation completed, rescan events.{" "}
        All payloads are HMAC-signed for security.
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// API KEYS
// ═══════════════════════════════════════════════════════════════════════════════

function ApiKeysPanel() {
  const token = useAuthStore((s) => s.token);
  const limits = useTierLimits();
  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const atCap = keys.length >= limits.maxApiKeys;

  const load = useCallback(async () => {
    try {
      const data = await apiFetch("/api/features/api-keys", token);
      setKeys(data.data || []);
    } catch {
      /* empty */
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    try {
      const data = await apiFetch("/api/features/api-keys", token, {
        method: "POST",
        body: JSON.stringify({ name: newKeyName || "Default" }),
      });
      setNewKey(data.data.plaintext_key);
      setNewKeyName("");
      toast.success("API key created. Copy it now, it won't be shown again!");
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm("Revoke this API key? This cannot be undone.")) return;
    try {
      await apiFetch(`/api/features/api-keys/${id}`, token, { method: "DELETE" });
      toast.success("API key revoked");
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const copyKey = () => {
    if (newKey) {
      navigator.clipboard.writeText(newKey);
      toast.success("Copied to clipboard");
    }
  };

  if (loading) return <Loader2 className="w-4 h-4 animate-spin text-white/50 mx-auto" />;

  return (
    <div className="space-y-3">
      {/* New key reveal */}
      {newKey && (
        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
          <p className="text-xs text-green-400 mb-2 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Copy your key now, it won't be shown again
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs text-white/90 bg-charcoal-deep px-2 py-1 rounded font-mono overflow-x-auto">
              {showKey ? newKey : `${newKey.slice(0, 12)}${"•".repeat(40)}`}
            </code>
            <button onClick={() => setShowKey(!showKey)} className="text-white/50 hover:text-white/80">
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            <button onClick={copyKey} className="text-white/50 hover:text-white/80">
              <Copy className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => setNewKey(null)}
            className="text-xs text-white/50 mt-2 hover:text-white/80"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Create form */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Key name (e.g. Production)"
          value={newKeyName}
          onChange={(e) => setNewKeyName(e.target.value)}
          className={`flex-1 text-sm px-3 py-2 rounded-lg ${appInputSurfaceClass}`}
        />
        <button
          onClick={handleCreate}
          disabled={atCap}
          title={atCap ? `Limit: ${limits.maxApiKeys} keys on your plan` : "Generate API key"}
          className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Key className="w-4 h-4" /> Generate
        </button>
      </div>

      {atCap && (
        <p className="text-xs text-amber-400/80">Plan limit reached ({limits.maxApiKeys} API keys). Upgrade for more.</p>
      )}

      <p className="text-xs text-white/50">
        Use: <code className="text-white/70">Authorization: Bearer avis_xxx</code> with <code className="text-white/70">GET /api/v1/audits</code>
      </p>

      {/* Existing keys */}
      {keys.length === 0 && !newKey && (
        <p className="text-xs text-white/50 text-center py-2">No API keys yet</p>
      )}
      {keys.map((k) => (
        <div key={k.id} className="flex items-center gap-3 p-3 rounded-lg bg-charcoal-deep border border-white/8">
          <Key className="w-4 h-4 text-white/40 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white">{k.name}</p>
            <p className="text-xs text-white/50 font-mono">
              {k.key_prefix}•••••
              {k.last_used_at && <> &bull; Last used: {new Date(k.last_used_at).toLocaleDateString()}</>}
            </p>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full ${k.enabled ? "bg-green-500/20 text-green-400" : "bg-white/10 text-white/50"}`}>
            {k.enabled ? "Active" : "Disabled"}
          </span>
          <button
            onClick={() => handleRevoke(k.id)}
            className="p-1 rounded text-white/40 hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// WEBHOOKS
// ═══════════════════════════════════════════════════════════════════════════════

function WebhooksPanel() {
  const token = useAuthStore((s) => s.token);
  const limits = useTierLimits();
  const [hooks, setHooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState("");
  const atCap = hooks.length >= limits.maxWebhooks;

  const load = useCallback(async () => {
    try {
      const data = await apiFetch("/api/features/webhooks", token);
      setHooks(data.data || []);
    } catch {
      /* empty */
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!url.trim()) return;
    try {
      const data = await apiFetch("/api/features/webhooks", token, {
        method: "POST",
        body: JSON.stringify({ url: url.trim(), events: ["audit.completed"] }),
      });
      setUrl("");
      toast.success(`Webhook created. Secret: ${data.data.secret}`);
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/api/features/webhooks/${id}`, token, { method: "DELETE" });
      toast.success("Webhook deleted");
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await apiFetch(`/api/features/webhooks/${id}`, token, {
        method: "PATCH",
        body: JSON.stringify({ enabled: !enabled }),
      });
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (loading) return <Loader2 className="w-4 h-4 animate-spin text-white/50 mx-auto" />;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="url"
          placeholder="https://your-server.com/webhook"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && url.trim() && !atCap && handleAdd()}
          enterKeyHint="done"
          className={`flex-1 text-sm px-3 py-2 rounded-lg ${appInputSurfaceClass}`}
        />
        <button
          onClick={handleAdd}
          disabled={atCap}
          title={atCap ? `Limit: ${limits.maxWebhooks} webhooks on your plan` : "Add webhook"}
          className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <p className="text-xs text-white/50">
        Receives <code className="text-white/70">POST</code> with <code className="text-white/70">X-AiVIS-Signature</code> header on <code className="text-white/70">audit.completed</code> events.
      </p>

      {atCap && (
        <p className="text-xs text-amber-400/80">Plan limit reached ({limits.maxWebhooks} webhooks). Upgrade for more.</p>
      )}

      {hooks.length === 0 && (
        <p className="text-xs text-white/50 text-center py-2">No webhooks configured</p>
      )}
      {hooks.map((h) => (
        <div key={h.id} className="flex items-center gap-3 p-3 rounded-lg bg-charcoal-deep border border-white/8">
          <Webhook className="w-4 h-4 text-white/40 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white truncate">{h.url}</p>
            <p className="text-xs text-white/50">
              Events: {h.events?.join(", ")}
              {h.failure_count > 0 && <span className="text-red-400"> &bull; {h.failure_count} failures</span>}
              {h.last_triggered_at && <> &bull; Last: {new Date(h.last_triggered_at).toLocaleDateString()}</>}
            </p>
          </div>
          <button
            onClick={() => handleToggle(h.id, h.enabled)}
            className={`p-1 rounded ${h.enabled ? "text-green-400" : "text-white/40"}`}
          >
            {h.enabled ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
          </button>
          <button
            onClick={() => handleDelete(h.id)}
            className="p-1 rounded text-white/40 hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

function ReportDeliveryPanel() {
  const token = useAuthStore((s) => s.token);
  const limits = useTierLimits();
  const [targets, setTargets] = useState<ReportDeliveryTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState<ReportDeliveryProvider>("email");
  const [target, setTarget] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [branded, setBranded] = useState(true);
  const [includePdf, setIncludePdf] = useState(true);
  const [includeShareLink, setIncludeShareLink] = useState(true);
  const atCap = targets.length >= limits.maxReportDeliveries;

  const placeholders: Record<ReportDeliveryProvider, string> = {
    email: "client@company.com",
    generic: "https://your-server.com/report-delivery",
    slack: "https://hooks.slack.com/services/...",
    discord: "https://discord.com/api/webhooks/...",
    zapier: "https://hooks.zapier.com/hooks/catch/...",
    notion: "https://api.notion.com/v1/...",
    teams: "https://outlook.office.com/webhook/...",
    google_chat: "https://chat.googleapis.com/v1/spaces/...",
  };

  const load = useCallback(async () => {
    try {
      const data = await apiFetch("/api/features/report-deliveries", token);
      setTargets(data.data || []);
    } catch {
      setTargets([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!target.trim()) return;
    try {
      await apiFetch("/api/features/report-deliveries", token, {
        method: "POST",
        body: JSON.stringify({
          provider,
          target: target.trim(),
          displayName: displayName.trim() || undefined,
          branded,
          includePdf,
          includeShareLink,
        }),
      });
      setTarget("");
      setDisplayName("");
      toast.success("Automatic report delivery added");
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await apiFetch(`/api/features/report-deliveries/${id}`, token, {
        method: "PATCH",
        body: JSON.stringify({ enabled: !enabled }),
      });
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/api/features/report-deliveries/${id}`, token, { method: "DELETE" });
      toast.success("Automatic delivery removed");
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (loading) return <Loader2 className="w-4 h-4 animate-spin text-white/50 mx-auto" />;

  return (
    <div className="space-y-3">
      <div className="rounded-lg bg-charcoal-deep border border-white/8 p-3 text-xs text-white/60 leading-relaxed">
        When an audit completes, AiVIS can render a PDF and deliver it automatically. Email receives the PDF attachment. Slack, Discord, Zapier, and generic webhooks receive a summary plus public report link when available.
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value as ReportDeliveryProvider)}
          className={`text-sm px-3 py-2 rounded-lg text-white/80 ${appSelectSurfaceClass}`}
        >
          <option value="email">Email</option>
          <option value="slack">Slack</option>
          <option value="discord">Discord</option>
          <option value="zapier">Zapier</option>
          <option value="generic">Generic Webhook</option>
        </select>
        <input
          type="text"
          placeholder="Optional label"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className={`text-sm px-3 py-2 rounded-lg ${appInputSurfaceClass}`}
        />
      </div>

      <div className="flex gap-2">
        <input
          type={provider === "email" ? "email" : "url"}
          placeholder={placeholders[provider]}
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className={`flex-1 text-sm px-3 py-2 rounded-lg ${appInputSurfaceClass}`}
        />
        <button
          onClick={handleAdd}
          disabled={atCap}
          title={atCap ? `Limit: ${limits.maxReportDeliveries} targets on your plan` : "Add delivery target"}
          className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          type="button"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {atCap && (
        <p className="text-xs text-amber-400/80">Plan limit reached ({limits.maxReportDeliveries} delivery targets). Upgrade for more.</p>
      )}

      <div className="grid gap-2 md:grid-cols-3 text-xs text-white/70">
        <label className="flex items-center gap-2 rounded-lg border border-white/8 bg-charcoal-deep px-3 py-2">
          <input type="checkbox" checked={branded} onChange={(e) => setBranded(e.target.checked)} />
          Branded PDF when available
        </label>
        <label className="flex items-center gap-2 rounded-lg border border-white/8 bg-charcoal-deep px-3 py-2">
          <input type="checkbox" checked={includePdf} onChange={(e) => setIncludePdf(e.target.checked)} />
          Include PDF delivery
        </label>
        <label className="flex items-center gap-2 rounded-lg border border-white/8 bg-charcoal-deep px-3 py-2">
          <input type="checkbox" checked={includeShareLink} onChange={(e) => setIncludeShareLink(e.target.checked)} />
          Include public report link
        </label>
      </div>

      {targets.length === 0 && (
        <p className="text-xs text-white/50 text-center py-2">No automatic report deliveries configured</p>
      )}

      {targets.map((delivery) => (
        <div key={delivery.id} className="flex items-center gap-3 p-3 rounded-lg bg-charcoal-deep border border-white/8">
          {delivery.provider === "email" ? <Mail className="w-4 h-4 text-white/40 shrink-0" /> : <FileText className="w-4 h-4 text-white/40 shrink-0" />}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white">
              {delivery.display_name || delivery.provider.charAt(0).toUpperCase() + delivery.provider.slice(1)}
            </p>
            <p className="text-xs text-white/50 truncate">{delivery.target}</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/60">{delivery.include_pdf ? "PDF" : "No PDF"}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/60">{delivery.include_share_link ? "Share link" : "No share link"}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/60">{delivery.branded ? "Branded" : "Standard"}</span>
              {delivery.last_triggered_at && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/50">
                  Last sent {new Date(delivery.last_triggered_at).toLocaleDateString()}
                </span>
              )}
              {delivery.failure_count > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-300">
                  {delivery.failure_count} failures
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => handleToggle(delivery.id, delivery.enabled)}
            className={`p-1 rounded ${delivery.enabled ? "text-green-400" : "text-white/40"}`}
            type="button"
          >
            {delivery.enabled ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
          </button>
          <button
            onClick={() => handleDelete(delivery.id)}
            className="p-1 rounded text-white/40 hover:text-red-400 transition-colors"
            type="button"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// WHITE-LABEL BRANDING
// ═══════════════════════════════════════════════════════════════════════════════

function BrandingPanel() {
  const token = useAuthStore((s) => s.token);
  const [branding, setBranding] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [tagline, setTagline] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [showCoverPage, setShowCoverPage] = useState(false);
  const [primaryColor, setPrimaryColor] = useState("#0ea5e9");
  const [accentColor, setAccentColor] = useState("#6366f1");
  const [footerText, setFooterText] = useState("");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch("/api/features/branding", token);
      const b = data.data;
      if (b) {
        setBranding(b);
        setCompanyName(b.company_name || "");
        setTagline(b.tagline || "");
        setContactEmail(b.contact_email || "");
        setWebsiteUrl(b.website_url || "");
        setShowCoverPage(b.show_cover_page || false);
        setPrimaryColor(b.primary_color || "#0ea5e9");
        setAccentColor(b.accent_color || "#6366f1");
        setFooterText(b.footer_text || "");
        if (b.logo_base64) setLogoPreview(b.logo_base64);
        else if (b.logo_url) setLogoPreview(b.logo_url);
      }
    } catch {
      /* empty */
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      toast.error("Logo must be under 500KB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setLogoPreview(result);
      setLogoBase64(result);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiFetch("/api/features/branding", token, {
        method: "PUT",
        body: JSON.stringify({
          company_name: companyName || null,
          logo_base64: logoBase64 || undefined,
          primary_color: primaryColor,
          accent_color: accentColor,
          footer_text: footerText || null,
          tagline: tagline || null,
          contact_email: contactEmail || null,
          website_url: websiteUrl || null,
          show_cover_page: showCoverPage,
        }),
      });
      toast.success("Branding saved");
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader2 className="w-4 h-4 animate-spin text-white/50 mx-auto" />;

  return (
    <div className="space-y-4">
      {/* Logo upload */}
      <div>
        <label className="block text-xs text-white/60 mb-1.5">Company Logo</label>
        <div className="flex items-center gap-4">
          {logoPreview ? (
            <img src={logoPreview} alt="Company logo preview" className="h-12 w-auto rounded-lg border border-white/10 object-contain bg-white/5 px-2" />
          ) : (
            <div className="h-12 w-12 rounded-lg border border-white/10 bg-charcoal-deep flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white/30" />
            </div>
          )}
          <label className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium cursor-pointer transition-colors flex items-center gap-1">
            <Upload className="w-3 h-3" /> Upload
            <input type="file" accept="image/png,image/jpeg,image/svg+xml" onChange={handleLogoUpload} className="hidden" />
          </label>
          {logoPreview && (
            <button onClick={() => { setLogoPreview(null); setLogoBase64(null); }} className="text-xs text-red-400 hover:text-red-300 transition-colors">Remove</button>
          )}
        </div>
      </div>

      {/* Company name + tagline */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-white/60 mb-1.5">Company Name</label>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Your Company"
            className={`w-full text-sm px-3 py-2 rounded-lg bg-charcoal/70 ${appInputSurfaceClass}`}
          />
        </div>
        <div>
          <label className="block text-xs text-white/60 mb-1.5">Tagline <span className="text-white/30">(optional)</span></label>
          <input
            type="text"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="AI Visibility Intelligence"
            className={`w-full text-sm px-3 py-2 rounded-lg bg-charcoal/70 ${appInputSurfaceClass}`}
          />
        </div>
      </div>

      {/* Contact details (optional) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-white/60 mb-1.5">Contact Email <span className="text-white/30">(optional)</span></label>
          <input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="reports@yourcompany.com"
            className={`w-full text-sm px-3 py-2 rounded-lg bg-charcoal/70 ${appInputSurfaceClass}`}
          />
        </div>
        <div>
          <label className="block text-xs text-white/60 mb-1.5">Website URL <span className="text-white/30">(optional)</span></label>
          <input
            type="url"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="https://yourcompany.com"
            className={`w-full text-sm px-3 py-2 rounded-lg bg-charcoal/70 ${appInputSurfaceClass}`}
          />
        </div>
      </div>

      {/* Colors */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-white/60 mb-1.5">Primary Color</label>
          <div className="flex items-center gap-2">
            <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-8 h-8 rounded border-0 cursor-pointer" />
            <span className="text-xs text-white/70 font-mono">{primaryColor}</span>
          </div>
        </div>
        <div>
          <label className="block text-xs text-white/60 mb-1.5">Accent Color</label>
          <div className="flex items-center gap-2">
            <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="w-8 h-8 rounded border-0 cursor-pointer" />
            <span className="text-xs text-white/70 font-mono">{accentColor}</span>
          </div>
        </div>
      </div>

      {/* Footer text */}
      <div>
        <label className="block text-xs text-white/60 mb-1.5">Report Footer Text</label>
        <input
          type="text"
          value={footerText}
          onChange={(e) => setFooterText(e.target.value)}
          placeholder="Generated by Your Company"
          className={`w-full text-sm px-3 py-2 rounded-lg bg-charcoal/70 ${appInputSurfaceClass}`}
        />
      </div>

      {/* Cover page toggle */}
      <div className="flex items-center justify-between p-3 rounded-lg border border-white/10 bg-white/[0.03]">
        <div>
          <p className="text-sm text-white font-medium">Include Cover Page</p>
          <p className="text-xs text-white/50">Add a branded cover page with logo, company details, and report metadata to exported PDFs</p>
        </div>
        <button
          onClick={() => setShowCoverPage(!showCoverPage)}
          className={`relative w-10 h-5 rounded-full transition-colors ${showCoverPage ? "bg-sky-500" : "bg-white/20"}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${showCoverPage ? "translate-x-5" : ""}`} />
        </button>
      </div>

      {/* Preview */}
      <div className="rounded-lg border border-white/10 overflow-hidden" style={{ background: `linear-gradient(135deg, ${primaryColor}12, ${accentColor}12)` }}>
        <p className="text-xs text-white/50 px-3 pt-2">PDF Header Preview:</p>
        <div className="flex items-center gap-3 px-3 py-3" style={{ borderLeft: `3px solid ${primaryColor}` }}>
          {logoPreview && <img src={logoPreview} alt="Company logo preview" className="h-8 w-auto object-contain" />}
          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold text-white block truncate">{companyName || "Company Name"}</span>
            {tagline && <span className="text-[10px] text-white/50 block truncate">{tagline}</span>}
          </div>
          {(contactEmail || websiteUrl) && (
            <div className="text-right shrink-0 hidden sm:block">
              {contactEmail && <p className="text-[10px] text-white/40 truncate">{contactEmail}</p>}
              {websiteUrl && <p className="text-[10px] text-white/40 truncate">{websiteUrl}</p>}
            </div>
          )}
        </div>
        {footerText && (
          <div className="border-t border-white/5 px-3 py-1.5">
            <p className="text-[10px] text-white/30 text-center">{footerText}</p>
          </div>
        )}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full px-4 py-2.5 rounded-lg text-white text-sm font-medium transition-all flex items-center justify-center gap-2 hover:scale-[1.01]"
        style={{
          background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})`,
          opacity: saving ? 0.6 : 1,
        }}
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
        Save Branding
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PANEL
// ═══════════════════════════════════════════════════════════════════════════════

const AdvancedFeaturesPanel: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const hasAdvancedAccess = meetsMinimumTier((user?.tier as any) || "observer", "alignment");
  const hasSignalAccess = meetsMinimumTier((user?.tier as any) || "observer", "signal");
  const [featureCounts, setFeatureCounts] = useState<{
    rescans: { used: number; max: number };
    apiKeys: { used: number; max: number };
    webhooks: { used: number; max: number };
    reportDeliveries: { used: number; max: number };
  } | null>(null);

  useEffect(() => {
    if (!hasAdvancedAccess) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/api/features/status", token);
        if (cancelled) return;
        const f = res?.data?.features;
        if (f) {
          setFeatureCounts({
            rescans: { used: f.scheduledRescans?.count ?? 0, max: f.scheduledRescans?.max ?? 0 },
            apiKeys: { used: f.apiAccess?.keyCount ?? 0, max: f.apiAccess?.maxKeys ?? 0 },
            webhooks: { used: f.webhooks?.count ?? 0, max: f.webhooks?.max ?? 0 },
            reportDeliveries: { used: f.reportDeliveries?.count ?? 0, max: f.reportDeliveries?.max ?? 0 },
          });
        }
      } catch { /* status fetch is non-critical */ }
    })();
    return () => { cancelled = true; };
  }, [hasAdvancedAccess, token]);

  if (!hasAdvancedAccess) {
    return (
      <div className="space-y-4">
        <SectionCard icon={Workflow} title="Teams Focus Framework" defaultOpen>
          <TeamsFocusFrameworkPanel />
        </SectionCard>

        <div className="p-4 rounded-xl bg-gradient-to-r from-white/25 to-white/14 border border-white/12 mb-2">
          <p className="text-sm text-white/80 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>
              Advanced features require <strong>Alignment</strong> or higher. Upgrade to access API keys,
              webhooks, scheduled rescans, integrations, and more.
            </span>
          </p>
        </div>
        {[
          { icon: Calendar, title: "Scheduled Rescans", desc: "Automated monthly audits (daily with Signal+)", tier: "Alignment+" },
          { icon: Key, title: "API Keys", desc: "Read-only API access to audit data", tier: "Alignment+" },
          { icon: LinkIcon, title: "Webhooks", desc: "POST notifications on audit completion", tier: "Alignment+" },
          { icon: MessageSquare, title: "Integrations", desc: "Notion, Slack, Teams, Google Chat, Zapier & more", tier: "Alignment+" },
          { icon: Palette, title: "White-Label Branding", desc: "Branded PDF exports with your logo", tier: "Signal+" },
        ].map((f) => (
          <div key={f.title} className="flex items-center gap-4 p-4 rounded-xl bg-charcoal-light border border-white/10 opacity-60">
            <f.icon className="w-5 h-5 text-white/40" />
            <div className="flex-1">
              <p className="text-sm text-white font-medium">{f.title}</p>
              <p className="text-xs text-white/50">{f.desc}</p>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
              f.tier === "Signal+" ? "bg-purple-500/20 text-purple-300" : "bg-white/10 text-white/60"
            }`}>{f.tier}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <SectionCard icon={Workflow} title="Teams Focus Framework" defaultOpen>
        <TeamsFocusFrameworkPanel />
      </SectionCard>

      <SectionCard icon={MessageSquare} title="Integrations & Webhooks" badge="Alignment+" counter={featureCounts ? <LimitBadge used={featureCounts.webhooks.used} max={featureCounts.webhooks.max} /> : undefined} defaultOpen>
        <ThirdPartyIntegrationsPanel />
      </SectionCard>

      <SectionCard icon={Calendar} title="Scheduled Rescans" badge="Alignment+" counter={featureCounts ? <LimitBadge used={featureCounts.rescans.used} max={featureCounts.rescans.max} /> : undefined} defaultOpen>
        <ScheduledRescansPanel />
      </SectionCard>

      <SectionCard icon={Key} title="API Keys" badge="Alignment+" counter={featureCounts ? <LimitBadge used={featureCounts.apiKeys.used} max={featureCounts.apiKeys.max} /> : undefined}>
        <ApiKeysPanel />
      </SectionCard>

      <SectionCard icon={Mail} title="Auto Report Delivery" badge="Alignment+" counter={featureCounts ? <LimitBadge used={featureCounts.reportDeliveries.used} max={featureCounts.reportDeliveries.max} /> : undefined} defaultOpen>
        <ReportDeliveryPanel />
      </SectionCard>

      <SectionCard icon={Palette} title="White-Label Branding" badge="Signal+">
        {hasSignalAccess ? (
          <BrandingPanel />
        ) : (
          <div className="p-4 rounded-lg bg-charcoal-deep border border-white/10">
            <p className="text-sm text-white/70 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-purple-400 shrink-0" />
              White-label branding requires <strong className="text-purple-300 ml-1">Signal</strong> or higher.
              Upgrade to add your logo, colors, and custom footer to exported PDFs.
            </p>
          </div>
        )}
      </SectionCard>
    </div>
  );
};

export default AdvancedFeaturesPanel;
