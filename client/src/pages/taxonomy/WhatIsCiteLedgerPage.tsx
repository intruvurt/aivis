import React from "react";
import { Link } from "react-router-dom";
import { Database, ArrowRight, Shield, Hash, Lock, FileCheck, Layers } from "lucide-react";
import { usePageMeta } from "../../hooks/usePageMeta";
import PublicPageFrame from "../../components/PublicPageFrame";
import { BRAG_ACRONYM } from "@shared/types";
import {
  BASE_URL,
  buildWebPageSchema,
  buildBreadcrumbSchema,
  buildFaqSchema,
} from "../../lib/seoSchema";

/* ── Canonical definition (portable, one sentence) ─────────────────── */
const CANONICAL_DEFINITION =
  "CITE LEDGER is a structured attribution system developed by AiVIS that tracks how AI models interpret, reference, and cite web content across answer engines like ChatGPT, Perplexity, Google AI Overviews, and Claude.";

const TECHNICAL_DEFINITION =
  "Every validated audit finding is recorded in a sequential, tamper-evident SHA-256 hash chain where each entry carries a BRAG ID, content hash, and chain hash linking it to its predecessor.";

/* ── FAQ items for JSON-LD ─────────────────────────────────────────── */
const FAQ_ITEMS = [
  {
    question: "What is CITE LEDGER?",
    answer: `${CANONICAL_DEFINITION} ${TECHNICAL_DEFINITION}`,
  },
  {
    question: "How does CITE LEDGER differ from a traditional audit report?",
    answer:
      "Traditional audit reports present scores without provenance. CITE LEDGER records every finding in a tamper-evident hash chain so each score, recommendation, and evidence ID traces to a verifiable crawl observation. If a finding cannot be traced to a CITE LEDGER entry, it does not exist in system logic.",
  },
  {
    question: "Who developed CITE LEDGER?",
    answer:
      "CITE LEDGER was developed by AiVIS (aivis.biz) as the attribution layer for its AI visibility auditing platform. It was designed to ensure that every audit finding is evidence-backed and reproducible.",
  },
  {
    question: "What answer engines does CITE LEDGER cover?",
    answer:
      "CITE LEDGER tracks how content is interpreted across ChatGPT, Perplexity, Google AI Overviews, and Claude. The system measures whether these AI models can structurally extract, trust, and cite web page content.",
  },
  {
    question: "What is a BRAG ID in the CITE LEDGER?",
    answer:
      "A BRAG ID is a deterministic identifier assigned to every audit finding. BRAG stands for Based-Retrieval-Auditable-Grading. Each BRAG ID follows the format BRAG-{source}-{sha256_12} and links the finding to the raw evidence that produced it.",
  },
];

