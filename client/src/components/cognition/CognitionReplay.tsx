/**
 * CognitionReplay.tsx — Assembled 3-panel cognition map.
 *
 * Assembles the full system inside MainGrid:
 *   LEFT   → CommitGraph   (history spine)
 *   CENTER → graphSlot     (WebGL / CausalityGraph — caller provides)
 *   RIGHT  → CommitInspector
 *   BOTTOM → TimelineControls
 *
 * The center slot is injectable via `graphSlot` prop so this component
 * has no hard dependency on any specific renderer. Default renders a
 * "watching cursor" info overlay when no slot is provided.
 *
 * useCursorSync (exported hook): bridges replayStore.cursor.seq →
 * debugStore.setReplayIndex so CausalityGraph reacts to commit navigation.
 */

import React, { useEffect } from 'react';
import { MainGrid } from '../layout/MainGrid';
import CommitGraph from './CommitGraph';
import CommitInspector from './CommitInspector';
import TimelineControls from './TimelineControls';
import { useReplayStore } from '../../stores/replayStore';
import { useDebugStore } from '../../stores/debugStore';
import '../../styles/cognition-replay.css';

// ── useCursorSync ─────────────────────────────────────────────────────────────
// Syncs replayStore.cursor.seq → debugStore.replayIndex.
// When cursor advances to seq N, find the first debug event with seq >= N
// and set that as the replay point so the CausalityGraph shows matching state.

export function useCursorSync() {
  const cursor = useReplayStore((s) => s.cursor);
  const events = useDebugStore((s) => s.events);
  const setReplayIndex = useDebugStore((s) => s.setReplayIndex);

  useEffect(() => {
    if (events.length === 0) return;
    // Find first event at or beyond cursor.seq — if none, clamp to last
    const idx = events.findIndex((e) => e.seq >= cursor.seq);
    setReplayIndex(idx >= 0 ? idx : events.length - 1);
  }, [cursor.seq, events, setReplayIndex]);
}

// ── Default center placeholder ────────────────────────────────────────────────

function GraphPlaceholder({ seq }: { seq: number }) {
  return (
    <div className="cr-graph-placeholder">
      <div className="cr-graph-placeholder__inner">
        <div className="cr-graph-placeholder__seq">seq: {seq}</div>
        <div className="cr-graph-placeholder__label">
          Inject <code>graphSlot</code> to attach a renderer.
        </div>
      </div>
    </div>
  );
}

// ── TopBar ────────────────────────────────────────────────────────────────────

function CognitionTopBar() {
  const scanId = useReplayStore((s) => s.scanId);
  const commits = useReplayStore((s) => s.commits);
  const allBranches = useReplayStore((s) => s.allBranches);
  const cursor = useReplayStore((s) => s.cursor);

  return (
    <>
      <span className="cr-topbar-label">Cognition Replay</span>

      {scanId && (
        <span className="cr-topbar-scanid" title={scanId}>
          scan <span className="cr-topbar-scanid-val">{scanId.slice(0, 12)}</span>
        </span>
      )}

      <div className="fl-topbar__controls">
        <span className="cr-topbar-stat">{commits.length} commits</span>
        <span className="cr-topbar-stat">{allBranches.length} branches</span>
        <span className="cr-topbar-stat cr-topbar-stat--seq">#{cursor.seq}</span>
      </div>
    </>
  );
}

// ── CognitionReplay ───────────────────────────────────────────────────────────

interface CognitionReplayProps {
  /**
   * Center panel — typically CausalityGraph or a WebGL renderer.
   * Receives cursor changes via useCursorSync (auto-wired when provided).
   * Omit to render the default placeholder.
   */
  graphSlot?: React.ReactNode;
  className?: string;
  /** When true, the timeline scrubber is hidden (e.g. during live scanning) */
  hideTimeline?: boolean;
  /**
   * Activates stage-primary desktop layout (fl-shell--stage).
   * Desktop: narrow stage rail + graph + deepview panel.
   * Mobile: ignored — stacked layout applies.
   */
  stageMode?: boolean;
  /** Narrow left stage-timeline rail (80px) — desktop only in stageMode */
  stageRail?: React.ReactNode;
  /** Contextual evidence panel below graph — desktop only in stageMode */
  stagePanel?: React.ReactNode;
}

export default function CognitionReplay({
  graphSlot,
  className,
  hideTimeline,
  stageMode = false,
  stageRail,
  stagePanel,
}: CognitionReplayProps) {
  const cursor = useReplayStore((s) => s.cursor);

  // Wire replayStore → debugStore automatically when graphSlot is provided
  useCursorSync();

  const center = graphSlot ?? <GraphPlaceholder seq={cursor.seq} />;

  return (
    <MainGrid
      className={className}
      topBar={<CognitionTopBar />}
      left={<CommitGraph />}
      center={center}
      right={<CommitInspector />}
      timeline={hideTimeline ? undefined : <TimelineControls />}
      stageMode={stageMode}
      stageRail={stageRail}
      stagePanel={stagePanel}
    />
  );
}
