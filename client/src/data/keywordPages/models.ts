import type { KeywordPage } from "./types";

/* ── Seed data ──────────────────────────────────────────────────────── */

interface ModelSeed {
  slug: string;
  name: string;
  maker: string;
  crawlerUA: string;
  note: string;
}

interface TopicSeed {
  slugSuffix: string;
  titleTemplate: (m: ModelSeed) => string;
  metaTitleTemplate: (m: ModelSeed) => string;
  descTemplate: (m: ModelSeed) => string;
  hookTemplate: (m: ModelSeed) => string;
  sections: (m: ModelSeed) => { heading: string; content: string[] }[];
  faqs: (m: ModelSeed) => { question: string; answer: string }[];
}

const MODELS: ModelSeed[] = [
  { slug: "chatgpt", name: "ChatGPT", maker: "OpenAI", crawlerUA: "GPTBot", note: "uses GPTBot to crawl the web and synthesizes answers from multiple sources with inline citations" },
  { slug: "perplexity", name: "Perplexity", maker: "Perplexity AI", crawlerUA: "PerplexityBot", note: "crawls the web in real-time for every query and provides numbered source citations" },
  { slug: "claude", name: "Claude", maker: "Anthropic", crawlerUA: "ClaudeBot", note: "uses ClaudeBot for web access and focuses on accuracy and nuance in citations" },
  { slug: "gemini", name: "Gemini", maker: "Google", crawlerUA: "Google-Extended", note: "powers Google AI Overviews and draws from Google's search index for citations" },
  { slug: "google-ai-overviews", name: "Google AI Overviews", maker: "Google", crawlerUA: "Googlebot", note: "generates AI summaries above traditional search results using Google's index" },
  { slug: "copilot", name: "Microsoft Copilot", maker: "Microsoft", crawlerUA: "bingbot", note: "uses Bing's search index and GPT models to generate cited answers" },
  { slug: "grok", name: "Grok", maker: "xAI", crawlerUA: "Grok", note: "accesses real-time X/Twitter data and web content for conversational answers" },
  { slug: "deepseek", name: "DeepSeek", maker: "DeepSeek", crawlerUA: "DeepSeekBot", note: "open-weight model family with web search capabilities for cited answers" },
  { slug: "mistral", name: "Mistral Le Chat", maker: "Mistral AI", crawlerUA: "MistralBot", note: "European AI with web search integration for cited research answers" },
  { slug: "meta-ai", name: "Meta AI", maker: "Meta", crawlerUA: "Meta-ExternalAgent", note: "integrated into Facebook, Instagram, WhatsApp, and Threads for conversational AI answers" },
  { slug: "amazon-q", name: "Amazon Q", maker: "Amazon", crawlerUA: "Amazonbot", note: "enterprise AI assistant that cites business and web sources" },
  { slug: "you-com", name: "You.com", maker: "You.com", crawlerUA: "YouBot", note: "AI search engine that provides cited answers with source transparency" },
];

