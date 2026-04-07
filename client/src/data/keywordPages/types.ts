/* ── Keyword Page System Types ──
 *
 * Shared interfaces for the 100-page keyword map.
 * 5 clusters × 20 pages each: platforms, problems, signals, industries, compare.
 */

export type KeywordCluster =
  | "platforms"
  | "problems"
  | "signals"
  | "industries"
  | "compare";

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
      "AI visibility audits specific to your website platform. Discover what breaks citation readiness on your stack.",
    basePath: "/platforms",
  },
  problems: {
    cluster: "problems",
    label: "Problem Diagnosis",
    description:
      "Plain-language answers to the most common AI visibility failures. Find what is broken and how to fix it.",
    basePath: "/problems",
  },
  signals: {
    cluster: "signals",
    label: "Signal Audits",
    description:
      "Deep dives into the technical signals that control whether AI systems can parse, trust, and cite your content.",
    basePath: "/signals",
  },
  industries: {
    cluster: "industries",
    label: "Industry Audits",
    description:
      "AI visibility guidance tailored to specific industries. See how answer engines handle sites like yours.",
    basePath: "/industries",
  },
  compare: {
    cluster: "compare",
    label: "Comparisons",
    description:
      "Honest comparisons between AiVIS and other AI visibility tools. Monitoring vs diagnostics vs remediation.",
    basePath: "/compare",
  },
};
