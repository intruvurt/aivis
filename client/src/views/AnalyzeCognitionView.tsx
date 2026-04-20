/**
 * AnalyzeCognitionView.tsx
 *
 * Full-viewport replacement for the analyze page.
 * Three phases, zero SaaS chrome.
 *
 *   idle     → black screen, centered URL input
 *   scanning → 3-panel layout, commits growing in real-time
 *   complete → 3-panel layout, full entity graph, time scrubber active
 *
 * The view sits at z-[100] (fixed overlay) so it covers AppShell while
 * keeping auth and routing intact.
 */

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import CognitionReplay from './CognitionReplay';
import { EntityGraph } from './EntityGraph';
import {
  buildCognitionData,
  buildScanningCommits,
  buildScanningCognitionData,
} from './buildCognitionData';
import { buildReplayData, buildScanReplayNodes } from './buildReplayData';
import { graphEventBus } from '../lib/graphEventBus';
import {
  replayEngine,
  setReplayMode,
  onReplayModeChange,
  type ReplayMode,
} from '../lib/replayEngine';
import { useReplayStore } from '../../stores/replayStore';
import type { CognitionData } from './types';
import type { AnalysisResponse } from '@shared/types';
import '../../styles/forensic-grid.css';
import '../../styles/cognition-replay.css';

// ── Score color ───────────────────────────────────────────────────────────────

function scoreColor(s: number): string {
  if (s >= 65) return '#22c55e';
  if (s >= 40) return '#eab308';
  return '#ef4444';
}

// ── URL validation (mirrors AnalyzePage) ─────────────────────────────────────

function isValidUrl(input: string): boolean {
  try {
    const normalized = input.startsWith('http') ? input : `https://${input}`;
    const u = new URL(normalized);
    const h = u.hostname.toLowerCase();
    if (
      h === 'localhost' ||
      h === '127.0.0.1' ||
      h === '0.0.0.0' ||
      /^10\./.test(h) ||
      /^192\.168\./.test(h) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(h)
    )
      return false;
    return !!h && h.includes('.');
  } catch {
    return false;
  }
}

// ── Idle screen ───────────────────────────────────────────────────────────────

interface IdleProps {
  onSubmit: (url: string) => void;
  error: string | null;
}

