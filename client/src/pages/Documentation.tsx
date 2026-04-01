import React from "react";

const Documentation = () => {
  return (
    <div id="src_pages_documentation_a1b2" className="max-w-4xl mx-auto p-8 bg-gray-800 text-gray-100 rounded-lg shadow-lg my-8">
      <h1 id="src_pages_documentation_h1c3" className="text-4xl font-bold mb-6 text-accent">
        Machine-First Content Formatting Guidelines
      </h1>
      
      <h2 id="src_pages_documentation_h2d4" className="text-2xl font-semibold mt-8 mb-3 text-gray-200">
        Definition
      </h2>
      <p id="src_pages_documentation_pe5" className="mb-4 text-gray-300 leading-relaxed">
        Machine-first formatting optimizes content for AI and algorithmic readability by prioritizing structure and clarity over stylistic prose.
      </p>
      <p id="src_pages_documentation_pf6" className="mb-4 text-gray-300 leading-relaxed">
        For AI ingestion, format beats style.
      </p>

      <h2 id="src_pages_documentation_h2g7" className="text-2xl font-semibold mt-8 mb-3 text-gray-200">
        Key Rules
      </h2>
      <ul id="src_pages_documentation_ulh8" className="list-disc ml-6 mb-4 text-gray-300 space-y-2">
        <li id="src_pages_documentation_lii9">Clear heading hierarchy (H1 → H2 → H3)</li>
        <li id="src_pages_documentation_lij0">Short paragraphs (1–3 sentences)</li>
        <li id="src_pages_documentation_lik1">Definition-first in every section</li>
        <li id="src_pages_documentation_lil2">Use lists instead of prose when possible</li>
      </ul>

      <h2 id="src_pages_documentation_h2m3" className="text-2xl font-semibold mt-8 mb-3 text-gray-200">
        Bad for AI
      </h2>
      <ul id="src_pages_documentation_uln4" className="list-disc ml-6 mb-4 text-gray-300 space-y-2">
        <li id="src_pages_documentation_lio5">Poetic hero copy only</li>
        <li id="src_pages_documentation_lip6">Clever metaphors</li>
        <li id="src_pages_documentation_liq7">Implied meaning</li>
      </ul>

      <h2 id="src_pages_documentation_h2r8" className="text-2xl font-semibold mt-8 mb-3 text-gray-200">
        Good for AI
      </h2>
      <div id="src_pages_documentation_divs9" className="mb-6 bg-gray-700 p-4 rounded-lg">
        <h3 id="src_pages_documentation_h3t0" className="text-xl font-bold mb-3 text-accent">
          How AiVis Works
        </h3>
        <ul id="src_pages_documentation_ulu1" className="list-disc ml-6 text-gray-300 space-y-2">
          <li id="src_pages_documentation_liv2">Scans page structure and metadata</li>
          <li id="src_pages_documentation_liw3">Evaluates AI readability and clarity</li>
          <li id="src_pages_documentation_lix4">Identifies missing or ambiguous signals</li>
          <li id="src_pages_documentation_liy5">Provides actionable fixes</li>
        </ul>
      </div>

      <h2 id="src_pages_documentation_h2z6" className="text-2xl font-semibold mt-8 mb-3 text-gray-200">
        Formatting Example
      </h2>
      <ol id="src_pages_documentation_ola7" className="list-decimal ml-6 mb-4 text-gray-300 space-y-2">
        <li id="src_pages_documentation_lib8">Start with a clear H1 for topic.</li>
        <li id="src_pages_documentation_lic9">Break down sections under H2/H3.</li>
        <li id="src_pages_documentation_lid0">Use short lists or bullet points where possible.</li>
        <li id="src_pages_documentation_lie1">Avoid unfamiliar idioms or unnecessary adjectives.</li>
      </ol>

      <div id="src_pages_documentation_divf2" className="mt-12 pt-6 border-t border-gray-600 text-xs text-gray-400">
        <p id="src_pages_documentation_pg3">
          © {new Date().getFullYear()} AiVis. All rights reserved.
          <br id="src_pages_Documentation_pt3w"/>
          Powered by icōd.ai
        </p>
      </div>
    </div>
  );
};

export default Documentation;
