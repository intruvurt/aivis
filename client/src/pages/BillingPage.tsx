import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { CreditCard, Sparkles, Receipt, WalletCards, ShieldCheck, Clock, TrendingUp, AlertTriangle, CheckCircle2, X as XIcon, ExternalLink } from "lucide-react";
import toast from "react-hot-toast";
import AppPageFrame from "../components/AppPageFrame";
import { API_URL } from "../config";
import { useAuthStore } from "../stores/authStore";
import { usePageMeta } from "../hooks/usePageMeta";
import useFeatureStatus from "../hooks/useFeatureStatus";
import { CANONICAL_TIER_PRICING, type CanonicalTier, type TierBillingModel } from "@shared/types";

interface ScanPack {
  key: string;
  scans: number;
  effectiveScans?: number;
  bonusPercent?: number;
  amountCents?: number;
  amountUsd?: number;
  stripeConfigured?: boolean;
}

interface UsageSnapshot {
  monthlyLimit: number;
  usedThisMonth: number;
  remainingThisMonth: number;
}

interface CreditBonusPolicy {
  scanPackTierBoost?: {
    signalPercent?: number;
    scorefixPercent?: number;
  };
  initialTierBonus?: {
    signal?: { monthlyPercent?: number; yearlyPercent?: number };
    scorefix?: { monthlyPercent?: number; yearlyPercent?: number };
    milestoneWindowHours?: number;
  };
}

interface InitialTierBonusGrant {
  tier: string;
  billingPeriod: string;
  bonusPercent: number;
  baseCredits: number;
  bonusCredits: number;
  totalCreditsAdded: number;
  milestoneQualified: boolean;
  milestoneWindowMinutes: number;
  grantedAt?: string;
}

interface SubscriptionData {
  planName: string;
  status: "active" | "trialing" | "past_due" | "canceled" | "incomplete";
  currentPeriodEnd: string | null;
  packCreditsRemaining?: number;
  referralCreditsEarnedTotal?: number;
  totalAuditCreditsAvailable?: number;
  usage?: UsageSnapshot;
  creditBonusPolicy?: CreditBonusPolicy;
  initialTierBonus?: InitialTierBonusGrant | null;
  scanPacks?: ScanPack[];
  trial?: {
    active?: boolean;
    endsAt?: string | null;
    daysRemaining?: number;
    used?: boolean;
  };
}

interface CreditLedgerEntry {
  id: string;
  delta_credits: number;
  balance_after: number;
  reason: string;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

interface TierPrice {
  amount: number;
  formatted: string;
}

interface LivePricingTier {
  key: string;
  name: string;
  pricing: {
    monthly: TierPrice | null;
    yearly: TierPrice | null;
    one_time?: TierPrice | null;
  };
  billingModel?: "free" | "subscription" | "one_time";
}

interface LivePricingResponse {
  success?: boolean;
  tiers?: LivePricingTier[];
}

type PortalResponse = { url: string };
type ScanPackCheckoutResponse = {
  success?: boolean;
  data?: string;
  url?: string;
};

export default function BillingPage() {
  const token = useAuthStore((s) => s.token);
  const userTier = String(useAuthStore((s) => s.user?.tier || 'observer')).toLowerCase();
  const [searchParams] = useSearchParams();

  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [buyingPackKey, setBuyingPackKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [livePricing, setLivePricing] = useState<LivePricingTier[]>([]);
  const [loadingLivePricing, setLoadingLivePricing] = useState(true);
  const [creditLedger, setCreditLedger] = useState<CreditLedgerEntry[]>([]);
  const [loadingCreditLedger, setLoadingCreditLedger] = useState(false);
  const [exportingCreditLedger, setExportingCreditLedger] = useState(false);
  const { status: featureStatus, updatedAtLabel: featureStatusUpdatedAt } = useFeatureStatus();

  const packStatus = searchParams.get("pack");

  // Prefer API_URL if defined, otherwise same-origin.
  const baseUrl = useMemo(() => {
    const trimmed = (API_URL || "").trim();
    return trimmed ? trimmed.replace(/\/+$/, "") : "";
  }, []);

  const buildUrl = (path: string) => (baseUrl ? `${baseUrl}${path}` : path);

  const authHeaders = useMemo(() => {
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [token]);

  const fetchWithFallback = async (paths: string[], init: RequestInit) => {
    let lastResponse: Response | null = null;

    for (const path of paths) {
      const res = await fetch(buildUrl(path), init);
      lastResponse = res;

      if (res.status !== 404) {
        return res;
      }
    }

    return lastResponse;
  };

  const formatUsd = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: value % 1 === 0 ? 0 : 2,
    }).format(value);
  };

