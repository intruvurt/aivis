import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useAuthStore } from "../stores/authStore";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { API_URL } from "../config";

interface AdminStats {
  totalUsers: number;
  totalAudits: number;
  activeJobs: number;
  systemHealth: "healthy" | "degraded" | "down" | "unknown";
  queueLagSeconds?: number;
  lastError?: string | null;
}

type NewsletterTier = "observer" | "alignment" | "signal" | "scorefix";

interface NewsletterSettings {
  automationEnabled: boolean;
  batchSize: number;
  delayMs: number;
  tierFilter: NewsletterTier[];
}

interface NewsletterDispatchResult {
  attempted: number;
  sent: number;
  failed: number;
  dryRun: boolean;
  editionKey: string;
  batchSize: number;
  delayMs: number;
  tierFilter: NewsletterTier[];
}

interface AdminPaymentSummary {
  completedCount: number;
  pendingCount: number;
  failedCount: number;
  activeSubscriptionCount: number;
  confirmedRevenueCents: number;
  activeSignalTrials: number;
  totalTrialsStarted: number;
}

interface AdminPaymentRow {
  id: string;
  userId: string;
  email: string;
  name: string | null;
  currentTier: string;
  purchasedTier: string;
  status: string;
  subscriptionStatus: string | null;
  amountCents: number | null;
  currency: string | null;
  completedAt: string | null;
  lastPaymentAt: string | null;
  createdAt: string;
  updatedAt: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  stripeSessionId: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  lastInvoiceId: string | null;
  failedInvoiceId: string | null;
  metadata: Record<string, unknown> | null;
  trialEndsAt: string | null;
  trialUsed: boolean;
}

type LoadState = "idle" | "loading" | "ready" | "error";

const DEFAULT_STATS: AdminStats = {
  totalUsers: 0,
  totalAudits: 0,
  activeJobs: 0,
  systemHealth: "unknown",
  queueLagSeconds: undefined,
  lastError: null,
};

const DEFAULT_NEWSLETTER_SETTINGS: NewsletterSettings = {
  automationEnabled: false,
  batchSize: 200,
  delayMs: 550,
  tierFilter: [],
};

const DEFAULT_PAYMENT_SUMMARY: AdminPaymentSummary = {
  completedCount: 0,
  pendingCount: 0,
  failedCount: 0,
  activeSubscriptionCount: 0,
  confirmedRevenueCents: 0,
  activeSignalTrials: 0,
  totalTrialsStarted: 0,
};

const NEWSLETTER_TIERS: NewsletterTier[] = ["observer", "alignment", "signal", "scorefix"];

