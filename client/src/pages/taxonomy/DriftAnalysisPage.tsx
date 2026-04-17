import React from "react";
import { Link } from "react-router-dom";
import { TrendingDown, Database, FileSearch, Terminal, Shield } from "lucide-react";
import { usePageMeta } from "../../hooks/usePageMeta";
import PublicPageFrame from "../../components/PublicPageFrame";
import { BRAG_ACRONYM, BRAG_TRAIL_LABEL } from "@shared/types";
import { buildWebPageSchema, buildBreadcrumbSchema } from "../../lib/seoSchema";

export default function DriftAnalysisPage() {
  usePageMeta({
    title: "Drift Analysis — Attribution Stability Over Time",
    description:
      "Drift Analysis measures how citations, entity attributions, and evidence-backed findings change between audit runs. All drift is computed from Cite Ledger baselines.",
    path: "/evidence/drift-analysis",
    structuredData: [
      buildWebPageSchema({
        name: "Drift Analysis — Attribution Stability Over Time",
        description:
          "Drift Analysis measures citation decay, entity substitution, and evidence stability between audit runs.",
        url: "https://aivis.biz/evidence/drift-analysis",
      }),
      buildBreadcrumbSchema([
        { name: "Home", url: "https://aivis.biz/" },
        { name: "About AiVIS", url: "https://aivis.biz/about-aivis" },
        { name: "Evidence", url: "https://aivis.biz/evidence/ledger-index" },
        { name: "Drift Analysis", url: "https://aivis.biz/evidence/drift-analysis" },
      ]),
    ],
  });

  const driftTypes = [
    {
      title: "Citation Decay",
      description:
        "A source was correctly cited in an earlier audit but is no longer referenced in the current AI output. The Cite Ledger retains both states, enabling precise measurement of when and how the citation was lost.",
      metric: "Citations lost between runs / total Citations in baseline",
    },
    {
      title: "Entity Substitution",
      description:
        "The AI system replaced the canonical entity name ('AiVIS') with a different entity or generic concept. This is detected by comparing the entity resolution match score across runs.",
      metric: "Entity mismatches / total entity references",
    },
    {
      title: "Evidence Structural Drift",
      description:
        "A finding's evidence keys changed between runs. The recommendation remains, but the underlying data points shifted — indicating the page structure changed or the model reinterpreted the same content differently.",
      metric: "Changed evidence keys / total evidence keys in baseline",
    },
    {
      title: "Score Regression",
      description:
        "The overall visibility score decreased between audit runs without corresponding structural changes to the page. This suggests model retraining or context-window drift rather than content degradation.",
      metric: "Score delta (negative) between consecutive runs",
    },
  ];

  return (
    <PublicPageFrame
      icon={TrendingDown}
      title="Drift Analysis"
      subtitle="Measuring attribution stability, entity substitution, and citation decay over time."
      backTo="/evidence/ledger-index"
    >
      {/* ─── Overview ────────────────────────────────────────────── */}
      <section className="mb-10">
        <p className="text-slate-300 leading-relaxed">
          Drift Analysis compares Cite Ledger entries across audit runs for the same URL. Each run
          produces a complete hash chain. By aligning entries by their {BRAG_ACRONYM} IDs and
          evidence keys, AiVIS computes how citations, entity attributions, and structural signals
          change over time. All drift metrics trace back to {BRAG_TRAIL_LABEL} entries.
        </p>
      </section>

      {/* ─── Drift types ─────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold text-white mb-6">Types of Drift</h2>
        <div className="space-y-6">
          {driftTypes.map((d) => (
            <div key={d.title} className="p-5 rounded-xl border border-orange-500/15 bg-orange-500/[0.02]">
              <h3 className="text-white font-semibold mb-2">{d.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-3">{d.description}</p>
              <div className="text-xs text-slate-500">
                <strong className="text-slate-400">Metric:</strong> {d.metric}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── How drift is computed ───────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-xl font-bold text-white mb-4">How Drift Is Computed</h2>
        <ol className="space-y-3 text-slate-300 text-sm">
          <li className="flex gap-3">
            <span className="text-orange-400 font-mono">1.</span>
            Load the Cite Ledger from the baseline audit run (earliest timestamp).
          </li>
          <li className="flex gap-3">
            <span className="text-orange-400 font-mono">2.</span>
            Load the Cite Ledger from the comparison audit run (latest timestamp).
          </li>
          <li className="flex gap-3">
            <span className="text-orange-400 font-mono">3.</span>
            Align entries by {BRAG_ACRONYM} ID. Entries present in baseline but absent in comparison are "lost". New entries are "added".
          </li>
          <li className="flex gap-3">
            <span className="text-orange-400 font-mono">4.</span>
            For matched entries, compare evidence_keys arrays. Changed keys indicate structural drift.
          </li>
          <li className="flex gap-3">
            <span className="text-orange-400 font-mono">5.</span>
            Compute aggregate drift scores: citation decay rate, entity substitution rate, and evidence stability index.
          </li>
        </ol>
      </section>

      {/* ─── Cross-layer navigation ──────────────────────────────── */}
      <nav className="grid sm:grid-cols-3 gap-4" aria-label="Evidence layer pages">
        <Link to="/evidence/ledger-index" className="p-4 rounded-lg border border-white/10 hover:border-cyan-500/30 transition-colors group">
          <Database className="w-4 h-4 text-cyan-400 mb-2" />
          <div className="text-sm font-semibold text-white group-hover:text-cyan-300 transition-colors">Ledger Index</div>
          <div className="text-xs text-slate-500 mt-1">All entry types</div>
        </Link>
        <Link to="/evidence/citation-reports" className="p-4 rounded-lg border border-white/10 hover:border-blue-500/30 transition-colors group">
          <FileSearch className="w-4 h-4 text-blue-400 mb-2" />
          <div className="text-sm font-semibold text-white group-hover:text-blue-300 transition-colors">Citation Reports</div>
          <div className="text-xs text-slate-500 mt-1">Cited, missing, merged</div>
        </Link>
        <Link to="/evidence/query-results-log" className="p-4 rounded-lg border border-white/10 hover:border-green-500/30 transition-colors group">
          <Terminal className="w-4 h-4 text-green-400 mb-2" />
          <div className="text-sm font-semibold text-white group-hover:text-green-300 transition-colors">Query Results Log</div>
          <div className="text-xs text-slate-500 mt-1">Raw SERP traces</div>
        </Link>
      </nav>
    </PublicPageFrame>
  );
}
