/**
 * replayEngine.ts — Deterministic state rehydration engine.
 *
 * Architecture (§1 spec):
 *
 *   CognitionData (nodes/edges/commits with revealedAtStep)
 *        ↓
 *   applyCommit(state, seq) reducer  →  ScanState
 *        ↓
 *   Snapshot index (every SNAPSHOT_INTERVAL commits)
 *        ↓
 *   resolve(targetSeq)  →  nearest snapshot + forward replay
 *        ↓
 *   caller (CognitionOverlay) reads ScanState → pushes to WebGL renderer
 *
 * Guarantees:
 *   SAME seq → IDENTICAL ScanState every time (§2 non-negotiable).
 *   O(N/SNAPSHOT_INTERVAL) replay cost. For 10k commits, ~200 snapshot segments.
 *   No async. No randomness in reducer. No hidden state.
 *
 * Mode system (§9 live+replay hybrid):
 *   LIVE   → cursor auto-follows maxSeq; event bus active.
 *   REPLAY → cursor frozen at chosen seq; event bus concept is "frozen"
 *             (practically: AnalyzeCognitionView stops advancing cursor).
 */

import type { CognitionNode, CognitionEdge, CognitionData } from '../components/cognition/types';

// ── ScanState: the projected world at a specific seq ─────────────────────────

export type ScanState = {
    /** All visible nodes at this seq (id → node) */
    nodes: Map<string, CognitionNode>;
    /** All visible edges at this seq */
    edges: CognitionEdge[];
    /** Nodes in conflict state */
    conflicts: CognitionNode[];
    /** id → confidence at this seq */
    confidenceMap: Map<string, number>;
    /** How many commits have been applied (=targetSeq) */
    seq: number;
};

function emptyScanState(seq = 0): ScanState {
    return {
        nodes: new Map(),
        edges: [],
        conflicts: [],
        confidenceMap: new Map(),
        seq,
    };
}

/** Deep-clone a ScanState so snapshots are immutable. */
function cloneState(s: ScanState): ScanState {
    const nodes = new Map(s.nodes);
    return {
        nodes,
        edges: s.edges.slice(),
        conflicts: s.conflicts.slice(),
        confidenceMap: new Map(s.confidenceMap),
        seq: s.seq,
    };
}

// ── applyStep: the pure reducer ───────────────────────────────────────────────
//
// Given previous ScanState and the CognitionData, return the new state after
// applying all items revealed at `currentSeq`.
//
// This is the only function that mutates (derives) state. It is pure in that:
//   applyStep(state, cogData, seq) always returns the same result for the
//   same (state, seq) inputs.

function applyStep(
    prev: ScanState,
    cogData: CognitionData,
    currentSeq: number,
): ScanState {
    // Accumulate — we work on a mutable copy of the previous state
    const nodes = new Map(prev.nodes);
    const edges = prev.edges.slice();
    const confidenceMap = new Map(prev.confidenceMap);

    // Nodes revealed exactly at this step
    for (const node of cogData.nodes) {
        if (node.revealedAtStep === currentSeq) {
            nodes.set(node.id, node);
            confidenceMap.set(node.id, node.confidence);
        }
    }

    // Edges revealed exactly at this step
    for (const edge of cogData.edges) {
        if (edge.revealedAtStep === currentSeq) {
            if (!edges.some((e) => e.source === edge.source && e.target === edge.target)) {
                edges.push(edge);
            }
        }
    }

    const conflicts = [...nodes.values()].filter((n) => n.status === 'conflict');

    return { nodes, edges, conflicts, confidenceMap, seq: currentSeq };
}

// ── SNAPSHOT_INTERVAL ─────────────────────────────────────────────────────────
// Store a checkpoint every N commits. With 10k commits, this gives 200 segments
// of max 50 replays each → O(50) per seek regardless of total timeline length.

const SNAPSHOT_INTERVAL = 50;

// ── ReplayEngine ───────────────────────────────────────────────────────────────

export class ReplayEngine {
    private cogData: CognitionData | null = null;
    private maxSeq = 0;

    /** seq → ScanState snapshot (immutable checkpoints) */
    private snapshots = new Map<number, ScanState>();

    /** `${checkpointSeq}:${targetSeq}` → ScanState (cached segment results) */
    private segmentCache = new Map<string, ScanState>();

    /** Load new cognition data and pre-build all snapshots. */
    load(cogData: CognitionData): void {
        this.cogData = cogData;
        this.snapshots.clear();
        this.segmentCache.clear();

        const maxStep = cogData.commits.reduce((m, c) => Math.max(m, c.stepIndex), 0);
        this.maxSeq = maxStep;

        // Build snapshots by replaying from 0 once. O(n).
        let state = emptyScanState();
        this.snapshots.set(0, cloneState(state));

        for (let seq = 1; seq <= maxStep; seq++) {
            state = applyStep(state, cogData, seq);
            if (seq % SNAPSHOT_INTERVAL === 0) {
                this.snapshots.set(seq, cloneState(state));
            }
        }
    }

    /** Return the ScanState at exactly `targetSeq`. O(SNAPSHOT_INTERVAL) worst case. */
    resolve(targetSeq: number): ScanState {
        if (!this.cogData) return emptyScanState(targetSeq);

        // Clamp to valid range
        const seq = Math.max(0, Math.min(targetSeq, this.maxSeq));

        // Find nearest snapshot ≤ seq
        const checkpointSeq = Math.floor(seq / SNAPSHOT_INTERVAL) * SNAPSHOT_INTERVAL;
        const snapshot = this.snapshots.get(checkpointSeq) ?? emptyScanState(checkpointSeq);

        if (seq === checkpointSeq) return snapshot;

        // Check segment cache
        const cacheKey = `${checkpointSeq}:${seq}`;
        const cached = this.segmentCache.get(cacheKey);
        if (cached) return cached;

        // Replay forward from checkpoint to target
        let state = cloneState(snapshot);
        for (let s = checkpointSeq + 1; s <= seq; s++) {
            state = applyStep(state, this.cogData, s);
        }

        this.segmentCache.set(cacheKey, state);
        return state;
    }

    get maxCommitSeq(): number {
        return this.maxSeq;
    }

    /** Flush segment cache (e.g. after new commits arrive in live mode). */
    invalidateCache(): void {
        this.segmentCache.clear();
    }

    isLoaded(): boolean {
        return this.cogData !== null;
    }
}

// ── Singleton instance used by CognitionOverlay ───────────────────────────────
// A single engine is sufficient — one scan active at a time.

export const replayEngine = new ReplayEngine();

// ── Mode control ──────────────────────────────────────────────────────────────
// §9: LIVE = cursor auto-advances; REPLAY = cursor is frozen by user.

export type ReplayMode = 'LIVE' | 'REPLAY';

let _mode: ReplayMode = 'LIVE';
const _modeListeners = new Set<(m: ReplayMode) => void>();

export function getReplayMode(): ReplayMode {
    return _mode;
}

export function setReplayMode(mode: ReplayMode): void {
    if (_mode === mode) return;
    _mode = mode;
    for (const cb of _modeListeners) {
        try { cb(mode); } catch { /* ignore */ }
    }
}

export function onReplayModeChange(cb: (m: ReplayMode) => void): () => void {
    _modeListeners.add(cb);
    return () => _modeListeners.delete(cb);
}
