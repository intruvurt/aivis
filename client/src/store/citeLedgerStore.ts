/**
 * CITE LEDGER STORE - Zustand
 *
 * Ledger-first state model. All UI state derives from cite entries.
 * Nothing renders unless it has backing cites.
 *
 * Core principle: UI is an interpreter of the Cite Ledger, not a viewer.
 */

import { create } from 'zustand';
import type { CiteEntry, CiteSourceType, AuditWithCiteLedger } from '@shared/types';

/**
 * UI State Shape - Everything keys off cites
 */
export interface UIState {
  // Primary source of truth
  cites: Record<string, CiteEntry>; // hash → cite entry

  // Score layer - references to cite entries
  scoreRefs: {
    crawl: string[]; // cite hashes
    semantic: string[];
    authority: string[];
  };
  scoresComputed: {
    crawl: number;
    semantic: number;
    authority: number;
    visibility: number; // aggregate
  };

  // Issue layer - cite-backed findings
  issues: Array<{
    id: string;
    fingerprint: string; // deterministic id
    citeRefs: string[]; // cite hashes
    severity: 'critical' | 'high' | 'medium' | 'low';
    category: string;
  }>;

  // Fix layer - transformations justified by cites
  fixes: Array<{
    id: string;
    citeRefs: string[]; // cite hashes
    patch: string; // actual code/config change
    targetPath: string;
    appliedAt?: number; // timestamp when applied
    prUrl?: string; // GitHub PR if automation ran
  }>;

  // Metadata
  auditId: string | null;
  url: string | null;
  analyzedAt: number | null;
  streaming: boolean;
  lastStreamEvent: number | null;

  // Temporal replay (for time slider)
  timeline: Array<{
    timestamp: number;
    event: 'cite:add' | 'score:update' | 'issue:add' | 'fix:add';
    citeHash?: string;
    layer?: string;
  }>;
  currentTimelineIndex: number; // for replay

  // Actions
  addCite: (cite: CiteEntry) => void;
  removeCite: (hash: string) => void;
  setScoreRefs: (layer: 'crawl' | 'semantic' | 'authority', refs: string[]) => void;
  setScores: (scores: {
    crawl: number;
    semantic: number;
    authority: number;
    visibility: number;
  }) => void;
  addIssue: (issue: UIState['issues'][number]) => void;
  removeIssue: (issueId: string) => void;
  addFix: (fix: UIState['fixes'][number]) => void;
  removeFix: (fixId: string) => void;
  setAuditMetadata: (auditId: string, url: string) => void;
  setStreaming: (isStreaming: boolean) => void;
  recordTimelineEvent: (event: UIState['timeline'][number]) => void;
  seekTimeline: (index: number) => void;
  reset: () => void;
}

const initialState = {
  cites: {},
  scoreRefs: { crawl: [], semantic: [], authority: [] },
  scoresComputed: {
    crawl: 0,
    semantic: 0,
    authority: 0,
    visibility: 0,
  },
  issues: [],
  fixes: [],
  auditId: null,
  url: null,
  analyzedAt: null,
  streaming: false,
  lastStreamEvent: null,
  timeline: [],
  currentTimelineIndex: 0,
};

/**
 * Zustand Store - Ledger enforced
 */
