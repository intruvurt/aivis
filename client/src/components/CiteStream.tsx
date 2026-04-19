/**
 * CITE STREAM - Raw truth feed component
 *
 * This runs continuously—like logs. Shows all cites as they arrive.
 * Pure visibility into the ledger state.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useCiteLedgerStore } from '../store/citeLedgerStore';
import '../styles/CiteStream.css';

interface StreamEntry {
  timestamp: number;
  cite_id: string;
  source_type: string;
  signal: string;
  confidence: number;
}

/**
 * CITE STREAM - Live feed of incoming cites
 */
export const CiteStream: React.FC = () => {
  const cites = useCiteLedgerStore((s) => Object.values(s.cites));
  const lastStreamEvent = useCiteLedgerStore((s) => s.lastStreamEvent);
  const streamRef = useRef<HTMLDivElement>(null);
  const [streams, setStreams] = useState<StreamEntry[]>([]);
  const [paused, setPaused] = useState(false);

  // When cites change, create stream entries
  useEffect(() => {
    const newEntry: StreamEntry = {
      timestamp: Date.now(),
      cite_id: cites[cites.length - 1]?.id || '',
      source_type: cites[cites.length - 1]?.source_type || '',
      signal: cites[cites.length - 1]?.extracted_signal || '',
      confidence: cites[cites.length - 1]?.confidence_score || 0,
    };

    if (
      cites.length > 0 &&
      newEntry.cite_id &&
      !streams.some((s) => s.cite_id === newEntry.cite_id)
    ) {
      setStreams((prev) => [newEntry, ...prev].slice(0, 100)); // Keep last 100
    }
  }, [cites, lastStreamEvent]);

  // Auto-scroll when not paused
  useEffect(() => {
    if (!paused && streamRef.current) {
      streamRef.current.scrollTop = 0;
    }
  }, [streams, paused]);

  const sourceColors: Record<string, string> = {
    crawl: '#3b82f6',
    semantic: '#10b981',
    authority: '#f59e0b',
    entity: '#8b5cf6',
  };

  return (
    <div className="cite-stream">
      <div className="cite-stream__header">
        <h3>Live Cite Stream</h3>
        <div className="cite-stream__controls">
          <span className="cite-stream__count">{streams.length} visible</span>
          <button
            className={`cite-stream__btn ${paused ? 'cite-stream__btn--play' : 'cite-stream__btn--pause'}`}
            onClick={() => setPaused(!paused)}
          >
            {paused ? '▶' : '⏸'}
          </button>
        </div>
      </div>

      <div className="cite-stream__info">
        Real-time evidence stream. Each line is a cite entry. Newest at top.
      </div>

      {streams.length === 0 ? (
        <div className="cite-stream__empty">Waiting for cite events...</div>
      ) : (
        <div className="cite-stream__container" ref={streamRef}>
          {streams.map((entry, idx) => (
            <div key={`${entry.cite_id}-${idx}`} className="cite-stream__entry">
              <span className="cite-stream__timestamp">
                {new Date(entry.timestamp).toLocaleTimeString()}
              </span>

              <span
                className="cite-stream__source"
                style={{
                  backgroundColor: sourceColors[entry.source_type] || '#6b7280',
                }}
              >
                {entry.source_type}
              </span>

              <span className="cite-stream__signal">{entry.signal}</span>

              <span
                className={`cite-stream__confidence confidence-${Math.round(entry.confidence * 100)}`}
              >
                {Math.round(entry.confidence * 100)}%
              </span>

              <span className="cite-stream__id">{entry.cite_id.substring(0, 8)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="cite-stream__footer">
        Streaming live from ledger • {cites.length} total cites in store
      </div>
    </div>
  );
};

export default CiteStream;
