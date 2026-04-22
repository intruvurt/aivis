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
import CognitionReplay from '../components/cognition/CognitionReplay';
import ScanStageTimeline, {
  pipelineStepToStage,
  type ScanStage,
} from '../components/cognition/ScanStageTimeline';
import StageDeepView from '../components/cognition/StageDeepView';
import { EntityGraph } from '../components/cognition/EntityGraph';
import {
  buildCognitionData,
  buildScanningCommits,
  buildScanningCognitionData,
} from '../components/cognition/buildCognitionData';
import { buildReplayData, buildScanReplayNodes } from '../components/cognition/buildReplayData';
import { graphEventBus } from '../lib/graphEventBus';
import {
  replayEngine,
  setReplayMode,
  onReplayModeChange,
  type ReplayMode,
} from '../lib/replayEngine';
import { useReplayStore } from '../stores/replayStore';
import type { CognitionData } from '../components/cognition/types';
import type { AnalysisResponse } from '@shared/types';
import '../styles/forensic-grid.css';
import '../styles/cognition-replay.css';

// ── Score color ───────────────────────────────────────────────────────────────

function scoreColor(s: number): string {
  if (s >= 65) return '#22c55e';
  if (s >= 40) return '#eab308';
  return '#ef4444';
}

function visibilityLabel(score: number): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (score >= 65) return 'HIGH';
  if (score >= 40) return 'MEDIUM';
  return 'LOW';
}

function normalizeToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function nodeMatchesAnyToken(label: string, tokens: string[]): boolean {
  const normalized = ` ${normalizeToken(label)} `;
  return tokens.some((token) => {
    const t = normalizeToken(token);
    if (!t) return false;
    return normalized.includes(` ${t} `) || normalized.includes(t);
  });
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
  /** Whether to show a link back to the main dashboard */
  showBack?: boolean;
}

