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
    <div className="min-h-screen page-splash-bg bg-[#2e3646] text-white">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <header className="mb-10 rounded-2xl border border-white/10/70 bg-charcoal-deep p-8">
          <p className="text-xs font-semibold tracking-wide uppercase text-white/85 mb-3">AEO Playbook</p>
          <h1 className="text-3xl md:text-4xl brand-title-lg mb-4">{ARTICLE.title}</h1>
          <p className="text-white/75 leading-relaxed">{ARTICLE.description}</p>
        </header>

        <section className="mb-10 rounded-2xl border border-white/10/70 bg-charcoal p-6">
          <h2 className="text-2xl brand-title mb-4">What AEO Optimizes For</h2>
          <p className="text-white/75 leading-relaxed mb-4">
            Answer Engine Optimization focuses on extractability and answer quality. The goal is to make each core section easy for
            AI systems to identify, reuse, and cite with minimal ambiguity.
          </p>
          <ul className="space-y-2 list-disc list-inside text-white/75">
            <li>Direct definitions and question-aligned subheadings</li>
            <li>Layered answer depth (short, medium, deep)</li>
            <li>Low-noise language with high semantic clarity</li>
            <li>Consistent terminology across your domain</li>
          </ul>
        </section>

        <section className="mb-10 rounded-2xl border border-white/10/70 bg-charcoal p-6">
          <h2 className="text-2xl brand-title mb-4">Implementation Framework</h2>
          <ol className="space-y-3 list-decimal list-inside text-white/75">
            {FRAMEWORK.map((step) => (
              <li key={step} className="leading-relaxed">{step}</li>
            ))}
          </ol>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl brand-title mb-4">Q/A Reference</h2>
          <div className="space-y-4">
            {ARTICLE.faq.map((item) => (
              <article key={item.question} className="rounded-xl border border-white/10 bg-charcoal p-5">
                <h3 className="text-lg font-semibold text-white/85 mb-2">Q: {item.question}</h3>
                <p className="text-white/75 leading-relaxed">A: {item.answer}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/12/20 bg-charcoal/5 p-6">
          <h2 className="text-xl brand-title mb-3">Continue the Cluster</h2>
          <div className="flex flex-wrap gap-3">
            <Link to="/ai-search-visibility-2026" className="text-sm text-white/85 hover:text-white/85 font-semibold">
              Ai Visibility Intelligence Audits in 2026 →
            </Link>
            <Link to="/geo-ai-ranking-2026" className="text-sm text-white/85 hover:text-white/85 font-semibold">
              Geo AI Ranking in 2026 →
            </Link>
            <Link to="/insights" className="text-sm text-white/85 hover:text-white/85 font-semibold">
              Back to Insights Hub →
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
