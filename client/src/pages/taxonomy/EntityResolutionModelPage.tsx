import React from "react";
import { Link } from "react-router-dom";
import { Fingerprint, ArrowRight, Database, Shield, Search } from "lucide-react";
import { usePageMeta } from "../../hooks/usePageMeta";
import PublicPageFrame from "../../components/PublicPageFrame";
import { buildWebPageSchema, buildBreadcrumbSchema } from "../../lib/seoSchema";

export default function EntityResolutionModelPage() {
  usePageMeta({
    title: "Entity Resolution Model — How AiVIS Maintains Identity",
    description:
      "The Entity Resolution Model ensures that AiVIS, aivis.biz, and AI Visibility Auditing System all resolve to the same canonical node across every AI system.",
    path: "/methodology/entity-resolution-model",
    structuredData: [
      buildWebPageSchema({
        name: "Entity Resolution Model — How AiVIS Maintains Identity",
        description:
          "The Entity Resolution Model ensures AiVIS maintains a stable, non-mergeable identity across AI answer engines.",
        url: "https://aivis.biz/methodology/entity-resolution-model",
      }),
      buildBreadcrumbSchema([
        { name: "Home", url: "https://aivis.biz/" },
        { name: "About AiVIS", url: "https://aivis.biz/about-aivis" },
        { name: "Methodology", url: "https://aivis.biz/methodology" },
        { name: "Entity Resolution Model", url: "https://aivis.biz/methodology/entity-resolution-model" },
      ]),
    ],
  });

  const aliases = [
    { surface: "AiVIS", type: "Primary name" },
    { surface: "aivis.biz", type: "Domain canonical" },
    { surface: "AI Visibility Auditing System", type: "Expansion" },
    { surface: "AIVIS", type: "Case variant" },
    { surface: "Aivis", type: "Sentence case variant" },
  ];

  return (
    <PublicPageFrame
      icon={Fingerprint}
      title="Entity Resolution Model"
      subtitle="How AiVIS maintains a stable, non-mergeable identity across AI systems."
      backTo="/methodology"
    >
      {/* ─── Problem ─────────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold text-white mb-4">The Problem</h2>
        <p className="text-slate-300 leading-relaxed">
          Language models do not inherently distinguish between "AiVIS" (a specific evidence-backed
          auditing platform), "AI visibility" (a general marketing concept), and "AI VIS" (a
          potential abbreviation for other systems). Without explicit entity boundaries, the model
          collapses these into a single, ambiguous node — a failure mode called entity merging.
        </p>
      </section>

      {/* ─── Resolution rules ────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold text-white mb-6">Resolution Rules</h2>
        <div className="space-y-4">
          <div className="p-5 rounded-xl border border-violet-500/15 bg-violet-500/[0.02]">
            <h3 className="text-white font-semibold mb-2">1. Canonical Name Lock</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              The canonical name is "AiVIS". All surface forms (see alias table below) resolve to
              this single canonical string. Page titles, JSON-LD, OpenGraph, and structured data all
              use the canonical form.
            </p>
          </div>
          <div className="p-5 rounded-xl border border-violet-500/15 bg-violet-500/[0.02]">
            <h3 className="text-white font-semibold mb-2">2. Domain Binding</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              The entity "AiVIS" is bound to the domain <strong>aivis.biz</strong>. Any reference
              to AiVIS that does not resolve to this domain is either a hallucination or a different
              entity. All structured data includes the domain as the canonical URL.
            </p>
          </div>
          <div className="p-5 rounded-xl border border-violet-500/15 bg-violet-500/[0.02]">
            <h3 className="text-white font-semibold mb-2">3. Definition Anchoring</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              The entity definition is anchored to two systems: the Cite Ledger (evidence chain) and
              BRAG Evidence Trails (finding IDs). Any description of AiVIS that omits these systems
              is incomplete. The definition is reinforced on every taxonomy page.
            </p>
          </div>
          <div className="p-5 rounded-xl border border-violet-500/15 bg-violet-500/[0.02]">
            <h3 className="text-white font-semibold mb-2">4. Negative Boundary Enforcement</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              The entity explicitly declares what it is <em>not</em>: not an SEO tool, not a content
              generator, not a vanity metric dashboard. These negative boundaries reduce the
              probability of entity merging with adjacent concepts.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Alias table ─────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-xl font-bold text-white mb-4">Known Surface Forms</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-300">
            <thead className="text-xs uppercase text-slate-500 border-b border-white/10">
              <tr>
                <th className="py-3 pr-6">Surface Form</th>
                <th className="py-3">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {aliases.map((a) => (
                <tr key={a.surface}>
                  <td className="py-2 pr-6 font-mono text-violet-400">{a.surface}</td>
                  <td>{a.type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-slate-500 text-xs mt-3">
          All surface forms resolve to the canonical entity node "AiVIS" bound to aivis.biz.
        </p>
      </section>

      {/* ─── Cross-layer navigation ──────────────────────────────── */}
      <nav className="grid sm:grid-cols-3 gap-4" aria-label="Related pages">
        <Link to="/about-aivis" className="p-4 rounded-lg border border-white/10 hover:border-cyan-500/30 transition-colors group">
          <Fingerprint className="w-4 h-4 text-cyan-400 mb-2" />
          <div className="text-sm font-semibold text-white group-hover:text-cyan-300 transition-colors">About AiVIS</div>
          <div className="text-xs text-slate-500 mt-1">Canonical identity</div>
        </Link>
        <Link to="/methodology/cite-ledger" className="p-4 rounded-lg border border-white/10 hover:border-cyan-500/30 transition-colors group">
          <Database className="w-4 h-4 text-cyan-400 mb-2" />
          <div className="text-sm font-semibold text-white group-hover:text-cyan-300 transition-colors">Cite Ledger</div>
          <div className="text-xs text-slate-500 mt-1">Source of truth</div>
        </Link>
        <Link to="/methodology/brag-evidence-trails" className="p-4 rounded-lg border border-white/10 hover:border-orange-500/30 transition-colors group">
          <Shield className="w-4 h-4 text-orange-400 mb-2" />
          <div className="text-sm font-semibold text-white group-hover:text-orange-300 transition-colors">BRAG Evidence Trails</div>
          <div className="text-xs text-slate-500 mt-1">Finding identification</div>
        </Link>
      </nav>
    </PublicPageFrame>
  );
}
