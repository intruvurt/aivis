import React from "react";
import { CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import { usePageMeta } from "../hooks/usePageMeta";
import { SITE_NAME } from "../config/constants";
import { Link } from "react-router-dom";

export default function CompareOtterlyPage() {
  usePageMeta({
    title: `AiVIS.biz vs Otterly: Better AI SEO & Visibility Auditing (2026 Comparison)`,
    description: 'AiVIS.biz vs Otterly AI: compare LLM response parsing, entity-trust metrics, and un-gated AEO recommendations side by side.',
    path: '/compare/aivis-vs-otterly',
    structuredData: [
      {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": `AiVIS.biz vs Otterly: Which AI Visibility Tool Wins?`,
        "author": { "@id": "https://aivis.biz/#author" },
        "publisher": { "@id": "https://aivis.biz/#organization" }
      }
    ]
  });

  return (
    <div className="max-w-4xl mx-auto py-12 px-6">
      <h1 className="text-4xl font-extrabold mb-6 tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
        AiVIS.biz vs. Otterly
      </h1>
      <p className="text-xl text-gray-700 dark:text-gray-300 mb-8 leading-relaxed">
        Otterly helped popularize the concept of "AI Search Optimization" (AEO) by tracking brand 
        mentions using standard RAG models. However, <strong>AiVIS.biz</strong> goes beyond tracking-it gives you 
        the exact architectural fixes, JSON-LD schemas, and content structures required to rank 
        in AI Overviews, Perplexity, and ChatGPT. 
      </p>

      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-4 text-indigo-700 dark:text-indigo-300">Feature Comparison</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="p-4 border-b dark:border-gray-700 font-semibold border-r">Feature</th>
                <th className="p-4 border-b dark:border-gray-700 font-semibold border-r">AiVIS.biz</th>
                <th className="p-4 border-b dark:border-gray-700 font-semibold">Otterly</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-4 border-b border-r dark:border-gray-700 font-medium">Extractability Auditing</td>
                <td className="p-4 border-b border-r dark:border-gray-700 bg-green-50/50 dark:bg-green-900/10"><CheckCircle2 className="inline text-green-500 mr-2"/> Full DOM & JSON-LD parsing</td>
                <td className="p-4 border-b dark:border-gray-700"><CheckCircle2 className="inline text-gray-400 mr-2"/> Basic URL mention tracking</td>
              </tr>
              <tr>
                <td className="p-4 border-b border-r dark:border-gray-700 font-medium">Model Triple-Check Algorithm</td>
                <td className="p-4 border-b border-r dark:border-gray-700 bg-green-50/50 dark:bg-green-900/10"><CheckCircle2 className="inline text-green-500 mr-2"/> Yes (Anti-Hallucination)</td>
                <td className="p-4 border-b dark:border-gray-700"><XCircle className="inline text-red-400 mr-2"/> Single-pass LLM scoring</td>
              </tr>
              <tr>
                <td className="p-4 border-b border-r dark:border-gray-700 font-medium">Actionable Code Fixes</td>
                <td className="p-4 border-b border-r dark:border-gray-700 bg-green-50/50 dark:bg-green-900/10"><CheckCircle2 className="inline text-green-500 mr-2"/> Generates Schema & Header fixes</td>
                <td className="p-4 border-b dark:border-gray-700"><XCircle className="inline text-red-400 mr-2"/> Dashboard metrics only</td>
              </tr>
              <tr>
                <td className="p-4 border-b border-r dark:border-gray-700 font-medium">Evidence-Backed Recommendations</td>
                <td className="p-4 border-b border-r dark:border-gray-700 bg-green-50/50 dark:bg-green-900/10"><CheckCircle2 className="inline text-green-500 mr-2"/> Structured 8-12 recommendations per audit</td>
                <td className="p-4 border-b dark:border-gray-700"><XCircle className="inline text-red-400 mr-2"/> Often broad guidance without implementation detail</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      
      <section className="bg-blue-50 dark:bg-blue-900/20 p-8 rounded-2xl border border-blue-100 dark:border-blue-800">
        <h3 className="text-2xl font-bold mb-3 text-blue-800 dark:text-blue-200">The AiVIS.biz Advantage</h3>
        <p className="mb-4 text-gray-700 dark:text-gray-300">
          If you want to know <em>how often</em> you appear in conversational search, Otterly is fine. 
          But if you want to know <strong>why you aren't appearing, and precisely what code to change to fix it</strong>, 
          you need the AiVIS.biz structural analysis engine.
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
          <Link to="/compare/profound" className="rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] px-4 py-2 text-sm text-gray-600 dark:text-white/70 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.06] transition">vs Profound</Link>
          <Link to="/compare/reaudit" className="rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] px-4 py-2 text-sm text-gray-600 dark:text-white/70 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.06] transition">vs Reaudit</Link>
        </div>
      </section>
    </div>
  );
}
