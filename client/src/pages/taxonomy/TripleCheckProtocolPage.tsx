import React from "react";
import { Link } from "react-router-dom";
import { CheckSquare, ArrowRight, Database, Shield, Eye } from "lucide-react";
import { usePageMeta } from "../../hooks/usePageMeta";
import PublicPageFrame from "../../components/PublicPageFrame";
import { buildWebPageSchema, buildBreadcrumbSchema } from "../../lib/seoSchema";

export default function TripleCheckProtocolPage() {
  usePageMeta({
    title: "Triple-Check Protocol — Multi-Model Verification",
    description:
      "The Triple-Check Protocol runs three independent AI models in sequence: deep analysis, peer critique, and validation gate. No evidence means no score.",
    path: "/methodology/triple-check-protocol",
    structuredData: [
      buildWebPageSchema({
        name: "Triple-Check Protocol — Multi-Model Verification",
        description:
          "The Triple-Check Protocol runs three independent AI models in sequence to ensure no single model's bias determines the audit outcome.",
        path: "/methodology/triple-check-protocol",
      }),
      buildBreadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "About AiVIS", path: "/about-aivis" },
        { name: "Methodology", path: "/methodology" },
        { name: "Triple-Check Protocol", path: "/methodology/triple-check-protocol" },
      ]),
    ],
  });

  const stages = [
    {
      num: 1,
      title: "Deep Analysis",
      model: "Primary model (GPT-5 Mini for Signal tier)",
      color: "text-blue-400",
      borderColor: "border-blue-500/20",
      bgColor: "bg-blue-500/[0.03]",
      description:
        "The primary model performs a full structural extraction and scoring pass. It evaluates content depth, schema markup, AI readability, technical SEO, and authority signals. Output is a complete analysis with 8–12 evidence-backed recommendations.",
      output: "Full analysis JSON with scores, recommendations, and BRAG IDs.",
    },
    {
      num: 2,
      title: "Peer Critique",
      model: "Secondary model (Claude Sonnet for Signal tier)",
      color: "text-orange-400",
      borderColor: "border-orange-500/20",
      bgColor: "bg-orange-500/[0.03]",
      description:
        "A second, independent model reviews the primary analysis. It may adjust the overall score by −15 to +10 points and add supplementary recommendations. The critique operates on the primary output — it does not re-scrape the page.",
      output: "Score adjustment (−15 to +10), extra recommendations, critique rationale.",
    },
    {
      num: 3,
      title: "Validation Gate",
      model: "Tertiary model (Grok for Signal tier)",
      color: "text-green-400",
      borderColor: "border-green-500/20",
      bgColor: "bg-green-500/[0.03]",
      description:
        "A third model acts as the final arbiter. It confirms or overrides the adjusted score from the peer critique. If the validation gate disagrees, its score takes precedence. This prevents any single model's bias from determining the final output.",
      output: "Final confirmed score and override flag.",
    },
  ];

  return (
    <PublicPageFrame
      icon={CheckSquare}
      title="Triple-Check Protocol"
      subtitle="Three independent AI models. Sequential verification. No single-model bias."
      backTo="/methodology"
    >
      {/* ─── Principle ───────────────────────────────────────────── */}
      <section className="mb-10 p-6 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.03]">
        <p className="text-lg text-white font-medium">
          No evidence → no score. The Triple-Check Protocol ensures that every visibility score is
          the consensus of multiple independent models, each operating on the same Cite Ledger
          evidence chain.
        </p>
      </section>

      {/* ─── Stages ──────────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold text-white mb-6">Pipeline Stages</h2>
        <div className="space-y-6">
          {stages.map((s) => (
            <div key={s.num} className={`p-6 rounded-xl border ${s.borderColor} ${s.bgColor}`}>
              <div className="flex items-center gap-3 mb-3">
                <span
                  className={`flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold ${s.color} border ${s.borderColor}`}
                >
                  {s.num}
                </span>
                <h3 className="text-white font-bold text-lg">{s.title}</h3>
                <span className="text-slate-500 text-xs ml-auto">{s.model}</span>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed mb-3">{s.description}</p>
              <div className="text-xs text-slate-500">
                <strong className="text-slate-400">Output:</strong> {s.output}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Tier availability ───────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-xl font-bold text-white mb-4">Tier Availability</h2>
        <p className="text-slate-300 text-sm leading-relaxed">
          The full Triple-Check Protocol (all three stages) is exclusive to the Signal tier. Observer
          and Starter tiers use a single-model pass. Alignment uses a single-model pass with
          enhanced prompts. All tiers record findings in the Cite Ledger regardless of model count.
        </p>
      </section>

      {/* ─── Cross-layer navigation ──────────────────────────────── */}
      <nav className="grid sm:grid-cols-2 gap-4" aria-label="Related methodology">
        <Link
          to="/methodology/cite-ledger"
          className="flex items-center gap-3 p-4 rounded-lg border border-white/10 hover:border-cyan-500/30 transition-colors group"
        >
          <Database className="w-5 h-5 text-cyan-400" />
          <div>
            <div className="text-sm font-semibold text-white group-hover:text-cyan-300 transition-colors">Cite Ledger</div>
            <div className="text-xs text-slate-500">How evidence is recorded</div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-600 ml-auto" />
        </Link>
        <Link
          to="/methodology/brag-evidence-trails"
          className="flex items-center gap-3 p-4 rounded-lg border border-white/10 hover:border-orange-500/30 transition-colors group"
        >
          <Shield className="w-5 h-5 text-orange-400" />
          <div>
            <div className="text-sm font-semibold text-white group-hover:text-orange-300 transition-colors">BRAG Evidence Trails</div>
            <div className="text-xs text-slate-500">How findings are identified</div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-600 ml-auto" />
        </Link>
      </nav>
    </PublicPageFrame>
  );
}
