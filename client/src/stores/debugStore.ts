/**
 * debugStore.ts
 *
 * Volatile observation-layer state for the Live Agent Brain Debugger.
 *
 * Architecture:
 *   Scan Engine (production)
 *     ↓ tapEvent() — zero-interference shadow projection
 *   Debug Event Bus
 *     ↓
 *   debugStore (Zustand) — time-indexed graph + agent lanes + conflict detection
 *     ↓
 *   DebuggerApp (React + Canvas)
 *
 * CRITICAL RULE: Nothing in this store writes back to the scan engine.
 * This is observation only. No feedback loop.
 */

import { create } from 'zustand';
import type { ScanEvent } from '../../../shared/types';

// ── Debug graph primitives ────────────────────────────────────────────────────

export type DebugNodeType = 'AGENT' | 'EVENT' | 'VOTE' | 'REDUCE';

export type DebugNode = {
  id: string;
  type: DebugNodeType;
  eventType: string;
  timestamp: number;       // performance.now() at tap time
  wallTime: number;        // Date.now()
  scanId: string;
  seq: number;
  payload: ScanEvent;
  confidence?: number;
  jitter: number;          // ms drift from declared scan ts to tap time
};

export type DebugEdgeType = 'DERIVES_FROM' | 'CONFLICTS_WITH' | 'CONFIRMS';

export type DebugEdge = {
  from: string;
  to: string;
  type: DebugEdgeType;
  confidence?: number;
};

export type DebugGraph = {
  nodes: Map<string, DebugNode>;
  edges: DebugEdge[];
};

// ── Agent lane primitives ─────────────────────────────────────────────────────

export type AgentBurst = {
  nodeId: string;
  timestamp: number;
  confidence: number;
  eventType: string;
  durationMs: number;
};

// ── Conflict primitives ───────────────────────────────────────────────────────

export type DebugConflict = {
  id: string;
  entity: string;
  variance: number;
  sources: string[];
  involvedNodeIds: string[];
  detectedAt: number;
};

// ── Full debug state ──────────────────────────────────────────────────────────

