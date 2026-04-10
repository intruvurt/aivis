import React, { useEffect, useState, useMemo } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  Shield,
  Zap,
  Calendar,
  BarChart3,
  Settings,
  CreditCard,
  LogOut,
  Copy,
  Share2,
  BookOpen,
  Terminal,
  Link2,
  ChevronRight,
} from "lucide-react";
import { useAuthStore } from "../stores/authStore";
import { API_URL } from "../config";
import useFeatureStatus from "../hooks/useFeatureStatus";
import { buildReferralInviteLink, shareReferralInvite } from "../utils/referralShare";
import { getDisplayAvatarUrl, getIdentityInitials } from "../utils/userIdentity";
import { getTierDisplayName, getTierPositioning, getTierAudience, TIER_LIMITS } from "../../../shared/types";
import type { CanonicalTier } from "../../../shared/types";

interface ReferralSummaryData {
  code: string;
  stats: {
    pending: number;
    granted: number;
    totalReferrals: number;
    totalCreditsEarned: number;
  };
  constants: {
    creditsToReferrer: number;
    creditsToReferred: number;
    requiredAuditsForReward?: number;
    paidRewardMultiplier?: number;
  };
}

export default function ProfilePage() {
  const { isAuthenticated, user, token, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [referralSummary, setReferralSummary] = useState<ReferralSummaryData | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [inviteCopyMessage, setInviteCopyMessage] = useState('');
  const { status: featureStatus, updatedAtLabel: featureStatusUpdatedAt } = useFeatureStatus();

  if (!isAuthenticated || !user) {
    const redirectTarget = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/auth?mode=signin&redirect=${encodeURIComponent(redirectTarget)}`} replace />;
  }

  const handleShareInvite = async () => {
    if (!referralSummary) return;
    const result = await shareReferralInvite({
      referralCode: referralSummary.code,
      creditsToReferrer: referralSummary.constants.creditsToReferrer,
      creditsToReferred: referralSummary.constants.creditsToReferred,
      requiredAuditsForReward: referralSummary.constants.requiredAuditsForReward,
      paidRewardMultiplier: referralSummary.constants.paidRewardMultiplier,
    });

    if (result === "failed") {
      window.alert("Sharing is unavailable on this device right now.");
    }
  };

  const handleCopyInviteLink = async () => {
    if (!referralSummary) return;
    const inviteLink = buildReferralInviteLink(referralSummary.code);

    try {
      await navigator.clipboard.writeText(inviteLink);
      setInviteCopied(true);
      setInviteCopyMessage('Invite link copied - thanks for sharing AiVIS.');
      window.setTimeout(() => setInviteCopied(false), 2000);
    } catch {
      setInviteCopied(false);
      window.alert("We couldn’t copy automatically on this browser. Please copy the invite link manually from your profile.");
    }
  };

  useEffect(() => {
    let cancelled = false;

    const fetchReferralSummary = async () => {
      try {
        const base = (API_URL || "").replace(/\/+$/, "");
        const res = await fetch(`${base}/api/auth/referral/me`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: "include",
        });

        if (!res.ok) return;
        const raw = await res.json().catch(() => ({}));
        const payload = raw?.data ?? raw;
        if (!payload || typeof payload !== "object") return;

        if (!cancelled) {
          setReferralSummary(payload as ReferralSummaryData);
        }
      } catch {
        if (!cancelled) {
          setReferralSummary(null);
        }
      }
    };

    fetchReferralSummary();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const tierKey = (user.tier || "observer") as CanonicalTier;
  const tierDisplay = getTierDisplayName(tierKey);
  const tierPositioning = getTierPositioning(tierKey);
  const tierAudience = getTierAudience(tierKey);
  const limits = TIER_LIMITS[tierKey];

  const TIER_COLORS: Record<CanonicalTier, { bg: string; border: string; text: string; badge: string; ring: string }> = {
    observer: { bg: "from-emerald-500/15 to-emerald-700/5", border: "border-emerald-400/25", text: "text-emerald-300", badge: "bg-emerald-500/20 text-emerald-200 border-emerald-400/30", ring: "text-emerald-400" },
    starter: { bg: "from-teal-500/15 to-teal-700/5", border: "border-teal-400/25", text: "text-teal-300", badge: "bg-teal-500/20 text-teal-200 border-teal-400/30", ring: "text-teal-400" },
    alignment: { bg: "from-indigo-500/15 to-indigo-700/5", border: "border-indigo-400/25", text: "text-indigo-300", badge: "bg-indigo-500/20 text-indigo-200 border-indigo-400/30", ring: "text-indigo-400" },
    signal: { bg: "from-cyan-500/15 to-cyan-700/5", border: "border-cyan-400/25", text: "text-cyan-300", badge: "bg-cyan-500/20 text-cyan-200 border-cyan-400/30", ring: "text-cyan-400" },
    scorefix: { bg: "from-amber-500/15 to-amber-700/5", border: "border-amber-400/25", text: "text-amber-300", badge: "bg-amber-500/20 text-amber-200 border-amber-400/30", ring: "text-amber-400" },
  };
  const tc = TIER_COLORS[tierKey];

  const usageUsed = featureStatus?.usage?.usedThisMonth ?? 0;
  const usageLimit = featureStatus?.usage?.monthlyLimit ?? limits.scansPerMonth;
  const usageRemaining = featureStatus?.usage?.remainingThisMonth ?? (usageLimit - usageUsed);
  const usagePct = usageLimit > 0 ? Math.min(100, Math.round((usageUsed / usageLimit) * 100)) : 0;

  const memberDays = useMemo(() => {
    if (!user.created_at) return null;
    const diff = Date.now() - new Date(user.created_at).getTime();
    return Math.max(1, Math.floor(diff / 86400000));
  }, [user.created_at]);

  const initials = useMemo(() => {
    return getIdentityInitials(user);
  }, [user]);
  const avatarUrl = useMemo(() => getDisplayAvatarUrl(user), [user]);

  return (
    <div className="space-y-6 text-white">
      {/* ──── Profile Hero Card ──── */}
      <div className={`relative overflow-hidden rounded-2xl border ${tc.border} bg-charcoal-deep`}>
        <div className={`absolute inset-0 bg-gradient-to-r ${tc.bg} opacity-60 pointer-events-none`} />
        <div className="relative px-6 py-6">
          <div className="flex items-start gap-5">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Profile photo"
                  className={`h-20 w-20 rounded-2xl object-cover ring-2 ${tc.ring} ring-offset-2 ring-offset-charcoal-deep`}
                />
              ) : (
                <div className={`flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br ${tc.bg} ring-2 ${tc.ring} ring-offset-2 ring-offset-charcoal-deep text-2xl font-bold ${tc.text}`}>
                  {initials}
                </div>
              )}
              <span className={`absolute -bottom-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-lg border ${tc.badge}`}>
                <Shield className="h-3.5 w-3.5" />
              </span>
            </div>

            {/* Identity */}
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold tracking-tight truncate">
                {user.full_name || user.display_name || user.email.split("@")[0]}
              </h1>
              <p className="mt-0.5 text-sm text-white/55 truncate">{user.email}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tc.badge}`}>
                  <Zap className="h-3 w-3" /> {tierDisplay}
                </span>
                {memberDays && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-white/60">
                    <Calendar className="h-3 w-3" /> Member for {memberDays > 365 ? `${Math.floor(memberDays / 365)}y ${Math.floor((memberDays % 365) / 30)}mo` : memberDays > 30 ? `${Math.floor(memberDays / 30)} months` : `${memberDays} days`}
                  </span>
                )}
              </div>
              <p className="mt-2 text-xs text-white/45 leading-relaxed max-w-md">{tierPositioning}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* ──── Usage & Quick Stats ──── */}
        <div className="grid gap-4 sm:grid-cols-3">
          {/* Usage ring card */}
          <div className={`sm:col-span-2 rounded-2xl border ${tc.border} bg-charcoal-deep/50 p-5`}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white/80 flex items-center gap-1.5">
                <BarChart3 className={`h-4 w-4 ${tc.text}`} /> Monthly Usage
              </h2>
              <span className="text-xs text-white/45">{usageUsed} / {usageLimit} scans</span>
            </div>
            <div className="relative h-3 rounded-full bg-white/8 overflow-hidden">
              <div
                className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${
                  usagePct >= 90 ? "bg-red-500" : usagePct >= 70 ? "bg-amber-500" : `bg-gradient-to-r ${tc.bg.replace("/15", "/60").replace("/5", "/40")}`
                }`}
                style={{ width: `${usagePct}%` }}
              />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-white/8 bg-charcoal-light/40 px-3 py-2 text-center">
                <p className="text-lg font-bold">{usageRemaining}</p>
                <p className="text-[10px] uppercase tracking-wide text-white/50">Remaining</p>
              </div>
              <div className="rounded-lg border border-white/8 bg-charcoal-light/40 px-3 py-2 text-center">
                <p className="text-lg font-bold">{limits.competitors}</p>
                <p className="text-[10px] uppercase tracking-wide text-white/50">Competitors</p>
              </div>
              <div className="rounded-lg border border-white/8 bg-charcoal-light/40 px-3 py-2 text-center">
                <p className="text-lg font-bold">{limits.pagesPerScan}</p>
                <p className="text-[10px] uppercase tracking-wide text-white/50">Pages/Scan</p>
              </div>
            </div>
          </div>

          {/* Tier summary card */}
          <div className={`rounded-2xl border ${tc.border} bg-gradient-to-br ${tc.bg} p-5 flex flex-col justify-between`}>
            <div>
              <p className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${tc.text}`}>Running Plan</p>
              <p className="mt-1 text-lg font-bold">{tierDisplay}</p>
              <p className="mt-1.5 text-xs text-white/55 leading-relaxed">{tierAudience}</p>
            </div>
            <Link
              to="/pricing"
              className={`mt-4 inline-flex items-center gap-1 text-xs font-medium ${tc.text} hover:underline`}
            >
              {tierKey === "scorefix" ? "Buy more scans" : "Upgrade plan"} <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* ──── Quick Actions ──── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { to: "/settings", icon: Settings, label: "Settings", color: "text-white/70" },
            { to: "/billing", icon: CreditCard, label: "Billing", color: "text-white/70" },
            { to: "/reports", icon: BookOpen, label: "Reports", color: "text-white/70" },
            { to: "/analytics", icon: BarChart3, label: "Analytics", color: "text-white/70" },
          ].map((action) => (
            <Link
              key={action.to}
              to={action.to}
              className="flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-charcoal-deep/50 px-3 py-4 text-center hover:bg-charcoal-light/50 transition-colors group"
            >
              <action.icon className={`h-5 w-5 ${action.color} group-hover:text-white transition-colors`} />
              <span className="text-xs font-medium text-white/70 group-hover:text-white transition-colors">{action.label}</span>
            </Link>
          ))}
        </div>

        {/* ──── Automation & API ──── */}
        <div className="rounded-2xl border border-white/12 bg-charcoal-deep/50 p-5">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Terminal className="h-4 w-4 text-violet-400" /> Platform Automation & API
            </h2>
            <Link
              to="/app/settings?section=advanced"
              className="px-3 py-1 rounded-full border border-white/12 hover:bg-charcoal-light text-white text-xs transition"
            >
              Advanced Settings
            </Link>
          </div>

          <div className="rounded-xl border border-violet-300/20 bg-gradient-to-br from-violet-500/10 via-transparent to-cyan-500/10 p-4 mb-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-violet-200/90">Executive automation layer</p>
            <p className="mt-2 text-sm text-white/70 leading-relaxed">
              API keys, scheduled rescans, delivery workflows and developer ready docs for production integrations.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <Link to="/api-docs" className="rounded-xl border border-cyan-300/20 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:border-cyan-200/40 text-center">
                API Docs
              </Link>
              <Link to="/integrations" className="rounded-xl border border-violet-300/20 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-100 transition hover:border-violet-200/40 text-center">
                Integrations
              </Link>
              <Link to="/app/settings?section=advanced" className="rounded-xl border border-emerald-300/20 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:border-emerald-200/40 text-center">
                API Access
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-lg border border-white/10 bg-charcoal-light/40 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wide text-white/50">Scheduled Rescans</p>
              <p className="text-sm font-semibold mt-0.5">
                {featureStatus?.features?.scheduledRescans?.available
                  ? `${Number(featureStatus?.features?.scheduledRescans?.count || 0)} active`
                  : "Not available"}
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-charcoal-light/40 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wide text-white/50">API Keys</p>
              <p className="text-sm font-semibold mt-0.5">
                {featureStatus?.features?.apiAccess?.available
                  ? `${Number(featureStatus?.features?.apiAccess?.keyCount || 0)} active`
                  : "Not available"}
              </p>
            </div>
          </div>
          {featureStatusUpdatedAt && (
            <p className="text-[11px] text-white/40 mt-2">Updated {featureStatusUpdatedAt}</p>
          )}
        </div>

        {/* ──── Referral Program ──── */}
        <div className="rounded-2xl border border-white/12 bg-charcoal-deep/50 p-5">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Link2 className="h-4 w-4 text-cyan-400" /> Referral Program
            </h2>
            <Link
              to="/referrals"
              className="px-3 py-1 rounded-full border border-white/12 hover:bg-charcoal-light text-white text-xs transition"
            >
              View All
            </Link>
          </div>

          {referralSummary ? (
            <>
              <div className="rounded-xl border border-cyan-300/20 bg-gradient-to-br from-cyan-500/10 via-transparent to-violet-500/10 p-4 mb-4">
                <p className="text-[11px] uppercase tracking-[0.16em] text-cyan-200/90">Referral growth engine</p>
                <p className="mt-2 text-sm text-white/70 leading-relaxed">
                  Your code is <span className="font-semibold text-white">{referralSummary.code}</span> - you get +{referralSummary.constants.creditsToReferrer} credits and they get +{referralSummary.constants.creditsToReferred} once referral eligibility is met ({referralSummary.constants.requiredAuditsForReward || 5}+ audits), with {referralSummary.constants.paidRewardMultiplier || 3}x rewards if they upgrade.
                </p>
                <div className="mt-3 rounded-xl border border-white/10 bg-[#101726] px-3 py-2 text-xs break-all text-cyan-200 font-mono">
                  {buildReferralInviteLink(referralSummary.code)}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleShareInvite}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-cyan-300/25 bg-cyan-500/10 hover:bg-cyan-500/15 text-cyan-100 text-xs transition"
                  >
                    <Share2 className="h-3 w-3" /> Invite a Teammate
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyInviteLink}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-charcoal-light hover:bg-charcoal text-white text-xs transition"
                  >
                    <Copy className="h-3 w-3" /> Copy Invite Link
                  </button>
                  {inviteCopied && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full border border-emerald-300/25 bg-emerald-500/10 text-emerald-200 text-[11px]">
                      {inviteCopyMessage || "Copied!"}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Referrals", value: referralSummary.stats.totalReferrals },
                  { label: "Granted", value: referralSummary.stats.granted },
                  { label: "Pending", value: referralSummary.stats.pending },
                  { label: "Credits Earned", value: referralSummary.stats.totalCreditsEarned },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-lg border border-white/10 bg-charcoal-light/40 px-3 py-2.5 text-center">
                    <p className="text-lg font-bold">{stat.value}</p>
                    <p className="text-[10px] uppercase tracking-wide text-white/50">{stat.label}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-white/50">Referral data unavailable right now.</p>
          )}
        </div>

        {/* ──── Sign Out ──── */}
        <div className="flex justify-center pt-2 pb-8">
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-white/10 text-white/60 hover:text-white hover:bg-red-500/15 hover:border-red-400/30 transition-colors text-sm"
          >
            <LogOut className="h-4 w-4" /> Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
