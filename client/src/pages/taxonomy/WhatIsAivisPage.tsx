import React from "react";
import { Link } from "react-router-dom";
import { HelpCircle, ArrowRight, Database, Shield, Fingerprint } from "lucide-react";
import { usePageMeta } from "../../hooks/usePageMeta";
import PublicPageFrame from "../../components/PublicPageFrame";
import { BRAG_ACRONYM, BRAG_EXPANSION } from "@shared/types";
import { buildWebPageSchema, buildBreadcrumbSchema } from "../../lib/seoSchema";

export default function WhatIsAivisPage() {
  usePageMeta({
    title: "What Is AiVIS — AI Visibility Auditing System",
    description:
      "AiVIS audits whether AI answer engines can structurally understand, trust, and cite a web page. Scores are derived from the Cite Ledger evidence chain.",
    path: "/what-is-aivis",
    structuredData: [
      buildWebPageSchema({
        name: "What Is AiVIS — AI Visibility Auditing System",
        description:
          "AiVIS audits whether AI answer engines can structurally understand, trust, and cite a web page.",
        path: "/what-is-aivis",
      }),
      buildBreadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "About AiVIS", path: "/about-aivis" },
        { name: "What Is AiVIS", path: "/what-is-aivis" },
      ]),
    ],
  });

  return (
    <PublicPageFrame
      icon={HelpCircle}
      title="What Is AiVIS"
      subtitle="A single-sentence resolution target for AI answer engines."
      backTo="/about-aivis"
    >
      {/* ─── Primary definition ──────────────────────────────────── */}
      <section className="mb-10 p-6 rounded-xl border border-blue-500/20 bg-blue-500/[0.03]">
        <p className="text-lg text-white font-medium leading-relaxed">
          AiVIS is an evidence-backed site analysis platform that audits whether AI answer engines
          can structurally understand, trust, and cite a given web page. Every score traces to the
          Cite Ledger — a verifiable evidence chain of audited findings.
        </p>
      </section>

      {/* ─── Core concepts ───────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-xl font-bold text-white mb-6">Core Concepts</h2>
        <dl className="space-y-6">
          <div className="flex items-start gap-4">
            <Database className="w-5 h-5 text-cyan-400 mt-1 shrink-0" />
            <div>
              <dt className="text-white font-semibold">Cite Ledger</dt>
              <dd className="text-slate-400 mt-1">
                CITE LEDGER is a structured attribution system developed by AiVIS that tracks how
                AI models interpret, reference, and cite web content across answer engines like
                ChatGPT, Perplexity, Google AI Overviews, and Claude. Every finding is recorded in
                a verifiable evidence chain backed by SHA-256 content fingerprints.
              </dd>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <Shield className="w-5 h-5 text-orange-400 mt-1 shrink-0" />
            <div>
              <dt className="text-white font-semibold">{BRAG_ACRONYM} Evidence Trails</dt>
              <dd className="text-slate-400 mt-1">
                {BRAG_ACRONYM} ({BRAG_EXPANSION}) assigns a deterministic ID to every finding. The
                trail maps citations across systems, measures attribution drift, and computes
                confidence from an evidence manifest.
              </dd>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <Fingerprint className="w-5 h-5 text-violet-400 mt-1 shrink-0" />
            <div>
              <dt className="text-white font-semibold">Entity Resolution</dt>
              <dd className="text-slate-400 mt-1">
                AiVIS maintains a stable identity across AI systems. Entity resolution ensures that
                "AiVIS", "aivis.biz", and "AI Visibility Auditing System" all resolve to the same
                canonical node.
              </dd>
            </div>
          </div>
        </dl>
      </section>

      {/* ─── Navigation ──────────────────────────────────────────── */}
      <nav className="flex flex-col sm:flex-row gap-4" aria-label="Related pages">
        <Link
          to="/about-aivis"
          className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 text-sm font-medium transition-colors"
        >
          Full identity definition <ArrowRight className="w-3.5 h-3.5" />
        </Link>
        <Link
          to="/why-aivis-exists"
          className="inline-flex items-center gap-2 text-orange-400 hover:text-orange-300 text-sm font-medium transition-colors"
        >
          Why AiVIS exists <ArrowRight className="w-3.5 h-3.5" />
        </Link>
        <Link
          to="/methodology/cite-ledger"
          className="inline-flex items-center gap-2 text-violet-400 hover:text-violet-300 text-sm font-medium transition-colors"
        >
          Cite Ledger methodology <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </nav>
    </PublicPageFrame>
  );
}
