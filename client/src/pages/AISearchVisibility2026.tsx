import React from 'react';
import { Link } from 'react-router-dom';
import { usePageMeta } from '../hooks/usePageMeta';
import { buildArticleSchema, buildBreadcrumbSchema } from '../lib/seoSchema';

const QA_PAIRS = [
  {
    question: 'What is changing in search by 2026?',
    answer:
      'Search is shifting from link retrieval to AI answer synthesis. Visibility now depends on whether your content can be extracted, trusted, and cited by reasoning systems.',
  },
  {
    question: 'Why is traditional SEO losing power?',
    answer:
      'Keyword density and backlink volume are weaker signals in AI-first results. Engines increasingly prioritize intent alignment, semantic consistency, and structured clarity.',
  },
  {
    question: 'What is AI visibility?',
    answer:
      'AI visibility measures how often and how accurately AI systems include your content in generated answers, overviews, citations, and summaries.',
  },
  {
    question: 'What is AEO in simple terms?',
    answer:
      'Answer Engine Optimization means structuring content so AI can extract direct, standalone answers quickly, including definitions, steps, and comparisons.',
  },
  {
    question: 'How does geo relevance affect AI answers?',
    answer:
      'AI systems adapt responses by region. Content with local terminology, local entities, and region-specific use cases is more likely to be selected for local queries.',
  },
  {
    question: 'What should founders do first?',
    answer:
      'Audit pages for extractability, build semantic clusters, deploy AI visibility tracking, and use repeatable content-update workflows instead of one-off publishing.',
  },
  {
    question: 'What metric replaces “rank #1”?',
    answer:
      'In AI search, the core metric is inclusion quality: being cited, summarized correctly, and used as a trusted source in generated answers.',
  },
  {
    question: 'What is the biggest strategic shift?',
    answer:
      'The shift is from traffic optimization to influence optimization. Authority compounds when AI repeatedly references your brand as a source node.',
  },
];

const IMPLEMENTATION_STEPS = [
  'Audit every priority page for clear answer sections, direct query-response blocks, and heading hierarchy.',
  'Build semantic clusters so each article reinforces related entities, use cases, and subtopics.',
  'Track AI overview inclusion, citation frequency, and extracted answer fidelity over time.',
  'Restructure content for AEO: definitions, procedures, comparisons, and concise standalone answer blocks.',
  'Automate monitoring and content updates so your knowledge graph improves continuously.',
];

export default function AISearchVisibility2026() {
  usePageMeta({
    title: 'AI Answer Readiness in 2026',
    description:
      'A 2026 framework for founders: shift from traditional SEO to AI Visibility with AEO, geo relevance, and Q/A content.',
    path: '/ai-search-visibility-2026',
    ogTitle: 'AI Visibility Auditing in 2026: Why Traditional SEO Is Collapsing',
    structuredData: [
      {
        ...buildArticleSchema({
          title: 'AI Visibility Auditing in 2026: Why Traditional SEO Is Collapsing and What Replaces It',
          description:
            'Search has shifted from page ranking to AI answer synthesis. Learn how to structure content for extractability, citations, and authority.',
          path: '/ai-search-visibility-2026',
          datePublished: '2026-03-02',
        }),
        about: [
          { '@type': 'Thing', name: 'AI Visibility Audit' },
          { '@type': 'Thing', name: 'Answer Engine Optimization' },
          { '@type': 'Thing', name: 'Geo Ranking' },
          { '@type': 'Thing', name: 'Content Infrastructure' },
        ],
      },
      buildBreadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'Insights', path: '/insights' },
        { name: 'AI Visibility Auditing in 2026', path: '/ai-search-visibility-2026' },
      ]),
    ],
  });

  return (
    <div className="text-white">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <header className="mb-10 rounded-2xl border border-white/10/70 bg-charcoal-deep p-8">
          <p className="text-xs font-semibold tracking-wide uppercase text-white/85 mb-3">2026 Playbook</p>
          <h1 className="text-3xl md:text-4xl brand-title-lg leading-tight mb-4">
            AI Visibility Auditing in 2026
          </h1>
          <p className="text-white/75 leading-relaxed">
            Traditional SEO mechanics are losing leverage. AI answer engines now prioritize structured understanding,
            intent alignment, and extractable answer blocks. This guide explains the strategic shift and how to adapt.
          </p>
        </header>

        <section className="mb-10 rounded-2xl border border-white/10/70 bg-charcoal p-6">
          <h2 className="text-2xl brand-title mb-4">What Replaces Traditional SEO</h2>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="rounded-xl border border-white/10 bg-charcoal p-4">
              <p className="text-white/80 font-semibold mb-2">Declining Model</p>
              <ul className="space-y-1.5 text-white/75 list-disc list-inside">
                <li>Keyword-density targeting</li>
                <li>Backlink volume as primary signal</li>
                <li>Ranking position as the core KPI</li>
                <li>One-off publishing without reinforcement</li>
              </ul>
            </div>
            <div className="rounded-xl border border-white/10/20 bg-charcoal p-4">
              <p className="text-white/80 font-semibold mb-2">Emerging Model</p>
              <ul className="space-y-1.5 text-white/75 list-disc list-inside">
                <li>Intent and query-answer alignment</li>
                <li>Semantic coherence across topic clusters</li>
                <li>Citation and inclusion quality as KPI</li>
                <li>Continuous orchestration and updates</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl brand-title mb-4">AEO-Ready Q/A Blocks</h2>
          <p className="text-white/55 mb-5">
            These concise blocks are structured for answer extraction, follow-up query handling, and AI citation clarity.
          </p>
          <div className="space-y-4">
            {QA_PAIRS.map((item) => (
              <article key={item.question} className="rounded-xl border border-white/10 bg-charcoal p-5">
                <h3 className="text-lg font-semibold text-white/85 mb-2">Q: {item.question}</h3>
                <p className="text-white/75 leading-relaxed">A: {item.answer}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mb-10 rounded-2xl border border-white/10/70 bg-charcoal p-6">
          <h2 className="text-2xl brand-title mb-4">Practical Implementation Framework</h2>
          <ol className="space-y-3 list-decimal list-inside text-white/75">
            {IMPLEMENTATION_STEPS.map((step) => (
              <li key={step} className="leading-relaxed">{step}</li>
            ))}
          </ol>
        </section>

        <section className="rounded-2xl border border-white/12/20 bg-charcoal/5 p-6">
          <h2 className="text-xl brand-title mb-3">Run This Strategy in AiVIS</h2>
          <p className="text-white/75 mb-5">
            Use AiVIS to measure AI overview inclusion, citation frequency, and recommendation gaps so your content infrastructure
            improves with every iteration.
          </p>
          <div className="mb-5 text-sm text-white/75">
            Continue with focused playbooks:{' '}
            <Link to="/aeo-playbook-2026" className="text-white/85 hover:text-white/85 font-semibold">AEO Playbook 2026</Link>
            {' '}·{' '}
            <Link to="/geo-ai-ranking-2026" className="text-white/85 hover:text-white/85 font-semibold">Geo AI Ranking 2026</Link>
            {' '}·{' '}
            <Link to="/insights" className="text-white/85 hover:text-white/85 font-semibold">Insights Hub</Link>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/app/analyze"
              className="inline-flex items-center rounded-full bg-charcoal px-4 py-2 text-sm font-semibold text-white hover:bg-charcoal transition-colors"
            >
              Run an AI Visibility Audit
            </Link>
            <Link
              to="/guide"
              className="inline-flex items-center rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-white/85 hover:bg-charcoal-light transition-colors"
            >
              View Implementation Guide
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
