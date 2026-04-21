/**
 * MainGrid — Forensic 3-panel layout shell.
 *
 * Columns:
 *   left   — 336px fixed (commit graph / history layer)
 *   center — fill       (WebGL graph / analysis surface)
 *   right  — 336px fixed (inspector / metadata)
 *
 * Vertical:
 *   topBar   — 64px  fixed
 *   main     —       fill
 *   timeline — 96px  fixed
 *
 * Breakpoints (controlled, never fluid):
 *   1440px — primary
 *   1280px — compressed (center narrowed; side panels stay fixed)
 *   ≤1024px — stacked (column layout; graph moves to top)
 *
 * Every slot is optional. Omitting a slot collapses its space.
 *
 * Implementation contract (§8):
 *   This component is layout-only. No data. No state. No motion.
 *   Motion is composed at the leaf level via scanMotion.ts.
 */

import React from 'react';

export interface MainGridProps {
  /** 64px fixed top bar — scan ID, branch selector, mode toggle, controls */
  topBar?: React.ReactNode;
  /** 336px fixed left panel — commit graph / history */
  left?: React.ReactNode;
  /** Fill center panel — WebGL graph or primary analysis surface */
  center: React.ReactNode;
  /** 336px fixed right panel — inspector / metadata */
  right?: React.ReactNode;
  /** 96px fixed bottom bar — timeline scrubber */
  timeline?: React.ReactNode;
  className?: string;

  /**
   * Stage-primary layout mode (fl-shell--stage).
   * Desktop: stageRail (80px left spine) + graph over stagePanel.
   * Mobile: stageRail and stagePanel hidden; falls back to stacked layout.
   */
  stageMode?: boolean;
  /** Narrow left stage timeline rail — rendered at desktop only in stageMode */
  stageRail?: React.ReactNode;
  /** Contextual evidence panel below graph — rendered at desktop only in stageMode */
  stagePanel?: React.ReactNode;
}

export function MainGrid({
  topBar,
  left,
  center,
  right,
  timeline,
  className = '',
  stageMode = false,
  stageRail,
  stagePanel,
}: MainGridProps) {
  const shellClass = ['fl-shell', stageMode ? 'fl-shell--stage' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={shellClass}>
      {topBar != null && (
        <header className="fl-topbar" role="banner">
          {topBar}
        </header>
      )}

      <div className="fl-main-grid" role="main">
        {/* Stage rail — desktop only in stageMode; CSS hides on mobile */}
        {stageMode && stageRail != null && stageRail}

        {/* Commit graph — mobile fallback; CSS hides on desktop in stageMode */}
        {left != null && (
          <aside className="fl-panel fl-panel--commit" aria-label="Commit history">
            {left}
          </aside>
        )}

        {stageMode ? (
          /* Stage content: graph (flex:1) stacked over deepview (220px) */
          <div className="fl-stage-content">
            <section className="fl-stage-graph fl-panel fl-panel--graph" aria-label="Graph">
              {center}
            </section>
            {stagePanel != null && stagePanel}
          </div>
        ) : (
          <section className="fl-panel fl-panel--graph" aria-label="Graph">
            {center}
          </section>
        )}

        {/* Inspector — mobile fallback; CSS hides on desktop in stageMode */}
        {right != null && (
          <aside className="fl-panel fl-panel--inspector" aria-label="Inspector">
            {right}
          </aside>
        )}
      </div>

      {timeline != null && (
        <footer className="fl-timeline" role="contentinfo" aria-label="Timeline">
          {timeline}
        </footer>
      )}
    </div>
  );
}

export default MainGrid;
