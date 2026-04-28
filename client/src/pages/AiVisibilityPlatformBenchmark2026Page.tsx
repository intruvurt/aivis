import React from 'react';
import { Link } from 'react-router-dom';
import { usePageMeta } from '../hooks/usePageMeta';
import { buildBreadcrumbSchema, buildWebPageSchema, buildFaqSchema } from '../lib/seoSchema';
import { COMPETITOR_PROMPT_MAP } from '../content/competitorPromptMap';

const PATH = '/compare/ai-visibility-platform-benchmark-2026';
const TITLE = 'AI Visibility Platform Benchmark 2026';
const DESCRIPTION =
  'Comparison benchmark for AI visibility platforms with prompt-family fit, remediation depth, and citation-readiness orientation.';

const FAQ = [
  {
    question: 'How is this benchmark different from feature grids?',
    answer:
      'This benchmark maps platform positioning to prompt families and remediation depth, not just headline feature checkboxes.',
  },
  {
    question: 'Which pages should I optimize first?',
    answer:
      'Start with the homepage, pricing page, and your top comparison pages because they capture most high-intent prompt traffic.',
  },
];

export default function AiVisibilityPlatformBenchmark2026Page() {
  usePageMeta({
    title: TITLE,
    description: DESCRIPTION,
    path: PATH,
    structuredData: [
      buildWebPageSchema({ path: PATH, name: TITLE, description: DESCRIPTION }),
      ...buildFaqSchema(FAQ, { path: PATH }),
      buildBreadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'Comparison', path: '/compare' },
        { name: 'Benchmark 2026', path: PATH },
      ]),
    ],
  });

  return (
    <div className="text-white py-10">
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <header className="rounded-2xl border border-white/10 bg-charcoal p-7">
          <p className="text-xs uppercase tracking-widest text-cyan-300 mb-2">
            Comparison benchmark
          </p>
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-4">{TITLE}</h1>
          <p className="text-white/70 leading-relaxed">
            A prompt-driven benchmark of AI visibility platforms. Use this page when buyers ask
            direct comparison questions and expect clear differences in citation-readiness
            workflows.
          </p>
        </header>

        <section className="rounded-2xl border border-white/10 bg-charcoal p-7">
          <h2 className="text-2xl font-bold mb-3">Answer-first benchmark view</h2>
          <p className="text-white/70 mb-4">
            The table below maps each competitor to prompt families where evaluation pressure is
            highest and where citation-readiness narratives usually break.
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-white/80 border border-white/10 rounded-lg overflow-hidden">
              <thead className="bg-white/5 text-left">
                <tr>
                  <th className="px-4 py-3">Platform</th>
                  <th className="px-4 py-3">Strongest value area</th>
                  <th className="px-4 py-3">Primary weak area</th>
                  <th className="px-4 py-3">High-value prompt families</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {COMPETITOR_PROMPT_MAP.map((row) => (
                  <tr key={row.competitor}>
                    <td className="px-4 py-3 font-semibold text-white">{row.competitor}</td>
                    <td className="px-4 py-3">{row.strongestOn.join(', ')}</td>
                    <td className="px-4 py-3">{row.weakerOn.join(', ')}</td>
                    <td className="px-4 py-3 text-cyan-200">
                      {row.suggestedPromptFamilies.join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-charcoal p-7">
          <h2 className="text-2xl font-bold mb-3">Money-page publishing priorities</h2>
          <ul className="list-disc list-inside space-y-2 text-white/75">
            <li>Homepage: category definition + citation-state narrative.</li>
            <li>Pricing: explicit plan-to-outcome mapping for prompt intent.</li>
            <li>Comparison pages: direct displacement and action-path framing.</li>
            <li>Methodology: verifiable evidence pipeline and scoring logic.</li>
            <li>Research pages: original findings tied to repeatable prompt sets.</li>
          </ul>
        </section>

        <section className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-7">
          <h2 className="text-xl font-bold mb-2">Continue to original research</h2>
          <p className="text-white/75 mb-4">
            Review the latest citation-pattern study, then route findings into your prompt and
            comparison content updates.
          </p>
          <Link
            to="/research/ai-citation-patterns-2026"
            className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/85 hover:text-white"
          >
            Open original research report
          </Link>
        </section>
      </main>
    </div>
  );
}
