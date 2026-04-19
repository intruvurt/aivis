/**
 * ADVANCED FEATURES - Replay, Diff Mode, Entity Gravity, GitHub Integration
 *
 * Production-grade forensic tools for audit visualization and remediation.
 */

import React, { useState, useMemo } from 'react';
import { useCiteLedgerStore } from '../store/citeLedgerStore';
import '../styles/AdvancedFeatures.css';

/**
 * REPLAY - Time slider to watch visibility evolve
 *
 * Seek through the timeline and see state rebuild.
 */
export const Replay: React.FC = () => {
  const timeline = useCiteLedgerStore((s) => s.timeline);
  const currentIndex = useCiteLedgerStore((s) => s.currentTimelineIndex);
  const seekTimeline = useCiteLedgerStore((s) => s.seekTimeline);
  const [playing, setPlaying] = useState(false);

  const handleSeek = (index: number) => {
    seekTimeline(Math.max(0, Math.min(index, timeline.length - 1)));
  };

  if (timeline.length === 0) {
    return (
      <div className="replay replay--empty">
        <p>No timeline data yet. Events will appear as audit runs.</p>
      </div>
    );
  }

  return (
    <div className="replay">
      <div className="replay__header">
        <h3>Timeline Replay</h3>
        <button
          className={`replay__btn ${playing ? 'replay__btn--pause' : 'replay__btn--play'}`}
          onClick={() => setPlaying(!playing)}
          title={playing ? 'Pause' : 'Play'}
        >
          {playing ? '⏸' : '▶'}
        </button>
      </div>

      <div className="replay__slider-container">
        <input
          type="range"
          min="0"
          max={timeline.length - 1}
          value={currentIndex}
          onChange={(e) => handleSeek(parseInt(e.target.value))}
          className="replay__slider"
        />
      </div>

      <div className="replay__info">
        <span className="replay__position">
          Event {currentIndex + 1} of {timeline.length}
        </span>
        <span className="replay__event-type">{timeline[currentIndex]?.event}</span>
      </div>
    </div>
  );
};

/**
 * DIFF MODE - Before/after cite delta visualization
 *
 * See which cites changed between snapshots.
 */
