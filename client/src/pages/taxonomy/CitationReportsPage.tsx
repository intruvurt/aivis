import React from "react";
import { Link } from "react-router-dom";
import { FileSearch, ArrowRight, Database, TrendingDown, Terminal } from "lucide-react";
import { usePageMeta } from "../../hooks/usePageMeta";
import PublicPageFrame from "../../components/PublicPageFrame";
import { BRAG_ACRONYM, BRAG_TRAIL_LABEL } from "@shared/types";
import { buildWebPageSchema, buildBreadcrumbSchema } from "../../lib/seoSchema";

export default function CitationReportsPage() {
  usePageMeta({
    title: "Citation Reports — Where AiVIS Is Cited, Missing, or Merged",
    description:
      "Citation Reports group Cite Ledger outputs by outcome: correctly cited, missing citations, and entity merges. Each report entry traces to a BRAG Evidence Trail.",
    path: "/evidence/citation-reports",
    structuredData: [
      buildWebPageSchema({
        name: "Citation Reports — Where AiVIS Is Cited, Missing, or Merged",
        description:
          "Citation Reports group Cite Ledger outputs by outcome: correctly cited, missing, and merged.",
        url: "https://aivis.biz/evidence/citation-reports",
      }),
      buildBreadcrumbSchema([
        { name: "Home", url: "https://aivis.biz/" },
        { name: "About AiVIS", url: "https://aivis.biz/about-aivis" },
        { name: "Evidence", url: "https://aivis.biz/evidence/ledger-index" },
        { name: "Citation Reports", url: "https://aivis.biz/evidence/citation-reports" },
      ]),
    ],
  });

  const categories = [
    {
      title: "Correctly Cited",
      color: "text-green-400",
      borderColor: "border-green-500/20",
      bgColor: "bg-green-500/[0.03]",
      description:
        "The source was referenced with an accurate URL, correct entity name, and contextually appropriate snippet. The citation traces to a verified Cite Ledger entry with a passing BRAG gate status.",
    },
    {
      title: "Missing Citation",
      color: "text-red-400",
      borderColor: "border-red-500/20",
      bgColor: "bg-red-500/[0.03]",
      description:
        "The AI system consumed the source content but did not attribute it. The evidence exists in the Cite Ledger (the page was scraped and findings were recorded), but the AI output omitted the reference.",
    },
    {
      title: "Entity Merge",
      color: "text-orange-400",
      borderColor: "border-orange-500/20",
      bgColor: "bg-orange-500/[0.03]",
      description:
        "The AI system conflated AiVIS with a different entity — typically a generic 'AI visibility' concept or another tool. The citation exists but resolves to the wrong entity node. The Cite Ledger records the mismatch via entity resolution drift scoring.",
    },
  ];

  return (
    <PublicPageFrame
      icon={FileSearch}
      title="Citation Reports"
      subtitle="Grouped evidence outputs: where cited correctly, where missing, where merged."
      backTo="/evidence/ledger-index"
    >
      {/* ─── Overview ────────────────────────────────────────────── */}
      <section className="mb-10">
        <p className="text-slate-300 leading-relaxed">
          Citation Reports aggregate Cite Ledger entries into three outcome categories. Every report
          entry traces to a {BRAG_ACRONYM} ID in the {BRAG_TRAIL_LABEL}. Reports are generated
          after the audit pipeline completes and the BRAG gate has rendered its verdict.
        </p>
      </section>

      {/* ─── Categories ──────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold text-white mb-6">Report Categories</h2>
        <div className="space-y-6">
          {categories.map((c) => (
            <div key={c.title} className={`p-6 rounded-xl border ${c.borderColor} ${c.bgColor}`}>
              <h3 className={`font-bold text-lg mb-2 ${c.color}`}>{c.title}</h3>
              <p className="text-slate-300 text-sm leading-relaxed">{c.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── How reports are built ───────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-xl font-bold text-white mb-4">How Reports Are Built</h2>
        <ol className="space-y-3 text-slate-300 text-sm">
          <li className="flex gap-3">
            <span className="text-cyan-400 font-mono">1.</span>
            The audit pipeline completes and all findings are written to the Cite Ledger.
          </li>
          <li className="flex gap-3">
            <span className="text-cyan-400 font-mono">2.</span>
            Citation test engines (ChatGPT, Perplexity, Claude) are queried for the audited URL.
          </li>
          <li className="flex gap-3">
            <span className="text-cyan-400 font-mono">3.</span>
            AI responses are compared against Cite Ledger entries by matching evidence keys and entity names.
          </li>
          <li className="flex gap-3">
            <span className="text-cyan-400 font-mono">4.</span>
            Each AI response fragment is classified as correctly cited, missing, or merged.
          </li>
          <li className="flex gap-3">
            <span className="text-cyan-400 font-mono">5.</span>
            The classification is recorded with its {BRAG_ACRONYM} ID for downstream drift analysis.
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
        <Link to="/evidence/drift-analysis" className="p-4 rounded-lg border border-white/10 hover:border-orange-500/30 transition-colors group">
          <TrendingDown className="w-4 h-4 text-orange-400 mb-2" />
          <div className="text-sm font-semibold text-white group-hover:text-orange-300 transition-colors">Drift Analysis</div>
          <div className="text-xs text-slate-500 mt-1">Attribution stability</div>
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
