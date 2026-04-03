import React from 'react';
import { Link } from 'react-router-dom';
import { usePageMeta } from '../hooks/usePageMeta';
import { getInsightBySlug } from '../content/insights';
import { buildArticleSchema, buildBreadcrumbSchema } from '../lib/seoSchema';

const ARTICLE = getInsightBySlug('conversational-query-playbook-2026');

const FRAMEWORK = [
  { step: 'Audit your top 20 pages and count how many headings are written as full questions people would actually ask an AI assistant.', label: 'Heading audit' },
  { step: 'Rewrite keyword-fragment headings into natural conversational questions with qualifiers (who, when, how much, what if).', label: 'Rewrite headings' },
  { step: 'Add follow-up sections under each question that address constraints: budget, team size, industry, timeline.', label: 'Constraint blocks' },
  { step: 'Build comparison blocks for "vs" and "instead of" patterns that conversational users naturally produce.', label: 'Comparison blocks' },
  { step: 'Structure every major section as a standalone answer that makes sense without reading the rest of the page.', label: 'Standalone answers' },
  { step: 'Add FAQPage schema with real conversational questions extracted from customer support logs, sales calls, and chatbot transcripts.', label: 'FAQ schema' },
  { step: 'Test your pages against actual conversational queries in ChatGPT, Claude, and Perplexity to verify extraction.', label: 'Verification testing' },
];

const QUERY_SOURCES = [
  { name: 'Customer support logs', desc: 'The actual questions people type into your help desk or chatbot.' },
  { name: 'Sales call transcripts', desc: 'Prospects describe their situation before asking for a recommendation.' },
  { name: 'Reddit and forum threads', desc: 'People asking for advice use full conversational phrasing.' },
  { name: 'Google Search Console', desc: 'Filter for queries over 6 words to find natural language patterns.' },
  { name: 'AI chat interfaces', desc: 'Ask ChatGPT and Claude questions about your product category and study how the queries are phrased.' },
];

export default function ConversationalQueryPlaybook2026() {
  if (!ARTICLE) return null;

  usePageMeta({
    title: 'Conversational Query Playbook 2026 | AI Search',
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
    <div className="min-h-screen text-white page-splash-bg">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">

        {/* ── Header ────────────────────────────────── */}
        <header className="card-charcoal rounded-2xl p-8 glass-bleed-cyan">
          <p className="text-xs font-semibold tracking-wide uppercase text-cyan-400/90 mb-3">Conversational Playbook</p>
          <h1 className="text-3xl md:text-4xl brand-title-lg mb-4">{ARTICLE.title}</h1>
          <p className="text-slate-300 leading-relaxed max-w-2xl">{ARTICLE.description}</p>
        </header>

        {/* ── Why Conversational Queries Break Traditional Content ── */}
        <section className="card-charcoal rounded-2xl p-6 section-accent-orange">
          <h2 className="text-2xl brand-title mb-4">Why Conversational Queries Break Traditional Content</h2>
          <p className="text-slate-300 leading-relaxed mb-4">
            When someone types "best project management tool" into Google, your keyword-optimized listicle has a chance.
            When someone asks ChatGPT "What project management tool should I use if my team is fully remote, we have 8
            people, and we need something that integrates with Figma and Slack?" your listicle is useless.
          </p>
          <p className="text-slate-300 leading-relaxed mb-5">
            Conversational queries carry context, constraints, and expectations that keyword-fragment pages were never designed
            to answer. The user is not searching for a topic. They are describing a specific situation and expecting a specific
            recommendation.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { keyword: '2–4 words', conv: '12–25 words', label: 'Length' },
              { keyword: 'Express topics', conv: 'Express situations', label: 'Intent' },
              { keyword: 'Answered with lists', conv: 'Need reasoning', label: 'Format' },
              { keyword: 'Match pages', conv: 'Match sections', label: 'Scope' },
            ].map((r) => (
              <div key={r.label} className="card-charcoal-inner rounded-xl p-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{r.label}</span>
                <div className="mt-2 flex items-center gap-3 text-sm">
                  <span className="text-slate-400 line-through decoration-slate-600">{r.keyword}</span>
                  <span className="text-cyan-400">→</span>
                  <span className="text-white font-medium">{r.conv}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── The Structural Problem ──────────────── */}
        <section className="card-charcoal rounded-2xl p-6 section-accent-violet">
          <h2 className="text-2xl brand-title mb-4">The Structural Problem</h2>
          <p className="text-slate-300 leading-relaxed mb-4">
            Most websites are built around keyword clusters. Each page targets a primary keyword and a handful of related terms.
            The page structure assumes the user will read top-to-bottom and self-select the relevant sections.
          </p>
          <p className="text-slate-300 leading-relaxed mb-4">
            AI models do not read top-to-bottom. They scan for extractable answer blocks that match the specific query context.
            If your page has a section that perfectly answers the question but it is buried under a generic heading like
            "Features" or "Benefits," the model may not identify it as the answer.
          </p>
          <p className="text-slate-300 leading-relaxed">
            The fix is not to write more content. It is to restructure existing content around the questions people actually ask,
            using the language they actually use when talking to an AI assistant.
          </p>
        </section>

        {/* ── Implementation Framework ────────────── */}
        <section className="card-charcoal rounded-2xl p-6 section-accent-cyan">
          <h2 className="text-2xl brand-title mb-5">Implementation Framework</h2>
          <ol className="space-y-3">
            {FRAMEWORK.map((item, i) => (
              <li key={item.label} className="card-charcoal-inner rounded-xl p-4 flex gap-4 items-start">
                <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center text-sm font-bold text-cyan-400">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{item.label}</span>
                  <p className="text-slate-300 text-sm leading-relaxed mt-1">{item.step}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* ── Where to Find Real Conversational Queries ── */}
        <section className="card-charcoal rounded-2xl p-6 section-accent-amber">
          <h2 className="text-2xl brand-title mb-4">Where to Find Real Conversational Queries</h2>
          <p className="text-slate-300 leading-relaxed mb-5">
            Do not guess what people ask. Extract real conversational patterns from these sources:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {QUERY_SOURCES.map((src) => (
              <div key={src.name} className="card-charcoal-inner rounded-xl p-4">
                <h3 className="text-sm font-semibold text-white mb-1">{src.name}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{src.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Q/A Reference ───────────────────────── */}
        <section>
          <h2 className="text-2xl brand-title mb-5">Q/A Reference</h2>
          <div className="space-y-4">
            {ARTICLE.faq.map((item) => (
              <article key={item.question} className="card-charcoal rounded-xl p-5 section-accent-emerald">
                <h3 className="text-base font-semibold text-white mb-2">Q: {item.question}</h3>
                <p className="text-slate-300 leading-relaxed">A: {item.answer}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ── Continue the Cluster ────────────────── */}
        <section className="card-charcoal-inner rounded-2xl p-6">
          <h2 className="text-xl brand-title mb-4">Continue the Cluster</h2>
          <div className="flex flex-wrap gap-3">
            <Link to="/voice-search-ai-answer-optimization-2026" className="btn-cta-secondary text-sm px-4 py-2 rounded-lg">
              Voice Search &amp; AI Answer Optimization →
            </Link>
            <Link to="/aeo-playbook-2026" className="btn-cta-secondary text-sm px-4 py-2 rounded-lg">
              AEO Playbook 2026 →
            </Link>
            <Link to="/insights" className="text-sm text-slate-400 hover:text-white font-medium px-4 py-2 rounded-lg border border-white/10 hover:border-white/20 transition-colors">
              ← Back to Insights Hub
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
