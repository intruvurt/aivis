import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { FaqItem } from "../lib/seoSchema";

interface PageQASectionProps {
  items: FaqItem[];
  heading?: string;
  className?: string;
}

/** Reusable collapsible Q&A accordion for all tool/feature pages.
 *  Renders visible FAQ content that AI answer engines can extract and cite.
 *  Wire `items` to `buildFaqSchema` in `usePageMeta` for JSON-LD injection. */
export default function PageQASection({ items, heading = "Frequently asked questions", className = "" }: PageQASectionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section
      aria-label={heading}
      className={`rounded-[22px] border border-white/10 bg-white/[0.03] p-4 sm:p-6 ${className}`}
    >
      <h2 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">{heading}</h2>
      <p className="mt-1 text-sm text-slate-400">
        Factual answers to common questions about this feature — structured for AI extraction.
      </p>
      <div className="mt-5 space-y-2">
        {items.map((item, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div
              key={item.question}
              className="rounded-[14px] border border-white/10 bg-slate-950/50 overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : idx)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-white/5"
              >
                <h3 className="text-sm font-medium text-white sm:text-base leading-snug pr-4">
                  {item.question}
                </h3>
                <ChevronDown
                  className={`h-4 w-4 flex-shrink-0 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                />
              </button>
              {isOpen && (
                <div className="px-4 pb-4 pt-1">
                  <p className="text-sm leading-7 text-slate-300">{item.answer}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
