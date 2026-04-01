import React from 'react';
import { Link } from 'react-router-dom';
import { usePageMeta } from '../hooks/usePageMeta';
import { getInsightBySlug } from '../content/insights';
import { buildArticleSchema, buildBreadcrumbSchema } from '../lib/seoSchema';

const ARTICLE = getInsightBySlug('voice-search-ai-answer-optimization-2026');

const CHECKLIST = [
  'Lead every answer section with a single-sentence direct answer under 30 words.',
  'Add SpeakableSpecification schema to your primary answer blocks.',
  'Include FAQPage schema with questions phrased as complete spoken sentences.',
  'Use HowTo schema for procedural content with clear numbered steps.',
  'Add LocalBusiness schema with geo-coordinates for any location-relevant pages.',
  'Test answer extraction by asking voice assistants your target questions out loud.',
];

export default function VoiceSearchAIAnswerOptimization2026() {
  if (!ARTICLE) return null;

  usePageMeta({
    title: 'Voice Search & AI Answer Optimization 2026',
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
          <p className="text-xs font-semibold tracking-wide uppercase text-white/85 mb-3">Voice + AI Answers</p>
          <h1 className="text-3xl md:text-4xl brand-title-lg mb-4">{ARTICLE.title}</h1>
          <p className="text-white/75 leading-relaxed">{ARTICLE.description}</p>
        </header>

        <section className="mb-10 rounded-2xl border border-white/10/70 bg-charcoal p-6">
          <h2 className="text-2xl brand-title mb-4">Why Voice Is Winner-Take-All</h2>
          <p className="text-white/75 leading-relaxed mb-4">
            When someone asks Siri, Alexa, or Google Assistant a question, they get one answer. Not ten blue links. Not
            a carousel of options. One spoken response, usually under 30 seconds.
          </p>
          <p className="text-white/75 leading-relaxed mb-4">
            If your content is not the answer the model selects, you do not get second place. You get nothing. There is
            no "fold" to scroll below. There is no "next page" button. Voice is the most zero-sum interaction surface in AI search.
          </p>
          <ul className="space-y-2 list-disc list-inside text-white/75">
            <li>Voice queries are 3-5x longer than typed search queries</li>
            <li>Over 70% of voice queries use natural conversational phrasing</li>
            <li>Voice queries skew heavily toward local intent and immediate action</li>
            <li>Voice answers must be concise, speakable, and factually precise</li>
          </ul>
        </section>

        <section className="mb-10 rounded-2xl border border-white/10/70 bg-charcoal p-6">
          <h2 className="text-2xl brand-title mb-4">What Makes Content Voice-Ready</h2>
          <p className="text-white/75 leading-relaxed mb-4">
            Voice-ready content follows a specific structure that most web pages do not use:
          </p>
          <div className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-charcoal-deep p-4">
              <h3 className="text-lg font-semibold text-white/85 mb-2">Direct Answer First</h3>
              <p className="text-white/75 leading-relaxed">
                Every answer section must start with a single complete sentence that directly answers the question. This is
                what gets spoken. Everything after is supporting detail for text readers.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-charcoal-deep p-4">
              <h3 className="text-lg font-semibold text-white/85 mb-2">Speakable Length</h3>
              <p className="text-white/75 leading-relaxed">
                The primary answer must be under 30 words. Voice assistants truncate or skip answers that are too long to
                speak naturally. Write for the ear, not the eye.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-charcoal-deep p-4">
              <h3 className="text-lg font-semibold text-white/85 mb-2">Action-Oriented Phrasing</h3>
              <p className="text-white/75 leading-relaxed">
                Voice users say "find me," "show me," "how do I." Your content should mirror this action-oriented phrasing
                in headings and answer blocks. Passive descriptions get skipped.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-charcoal-deep p-4">
              <h3 className="text-lg font-semibold text-white/85 mb-2">Schema Markup</h3>
              <p className="text-white/75 leading-relaxed">
                SpeakableSpecification tells voice assistants which sections are voice-ready. FAQPage and HowTo schemas
                give structured content that voice assistants can parse into spoken steps and answers.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-10 rounded-2xl border border-white/10/70 bg-charcoal p-6">
          <h2 className="text-2xl brand-title mb-4">Voice Optimization Checklist</h2>
          <ol className="space-y-3 list-decimal list-inside text-white/75">
            {CHECKLIST.map((step) => (
              <li key={step} className="leading-relaxed">{step}</li>
            ))}
          </ol>
        </section>

        <section className="mb-10 rounded-2xl border border-white/10/70 bg-charcoal p-6">
          <h2 className="text-2xl brand-title mb-4">Voice vs Typed Conversational Queries</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-white/75">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 pr-4 text-white/85 font-semibold">Dimension</th>
                  <th className="text-left py-3 pr-4 text-white/85 font-semibold">Voice Queries</th>
                  <th className="text-left py-3 text-white/85 font-semibold">Typed Conversational</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-white/5">
                  <td className="py-3 pr-4 font-medium">Length</td>
                  <td className="py-3 pr-4">15-30 words</td>
                  <td className="py-3">10-20 words</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-3 pr-4 font-medium">Phrasing</td>
                  <td className="py-3 pr-4">Action-oriented, filler words</td>
                  <td className="py-3">More structured, fewer fillers</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-3 pr-4 font-medium">Intent</td>
                  <td className="py-3 pr-4">Immediate action, local</td>
                  <td className="py-3">Research, comparison</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-3 pr-4 font-medium">Expected Answer</td>
                  <td className="py-3 pr-4">Single spoken sentence</td>
                  <td className="py-3">Multi-paragraph with sources</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium">Competition</td>
                  <td className="py-3 pr-4">Winner-take-all</td>
                  <td className="py-3">Multiple citations possible</td>
                </tr>
              </tbody>
            </table>
          </div>
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
            <Link to="/conversational-query-playbook-2026" className="text-sm text-white/85 hover:text-white/85 font-semibold">
              Conversational Query Playbook 2026 →
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