const TOPICS: TopicSeed[] = [
  {
    slugSuffix: "how-it-decides-what-to-cite",
    titleTemplate: (m) => `How Does ${m.name} Decide What Websites to Cite?`,
    metaTitleTemplate: (m) => `How Does ${m.name} Decide What to Cite? | AiVIS.biz`,
    descTemplate: (m) => `${m.name} by ${m.maker} selects sources based on crawl access, structured data, and content authority. Learn the exact citation selection criteria.`,
    hookTemplate: (m) => `${m.name} ${m.note}. Understanding how it selects sources for citation is the first step to getting your content included in its answers.`,
    sections: (m) => [
      { heading: `${m.name}'s Citation Selection Process`, content: [
        `${m.name} evaluates potential sources through a multi-stage pipeline: crawl access, content extraction, entity verification, and authority scoring. Pages that fail any stage are excluded from citations.`,
        `The ${m.crawlerUA} crawler must be able to access your page (check robots.txt), the content must be extractable (not hidden behind JavaScript rendering), and your entity signals must be clear enough for accurate attribution.`,
      ]},
      { heading: "What Makes a Page Citable", content: [
        `For ${m.name}, citable pages have: accessible raw HTML, complete structured data (JSON-LD, Schema.org), clear entity markup (Organization, Author), and content depth that demonstrates expertise.`,
        `Pages with thin content, broken schema, or blocked crawlers are systematically excluded. Run an AiVIS audit to check all four citation requirements.`,
      ]},
    ],
    faqs: (m) => [
      { question: `Can I pay to appear in ${m.name} answers?`, answer: `No. ${m.name} citation is earned through structural correctness, not paid placement. Ensure crawl access, structured data, and content authority.` },
      { question: `How quickly does ${m.name} pick up new content?`, answer: `${m.crawlerUA} crawl frequency varies. Real-time search models like ${m.name} can find new content within hours if your site is accessible and well-structured.` },
    ],
  },
  {
    slugSuffix: "can-it-read-my-site",
    titleTemplate: (m) => `Can ${m.name} Read My Website?`,
    metaTitleTemplate: (m) => `Can ${m.name} Read and Cite My Website? | AiVIS.biz`,
    descTemplate: (m) => `Test whether ${m.name}'s ${m.crawlerUA} crawler can access, parse, and cite your web content. Common blockers and fixes.`,
    hookTemplate: (m) => `${m.name} uses ${m.crawlerUA} to access web content. If your site blocks this crawler or renders content client-side, ${m.name} cannot read or cite you.`,
    sections: (m) => [
      { heading: `How ${m.name} Accesses Your Content`, content: [
        `${m.name} sends ${m.crawlerUA} to fetch your pages. This crawler reads raw HTML — it does not execute JavaScript or wait for client-side rendering. What appears in View Source is what ${m.name} sees.`,
        `Check your robots.txt for rules that block ${m.crawlerUA}. A single Disallow rule can make your entire site invisible to ${m.name}.`,
      ]},
      { heading: "Common Access Blockers", content: [
        `JavaScript-only rendering: if your content loads via React, Vue, or Angular without SSR, ${m.crawlerUA} sees an empty div. Solution: add server-side rendering or static prerendering.`,
        `Aggressive rate limiting or WAF rules that block non-browser user-agents can prevent ${m.crawlerUA} from accessing your pages.`,
      ]},
    ],
    faqs: (m) => [
      { question: `How do I check if ${m.crawlerUA} can access my site?`, answer: `Check your robots.txt for Disallow rules targeting ${m.crawlerUA}. Then view your page source to verify content appears in raw HTML without JavaScript execution.` },
      { question: `Should I allow or block ${m.crawlerUA}?`, answer: `If you want ${m.name} to cite your content, allow ${m.crawlerUA} in robots.txt. Blocking it removes you from ${m.name}'s citation pool entirely.` },
    ],
  },
  {
    slugSuffix: "why-it-ignores-my-site",
    titleTemplate: (m) => `Why Does ${m.name} Ignore My Website?`,
    metaTitleTemplate: (m) => `Why ${m.name} Ignores My Website — Root Causes | AiVIS.biz`,
    descTemplate: (m) => `${m.name} skips your site because of crawl blocks, missing structured data, or weak entity signals. Diagnose the exact cause.`,
    hookTemplate: (m) => `If ${m.name} never mentions your website in its answers, one or more extraction barriers are preventing citation. The most common causes are crawl access blocks, missing structured data, and weak entity signals.`,
    sections: (m) => [
      { heading: "Crawl Access Failures", content: [
        `The most common reason ${m.name} ignores a site is that ${m.crawlerUA} is blocked by robots.txt, denied by the CDN/WAF, or served an empty shell page due to client-side rendering.`,
        `${m.maker}'s crawler ${m.crawlerUA} behaves differently from Googlebot. Just because Google indexes your site does not mean ${m.name} can access it.`,
      ]},
      { heading: "Structural Extraction Failures", content: [
        `Even when ${m.crawlerUA} can access your pages, ${m.name} may still ignore your content if it lacks structured data (JSON-LD, Schema.org), clear heading hierarchy, or author/organization entity markup.`,
        `Run an AiVIS audit to identify exactly which extraction barriers are blocking ${m.name} from citing your content.`,
      ]},
    ],
    faqs: (m) => [
      { question: `Does ${m.name} penalize certain types of sites?`, answer: `${m.name} does not have a penalty system. It simply cannot cite sites it cannot crawl, parse, or attribute. Fix the structural barriers and your content becomes citable.` },
      { question: `How long until ${m.name} starts citing my site after fixes?`, answer: `After fixing crawl access and structured data issues, ${m.crawlerUA} typically re-crawls within days. Citation inclusion depends on query relevance and content authority.` },
    ],
  },
  {
    slugSuffix: "structured-data-requirements",
    titleTemplate: (m) => `What Structured Data Does ${m.name} Need?`,
    metaTitleTemplate: (m) => `Structured Data Requirements for ${m.name} Citations | AiVIS.biz`,
    descTemplate: (m) => `The specific JSON-LD and Schema.org types that ${m.name} uses for content extraction, entity resolution, and citation attribution.`,
    hookTemplate: (m) => `${m.name} by ${m.maker} relies on structured data to extract, verify, and attribute content. Here are the specific schema types and properties that improve your citation chances.`,
    sections: (m) => [
      { heading: `Schema Types ${m.name} Prioritizes`, content: [
        `${m.name} extracts Organization schema for brand identity, Article schema for content attribution, FAQPage schema for direct answer extraction, and Product schema for e-commerce citations.`,
        `The minimum viable structured data for ${m.name} citation: Organization (name, url, logo), plus Article (headline, author, datePublished) on content pages.`,
      ]},
      { heading: "Implementation for Maximum Citation", content: [
        `Place JSON-LD in a <script type="application/ld+json"> tag in your page head. ${m.name}'s ${m.crawlerUA} extracts JSON-LD before parsing body content, making head placement critical.`,
        `Ensure all schema properties are populated with accurate data. Empty or placeholder values (like "Author Name" or "https://example.com") cause ${m.name} to distrust the entire schema block.`,
      ]},
    ],
    faqs: (m) => [
      { question: `Does ${m.name} require specific Schema.org versions?`, answer: `${m.name} follows the latest Schema.org vocabulary. Use the most specific types available (e.g., SoftwareApplication instead of generic Thing).` },
      { question: `Can microdata work instead of JSON-LD for ${m.name}?`, answer: `JSON-LD is strongly preferred. Microdata is parsed but harder for ${m.crawlerUA} to extract reliably. JSON-LD is self-contained and unambiguous.` },
    ],
  },
  {
    slugSuffix: "robots-txt-configuration",
    titleTemplate: (m) => `How to Configure robots.txt for ${m.name}?`,
    metaTitleTemplate: (m) => `robots.txt Configuration for ${m.name} (${m.crawlerUA}) | AiVIS.biz`,
    descTemplate: (m) => `Allow or configure ${m.crawlerUA} access in your robots.txt. Control what ${m.name} can crawl and cite from your website.`,
    hookTemplate: (m) => `Your robots.txt controls whether ${m.crawlerUA} — the crawler behind ${m.name} — can access your content. A misconfigured robots.txt is the most common reason sites are invisible to ${m.name}.`,
    sections: (m) => [
      { heading: `Allowing ${m.crawlerUA} in robots.txt`, content: [
        `To allow ${m.name} to crawl your site, add: User-agent: ${m.crawlerUA} / Allow: / to your robots.txt. If you have a blanket Disallow rule, ${m.crawlerUA} will be blocked even if you want citations.`,
        `Check for overly broad rules like "User-agent: * / Disallow: /" that block all bots including ${m.crawlerUA}. Many sites accidentally block AI crawlers this way.`,
      ]},
      { heading: "Selective Access Control", content: [
        `You can allow ${m.crawlerUA} access to public content while blocking sensitive areas: Disallow specific paths like /admin, /api, or /private while allowing everything else.`,
        `Crawl-delay directives may slow ${m.crawlerUA} but are generally respected. Set reasonable values (1-5 seconds) to protect server resources without blocking access entirely.`,
      ]},
    ],
    faqs: (m) => [
      { question: `What is ${m.name}'s crawler user-agent?`, answer: `${m.name} uses "${m.crawlerUA}" as its crawler user-agent string. Add rules for this specific user-agent in your robots.txt.` },
      { question: `Does blocking ${m.crawlerUA} remove me from ${m.name}?`, answer: `Yes. If ${m.crawlerUA} is blocked by robots.txt, ${m.name} cannot crawl or cite your content. You become invisible to that AI model.` },
    ],
  },
  {
    slugSuffix: "content-best-practices",
    titleTemplate: (m) => `Content Best Practices for ${m.name} Citations`,
    metaTitleTemplate: (m) => `Content Best Practices for Getting Cited by ${m.name} | AiVIS.biz`,
    descTemplate: (m) => `Write content that ${m.name} can extract, understand, and cite. Content structure, depth, and specificity guidelines.`,
    hookTemplate: (m) => `${m.name} ${m.note}. The content you publish must be structured for extraction, specific enough for attribution, and authoritative enough for citation.`,
    sections: (m) => [
      { heading: "Structure for AI Extraction", content: [
        `${m.name} parses content using heading hierarchy (H1–H6), paragraph segmentation, and list structures. Clear semantic HTML makes extraction reliable.`,
        `Write specific, attributable claims rather than vague generalities. ${m.name} cites pages that provide concrete facts, numbers, and expert statements.`,
      ]},
      { heading: "Depth and Authority Signals", content: [
        `Thin content (under 500 words) is rarely cited by ${m.name}. Aim for comprehensive coverage (1500+ words) with clear section headings and supporting evidence.`,
        `Include author entities, publication dates, and source references. ${m.name} uses these signals to evaluate trustworthiness before citing.`,
      ]},
    ],
    faqs: (m) => [
      { question: `What content length does ${m.name} prefer?`, answer: `${m.name} does not have a hard word count requirement, but comprehensive content (1500+ words) with clear structure is more likely to be cited than thin pages.` },
      { question: `Does ${m.name} prefer certain content formats?`, answer: `${m.name} extracts from articles, FAQs, how-to guides, and product pages most reliably. Ensure proper schema markup matches your content type.` },
    ],
  },
  {
    slugSuffix: "entity-disambiguation",
    titleTemplate: (m) => `How to Fix Entity Confusion in ${m.name}?`,
    metaTitleTemplate: (m) => `Fix Entity Confusion — Stop ${m.name} from Misidentifying Your Brand | AiVIS.biz`,
    descTemplate: (m) => `${m.name} confuses your brand with competitors or unrelated entities? Fix disambiguation with Organization schema and entity anchoring.`,
    hookTemplate: (m) => `When ${m.name} confuses your brand with another entity, it's because your site lacks clear entity disambiguation signals. Organization schema, sameAs links, and consistent naming fix this.`,
    sections: (m) => [
      { heading: "Why Entity Confusion Happens", content: [
        `${m.name} builds entity knowledge from structured data across the web. If your Organization schema is missing or inconsistent, ${m.name} may merge your brand with similarly named entities.`,
        `Common triggers: no Organization JSON-LD, inconsistent brand naming, missing sameAs social profile links, and no foundingDate or location anchors.`,
      ]},
      { heading: "Fix Entity Disambiguation", content: [
        `Add complete Organization JSON-LD to every page: name, url, logo, foundingDate, founder, sameAs (link to LinkedIn, Twitter/X, Crunchbase, Wikidata). This gives ${m.name} enough signals to resolve your entity uniquely.`,
        `Ensure your brand name is used consistently across all pages, schema, and social profiles. ${m.name} uses name consistency as a disambiguation signal.`,
      ]},
    ],
    faqs: (m) => [
      { question: `How long until ${m.name} stops confusing my brand?`, answer: `After adding complete Organization schema and sameAs links, ${m.crawlerUA} needs to re-crawl your site. Entity resolution typically updates within 1-4 weeks.` },
      { question: `Can Wikidata help ${m.name} identify my brand?`, answer: `Yes. Adding a Wikidata QID as a sameAs link in your Organization schema provides ${m.name} with a strong disambiguation anchor.` },
    ],
  },
  {
    slugSuffix: "freshness-and-updates",
    titleTemplate: (m) => `How Does ${m.name} Handle Content Freshness?`,
    metaTitleTemplate: (m) => `Content Freshness — How ${m.name} Decides If Your Content Is Current | AiVIS.biz`,
    descTemplate: (m) => `${m.name} prioritizes fresh content for time-sensitive queries. Learn which freshness signals matter and how to maintain them.`,
    hookTemplate: (m) => `${m.name} uses dateModified, datePublished, and crawl-frequency signals to determine whether your content is fresh enough to cite. Stale content gets replaced by newer sources.`,
    sections: (m) => [
      { heading: "Freshness Signals for AI Citation", content: [
        `${m.name} checks Article schema dateModified to determine content age. Pages without dateModified are assumed to be their original publication date — potentially years old.`,
        `For time-sensitive topics, ${m.name} strongly prefers recently updated content. Keep dateModified accurate (only update when content actually changes).`,
      ]},
      { heading: "Maintaining Citation Currency", content: [
        `Regular content audits and updates keep your pages competitive in ${m.name}'s citation pool. Update statistics, examples, and references at least quarterly.`,
        `Your XML sitemap's lastmod dates should match actual content changes. ${m.crawlerUA} uses sitemap lastmod to prioritize which pages to re-crawl.`,
      ]},
    ],
    faqs: (m) => [
      { question: `Does ${m.name} penalize old content?`, answer: `Not penalized, but deprioritized for time-sensitive queries. Evergreen content with accurate dateModified can maintain citations for years.` },
      { question: `How often should I update content for ${m.name}?`, answer: `Update when facts change, not on a schedule. Artificial edits without substantive changes can erode trust signals.` },
    ],
  },
  {
    slugSuffix: "scoring-factors",
    titleTemplate: (m) => `What Factors Affect My ${m.name} Visibility Score?`,
    metaTitleTemplate: (m) => `${m.name} Visibility Scoring — Key Factors for Citation | AiVIS.biz`,
    descTemplate: (m) => `The technical and content factors that determine whether ${m.name} cites your website. Audit your visibility across all scoring dimensions.`,
    hookTemplate: (m) => `Your visibility in ${m.name} depends on measurable factors: crawl access, structured data completeness, content depth, entity clarity, and technical hygiene. AiVIS audits all of them.`,
    sections: (m) => [
      { heading: "Technical Scoring Factors", content: [
        `Crawl access (is ${m.crawlerUA} allowed?), page speed (does your server respond within ${m.name}'s timeout?), rendering (is content in raw HTML?), and HTTPS (is your connection secure?).`,
        `Structured data completeness: Organization, Article/Product, FAQ, BreadcrumbList schemas. ${m.name} uses these for entity extraction and content classification.`,
      ]},
      { heading: "Content Scoring Factors", content: [
        `Content depth (word count and topic coverage), heading hierarchy (semantic HTML structure), author attribution (named authors with credentials), and citation density (links to authoritative sources).`,
        `Entity clarity: does your site unambiguously define what your organization does? Vague positioning leads to missed citations or incorrect attribution.`,
      ]},
    ],
    faqs: (m) => [
      { question: `Does AiVIS measure my ${m.name} visibility specifically?`, answer: `AiVIS audits the structural signals that all AI models use for citation. The BRAG evidence trail shows which factors affect each model's ability to cite your content.` },
      { question: `Which factor matters most for ${m.name}?`, answer: `Crawl access is the gating factor. If ${m.crawlerUA} cannot reach your content, no other optimization matters. Fix access first, then structured data, then content depth.` },
    ],
  },
  {
    slugSuffix: "vs-google-search",
    titleTemplate: (m) => `${m.name} vs Google: How Content Requirements Differ`,
    metaTitleTemplate: (m) => `${m.name} vs Google — Different Content Requirements for Visibility | AiVIS.biz`,
    descTemplate: (m) => `${m.name} and Google evaluate content differently. What ranks in Google may be invisible to ${m.name}. Understand the key differences.`,
    hookTemplate: (m) => `Ranking #1 in Google does not guarantee citation in ${m.name}. The two systems have different crawlers, different content requirements, and different citation logic.`,
    sections: (m) => [
      { heading: "Crawl and Access Differences", content: [
        `Google uses Googlebot with full JavaScript rendering; ${m.name} uses ${m.crawlerUA} which typically reads raw HTML without JS execution. Sites that rely on client-side rendering rank in Google but are invisible to ${m.name}.`,
        `Google indexes based on relevance algorithms and backlinks; ${m.name} cites based on extractability and attribution clarity. Different optimization strategies are needed for each.`,
      ]},
      { heading: "Content Signal Differences", content: [
        `Google rewards topical authority, backlink profiles, and user engagement signals. ${m.name} rewards structured data completeness, entity clarity, and content specificity.`,
        `SEO-optimized content may lack the structural signals ${m.name} needs. Add JSON-LD, FAQ schema, and clear entity markup alongside your existing SEO work.`,
      ]},
    ],
    faqs: (m) => [
      { question: `Should I optimize for Google or ${m.name}?`, answer: `Both. The structural improvements needed for ${m.name} (schema, clean HTML, entity markup) also benefit Google rankings. They are complementary, not conflicting.` },
      { question: `Why does Google show my site but ${m.name} doesn't?`, answer: `Different crawlers (Googlebot vs ${m.crawlerUA}), different rendering (JS vs raw HTML), and different citation criteria (ranking vs extraction). Check your robots.txt and page rendering.` },
    ],
  },
];

/* ── Generator ──────────────────────────────────────────────────────── */

function generate(m: ModelSeed, t: TopicSeed): KeywordPage {
  return {
    slug: `${m.slug}-${t.slugSuffix}`,
    cluster: "models",
    title: t.titleTemplate(m),
    metaTitle: t.metaTitleTemplate(m),
    metaDescription: t.descTemplate(m),
    primaryKeyword: `${m.slug} ai visibility`,
    secondaryKeyword: `${m.name} citation requirements`,
    hook: t.hookTemplate(m),
    sections: t.sections(m),
    faqs: t.faqs(m),
    internalLinks: [
      { label: "Run an AI visibility audit", to: "/app/analyze" },
      { label: "robots.txt configuration", to: "/signals/robots-txt" },
      { label: "JSON-LD signal guide", to: "/signals/json-ld" },
    ],
    ctaText: `Check visibility for ${m.name}`,
    ctaLink: "/app/analyze",
  };
}

/** 120 pages: 12 AI models × 10 topics */
export const modelPages: KeywordPage[] = MODELS.flatMap((m) =>
  TOPICS.map((t) => generate(m, t)),
);