const Admin: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  const [stats, setStats] = useState<AdminStats>(DEFAULT_STATS);
  const [state, setState] = useState<LoadState>("idle");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [adminKey, setAdminKey] = useState<string>(() => sessionStorage.getItem("aivis_admin_key") || "");

  const [newsletterSettings, setNewsletterSettings] = useState<NewsletterSettings>(DEFAULT_NEWSLETTER_SETTINGS);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [dispatchLoading, setDispatchLoading] = useState(false);
  const [editionLoading, setEditionLoading] = useState(false);
  const [editionLabel, setEditionLabel] = useState<string>("");
  const [dispatchResult, setDispatchResult] = useState<NewsletterDispatchResult | null>(null);
  const [editionTitle, setEditionTitle] = useState<string>("");
  const [editionSummary, setEditionSummary] = useState<string>("");
  const [paymentSummary, setPaymentSummary] = useState<AdminPaymentSummary>(DEFAULT_PAYMENT_SUMMARY);
  const [payments, setPayments] = useState<AdminPaymentRow[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);

  // Broadcast state
  const [broadcastSubject, setBroadcastSubject] = useState<string>("");
  const [broadcastHeadline, setBroadcastHeadline] = useState<string>("");
  const [broadcastBody, setBroadcastBody] = useState<string>("");
  const [broadcastCtaLabel, setBroadcastCtaLabel] = useState<string>("");
  const [broadcastCtaUrl, setBroadcastCtaUrl] = useState<string>("");
  const [broadcastTestTo, setBroadcastTestTo] = useState<string>("");
  const [broadcastTierFilter, setBroadcastTierFilter] = useState<NewsletterTier[]>([]);
  const [broadcastLoading, setBroadcastLoading] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<{ attempted: number; sent: number; failed: number; dryRun: boolean } | null>(null);

  const redirectedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const isAdmin = useMemo(() => user?.role === "admin" || !!adminKey.trim(), [user?.role, adminKey]);

  const adminHeaders = useMemo(() => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (adminKey.trim()) headers["x-admin-key"] = adminKey.trim();
    return headers;
  }, [adminKey]);

  const currencyFormatter = useMemo(() => new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }), []);

  // No redirect - show lock screen instead when not admin

  // Fetch admin stats
  const fetchStats = async () => {
    if (!isAdmin) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState("loading");

    try {
      // Change endpoint as needed
      const res = await fetch(`${API_URL}/api/admin/db/stats`, {
        method: "GET",
        headers: { ...adminHeaders },
        credentials: "include",
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Failed to load admin stats (${res.status})`);
      }

      const data = (await res.json()) as Partial<AdminStats>;

      setStats({
        ...DEFAULT_STATS,
        ...data,
        systemHealth: data.systemHealth ?? "unknown",
      });

      setLastUpdatedAt(new Date().toISOString());
      setState("ready");
    } catch (err: any) {
      if (err?.name === "AbortError") return;

      setState("error");
      setStats((prev) => ({
        ...prev,
        systemHealth: "unknown",
        lastError: err?.message || "Unknown error",
      }));
      toast.error(err?.message || "Failed to load admin stats");
    }
  };

  const fetchPayments = async () => {
    if (!isAdmin || !adminKey.trim()) return;

    setPaymentsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/payments?limit=20`, {
        method: "GET",
        headers: { ...adminHeaders },
        credentials: "include",
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Failed to load payment ledger (${res.status})`);
      }

      const data = await res.json();
      setPaymentSummary({
        ...DEFAULT_PAYMENT_SUMMARY,
        ...(data?.summary || {}),
      });
      setPayments(Array.isArray(data?.payments) ? data.payments : []);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load payment ledger");
    } finally {
      setPaymentsLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin || !adminKey.trim()) return;
    fetchStats();
    fetchPayments();

    return () => {
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, adminKey]);

  useEffect(() => {
    sessionStorage.setItem("aivis_admin_key", adminKey);
  }, [adminKey]);

  const fetchNewsletterSettings = async () => {
    if (!isAdmin || !adminKey.trim()) return;
    setSettingsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/newsletter/settings`, {
        method: "GET",
        headers: adminHeaders,
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Failed to load newsletter settings (${res.status})`);
      }
      const data = await res.json();
      const settings = (data?.settings || DEFAULT_NEWSLETTER_SETTINGS) as NewsletterSettings;
      setNewsletterSettings({
        automationEnabled: Boolean(settings.automationEnabled),
        batchSize: Number(settings.batchSize) || 200,
        delayMs: Number(settings.delayMs) || 550,
        tierFilter: Array.isArray(settings.tierFilter) ? settings.tierFilter : [],
      });
    } catch (err: any) {
      toast.error(err?.message || "Failed to load newsletter settings");
    } finally {
      setSettingsLoading(false);
    }
  };

  const saveNewsletterSettings = async () => {
    if (!adminKey.trim()) {
      toast.error("Admin key is required");
      return;
    }
    setSettingsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/newsletter/settings`, {
        method: "POST",
        headers: adminHeaders,
        credentials: "include",
        body: JSON.stringify(newsletterSettings),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Failed to save newsletter settings (${res.status})`);
      }
      const data = await res.json();
      setNewsletterSettings(data?.settings || newsletterSettings);
      toast.success("Newsletter settings saved");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save newsletter settings");
    } finally {
      setSettingsLoading(false);
    }
  };

  const runNewsletterDispatch = async (dryRun: boolean) => {
    if (!adminKey.trim()) {
      toast.error("Admin key is required");
      return;
    }
    setDispatchLoading(true);
    setDispatchResult(null);
    try {
      const res = await fetch(`${API_URL}/api/admin/newsletter/dispatch`, {
        method: "POST",
        headers: adminHeaders,
        credentials: "include",
        body: JSON.stringify({
          editionLabel: editionLabel.trim() || undefined,
          batchSize: newsletterSettings.batchSize,
          delayMs: newsletterSettings.delayMs,
          tierFilter: newsletterSettings.tierFilter,
          dryRun,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Dispatch failed (${res.status})`);
      }
      const data = await res.json();
      setDispatchResult((data?.result || null) as NewsletterDispatchResult | null);
      toast.success(dryRun ? "Newsletter dry run complete" : "Newsletter dispatch complete");
    } catch (err: any) {
      toast.error(err?.message || "Newsletter dispatch failed");
    } finally {
      setDispatchLoading(false);
    }
  };

  const createNewsletterEdition = async () => {
    if (!adminKey.trim()) {
      toast.error("Admin key is required");
      return;
    }
    setEditionLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/newsletter/editions`, {
        method: "POST",
        headers: adminHeaders,
        credentials: "include",
        body: JSON.stringify({
          editionLabel: editionLabel.trim() || undefined,
          title: editionTitle.trim() || undefined,
          summary: editionSummary.trim() || undefined,
          metadata: {
            tierFilter: newsletterSettings.tierFilter,
            batchSize: newsletterSettings.batchSize,
            delayMs: newsletterSettings.delayMs,
          },
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Edition create failed (${res.status})`);
      }
      const data = await res.json();
      setEditionLabel(String(data?.edition?.edition_key || editionLabel));
      toast.success("Newsletter edition created");
    } catch (err: any) {
      toast.error(err?.message || "Failed to create newsletter edition");
    } finally {
      setEditionLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin || !adminKey.trim()) return;
    fetchNewsletterSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, adminKey]);

  const healthColor =
    stats.systemHealth === "healthy"
      ? "text-white/80"
      : stats.systemHealth === "degraded"
      ? "text-white/80"
      : stats.systemHealth === "down"
      ? "text-white/80"
      : "text-white/70";

  const healthLabel =
    stats.systemHealth === "healthy"
      ? "Healthy"
      : stats.systemHealth === "degraded"
      ? "Degraded"
      : stats.systemHealth === "down"
      ? "Down"
      : "Unknown";

  // Admin key lock screen - show when user has no role or stored key
  if (!isAdmin) {
    return (
      <div id="src_pages_Admin_lock" className="flex items-center justify-center py-12">
        <div className="max-w-sm w-full mx-auto px-4">
          <div className="card-charcoal rounded-2xl p-8 text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-white/10 flex items-center justify-center">
              <svg className="w-6 h-6 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white">Admin Access</h2>
            <p className="text-sm text-white/60">Enter your admin API key to continue</p>
            <form onSubmit={(e) => {
              e.preventDefault();
              const key = (e.currentTarget.elements.namedItem('adminKeyInput') as HTMLInputElement)?.value?.trim();
              if (key) {
                setAdminKey(key);
                sessionStorage.setItem('aivis_admin_key', key);
              }
            }} className="space-y-3">
              <input
                name="adminKeyInput"
                type="password"
                placeholder="Admin API key"
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
                autoFocus
              />
              <button
                type="submit"
                className="w-full px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white text-sm font-medium transition-colors"
              >
                Unlock
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="src_pages_Admin_main" className="py-12">
      <div
        id="src_pages_Admin_container"
        className="px-4 sm:px-6 lg:px-8"
      >
        <motion.div
          id="src_pages_Admin_header"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="flex items-start justify-between gap-4"
        >
          <div className="lonely-text">
            <h1
              id="src_pages_Admin_title"
              className="text-3xl font-bold text-white"
            >
              Admin Dashboard
            </h1>
            <p className="text-sm text-white/70 mt-2">
              Operational visibility. Audit throughput. Tier enforcement. No guessing.
            </p>

            {lastUpdatedAt && (
              <p className="text-xs text-white/60 mt-1">
                Last updated: {new Date(lastUpdatedAt).toLocaleString()}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <input
              type="password"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              className="bg-[#323a4c] text-white px-3 py-2 rounded-md text-sm w-56 placeholder:text-white/40"
              placeholder="Enter admin key"
            />
            <button
              type="button"
              onClick={() => {
                void fetchStats();
                void fetchPayments();
              }}
              disabled={state === "loading" || !adminKey.trim()}
              className="bg-[#323a4c] text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-50"
            >
              {state === "loading" ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </motion.div>

        {/* Status bar */}
        <div className="mt-6">
          {state === "loading" && (
            <div className="bg-charcoal rounded-lg shadow-sm p-4 border border-white/10">
              <p className="text-sm text-white/80">Loading admin stats…</p>
            </div>
          )}

          {state === "error" && (
            <div className="bg-charcoal rounded-lg shadow-sm p-4 border border-white/10">
              <p className="text-sm text-white/80 font-semibold">Stats unavailable</p>
              <p className="text-sm text-white/80 mt-1">
                {stats.lastError || "An unknown error occurred."}
              </p>
            </div>
          )}
        </div>

        <div
          id="src_pages_Admin_stats"
          className="grid md:grid-cols-4 gap-6 mt-6 mb-8"
        >
          <div className="bg-charcoal rounded-lg shadow-sm p-6">
            <p className="text-sm text-white/70 mb-2">Total Users</p>
            <p className="text-3xl font-bold text-white">{stats.totalUsers}</p>
            <p className="text-xs text-white/60 mt-2">All-time accounts</p>
          </div>

          <div className="bg-charcoal rounded-lg shadow-sm p-6">
            <p className="text-sm text-white/70 mb-2">Total Audits</p>
            <p className="text-3xl font-bold text-white">{stats.totalAudits}</p>
            <p className="text-xs text-white/60 mt-2">Completed + stored</p>
          </div>

          <div className="bg-charcoal rounded-lg shadow-sm p-6">
            <p className="text-sm text-white/70 mb-2">Active Jobs</p>
            <p className="text-3xl font-bold text-white">{stats.activeJobs}</p>
            <p className="text-xs text-white/60 mt-2">
              {typeof stats.queueLagSeconds === "number"
                ? `Queue lag: ~${stats.queueLagSeconds}s`
                : "Queue lag: unknown"}
            </p>
          </div>

          <div className="bg-charcoal rounded-lg shadow-sm p-6">
            <p className="text-sm text-white/70 mb-2">System Health</p>
            <p className={`text-3xl font-bold ${healthColor}`}>{healthLabel}</p>
            <p className="text-xs text-white/60 mt-2">
              Based on DB + queue + AI provider checks
            </p>
          </div>
        </div>

        <div
          id="src_pages_Admin_tools"
          className="bg-charcoal rounded-lg shadow-sm p-8"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white">Admin Tools</h2>
              <p className="text-sm text-white/70 mt-2">
                Guarded operations. Logged actions. Reversible changes where possible.
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mt-6">
            <div className="border border-white/14 rounded-lg p-5">
              <p className="font-semibold text-white">User Management</p>
              <p className="text-sm text-white/70 mt-2">
                Search users. Disable accounts. Role changes. Manual tier overrides.
              </p>
              <p className="text-xs text-white/60 mt-3">
                Next: add user lookup + audit trail
              </p>
            </div>

            <div className="border border-white/14 rounded-lg p-5">
              <p className="font-semibold text-white">Usage & Entitlements</p>
              <p className="text-sm text-white/70 mt-2">
                Monitor limits. Identify abuse. Reset counters. Grant temporary credits.
              </p>
              <p className="text-xs text-white/60 mt-3">
                Next: limit dashboard + per-route breakdown
              </p>
            </div>

            <div className="border border-white/14 rounded-lg p-5">
              <p className="font-semibold text-white">Jobs / Queue Ops</p>
              <p className="text-sm text-white/70 mt-2">
                Retry failed jobs. Reprocess audit runs. Inspect stuck workflows.
              </p>
              <p className="text-xs text-white/60 mt-3">
                Next: job list + re-run button with confirmation
              </p>
            </div>

            <div className="border border-white/14 rounded-lg p-5">
              <p className="font-semibold text-white">System Diagnostics</p>
              <p className="text-sm text-white/70 mt-2">
                DB health. Redis health. AI provider availability. Webhook integrity.
              </p>
              <p className="text-xs text-white/60 mt-3">
                Next: health probes + latency snapshots
              </p>
            </div>
          </div>

          <div className="border border-white/14 rounded-lg p-5 mt-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="font-semibold text-white">Billing Confirmation</p>
                <p className="text-sm text-white/70 mt-2">
                  Stripe-backed payment receipts and Signal trial state. Separate from team and workspace administration.
                </p>
              </div>
              <button
                type="button"
                onClick={() => { void fetchPayments(); }}
                disabled={paymentsLoading}
                className="bg-[#323a4c] text-white px-3 py-2 rounded-md text-sm disabled:opacity-50"
              >
                {paymentsLoading ? "Loading..." : "Refresh Ledger"}
              </button>
            </div>

            <div className="grid md:grid-cols-3 xl:grid-cols-6 gap-3 mt-4">
              <div className="rounded-lg border border-white/10 bg-[#323a4c]/45 p-3">
                <p className="text-xs text-white/55 uppercase tracking-[0.14em]">Confirmed</p>
                <p className="mt-2 text-2xl font-semibold text-white">{paymentSummary.completedCount}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-[#323a4c]/45 p-3">
                <p className="text-xs text-white/55 uppercase tracking-[0.14em]">Pending</p>
                <p className="mt-2 text-2xl font-semibold text-white">{paymentSummary.pendingCount}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-[#323a4c]/45 p-3">
                <p className="text-xs text-white/55 uppercase tracking-[0.14em]">Failed</p>
                <p className="mt-2 text-2xl font-semibold text-white">{paymentSummary.failedCount}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-[#323a4c]/45 p-3">
                <p className="text-xs text-white/55 uppercase tracking-[0.14em]">Active Subs</p>
                <p className="mt-2 text-2xl font-semibold text-white">{paymentSummary.activeSubscriptionCount}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-[#323a4c]/45 p-3">
                <p className="text-xs text-white/55 uppercase tracking-[0.14em]">Signal Trials</p>
                <p className="mt-2 text-2xl font-semibold text-white">{paymentSummary.activeSignalTrials}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-[#323a4c]/45 p-3">
                <p className="text-xs text-white/55 uppercase tracking-[0.14em]">Confirmed Revenue</p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {currencyFormatter.format((paymentSummary.confirmedRevenueCents || 0) / 100)}
                </p>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto rounded-lg border border-white/10">
              <table className="min-w-full text-sm text-white/85">
                <thead className="bg-white/5 text-left text-xs uppercase tracking-[0.12em] text-white/50">
                  <tr>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Payment</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Subscription</th>
                    <th className="px-4 py-3">Stripe</th>
                    <th className="px-4 py-3">Trial</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id} className="border-t border-white/10 align-top">
                      <td className="px-4 py-3">
                        <p className="font-medium text-white">{payment.name || payment.email}</p>
                        <p className="text-xs text-white/55 mt-1">{payment.email}</p>
                        <p className="text-xs text-white/45 mt-1">current {payment.currentTier} / purchased {payment.purchasedTier}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-white">
                          {payment.amountCents != null
                            ? currencyFormatter.format(payment.amountCents / 100)
                            : "Custom"}
                        </p>
                        <p className="text-xs text-white/55 mt-1">
                          created {new Date(payment.createdAt).toLocaleString()}
                        </p>
                        {payment.completedAt && (
                          <p className="text-xs text-emerald-300 mt-1">
                            confirmed {new Date(payment.completedAt).toLocaleString()}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-white">{payment.status}</p>
                        {payment.lastInvoiceId && (
                          <p className="text-xs text-white/55 mt-1">invoice {payment.lastInvoiceId}</p>
                        )}
                        {payment.failedInvoiceId && (
                          <p className="text-xs text-rose-300 mt-1">failed {payment.failedInvoiceId}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-white">{payment.subscriptionStatus || "one-time"}</p>
                        {payment.currentPeriodEnd && (
                          <p className="text-xs text-white/55 mt-1">period ends {new Date(payment.currentPeriodEnd).toLocaleDateString()}</p>
                        )}
                        {payment.cancelAtPeriodEnd && (
                          <p className="text-xs text-amber-300 mt-1">cancel at period end</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-white/55">session {payment.stripeSessionId || "-"}</p>
                        <p className="text-xs text-white/55 mt-1">subscription {payment.stripeSubscriptionId || "-"}</p>
                        <p className="text-xs text-white/55 mt-1">customer {payment.stripeCustomerId || "-"}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-white">{payment.trialUsed ? "Started" : "Not used"}</p>
                        {payment.trialEndsAt && (
                          <p className="text-xs text-white/55 mt-1">ends {new Date(payment.trialEndsAt).toLocaleDateString()}</p>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!paymentsLoading && payments.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-sm text-white/55">
                        No payment rows returned.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="border border-white/14 rounded-lg p-5 mt-6">
            <p className="font-semibold text-white">Newsletter Controls</p>
            <p className="text-sm text-white/70 mt-2">
              Manual-only newsletter operations. Use toggles to enable automation or trigger one-off sends.
            </p>

            <div className="grid md:grid-cols-2 gap-3 mt-4">
              <div>
                <label className="block text-xs text-white/70 mb-1">Admin key</label>
                <input
                  type="password"
                  value={adminKey}
                  onChange={(e) => setAdminKey(e.target.value)}
                  className="w-full bg-[#323a4c] text-white px-3 py-2 rounded-md text-sm"
                  placeholder="Required for newsletter admin APIs"
                />
              </div>
              <div>
                <label className="block text-xs text-white/70 mb-1">Edition label</label>
                <input
                  value={editionLabel}
                  onChange={(e) => setEditionLabel(e.target.value)}
                  className="w-full bg-[#323a4c] text-white px-3 py-2 rounded-md text-sm"
                  placeholder="e.g. 2026-W12-special"
                />
              </div>
              <div>
                <label className="block text-xs text-white/70 mb-1">Batch size</label>
                <input
                  type="number"
                  min={1}
                  max={2000}
                  value={newsletterSettings.batchSize}
                  onChange={(e) => setNewsletterSettings((prev) => ({ ...prev, batchSize: Number(e.target.value) || 1 }))}
                  className="w-full bg-[#323a4c] text-white px-3 py-2 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-white/70 mb-1">Send delay (ms)</label>
                <input
                  type="number"
                  min={500}
                  max={10000}
                  value={newsletterSettings.delayMs}
                  onChange={(e) => setNewsletterSettings((prev) => ({ ...prev, delayMs: Number(e.target.value) || 550 }))}
                  className="w-full bg-[#323a4c] text-white px-3 py-2 rounded-md text-sm"
                />
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2 flex-wrap">
              {NEWSLETTER_TIERS.map((tier) => {
                const enabled = newsletterSettings.tierFilter.includes(tier);
                return (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => {
                      setNewsletterSettings((prev) => {
                        const exists = prev.tierFilter.includes(tier);
                        return {
                          ...prev,
                          tierFilter: exists
                            ? prev.tierFilter.filter((t) => t !== tier)
                            : [...prev.tierFilter, tier],
                        };
                      });
                    }}
                    className={`px-2 py-1 rounded text-xs ${enabled ? "bg-white text-[#2e3646]" : "bg-[#323a4c] text-white"}`}
                  >
                    {tier}
                  </button>
                );
              })}
              <label className="ml-2 text-xs text-white/80 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newsletterSettings.automationEnabled}
                  onChange={(e) => setNewsletterSettings((prev) => ({ ...prev, automationEnabled: e.target.checked }))}
                />
                Enable periodic automation
              </label>
            </div>

            <div className="grid md:grid-cols-2 gap-3 mt-4">
              <input
                value={editionTitle}
                onChange={(e) => setEditionTitle(e.target.value)}
                className="w-full bg-[#323a4c] text-white px-3 py-2 rounded-md text-sm"
                placeholder="Edition title"
              />
              <input
                value={editionSummary}
                onChange={(e) => setEditionSummary(e.target.value)}
                className="w-full bg-[#323a4c] text-white px-3 py-2 rounded-md text-sm"
                placeholder="Edition summary"
              />
            </div>

            <div className="flex items-center gap-2 mt-4 flex-wrap">
              <button
                type="button"
                onClick={fetchNewsletterSettings}
                disabled={settingsLoading}
                className="bg-[#323a4c] text-white px-3 py-2 rounded-md text-sm disabled:opacity-50"
              >
                {settingsLoading ? "Loading..." : "Load Settings"}
              </button>
              <button
                type="button"
                onClick={saveNewsletterSettings}
                disabled={settingsLoading}
                className="bg-[#323a4c] text-white px-3 py-2 rounded-md text-sm disabled:opacity-50"
              >
                Save Settings
              </button>
              <button
                type="button"
                onClick={() => runNewsletterDispatch(true)}
                disabled={dispatchLoading}
                className="bg-[#323a4c] text-white px-3 py-2 rounded-md text-sm disabled:opacity-50"
              >
                Dry Run Dispatch
              </button>
              <button
                type="button"
                onClick={() => runNewsletterDispatch(false)}
                disabled={dispatchLoading}
                className="bg-white text-[#2e3646] px-3 py-2 rounded-md text-sm font-semibold disabled:opacity-50"
              >
                Send Now
              </button>
              <button
                type="button"
                onClick={createNewsletterEdition}
                disabled={editionLoading}
                className="bg-[#323a4c] text-white px-3 py-2 rounded-md text-sm disabled:opacity-50"
              >
                {editionLoading ? "Creating..." : "Create Edition"}
              </button>
            </div>

            {dispatchResult && (
              <div className="mt-4 text-xs text-white/80 border border-white/14 rounded-lg p-3">
                edition={dispatchResult.editionKey} | attempted={dispatchResult.attempted} | sent={dispatchResult.sent} | failed={dispatchResult.failed} | dryRun={String(dispatchResult.dryRun)}
              </div>
            )}
          </div>

          {/* ─── Broadcast Email Section ─────────────────────────────────── */}
          <div className="border border-white/14 rounded-lg p-5 mt-6">
            <p className="font-semibold text-white">Broadcast Email</p>
            <p className="text-sm text-white/70 mt-2">
              Send a custom one-off announcement to all users (or filtered by tier). Compose the email here, preview it, then send.
            </p>

            <div className="grid md:grid-cols-2 gap-3 mt-4">
              <div>
                <label className="block text-xs text-white/70 mb-1">Subject line *</label>
                <input
                  value={broadcastSubject}
                  onChange={(e) => setBroadcastSubject(e.target.value)}
                  className="w-full bg-[#323a4c] text-white px-3 py-2 rounded-md text-sm"
                  placeholder="e.g. Score Fix is now AutoFix PR - here's what changed"
                />
              </div>
              <div>
                <label className="block text-xs text-white/70 mb-1">Headline *</label>
                <input
                  value={broadcastHeadline}
                  onChange={(e) => setBroadcastHeadline(e.target.value)}
                  className="w-full bg-[#323a4c] text-white px-3 py-2 rounded-md text-sm"
                  placeholder="e.g. Big changes are here."
                />
              </div>
            </div>

            <div className="mt-3">
              <label className="block text-xs text-white/70 mb-1">Body * (separate paragraphs with blank lines)</label>
              <textarea
                value={broadcastBody}
                onChange={(e) => setBroadcastBody(e.target.value)}
                rows={6}
                className="w-full bg-[#323a4c] text-white px-3 py-2 rounded-md text-sm resize-y"
                placeholder={"We just shipped a major platform update.\n\nScore Fix is now AutoFix PR - credit-based automated GitHub PR remediation..."}
              />
            </div>

            <div className="grid md:grid-cols-2 gap-3 mt-3">
              <div>
                <label className="block text-xs text-white/70 mb-1">CTA button label (optional)</label>
                <input
                  value={broadcastCtaLabel}
                  onChange={(e) => setBroadcastCtaLabel(e.target.value)}
                  className="w-full bg-[#323a4c] text-white px-3 py-2 rounded-md text-sm"
                  placeholder="e.g. See What's New"
                />
              </div>
              <div>
                <label className="block text-xs text-white/70 mb-1">CTA URL (optional)</label>
                <input
                  value={broadcastCtaUrl}
                  onChange={(e) => setBroadcastCtaUrl(e.target.value)}
                  className="w-full bg-[#323a4c] text-white px-3 py-2 rounded-md text-sm"
                  placeholder="e.g. https://aivis.biz/changelog"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-3 mt-3">
              <div>
                <label className="block text-xs text-white/70 mb-1">Test recipient email (for preview send)</label>
                <input
                  value={broadcastTestTo}
                  onChange={(e) => setBroadcastTestTo(e.target.value)}
                  className="w-full bg-[#323a4c] text-white px-3 py-2 rounded-md text-sm"
                  placeholder="your@email.com"
                />
              </div>
              <div>
                <label className="block text-xs text-white/70 mb-1">Tier filter (empty = all users)</label>
                <div className="flex items-center gap-2 flex-wrap mt-1">
                  {NEWSLETTER_TIERS.map((tier) => {
                    const enabled = broadcastTierFilter.includes(tier);
                    return (
                      <button
                        key={tier}
                        type="button"
                        onClick={() => {
                          setBroadcastTierFilter((prev) =>
                            prev.includes(tier) ? prev.filter((t) => t !== tier) : [...prev, tier]
                          );
                        }}
                        className={`px-2 py-1 rounded text-xs ${enabled ? "bg-white text-[#2e3646]" : "bg-[#323a4c] text-white"}`}
                      >
                        {tier}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-4 flex-wrap">
              <button
                type="button"
                disabled={broadcastLoading || !broadcastSubject.trim() || !broadcastHeadline.trim() || !broadcastBody.trim()}
                onClick={async () => {
                  if (!adminKey.trim()) { toast.error("Admin key is required"); return; }
                  setBroadcastLoading(true);
                  setBroadcastResult(null);
                  try {
                    const res = await fetch(`${API_URL}/api/admin/broadcast/preview`, {
                      method: "POST",
                      headers: adminHeaders,
                      credentials: "include",
                      body: JSON.stringify({
                        subject: broadcastSubject,
                        headline: broadcastHeadline,
                        body: broadcastBody,
                        ctaLabel: broadcastCtaLabel || undefined,
                        ctaUrl: broadcastCtaUrl || undefined,
                        to: broadcastTestTo || undefined,
                        sendTest: !!broadcastTestTo.trim(),
                      }),
                    });
                    if (!res.ok) { const t = await res.text().catch(() => ""); throw new Error(t || `Preview failed (${res.status})`); }
                    const data = await res.json();
                    toast.success(data?.sent ? `Test sent to ${broadcastTestTo}` : "Preview generated (check response)");
                  } catch (err: any) {
                    toast.error(err?.message || "Broadcast preview failed");
                  } finally {
                    setBroadcastLoading(false);
                  }
                }}
                className="bg-[#323a4c] text-white px-3 py-2 rounded-md text-sm disabled:opacity-50"
              >
                {broadcastLoading ? "Sending..." : broadcastTestTo.trim() ? "Send Test Email" : "Preview Only"}
              </button>
              <button
                type="button"
                disabled={broadcastLoading || !broadcastSubject.trim() || !broadcastHeadline.trim() || !broadcastBody.trim()}
                onClick={async () => {
                  if (!adminKey.trim()) { toast.error("Admin key is required"); return; }
                  setBroadcastLoading(true);
                  setBroadcastResult(null);
                  try {
                    const res = await fetch(`${API_URL}/api/admin/broadcast/send`, {
                      method: "POST",
                      headers: adminHeaders,
                      credentials: "include",
                      body: JSON.stringify({
                        subject: broadcastSubject,
                        headline: broadcastHeadline,
                        body: broadcastBody,
                        ctaLabel: broadcastCtaLabel || undefined,
                        ctaUrl: broadcastCtaUrl || undefined,
                        tierFilter: broadcastTierFilter.length > 0 ? broadcastTierFilter : undefined,
                        dryRun: true,
                      }),
                    });
                    if (!res.ok) { const t = await res.text().catch(() => ""); throw new Error(t || `Dry run failed (${res.status})`); }
                    const data = await res.json();
                    setBroadcastResult(data?.result ?? data ?? null);
                    toast.success(`Dry run complete - ${data?.attempted || 0} users would receive this`);
                  } catch (err: any) {
                    toast.error(err?.message || "Broadcast dry run failed");
                  } finally {
                    setBroadcastLoading(false);
                  }
                }}
                className="bg-[#323a4c] text-white px-3 py-2 rounded-md text-sm disabled:opacity-50"
              >
                Dry Run
              </button>
              <button
                type="button"
                disabled={broadcastLoading || !broadcastSubject.trim() || !broadcastHeadline.trim() || !broadcastBody.trim()}
                onClick={async () => {
                  if (!adminKey.trim()) { toast.error("Admin key is required"); return; }
                  if (!window.confirm(`Send broadcast to ${broadcastTierFilter.length > 0 ? broadcastTierFilter.join(", ") : "ALL"} users?\n\nSubject: ${broadcastSubject}\n\nThis cannot be undone.`)) return;
                  setBroadcastLoading(true);
                  setBroadcastResult(null);
                  try {
                    const res = await fetch(`${API_URL}/api/admin/broadcast/send`, {
                      method: "POST",
                      headers: adminHeaders,
                      credentials: "include",
                      body: JSON.stringify({
                        subject: broadcastSubject,
                        headline: broadcastHeadline,
                        body: broadcastBody,
                        ctaLabel: broadcastCtaLabel || undefined,
                        ctaUrl: broadcastCtaUrl || undefined,
                        tierFilter: broadcastTierFilter.length > 0 ? broadcastTierFilter : undefined,
                        dryRun: false,
                      }),
                    });
                    if (!res.ok) { const t = await res.text().catch(() => ""); throw new Error(t || `Broadcast failed (${res.status})`); }
                    const data = await res.json();
                    setBroadcastResult(data ?? null);
                    toast.success(`Broadcast sent - ${data?.sent || 0} delivered, ${data?.failed || 0} failed`);
                  } catch (err: any) {
                    toast.error(err?.message || "Broadcast send failed");
                  } finally {
                    setBroadcastLoading(false);
                  }
                }}
                className="bg-white text-[#2e3646] px-3 py-2 rounded-md text-sm font-semibold disabled:opacity-50"
              >
                Send Broadcast Now
              </button>
            </div>

            {broadcastResult && (
              <div className="mt-4 text-xs text-white/80 border border-white/14 rounded-lg p-3">
                attempted={broadcastResult.attempted} | sent={broadcastResult.sent} | failed={broadcastResult.failed} | dryRun={String(broadcastResult.dryRun)}
              </div>
            )}
          </div>

          <div className="mt-8 text-xs text-white/60">
            Every admin action should emit an audit log entry with actor_id, target_id, action, before/after, and timestamp.
          </div>
        </div>
      </div>
    </div>
  );
};

export default Admin;
