import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, BookMarked } from 'lucide-react';
import { usePageMeta } from '../hooks/usePageMeta';
import { INSIGHT_ARTICLES } from '../content/insights';
import { buildBreadcrumbSchema, buildCollectionSchema, buildItemListSchema } from '../lib/seoSchema';

export default function InsightsPage() {
  usePageMeta({
    title: 'AI Visibility Insights Hub | AiVIS',
    description:
      'Strategic AI search playbooks covering AI visibility, AEO implementation, and geo-adaptive ranking in 2026.',
    path: '/insights',
    ogTitle: 'AI Visibility Insights Hub: 2026 Playbooks',
    structuredData: [
      buildCollectionSchema(
        'AiVIS Insights Hub',
        'Strategic content for Ai Visibility Intelligence Audits, answer engine optimization, and geo ranking in 2026.',
        '/insights'
      ),
      buildItemListSchema(INSIGHT_ARTICLES.map((article) => ({ name: article.title, path: article.path }))),
      buildBreadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'Insights', path: '/insights' },
      ]),
    ],
  });

  const navigate = useNavigate();

  return (
    <div className="min-h-screen text-white">
      {/* ── Standard page header ─────────────────────────────── */}
      <header className="border-b border-white/10 bg-charcoal-deep sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="rounded-full p-2 transition-colors hover:bg-white/8" type="button" aria-label="Go back">
            <ArrowLeft className="h-5 w-5 text-white/55" />
          </button>
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-xl brand-title">
              <BookMarked className="h-5 w-5 text-orange-400" />
              Strategy &amp; Insights
            </h1>
            <p className="text-sm text-white/60 leading-relaxed">AI visibility playbooks, AEO guides, and geo-adaptive ranking strategies for 2026</p>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-10 w-full rounded-2xl overflow-hidden shadow-2xl border border-white/10 relative">
          <img src="/images/abstract-art-bg-image.png" alt="Abstract Art Background" className="absolute inset-0 w-full h-full object-cover opacity-30" />
          <div className="relative p-8 px-6 sm:px-12 flex flex-col items-center justify-center bg-gradient-to-r from-blue-900/40 to-indigo-900/40 z-10">
             <img src="/images/ad-creative.png" alt="AiVIS strategy and insights creative promo" className="max-w-full h-auto max-h-[300px] object-contain mb-4" />
             <h1 className="text-3xl sm:text-5xl font-bold bg-gradient-to-r from-blue-300 to-indigo-400 bg-clip-text text-transparent mb-2">Strategy &amp; Insights</h1>
             <p className="text-white/60 text-lg">Master AI visibility and optimize your pipeline.</p>
          </div>
        </div>
        <header className="mb-10 rounded-2xl border border-white/10/70 bg-charcoal-deep p-8">
          <p className="text-xs font-semibold tracking-wide uppercase text-white/85 mb-3">Insights Hub</p>
          <h1 className="text-3xl md:text-4xl brand-title mb-4">AI Search Playbooks for 2026</h1>
          <p className="text-white/75 leading-relaxed">
            High-intent guides built for extractability, citation quality, and semantic reinforcement across the AiVIS domain.
          </p>
        </header>

        <section className="grid md:grid-cols-2 gap-5 mb-10">
          {INSIGHT_ARTICLES.map((article) => (
            <article key={article.slug} className="rounded-2xl border border-white/10 bg-charcoal p-6">
              <div className="flex items-center justify-between mb-3 text-xs">
                <span className="px-2 py-1 rounded-full bg-charcoal/15 text-white/85 font-medium">{article.category}</span>
                <span className="text-white/60">{article.readMinutes} min read</span>
              </div>
              <h2 className="text-xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-indigo-400 mb-2">{article.title}</h2>
              <p className="text-sm text-white/75 mb-4 leading-relaxed">{article.description}</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {article.keywords.slice(0, 3).map((keyword) => (
                  <span key={keyword} className="text-xs text-white/55 border border-white/10 rounded-full px-2 py-1">
                    {keyword}
                  </span>
                ))}
              </div>
              <Link
                to={article.path}
                className="inline-flex items-center text-sm font-semibold text-white/85 hover:text-white/85 transition-colors"
              >
                Read playbook →
              </Link>
            </article>
          ))}
        </section>

        <section className="rounded-2xl border border-white/10/70 bg-charcoal p-6">
          <h2 className="text-xl brand-title mb-3">Apply These Playbooks in AiVIS</h2>
          <p className="text-white/75 mb-4">
            Run audits after each content update, compare recommendation deltas, and track whether your high-value pages are becoming more citation-ready.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/analyze"
              className="inline-flex items-center rounded-full bg-charcoal px-4 py-2 text-sm font-semibold text-white hover:bg-charcoal transition-colors"
            >
              Run an Audit
            </Link>
            <Link
              to="/guide"
              className="inline-flex items-center rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-white/85 hover:bg-charcoal-light transition-colors"
            >
              Implementation Guide
            </Link>
            <Link
              to="/blogs"
              className="inline-flex items-center rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-white/85 hover:bg-charcoal-light transition-colors"
            >
              Read Our Blog
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
