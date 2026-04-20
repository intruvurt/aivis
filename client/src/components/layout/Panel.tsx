/**
 * Panel — Forensic layout panel atom.
 *
 * Enforces per-variant width/overflow constraints from the grid spec.
 * Compose this inside MainGrid or standalone for partial layouts.
 *
 * Component constraints (§12):
 *   commit    — min 280px, max 336px, overflow: scroll-y
 *   graph     — min 0 (fill),  max none, overflow: hidden
 *   inspector — min 280px, max 336px, overflow: scroll-y
 *   generic   — no sizing enforcement, display: flex column
 *
 * Rule (§8): This component carries no data, state, or motion.
 * Declare motion at the leaf via SCAN_MOTION from scanMotion.ts.
 */

import React from 'react';

export type PanelVariant = 'commit' | 'graph' | 'inspector' | 'generic';

/** Maps each variant to its CSS class combination. */
const VARIANT_CLASS: Record<PanelVariant, string> = {
  commit: 'fl-panel fl-panel--commit',
  graph: 'fl-panel fl-panel--graph',
  inspector: 'fl-panel fl-panel--inspector',
  generic: 'fl-panel',
};

export interface PanelProps {
  variant?: PanelVariant;
  children: React.ReactNode;
  className?: string;
  /** Accessible label for the panel region */
  label?: string;
  /** Override the rendered element (default: div) */
  as?: React.ElementType;
}

export function Panel({
  variant = 'generic',
  children,
  className = '',
  label,
  as: Tag = 'div',
}: PanelProps) {
  const cls = [VARIANT_CLASS[variant], className].filter(Boolean).join(' ');

  return (
    <Tag className={cls} aria-label={label}>
      {children}
    </Tag>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────────────
 * These small composable pieces enforce the §8 inspector typography grid
 * and §6 commit-graph node constraints without pulling in external deps.
 * ─────────────────────────────────────────────────────────────────────────── */

/** Inspector header — 72px fixed height, holds title + hash */
export function InspectorHeader({ children }: { children: React.ReactNode }) {
  return <div className="fl-inspector__header">{children}</div>;
}

/** Inspector primary title — 16px / 24px, truncates */
export function InspectorTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="fl-inspector__title">{children}</h2>;
}

/** Auto-height metadata block, ~120px, secondary text */
export function MetadataBlock({ children }: { children: React.ReactNode }) {
  return <div className="fl-inspector__meta-block">{children}</div>;
}

/** 1px horizontal rule between inspector sections */
export function InspectorDivider() {
  return <hr className="fl-inspector__divider" aria-hidden="true" />;
}

/** Diff line — variant controls color (add / del / meta) */
interface DiffLineProps {
  variant?: 'add' | 'del' | 'meta';
  children: React.ReactNode;
}
export function DiffLine({ variant = 'meta', children }: DiffLineProps) {
  return <div className={`fl-diff-line fl-diff-line--${variant}`}>{children}</div>;
}

/** Commit row — set active to apply larger node + bold label */
interface CommitRowProps {
  active?: boolean;
  label: string;
  children?: React.ReactNode;
  onClick?: () => void;
}
export function CommitRow({ active = false, label, children, onClick }: CommitRowProps) {
  return (
    // §13: button semantics for keyboard nav; no layout shift on hover
    <button
      type="button"
      className={`fl-commit-row${active ? ' fl-commit-row--active' : ''}`}
      onClick={onClick}
      aria-pressed={active}
    >
      <span className="fl-commit-dot" aria-hidden="true" />
      <span className="fl-commit-label" title={label}>
        {label}
      </span>
      {children}
    </button>
  );
}

export default Panel;
