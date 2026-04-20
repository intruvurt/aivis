/**
 * ScorePanel.tsx
 *
 * Fixed-schema layer score renderer.
 * Receives scores as prop. Zero layout freedom — fixed grid.
 */

import type { LayerScores } from '../../machines/scanMachine';

interface Props {
  overall: number;
  scores: LayerScores;
}

function scoreColor(v: number) {
  if (v >= 80) return 'text-emerald-400';
  if (v >= 60) return 'text-green-400';
  if (v >= 40) return 'text-amber-400';
  if (v >= 20) return 'text-orange-400';
  return 'text-red-400';
}

function scoreRingBg(v: number) {
  if (v >= 80) return 'border-emerald-400/40 bg-emerald-400/10';
  if (v >= 60) return 'border-green-400/40 bg-green-400/10';
  if (v >= 40) return 'border-amber-400/40 bg-amber-400/10';
  if (v >= 20) return 'border-orange-400/40 bg-orange-400/10';
  return 'border-red-400/40 bg-red-400/10';
}

function ScoreCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/[0.035] border border-white/8">
      <span className={`text-2xl font-black tabular-nums ${scoreColor(value)}`}>{value}</span>
      <span className="text-[10px] font-semibold uppercase tracking-widest text-white/40 text-center leading-tight">
        {label}
      </span>
    </div>
  );
}

export function ScorePanel({ overall, scores }: Props) {
  return (
    <div className="flex items-center gap-5 mb-6">
      {/* Overall ring */}
      <div
        className={`w-20 h-20 rounded-full border-4 flex items-center justify-center shrink-0 ${scoreRingBg(overall)}`}
      >
        <span className={`text-3xl font-black ${scoreColor(overall)}`}>{overall}</span>
      </div>

      {/* Layer cells — fixed 3-column */}
      <div className="grid grid-cols-3 gap-2 flex-1">
        <ScoreCell label="Crawl" value={scores.crawl} />
        <ScoreCell label="Semantic" value={scores.semantic} />
        <ScoreCell label="Authority" value={scores.authority} />
      </div>
    </div>
  );
}
