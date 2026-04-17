import React from "react";
import { Link } from "react-router-dom";
import { Database, ArrowRight, Hash, Lock, Link2, Shield } from "lucide-react";
import { usePageMeta } from "../../hooks/usePageMeta";
import PublicPageFrame from "../../components/PublicPageFrame";
import { BRAG_ACRONYM } from "@shared/types";
import { buildWebPageSchema, buildBreadcrumbSchema } from "../../lib/seoSchema";

export default function CiteLedgerPage() {
  usePageMeta({
    title: "Cite Ledger Methodology — How AiVIS Records Evidence",
    description:
      "CITE LEDGER is a structured attribution system developed by AiVIS that tracks how AI models interpret, reference, and cite web content across answer engines like ChatGPT, Perplexity, Google AI Overviews, and Claude.",
    path: "/methodology/cite-ledger",
    structuredData: [
      buildWebPageSchema({
        name: "Cite Ledger Methodology — How AiVIS Records Evidence",
        description:
          "CITE LEDGER is a structured attribution system developed by AiVIS that tracks how AI models interpret, reference, and cite web content across answer engines like ChatGPT, Perplexity, Google AI Overviews, and Claude.",
        url: "https://aivis.biz/methodology/cite-ledger",
      }),
      buildBreadcrumbSchema([
        { name: "Home", url: "https://aivis.biz/" },
        { name: "About AiVIS", url: "https://aivis.biz/about-aivis" },
        { name: "Methodology", url: "https://aivis.biz/methodology" },
        { name: "Cite Ledger", url: "https://aivis.biz/methodology/cite-ledger" },
      ]),
    ],
  });

  return (
    <PublicPageFrame
      icon={Database}
      title="Cite Ledger"
      subtitle="The highest-authority page in the AiVIS taxonomy. This is how truth is generated."
      backTo="/methodology"
    >
      {/* ─── Definition ──────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold text-white mb-4">Definition</h2>
        <p className="text-slate-300 leading-relaxed text-lg mb-4">
          CITE LEDGER is a structured attribution system developed by AiVIS that tracks how AI
          models interpret, reference, and cite web content across answer engines like ChatGPT,
          Perplexity, Google AI Overviews, and Claude.
        </p>
        <p className="text-slate-300 leading-relaxed">
          Every validated audit finding is recorded in a sequential, tamper-evident SHA-256 hash
          chain where each entry carries a {BRAG_ACRONYM} ID, content hash, and chain hash linking
          it to its predecessor. It serves as the single source of truth for all scores,
          recommendations, and evidence IDs. A finding that does not appear in the Cite Ledger
          does not exist in system logic.
        </p>
      </section>

      {/* ─── How citations are captured ──────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold text-white mb-6">How Citations Are Captured</h2>
        <ol className="space-y-6">
          {[
            {
              icon: <Shield className="w-5 h-5 text-orange-400" />,
              title: "Pipeline produces a finding",
              desc: `Each audit stage (scrape → evidence → rules → ai_analysis → brag_gate → finalize) emits findings with evidence keys. The finding carries a ${BRAG_ACRONYM} ID generated deterministically from its source and content hash.`,
            },
            {
              icon: <Hash className="w-5 h-5 text-cyan-400" />,
              title: "Content hash computed",
              desc: "A SHA-256 hash is computed over the finding's canonical JSON representation (sorted keys, no whitespace). This is the content_hash.",
            },
            {
              icon: <Link2 className="w-5 h-5 text-violet-400" />,
              title: "Chain hash derived",
              desc: "The chain_hash is computed as SHA-256(previous_hash + content_hash). For the genesis entry (sequence 0), the previous_hash is 64 zero bytes.",
            },
            {
              icon: <Lock className="w-5 h-5 text-green-400" />,
              title: "Entry appended",
              desc: "The entry is appended to the ledger with its sequence number, BRAG ID, content hash, chain hash, and ISO-8601 timestamp. Once appended, the entry is immutable.",
            },
          ].map((step, i) => (
            <li key={i} className="flex gap-4">
              <div className="flex-shrink-0 mt-1">{step.icon}</div>
              <div>
                <div className="text-white font-semibold mb-1">
                  {i + 1}. {step.title}
                </div>
                <p className="text-slate-400 text-sm leading-relaxed">{step.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ─── Entry structure ─────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold text-white mb-4">Entry Structure</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-300">
            <thead className="text-xs uppercase text-slate-500 border-b border-white/10">
              <tr>
                <th className="py-3 pr-4">Field</th>
                <th className="py-3 pr-4">Type</th>
                <th className="py-3">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              <tr><td className="py-2 pr-4 font-mono text-cyan-400">sequence</td><td className="pr-4">number</td><td>Monotonic index starting at 0</td></tr>
              <tr><td className="py-2 pr-4 font-mono text-cyan-400">brag_id</td><td className="pr-4">string</td><td>{BRAG_ACRONYM} ID ({`BRAG-{source}-{sha256_12}`})</td></tr>
              <tr><td className="py-2 pr-4 font-mono text-cyan-400">content_hash</td><td className="pr-4">string</td><td>SHA-256 of canonical finding JSON</td></tr>
              <tr><td className="py-2 pr-4 font-mono text-cyan-400">previous_hash</td><td className="pr-4">string</td><td>Chain hash of preceding entry (genesis: 64×0)</td></tr>
              <tr><td className="py-2 pr-4 font-mono text-cyan-400">chain_hash</td><td className="pr-4">string</td><td>SHA-256(previous_hash + content_hash)</td></tr>
              <tr><td className="py-2 pr-4 font-mono text-cyan-400">timestamp</td><td className="pr-4">string</td><td>ISO-8601 creation timestamp</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ─── Storage rules ───────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold text-white mb-4">Storage Rules</h2>
        <ul className="space-y-3 text-slate-300 text-sm">
          <li className="flex gap-2"><span className="text-green-400">●</span> <strong>Immutability:</strong> Once appended, no entry may be mutated or deleted.</li>
          <li className="flex gap-2"><span className="text-green-400">●</span> <strong>Traceability:</strong> Every entry's chain_hash links to its predecessor. Break any link and the chain invalidates downstream.</li>
          <li className="flex gap-2"><span className="text-green-400">●</span> <strong>Determinism:</strong> Given the same pipeline inputs, the same ledger sequence is produced.</li>
          <li className="flex gap-2"><span className="text-green-400">●</span> <strong>No evidence, no entry:</strong> Findings without validated evidence keys are rejected before ledger insertion.</li>
        </ul>
      </section>

      {/* ─── Cross-layer navigation ──────────────────────────────── */}
      <nav className="grid sm:grid-cols-3 gap-4 mt-8" aria-label="Related methodology">
        <Link to="/methodology/brag-evidence-trails" className="p-4 rounded-lg border border-white/10 hover:border-orange-500/30 transition-colors group">
          <Shield className="w-4 h-4 text-orange-400 mb-2" />
          <div className="text-sm font-semibold text-white group-hover:text-orange-300 transition-colors">BRAG Evidence Trails</div>
          <div className="text-xs text-slate-500 mt-1">How findings are identified</div>
        </Link>
        <Link to="/methodology/triple-check-protocol" className="p-4 rounded-lg border border-white/10 hover:border-blue-500/30 transition-colors group">
          <Hash className="w-4 h-4 text-blue-400 mb-2" />
          <div className="text-sm font-semibold text-white group-hover:text-blue-300 transition-colors">Triple-Check Protocol</div>
          <div className="text-xs text-slate-500 mt-1">Multi-model verification</div>
        </Link>
        <Link to="/evidence/ledger-index" className="p-4 rounded-lg border border-white/10 hover:border-green-500/30 transition-colors group">
          <Database className="w-4 h-4 text-green-400 mb-2" />
          <div className="text-sm font-semibold text-white group-hover:text-green-300 transition-colors">Evidence Ledger Index</div>
          <div className="text-xs text-slate-500 mt-1">Browse recorded entries</div>
        </Link>
      </nav>
    </PublicPageFrame>
  );
}
