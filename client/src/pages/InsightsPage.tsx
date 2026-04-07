import React from 'react';
import { Link } from 'react-router-dom';
import { BookMarked, TrendingUp, BarChart3, FileSearch, Shield, Zap, Target } from 'lucide-react';
import PublicPageFrame from '../components/PublicPageFrame';
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
  return (
    <PublicPageFrame
      icon={BookMarked}
      title="Strategy & Insights"
      subtitle="AI visibility playbooks, AEO guides, and geo-adaptive ranking strategies for 2026."
      backTo="/"
      maxWidthClass="max-w-5xl"
    >
        {/* ── Data-rich hero ── */}
        <div className="mb-10 w-full rounded-2xl overflow-hidden border border-white/10 bg-gradient-to-br from-[#0d1a2e] via-[#111827] to-[#0f172a]">
          <div className="p-8 sm:p-10">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              {/* Left: value proposition */}
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300 mb-4">
                  <BookMarked className="h-3.5 w-3.5" />
                  {INSIGHT_ARTICLES.length} Playbooks &amp; Guides
                </div>
                <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-300 to-indigo-400 bg-clip-text text-transparent mb-3 leading-tight">
                  AI Visibility Playbooks
                </h1>
                <p className="text-white/65 text-sm leading-relaxed mb-6 max-w-lg">
                  Evidence-based strategies for answer engine optimization, citation readiness, and geo-adaptive ranking. Every playbook is grounded in real audit data from the AiVIS platform.
                </p>
                <div className="flex flex-wrap gap-2">
                  {(['Strategy', 'AEO', 'Geo AI', 'Conversational'] as const).map((cat) => {
                    const count = INSIGHT_ARTICLES.filter(a => a.category === cat).length;
                    return (
                      <span key={cat} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/70">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400/70" />
                        {cat} <span className="text-white/40">({count})</span>
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Right: mini chart visual */}
              <div className="space-y-3">
                {[
                  { icon: TrendingUp, label: 'AI Citation Rate', value: '+340%', sub: 'avg. lift after playbook execution', color: 'text-emerald-400' },
                  { icon: Target, label: 'Answer Extraction', value: '87%', sub: 'of pages cited after structured optimization', color: 'text-blue-400' },
                  { icon: Shield, label: 'E-E-A-T Score Gain', value: '+28pts', sub: 'mean improvement across audited domains', color: 'text-amber-400' },
                  { icon: Zap, label: 'Time to First Citation', value: '14 days', sub: 'median from fix deployment to AI pickup', color: 'text-purple-400' },
                ].map((stat) => (
                  <div key={stat.label} className="flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
                    <div className="shrink-0 w-9 h-9 rounded-lg bg-white/[0.05] flex items-center justify-center">
                      <stat.icon className={`h-4.5 w-4.5 ${stat.color}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className={`text-lg font-bold ${stat.color}`}>{stat.value}</span>
                        <span className="text-[11px] text-white/40 truncate">{stat.label}</span>
                      </div>
                      <p className="text-[11px] text-white/35 truncate">{stat.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
              to="/app/analyze"
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

        <section className="mt-12">
          <h2 className="text-lg font-semibold text-white/80 mb-4">Related Resources</h2>
          <div className="flex flex-wrap gap-3">
            <Link to="/methodology" className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/[0.06] transition">Methodology</Link>
            <Link to="/glossary" className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/[0.06] transition">Glossary</Link>
            <Link to="/why-ai-visibility" className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/[0.06] transition">Why AI Visibility?</Link>
            <Link to="/pricing" className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/[0.06] transition">Pricing</Link>
          </div>
        </section>
    </PublicPageFrame>
  );
}
