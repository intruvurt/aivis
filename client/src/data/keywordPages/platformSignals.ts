import type { KeywordPage } from "./types";

/* ── Seed data ──────────────────────────────────────────────────────── */

interface PlatformSeed {
  slug: string; name: string; type: string; note: string;
}

interface SignalSeed {
  slug: string; name: string; action: string; what: string;
}

const PLATFORMS: PlatformSeed[] = [
  { slug: "wordpress", name: "WordPress", type: "open-source CMS", note: "uses plugins like Yoast SEO, RankMath, and Schema Pro for structured data" },
  { slug: "shopify", name: "Shopify", type: "hosted e-commerce platform", note: "adds Product and Organization schema through its theme engine and apps like JSON-LD for SEO" },
  { slug: "wix", name: "Wix", type: "hosted website builder", note: "provides built-in SEO settings through the Wix SEO Wiz and structured data editor" },
  { slug: "squarespace", name: "Squarespace", type: "hosted website builder", note: "adds basic schema automatically but requires code injection for advanced structured data" },
  { slug: "webflow", name: "Webflow", type: "visual web development platform", note: "offers custom code injection in page settings and project-level head/body code" },
  { slug: "next-js", name: "Next.js", type: "React framework", note: "provides the Metadata API and generateMetadata for SSR/SSG pages" },
  { slug: "gatsby", name: "Gatsby", type: "React-based static site generator", note: "uses gatsby-plugin-react-helmet and gatsby-plugin-sitemap for metadata" },
  { slug: "drupal", name: "Drupal", type: "open-source CMS", note: "uses modules like Metatag, Schema.org Blueprints, and Simple XML Sitemap" },
  { slug: "ghost", name: "Ghost", type: "headless CMS", note: "generates JSON-LD automatically via its built-in SEO features and supports code injection" },
  { slug: "hubspot", name: "HubSpot", type: "marketing CMS", note: "adds structured data through HubL templates and the SEO recommendations panel" },
  { slug: "framer", name: "Framer", type: "visual design-to-code platform", note: "supports custom meta tags and code overrides for adding structured data" },
  { slug: "bubble", name: "Bubble", type: "no-code application builder", note: "renders client-side by default and requires SEO meta tag plugins for structured data" },
  { slug: "weebly", name: "Weebly", type: "hosted website builder", note: "offers basic SEO settings through the editor and supports custom header code" },
  { slug: "joomla", name: "Joomla", type: "open-source CMS", note: "uses extensions like JoomSEF and Schema.org structured data plugins" },
  { slug: "magento", name: "Magento", type: "e-commerce platform", note: "supports Product, Offer, and Organization schema through extensions and template customization" },
  { slug: "bigcommerce", name: "BigCommerce", type: "hosted e-commerce platform", note: "generates Product schema automatically and supports custom HTML head injection" },
  { slug: "cargo", name: "Cargo", type: "portfolio website builder", note: "focuses on visual design with limited built-in SEO; requires custom code for structured data" },
  { slug: "notion-sites", name: "Notion Sites", type: "published Notion workspace", note: "renders server-side but has limited control over meta tags and no native structured data" },
  { slug: "carrd", name: "Carrd", type: "single-page website builder", note: "supports custom meta tags and head code in the Pro plan for structured data" },
  { slug: "react-spa", name: "React SPA", type: "single-page application", note: "renders client-side by default, requiring SSR or prerendering for AI crawler access" },
];