function IdleScreen({ onSubmit, error }: IdleProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Autofocus after mount transition
    const t = setTimeout(() => inputRef.current?.focus(), 320);
    return () => clearTimeout(t);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || !isValidUrl(trimmed)) return;
    onSubmit(trimmed);
  };

  return (
    <motion.div
      key="idle"
      className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.4 }}
    >
      {/* Subtle grid background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.018) 1px,transparent 1px),' +
            'linear-gradient(90deg,rgba(255,255,255,0.018) 1px,transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-8 w-full max-w-lg px-6">
        {/* Micro-logo / system label */}
        <div className="text-[10px] font-mono tracking-[0.25em] text-white/20 uppercase">
          cognition map · v2
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="w-full flex flex-col items-center gap-3">
          <label className="sr-only" htmlFor="cog-url-input">
            URL to analyze
          </label>
          <div className="relative w-full">
            <input
              id="cog-url-input"
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="paste url"
              autoComplete="off"
              spellCheck={false}
              className="w-full bg-transparent border-0 border-b text-white text-xl font-mono text-center py-3 px-2 outline-none placeholder-white/15 transition-colors"
              style={{ borderBottomColor: 'rgba(255,255,255,0.12)' }}
              onFocus={(e) => (e.currentTarget.style.borderBottomColor = 'rgba(255,255,255,0.35)')}
              onBlur={(e) => (e.currentTarget.style.borderBottomColor = 'rgba(255,255,255,0.12)')}
            />
          </div>

          <button
            type="submit"
            disabled={!value.trim() || !isValidUrl(value)}
            className="mt-2 text-[11px] font-mono text-white/25 hover:text-white/50 disabled:text-white/10 disabled:cursor-not-allowed border border-white/10 hover:border-white/25 disabled:border-white/5 px-5 py-1.5 transition-all duration-150"
          >
            [ analyze ]
          </button>
        </form>

        {/* Error */}
        {error && (
          <p className="text-[11px] font-mono text-red-400/80 text-center max-w-sm">{error}</p>
        )}

        {/* Legend */}
        <div className="flex items-center gap-6 mt-4">
          {[
            { color: '#22c55e', label: 'confirmed' },
            { color: '#eab308', label: 'uncertain' },
            { color: '#ef4444', label: 'conflict' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className="block w-1.5 h-1.5 rounded-full" style={{ background: color }} />
              <span className="text-[9px] font-mono text-white/20">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ── Cognition overlay ─────────────────────────────────────────────────────────

interface CognitionOverlayProps {
  scanning: boolean;
  scanStep: string;
  result: AnalysisResponse | null;
  onReset: () => void;
}

function CognitionOverlay({ scanning, scanStep, result, onReset }: CognitionOverlayProps) {
  const [cognData, setCognData] = useState<CognitionData | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [replayMode, setLocalReplayMode] = useState<ReplayMode>('LIVE');

  const loadCommits = useReplayStore((s) => s.loadCommits);
  const cursorSeq = useReplayStore((s) => s.cursor.seq);
  const maxSeq = useReplayStore((s) => s.maxSeq);
  const storeReset = useReplayStore((s) => s.reset);

  // Track last synced step to avoid redundant store writes
  const syncedStepRef = useRef<string>('');
  const syncedResultRef = useRef<string>('');

  // ── Sync local mode state from engine singleton ────────────────────────────
  useEffect(() => {
    return onReplayModeChange((m) => setLocalReplayMode(m));
  }, []);

  // ── Auto-detect LIVE vs REPLAY from cursor position ───────────────────────
  // If user drags scrubber below maxSeq → enter REPLAY; reach maxSeq → LIVE.
  useEffect(() => {
    if (maxSeq === 0) return;
    const derived: ReplayMode = cursorSeq < maxSeq ? 'REPLAY' : 'LIVE';
    setReplayMode(derived);
  }, [cursorSeq, maxSeq]);

  // ── Scanning phase: populate store + set live graph from placeholder data ──
  useEffect(() => {
    if (!scanning || result) return;
    if (scanStep === syncedStepRef.current) return;
    syncedStepRef.current = scanStep;

    graphEventBus.emit('step', scanStep);

    const commits = buildScanningCommits(scanStep);
    if (commits.length === 0) return;

    const scanningData = buildScanningCognitionData(scanStep);
    setCognData(scanningData);

    // Load engine with scanning placeholder data
    replayEngine.load(scanningData);

    const nodes = buildScanReplayNodes(commits);
    loadCommits('scanning', nodes, {});
    // LIVE mode: advance cursor only if not in REPLAY
    if (replayMode === 'LIVE') {
      useReplayStore.getState().setCursorSeq(nodes[nodes.length - 1].seq);
    }
  }, [scanning, scanStep, result, loadCommits, replayMode]);

  // ── Complete phase: populate engine + store with real analysis data ────────
  useEffect(() => {
    if (!result) return;
    const cacheKey = result.analyzed_at + result.url;
    if (cacheKey === syncedResultRef.current) return;
    syncedResultRef.current = cacheKey;

    const data = buildCognitionData(result);
    setCognData(data);

    // Load deterministic engine — builds all snapshots O(n)
    replayEngine.load(data);

    const { commitNodes, diffs } = buildReplayData(data);
    loadCommits(result.url, commitNodes, diffs);
    // Always advance to end on completion (LIVE init position)
    useReplayStore.getState().setCursorSeq(commitNodes[commitNodes.length - 1].seq);
    setReplayMode('LIVE');

    graphEventBus.emit('complete', result);
  }, [result, loadCommits]);

  // ── Clean up engine + store + bus on unmount ──────────────────────────────
  useEffect(() => {
    return () => {
      storeReset();
      graphEventBus.emit('reset', undefined);
      setReplayMode('LIVE');
    };
  }, [storeReset]);

  // ── Deterministic state projection via ReplayEngine ───────────────────────
  // resolve(cursorSeq) → ScanState checkpoint + forward replay.
  // O(SNAPSHOT_INTERVAL=50) max regardless of total commit count.
  // Falls back to simple revealedAtStep filter if engine not yet loaded.
  const projectedState = useMemo(() => {
    if (replayEngine.isLoaded()) {
      return replayEngine.resolve(cursorSeq);
    }
    // Pre-load fallback (scanning placeholder, engine not ready yet)
    return null;
  }, [cursorSeq]);

  const visibleNodes = useMemo(() => {
    if (projectedState) return [...projectedState.nodes.values()];
    return cognData?.nodes.filter((n) => n.revealedAtStep <= cursorSeq) ?? [];
  }, [projectedState, cognData, cursorSeq]);

  const visibleEdges = useMemo(() => {
    if (projectedState) return projectedState.edges;
    return cognData?.edges.filter((e) => e.revealedAtStep <= cursorSeq) ?? [];
  }, [projectedState, cognData, cursorSeq]);

  // Conflicts derived from engine state (shown in graph overlay)
  const conflicts = projectedState?.conflicts ?? [];

  const handleNodeClick = useCallback(
    (id: string) => setSelectedNodeId((prev) => (prev === id ? null : id)),
    []
  );

  const score = result?.visibility_score;

  // Center panel: entity graph
  const graphSlot = (
    <div className="relative w-full h-full">
      <EntityGraph
        nodes={visibleNodes}
        edges={visibleEdges}
        selectedNodeId={selectedNodeId}
        onNodeHover={setHoveredNodeId}
        onNodeClick={handleNodeClick}
      />

      {/* Top-left overlay: scan info */}
      <div
        className="fl-graph__overlay-tl font-mono pointer-events-none"
        style={{ color: 'rgba(255,255,255,0.25)' }}
      >
        {result ? (
          <>
            <span style={{ color: 'rgba(255,255,255,0.15)' }}>scan:</span> {result.url}
            {'  '}
            <span style={{ color: 'rgba(255,255,255,0.15)' }}>score:</span>{' '}
            <span style={{ color: score != null ? scoreColor(score) : '#888' }}>
              {score ?? '–'}
            </span>
            {conflicts.length > 0 && (
              <>
                {'  '}
                <span style={{ color: '#ef4444' }}>
                  ⚡ {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''}
                </span>
              </>
            )}
          </>
        ) : (
          <>
            <span style={{ color: 'rgba(255,255,255,0.15)' }}>status:</span>{' '}
            <span style={{ color: '#06b6d4' }}>{scanStep}…</span>
          </>
        )}
      </div>

      {/* LIVE / REPLAY mode badge */}
      <div
        className="absolute top-2 left-1/2 -translate-x-1/2 pointer-events-none"
        style={{ zIndex: 10 }}
      >
        <span
          className="text-[9px] font-mono px-2 py-0.5 border"
          style={
            replayMode === 'LIVE'
              ? {
                  color: '#22c55e',
                  borderColor: 'rgba(34,197,94,0.3)',
                  background: 'rgba(34,197,94,0.06)',
                }
              : {
                  color: '#eab308',
                  borderColor: 'rgba(234,179,8,0.3)',
                  background: 'rgba(234,179,8,0.06)',
                }
          }
        >
          {replayMode === 'LIVE' ? '● LIVE' : '⏸ REPLAY'}
        </span>
      </div>

      {/* Top-right: action buttons */}
      <div className="fl-graph__overlay-tr gap-2">
        {result?.audit_id && (
          <Link
            to={`/app/audits/${result.audit_id}`}
            className="text-[10px] font-mono text-white/30 hover:text-white/60 border border-white/10 hover:border-white/25 px-3 py-1 transition-all"
          >
            full report →
          </Link>
        )}
        <button
          type="button"
          onClick={onReset}
          className="text-[10px] font-mono text-white/20 hover:text-white/40 border border-white/8 hover:border-white/20 px-3 py-1 transition-all"
        >
          ✕ new scan
        </button>
      </div>
    </div>
  );

  return (
    <motion.div
      key="overlay"
      className="fixed inset-0 z-[100]"
      initial={{ opacity: 0, scale: 1.01 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      {/* CognitionReplay renders MainGrid (fl-shell) with CommitGraph,
          CommitInspector, TimelineControls already wired to replayStore.
          We inject our EntityGraph as the center slot. */}
      <CognitionReplay
        graphSlot={graphSlot}
        // Hide timeline during scan — scrubbing is for post-scan replay
        hideTimeline={scanning && !result}
      />
    </motion.div>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

export interface AnalyzeCognitionViewProps {
  /** Whether a scan is in progress */
  loading: boolean;
  /** Current pipeline step key (e.g. "dns", "ai1") */
  step: string;
  /** AnalysisResponse — undefined/null until scan completes */
  result: AnalysisResponse | null;
  /** Error message if scan failed */
  error: string | null;
  /** Called when user submits a URL in the idle input */
  onSubmit: (url: string) => void;
}

export default function AnalyzeCognitionView({
  loading,
  step,
  result,
  error,
  onSubmit,
}: AnalyzeCognitionViewProps) {
  const [dismissed, setDismissed] = useState(false);

  // When user clicks "new scan", reset to idle
  const handleReset = useCallback(() => {
    setDismissed(true);
    // brief delay so the fade-out plays
    setTimeout(() => setDismissed(false), 400);
  }, []);

  const showOverlay = loading || (result != null && !dismissed);
  const showIdle = !showOverlay;

  return (
    <AnimatePresence mode="wait">
      {showIdle ? (
        <IdleScreen key="idle" onSubmit={onSubmit} error={error} />
      ) : (
        <CognitionOverlay
          key="overlay"
          scanning={loading}
          scanStep={step}
          result={dismissed ? null : result}
          onReset={handleReset}
        />
      )}
    </AnimatePresence>
  );
}
