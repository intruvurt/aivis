/**
 * CommitGraph.tsx — Left panel: SVG commit history with branch lanes.
 *
 * Visual rules (from spec §3):
 *   vertical flow = time (top → bottom)
 *   horizontal lanes = branches (agents)
 *   nodes = commits (10px default, 14px active)
 *   edges = parent → child relationships
 *   cross-branch lines = merges / branch creation
 *
 * Performance: virtualized — only renders rows inside the scroll viewport.
 */

import React, { useMemo, useRef, useCallback, useState } from 'react';
import { useReplayStore } from '../../stores/replayStore';
import type { CommitNode } from '../../stores/replayStore';

// ── Geometry constants (forensic-grid §6) ─────────────────────────────────────

const ROW_H       = 40;   // px per commit row
const NODE_R      = 5;    // radius for default node (10px diameter)
const NODE_R_ACT  = 7;    // radius for active node  (14px diameter)
const LANE_STEP   = 32;   // horizontal offset per branch lane
const LEFT_PAD    = 24;   // left padding before first lane
const LABEL_X     = 72;   // commit message column start
const LABEL_CHARS = 30;   // max chars before truncation
const SVG_W       = 320;  // fixed SVG width (panel 336px − 16px padding)

// ── Color helpers (§11 semantic palette) ─────────────────────────────────────

const BRANCH_COLORS = [
  '#4fc3f7', // fl-node (main)
  '#00ff9c', // fl-truth
  '#ffc857', // fl-warning
  '#ff4d4d', // fl-conflict
  '#a78bfa', // violet accent
  '#34d399', // green accent
];

function branchColor(laneIdx: number): string {
  return BRANCH_COLORS[laneIdx % BRANCH_COLORS.length];
}

function confidenceColor(c: number): string {
  if (c >= 0.7) return '#00ff9c';
  if (c >= 0.4) return '#ffc857';
  return '#ff4d4d';
}

function truncate(msg: string): string {
  return msg.length > LABEL_CHARS ? msg.slice(0, LABEL_CHARS) + '…' : msg;
}

// ── Geometry computation ──────────────────────────────────────────────────────

type NodePos = { x: number; y: number; laneIdx: number };

function computeGeometry(
  commits: CommitNode[],
  visibleBranches: string[],
): {
  positions: Map<string, NodePos>;
  laneMap:   Map<string, number>;
  svgHeight: number;
} {
  // Assign lanes in first-appearance order across ALL commits (stable even when filtered)
  const laneMap = new Map<string, number>();
  let nextLane = 0;
  for (const c of commits) {
    if (!laneMap.has(c.branch)) laneMap.set(c.branch, nextLane++);
  }

  const visible = commits.filter(c => visibleBranches.includes(c.branch));
  const positions = new Map<string, NodePos>();
  visible.forEach((c, i) => {
    const laneIdx = laneMap.get(c.branch) ?? 0;
    positions.set(c.hash, {
      x: LEFT_PAD + laneIdx * LANE_STEP,
      y: i * ROW_H + ROW_H / 2,
      laneIdx,
    });
  });

  return { positions, laneMap, svgHeight: Math.max(visible.length * ROW_H, ROW_H) };
}

// ── Virtualization ─────────────────────────────────────────────────────────────

const OVERSCAN = 5; // rows above/below viewport to pre-render

