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
}

export function MainGrid({ topBar, left, center, right, timeline, className = '' }: MainGridProps) {
  return (
    <div className={`fl-shell${className ? ` ${className}` : ''}`}>
      {topBar != null && (
        <header className="fl-topbar" role="banner">
          {topBar}
        </header>
      )}

      <div className="fl-main-grid" role="main">
        {left != null && (
          <aside className="fl-panel fl-panel--commit" aria-label="Commit history">
            {left}
          </aside>
        )}

        <section className="fl-panel fl-panel--graph" aria-label="Graph">
          {center}
        </section>

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
