import { ArrowRight, CheckCircle2, Clock3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { GuideFlowStage } from './guideTypes';

interface GuideScanFlowProps {
  stages: GuideFlowStage[];
}

export default function GuideScanFlow({ stages }: GuideScanFlowProps) {
  return (
    <section className="mb-6 rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 via-charcoal to-orange-500/10 p-6 sm:p-8">
      <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-[11px] uppercase tracking-wide text-cyan-300">
        <CheckCircle2 className="h-3.5 w-3.5" />
        End-to-end scan flow
      </div>
      <h2 className="mt-3 text-2xl brand-title">From first audit to citation-proof improvement</h2>
      <p className="mt-2 max-w-3xl text-sm leading-7 text-white/70">
        Follow this exact sequence every cycle. Each step links to the detailed section in this
        guide, so you can execute without guessing what comes next.
      </p>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {stages.map((stage, index) => (
          <article
            key={stage.id}
            className="rounded-xl border border-white/10 bg-charcoal-deep/90 p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500/15 text-[11px] font-bold text-cyan-300">
                {index + 1}
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-white/45">
                <Clock3 className="h-3 w-3" />
                {stage.eta}
              </span>
            </div>
            <h3 className="mt-3 text-sm font-semibold text-white/90">{stage.title}</h3>
            <p className="mt-2 text-xs leading-relaxed text-white/65">{stage.summary}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href={`#${stage.anchorId}`}
                className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-2.5 py-1.5 text-[11px] font-medium text-white/80 transition-colors hover:border-white/30 hover:text-white"
              >
                {stage.ctaLabel}
                <ArrowRight className="h-3 w-3" />
              </a>
              {stage.ctaTo && (
                <Link
                  to={stage.ctaTo}
                  className="inline-flex items-center gap-1 rounded-lg border border-cyan-400/25 bg-cyan-500/10 px-2.5 py-1.5 text-[11px] font-medium text-cyan-200 transition-colors hover:border-cyan-300/40 hover:text-cyan-100"
                >
                  Open tool
                  <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
