/* ── Keyword Page System Types ──
 *
 * Shared interfaces for the programmatic NLQ page system.
 * 7 data files across 5 clusters: platforms, problems, signals, industries, compare.
 */

export type KeywordCluster =
  | "platforms"
  | "problems"
  | "signals"
  | "industries"
  | "compare"
  | "platform-signals"
  | "models"
  | "questions"
  | "how-to";

export interface ContentSection {
  heading: string;
  content: string[];          // paragraphs
}

export interface FAQ {
  question: string;
  answer: string;
}

export interface InternalLink {
  label: string;
  to: string;
}

export interface KeywordPage {
  slug: string;
  cluster: KeywordCluster;
  title: string;                  // H1
  metaTitle: string;              // <title> / og:title
  metaDescription: string;
  primaryKeyword: string;
  secondaryKeyword: string;
  hook: string;                   // lead paragraph below H1
  sections: ContentSection[];
  faqs: FAQ[];
  internalLinks: InternalLink[];
  ctaText: string;
  ctaLink: string;
}

/** Cluster metadata for index pages and breadcrumbs */
export interface ClusterMeta {
  cluster: KeywordCluster;
  label: string;
  description: string;
  basePath: string;               // e.g. "/platforms"
}

export const CLUSTER_META: Record<KeywordCluster, ClusterMeta> = {
  platforms: {
    cluster: "platforms",
    label: "Platform Audits",
    description:
      "Why can't AI answer engines cite my site? Platform-specific audits for WordPress, Shopify, Wix, and 17 more.",
    basePath: "/platforms",
  },
  problems: {
    cluster: "problems",
    label: "Problem Diagnosis",
    description:
      "Why is AI ignoring my website? Diagnose the most common AI visibility failures and get actionable fixes.",
    basePath: "/problems",
  },
  signals: {
    cluster: "signals",
    label: "Signal Audits",
    description:
      "What technical signals do AI answer engines look for? Deep dives into JSON-LD, robots.txt, llms.txt, and more.",
    basePath: "/signals",
  },
  industries: {
    cluster: "industries",
    label: "Industry Audits",
    description:
      "How does my industry get cited by AI answer engines? Tailored guidance for SaaS, healthcare, e-commerce, and more.",
    basePath: "/industries",
  },
  compare: {
    cluster: "compare",
    label: "Comparisons",
    description:
      "Should I use AiVIS or another tool for AI answer engine readiness? Honest comparisons vs Moz, Semrush, Ahrefs, and more.",
    basePath: "/compare",
  },
  "platform-signals": {
    cluster: "platform-signals",
    label: "Platform × Signal Guides",
    description:
      "How do I configure a specific AI visibility signal on my platform? Step-by-step guides for every platform and signal combination.",
    basePath: "/platform-signals",
  },
  models: {
    cluster: "models",
    label: "AI Model Guides",
    description:
      "How does each AI model decide what to cite? Model-specific guides for ChatGPT, Claude, Perplexity, Gemini, and more.",
    basePath: "/models",
  },
  questions: {
    cluster: "questions",
    label: "AI Visibility Questions",
    description:
      "Answers to every question about AI answer engine visibility, citation readiness, and structured data best practices.",
    basePath: "/questions",
  },
  "how-to": {
    cluster: "how-to",
    label: "How-To Guides",
    description:
      "Step-by-step implementation guides for making your website visible and citable by AI answer engines.",
    basePath: "/how-to",
  },
};
