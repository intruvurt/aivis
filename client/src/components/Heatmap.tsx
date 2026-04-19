/**
 * HEATMAP COMPONENT - Score visualization via cite resolution
 *
 * The score is not a number anymore. It's a compressed cite graph.
 * Click each layer to expand and see backing evidence.
 */

import React, { useState } from 'react';
import { useCiteLedgerStore } from '../store/citeLedgerStore';
import { CiteChain } from './CiteChain';
import '../styles/Heatmap.css';

/**
 * Individual layer component
 */
const Layer: React.FC<{
  label: string;
  score: number;
  refs: string[];
  icon?: string;
}> = ({ label, score, refs, icon = '•' }) => {
  const [expanded, setExpanded] = useState(false);
  const scorePercent = Math.round(score * 100) / 100;

  // Hard constraint: no refs → no evidence for this layer
  const hasEvidence = refs && refs.length > 0;

  return (
    <div className="heatmap-layer">
      <div
        className={`heatmap-layer__header ${!hasEvidence ? 'heatmap-layer__header--no-evidence' : ''}`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="heatmap-layer__toggle">{hasEvidence ? (expanded ? '▼' : '▶') : '—'}</div>

        <div className="heatmap-layer__label" title={label}>
          {icon} {label}
        </div>

        <div className="heatmap-layer__score">
          <span className={`heatmap-layer__number ${getScoreClass(scorePercent)}`}>
            {scorePercent}
          </span>
          <span className="heatmap-layer__percent">%</span>
        </div>

        {hasEvidence && (
          <div className="heatmap-layer__cite-count">
            {refs.length} cite{refs.length !== 1 ? 's' : ''}
          </div>
        )}

        {!hasEvidence && <div className="heatmap-layer__no-evidence">No evidence</div>}
      </div>

      {expanded && hasEvidence && (
        <div className="heatmap-layer__expanded">
          <CiteChain refs={refs} compact={true} label={`${label} Evidence Chain`} />
        </div>
      )}

      {expanded && !hasEvidence && (
        <div className="heatmap-layer__empty">No cite references for this layer</div>
      )}
    </div>
  );
};

/**
 * HEATMAP - Three-layer score visualization
 *
 * Each layer is collapsible to show underlying cite evidence.
 * Principle: Every visible score has backing evidence beneath it.
 */
export const Heatmap: React.FC = () => {
  const scoreRefs = useCiteLedgerStore((s) => s.scoreRefs);
  const scores = useCiteLedgerStore((s) => s.scoresComputed);
  const allCites = useCiteLedgerStore((s) => Object.values(s.cites));
  const [expandAll, setExpandAll] = useState(false);

  const hasAnyCites = allCites.length > 0;

  const heatmapPercentage = Math.round((scores.visibility || 0) * 100) / 100;

  return (
    <div className="heatmap">
      <div className="heatmap__header">
        <div className="heatmap__title">
          <h2>Visibility Score</h2>
          <div className={`heatmap__main-score ${getScoreClass(heatmapPercentage)}`}>
            {heatmapPercentage}%
          </div>
        </div>

        <div className="heatmap__actions">
          <button
            className=" heatmap__btn heatmap__btn--expand"
            onClick={() => setExpandAll(!expandAll)}
            disabled={!hasAnyCites}
          >
            {expandAll ? 'Collapse' : 'Expand'} All Evidence
          </button>
        </div>
      </div>

      {!hasAnyCites && (
        <div className="heatmap__empty">
          No cite data yet. Run an audit to populate evidence layers.
        </div>
      )}

      {hasAnyCites && (
        <div className="heatmap__layers">
          <Layer
            label="Crawl Analysis"
            score={scores.crawl || 0}
            refs={scoreRefs.crawl}
            icon="🕷️"
          />
          <Layer
            label="Semantic Extraction"
            score={scores.semantic || 0}
            refs={scoreRefs.semantic}
            icon="📚"
          />
          <Layer
            label="Authority & Trust"
            score={scores.authority || 0}
            refs={scoreRefs.authority}
            icon="🏆"
          />
        </div>
      )}

      <div className="heatmap__footer">
        <div className="heatmap__stats">
          <span>{allCites.length} total cites</span>
          <span>
            {scoreRefs.crawl.length + scoreRefs.semantic.length + scoreRefs.authority.length} cite
            references
          </span>
          {allCites.length > 0 && (
            <span>
              {Math.round(
                (allCites.reduce((s, c) => s + c.confidence_score, 0) / allCites.length) * 100
              )}
              % avg confidence
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Helper to get CSS class for score color
 */
function getScoreClass(score: number): string {
  if (score >= 80) return 'score--excellent';
  if (score >= 60) return 'score--good';
  if (score >= 40) return 'score--fair';
  if (score >= 20) return 'score--poor';
  return 'score--critical';
}

export default Heatmap;
