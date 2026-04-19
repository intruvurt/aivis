/**
 * CITE CHAIN RESOLVER - Spine Component
 *
 * This is the core UI primitive. Everything reuses it.
 * Renders a chain of cite entries with full transparency.
 *
 * Principle: If it has cites, render them. If not, render nothing.
 */

import React, { useMemo } from 'react';
import {
  useCiteLedgerStore,
  selectAllCites,
  selectScoreConfidence,
} from '../store/citeLedgerStore';
import type { CiteEntry } from '@shared/types';
import '../styles/CiteChain.css';

interface CiteChainProps {
  refs: string[]; // cite hashes
  compact?: boolean; // compact vs expanded view
  onCiteClick?: (cite: CiteEntry) => void;
  label?: string;
}

/**
 * Individual cite node renderer
 */
const CiteNode: React.FC<{
  cite: CiteEntry;
  compact?: boolean;
  onCiteClick?: (cite: CiteEntry) => void;
}> = ({ cite, compact = false, onCiteClick }) => {
  const confidencePercent = Math.round(cite.confidence_score * 100);

  if (compact) {
    return (
      <div
        className="cite-node cite-node--compact"
        onClick={() => onCiteClick?.(cite)}
        title={cite.extracted_signal}
      >
        <span className="cite-node__source">{cite.source_type}</span>
        <span className="cite-node__signal">{cite.extracted_signal.substring(0, 50)}...</span>
        <span className={`cite-node__confidence confidence-${confidencePercent}`}>
          {confidencePercent}%
        </span>
      </div>
    );
  }

  return (
    <div className="cite-node" onClick={() => onCiteClick?.(cite)}>
      <div className="cite-node__header">
        <span className="cite-node__source">{cite.source_type}</span>
        <span className={`cite-node__confidence confidence-${confidencePercent}`}>
          {confidencePercent}% confidence
        </span>
        <span className="cite-node__timestamp">{new Date(cite.created_at).toLocaleString()}</span>
      </div>

      <div className="cite-node__body">
        <div className="cite-node__signal">
          <strong>Evidence:</strong> {cite.extracted_signal}
        </div>

        <div className="cite-node__raw">
          <strong>Raw:</strong>
          <pre>{cite.raw_evidence}</pre>
        </div>
      </div>

      <div className="cite-node__footer">
        <span className="cite-node__id">ID: {cite.id.substring(0, 8)}...</span>
        {cite.ledger_hash && (
          <span className="cite-node__hash" title={cite.ledger_hash}>
            Hash: {cite.ledger_hash.substring(0, 8)}...
          </span>
        )}
      </div>
    </div>
  );
};

/**
 * CITE CHAIN RESOLVER - Core component
 *
 * Hard constraint: if refs is empty or falsy, render nothing
 */
export const CiteChain: React.FC<CiteChainProps> = ({
  refs,
  compact = false,
  onCiteClick,
  label,
}) => {
  const cites = useCiteLedgerStore((s) => s.cites);

  // Hard constraint: no refs → no visibility
  if (!refs || refs.length === 0) {
    return null;
  }

  const citations = refs.map((h) => cites[h]).filter(Boolean) as CiteEntry[];

  // If refs exist but cites don't (shouldn't happen), show error
  if (citations.length === 0) {
    return (
      <div className="cite-chain cite-chain--error">
        <div className="cite-chain__error">
          Error: {refs.length} cite refs but no backing cites found
        </div>
      </div>
    );
  }

  const avgConfidence =
    citations.reduce((sum, c) => sum + c.confidence_score, 0) / citations.length;

  return (
    <div className="cite-chain">
      {label && (
        <div className="cite-chain__label">
          {label} ({citations.length} cites, {Math.round(avgConfidence * 100)}% avg confidence)
        </div>
      )}

      <div className={`cite-chain__container ${compact ? 'cite-chain__container--compact' : ''}`}>
        {citations.map((cite, idx) => (
          <div key={cite.id} className="cite-chain__item">
            {idx > 0 && <div className="cite-chain__separator">↓</div>}
            <CiteNode cite={cite} compact={compact} onCiteClick={onCiteClick} />
          </div>
        ))}
      </div>

      <div className="cite-chain__stats">
        <span>{citations.length} pieces of evidence</span>
        <span>{Math.round(avgConfidence * 100)}% average confidence</span>
        <span>{citations.filter((c) => c.confidence_score > 0.8).length} high-confidence</span>
      </div>
    </div>
  );
};

/**
 * CITE LEGEND - Show all cites in store (diagnostics)
 */
export const CiteLegend: React.FC = () => {
  const cites = useCiteLedgerStore((s) => s.cites);
  const allCites = useMemo(() => Object.values(cites), [cites]);
  const confidence = useCiteLedgerStore(selectScoreConfidence);

  if (allCites.length === 0) {
    return <div className="cite-legend cite-legend--empty">No cites in ledger yet</div>;
  }

  const bySource = allCites.reduce(
    (acc, c) => {
      if (!acc[c.source_type]) acc[c.source_type] = [];
      acc[c.source_type].push(c);
      return acc;
    },
    {} as Record<string, CiteEntry[]>
  );

  return (
    <div className="cite-legend">
      <div className="cite-legend__header">
        <h3>Cite Ledger Summary</h3>
        <span className="cite-legend__confidence">{confidence}% overall confidence</span>
      </div>

      <div className="cite-legend__sources">
        {Object.entries(bySource).map(([source, sourceCites]) => (
          <div key={source} className="cite-legend__source-group">
            <div className="cite-legend__source-header">
              {source} ({sourceCites.length})
            </div>
            <div className="cite-legend__source-items">
              {sourceCites.map((cite) => (
                <div key={cite.id} className="cite-legend__item">
                  <span className="cite-legend__signal">
                    {cite.extracted_signal.substring(0, 80)}...
                  </span>
                  <span className="cite-legend__confidence">
                    {Math.round(cite.confidence_score * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CiteChain;
