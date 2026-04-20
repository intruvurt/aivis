/**
 * ResultView.tsx
 *
 * RESULT phase renderer. Deterministic grid — no layout freedom.
 * Structured output only: ScorePanel + primary insight + findings + evidence + gate.
 */

import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { ScorePanel } from './ScorePanel';
import { EvidencePanel } from './EvidencePanel';
import { useScan } from '../../context/ScanContext';
import type { ScanResult } from '../../machines/scanMachine';

interface Props {
  result: ScanResult;
}

export function ResultView({ result }: Props) {
  const { reset } = useScan();
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  const scores = {
    crawl: result.scores.crawl ?? 50,
    semantic: result.scores.semantic ?? 50,
    authority: result.scores.authority ?? 50,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="result-grid mt-6 w-full max-w-lg mx-auto"
    >
      <div className="rounded-2xl border border-white/10 bg-[#111827]/60 p-6 sm:p-8">
        {/* Score panel (fixed schema) */}
        <ScorePanel overall={result.score} scores={scores} />

        {/* Status line — single truth */}
        <p className="text-white font-bold text-base mb-1">{result.status_line}</p>
        <p className="text-white/35 text-xs font-mono mb-5 truncate">{result.url}</p>

        {/* Findings (primary insight, one at a time) */}
        <div className="space-y-2.5 mb-5">
          {result.findings.map((finding, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
              <span className="text-sm text-white/65 text-left">{finding}</span>
            </div>
          ))}
        </div>

        {/* Top recommendation */}
        {result.recommendation && (
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-emerald-500/8 border border-emerald-400/18 mb-5">
            <svg
              className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <div className="text-left">
              <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest mb-1">
                Top Fix
              </p>
              <p className="text-sm text-emerald-200/80">{result.recommendation}</p>
            </div>
          </div>
        )}

        {/* Hard blockers */}
        {result.hard_blockers.length > 0 && (
          <div className="p-3.5 rounded-xl bg-red-500/8 border border-red-400/18 mb-5">
            <p className="text-[10px] text-red-400 font-bold uppercase tracking-widest mb-2">
              Hard blockers — capping your score
            </p>
            <div className="space-y-1.5">
              {result.hard_blockers.map((b, i) => (
                <p key={i} className="text-sm text-red-300/75 text-left">
                  · {b}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Evidence panel — collapsed truth graph */}
        {result.cites.length > 0 && (
          <div className="mb-5">
            <EvidencePanel cites={result.cites} />
          </div>
        )}

        {/* Hard gate: full audit */}
        <div className="relative rounded-xl border border-white/8 bg-[#0a0a14]/80 p-5 overflow-hidden">
          <div className="absolute inset-0 backdrop-blur-sm bg-[#060607]/60 z-10 flex flex-col items-center justify-center gap-3 px-4">
            <p className="text-white/55 text-sm text-center">
              Full audit: category breakdowns, BRAG evidence chain, fix priorities
            </p>
            <Link
              to={
                isAuthenticated
                  ? '/app/analyze'
                  : `/auth?redirect=/app/analyze&url=${encodeURIComponent(result.url)}`
              }
              className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-violet-600 text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:from-cyan-400 hover:to-violet-500 transition-all shadow-lg shadow-violet-500/20"
            >
              Unlock full audit — free
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14 5l7 7m0 0l-7 7m7-7H3"
                />
              </svg>
            </Link>
          </div>
          {/* Blurred skeleton */}
          <div
            className="space-y-2.5 opacity-30 select-none pointer-events-none"
            aria-hidden="true"
          >
            <div className="h-3 bg-white/10 rounded w-3/4" />
            <div className="h-3 bg-white/10 rounded w-1/2" />
            <div className="h-3 bg-white/10 rounded w-2/3" />
            <div className="h-7 bg-white/5 rounded mt-3" />
            <div className="h-3 bg-white/10 rounded w-5/6" />
          </div>
        </div>

        {/* Reset */}
        <button
          type="button"
          onClick={() => {
            reset();
            navigate('/landing', { replace: false });
          }}
          className="w-full mt-4 text-xs text-white/25 hover:text-white/50 transition-colors py-1"
        >
          ← Scan another URL
        </button>
      </div>
    </motion.div>
  );
}
