/**
 * Live Audit Narrative
 *
 * Replaces declarative homepage messaging with procedural audit storytelling.
 * Turns the homepage into a proof surface: the page itself is an active scan.
 *
 * Flow mirrors actual pipeline:
 * 01. Crawling surface (extraction) → Scan phase
 * 02. Entity resolution (deduplication) → Observe phase
 * 03. Citation readiness test (validation) → Verify phase
 * 04. Structural failure scan (anomaly detection) → Fix opportunities
 * 05. System interpretation (synthesis) → Final state
 */

import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface NarrativeStep {
  id: string;
  number: string;
  title: string;
  description: string;
  observation: string;
  findings?: string[];
  isExpanded: boolean;
}

export const LiveAuditNarrative: React.FC = () => {
  const [steps, setSteps] = useState<NarrativeStep[]>([
    {
      id: 'crawling',
      number: '01',
      title: 'Crawling surface',
      description:
        'The system extracts raw structure: headings, schema, metadata, and entity signals. Anything not machine-readable is already being discounted.',
      observation:
        'Observation: this site contains structured claims about AI visibility, but limited executable evidence blocks.',
      isExpanded: true,
    },
    {
      id: 'entity',
      number: '02',
      title: 'Entity resolution',
      description:
        'Entities are being mapped across schema, text, and metadata layers. "AiVIS", "CITE LEDGER", and "BRAG" are recognized as system-level constructs.',
      observation:
        'Risk: entity definition exists in schema, but behavioral examples are not fully grounded in visible UI flow.',
      isExpanded: false,
    },
    {
      id: 'citation',
      number: '03',
      title: 'Citation readiness test',
      description:
        'The system evaluates whether this page can be safely quoted by AI models without hallucination.',
      observation:
        'Result: partial readiness. Schema signals are strong. Narrative proof is thin in operational sections.',
      isExpanded: false,
    },
    {
      id: 'failure',
      number: '04',
      title: 'Structural failure scan',
      description: 'Detecting inconsistencies between machine layer and human layer.',
      findings: [
        'Duplicate schema graphs detected (WebPage + HowTo overlap)',
        'High metadata density vs low executable examples',
        'Definition-heavy content with limited audit simulation traces',
      ],
      observation: '',
      isExpanded: false,
    },
    {
      id: 'interpretation',
      number: '05',
      title: 'System interpretation',
      description:
        'AI models will likely understand what this product is. They may not yet fully trust how it behaves under real crawling conditions.',
      observation: 'Translation: comprehension is high. Verification confidence is medium.',
      isExpanded: false,
    },
  ]);

  const toggleStep = (id: string) => {
    setSteps((prev) =>
      prev.map((step) => (step.id === id ? { ...step, isExpanded: !step.isExpanded } : step))
    );
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Header */}
      <header className="mb-8 pb-4 border-b border-white/10">
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 tracking-tight">
          AI visibility audit in progress
        </h1>
        <p className="text-sm text-white/60">
          This page is being interpreted the way an AI answer engine would read it: structurally,
          semantically, and with loss detection enabled.
        </p>
      </header>

      {/* Steps */}
      <div className="space-y-3 mb-8">
        {steps.map((step) => (
          <div
            key={step.id}
            className="border border-white/10 rounded-lg bg-white/[0.02] overflow-hidden transition-all hover:border-white/20"
          >
            {/* Step Header */}
            <button
              onClick={() => toggleStep(step.id)}
              className="w-full px-4 py-3 flex items-start justify-between gap-3 hover:bg-white/[0.03] transition-colors text-left"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-cyan-400/70 font-semibold">
                    Step {step.number}
                  </span>
                  <h3 className="text-sm font-semibold text-white">{step.title}</h3>
                </div>
                <p className="text-xs text-white/50 leading-relaxed">{step.description}</p>
              </div>
              <div className="flex-shrink-0 pt-1">
                {step.isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-white/40" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-white/40" />
                )}
              </div>
            </button>

            {/* Step Content (Expanded) */}
            {step.isExpanded && (
              <div className="px-4 py-3 border-t border-white/5 bg-white/[0.01] space-y-2 text-xs">
                {/* Findings List */}
                {step.findings && step.findings.length > 0 && (
                  <ul className="space-y-1.5 text-white/60 pl-4">
                    {step.findings.map((finding, idx) => (
                      <li key={idx} className="flex gap-2">
                        <AlertTriangle className="w-3 h-3 text-amber-400/60 flex-shrink-0 mt-0.5" />
                        <span>{finding}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Observation */}
                {step.observation && (
                  <div className="pt-1">
                    <p className="text-white/60">{step.observation}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* System State Summary */}
      <div className="border-t border-white/10 pt-6">
        <h2 className="text-sm font-semibold text-white mb-3">System state</h2>
        <p className="text-sm text-white/70 mb-2">
          AiVIS is interpretable by AI systems, but not yet fully stress-proven through visible
          execution traces.
        </p>
        <p className="text-sm text-white/50">
          <span className="text-white/70 font-medium">Recommendation:</span> expose one real audit
          run per page load to close the gap between claim and demonstration.
        </p>
      </div>

      {/* Call to action — unified with narrative */}
      <div className="mt-6 pt-4 border-t border-white/10">
        <p className="text-xs text-white/40 text-center">
          This page is demonstrating the system, not describing it.{' '}
          <a
            href="#hero-scanner"
            className="text-cyan-400/70 hover:text-cyan-400 transition-colors font-medium"
          >
            Run a live audit below.
          </a>
        </p>
      </div>
    </div>
  );
};
