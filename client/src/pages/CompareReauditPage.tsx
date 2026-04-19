import React from "react";
import { CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import { usePageMeta } from "../hooks/usePageMeta";
import { SITE_NAME } from "../config/constants";
import { Link } from "react-router-dom";

export default function CompareReauditPage() {
  usePageMeta({
    title: `AiVIS.biz vs Reaudit: Technical AI SEO Compared`,
    description: `Detailed comparison of ${SITE_NAME} vs Reaudit. Why AiVIS.biz delivers more complete structural AEO (AI Engine Optimization) payload reviews.`,
    path: '/compare/aivis-vs-reaudit',
    structuredData: [
      {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": `AiVIS.biz vs Reaudit for Technical AEO`,
        "author": { "@id": "https://aivis.biz/#author" },
        "publisher": { "@id": "https://aivis.biz/#organization" }
      }
    ]
  });

  return (
    <div className="max-w-4xl mx-auto py-12 px-6">
      <h1 className="text-4xl font-extrabold mb-6 tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
        AiVIS.biz vs. Reaudit
      </h1>
      <p className="text-xl text-gray-700 dark:text-gray-300 mb-8 leading-relaxed">
        Reaudit focuses defensively on traditional technical SEO overlaps. <strong>AiVIS.biz</strong> is built offensively for the AEO (AI Engine Optimization) era-validating machine-readability down to the JSON-LD layer for direct LLM ingestion.
      </p>

      <section className="mb-12">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="p-4 border-b dark:border-gray-700 font-semibold border-r">Feature Focus</th>
                <th className="p-4 border-b dark:border-gray-700 font-semibold border-r">AiVIS.biz</th>
                <th className="p-4 border-b dark:border-gray-700 font-semibold">Reaudit</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-4 border-b border-r dark:border-gray-700 font-medium">Headless Extractability Score</td>
                <td className="p-4 border-b border-r dark:border-gray-700 bg-green-50/50 dark:bg-green-900/10"><CheckCircle2 className="inline text-green-500 mr-2"/> Scanned as Headless Bot</td>
                <td className="p-4 border-b dark:border-gray-700"><CheckCircle2 className="inline text-gray-400 mr-2"/> Yes</td>
              </tr>
              <tr>
                <td className="p-4 border-b border-r dark:border-gray-700 font-medium">Entity & Trust Signal Output</td>
                <td className="p-4 border-b border-r dark:border-gray-700 bg-green-50/50 dark:bg-green-900/10"><CheckCircle2 className="inline text-green-500 mr-2"/> Full Payload Review</td>
                <td className="p-4 border-b dark:border-gray-700"><XCircle className="inline text-red-400 mr-2"/> Limited Entity Support</td>
              </tr>
              <tr>
                <td className="p-4 border-b border-r dark:border-gray-700 font-medium">Generated JSON-LD Fixes</td>
                <td className="p-4 border-b border-r dark:border-gray-700 bg-green-50/50 dark:bg-green-900/10"><CheckCircle2 className="inline text-green-500 mr-2"/> Actionable Code Provided</td>
                <td className="p-4 border-b dark:border-gray-700"><XCircle className="inline text-red-400 mr-2"/> Guidelines Only</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-blue-50 dark:bg-blue-900/20 p-8 rounded-2xl border border-blue-100 dark:border-blue-800">
        <h3 className="text-2xl font-bold mb-3">Why Developers Choose AiVIS.biz</h3>
        <p className="mb-4 text-gray-700 dark:text-gray-300">
          We don't just tell you that your site is unreadable. We provide the exact structured data block and ARIA landmarks required to force Perplexity and ChatGPT to parse your site properly.
        </p>
        <Link to="/" className="inline-flex items-center font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700">
          Run your free audit now <ArrowRight className="ml-1 w-4 h-4" />
        </Link>
      </section>

      <section className="mt-8">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white/80 mb-4">Compare AiVIS.biz with other tools</h3>
        <div className="flex flex-wrap gap-3">
          <Link to="/compare/ahrefs" className="rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] px-4 py-2 text-sm text-gray-600 dark:text-white/70 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.06] transition">vs Ahrefs</Link>
          <Link to="/compare/semrush" className="rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] px-4 py-2 text-sm text-gray-600 dark:text-white/70 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.06] transition">vs Semrush</Link>
          <Link to="/compare/rankscale" className="rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] px-4 py-2 text-sm text-gray-600 dark:text-white/70 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.06] transition">vs RankScale</Link>
          <Link to="/compare/otterly" className="rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] px-4 py-2 text-sm text-gray-600 dark:text-white/70 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.06] transition">vs Otterly</Link>
          <Link to="/compare/profound" className="rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] px-4 py-2 text-sm text-gray-600 dark:text-white/70 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.06] transition">vs Profound</Link>
        </div>
      </section>
    </div>
  );
}
