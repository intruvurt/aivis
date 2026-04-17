import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { usePageMeta } from '../hooks/usePageMeta';
import { buildBreadcrumbSchema, buildOrganizationRef, buildWebPageSchema } from '../lib/seoSchema';
import { PLATFORM_NARRATIVE } from '../constants/platformNarrative';

/**
 * Why AI Visibility Matters - Educational page explaining the shift from traditional search to AI search
 * 
 * Key data points (sourced):
 * - ChatGPT reached 100M users in 2 months (fastest ever) - Reuters, Feb 2023
 * - 58.5% of Google searches result in zero clicks - SparkToro/Datos, 2026
 * - Perplexity serves 100M+ queries/week - Company statements, 2026
 * - Google's AI Overviews appeared on 47% of searches at peak - BrightEdge, 2026
 * - AI search market projected to hit $100B+ by 2027 - Multiple analyst reports
 */

const WhyAIVisibility = () => {
  usePageMeta({
    title: 'Why AI Visibility',
    description: 'AI answer engines are replacing traditional search. Learn why businesses must become AI-readable entities, not just searchable pages.',
    path: '/why-ai-visibility',
    ogTitle: 'Why AI Visibility Matters - The Search Revolution',
    structuredData: [
      {
        '@context': 'https://schema.org',
        '@type': 'Article',
        '@id': 'https://aivis.biz/why-ai-visibility#article',
        headline: 'Why AI Visibility Matters - The Search Revolution Is Here',
        description: 'AI answer engines are replacing traditional search. Your website either gets cited, or gets ignored.',
        image: ['https://aivis.biz/aivis-cover.png'],
        author: {
          '@type': 'Person',
          '@id': 'https://aivis.biz/#author',
          name: 'Ryan Mason',
          url: 'https://aivis.biz/about',
        },
        publisher: {
          '@type': 'Organization',
          '@id': 'https://aivis.biz/#organization',
          name: 'AiVIS.biz',
          url: 'https://aivis.biz/',
          logo: {
            '@type': 'ImageObject',
            url: 'https://aivis.biz/aivis-logo.png',
          },
        },
        datePublished: '2026-03-02T00:00:00.000Z',
        dateModified: '2026-03-16T00:00:00.000Z',
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': 'https://aivis.biz/why-ai-visibility#webpage',
        },
        inLanguage: 'en-US',
        about: [
          { '@type': 'Thing', name: 'AI Visibility Audit' },
          { '@type': 'Thing', name: 'Zero-Click Searches' },
          { '@type': 'Thing', name: 'AI Citation Optimization' },
        ],
      },
      buildWebPageSchema({
        path: '/why-ai-visibility',
        name: 'Why AI Visibility Matters - The Search Revolution',
        description:
          'AI answer engines are replacing traditional search. Learn why businesses must become AI-readable entities, not just searchable pages.',
        mainEntityId: 'https://aivis.biz/why-ai-visibility#article',
      }),
      buildBreadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'Why AI Visibility', path: '/why-ai-visibility' },
      ]),
    ],
  });

  const stats = [
    {
      stat: '100M',
      label: 'ChatGPT users in 2 months',
      source: 'Reuters/UBS Study, Feb 2023',
      note: 'Fastest-growing consumer app in history',
    },
    {
      stat: '58.5%',
      label: 'Google searches with zero clicks',
      source: 'SparkToro/Datos, 2026',
      note: 'Users get answers without visiting websites',
    },
    {
      stat: '100M+',
      label: 'Perplexity queries per week',
      source: 'Perplexity AI, 2026',
      note: 'Answer engine replacing traditional search',
    },
    {
      stat: '47%',
      label: 'Google searches showing AI Overviews',
      source: 'BrightEdge Research, 2026',
      note: 'AI-generated answers at the top of results',
    },
  ];

  const shifts = [
    {
      title: 'From Links to Answers',
      old: 'Search engines provided links to websites',
      new: 'AI engines provide direct answers, citing sources (or not)',
      impact: 'Being a source AI trusts is the new SEO',
    },
    {
      title: 'From Keywords to Understanding',
      old: 'Optimize for specific keyword matches',
      new: 'AI parses meaning, context, and structure',
      impact: 'Clear, well-structured content gets cited',
    },
    {
      title: 'From Ranking to Being Cited',
      old: 'Goal: rank #1 on Google SERP',
      new: 'Goal: be the source AI references in its answer',
      impact: 'Citation = trust = traffic',
    },
    {
      title: 'From Crawlers to Parsers',
      old: 'Googlebot indexes and ranks by backlinks',
      new: 'LLMs extract facts, entities, and relationships',
      impact: 'Structured data and semantic HTML matter more than ever',
    },
  ];

  const whyGoogleDoesntCare = [
    {
      point: 'Ad revenue is protected',
      detail: 'Google makes $200B+/year from ads. Zero-click searches still show ads above AI answers. Their business model is intact.',
    },
    {
      point: 'They own AI Overviews',
      detail: 'Google is the one cannibalizing organic clicks with their own AI. If users stay on Google longer, they see more ads.',
    },
    {
      point: 'Websites are training data',
      detail: 'Google uses your content to train their AI, then serves answers directly. You\'re a supplier, not a customer.',
    },
    {
      point: 'Search monopoly remains',
      detail: '90%+ market share means Google sets the rules. They\'ve already pivoted, and AI Overviews are default behavior now.',
    },
    {
      point: 'Enterprise deals drive cloud revenue',
      detail: 'Google\'s real growth is Google Cloud + Gemini API. Helping small websites get traffic isn\'t the priority.',
    },
  ];

  return (
    <div id="why-ai-visibility-page" className="text-white">
      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-white/22/20 to-transparent" />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <div className="lonely-text mb-6">
              <h1 className="text-4xl md:text-6xl font-black mb-6 bg-gradient-to-r from-white/22 via-white/14 to-white/12 bg-clip-text text-transparent">
                The Search Revolution Is Here
              </h1>
              <p className="text-xl md:text-2xl text-white/75 max-w-3xl mx-auto">
                {PLATFORM_NARRATIVE.oneLiner}
              </p>
            </div>
            <div className="mt-6 max-w-3xl mx-auto rounded-2xl border border-emerald-300/25 bg-emerald-500/10 px-5 py-4 text-left">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-100">The step-function change</h2>
              <p className="mt-2 text-sm leading-7 text-emerald-50/90">
                {PLATFORM_NARRATIVE.disruption}
              </p>
              <p className="mt-2 text-sm leading-7 text-emerald-50/90">
                {PLATFORM_NARRATIVE.stageClose}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                to="/auth?mode=signup"
                className="bg-gradient-to-r from-white/22 to-white/14 hover:from-white/22 hover:to-white/14 text-white px-8 py-3 rounded-full font-semibold transition-all transform hover:scale-105"
              >
                Check Your AI Visibility →
              </Link>
              <a
                href="#the-shift"
                className="bg-charcoal-light hover:bg-charcoal text-white px-8 py-3 rounded-full font-semibold transition-all"
              >
                Learn More ↓
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats Grid */}
      <section className="py-16 bg-[#323a4c]/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl brand-title text-center mb-12 lonely-text">The Numbers Don't Lie</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="bg-charcoal-light/50 border border-white/10 rounded-xl p-6 text-center"
              >
                <div className="text-4xl md:text-5xl font-black text-white/80 mb-2">
                  {item.stat}
                </div>
                <div className="text-lg font-semibold text-white mb-2">{item.label}</div>
                <div className="text-sm text-white/55 mb-2">{item.note}</div>
                <div className="text-xs text-white/60 italic">Source: {item.source}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* The Shift Section */}
      <section id="the-shift" className="py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lonely-text text-center mb-12">
            <h2 className="text-3xl md:text-4xl brand-title text-center mb-4">
              How Search Has Changed
            </h2>
            <p className="text-white/55 text-center max-w-2xl mx-auto">
              The paradigm shift from "search results" to "AI answers" changes everything about how websites get discovered.
            </p>
          </div>

          <div className="space-y-8">
            {shifts.map((shift, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: idx % 2 === 0 ? -20 : 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-gradient-to-r from-white/20 to-white/12 border border-white/10 rounded-xl p-6"
              >
                <h3 className="text-xl font-bold text-white/80 mb-4">{shift.title}</h3>
                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <div className="card-charcoal rounded-lg p-4">
                    <div className="text-xs text-white/80 font-semibold mb-1">OLD WAY (Dying)</div>
                    <div className="text-white/75">{shift.old}</div>
                  </div>
                  <div className="card-charcoal/30 rounded-lg p-4">
                    <div className="text-xs text-white/80 font-semibold mb-1">NEW WAY (Now)</div>
                    <div className="text-white/75">{shift.new}</div>
                  </div>
                </div>
                <div className="text-sm text-white/55">
                  <span className="text-white/80 font-semibold">Impact:</span> {shift.impact}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Google Doesn't Care */}
      <section className="py-20 bg-gradient-to-b from-white/20/30 to-transparent">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lonely-text text-center mb-12">
            <h2 className="text-3xl md:text-4xl brand-title text-center mb-4">
              Why Google Doesn't Care About Your Traffic
            </h2>
            <p className="text-white/55 text-center max-w-2xl mx-auto">
              Google isn't fighting AI search, they're leading it. Understanding their incentives explains everything.
            </p>
          </div>

          <div className="space-y-4">
            {whyGoogleDoesntCare.map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-charcoal-light/30 border border-white/10 rounded-lg p-5 hover:border-white/10 transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 card-charcoal rounded-full flex items-center justify-center">
                    <span className="text-white/80 font-bold text-sm">{idx + 1}</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1">{item.point}</h3>
                    <p className="text-white/55 text-sm">{item.detail}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* What You Can Do */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lonely-text text-center mb-12">
            <h2 className="text-3xl md:text-4xl brand-title mb-4">
              What You Can Do About It
            </h2>
            <p className="text-white/55 max-w-2xl mx-auto">
              AI systems need to understand, trust, and cite your content. Here's what makes them do that.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: '',
                title: 'Structured Data',
                desc: 'JSON-LD schema markup tells AI exactly what your content represents: products, FAQs, organizations, and reviews.',
              },
              {
                icon: '',
                title: 'Clear Hierarchy',
                desc: 'Proper H1 → H2 → H3 structure, semantic HTML, and logical content flow help AI parse your page.',
              },
              {
                icon: '',
                title: 'Factual Authority',
                desc: 'Specific claims, cited sources, and expert credentials help AI confirm your content is trustworthy.',
              },
              {
                icon: '',
                title: 'Answer-Ready Content',
                desc: 'FAQ sections, clear definitions, and concise explanations are easy for AI to extract and cite.',
              },
              {
                icon: '',
                title: 'Entity Connections',
                desc: 'Link to authoritative sources. Be linked by authoritative sources. AI follows the trust graph.',
              },
              {
                icon: '',
                title: 'Technical Hygiene',
                desc: 'HTTPS, fast load times, meta descriptions, and canonical URLs still matter for AI crawlers.',
              },
            ].map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-charcoal-light/30 border border-white/10 rounded-xl p-6 hover:border-white/10 transition-all"
              >
                <div className="text-4xl mb-4">{item.icon}</div>
                <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
                <p className="text-white/55 text-sm">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Sources Section */}
      <section className="py-16 bg-[#323a4c]/20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-center mb-8 lonely-text">Sources & Further Reading</h2>
          <div className="bg-charcoal-light/30 border border-white/10 rounded-xl p-6">
            <ul className="space-y-3 text-sm text-white/55">
              <li>
                <span className="text-white font-semibold">ChatGPT Growth:</span>{' '}
                <a
                  href="https://www.reuters.com/technology/chatgpt-sets-record-fastest-growing-user-base-analyst-note-2023-02-01/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/80 hover:text-white/80 underline"
                >
                  Reuters - "ChatGPT sets record for fastest-growing user base" (Feb 2023)
                </a>
              </li>
              <li>
                <span className="text-white font-semibold">Zero-Click Searches:</span>{' '}
                <a
                  href="https://sparktoro.com/blog/2026-zero-click-search-study/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/80 hover:text-white/80 underline"
                >
                  SparkToro - "2026 Zero-Click Search Study" (2026)
                </a>
              </li>
              <li>
                <span className="text-white font-semibold">AI Overviews Impact:</span>{' '}
                <a
                  href="https://www.brightedge.com/resources/research-reports"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/80 hover:text-white/80 underline"
                >
                  BrightEdge Research - AI Overviews in Search Results (2026)
                </a>
              </li>
              <li>
                <span className="text-white font-semibold">Perplexity Growth:</span>{' '}
                <a
                  href="https://www.perplexity.ai/hub/blog"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/80 hover:text-white/80 underline"
                >
                  Perplexity AI Blog - Company announcements and metrics
                </a>
              </li>
              <li>
                <span className="text-white font-semibold">Google Revenue:</span>{' '}
                <a
                  href="https://abc.xyz/investor/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/80 hover:text-white/80 underline"
                >
                  Alphabet Investor Relations - Quarterly earnings reports
                </a>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Related Reading */}
      <section className="py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-charcoal-light/30 border border-white/10 rounded-xl p-6">
            <p className="text-xs uppercase tracking-wide text-white/80 font-semibold mb-2">Related Reading</p>
            <h3 className="text-xl font-bold text-white mb-2">AI Visibility Auditing in 2026</h3>
            <p className="text-sm text-white/55 mb-4">
              Get the practical 2026 framework: AEO, geo-adaptive relevance, content infrastructure,
              and Q/A-structured blocks designed for AI extraction and citation.
            </p>
            <Link
              to="/ai-search-visibility-2026"
              className="inline-flex items-center gap-2 text-white/80 hover:text-white/80 font-semibold transition-colors"
            >
              Read the full 2026 article →
            </Link>
            <div className="mt-3">
              <Link
                to="/insights"
                className="inline-flex items-center gap-2 text-sm text-white/80/90 hover:text-white/80 transition-colors"
              >
                Explore all AI Search playbooks →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="lonely-text mb-8">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to See How AI Views Your Site?
            </h2>
            <p className="text-white/55 max-w-xl mx-auto">
              Run a free audit and get evidence-backed insights into how AI systems interpret and cite your website. No fluff, no invented scores, just facts.
            </p>
          </div>
          <Link
            to="/auth?mode=signup"
            className="inline-block bg-gradient-to-r from-white/22 to-white/14 hover:from-white/22 hover:to-white/14 text-white px-10 py-4 rounded-full font-bold text-lg transition-all transform hover:scale-105 shadow-lg shadow-white/20"
          >
            Start Your Free Audit →
          </Link>
        </div>
      </section>

      <section className="max-w-3xl mx-auto mt-12 px-6">
        <h3 className="text-lg font-semibold text-white/80 mb-4">Learn More</h3>
        <div className="flex flex-wrap gap-3">
          <Link to="/methodology" className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/[0.06] transition">Methodology</Link>
          <Link to="/glossary" className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/[0.06] transition">Glossary</Link>
          <Link to="/pricing" className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/[0.06] transition">Pricing</Link>
          <Link to="/guide" className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/[0.06] transition">Implementation Guide</Link>
          <Link to="/insights" className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/[0.06] transition">Playbooks & Insights</Link>
        </div>
      </section>
    </div>
  );
};

export default WhyAIVisibility;
