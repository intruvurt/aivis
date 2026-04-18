import type { KeywordPage } from "./types";

export const platformPages: KeywordPage[] = [
  {
    slug: "wordpress",
    cluster: "platforms",
    title: "Why Can't AI Answer Engines Cite My WordPress Site?",
    metaTitle: "Why Can't AI Cite My WordPress Site? | AiVIS.biz",
    metaDescription:
      "Audit your WordPress site for AI answer-engine readiness. Find schema gaps, crawl blocks, and citation failures specific to WordPress.",
    primaryKeyword: "wordpress ai visibility",
    secondaryKeyword: "wordpress ai audit",
    hook: "WordPress powers 40%+ of the web — but default themes and plugins often break the exact signals AI models need to cite your content. This audit shows you what's missing.",
    sections: [
      {
        heading: "Why WordPress Sites Struggle with AI Visibility",
        content: [
          "WordPress relies heavily on plugins for structured data, Open Graph, and sitemap generation. When plugins conflict or misconfigure, AI crawlers receive broken or missing signals.",
          "Common issues include render-blocking JavaScript from page builders, duplicate schema from competing SEO plugins, and robots.txt rules that accidentally block AI model crawlers like GPTBot or ClaudeBot.",
        ],
      },
      {
        heading: "Key Signals to Check on WordPress",
        content: [
          "JSON-LD schema output: verify your SEO plugin emits Article, Organization, and FAQ schema on every relevant page — not just the homepage.",
          "Check that your caching plugin serves the same structured data to crawlers as it does to browsers. Some aggressive caching strips meta tags from cached HTML.",
          "Verify your robots.txt allows GPTBot, ClaudeBot, and PerplexityBot. Many security plugins add blanket Disallow rules that silently block AI crawlers.",
        ],
      },
      {
        heading: "WordPress-Specific Fixes",
        content: [
          "Use a single authoritative SEO plugin (Yoast, Rank Math, or SEOPress) and disable schema output from all other plugins to prevent conflicts.",
          "Add an llms.txt file to your root directory describing your site for AI models. WordPress doesn't generate this natively — create it as a static file or use a custom rewrite rule.",
          "Test your pages with AiVIS.biz to see exactly which signals are present, missing, or malformed. The audit checks 30+ machine-readability factors automatically.",
        ],
      },
    ],
    faqs: [
      {
        question: "Does WordPress support AI visibility out of the box?",
        answer:
          "No. WordPress core does not emit JSON-LD, llms.txt, or AI-specific crawler rules. You need plugins and manual configuration to achieve strong AI visibility.",
      },
      {
        question: "Which WordPress SEO plugin is best for AI visibility?",
        answer:
          "Yoast and Rank Math both support JSON-LD schema output. The key is using only one and configuring it to emit Article, FAQ, and Organization schema on relevant pages.",
      },
      {
        question: "How do I check if AI crawlers can access my WordPress site?",
        answer:
          "Run a free AiVIS.biz audit on your URL. It checks robots.txt rules, rendered HTML, structured data, and 30+ signals that determine whether AI systems can parse and cite your content.",
      },
    ],
    internalLinks: [
      { label: "Run a free audit", to: "/app/analyze" },
      { label: "What is llms.txt?", to: "/signals/llms-txt" },
      { label: "Schema.org markup guide", to: "/signals/schema-org" },
      { label: "robots.txt for AI crawlers", to: "/signals/robots-txt" },
    ],
    ctaText: "Audit your WordPress site now",
    ctaLink: "/app/analyze",
  },
  {
    slug: "shopify",
    cluster: "platforms",
    title: "How to Get Your Shopify Store Cited by AI Answer Engines",
    metaTitle: "How to Get Shopify Cited by ChatGPT & Perplexity | AiVIS.biz",
    metaDescription:
      "Discover why AI models skip your Shopify store. Audit product schema, crawl access, and citation readiness for Shopify sites.",
    primaryKeyword: "shopify ai visibility",
    secondaryKeyword: "shopify ai seo audit",
    hook: "Shopify generates product schema automatically — but that doesn't mean AI models can cite your store. Liquid templates, app conflicts, and missing signals create blind spots.",
    sections: [
      {
        heading: "Shopify's Built-In Signals vs What AI Actually Needs",
        content: [
          "Shopify auto-generates Product schema and basic Open Graph tags. However, AI answer engines need more: Organization schema, FAQ schema for product pages, breadcrumb markup, and clean heading hierarchies.",
          "Many Shopify themes inject critical content via JavaScript that AI crawlers cannot execute, making product descriptions invisible to models like GPT and Claude.",
        ],
      },
      {
        heading: "Common Shopify AI Visibility Failures",
        content: [
          "App-injected scripts that override or duplicate schema markup. Review apps, upsell widgets, and pop-up tools often inject competing JSON-LD that confuses parsers.",
          "Missing FAQ schema on product pages. AI models pull FAQ-formatted content for answer boxes — without the schema, your product Q&A sections are invisible.",
          "robots.txt lockdowns: Shopify's default robots.txt blocks many paths. Verify that AI crawlers can reach your key collection and product pages.",
        ],
      },
      {
        heading: "How to Fix Shopify for AI Engines",
        content: [
          "Edit your theme's Liquid templates to add FAQ and Organization JSON-LD. Use Shopify's native {{ product | json }} filter as a base, then extend it.",
          "Audit every installed app for duplicate schema output. Disable schema generation in apps when your theme already handles it.",
          "Add an llms.txt file via Shopify's file system or a proxy rule. Describe your store, product categories, and key content for AI models.",
        ],
      },
    ],
    faqs: [
      {
        question: "Does Shopify support AI visibility natively?",
        answer:
          "Partially. Shopify generates Product schema and Open Graph tags, but lacks FAQ schema, Organization schema, llms.txt, and fine-grained AI crawler control.",
      },
      {
        question: "Can AI models read Shopify product pages?",
        answer:
          "It depends on your theme. Themes that render product descriptions via JavaScript are invisible to most AI crawlers. Check with an AiVIS.biz audit.",
      },
      {
        question: "How do I add llms.txt to Shopify?",
        answer:
          "Upload it as a static asset via Shopify Files, then create a URL redirect from /llms.txt to the asset URL. Alternatively, use a reverse proxy or edge function.",
      },
    ],
    internalLinks: [
      { label: "Run a free audit", to: "/app/analyze" },
      { label: "E-commerce AI visibility", to: "/industries/ecommerce" },
      { label: "Product schema deep dive", to: "/signals/schema-org" },
      { label: "Open Graph optimization", to: "/signals/open-graph" },
    ],
    ctaText: "Audit your Shopify store",
    ctaLink: "/app/analyze",
  },
  {
    slug: "wix",
    cluster: "platforms",
    title: "Why AI Models Can't Read My Wix Website",
    metaTitle: "Why AI Models Can't Read My Wix Website | AiVIS.biz",
    metaDescription:
      "Find out why AI models can't cite your Wix site. Audit JavaScript rendering, schema, and crawl signals for Wix.",
    primaryKeyword: "wix ai visibility",
    secondaryKeyword: "wix ai audit",
    hook: "Wix renders almost everything client-side. AI crawlers see a blank shell unless your site is configured correctly. Here's how to check and fix it.",
    sections: [
      {
        heading: "The Wix Rendering Problem",
        content: [
          "Wix uses heavy client-side JavaScript rendering. When AI crawlers fetch your page, they often receive a minimal HTML shell with no visible content — just framework bootstrap code.",
          "Wix has improved server-side rendering in recent years, but many older sites and certain templates still rely on client-side hydration that AI crawlers cannot execute.",
        ],
      },
      {
        heading: "Schema and Structured Data on Wix",
        content: [
          "Wix auto-generates basic schema for some page types but lacks fine-grained control. You cannot easily add custom JSON-LD or modify the generated schema without workarounds.",
          "Open Graph tags are configurable in Wix SEO settings, but many users leave them on defaults, resulting in generic descriptions that AI models deprioritize.",
        ],
      },
      {
        heading: "Improving Wix AI Visibility",
        content: [
          "Use Wix's SEO panel to manually set meta descriptions, Open Graph fields, and canonical URLs for every important page.",
          "Consider Wix Velo (custom code) to inject JSON-LD schema into page headers. This lets you add FAQ, Article, or Organization schema that Wix doesn't generate natively.",
          "Run an AiVIS.biz audit to see exactly what AI crawlers receive when they fetch your Wix pages. The gap between what you see in the editor and what crawlers receive is often significant.",
        ],
      },
    ],
    faqs: [
      {
        question: "Can AI models read Wix websites?",
        answer:
          "It varies. Newer Wix sites with server-side rendering are partially readable. Older sites or those with heavy animations/widgets may be invisible to AI crawlers.",
      },
      {
        question: "Does Wix support JSON-LD schema?",
        answer:
          "Wix generates basic schema for some elements but doesn't support custom JSON-LD natively. You can add it through Wix Velo custom code injection.",
      },
      {
        question: "How do I improve my Wix site's AI visibility?",
        answer:
          "Start with an AiVIS.biz audit to identify gaps. Then optimize meta tags, add custom JSON-LD via Velo, and ensure your content renders server-side.",
      },
    ],
    internalLinks: [
      { label: "Run a free audit", to: "/app/analyze" },
      { label: "JavaScript rendering issues", to: "/problems/javascript-rendering-blocks-ai" },
      { label: "Meta descriptions guide", to: "/signals/meta-descriptions" },
      { label: "Squarespace comparison", to: "/platforms/squarespace" },
    ],
    ctaText: "Audit your Wix site",
    ctaLink: "/app/analyze",
  },
  {
    slug: "squarespace",
    cluster: "platforms",
    title: "Why Doesn't ChatGPT Cite My Squarespace Site?",
    metaTitle: "Why Doesn't ChatGPT Cite My Squarespace Site? | AiVIS.biz",
    metaDescription:
      "Audit your Squarespace site for AI citation readiness. Check schema, crawl access, and structured data gaps specific to Squarespace.",
    primaryKeyword: "squarespace ai visibility",
    secondaryKeyword: "squarespace ai audit",
    hook: "Squarespace produces clean HTML — but its rigid templating means you can't easily fix the structured data gaps that AI models need for citations.",
    sections: [
      {
        heading: "What Squarespace Gets Right",
        content: [
          "Squarespace renders content server-side, producing clean HTML that AI crawlers can parse. It also generates basic Open Graph tags and a sitemap automatically.",
          "The platform enforces semantic heading structures in most templates, giving AI models a clear content hierarchy to follow.",
        ],
      },
      {
        heading: "What Squarespace Gets Wrong for AI",
        content: [
          "Limited schema output: Squarespace generates Article schema for blog posts but lacks FAQ, HowTo, Organization, and Product schema on relevant page types.",
          "No custom JSON-LD injection without code injection blocks, which are only available on Business plan and above.",
          "No llms.txt support. There's no built-in way to serve a file at /llms.txt describing your site for AI models.",
        ],
      },
      {
        heading: "Fixing Squarespace for AI Engines",
        content: [
          "Use Squarespace's Code Injection feature (Business plan+) to add custom JSON-LD in the page header. Target FAQ, Organization, and Breadcrumb schema.",
          "Manually optimize every page's SEO title and description — Squarespace defaults are often too generic for AI parsing.",
          "Run an AiVIS.biz audit to see your current AI readiness score and get specific fix recommendations ranked by impact.",
        ],
      },
    ],
    faqs: [
      {
        question: "Is Squarespace good for AI visibility?",
        answer:
          "Squarespace's server-rendered HTML is better than client-rendered platforms, but it lacks comprehensive schema support. With manual optimization, scores can improve significantly.",
      },
      {
        question: "Can I add JSON-LD to Squarespace?",
        answer:
          "Yes, via Code Injection on Business plan and above. You'll need to manually write and maintain the JSON-LD markup for each page type.",
      },
      {
        question: "How does Squarespace compare to WordPress for AI visibility?",
        answer:
          "Squarespace has cleaner default HTML but less flexibility. WordPress with the right plugins can achieve better AI visibility thanks to fine-grained schema control.",
      },
    ],
    internalLinks: [
      { label: "Run a free audit", to: "/app/analyze" },
      { label: "Wix comparison", to: "/platforms/wix" },
      { label: "JSON-LD guide", to: "/signals/json-ld" },
      { label: "Heading hierarchy", to: "/signals/heading-hierarchy" },
    ],
    ctaText: "Audit your Squarespace site",
    ctaLink: "/app/analyze",
  },
  {
    slug: "webflow",
    cluster: "platforms",
    title: "How to Make AI Answer Engines Cite Your Webflow Site",
    metaTitle: "How to Make AI Cite Your Webflow Site | AiVIS.biz",
    metaDescription:
      "Audit your Webflow site for AI readability. Discover schema gaps, custom code opportunities, and citation-blocking issues on Webflow.",
    primaryKeyword: "webflow ai visibility",
    secondaryKeyword: "webflow ai seo",
    hook: "Webflow gives you full HTML control — which means AI visibility success depends entirely on how you've configured your project. Most Webflow sites leave critical signals on the table.",
    sections: [
      {
        heading: "Webflow's AI Visibility Advantage",
        content: [
          "Webflow renders static HTML with full server-side output, making all content immediately available to AI crawlers without JavaScript execution.",
          "The platform supports custom code injection at the page, project, and component level — giving you complete control over JSON-LD, meta tags, and structured data.",
        ],
      },
      {
        heading: "Common Webflow Gaps",
        content: [
          "Despite its flexibility, most Webflow sites ship without any JSON-LD schema beyond basic Open Graph. Designers focus on visual output and overlook machine-readable markup.",
          "CMS-driven pages (blog posts, case studies) often share identical meta descriptions generated from a single CMS field, creating duplicate signals that AI models deprioritize.",
          "Missing llms.txt and incomplete robots.txt configurations are common because Webflow doesn't surface these in the visual designer.",
        ],
      },
      {
        heading: "Optimizing Webflow for AI Models",
        content: [
          "Add JSON-LD schema in Webflow's custom code settings for each page type. Use CMS fields to dynamically populate schema properties like author, datePublished, and FAQ entries.",
          "Create unique meta descriptions for every CMS entry. Use Webflow's SEO settings panel — don't rely on auto-generated summaries.",
          "Host an llms.txt at your domain root using Webflow's hosting 301 redirect or a worker/proxy in front of your site.",
        ],
      },
    ],
    faqs: [
      {
        question: "Is Webflow good for AI visibility?",
        answer:
          "Webflow has the best potential of any visual builder because it renders clean HTML and supports custom code injection. But you must configure schema and signals manually.",
      },
      {
        question: "How do I add JSON-LD to Webflow?",
        answer:
          "Use the custom code panel in Page Settings (head section) to add static JSON-LD. For CMS pages, use embed elements with dynamic field bindings to generate page-specific schema.",
      },
      {
        question: "Does Webflow auto-generate structured data?",
        answer:
          "No. Webflow generates Open Graph tags from SEO settings but does not produce JSON-LD schema. You must add it manually via custom code.",
      },
    ],
    internalLinks: [
      { label: "Run a free audit", to: "/app/analyze" },
      { label: "Schema.org markup", to: "/signals/schema-org" },
      { label: "Heading hierarchy", to: "/signals/heading-hierarchy" },
      { label: "Compare platforms", to: "/platforms" },
    ],
    ctaText: "Audit your Webflow site",
    ctaLink: "/app/analyze",
  },
  {
    slug: "next-js",
    cluster: "platforms",
    title: "Why Can't AI Crawlers Read My Next.js App?",
    metaTitle: "Why Can't AI Crawlers Read My Next.js App? | AiVIS.biz",
    metaDescription:
      "Ensure your Next.js app is visible to AI answer engines. Audit SSR, metadata API, and structured data configuration for Next.js.",
    primaryKeyword: "next.js ai visibility",
    secondaryKeyword: "nextjs ai seo audit",
    hook: "Next.js supports SSR, SSG, and ISR — but choosing the wrong rendering strategy for the wrong pages makes your content invisible to AI crawlers.",
    sections: [
      {
        heading: "Next.js Rendering and AI Crawlers",
        content: [
          "AI crawlers do not execute JavaScript. Pages using client-side rendering (CSR) are invisible. Pages using SSR, SSG, or ISR serve pre-rendered HTML that crawlers can parse.",
          "The App Router's metadata API makes it easy to emit SEO tags, but many developers skip structured data because it requires manual JSON-LD configuration.",
        ],
      },
      {
        heading: "Critical Next.js AI Signals",
        content: [
          "Use generateMetadata() in your layout and page files to emit unique titles, descriptions, and Open Graph tags for every route.",
          "Add JSON-LD via a <script type='application/ld+json'> tag in your page or layout components. Next.js doesn't auto-generate schema — you must build it.",
          "Ensure your robots.ts or robots.txt allows GPTBot, ClaudeBot, and other AI crawlers. Next.js middleware can selectively block or allow by user-agent.",
        ],
      },
      {
        heading: "Common Next.js Mistakes",
        content: [
          "Using 'use client' on pages that should be server-rendered. This prevents pre-rendering and makes the page invisible to AI crawlers.",
          "Putting all schema in _app or layout without per-page overrides, resulting in generic Organization schema on every page instead of page-specific Article or FAQ schema.",
          "Forgetting to handle streaming and Suspense boundaries — incomplete HTML sent during streaming can confuse crawlers that close connections early.",
        ],
      },
    ],
    faqs: [
      {
        question: "Does Next.js support AI visibility out of the box?",
        answer:
          "Next.js provides excellent rendering options (SSR/SSG) and a metadata API, but you must manually add JSON-LD schema and configure AI crawler access.",
      },
      {
        question:
          "Should I use SSR or SSG for AI visibility in Next.js?",
        answer:
          "Both work. SSG is ideal for content pages (blog posts, docs). SSR is better for dynamic content that changes frequently. Avoid CSR for any page you want AI to cite.",
      },
      {
        question: "How do I add structured data to Next.js?",
        answer:
          "Add a <script type='application/ld+json'> element in your page component or layout. Use Next.js's generateMetadata for basic tags and manual JSON-LD for rich schema.",
      },
    ],
    internalLinks: [
      { label: "Run a free audit", to: "/app/analyze" },
      { label: "React SPA audit", to: "/platforms/react-spa" },
      { label: "Gatsby comparison", to: "/platforms/gatsby" },
      { label: "JSON-LD guide", to: "/signals/json-ld" },
    ],
    ctaText: "Audit your Next.js app",
    ctaLink: "/app/analyze",
  },
  {
    slug: "gatsby",
    cluster: "platforms",
    title: "Can AI Answer Engines Cite Gatsby Static Sites?",
    metaTitle: "Can AI Answer Engines Cite Gatsby Sites? | AiVIS.biz",
    metaDescription:
      "Audit your Gatsby site for AI answer-engine readiness. Check static HTML output, schema plugins, and crawler access for Gatsby.",
    primaryKeyword: "gatsby ai visibility",
    secondaryKeyword: "gatsby ai seo",
    hook: "Gatsby's static site generation gives you a head start — every page is pre-rendered HTML. But default Gatsby projects ship with zero structured data for AI models.",
    sections: [
      {
        heading: "Gatsby's SSG Advantage for AI",
        content: [
          "Gatsby builds static HTML at compile time. Every page is a fully rendered document that AI crawlers can parse immediately without JavaScript execution.",
          "This gives Gatsby a structural advantage over client-rendered React apps — but the advantage only matters if you add the right machine-readable signals.",
        ],
      },
      {
        heading: "What Gatsby Misses for AI Models",
        content: [
          "No built-in JSON-LD schema generation. Gatsby's SEO ecosystem relies on gatsby-plugin-react-helmet for basic meta tags, but structured data requires manual implementation.",
          "GraphQL-driven pages often dynamically generate slugs and content but use the same meta description template, creating duplicate signals across hundreds of pages.",
          "Many Gatsby starters don't include robots.txt or sitemap plugins, leaving AI crawlers without a starting point for discovery.",
        ],
      },
      {
        heading: "Fixing Gatsby for AI Engines",
        content: [
          "Install gatsby-plugin-sitemap and gatsby-plugin-robots-txt. Configure robots.txt to explicitly allow AI crawler user-agents.",
          "Add a reusable SEO component that injects page-specific JSON-LD (Article, FAQ, Organization) into the document head using React Helmet or Gatsby Head API.",
          "Audit your site with AiVIS.biz to validate that static output contains all required signals — what your dev server renders may differ from the production build.",
        ],
      },
    ],
    faqs: [
      {
        question: "Is Gatsby good for AI visibility?",
        answer:
          "Gatsby's static HTML output is a strong foundation. However, you must add JSON-LD schema, AI crawler rules, and unique meta data manually — none of it is included by default.",
      },
      {
        question: "What Gatsby plugins help with AI visibility?",
        answer:
          "gatsby-plugin-sitemap, gatsby-plugin-robots-txt, and a custom SEO component for JSON-LD are the essentials. Consider gatsby-plugin-canonical-urls for canonical tag management.",
      },
      {
        question: "How does Gatsby compare to Next.js for AI visibility?",
        answer:
          "Both can achieve strong AI visibility. Gatsby excels for static content sites; Next.js offers more flexibility with SSR for dynamic content. The key difference is deployment complexity, not AI readiness.",
      },
    ],
    internalLinks: [
      { label: "Run a free audit", to: "/app/analyze" },
      { label: "Next.js comparison", to: "/platforms/next-js" },
      { label: "XML sitemap guide", to: "/signals/sitemap-xml" },
      { label: "Content freshness", to: "/signals/content-freshness" },
    ],
    ctaText: "Audit your Gatsby site",
    ctaLink: "/app/analyze",
  },
  {
    slug: "drupal",
    cluster: "platforms",
    title: "How to Make Your Drupal Site Visible to AI Answer Engines",
    metaTitle: "How to Make Drupal Visible to AI Answer Engines | AiVIS.biz",
    metaDescription:
      "Audit your Drupal site for AI citation readiness. Discover schema module gaps, crawl configuration issues, and structured data fixes for Drupal.",
    primaryKeyword: "drupal ai visibility",
    secondaryKeyword: "drupal ai audit",
    hook: "Drupal's module ecosystem is powerful but fragmented. Getting the right schema, metatag, and crawl modules working together for AI visibility requires intentional configuration.",
    sections: [
      {
        heading: "Drupal's Strength: Server-Rendered Content",
        content: [
          "Drupal renders all content server-side by default, producing clean HTML that AI crawlers can parse without JavaScript execution.",
          "Drupal's taxonomy, node, and field systems create highly structured content — but that structure lives in the database, not in the HTML output, unless you configure it.",
        ],
      },
      {
        heading: "Common AI Visibility Gaps in Drupal",
        content: [
          "The Schema.org Metatag module exists but is underused. Most Drupal sites emit only basic meta tags without JSON-LD schema for Article, FAQ, or Organization types.",
          "Drupal's permissions system can accidentally block crawlers. Verify that anonymous access allows AI user-agents to reach all public content.",
          "Module conflicts: running Pathauto, Redirect, Metatag, and Schema.org Metatag together requires careful configuration to avoid contradictory output.",
        ],
      },
      {
        heading: "Drupal AI Visibility Fixes",
        content: [
          "Install and configure the Schema.org Metatag module to emit JSON-LD for your primary content types (Article, FAQ, Organization, LocalBusiness).",
          "Use Drupal's robots.txt module to explicitly allow AI crawlers (GPTBot, ClaudeBot) and ensure your sitemap module generates a clean XML sitemap.",
          "Audit regularly — Drupal module updates can silently change output. Run an AiVIS.biz audit after every major deployment.",
        ],
      },
    ],
    faqs: [
      {
        question: "Does Drupal support AI visibility?",
        answer:
          "Drupal has strong potential through its module ecosystem, but AI visibility requires intentional configuration of Schema.org, Metatag, and robots.txt modules.",
      },
      {
        question: "Which Drupal modules help with AI?",
        answer:
          "Schema.org Metatag for JSON-LD, Metatag for Open Graph and meta descriptions, XML Sitemap for discovery, and Robots.txt for crawler control.",
      },
      {
        question: "How do I audit my Drupal site for AI?",
        answer:
          "Run a free AiVIS.biz audit on your site URL. The audit checks all 30+ AI visibility signals and provides Drupal-specific fix recommendations.",
      },
    ],
    internalLinks: [
      { label: "Run a free audit", to: "/app/analyze" },
      { label: "WordPress comparison", to: "/platforms/wordpress" },
      { label: "Schema.org markup", to: "/signals/schema-org" },
      { label: "robots.txt guide", to: "/signals/robots-txt" },
    ],
    ctaText: "Audit your Drupal site",
    ctaLink: "/app/analyze",
  },
  {
    slug: "ghost",
    cluster: "platforms",
    title: "Why AI Models Skip Ghost CMS Blogs",
    metaTitle: "Why AI Models Skip Ghost CMS Blogs | AiVIS.biz",
    metaDescription:
      "Audit your Ghost blog for AI visibility. Check structured data, crawl access, and citation readiness specific to Ghost CMS.",
    primaryKeyword: "ghost cms ai visibility",
    secondaryKeyword: "ghost blog ai audit",
    hook: "Ghost is built for publishing — clean HTML, fast rendering, and built-in structured data. But its minimalist approach means several AI signals are missing by default.",
    sections: [
      {
        heading: "What Ghost Does Well for AI",
        content: [
          "Ghost renders server-side with minimal JavaScript, producing clean HTML documents that AI crawlers parse easily.",
          "Ghost auto-generates Article schema with author, datePublished, and dateModified fields — giving AI models the attribution signals they need for citations.",
        ],
      },
      {
        heading: "Ghost's AI Visibility Gaps",
        content: [
          "No FAQ schema support. Ghost's editor doesn't produce structured FAQ sections, even if you write Q&A content in your posts.",
          "Limited robots.txt customization. Ghost generates a default robots.txt that may not include explicit rules for AI crawlers.",
          "No llms.txt support. Ghost has no built-in way to serve a machine-readable site description file for AI models.",
        ],
      },
      {
        heading: "Ghost AI Visibility Fixes",
        content: [
          "Use Ghost's code injection (per-post and site-wide) to add custom JSON-LD for FAQ, HowTo, and Organization schema.",
          "Customize your Ghost theme's default.hbs to include optimized meta tags and structured data helpers.",
          "Deploy an llms.txt file via your hosting provider's static file serving (if using Ghost Pro, you'll need a CDN or proxy layer).",
        ],
      },
    ],
    faqs: [
      {
        question: "Is Ghost good for AI visibility?",
        answer:
          "Ghost has a strong foundation with clean HTML and auto-generated Article schema. It needs manual work for FAQ schema, llms.txt, and AI crawler rules.",
      },
      {
        question: "Does Ghost generate structured data?",
        answer:
          "Yes — Ghost auto-generates Article schema with author and date fields. But it lacks FAQ, Organization, and Breadcrumb schema that AI models also look for.",
      },
      {
        question: "How do I improve my Ghost blog's AI visibility?",
        answer:
          "Add custom JSON-LD via code injection, optimize your theme's meta output, and run an AiVIS.biz audit to identify specific gaps and prioritized fixes.",
      },
    ],
    internalLinks: [
      { label: "Run a free audit", to: "/app/analyze" },
      { label: "Author entity markup", to: "/signals/author-entity" },
      { label: "Content freshness", to: "/signals/content-freshness" },
      { label: "WordPress comparison", to: "/platforms/wordpress" },
    ],
    ctaText: "Audit your Ghost blog",
    ctaLink: "/app/analyze",
  },
  {
    slug: "hubspot",
    cluster: "platforms",
    title: "Can ChatGPT and Perplexity Read My HubSpot Pages?",
    metaTitle: "Can AI Read My HubSpot Pages? | AiVIS.biz",
    metaDescription:
      "Audit your HubSpot site for AI answer-engine readiness. Discover CMS limitations, schema gaps, and crawl issues for HubSpot.",
    primaryKeyword: "hubspot ai visibility",
    secondaryKeyword: "hubspot cms ai audit",
    hook: "HubSpot CMS powers marketing sites and blogs for thousands of businesses — but its AI visibility depends on how you've configured modules, templates, and HubDB.",
    sections: [
      {
        heading: "HubSpot CMS and AI Crawlers",
        content: [
          "HubSpot renders content server-side, producing HTML that AI crawlers can access. Its built-in SEO tools handle basic meta tags and canonical URLs.",
          "However, HubSpot's template system limits custom structured data injection. Adding JSON-LD requires custom module development or HubL code blocks.",
        ],
      },
      {
        heading: "HubSpot AI Visibility Challenges",
        content: [
          "Limited schema control: HubSpot generates basic WebPage schema but lacks Article, FAQ, or Organization schema on blog posts and landing pages.",
          "Dynamic content loaded via HubSpot forms, CTAs, and smart content is invisible to AI crawlers that don't execute JavaScript.",
          "Blog listing pages often produce thin content signals because HubSpot shows excerpts rather than full articles.",
        ],
      },
      {
        heading: "Improving HubSpot AI Visibility",
        content: [
          "Create custom HubSpot modules that inject JSON-LD schema into page templates. Use HubL variables to populate dynamic fields.",
          "Ensure blog posts have rich standalone content — not just fragments that depend on embedded CTAs or forms for substance.",
          "Run an AiVIS.biz audit to identify exact gaps in your HubSpot site's AI readiness and get prioritized fix recommendations.",
        ],
      },
    ],
    faqs: [
      {
        question: "Does HubSpot CMS support AI visibility?",
        answer:
          "HubSpot provides basic SEO tools but lacks comprehensive structured data output for AI models. Custom modules are needed for full AI visibility.",
      },
      {
        question: "Can I add JSON-LD to HubSpot?",
        answer:
          "Yes, through custom modules using HubL code. HubSpot doesn't have a built-in JSON-LD editor, but developers can create reusable schema modules.",
      },
      {
        question: "How does HubSpot compare to WordPress for AI visibility?",
        answer:
          "WordPress has a larger plugin ecosystem for AI visibility (Yoast, Rank Math). HubSpot requires more custom development but offers better marketing integration.",
      },
    ],
    internalLinks: [
      { label: "Run a free audit", to: "/app/analyze" },
      { label: "AiVIS.biz vs HubSpot SEO", to: "/compare/vs-hubspot-seo" },
      { label: "Schema.org guide", to: "/signals/schema-org" },
      { label: "Content depth", to: "/signals/content-length" },
    ],
    ctaText: "Audit your HubSpot site",
    ctaLink: "/app/analyze",
  },
  {
    slug: "framer",
    cluster: "platforms",
    title: "Why AI Answer Engines Can't Cite Framer Websites",
    metaTitle: "Why AI Can't Cite Framer Websites | AiVIS.biz",
    metaDescription:
      "Audit your Framer site for AI visibility. Check rendering, schema gaps, and crawl access for Framer-built websites.",
    primaryKeyword: "framer ai visibility",
    secondaryKeyword: "framer website ai audit",
    hook: "Framer produces beautiful interactive sites — but animations, transitions, and client-rendered content create AI visibility blind spots that most designers don't realize exist.",
    sections: [
      {
        heading: "How Framer Renders for AI",
        content: [
          "Framer generates static HTML for published sites, which is good for AI crawlers. However, interactive components and animated sections may rely on JavaScript that crawlers skip.",
          "Framer's CMS pages receive server-rendered output, but the quality of that output depends on how you've structured your content fields.",
        ],
      },
      {
        heading: "Framer AI Visibility Gaps",
        content: [
          "No built-in JSON-LD schema. Framer focuses on visual design and lacks structured data tools entirely.",
          "Limited meta tag control: while you can set SEO titles and descriptions, Open Graph images and other tags require workarounds.",
          "No robots.txt or llms.txt customization without deploying through a proxy or custom domain configuration.",
        ],
      },
      {
        heading: "Fixing Framer for AI",
        content: [
          "Use Framer's custom code injection to add JSON-LD schema in the page head. This requires writing schema manually for each page type.",
          "Ensure all important text content is in static elements, not exclusively in animated or interactive components.",
          "Run an AiVIS.biz audit to see what AI models actually receive when they crawl your Framer site — the visual output and the machine-readable output are often very different.",
        ],
      },
    ],
    faqs: [
      {
        question: "Can AI models read Framer sites?",
        answer:
          "Framer generates static HTML for most content, so AI crawlers can read it. But interactive elements and animations may contain content that crawlers miss.",
      },
      {
        question: "Does Framer support structured data?",
        answer:
          "Not natively. You need to inject JSON-LD via Framer's custom code feature, which requires writing schema markup manually.",
      },
      {
        question: "Is Framer better than Webflow for AI visibility?",
        answer:
          "Webflow offers more control over custom code, meta tags, and structured data. Framer is catching up but currently requires more workarounds for AI visibility.",
      },
    ],
    internalLinks: [
      { label: "Run a free audit", to: "/app/analyze" },
      { label: "Webflow comparison", to: "/platforms/webflow" },
      { label: "JSON-LD guide", to: "/signals/json-ld" },
      { label: "JavaScript rendering", to: "/problems/javascript-rendering-blocks-ai" },
    ],
    ctaText: "Audit your Framer site",
    ctaLink: "/app/analyze",
  },
  {
    slug: "bubble",
    cluster: "platforms",
    title: "Why AI Models Can't Parse Bubble.io Apps",
    metaTitle: "Why AI Models Can't Parse Bubble.io Apps | AiVIS.biz",
    metaDescription:
      "Discover why AI models can't parse your Bubble.io app. Audit rendering, schema, and crawl access for no-code apps.",
    primaryKeyword: "bubble io ai visibility",
    secondaryKeyword: "bubble no-code ai audit",
    hook: "Bubble.io builds dynamic web apps — but dynamic rendering is the enemy of AI visibility. If your Bubble app has public-facing content, AI models probably can't read it.",
    sections: [
      {
        heading: "The Bubble Rendering Challenge",
        content: [
          "Bubble renders content dynamically via JavaScript. AI crawlers fetch the page and receive a nearly empty HTML shell with JavaScript bootstrap code.",
          "This means any content you display on Bubble pages — text, lists, pricing tables, FAQ sections — is invisible to AI models by default.",
        ],
      },
      {
        heading: "Can You Fix Bubble for AI?",
        content: [
          "Bubble has limited SEO settings for meta tags and page titles, but no support for JSON-LD schema, custom robots.txt rules, or server-side rendering.",
          "For landing pages and content marketing, consider hosting those on a separate platform (WordPress, Webflow, Ghost) and keep Bubble for the application layer.",
        ],
      },
      {
        heading: "Practical Workarounds",
        content: [
          "Use Bubble's SEO/metatag plugin to set basic Open Graph tags and descriptions for key pages.",
          "If you need public-facing AI-visible content on your Bubble domain, consider a prerendering service that serves static HTML to known crawler user-agents.",
          "Run an AiVIS.biz audit to see exactly what AI crawlers receive when they visit your Bubble app — the gap is often an eye-opener.",
        ],
      },
    ],
    faqs: [
      {
        question: "Can AI models read Bubble.io apps?",
        answer:
          "No, by default. Bubble renders content via JavaScript, which AI crawlers cannot execute. Content-heavy pages are effectively invisible.",
      },
      {
        question: "How do I improve Bubble's AI visibility?",
        answer:
          "Use a prerendering service for crawler requests, or host content pages on a separate platform. Bubble itself lacks the tools for comprehensive AI visibility.",
      },
      {
        question: "Should I use Bubble for my marketing site?",
        answer:
          "No. Bubble excels for dynamic web apps, but marketing and content pages should be on a platform with server-side rendering and schema support.",
      },
    ],
    internalLinks: [
      { label: "Run a free audit", to: "/app/analyze" },
      { label: "JavaScript rendering issues", to: "/problems/javascript-rendering-blocks-ai" },
      { label: "React SPA audit", to: "/platforms/react-spa" },
      { label: "Webflow comparison", to: "/platforms/webflow" },
    ],
    ctaText: "Audit your Bubble app",
    ctaLink: "/app/analyze",
  },
  {
    slug: "weebly",
    cluster: "platforms",
    title: "How to Fix AI Answer Engine Visibility on Weebly",
    metaTitle: "How to Fix AI Visibility on Weebly | AiVIS.biz",
    metaDescription:
      "Audit your Weebly site for AI readability. Check structured data, crawl access, and meta tag configuration for Weebly.",
    primaryKeyword: "weebly ai visibility",
    secondaryKeyword: "weebly ai audit",
    hook: "Weebly produces basic server-rendered HTML, but its limited customization options make it hard to add the structured data that AI models need for citations.",
    sections: [
      {
        heading: "Weebly's Baseline AI Readability",
        content: [
          "Weebly renders content server-side, so AI crawlers can parse the basic HTML. The platform generates a sitemap and basic meta tags automatically.",
          "However, Weebly's builder produces generic HTML structure with limited semantic meaning — headings are often used for styling rather than hierarchy.",
        ],
      },
      {
        heading: "Weebly AI Visibility Limitations",
        content: [
          "No JSON-LD schema support. Weebly doesn't generate structured data and has extremely limited custom code injection capabilities.",
          "Fixed robots.txt with no customization. You cannot add AI-specific crawler rules.",
          "Since Square acquired Weebly, development has slowed. AI visibility features are unlikely to be added natively.",
        ],
      },
      {
        heading: "What Weebly Users Should Do",
        content: [
          "If AI visibility is important for your business, consider migrating to a platform with better schema support (WordPress, Webflow, or Ghost).",
          "For quick wins on Weebly: optimize every page's title and description, use proper heading hierarchy, and ensure all images have alt text.",
          "Run an AiVIS.biz audit to benchmark your current score and understand exactly what's missing before deciding on your next steps.",
        ],
      },
    ],
    faqs: [
      {
        question: "Does Weebly support structured data?",
        answer:
          "No. Weebly doesn't generate JSON-LD schema and offers very limited code injection for adding it manually.",
      },
      {
        question: "Should I migrate from Weebly for AI visibility?",
        answer:
          "If AI visibility is a priority, yes. WordPress, Webflow, and Ghost all offer significantly better AI optimization capabilities.",
      },
      {
        question: "What can I do on Weebly without migrating?",
        answer:
          "Optimize page titles, meta descriptions, heading hierarchy, and image alt text. These basic signals help, even without structured data.",
      },
    ],
    internalLinks: [
      { label: "Run a free audit", to: "/app/analyze" },
      { label: "WordPress alternative", to: "/platforms/wordpress" },
      { label: "Webflow alternative", to: "/platforms/webflow" },
      { label: "Meta descriptions", to: "/signals/meta-descriptions" },
    ],
    ctaText: "Audit your Weebly site",
    ctaLink: "/app/analyze",
  },
  {
    slug: "joomla",
    cluster: "platforms",
    title: "Why AI Answer Engines Skip Joomla Websites",
    metaTitle: "Why AI Answer Engines Skip Joomla Sites | AiVIS.biz",
    metaDescription:
      "Audit your Joomla site for AI answer-engine readiness. Check extensions, schema output, and crawl configuration for Joomla.",
    primaryKeyword: "joomla ai visibility",
    secondaryKeyword: "joomla ai seo audit",
    hook: "Joomla's extension ecosystem can deliver strong AI visibility — but misconfigured extensions and outdated templates often leave critical gaps.",
    sections: [
      {
        heading: "Joomla's AI Visibility Potential",
        content: [
          "Joomla renders content server-side with good semantic HTML in modern templates. Its structured content model (articles, categories, tags) maps well to schema markup.",
          "With the right extensions, Joomla can emit comprehensive JSON-LD, manage AI crawler rules, and generate rich sitemaps.",
        ],
      },
      {
        heading: "Common Joomla AI Visibility Issues",
        content: [
          "Many Joomla sites run on outdated templates with poor heading hierarchy and non-semantic HTML, making it hard for AI models to extract meaning.",
          "Extension conflicts are common: running multiple SEO extensions that each try to generate schema creates duplicate or contradictory structured data.",
          "Joomla's default robots.txt is minimal and doesn't address AI crawlers specifically.",
        ],
      },
      {
        heading: "Joomla AI Visibility Fixes",
        content: [
          "Use a single authoritative SEO extension (like JCH Optimize or sh404SEF) and configure it to emit Article, FAQ, and Organization JSON-LD.",
          "Update your template to use semantic HTML5 elements and proper heading hierarchy.",
          "Customize robots.txt to explicitly allow AI crawler user-agents and run regular AiVIS.biz audits to catch configuration drift.",
        ],
      },
    ],
    faqs: [
      {
        question: "Is Joomla good for AI visibility?",
        answer:
          "Joomla can achieve good AI visibility with proper extension configuration, but it requires more manual setup than WordPress.",
      },
      {
        question: "Which Joomla extensions help with AI?",
        answer:
          "Look for extensions that handle JSON-LD schema output, XML sitemap generation, and meta tag management. Avoid running multiple SEO extensions simultaneously.",
      },
      {
        question: "How does Joomla compare to Drupal for AI visibility?",
        answer:
          "Both are capable CMS platforms. Drupal has a more active schema module ecosystem; Joomla's extension quality varies more widely.",
      },
    ],
    internalLinks: [
      { label: "Run a free audit", to: "/app/analyze" },
      { label: "Drupal comparison", to: "/platforms/drupal" },
      { label: "Schema.org guide", to: "/signals/schema-org" },
      { label: "Heading structure", to: "/signals/heading-hierarchy" },
    ],
    ctaText: "Audit your Joomla site",
    ctaLink: "/app/analyze",
  },
  {
    slug: "magento",
    cluster: "platforms",
    title: "How to Get Your Magento Store Cited by AI",
    metaTitle: "How to Get Magento Cited by AI Answer Engines | AiVIS.biz",
    metaDescription:
      "Audit your Magento or Adobe Commerce store for AI answer-engine readiness. Check product schema, crawl access, and structured data.",
    primaryKeyword: "magento ai visibility",
    secondaryKeyword: "adobe commerce ai audit",
    hook: "Magento powers complex e-commerce — but its performance-heavy architecture and default configuration leave major AI visibility gaps on product, category, and content pages.",
    sections: [
      {
        heading: "Magento's E-Commerce Schema",
        content: [
          "Magento can generate Product schema with price, availability, and review data. However, default themes often miss FAQ, Breadcrumb, and Organization schema that AI models also reference.",
          "Large catalogs create crawl budget challenges: AI crawlers may give up before reaching important pages if your sitemap includes thousands of low-value URLs.",
        ],
      },
      {
        heading: "Common Magento AI Issues",
        content: [
          "Full Page Cache can serve stale or stripped HTML to crawlers. Verify that cached pages include all schema and meta tags.",
          "Extension conflicts are prevalent in Magento. Multiple SEO extensions generating competing schema output confuse AI parsers.",
          "JavaScript-heavy themes (especially PWA Studio / React-based storefronts) are invisible to AI crawlers.",
        ],
      },
      {
        heading: "Magento AI Visibility Fixes",
        content: [
          "Consolidate to one SEO extension for schema output. Disable schema generation in all other extensions.",
          "Optimize your sitemap to prioritize high-value product and category pages. Remove admin, checkout, and customer account URLs.",
          "If using a PWA storefront, implement prerendering or a hybrid architecture that serves HTML to crawler user-agents.",
        ],
      },
    ],
    faqs: [
      {
        question: "Does Magento support AI visibility?",
        answer:
          "Magento has basic Product schema support but requires extensions and configuration for comprehensive AI visibility across all page types.",
      },
      {
        question: "Is Magento PWA Studio bad for AI visibility?",
        answer:
          "Yes, by default. PWA Studio renders client-side, making content invisible to AI crawlers. A prerendering layer is required.",
      },
      {
        question: "How do I audit my Magento store for AI?",
        answer:
          "Run an AiVIS.biz audit on your key product and category URLs. Check for schema completeness, crawl access, and content rendering issues.",
      },
    ],
    internalLinks: [
      { label: "Run a free audit", to: "/app/analyze" },
      { label: "E-commerce AI visibility", to: "/industries/ecommerce" },
      { label: "BigCommerce comparison", to: "/platforms/bigcommerce" },
      { label: "Shopify comparison", to: "/platforms/shopify" },
    ],
    ctaText: "Audit your Magento store",
    ctaLink: "/app/analyze",
  },
  {
    slug: "bigcommerce",
    cluster: "platforms",
    title: "Can AI Answer Engines Cite BigCommerce Stores?",
    metaTitle: "Can AI Cite BigCommerce Stores? | AiVIS.biz",
    metaDescription:
      "Audit your BigCommerce store for AI readiness. Check product schema, crawl access, and structured data specific to BigCommerce.",
    primaryKeyword: "bigcommerce ai visibility",
    secondaryKeyword: "bigcommerce ai seo",
    hook: "BigCommerce generates decent product schema out of the box — but category pages, content pages, and AI crawler access often need significant attention.",
    sections: [
      {
        heading: "BigCommerce Built-In AI Signals",
        content: [
          "BigCommerce auto-generates Product schema with price, availability, rating, and brand fields. It also produces an XML sitemap and basic Open Graph tags.",
          "Blog posts get basic Article schema, though the quality varies by theme and configuration.",
        ],
      },
      {
        heading: "BigCommerce AI Visibility Gaps",
        content: [
          "Category pages receive no structured data by default — a significant gap since AI models often reference product categories in answer generation.",
          "Blog content is often thin because merchants focus on product pages. AI models deprioritize sites with sparse blog content.",
          "Custom theme modifications can break schema output without obvious errors. Theme updates may silently remove JSON-LD from templates.",
        ],
      },
      {
        heading: "BigCommerce Fixes",
        content: [
          "Add JSON-LD for Collection/Category pages via BigCommerce's Script Manager or theme template customization.",
          "Invest in blog content that targets AI answer queries about your product category — this builds citation-worthy authority.",
          "Run regular AiVIS.biz audits after theme updates to catch schema regressions before they impact your AI visibility.",
        ],
      },
    ],
    faqs: [
      {
        question: "Does BigCommerce generate structured data?",
        answer:
          "Yes — Product and Article schema are generated automatically. But category pages, FAQ sections, and Organization schema need manual implementation.",
      },
      {
        question: "How does BigCommerce compare to Shopify for AI?",
        answer:
          "BigCommerce has slightly better default schema output than Shopify. Both require manual work for comprehensive AI visibility.",
      },
      {
        question: "Can I add custom schema to BigCommerce?",
        answer:
          "Yes, via Script Manager (for site-wide scripts) or Stencil theme templates (for page-specific schema). Both require coding knowledge.",
      },
    ],
    internalLinks: [
      { label: "Run a free audit", to: "/app/analyze" },
      { label: "Shopify comparison", to: "/platforms/shopify" },
      { label: "Magento comparison", to: "/platforms/magento" },
      { label: "E-commerce AI visibility", to: "/industries/ecommerce" },
    ],
    ctaText: "Audit your BigCommerce store",
    ctaLink: "/app/analyze",
  },
  {
    slug: "cargo",
    cluster: "platforms",
    title: "Can AI Crawlers Read Cargo Portfolio Sites?",
    metaTitle: "Can AI Crawlers Read Cargo Sites? | AiVIS.biz",
    metaDescription:
      "Audit your Cargo portfolio site for AI visibility. Discover rendering issues, missing schema, and crawl gaps.",
    primaryKeyword: "cargo site ai visibility",
    secondaryKeyword: "cargo portfolio ai audit",
    hook: "Cargo builds stunning portfolio sites — but design-first platforms often sacrifice machine readability for visual impact, making your work invisible to AI models.",
    sections: [
      {
        heading: "Cargo's Design-First Approach",
        content: [
          "Cargo produces visually striking sites but uses non-standard HTML structures, custom rendering, and animation-heavy layouts that AI crawlers struggle to parse.",
          "Content is often embedded in complex CSS grid/flexbox layouts with minimal semantic HTML, making text extraction unreliable for AI models.",
        ],
      },
      {
        heading: "AI Visibility Limitations",
        content: [
          "No JSON-LD, minimal schema output, and limited meta tag customization. Cargo focuses on visual presentation over machine readability.",
          "Portfolio images lack structured alt text workflows, missing a key signal for AI image understanding and attribution.",
        ],
      },
      {
        heading: "What Portfolio Sites Can Do",
        content: [
          "Use Cargo's available SEO settings to set unique titles and descriptions for every project page.",
          "If AI visibility matters for client acquisition, consider a companion blog or landing page on a more configurable platform that links to your Cargo portfolio.",
          "Run an AiVIS.biz audit to see your baseline score and understand the specific gaps in your Cargo site's AI readability.",
        ],
      },
    ],
    faqs: [
      {
        question: "Can AI models cite Cargo portfolio sites?",
        answer:
          "It's unlikely. Cargo's non-standard HTML and lack of structured data make it difficult for AI models to extract and cite portfolio content.",
      },
      {
        question: "Should creatives care about AI visibility?",
        answer:
          "Yes — AI-powered search increasingly mediates client discovery. If AI models can't find or cite your work, you're missing potential clients.",
      },
      {
        question: "What's a better alternative to Cargo for AI visibility?",
        answer:
          "Webflow offers similar design flexibility with much better AI optimization capabilities — custom code injection, schema support, and clean HTML output.",
      },
    ],
    internalLinks: [
      { label: "Run a free audit", to: "/app/analyze" },
      { label: "Webflow alternative", to: "/platforms/webflow" },
      { label: "Framer comparison", to: "/platforms/framer" },
      { label: "Image alt text", to: "/signals/alt-text" },
    ],
    ctaText: "Audit your Cargo site",
    ctaLink: "/app/analyze",
  },
  {
    slug: "notion-sites",
    cluster: "platforms",
    title: "Why ChatGPT Doesn't Cite Notion Sites",
    metaTitle: "Why ChatGPT Doesn't Cite Notion Sites | AiVIS.biz",
    metaDescription:
      "Audit your published Notion site for AI readability. Check rendering, structured data, and crawl access for Notion-powered websites.",
    primaryKeyword: "notion sites ai visibility",
    secondaryKeyword: "notion website ai audit",
    hook: "Notion Sites turns documentation into websites instantly — but the generated HTML lacks the structured data and crawl signals that AI answer engines need.",
    sections: [
      {
        heading: "How Notion Sites Renders for AI",
        content: [
          "Notion Sites produces server-rendered HTML, which is good for crawl access. Content blocks translate to HTML elements that AI crawlers can parse.",
          "However, Notion's HTML output is heavily nested with generic div elements, making semantic structure harder for AI models to judge.",
        ],
      },
      {
        heading: "Notion Sites AI Gaps",
        content: [
          "Zero JSON-LD schema. Notion Sites doesn't generate any structured data — no Article, FAQ, Organization, or Breadcrumb schema.",
          "No custom meta tags beyond what Notion auto-generates from page titles and content snippets.",
          "No robots.txt customization, no sitemap control, and no ability to add an llms.txt file.",
        ],
      },
      {
        heading: "Working Within Notion's Limits",
        content: [
          "Use Notion's page properties to set custom descriptions and titles that will populate basic meta tags.",
          "Structure your content with clear headings (H1, H2, H3) — Notion translates these to proper heading elements that AI models use for hierarchy.",
          "For serious AI visibility needs, consider using Notion as a CMS backend with a custom frontend (via Notion API) that adds proper schema and meta tags.",
        ],
      },
    ],
    faqs: [
      {
        question: "Are Notion Sites visible to AI?",
        answer:
          "The raw content is crawlable, but Notion Sites lacks structured data, custom meta tags, and AI crawler rules — limiting citation potential.",
      },
      {
        question: "Can I add JSON-LD to Notion Sites?",
        answer:
          "Not directly. Notion Sites doesn't support custom code injection. You would need a proxy layer or custom frontend to add structured data.",
      },
      {
        question: "Is Notion Sites good for SEO?",
        answer:
          "For internal docs and simple knowledge bases, it's adequate. For competitive AI visibility, you need a platform with more control.",
      },
    ],
    internalLinks: [
      { label: "Run a free audit", to: "/app/analyze" },
      { label: "Ghost alternative", to: "/platforms/ghost" },
      { label: "Heading hierarchy guide", to: "/signals/heading-hierarchy" },
      { label: "Missing structured data", to: "/problems/missing-structured-data" },
    ],
    ctaText: "Audit your Notion site",
    ctaLink: "/app/analyze",
  },
  {
    slug: "carrd",
    cluster: "platforms",
    title: "How to Make AI Cite Your Carrd Landing Page",
    metaTitle: "How to Make AI Cite Your Carrd Page | AiVIS.biz",
    metaDescription:
      "Audit your Carrd landing page for AI visibility. Check meta tags, rendering, and structured data for single-page Carrd sites.",
    primaryKeyword: "carrd ai visibility",
    secondaryKeyword: "carrd landing page ai audit",
    hook: "Carrd builds beautiful single-page sites — but one-page layouts create unique AI visibility challenges that most builders don't consider.",
    sections: [
      {
        heading: "Single-Page AI Visibility Challenges",
        content: [
          "AI models prefer content-rich pages with clear topical focus. A single-page site that covers your about, pricing, features, and FAQ in one URL gives AI less to cite specifically.",
          "Carrd uses section-based layouts that translate to simple HTML. The content is visible to crawlers, but there's only one URL to index — limiting your citation surface area.",
        ],
      },
      {
        heading: "What Carrd Provides vs What AI Needs",
        content: [
          "Carrd generates basic meta tags (title, description) and Open Graph tags. It renders server-side, so content is crawlable.",
          "Missing: JSON-LD schema, sitemap, robots.txt control, llms.txt, heading hierarchy (many Carrd sites use H2 and H3 inconsistently), and multi-page content structure.",
        ],
      },
      {
        heading: "Maximizing Carrd AI Visibility",
        content: [
          "Use Carrd Pro's embed feature to inject JSON-LD Organization schema in the page head.",
          "Structure your sections with proper headings and ensure your meta description accurately summarizes your primary offering.",
          "If AI visibility is critical, consider using Carrd as a landing page but hosting supporting content (blog, docs, FAQ) on a more capable platform.",
        ],
      },
    ],
    faqs: [
      {
        question: "Can AI models find my Carrd site?",
        answer:
          "AI crawlers can read Carrd's HTML output, but with only one URL and no structured data, citation chances are limited.",
      },
      {
        question: "Should I add structured data to Carrd?",
        answer:
          "Yes — even basic Organization and WebPage schema helps. Use Carrd Pro's embed feature to add JSON-LD in the head section.",
      },
      {
        question: "Is Carrd enough for AI visibility?",
        answer:
          "For a simple landing page, Carrd is fine. For comprehensive AI visibility, you need multi-page content on a platform with schema support.",
      },
    ],
    internalLinks: [
      { label: "Run a free audit", to: "/app/analyze" },
      { label: "Framer alternative", to: "/platforms/framer" },
      { label: "Content depth guide", to: "/signals/content-length" },
      { label: "Local business guide", to: "/industries/local-business" },
    ],
    ctaText: "Audit your Carrd site",
    ctaLink: "/app/analyze",
  },
  {
    slug: "react-spa",
    cluster: "platforms",
    title: "Why AI Can't Read React Single-Page Applications",
    metaTitle: "Why AI Can't Read React SPAs | AiVIS.biz",
    metaDescription:
      "Find out why AI models can't read your React SPA. Audit client-side rendering, missing schema, and crawl issues for React apps.",
    primaryKeyword: "react spa ai visibility",
    secondaryKeyword: "react single page app ai",
    hook: "React single-page apps are invisible to AI by default. Client-side rendering means AI crawlers see an empty div and nothing else. Here's how to fix it.",
    sections: [
      {
        heading: "Why React SPAs Are Invisible to AI",
        content: [
          "A standard React SPA serves an HTML file containing <div id='root'></div> and a JavaScript bundle. AI crawlers don't execute JavaScript — they see an empty page.",
          "This isn't a React limitation per se — it's a client-side rendering issue. Any framework that renders in the browser has the same problem.",
        ],
      },
      {
        heading: "Solutions for React AI Visibility",
        content: [
          "Server-Side Rendering (SSR): Use Next.js, Remix, or a custom SSR setup to pre-render HTML on the server. This is the most robust solution.",
          "Static Site Generation (SSG): If your content doesn't change frequently, generate static HTML at build time using Next.js static export or a similar approach.",
          "Prerendering services: Tools like Prerender.io intercept crawler requests and serve pre-rendered HTML. This works but adds latency and a dependency.",
        ],
      },
      {
        heading: "Schema and Meta for React Apps",
        content: [
          "Use React Helmet (or your framework's metadata API) to set unique title, description, and Open Graph tags per route.",
          "Add JSON-LD schema via a dedicated component that injects <script type='application/ld+json'> into the document head.",
          "Configure your deployment to serve a proper robots.txt and sitemap.xml. Many React SPA deployments serve 404 or the index.html for these paths.",
        ],
      },
    ],
    faqs: [
      {
        question: "Can AI models read React apps?",
        answer:
          "Not client-side rendered React apps. AI crawlers don't execute JavaScript. You need SSR, SSG, or a prerendering service.",
      },
      {
        question: "Is Next.js the only way to fix React AI visibility?",
        answer:
          "No — Remix, Astro, Gatsby, and custom SSR solutions all work. Any approach that serves pre-rendered HTML to crawlers solves the problem.",
      },
      {
        question: "How do I test if my React app is visible to AI?",
        answer:
          "Run an AiVIS.biz audit. It fetches your URL like an AI crawler and reports exactly what it sees — including whether content is rendered or just JavaScript.",
      },
    ],
    internalLinks: [
      { label: "Run a free audit", to: "/app/analyze" },
      { label: "Next.js guide", to: "/platforms/next-js" },
      { label: "JavaScript rendering problem", to: "/problems/javascript-rendering-blocks-ai" },
      { label: "Gatsby guide", to: "/platforms/gatsby" },
    ],
    ctaText: "Audit your React app",
    ctaLink: "/app/analyze",
  },
];
