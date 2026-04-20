/**
 * TimelineControls.tsx — Bottom panel: dual-mode scrubber (§7).
 *
 * Two interaction modes:
 *   Seq mode: continuous range input — drag to replay any frame
 *   Commit mode: step back / step forward between discrete commits
 *
 * Scrub events are debounced to 16ms (one rAF tick) to avoid recomputing
 * graph state on every pixel of drag (§10 performance: debounced scrubber).
 *
 * §9 geometry:
 *   fl-timeline      → 96px fixed height container
 *   fl-timeline__controls → step ◀ | track | ▶
 *   fl-timeline__meta     → commit hash · seq · position
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useReplayStore } from '../../stores/replayStore';
import {
  getReplayMode,
  onReplayModeChange,
  setReplayMode,
  type ReplayMode,
} from '../../lib/replayEngine';

const SCRUB_DEBOUNCE_MS = 16;

export default function TimelineControls() {
  const scanId = useReplayStore((s) => s.scanId);
  const commits = useReplayStore((s) => s.commits);
  const cursor = useReplayStore((s) => s.cursor);
  const maxSeq = useReplayStore((s) => s.maxSeq);
  const stepForward = useReplayStore((s) => s.stepForward);
  const stepBack = useReplayStore((s) => s.stepBack);
  const setCursorSeq = useReplayStore((s) => s.setCursorSeq);

  // Track engine mode for LIVE/REPLAY badge
  const [mode, setLocalMode] = useState<ReplayMode>(getReplayMode());
  useEffect(() => onReplayModeChange((m) => setLocalMode(m)), []);

  const jumpToLive = useCallback(() => {
    setCursorSeq(maxSeq);
    setReplayMode('LIVE');
  }, [setCursorSeq, maxSeq]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleScrub = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = Number(e.target.value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => setCursorSeq(val), SCRUB_DEBOUNCE_MS);
    },
    [setCursorSeq]
  );

  const currentIdx = commits.findIndex((c) => c.seq === cursor.seq);
  const currentCommit = currentIdx >= 0 ? commits[currentIdx] : null;
  const fillPct = maxSeq > 0 ? (cursor.seq / maxSeq) * 100 : 0;

  if (commits.length === 0) {
    return (
      <div className="fl-timeline">
        <span className="tc-empty">No commits loaded.</span>
      </div>
    );
  }

  return (
    <div className="fl-timeline">
      {/* Controls row: step back | scrubber track | step forward */}
      <div className="fl-timeline__controls">
        <button
          type="button"
          className="tc-btn"
          onClick={stepBack}
          disabled={currentIdx <= 0}
          aria-label="Previous commit"
          title="Step back"
        >
          ◀
        </button>

        <div className="fl-timeline__track-wrap">
          {/* Visual track */}
          <div className="fl-timeline__track" aria-hidden="true" />
          {/* Filled progress */}
          <div className="tc-fill" style={{ width: `${fillPct}%` }} aria-hidden="true" />
          {/* Thumb marker */}
          <div className="fl-timeline__thumb" style={{ left: `${fillPct}%` }} aria-hidden="true" />
          {/* Range input covers full hit area — transparent overlay */}
          <input
            type="range"
            className="tc-range"
            min={0}
            max={maxSeq}
            value={cursor.seq}
            onChange={handleScrub}
            aria-label="Replay scrubber"
            aria-valuemin={0}
            aria-valuemax={maxSeq}
            aria-valuenow={cursor.seq}
            aria-valuetext={`Commit ${currentIdx + 1} of ${commits.length}`}
          />
        </div>

        <button
          type="button"
          className="tc-btn"
          onClick={stepForward}
          disabled={currentIdx >= commits.length - 1}
          aria-label="Next commit"
          title="Step forward"
        >
          ▶
        </button>
      </div>

      {/* Mode row: LIVE badge or jump-to-live button */}
      <div className="flex items-center justify-between px-1 mb-1" style={{ minHeight: '18px' }}>
        <span
          className="text-[9px] font-mono px-1.5 py-0.5 border"
          style={
            mode === 'LIVE'
              ? {
                  color: '#22c55e',
                  borderColor: 'rgba(34,197,94,0.25)',
                  background: 'rgba(34,197,94,0.06)',
                }
              : {
                  color: '#eab308',
                  borderColor: 'rgba(234,179,8,0.25)',
                  background: 'rgba(234,179,8,0.06)',
                }
          }
        >
          {mode === 'LIVE' ? '● LIVE' : '⏸ REPLAY'}
        </span>
        {mode === 'REPLAY' && (
          <button
            type="button"
            onClick={jumpToLive}
            className="text-[9px] font-mono text-white/30 hover:text-white/60 border border-white/10 hover:border-white/25 px-2 py-0.5 transition-all"
          >
            ⏵ live
          </button>
        )}
      </div>

      {/* Metadata row: scanId · hash · seq · position */}
      <div className="fl-timeline__meta">
        {scanId && (
          <>
            <span title={`Scan: ${scanId}`}>{scanId.slice(0, 12)}…</span>
            <span className="tc-sep" aria-hidden="true">
              ·
            </span>
          </>
        )}
        <span className="tc-meta-mono" title={currentCommit?.hash ?? ''}>
          {currentCommit ? currentCommit.hash.slice(0, 8) : '────────'}
        </span>
        <span className="tc-sep" aria-hidden="true">
          ·
        </span>
        <span className="tc-meta-mono">#{cursor.seq}</span>
        <span className="tc-sep" aria-hidden="true">
          ·
        </span>
        <span>
          {currentIdx >= 0 ? currentIdx + 1 : '?'} / {commits.length}
        </span>
        {currentCommit && (
          <>
            <span className="tc-sep" aria-hidden="true">
              ·
            </span>
            <span className="tc-conf" style={{ color: confColor(currentCommit.confidence) }}>
              {(currentCommit.confidence * 100).toFixed(0)}% conf
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function confColor(c: number): string {
  if (c >= 0.7) return '#00ff9c';
  if (c >= 0.4) return '#ffc857';
  return '#ff4d4d';
}