function visibleRange(
  scrollTop: number,
  clientHeight: number,
  totalRows: number,
): [number, number] {
  const start = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
  const end   = Math.min(totalRows, Math.ceil((scrollTop + clientHeight) / ROW_H) + OVERSCAN);
  return [start, end];
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CommitGraph() {
  const commits        = useReplayStore(s => s.commits);
  const cursor         = useReplayStore(s => s.cursor);
  const visibleBranches= useReplayStore(s => s.visibleBranches);
  const hoveredHash    = useReplayStore(s => s.hoveredHash);
  const allBranches    = useReplayStore(s => s.allBranches);
  const setCursorHash  = useReplayStore(s => s.setCursorHash);
  const setHoveredHash = useReplayStore(s => s.setHoveredHash);
  const toggleBranch   = useReplayStore(s => s.toggleBranch);

  const scrollRef   = useRef<HTMLDivElement>(null);
  const hoverTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [clientH,   setClientH]   = useState(600);

  const visibleCommits = useMemo(
    () => commits.filter(c => visibleBranches.includes(c.branch)),
    [commits, visibleBranches],
  );

  const { positions, laneMap, svgHeight } = useMemo(
    () => computeGeometry(commits, visibleBranches),
    [commits, visibleBranches],
  );

  // Viewport windowing
  const [rowStart, rowEnd] = visibleRange(scrollTop, clientH, visibleCommits.length);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    setScrollTop(el.scrollTop);
    setClientH(el.clientHeight);
  }, []);

  const handleHover = useCallback((hash: string | null) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setHoveredHash(hash), 60);
  }, [setHoveredHash]);

  if (commits.length === 0) {
    return (
      <div className="fl-panel fl-panel--commit cg-empty">
        <span className="cg-empty__label">No commits loaded.</span>
      </div>
    );
  }

  // Build connector lines between parent → child for ALL visible commits
  // (lines are always drawn even if parent is out of virtual viewport)
  const connectorLines = visibleCommits.flatMap(commit => {
    if (!commit.parent) return [];
    const from = positions.get(commit.parent);
    const to   = positions.get(commit.hash);
    if (!from || !to) return [];
    const isCross = from.x !== to.x;
    return [{ from, to, isCross, hash: commit.hash }];
  });

  // Branch spine lines: thin vertical line through each branch's Y range
  const spineLines = (() => {
    const branchRanges = new Map<string, { minY: number; maxY: number; laneIdx: number }>();
    visibleCommits.forEach(c => {
      const pos = positions.get(c.hash);
      if (!pos) return;
      const existing = branchRanges.get(c.branch);
      if (!existing) {
        branchRanges.set(c.branch, { minY: pos.y, maxY: pos.y, laneIdx: pos.laneIdx });
      } else {
        existing.minY = Math.min(existing.minY, pos.y);
        existing.maxY = Math.max(existing.maxY, pos.y);
      }
    });
    return Array.from(branchRanges.entries()).map(([branch, { minY, maxY, laneIdx }]) => ({
      branch, minY, maxY,
      x: LEFT_PAD + laneIdx * LANE_STEP,
      color: branchColor(laneIdx),
    }));
  })();

  return (
    <div className="fl-panel fl-panel--commit cg-root">
      {/* Branch filter chips */}
      <div className="cg-branch-filter" role="group" aria-label="Branch visibility">
        {allBranches.map(branch => {
          const laneIdx = laneMap.get(branch) ?? 0;
          const on = visibleBranches.includes(branch);
          return (
            <button
              key={branch}
              type="button"
              className={`cg-branch-chip${on ? ' cg-branch-chip--on' : ''}`}
              style={{ '--chip-color': branchColor(laneIdx) } as React.CSSProperties}
              onClick={() => toggleBranch(branch)}
              aria-pressed={on}
              title={`${on ? 'Hide' : 'Show'} ${branch}`}
            >
              {branch}
            </button>
          );
        })}
      </div>

      {/* Virtualized SVG scroll container */}
      <div
        ref={scrollRef}
        className="cg-scroll"
        onScroll={handleScroll}
        role="listbox"
        aria-label="Commit history"
      >
        <svg
          width={SVG_W}
          height={svgHeight}
          className="cg-svg"
          aria-hidden="true"
        >
          {/* Branch spine (faint vertical lane guides) */}
          {spineLines.map(({ branch, minY, maxY, x, color }) => (
            <line
              key={`spine-${branch}`}
              x1={x} y1={minY}
              x2={x} y2={maxY}
              stroke={color}
              strokeWidth={1}
              opacity={0.12}
            />
          ))}

          {/* Connector lines (parent → child) */}
          {connectorLines.map(({ from, to, isCross, hash }) => (
            <line
              key={`conn-${hash}`}
              x1={from.x} y1={from.y}
              x2={to.x}   y2={to.y}
              stroke={isCross ? '#4fc3f7' : '#2a2a2a'}
              strokeWidth={isCross ? 1.5 : 2}
              strokeDasharray={isCross ? '3 3' : undefined}
              opacity={isCross ? 0.65 : 1}
            />
          ))}

          {/* Commit nodes (virtualized window only) */}
          {visibleCommits.slice(rowStart, rowEnd).map(commit => {
            const pos = positions.get(commit.hash);
            if (!pos) return null;

            const isActive  = cursor.hash === commit.hash || cursor.seq === commit.seq;
            const isHovered = hoveredHash === commit.hash;
            const r         = (isActive || isHovered) ? NODE_R_ACT : NODE_R;
            const nodeColor = confidenceColor(commit.confidence);
            const laneColor = branchColor(pos.laneIdx);

            return (
              <g
                key={commit.hash}
                onClick={() => setCursorHash(commit.hash)}
                onMouseEnter={() => handleHover(commit.hash)}
                onMouseLeave={() => handleHover(null)}
                style={{ cursor: 'pointer' }}
                role="option"
                aria-selected={isActive}
              >
                {/* Active / hover glow */}
                {(isActive || isHovered) && (
                  <circle
                    cx={pos.x} cy={pos.y}
                    r={r + 5}
                    fill={nodeColor}
                    opacity={0.1}
                  />
                )}

                {/* Branch lane color ring */}
                <circle
                  cx={pos.x} cy={pos.y}
                  r={r + 2}
                  fill="none"
                  stroke={laneColor}
                  strokeWidth={1}
                  opacity={0.3}
                />

                {/* Main dot: filled when active, outlined when not */}
                <circle
                  cx={pos.x} cy={pos.y}
                  r={r}
                  fill={isActive ? nodeColor : '#0a0a0a'}
                  stroke={nodeColor}
                  strokeWidth={isActive ? 0 : 1.5}
                />

                {/* Seq label inside dot */}
                <text
                  x={pos.x} y={pos.y + 3.5}
                  fill={isActive ? '#000' : nodeColor}
                  fontSize={7}
                  fontFamily="monospace"
                  textAnchor="middle"
                  opacity={0.9}
                >
                  {commit.seq}
                </text>

                {/* Commit message */}
                <text
                  x={LABEL_X}
                  y={pos.y + 4}
                  fill={isActive ? '#eaeaea' : '#666666'}
                  fontSize={12}
                  fontFamily="monospace"
                  fontWeight={isActive ? 700 : 400}
                >
                  {truncate(commit.message)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
