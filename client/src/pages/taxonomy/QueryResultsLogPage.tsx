import React from "react";
import { Link } from "react-router-dom";
import { Terminal, Database, FileSearch, TrendingDown } from "lucide-react";
import { usePageMeta } from "../../hooks/usePageMeta";
import PublicPageFrame from "../../components/PublicPageFrame";
import { buildWebPageSchema, buildBreadcrumbSchema } from "../../lib/seoSchema";

export default function QueryResultsLogPage() {
  usePageMeta({
    title: "Query Results Log — Raw SERP and AI Output Traces",
    description:
      "The Query Results Log records raw SERP snapshots and AI answer traces without interpretation. Each entry is timestamped and linked to the Cite Ledger.",
    path: "/evidence/query-results-log",
    structuredData: [
      buildWebPageSchema({
        name: "Query Results Log — Raw SERP and AI Output Traces",
        description:
          "Raw SERP snapshots and AI answer traces, timestamped and linked to Cite Ledger entries.",
        path: "/evidence/query-results-log",
      }),
      buildBreadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "About AiVIS", path: "/about-aivis" },
        { name: "Evidence", path: "/evidence/ledger-index" },
        { name: "Query Results Log", path: "/evidence/query-results-log" },
      ]),
    ],
  });

  return (
    <PublicPageFrame
      icon={Terminal}
      title="Query Results Log"
      subtitle="Raw SERP snapshots and AI output traces. No interpretation."
      backTo="/evidence/ledger-index"
    >
      {/* ─── Purpose ─────────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold text-white mb-4">Purpose</h2>
        <p className="text-slate-300 leading-relaxed">
          The Query Results Log stores unprocessed output from SERP queries and AI answer engine
          probes. Unlike Citation Reports — which classify outcomes — this log records the raw
          response text, ranking position, and timestamp. No editorial interpretation is applied.
          The log exists to provide primary-source evidence for drift analysis and citation
          verification.
        </p>
      </section>

      {/* ─── What is recorded ────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-xl font-bold text-white mb-4">What Is Recorded</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-300">
            <thead className="text-xs uppercase text-slate-500 border-b border-white/10">
              <tr>
                <th className="py-3 pr-4">Field</th>
                <th className="py-3">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              <tr><td className="py-2 pr-4 font-mono text-green-400">query</td><td>The search query or prompt sent to the engine</td></tr>
              <tr><td className="py-2 pr-4 font-mono text-green-400">engine</td><td>Source engine identifier (Google, Bing, ChatGPT, Perplexity, Claude, etc.)</td></tr>
              <tr><td className="py-2 pr-4 font-mono text-green-400">raw_response</td><td>Unmodified response text or snippet</td></tr>
              <tr><td className="py-2 pr-4 font-mono text-green-400">rank_position</td><td>Position in SERP results (null for AI answer engines)</td></tr>
              <tr><td className="py-2 pr-4 font-mono text-green-400">cited_url</td><td>URL referenced in the response (if any)</td></tr>
              <tr><td className="py-2 pr-4 font-mono text-green-400">entity_match</td><td>Whether the canonical entity name appeared correctly</td></tr>
              <tr><td className="py-2 pr-4 font-mono text-green-400">timestamp</td><td>ISO-8601 capture timestamp</td></tr>
              <tr><td className="py-2 pr-4 font-mono text-green-400">ledger_ref</td><td>Cite Ledger entry sequence number (cross-reference)</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ─── Data sources ────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-xl font-bold text-white mb-4">Data Sources</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg border border-white/10">
            <h3 className="text-white font-semibold text-sm mb-2">SERP Snapshots</h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              Captured via SerpAPI for Alignment+ tiers. Records organic results, featured snippets,
              knowledge panel presence, and People Also Ask entries. Each snapshot is timestamped
              and stored in the <code className="text-cyan-400">serp_snapshots</code> table.
            </p>
          </div>
          <div className="p-4 rounded-lg border border-white/10">
            <h3 className="text-white font-semibold text-sm mb-2">AI Answer Traces</h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              Captured during citation testing (Signal tier). Three AI engines are queried in parallel.
              Each response is recorded verbatim with entity-match scoring. Results are stored in the{" "}
              <code className="text-cyan-400">citation_results</code> table.
            </p>
          </div>
        </div>
      </section>

      {/* ─── No interpretation ───────────────────────────────────── */}
      <section className="mb-10 p-5 rounded-xl border border-yellow-500/20 bg-yellow-500/[0.03]">
        <p className="text-yellow-200/80 text-sm leading-relaxed">
          <strong>Design principle:</strong> The Query Results Log contains only raw data. All
          interpretation, classification, and scoring happens in the Citation Reports and Drift
          Analysis layers. This separation ensures that the primary evidence is never contaminated
          by analytical assumptions.
        </p>
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
        <Link to="/evidence/drift-analysis" className="p-4 rounded-lg border border-white/10 hover:border-orange-500/30 transition-colors group">
          <TrendingDown className="w-4 h-4 text-orange-400 mb-2" />
          <div className="text-sm font-semibold text-white group-hover:text-orange-300 transition-colors">Drift Analysis</div>
          <div className="text-xs text-slate-500 mt-1">Attribution stability</div>
        </Link>
      </nav>
    </PublicPageFrame>
  );
}
