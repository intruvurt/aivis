import React from 'react';
import type { Recommendation } from '@shared/types';
import { TrendingUp, Zap, ArrowRight } from 'lucide-react';

interface FixImpactSimulatorProps {
  currentScore: number;
  recommendations: Recommendation[];
  onFixClick?: () => void;
  hasAlignment?: boolean;
}

/**
 * Projects the score improvement if all high/medium fixes are applied.
 * Uses a conservative estimate: each high = +4-6, medium = +2-3, low = +1
 * Capped at 95 (no one gets 100 automatically).
 */
function projectScore(current: number, recs: Recommendation[]): number {
  let lift = 0;
  for (const rec of recs) {
    if (rec.priority === 'high') lift += 5;
    else if (rec.priority === 'medium') lift += 2.5;
    else lift += 1;
  }
  return Math.min(95, Math.round(current + lift));
}

function estimateCitationImprovement(current: number, projected: number): string {
  const delta = projected - current;
  if (delta <= 3) return '+5-10%';
  if (delta <= 8) return '+15-25%';
  if (delta <= 15) return '+25-40%';
  return '+40-60%';
}

const FixImpactSimulator: React.FC<FixImpactSimulatorProps> = ({
  currentScore,
  recommendations,
  onFixClick,
  hasAlignment = false,
}) => {
  const projected = projectScore(currentScore, recommendations);
  const delta = projected - currentScore;
  const citationImprovement = estimateCitationImprovement(currentScore, projected);
  const highCount = recommendations.filter(r => r.priority === 'high').length;
  const totalTime = recommendations.reduce((sum, r) => sum + (r.estimatedTimeMinutes || 30), 0);
  const timeLabel = totalTime >= 120 ? `${Math.round(totalTime / 60)}h` : `${totalTime}m`;

  if (delta <= 0) return null;

  return (
    <div className="rounded-[22px] border border-emerald-500/20 bg-gradient-to-b from-emerald-500/[0.06] to-transparent p-4 mb-5">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="h-4 w-4 text-emerald-400" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-300/70">Fix Impact Projection</span>
      </div>

      {/* Score trajectory */}
      <div className="flex items-center gap-4 mb-4">
        <div className="text-center">
          <div className="text-2xl font-semibold text-white/60">{currentScore}</div>
          <div className="text-[10px] text-white/35 mt-0.5">Current</div>
        </div>
        <div className="flex-1 relative h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-white/20"
            style={{ width: `${currentScore}%` }}
          />
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 animate-pulse"
            style={{ width: `${projected}%` }}
          />
        </div>
        <div className="text-center">
          <div className="text-2xl font-semibold text-emerald-300">{projected}</div>
          <div className="text-[10px] text-emerald-300/50 mt-0.5">Projected</div>
        </div>
      </div>

      {/* Impact stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="rounded-xl bg-white/[0.04] border border-white/10 p-2.5 text-center">
          <div className="text-lg font-semibold text-emerald-300">+{delta}</div>
          <div className="text-[10px] text-white/40">Score lift</div>
        </div>
        <div className="rounded-xl bg-white/[0.04] border border-white/10 p-2.5 text-center">
          <div className="text-lg font-semibold text-cyan-300">{citationImprovement}</div>
          <div className="text-[10px] text-white/40">Citation lift</div>
        </div>
        <div className="rounded-xl bg-white/[0.04] border border-white/10 p-2.5 text-center">
          <div className="text-lg font-semibold text-white/70">{timeLabel}</div>
          <div className="text-[10px] text-white/40">Est. effort</div>
        </div>
      </div>

      {/* CTA */}
      {highCount > 0 && (
        <button
          type="button"
          onClick={onFixClick}
          className={`w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition ${
            hasAlignment
              ? 'bg-gradient-to-r from-emerald-400 to-cyan-400 text-slate-950 shadow-[0_10px_30px_rgba(16,185,129,0.18)] hover:scale-[1.01]'
              : 'border border-emerald-400/20 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/15'
          }`}
        >
          <Zap className="h-4 w-4" />
          {hasAlignment
            ? `Fix ${highCount} critical issues automatically`
            : `Unlock auto-fix for ${highCount} critical issues`
          }
          <ArrowRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

export default FixImpactSimulator;
