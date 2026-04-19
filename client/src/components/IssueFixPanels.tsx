/**
 * ISSUE & FIX PANELS - Evidence-backed components
 *
 * Issues and fixes are not visible unless they have cite backing.
 * Hard constraint enforced in store and UI.
 */

import React, { useState } from 'react';
import {
  useCiteLedgerStore,
  selectIssuesWithCites,
  selectFixesWithCites,
} from '../store/citeLedgerStore';
import { CiteChain } from './CiteChain';
import '../styles/IssueFixPanels.css';

/**
 * ISSUE PANEL - Cite-backed visibility issues
 *
 * No issue appears without evidence.
 */
export const IssuePanel: React.FC = () => {
  const issues = useCiteLedgerStore(selectIssuesWithCites);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (issues.length === 0) {
    return (
      <div className="issue-panel issue-panel--empty">
        <div className="issue-panel__empty-state">
          <h3>No Issues Found</h3>
          <p>All visibility checks passed. Site is well-optimized for AI discoverability.</p>
        </div>
      </div>
    );
  }

  // Group by severity
  const bySeverity = issues.reduce(
    (acc, issue) => {
      if (!acc[issue.severity]) acc[issue.severity] = [];
      acc[issue.severity].push(issue);
      return acc;
    },
    {} as Record<string, typeof issues>
  );

  return (
    <div className="issue-panel">
      <div className="issue-panel__header">
        <h2>Visibility Issues</h2>
        <span className="issue-panel__count">{issues.length} issues found</span>
      </div>

      <div className="issue-panel__severity-filter">
        {Object.entries(bySeverity).map(([severity, severityIssues]) => (
          <span key={severity} className={`issue-panel__severity-badge severity-${severity}`}>
            {severity} ({severityIssues.length})
          </span>
        ))}
      </div>

      <div className="issue-panel__issues">
        {Object.keys(bySeverity)
          .sort(
            (a, b) =>
              ['critical', 'high', 'medium', 'low'].indexOf(a) -
              ['critical', 'high', 'medium', 'low'].indexOf(b)
          )
          .map((severity) =>
            bySeverity[severity as any].map((issue) => (
              <div key={issue.id} className={`issue-item severity-${issue.severity}`}>
                <div
                  className="issue-item__header"
                  onClick={() => setExpandedId(expandedId === issue.id ? null : issue.id)}
                >
                  <div className="issue-item__severity-badge">
                    {issue.severity.charAt(0).toUpperCase()}
                  </div>

                  <div className="issue-item__content">
                    <div className="issue-item__fingerprint">{issue.fingerprint}</div>
                    <div className="issue-item__category">{issue.category}</div>
                  </div>

                  <div className="issue-item__cite-count">
                    {issue.citeRefs.length} cite{issue.citeRefs.length !== 1 ? 's' : ''}
                  </div>

                  <div className="issue-item__toggle">{expandedId === issue.id ? '▼' : '▶'}</div>
                </div>

                {expandedId === issue.id && (
                  <div className="issue-item__expanded">
                    <div className="issue-item__evidence">
                      <h4>Evidence</h4>
                      <CiteChain refs={issue.citeRefs} compact={true} label="Issue Evidence" />
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
      </div>
    </div>
  );
};

/**
 * FIX PANEL - Proof-bound actions
 *
 * No fix appears without evidence beneath it.
 */
export const FixPanel: React.FC<{
  onApplyFix?: (fixId: string) => Promise<void>;
}> = ({ onApplyFix }) => {
  const fixes = useCiteLedgerStore(selectFixesWithCites);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  if (fixes.length === 0) {
    return (
      <div className="fix-panel fix-panel--empty">
        <div className="fix-panel__empty-state">
          <h3>No Fixes Available</h3>
          <p>No actionable improvements were recommended.</p>
        </div>
      </div>
    );
  }

  const handleApplyFix = async (fixId: string) => {
    if (!onApplyFix) return;

    try {
      setApplyingId(fixId);
      await onApplyFix(fixId);
    } catch (err) {
      console.error('[FixPanel] Error applying fix:', err);
    } finally {
      setApplyingId(null);
    }
  };

  return (
    <div className="fix-panel">
      <div className="fix-panel__header">
        <h2>Recommended Fixes</h2>
        <span className="fix-panel__count">{fixes.length} fixes available</span>
      </div>

      <div className="fix-panel__fixes">
        {fixes.map((fix) => (
          <div key={fix.id} className="fix-item">
            <div
              className="fix-item__header"
              onClick={() => setExpandedId(expandedId === fix.id ? null : fix.id)}
            >
              <div className="fix-item__icon">🔧</div>

              <div className="fix-item__content">
                <div className="fix-item__target">{fix.targetPath || 'Recommended Patch'}</div>
                {fix.prUrl && (
                  <div className="fix-item__meta">
                    Applied:{' '}
                    <a href={fix.prUrl} target="_blank" rel="noopener noreferrer">
                      PR Link
                    </a>
                  </div>
                )}
              </div>

              <div className="fix-item__cite-count">
                {fix.citeRefs.length} cite{fix.citeRefs.length !== 1 ? 's' : ''}
              </div>

              <div className="fix-item__toggle">{expandedId === fix.id ? '▼' : '▶'}</div>
            </div>

            {expandedId === fix.id && (
              <div className="fix-item__expanded">
                <div className="fix-item__patch">
                  <h4>Recommended Change</h4>
                  <pre className="fix-item__code">{fix.patch}</pre>
                </div>

                <div className="fix-item__evidence">
                  <h4>Evidence Chain</h4>
                  <CiteChain refs={fix.citeRefs} compact={true} label="Why This Fix" />
                </div>

                {onApplyFix && !fix.prUrl && (
                  <div className="fix-item__actions">
                    <button
                      className="fix-item__btn fix-item__btn--primary"
                      onClick={() => handleApplyFix(fix.id)}
                      disabled={applyingId === fix.id}
                    >
                      {applyingId === fix.id ? 'Applying...' : 'Apply Fix (GitHub PR)'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default IssuePanel;
