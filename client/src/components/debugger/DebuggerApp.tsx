/**
 * DebuggerApp.tsx — Live Agent Brain UI
 *
 * Cognitive oscilloscope for distributed inference.
 * Four synchronized views: Timeline · Agent Lanes · Causality Graph · Conflict Lens
 *
 * Zero feedback loop into the scan engine — pure observation layer.
 */

import React, { useEffect } from 'react';
import TimelineView from './TimelineView';
import AgentLaneView from './AgentLaneView';
import CausalityGraph from './CausalityGraph';
import ConflictLens from './ConflictLens';
import { useDebugStore } from '../../stores/debugStore';
import '../../styles/Debugger.css';

export default function DebuggerApp() {
  const isRecording = useDebugStore((s) => s.isRecording);
  const startRecording = useDebugStore((s) => s.startRecording);
  const events = useDebugStore((s) => s.events);
  const conflicts = useDebugStore((s) => s.conflicts);
  const activeScanId = useDebugStore((s) => s.activeScanId);

  // Auto-start recording on mount so the user doesn't have to manually enable it
  useEffect(() => {
    startRecording();
  }, [startRecording]);

  return (
    <div className="debugger-root">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="debugger-header">
        <div className="debugger-header__left">
          <span className="debugger-title">Live Agent Brain</span>
          <span className="debugger-subtitle">Cognitive oscilloscope · distributed inference</span>
        </div>
        <div className="debugger-header__right">
          <div className="debugger-meta">
            <span className="debugger-meta__item">
              <span
                className="debugger-meta__dot"
                style={{ background: isRecording ? '#22d3ee' : '#475569' }}
              />
              {isRecording ? 'Recording' : 'Paused'}
            </span>
            <span className="debugger-meta__item">{events.length} events</span>
            {conflicts.length > 0 && (
              <span className="debugger-meta__item debugger-meta__item--warn">
                ⚡ {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''}
              </span>
            )}
            {activeScanId && (
              <span className="debugger-meta__item debugger-meta__item--mono">
                scan:{activeScanId.slice(0, 8)}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* ── Four-panel grid ─────────────────────────────────────────────── */}
      <div className="debugger-grid">
        {/* Row 1: Timeline (full width) */}
        <div className="debugger-cell debugger-cell--timeline">
          <TimelineView />
        </div>

        {/* Row 2: Agent Lanes + Causality Graph */}
        <div className="debugger-cell debugger-cell--lanes">
          <AgentLaneView />
        </div>
        <div className="debugger-cell debugger-cell--graph">
          <CausalityGraph />
        </div>

        {/* Row 3: Conflict Lens (full width) */}
        <div className="debugger-cell debugger-cell--conflicts">
          <ConflictLens />
        </div>
      </div>
    </div>
  );
}
