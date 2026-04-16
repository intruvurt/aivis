import React from 'react';
import { Link } from 'react-router-dom';
import { usePageMeta } from '../hooks/usePageMeta';
import { getInsightBySlug } from '../content/insights';
import { buildArticleSchema, buildBreadcrumbSchema, buildNewsArticleSchema } from '../lib/seoSchema';

const ARTICLE = getInsightBySlug('geo-ai-ranking-2026');

const LOCAL_SIGNALS = [
  'Region-specific terminology and entity references',
  'Local use-case examples tied to buyer intent',
  'Market-appropriate pricing and service framing',
  'Geo-specific FAQ blocks that match conversational queries',
  'Location-aware internal links across your cluster pages',
];

export default function GeoAIRanking2026() {
  if (!ARTICLE) return null;

  usePageMeta({
    title: 'Geo AI Ranking 2026 | Local AI Visibility & Geo-Adaptive Ranking',
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
      buildNewsArticleSchema({
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
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <header className="mb-10 rounded-2xl border border-white/10/70 bg-charcoal-deep p-8">
          <p className="text-xs font-semibold tracking-wide uppercase text-white/85 mb-3">Geo AI Playbook</p>
          <h1 className="text-3xl md:text-4xl brand-title-lg mb-4">{ARTICLE.title}</h1>
          <p className="text-white/75 leading-relaxed">{ARTICLE.description}</p>
        </header>

        <section className="mb-10 rounded-2xl border border-white/10/70 bg-charcoal p-6">
          <h2 className="text-2xl brand-title mb-4">Why Geo Relevance Matters in AI Search</h2>
          <p className="text-white/75 leading-relaxed">
            AI answer systems adapt output by local behavior patterns. Two pages with similar quality can perform very differently across
            markets if one page contains region-aligned language, entities, and use cases.
          </p>
        </section>

        <section className="mb-10 rounded-2xl border border-white/10/70 bg-charcoal p-6">
          <h2 className="text-2xl brand-title mb-4">Local Signal Checklist</h2>
          <ul className="space-y-2 list-disc list-inside text-white/75">
            {LOCAL_SIGNALS.map((signal) => (
              <li key={signal} className="leading-relaxed">{signal}</li>
            ))}
          </ul>
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
              AI Visibility Auditing in 2026 →
            </Link>
            <Link to="/aeo-playbook-2026" className="text-sm text-white/85 hover:text-white/85 font-semibold">
              AEO Playbook for 2026 →
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
