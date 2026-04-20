/**
 * CitationHeatmapGrid
 *
 * Query × Engine × Citation Probability surface.
 *
 * Each row = one query.
 * Each column = one AI engine.
 * Each cell = citation presence derived from citation_results ledger.
 *
 * Color contract:
 *   absent (not cited)          → near-black  (bg-gray-950 / #030712)
 *   weak  (cited once, <50%)    → dim orange  (bg-orange-950 / low saturation)
 *   strong (cited ≥2 or ≥50%)   → bright orange
 *
 * The user should be able to answer ONE question from this grid:
 *   "For this query, do AI systems consider me a source?"
 */

import React, { useEffect, useState, useCallback, memo } from 'react';
import type {
  HeatmapSurface,
  HeatmapRow,
  HeatmapCell,
  HeatmapDelta,
  CitationEngine,
} from '../../../shared/types';
import { apiFetch } from '../utils/api';

// ─── Engine display config ────────────────────────────────────────────────────

const ENGINE_LABELS: Record<CitationEngine, string> = {
  chatgpt: 'ChatGPT',
  perplexity: 'Perplexity',
  claude: 'Claude',
  google_ai: 'Google AI',
};

const ENGINES: CitationEngine[] = ['chatgpt', 'perplexity', 'claude', 'google_ai'];

// ─── Cell state → color ───────────────────────────────────────────────────────

function cellBg(cell: HeatmapCell): string {
  if (!cell.cited) return '#030712'; // absent — dark
  if (cell.citationCount === 1 || cell.confidence < 50) return '#431407'; // weak — dim orange
  return '#ea580c'; // strong — bright orange
}

function cellBorder(cell: HeatmapCell): string {
  if (!cell.cited) return '#111827';
  if (cell.citationCount === 1 || cell.confidence < 50) return '#7c2d12';
  return '#f97316';
}

