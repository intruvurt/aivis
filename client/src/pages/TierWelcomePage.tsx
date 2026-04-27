import { useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Check, ArrowRight, Sparkles, Zap, Shield, BarChart2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { usePageMeta } from '../hooks/usePageMeta';
import { useAuthStore } from '../stores/authStore';

interface TierWelcomeConfig {
  badge: string;
  badgeColor: string;
  headline: string;
  subline: string;
  unlocks: { icon: React.ElementType; label: string; detail: string }[];
  firstSteps: { number: string; label: string; href: string }[];
  primaryCta: { label: string; href: string };
}

const TIER_WELCOME: Record<string, TierWelcomeConfig> = {
  starter: {
    badge: 'Starter',
    badgeColor: 'border-sky-400/30 bg-sky-400/10 text-sky-300',
    headline: "You've unlocked structural visibility.",
    subline:
      'Full mismatch analysis, entity-level ledger entries, and implementation-ready corrections are now active on every scan.',
    unlocks: [
      {
        icon: BarChart2,
        label: 'Full mismatch breakdown',
        detail: 'See exactly what AI misreads and why',
      },
      { icon: Shield, label: 'Evidence trace per scan', detail: 'Every finding is ledger-backed' },
      {
        icon: Zap,
        label: 'Implementation-ready corrections',
        detail: 'Copy-paste fix code per issue',
      },
      {
        icon: Check,
        label: 'PDF export & share links',
        detail: 'Send proof to stakeholders instantly',
      },
    ],
    firstSteps: [
      { number: '01', label: 'Run your first full audit', href: '/app/scan' },
      { number: '02', label: 'Review mismatch breakdown', href: '/app/evidence' },
      { number: '03', label: 'Export a shareable report', href: '/app/reports' },
    ],
    primaryCta: { label: 'Run your first audit', href: '/app/scan' },
  },
  alignment: {
    badge: 'Alignment',
    badgeColor: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300',
    headline: "You've unlocked temporal intelligence.",
    subline:
      'Cross-scan context, citation propagation history, and multi-model verification are now active.',
    unlocks: [
      {
        icon: BarChart2,
        label: 'Interpretation drift tracking',
        detail: 'See how AI understanding shifts over time',
      },
      {
        icon: Shield,
        label: 'Citation propagation history',
        detail: 'Trace citations across sources and scans',
      },
      {
        icon: Zap,
        label: 'Competitor tracking',
        detail: 'Monitor how rivals appear in AI answers',
      },
      {
        icon: Check,
        label: 'Cross-model verification',
        detail: 'Validate findings across multiple AI engines',
      },
    ],
    firstSteps: [
      { number: '01', label: 'Set up competitor tracking', href: '/app/competitors' },
      { number: '02', label: 'Review analytics dashboard', href: '/app/analytics' },
      { number: '03', label: 'Explore brand mentions', href: '/app/evidence' },
    ],
    primaryCta: { label: 'Set up competitors', href: '/app/competitors' },
  },
  signal: {
    badge: 'Signal',
    badgeColor: 'border-violet-400/30 bg-violet-400/10 text-violet-300',
    headline: "You've unlocked infrastructure access.",
    subline:
      'The ledger is now an API. Real-time observability, automation hooks, and team workflows are active.',
    unlocks: [
      {
        icon: Zap,
        label: 'API access to ledger & query engine',
        detail: 'Integrate visibility data into your stack',
      },
      {
        icon: BarChart2,
        label: 'Triple-check AI pipeline',
        detail: '3-model validation for every finding',
      },
      {
        icon: Shield,
        label: 'Automation & webhooks',
        detail: 'Trigger workflows on visibility changes',
      },
      { icon: Check, label: 'Team workspace', detail: 'Collaborate across up to 10 seats' },
    ],
    firstSteps: [
      { number: '01', label: 'Run a triple-check scan', href: '/app/scan' },
      { number: '02', label: 'Explore API documentation', href: '/app/api-docs' },
      { number: '03', label: 'Connect MCP integration', href: '/app/mcp' },
    ],
    primaryCta: { label: 'Run a triple-check scan', href: '/app/scan' },
  },
  scorefix: {
    badge: 'Score Fix',
    badgeColor: 'border-orange-400/30 bg-orange-400/10 text-orange-300',
    headline: 'Continuous remediation is active.',
    subline:
      'Automated ledger repair, citation decay detection, and GitHub PR workflows are now running.',
    unlocks: [
      { icon: Zap, label: '6-hour watch-mode loop', detail: 'Always-on ledger monitoring' },
      { icon: Shield, label: 'Auto PR generation', detail: 'Evidence-linked GitHub remediation' },
      { icon: BarChart2, label: '250 monthly repair credits', detail: 'Reset each billing cycle' },
      { icon: Check, label: 'PR regression rollback', detail: 'Auto-reverts score-reducing PRs' },
    ],
    firstSteps: [
      { number: '01', label: 'Connect your GitHub repo', href: '/app/score-fix' },
      { number: '02', label: 'Review ledger sync status', href: '/app/score-fix' },
      { number: '03', label: 'Configure auto-fix threshold', href: '/app/score-fix' },
    ],
    primaryCta: { label: 'Set up Score Fix', href: '/app/score-fix' },
  },
  agency: {
    badge: 'Agency',
    badgeColor: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
    headline: 'Full-scale operations unlocked.',
    subline:
      '500 audits per month, white-label reporting, and priority support are now active for your team.',
    unlocks: [
      { icon: Zap, label: '500 audits per month', detail: 'Scale across client portfolios' },
      { icon: Shield, label: 'White-label reports', detail: 'Send branded reports to clients' },
      { icon: BarChart2, label: 'Team management', detail: 'Unlimited team seats' },
      { icon: Check, label: 'Priority support', detail: 'Dedicated response SLA' },
    ],
    firstSteps: [
      { number: '01', label: 'Invite team members', href: '/app/team' },
      { number: '02', label: 'Run first client audit', href: '/app/scan' },
      { number: '03', label: 'Configure white-label settings', href: '/app/settings' },
    ],
    primaryCta: { label: 'Invite your team', href: '/app/team' },
  },
};

const FALLBACK_WELCOME: TierWelcomeConfig = {
  badge: 'Upgraded',
  badgeColor: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
  headline: 'Your plan is now active.',
  subline: 'New features are live. Start a scan to see your upgraded visibility intelligence.',
  unlocks: [
    { icon: Zap, label: 'Expanded scan capacity', detail: 'More audits per month' },
    { icon: Shield, label: 'Deeper ledger evidence', detail: 'Per-finding citations' },
    { icon: BarChart2, label: 'Extended history', detail: 'Longer audit retention' },
    { icon: Check, label: 'Advanced recommendations', detail: 'Implementation-ready fixes' },
  ],
  firstSteps: [
    { number: '01', label: 'Run your first audit', href: '/app/scan' },
    { number: '02', label: 'Review your evidence', href: '/app/evidence' },
    { number: '03', label: 'Check billing details', href: '/app/billing' },
  ],
  primaryCta: { label: 'Run your first audit', href: '/app/scan' },
};

export default function TierWelcomePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const refreshUser = useAuthStore((s) => s.refreshUser);

  const tierParam = searchParams.get('tier') || '';
  const config = TIER_WELCOME[tierParam] ?? FALLBACK_WELCOME;

  usePageMeta({
    title: `Welcome to ${config.badge}`,
    description: config.subline,
    noIndex: true,
  });

  // Ensure auth store is fresh after Stripe redirect
  useEffect(() => {
    refreshUser().catch(() => {});
  }, [refreshUser]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-xl">
        {/* Badge + heading */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-10"
        >
          <div
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold tracking-wide mb-4 ${config.badgeColor}`}
          >
            <Sparkles className="w-3 h-3" />
            {config.badge} active
          </div>
          <h1 className="text-3xl font-bold text-white mb-3 leading-snug">{config.headline}</h1>
          <p className="text-white/50 text-base leading-relaxed max-w-md mx-auto">
            {config.subline}
          </p>
        </motion.div>

        {/* Unlocks grid */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-5 mb-6"
        >
          <p className="text-[10px] uppercase tracking-widest text-white/25 mb-4 font-semibold">
            Now available to you
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {config.unlocks.map(({ icon: Icon, label, detail }) => (
              <div key={label} className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-3.5 h-3.5 text-white/50" />
                </div>
                <div>
                  <p className="text-sm text-white/80 font-medium leading-none mb-0.5">{label}</p>
                  <p className="text-xs text-white/35 leading-snug">{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* First steps */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.26, delay: 0.14, ease: [0.16, 1, 0.3, 1] }}
          className="mb-7"
        >
          <p className="text-[10px] uppercase tracking-widest text-white/25 mb-3 font-semibold">
            Your first 3 steps
          </p>
          <div className="space-y-2">
            {config.firstSteps.map(({ number, label, href }) => (
              <Link
                key={number}
                to={href}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/12 transition-colors group"
              >
                <span className="text-[11px] font-mono text-white/20 group-hover:text-white/40 transition-colors">
                  {number}
                </span>
                <span className="text-sm text-white/60 group-hover:text-white/85 transition-colors flex-1">
                  {label}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-white/20 group-hover:text-white/55 transition-colors" />
              </Link>
            ))}
          </div>
        </motion.div>

        {/* Primary CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.24, delay: 0.2 }}
          className="flex flex-col items-center gap-2"
        >
          <Link
            to={config.primaryCta.href}
            className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white/10 hover:bg-white/16 border border-white/12 text-white text-sm font-semibold transition-colors"
          >
            {config.primaryCta.label}
            <ArrowRight className="w-4 h-4" />
          </Link>
          <button
            onClick={() => navigate('/app/billing')}
            className="text-xs text-white/25 hover:text-white/50 transition-colors"
            type="button"
          >
            View billing details
          </button>
        </motion.div>
      </div>
    </div>
  );
}
