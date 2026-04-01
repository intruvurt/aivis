import React from 'react';
import { Link } from 'react-router-dom';
import { usePageMeta } from '../hooks/usePageMeta';
import { getInsightBySlug } from '../content/insights';
import { buildArticleSchema, buildBreadcrumbSchema } from '../lib/seoSchema';

const ARTICLE = getInsightBySlug('conversational-query-playbook-2026');

const FRAMEWORK = [
  'Audit your top 20 pages and count how many headings are written as full questions people would actually ask an AI assistant.',
  'Rewrite keyword-fragment headings into natural conversational questions with qualifiers (who, when, how much, what if).',
  'Add follow-up sections under each question that address constraints: budget, team size, industry, timeline.',
  'Build comparison blocks for "vs" and "instead of" patterns that conversational users naturally produce.',
  'Structure every major section as a standalone answer that makes sense without reading the rest of the page.',
  'Add FAQPage schema with real conversational questions extracted from customer support logs, sales calls, and chatbot transcripts.',
  'Test your pages against actual conversational queries in ChatGPT, Claude, and Perplexity to verify extraction.',
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
    <div className="min-h-screen page-splash-bg bg-[#2e3646] text-white">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <header className="mb-10 rounded-2xl border border-white/10/70 bg-charcoal-deep p-8">
          <p className="text-xs font-semibold tracking-wide uppercase text-white/85 mb-3">Conversational Playbook</p>
          <h1 className="text-3xl md:text-4xl brand-title-lg mb-4">{ARTICLE.title}</h1>
          <p className="text-white/75 leading-relaxed">{ARTICLE.description}</p>
        </header>

        <section className="mb-10 rounded-2xl border border-white/10/70 bg-charcoal p-6">
          <h2 className="text-2xl brand-title mb-4">Why Conversational Queries Break Traditional Content</h2>
          <p className="text-white/75 leading-relaxed mb-4">
            When someone types "best project management tool" into Google, your keyword-optimized listicle has a chance.
            When someone asks ChatGPT "What project management tool should I use if my team is fully remote, we have 8
            people, and we need something that integrates with Figma and Slack?" your listicle is useless.
          </p>
          <p className="text-white/75 leading-relaxed mb-4">
            Conversational queries carry context, constraints, and expectations that keyword-fragment pages were never designed
            to answer. The user is not searching for a topic. They are describing a specific situation and expecting a specific
            recommendation.
          </p>
          <ul className="space-y-2 list-disc list-inside text-white/75">
            <li>Keyword queries average 2-4 words. Conversational queries average 12-25 words.</li>
            <li>Keyword queries express topics. Conversational queries express situations.</li>
            <li>Keyword queries can be answered with lists. Conversational queries need reasoning.</li>
            <li>Keyword queries match pages. Conversational queries match specific sections within pages.</li>
          </ul>
        </section>

        <section className="mb-10 rounded-2xl border border-white/10/70 bg-charcoal p-6">
          <h2 className="text-2xl brand-title mb-4">The Structural Problem</h2>
          <p className="text-white/75 leading-relaxed mb-4">
            Most websites are built around keyword clusters. Each page targets a primary keyword and a handful of related terms.
            The page structure assumes the user will read top-to-bottom and self-select the relevant sections.
          </p>
          <p className="text-white/75 leading-relaxed mb-4">
            AI models do not read top-to-bottom. They scan for extractable answer blocks that match the specific query context.
            If your page has a section that perfectly answers the question but it is buried under a generic heading like
            "Features" or "Benefits," the model may not identify it as the answer.
          </p>
          <p className="text-white/75 leading-relaxed">
            The fix is not to write more content. It is to restructure existing content around the questions people actually ask,
            using the language they actually use when talking to an AI assistant.
          </p>
        </section>

        <section className="mb-10 rounded-2xl border border-white/10/70 bg-charcoal p-6">
          <h2 className="text-2xl brand-title mb-4">Implementation Framework</h2>
          <ol className="space-y-3 list-decimal list-inside text-white/75">
            {FRAMEWORK.map((step) => (
              <li key={step} className="leading-relaxed">{step}</li>
            ))}
          </ol>
        </section>

        <section className="mb-10 rounded-2xl border border-white/10/70 bg-charcoal p-6">
          <h2 className="text-2xl brand-title mb-4">Where to Find Real Conversational Queries</h2>
          <p className="text-white/75 leading-relaxed mb-4">
            Do not guess what people ask. Extract real conversational patterns from these sources:
          </p>
          <ul className="space-y-2 list-disc list-inside text-white/75">
            <li><strong>Customer support logs:</strong> The actual questions people type into your help desk or chatbot.</li>
            <li><strong>Sales call transcripts:</strong> Prospects describe their situation before asking for a recommendation.</li>
            <li><strong>Reddit and forum threads:</strong> People asking for advice use full conversational phrasing.</li>
            <li><strong>Google Search Console:</strong> Filter for queries over 6 words to find natural language patterns.</li>
            <li><strong>AI chat interfaces:</strong> Ask ChatGPT and Claude questions about your product category and study how the queries are phrased.</li>
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
            <Link to="/voice-search-ai-answer-optimization-2026" className="text-sm text-white/85 hover:text-white/85 font-semibold">
              Voice Search and AI Answer Optimization →
            </Link>
            <Link to="/aeo-playbook-2026" className="text-sm text-white/85 hover:text-white/85 font-semibold">
              AEO Playbook 2026 →
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
