/**
 * CausalityGraph.tsx — brain structure view
 *
 * Canvas-rendered directed graph. Nodes = events. Edges = derivation.
 * Color = confidence tier. Nodes pulse based on recency.
 * Runs in an off-screen canvas loop via requestAnimationFrame.
 */

import React, { useRef, useEffect, useCallback } from 'react';
import { useDebugStore } from '../../stores/debugStore';
import type { DebugNode, DebugEdge, DebugGraph } from '../../stores/debugStore';

// ── Layout engine (force-directed, lightweight) ────────────────────────────

type Vec2 = { x: number; y: number };

type LayoutNode = {
  id: string;
  node: DebugNode;
  pos: Vec2;
  vel: Vec2;
};

const NODE_COLORS: Record<string, string> = {
  AGENT: '#22d3ee',
  EVENT: '#94a3b8',
  VOTE: '#f59e0b',
  REDUCE: '#4ade80',
};

const EDGE_COLORS: Record<string, string> = {
  DERIVES_FROM: '#334155',
  CONFLICTS_WITH: '#f87171',
  CONFIRMS: '#22d3ee',
};

const EVENT_COLORS: Record<string, string> = {
  SCAN_STARTED: '#22d3ee',
  CITE_FOUND: '#f59e0b',
  ENTITY_EXTRACTED: '#60a5fa',
  SCORE_UPDATED: '#4ade80',
  SCAN_COMPLETED: '#818cf8',
  ERROR: '#f87171',
};

function nodeColor(node: DebugNode): string {
  return EVENT_COLORS[node.eventType] ?? NODE_COLORS[node.type] ?? '#94a3b8';
}

function buildLayout(graph: DebugGraph, width: number, height: number): Map<string, LayoutNode> {
  const layout = new Map<string, LayoutNode>();
  let i = 0;
  const total = graph.nodes.size;

  for (const [id, node] of graph.nodes) {
    // Initial placement: timeline-ordered horizontal spread with slight vertical jitter
    const tx = total > 1 ? (i / (total - 1)) * (width - 80) + 40 : width / 2;
    const ty = height / 2 + Math.sin(i * 1.7) * height * 0.3;
    layout.set(id, {
      id,
      node,
      pos: { x: tx, y: ty },
      vel: { x: 0, y: 0 },
    });
    i++;
  }

  return layout;
}

function runForceStep(
  layout: Map<string, LayoutNode>,
  edges: DebugEdge[],
  width: number,
  height: number
) {
  const nodes = Array.from(layout.values());
  const REPEL = 800;
  const ATTRACT = 0.025;
  const DAMPING = 0.85;

  // Repulsion between all pairs
  for (let a = 0; a < nodes.length; a++) {
    for (let b = a + 1; b < nodes.length; b++) {
      const na = nodes[a];
      const nb = nodes[b];
      const dx = na.pos.x - nb.pos.x;
      const dy = na.pos.y - nb.pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = REPEL / (dist * dist);
      na.vel.x += (dx / dist) * force;
      na.vel.y += (dy / dist) * force;
      nb.vel.x -= (dx / dist) * force;
      nb.vel.y -= (dy / dist) * force;
    }
  }

  // Spring attraction along edges
  for (const edge of edges) {
    const a = layout.get(edge.from);
    const b = layout.get(edge.to);
    if (!a || !b) continue;
    const dx = b.pos.x - a.pos.x;
    const dy = b.pos.y - a.pos.y;
    a.vel.x += dx * ATTRACT;
    a.vel.y += dy * ATTRACT;
    b.vel.x -= dx * ATTRACT;
    b.vel.y -= dy * ATTRACT;
  }

  // Integrate + dampen + clamp to canvas
  for (const n of nodes) {
    n.vel.x *= DAMPING;
    n.vel.y *= DAMPING;
    n.pos.x = Math.max(20, Math.min(width - 20, n.pos.x + n.vel.x));
    n.pos.y = Math.max(20, Math.min(height - 20, n.pos.y + n.vel.y));
  }
}

// ── Renderer ───────────────────────────────────────────────────────────────

