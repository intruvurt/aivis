import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Sparkles, ArrowRight, Lock } from 'lucide-react';

// Tier metadata scoped to the confirm flow — defines what users see before committing
const TIER_META: Record<
  string,
  {
    badge: string;
    badgeColor: string;
    headline: string;
    body: string;
    unlocks: string[];
    trialLine?: string;
  }
> = {
  starter: {
    badge: 'Starter',
    badgeColor: 'border-sky-400/30 bg-sky-400/10 text-sky-300',
    headline: 'Structural interpretation layer.',
    body: 'Unlocks full mismatch analysis, entity-level ledger entries, and implementation-ready corrections tied to every scan.',
    unlocks: [
      'Full mismatch breakdown with fix code',
      'Entity-level ledger entries',
      'Evidence trace per scan',
      'PDF export & shareable report links',
    ],
  },
  alignment: {
    badge: 'Alignment',
    badgeColor: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300',
    headline: 'Temporal interpretation layer.',
    body: 'Reveals how AI understanding shifts over time. Cross-scan context, propagation evidence, and multi-model verification.',
    unlocks: [
      'Interpretation drift tracking over time',
      'Cross-scan entity graph context',
      'Citation propagation history',
      'Cross-model interpretation verification',
    ],
  },
  signal: {
    badge: 'Signal',
    badgeColor: 'border-violet-400/30 bg-violet-400/10 text-violet-300',
    headline: 'Infrastructure access layer.',
    body: 'Operationalizes the ledger as infrastructure with APIs, automation, team workflows, and real-time observability.',
    unlocks: [
      'Real-time scan stream observability',
      'API access to ledger and query engine',
      'Workspace-level intelligence workflows',
      'Automation, webhooks, and team operations',
    ],
    trialLine: '14-day free trial available — no credit card required.',
  },
  scorefix: {
    badge: 'Score Fix',
    badgeColor: 'border-orange-400/30 bg-orange-400/10 text-orange-300',
    headline: 'Continuous remediation layer.',
    body: 'Automated, evidence-linked remediation cycles with recurring credits and GitHub PR workflows for always-on repair.',
    unlocks: [
      '6-hour ledger watch-mode loop',
      'Auto-generated GitHub PRs (up to 5/week)',
      '250 monthly repair credits',
      'Citation decay detection & entity graph repair',
    ],
  },
  agency: {
    badge: 'Agency',
    badgeColor: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
    headline: 'Scale operations layer.',
    body: 'Full platform access at scale. Team operations, advanced reporting, and volume capacity for client-facing workflows.',
    unlocks: [
      '500 audits per month',
      'Unlimited team seats',
      'White-label client reports',
      'Priority support & SLA',
    ],
  },
};

interface TierConfirmModalProps {
  tierKey: string;
  billingPeriod: 'monthly' | 'yearly';
  priceMonthly?: number | null;
  priceYearly?: number | null;
  isOpen: boolean;
  onClose: () => void;
  /** Called when user confirms subscription checkout */
  onConfirm: () => Promise<void>;
  /** True if user can still claim a free Signal trial */
  canStartTrial?: boolean;
  /** Called when user clicks Start Trial in the modal */
  onStartTrial?: () => Promise<void>;
  /** Loading state for checkout */
  isCheckingOut?: boolean;
  /** Loading state for trial */
  isStartingTrial?: boolean;
}

export default function TierConfirmModal({
  tierKey,
  billingPeriod,
  priceMonthly,
  priceYearly,
  isOpen,
  onClose,
  onConfirm,
  canStartTrial,
  onStartTrial,
  isCheckingOut,
  isStartingTrial,
}: TierConfirmModalProps) {
  const meta = TIER_META[tierKey];
  if (!meta) return null;

  const isSignal = tierKey === 'signal';
  const showTrial = isSignal && canStartTrial && typeof onStartTrial === 'function';

  const displayPrice =
    billingPeriod === 'yearly' && priceYearly
      ? `$${priceYearly}/yr`
      : priceMonthly
        ? `$${priceMonthly}/mo`
        : null;

  const isLoading = isCheckingOut || isStartingTrial;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />

          {/* Modal panel */}
          <motion.div
            key="panel"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            <div
              className="pointer-events-auto w-full max-w-md rounded-2xl border border-white/10 bg-[#0f1117] shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start justify-between p-6 pb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide ${meta.badgeColor}`}
                  >
                    <Lock className="w-3 h-3" />
                    {meta.badge}
                  </div>
                  {displayPrice && <span className="text-white/40 text-sm">{displayPrice}</span>}
                </div>
                <button
                  onClick={onClose}
                  disabled={isLoading}
                  className="p-1.5 rounded-lg text-white/35 hover:text-white/70 hover:bg-white/8 transition-colors disabled:opacity-30"
                  type="button"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="px-6 pb-5">
                <h2 className="text-lg font-semibold text-white mb-1 leading-snug">
                  {meta.headline}
                </h2>
                <p className="text-sm text-white/50 mb-5 leading-relaxed">{meta.body}</p>

                {/* Unlock list */}
                <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4 mb-5">
                  <p className="text-[10px] uppercase tracking-widest text-white/30 mb-3 font-semibold">
                    What you're unlocking
                  </p>
                  <ul className="space-y-2">
                    {meta.unlocks.map((line) => (
                      <li key={line} className="flex items-start gap-2 text-sm text-white/65">
                        <Check className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-400/80" />
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Trial callout for Signal */}
                {showTrial && (
                  <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/8 p-4 mb-5">
                    <div className="flex items-start gap-2.5">
                      <Sparkles className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-emerald-300 mb-0.5">
                          Start with a free 14-day trial
                        </p>
                        <p className="text-xs text-white/45 leading-relaxed">
                          Full Signal access — triple-check pipeline, citation testing, API, and
                          every feature. No credit card required.
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={onStartTrial}
                      disabled={isLoading}
                      className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-500/80 hover:bg-emerald-500/90 text-white text-sm font-semibold transition-colors disabled:opacity-50"
                      type="button"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {isStartingTrial ? 'Starting trial…' : 'Start free 14-day trial'}
                    </button>
                  </div>
                )}

                {/* Confirm checkout CTA */}
                <button
                  onClick={onConfirm}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white/10 hover:bg-white/16 border border-white/12 text-white text-sm font-semibold transition-colors disabled:opacity-40"
                  type="button"
                >
                  {isCheckingOut ? (
                    'Redirecting to checkout…'
                  ) : (
                    <>
                      {showTrial ? `Subscribe to ${meta.badge}` : `Continue to checkout`}
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              {/* Footer */}
              <div className="px-6 pb-5 flex flex-col items-center gap-1.5">
                <p className="text-[11px] text-white/25 text-center">
                  24-hour refund window from payment date. No refund after code is pushed or PR is
                  confirmed.
                </p>
                <button
                  onClick={onClose}
                  disabled={isLoading}
                  className="text-[11px] text-white/30 hover:text-white/55 transition-colors disabled:opacity-30"
                  type="button"
                >
                  Maybe later
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
