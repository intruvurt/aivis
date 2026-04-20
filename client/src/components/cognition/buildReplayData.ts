/**
 * buildReplayData.ts
 *
 * Converts CognitionData (from buildCognitionData) into the CommitNode[] +
 * CommitDiff[] format that replayStore.loadCommits() accepts.
 *
 * This is the bridge between the cognition data model and the replay store.
 */

import type { CognitionData } from './types';
import type { CommitNode, CommitDiff } from '../../stores/replayStore';

export function buildReplayData(cog: CognitionData): {
  commitNodes: CommitNode[];
  diffs: Record<string, CommitDiff>;
} {
  const commitNodes: CommitNode[] = cog.commits.map((c, i) => ({
    hash: c.id,
    parent: i > 0 ? cog.commits[i - 1].id : null,
    branch: c.isBranch ? 'conflict' : c.agent,
    seq: c.stepIndex,
    message: c.label,
    confidence: c.confidence ?? 0.8,
    agentId: c.agent,
    // Spread commits over a synthetic wall-clock window so they feel organic
    timestamp: Date.now() - (cog.commits.length - i) * 800,
  }));

  const diffs: Record<string, CommitDiff> = {};
  for (const c of cog.commits) {
    diffs[c.id] = {
      added: (c.evidence ?? [])
        .filter((l) => l.startsWith('+'))
        .map((l) => l.replace(/^\+\s*/, '')),
      removed: (c.changes ?? [])
        .filter((l) => l.startsWith('-'))
        .map((l) => l.replace(/^-\s*/, '')),
      modified: (c.changes ?? [])
        .filter((l) => l.startsWith('!'))
        .map((l) => l.replace(/^!\s*/, '')),
      affectedNodeIds: c.relatedNodeIds ?? [],
    };
  }

  return { commitNodes, diffs };
}

/**
 * Build placeholder CommitNode[] for the scanning phase from the
 * scanning-phase CognitionCommit[] produced by buildScanningCommits().
 */
export function buildScanReplayNodes(
  commits: ReturnType<typeof import('./buildCognitionData')['buildScanningCommits']>,
): CommitNode[] {
  return commits.map((c, i) => ({
    hash: c.id,
    parent: i > 0 ? commits[i - 1].id : null,
    branch: c.agent,
    seq: c.stepIndex,
    message: c.label,
    confidence: 0.5,
    agentId: c.agent,
  }));
}
