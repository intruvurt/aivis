/**
 * AlertSettingsPanel — configure multi-channel alert notifications.
 *
 * Channels: email, slack, discord, webhook, in_app
 * The panel can be embedded in Settings or the Dashboard.
 */

import React, { useCallback, useEffect, useState } from "react";
import { useAuthStore } from "../stores/authStore";
import { API_URL } from "../config";
import { buildBearerHeader } from "../utils/authToken";

// ── Types ────────────────────────────────────────────────────────────────────

type AlertChannel = "email" | "slack" | "discord" | "webhook" | "in_app";

type AlertType =
  | "score_regression"
  | "score_improvement"
  | "opportunity"
  | "competitor_gap"
  | "fix_applied"
  | "fix_merged"
  | "deploy_regression";

interface Subscription {
  id: string;
  channel: AlertChannel;
  channel_config: Record<string, string>;
  alert_types: AlertType[];
  enabled: boolean;
}

const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  score_regression: "Score drops",
  score_improvement: "Score improvements",
  opportunity: "New opportunities",
  competitor_gap: "Competitor gaps",
  fix_applied: "Fix applied",
  fix_merged: "Fix merged",
  deploy_regression: "Deploy regressions",
};

const ALL_ALERT_TYPES: AlertType[] = Object.keys(ALERT_TYPE_LABELS) as AlertType[];