function visibilityColor(prob: number): string {
  if (prob === 0) return '#6b7280'; // gray-500
  if (prob < 0.5) return '#b45309'; // amber-700
  if (prob < 1) return '#d97706'; // amber-500
  return '#22c55e'; // green-500
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

interface TooltipState {
  cell: HeatmapCell;
  x: number;
  y: number;
}

// ─── Cell component ───────────────────────────────────────────────────────────

const GridCell = memo(function GridCell({
  cell,
  onHover,
  onLeave,
}: {
  cell: HeatmapCell;
  onHover: (cell: HeatmapCell, e: React.MouseEvent) => void;
  onLeave: () => void;
}) {
  return (
    <div
      onMouseEnter={(e) => onHover(cell, e)}
      onMouseLeave={onLeave}
      style={{
        width: 44,
        height: 44,
        borderRadius: 4,
        backgroundColor: cellBg(cell),
        border: `1px solid ${cellBorder(cell)}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: cell.cited ? 'pointer' : 'default',
        flexShrink: 0,
        transition: 'transform 0.1s',
        position: 'relative',
      }}
    >
      {cell.cited && (
        <span style={{ fontSize: 11, color: cell.citationCount >= 2 ? '#fff' : '#fdba74' }}>
          {cell.citationCount}
        </span>
      )}
    </div>
  );
});

// ─── Row component ────────────────────────────────────────────────────────────

const HeatmapGridRow = memo(function HeatmapGridRow({
  row,
  deltas,
  onCellHover,
  onCellLeave,
  onGapClick,
  isSelected,
}: {
  row: HeatmapRow;
  deltas: HeatmapDelta[];
  onCellHover: (cell: HeatmapCell, e: React.MouseEvent) => void;
  onCellLeave: () => void;
  onGapClick: (row: HeatmapRow) => void;
  isSelected: boolean;
}) {
  const rowDeltas = deltas.filter((d) => d.query === row.query);
  const gained = rowDeltas.filter((d) => d.change === 'gained').length;
  const lost = rowDeltas.filter((d) => d.change === 'lost').length;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 0',
        borderBottom: '1px solid #111827',
        backgroundColor: isSelected ? '#0f172a' : 'transparent',
        cursor: row.gapAction ? 'pointer' : 'default',
      }}
      onClick={() => row.gapAction && onGapClick(row)}
    >
      {/* Query label — fixed width */}
      <div
        style={{
          width: 240,
          minWidth: 240,
          fontSize: 12,
          color: '#e5e7eb',
          overflowX: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          paddingRight: 8,
        }}
        title={row.query}
      >
        {row.query}
      </div>

      {/* Delta badges */}
      <div style={{ width: 48, display: 'flex', gap: 4, flexShrink: 0 }}>
        {gained > 0 && (
          <span
            style={{
              fontSize: 10,
              backgroundColor: '#14532d',
              color: '#86efac',
              borderRadius: 3,
              padding: '1px 4px',
            }}
          >
            +{gained}
          </span>
        )}
        {lost > 0 && (
          <span
            style={{
              fontSize: 10,
              backgroundColor: '#7f1d1d',
              color: '#fca5a5',
              borderRadius: 3,
              padding: '1px 4px',
            }}
          >
            -{lost}
          </span>
        )}
      </div>

      {/* Engine cells */}
      <div style={{ display: 'flex', gap: 6 }}>
        {row.cells.map((cell) => (
          <GridCell key={cell.engine} cell={cell} onHover={onCellHover} onLeave={onCellLeave} />
        ))}
      </div>

      {/* Visibility probability bar */}
      <div
        style={{
          marginLeft: 12,
          width: 60,
          textAlign: 'right',
          fontSize: 11,
          color: visibilityColor(row.visibilityProbability),
          flexShrink: 0,
        }}
      >
        {Math.round(row.visibilityProbability * 100)}%
      </div>
    </div>
  );
});

// ─── Gap action panel ─────────────────────────────────────────────────────────

function GapActionPanel({ row, onClose }: { row: HeatmapRow; onClose: () => void }) {
  const gap = row.gapAction;
  if (!gap) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 32,
        right: 32,
        width: 400,
        backgroundColor: '#0f172a',
        border: '1px solid #1e293b',
        borderRadius: 8,
        padding: 20,
        zIndex: 9999,
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 12,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              color: gap.issue === 'no_citation' ? '#ef4444' : '#f97316',
              textTransform: 'uppercase',
              letterSpacing: 1,
              marginBottom: 4,
            }}
          >
            {gap.issue === 'no_citation' ? '✕ No Citation' : '⚠ Weak Citation'}
          </div>
          <div style={{ fontSize: 13, color: '#f1f5f9', fontWeight: 600 }}>{row.query}</div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#6b7280',
            cursor: 'pointer',
            fontSize: 16,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div
          style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', marginBottom: 4 }}
        >
          Cause
        </div>
        <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6 }}>{gap.cause}</div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div
          style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', marginBottom: 4 }}
        >
          Fix
        </div>
        <div style={{ fontSize: 12, color: '#e2e8f0', lineHeight: 1.6 }}>{gap.fix}</div>
      </div>

      <div
        style={{
          fontSize: 11,
          color: '#22c55e',
          backgroundColor: '#052e16',
          borderRadius: 4,
          padding: '8px 10px',
        }}
      >
        Expected: {gap.expectedImpact}
      </div>
    </div>
  );
}

// ─── Cell tooltip ─────────────────────────────────────────────────────────────

function CellTooltip({ state }: { state: TooltipState }) {
  const { cell, x, y } = state;
  return (
    <div
      style={{
        position: 'fixed',
        top: y + 16,
        left: x + 16,
        backgroundColor: '#0f172a',
        border: '1px solid #1e293b',
        borderRadius: 6,
        padding: '10px 12px',
        fontSize: 12,
        color: '#e2e8f0',
        pointerEvents: 'none',
        zIndex: 9999,
        maxWidth: 260,
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{ENGINE_LABELS[cell.engine]}</div>
      {cell.cited ? (
        <>
          <div style={{ color: '#4ade80', marginBottom: 4 }}>
            ✓ Cited {cell.citationCount}× — {cell.confidence}% confidence
          </div>
          {cell.lastSeenAt && (
            <div style={{ color: '#6b7280', marginBottom: 4, fontSize: 11 }}>
              Last seen: {new Date(cell.lastSeenAt).toLocaleDateString()}
            </div>
          )}
          {cell.excerpt && (
            <div
              style={{
                color: '#94a3b8',
                fontSize: 11,
                borderTop: '1px solid #1e293b',
                paddingTop: 6,
                marginTop: 4,
                lineHeight: 1.5,
              }}
            >
              {cell.excerpt.slice(0, 200)}
              {cell.excerpt.length > 200 ? '…' : ''}
            </div>
          )}
        </>
      ) : (
        <div style={{ color: '#6b7280' }}>✕ Not cited</div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface CitationHeatmapGridProps {
  url: string;
}

export const CitationHeatmapGrid: React.FC<CitationHeatmapGridProps> = ({ url }) => {
  const [surface, setSurface] = useState<HeatmapSurface | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [selectedRow, setSelectedRow] = useState<HeatmapRow | null>(null);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;

    setLoading(true);
    setError(null);

    apiFetch(`/api/heatmap?url=${encodeURIComponent(url)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return res.json() as Promise<HeatmapSurface>;
      })
      .then((data) => {
        if (!cancelled) setSurface(data);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load heatmap');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  const handleCellHover = useCallback((cell: HeatmapCell, e: React.MouseEvent) => {
    setTooltip({ cell, x: e.clientX, y: e.clientY });
  }, []);

  const handleCellLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  const handleGapClick = useCallback((row: HeatmapRow) => {
    setSelectedRow((prev) => (prev?.query === row.query ? null : row));
  }, []);

  // ── Empty/loading states ──

  if (loading) {
    return (
      <div className="citation-heatmap" style={{ padding: 24, color: '#6b7280', fontSize: 13 }}>
        Building citation surface…
      </div>
    );
  }

  if (error) {
    return (
      <div className="citation-heatmap" style={{ padding: 24, color: '#ef4444', fontSize: 13 }}>
        {error}
      </div>
    );
  }

  if (!surface || surface.rows.length === 0) {
    return (
      <div className="citation-heatmap" style={{ padding: 24, color: '#6b7280', fontSize: 13 }}>
        No citation test data yet for this URL. Run a citation scan to populate the grid.
      </div>
    );
  }

  // ── Delta summary ──
  const gained = surface.deltas.filter((d) => d.change === 'gained').length;
  const lost = surface.deltas.filter((d) => d.change === 'lost').length;

  return (
    <div className="citation-heatmap" style={{ fontFamily: 'inherit', color: '#e5e7eb' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>
            Citation Grid
          </h3>
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
            {surface.totalCited}/{surface.totalQueries} queries cited · {surface.rows.length} query
            × {ENGINES.length} engine surface
          </div>
        </div>

        {/* Delta summary */}
        {surface.deltas.length > 0 && (
          <div style={{ display: 'flex', gap: 8 }}>
            {gained > 0 && (
              <div
                style={{
                  fontSize: 11,
                  backgroundColor: '#14532d',
                  color: '#86efac',
                  borderRadius: 4,
                  padding: '4px 8px',
                }}
              >
                +{gained} gained
              </div>
            )}
            {lost > 0 && (
              <div
                style={{
                  fontSize: 11,
                  backgroundColor: '#7f1d1d',
                  color: '#fca5a5',
                  borderRadius: 4,
                  padding: '4px 8px',
                }}
              >
                -{lost} lost
              </div>
            )}
          </div>
        )}
      </div>

      {/* Column headers */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 4,
          paddingBottom: 6,
          borderBottom: '1px solid #1e293b',
        }}
      >
        <div style={{ width: 240, minWidth: 240, fontSize: 10, color: '#4b5563' }}>QUERY</div>
        <div style={{ width: 48 }} />
        <div style={{ display: 'flex', gap: 6 }}>
          {ENGINES.map((e) => (
            <div
              key={e}
              style={{
                width: 44,
                textAlign: 'center',
                fontSize: 10,
                color: '#6b7280',
                flexShrink: 0,
              }}
            >
              {ENGINE_LABELS[e].split(' ')[0]}
            </div>
          ))}
        </div>
        <div
          style={{ marginLeft: 12, width: 60, fontSize: 10, color: '#4b5563', textAlign: 'right' }}
        >
          PROB
        </div>
      </div>

      {/* Grid rows — scrollable, memoized */}
      <div
        style={{
          maxHeight: 480,
          overflowY: 'auto',
          overflowX: 'auto',
        }}
      >
        {surface.rows.map((row) => (
          <HeatmapGridRow
            key={row.query}
            row={row}
            deltas={surface.deltas}
            onCellHover={handleCellHover}
            onCellLeave={handleCellLeave}
            onGapClick={handleGapClick}
            isSelected={selectedRow?.query === row.query}
          />
        ))}
      </div>

      {/* Legend */}
      <div
        style={{
          display: 'flex',
          gap: 16,
          marginTop: 12,
          paddingTop: 10,
          borderTop: '1px solid #111827',
          fontSize: 11,
          color: '#6b7280',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: 2,
              backgroundColor: '#030712',
              border: '1px solid #111827',
              display: 'inline-block',
            }}
          />
          Not cited
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: 2,
              backgroundColor: '#431407',
              border: '1px solid #7c2d12',
              display: 'inline-block',
            }}
          />
          Weak (1×)
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: 2,
              backgroundColor: '#ea580c',
              border: '1px solid #f97316',
              display: 'inline-block',
            }}
          />
          Strong (2×+)
        </span>
        <span style={{ marginLeft: 'auto', color: '#374151' }}>Click any row for action graph</span>
      </div>

      {/* Tooltip */}
      {tooltip && <CellTooltip state={tooltip} />}

      {/* Gap action panel */}
      {selectedRow?.gapAction && (
        <GapActionPanel row={selectedRow} onClose={() => setSelectedRow(null)} />
      )}
    </div>
  );
};

export default CitationHeatmapGrid;
