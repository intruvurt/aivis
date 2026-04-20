/**
 * ScanningView.tsx
 *
 * SCANNING phase visualizer.
 * This is NOT a UI component — it is a live state emitter visualization.
 * Receives stage as prop; renders only what the machine says is true.
 * No cards. No layout variation. No sidebar.
 */

import { motion } from 'framer-motion';
import { SCAN_STAGE_ORDER, STAGE_LABEL } from '../../machines/scanMachine';
import type { ScanStage } from '../../machines/scanMachine';
import { useScan } from '../../context/ScanContext';

interface Props {
  stage: ScanStage;
  url: string;
}

// SSE event type → terminal prefix + color
const PREFIX: Record<string, { label: string; color: string }> = {
  FETCHING: { label: '[scan]', color: 'text-cyan-400' },
  PARSING_DOM: { label: '[scan]', color: 'text-cyan-400' },
  EXTRACTING_ENTITIES: { label: '[cite]', color: 'text-violet-400' },
  RESOLVING_CITATIONS: { label: '[cite]', color: 'text-violet-400' },
  SCORING: { label: '[interp]', color: 'text-amber-400' },
  FINALIZING: { label: '[brag]', color: 'text-emerald-400' },
};

export function ScanningView({ stage, url }: Props) {
  const { state } = useScan();
  const citeCount = state.phase === 'SCANNING' ? state.cites.length : 0;
  const currentIndex = SCAN_STAGE_ORDER.indexOf(stage);

  return (
    <div className="w-full max-w-lg mx-auto mt-4">
      {/* Terminal chrome */}
      <div className="rounded-2xl border border-white/10 bg-[#0d1117] overflow-hidden">
        {/* Titlebar */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/8 bg-[#111827]/60">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
          <span className="ml-3 text-xs text-white/30 font-mono truncate">{url}</span>
          <span className="ml-auto text-[10px] font-bold uppercase tracking-widest text-white/20">
            cite-ledger scan
          </span>
        </div>

        {/* Stream output */}
        <div className="p-4 font-mono text-sm space-y-2 min-h-[180px]">
          {SCAN_STAGE_ORDER.slice(0, currentIndex + 1).map((s, i) => {
            const pfx = PREFIX[s];
            const isActive = s === stage;
            const isDone = i < currentIndex;

            return (
              <motion.div
                key={s}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25, delay: 0 }}
                className="flex items-center gap-2"
              >
                {/* Prefix */}
                <span className={`shrink-0 ${pfx.color} ${isDone ? 'opacity-50' : ''}`}>
                  {pfx.label}
                </span>

                {/* Label */}
                <span
                  className={
                    isDone ? 'text-white/30' : isActive ? 'text-white/85' : 'text-white/50'
                  }
                >
                  {STAGE_LABEL[s]}
                </span>

                {/* Live badge */}
                {isActive && s === 'EXTRACTING_ENTITIES' && citeCount > 0 && (
                  <span className="text-xs text-cyan-400 tabular-nums">{citeCount} cites</span>
                )}

                {/* Done check */}
                {isDone && <span className="text-emerald-400 ml-auto text-xs">✓</span>}

                {/* Active spinner */}
                {isActive && (
                  <svg
                    className="w-3 h-3 text-white/40 animate-spin ml-auto"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
