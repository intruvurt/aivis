/**
 * ConflictLens.tsx — truth tension view
 *
 * Shows citation disagreement clusters, entity ambiguity zones,
 * and low-confidence merges detected by the debugger.
 */

import React from 'react';
import { useDebugStore } from '../../stores/debugStore';
import type { DebugConflict } from '../../stores/debugStore';

function VarianceBar({ variance }: { variance: number }) {
  const pct = Math.min(variance * 100, 100);
  const color = pct > 60 ? '#f87171' : pct > 30 ? '#fb923c' : '#facc15';

  return (
    <div className="conflict-variance">
      <div className="conflict-variance__fill" style={{ width: `${pct}%`, background: color }} />
      <span className="conflict-variance__label" style={{ color }}>
        {variance.toFixed(2)}
      </span>
    </div>
  );
}

function ConflictCard({ conflict }: { conflict: DebugConflict }) {
  const severity = conflict.variance > 0.6 ? 'HIGH' : conflict.variance > 0.3 ? 'MED' : 'LOW';

  const severityColor =
    severity === 'HIGH' ? '#f87171' : severity === 'MED' ? '#fb923c' : '#facc15';

  return (
    <div className="conflict-card">
      <div className="conflict-card__header">
        <span className="conflict-entity">{conflict.entity}</span>
        <span
          className="conflict-severity"
          style={{ color: severityColor, borderColor: severityColor }}
        >
          {severity}
        </span>
      </div>
      <VarianceBar variance={conflict.variance} />
      <div className="conflict-card__meta">
        <span>{conflict.sources.length} sources</span>
        <span>{conflict.involvedNodeIds.length} nodes</span>
        <span className="conflict-time">{new Date(conflict.detectedAt).toLocaleTimeString()}</span>
      </div>
      {conflict.sources.length > 0 && (
        <ul className="conflict-sources">
          {conflict.sources.slice(0, 4).map((s, i) => (
            <li key={i} className="conflict-source">
              {s}
            </li>
          ))}
          {conflict.sources.length > 4 && (
            <li className="conflict-source conflict-source--more">
              +{conflict.sources.length - 4} more
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

export default function ConflictLens() {
  const conflicts = useDebugStore((s) => s.conflicts);
  const replayIndex = useDebugStore((s) => s.replayIndex);
  const events = useDebugStore((s) => s.events);

  // In replay mode, only show conflicts detected before replay point
  const visibleConflicts =
    replayIndex !== null
      ? (() => {
          const cutoff = events[replayIndex]?.wallTime ?? Infinity;
          return conflicts.filter((c) => c.detectedAt <= cutoff);
        })()
      : conflicts;

  const highCount = visibleConflicts.filter((c) => c.variance > 0.6).length;
  const medCount = visibleConflicts.filter((c) => c.variance > 0.3 && c.variance <= 0.6).length;

  return (
    <div className="dbg-panel dbg-panel--conflicts">
      <div className="dbg-panel__header">
        <span className="dbg-panel__title">Conflict Lens</span>
        <div className="conflict-summary">
          {highCount > 0 && (
            <span className="conflict-badge conflict-badge--high">{highCount} HIGH</span>
          )}
          {medCount > 0 && (
            <span className="conflict-badge conflict-badge--med">{medCount} MED</span>
          )}
          {visibleConflicts.length === 0 && (
            <span className="conflict-badge conflict-badge--ok">No conflicts</span>
          )}
        </div>
      </div>

      {visibleConflicts.length === 0 ? (
        <div className="dbg-empty">
          {conflicts.length === 0
            ? 'No citation disagreements detected yet.'
            : 'No conflicts at this replay point.'}
        </div>
      ) : (
        <div className="conflicts-list">
          {visibleConflicts.map((c) => (
            <ConflictCard key={c.id} conflict={c} />
          ))}
        </div>
      )}
    </div>
  );
}