function IdleScreen({ onSubmit, error, showBack }: IdleProps) {
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
      className="fixed inset-0 bg-[#080c14] flex flex-col items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.4 }}
    >
      {/* Escape — back to dashboard */}
      {showBack && (
        <div className="absolute top-4 right-5 z-10">
          <Link
            to="/app/overview"
            className="text-[9px] font-mono text-white/20 hover:text-white/50 transition-colors"
          >
            ← dashboard
          </Link>
        </div>
      )}

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

  // Stage-primary desktop layout: user can select a stage to inspect
  const [selectedStage, setSelectedStage] = useState<ScanStage>(pipelineStepToStage(scanStep));
  const [showStableNodes, setShowStableNodes] = useState(false);

  // Follow active pipeline stage until user overrides
  const userOverrodeStageRef = useRef(false);
  useEffect(() => {
    if (!userOverrodeStageRef.current) {
      setSelectedStage(pipelineStepToStage(scanStep));
    }
  }, [scanStep]);
  // When scan completes, unlock override so stage auto-advances to 'score'
  useEffect(() => {
    if (result) {
      userOverrodeStageRef.current = false;
      setSelectedStage('score');
    }
  }, [result]);

  const handleStageSelect = useCallback((stage: ScanStage) => {
    userOverrodeStageRef.current = true;
    setSelectedStage(stage);
  }, []);

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

  const trustFocusTokens = useMemo(() => {
    if (!result) return ['trust', 'authority', 'security', 'https', 'entity'];

    const rubricTrust = (result.strict_rubric?.gates ?? [])
      .filter((g) => /trust|security|author|https|crawl|reliability/i.test(`${g.id} ${g.label}`))
      .map((g) => ({ token: g.label, deficit: Math.max(0, 100 - g.score_0_100) }));

    const presence = result.answer_presence;
    const presenceSignals = [
      {
        token: 'authority',
        deficit: Math.max(0, 100 - (presence?.authority_alignment_score ?? 100)),
      },
      { token: 'entity', deficit: Math.max(0, 100 - (presence?.entity_clarity_score ?? 100)) },
      { token: 'citation', deficit: Math.max(0, 100 - (presence?.citation_coverage_score ?? 100)) },
    ];

    return [...rubricTrust, ...presenceSignals]
      .sort((a, b) => b.deficit - a.deficit)
      .slice(0, 5)
      .map((x) => x.token)
      .concat(['trust', 'authority', 'security', 'https']);
  }, [result]);

  const scoreFocusTokens = useMemo(() => {
    if (!result) return ['score', 'category', 'issue'];

    const gradeSignals = (result.category_grades ?? []).map((g) => ({
      token: g.label,
      deficit: Math.max(0, 100 - g.score),
    }));

    const presence = result.answer_presence;
    const presenceSignals = [
      {
        token: 'citation coverage',
        deficit: Math.max(0, 100 - (presence?.citation_coverage_score ?? 100)),
      },
      {
        token: 'authority alignment',
        deficit: Math.max(0, 100 - (presence?.authority_alignment_score ?? 100)),
      },
      {
        token: 'entity clarity',
        deficit: Math.max(0, 100 - (presence?.entity_clarity_score ?? 100)),
      },
    ];

    return [...gradeSignals, ...presenceSignals]
      .sort((a, b) => b.deficit - a.deficit)
      .slice(0, 6)
      .map((x) => x.token)
      .concat(['score', 'issue', 'gap']);
  }, [result]);

  const stageFilteredNodeIds = useMemo(() => {
    const matchesStage = (node: (typeof visibleNodes)[number]) => {
      switch (selectedStage) {
        case 'conflict':
          return (
            node.status === 'conflict' ||
            node.status === 'uncertain' ||
            node.type === 'issue' ||
            node.type === 'gap'
          );
        case 'trust':
          return (
            nodeMatchesAnyToken(node.label, trustFocusTokens) ||
            ((node.type === 'entity' || node.type === 'category') && node.confidence >= 0.6) ||
            node.status === 'conflict'
          );
        case 'score':
          return (
            node.type === 'category' ||
            node.type === 'issue' ||
            node.type === 'gap' ||
            nodeMatchesAnyToken(node.label, scoreFocusTokens)
          );
        case 'schema':
          return /schema|json|markup/i.test(node.label) || node.type === 'issue';
        case 'extract':
          return (
            node.type === 'entity' ||
            node.type === 'claim' ||
            node.type === 'keyword' ||
            node.type === 'query' ||
            node.type === 'gap'
          );
        case 'fetch':
          return node.type === 'entity' || node.type === 'category' || node.type === 'issue';
        case 'resolve':
        default:
          return true;
      }
    };

    const ids = new Set<string>();
    for (const node of visibleNodes) {
      const keepByStage = matchesStage(node);
      const hideStable = !!result && !showStableNodes && node.status === 'confirmed';
      const keepSelected = node.id === selectedNodeId;
      if ((keepByStage && !hideStable) || keepSelected) {
        ids.add(node.id);
      }
    }

    if (ids.size === 0) {
      for (const node of visibleNodes) ids.add(node.id);
    }

    return ids;
  }, [
    visibleNodes,
    selectedStage,
    result,
    showStableNodes,
    selectedNodeId,
    trustFocusTokens,
    scoreFocusTokens,
  ]);

  const focusedNodes = useMemo(
    () => visibleNodes.filter((n) => stageFilteredNodeIds.has(n.id)),
    [visibleNodes, stageFilteredNodeIds]
  );

  const focusedEdges = useMemo(
    () =>
      visibleEdges.filter(
        (e) => stageFilteredNodeIds.has(e.source) && stageFilteredNodeIds.has(e.target)
      ),
    [visibleEdges, stageFilteredNodeIds]
  );

  const conflictCount = useMemo(
    () => visibleNodes.filter((n) => n.status === 'conflict').length,
    [visibleNodes]
  );
  const uncertainCount = useMemo(
    () => visibleNodes.filter((n) => n.status === 'uncertain').length,
    [visibleNodes]
  );

  const weakAuthority = useMemo(() => {
    const authorityFromPresence = (result?.answer_presence?.authority_alignment_score ?? 100) < 60;
    const authorityFromGrades =
      (result?.category_grades ?? []).find((g) => /authority|trust/i.test(g.label))?.score ?? 100;
    return authorityFromPresence || authorityFromGrades < 60;
  }, [result]);

  const missingCoverage = useMemo(() => {
    const coverage = result?.answer_presence?.citation_coverage_score;
    const gaps = result?.answer_presence?.gaps?.length ?? 0;
    if (coverage == null) return gaps > 0;
    return coverage < 60 || gaps > 0;
  }, [result]);

  const primaryIssueNode = useMemo(() => {
    const pool = visibleNodes.filter(
      (n) =>
        n.status === 'conflict' ||
        n.status === 'uncertain' ||
        n.type === 'issue' ||
        n.type === 'gap'
    );
    if (pool.length === 0) return visibleNodes[0] ?? null;
    return pool.sort((a, b) => a.confidence - b.confidence)[0] ?? null;
  }, [visibleNodes]);

  const selectedNode = useMemo(
    () => visibleNodes.find((n) => n.id === selectedNodeId) ?? null,
    [visibleNodes, selectedNodeId]
  );

  const issueNode = selectedNode ?? primaryIssueNode;

  const nodeConflictCount = useCallback(
    (nodeId: string): number => {
      let count = 0;
      for (const e of visibleEdges) {
        const linkedId = e.source === nodeId ? e.target : e.target === nodeId ? e.source : null;
        if (!linkedId) continue;
        const linked = visibleNodes.find((n) => n.id === linkedId);
        if (linked?.status === 'conflict') count++;
      }
      return count;
    },
    [visibleEdges, visibleNodes]
  );

  const nodeFixPath = useCallback(
    (node: NonNullable<typeof issueNode>) => {
      const rec = (result?.recommendations ?? []).find(
        (r) =>
          node.label.toLowerCase().includes(r.title.toLowerCase().slice(0, 20)) ||
          r.title.toLowerCase().includes(node.label.toLowerCase().slice(0, 20))
      );

      if (rec?.description) {
        return [
          rec.title,
          rec.description,
          rec.category
            ? `Re-test ${rec.category.toLowerCase()} after applying fix`
            : 'Re-scan to verify evidence change',
        ];
      }

      if (node.type === 'entity') {
        return [
          'Update homepage H1 to one canonical positioning statement',
          'Align meta description and Organization schema with the same wording',
          'Reinforce that statement in three supporting pages',
        ];
      }

      if (node.type === 'category' && /schema|json/i.test(node.label)) {
        return [
          'Add or repair JSON-LD blocks for primary entity pages',
          'Validate schema output against required properties',
          'Re-scan and verify citation coverage lift',
        ];
      }

      return [
        'Unify conflicting claims across key pages',
        'Back claims with structured evidence and source citations',
        'Re-run analysis and verify conflict count reduction',
      ];
    },
    [issueNode, result]
  );

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
        nodes={focusedNodes}
        edges={focusedEdges}
        selectedNodeId={selectedNodeId}
        onNodeHover={setHoveredNodeId}
        onNodeClick={handleNodeClick}
      />

      {/* Narrative-first overlay */}
      <div
        className="fl-graph__overlay-tl font-mono"
        style={{ color: 'rgba(255,255,255,0.85)', pointerEvents: 'auto', maxWidth: 420 }}
      >
        {result ? (
          <div
            className="rounded-md border px-3 py-2"
            style={{ borderColor: 'rgba(255,255,255,0.14)', background: 'rgba(2,8,23,0.7)' }}
          >
            <div className="text-[10px] tracking-widest uppercase text-white/40">
              Decision Surface
            </div>
            <div className="mt-1 text-[12px] text-white/90">
              Your visibility is{' '}
              <span style={{ color: score != null ? scoreColor(score) : '#888' }}>
                {score != null ? visibilityLabel(score) : 'UNKNOWN'}
              </span>{' '}
              because:
            </div>
            <ul className="mt-1 text-[11px] space-y-1 text-white/80">
              <li>- {conflictCount} conflicting claims detected</li>
              <li>
                - {weakAuthority ? 'weak entity authority signals' : 'authority signals are stable'}
              </li>
              <li>
                - {missingCoverage ? 'missing citation coverage' : 'citation coverage is holding'}
              </li>
            </ul>
            <div className="mt-2 text-[10px] text-white/45">
              score {score ?? '–'} · focused {focusedNodes.length} / {visibleNodes.length} nodes
            </div>
          </div>
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
        {result && (
          <button
            type="button"
            onClick={() => setShowStableNodes((prev) => !prev)}
            className="text-[10px] font-mono text-white/55 hover:text-white/85 border px-3 py-1 transition-all"
            style={{
              borderColor: showStableNodes ? 'rgba(34,197,94,0.45)' : 'rgba(255,255,255,0.2)',
              background: showStableNodes ? 'rgba(34,197,94,0.08)' : 'rgba(0,0,0,0.35)',
            }}
            title="Toggle stable nodes"
          >
            {showStableNodes ? 'hide stable' : 'show stable'}
          </button>
        )}
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

      {/* Current issue panel */}
      {result && issueNode && (
        <div
          className="absolute bottom-3 right-3 w-[360px] rounded-md border p-3 font-mono"
          style={{
            background: 'rgba(2,8,23,0.82)',
            borderColor: 'rgba(255,255,255,0.14)',
            zIndex: 12,
          }}
        >
          <div className="text-[10px] tracking-widest uppercase text-white/45">Current Issue</div>
          <div className="mt-1 text-[12px] text-white/90">
            Primary {issueNode.status === 'conflict' ? 'Conflict' : 'Focus'}: {issueNode.label}
          </div>
          <div className="mt-2 text-[11px] text-white/70">
            Impact: lowers entity confidence and citation consistency.
          </div>
          <div className="mt-1 text-[11px] text-white/60">
            Node stats: confidence {issueNode.confidence.toFixed(2)} · mentions{' '}
            {issueNode.sources ?? 0} · linked conflicts {nodeConflictCount(issueNode.id)}
          </div>
          <div className="mt-2 text-[10px] tracking-wide uppercase text-white/45">Fix Path</div>
          <ol className="mt-1 text-[11px] text-white/80 space-y-1">
            {nodeFixPath(issueNode).map((stepText, i) => (
              <li key={`${issueNode.id}-fix-${i}`}>
                {i + 1}. {stepText}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Focus hint */}
      {result && !showStableNodes && (
        <div
          className="absolute bottom-3 left-3 text-[10px] font-mono px-2 py-1 border rounded"
          style={{
            borderColor: 'rgba(234,179,8,0.35)',
            color: 'rgba(255,255,255,0.75)',
            background: 'rgba(234,179,8,0.08)',
            zIndex: 11,
          }}
        >
          Focus mode: highlighting conflicts ({conflictCount}) + uncertain ({uncertainCount}),
          stable nodes hidden
        </div>
      )}
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
        // Stage-primary desktop layout
        stageMode
        stageRail={
          <ScanStageTimeline
            currentStep={scanStep}
            complete={!!result}
            selectedStage={selectedStage}
            onStageSelect={handleStageSelect}
          />
        }
        stagePanel={
          <StageDeepView stage={selectedStage} result={result} graphConflicts={conflicts} />
        }
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
  /** Called when the user clicks "new scan" — parent should clear its result state */
  onReset?: () => void;
}

export default function AnalyzeCognitionView({
  loading,
  step,
  result,
  error,
  onSubmit,
  onReset,
}: AnalyzeCognitionViewProps) {
  const [dismissed, setDismissed] = useState(false);

  // When user clicks "new scan":
  //   1. tell parent to clear its result state (so result becomes null)
  //   2. set dismissed for the brief fade-out duration
  //   3. When dismissed resets and result is now null → showIdle stays true
  const handleReset = useCallback(() => {
    onReset?.();
    setDismissed(true);
    setTimeout(() => setDismissed(false), 420);
  }, [onReset]);

  const showOverlay = !dismissed && (loading || result != null);
  const showIdle = !showOverlay;

  return (
    <AnimatePresence mode="wait">
      {showIdle ? (
        <IdleScreen key="idle" onSubmit={onSubmit} error={error} showBack />
      ) : (
        <CognitionOverlay
          key="overlay"
          scanning={loading}
          scanStep={step}
          result={result}
          onReset={handleReset}
        />
      )}
    </AnimatePresence>
  );
}
