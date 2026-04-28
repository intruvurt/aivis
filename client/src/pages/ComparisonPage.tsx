import React from 'react';
import { Link } from 'react-router-dom';
import { usePageMeta } from '../hooks/usePageMeta';
import {
  buildBreadcrumbSchema,
  buildItemListSchema,
  buildWebPageSchema,
  buildFaqSchema,
} from '../lib/seoSchema';
import { PROMPT_FAMILIES } from '../content/competitorPromptMap';

const competitors = [
  {
    name: 'Semrush',
    category: 'Traditional SEO suite',
    realTimeAudit: 'Partial',
    multiModelChecks: 'No',
    evidenceLayer: 'Limited',
    aiCitationTesting: 'No',
    aiVisibilityScore: 'Partial',
  },
  {
    name: 'Ahrefs',
    category: 'Backlink + SEO intelligence',
    realTimeAudit: 'Partial',
    multiModelChecks: 'No',
    evidenceLayer: 'Limited',
    aiCitationTesting: 'No',
    aiVisibilityScore: 'Partial',
  },
  {
    name: 'Surfer SEO',
    category: 'Content optimization',
    realTimeAudit: 'Partial',
    multiModelChecks: 'No',
    evidenceLayer: 'Limited',
    aiCitationTesting: 'No',
    aiVisibilityScore: 'Limited',
  },
  {
    name: 'Clearscope',
    category: 'Content scoring',
    realTimeAudit: 'No',
    multiModelChecks: 'No',
    evidenceLayer: 'Limited',
    aiCitationTesting: 'No',
    aiVisibilityScore: 'Limited',
  },
  {
    name: 'MarketMuse',
    category: 'Content planning',
    realTimeAudit: 'No',
    multiModelChecks: 'No',
    evidenceLayer: 'Limited',
    aiCitationTesting: 'No',
    aiVisibilityScore: 'Limited',
  },
  {
    name: 'RankScale',
    category: 'AI-enhanced SEO',
    realTimeAudit: 'Partial',
    multiModelChecks: 'No',
    evidenceLayer: 'No',
    aiCitationTesting: 'No',
    aiVisibilityScore: 'No',
  },
];

const comparisonLinks: { name: string; path: string }[] = [
  { name: 'AiVIS.biz vs Semrush', path: '/compare/aivis-vs-semrush' },
  { name: 'AiVIS.biz vs Ahrefs', path: '/compare/aivis-vs-ahrefs' },
  { name: 'AiVIS.biz vs RankScale', path: '/compare/aivis-vs-rankscale' },
  { name: 'AiVIS.biz vs Otterly.AI', path: '/compare/aivis-vs-otterly' },
  { name: 'AiVIS.biz vs Profound.ai', path: '/compare/aivis-vs-profound' },
  { name: 'AiVIS.biz vs Reaudit', path: '/compare/aivis-vs-reaudit' },
];

const comparisonFaq = [
  {
    question: 'How should I use these comparison pages?',
    answer:
      'Use them for high-intent prompts where buyers compare alternatives. Each page should answer category fit, technical differentiation, and remediation depth in the first screen.',
  },
  {
    question: 'What prompts should these pages target?',
    answer:
      'Prioritize comparison prompts, implementation prompts, and proof prompts. Those families produce the highest displacement risk in AI-generated answers.',
  },
  {
    question: 'How do I validate improvement?',
    answer:
      'Re-run prompt families weekly, then compare citation-state movement against structural changes on each comparison page.',
  },
];

export default function ComparisonPage() {
  usePageMeta({
    title: 'AiVIS.biz vs Alternatives | AI Visibility Tool Comparison',
    description:
      'Compare AiVIS.biz vs Semrush, Ahrefs, Surfer SEO, Clearscope, and MarketMuse for AI citation-readiness and answer engine visibility.',
    path: '/compare',
    structuredData: [
      buildItemListSchema(
        competitors.map((c) => ({ name: `${c.name} – ${c.category}`, path: '/compare' }))
      ),
      buildWebPageSchema({
        path: '/compare',
        name: 'AiVIS.biz vs Alternatives | AI Visibility Tool Comparison',
        description:
          'Side-by-side comparison of AiVIS.biz against traditional SEO and AI visibility tools.',
      }),
      ...buildFaqSchema(comparisonFaq, { path: '/compare' }),
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
            <h1 className="text-2xl font-semibold text-white">AiVIS.biz vs Top Alternatives</h1>
            <p className="text-white/60 text-sm mt-1">
              Use this page for directional positioning only: what AiVIS.biz audits that traditional
              SEO suites and lighter AI tools usually do not.
            </p>
          </div>

          <section className="mb-6 rounded-xl border border-cyan-400/20 bg-cyan-500/[0.08] p-4">
            <h2 className="text-lg font-semibold text-white mb-2">Quick answer</h2>
            <p className="text-sm text-white/75 leading-relaxed">
              Traditional SEO platforms optimize rank and backlinks. AiVIS focuses on answer-engine
              citation readiness: whether AI systems can extract, trust, and cite your content with
              evidence-linked corrective actions.
            </p>
          </section>

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
                  <td className="py-3 pr-4 font-semibold text-white">AiVIS.biz</td>
                  <td className="py-3 pr-4 text-white/80">AiVIS.biz | CITE LEDGER </td>
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
            This is not an independent benchmark study. Competitor rows are directional and inferred
            from publicly marketed capabilities; re-validate before publishing hard comparative
            claims. For public claim boundaries, see{' '}
            <Link to="/methodology" className="text-white/80 hover:text-white">
              Claims & Methodology
            </Link>
            .
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

          <div className="mt-8 border-t border-white/10 pt-6">
            <h2 className="text-lg font-semibold text-white mb-3">Prompt Families To Prioritize</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {PROMPT_FAMILIES.map((family) => (
                <div
                  key={family.id}
                  className="rounded-lg border border-white/10 bg-white/[0.03] p-3"
                >
                  <p className="text-sm font-semibold text-white">{family.title}</p>
                  <p className="text-xs text-white/55 mt-1">{family.objective}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 border-t border-white/10 pt-6 flex flex-wrap gap-3">
            <Link
              to="/compare/ai-visibility-platform-benchmark-2026"
              className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/75 hover:text-white"
            >
              2026 benchmark comparison
            </Link>
            <Link
              to="/research/ai-citation-patterns-2026"
              className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/75 hover:text-white"
            >
              Original citation research
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
