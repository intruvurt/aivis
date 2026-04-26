import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  CheckCircle2,
  Database,
  Fingerprint,
  Hash,
  Link2,
  Lock,
  Network,
  Shield,
} from 'lucide-react';
import { usePageMeta } from '../../hooks/usePageMeta';
import PublicPageFrame from '../../components/PublicPageFrame';
import { BRAG_ACRONYM } from '@shared/types';
import { buildWebPageSchema, buildBreadcrumbSchema } from '../../lib/seoSchema';

export default function CiteLedgerPage() {
  const location = useLocation();
  const canonicalPath =
    location.pathname === '/cite-ledger' ? '/cite-ledger' : '/methodology/cite-ledger';

  usePageMeta({
    title: 'CITE LEDGER | Ownership and Data Model',
    description:
      'CITE LEDGER is the ownership layer for AiVIS visibility truth. This page defines data structures, append rules, failure behavior, and why no score exists without ledger evidence.',
    path: canonicalPath,
    structuredData: [
      buildWebPageSchema({
        name: 'CITE LEDGER | Ownership and Data Model',
        description:
          'Long-form technical ownership documentation for CITE LEDGER, the append-only evidence chain that anchors AiVIS outputs.',
        path: canonicalPath,
      }),
      buildBreadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'Methodology', path: '/methodology' },
        { name: 'CITE LEDGER', path: canonicalPath },
      ]),
    ],
  });

  return (
    <PublicPageFrame
      icon={Database}
      title="CITE LEDGER"
      subtitle="Ownership layer for visibility truth. If a claim is not ledger-backed, it is not part of the AiVIS system state."
      backTo="/methodology"
    >
      <section className="mb-10 rounded-2xl border border-cyan-300/20 bg-cyan-400/6 p-5">
        <p className="text-xs uppercase tracking-[0.18em] text-cyan-200/80 mb-3">
          Ownership statement
        </p>
        <p className="text-slate-100 leading-relaxed text-lg">
          CITE LEDGER is the system-of-record for AiVIS visibility truth. Every score movement,
          blocker, recommendation, and remediation trace must resolve to a ledger-backed evidence
          chain.
        </p>
        <p className="text-slate-300 leading-relaxed mt-3">
          AiVIS is not a dashboard of disconnected metrics. It is a visibility intelligence system
          where claims are only valid when they are linked to citation state or a corrective action
          path.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-bold text-white mb-4">Why CITE LEDGER exists</h2>
        <div className="space-y-4 text-slate-300 leading-relaxed">
          <p>
            Answer engines synthesize responses from multiple sources. Without a persistent
            attribution ledger, platform outputs drift into unverifiable summaries and confidence
            theater. CITE LEDGER prevents that failure mode by forcing deterministic evidence
            registration at the point of analysis.
          </p>
          <p>
            In AiVIS, a finding that does not have a ledger entry is treated as non-existent for
            scoring and remediation. This makes the engine auditable by design and ensures historic
            outputs remain reproducible.
          </p>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-bold text-white mb-6">Ledger write path</h2>
        <ol className="space-y-5">
          {[
            {
              icon: <Network className="w-5 h-5 text-cyan-300" />,
              title: 'Evidence emission',
              desc: `Pipeline stages emit findings with source metadata, candidate severity, and evidence keys. ${BRAG_ACRONYM} identity is generated from deterministic inputs only.`,
            },
            {
              icon: <Fingerprint className="w-5 h-5 text-violet-300" />,
              title: 'Canonical fingerprinting',
              desc: 'Finding payload is normalized into canonical JSON and hashed, producing a stable content fingerprint used for replay-safe deduplication and drift comparison.',
            },
            {
              icon: <Hash className="w-5 h-5 text-orange-300" />,
              title: 'Chain derivation',
              desc: 'Each entry computes chain_hash from previous_hash plus content_hash. Any historical mutation breaks chain continuity and is immediately detectable.',
            },
            {
              icon: <Lock className="w-5 h-5 text-emerald-300" />,
              title: 'Append commit',
              desc: 'Entry is appended with immutable sequence index, evidence references, and timestamp. Post-write mutation is prohibited by contract.',
            },
          ].map((step, index) => (
            <li key={step.title} className="rounded-xl border border-white/10 bg-white/4 p-4">
              <div className="flex items-center gap-2 text-white font-semibold">
                {step.icon}
                <span>
                  {index + 1}. {step.title}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-300 leading-relaxed">{step.desc}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-bold text-white mb-4">Core data model</h2>
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-sm text-left text-slate-300">
            <thead className="text-xs uppercase text-slate-500 border-b border-white/10 bg-black/20">
              <tr>
                <th className="py-3 px-4">Field</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Purpose</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              <tr>
                <td className="py-2 px-4 font-mono text-cyan-300">scan_id</td>
                <td className="py-2 px-4">string</td>
                <td className="py-2 px-4">
                  Trace root for all evidence, scores, and remediation outputs for one analysis run.
                </td>
              </tr>
              <tr>
                <td className="py-2 px-4 font-mono text-cyan-300">sequence</td>
                <td className="py-2 px-4">number</td>
                <td className="py-2 px-4">
                  Monotonic append index used for deterministic replay and ordering.
                </td>
              </tr>
              <tr>
                <td className="py-2 px-4 font-mono text-cyan-300">brag_id</td>
                <td className="py-2 px-4">string</td>
                <td className="py-2 px-4">
                  Deterministic finding identifier that links diagnostic and remediation layers.
                </td>
              </tr>
              <tr>
                <td className="py-2 px-4 font-mono text-cyan-300">content_hash</td>
                <td className="py-2 px-4">string</td>
                <td className="py-2 px-4">
                  Fingerprint of canonical finding payload to detect semantic mutation.
                </td>
              </tr>
              <tr>
                <td className="py-2 px-4 font-mono text-cyan-300">previous_hash</td>
                <td className="py-2 px-4">string</td>
                <td className="py-2 px-4">
                  Back-reference to prior chain state for tamper detection.
                </td>
              </tr>
              <tr>
                <td className="py-2 px-4 font-mono text-cyan-300">chain_hash</td>
                <td className="py-2 px-4">string</td>
                <td className="py-2 px-4">Integrity checksum over current and prior state.</td>
              </tr>
              <tr>
                <td className="py-2 px-4 font-mono text-cyan-300">citation_state</td>
                <td className="py-2 px-4">enum</td>
                <td className="py-2 px-4">
                  Citation-backed, uncited, or unavailable state used by scoring and prioritization
                  logic.
                </td>
              </tr>
              <tr>
                <td className="py-2 px-4 font-mono text-cyan-300">action_path</td>
                <td className="py-2 px-4">object</td>
                <td className="py-2 px-4">
                  Corrective actions mapped to the evidence producing this finding.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-bold text-white mb-4">
          Integrity and unavailable-state rules
        </h2>
        <div className="space-y-3 text-sm text-slate-300">
          <p className="rounded-lg border border-white/10 bg-white/4 p-3">
            <strong className="text-white">Append-only:</strong> ledger rows are immutable after
            commit.
          </p>
          <p className="rounded-lg border border-white/10 bg-white/4 p-3">
            <strong className="text-white">No evidence, no claim:</strong> if evidence cannot be
            validated, output must degrade to unavailable or uncited state, never fabricated
            certainty.
          </p>
          <p className="rounded-lg border border-white/10 bg-white/4 p-3">
            <strong className="text-white">Contract stability:</strong> response shape remains
            stable even during partial stage failure; prior valid outputs are preserved.
          </p>
          <p className="rounded-lg border border-white/10 bg-white/4 p-3">
            <strong className="text-white">Server authority:</strong> client projections may
            summarize state, but ledger-backed server outputs always win on disagreement.
          </p>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-bold text-white mb-4">Disambiguation: ledger vs analytics</h2>
        <p className="text-slate-300 leading-relaxed mb-4">
          CITE LEDGER is not a charting feature. It is the evidence substrate that makes charting
          meaningful. Generic request counters cannot explain citation outcomes. Ledger-backed state
          can.
        </p>
        <ul className="space-y-2 text-sm text-slate-300">
          <li className="flex gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-300 mt-0.5" />
            Ledger answers: which claim is cited, which is uncited, and which fix path is active.
          </li>
          <li className="flex gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-300 mt-0.5" />
            Ledger explains: why a score changed by mapping movement to evidence and action path
            deltas.
          </li>
          <li className="flex gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-300 mt-0.5" />
            Ledger enables automation: workers act on evidence-backed tasks rather than generic
            health metrics.
          </li>
        </ul>
      </section>

      <nav className="grid sm:grid-cols-3 gap-4 mt-8" aria-label="Related methodology">
        <Link
          to="/brag-methodology"
          className="p-4 rounded-lg border border-white/10 hover:border-orange-500/30 transition-colors group"
        >
          <Shield className="w-4 h-4 text-orange-300 mb-2" />
          <div className="text-sm font-semibold text-white group-hover:text-orange-200 transition-colors">
            BRAG methodology
          </div>
          <div className="text-xs text-slate-500 mt-1">Scoring and evidence semantics</div>
        </Link>
        <Link
          to="/methodology/triple-check-protocol"
          className="p-4 rounded-lg border border-white/10 hover:border-cyan-500/30 transition-colors group"
        >
          <Hash className="w-4 h-4 text-cyan-300 mb-2" />
          <div className="text-sm font-semibold text-white group-hover:text-cyan-200 transition-colors">
            Triple-check protocol
          </div>
          <div className="text-xs text-slate-500 mt-1">Multi-model validation gate</div>
        </Link>
        <Link
          to="/evidence/ledger-index"
          className="p-4 rounded-lg border border-white/10 hover:border-emerald-500/30 transition-colors group"
        >
          <Database className="w-4 h-4 text-emerald-300 mb-2" />
          <div className="text-sm font-semibold text-white group-hover:text-emerald-200 transition-colors">
            Ledger index
          </div>
          <div className="text-xs text-slate-500 mt-1">Browse evidence outputs</div>
        </Link>
      </nav>
    </PublicPageFrame>
  );
}
