import React, { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Gift, Trophy, Star, Users, TrendingUp, Copy, Share2, Mail, Zap, Target, Crown, Award } from "lucide-react";
import { API_URL } from "../config";
import { usePageMeta } from "../hooks/usePageMeta";
import { buildBreadcrumbSchema, buildWebPageSchema } from "../lib/seoSchema";
import { useAuthStore } from "../stores/authStore";
import { buildReferralInviteLink, shareReferralInvite } from "../utils/referralShare";

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

export default function ReferralsPage() {
  const { isAuthenticated, token } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [summary, setSummary] = useState<ReferralSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  usePageMeta({
    title: 'Referrals | AiVIS AI Visibility Platform',
    description: 'Invite colleagues to AiVIS and earn bonus scan credits. Grow your team’s AI visibility intelligence together.',
    path: '/referrals',
    structuredData: [
      buildWebPageSchema({ path: '/referrals', name: 'AiVIS Referral Program', description: 'Earn bonus credits by referring others to the AiVIS AI visibility platform.' }),
      buildBreadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Referrals', path: '/referrals' }]),
    ],
  });

  if (!isAuthenticated) {
    const redirectTarget = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/auth?mode=signin&redirect=${encodeURIComponent(redirectTarget)}`} replace />;
  }

  useEffect(() => {
    let cancelled = false;

    async function loadSummary() {
      setLoading(true);
      setError(null);
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

        if (!res.ok) {
          throw new Error("Referral summary could not be loaded.");
        }

        const raw = await res.json().catch(() => ({}));
        const payload = raw?.data ?? raw;
        if (!cancelled) {
          setSummary(payload as ReferralSummaryData);
        }
      } catch (err: any) {
        if (!cancelled) {
          setSummary(null);
          setError(err?.message || "Referral summary could not be loaded.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadSummary();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const inviteLink = useMemo(() => {
    if (!summary?.code) return "";
    return buildReferralInviteLink(summary.code);
  }, [summary?.code]);

  const referralConversionRate = useMemo(() => {
    if (!summary || summary.stats.totalReferrals === 0) return 0;
    return Math.round((summary.stats.granted / summary.stats.totalReferrals) * 100);
  }, [summary]);

  const handleShareInvite = async () => {
    if (!summary) return;
    const result = await shareReferralInvite({
      referralCode: summary.code,
      creditsToReferrer: summary.constants.creditsToReferrer,
      creditsToReferred: summary.constants.creditsToReferred,
      requiredAuditsForReward: summary.constants.requiredAuditsForReward,
      paidRewardMultiplier: summary.constants.paidRewardMultiplier,
    });

    if (result === "failed") {
      window.alert("Sharing is unavailable on this device right now.");
    }
  };

  const handleCopyInvite = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      window.alert("Unable to copy link automatically on this browser.");
    }
  };

  const milestones = [
    { threshold: 3, label: 'Starter', icon: Star, reward: '+5 bonus credits', color: 'text-amber-300 border-amber-400/25 bg-amber-500/10' },
    { threshold: 10, label: 'Connector', icon: Users, reward: '+15 bonus credits', color: 'text-cyan-300 border-cyan-400/25 bg-cyan-500/10' },
    { threshold: 25, label: 'Advocate', icon: Trophy, reward: '+40 bonus credits + badge', color: 'text-violet-300 border-violet-400/25 bg-violet-500/10' },
    { threshold: 50, label: 'Ambassador', icon: Crown, reward: '+100 bonus credits + priority support', color: 'text-emerald-300 border-emerald-400/25 bg-emerald-500/10' },
  ];

  const currentMilestone = useMemo(() => {
    const total = summary?.stats.totalReferrals ?? 0;
    const reached = milestones.filter(m => total >= m.threshold);
    return reached.length > 0 ? reached[reached.length - 1] : null;
  }, [summary]);

  const nextMilestone = useMemo(() => {
    const total = summary?.stats.totalReferrals ?? 0;
    return milestones.find(m => total < m.threshold) ?? null;
  }, [summary]);

  const milestoneProgress = useMemo(() => {
    const total = summary?.stats.totalReferrals ?? 0;
    if (!nextMilestone) return 100;
    const prev = currentMilestone?.threshold ?? 0;
    const range = nextMilestone.threshold - prev;
    return Math.min(100, Math.round(((total - prev) / range) * 100));
  }, [summary, currentMilestone, nextMilestone]);

  const handleEmailInvite = () => {
    if (!inviteLink || !summary) return;
    const subject = encodeURIComponent('Try AiVIS — AI Visibility Audit Platform');
    const body = encodeURIComponent(
      `I've been using AiVIS to audit how AI sees websites.\n\nSign up with my referral link and we both earn ${summary.constants.creditsToReferred} bonus scan credits:\n${inviteLink}\n\nIt scores your site for machine readability, structured data, and citation readiness across ChatGPT, Perplexity, Claude, and Google AI.`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`, '_self');
  };

  const handleTwitterShare = () => {
    if (!inviteLink) return;
    const text = encodeURIComponent(`I'm using AiVIS to audit how AI sees my website. Check it out — we both earn bonus credits:\n${inviteLink}`);
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank', 'noopener');
  };

  const handleLinkedInShare = () => {
    if (!inviteLink) return;
    const url = encodeURIComponent(inviteLink);
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, '_blank', 'noopener');
  };

  return (
    <div className="min-h-screen page-splash-bg bg-[#2e3646] text-white flex flex-col">
      <header className="border-b border-white/10 bg-charcoal-deep backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <button onClick={() => navigate("/")} className="rounded-full p-2 transition-colors hover:bg-white/8" type="button" aria-label="Go back">
            <ArrowLeft className="h-5 w-5 text-white/55" />
          </button>
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-xl brand-title">
              <Gift className="h-5 w-5 text-orange-400" />
              Referral Hub
            </h1>
            <p className="text-sm text-white/60 leading-relaxed">Invite peers, earn scan credits, and track conversion outcomes in real time</p>
          </div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8 space-y-6">

        {/* ── Hero + reward cards ── */}
        <div className="overflow-hidden rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-[#0b1c2f]/95 via-[#151a2f]/95 to-[#2a1d3b]/90 p-6 sm:p-8 shadow-[0_26px_70px_rgba(0,0,0,0.5)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-cyan-300/30 bg-cyan-400/15 text-cyan-200 text-[11px] font-semibold uppercase tracking-[0.18em] mb-3">
                Revenue referral engine
              </span>
              <h1 className="text-3xl sm:text-4xl font-black leading-tight">
                <span className="bg-gradient-to-r from-cyan-300 via-white to-violet-300 bg-clip-text text-transparent">
                  Turn users into high-intent growth channels
                </span>
              </h1>
              <p className="mt-3 text-sm sm:text-base text-white/78 max-w-2xl">
                A conversion-first referral workspace with instant sharing, transparent reward mechanics, and clear attribution outcomes.
              </p>
            </div>
            <Link
              to="/settings"
              className="hidden sm:inline-flex rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/85 transition hover:border-white/40 hover:bg-white/8"
            >
              Back to Settings
            </Link>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-emerald-300/25 bg-emerald-500/10 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-emerald-200/90">Referrer reward</p>
              <p className="mt-1 text-xl font-black text-emerald-100">+{summary?.constants.creditsToReferrer ?? 0} credits</p>
            </div>
            <div className="rounded-2xl border border-cyan-300/25 bg-cyan-500/10 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-cyan-200/90">Invitee reward</p>
              <p className="mt-1 text-xl font-black text-cyan-100">+{summary?.constants.creditsToReferred ?? 0} credits</p>
            </div>
            <div className="rounded-2xl border border-violet-300/25 bg-violet-500/10 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-violet-200/90">Paid multiplier</p>
              <p className="mt-1 text-xl font-black text-violet-100">{summary?.constants.paidRewardMultiplier ?? 3}x</p>
            </div>
            <div className="rounded-2xl border border-amber-300/25 bg-amber-500/10 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-amber-200/90">Total earned</p>
              <p className="mt-1 text-xl font-black text-amber-100">{summary?.stats.totalCreditsEarned ?? 0} credits</p>
            </div>
          </div>
        </div>

        {/* ── Main content ── */}
        <div className="rounded-3xl border border-white/10 bg-charcoal p-5 sm:p-6 shadow-[0_18px_45px_rgba(0,0,0,0.48)]">
          {loading ? (
            <p className="text-sm text-white/70">Loading referral summary…</p>
          ) : error ? (
            <p className="text-sm text-rose-300">{error}</p>
          ) : !summary ? (
            <p className="text-sm text-white/70">Referral summary unavailable.</p>
          ) : (
            <>
              {/* Stats grid */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div className="rounded-2xl border border-white/10 bg-charcoal-light p-3">
                  <p className="text-[10px] uppercase tracking-wide text-white/50">Referral code</p>
                  <p className="mt-1 text-sm font-semibold text-cyan-200">{summary.code}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-charcoal-light p-3">
                  <p className="text-[10px] uppercase tracking-wide text-white/50">Total referrals</p>
                  <p className="mt-1 text-sm font-semibold text-white">{summary.stats.totalReferrals}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-charcoal-light p-3">
                  <p className="text-[10px] uppercase tracking-wide text-white/50">Granted credits</p>
                  <p className="mt-1 text-sm font-semibold text-emerald-300">{summary.stats.granted}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-charcoal-light p-3">
                  <p className="text-[10px] uppercase tracking-wide text-white/50">Pending credits</p>
                  <p className="mt-1 text-sm font-semibold text-amber-300">{summary.stats.pending}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-charcoal-light p-3">
                  <p className="text-[10px] uppercase tracking-wide text-white/50">Conversion rate</p>
                  <p className="mt-1 text-sm font-semibold text-violet-300">{referralConversionRate}%</p>
                </div>
              </div>

              {/* ── Milestone progress ── */}
              <div className="mt-5 rounded-2xl border border-white/10 bg-charcoal-light p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-white/55 flex items-center gap-1.5">
                    <Award className="h-3.5 w-3.5 text-amber-400" />
                    Referral milestones
                  </p>
                  {currentMilestone && (
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${currentMilestone.color}`}>
                      <currentMilestone.icon className="h-3 w-3" />
                      {currentMilestone.label}
                    </span>
                  )}
                </div>
                <div className="relative h-2.5 rounded-full bg-white/8 overflow-hidden mb-3">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 transition-all duration-700"
                    style={{ width: `${milestoneProgress}%` }}
                  />
                  {milestones.map((m) => (
                    <div
                      key={m.threshold}
                      className="absolute top-1/2 -translate-y-1/2 h-3 w-0.5 bg-white/20"
                      style={{ left: `${Math.min(100, (m.threshold / (milestones[milestones.length - 1].threshold)) * 100)}%` }}
                    />
                  ))}
                </div>
                <div className="grid gap-2 sm:grid-cols-4">
                  {milestones.map((m) => {
                    const reached = (summary?.stats.totalReferrals ?? 0) >= m.threshold;
                    return (
                      <div key={m.threshold} className={`rounded-xl border p-2.5 transition ${reached ? m.color : 'border-white/5 bg-white/[0.02] opacity-50'}`}>
                        <div className="flex items-center gap-1.5">
                          <m.icon className="h-3.5 w-3.5" />
                          <span className="text-[11px] font-bold">{m.label}</span>
                        </div>
                        <p className="text-[10px] mt-1 opacity-75">{m.threshold} referrals — {m.reward}</p>
                      </div>
                    );
                  })}
                </div>
                {nextMilestone && (
                  <p className="mt-2 text-[10px] text-white/45">
                    {nextMilestone.threshold - (summary?.stats.totalReferrals ?? 0)} more referral{nextMilestone.threshold - (summary?.stats.totalReferrals ?? 0) !== 1 ? 's' : ''} to reach <strong className="text-white/65">{nextMilestone.label}</strong> tier
                  </p>
                )}
              </div>

              {/* ── Share section ── */}
              <div className="mt-5 grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
                <div className="rounded-2xl border border-cyan-300/20 bg-gradient-to-br from-cyan-500/10 via-transparent to-violet-500/10 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-cyan-200/85 mb-2">Share-ready referral link</p>
                  <p className="mt-3 break-all rounded-xl border border-cyan-300/20 bg-[#0b1220]/85 px-3 py-2 text-xs text-cyan-200">{inviteLink}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={handleCopyInvite} className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-400/25 bg-cyan-500/15 px-3 py-2 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/25 active:scale-[0.97]">
                      <Copy className="h-3 w-3" />
                      {copied ? 'Copied!' : 'Copy Link'}
                    </button>
                    <button type="button" onClick={handleShareInvite} className="inline-flex items-center gap-1.5 rounded-xl border border-violet-400/25 bg-violet-500/15 px-3 py-2 text-xs font-semibold text-violet-200 transition hover:bg-violet-500/25 active:scale-[0.97]">
                      <Share2 className="h-3 w-3" />
                      Share
                    </button>
                    <button type="button" onClick={handleEmailInvite} className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/25 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/25 active:scale-[0.97]">
                      <Mail className="h-3 w-3" />
                      Email Invite
                    </button>
                  </div>
                  {/* Social share row */}
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={handleTwitterShare} className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] text-white/65 transition hover:bg-white/10 hover:text-white active:scale-[0.97]">
                      Post on X/Twitter
                    </button>
                    <button type="button" onClick={handleLinkedInShare} className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] text-white/65 transition hover:bg-white/10 hover:text-white active:scale-[0.97]">
                      Share on LinkedIn
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="rounded-2xl border border-white/12 bg-charcoal-light p-4">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-white/55">How it works</p>
                    <ol className="mt-2 space-y-2 text-xs text-white/78 leading-6">
                      <li className="flex gap-2"><span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-[9px] font-bold text-cyan-300">1</span>Share your referral link with colleagues or prospects</li>
                      <li className="flex gap-2"><span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-[9px] font-bold text-violet-300">2</span>Invitee signs up and runs {summary.constants.requiredAuditsForReward || 5}+ audits</li>
                      <li className="flex gap-2"><span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[9px] font-bold text-emerald-300">3</span>Both accounts receive scan credits instantly</li>
                      <li className="flex gap-2"><span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-[9px] font-bold text-amber-300">4</span>If invitee upgrades, you earn {summary.constants.paidRewardMultiplier || 3}x multiplied credits</li>
                    </ol>
                  </div>
                  <div className="rounded-2xl border border-white/12 bg-charcoal-light p-4">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-white/55 flex items-center gap-1"><Zap className="h-3 w-3 text-amber-400" /> Pro tips</p>
                    <ul className="mt-2 space-y-1.5 text-[11px] text-white/65 leading-5">
                      <li>Share after showing someone a real audit result</li>
                      <li>Include link in your email signature or bio</li>
                      <li>Post comparison screenshots on social media</li>
                      <li>Help invitees run their first 5 audits for faster activation</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* ── Earnings projection ── */}
              <div className="mt-5 rounded-2xl border border-white/10 bg-charcoal-light p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-white/55 flex items-center gap-1.5 mb-3">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                  Earnings projection
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    { label: '5 referrals', credits: 5 * (summary.constants.creditsToReferrer ?? 0), paid: 2 * (summary.constants.creditsToReferrer ?? 0) * (summary.constants.paidRewardMultiplier ?? 3) },
                    { label: '15 referrals', credits: 15 * (summary.constants.creditsToReferrer ?? 0), paid: 5 * (summary.constants.creditsToReferrer ?? 0) * (summary.constants.paidRewardMultiplier ?? 3) },
                    { label: '50 referrals', credits: 50 * (summary.constants.creditsToReferrer ?? 0), paid: 15 * (summary.constants.creditsToReferrer ?? 0) * (summary.constants.paidRewardMultiplier ?? 3) },
                  ].map((proj) => (
                    <div key={proj.label} className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
                      <p className="text-[10px] uppercase text-white/45">{proj.label}</p>
                      <p className="mt-1 text-sm font-bold text-emerald-300">+{proj.credits} base credits</p>
                      <p className="text-[10px] text-white/45">+{proj.paid} if ~30% upgrade to paid</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Quick actions ── */}
              <div className="mt-5 grid gap-3 sm:grid-cols-4">
                <Link to="/analyze" className="flex items-center gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-3 text-xs font-semibold text-cyan-100 transition hover:border-cyan-200/40">
                  <Target className="h-3.5 w-3.5" />
                  Run audit baseline
                </Link>
                <Link to="/reports" className="flex items-center gap-2 rounded-2xl border border-violet-300/20 bg-violet-500/10 p-3 text-xs font-semibold text-violet-100 transition hover:border-violet-200/40">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Open report proofs
                </Link>
                <Link to="/billing" className="flex items-center gap-2 rounded-2xl border border-amber-300/20 bg-amber-500/10 p-3 text-xs font-semibold text-amber-100 transition hover:border-amber-200/40">
                  <Zap className="h-3.5 w-3.5" />
                  Upgrade for multiplier
                </Link>
                <Link to="/guide#tool-routing" className="flex items-center gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-100 transition hover:border-emerald-200/40">
                  <Star className="h-3.5 w-3.5" />
                  Tool explainers
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
