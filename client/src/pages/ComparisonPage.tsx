import React from "react";
import { Link } from "react-router-dom";
import { usePageMeta } from "../hooks/usePageMeta";
import { buildBreadcrumbSchema, buildItemListSchema, buildWebPageSchema } from "../lib/seoSchema";

const competitors = [
  {
    name: "Semrush",
    category: "Traditional SEO suite",
    realTimeAudit: "Partial",
    multiModelChecks: "No",
    evidenceLayer: "Limited",
    aiCitationTesting: "No",
    aiVisibilityScore: "Partial",
  },
  {
    name: "Ahrefs",
    category: "Backlink + SEO intelligence",
    realTimeAudit: "Partial",
    multiModelChecks: "No",
    evidenceLayer: "Limited",
    aiCitationTesting: "No",
    aiVisibilityScore: "Partial",
  },
  {
    name: "Surfer SEO",
    category: "Content optimization",
    realTimeAudit: "Partial",
    multiModelChecks: "No",
    evidenceLayer: "Limited",
    aiCitationTesting: "No",
    aiVisibilityScore: "Limited",
  },
  {
    name: "Clearscope",
    category: "Content scoring",
    realTimeAudit: "No",
    multiModelChecks: "No",
    evidenceLayer: "Limited",
    aiCitationTesting: "No",
    aiVisibilityScore: "Limited",
  },
  {
    name: "MarketMuse",
    category: "Content planning",
    realTimeAudit: "No",
    multiModelChecks: "No",
    evidenceLayer: "Limited",
    aiCitationTesting: "No",
    aiVisibilityScore: "Limited",
  },
  {
    name: "RankScale",
    category: "AI-enhanced SEO",
    realTimeAudit: "Partial",
    multiModelChecks: "No",
    evidenceLayer: "No",
    aiCitationTesting: "No",
    aiVisibilityScore: "No",
  },
];

const comparisonLinks: { name: string; path: string }[] = [
  { name: "AiVIS vs Semrush", path: "/compare/aivis-vs-semrush" },
  { name: "AiVIS vs Ahrefs", path: "/compare/aivis-vs-ahrefs" },
  { name: "AiVIS vs RankScale", path: "/compare/aivis-vs-rankscale" },
  { name: "AiVIS vs Otterly.AI", path: "/compare/aivis-vs-otterly" },
  { name: "AiVIS vs Profound.ai", path: "/compare/aivis-vs-profound" },
  { name: "AiVIS vs Reaudit", path: "/compare/aivis-vs-reaudit" },
];

export default function ComparisonPage() {
  usePageMeta({
    title: "AiVIS vs Alternatives | AI Visibility Tool Comparison",
    description: 'Compare AiVIS vs Semrush, Ahrefs, Surfer SEO, Clearscope, and MarketMuse for AI citation-readiness and answer engine visibility.',
    path: "/compare",
    structuredData: [
      buildItemListSchema(
        competitors.map((c) => ({ name: `${c.name} – ${c.category}`, path: '/compare' }))
      ),
      buildWebPageSchema({
        path: '/compare',
        name: 'AiVIS vs Alternatives | AI Visibility Tool Comparison',
        description: 'Side-by-side comparison of AiVIS against traditional SEO and AI visibility tools.',
      }),
      buildBreadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'Comparison', path: '/compare' },
      ]),
    ],
  });

  return (
    <div className="text-white py-10">
      <section className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pb-12">
        <div className="card-charcoal rounded-2xl p-6 border border-white/10">
          <div className="mb-5">
            <h1 className="text-2xl font-semibold text-white">AiVIS vs Top Alternatives</h1>
            <p className="text-white/60 text-sm mt-1">Use this page for directional positioning only: what AiVIS audits that traditional SEO suites and lighter AI tools usually do not.</p>
          </div>

          <div className="mb-6 rounded-xl border border-white/10 bg-charcoal-light/40 p-3">
            <img
              src="/images/competitor-gap-chart.svg"
              alt="Positioning chart for AI visibility capabilities"
              className="w-full h-auto rounded-lg"
              loading="lazy"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-white/70">
                  <th className="py-3 pr-4 font-medium">Platform</th>
                  <th className="py-3 pr-4 font-medium">Primary Category</th>
                  <th className="py-3 pr-4 font-medium">Real-Time URL Audit</th>
                  <th className="py-3 pr-4 font-medium">Triple-Check / Multi-Model</th>
                  <th className="py-3 pr-4 font-medium">Evidence Layer</th>
                  <th className="py-3 pr-4 font-medium">AI Citation Testing</th>
                  <th className="py-3 font-medium">AI Visibility Scoring</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-white/10/60 bg-charcoal/30">
                  <td className="py-3 pr-4 font-semibold text-white">AiVIS</td>
                  <td className="py-3 pr-4 text-white/80">AI Visibility Audit Platform</td>
                  <td className="py-3 pr-4 text-white/80">Yes</td>
                  <td className="py-3 pr-4 text-white/80">Yes (Signal + Score Fix)</td>
                  <td className="py-3 pr-4 text-white/80">Yes (BRAG)</td>
                  <td className="py-3 pr-4 text-white/80">Yes (Signal + Score Fix)</td>
                  <td className="py-3 text-white/80">Yes</td>
                </tr>
                {competitors.map((c) => (
                  <tr key={c.name} className="border-b border-white/10/40 last:border-b-0">
                    <td className="py-3 pr-4 text-white/80 font-medium">{c.name}</td>
                    <td className="py-3 pr-4 text-white/65">{c.category}</td>
                    <td className="py-3 pr-4 text-white/65">{c.realTimeAudit}</td>
                    <td className="py-3 pr-4 text-white/65">{c.multiModelChecks}</td>
                    <td className="py-3 pr-4 text-white/65">{c.evidenceLayer}</td>
                    <td className="py-3 pr-4 text-white/65">{c.aiCitationTesting}</td>
                    <td className="py-3 text-white/65">{c.aiVisibilityScore}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-white/50 mt-4">
            This is not an independent benchmark study. Competitor rows are directional and inferred from publicly marketed capabilities; re-validate before publishing hard comparative claims.
            {' '}For public claim boundaries, see <Link to="/methodology" className="text-white/80 hover:text-white">Claims & Methodology</Link>.
          </p>

          {/* ── Detailed Comparison Links ── */}
          <div className="mt-8 border-t border-white/10 pt-6">
            <h2 className="text-lg font-semibold text-white mb-3">Detailed Comparisons</h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {comparisonLinks.map((l) => (
                <Link
                  key={l.path}
                  to={l.path}
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/75 hover:text-white hover:border-cyan-400/30 hover:bg-cyan-500/[0.06] transition"
                >
                  {l.name} &rarr;
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