const CHANNEL_META: Record<AlertChannel, { label: string; icon: string; configField?: string; placeholder?: string }> = {
  email: { label: "Email", icon: "✉️", configField: "address", placeholder: "you@example.com" },
  slack: { label: "Slack", icon: "💬", configField: "url", placeholder: "https://hooks.slack.com/services/…" },
  discord: { label: "Discord", icon: "🎮", configField: "url", placeholder: "https://discord.com/api/webhooks/…" },
  webhook: { label: "Webhook", icon: "🔗", configField: "url", placeholder: "https://your-server.com/webhook" },
  in_app: { label: "In-app (always on)", icon: "🔔" },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function base() {
  return (API_URL || "").replace(/\/+$/, "") + "/api/self-healing/alerts";
}

// ── Channel Row ──────────────────────────────────────────────────────────────

interface ChannelRowProps {
  channel: AlertChannel;
  sub: Subscription | undefined;
  onSave: (channel: AlertChannel, config: Record<string, string>, types: AlertType[], enabled: boolean) => Promise<void>;
  onDelete: (channel: AlertChannel) => Promise<void>;
  onTest: (channel: AlertChannel, config: Record<string, string>) => Promise<void>;
}

function ChannelRow({ channel, sub, onSave, onDelete, onTest }: ChannelRowProps) {
  const meta = CHANNEL_META[channel];
  const [expanded, setExpanded] = useState(false);
  const [configValue, setConfigValue] = useState(sub?.channel_config?.[meta.configField ?? ""] ?? "");
  const [selectedTypes, setSelectedTypes] = useState<AlertType[]>(sub?.alert_types ?? ALL_ALERT_TYPES);
  const [enabled, setEnabled] = useState(sub?.enabled ?? true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const isAlwaysOn = channel === "in_app";
  const isConfigured = !!sub;

  function toggleType(t: AlertType) {
    setSelectedTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  }

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    try {
      const config = meta.configField ? { [meta.configField]: configValue } : {};
      await onSave(channel, config, selectedTypes, enabled);
      setMsg({ text: "Saved", ok: true });
    } catch (err: any) {
      setMsg({ text: err?.message || "Save failed", ok: false });
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    if (!meta.configField) return;
    setTesting(true);
    setMsg(null);
    try {
      const config = { [meta.configField]: configValue };
      await onTest(channel, config);
      setMsg({ text: "Test sent!", ok: true });
    } catch (err: any) {
      setMsg({ text: err?.message || "Test failed", ok: false });
    } finally {
      setTesting(false);
    }
  }

  async function handleDelete() {
    setSaving(true);
    setMsg(null);
    try {
      await onDelete(channel);
      setMsg({ text: "Removed", ok: true });
      setExpanded(false);
    } catch (err: any) {
      setMsg({ text: err?.message || "Delete failed", ok: false });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border border-slate-700 rounded-xl overflow-hidden">
      {/* Header row */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-800 hover:bg-slate-750 transition-colors"
        onClick={() => !isAlwaysOn && setExpanded((e) => !e)}
        type="button"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">{meta.icon}</span>
          <div className="text-left">
            <p className="text-sm font-medium text-white">{meta.label}</p>
            {isAlwaysOn ? (
              <p className="text-xs text-slate-400">Notifications always stored in-app</p>
            ) : isConfigured ? (
              <p className="text-xs text-green-400">Configured {!sub.enabled ? "(paused)" : ""}</p>
            ) : (
              <p className="text-xs text-slate-500">Not configured</p>
            )}
          </div>
        </div>
        {!isAlwaysOn && (
          <span className="text-slate-400 text-sm">{expanded ? "▲" : "▼"}</span>
        )}
      </button>

      {/* Config panel */}
      {expanded && !isAlwaysOn && (
        <div className="bg-slate-900 px-4 py-4 space-y-4">
          {/* URL / address input */}
          {meta.configField && (
            <div>
              <label className="block text-xs text-slate-400 mb-1">{meta.configField === "url" ? "Webhook URL" : "Email address"}</label>
              <input
                type={meta.configField === "address" ? "email" : "url"}
                value={configValue}
                onChange={(e) => setConfigValue(e.target.value)}
                placeholder={meta.placeholder}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}

          {/* Alert type checkboxes */}
          <div>
            <label className="block text-xs text-slate-400 mb-2">Alert types</label>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {ALL_ALERT_TYPES.map((t) => (
                <label key={t} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedTypes.includes(t)}
                    onChange={() => toggleType(t)}
                    className="accent-indigo-500"
                  />
                  <span className="text-xs text-slate-300">{ALERT_TYPE_LABELS[t]}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Enable toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="accent-indigo-500"
            />
            <span className="text-sm text-slate-300">Enabled</span>
          </label>

          {/* Feedback */}
          {msg && (
            <p className={`text-xs ${msg.ok ? "text-green-400" : "text-red-400"}`}>{msg.text}</p>
          )}

          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm rounded-lg font-medium transition-colors"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            {meta.configField && (
              <button
                onClick={handleTest}
                disabled={testing || !configValue}
                className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white text-sm rounded-lg font-medium transition-colors"
              >
                {testing ? "Sending…" : "Send test"}
              </button>
            )}
            {isConfigured && (
              <button
                onClick={handleDelete}
                disabled={saving}
                className="px-4 py-1.5 bg-red-900/40 hover:bg-red-800/40 disabled:opacity-40 text-red-300 text-sm rounded-lg font-medium transition-colors ml-auto"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

interface Props {
  className?: string;
}

export function AlertSettingsPanel({ className = "" }: Props) {
  const { token } = useAuthStore();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const headers = useCallback(
    () => ({ ...buildBearerHeader(token), "Content-Type": "application/json" }),
    [token],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${base()}/subscriptions`, { headers: buildBearerHeader(token) });
      const data = await res.json();
      if (data.success) setSubscriptions(data.subscriptions);
      else setError(data.error || "Failed to load");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const handleSave = useCallback(
    async (channel: AlertChannel, config: Record<string, string>, types: AlertType[], enabled: boolean) => {
      const res = await fetch(`${base()}/subscriptions`, {
        method: "PUT",
        headers: headers(),
        body: JSON.stringify({ channel, channel_config: config, alert_types: types, enabled }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Save failed");
      await load();
    },
    [headers, load],
  );

  const handleDelete = useCallback(
    async (channel: AlertChannel) => {
      const res = await fetch(`${base()}/subscriptions/${channel}`, {
        method: "DELETE",
        headers: buildBearerHeader(token),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Delete failed");
      await load();
    },
    [token, load],
  );

  const handleTest = useCallback(
    async (channel: AlertChannel, config: Record<string, string>) => {
      const res = await fetch(`${base()}/test`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ channel, channel_config: config }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Test failed");
    },
    [headers],
  );

  return (
    <div className={`bg-slate-900 border border-slate-700 rounded-xl p-5 ${className}`}>
      <div className="mb-5">
        <h3 className="text-white font-semibold text-base">Alert Channels</h3>
        <p className="text-slate-400 text-sm mt-1">
          Get notified when your AI visibility score changes, a fix is merged, or a competitor moves.
        </p>
      </div>

      {loading ? (
        <p className="text-slate-400 animate-pulse text-sm">Loading…</p>
      ) : error ? (
        <p className="text-red-400 text-sm">{error}</p>
      ) : (
        <div className="space-y-3">
          {(Object.keys(CHANNEL_META) as AlertChannel[]).map((ch) => (
            <ChannelRow
              key={ch}
              channel={ch}
              sub={subscriptions.find((s) => s.channel === ch)}
              onSave={handleSave}
              onDelete={handleDelete}
              onTest={handleTest}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default AlertSettingsPanel;