type DebugState = {
  events: DebugNode[];
  graph: DebugGraph;
  agentLanes: Record<string, AgentBurst[]>;
  conflicts: DebugConflict[];
  activeScanId: string | null;
  isRecording: boolean;
  replayIndex: number | null;   // null = live, number = replaying at that index

  // Actions
  tapEvent: (event: ScanEvent, scanId: string, seq: number) => void;
  setScanId: (id: string) => void;
  startRecording: () => void;
  stopRecording: () => void;
  reset: () => void;
  setReplayIndex: (idx: number | null) => void;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function eventToNodeType(event: ScanEvent): DebugNodeType {
  switch (event.type) {
    case 'SCAN_STARTED': return 'AGENT';
    case 'CITE_FOUND':   return 'VOTE';
    case 'SCORE_UPDATED': return 'REDUCE';
    case 'SCAN_COMPLETED': return 'REDUCE';
    default: return 'EVENT';
  }
}

function extractConfidence(event: ScanEvent): number | undefined {
  if (event.type === 'CITE_FOUND') return event.cite.confidence;
  if (event.type === 'SCORE_UPDATED') return event.value / 100;
  return undefined;
}

function agentLaneKey(event: ScanEvent): string {
  switch (event.type) {
    case 'CITE_FOUND':        return 'CitationVoter';
    case 'ENTITY_EXTRACTED':  return 'EntityAgent';
    case 'INTERPRETATION':    return 'InterpretAgent';
    case 'SCORE_UPDATED':     return `Reducer:${event.layer}`;
    case 'SCAN_COMPLETED':    return 'Finaliser';
    default:                  return 'Orchestrator';
  }
}

let _nodeSerial = 0;

function buildNode(
  event: ScanEvent,
  scanId: string,
  seq: number,
  nowPerf: number,
): DebugNode {
  _nodeSerial++;
  const scanTs = event.type === 'SCAN_STARTED' ? event.ts : nowPerf;
  return {
    id: `${scanId}:${seq}:${_nodeSerial}`,
    type: eventToNodeType(event),
    eventType: event.type,
    timestamp: nowPerf,
    wallTime: Date.now(),
    scanId,
    seq,
    payload: event,
    confidence: extractConfidence(event),
    jitter: Math.abs(nowPerf - scanTs),
  };
}

function detectConflicts(nodes: DebugNode[], newNode: DebugNode): DebugConflict[] {
  const conflicts: DebugConflict[] = [];

  if (newNode.eventType !== 'CITE_FOUND') return conflicts;

  const cite = (newNode.payload as Extract<ScanEvent, { type: 'CITE_FOUND' }>).cite;
  const sameKey = nodes.filter(
    (n) =>
      n.eventType === 'CITE_FOUND' &&
      n.scanId === newNode.scanId &&
      (n.payload as Extract<ScanEvent, { type: 'CITE_FOUND' }>).cite.evidence_key ===
        cite.evidence_key,
  );

  if (sameKey.length >= 2) {
    const confidences = sameKey.map(
      (n) => (n.payload as Extract<ScanEvent, { type: 'CITE_FOUND' }>).cite.confidence,
    );
    const max = Math.max(...confidences);
    const min = Math.min(...confidences);
    const variance = max - min;

    if (variance > 0.15) {
      conflicts.push({
        id: `conflict:${cite.evidence_key}:${Date.now()}`,
        entity: cite.evidence_key,
        variance,
        sources: [...new Set(sameKey.map(
          (n) => (n.payload as Extract<ScanEvent, { type: 'CITE_FOUND' }>).cite.source,
        ))],
        involvedNodeIds: sameKey.map((n) => n.id),
        detectedAt: Date.now(),
      });
    }
  }

  return conflicts;
}

// ── Store ─────────────────────────────────────────────────────────────────────

const BLANK_GRAPH = (): DebugGraph => ({ nodes: new Map(), edges: [] });

export const useDebugStore = create<DebugState>((set, get) => ({
  events: [],
  graph: BLANK_GRAPH(),
  agentLanes: {},
  conflicts: [],
  activeScanId: null,
  isRecording: false,
  replayIndex: null,

  tapEvent(event: ScanEvent, scanId: string, seq: number) {
    const { isRecording } = get();
    if (!isRecording) return;

    const nowPerf = performance.now();
    const node = buildNode(event, scanId, seq, nowPerf);

    set((state) => {
      // ── Build new graph ──────────────────────────────────────────────────
      const newNodes = new Map(state.graph.nodes);
      newNodes.set(node.id, node);

      const newEdges = [...state.graph.edges];
      // Find the most-recent prior node for this scan to create a causal edge
      const priorNodes = state.events
        .filter((e) => e.scanId === scanId)
        .sort((a, b) => b.seq - a.seq);

      if (priorNodes.length > 0) {
        newEdges.push({
          from: priorNodes[0].id,
          to: node.id,
          type: 'DERIVES_FROM',
          confidence: node.confidence,
        });
      }

      // ── Agent lanes ──────────────────────────────────────────────────────
      const laneKey = agentLaneKey(event);
      const prevLane = state.agentLanes[laneKey] ?? [];
      const prevBurst = prevLane[prevLane.length - 1];
      const durationMs = prevBurst ? nowPerf - prevBurst.timestamp : 0;

      const newBurst: AgentBurst = {
        nodeId: node.id,
        timestamp: nowPerf,
        confidence: node.confidence ?? 0.5,
        eventType: event.type,
        durationMs,
      };

      // ── Conflict detection ────────────────────────────────────────────────
      const newConflicts = detectConflicts(state.events, node);

      return {
        events: [...state.events, node],
        graph: { nodes: newNodes, edges: newEdges },
        agentLanes: {
          ...state.agentLanes,
          [laneKey]: [...prevLane, newBurst],
        },
        conflicts: [...state.conflicts, ...newConflicts],
      };
    });
  },

  setScanId(id: string) {
    set({ activeScanId: id });
  },

  startRecording() {
    set({ isRecording: true });
  },

  stopRecording() {
    set({ isRecording: false });
  },

  reset() {
    _nodeSerial = 0;
    set({
      events: [],
      graph: BLANK_GRAPH(),
      agentLanes: {},
      conflicts: [],
      activeScanId: null,
      replayIndex: null,
    });
  },

  setReplayIndex(idx: number | null) {
    set({ replayIndex: idx });
  },
}));
