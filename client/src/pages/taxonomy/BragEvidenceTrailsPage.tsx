import React from "react";
import { Link } from "react-router-dom";
import { Shield, ArrowRight, Database, Hash, Fingerprint } from "lucide-react";
import { usePageMeta } from "../../hooks/usePageMeta";
import PublicPageFrame from "../../components/PublicPageFrame";
import { BRAG_ACRONYM, BRAG_EXPANSION, BRAG_TRAIL_LABEL } from "@shared/types";
import { buildWebPageSchema, buildBreadcrumbSchema } from "../../lib/seoSchema";

export default function BragEvidenceTrailsPage() {
  usePageMeta({
    title: `${BRAG_TRAIL_LABEL} Methodology — Deterministic Finding IDs`,
    description:
      `${BRAG_ACRONYM} (${BRAG_EXPANSION}) assigns a deterministic ID to every audit finding. Trails map citation relationships, measure drift, and compute confidence from evidence manifests.`,
    path: "/methodology/brag-evidence-trails",
    structuredData: [
      buildWebPageSchema({
        name: `${BRAG_TRAIL_LABEL} Methodology`,
        description:
          `${BRAG_ACRONYM} assigns a deterministic ID to every audit finding. Trails map citation relationships and measure drift.`,
        url: "https://aivis.biz/methodology/brag-evidence-trails",
      }),
      buildBreadcrumbSchema([
        { name: "Home", url: "https://aivis.biz/" },
        { name: "About AiVIS", url: "https://aivis.biz/about-aivis" },
        { name: "Methodology", url: "https://aivis.biz/methodology" },
        { name: BRAG_TRAIL_LABEL, url: "https://aivis.biz/methodology/brag-evidence-trails" },
      ]),
    ],
  });

  return (
    <PublicPageFrame
      icon={Shield}
      title={BRAG_TRAIL_LABEL}
      subtitle={`${BRAG_ACRONYM} — ${BRAG_EXPANSION}. How every finding gets a verifiable identity.`}
      backTo="/methodology"
    >
      {/* ─── What is BRAG ────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold text-white mb-4">What Is {BRAG_ACRONYM}</h2>
        <p className="text-slate-300 leading-relaxed text-lg">
          {BRAG_ACRONYM} stands for <strong className="text-white">{BRAG_EXPANSION}</strong>. It is
          the naming and linking system that gives every AiVIS audit finding a deterministic,
          content-derived identifier. Each {BRAG_ACRONYM} ID follows the pattern{" "}
          <code className="text-cyan-400 bg-white/5 px-1.5 py-0.5 rounded text-sm">
            BRAG-&#123;source&#125;-&#123;sha256_12&#125;
          </code>{" "}
          where <em>source</em> is the pipeline stage and <em>sha256_12</em> is the first 12
          characters of the finding's content hash.
        </p>
      </section>

      {/* ─── Trail construction ──────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold text-white mb-6">Trail Construction</h2>
        <div className="space-y-6">
          <div className="p-5 rounded-xl border border-orange-500/15 bg-orange-500/[0.02]">
            <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
              <Hash className="w-4 h-4 text-orange-400" /> ID Generation
            </h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              When a pipeline stage emits a finding, the {BRAG_ACRONYM} ID is generated
              deterministically from the source stage name and the SHA-256 content hash. The same
              input always produces the same ID. No randomness is involved.
            </p>
          </div>
          <div className="p-5 rounded-xl border border-orange-500/15 bg-orange-500/[0.02]">
            <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
              <Shield className="w-4 h-4 text-orange-400" /> Evidence Binding
            </h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Each finding carries an array of <em>evidence_keys</em> — references to the specific
              data points that produced it (DOM node paths, schema properties, HTTP headers, etc.).
              The {BRAG_ACRONYM} ID only exists if its evidence keys resolve. Missing evidence →
              no trail entry.
            </p>
          </div>
          <div className="p-5 rounded-xl border border-orange-500/15 bg-orange-500/[0.02]">
            <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
              <Database className="w-4 h-4 text-cyan-400" /> Ledger Insertion
            </h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              After validation, the finding is written to the Cite Ledger as an immutable entry.
              The {BRAG_ACRONYM} ID becomes the primary reference key. All downstream outputs
              (scores, recommendations, exports) reference findings by their {BRAG_ACRONYM} ID.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Drift measurement ───────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-xl font-bold text-white mb-4">Drift Measurement</h2>
        <p className="text-slate-300 text-sm leading-relaxed">
          When the same page is audited at different points in time, the {BRAG_ACRONYM} trail
          enables drift analysis. If a finding's evidence keys change but the recommendation
          remains, the drift is structural. If the finding disappears entirely, the drift is a
          regression. All drift is computed by comparing Cite Ledger entries across audit
          timestamps.
        </p>
      </section>

      {/* ─── Finding structure ───────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-xl font-bold text-white mb-4">Finding Structure</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-300">
            <thead className="text-xs uppercase text-slate-500 border-b border-white/10">
              <tr>
                <th className="py-3 pr-4">Field</th>
                <th className="py-3">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              <tr><td className="py-2 pr-4 font-mono text-orange-400">brag_id</td><td>Deterministic ID ({`BRAG-{source}-{sha256_12}`})</td></tr>
              <tr><td className="py-2 pr-4 font-mono text-orange-400">source</td><td>Pipeline stage that produced the finding</td></tr>
              <tr><td className="py-2 pr-4 font-mono text-orange-400">title</td><td>Human-readable finding title</td></tr>
              <tr><td className="py-2 pr-4 font-mono text-orange-400">severity</td><td>critical | high | medium | low | info</td></tr>
              <tr><td className="py-2 pr-4 font-mono text-orange-400">is_hard_blocker</td><td>Whether this finding blocks BRAG gate passage</td></tr>
              <tr><td className="py-2 pr-4 font-mono text-orange-400">evidence_keys</td><td>Array of evidence references</td></tr>
              <tr><td className="py-2 pr-4 font-mono text-orange-400">evidence_statuses</td><td>Per-key validation results</td></tr>
              <tr><td className="py-2 pr-4 font-mono text-orange-400">confidence</td><td>0–1 confidence derived from evidence completeness</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ─── Cross-layer navigation ──────────────────────────────── */}
      <nav className="grid sm:grid-cols-3 gap-4" aria-label="Related methodology">
        <Link to="/methodology/cite-ledger" className="p-4 rounded-lg border border-white/10 hover:border-cyan-500/30 transition-colors group">
          <Database className="w-4 h-4 text-cyan-400 mb-2" />
          <div className="text-sm font-semibold text-white group-hover:text-cyan-300 transition-colors">Cite Ledger</div>
          <div className="text-xs text-slate-500 mt-1">Source of truth</div>
        </Link>
        <Link to="/methodology/entity-resolution-model" className="p-4 rounded-lg border border-white/10 hover:border-violet-500/30 transition-colors group">
          <Fingerprint className="w-4 h-4 text-violet-400 mb-2" />
          <div className="text-sm font-semibold text-white group-hover:text-violet-300 transition-colors">Entity Resolution</div>
          <div className="text-xs text-slate-500 mt-1">Identity protection</div>
        </Link>
        <Link to="/evidence/drift-analysis" className="p-4 rounded-lg border border-white/10 hover:border-green-500/30 transition-colors group">
          <Shield className="w-4 h-4 text-green-400 mb-2" />
          <div className="text-sm font-semibold text-white group-hover:text-green-300 transition-colors">Drift Analysis</div>
          <div className="text-xs text-slate-500 mt-1">Measure attribution stability</div>
        </Link>
      </nav>
    </PublicPageFrame>
  );
}