const SIGNALS: SignalSeed[] = [
  { slug: "json-ld", name: "JSON-LD", action: "add JSON-LD structured data to", what: "the structured data format AI models prefer for entity extraction and citation" },
  { slug: "open-graph", name: "Open Graph tags", action: "configure Open Graph tags on", what: "metadata that helps AI models classify and preview your content" },
  { slug: "meta-descriptions", name: "meta descriptions", action: "write AI-optimized meta descriptions for", what: "the summary text AI models use for content classification and citation previews" },
  { slug: "canonical-urls", name: "canonical URLs", action: "set canonical URLs on", what: "the signal that tells AI models which version of your content is authoritative" },
  { slug: "robots-txt", name: "robots.txt", action: "configure robots.txt for AI crawlers on", what: "the file that controls which AI bots can access your content" },
  { slug: "sitemap-xml", name: "XML sitemap", action: "optimize your XML sitemap on", what: "the roadmap AI crawlers use to discover all your content" },
  { slug: "llms-txt", name: "llms.txt", action: "create an llms.txt file for", what: "the new standard for describing your site directly to AI language models" },
  { slug: "schema-org", name: "Schema.org markup", action: "implement Schema.org types on", what: "the vocabulary AI models use to understand entity types and relationships" },
  { slug: "heading-hierarchy", name: "heading hierarchy", action: "fix heading structure (H1–H6) on", what: "the semantic structure AI models use to parse content sections" },
  { slug: "page-speed", name: "page speed", action: "optimize page speed for AI crawlers on", what: "response time directly affects whether AI crawlers can access your content" },
  { slug: "mobile-responsiveness", name: "mobile-first design", action: "ensure mobile-first rendering on", what: "AI crawlers often use mobile user-agents; mobile rendering must be complete" },
  { slug: "internal-linking", name: "internal linking", action: "build an internal link architecture on", what: "how AI crawlers discover and traverse your content graph" },
  { slug: "content-freshness", name: "content freshness signals", action: "add freshness signals to", what: "temporal metadata that tells AI models your content is current and reliable" },
  { slug: "author-entity", name: "author entity markup", action: "add author entity markup to", what: "identity signals that connect content to verified authors for trust scoring" },
  { slug: "faq-schema", name: "FAQ schema", action: "add FAQ schema to", what: "the highest-impact signal for AI answer inclusion and direct extraction" },
  { slug: "breadcrumb-schema", name: "breadcrumb schema", action: "add breadcrumb schema to", what: "navigation metadata that helps AI models understand your site hierarchy" },
  { slug: "alt-text", name: "image alt text", action: "write AI-readable alt text for images on", what: "descriptive text that makes visual content accessible to AI language models" },
  { slug: "hreflang", name: "hreflang tags", action: "configure hreflang tags on", what: "language-routing metadata for multilingual AI visibility" },
  { slug: "content-length", name: "content depth", action: "optimize content depth on", what: "comprehensive content is more likely to be cited by AI answer engines" },
  { slug: "trust-signals", name: "trust signals", action: "build trust and authority signals on", what: "the authority markers AI models check before deciding to cite a source" },
];

/* ── Generator ──────────────────────────────────────────────────────── */

function generate(p: PlatformSeed, s: SignalSeed): KeywordPage {
  return {
    slug: `${p.slug}-${s.slug}`,
    cluster: "platform-signals",
    title: `How to ${capitalize(s.action)} ${p.name} for AI Citations?`,
    metaTitle: `How to ${capitalize(s.action)} ${p.name} for AI Answer Engine Citations? | AiVIS.biz`,
    metaDescription: `Step-by-step guide to ${s.action} ${p.name}. ${capitalize(s.what)}. Make your ${p.name} site citable by ChatGPT, Perplexity, and Claude.`,
    primaryKeyword: `${p.slug} ${s.slug} ai visibility`,
    secondaryKeyword: `${s.slug} ${p.slug} ai citations`,
    hook: `${p.name} is a ${p.type} that ${p.note}. ${capitalize(s.name)} is ${s.what}. Here's exactly how to set it up on ${p.name} so AI answer engines can cite your content.`,
    sections: [
      {
        heading: `Why ${p.name} Sites Need ${s.name}`,
        content: [
          `AI answer engines like ChatGPT, Perplexity, and Claude need ${s.name} to extract and cite your content reliably. Without it, your ${p.name} site is harder to parse and less likely to appear in AI-generated answers.`,
          `${p.name} ${p.note}. Understanding how ${p.name} handles ${s.name} is the first step to making your content AI-citable.`,
        ],
      },
      {
        heading: `How to ${capitalize(s.action)} ${p.name}`,
        content: [
          `On ${p.name} (${p.type}), implementing ${s.name} requires understanding the platform's specific capabilities. ${p.name} ${p.note}.`,
          `After configuring ${s.name}, validate with an AiVIS audit to confirm AI crawlers can access and parse the signal correctly. Common mistakes include incomplete configuration, caching delays, and platform-specific rendering issues.`,
          `Test by checking your page source (View Source, not Inspect Element) to verify ${s.name} appears in the raw HTML that AI crawlers see.`,
        ],
      },
    ],
    faqs: [
      {
        question: `Does ${p.name} support ${s.name} natively?`,
        answer: `${p.name} is a ${p.type} — it ${p.note}. Check the platform documentation and verify with a source-code inspection to confirm ${s.name} is present and correctly formatted.`,
      },
      {
        question: `How do I verify ${s.name} is working on my ${p.name} site?`,
        answer: `Run an AiVIS audit on your page URL. The audit checks whether AI crawlers can detect your ${s.name} configuration and flags any issues that block AI citation.`,
      },
    ],
    internalLinks: [
      { label: `${s.name} signal guide`, to: `/signals/${s.slug}` },
      { label: `${p.name} platform audit`, to: `/platforms/${p.slug}` },
      { label: "Run an AI visibility audit", to: "/app/analyze" },
    ],
    ctaText: `Audit ${s.name} on ${p.name}`,
    ctaLink: "/app/analyze",
  };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** 400 cross-product pages: 20 platforms × 20 signals */
export const platformSignalPages: KeywordPage[] = PLATFORMS.flatMap((p) =>
  SIGNALS.map((s) => generate(p, s)),
);
