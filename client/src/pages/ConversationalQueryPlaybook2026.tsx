import React from 'react';
import { Link } from 'react-router-dom';
import { MessagesSquare } from 'lucide-react';
import { usePageMeta } from '../hooks/usePageMeta';
import { getInsightBySlug } from '../content/insights';
import { buildArticleSchema, buildBreadcrumbSchema } from '../lib/seoSchema';
import PublicPageFrame from '../components/PublicPageFrame';

const ARTICLE = getInsightBySlug('conversational-query-playbook-2026');

const FRAMEWORK = [
  { step: 'Audit your top 20 pages and count how many headings are written as full questions people would actually ask an AI assistant.', label: 'Heading audit' },
  { step: 'Rewrite keyword-fragment headings into natural conversational questions with qualifiers like who, how, when, and what if.', label: 'Rewrite headings' },
  { step: 'Add follow-up sections under each question that handle constraints such as budget, team size, industry, and timeline.', label: 'Constraint blocks' },
  { step: 'Build comparison sections for versus and instead-of patterns that conversational users naturally produce.', label: 'Comparison blocks' },
  { step: 'Make every major section read as a complete answer even when extracted without the rest of the page.', label: 'Standalone answers' },
  { step: 'Add FAQPage schema with real conversational prompts from support logs, calls, and transcripts.', label: 'FAQ schema' },
  { step: 'Test pages against real prompts in ChatGPT, Claude, and Perplexity to verify extraction.', label: 'Verification testing' },
];

const QUERY_SOURCES = [
  { name: 'Customer support logs', desc: 'The actual questions people type into your help desk or chatbot.' },
  { name: 'Sales call transcripts', desc: 'Prospects describe their situation before asking for a recommendation.' },
  { name: 'Reddit and forum threads', desc: 'People asking for advice use full conversational phrasing.' },
  { name: 'Google Search Console', desc: 'Filter for queries over six words to find natural-language patterns.' },
  { name: 'AI chat interfaces', desc: 'Ask ChatGPT and Claude questions in your category and study how those prompts are phrased.' },
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
    <PublicPageFrame
      icon={MessagesSquare}
      title={ARTICLE.title}
      subtitle={ARTICLE.description}
      backTo="/insights"
      maxWidthClass="max-w-5xl"
    >
      <section className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="text-sm leading-7 text-white/68">
            Conversational queries do not behave like short keywords. They carry context, constraints, and implied follow-ups. If your page only works when someone reads it top-to-bottom, it will underperform in answer engines.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {[
              { label: 'Length', before: '2-4 words', after: '12-25 words' },
              { label: 'Intent', before: 'Topic fragments', after: 'Situation-rich prompts' },
              { label: 'Format', before: 'List pages', after: 'Direct answer blocks' },
              { label: 'Scope', before: 'Whole pages', after: 'Extractable sections' },
            ].map((item) => (
              <article key={item.label} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/44">{item.label}</p>
                <p className="mt-3 text-sm text-white/46">{item.before}</p>
                <p className="mt-1 text-base font-semibold text-white">{item.after}</p>
              </article>
            ))}
          </div>
        </div>
        <aside className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300/72">Operator rule</p>
          <h2 className="mt-3 text-xl font-semibold text-white">Rewrite pages as answer surfaces, not topic containers.</h2>
          <p className="mt-3 text-sm leading-6 text-white/64">
            The goal is not more content. The goal is clearer question phrasing, stronger answer blocks, and better extraction shape.
          </p>
        </aside>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight text-white">Implementation framework</h2>
        <div className="mt-5 grid gap-3">
          {FRAMEWORK.map((item, index) => (
            <article key={item.label} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-start gap-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-orange-400/12 text-sm font-semibold text-orange-200">{index + 1}</span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/42">{item.label}</p>
                  <p className="mt-2 text-sm leading-7 text-white/66">{item.step}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-12 grid gap-10 lg:grid-cols-2">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-white">Where to get real conversational queries</h2>
          <div className="mt-5 space-y-3">
            {QUERY_SOURCES.map((src) => (
              <article key={src.name} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                <h3 className="text-base font-semibold text-white">{src.name}</h3>
                <p className="mt-2 text-sm leading-7 text-white/64">{src.desc}</p>
              </article>
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-white">Reference Q&A</h2>
          <div className="mt-5 space-y-3">
            {ARTICLE.faq.map((item) => (
              <details key={item.question} className="group rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-base font-semibold text-white">
                  <span>{item.question}</span>
                  <span className="text-white/40 transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-4 text-sm leading-7 text-white/64">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-12 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-xl font-semibold text-white">Continue the cluster</h2>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link to="/voice-search-ai-answer-optimization-2026" className="rounded-full border border-white/12 px-4 py-2 text-white/72 transition hover:text-white">Voice Search &amp; AI Answer Optimization 2026</Link>
          <Link to="/aeo-playbook-2026" className="rounded-full border border-white/12 px-4 py-2 text-white/72 transition hover:text-white">AEO Playbook 2026</Link>
          <Link to="/insights" className="rounded-full border border-white/12 px-4 py-2 text-white/72 transition hover:text-white">Insights hub</Link>
        </div>
      </section>
    </PublicPageFrame>
  );
}
