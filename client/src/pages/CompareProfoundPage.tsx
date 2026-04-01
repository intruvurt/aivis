import React from "react";
import { CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import { usePageMeta } from "../hooks/usePageMeta";
import { SITE_NAME } from "../config/constants";
import { Link } from "react-router-dom";

export default function CompareProfoundPage() {
  usePageMeta({
    title: `AiVIS vs Profound AI: Enterprise Visibility Comparison`,
    description: `AiVIS compared against Profound AI. Discover the differences in cost, speed, code-level execution, and agency scalability for AEO.`,
    path: '/compare/aivis-vs-profound',
    structuredData: [
      {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": `AiVIS vs Profound AI: Which is better?`,
        "author": { "@id": "https://aivis.biz/#author" },
        "publisher": { "@id": "https://aivis.biz/#organization" }
      }
    ]
  });

  return (
    <div className="max-w-4xl mx-auto py-12 px-6">
      <h1 className="text-4xl font-extrabold mb-6 tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
        AiVIS vs. Profound AI
      </h1>
      <p className="text-xl text-gray-700 dark:text-gray-300 mb-8 leading-relaxed">
        Profound is an enterprise solution often focused on heavy, consultative brand analysis. <strong>AiVIS</strong> is a ruthless, lightweight structural auditing engine designed for developers and technical marketers who want immediate code fixes, not month-long consulting cycles.
      </p>

      <section className="mb-12">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="p-4 border-b dark:border-gray-700 font-semibold border-r">Attribute</th>
                <th className="p-4 border-b dark:border-gray-700 font-semibold border-r">AiVIS</th>
                <th className="p-4 border-b dark:border-gray-700 font-semibold">Profound AI</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-4 border-b border-r dark:border-gray-700 font-medium">Time to Value</td>
                <td className="p-4 border-b border-r dark:border-gray-700"><CheckCircle2 className="inline text-green-500 mr-2"/> &lt; 2 Minutes per audit</td>
                <td className="p-4 border-b dark:border-gray-700"><XCircle className="inline text-gray-400 mr-2"/> Discovery call setup</td>
              </tr>
              <tr>
                <td className="p-4 border-b border-r dark:border-gray-700 font-medium">Focus Area</td>
                <td className="p-4 border-b border-r dark:border-gray-700 bg-green-50/50 dark:bg-green-900/10"><CheckCircle2 className="inline text-green-500 mr-2"/> Code, Schema & Structure</td>
                <td className="p-4 border-b dark:border-gray-700"><CheckCircle2 className="inline text-gray-400 mr-2"/> Brand alignment & Narrative</td>
              </tr>
              <tr>
                <td className="p-4 border-b border-r dark:border-gray-700 font-medium">Pricing Model</td>
                <td className="p-4 border-b border-r dark:border-gray-700 bg-green-50/50 dark:bg-green-900/10"><CheckCircle2 className="inline text-green-500 mr-2"/> Transparent Hybrid SaaS</td>
                <td className="p-4 border-b dark:border-gray-700"><XCircle className="inline text-gray-400 mr-2"/> Custom Enterprise Pricing</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-blue-50 dark:bg-blue-900/20 p-8 rounded-2xl border border-blue-100 dark:border-blue-800">
        <h3 className="text-2xl font-bold mb-3">The Speed of Execution</h3>
        <p className="mb-4 text-gray-700 dark:text-gray-300">
          AiVIS is built to be embedded directly into agency tools and technical workflows via API, or used seamlessly via the dashboard to audit a page in under 60 seconds.
        </p>
        <Link to="/" className="inline-flex items-center font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700">
          Start your audit now <ArrowRight className="ml-1 w-4 h-4" />
        </Link>
      </section>
    </div>
  );
}
