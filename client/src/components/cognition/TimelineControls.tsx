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
  const trackWrapRef = useRef<HTMLDivElement | null>(null);
  const [hoverPreview, setHoverPreview] = useState<{ index: number; leftPct: number } | null>(null);

  useEffect(() => {
    const el = trackWrapRef.current;
    if (!el) return;
    el.style.setProperty('--tc-fill-pct', `${fillPct}%`);
    el.style.setProperty('--tc-thumb-pct', `${fillPct}%`);
    el.style.setProperty('--tc-preview-pct', `${hoverPreview?.leftPct ?? fillPct}%`);
  }, [fillPct, hoverPreview?.leftPct]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const scrubToCommitIndex = useCallback(
    (index: number) => {
      if (commits.length === 0) return;
      const safeIndex = Math.max(0, Math.min(index, commits.length - 1));
      const target = commits[safeIndex];
      if (!target) return;
      setCursorSeq(target.seq);
    },
    [commits, setCursorSeq]
  );

  const currentIdx = commits.findIndex((c) => c.seq === cursor.seq);
  const currentCommit = currentIdx >= 0 ? commits[currentIdx] : null;
  const fillPct = maxSeq > 0 ? (cursor.seq / maxSeq) * 100 : 0;

  const derivePreviewFromClientX = useCallback(
    (clientX: number): { index: number; leftPct: number } | null => {
      const el = trackWrapRef.current;
      if (!el || commits.length === 0) return null;
      const rect = el.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / width));
      const maxIndex = Math.max(0, commits.length - 1);
      const targetIndex = Math.round(ratio * maxIndex);
      return { index: targetIndex, leftPct: ratio * 100 };
    },
    [commits.length]
  );

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const preview = derivePreviewFromClientX(clientX);
      if (!preview) return;
      if (mode !== 'REPLAY') setReplayMode('REPLAY');
      scrubToCommitIndex(preview.index);
    },
    [derivePreviewFromClientX, mode, scrubToCommitIndex]
  );

  const handleScrub = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const commitIndex = Number(e.target.value);
      // Enter replay mode immediately when the user touches the scrubber.
      if (mode !== 'REPLAY') setReplayMode('REPLAY');
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => scrubToCommitIndex(commitIndex), SCRUB_DEBOUNCE_MS);
    },
    [mode, scrubToCommitIndex]
  );

  const handleScrubCommit = useCallback(
    (e: React.MouseEvent<HTMLInputElement> | React.TouchEvent<HTMLInputElement>) => {
      const input = e.currentTarget;
      const commitIndex = Number(input.value);
      scrubToCommitIndex(commitIndex);
    },
    [scrubToCommitIndex]
  );

  const handleTrackPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const preview = derivePreviewFromClientX(e.clientX);
      setHoverPreview(preview);
      seekFromClientX(e.clientX);
    },
    [derivePreviewFromClientX, seekFromClientX]
  );

  const handleTrackPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const preview = derivePreviewFromClientX(e.clientX);
      setHoverPreview(preview);
      if (e.buttons !== 1) return;
      seekFromClientX(e.clientX);
    },
    [derivePreviewFromClientX, seekFromClientX]
  );

  const handleTrackPointerLeave = useCallback(() => {
    setHoverPreview(null);
  }, []);

  const toggleLivePause = useCallback(() => {
    if (mode === 'LIVE') {
      setReplayMode('REPLAY');
      return;
    }
    jumpToLive();
  }, [jumpToLive, mode]);

  const stepByDelta = useCallback(
    (delta: number) => {
      if (commits.length === 0) return;
      const maxIndex = Math.max(0, commits.length - 1);
      const activeIndex = Math.max(0, currentIdx);
      const targetIndex = Math.max(0, Math.min(maxIndex, activeIndex + delta));
      if (mode !== 'REPLAY') setReplayMode('REPLAY');
      scrubToCommitIndex(targetIndex);
    },
    [commits.length, currentIdx, mode, scrubToCommitIndex]
  );

  const handleRangeKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (commits.length === 0) return;
      const maxIndex = Math.max(0, commits.length - 1);
      const activeIndex = Math.max(0, currentIdx);
      const stepSize = e.shiftKey ? 5 : 1;

      if (e.key === ' ') {
        e.preventDefault();
        toggleLivePause();
        return;
      }

      let targetIndex: number | null = null;
      if (e.key === 'ArrowLeft') targetIndex = activeIndex - stepSize;
      if (e.key === 'ArrowRight') targetIndex = activeIndex + stepSize;
      if (e.key === 'Home') targetIndex = 0;
      if (e.key === 'End') targetIndex = maxIndex;

      if (targetIndex === null) return;
      e.preventDefault();
      stepByDelta(targetIndex - activeIndex);
    },
    [commits.length, currentIdx, stepByDelta, toggleLivePause]
  );

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

        <div
          ref={trackWrapRef}
          className="fl-timeline__track-wrap"
          onPointerDown={handleTrackPointerDown}
          onPointerMove={handleTrackPointerMove}
          onPointerLeave={handleTrackPointerLeave}
        >
          {/* Visual track */}
          <div className="fl-timeline__track" aria-hidden="true" />
          {/* Filled progress */}
          <div className="tc-fill" aria-hidden="true" />
          {/* Thumb marker */}
          <div className="fl-timeline__thumb" aria-hidden="true" />
          {hoverPreview && (
            <div className="tc-hover-preview" aria-hidden="true">
              {hoverPreview.index + 1}/{commits.length} ·{' '}
              {(commits[hoverPreview.index]?.hash ?? '--------').slice(0, 8)}
            </div>
          )}
          {/* Range input covers full hit area — transparent overlay */}
          <input
            type="range"
            className="tc-range"
            min={0}
            max={Math.max(0, commits.length - 1)}
            value={Math.max(0, currentIdx)}
            onChange={handleScrub}
            onMouseUp={handleScrubCommit}
            onTouchEnd={handleScrubCommit}
            onKeyDown={handleRangeKeyDown}
            aria-label="Replay scrubber"
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
      <div className="tc-mode-row">
        <span
          className={`tc-mode-badge ${mode === 'LIVE' ? 'tc-mode-badge--live' : 'tc-mode-badge--replay'}`}
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
            <span className={`tc-conf ${confClass(currentCommit.confidence)}`}>
              {(currentCommit.confidence * 100).toFixed(0)}% conf
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function confClass(c: number): string {
  if (c >= 0.7) return 'tc-conf--high';
  if (c >= 0.4) return 'tc-conf--mid';
  return 'tc-conf--low';
}
