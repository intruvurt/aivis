import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

const faqData = [
  {
    question: "What is Ai Visibility Intelligence Audits?",
    answer: "Ai Visibility Intelligence Audits measures whether answer engines can read, trust, and cite your content when users get synthesized answers instead of blue links."
  },
  {
    question: "How is AI search different from SEO?",
    answer: (
      <ul id="src_components_FAQSection_2pav" className="brand-list list-none space-y-2">
        <li id="src_components_FAQSection_pr0b">SEO targets traditional search engines with keywords, links, and structure.</li>
        <li id="src_components_FAQSection_nbn5">Answer engines rely on semantic understanding, trust signals, and reusable answer blocks.</li>
        <li id="src_components_FAQSection_j5ck">AI prioritizes clear questions, direct answers, and machine-readable entity signals.</li>
      </ul>
    )
  },
  {
    question: "What does AiVis analyze?",
    answer: (
      <ul id="src_components_FAQSection_stx0" className="brand-list list-none space-y-2">
        <li id="src_components_FAQSection_frw0">Audits page structure and metadata</li>
        <li id="src_components_FAQSection_eem7">Evaluates AI readability and clarity</li>
        <li id="src_components_FAQSection_t9oq">Identifies missing or ambiguous signals</li>
        <li id="src_components_FAQSection_pe9y">Provides actionable fixes</li>
      </ul>
    )
  },
  {
    question: "Does AiVis work for ChatGPT or Google AI?",
    answer: "Yes. AiVis is designed to assess content as it would be interpreted by major AI engines like ChatGPT and Google AI, though it is not affiliated with them."
  },
  {
    question: "How does AiVis work?",
    answer: (
      <ul id="src_components_FAQSection_6hvg" className="brand-list list-none space-y-2">
        <li id="src_components_FAQSection_w5wx">Audits all visible and hidden content</li>
        <li id="src_components_FAQSection_iph0">Evaluates headings and FAQs for best AI discoverability</li>
        <li id="src_components_FAQSection_a8hr">Flags weak definitions and ambiguous question-answer sections</li>
        <li id="src_components_FAQSection_3azr">Provides a prioritized fix list</li>
      </ul>
    )
  }
];

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (idx: number) => setOpenIndex(prev => prev === idx ? null : idx);

  return (
    <section id="src_components_FAQSection_main" className="py-20 bg-gradient-to-b from-[#0a0a0f] to-[#060607]">
      <div id="src_components_FAQSection_container" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 id="src_components_FAQSection_title" className="text-4xl font-bold text-white mb-12 text-center">
          Frequently Asked Questions
        </h2>
        <dl id="src_components_FAQSection_list" className="space-y-4">
          {faqData.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div 
                key={idx} 
                id={`src_components_FAQSection_item_${idx}`}
                className="bg-[#323a4c]/50 border border-white/10 rounded-lg overflow-hidden hover:border-white/10 transition-all"
              >
                <button
                  type="button"
                  onClick={() => toggle(idx)}
                  className="flex w-full items-center justify-between gap-4 p-6 text-left"
                  aria-expanded={isOpen}
                  aria-controls={`faq-panel-${idx}`}
                >
                  <dt id={`src_components_FAQSection_q_${idx}`} className="text-xl font-semibold text-white">
                    {faq.question}
                  </dt>
                  <ChevronDown className={`h-5 w-5 shrink-0 text-white/45 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
                {isOpen && (
                  <dd id={`src_components_FAQSection_a_${idx}`} className="px-6 pb-6 text-white/55 leading-relaxed" role="region" aria-labelledby={`src_components_FAQSection_q_${idx}`}>
                    {faq.answer}
                  </dd>
                )}
              </div>
            );
          })}
        </dl>
      </div>
    </section>
  );
}
