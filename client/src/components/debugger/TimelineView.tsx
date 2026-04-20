/**
 * TimelineView.tsx — time-axis truth stream
 *
 * Left→right event flow, strictly ordered by seq.
 * Shows latency gaps between events.
 */

import React, { useRef, useEffect } from 'react';
import { useDebugStore } from '../../stores/debugStore';
import type { DebugNode } from '../../stores/debugStore';

const EVENT_COLORS: Record<string, string> = {
  SCAN_STARTED: '#22d3ee',
  HTML_FETCHED: '#34d399',
  DOM_PARSED: '#a78bfa',
  CITE_FOUND: '#f59e0b',
  ENTITY_EXTRACTED: '#60a5fa',
  INTERPRETATION: '#fb7185',
  SCORE_UPDATED: '#4ade80',
  SCAN_COMPLETED: '#818cf8',
  ERROR: '#f87171',
};

function eventColor(type: string): string {
  return EVENT_COLORS[type] ?? '#94a3b8';
}

function jitterLabel(ms: number): string {
  if (ms < 10) return '';
  if (ms < 100) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function EventBadge({
  node,
  isSelected,
  onClick,
}: {
  node: DebugNode;
  isSelected: boolean;
  onClick: () => void;
}) {
  const color = eventColor(node.eventType);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      className="timeline-event"
      style={{
        borderColor: isSelected ? color : 'transparent',
        background: isSelected ? `${color}22` : 'rgba(30,41,59,0.7)',
      }}
    >
      <div className="timeline-event__dot" style={{ background: color }} />
      <span className="timeline-event__type">{node.eventType}</span>
      {node.confidence !== undefined && (
        <span className="timeline-event__conf" style={{ color }}>
          {(node.confidence * 100).toFixed(0)}%
        </span>
      )}
      {node.jitter > 10 && (
        <span className="timeline-event__jitter">⚡{jitterLabel(node.jitter)}</span>
      )}
      <span className="timeline-event__seq">#{node.seq}</span>
    </div>
  );
}

export default function TimelineView() {
  const events = useDebugStore((s) => s.events);
  const replayIndex = useDebugStore((s) => s.replayIndex);
  const setReplayIndex = useDebugStore((s) => s.setReplayIndex);
  const isRecording = useDebugStore((s) => s.isRecording);
  const startRecording = useDebugStore((s) => s.startRecording);
  const stopRecording = useDebugStore((s) => s.stopRecording);
  const reset = useDebugStore((s) => s.reset);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest event while live
  useEffect(() => {
    if (replayIndex === null && scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [events.length, replayIndex]);

  const visibleEvents = replayIndex !== null ? events.slice(0, replayIndex + 1) : events;

  // Compute per-event gap from previous
  const gaps: number[] = [];
  for (let i = 0; i < visibleEvents.length; i++) {
    gaps.push(i === 0 ? 0 : visibleEvents[i].timestamp - visibleEvents[i - 1].timestamp);
  }

  return (
    <div className="dbg-panel dbg-panel--timeline">
      <div className="dbg-panel__header">
        <span className="dbg-panel__title">Timeline Stream</span>
        <div className="dbg-panel__controls">
          <span
            className="dbg-status-dot"
            style={{ background: isRecording ? '#22d3ee' : '#475569' }}
          />
          <button className="dbg-btn" onClick={isRecording ? stopRecording : startRecording}>
            {isRecording ? 'Pause' : 'Record'}
          </button>
          <button className="dbg-btn" onClick={reset}>
            Reset
          </button>
          {replayIndex !== null && (
            <button className="dbg-btn dbg-btn--active" onClick={() => setReplayIndex(null)}>
              Live
            </button>
          )}
        </div>
      </div>

      {events.length === 0 ? (
        <div className="dbg-empty">
          {isRecording
            ? 'Waiting for scan events…'
            : 'Press Record then run a scan to begin capture.'}
        </div>
      ) : (
        <>
          <div className="timeline-scroll" ref={scrollRef}>
            <div className="timeline-track">
              {visibleEvents.map((node, i) => (
                <React.Fragment key={node.id}>
                  {gaps[i] > 50 && (
                    <div
                      className="timeline-gap"
                      style={{ width: Math.min(Math.log(gaps[i]) * 8, 60) }}
                      title={`${gaps[i].toFixed(0)}ms gap`}
                    />
                  )}
                  <EventBadge
                    node={node}
                    isSelected={replayIndex === i}
                    onClick={() => setReplayIndex(i)}
                  />
                </React.Fragment>
              ))}
            </div>
          </div>

          {replayIndex !== null && (
            <div className="timeline-replay-bar">
              <input
                type="range"
                min={0}
                max={events.length - 1}
                value={replayIndex}
                onChange={(e) => setReplayIndex(Number(e.target.value))}
                className="timeline-scrubber"
              />
              <span className="timeline-replay-label">
                Step {replayIndex + 1} / {events.length}
              </span>
            </div>
          )}

          {replayIndex !== null && (
            <div className="timeline-payload">
              <pre>{JSON.stringify(visibleEvents[replayIndex]?.payload, null, 2)}</pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}