  const normalizeScanPacks = (input: unknown): ScanPack[] => {
    if (!Array.isArray(input)) return [];
    return input
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const candidate = entry as Record<string, unknown>;

        const scans = Number(candidate.scans ?? 0);
        const key = String(candidate.key ?? "").trim();
        if (!key || !Number.isFinite(scans) || scans <= 0) return null;

        const amountCentsRaw = candidate.amountCents ?? candidate.amount_cents;
        const amountUsdRaw = candidate.amountUsd ?? candidate.amount_usd;
        const amountCents = Number(amountCentsRaw ?? 0);
        const amountUsd = Number(amountUsdRaw ?? (Number.isFinite(amountCents) ? amountCents / 100 : 0));

        return {
          key,
          scans,
          effectiveScans: Number(candidate.effectiveScans ?? candidate.effective_scans ?? scans),
          bonusPercent: Number(candidate.bonusPercent ?? candidate.bonus_percent ?? 0),
          amountCents: Number.isFinite(amountCents) ? amountCents : undefined,
          amountUsd: Number.isFinite(amountUsd) ? amountUsd : undefined,
          stripeConfigured: Boolean(candidate.stripeConfigured ?? candidate.stripe_configured ?? true),
        } as ScanPack;
      })
      .filter((pack): pack is ScanPack => Boolean(pack));
  };

  const normalizeLivePricingTiers = useCallback((input: unknown): LivePricingTier[] => {
    if (!Array.isArray(input)) return [];

    return input
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const candidate = entry as Record<string, unknown>;
        const key = String(candidate.key || "").toLowerCase() as CanonicalTier;
        if (!key || !(key in CANONICAL_TIER_PRICING)) return null;

        const baseline = CANONICAL_TIER_PRICING[key];
        const pricing = (candidate.pricing && typeof candidate.pricing === "object")
          ? (candidate.pricing as Record<string, unknown>)
          : {};

        const monthlyAmount = Number((pricing.monthly as any)?.amount ?? baseline.monthlyUsd ?? 0);
        const yearlyAmount = Number((pricing.yearly as any)?.amount ?? baseline.yearlyUsd ?? 0);
        const oneTimeAmount = Number((pricing.one_time as any)?.amount ?? (pricing.oneTime as any)?.amount ?? baseline.oneTimeUsd ?? 0);

        const billingModelRaw = String(candidate.billingModel ?? candidate.billing_model ?? "").toLowerCase();
        const billingModel: TierBillingModel =
          billingModelRaw === "one_time" || billingModelRaw === "subscription" || billingModelRaw === "free"
            ? (billingModelRaw as TierBillingModel)
            : oneTimeAmount > 0
              ? "one_time"
              : monthlyAmount > 0 || yearlyAmount > 0
                ? "subscription"
                : baseline.billingModel;

        return {
          key,
          name: String(candidate.name || key),
          billingModel,
          pricing: {
            monthly: billingModel === "subscription" && monthlyAmount > 0
              ? { amount: monthlyAmount, formatted: `$${monthlyAmount}` }
              : null,
            yearly: billingModel === "subscription" && yearlyAmount > 0
              ? { amount: yearlyAmount, formatted: `$${yearlyAmount}` }
              : null,
            one_time: billingModel === "one_time" && oneTimeAmount > 0
              ? { amount: oneTimeAmount, formatted: `$${oneTimeAmount}` }
              : null,
          },
        } as LivePricingTier;
      })
      .filter((tier): tier is LivePricingTier => Boolean(tier));
  }, []);


  useEffect(() => {
    let cancelled = false;

    const fetchSubscription = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetchWithFallback(["/api/billing/subscription", "/api/payment/subscription"], {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders,
          },
          // Keep cookies for same-origin setups, harmless otherwise.
          credentials: "include",
        });

        if (!res) {
          throw new Error("Failed to fetch subscription (network)");
        }

        if (res.status === 401) {
          throw new Error("Please sign in to view billing.");
        }

        if (!res.ok) {
          throw new Error(`Failed to fetch subscription (${res.status})`);
        }

        const data = (await res.json()) as unknown;

        let rawPayload: Record<string, unknown> | null = null;
        if (data && typeof data === "object") {
          const obj = data as Record<string, unknown>;
          if (obj.data && typeof obj.data === "object") {
            rawPayload = obj.data as Record<string, unknown>;
          } else {
            rawPayload = obj;
          }
        }

        const subscriptionPayload: SubscriptionData | null = rawPayload && typeof rawPayload.planName === "string"
          ? {
              planName: rawPayload.planName,
              status: String(rawPayload.status || "active") as SubscriptionData["status"],
              currentPeriodEnd: rawPayload.currentPeriodEnd ? String(rawPayload.currentPeriodEnd) : null,
              packCreditsRemaining: Number(rawPayload.packCreditsRemaining || 0),
              referralCreditsEarnedTotal: Number(rawPayload.referralCreditsEarnedTotal || 0),
              totalAuditCreditsAvailable: Number(rawPayload.totalAuditCreditsAvailable ?? ((rawPayload.usage as any)?.remainingThisMonth || 0) + Number(rawPayload.packCreditsRemaining || 0)),
              usage: rawPayload.usage && typeof rawPayload.usage === "object"
                ? {
                    monthlyLimit: Number((rawPayload.usage as any).monthlyLimit || 0),
                    usedThisMonth: Number((rawPayload.usage as any).usedThisMonth || 0),
                    remainingThisMonth: Number((rawPayload.usage as any).remainingThisMonth || 0),
                  }
                : undefined,
              creditBonusPolicy: rawPayload.creditBonusPolicy && typeof rawPayload.creditBonusPolicy === "object"
                ? (rawPayload.creditBonusPolicy as CreditBonusPolicy)
                : undefined,
              initialTierBonus: rawPayload.initialTierBonus && typeof rawPayload.initialTierBonus === "object"
                ? (rawPayload.initialTierBonus as InitialTierBonusGrant)
                : null,
              scanPacks: normalizeScanPacks(rawPayload.scanPacks),
              trial: rawPayload.trial && typeof rawPayload.trial === "object"
                ? {
                    active: Boolean((rawPayload.trial as any).active),
                    endsAt: (rawPayload.trial as any).endsAt ? String((rawPayload.trial as any).endsAt) : null,
                    daysRemaining: Number((rawPayload.trial as any).daysRemaining || 0),
                    used: Boolean((rawPayload.trial as any).used),
                  }
                : undefined,
            }
          : null;

        if (!cancelled) setSubscription(subscriptionPayload);
      } catch (err) {
        if (cancelled) return;

        if (err instanceof Error) setError(err.message);
        else setError("Unexpected error occurred");
        setSubscription(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchSubscription();
    return () => {
      cancelled = true;
    };
  }, [authHeaders, baseUrl]);

  useEffect(() => {
    let cancelled = false;

    const fetchLivePricing = async () => {
      setLoadingLivePricing(true);

      try {
        const res = await fetchWithFallback(["/api/payment/pricing"], {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
        });

        if (!res || !res.ok) {
          throw new Error("Pricing unavailable");
        }

        const data = (await res.json()) as LivePricingResponse;
        const tiers = normalizeLivePricingTiers(data?.tiers);

        if (!cancelled) {
          setLivePricing(tiers);
        }
      } catch {
        if (!cancelled) {
          setLivePricing([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingLivePricing(false);
        }
      }
    };

    fetchLivePricing();
    return () => {
      cancelled = true;
    };
  }, [baseUrl, normalizeLivePricingTiers]);

  useEffect(() => {
    let cancelled = false;

    const fetchCreditLedger = async () => {
      setLoadingCreditLedger(true);
      try {
        const res = await fetchWithFallback(["/api/features/credits/ledger?limit=20"], {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders,
          },
          credentials: "include",
        });

        if (!res || !res.ok) throw new Error("Ledger unavailable");

        const payload = (await res.json().catch(() => ({}))) as { data?: { entries?: CreditLedgerEntry[] } };
        const entries = Array.isArray(payload?.data?.entries) ? payload.data!.entries! : [];
        if (!cancelled) setCreditLedger(entries);
      } catch {
        if (!cancelled) setCreditLedger([]);
      } finally {
        if (!cancelled) setLoadingCreditLedger(false);
      }
    };

    void fetchCreditLedger();
    return () => {
      cancelled = true;
    };
  }, [authHeaders, baseUrl]);

  const handleBuyScanPack = async (packKey: string) => {
    if (!packKey) return;

    setBuyingPackKey(packKey);
    setError(null);

    try {
      const res = await fetchWithFallback(["/api/billing/scan-pack/checkout", "/api/payment/scan-pack/checkout"], {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        credentials: "include",
        body: JSON.stringify({ packKey }),
      });

      if (!res) {
        throw new Error("Failed to create audit credit checkout session (network)");
      }

      if (res.status === 401) {
        throw new Error("Please sign in to buy audit credits.");
      }

      if (!res.ok) {
        let serverError = '';
        try {
          const body = await res.json();
          serverError = body?.error || body?.message || '';
        } catch { /* ignore */ }
        throw new Error(serverError || `Failed to create audit credit checkout session (${res.status})`);
      }

      const data = (await res.json()) as ScanPackCheckoutResponse;
      const checkoutUrl = data.url || data.data;
      if (!checkoutUrl) {
        throw new Error("Invalid checkout URL returned");
      }

      window.location.assign(checkoutUrl);
    } catch (err) {
      if (err instanceof Error) setError(err.message);
      else setError("Unexpected audit credit checkout error");
    } finally {
      setBuyingPackKey(null);
    }
  };

  const packCreditsRemaining = Number(subscription?.packCreditsRemaining || 0);
  const referralCreditsEarnedTotal = Number(subscription?.referralCreditsEarnedTotal || 0);
  const totalAuditCreditsAvailable = Number(
    subscription?.totalAuditCreditsAvailable
      ?? Number((subscription?.usage?.remainingThisMonth || 0) + packCreditsRemaining)
  );
  const formatCreditBalance = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(2));
  const formatLedgerReason = (reason: string) => {
    const raw = String(reason || "usage").replace(/_/g, " ").trim();
    return raw ? `${raw.charAt(0).toUpperCase()}${raw.slice(1)}` : "Usage";
  };
  const packCreditsLabel = formatCreditBalance(packCreditsRemaining);
  const totalAuditCreditsLabel = formatCreditBalance(totalAuditCreditsAvailable);
  const usageSnapshot = subscription?.usage || {
    monthlyLimit: Number(featureStatus?.usage?.monthlyLimit || 0),
    usedThisMonth: Number(featureStatus?.usage?.usedThisMonth || 0),
    remainingThisMonth: Number(featureStatus?.usage?.remainingThisMonth || 0),
  };
  const availableScanPacks = subscription?.scanPacks || [];
  const displayStatus = loading
    ? "loading"
    : subscription?.status
      ? String(subscription.status)
      : "not_active";
  const statusTone = displayStatus.toLowerCase();
  const statusClass =
    statusTone === "active" || statusTone === "trialing"
      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300/90"
      : statusTone === "past_due"
        ? "border-amber-400/30 bg-amber-500/10 text-amber-300/90"
        : statusTone === "loading"
          ? "border-white/20 bg-charcoal-light text-white/70"
          : "border-red-400/30 bg-red-500/10 text-red-300/90";

  const handleManageBilling = async () => {
    setWorking(true);
    setError(null);

    try {
      const res = await fetchWithFallback(["/api/billing/portal", "/api/payment/portal"], {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        credentials: "include",
      });

      if (!res) {
        throw new Error("Failed to create portal session (network)");
      }

      if (res.status === 401) {
        throw new Error("Please sign in to manage billing.");
      }

      if (!res.ok) {
        throw new Error(`Failed to create portal session (${res.status})`);
      }

      const data = (await res.json()) as PortalResponse | { data?: string };
      const portalUrl =
        data && typeof data === "object" && "url" in data
          ? (data as PortalResponse).url
          : (data as { data?: string }).data;

      if (!portalUrl) {
        throw new Error("Invalid portal URL returned");
      }

      window.location.assign(portalUrl);
    } catch (err) {
      if (err instanceof Error) setError(err.message);
      else setError("Unexpected billing error");
    } finally {
      setWorking(false);
    }
  };

  const handleExportCreditLedgerCsv = async () => {
    setExportingCreditLedger(true);
    setError(null);

    try {
      const res = await fetchWithFallback(["/api/features/credits/ledger?limit=200&format=csv"], {
        method: "GET",
        headers: {
          "Content-Type": "text/csv",
          ...authHeaders,
        },
        credentials: "include",
      });

      if (!res || !res.ok) {
        throw new Error(`Failed to export credit trail (${res?.status || "network"})`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `aivis-credit-usage-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      toast.success("Credit trail CSV exported");
    } catch (err: any) {
      setError(err?.message || "Failed to export credit trail");
    } finally {
      setExportingCreditLedger(false);
    }
  };

  usePageMeta({
    title: 'Billing & Subscription',
    description: 'Manage your AiVIS subscription, payment methods, invoices, and extra audit credit packs from one secure billing center.',
    path: '/billing',
    ogTitle: 'AiVIS Billing Center',
  });

  const navigate = useNavigate();

  return (
    <AppPageFrame
      icon={<CreditCard className="h-5 w-5 text-orange-400" />}
      title="Billing & Subscription"
      subtitle="Manage your subscription, invoices, credit packs, live usage, and automation access from one client-safe billing workspace."
      maxWidthClass="max-w-6xl"
    >
      <div>

        <div id="overview" className="section-anchor grid grid-cols-1 sm:grid-cols-4 gap-3 mb-5">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0 }} className="rounded-xl border border-white/10 bg-charcoal p-4 surface-structured hover:border-white/20 transition-colors">
            <p className="text-[11px] uppercase tracking-wide text-white/55 mb-1">Plan status</p>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-white/80" />
              <span className={`text-xs px-2 py-0.5 rounded-full border ${statusClass}`}>{displayStatus}</span>
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.06 }} className="rounded-xl border border-white/10 bg-charcoal p-4 surface-structured hover:border-white/20 transition-colors">
            <p className="text-[11px] uppercase tracking-wide text-white/55 mb-1">Current plan</p>
            <p className="text-sm font-semibold text-white">{subscription?.planName || 'No active plan'}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.12 }} className="rounded-xl border border-white/10 bg-charcoal p-4 surface-structured hover:border-white/20 transition-colors">
            <p className="text-[11px] uppercase tracking-wide text-white/55 mb-1">Audit capacity now</p>
            <p className="text-sm font-semibold text-white">{totalAuditCreditsLabel}</p>
            <p className="mt-1 text-[11px] text-white/45">
              {usageSnapshot.remainingThisMonth} monthly remaining + {packCreditsLabel} pack credits
            </p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.18 }} className="rounded-xl border border-violet-400/30 bg-violet-500/10 p-4 surface-structured-muted hover:border-violet-400/50 transition-colors">
            <p className="text-[11px] uppercase tracking-wide text-violet-200/90 mb-1">Referrals</p>
            <p className="text-sm font-semibold text-violet-100">+{referralCreditsEarnedTotal} earned</p>
            <Link to="/referrals" className="text-xs text-violet-100/80 hover:text-white transition-colors">Open Referral Hub</Link>
          </motion.div>
        </div>

        {/* Trial countdown banner */}
        {subscription?.trial?.active && subscription.trial.daysRemaining != null && (
          <div className={`rounded-xl border p-4 mb-5 flex items-center justify-between gap-4 ${
            (subscription.trial.daysRemaining ?? 0) <= 3
              ? "border-amber-400/30 bg-gradient-to-r from-amber-600/15 to-red-600/10"
              : "border-emerald-400/20 bg-gradient-to-r from-emerald-600/10 to-teal-600/10"
          }`}>
            <div className="flex items-center gap-3">
              <Clock className={`w-5 h-5 ${(subscription.trial.daysRemaining ?? 0) <= 3 ? "text-amber-400" : "text-emerald-400"}`} />
              <div>
                <p className="text-sm font-semibold text-white">
                  Signal Trial — {subscription.trial.daysRemaining} day{subscription.trial.daysRemaining !== 1 ? "s" : ""} remaining
                </p>
                <p className="text-xs text-white/55">
                  {subscription.trial.endsAt
                    ? `Expires ${new Date(subscription.trial.endsAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}`
                    : "Subscribe to keep Signal features after the trial ends."}
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate("/pricing")}
              className="px-4 py-2 bg-gradient-to-r from-white/28 to-white/14 text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity whitespace-nowrap"
              type="button"
            >
              Subscribe Now
            </button>
          </div>
        )}

        {/* Trial expired notice */}
        {subscription?.trial?.used && !subscription.trial.active && (
          <div className="rounded-xl border border-red-400/20 bg-red-500/8 p-4 mb-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-red-400" />
              <div>
                <p className="text-sm font-semibold text-white">Signal Trial Expired</p>
                <p className="text-xs text-white/55">Your free trial has ended. Subscribe to restore Signal-tier features and limits.</p>
              </div>
            </div>
            <button
              onClick={() => navigate("/pricing")}
              className="px-4 py-2 bg-gradient-to-r from-white/28 to-white/14 text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity whitespace-nowrap"
              type="button"
            >
              View Plans
            </button>
          </div>
        )}

        <motion.div id="usage" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.24 }} className="section-anchor rounded-xl border border-white/10 bg-charcoal p-4 mb-5 surface-structured">
          <p className="text-[11px] uppercase tracking-wide text-white/55 mb-1">Real-time credit usage</p>
          <p className="text-sm text-white font-semibold">
            {usageSnapshot.usedThisMonth}/{usageSnapshot.monthlyLimit} audits used • {usageSnapshot.remainingThisMonth} audits remaining this month
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/5">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-amber-400/80 to-amber-500/40"
              initial={{ width: 0 }}
              animate={{ width: `${usageSnapshot.monthlyLimit > 0 ? Math.min(100, (usageSnapshot.usedThisMonth / usageSnapshot.monthlyLimit) * 100) : 0}%` }}
              transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
            />
          </div>
          <p className="text-xs text-white/60 mt-1">
            Usage updates after each audit and includes live tier limits. Current credit balance: <span className="text-amber-300 font-semibold">{packCreditsLabel}</span>.
          </p>
          {featureStatusUpdatedAt ? (
            <p className="text-[11px] text-white/50 mt-2">Last synced {featureStatusUpdatedAt}</p>
          ) : null}
        </motion.div>

        <div id="automation" className="section-anchor rounded-xl border border-white/10 bg-charcoal p-4 mb-5 surface-structured">
          <div className="flex items-center justify-between gap-3 mb-3">
            <p className="text-sm font-semibold text-white">Automation & API</p>
            <Link
              to="/app/settings?section=advanced"
              className="text-xs px-3 py-1 rounded-full border border-white/12 bg-charcoal-light text-white/80 hover:text-white transition-colors"
            >
              Open Advanced
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="rounded-lg border border-white/10 bg-charcoal-light/45 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-white/55">Scheduled rescans</p>
              <p className="text-sm text-white font-medium">
                {featureStatus?.features?.scheduledRescans?.available
                  ? `${Number(featureStatus?.features?.scheduledRescans?.count || 0)} active schedules`
                  : "Not available on current tier"}
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-charcoal-light/45 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-white/55">API access</p>
              <p className="text-sm text-white font-medium">
                {featureStatus?.features?.apiAccess?.available
                  ? `${Number(featureStatus?.features?.apiAccess?.keyCount || 0)} API keys`
                  : "Not available on current tier"}
              </p>
            </div>
          </div>
          <p className="text-xs text-white/55 mt-2">
            Values are loaded from live feature status and workspace-scoped configuration
            {featureStatusUpdatedAt ? ` • Updated ${featureStatusUpdatedAt}` : ""}.
          </p>
        </div>

        <div className="p-6 border border-white/14 dark:border-white/10 rounded-2xl bg-charcoal dark:bg-charcoal-deep shadow-sm surface-structured">
          {loading && (
            <div className="flex items-center gap-2 text-white/60 dark:text-white/55">
              <CreditCard className="w-4 h-4" />
              <p>Loading billing profile…</p>
            </div>
          )}

          {!loading && !error && packStatus === "success" && (
            <p className="mb-4 text-sm text-emerald-300/90 border border-emerald-400/25 bg-emerald-500/10 rounded-lg px-3 py-2">
              Audit credits purchased successfully. Your new credits are ready to use.
            </p>
          )}

          {!loading && !error && packStatus === "cancel" && (
            <p className="mb-4 text-sm text-white/75 border border-white/10 bg-charcoal-light rounded-lg px-3 py-2">
              Audit credit checkout was canceled.
            </p>
          )}

          {!loading && error && <p className="text-white/80 border border-red-400/25 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}

          {!loading && !error && subscription && (
            <>
              <div className="mb-5 space-y-1.5 rounded-xl border border-white/10 bg-charcoal-light p-4">
                <p className="text-lg font-semibold flex items-center gap-2">
                  <WalletCards className="w-4 h-4 text-white/80" />
                  Plan: {subscription.planName}
                </p>
                <p className="text-sm text-white/60 dark:text-white/55">
                  Status: {subscription.status}
                </p>
                <p className="text-sm text-white/60 dark:text-white/55">
                  Renews on:{" "}
                  {subscription.currentPeriodEnd
                    ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
                    : "Not applicable"}
                </p>
                <p className="text-sm text-white/60 dark:text-white/55">
                  Pack credits wallet: {packCreditsLabel}
                </p>
                <p className="text-sm text-white/60 dark:text-white/55">
                  Total audits available now: {formatCreditBalance(totalAuditCreditsAvailable)}
                </p>
                <p className="text-sm text-violet-200/90">
                  Referral credits earned: +{referralCreditsEarnedTotal}. Program details and invite controls are managed in Referral Hub.
                </p>
              </div>

              {subscription.initialTierBonus ? (
                <div className="mb-5 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4">
                  <p className="text-sm font-semibold text-emerald-200">Initial tier bonus applied</p>
                  <p className="text-xs text-emerald-100/90 mt-1">
                    {subscription.initialTierBonus.tier} ({subscription.initialTierBonus.billingPeriod}) awarded +{subscription.initialTierBonus.totalCreditsAdded} credits
                    (base {subscription.initialTierBonus.baseCredits} + bonus {subscription.initialTierBonus.bonusCredits} at {subscription.initialTierBonus.bonusPercent}%).
                  </p>
                  {subscription.initialTierBonus.milestoneQualified ? (
                    <p className="text-xs text-emerald-100 mt-1">
                      Milestone achieved: annual upgrade completed inside the first {Math.round(subscription.initialTierBonus.milestoneWindowMinutes / 60)} hours.
                    </p>
                  ) : null}
                </div>
              ) : null}

              <button
                onClick={handleManageBilling}
                type="button"
                disabled={working}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-charcoal-light hover:bg-charcoal disabled:opacity-60 text-white transition border border-white/10"
              >
                <Receipt className="w-4 h-4" />
                {working ? "Opening…" : "Manage Billing"}
              </button>

              <p className="mt-3 text-xs text-white/55">
                Manage Billing opens your secure Stripe customer portal for payment methods, invoices, and subscription changes.
              </p>

              <div id="pricing" className="section-anchor mt-6 pt-5 border-t border-white/10">
                <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-white/80" />
                  Live Stripe Plan Prices
                </h2>

                {loadingLivePricing ? (
                  <p className="text-white/60 dark:text-white/55 text-sm">Loading live plan pricing…</p>
                ) : livePricing.length === 0 ? (
                  <p className="text-white/60 dark:text-white/55 text-sm">Live plan pricing is temporarily unavailable.</p>
                ) : (
                  <div className="space-y-2.5">
                    {livePricing.map((tier) => {
                      const monthlyAmount = Number(tier.pricing?.monthly?.amount ?? 0);
                      const yearlyAmount = Number(tier.pricing?.yearly?.amount ?? 0);
                      const oneTimeAmount = Number(tier.pricing?.one_time?.amount ?? 0);
                      const billingModel = tier.billingModel || (oneTimeAmount > 0 ? 'one_time' : monthlyAmount > 0 ? 'subscription' : 'free');
                      const isCurrentPlan = subscription?.planName?.toLowerCase().includes(tier.key.toLowerCase());

                      const pricingLabel = billingModel === 'one_time'
                        ? (oneTimeAmount > 0 ? `${formatUsd(oneTimeAmount)} one-time` : 'One-time pricing unavailable')
                        : billingModel === 'subscription'
                          ? `${monthlyAmount > 0 ? `${formatUsd(monthlyAmount)}/mo` : 'N/A'} • ${yearlyAmount > 0 ? `${formatUsd(yearlyAmount)}/yr` : 'No annual option'}`
                          : 'Free';

                      return (
                        <div
                          key={tier.key}
                          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl border border-white/10 bg-charcoal-light/45 px-4 py-3"
                        >
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-white">{tier.name}</p>
                            {isCurrentPlan && (
                              <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border border-white/20 bg-charcoal-light text-white/75">Current</span>
                            )}
                          </div>
                          <p className="text-xs text-white/70">{pricingLabel}</p>
                        </div>
                      );
                    })}
                  </div>
                )}

                <p className="mt-3 text-xs text-white/55">Values are loaded from the live Stripe-backed pricing endpoint.</p>
              </div>

              <div id="packs" className="section-anchor mt-6 pt-5 border-t border-white/10">
                <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-white/80" />
                  Buy Extra Audit Credits
                </h2>
                <p className="text-xs text-white/60 mb-3">
                  Total audit credits available now: <span className="text-white/80 font-semibold">{formatCreditBalance(totalAuditCreditsAvailable)}</span>
                </p>
                <p className="text-xs text-white/55 mb-4 rounded-lg border border-white/10 bg-white/5 p-3">
                  <strong className="text-white/75">Note:</strong> These are audit credits for {userTier === 'signal' ? 'Signal' : userTier === 'alignment' ? 'Alignment' : 'your tier'}. Score Fix has a separate tier and credit pool.
                </p>
                {userTier === 'observer' ? (
                  <p className="text-sm text-white/70 rounded-xl border border-white/10 bg-charcoal-light/45 px-4 py-3">
                    Observer tier cannot purchase extra audit credits. Upgrade to Alignment, Signal, or Score Fix to unlock credit packs.
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-white/60 mb-3">
                      Credit packs and bonus multipliers are shown live at checkout.
                      Signal gets +20% pack credits, Score Fix gets +40% pack credits automatically.
                    </p>
                    {subscription.creditBonusPolicy?.initialTierBonus ? (
                      <p className="text-xs text-white/55 mb-3">
                        Initial tier bonuses (one-time): Signal +{subscription.creditBonusPolicy.initialTierBonus.signal?.monthlyPercent}% monthly / +{subscription.creditBonusPolicy.initialTierBonus.signal?.yearlyPercent}% annual,
                        Score Fix +{subscription.creditBonusPolicy.initialTierBonus.scorefix?.monthlyPercent}% monthly / +{subscription.creditBonusPolicy.initialTierBonus.scorefix?.yearlyPercent}% annual.
                        Annual upgrades inside {subscription.creditBonusPolicy.initialTierBonus.milestoneWindowHours} hours are tracked as milestone purchases.
                      </p>
                    ) : null}
                    {availableScanPacks.length === 0 ? (
                      <p className="text-white/60 dark:text-white/55 text-sm">
                        No audit credit packs are available right now.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {availableScanPacks.map((pack) => {
                          const packPrice = Number(pack.amountUsd ?? 0);
                          const effectiveScans = Number(pack.effectiveScans || pack.scans || 0);
                          const bonusPercent = Number(pack.bonusPercent || 0);
                          const buttonLabel = Number.isFinite(packPrice) && packPrice > 0
                            ? `Buy ${effectiveScans} audits: ${formatUsd(packPrice)}`
                            : `Buy ${effectiveScans} audits`;

                          return (
                            <div
                              key={pack.key}
                              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-white/10 bg-charcoal-light/45 px-4 py-3"
                            >
                              <div>
                                <p className="text-sm font-medium text-white">
                                  {effectiveScans} extra audits
                                  {bonusPercent > 0 ? (
                                    <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full border border-amber-400/30 bg-amber-500/10 text-amber-300/90">
                                      +{bonusPercent}% tier boost
                                    </span>
                                  ) : null}
                                </p>
                                <p className="text-xs text-white/60">
                                  Base {pack.scans} audits • one-time top-up, never expires
                                </p>
                              </div>
                              <button
                                type="button"
                                disabled={!pack.stripeConfigured || buyingPackKey === pack.key}
                                onClick={() => handleBuyScanPack(pack.key)}
                                className="px-4 py-2 rounded-full bg-charcoal hover:bg-charcoal disabled:opacity-60 text-white text-sm transition border border-white/10"
                              >
                                {buyingPackKey === pack.key
                                  ? "Opening…"
                                  : !pack.stripeConfigured
                                    ? "Unavailable"
                                    : buttonLabel}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div id="credit-trail" className="section-anchor mt-6 pt-5 border-t border-white/10">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-white/80" />
                    Credit Spend Trail
                  </h2>
                  <button
                    type="button"
                    onClick={() => void handleExportCreditLedgerCsv()}
                    disabled={exportingCreditLedger}
                    className="text-xs px-3 py-1.5 rounded-full border border-white/10 bg-charcoal-light text-white/80 hover:text-white disabled:opacity-60"
                  >
                    {exportingCreditLedger ? "Exporting…" : "Export CSV"}
                  </button>
                </div>
                <p className="text-xs text-white/60 mb-3">
                  Every credit add/spend is tracked with purpose and resulting balance for auditability.
                </p>

                {loadingCreditLedger ? (
                  <p className="text-sm text-white/60">Loading credit activity…</p>
                ) : creditLedger.length === 0 ? (
                  <p className="text-sm text-white/60">No credit activity yet.</p>
                ) : (
                  <div className="space-y-2">
                    {creditLedger.slice(0, 10).map((entry) => {
                      const delta = Number(entry.delta_credits || 0);
                      const positive = delta > 0;
                      const createdAt = entry.created_at ? new Date(entry.created_at) : null;
                      const createdLabel = createdAt && !Number.isNaN(createdAt.getTime())
                        ? createdAt.toLocaleString()
                        : "Unknown time";

                      return (
                        <div
                          key={entry.id}
                          className="rounded-xl border border-white/10 bg-charcoal-light/45 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                        >
                          <div>
                            <p className="text-sm text-white font-medium">{formatLedgerReason(entry.reason)}</p>
                            <p className="text-xs text-white/60">{createdLabel}</p>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-semibold ${positive ? "text-emerald-300" : "text-amber-300"}`}>
                              {positive ? "+" : ""}{formatCreditBalance(delta)}
                            </p>
                            <p className="text-xs text-white/60">Balance {formatCreditBalance(Number(entry.balance_after || 0))}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </>
          )}

          {!loading && !error && !subscription && (
            <p className="text-white/60 dark:text-white/55 rounded-lg border border-white/10 bg-charcoal-light px-3 py-2">
              No active subscription found.
            </p>
          )}
        </div>

        <div className="mt-5 rounded-xl border border-white/10 bg-charcoal/45 p-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-white/65">Need to compare plans before upgrading?</p>
          <div className="flex items-center gap-2">
            <Link
              to="/pricing#plans"
              className="text-xs px-3 py-1.5 rounded-full border border-white/10 bg-charcoal-light text-white/80 hover:text-white transition-colors"
            >
              View Pricing
            </Link>
            <Link
              to="/"
              className="text-xs px-3 py-1.5 rounded-full border border-white/10 bg-charcoal-light text-white/80 hover:text-white transition-colors"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>

        {/* ─── Usage Value Analytics ───────────────────────────────────── */}
        <div id="usage-value" className="section-anchor mt-6 rounded-2xl border border-white/10 bg-charcoal p-5 surface-structured">
          <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            Usage &amp; Value Summary
          </h2>
          <p className="text-xs text-white/50 mb-4">How your subscription translates to real audit value.</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="rounded-xl border border-white/10 bg-charcoal-light/45 p-3 text-center">
              <p className="text-[10px] uppercase tracking-wide text-white/45 mb-1">Audits used</p>
              <p className="text-lg font-bold text-white">{usageSnapshot.usedThisMonth}</p>
              <p className="text-[10px] text-white/40">of {usageSnapshot.monthlyLimit} this month</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-charcoal-light/45 p-3 text-center">
              <p className="text-[10px] uppercase tracking-wide text-white/45 mb-1">Effective cost / audit</p>
              <p className="text-lg font-bold text-emerald-300">
                {(() => {
                  const tierKey = userTier as CanonicalTier;
                  const tierData = CANONICAL_TIER_PRICING[tierKey];
                  if (!tierData || tierData.monthlyUsd === 0) return "Free";
                  const monthlyPrice = tierData.billingModel === "one_time"
                    ? (tierData.oneTimeUsd || 0)
                    : tierData.monthlyUsd;
                  const limit = usageSnapshot.monthlyLimit || 1;
                  const costPerAudit = monthlyPrice / limit;
                  return `$${costPerAudit.toFixed(2)}`;
                })()}
              </p>
              <p className="text-[10px] text-white/40">based on plan allowance</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-charcoal-light/45 p-3 text-center">
              <p className="text-[10px] uppercase tracking-wide text-white/45 mb-1">Credits remaining</p>
              <p className="text-lg font-bold text-amber-300">{formatCreditBalance(totalAuditCreditsAvailable)}</p>
              <p className="text-[10px] text-white/40">monthly + pack credits</p>
            </div>
          </div>

          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
            <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">What each audit includes</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                "50+ AI-readiness signals",
                "Schema & entity analysis",
                "Technical SEO check",
                "8–12 recommendations",
                "Keyword intelligence",
                "Content authority score",
                "Multi-model AI pipeline",
                "Exportable report",
              ].map((item) => (
                <div key={item} className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400/70 mt-0.5 flex-shrink-0" />
                  <span className="text-[11px] text-white/55 leading-tight">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ─── Platform Cost Comparison ───────────────────────────────── */}
        <div id="cost-comparison" className="section-anchor mt-6 rounded-2xl border border-cyan-400/15 bg-gradient-to-br from-cyan-500/5 to-blue-500/5 p-5">
          <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            How AiVIS Compares
          </h2>
          <p className="text-xs text-white/50 mb-5">Estimated monthly cost for comparable AI visibility capabilities on other platforms — if they even offer them.</p>

          {/* Comparison Table */}
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-white/40">
                  <th className="pb-2 pr-3 font-medium">Capability</th>
                  <th className="pb-2 px-3 font-medium text-center">AiVIS</th>
                  <th className="pb-2 px-3 font-medium text-center">Otterly.ai</th>
                  <th className="pb-2 px-3 font-medium text-center">Profound</th>
                  <th className="pb-2 px-3 font-medium text-center">Re:audit</th>
                </tr>
              </thead>
              <tbody className="text-white/65">
                {[
                  { cap: "AI visibility audits", aivis: true, aivisCost: "Included", otterly: true, otterlyCost: "$149+/mo", profound: true, profoundCost: "$99+/mo", reaudit: true, reauditCost: "$79+/mo" },
                  { cap: "Multi-model AI pipeline", aivis: true, aivisCost: "Included", otterly: false, otterlyCost: "—", profound: false, profoundCost: "—", reaudit: false, reauditCost: "—" },
                  { cap: "Triple-check validation", aivis: true, aivisCost: "Signal+", otterly: false, otterlyCost: "—", profound: false, profoundCost: "—", reaudit: false, reauditCost: "—" },
                  { cap: "Citation testing (4 AI engines)", aivis: true, aivisCost: "Signal+", otterly: true, otterlyCost: "$149+/mo", profound: false, profoundCost: "—", reaudit: false, reauditCost: "—" },
                  { cap: "Brand mention tracking (15 sources)", aivis: true, aivisCost: "Alignment+", otterly: false, otterlyCost: "—", profound: false, profoundCost: "—", reaudit: false, reauditCost: "—" },
                  { cap: "Competitor tracking", aivis: true, aivisCost: "Alignment+", otterly: true, otterlyCost: "$149+/mo", profound: true, profoundCost: "$99+/mo", reaudit: false, reauditCost: "—" },
                  { cap: "Reverse engineer AI answers", aivis: true, aivisCost: "Alignment+", otterly: false, otterlyCost: "—", profound: false, profoundCost: "—", reaudit: false, reauditCost: "—" },
                  { cap: "MCP protocol (AI agent access)", aivis: true, aivisCost: "Alignment+", otterly: false, otterlyCost: "—", profound: false, profoundCost: "—", reaudit: false, reauditCost: "—" },
                  { cap: "Niche URL discovery", aivis: true, aivisCost: "Alignment+", otterly: false, otterlyCost: "—", profound: false, profoundCost: "—", reaudit: false, reauditCost: "—" },
                  { cap: "Scheduled rescans & webhooks", aivis: true, aivisCost: "Alignment+", otterly: true, otterlyCost: "$149+/mo", profound: false, profoundCost: "—", reaudit: true, reauditCost: "$79+/mo" },
                  { cap: "REST API + OAuth 2.0", aivis: true, aivisCost: "Alignment+", otterly: false, otterlyCost: "—", profound: false, profoundCost: "—", reaudit: false, reauditCost: "—" },
                  { cap: "Automated PR generation (AutoPR)", aivis: true, aivisCost: "Score Fix", otterly: false, otterlyCost: "—", profound: false, profoundCost: "—", reaudit: false, reauditCost: "—" },
                ].map((row) => (
                  <tr key={row.cap} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="py-2 pr-3 text-white/75 font-medium">{row.cap}</td>
                    <td className="py-2 px-3 text-center">
                      {row.aivis ? (
                        <span className="inline-flex items-center gap-1 text-emerald-300/90">
                          <CheckCircle2 className="w-3 h-3" />
                          <span className="text-[10px]">{row.aivisCost}</span>
                        </span>
                      ) : (
                        <XIcon className="w-3 h-3 text-white/25 mx-auto" />
                      )}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {row.otterly ? (
                        <span className="text-amber-300/80 text-[10px]">{row.otterlyCost}</span>
                      ) : (
                        <XIcon className="w-3 h-3 text-white/25 mx-auto" />
                      )}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {row.profound ? (
                        <span className="text-amber-300/80 text-[10px]">{row.profoundCost}</span>
                      ) : (
                        <XIcon className="w-3 h-3 text-white/25 mx-auto" />
                      )}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {row.reaudit ? (
                        <span className="text-amber-300/80 text-[10px]">{row.reauditCost}</span>
                      ) : (
                        <XIcon className="w-3 h-3 text-white/25 mx-auto" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 rounded-xl border border-white/8 bg-white/[0.02] p-3">
            <p className="text-[11px] text-white/55 leading-relaxed">
              <strong className="text-white/70">Bottom line:</strong>{" "}
              To match what AiVIS Signal offers at $149/mo, you'd need multiple subscriptions totaling $300–$500+/mo — and you still wouldn't get MCP protocol access, reverse-engineering tools, brand mention tracking, niche discovery, or automated PR generation. Most platforms don't even offer multi-model validation or citation testing.
            </p>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Link to="/compare/aivis-vs-otterly" className="inline-flex items-center gap-1 text-[11px] px-3 py-1.5 rounded-full border border-white/10 bg-charcoal-light text-white/70 hover:text-white transition-colors">
              AiVIS vs Otterly <ExternalLink className="w-3 h-3" />
            </Link>
            <Link to="/compare/aivis-vs-profound" className="inline-flex items-center gap-1 text-[11px] px-3 py-1.5 rounded-full border border-white/10 bg-charcoal-light text-white/70 hover:text-white transition-colors">
              AiVIS vs Profound <ExternalLink className="w-3 h-3" />
            </Link>
            <Link to="/compare/aivis-vs-reaudit" className="inline-flex items-center gap-1 text-[11px] px-3 py-1.5 rounded-full border border-white/10 bg-charcoal-light text-white/70 hover:text-white transition-colors">
              AiVIS vs Re:audit <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* ─── Secure Stripe Connection ───────────────────────────────── */}
        <div id="stripe-security" className="section-anchor mt-6 rounded-2xl border border-emerald-400/15 bg-gradient-to-br from-emerald-500/5 to-teal-500/5 p-5">
          <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Secure Payment Connection
          </h2>
          <p className="text-xs text-white/50 mb-3">Your billing is handled entirely through Stripe — AiVIS never sees or stores your card details.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-start gap-2.5 rounded-xl border border-white/8 bg-white/[0.02] p-3">
              <ShieldCheck className="w-4 h-4 text-emerald-400/80 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-white/80">PCI DSS Level 1</p>
                <p className="text-[10px] text-white/45">Stripe is certified to the highest PCI compliance level</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5 rounded-xl border border-white/8 bg-white/[0.02] p-3">
              <ShieldCheck className="w-4 h-4 text-emerald-400/80 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-white/80">End-to-end encryption</p>
                <p className="text-[10px] text-white/45">All payment data is encrypted in transit and at rest</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5 rounded-xl border border-white/8 bg-white/[0.02] p-3">
              <ShieldCheck className="w-4 h-4 text-emerald-400/80 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-white/80">No card storage on AiVIS</p>
                <p className="text-[10px] text-white/45">Payment methods managed exclusively through Stripe portal</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5 rounded-xl border border-white/8 bg-white/[0.02] p-3">
              <ShieldCheck className="w-4 h-4 text-emerald-400/80 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-white/80">Webhook signature verification</p>
                <p className="text-[10px] text-white/45">All Stripe events verified via HMAC before processing</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppPageFrame>
  );
}