function renderGraph(
  ctx: CanvasRenderingContext2D,
  layout: Map<string, LayoutNode>,
  edges: DebugEdge[],
  nowMs: number
) {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);

  // Draw edges
  for (const edge of edges) {
    const a = layout.get(edge.from);
    const b = layout.get(edge.to);
    if (!a || !b) continue;

    ctx.beginPath();
    ctx.moveTo(a.pos.x, a.pos.y);
    ctx.lineTo(b.pos.x, b.pos.y);
    ctx.strokeStyle = EDGE_COLORS[edge.type] ?? '#334155';
    ctx.lineWidth = edge.type === 'CONFLICTS_WITH' ? 2 : 1;
    ctx.globalAlpha = edge.type === 'CONFLICTS_WITH' ? 0.9 : 0.4;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Arrowhead
    const angle = Math.atan2(b.pos.y - a.pos.y, b.pos.x - a.pos.x);
    const ax = b.pos.x - Math.cos(angle) * 12;
    const ay = b.pos.y - Math.sin(angle) * 12;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(ax - 8 * Math.cos(angle - 0.4), ay - 8 * Math.sin(angle - 0.4));
    ctx.lineTo(ax - 8 * Math.cos(angle + 0.4), ay - 8 * Math.sin(angle + 0.4));
    ctx.closePath();
    ctx.fillStyle = EDGE_COLORS[edge.type] ?? '#334155';
    ctx.globalAlpha = 0.6;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Draw nodes
  for (const { node, pos } of layout.values()) {
    const color = nodeColor(node);
    const age = nowMs - node.wallTime;
    const pulse = age < 1500 ? 1 + Math.sin((age / 1500) * Math.PI) * 0.4 : 1;
    const baseR = node.type === 'REDUCE' ? 9 : 7;
    const r = baseR * pulse;

    // Glow for recent nodes
    if (age < 1500) {
      const gradient = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, r * 2.5);
      gradient.addColorStop(0, `${color}55`);
      gradient.addColorStop(1, 'transparent');
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r * 2.5, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
    }

    // Node fill
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.85;
    ctx.fill();
    ctx.globalAlpha = 1;

    // Confidence ring
    if (node.confidence !== undefined) {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r + 3, -Math.PI / 2, -Math.PI / 2 + node.confidence * Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.6;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Label (only seq number to keep it readable)
    ctx.fillStyle = '#f1f5f9';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`#${node.seq}`, pos.x, pos.y + r + 11);
  }
}

// ── Component ──────────────────────────────────────────────────────────────

export default function CausalityGraph() {
  const graph = useDebugStore((s) => s.graph);
  const replayIndex = useDebugStore((s) => s.replayIndex);
  const events = useDebugStore((s) => s.events);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layoutRef = useRef<Map<string, LayoutNode>>(new Map());
  const rafRef = useRef<number>(0);
  const stepsRef = useRef(0);

  // In replay mode, restrict to visible slice
  const visibleGraph =
    replayIndex !== null
      ? (() => {
          const visible = events.slice(0, replayIndex + 1);
          const visIds = new Set(visible.map((e) => e.id));
          const nodes = new Map<string, DebugNode>();
          for (const e of visible) nodes.set(e.id, e);
          const edges = graph.edges.filter((ed) => visIds.has(ed.from) && visIds.has(ed.to));
          return { nodes, edges };
        })()
      : graph;

  const animLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Rebuild layout if node set changed
    const layoutIds = new Set(layoutRef.current.keys());
    const graphIds = new Set(visibleGraph.nodes.keys());
    const changed =
      layoutIds.size !== graphIds.size || [...graphIds].some((id) => !layoutIds.has(id));

    if (changed) {
      const w = canvas.offsetWidth || 400;
      const h = canvas.offsetHeight || 300;
      canvas.width = w;
      canvas.height = h;
      layoutRef.current = buildLayout(visibleGraph as DebugGraph, w, h);
      stepsRef.current = 0;
    }

    // Run force steps until settled (first 120 frames)
    if (stepsRef.current < 120 && visibleGraph.nodes.size > 1) {
      runForceStep(layoutRef.current, visibleGraph.edges, canvas.width, canvas.height);
      stepsRef.current++;
    }

    renderGraph(ctx, layoutRef.current, visibleGraph.edges, Date.now());
    rafRef.current = requestAnimationFrame(animLoop);
  }, [visibleGraph]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(animLoop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [animLoop]);

  // Handle canvas resize
  useEffect(() => {
    const obs = new ResizeObserver(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      layoutRef.current = new Map(); // force rebuild
    });
    if (canvasRef.current) obs.observe(canvasRef.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div className="dbg-panel dbg-panel--graph">
      <div className="dbg-panel__header">
        <span className="dbg-panel__title">Causality Graph</span>
        <span className="dbg-panel__sub">
          {visibleGraph.nodes.size} nodes · {visibleGraph.edges.length} edges
        </span>
      </div>
      {visibleGraph.nodes.size === 0 ? (
        <div className="dbg-empty">Graph will populate as scan events arrive.</div>
      ) : (
        <canvas ref={canvasRef} className="causality-canvas" />
      )}
    </div>
  );
}
