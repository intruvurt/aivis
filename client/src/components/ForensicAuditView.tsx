/**
 * FORENSIC AUDIT VIEW - Ledger-first interface
 *
 * Orchestrates all cite ledger components into a production UI.
 * Everything flows upward from cites → scores → issues → fixes.
 */

import React, { useEffect } from 'react';
import { useCiteLedgerStore } from '../store/citeLedgerStore';
import useCiteLedgerStream from '../hooks/useCiteLedgerStream';
import { CiteChain, CiteLegend } from './CiteChain';
import { Heatmap } from './Heatmap';
import { IssuePanel, FixPanel } from './IssueFixPanels';
import { CiteStream } from './CiteStream';
import { Replay, DiffMode, EntityGravityMap, GitHubIntegration } from './AdvancedFeatures';
import '../styles/ForensicAuditView.css';

interface ForensicAuditViewProps {
  auditId: string;
  url: string;
}

/**
 * FORENSIC AUDIT VIEW
 *
 * Main interface for cite-ledger driven audit visualization.
 * Principle: Everything is cite-backed, everything is traceable.
 */
export const ForensicAuditView: React.FC<ForensicAuditViewProps> = ({ auditId, url }) => {
  const setAuditMetadata = useCiteLedgerStore((s) => s.setAuditMetadata);
  const reset = useCiteLedgerStore((s) => s.reset);
  const { isConnected } = useCiteLedgerStream(auditId);
  const citeCount = useCiteLedgerStore((s) => Object.keys(s.cites).length);
  const issueCount = useCiteLedgerStore((s) => s.issues.length);
  const fixCount = useCiteLedgerStore((s) => s.fixes.length);
  const streaming = useCiteLedgerStore((s) => s.streaming);

  // Initialize audit metadata
  useEffect(() => {
    reset();
    setAuditMetadata(auditId, url);
  }, [auditId, url]);

  return (
    <div className="forensic-audit-view">
      {/* HEADER */}
      <div className="forensic-audit-view__header">
        <div className="forensic-audit-view__title">
          <h1>AI Visibility Forensic Audit</h1>
          <div className="forensic-audit-view__url">{url}</div>
        </div>

        <div className="forensic-audit-view__status">
          <div className={`forensic-audit-view__indicator ${streaming ? 'streaming' : 'idle'}`}>
            {streaming ? '◆ Streaming' : '○ Complete'}
          </div>

          <div className="forensic-audit-view__stats">
            <div className="stat">
              <span className="stat__label">Cites</span>
              <span className="stat__value">{citeCount}</span>
            </div>
            <div className="stat">
              <span className="stat__label">Issues</span>
              <span className="stat__value">{issueCount}</span>
            </div>
            <div className="stat">
              <span className="stat__label">Fixes</span>
              <span className="stat__value">{fixCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT - Grid layout */}
      <div className="forensic-audit-view__container">
        {/* LEFT PANEL - Score and visualization */}
        <div className="forensic-audit-view__left">
          <section className="section">
            <Heatmap />
          </section>

          <section className="section">
            <h2>Evidence Stream</h2>
            <CiteStream />
          </section>
        </div>

        {/* RIGHT PANEL - Issues, fixes, advanced features */}
        <div className="forensic-audit-view__right">
          <section className="section">
            <IssuePanel />
          </section>

          <section className="section">
            <FixPanel />
          </section>

          {/* Advanced Features - Tabs */}
          <div className="advanced-tabs">
            <AdvancedFeaturesTab />
          </div>
        </div>
      </div>

      {/* FOOTER - Diagnostics and cite legend */}
      <div className="forensic-audit-view__footer">
        <section className="section section--footer">
          <CiteLegend />
        </section>
      </div>
    </div>
  );
};

/**
 * Advanced Features Tab Component
 */
const AdvancedFeaturesTab: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState<'replay' | 'diff' | 'gravity'>('replay');

  return (
    <div className="advanced-tabs">
      <div className="advanced-tabs__nav">
        <button
          className={`advanced-tabs__btn ${activeTab === 'replay' ? 'active' : ''}`}
          onClick={() => setActiveTab('replay')}
        >
          ⏱ Replay
        </button>
        <button
          className={`advanced-tabs__btn ${activeTab === 'diff' ? 'active' : ''}`}
          onClick={() => setActiveTab('diff')}
        >
          🔀 Diff Mode
        </button>
        <button
          className={`advanced-tabs__btn ${activeTab === 'gravity' ? 'active' : ''}`}
          onClick={() => setActiveTab('gravity')}
        >
          🌍 Entity Gravity
        </button>
      </div>

      <div className="advanced-tabs__content">
        {activeTab === 'replay' && <Replay />}
        {activeTab === 'diff' && <DiffMode />}
        {activeTab === 'gravity' && <EntityGravityMap />}
      </div>
    </div>
  );
};

export default ForensicAuditView;
