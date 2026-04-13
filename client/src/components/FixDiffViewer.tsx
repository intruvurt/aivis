/**
 * FixDiffViewer.tsx — Before/after diff viewer for Auto Score Fix file changes.
 *
 * Shows each file change as a tabbed, color-coded line diff.
 * Deterministic patches get a blue "Auto" badge; LLM patches get a purple "AI" badge.
 * Each file tab shows +additions / -removals counts.
 */

import React, { useState } from "react";

// ─── Types (mirroring server/src/services/fixDiffService.ts) ─────────────────

interface DiffLine {
  type: "add" | "remove" | "context";
  content: string;
  lineNo?: number;
  newLineNo?: number;
}

interface FileDiff {
  before_lines: number;
  after_lines: number;
  lines: DiffLine[];
  has_changes: boolean;
  additions: number;
  removals: number;
}

export interface FileChangeSummary {
  path: string;
  operation: "create" | "update";
  is_deterministic: boolean;
  diff: FileDiff | null;
  validation_warnings: string[];
}

interface Props {
  fileChanges: FileChangeSummary[];
  className?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function lineClassName(type: DiffLine["type"]): string {
  switch (type) {
    case "add":
      return "bg-green-950/60 text-green-300 border-l-2 border-green-500";
    case "remove":
      return "bg-red-950/60 text-red-300 border-l-2 border-red-500";
    default:
      return "text-neutral-400 border-l-2 border-transparent";
  }
}

function linePrefix(type: DiffLine["type"]): string {
  switch (type) {
    case "add":    return "+";
    case "remove": return "−";
    default:       return " ";
  }
}

function lineNumber(line: DiffLine, side: "before" | "after"): string {
  const n = side === "before" ? line.lineNo : line.newLineNo;
  return n !== undefined ? String(n).padStart(4, " ") : "    ";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DiffLineRow({ line }: { line: DiffLine }) {
  const cls = lineClassName(line.type);
  return (
    <div className={`flex items-start font-mono text-xs leading-relaxed ${cls}`}>
      {/* Before line number */}
      <span className="select-none w-10 shrink-0 text-right pr-2 opacity-40">
        {lineNumber(line, "before")}
      </span>
      {/* After line number */}
      <span className="select-none w-10 shrink-0 text-right pr-2 opacity-40">
        {lineNumber(line, "after")}
      </span>
      {/* +/- prefix */}
      <span className="select-none w-4 shrink-0 text-center opacity-70">
        {linePrefix(line.type)}
      </span>
      {/* Content */}
      <span className="flex-1 whitespace-pre-wrap break-all pl-1">
        {line.content === "..." ? (
          <span className="opacity-40 italic">... context omitted ...</span>
        ) : (
          line.content
        )}
      </span>
    </div>
  );
}

function FileDiffPanel({ diff, path, isDeterministic, warnings }: {
  diff: FileDiff | null;
  path: string;
  isDeterministic: boolean;
  warnings: string[];
}) {
  if (!diff) {
    return (
      <div className="rounded-md border border-neutral-700 bg-neutral-900 p-4 text-sm text-neutral-500">
        Diff not available — the job may still be generating or diffs were not captured.
      </div>
    );
  }

  if (!diff.has_changes) {
    return (
      <div className="rounded-md border border-neutral-700 bg-neutral-900 p-4 text-sm text-neutral-500">
        No changes detected for <code className="text-neutral-300">{path}</code>.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Diff header */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs text-neutral-500">
          {diff.before_lines} → {diff.after_lines} lines
        </span>
        <span className="text-xs font-medium text-green-400">
          +{diff.additions}
        </span>
        <span className="text-xs font-medium text-red-400">
          −{diff.removals}
        </span>
        {isDeterministic ? (
          <span className="text-[10px] font-semibold bg-blue-900/50 border border-blue-700 text-blue-300 px-1.5 py-0.5 rounded">
            Auto · deterministic
          </span>
        ) : (
          <span className="text-[10px] font-semibold bg-purple-900/50 border border-purple-700 text-purple-300 px-1.5 py-0.5 rounded">
            AI-assisted
          </span>
        )}
      </div>

      {/* Validation warnings */}
      {warnings.length > 0 && (
        <div className="rounded border border-yellow-700/50 bg-yellow-950/30 px-3 py-2">
          <p className="text-xs font-medium text-yellow-400 mb-1">Validation warnings</p>
          <ul className="list-disc list-inside space-y-0.5">
            {warnings.map((w, i) => (
              <li key={i} className="text-xs text-yellow-300/80">{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Diff lines */}
      <div className="rounded-md border border-neutral-700 bg-neutral-950 overflow-auto max-h-[400px]">
        {diff.lines.map((line, idx) => (
          <DiffLineRow key={idx} line={line} />
        ))}
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function FixDiffViewer({ fileChanges, className = "" }: Props) {
  const [activeIdx, setActiveIdx] = useState(0);

  if (!fileChanges || fileChanges.length === 0) {
    return (
      <div className={`rounded-lg border border-neutral-700 bg-neutral-900 p-6 text-center text-sm text-neutral-500 ${className}`}>
        No file changes to preview.
      </div>
    );
  }

  const active = fileChanges[activeIdx];

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {/* File tabs */}
      <div className="flex flex-wrap gap-1.5" role="tablist">
        {fileChanges.map((fc, idx) => {
          const isActive = idx === activeIdx;
          const hasDiff = fc.diff?.has_changes;
          return (
            <button
              key={idx}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveIdx(idx)}
              className={[
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono transition-colors",
                isActive
                  ? "bg-neutral-700 text-white border border-neutral-500"
                  : "bg-neutral-800/60 text-neutral-400 border border-neutral-700 hover:bg-neutral-700/60 hover:text-neutral-200",
              ].join(" ")}
            >
              {/* Operation badge */}
              <span
                className={[
                  "text-[10px] font-semibold rounded px-0.5",
                  fc.operation === "create" ? "text-green-400" : "text-sky-400",
                ].join(" ")}
              >
                {fc.operation === "create" ? "NEW" : "MOD"}
              </span>
              {/* Filename */}
              <span className="max-w-[180px] truncate">{fc.path}</span>
              {/* Diff stats */}
              {hasDiff && (
                <span className="text-[10px] text-green-400">+{fc.diff!.additions}</span>
              )}
              {hasDiff && fc.diff!.removals > 0 && (
                <span className="text-[10px] text-red-400">−{fc.diff!.removals}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Active file diff */}
      <div role="tabpanel">
        <p className="text-xs text-neutral-500 font-mono mb-2">
          {active.path}
        </p>
        <FileDiffPanel
          diff={active.diff}
          path={active.path}
          isDeterministic={active.is_deterministic}
          warnings={active.validation_warnings}
        />
      </div>
    </div>
  );
}

export default FixDiffViewer;
