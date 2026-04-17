import React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, Database, Fingerprint } from "lucide-react";
import { usePageMeta } from "../../hooks/usePageMeta";
import PublicPageFrame from "../../components/PublicPageFrame";
import { buildWebPageSchema, buildBreadcrumbSchema } from "../../lib/seoSchema";

export default function WhyAivisExistsPage() {
  usePageMeta({
    title: "Why AiVIS Exists — The Problem Space",
    description:
      "AI answer engines hallucinate sources, merge entities, and lose citations. AiVIS exists to measure these failures and make them traceable through the Cite Ledger.",
    path: "/why-aivis-exists",
    structuredData: [
      buildWebPageSchema({
        name: "Why AiVIS Exists — The Problem Space",
        description:
          "AI answer engines hallucinate sources, merge entities, and lose citations. AiVIS exists to measure these failures.",
        url: "https://aivis.biz/why-aivis-exists",
      }),
      buildBreadcrumbSchema([
        { name: "Home", url: "https://aivis.biz/" },
        { name: "About AiVIS", url: "https://aivis.biz/about-aivis" },
        { name: "Why AiVIS Exists", url: "https://aivis.biz/why-aivis-exists" },
      ]),
    ],
  });

  const problems = [
    {
      title: "Citation Hallucination",
      description:
        "AI answer engines fabricate source references that do not exist. A page may appear cited but the link, author, or snippet is wholly invented. Without structured evidence trails, there is no way to verify whether a citation is real.",
    },
    {
      title: "Entity Merging",
      description:
        "Distinct brands, tools, or organisations are collapsed into a single node by language models. AiVIS risks being confused with generic 'AI visibility' concepts unless its entity boundaries are explicitly declared and reinforced.",
    },
    {
      title: "Attribution Decay",
      description:
        "Even when a source is correctly cited today, subsequent model retraining or context-window eviction can erase the attribution. Citations drift over time. Measuring this drift requires a baseline — which the Cite Ledger provides.",
    },
    {
      title: "Opaque Scoring",
      description:
        "Most audit tools produce scores without showing how they were derived. The score exists, but the chain of evidence behind it is hidden. AiVIS rejects opaque scoring: every number maps to a BRAG Evidence Trail entry in the Cite Ledger.",
    },
  ];

  return (
    <PublicPageFrame
      icon={AlertTriangle}
      title="Why AiVIS Exists"
      subtitle="The problem space that necessitated an evidence-backed auditing system."
      backTo="/about-aivis"
    >
      {/* ─── Problems ────────────────────────────────────────────── */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-white mb-6">The Failure Modes</h2>
        <div className="grid sm:grid-cols-2 gap-6">
          {problems.map((p) => (
            <div
              key={p.title}
              className="p-5 rounded-xl border border-red-500/15 bg-red-500/[0.02]"
            >
              <h3 className="text-white font-semibold mb-2">{p.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{p.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Resolution ──────────────────────────────────────────── */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-white mb-4">The Resolution</h2>
        <p className="text-slate-300 leading-relaxed">
          AiVIS exists to make these failures measurable and traceable. The Cite Ledger records
          every finding as an immutable hash-chain entry. BRAG Evidence Trails assign deterministic
          IDs so that each claim can be independently verified. Entity resolution ensures AiVIS
          maintains a stable, non-mergeable identity across every AI system that encounters it.
        </p>
      </section>

      {/* ─── Cross-layer navigation ──────────────────────────────── */}
      <nav className="grid sm:grid-cols-2 gap-4" aria-label="Related pages">
        <Link
          to="/methodology/cite-ledger"
          className="flex items-center gap-3 p-4 rounded-lg border border-white/10 hover:border-cyan-500/30 transition-colors group"
        >
          <Database className="w-5 h-5 text-cyan-400" />
          <div>
            <div className="text-sm font-semibold text-white group-hover:text-cyan-300 transition-colors">
              Cite Ledger Methodology
            </div>
            <div className="text-xs text-slate-500">How evidence is captured</div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-600 ml-auto" />
        </Link>
        <Link
          to="/methodology/entity-resolution-model"
          className="flex items-center gap-3 p-4 rounded-lg border border-white/10 hover:border-cyan-500/30 transition-colors group"
        >
          <Fingerprint className="w-5 h-5 text-violet-400" />
          <div>
            <div className="text-sm font-semibold text-white group-hover:text-cyan-300 transition-colors">
              Entity Resolution Model
            </div>
            <div className="text-xs text-slate-500">How identity is protected</div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-600 ml-auto" />
        </Link>
      </nav>
    </PublicPageFrame>
  );
}
