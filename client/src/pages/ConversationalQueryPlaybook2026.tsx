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
    <div className="min-h-screen bg-gradient-to-b from-[#0b1220] via-[#111827] to-[#0b1220] text-white">
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <header className="mb-8 rounded-2xl border border-white/10 bg-white/[0.04] p-6 sm:p-8">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">Conversational Playbook</p>
          <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">{ARTICLE.title}</h1>
          <p className="mt-4 max-w-2xl text-white/75">{ARTICLE.description}</p>
        </header>

        <section className="mb-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
          <h2 className="text-2xl font-semibold">Why conversational queries break traditional content</h2>
          <p className="mt-3 text-white/75">
            When someone types "best project management tool" into Google, your keyword-optimized listicle has a chance.
            When someone asks ChatGPT "What project management tool should I use if my team is fully remote, we have 8
            people, and we need something that integrates with Figma and Slack?" your listicle is not the right shape.
          </p>
          <p className="mt-4 text-white/75">
            Conversational queries carry context, constraints, and expectations that keyword-fragment pages were never designed
            to answer. The user is not searching for a topic. They are describing a specific situation and expecting a specific
            recommendation.
          </p>
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              { keyword: '2–4 words', conv: '12–25 words', label: 'Length' },
              { keyword: 'Express topics', conv: 'Express situations', label: 'Intent' },
              { keyword: 'Answered with lists', conv: 'Need reasoning', label: 'Format' },
              { keyword: 'Match pages', conv: 'Match sections', label: 'Scope' },
            ].map((row) => (
              <div key={row.label} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-white/45">{row.label}</span>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm sm:gap-3">
                  <span className="text-white/45 line-through decoration-white/25">{row.keyword}</span>
                  <span className="text-cyan-400">→</span>
                  <span className="font-medium text-white">{row.conv}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
          <h2 className="text-2xl font-semibold">The structural problem</h2>
          <p className="mt-3 text-white/75">
            Most websites are built around keyword clusters. Each page targets a primary keyword and a handful of related terms.
            The page structure assumes the user will read top-to-bottom and self-select the relevant sections.
          </p>
          <p className="mt-4 text-white/75">
            AI models do not read top-to-bottom. They scan for extractable answer blocks that match the specific query context.
            If your page has a section that perfectly answers the question but it is buried under a generic heading like
            "Features" or "Benefits," the model may not identify it as the answer.
          </p>
          <p className="mt-4 text-white/75">
            The fix is not to write more content. It is to restructure existing content around the questions people actually ask,
            using the language they actually use when talking to an AI assistant.
          </p>
        </section>

        <section className="mb-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
          <h2 className="text-2xl font-semibold">Implementation framework</h2>
          <ol className="mt-5 space-y-3">
            {FRAMEWORK.map((item, index) => (
              <li key={item.label} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:gap-4">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-sm font-bold text-cyan-400">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <span className="text-xs font-bold uppercase tracking-wider text-white/45">{item.label}</span>
                  <p className="mt-1 text-sm leading-relaxed text-white/75">{item.step}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mb-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
          <h2 className="text-2xl font-semibold">Where to find real conversational queries</h2>
          <p className="mt-3 text-white/75">
            Do not guess what people ask. Extract real conversational patterns from these sources:
          </p>
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {QUERY_SOURCES.map((src) => (
              <div key={src.name} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <h3 className="text-sm font-semibold text-white">{src.name}</h3>
                <p className="mt-1 text-sm leading-relaxed text-white/60">{src.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-2xl font-semibold">Q/A reference</h2>
          <div className="space-y-4">
            {ARTICLE.faq.map((item) => (
              <article key={item.question} className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                <h3 className="text-base font-semibold text-white/90">Q: {item.question}</h3>
                <p className="mt-2 text-white/75">A: {item.answer}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
          <h2 className="text-xl font-semibold">Continue the cluster</h2>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center text-sm">
            <Link to="/voice-search-ai-answer-optimization-2026" className="rounded-lg border border-white/20 px-4 py-2 text-white/80 hover:text-white">
              Voice Search &amp; AI Answer Optimization 2026
            </Link>
            <Link to="/aeo-playbook-2026" className="rounded-lg border border-white/20 px-4 py-2 text-white/80 hover:text-white">
              AEO Playbook 2026
            </Link>
            <Link to="/insights" className="rounded-lg border border-white/20 px-4 py-2 text-white/80 hover:text-white">
              Insights Hub
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
