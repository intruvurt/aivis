import React from 'react';
import { Link } from 'react-router-dom';
import { usePageMeta } from '../hooks/usePageMeta';
import { getInsightBySlug } from '../content/insights';
import { buildArticleSchema, buildBreadcrumbSchema } from '../lib/seoSchema';

const ARTICLE = getInsightBySlug('aeo-playbook-2026');

const FRAMEWORK = [
  'Map high-intent user questions and cluster them by core topic.',
  'Write direct first-sentence answers under each H2/H3 before deeper detail.',
  'Use consistent entity naming and semantic anchors across related pages.',
  'Add comparison and procedure sections to support follow-up query synthesis.',
  'Re-audit and patch weak blocks based on extracted-answer fidelity.',
];

export default function AEOPlaybook2026() {
  if (!ARTICLE) return null;

  usePageMeta({
    title: 'AEO Playbook 2026 | Answer Engine Optimization',
    description: ARTICLE.description,
    path: ARTICLE.path,
    ogTitle: ARTICLE.title,
    structuredData: [
      buildArticleSchema({
        title: ARTICLE.title,
        description: ARTICLE.description,
        path: ARTICLE.path,
        datePublished: ARTICLE.publishedAt,
      }),
      buildBreadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'Insights', path: '/insights' },
        { name: ARTICLE.title, path: ARTICLE.path },
      ]),
    ],
  });

  return (
    <div className="text-white">
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <header className="mb-8 rounded-2xl border border-white/10 bg-white/[0.04] p-8">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">AEO Playbook</p>
          <h1 className="text-3xl font-semibold sm:text-4xl">{ARTICLE.title}</h1>
          <p className="mt-4 text-white/75">{ARTICLE.description}</p>
        </header>

        <section className="mb-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-2xl font-semibold">What AEO optimizes for</h2>
          <p className="mt-3 text-white/75">
            Answer Engine Optimization improves extractability and answer quality so model-generated responses can quote
            your content accurately.
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-white/80 marker:text-cyan-300">
            <li>Direct definitions and question-aligned subheadings</li>
            <li>Layered answer depth (short, medium, deep)</li>
            <li>Low-noise language with high semantic clarity</li>
            <li>Consistent terminology across your domain</li>
          </ul>
        </section>

        <section className="mb-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-2xl font-semibold">Implementation framework</h2>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-white/80 marker:text-cyan-300">
            {FRAMEWORK.map((step) => (
              <li key={step} className="leading-relaxed">{step}</li>
            ))}
          </ol>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-2xl font-semibold">Q/A reference</h2>
          <div className="space-y-4">
            {ARTICLE.faq.map((item) => (
              <article key={item.question} className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                <h3 className="text-lg font-semibold text-white/90">Q: {item.question}</h3>
                <p className="mt-2 text-white/75">A: {item.answer}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-xl font-semibold">Continue the cluster</h2>
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <Link to="/ai-search-visibility-2026" className="rounded-lg border border-white/20 px-3 py-2 text-white/80 hover:text-white">
              AI Search Visibility 2026
            </Link>
            <Link to="/geo-ai-ranking-2026" className="rounded-lg border border-white/20 px-3 py-2 text-white/80 hover:text-white">
              Geo AI Ranking 2026
            </Link>
            <Link to="/insights" className="rounded-lg border border-white/20 px-3 py-2 text-white/80 hover:text-white">
              Insights Hub
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
