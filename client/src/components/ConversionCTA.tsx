import { Link } from 'react-router-dom';
import { ArrowRight, Zap, Sparkles, Lock } from 'lucide-react';

/* ── Variants ──────────────────────────────────────────────────────────── */

interface ConversionCTAProps {
  variant: 'usage-nudge' | 'scan-limit' | 'free-tool' | 'blog';
  /** Observer-tier usage numbers (for usage-nudge / scan-limit) */
  scansUsed?: number;
  scansLimit?: number;
  className?: string;
}

/**
 * Lightweight inline conversion CTA used across the funnel:
 *   - Dashboard usage nudge (Observer sees remaining scans + upgrade prompt)
 *   - Analyze page scan-limit wall (replaces plain error with actionable CTA)
 *   - Free tool results (post-check nudge to run a full audit)
 *   - Blog article footer (soft product nudge after reading)
 */
export default function ConversionCTA({
  variant,
  scansUsed = 0,
  scansLimit = 3,
  className = '',
}: ConversionCTAProps) {
  if (variant === 'usage-nudge') {
    const remaining = Math.max(0, scansLimit - scansUsed);
    const pct = scansLimit > 0 ? Math.min(100, Math.round((scansUsed / scansLimit) * 100)) : 0;
    const urgent = remaining <= 1;

    return (
      <section
        className={`rounded-3xl border p-5 sm:p-6 ${urgent ? 'border-amber-400/25 bg-gradient-to-br from-amber-500/10 to-amber-500/[0.03]' : 'border-cyan-300/15 bg-gradient-to-br from-cyan-500/8 to-cyan-500/[0.02]'} ${className}`}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/52">
              <Zap className={`h-3.5 w-3.5 ${urgent ? 'text-amber-400' : 'text-cyan-300'}`} />
              Observer plan
            </p>
            <p className="mt-2 text-sm text-white/80">
              <span className={`font-semibold ${urgent ? 'text-amber-300' : 'text-white'}`}>
                {remaining}
              </span>{' '}
              of {scansLimit} free scans remaining this month
            </p>
            <div className="mt-2 h-1.5 w-48 max-w-full overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full transition-all ${urgent ? 'bg-amber-400' : 'bg-cyan-400'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            {urgent && (
              <p className="mt-2 text-xs text-amber-200/70">
                Upgrade to Alignment for 60 monthly scans, report history, and evidence trails.
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/pricing"
              className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${urgent ? 'bg-amber-400 text-slate-950 hover:bg-amber-300' : 'border border-cyan-400/30 text-cyan-200 hover:bg-cyan-400/10'}`}
            >
              {urgent ? 'Upgrade now' : 'See plans'}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (variant === 'scan-limit') {
    return (
      <section
        className={`rounded-3xl border border-amber-400/25 bg-gradient-to-br from-amber-500/10 to-orange-500/[0.04] p-5 sm:p-6 ${className}`}
      >
        <div className="flex items-start gap-3">
          <Lock className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-white">Monthly scan limit reached</p>
            <p className="mt-1 text-sm text-white/70">
              You&apos;ve used all {scansLimit} Observer scans this cycle. Cached results are still
              accessible.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                to="/pricing"
                className="inline-flex items-center gap-2 rounded-2xl bg-orange-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-orange-300"
              >
                Upgrade to Alignment
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                to="/pricing#scorefix"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/[0.1]"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                Get Score Fix
              </Link>
            </div>
            <p className="mt-3 text-xs text-white/45">
              Alignment: 60 scans/mo for $49 &middot; Score Fix: 250 credits/mo · $299/mo
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (variant === 'free-tool') {
    return (
      <section
        className={`rounded-3xl border border-cyan-300/15 bg-gradient-to-r from-cyan-500/8 to-blue-500/[0.04] p-5 sm:p-6 ${className}`}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">Want the full picture?</p>
            <p className="mt-1 text-sm text-white/65">
              This free check covers one signal. A full AI visibility audit scores your site across
              schema, extractability, trust signals, and citation readiness — in one scan.
            </p>
          </div>
          <Link
            to="/analyze"
            className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-orange-400 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-orange-300"
          >
            Run free audit
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>
    );
  }

  if (variant === 'blog') {
    return (
      <section
        className={`rounded-3xl border border-orange-400/20 bg-gradient-to-r from-orange-500/8 to-amber-500/[0.04] p-5 sm:p-6 ${className}`}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">See how your site scores</p>
            <p className="mt-1 text-sm text-white/65">
              Run a free AI visibility audit and find out whether your site is citation-ready — in
              under 60 seconds.
            </p>
          </div>
          <Link
            to="/analyze"
            className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-orange-400 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-orange-300"
          >
            Audit your site
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>
    );
  }

  return null;
}
