import React from 'react';
import { CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
import { usePageMeta } from '../hooks/usePageMeta';
import { SITE_NAME } from '../config/constants';
import { Link } from 'react-router-dom';
import { buildBreadcrumbSchema, buildFaqSchema } from '../lib/seoSchema';

const PROFOUND_FAQ = [
  {
    question: 'Is AiVIS an enterprise narrative platform like Profound?',
    answer:
      'No. AiVIS is a citation-readiness and remediation engine that prioritizes page-level structural clarity and evidence-linked fixes.',
  },
  {
    question: 'Where does Profound remain stronger?',
    answer:
      'Profound is stronger in enterprise narrative monitoring and executive-level reporting workflows.',
  },
];

export default function CompareProfoundPage() {
  usePageMeta({
    title: `AiVIS.biz vs Profound AI: Enterprise Visibility Comparison`,
    description: `AiVIS.biz compared against Profound AI. Discover the differences in cost, speed, code-level execution, and agency scalability for AEO.`,
    path: '/compare/aivis-vs-profound',
    structuredData: [
      {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: `AiVIS.biz vs Profound AI: Which is better?`,
        author: { '@id': 'https://aivis.biz/#author' },
        publisher: { '@id': 'https://aivis.biz/#organization' },
      },
      ...buildFaqSchema(PROFOUND_FAQ, { path: '/compare/aivis-vs-profound' }),
      buildBreadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'Comparison', path: '/compare' },
        { name: 'AiVIS.biz vs Profound', path: '/compare/aivis-vs-profound' },
      ]),
    ],
  });

  return (
    <div className="max-w-4xl mx-auto py-12 px-6">
      <h1 className="text-4xl font-extrabold mb-6 tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
        AiVIS.biz vs. Profound AI
      </h1>
      <p className="text-xl text-gray-700 dark:text-gray-300 mb-8 leading-relaxed">
        Profound is an enterprise solution often focused on heavy, consultative brand analysis.{' '}
        <strong>AiVIS.biz</strong> is a focused, lightweight structural auditing engine designed for
        developers and technical marketers who want immediate code fixes, not month-long consulting
        cycles.
      </p>

      <section className="mb-8 rounded-xl border border-indigo-200/60 dark:border-white/10 bg-indigo-50 dark:bg-white/[0.03] p-5">
        <h2 className="text-xl font-bold text-indigo-700 dark:text-white mb-2">Quick answer</h2>
        <p className="text-sm text-gray-700 dark:text-white/70 leading-relaxed">
          Choose Profound for enterprise narrative intelligence. Choose AiVIS when your primary
          objective is to increase citation probability through deterministic structural fixes,
          evidence-linked scoring, and repeatable remediation loops.
        </p>
      </section>

      <section className="mb-12">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="p-4 border-b dark:border-gray-700 font-semibold border-r">
                  Attribute
                </th>
                <th className="p-4 border-b dark:border-gray-700 font-semibold border-r">
                  AiVIS.biz
                </th>
                <th className="p-4 border-b dark:border-gray-700 font-semibold">Profound AI</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-4 border-b border-r dark:border-gray-700 font-medium">
                  Time to Value
                </td>
                <td className="p-4 border-b border-r dark:border-gray-700">
                  <CheckCircle2 className="inline text-green-500 mr-2" /> &lt; 2 Minutes per audit
                </td>
                <td className="p-4 border-b dark:border-gray-700">
                  <XCircle className="inline text-gray-400 mr-2" /> Discovery call setup
                </td>
              </tr>
              <tr>
                <td className="p-4 border-b border-r dark:border-gray-700 font-medium">
                  Focus Area
                </td>
                <td className="p-4 border-b border-r dark:border-gray-700 bg-green-50/50 dark:bg-green-900/10">
                  <CheckCircle2 className="inline text-green-500 mr-2" /> Code, Schema & Structure
                </td>
                <td className="p-4 border-b dark:border-gray-700">
                  <CheckCircle2 className="inline text-gray-400 mr-2" /> Brand alignment & Narrative
                </td>
              </tr>
              <tr>
                <td className="p-4 border-b border-r dark:border-gray-700 font-medium">
                  Pricing Model
                </td>
                <td className="p-4 border-b border-r dark:border-gray-700 bg-green-50/50 dark:bg-green-900/10">
                  <CheckCircle2 className="inline text-green-500 mr-2" /> Transparent Hybrid SaaS
                </td>
                <td className="p-4 border-b dark:border-gray-700">
                  <XCircle className="inline text-gray-400 mr-2" /> Custom Enterprise Pricing
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-blue-50 dark:bg-blue-900/20 p-8 rounded-2xl border border-blue-100 dark:border-blue-800">
        <h3 className="text-2xl font-bold mb-3">The Speed of Execution</h3>
        <p className="mb-4 text-gray-700 dark:text-gray-300">
          AiVIS.biz is built to be embedded directly into agency tools and technical workflows via
          API, or used seamlessly via the dashboard to audit a page in under 60 seconds.
        </p>
        <Link
          to="/"
          className="inline-flex items-center font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700"
        >
          Start your audit now <ArrowRight className="ml-1 w-4 h-4" />
        </Link>
      </section>

      <section className="mt-8">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white/80 mb-4">
          Compare AiVIS.biz with other tools
        </h3>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/compare/aivis-vs-ahrefs"
            className="rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] px-4 py-2 text-sm text-gray-600 dark:text-white/70 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.06] transition"
          >
            vs Ahrefs
          </Link>
          <Link
            to="/compare/aivis-vs-semrush"
            className="rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] px-4 py-2 text-sm text-gray-600 dark:text-white/70 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.06] transition"
          >
            vs Semrush
          </Link>
          <Link
            to="/compare/aivis-vs-rankscale"
            className="rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] px-4 py-2 text-sm text-gray-600 dark:text-white/70 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.06] transition"
          >
            vs RankScale
          </Link>
          <Link
            to="/compare/aivis-vs-otterly"
            className="rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] px-4 py-2 text-sm text-gray-600 dark:text-white/70 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.06] transition"
          >
            vs Otterly
          </Link>
          <Link
            to="/compare/aivis-vs-reaudit"
            className="rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] px-4 py-2 text-sm text-gray-600 dark:text-white/70 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.06] transition"
          >
            vs Reaudit
          </Link>
        </div>
      </section>
    </div>
  );
}
