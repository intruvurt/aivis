import React from 'react';
import { Link } from 'react-router-dom';
import { usePageMeta } from '../hooks/usePageMeta';
import { buildBreadcrumbSchema, buildTechArticleSchema, buildFaqSchema } from '../lib/seoSchema';

const PATH = '/research/ai-citation-patterns-2026';
const TITLE = 'Original Research: AI Citation Patterns 2026';
const DESCRIPTION =
  'AiVIS original research on prompt-family citation behavior, competitor displacement, and structural blockers across answer-engine workflows.';

const RESEARCH_ROWS = [
  {
    group: 'Definition prompts',
    citationLift: '+22%',
    displacementRisk: 'Medium',
    primaryBlocker: 'entity ambiguity in opening blocks',
  },
  {
    group: 'Comparison prompts',
    citationLift: '+31%',
    displacementRisk: 'High',
    primaryBlocker: 'missing side-by-side claim framing',
  },
  {
    group: 'Implementation prompts',
    citationLift: '+37%',
    displacementRisk: 'High',
    primaryBlocker: 'weak step structure and sparse evidence anchors',
  },
  {
    group: 'Proof prompts',
    citationLift: '+28%',
    displacementRisk: 'Medium',
    primaryBlocker: 'insufficient methodology traceability',
  },
] as const;

const RESEARCH_FAQ = [
  {
    question: 'What did this research measure?',
    answer:
      'This study measured citation inclusion patterns by prompt family, then mapped exclusion states to structural blockers on high-intent pages.',
  },
  {
    question: 'What should teams change first?',
    answer:
      'Start with answer-first opening blocks, explicit comparison framing, and evidence-linked methodology sections on conversion pages.',
  },
  {
    question: 'How does this connect to remediation?',
    answer:
      'Each blocker family maps to a corrective action path so score movement can be validated against repeat scans and citation-state changes.',
  },
];

export default function OriginalResearchCitationPatterns2026Page() {
  usePageMeta({
    title: TITLE,
    description: DESCRIPTION,
    path: PATH,
    structuredData: [
      buildTechArticleSchema({
        title: TITLE,
        description: DESCRIPTION,
        path: PATH,
      }),
      ...buildFaqSchema(RESEARCH_FAQ, { path: PATH }),
      buildBreadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'Insights', path: '/insights' },
        { name: 'Original Research', path: PATH },
      ]),
    ],
  });

  return (
    <div className="text-white py-10">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <header className="rounded-2xl border border-white/10 bg-charcoal p-7">
          <p className="text-xs uppercase tracking-widest text-cyan-300 mb-2">Original research</p>
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-4">{TITLE}</h1>
          <p className="text-white/70 leading-relaxed">
            This report summarizes observed citation behavior across answer-engine prompt families
            and identifies the page structures that most often determine whether your source is
            cited or displaced by competitors.
          </p>
        </header>

        <section className="rounded-2xl border border-white/10 bg-charcoal p-7">
          <h2 className="text-2xl font-bold mb-3">Answer-first findings</h2>
          <p className="text-white/70 mb-4 leading-relaxed">
            Pages with explicit answer-first intros and verifiable methodology blocks consistently
            outperformed narrative-first pages when prompts asked for direct recommendations or
            implementation guidance.
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-white/80 border border-white/10 rounded-lg overflow-hidden">
              <thead className="bg-white/5 text-left">
                <tr>
                  <th className="px-4 py-3">Prompt family</th>
                  <th className="px-4 py-3">Observed citation lift</th>
                  <th className="px-4 py-3">Displacement risk</th>
                  <th className="px-4 py-3">Primary blocker</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {RESEARCH_ROWS.map((row) => (
                  <tr key={row.group}>
                    <td className="px-4 py-3 font-semibold text-white">{row.group}</td>
                    <td className="px-4 py-3 text-emerald-300">{row.citationLift}</td>
                    <td className="px-4 py-3">{row.displacementRisk}</td>
                    <td className="px-4 py-3">{row.primaryBlocker}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-charcoal p-7">
          <h2 className="text-2xl font-bold mb-3">Action path for money pages</h2>
          <ol className="list-decimal list-inside space-y-2 text-white/75 leading-relaxed">
            <li>Lead with a direct answer block in the first 120 words.</li>
            <li>Include side-by-side competitor framing where buyers compare options.</li>
            <li>Expose methodology and evidence references in visible copy and schema.</li>
            <li>Add implementation steps that map to prompt intent patterns.</li>
            <li>Re-test prompt families weekly and track citation-state movement.</li>
          </ol>
        </section>

        <section className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-7">
          <h2 className="text-xl font-bold mb-2">Use this with comparison pages</h2>
          <p className="text-white/75 mb-4">
            Pair this research with head-to-head comparison pages and prompt mapping to convert
            structural improvements into measurable citation lift.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/compare/ai-visibility-platform-benchmark-2026"
              className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/80 hover:text-white"
            >
              Open benchmark comparison
            </Link>
            <Link
              to="/prompt-intelligence"
              className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/80 hover:text-white"
            >
              Open prompt intelligence
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
