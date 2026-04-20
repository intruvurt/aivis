/**
 * CommitInspector.tsx — Right panel: commit metadata + belief diff.
 *
 * Shows the selected commit's diff and metadata (§6).
 * While hovering a commit in CommitGraph, renders a PREVIEW badge
 * without mutating cursor. Click commits in CommitGraph to commit the state.
 *
 * Inspector sections (§8 typography grid):
 *   CommitHeader  → 72px (message + short hash)
 *   MetadataBlock → auto (~120px)
 *   Divider       → 1px
 *   DiffView      → fill (added / removed / modified / affected nodes)
 */

import React, { useMemo } from 'react';
import { useReplayStore, resolveCursor } from '../../stores/replayStore';

function confColor(c: number): string {
  if (c >= 0.7) return '#00ff9c';
  if (c >= 0.4) return '#ffc857';
  return '#ff4d4d';
}

function confLabel(c: number): string {
  if (c >= 0.7) return 'High';
  if (c >= 0.4) return 'Medium';
  return 'Low';
}

// ── DiffView ──────────────────────────────────────────────────────────────────

interface DiffViewProps {
  added:           string[];
  removed:         string[];
  modified:        string[];
  affectedNodeIds: string[];
}

function DiffView({ added, removed, modified, affectedNodeIds }: DiffViewProps) {
  const isEmpty = added.length + removed.length + modified.length + affectedNodeIds.length === 0;
  if (isEmpty) {
    return <p className="ci-diff-empty">No diff data for this commit.</p>;
  }

  return (
    <div className="ci-diff">
      {added.length > 0 && (
        <div className="fl-diff-section">
          <div className="ci-diff-heading">Added ({added.length})</div>
          {added.map((line, i) => (
            <div key={i} className="fl-diff-line fl-diff-line--add">
              <span className="ci-diff-sigil">+</span>{line}
            </div>
          ))}
        </div>
      )}
      {removed.length > 0 && (
        <div className="fl-diff-section">
          <div className="ci-diff-heading">Removed ({removed.length})</div>
          {removed.map((line, i) => (
            <div key={i} className="fl-diff-line fl-diff-line--del">
              <span className="ci-diff-sigil">−</span>{line}
            </div>
          ))}
        </div>
      )}
      {modified.length > 0 && (
        <div className="fl-diff-section">
          <div className="ci-diff-heading">Modified ({modified.length})</div>
          {modified.map((line, i) => (
            <div key={i} className="fl-diff-line fl-diff-line--meta">
              <span className="ci-diff-sigil">~</span>{line}
            </div>
          ))}
        </div>
      )}
      {affectedNodeIds.length > 0 && (
        <div className="fl-diff-section">
          <div className="ci-diff-heading">Graph nodes ({affectedNodeIds.length})</div>
          {affectedNodeIds.map((id, i) => (
            <div key={i} className="fl-diff-line fl-diff-line--meta ci-diff-node-id">
              ◈ {id}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── CommitInspector ───────────────────────────────────────────────────────────

export default function CommitInspector() {
  const cursor      = useReplayStore(s => s.cursor);
  const commits     = useReplayStore(s => s.commits);
  const diffs       = useReplayStore(s => s.diffs);
  const hoveredHash = useReplayStore(s => s.hoveredHash);

  // While a commit is hovered, show its data as a PREVIEW (cursor unchanged)
  const displayHash = hoveredHash ?? cursor.hash;
  const isPreviewing = hoveredHash !== null && hoveredHash !== cursor.hash;

  const commit = useMemo(
    () =>
      displayHash
        ? (commits.find(c => c.hash === displayHash) ?? resolveCursor(cursor, commits))
        : resolveCursor(cursor, commits),
    [commits, displayHash, cursor],
  );

  const diff = displayHash ? (diffs[displayHash] ?? null) : null;

  if (!commit) {
    return (
      <div className="fl-panel fl-panel--inspector ci-empty">
        <span className="ci-empty-label">Select a commit to inspect.</span>
      </div>
    );
  }

  const color = confColor(commit.confidence);

  return (
    <div className="fl-panel fl-panel--inspector">
      {isPreviewing && (
        <div className="ci-preview-badge" aria-label="Preview mode">PREVIEW</div>
      )}

      {/* §8 Commit header — 72px */}
      <div className="fl-inspector__header">
        <h2 className="fl-inspector__title" title={commit.message}>
          {commit.message}
        </h2>
        <span className="ci-hash" title={commit.hash}>
          {commit.hash.slice(0, 8)}
        </span>
      </div>

      {/* §8 Metadata block  */}
      <div className="fl-inspector__meta-block ci-meta">
        <div className="ci-meta-row">
          <span className="ci-meta-key">Branch</span>
          <span className="ci-meta-val">{commit.branch}</span>
        </div>
        <div className="ci-meta-row">
          <span className="ci-meta-key">Agent</span>
          <span className="ci-meta-val">{commit.agentId ?? '—'}</span>
        </div>
        <div className="ci-meta-row">
          <span className="ci-meta-key">Seq</span>
          <span className="ci-meta-val ci-meta-val--mono">#{commit.seq}</span>
        </div>
        <div className="ci-meta-row">
          <span className="ci-meta-key">Confidence</span>
          <span className="ci-meta-val ci-meta-val--conf" style={{ color }}>
            {(commit.confidence * 100).toFixed(0)}% {confLabel(commit.confidence)}
          </span>
        </div>
        {commit.timestamp != null && (
          <div className="ci-meta-row">
            <span className="ci-meta-key">Time</span>
            <span className="ci-meta-val ci-meta-val--mono">
              {new Date(commit.timestamp).toLocaleTimeString()}
            </span>
          </div>
        )}
      </div>

      <hr className="fl-inspector__divider" aria-hidden="true" />

      {/* §8 Diff viewer — fill */}
      {diff ? (
        <DiffView
          added={diff.added}
          removed={diff.removed}
          modified={diff.modified}
          affectedNodeIds={diff.affectedNodeIds}
        />
      ) : (
        <p className="ci-diff-empty">No diff data for this commit.</p>
      )}
    </div>
  );
}
