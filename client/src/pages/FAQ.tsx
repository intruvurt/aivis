import React, { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  Search,
  ArrowLeft,
  HelpCircle,
  Zap,
  CreditCard,
  Shield,
  BarChart3,
  Globe,
} from "lucide-react";
import { usePageMeta } from "../hooks/usePageMeta";
import { MARKETING_CLAIMS } from "../constants/marketingClaims";
import { buildBreadcrumbSchema, buildFaqSchema, buildWebPageSchema } from "../lib/seoSchema";

/* ------------------------------------------------------------------ */
/* FAQ data — grouped by category                                      */
/* ------------------------------------------------------------------ */

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQCategory {
  id: string;
  label: string;
  icon: React.ElementType;
  items: FAQItem[];
}

const categories: FAQCategory[] = [
  {
    id: "getting-started",
    label: "Getting Started",
    icon: HelpCircle,
    items: [
      {
        question: "What is Ai Visibility Intelligence Audits?",
        answer:
          "Ai Visibility Intelligence Audits analyzes your website to determine whether answer engines can understand, trust, and cite your business. Unlike traditional SEO, this is about becoming an AI-readable entity when answers increasingly replace links.",
      },
      {
        question: "Who is this built for?",
        answer:
          "Small and medium businesses, consultants, agencies, and anyone who depends on being found online. If your competitors are showing up in AI answers and you're not, you're losing revenue to an invisible shift in search behavior.",
      },
      {
        question: "How does an AI audit work?",
        answer:
          "Enter your URL and AiVIS crawls public page signals, scores the page, and returns fixes tied to observed evidence. Signal and Score Fix add deeper validation and remediation output.",
      },
      {
        question: "Do I need technical knowledge to use this?",
        answer:
          "Not at all. The report is written in plain language with clear, prioritized recommendations. Each suggestion tells you exactly what to change and why it matters for AI discoverability. If you have a developer, the technical details are there too.",
      },
      {
        question: "How long does an analysis take?",
        answer:
          "Most audits complete in 30–60+ seconds. Comprehensive audits on large sites may take up to two minutes. You'll see a real-time progress indicator and results appear as soon as the pipeline finishes.",
      },
    ],
  },
  {
    id: "analysis",
    label: "Analysis & Scoring",
    icon: BarChart3,
    items: [
      {
        question: "What does my visibility score mean?",
        answer:
          "Your score (0–100) reflects how discoverable your site is to AI systems across six deterministic dimensions: Content Depth, Schema Coverage, AI Readability, Metadata Quality, Heading Structure, and Technical SEO. Scores below 40 indicate major structural barriers (Poor/Critical). Pages between 40–59 are parseable but often deprioritized (Fair). Above 70 generally indicates stronger citation readiness. Results also include a runtime truth layer (`analysis_integrity.execution_class` plus GEO/SSFR contradiction checks) so teams can distinguish live execution from fallback modes.",
      },
      {
        question: "What is the triple-check AI pipeline?",
        answer:
          "Signal and Score Fix use a three-stage pipeline: analyze, critique, validate. If a later stage fails, AiVIS degrades gracefully instead of faking certainty.",
      },
      {
        question: "How accurate are the results?",
        answer:
          "AiVIS only scores what it can observe from your live page. If something cannot be verified, it is marked unknown instead of guessed.",
      },
      {
        question: "What platforms does this cover?",
        answer:
          "We analyze your visibility across ChatGPT, Perplexity, Claude, and Google AI/Gemini. Each platform weighs signals differently, and our report highlights where you're strong and where you're missing across the score channels we actually return in the audit payload.",
      },
      {
        question: "How is this different from traditional SEO tools?",
        answer:
          "Traditional SEO tools focus on Google's link-based ranking algorithm: keywords, backlinks, and page speed. AiVIS focuses on whether answer engines can interpret, trust, and cite your site when users get synthesized answers instead of ten blue links. You can rank #1 on Google and still be invisible to ChatGPT if your content lacks clear structure, authority signals, and direct answers.",
      },
      {
        question:
          "Ai Visibility Intelligence Audits answers three core questions about your site’s presence in AI search engines:",
        answer: `Are AI systems mentioning us?
How are they describing us?
Are competitors being recommended instead?`,
      },
      {
        question: "What are the recommendations based on?",
        answer:
          "Recommendations come from evidence found or missing on your actual pages. They point to specific fields, gaps, or structural problems instead of generic advice.",
      },
      {
        question: "What checks happen before citing a site as factual?",
        answer:
          "We apply a quick credibility + visibility review in addition to structural scoring: author or organization traceability, evidence-backed claims that can be cross-checked, publish/update freshness, and potential bias or commercial incentives (including affiliate-heavy framing). For visibility context, we review branded and topic-query presence, indexed-page footprint, and third-party mentions from reputable domains such as institutions, niche publications, and trusted communities.",
      },
      {
        question: "What is the BRAG evidence system?",
        answer:
          "BRAG is the evidence system behind AiVIS. Each finding carries an evidence ID linked to a specific scraped page element so claims can be verified.",
      },
    ],
  },
  {
    id: "pricing",
    label: "Plans & Pricing",
    icon: CreditCard,
    items: [
      {
        question: "What can I do on the free tier?",
        answer:
          "Observer includes 3 lifetime audits (up to 3 pages per audit), verdict-first scoring, top blockers, and a competitor gap preview. Full evidence and competitor source intelligence are locked to paid tiers. No credit card is required.",
      },
      {
        question: "What do paid tiers add?",
        answer:
          "Alignment unlocks full evidence and fix planning. Signal adds tracking over time (citation movement, source gaps, deltas, alerts). Score Fix adds remediation execution and post-fix verification workflows.",
      },
      {
        question: "Can I export or share my report?",
        answer:
          "Observer, Alignment, Signal, and Score Fix tiers can generate public view links. JSON export is available on Alignment, Signal, and Score Fix. Observer links are intentionally redacted for safe sharing while still enabling distribution and proof.",
      },
      {
        question: "How is usage enforced?",
        answer:
          "Usage is enforced server-side with hard caps and real-time counters. Observer is treated as a constrained starter allowance; paid tiers use recurring or credit-based limits based on plan rules shown in Billing.",
      },
      {
        question: "What are the current audit credit packs and tier boosts?",
        answer:
          "Audit credit packs and tier boosts are always shown as live pricing in Billing before checkout. If you're already on Signal, each pack gets a +20% credit boost; Score Fix gets +40%. Billing always shows the effective audits you'll receive before checkout.",
      },
      {
        question: "Do Signal and Score Fix include initial credit bonuses?",
        answer:
          "Initial bonus credits are applied on tier activation and shown in Billing. Signal supports monthly and annual subscription bonus paths. Score Fix is now a one-time remediation purchase and follows the one-time bonus policy shown in Billing at checkout.",
      },
      {
        question: "Can I cancel or switch plans anytime?",
        answer:
          "Yes. Alignment and Signal subscriptions can be upgraded, downgraded, or cancelled from Billing, with access through the end of the active billing period. Score Fix is a one-time purchase, so it does not renew monthly.",
      },
      {
        question: "How does referral credit payout work now?",
        answer:
          "Referral credits are now eligibility-based. Credits are awarded only after the referred account completes 5 or more audits. If the referred account upgrades to a paid tier (Alignment, Signal, or Score Fix), the reward is multiplied 3× for both the referrer and the referred user.",
      },
    ],
  },
  {
    id: "technical",
    label: "Technical",
    icon: Zap,
    items: [
      {
        question: "What data do you collect from my site?",
        answer:
          "We crawl your publicly accessible pages the same way any search engine would. We extract HTML structure, meta tags, schema markup, headings, and text content. We do not execute JavaScript login flows, access password-protected areas, or scrape private data.",
      },
      {
        question: "Can I rescan a site I've already analyzed?",
        answer:
          "Yes. Results are cached by plan to save your audit quota, and eligible paid tiers can force a fresh re-audit to bypass cache and check whether improvements took effect. Observer can re-run after cache expiry using the normal audit flow.",
      },
      {
        question: "What if the analysis fails or returns partial results?",
        answer:
          "If a page can't be crawled (e.g. it blocks bots or times out), we return partial results with clear error indicators. The areas we could analyze are still scored, and inaccessible areas are marked as 'Unknown' so you know where to investigate.",
      },
      {
        question: "Is there an API?",
        answer:
          "Yes. API access is live on Signal and Score Fix. Generate API keys from Settings → Advanced, then use the read-only v1 endpoints (for audits and analytics) plus webhook delivery for audit completion events.",
      },
      {
        question: "What is the MCP Server Console?",
        answer:
          "MCP (Model Context Protocol) lets you connect AI coding agents — Claude, Cursor, Windsurf — directly to your AiVIS account. Agents can run audits, pull reports, and query analytics through their native tool interface. Available on Alignment and above.",
      },
      {
        question: "What is GSC Intelligence?",
        answer:
          "GSC Intelligence connects Google Search Console to AiVIS. It detects declining pages, low-CTR opportunities, keyword cannibalization, and surfaces real search performance data alongside your AI visibility audits. Available on Alignment and above.",
      },
      {
        question: "How does brand mention tracking work?",
        answer:
          "AiVIS scans 15 sources (Reddit, Hacker News, Mastodon, DuckDuckGo, Bing, Google News, GitHub, Quora, Product Hunt, Stack Overflow, Wikipedia, Dev.to, Medium, YouTube, and Lobsters) for your brand mentions. Each result is timestamped and linked. Available on Alignment and above.",
      },
      {
        question: "Can AiVIS send automated platform newsletters to signup users?",
        answer:
          "AiVIS newsletters are now admin-controlled by default. Admins can draft editions, set advanced dispatch preferences (batch size, tier filters, delays), run dry-runs, and trigger sends manually from the Admin dashboard. Periodic automation can be enabled explicitly through admin settings when needed.",
      },
    ],
  },
  {
    id: "privacy",
    label: "Privacy & Security",
    icon: Shield,
    items: [
      {
        question: "Do you store my data?",
        answer:
          "Analysis results are cached in our database for performance and history features. We do not sell your data, do not run third-party analytics trackers, and do not share your results with anyone. You can delete your data anytime from your Privacy settings.",
      },
      {
        question: "Is my payment information secure?",
        answer:
          "All payments are processed through Stripe. We never see or store your card details. Stripe is PCI Level 1 certified, the highest level of security in the payments industry.",
      },
      {
        question: "Can I download or delete all my data?",
        answer:
          "Yes. In Settings → Privacy & Data, you can download a full export of your data or request permanent deletion of your account and all associated analysis history.",
      },
      {
        question: "Does AiVIS detect malicious websites?",
        answer:
          "Yes. Every audit includes a real-time threat intelligence scan. We check your URL against URLhaus (known malicious URLs from abuse.ch), Google Safe Browsing API v4 (social engineering, malware, unwanted software), and our own hostname heuristics (punycode detection, risky TLDs, raw IP hosting). Results appear in a Threat Intel banner on your report with a risk level from Low to Critical.",
      },
    ],
  },
  {
    id: "platform",
    label: "About the Platform",
    icon: Globe,
    items: [
      {
        question: "What AI models power the analysis?",
        answer:
          `${MARKETING_CLAIMS.modelAllocation} Canonical source: ${MARKETING_CLAIMS.modelTruthUrl}`,
      },
      {
        question: "How often do you update the analysis criteria?",
        answer:
          "We continuously refine our scoring rubric as AI search engines evolve. When a major platform changes how it discovers and cites content, we update our criteria within days, not months.",
      },
      {
        question: "Do you offer white-label or agency plans?",
        answer:
          "Yes. Signal and Score Fix include white-label reporting plus agency-focused automation and monitoring features.",
      },
      {
        question: "I have a question not listed here.",
        answer:
          "Reach out at support@aivis.biz or use the feedback widget in the app. We respond to every message within 24 hours.",
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Accordion Item                                                      */
/* ------------------------------------------------------------------ */

const AccordionItem: React.FC<{
  item: FAQItem;
  isOpen: boolean;
  onToggle: () => void;
}> = ({ item, isOpen, onToggle }) => (
  <div className="border border-white/14 dark:border-white/12 rounded-xl overflow-hidden transition-colors">
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-charcoal-light dark:hover:bg-charcoal-deep transition-colors"
    >
      <span className="font-medium text-white dark:text-white text-[0.95rem] leading-snug pr-2">
        {item.question}
      </span>
      <ChevronDown
        className={`w-5 h-5 shrink-0 text-white/55 dark:text-white/60 transition-transform duration-200 ${
          isOpen ? "rotate-180" : ""
        }`}
      />
    </button>
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="overflow-hidden"
        >
          <div className="px-5 pb-5 pt-1 text-white/70 dark:text-white/75 text-sm leading-relaxed border-t border-white/10 dark:border-white/10">
            {item.answer}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

/* ------------------------------------------------------------------ */
/* FAQ Page                                                            */
/* ------------------------------------------------------------------ */

// Build FAQPage structured data from the categories array so it stays in sync
const FAQ_ITEMS = categories.flatMap((cat) => cat.items);
const FAQ_STRUCTURED_DATA = [
  {
    ...buildFaqSchema(
      FAQ_ITEMS.map((item) => ({
        question: item.question,
        answer: item.answer,
      }))
    ),
    "@id": "https://aivis.biz/faq#faq",
  },
  buildWebPageSchema({
    path: "/faq",
    name: "Frequently Asked Questions - AI Visibility Audit",
    description:
      "Get answers about AI visibility audits, scoring methodology, triple-check AI pipeline, pricing tiers, privacy, and citation readiness.",
    mainEntityId: "https://aivis.biz/faq#faq",
  }),
  buildBreadcrumbSchema([
    { name: "Home", path: "/" },
    { name: "FAQ", path: "/faq" },
  ]),
];

const FAQ: React.FC = () => {
  usePageMeta({
    title: 'AI Visibility FAQ | AiVIS',
    description:
      'Answers on AI visibility audits, scoring, triple-check pipeline, Score Fix plans, pricing, and getting cited by ChatGPT and Claude.',
    path: "/faq",
    ogTitle: 'AI Visibility FAQ – AiVIS Frequently Asked Questions',
    structuredData: FAQ_STRUCTURED_DATA,
  });

  const navigate = useNavigate();
  const [openIndex, setOpenIndex] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] =
    useState<string>("getting-started");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    const q = searchQuery.toLowerCase();
    return categories
      .map((cat) => ({
        ...cat,
        items: cat.items.filter(
          (item) =>
            item.question.toLowerCase().includes(q) ||
            item.answer.toLowerCase().includes(q)
        ),
      }))
      .filter((cat) => cat.items.length > 0);
  }, [searchQuery]);

  const activeItems = searchQuery.trim()
    ? filteredCategories.flatMap((c) => c.items)
    : categories.find((c) => c.id === activeCategory)?.items ?? [];

  const toggleItem = (key: string) =>
    setOpenIndex((prev) => (prev === key ? null : key));

  return (
    <div className="min-h-screen text-white transition-colors">
      {/* ── Standard page header banner ────────────────────────── */}
      <header className="border-b border-white/10 bg-charcoal-deep sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
          <button onClick={() => navigate("/")} className="rounded-full p-2 transition-colors hover:bg-white/8" type="button" aria-label="Go back">
            <ArrowLeft className="h-5 w-5 text-white/55" />
          </button>
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-xl brand-title">
              <HelpCircle className="h-5 w-5 text-orange-400" />
              Frequently Asked Questions
            </h1>
            <p className="text-sm text-white/60 leading-relaxed">Straight answers about AI visibility, scoring, and how the platform works</p>
          </div>
        </div>
      </header>
      {/* ---- Hero / search ---- */}
      <div className="bg-gradient-to-b from-white/20 via-white/16 to-white/12 dark:from-white/20 dark:to-white/12 border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-12">

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="lonely-text mb-4">
                            <div className="flex justify-center mb-8">
                <img src="/images/ad2.png" alt="AiVIS frequently asked questions promo" className="max-w-full h-auto max-h-[320px] object-contain rounded-xl opacity-90 hover:opacity-100 transition-opacity drop-shadow-md" />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-indigo-400 mb-3">
                Frequently Asked Questions
              </h1>
              <p className="text-white/55 text-lg max-w-2xl">
                Straight answers about AI visibility, how our analysis works, and
                what it means for your business.
              </p>
            </div>

            <div className="relative max-w-lg">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60" />
              <input
                type="text"
                placeholder="Search questions…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3 rounded-xl card-charcoal text-white placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-white/35/50 focus:border-white/12 transition-all"
              />
            </div>
          </motion.div>
        </div>
      </div>

      {/* ---- Body ---- */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14">
        <div className="flex flex-col lg:flex-row gap-8">
          {!searchQuery.trim() && (
            <div className="lg:w-56 shrink-0">
              <nav className="sticky top-8 space-y-1">
                {categories.map((cat) => {
                  const Icon = cat.icon;
                  const active = activeCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategory(cat.id)}
                      className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-full text-left text-sm transition-colors ${
                        active
                          ? "bg-charcoal dark:bg-charcoal/25 text-white/85 dark:text-white/85 font-medium"
                          : "text-white/70 dark:text-white/55 hover:bg-charcoal-light dark:hover:bg-charcoal-deep"
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {cat.label}
                      <span className="ml-auto text-xs text-white/55 dark:text-white/60 tabular-nums">
                        {cat.items.length}
                      </span>
                    </button>
                  );
                })}
              </nav>
            </div>
          )}

          <div className="flex-1 space-y-3">
            {searchQuery.trim() && filteredCategories.length === 0 && (
              <div className="text-center py-16">
                <Search className="w-10 h-10 text-white/60 mx-auto mb-3" />
                <p className="text-white/60 dark:text-white/55">
                  No questions match{" "}
                  <span className="font-medium text-white/80 dark:text-white">
                    "{searchQuery}"
                  </span>
                  . Try a different search.
                </p>
              </div>
            )}

            {searchQuery.trim()
              ? filteredCategories.map((cat) => (
                  <div key={cat.id} className="mb-6">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-white/55 dark:text-white/60 mb-3 px-1">
                      {cat.label}
                    </h3>
                    <div className="space-y-3">
                      {cat.items.map((item, i) => {
                        const key = `${cat.id}-${i}`;
                        return (
                          <AccordionItem
                            key={key}
                            item={item}
                            isOpen={openIndex === key}
                            onToggle={() => toggleItem(key)}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))
              : activeItems.map((item, i) => {
                  const key = `${activeCategory}-${i}`;
                  return (
                    <AccordionItem
                      key={key}
                      item={item}
                      isOpen={openIndex === key}
                      onToggle={() => toggleItem(key)}
                    />
                  );
                })}
          </div>
        </div>

        {/* ---- CTA ---- */}
        <div className="mt-16 text-center border-t border-white/14 dark:border-white/10 pt-12">
          <div className="lonely-text inline-block mb-6">
            <h2 className="text-xl font-semibold text-white dark:text-white mb-2">
              <span className="bg-gradient-to-r from-cyan-300 via-white to-violet-300 bg-clip-text text-transparent">Still have questions?</span>
            </h2>
            <p className="text-white/60 dark:text-white/55 max-w-md mx-auto">
              We respond to every message within 24 hours. No bots, no canned
              replies.
            </p>
          </div>
          <a
            href="mailto:support@aivis.biz"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-charcoal hover:bg-charcoal text-white font-semibold transition-colors shadow-lg shadow-white/20"
          >
            Contact Support
          </a>
        </div>
      </div>
    </div>
  );
};

export default FAQ;
