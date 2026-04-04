import React, { useMemo, useState } from "react";
import { ChevronDown, HelpCircle, Search } from "lucide-react";
import { usePageMeta } from "../hooks/usePageMeta";
import PublicPageFrame from "../components/PublicPageFrame";
import { buildBreadcrumbSchema, buildFaqSchema, buildWebPageSchema } from "../lib/seoSchema";

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQCategory {
  id: string;
  label: string;
  items: FAQItem[];
}

const categories: FAQCategory[] = [
  {
    id: "getting-started",
    label: "Getting Started",
    items: [
      {
        question: "What is AiVIS?",
        answer:
          "AiVIS audits whether answer engines can understand, trust, and cite your website. It is built for AI visibility, not just classic search rankings.",
      },
      {
        question: "Who is this built for?",
        answer:
          "Operators, in-house teams, consultants, and agencies that need evidence-backed visibility audits and actionable remediation paths.",
      },
      {
        question: "How long does an audit take?",
        answer:
          "Most audits finish in under a minute. Larger pages or deeper validation paths can take longer depending on crawl and model runtime.",
      },
    ],
  },
  {
    id: "analysis",
    label: "Analysis & Scoring",
    items: [
      {
        question: "What does the score mean?",
        answer:
          "The 0-100 score reflects how confidently AI systems can parse, trust, and cite your page across six weighted dimensions.",
      },
      {
        question: "How is this different from a normal SEO audit?",
        answer:
          "Traditional SEO audits optimize for ranked pages and clicks. AiVIS evaluates extraction quality, trust signals, and citation readiness for answer engines.",
      },
      {
        question: "What are recommendations based on?",
        answer:
          "Recommendations come from evidence found or missing on your actual page. They are tied to specific crawl-observable fields instead of generic advice.",
      },
    ],
  },
  {
    id: "plans",
    label: "Plans & Pricing",
    items: [
      {
        question: "What does the free tier include?",
        answer:
          "Observer gives you verdict-first audits with core blockers and a limited starter allowance so you can prove value before upgrading.",
      },
      {
        question: "What do paid tiers unlock?",
        answer:
          "Paid tiers unlock deeper evidence, competitor intelligence, stronger validation flows, and more automation around remediation and reporting.",
      },
      {
        question: "Can I share or export reports?",
        answer:
          "Yes. Paid tiers support richer exports and public links. Observer is intentionally more constrained.",
      },
    ],
  },
  {
    id: "privacy",
    label: "Privacy & Security",
    items: [
      {
        question: "Do you store my audit data?",
        answer:
          "Audit outputs are stored for history, report access, and comparison features. AiVIS does not sell your data.",
      },
      {
        question: "Is payment information stored by AiVIS?",
        answer:
          "No. Payments are handled through Stripe. AiVIS does not store raw card details.",
      },
      {
        question: "Can I export or delete my account data?",
        answer:
          "Yes. Privacy controls in Settings let you request exports and permanent deletion flows.",
      },
    ],
  },
  {
    id: "platform",
    label: "Technical & Platform",
    items: [
      {
        question: "Is there an API?",
        answer:
          "Yes. Paid tiers expose API and automation paths for audits, analytics, and webhook-driven workflows.",
      },
      {
        question: "Does AiVIS test live citations?",
        answer:
          "Yes. Citation and mention workflows are available on higher tiers and are designed to show whether your site is being surfaced in real answer environments.",
      },
      {
        question: "Can agencies use this for clients?",
        answer:
          "Yes. The product is designed to support internal teams and agency workflows with reports, collaboration, and evidence trails.",
      },
    ],
  },
];

function AccordionItem({ item, isOpen, onToggle }: { item: FAQItem; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      <button onClick={onToggle} className="flex w-full items-center justify-between gap-4 text-left" type="button">
        <span className="text-base font-semibold text-white">{item.question}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-white/45 transition ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen ? <p className="mt-4 text-sm leading-7 text-white/64">{item.answer}</p> : null}
    </div>
  );
}

export default function FAQ() {
  const [query, setQuery] = useState("");
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});

  const allItems = categories.flatMap((category) => category.items);

  usePageMeta({
    title: "AiVIS FAQ | Plans, scoring, data, and platform answers",
    description: "Common questions about AiVIS pricing, methodology, privacy, scoring, and AI visibility workflows.",
    path: "/faq",
    structuredData: [
      buildWebPageSchema({
        path: "/faq",
        name: "AiVIS FAQ",
        description: "Common questions about AiVIS pricing, methodology, privacy, scoring, and AI visibility workflows.",
      }),
      buildFaqSchema(allItems.map((item) => ({ question: item.question, answer: item.answer }))),
      buildBreadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "FAQ", path: "/faq" },
      ]),
    ],
  });

  const filteredCategories = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return categories;
    return categories
      .map((category) => ({
        ...category,
        items: category.items.filter((item) => `${item.question} ${item.answer}`.toLowerCase().includes(needle)),
      }))
      .filter((category) => category.items.length > 0);
  }, [query]);

  return (
    <PublicPageFrame
      icon={HelpCircle}
      title="Frequently asked questions"
      subtitle="Clear product answers without the giant bordered-slab FAQ treatment."
      backTo="/"
      maxWidthClass="max-w-5xl"
    >
      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-white/48">Search the FAQ</label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/34" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Pricing, data retention, scoring, API access..."
            className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3 pl-11 pr-4 text-sm text-white placeholder:text-white/32 focus:outline-none focus:ring-2 focus:ring-orange-400/70"
          />
        </div>
      </section>

      <div className="mt-8 space-y-10">
        {filteredCategories.map((category) => (
          <section key={category.id}>
            <h2 className="text-xl font-semibold tracking-tight text-white">{category.label}</h2>
            <div className="mt-4 space-y-3">
              {category.items.map((item) => {
                const key = `${category.id}:${item.question}`;
                return (
                  <AccordionItem
                    key={key}
                    item={item}
                    isOpen={Boolean(openMap[key])}
                    onToggle={() => setOpenMap((prev) => ({ ...prev, [key]: !prev[key] }))}
                  />
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </PublicPageFrame>
  );
}
