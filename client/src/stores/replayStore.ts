/**
 * replayStore.ts — Zustand store for commit-history based cognition replay.
 *
 * Architecture:
 *   loadCommits() populates the store with CommitNode[] + per-commit diffs.
 *   ONE variable drives everything:
 *     cursor = { hash?, seq }
 *   resolveCursor() narrows cursor to a concrete CommitNode.
 *   The center graph renderer reads cursor.seq to replay to that point.
 *
 * This is NOT the debug event bus (debugStore.ts).
 * This is the forensic history layer — navigable, discrete, causal.
 */

import { create } from 'zustand';

// ── Data model ────────────────────────────────────────────────────────────────

export type CommitNode = {
  hash: string;
  parent: string | null;   // null = root commit
  branch: string;
  seq: number;
  message: string;
  confidence: number;      // 0–1
  agentId?: string;
  timestamp?: number;      // wall-clock ms
};

export type CommitDiff = {
  added: string[];
  removed: string[];
  modified: string[];
  affectedNodeIds: string[];  // graph nodes touched by this commit
};

export type Cursor = {
  hash?: string;
  seq: number;
};

// ── Replay state ──────────────────────────────────────────────────────────────

type ReplayState = {
  scanId: string | null;
  commits: CommitNode[];              // sorted ascending by seq
  diffs: Record<string, CommitDiff>; // hash → diff
  cursor: Cursor;
  maxSeq: number;
  allBranches: string[];             // in order of first appearance
  visibleBranches: string[];         // drives filter; min 1 branch always visible
  hoveredHash: string | null;        // preview without cursor change
  commitByHash: Record<string, CommitNode>;

  // Actions
  loadCommits: (
    scanId: string,
    commits: CommitNode[],
    diffs?: Record<string, CommitDiff>,
  ) => void;
  setCursor:     (cursor: Cursor) => void;
  setCursorHash: (hash: string) => void;
  setCursorSeq:  (seq: number) => void;
  stepForward:   () => void;
  stepBack:      () => void;
  toggleBranch:  (branch: string) => void;
  setHoveredHash:(hash: string | null) => void;
  reset:         () => void;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function sortedBySeq(commits: CommitNode[]): CommitNode[] {
  return [...commits].sort((a, b) => a.seq - b.seq);
}

function buildIndex(commits: CommitNode[]): Record<string, CommitNode> {
  const idx: Record<string, CommitNode> = {};
  for (const c of commits) idx[c.hash] = c;
  return idx;
}

function extractBranches(commits: CommitNode[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of commits) {
    if (!seen.has(c.branch)) { seen.add(c.branch); out.push(c.branch); }
  }
  return out;
}

/**
 * Resolve cursor to a concrete CommitNode.
 * hash takes priority over seq. Returns null only if commits is empty.
 */
export function resolveCursor(cursor: Cursor, commits: CommitNode[]): CommitNode | null {
  if (cursor.hash) return commits.find(c => c.hash === cursor.hash) ?? null;
  return commits.find(c => c.seq === cursor.seq) ?? null;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useReplayStore = create<ReplayState>((set, get) => ({
  scanId:          null,
  commits:         [],
  diffs:           {},
  cursor:          { seq: 0 },
  maxSeq:          0,
  allBranches:     [],
  visibleBranches: [],
  hoveredHash:     null,
  commitByHash:    {},

  loadCommits(scanId, rawCommits, diffs = {}) {
    const commits      = sortedBySeq(rawCommits);
    const allBranches  = extractBranches(commits);
    const maxSeq       = commits.length > 0 ? commits[commits.length - 1].seq : 0;
    const first        = commits[0];
    set({
      scanId,
      commits,
      diffs,
      allBranches,
      visibleBranches: [...allBranches],
      commitByHash:    buildIndex(commits),
      maxSeq,
      cursor: first ? { hash: first.hash, seq: first.seq } : { seq: 0 },
      hoveredHash: null,
    });
  },

  setCursor(cursor) {
    set({ cursor });
  },

  setCursorHash(hash) {
    const commit = get().commitByHash[hash];
    if (commit) set({ cursor: { hash, seq: commit.seq } });
  },

  setCursorSeq(seq) {
    const commit = get().commits.find(c => c.seq === seq);
    set({ cursor: commit ? { hash: commit.hash, seq } : { seq } });
  },

  stepForward() {
    const { cursor, commits } = get();
    const idx = commits.findIndex(c => c.seq === cursor.seq);
    if (idx >= 0 && idx < commits.length - 1) {
      const next = commits[idx + 1];
      set({ cursor: { hash: next.hash, seq: next.seq } });
    }
  },

  stepBack() {
    const { cursor, commits } = get();
    const idx = commits.findIndex(c => c.seq === cursor.seq);
    if (idx > 0) {
      const prev = commits[idx - 1];
      set({ cursor: { hash: prev.hash, seq: prev.seq } });
    }
  },

  toggleBranch(branch) {
    const { visibleBranches } = get();
    if (visibleBranches.includes(branch)) {
      // Never hide the last visible branch
      if (visibleBranches.length > 1) {
        set({ visibleBranches: visibleBranches.filter(b => b !== branch) });
      }
    } else {
      set({ visibleBranches: [...visibleBranches, branch] });
    }
  },

  setHoveredHash(hash) {
    set({ hoveredHash: hash });
  },

  reset() {
    set({
      scanId:          null,
      commits:         [],
      diffs:           {},
      cursor:          { seq: 0 },
      maxSeq:          0,
      allBranches:     [],
      visibleBranches: [],
      hoveredHash:     null,
      commitByHash:    {},
    });
  },
}));
