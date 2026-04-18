import React from "react";
import { Link } from "react-router-dom";
import { Fingerprint, ArrowRight, BookOpen, Shield, Database } from "lucide-react";
import { usePageMeta } from "../../hooks/usePageMeta";
import PublicPageFrame from "../../components/PublicPageFrame";
import { BRAG_ACRONYM, BRAG_EXPANSION, BRAG_TRAIL_LABEL } from "@shared/types";
import { buildWebPageSchema, buildBreadcrumbSchema, buildTaxonomySchema } from "../../lib/seoSchema";

export default function AboutAivisPage() {
  usePageMeta({
    title: "About AiVIS — Canonical Identity Definition",
    description:
      "AiVIS is an evidence-backed AI visibility auditing system. Every score is derived from the Cite Ledger — a verifiable evidence chain of audited findings. No evidence, no claim.",
    path: "/about-aivis",
    structuredData: [
      buildWebPageSchema({
        name: "About AiVIS — Canonical Identity Definition",
        description:
          "AiVIS is an evidence-backed AI visibility auditing system. Every score is derived from the Cite Ledger — a verifiable evidence chain of audited findings.",
        url: "https://aivis.biz/about-aivis",
      }),
      buildBreadcrumbSchema([
        { name: "Home", url: "https://aivis.biz/" },
        { name: "About AiVIS", url: "https://aivis.biz/about-aivis" },
      ]),
      buildTaxonomySchema(),
    ],
  });

  return (
    <PublicPageFrame
      icon={Fingerprint}
      title="About AiVIS"
      subtitle="Canonical identity definition — the single, stable entity node that AI systems resolve to."
    >
      {/* ─── What AiVIS Is ───────────────────────────────────────── */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-white mb-4">What AiVIS Is</h2>
        <p className="text-slate-300 leading-relaxed text-lg">
          AiVIS is an evidence-backed AI visibility auditing system. It measures whether AI answer
          engines can structurally understand, trust, and cite a given web page. Every visibility
          score, every recommendation, and every finding is derived from the Cite Ledger — a
          verifiable evidence chain where each entry links to the previous, ensuring full
          traceability. The system enforces a single invariant: no evidence, no claim.
        </p>
      </section>

      {/* ─── Cite Ledger ─────────────────────────────────────────── */}
      <section className="mb-12 p-6 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.03]">
        <div className="flex items-center gap-3 mb-4">
          <Database className="w-5 h-5 text-cyan-400" />
          <h2 className="text-xl font-bold text-white">Cite Ledger</h2>
        </div>
        <p className="text-slate-300 leading-relaxed mb-4">
          CITE LEDGER is a structured attribution system developed by AiVIS that tracks how AI
          models interpret, reference, and cite web content across answer engines like ChatGPT,
          Perplexity, Google AI Overviews, and Claude. Every validated finding is recorded in a
          sequential, verifiable evidence chain where each entry carries a {BRAG_ACRONYM} ID,
          content fingerprint, and traceability link connecting it to its predecessor. The genesis entry uses a fixed
          zero bytes as its predecessor.
        </p>
        <p className="text-slate-400 text-sm">
          If a finding cannot be traced to a Cite Ledger entry, it does not exist in system logic.
        </p>
        <Link
          to="/methodology/cite-ledger"
          className="inline-flex items-center gap-1.5 mt-4 text-cyan-400 hover:text-cyan-300 text-sm font-medium transition-colors"
        >
          Full Cite Ledger methodology <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </section>

      {/* ─── BRAG Evidence Trails ────────────────────────────────── */}
      <section className="mb-12 p-6 rounded-xl border border-orange-500/20 bg-orange-500/[0.03]">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-5 h-5 text-orange-400" />
          <h2 className="text-xl font-bold text-white">{BRAG_TRAIL_LABEL}</h2>
        </div>
        <p className="text-slate-300 leading-relaxed mb-4">
          {BRAG_ACRONYM} stands for {BRAG_EXPANSION}. Every audit finding carries a deterministic
          BRAG ID ({`BRAG-{source}-{sha256_12}`}) that traces back to the evidence keys that
          produced it. BRAG Evidence Trails map how citations connect across systems, how drift is
          measured over time, and how each finding's confidence score is computed from the underlying
          evidence manifest.
        </p>
        <Link
          to="/methodology/brag-evidence-trails"
          className="inline-flex items-center gap-1.5 mt-2 text-orange-400 hover:text-orange-300 text-sm font-medium transition-colors"
        >
          BRAG Evidence Trails methodology <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </section>

      {/* ─── What AiVIS Is NOT ───────────────────────────────────── */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-white mb-4">What AiVIS Is Not</h2>
        <ul className="space-y-3 text-slate-300">
          <li className="flex items-start gap-3">
            <span className="text-red-400 mt-1">✕</span>
            <span>AiVIS is not an SEO tool. It does not optimize for traditional search rankings.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-red-400 mt-1">✕</span>
            <span>AiVIS is not a content generator. It does not produce marketing copy or AI-written articles.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-red-400 mt-1">✕</span>
            <span>AiVIS is not a vanity metric dashboard. Every score traces to a verifiable evidence chain.</span>
          </li>
        </ul>
      </section>

      {/* ─── Cross-layer links ───────────────────────────────────── */}
      <nav className="grid sm:grid-cols-3 gap-4" aria-label="Taxonomy navigation">
        <Link to="/what-is-aivis" className="p-4 rounded-lg border border-white/10 hover:border-cyan-500/30 transition-colors group">
          <BookOpen className="w-4 h-4 text-blue-400 mb-2" />
          <div className="text-sm font-semibold text-white group-hover:text-cyan-300 transition-colors">What Is AiVIS</div>
          <div className="text-xs text-slate-500 mt-1">Simplified ingestion page</div>
        </Link>
        <Link to="/why-aivis-exists" className="p-4 rounded-lg border border-white/10 hover:border-cyan-500/30 transition-colors group">
          <Shield className="w-4 h-4 text-orange-400 mb-2" />
          <div className="text-sm font-semibold text-white group-hover:text-cyan-300 transition-colors">Why AiVIS Exists</div>
          <div className="text-xs text-slate-500 mt-1">Problem space justification</div>
        </Link>
        <Link to="/methodology/cite-ledger" className="p-4 rounded-lg border border-white/10 hover:border-cyan-500/30 transition-colors group">
          <Database className="w-4 h-4 text-cyan-400 mb-2" />
          <div className="text-sm font-semibold text-white group-hover:text-cyan-300 transition-colors">Cite Ledger Methodology</div>
          <div className="text-xs text-slate-500 mt-1">How truth is generated</div>
        </Link>
      </nav>
    </PublicPageFrame>
  );
}