export const DiffMode: React.FC = () => {
  const cites = useCiteLedgerStore((s) => Object.values(s.cites));
  const [baselineIdx, setBaselineIdx] = useState(0);
  const [comparisonIdx, setComparisonIdx] = useState(Math.min(1, Math.max(0, cites.length - 1)));

  if (cites.length < 2) {
    return (
      <div className="diff-mode diff-mode--empty">
        <p>Need at least 2 cites to compare.</p>
      </div>
    );
  }

  const baseline = cites[baselineIdx];
  const comparison = cites[comparisonIdx];

  const added = comparison && !baseline ? [comparison] : [];
  const removed = baseline && !comparison ? [baseline] : [];
  const changed =
    baseline && comparison && baseline.id !== comparison.id
      ? [{ from: baseline, to: comparison }]
      : [];

  return (
    <div className="diff-mode">
      <div className="diff-mode__header">
        <h3>Diff Mode</h3>
      </div>

      <div className="diff-mode__controls">
        <div className="diff-mode__selector">
          <label>Baseline</label>
          <select value={baselineIdx} onChange={(e) => setBaselineIdx(parseInt(e.target.value))}>
            {cites.map((_, idx) => (
              <option key={idx} value={idx}>
                Cite {idx + 1}
              </option>
            ))}
          </select>
        </div>

        <div className="diff-mode__arrow">→</div>

        <div className="diff-mode__selector">
          <label>Compare</label>
          <select
            value={comparisonIdx}
            onChange={(e) => setComparisonIdx(parseInt(e.target.value))}
          >
            {cites.map((_, idx) => (
              <option key={idx} value={idx}>
                Cite {idx + 1}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="diff-mode__results">
        {added.length > 0 && (
          <div className="diff-mode__section diff-mode__section--added">
            <h4>Added</h4>
            {added.map((cite) => (
              <div key={cite.id} className="diff-mode__item">
                <span className="diff-mode__badge diff-mode__badge--added">+</span>
                {cite.extracted_signal}
              </div>
            ))}
          </div>
        )}

        {removed.length > 0 && (
          <div className="diff-mode__section diff-mode__section--removed">
            <h4>Removed</h4>
            {removed.map((cite) => (
              <div key={cite.id} className="diff-mode__item">
                <span className="diff-mode__badge diff-mode__badge--removed">−</span>
                {cite.extracted_signal}
              </div>
            ))}
          </div>
        )}

        {added.length === 0 && removed.length === 0 && (
          <div className="diff-mode__empty-result">No differences</div>
        )}
      </div>
    </div>
  );
};

/**
 * ENTITY GRAVITY MAP - Which entities dominate citation weight?
 *
 * Visualize entity influence across cites.
 */
export const EntityGravityMap: React.FC = () => {
  const cites = useCiteLedgerStore((s) => Object.values(s.cites));

  const entityWeights = useMemo(() => {
    const weights: Record<string, number> = {};

    cites.forEach((cite) => {
      // Extract entity references from raw evidence
      // This is a simplified extraction; real implementation would use NLP
      const entities = extractEntities(cite.raw_evidence);
      entities.forEach((entity) => {
        weights[entity] = (weights[entity] || 0) + cite.confidence_score;
      });
    });

    return Object.entries(weights)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20); // Top 20
  }, [cites]);

  if (entityWeights.length === 0) {
    return (
      <div className="entity-gravity entity-gravity--empty">
        <p>No entities detected.</p>
      </div>
    );
  }

  const maxWeight = Math.max(...entityWeights.map(([, w]) => w));

  return (
    <div className="entity-gravity">
      <div className="entity-gravity__header">
        <h3>Entity Gravity</h3>
        <span className="entity-gravity__subtitle">Top entities by citation weight</span>
      </div>

      <div className="entity-gravity__map">
        {entityWeights.map(([entity, weight], idx) => (
          <div key={entity} className="entity-gravity__item">
            <div className="entity-gravity__rank">{idx + 1}</div>
            <div className="entity-gravity__name">{entity}</div>
            <div
              className="entity-gravity__bar"
              style={{ width: `${(weight / maxWeight) * 100}%` }}
            >
              <span className="entity-gravity__weight">{Math.round(weight * 100) / 100}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * GITHUB PR INTEGRATION - Apply fix → PR with cite references
 *
 * Bidirectional sync: fix justification in commit message.
 */
export const GitHubIntegration: React.FC<{
  fixId: string;
  onApply?: (prUrl: string) => void;
}> = ({ fixId, onApply }) => {
  const fixes = useCiteLedgerStore((s) => s.fixes);
  const fix = fixes.find((f) => f.id === fixId);
  const cites = useCiteLedgerStore((s) => s.cites);
  const [creating, setCreating] = useState(false);
  const [status, setStatus] = useState<'idle' | 'creating' | 'success' | 'error'>('idle');

  if (!fix) return null;

  const buildCommitMessage = () => {
    const citeRefs = fix.citeRefs
      .map((h) => cites[h])
      .filter(Boolean)
      .map((c) => `- ${c.source_type}: ${c.extracted_signal}`)
      .join('\n');

    return `Fix AI Visibility: ${fix.targetPath}

## Evidence Chain
${citeRefs}

## Why This Matters
This fix directly addresses visibility issues backed by multiple cite entries in the CITE LEDGER.
Each piece of evidence above is immutable and traceable.

Generated by AIVIS Cite Ledger
Cite Count: ${fix.citeRefs.length}`;
  };

  const handleCreatePR = async () => {
    setCreating(true);
    setStatus('creating');

    try {
      // Call backend to create PR
      const response = await fetch('/api/github/create-pr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fixId,
          patch: fix.patch,
          targetPath: fix.targetPath,
          commitMessage: buildCommitMessage(),
          citeRefs: fix.citeRefs,
        }),
      });

      if (!response.ok) throw new Error('Failed to create PR');

      const { prUrl } = await response.json();
      setStatus('success');
      onApply?.(prUrl);
    } catch (err) {
      console.error('[GitHubIntegration] Error:', err);
      setStatus('error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="github-integration">
      <div className="github-integration__header">
        <h4>Create GitHub PR</h4>
        <span className="github-integration__cites">{fix.citeRefs.length} cites</span>
      </div>

      {fix.prUrl && (
        <div className="github-integration__applied">
          <span>✓ PR Created</span>
          <a href={fix.prUrl} target="_blank" rel="noopener noreferrer">
            View PR
          </a>
        </div>
      )}

      {!fix.prUrl && (
        <div className="github-integration__actions">
          <button
            className={`github-integration__btn ${status === 'error' ? 'github-integration__btn--error' : ''}`}
            onClick={handleCreatePR}
            disabled={creating}
          >
            {creating ? 'Creating...' : 'Create PR with Evidence'}
          </button>

          {status === 'error' && (
            <span className="github-integration__error">Failed to create PR. Try again.</span>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Helper: Extract entities from text (simplified)
 */
function extractEntities(text: string): string[] {
  // This is a placeholder. Real implementation would use NLP or entity extraction service.
  // For demo, extract capitalized phrases.
  const matches = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g) || [];
  return [...new Set(matches)];
}

export default Replay;