export const useCiteLedgerStore = create<UIState>((set, get) => ({
  ...initialState,

  /**
   * Add cite to store. Central truth entry point.
   */
  addCite: (cite: CiteEntry) =>
    set((state) => {
      const hash = cite.id; // Use cite ID as hash
      return {
        cites: {
          ...state.cites,
          [hash]: cite,
        },
        lastStreamEvent: Date.now(),
      };
    }),

  /**
   * Remove cite (rare - usually archive via ledger)
   */
  removeCite: (hash: string) =>
    set((state) => {
      const newCites = { ...state.cites };
      delete newCites[hash];

      // Rebuild refs to exclude this cite
      const scoreRefs = {
        crawl: state.scoreRefs.crawl.filter((h) => h !== hash),
        semantic: state.scoreRefs.semantic.filter((h) => h !== hash),
        authority: state.scoreRefs.authority.filter((h) => h !== hash),
      };

      const issues = state.issues.map((i) => ({
        ...i,
        citeRefs: i.citeRefs.filter((h) => h !== hash),
      }));

      const fixes = state.fixes.map((f) => ({
        ...f,
        citeRefs: f.citeRefs.filter((h) => h !== hash),
      }));

      return {
        cites: newCites,
        scoreRefs,
        issues,
        fixes,
      };
    }),

  /**
   * Set cite references for a scoring layer
   * Validates that all refs exist as cites
   */
  setScoreRefs: (layer: 'crawl' | 'semantic' | 'authority', refs: string[]) =>
    set((state) => {
      // Hard constraint: no refs → no visibility
      if (!refs || refs.length === 0) {
        return {
          scoreRefs: {
            ...state.scoreRefs,
            [layer]: [],
          },
        };
      }

      // Validate all refs exist
      const validRefs = refs.filter((h) => state.cites[h]);

      return {
        scoreRefs: {
          ...state.scoreRefs,
          [layer]: validRefs,
        },
        recordTimelineEvent: Date.now(),
      };
    }),

  /**
   * Set computed scores across layers
   */
  setScores: (scores) =>
    set({
      scoresComputed: scores,
      lastStreamEvent: Date.now(),
    }),

  /**
   * Add issue. Must have cites.
   */
  addIssue: (issue) =>
    set((state) => {
      // Hard constraint: no cites → no visibility
      if (!issue.citeRefs || issue.citeRefs.length === 0) {
        console.warn('[CiteLedger] Rejected issue without cite references', issue.id);
        return state;
      }

      return {
        issues: [...state.issues, issue],
        lastStreamEvent: Date.now(),
      };
    }),

  /**
   * Remove issue by ID
   */
  removeIssue: (issueId: string) =>
    set((state) => ({
      issues: state.issues.filter((i) => i.id !== issueId),
    })),

  /**
   * Add fix. Must have cites.
   */
  addFix: (fix) =>
    set((state) => {
      // Hard constraint: no cites → no visibility
      if (!fix.citeRefs || fix.citeRefs.length === 0) {
        console.warn('[CiteLedger] Rejected fix without cite references', fix.id);
        return state;
      }

      return {
        fixes: [...state.fixes, fix],
        lastStreamEvent: Date.now(),
      };
    }),

  /**
   * Remove fix by ID
   */
  removeFix: (fixId: string) =>
    set((state) => ({
      fixes: state.fixes.filter((f) => f.id !== fixId),
    })),

  /**
   * Set audit metadata
   */
  setAuditMetadata: (auditId: string, url: string) =>
    set({
      auditId,
      url,
      analyzedAt: Date.now(),
    }),

  /**
   * Set streaming state
   */
  setStreaming: (isStreaming: boolean) => set({ streaming: isStreaming }),

  /**
   * Record timeline event for replay functionality
   */
  recordTimelineEvent: (event) =>
    set((state) => ({
      timeline: [
        ...state.timeline,
        {
          ...event,
          timestamp: Date.now(),
        },
      ],
    })),

  /**
   * Seek to specific timeline index (for replay)
   */
  seekTimeline: (index: number) =>
    set((state) => {
      if (index < 0 || index > state.timeline.length - 1) {
        console.warn('[CiteLedger] Invalid timeline index', index);
        return state;
      }

      // Replay from beginning to target index
      const targetTimestamp = state.timeline[index].timestamp;

      // Rebuild state up to this point
      const replayedState: UIState = {
        ...initialState,
        auditId: state.auditId,
        url: state.url,
        analyzedAt: state.analyzedAt,
        timeline: state.timeline,
      };

      for (let i = 0; i <= index; i++) {
        const evt = state.timeline[i];
        if (evt.event === 'cite:add' && evt.citeHash) {
          const cite = state.cites[evt.citeHash];
          if (cite) {
            replayedState.cites[evt.citeHash] = cite;
          }
        } else if (evt.event === 'score:update' && evt.layer) {
          const layer = evt.layer as 'crawl' | 'semantic' | 'authority';
          replayedState.scoreRefs[layer] = state.scoreRefs[layer];
          replayedState.scoresComputed = state.scoresComputed;
        } else if (evt.event === 'issue:add') {
          replayedState.issues = state.issues;
        } else if (evt.event === 'fix:add') {
          replayedState.fixes = state.fixes;
        }
      }

      return {
        ...replayedState,
        currentTimelineIndex: index,
      };
    }),

  /**
   * Reset to initial state
   */
  reset: () => set(initialState),
}));

/**
 * Derived selectors (computed from store)
 */

export const selectAllCites = (state: UIState) => Object.values(state.cites);

export const selectCitesBySource = (state: UIState, source: CiteSourceType) =>
  Object.values(state.cites).filter((c) => c.source_type === source);

export const selectCitesForIssue = (state: UIState, issueId: string) => {
  const issue = state.issues.find((i) => i.id === issueId);
  if (!issue) return [];
  return issue.citeRefs.map((h) => state.cites[h]).filter(Boolean);
};

export const selectCitesForFix = (state: UIState, fixId: string) => {
  const fix = state.fixes.find((f) => f.id === fixId);
  if (!fix) return [];
  return fix.citeRefs.map((h) => state.cites[h]).filter(Boolean);
};

export const selectIssuesWithCites = (state: UIState) =>
  state.issues.filter((i) => i.citeRefs.length > 0);

export const selectFixesWithCites = (state: UIState) =>
  state.fixes.filter((f) => f.citeRefs.length > 0);

/**
 * Score confidence (based on cite count and average confidence)
 */
export const selectScoreConfidence = (state: UIState) => {
  const allCites = Object.values(state.cites);
  if (allCites.length === 0) return 0;

  const avgConfidence = allCites.reduce((sum, c) => sum + c.confidence_score, 0) / allCites.length;

  return Math.round(avgConfidence * 100);
};

/**
 * Cite coverage by source type
 */
export const selectCiteCoverage = (state: UIState) => {
  const coverage: Record<CiteSourceType, number> = {
    crawl: 0,
    semantic: 0,
    authority: 0,
    entity: 0,
  };

  Object.values(state.cites).forEach((c) => {
    coverage[c.source_type]++;
  });

  return coverage;
};