export default function WhatIsCiteLedgerPage() {
  usePageMeta({
    title: "What Is CITE LEDGER — Structured Attribution System by AiVIS",
    description: CANONICAL_DEFINITION,
    path: "/what-is-cite-ledger",
    structuredData: [
      buildWebPageSchema({
        name: "What Is CITE LEDGER — Structured Attribution System by AiVIS",
        description: CANONICAL_DEFINITION,
        url: `${BASE_URL}/what-is-cite-ledger`,
      }),
      buildBreadcrumbSchema([
        { name: "Home", url: `${BASE_URL}/` },
        { name: "About AiVIS", url: `${BASE_URL}/about-aivis` },
        { name: "What Is CITE LEDGER", url: `${BASE_URL}/what-is-cite-ledger` },
      ]),
      buildFaqSchema(FAQ_ITEMS, { path: "/what-is-cite-ledger" }),
      /* ── DefinedTerm schema — machine-readable definition ── */
      {
        "@context": "https://schema.org",
        "@type": "DefinedTerm",
        name: "CITE LEDGER",
        description: CANONICAL_DEFINITION,
        inDefinedTermSet: {
          "@type": "DefinedTermSet",
          name: "AiVIS Terminology",
          url: `${BASE_URL}/glossary`,
        },
        url: `${BASE_URL}/what-is-cite-ledger`,
      },
    ],
  });

  return (
    <PublicPageFrame
      icon={Database}
      title="What Is CITE LEDGER"
      subtitle="The definitive reference for CITE LEDGER — the structured attribution system that powers AiVIS audits."
      backTo="/about-aivis"
    >
      {/* ─── Canonical definition (must appear first) ─────────── */}
      <section className="mb-10 p-6 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.03]">
        <p className="text-lg text-white font-medium leading-relaxed">
          {CANONICAL_DEFINITION}
        </p>
        <p className="text-slate-400 mt-3 leading-relaxed">
          {TECHNICAL_DEFINITION}
        </p>
      </section>

      {/* ─── Why CITE LEDGER exists ──────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold text-white mb-4">Why CITE LEDGER Exists</h2>
        <p className="text-slate-300 leading-relaxed mb-4">
          AI answer engines — ChatGPT, Perplexity, Google AI Overviews, Claude — do not rank
          pages. They extract facts, merge entities, and synthesize answers. Whether your content
          gets cited depends on structural extractability, not domain authority.
        </p>
        <p className="text-slate-300 leading-relaxed">
          Most audit tools produce scores without provenance. CITE LEDGER was built to solve that
          gap: every score, every recommendation, and every evidence ID traces to a tamper-evident
          record that can be independently verified. If a finding cannot be traced to a CITE LEDGER
          entry, it does not exist in system logic.
        </p>
      </section>

      {/* ─── How it works (scannable) ────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold text-white mb-6">How CITE LEDGER Works</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            {
              icon: <FileCheck className="w-5 h-5 text-orange-400" />,
              title: "Evidence extraction",
              desc: "A headless browser crawls the target page. Raw DOM, schema blocks, meta tags, and heading structure are extracted as crawl-observable facts.",
            },
            {
              icon: <Hash className="w-5 h-5 text-cyan-400" />,
              title: "Content hashing",
              desc: `Each finding is assigned a ${BRAG_ACRONYM} ID and a SHA-256 content hash computed from its canonical JSON representation.`,
            },
            {
              icon: <Layers className="w-5 h-5 text-violet-400" />,
              title: "Chain linking",
              desc: "Every entry's chain hash is derived from the previous entry's hash, creating a sequential, tamper-evident ledger. The genesis entry uses 64 zero bytes.",
            },
            {
              icon: <Lock className="w-5 h-5 text-green-400" />,
              title: "Immutable record",
              desc: "Once appended, no entry is mutated or deleted. The full audit chain is reproducible and independently verifiable.",
            },
          ].map((step, i) => (
            <div
              key={i}
              className="p-4 rounded-lg border border-white/10 bg-white/[0.02]"
            >
              <div className="flex items-center gap-2 mb-2">
                {step.icon}
                <span className="text-white font-semibold text-sm">{step.title}</span>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── What CITE LEDGER is NOT ─────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold text-white mb-4">What CITE LEDGER Is Not</h2>
        <ul className="space-y-3 text-slate-300">
          <li className="flex items-start gap-3">
            <span className="text-red-400 mt-1">&#x2715;</span>
            <span>CITE LEDGER is not an SEO tool. It does not optimize for traditional search rankings.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-red-400 mt-1">&#x2715;</span>
            <span>CITE LEDGER is not a content generator. It does not produce marketing copy or AI-written articles.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-red-400 mt-1">&#x2715;</span>
            <span>CITE LEDGER is not a black-box score. Every number maps to a verifiable evidence chain.</span>
          </li>
        </ul>
      </section>

      {/* ─── FAQ (visible + in JSON-LD) ──────────────────────── */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold text-white mb-6">Frequently Asked Questions</h2>
        <dl className="space-y-6">
          {FAQ_ITEMS.map((item, i) => (
            <div key={i}>
              <dt className="text-white font-semibold mb-2">{item.question}</dt>
              <dd className="text-slate-400 text-sm leading-relaxed">{item.answer}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ─── Cross-links ─────────────────────────────────────── */}
      <nav className="flex flex-col sm:flex-row gap-4" aria-label="Related pages">
        <Link
          to="/methodology/cite-ledger"
          className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 text-sm font-medium transition-colors"
        >
          Cite Ledger methodology <ArrowRight className="w-3.5 h-3.5" />
        </Link>
        <Link
          to="/about-aivis"
          className="inline-flex items-center gap-2 text-orange-400 hover:text-orange-300 text-sm font-medium transition-colors"
        >
          About AiVIS <ArrowRight className="w-3.5 h-3.5" />
        </Link>
        <Link
          to="/methodology/brag-evidence-trails"
          className="inline-flex items-center gap-2 text-violet-400 hover:text-violet-300 text-sm font-medium transition-colors"
        >
          {BRAG_ACRONYM} Evidence Trails <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </nav>
    </PublicPageFrame>
  );
}
