import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Database,
  Fingerprint,
  Shield,
  Sparkles,
} from 'lucide-react';
import { usePageMeta } from '../../hooks/usePageMeta';
import PublicPageFrame from '../../components/PublicPageFrame';
import { BRAG_ACRONYM, BRAG_EXPANSION, BRAG_TRAIL_LABEL } from '@shared/types';
import { buildWebPageSchema, buildBreadcrumbSchema } from '../../lib/seoSchema';

export default function BragEvidenceTrailsPage() {
  const location = useLocation();
  const canonicalPath =
    location.pathname === '/brag-methodology'
      ? '/brag-methodology'
      : '/methodology/brag-evidence-trails';

  usePageMeta({
    title: `${BRAG_ACRONYM} Methodology | Based Retrieval Auditable Grading`,
    description: `${BRAG_ACRONYM} (${BRAG_EXPANSION}) defines the evidence-linked grading semantics that anchor AiVIS citation-readiness scores and remediation priorities.`,
    path: canonicalPath,
    structuredData: [
      buildWebPageSchema({
        name: `${BRAG_ACRONYM} Methodology | Based Retrieval Auditable Grading`,
        description: `${BRAG_ACRONYM} methodology page defining Benchmark, Rationale, Authority, and Gap classes and their impact on scoring and action paths.`,
        path: canonicalPath,
      }),
      buildBreadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'Methodology', path: '/methodology' },
        { name: `${BRAG_ACRONYM} Methodology`, path: canonicalPath },
      ]),
    ],
  });

  return (
    <PublicPageFrame
      icon={Shield}
      title={`${BRAG_ACRONYM} Methodology`}
      subtitle={`${BRAG_ACRONYM} (${BRAG_EXPANSION}) is the scoring anchor that keeps AiVIS outputs evidence-bound, reproducible, and action-linked.`}
      backTo="/methodology"
    >
      <section className="mb-10 rounded-2xl border border-orange-300/20 bg-orange-400/6 p-5">
        <p className="text-xs uppercase tracking-[0.18em] text-orange-200/85 mb-2">
          Clear definition
        </p>
        <p className="text-lg text-slate-100 leading-relaxed">
          {BRAG_ACRONYM} is the evidence-grading layer inside AiVIS. It ensures each finding is
          anchored to verifiable proof and tied to a corrective path when citation readiness is
          weak.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-bold text-white mb-4">Canonical expansion</h2>
        <p className="text-slate-300 leading-relaxed mb-4">
          {BRAG_ACRONYM} expands to <strong className="text-white">{BRAG_EXPANSION}</strong>. These
          are evidence classes used to classify claim quality and assign action urgency in the
          pipeline.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <article className="rounded-xl border border-white/10 bg-white/4 p-4">
            <h3 className="text-white font-semibold">B: Benchmark</h3>
            <p className="mt-2 text-sm text-slate-300">
              Verifiable quantitative anchors such as measurable deltas, counts, rates, and
              threshold states tied to source evidence.
            </p>
          </article>
          <article className="rounded-xl border border-white/10 bg-white/4 p-4">
            <h3 className="text-white font-semibold">R: Rationale</h3>
            <p className="mt-2 text-sm text-slate-300">
              Methodological explanation linking structural signals to extraction and citation
              outcomes.
            </p>
          </article>
          <article className="rounded-xl border border-white/10 bg-white/4 p-4">
            <h3 className="text-white font-semibold">A: Authority</h3>
            <p className="mt-2 text-sm text-slate-300">
              Evidence that source identity is legitimate, attributable, and stable enough for model
              trust routing.
            </p>
          </article>
          <article className="rounded-xl border border-white/10 bg-white/4 p-4">
            <h3 className="text-white font-semibold">G: Gap</h3>
            <p className="mt-2 text-sm text-slate-300">
              Explicit missing-evidence states and unresolved blockers requiring corrective action.
            </p>
          </article>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-bold text-white mb-4">How BRAG anchors scoring</h2>
        <div className="space-y-3 text-sm text-slate-300">
          <p className="rounded-lg border border-white/10 bg-white/4 p-3">
            <strong className="text-white">1. Classification:</strong> findings are tagged by BRAG
            evidence class before confidence scoring.
          </p>
          <p className="rounded-lg border border-white/10 bg-white/4 p-3">
            <strong className="text-white">2. Confidence shaping:</strong> missing benchmark or
            authority evidence lowers trust and increases remediation priority.
          </p>
          <p className="rounded-lg border border-white/10 bg-white/4 p-3">
            <strong className="text-white">3. Action routing:</strong> gap-heavy findings route to
            corrective workflows; benchmark-backed findings route to performance tracking.
          </p>
          <p className="rounded-lg border border-white/10 bg-white/4 p-3">
            <strong className="text-white">4. Ledger linkage:</strong> all BRAG-tagged findings are
            persisted into CITE LEDGER for replay-safe auditing.
          </p>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-bold text-white mb-4">What BRAG is not</h2>
        <ul className="space-y-2 text-sm text-slate-300 list-disc pl-5">
          <li>Not a vanity score layer detached from evidence.</li>
          <li>Not generic analytics labeling for engagement charts.</li>
          <li>Not a replacement for CITE LEDGER integrity rules.</li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-bold text-white mb-4">
          Disambiguation: methodology vs generic analytics
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-red-300/20 bg-red-400/8 p-4">
            <div className="flex items-center gap-2 text-red-200 font-semibold">
              <AlertTriangle className="h-4 w-4" /> Generic analytics framing
            </div>
            <ul className="mt-3 space-y-2 text-sm text-slate-200">
              <li>Request counters without citation interpretation</li>
              <li>Disconnected score numbers with no evidence path</li>
              <li>No actionable mapping between issue and fix</li>
            </ul>
          </div>
          <div className="rounded-xl border border-emerald-300/20 bg-emerald-400/8 p-4">
            <div className="flex items-center gap-2 text-emerald-200 font-semibold">
              <CheckCircle2 className="h-4 w-4" /> BRAG methodology framing
            </div>
            <ul className="mt-3 space-y-2 text-sm text-slate-200">
              <li>Evidence class attached to every diagnostic output</li>
              <li>Citation state and corrective path always present</li>
              <li>Visibility movement attributed to specific structural changes</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-bold text-white mb-4">BRAG in the remediation loop</h2>
        <div className="space-y-4 text-slate-300 leading-relaxed">
          <p>
            BRAG output is designed for autonomous optimization workflows. Fix workers consume
            gap-tagged findings, apply deterministic remediation patterns, and return updated
            evidence snapshots.
          </p>
          <p>
            This is why AiVIS should be interpreted as AI search visibility infrastructure rather
            than an analytics dashboard. The system does not stop at diagnosis; it closes the loop
            from detection to action and verification.
          </p>
        </div>
      </section>

      <section className="mb-10 rounded-2xl border border-cyan-300/20 bg-cyan-400/6 p-5">
        <div className="flex items-center gap-2 text-cyan-100 font-semibold">
          <BarChart3 className="h-4 w-4" /> Implementation note
        </div>
        <p className="mt-2 text-sm text-slate-200">
          Visibility scores should always be rendered with causal context, such as evidence gaps and
          active fixes. A bare score without BRAG interpretation is intentionally incomplete.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-bold text-white mb-4">Associated terms</h2>
        <div className="rounded-xl border border-white/10 bg-white/4 p-4 text-sm text-slate-300">
          AiVIS, CITE LEDGER, BRAG, AI visibility, and AI citation readiness are linked concepts in
          one evidence-backed system. BRAG provides grading semantics; CITE LEDGER provides
          verification substrate and traceability.
        </div>
      </section>

      <nav className="grid sm:grid-cols-3 gap-4" aria-label="Related methodology">
        <Link
          to="/cite-ledger"
          className="p-4 rounded-lg border border-white/10 hover:border-cyan-500/30 transition-colors group"
        >
          <Database className="w-4 h-4 text-cyan-300 mb-2" />
          <div className="text-sm font-semibold text-white group-hover:text-cyan-200 transition-colors">
            CITE LEDGER
          </div>
          <div className="text-xs text-slate-500 mt-1">Ownership and truth model</div>
        </Link>
        <Link
          to="/methodology/entity-resolution-model"
          className="p-4 rounded-lg border border-white/10 hover:border-violet-500/30 transition-colors group"
        >
          <Fingerprint className="w-4 h-4 text-violet-300 mb-2" />
          <div className="text-sm font-semibold text-white group-hover:text-violet-200 transition-colors">
            Entity resolution
          </div>
          <div className="text-xs text-slate-500 mt-1">Identity continuity</div>
        </Link>
        <Link
          to="/app/analytics"
          className="p-4 rounded-lg border border-white/10 hover:border-emerald-500/30 transition-colors group"
        >
          <Sparkles className="w-4 h-4 text-emerald-300 mb-2" />
          <div className="text-sm font-semibold text-white group-hover:text-emerald-200 transition-colors">
            Visibility Intelligence
          </div>
          <div className="text-xs text-slate-500 mt-1">State, interpretation, and impact</div>
        </Link>
      </nav>
    </PublicPageFrame>
  );
}
