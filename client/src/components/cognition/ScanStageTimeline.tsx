/**
 * ScanStageTimeline — Vertical stage spine for the scan view.
 *
 * 7 canonical stages that map the scan pipeline to readable steps.
 * Desktop: renders as a narrow vertical rail (80px).
 * Mobile: hidden — stacked CommitGraph layout handles it.
 *
 * Stage dots:
 *   done    → green fill (completed)
 *   active  → cyan glow (in-progress)
 *   pending → dim (not reached)
 */

import React from 'react';

// ── Canonical stages ──────────────────────────────────────────────────────────

export const SCAN_STAGES = [
  { key: 'resolve', label: 'resolve' },
  { key: 'fetch', label: 'fetch' },
  { key: 'extract', label: 'extract' },
  { key: 'schema', label: 'schema' },
  { key: 'trust', label: 'trust' },
  { key: 'conflict', label: 'conflict' },
  { key: 'score', label: 'score' },
] as const;

export type ScanStage = (typeof SCAN_STAGES)[number]['key'];

// ── Pipeline step → canonical stage mapping ───────────────────────────────────

export function pipelineStepToStage(step: string): ScanStage {
  switch (step) {
    case 'dns':
      return 'resolve';
    case 'crawl':
      return 'fetch';
    case 'extract':
    case 'ai1':
    case 'ai2':
    case 'ai3':
      return 'extract';
    case 'schema':
      return 'schema';
    case 'technical':
    case 'security':
      return 'trust';
    case 'compile':
    case 'finalize':
    case 'complete':
      return 'score';
    default:
      return 'resolve';
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface ScanStageTimelineProps {
  /** Current pipeline step key (from AnalyzePage progress, e.g. 'dns', 'schema') */
  currentStep: string;
  /** True once the scan has completed successfully */
  complete: boolean;
  /** Optional live percent from SSE progress */
  progressPercent?: number;
  /** User's actively selected stage (for StageDeepView display) */
  selectedStage: ScanStage;
  onStageSelect: (stage: ScanStage) => void;
}

export default function ScanStageTimeline({
  currentStep,
  complete,
  progressPercent,
  selectedStage,
  onStageSelect,
}: ScanStageTimelineProps) {
  const activeStage = pipelineStepToStage(currentStep);
  const activeIndex = SCAN_STAGES.findIndex((s) => s.key === activeStage);
  const safePct = Math.max(0, Math.min(100, Math.round(progressPercent ?? 0)));

  return (
    <nav className="fl-stage-rail" role="navigation" aria-label="Scan pipeline stages">
      <div className="fl-stage-progress" aria-live="polite">
        <div className="fl-stage-progress__label">live</div>
        <div className="fl-stage-progress__value">{safePct}%</div>
      </div>
      {SCAN_STAGES.map((stage, i) => {
        const isDone = complete || i < activeIndex;
        const isActive = !complete && stage.key === activeStage;
        const isSelected = stage.key === selectedStage;

        const dotClass = isDone
          ? 'fl-stage-dot fl-stage-dot--done'
          : isActive
            ? 'fl-stage-dot fl-stage-dot--active'
            : 'fl-stage-dot fl-stage-dot--pending';

        const labelClass = isActive
          ? 'fl-stage-label fl-stage-label--active'
          : isDone
            ? 'fl-stage-label fl-stage-label--done'
            : 'fl-stage-label fl-stage-label--pending';

        return (
          <button
            key={stage.key}
            className={`fl-stage-node${isSelected ? ' fl-stage-node--selected' : ''}`}
            onClick={() => onStageSelect(stage.key)}
            aria-label={`Stage: ${stage.label}${isActive ? ' (active)' : isDone ? ' (done)' : ''}`}
            aria-current={isActive ? 'step' : undefined}
          >
            <span className={dotClass} aria-hidden="true" />
            <span className={labelClass}>{stage.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
