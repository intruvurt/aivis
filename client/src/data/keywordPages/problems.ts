import type { KeywordPage } from "./types";

export const problemPages: KeywordPage[] = [
  {
    slug: "why-ai-cant-read-my-site",
    cluster: "problems",
    title: "Why AI Can't Read My Website",
    metaTitle: "Why AI Can't Read My Website — Common Causes | AiVIS",
    metaDescription:
      "Find out why ChatGPT, Perplexity, and Claude can't find or cite your website. Diagnose the most common AI visibility failures.",
    primaryKeyword: "why ai can't read my website",
    secondaryKeyword: "ai visibility problems",
    hook: "Your website looks great in a browser — but AI models see something completely different. Here are the most common reasons your site is invisible to AI answer engines.",
    sections: [
      {
        heading: "Client-Side Rendering",
        content: [
          "If your site runs on React, Vue, or Angular without server-side rendering, AI crawlers receive an empty HTML shell. They don't execute JavaScript.",
          "Check your page source (View Source, not Inspect Element). If the body is mostly empty, your content is client-rendered and invisible to AI.",
        ],
      },
      {
        heading: "Blocked Crawlers",
        content: [
          "Your robots.txt may block AI crawlers like GPTBot, ClaudeBot, or PerplexityBot. Many security tools add blanket Disallow rules that affect AI indexing.",
          "Some CDNs and WAFs (Cloudflare, Sucuri) rate-limit or block unknown user-agents, which includes newer AI crawlers.",
        ],
      },
      {
        heading: "Missing Structured Data",
        content: [
          "AI models rely on JSON-LD schema, Open Graph tags, and clean HTML hierarchy to understand your content. Without these signals, your content is parseable but not citable.",
          "Even if a crawler can read your HTML, missing schema makes it harder for models to attribute quotes, verify facts, and generate accurate citations.",
        ],
      },
    ],
    faqs: [
      {
        question: "How do I check if AI can read my website?",
        answer:
          "Run a free AiVIS audit on your URL. It crawls your site like an AI model and reports exactly which signals are present, missing, or broken.",
      },
      {
        question: "Can I fix AI visibility without redesigning my site?",
        answer:
          "Usually, yes. Most fixes involve configuration changes: updating robots.txt, adding JSON-LD, and ensuring server-side rendering. No visual redesign required.",
      },
      {
        question: "Which AI models crawl websites?",
        answer:
          "OpenAI (GPTBot), Anthropic (ClaudeBot), Perplexity (PerplexityBot), Google (Googlebot), and others. Each has slightly different crawling behavior.",
      },
    ],
    internalLinks: [
      { label: "Run a free audit", to: "/app/analyze" },
      { label: "JavaScript rendering issues", to: "/problems/javascript-rendering-blocks-ai" },
      { label: "Blocked by robots.txt", to: "/problems/blocked-by-robots-txt" },
      { label: "Missing structured data", to: "/problems/missing-structured-data" },
    ],
    ctaText: "Diagnose your site now",
    ctaLink: "/app/analyze",
  },
  {
    slug: "missing-structured-data",
    cluster: "problems",
    title: "Missing Structured Data Kills AI Citations",
    metaTitle: "Missing Structured Data — Why AI Skips Your Content | AiVIS",
    metaDescription:
      "No JSON-LD or schema markup? AI models can't properly cite or attribute your content. Learn what structured data AI needs and how to add it.",
    primaryKeyword: "missing structured data ai",
    secondaryKeyword: "no schema markup ai visibility",
    hook: "Your content might be crawler-accessible — but without structured data, AI models have no reliable way to attribute, verify, or cite it. Structured data is the citation bridge.",
    sections: [
      {
        heading: "What AI Models Need from Structured Data",
        content: [
          "JSON-LD schema tells AI models what your content is (Article, FAQ, Product), who wrote it (author), and when it was published. Without this, models guess — and often guess wrong.",
          "Open Graph tags provide pre-formatted summaries that AI models use for quick content classification and display formatting.",
        ],
      },
      {
        heading: "Which Schema Types Matter Most",
        content: [
          "Article schema: essential for blog posts, news, and editorial content. Includes author, datePublished, headline, and description.",
          "FAQ schema: tells AI models your page contains Q&A content, making it eligible for featured answer boxes and direct citations.",
          "Organization schema: establishes your brand entity, connecting your content to a verified publisher identity.",
        ],
      },
      {
        heading: "Adding Structured Data to Your Site",
        content: [
          "Add JSON-LD in a <script type='application/ld+json'> tag in your page's <head>. Don't use Microdata or RDFa — JSON-LD is the format AI models prefer.",
          "Test your schema output with Google's Rich Results Test and validate with an AiVIS audit to ensure AI crawlers receive the markup correctly.",
        ],
      },
    ],
    faqs: [
      {
        question: "Does structured data guarantee AI citations?",
        answer:
          "No, but it significantly increases the probability. Structured data makes your content machine-verifiable, which AI models prioritize when generating citations.",
      },
      {
        question: "Which structured data format should I use?",
        answer:
          "JSON-LD. It's the format recommended by Google and preferred by AI models. Microdata and RDFa are harder to maintain and less reliably parsed.",
      },
      {
        question: "How much structured data do I need?",
        answer:
          "At minimum: Organization, Article (for content pages), and FAQ (for Q&A content). Add Breadcrumb, Product, and HowTo where relevant.",
      },
    ],
    internalLinks: [
      { label: "Run a free audit", to: "/app/analyze" },
      { label: "JSON-LD guide", to: "/signals/json-ld" },
      { label: "Schema.org markup", to: "/signals/schema-org" },
      { label: "FAQ schema", to: "/signals/faq-schema" },
    ],
    ctaText: "Check your structured data",
    ctaLink: "/app/analyze",
  },
  {
    slug: "javascript-rendering-blocks-ai",
    cluster: "problems",
    title: "JavaScript Rendering Blocks AI Crawlers",
    metaTitle: "JavaScript Rendering Blocks AI Crawlers | AiVIS",
    metaDescription:
      "AI crawlers don't execute JavaScript. If your site renders client-side, your content is invisible to ChatGPT, Perplexity, and other AI models.",
    primaryKeyword: "javascript rendering ai visibility",
    secondaryKeyword: "client side rendering ai crawlers",
    hook: "AI crawlers fetch HTML and leave. They don't run your JavaScript bundles, wait for API calls, or hydrate your React components. If your content depends on JavaScript, it's invisible.",
    sections: [
      {
        heading: "How AI Crawlers Process Pages",
        content: [
          "AI crawlers (GPTBot, ClaudeBot, PerplexityBot) operate like wget or curl — they download the HTML response and parse it. No browser engine, no JavaScript execution.",
          "This means dynamic content loaded via API calls, client-side routing, and JavaScript-rendered components simply don't exist from the crawler's perspective.",
        ],
      },
      {
        heading: "Which Frameworks Are Affected",
        content: [
          "React (Create React App, Vite): fully client-rendered by default. All content invisible to AI crawlers.",
          "Vue (standard SPA mode): same issue as React. Content rendered in the browser only.",
          "Angular: client-side rendering by default. Angular Universal (SSR) solves it but adds significant complexity.",
          "Next.js, Nuxt, SvelteKit: safe by default IF you use SSR or SSG. But client-only components within these frameworks still have the problem.",
        ],
      },
      {
        heading: "How to Fix It",
        content: [
          "Migrate to a framework with SSR/SSG support (Next.js, Nuxt, SvelteKit, Astro). This is the most robust long-term solution.",
          "Use a prerendering service that serves static HTML to crawler user-agents. This works as a stopgap but adds latency and cost.",
          "At minimum, ensure critical content (headings, body text, meta tags) is in the initial HTML response, even if interactive elements load later.",
        ],
      },
    ],
    faqs: [
      {
        question: "Does Google render JavaScript for AI answers?",
        answer:
          "Google's traditional indexing can render JavaScript, but AI-specific crawlers (GPTBot, ClaudeBot) typically do not. Don't assume Google's behavior applies to all AI models.",
      },
      {
        question: "Can I check if my JavaScript content is visible to AI?",
        answer:
          "Yes — run an AiVIS audit. It crawls your page without JavaScript execution and shows exactly what AI models see.",
      },
      {
        question: "Is server-side rendering required for AI visibility?",
        answer:
          "Not strictly — SSG (static site generation) works too. The key requirement is that the HTML response contains your content without JavaScript execution.",
      },
    ],
    internalLinks: [
      { label: "Run a free audit", to: "/app/analyze" },
      { label: "React SPA audit", to: "/platforms/react-spa" },
      { label: "Next.js guide", to: "/platforms/next-js" },
      { label: "Why AI can't read my site", to: "/problems/why-ai-cant-read-my-site" },
    ],
    ctaText: "Test your rendering now",
    ctaLink: "/app/analyze",
  },
  {
    slug: "no-schema-markup",
    cluster: "problems",
    title: "No Schema Markup Detected on Your Site",
    metaTitle: "No Schema Markup Detected — Fix Your AI Visibility | AiVIS",
    metaDescription:
      "Your site has zero schema markup. AI models can parse your text but can't verify, attribute, or cite it reliably without structured data.",
    primaryKeyword: "no schema markup",
    secondaryKeyword: "add schema markup for ai",
    hook: "An AiVIS audit found no schema markup on your site. This means AI models can read your text but have no structured way to verify authorship, classify content, or generate reliable citations.",
    sections: [
      {
        heading: "What Zero Schema Means for AI",
        content: [
          "Without schema markup, AI models treat your content as undifferentiated text. They can't distinguish your article from a comment section, your product from a sidebar widget.",
          "Citation engines like Perplexity and ChatGPT with browsing prefer sources with machine-verifiable structure — schema lets them confirm what they're citing.",
        ],
      },
      {
        heading: "Priority Schema to Add First",
        content: [
          "Organization: tells AI who published the content. Add this site-wide, typically in the global layout or header.",
          "Article: identifies blog posts, news, and editorial content with author, date, and headline metadata.",
          "FAQ: marks Q&A sections for direct inclusion in AI answer generation. High impact for citation likelihood.",
        ],
      },
      {
        heading: "Quick Implementation Guide",
        content: [
          "Start with a single JSON-LD block in your homepage's <head> containing Organization schema. This immediately establishes your entity identity.",
          "Add Article schema to your blog post template — most CMS platforms and frameworks support this through plugins, modules, or custom components.",
          "Add FAQ schema to any page with a Q&A section. This is one of the highest-impact signals for AI answer placement.",
        ],
      },
    ],
    faqs: [
      {
        question: "Is schema markup hard to add?",
        answer:
          "No. JSON-LD schema is just a JavaScript object in a script tag in your page's head. Most CMS platforms have plugins that generate it automatically.",
      },
      {
        question: "How many schema types do I need?",
        answer:
          "Start with Organization (site-wide), Article (content pages), and FAQ (Q&A pages). Add Breadcrumb, Product, and HowTo as relevant.",
      },
      {
        question: "Will adding schema immediately improve AI visibility?",
        answer:
          "Improvement depends on crawl timing, but schema gives AI models immediate verifiable structure. Run a follow-up AiVIS audit to confirm deployment.",
      },
    ],
    internalLinks: [
      { label: "Run a free audit", to: "/app/analyze" },
      { label: "JSON-LD guide", to: "/signals/json-ld" },
      { label: "Schema.org types", to: "/signals/schema-org" },
      { label: "FAQ schema setup", to: "/signals/faq-schema" },
    ],
    ctaText: "Check your schema now",
    ctaLink: "/app/analyze",
  },
  {
    slug: "broken-open-graph",
    cluster: "problems",
    title: "Broken Open Graph Tags Hurt AI Visibility",
    metaTitle: "Broken Open Graph Tags — Fix for AI Engines | AiVIS",
    metaDescription:
      "Broken or missing Open Graph tags prevent AI models from classifying and displaying your content correctly. Diagnose and fix OG issues.",
    primaryKeyword: "broken open graph tags",
    secondaryKeyword: "open graph ai visibility",
    hook: "Open Graph tags are your content's first impression to AI systems. When they're broken, missing, or duplicated, AI models misjudge or skip your content entirely.",
    sections: [
      {
        heading: "How AI Uses Open Graph Tags",
        content: [
          "AI models use og:title, og:description, and og:type to quickly classify page content without deep parsing. Broken OG tags force models to fall back on less reliable heuristics.",
          "Perplexity and other citation engines use og:image and og:url for rich result formatting. Missing tags produce broken or generic results.",
        ],
      },
      {
        heading: "Common Open Graph Problems",
        content: [
          "Duplicate OG tags: multiple og:title or og:description tags from competing plugins. AI parsers may use the first, last, or neither.",
          "Empty OG tags: tags are present but contain empty strings or placeholder text like 'Your description here'.",
          "Missing og:type: without this tag, AI classifies your page as generic 'website' rather than 'article', reducing citation relevance.",
        ],
      },
      {
        heading: "Fixing Open Graph Tags",
        content: [
          "Audit your HTML source (not DOM) for duplicate OG meta tags. Remove competing plugins or disable OG output from all but your primary SEO tool.",
          "Set og:type to 'article' for blog posts and content pages. Use 'website' only for your homepage and app pages.",
          "Validate OG tags with an AiVIS audit — it checks for duplicates, empties, and missing required fields.",
        ],
      },
    ],
    faqs: [
      {
        question: "Do AI models actually use Open Graph?",
        answer:
          "Yes. AI answer engines and web-browsing AI models use OG tags for quick content classification. They're especially important for Perplexity and ChatGPT browsing.",
      },
      {
        question: "How many Open Graph tags should I have?",
        answer:
          "At minimum: og:title, og:description, og:type, og:url, and og:image. Each should appear exactly once per page.",
      },
      {
        question: "Can broken OG tags hurt my regular SEO?",
        answer:
          "Broken OG tags primarily affect social sharing and AI citation display. They don't directly impact Google rankings but hurt how your content appears in AI-generated answers.",
      },
    ],
    internalLinks: [
      { label: "Run a free audit", to: "/app/analyze" },
      { label: "Open Graph guide", to: "/signals/open-graph" },
      { label: "Meta descriptions", to: "/signals/meta-descriptions" },
      { label: "Missing structured data", to: "/problems/missing-structured-data" },
    ],
    ctaText: "Check your OG tags",
    ctaLink: "/app/analyze",
  },
  {
    slug: "missing-meta-descriptions",
    cluster: "problems",
    title: "Missing Meta Descriptions Block AI Citations",
    metaTitle: "Missing Meta Descriptions — AI Can't Summarize Your Pages | AiVIS",
    metaDescription:
      "Pages without meta descriptions force AI models to auto-generate summaries, often inaccurately. Fix missing descriptions to control your AI narrative.",
    primaryKeyword: "missing meta descriptions",
    secondaryKeyword: "meta description ai visibility",
    hook: "When you don't write a meta description, AI models write one for you — and they often get it wrong. Missing descriptions surrender control of how AI summarizes your content.",
    sections: [
      {
        heading: "Why Meta Descriptions Matter for AI",
        content: [
          "AI models use meta descriptions as pre-authored content summaries. When present, they anchor the model's understanding of what the page is about.",
          "Without a description, models extract random sentences from your page body — frequently pulling irrelevant sidebar text, footer links, or navigation labels.",
        ],
      },
      {
        heading: "The Scale of Missing Descriptions",
        content: [
          "Most AI visibility audits reveal that 30-60% of pages lack custom meta descriptions. CMS auto-generated descriptions are often truncated or generic.",
          "Blog posts are the worst offenders — many CMS platforms default to truncating the first paragraph, which is rarely an accurate page summary.",
        ],
      },
      {
        heading: "Fixing Missing Descriptions",
        content: [
          "Write unique, accurate descriptions for every important page. Target 150-160 characters. Include your primary keyword and a clear value statement.",
          "Prioritize pages that rank in AI citations or receive organic traffic. Use AiVIS audit data to identify high-impact gaps.",
          "For large sites, use your CMS's bulk editing tools to systematically fill in descriptions across content types.",
        ],
      },
    ],
    faqs: [
      {
        question: "Are meta descriptions still important for AI?",
        answer:
          "Yes — more than ever. AI models use descriptions as quick content summaries for classification and citation generation. Missing descriptions lead to inaccurate AI summaries.",
      },
      {
        question: "How long should my meta description be?",
        answer:
          "150-160 characters for traditional SEO. For AI, clarity matters more than length — ensure your description accurately captures the page's primary topic.",
      },
      {
        question: "Do auto-generated descriptions work?",
        answer:
          "Rarely. CMS auto-generated descriptions typically truncate content mid-sentence, creating misleading summaries that AI models may reproduce.",
      },
    ],
    internalLinks: [
      { label: "Run a free audit", to: "/app/analyze" },
      { label: "Meta descriptions guide", to: "/signals/meta-descriptions" },
      { label: "Open Graph tags", to: "/signals/open-graph" },
      { label: "Content depth", to: "/signals/content-length" },
    ],
    ctaText: "Find missing descriptions",
    ctaLink: "/app/analyze",
  },
  {
    slug: "thin-content",
    cluster: "problems",
    title: "Thin Content Kills AI Citation Chances",
    metaTitle: "Thin Content — Why AI Models Won't Cite You | AiVIS",
    metaDescription:
      "Thin pages with minimal content are skipped by AI models for citations. Learn the minimum content depth for AI visibility.",
    primaryKeyword: "thin content ai visibility",
    secondaryKeyword: "content depth ai citations",
    hook: "AI models prioritize pages with substantive, well-structured content. Pages with less than 300 words, no headings, and no supporting detail get classified as thin content and deprioritized.",
    sections: [
      {
        heading: "What AI Considers Thin Content",
        content: [
          "Pages under 300 words with minimal structure signal low authority. AI models associate thin content with placeholder pages, stubs, or auto-generated filler.",
          "Even longer pages can be 'thin' if they lack substance — pages padded with repetitive keywords, boilerplate, or navigation text without real information.",
        ],
      },
      {
        heading: "Why Thin Content Gets Deprioritized",
        content: [
          "AI citation engines need enough content to verify claims, extract specific facts, and generate contextual citations. Thin pages simply don't provide enough material.",
          "Perplexity and ChatGPT browsing prefer sources that answer questions comprehensively. A 150-word page can't compete with a 1500-word guide.",
        ],
      },
      {
        heading: "Fixing Thin Content",
        content: [
          "Identify thin pages with an AiVIS audit — it flags pages that fall below AI visibility thresholds for content depth.",
          "Expand pages to 800+ words with structured headings, specific details, and FAQ sections. Quality matters more than word count.",
          "Consolidate thin pages that cover similar topics into comprehensive resources, then redirect the old URLs.",
        ],
      },
    ],
    faqs: [
      {
        question: "What is the minimum word count for AI visibility?",
        answer:
          "There's no hard minimum, but pages with 800+ words, clear headings, and FAQ sections consistently score higher in AI audits. Under 300 words is almost always flagged.",
      },
      {
        question: "Can short pages ever rank in AI answers?",
        answer:
          "Rarely — and only if they contain highly specific, verifiable data (like a pricing table or factual reference). Most AI citations require substantial supporting content.",
      },
      {
        question: "Should I delete thin pages?",
        answer:
          "If they serve no purpose, consolidate them into richer pages and redirect. Don't bulk-delete — 404 errors can cause other AI visibility problems.",
      },
    ],
    internalLinks: [
      { label: "Run a free audit", to: "/app/analyze" },
      { label: "Content depth guide", to: "/signals/content-length" },
      { label: "Heading hierarchy", to: "/signals/heading-hierarchy" },
      { label: "FAQ schema", to: "/signals/faq-schema" },
    ],
    ctaText: "Identify thin pages",
    ctaLink: "/app/analyze",
  },
  {
    slug: "duplicate-content",
    cluster: "problems",
    title: "Duplicate Content Confuses AI Models",
    metaTitle: "Duplicate Content — How It Confuses AI Citations | AiVIS",
    metaDescription:
      "Duplicate content across your site forces AI models to choose between versions, often citing neither. Fix canonicalization for AI visibility.",
    primaryKeyword: "duplicate content ai visibility",
    secondaryKeyword: "canonical urls ai models",
    hook: "When AI models find identical content at multiple URLs, they face a trust decision: which version is authoritative? Often, they cite neither and choose a competitor instead.",
    sections: [
      {
        heading: "How Duplicate Content Affects AI",
        content: [
          "AI models encounter duplicates when the same content appears at multiple URLs (www vs non-www, HTTP vs HTTPS, paginated versions, print-friendly URLs).",
          "When models can't determine the canonical version, they may lower confidence in all versions — reducing your citation likelihood across the board.",
        ],
      },
      {
        heading: "Common Duplicate Content Causes",
        content: [
          "Missing canonical tags: without rel=canonical, every URL variation is treated as a separate page.",
          "CMS-generated duplicates: category pages, tag pages, and archive pages that reproduce full article content.",
          "Staging sites indexed by AI crawlers: your staging environment may be publicly accessible with identical content.",
        ],
      },
      {
        heading: "Fixing Duplicates for AI",
        content: [
          "Implement rel=canonical tags on every page pointing to the authoritative URL. Most CMS platforms support this natively.",
          "Use 301 redirects for URL variations (www/non-www, HTTP/HTTPS) to consolidate to a single canonical domain.",
          "Block staging environments from crawler access via robots.txt and authentication. Don't rely on noindex alone.",
        ],
      },
    ],
    faqs: [
      {
        question: "Does duplicate content penalty apply to AI?",
        answer:
          "AI models don't penalize duplicates like Google. Instead, they become uncertain about which version to cite and may skip your content entirely in favor of unique sources.",
      },
      {
        question: "How do I find duplicate content?",
        answer:
          "Run an AiVIS audit which checks for canonical tags and duplicate signals. Also check Google Search Console for duplicate page issues.",
      },
      {
        question: "Do canonical tags affect AI citations?",
        answer:
          "Yes — canonical tags tell AI crawlers which URL is authoritative. Well-implemented canonicalization improves citation targeting accuracy.",
      },
    ],
    internalLinks: [
      { label: "Run a free audit", to: "/app/analyze" },
      { label: "Canonical URLs guide", to: "/signals/canonical-urls" },
      { label: "Broken internal links", to: "/problems/broken-internal-links" },
      { label: "Missing sitemap", to: "/problems/missing-sitemap" },
    ],
    ctaText: "Find duplicates now",
    ctaLink: "/app/analyze",
  },
  {
    slug: "slow-page-load",
    cluster: "problems",
    title: "Slow Page Load Blocks AI Crawlers",
    metaTitle: "Slow Page Load Kills AI Visibility | AiVIS",
    metaDescription:
      "AI crawlers have strict timeouts. Slow pages get abandoned before content is parsed. Speed up your site for AI visibility.",
    primaryKeyword: "slow page load ai visibility",
    secondaryKeyword: "page speed ai crawlers",
    hook: "AI crawlers have tight timeout windows — typically 5-10 seconds. If your page doesn't deliver readable HTML in time, the crawler moves on and your content is never indexed.",
    sections: [
      {
        heading: "AI Crawler Timeout Behavior",
        content: [
          "Unlike human visitors who wait for pages to load, AI crawlers abort connections after a few seconds. If your server takes 8 seconds to respond, most AI crawlers will have already moved on.",
          "Time to First Byte (TTFB) is the critical metric. AI crawlers measure from request to first HTML response, not total page load completion.",
        ],
      },
      {
        heading: "Common Speed Killers for AI",
        content: [
          "Unoptimized database queries that block HTML generation on the server side.",
          "Large, uncompressed images loaded synchronously before any text content appears.",
          "Third-party scripts that block HTML rendering: analytics, chat widgets, A/B testing tools injected before content.",
        ],
      },
      {
        heading: "Speed Fixes for AI Visibility",
        content: [
          "Optimize your server response to deliver the initial HTML in under 2 seconds. Use caching, CDNs, and efficient database queries.",
          "Defer all non-critical JavaScript and CSS. AI crawlers only need the HTML — ensure it arrives first and contains all essential content.",
          "Run an AiVIS audit to test load time from the perspective of an AI crawler, not a browser with caching and JavaScript execution.",
        ],
      },
    ],
    faqs: [
      {
        question: "How fast does my page need to load for AI?",
        answer:
          "Under 3 seconds TTFB is ideal. Under 5 seconds is acceptable. Over 10 seconds and most AI crawlers will abandon the request.",
      },
      {
        question: "Does page speed affect AI citations?",
        answer:
          "Indirectly — slow pages may not get crawled at all, which means they're never candidates for citations. Speed ensures your content enters the AI index.",
      },
      {
        question: "Do CDNs help with AI visibility?",
        answer:
          "Yes — CDNs reduce TTFB by serving cached content from edge locations. This ensures fast responses regardless of where the AI crawler is located.",
      },
    ],
    internalLinks: [
      { label: "Run a free audit", to: "/app/analyze" },
      { label: "Page speed signals", to: "/signals/page-speed" },
      { label: "JavaScript rendering", to: "/problems/javascript-rendering-blocks-ai" },
      { label: "Why AI can't read my site", to: "/problems/why-ai-cant-read-my-site" },
    ],
    ctaText: "Test your speed",
    ctaLink: "/app/analyze",
  },
  {
    slug: "blocked-by-robots-txt",
    cluster: "problems",
    title: "Blocked by robots.txt — AI Can't Crawl You",
    metaTitle: "robots.txt Blocking AI Crawlers | AiVIS",
    metaDescription:
      "Your robots.txt may be blocking GPTBot, ClaudeBot, and other AI crawlers without you realizing it. Check and fix your crawler rules.",
    primaryKeyword: "robots txt blocking ai",
    secondaryKeyword: "allow gptbot claubot robots txt",
    hook: "One line in your robots.txt can make your entire site invisible to AI models. Many security plugins and default configurations block AI crawlers silently.",
    sections: [
      {
        heading: "AI-Specific User-Agents to Know",
        content: [
          "GPTBot (OpenAI), ClaudeBot (Anthropic), PerplexityBot (Perplexity), Googlebot (Google AI), and others each respect robots.txt rules for their user-agent.",
          "A blanket 'User-agent: * / Disallow: /' blocks everything — including AI crawlers. More targeted blocks may only affect specific models.",
        ],
      },
      {
        heading: "How to Check Your robots.txt",
        content: [
          "Visit yourdomain.com/robots.txt and look for Disallow rules. Check for both wildcard rules (User-agent: *) and AI-specific blocks (User-agent: GPTBot).",
          "Also check for noindex meta tags in your HTML — these tell crawlers to parse but not index, effectively hiding content from AI model training and citation.",
        ],
      },
      {
        heading: "Fixing robots.txt for AI",
        content: [
          "If you want AI visibility, explicitly allow AI crawlers. Add specific Allow rules for GPTBot, ClaudeBot, and PerplexityBot.",
          "Keep blocking admin paths, login pages, and private content. AI visibility doesn't mean opening everything.",
          "After updating robots.txt, run an AiVIS audit to confirm AI crawlers can now reach your key content pages.",
        ],
      },
    ],
    faqs: [
      {
        question: "Should I allow all AI crawlers in robots.txt?",
        answer:
          "Allow the ones you want citations from. For most businesses, allowing GPTBot, ClaudeBot, and PerplexityBot while blocking others based on your data policy works well.",
      },
      {
        question: "Do AI crawlers respect robots.txt?",
        answer:
          "The major AI crawlers (GPTBot, ClaudeBot, PerplexityBot) respect robots.txt. Some smaller or training crawlers may not.",
      },
      {
        question: "Can I block training but allow citations?",
        answer:
          "This is tricky. Currently, there's no standard robots.txt directive that distinguishes training from citation. Some providers support separate user-agents for different purposes.",
      },
    ],
    internalLinks: [
      { label: "Run a free audit", to: "/app/analyze" },
      { label: "robots.txt configuration", to: "/signals/robots-txt" },
      { label: "llms.txt guide", to: "/signals/llms-txt" },
      { label: "Why AI can't read my site", to: "/problems/why-ai-cant-read-my-site" },
    ],
    ctaText: "Check your robots.txt",
    ctaLink: "/app/analyze",
  },
  {
    slug: "no-canonical-urls",
    cluster: "problems",
    title: "No Canonical URLs Set — AI Can't Determine Authority",
    metaTitle: "No Canonical URLs — AI Citation Confusion | AiVIS",
    metaDescription:
      "Without canonical URLs, AI models see duplicates everywhere. Set canonicals to tell AI which page is authoritative.",
    primaryKeyword: "no canonical urls",
    secondaryKeyword: "canonical url ai visibility",
    hook: "Without rel=canonical tags, every URL variation of your content competes for AI attention — and AI models handle competing pages by citing none of them.",
    sections: [
      {
        heading: "Why Canonicals Matter",
        content: [
          "Canonical tags tell AI crawlers which URL is the official version of a page. Without them, AI models must guess — and they often choose the wrong version or skip entirely.",
        ],
      },
      {
        heading: "Common Canonical Issues",
        content: [
          "Self-referencing canonicals pointing to the wrong URL (HTTP instead of HTTPS, trailing slash inconsistency).",
          "Canonical tags missing entirely — especially common on category, tag, and archive pages in CMS platforms.",
          "Canonicals pointing to non-existent pages (404 errors), which tell AI crawlers the authoritative version doesn't exist.",
        ],
      },
      {
        heading: "Implementing Canonicals",
        content: [
          "Add a self-referencing rel=canonical tag to every page. Most CMS platforms do this automatically, but verify it's correct.",
          "For duplicate pages (paginated content, filtered views), point canonicals to the primary version.",
          "Audit canonicals regularly — CMS updates and URL structure changes can break them silently.",
        ],
      },
    ],
    faqs: [
      {
        question: "What is a canonical URL?",
        answer:
          "A canonical URL (rel=canonical) is an HTML tag that tells search engines and AI crawlers which URL is the authoritative version of a page's content.",
      },
      {
        question: "Do AI models use canonical tags?",
        answer:
          "Yes — major AI crawlers respect canonical tags for deduplication and authority determination, similar to how search engines use them.",
      },
      {
        question: "How do I check my canonical tags?",
        answer:
          "View your page source and search for rel=canonical. Or run an AiVIS audit which checks canonical implementation across your site.",
      },
    ],
    internalLinks: [
      { label: "Run a free audit", to: "/app/analyze" },
      { label: "Canonical URLs guide", to: "/signals/canonical-urls" },
      { label: "Duplicate content", to: "/problems/duplicate-content" },
      { label: "Internal linking", to: "/signals/internal-linking" },
    ],
    ctaText: "Check your canonicals",
    ctaLink: "/app/analyze",
  },
  {
    slug: "missing-sitemap",
    cluster: "problems",
    title: "Missing or Broken Sitemap Hurts AI Discovery",
    metaTitle: "Missing Sitemap — AI Crawlers Can't Find Your Pages | AiVIS",
    metaDescription:
      "Without a valid XML sitemap, AI crawlers may miss important pages on your site. Fix your sitemap for better AI discovery.",
    primaryKeyword: "missing sitemap ai",
    secondaryKeyword: "xml sitemap ai visibility",
    hook: "Your XML sitemap is a roadmap for AI crawlers. Without it, they're guessing which pages exist — and they'll miss the ones that matter most.",
    sections: [
      {
        heading: "How AI Crawlers Use Sitemaps",
        content: [
          "AI crawlers check /sitemap.xml to discover the full scope of your site's content. Without it, they rely on following links from your homepage, which often misses deep pages.",
        ],
      },
      {
        heading: "Common Sitemap Problems",
        content: [
          "404 at /sitemap.xml — no sitemap exists at the expected path. CMS auto-generated sitemaps may use different paths.",
          "Stale sitemaps that list deleted or redirected pages, wasting crawler resources on dead ends.",
          "Oversized sitemaps that include admin URLs, tag pages, and search results pages, burying important content.",
        ],
      },
      {
        heading: "Building an AI-Friendly Sitemap",
        content: [
          "Generate a sitemap that includes only your high-value content pages — blog posts, product pages, service pages, and key landing pages.",
          "Include lastmod dates so AI crawlers know when content was updated. Fresh content gets prioritized.",
          "Reference your sitemap in robots.txt with a Sitemap directive so AI crawlers know where to find it.",
        ],
      },
    ],
    faqs: [
      {
        question: "Is a sitemap required for AI visibility?",
        answer:
          "Not technically required, but strongly recommended. Without a sitemap, AI crawlers may not discover pages that aren't linked prominently from your homepage.",
      },
      {
        question: "How often should I update my sitemap?",
        answer:
          "Your sitemap should update automatically whenever you publish or modify content. Most CMS platforms handle this natively.",
      },
      {
        question: "Should my sitemap include every page?",
        answer:
          "No — include only pages you want AI crawlers to find. Exclude admin pages, login forms, search results, and low-value archive pages.",
      },
    ],
    internalLinks: [
      { label: "Run a free audit", to: "/app/analyze" },
      { label: "Sitemap XML guide", to: "/signals/sitemap-xml" },
      { label: "robots.txt guide", to: "/signals/robots-txt" },
      { label: "Content freshness", to: "/signals/content-freshness" },
    ],
    ctaText: "Check your sitemap",
    ctaLink: "/app/analyze",
  },
  {
    slug: "no-llms-txt",
    cluster: "problems",
    title: "No llms.txt File — AI Models Don't Know Your Site",
    metaTitle: "No llms.txt File — Tell AI Models Who You Are | AiVIS",
    metaDescription:
      "The llms.txt standard lets you describe your site directly to AI models. Without it, you're leaving context on the table.",
    primaryKeyword: "no llms txt file",
    secondaryKeyword: "llms txt ai visibility",
    hook: "llms.txt is a new standard that lets you describe your website directly to AI language models. It's the fastest way to add context that AI systems can use for citations.",
    sections: [
      {
        heading: "What is llms.txt?",
        content: [
          "llms.txt is a plaintext file at your domain root (/llms.txt) that describes your site for AI language models. It's like robots.txt, but for context instead of crawl rules.",
          "The file typically includes your site name, description, key content areas, and instructions for how AI models should reference your content.",
        ],
      },
      {
        heading: "Why You Need It",
        content: [
          "Without llms.txt, AI models must infer what your site is about from raw HTML. With it, you provide curated context that improves citation accuracy.",
          "Early adopters of llms.txt report more accurate AI citations because models can quickly verify the site's purpose without parsing every page.",
        ],
      },
      {
        heading: "Creating Your llms.txt",
        content: [
          "Create a plaintext file with your site name, a brief description, key content sections, and any citation preferences.",
          "Host it at yourdomain.com/llms.txt and reference it in your robots.txt. Keep it concise — under 500 words is ideal.",
          "Update it when your site structure or content focus changes. Stale llms.txt can mislead AI models.",
        ],
      },
    ],
    faqs: [
      {
        question: "Is llms.txt an official standard?",
        answer:
          "llms.txt is an emerging standard proposed for AI model communication. It's gaining adoption but is not yet universally supported by all AI systems.",
      },
      {
        question: "Do AI models actually read llms.txt?",
        answer:
          "Some do. The standard is new but growing. Having it in place prepares your site for increasing AI-specific discovery and improves context for models that support it.",
      },
      {
        question: "What should I include in llms.txt?",
        answer:
          "Site name, brief description, primary content categories, key pages, and any attribution preferences. Keep it factual and concise.",
      },
    ],
    internalLinks: [
      { label: "Run a free audit", to: "/app/analyze" },
      { label: "llms.txt guide", to: "/signals/llms-txt" },
      { label: "robots.txt guide", to: "/signals/robots-txt" },
      { label: "Schema.org markup", to: "/signals/schema-org" },
    ],
    ctaText: "Check for llms.txt",
    ctaLink: "/app/analyze",
  },
  {
    slug: "poor-heading-structure",
    cluster: "problems",
    title: "Poor Heading Structure Confuses AI Parsing",
    metaTitle: "Poor H1-H6 Heading Structure — AI Can't Parse Your Content | AiVIS",
    metaDescription:
      "AI models use heading hierarchy to understand content structure. Broken or missing headings make your content harder to cite.",
    primaryKeyword: "poor heading structure ai",
    secondaryKeyword: "heading hierarchy ai visibility",
    hook: "Headings aren't just visual formatting — they're the structural skeleton AI models use to understand, navigate, and cite your content. Broken hierarchy equals broken comprehension.",
    sections: [
      {
        heading: "How AI Uses Headings",
        content: [
          "AI models use H1-H6 tags to build a mental model of your content's structure. The H1 identifies the topic, H2s mark major sections, H3s provide detail. Skip levels or missing tags break this model.",
        ],
      },
      {
        heading: "Common Heading Mistakes",
        content: [
          "Multiple H1 tags on a single page — AI can't determine the primary topic.",
          "Skipping heading levels (H1 → H3, no H2), which signals broken content structure.",
          "Using headings for styling rather than semantics — large bold text that's actually a paragraph, or H3 tags used because they 'look right' visually.",
        ],
      },
      {
        heading: "Fixing Your Heading Structure",
        content: [
          "One H1 per page, clearly stating the primary topic. H2s for major sections, H3s for subsections. Never skip levels.",
          "Ensure headings match their content — an H2 that says 'Our Services' should be followed by sections about your services.",
          "Run an AiVIS audit to see how AI models interpret your heading hierarchy and identify structural issues.",
        ],
      },
    ],
    faqs: [
      {
        question: "Can I have multiple H1 tags?",
        answer:
          "Technically valid in HTML5, but not recommended for AI visibility. A single H1 gives AI models a clear primary topic signal.",
      },
      {
        question: "Do heading styles matter for AI?",
        answer:
          "AI models ignore visual styles — they only see the HTML tag level. An H3 styled to look like an H1 is still an H3 to AI.",
      },
      {
        question: "How deep should my heading hierarchy go?",
        answer:
          "H1 through H3 is sufficient for most pages. Use H4-H6 only when content genuinely has that level of hierarchical depth.",
      },
    ],
    internalLinks: [
      { label: "Run a free audit", to: "/app/analyze" },
      { label: "Heading hierarchy guide", to: "/signals/heading-hierarchy" },
      { label: "Content depth", to: "/signals/content-length" },
      { label: "Thin content problem", to: "/problems/thin-content" },
    ],
    ctaText: "Check your headings",
    ctaLink: "/app/analyze",
  },
  {
    slug: "images-without-alt-text",
    cluster: "problems",
    title: "Images Without Alt Text — Invisible to AI",
    metaTitle: "Images Without Alt Text — AI Can't See Your Visuals | AiVIS",
    metaDescription:
      "AI models rely on alt text to understand images. Missing alt attributes make your visual content completely invisible to AI systems.",
    primaryKeyword: "images without alt text ai",
    secondaryKeyword: "alt text ai visibility",
    hook: "AI models can't see your images — they read your alt text. Without descriptive alt attributes, every image on your site is a black box that AI completely ignores.",
    sections: [
      {
        heading: "Why Alt Text Matters for AI",
        content: [
          "AI language models process text, not pixels. Alt text is the only way they understand what an image shows, why it's relevant, and whether it supports the surrounding content.",
        ],
      },
      {
        heading: "The Impact of Missing Alt Text",
        content: [
          "Images without alt text are invisible to AI models. If your key evidence, charts, infographics, or product photos lack alt text, AI can't incorporate them into answers.",
          "Pages with many images but no alt text may be perceived as thin content by AI models, since the visual information they display can't be processed.",
        ],
      },
      {
        heading: "Writing Effective Alt Text for AI",
        content: [
          "Describe what the image shows factually and specifically. 'Bar chart showing 40% increase in organic traffic from January to June 2025' is better than 'chart'.",
          "Include relevant keywords naturally — alt text is a legitimate optimization signal for both SEO and AI visibility.",
          "Don't use alt text for decorative images — set alt='' (empty string) for purely decorative elements.",
        ],
      },
    ],
    faqs: [
      {
        question: "Do AI models actually read alt text?",
        answer:
          "Yes — AI language models that process web content treat alt text as descriptive content associated with images. Multimodal models may also process the image directly.",
      },
      {
        question: "What makes good alt text for AI?",
        answer:
          "Specific, factual descriptions that convey the image's information value. Include data points for charts, product details for product photos, and context for screenshots.",
      },
      {
        question: "Does decorative image alt text matter?",
        answer:
          "No — decorative images (backgrounds, separators) should have empty alt attributes (alt='') to tell AI models they carry no informational value.",
      },
    ],
    internalLinks: [
      { label: "Run a free audit", to: "/app/analyze" },
      { label: "Alt text guide", to: "/signals/alt-text" },
      { label: "Content depth", to: "/signals/content-length" },
      { label: "Schema.org markup", to: "/signals/schema-org" },
    ],
    ctaText: "Find missing alt text",
    ctaLink: "/app/analyze",
  },
  {
    slug: "no-author-attribution",
    cluster: "problems",
    title: "No Author Attribution — AI Can't Verify Your Expertise",
    metaTitle: "No Author Attribution — Why AI Won't Cite Unattributed Content | AiVIS",
    metaDescription:
      "Content without author attribution lacks the trust signal AI models need for citations. Add author schema and bylines for AI visibility.",
    primaryKeyword: "no author attribution ai",
    secondaryKeyword: "author schema ai visibility",
    hook: "AI models prioritize content from verified authors. Pages without bylines, author schema, or entity links are treated as anonymous — and anonymous content gets fewer citations.",
    sections: [
      {
        heading: "Why Author Identity Matters",
        content: [
          "AI models assess content trustworthiness partly through author attribution. Named, verifiable authors signal editorial responsibility and expertise.",
          "This maps to Google's E-E-A-T framework (Experience, Expertise, Authoritativeness, Trust) which AI models also factor into citation decisions.",
        ],
      },
      {
        heading: "What Good Attribution Looks Like",
        content: [
          "A visible byline with the author's name linked to an author page.", "Author page with bio, credentials, and links to other published work.",
          "Person schema (JSON-LD) connecting the author entity to the content, with name, url, and sameAs properties linking to social profiles.",
        ],
      },
      {
        heading: "Adding Author Attribution",
        content: [
          "Add a byline component to your blog/article template. Link the author name to a dedicated author page.",
          "Add Person schema in JSON-LD to every authored page, connecting the person to the Article schema via the author property.",
          "Ensure author pages are indexable and contain enough information for AI models to verify the person's credentials.",
        ],
      },
    ],
    faqs: [
      {
        question: "Does anonymous content get cited by AI?",
        answer:
          "Less frequently. AI models use author attribution as a trust signal. Anonymous content from unknown publishers is deprioritized in citation ranking.",
      },
      {
        question: "What schema do I need for authors?",
        answer:
          "Use Person schema with name, url (author page), and sameAs (social profiles). Connect it to Article schema via the author property.",
      },
      {
        question: "Do social profiles help AI visibility?",
        answer:
          "Yes — sameAs links in Person schema help AI models verify author identity across platforms, strengthening the trust signal.",
      },
    ],
    internalLinks: [
      { label: "Run a free audit", to: "/app/analyze" },
      { label: "Author entity guide", to: "/signals/author-entity" },
      { label: "Trust signals", to: "/signals/trust-signals" },
      { label: "Schema.org markup", to: "/signals/schema-org" },
    ],
    ctaText: "Check your attribution",
    ctaLink: "/app/analyze",
  },
  {
    slug: "missing-faq-schema",
    cluster: "problems",
    title: "Missing FAQ Schema — Your Q&A Is Invisible to AI",
    metaTitle: "Missing FAQ Schema — AI Can't Find Your Answers | AiVIS",
    metaDescription:
      "You have FAQ content on your pages but no FAQ schema markup. AI models can't identify Q&A sections without structured data.",
    primaryKeyword: "missing faq schema",
    secondaryKeyword: "faq schema ai visibility",
    hook: "Your site has Q&A content — but without FAQ schema, AI models see it as regular paragraphs. FAQ markup is one of the highest-impact signals for AI answer inclusion.",
    sections: [
      {
        heading: "Why FAQ Schema Has High Impact",
        content: [
          "FAQ schema explicitly tells AI models 'this is a question and this is its answer.' Without it, AI must infer Q&A structure from headings and formatting — an unreliable process.",
          "Pages with FAQ schema are significantly more likely to appear in AI-generated featured answers and citation panels.",
        ],
      },
      {
        heading: "Adding FAQ Schema",
        content: [
          "Wrap your Q&A content in FAQPage JSON-LD schema. Each question-answer pair becomes a mainEntity with Question type and acceptedAnswer.",
          "The FAQ schema should match visible on-page content. Don't add FAQ schema for questions that aren't visible to users — this is considered misleading.",
        ],
      },
      {
        heading: "FAQ Best Practices for AI",
        content: [
          "Write questions in natural language matching how people actually ask. 'How do I add JSON-LD?' instead of 'JSON-LD Implementation Guide'.",
          "Keep answers concise but complete — 2-4 sentences that directly answer the question. AI models prefer extractable, self-contained answers.",
          "Add FAQ sections to every content page where questions naturally arise. Product pages, service pages, and how-to guides all benefit.",
        ],
      },
    ],
    faqs: [
      {
        question: "How many FAQs should I add per page?",
        answer:
          "3-8 FAQs per page is ideal. Enough to provide value without overwhelming the content. Each should be genuinely useful to your audience.",
      },
      {
        question: "Does FAQ schema guarantee AI answer placement?",
        answer:
          "No, but it significantly increases your odds. FAQ schema is one of the strongest signals for AI answer inclusion, especially for direct-answer queries.",
      },
      {
        question: "Can I use FAQ schema on non-FAQ pages?",
        answer:
          "Yes, as long as the Q&A content is visible on the page. Many product pages, service pages, and blog posts naturally contain FAQ-worthy content.",
      },
    ],
    internalLinks: [
      { label: "Run a free audit", to: "/app/analyze" },
      { label: "FAQ schema guide", to: "/signals/faq-schema" },
      { label: "JSON-LD guide", to: "/signals/json-ld" },
      { label: "No schema markup", to: "/problems/no-schema-markup" },
    ],
    ctaText: "Check your FAQ schema",
    ctaLink: "/app/analyze",
  },
  {
    slug: "broken-internal-links",
    cluster: "problems",
    title: "Broken Internal Links Hurt AI Crawling",
    metaTitle: "Broken Internal Links — AI Crawlers Hit Dead Ends | AiVIS",
    metaDescription:
      "Broken internal links prevent AI crawlers from discovering important content. Fix broken links to improve AI site coverage.",
    primaryKeyword: "broken internal links ai",
    secondaryKeyword: "internal links ai visibility",
    hook: "AI crawlers navigate your site by following links. Every broken link is a dead end that prevents discovery of the content behind it.",
    sections: [
      {
        heading: "How Broken Links Affect AI",
        content: [
          "AI crawlers follow internal links to discover pages beyond your homepage and sitemap. Broken links (404, 500 errors) stop this discovery process dead.",
          "A chain of broken links can make entire sections of your site unreachable to AI crawlers, even if those pages are perfectly healthy.",
        ],
      },
      {
        heading: "Finding Broken Links",
        content: [
          "Run an AiVIS audit to identify pages that return errors when AI crawlers follow internal links.",
          "Check for links to deleted pages, renamed URLs without redirects, and hardcoded URLs that changed during site updates.",
        ],
      },
      {
        heading: "Fixing the Problem",
        content: [
          "Implement 301 redirects for any page that moved to a new URL. Never delete a page without redirecting its old URL.",
          "Audit internal links regularly, especially after CMS updates, URL restructuring, or content migrations.",
          "Use relative links where possible to avoid domain-change breakage.",
        ],
      },
    ],
    faqs: [
      {
        question: "Do broken links affect AI visibility?",
        answer:
          "Yes — broken links prevent AI crawlers from reaching content, reducing the total number of pages available for citation.",
      },
      {
        question: "How do I find all broken links on my site?",
        answer:
          "Run an AiVIS audit which checks link health, or use a dedicated crawler tool to scan your entire site for 404 and 500 response codes.",
      },
      {
        question: "Should I use 301 or 302 redirects?",
        answer:
          "Use 301 (permanent) redirects for moved content. 302 (temporary) redirects are for truly temporary moves — AI crawlers may not follow them consistently.",
      },
    ],
    internalLinks: [
      { label: "Run a free audit", to: "/app/analyze" },
      { label: "Internal linking guide", to: "/signals/internal-linking" },
      { label: "Missing sitemap", to: "/problems/missing-sitemap" },
      { label: "Canonical URLs guide", to: "/signals/canonical-urls" },
    ],
    ctaText: "Find broken links",
    ctaLink: "/app/analyze",
  },
  {
    slug: "no-hreflang-tags",
    cluster: "problems",
    title: "No Hreflang Tags — AI Can't Route Multi-Language Content",
    metaTitle: "No Hreflang Tags — AI Language Mismatch | AiVIS",
    metaDescription:
      "Without hreflang tags, AI models may cite the wrong language version of your content. Fix hreflang for multilingual AI visibility.",
    primaryKeyword: "no hreflang tags ai",
    secondaryKeyword: "hreflang ai visibility multilingual",
    hook: "If your site serves content in multiple languages, missing hreflang tags mean AI models can't determine which version to cite — often serving the wrong language to users.",
    sections: [
      {
        heading: "Hreflang and AI Routing",
        content: [
          "Hreflang tags tell AI crawlers that multiple language versions of a page exist and which version serves which audience. Without them, AI may cite your French page for English queries.",
        ],
      },
      {
        heading: "Common Hreflang Problems",
        content: [
          "Missing hreflang entirely — AI crawlers see all language versions as competing pages rather than coordinated translations.",
          "Incorrect language codes or region conflicts that misdirect crawlers.",
          "Non-reciprocal hreflang: page A points to page B, but page B doesn't point back to page A.",
        ],
      },
      {
        heading: "Implementing Hreflang for AI",
        content: [
          "Add hreflang link tags in the <head> of every page that has language alternatives. Each page must reference all other versions, including itself.",
          "Include an x-default hreflang for your primary/default language version.",
          "Validate with an AiVIS audit to ensure all hreflang relationships are reciprocal and correctly formatted.",
        ],
      },
    ],
    faqs: [
      {
        question: "Do I need hreflang for a single-language site?",
        answer:
          "No — hreflang is only necessary if you serve content in multiple languages or target different regions with similar language content.",
      },
      {
        question: "Do AI models use hreflang?",
        answer:
          "Yes — AI crawlers use hreflang to determine which language version to index and cite for language-specific queries.",
      },
      {
        question: "What is x-default hreflang?",
        answer:
          "x-default specifies the fallback page for users whose language doesn't match any specific hreflang variant. It's essential for multi-language sites.",
      },
    ],
    internalLinks: [
      { label: "Run a free audit", to: "/app/analyze" },
      { label: "Hreflang guide", to: "/signals/hreflang" },
      { label: "Canonical URLs", to: "/signals/canonical-urls" },
      { label: "Duplicate content", to: "/problems/duplicate-content" },
    ],
    ctaText: "Check your hreflang",
    ctaLink: "/app/analyze",
  },
  {
    slug: "ai-hallucinating-about-my-brand",
    cluster: "problems",
    title: "AI Is Hallucinating About My Brand",
    metaTitle: "AI Hallucinating About Your Brand — How to Fix It | AiVIS",
    metaDescription:
      "AI models generating false information about your brand? Learn why hallucinations happen and how to provide corrective structured data.",
    primaryKeyword: "ai hallucinating about my brand",
    secondaryKeyword: "ai brand misinformation fix",
    hook: "When AI models don't have reliable data about your brand, they fill gaps with plausible-sounding fiction. This isn't malice — it's the inevitable result of insufficient structured data.",
    sections: [
      {
        heading: "Why AI Hallucinations Happen",
        content: [
          "AI language models generate text by predicting likely next tokens. When they lack specific data about your brand, they extrapolate from patterns in their training data — creating plausible but false information.",
          "Common hallucinations include wrong founding dates, incorrect product descriptions, fabricated reviews, and misattributed features from competitor products.",
        ],
      },
      {
        heading: "How Structured Data Prevents Hallucinations",
        content: [
          "Comprehensive Organization schema gives AI models verified brand facts: name, founding date, CEO, address, products, description.",
          "Product schema provides accurate pricing, features, and specifications that anchor AI responses in real data.",
          "FAQ schema pre-answers common questions with your approved language, reducing the need for AI to generate its own (potentially wrong) answers.",
        ],
      },
      {
        heading: "Corrective Actions",
        content: [
          "Add comprehensive Organization and Brand schema to your homepage with every verifiable fact about your company.",
          "Create a detailed llms.txt file that provides curated, accurate context about your brand for AI models.",
          "Publish authoritative content on your own site answering the questions AI models commonly get wrong about your brand.",
          "Monitor AI responses about your brand with AiVIS citation testing to catch hallucinations early.",
        ],
      },
    ],
    faqs: [
      {
        question: "Can I stop AI from hallucinating about my brand?",
        answer:
          "You can significantly reduce it by providing comprehensive, machine-readable data. More structured data = less room for AI to guess = fewer hallucinations.",
      },
      {
        question: "How do I find AI hallucinations about my brand?",
        answer:
          "Use AiVIS's citation testing feature to ask AI models about your brand and compare their responses to your actual information.",
      },
      {
        question: "Should I contact AI providers about wrong information?",
        answer:
          "You can — some providers have correction channels. But the most effective approach is providing better source data through structured markup and authoritative content.",
      },
    ],
    internalLinks: [
      { label: "Run a free audit", to: "/app/analyze" },
      { label: "Citation testing", to: "/app/citations" },
      { label: "llms.txt guide", to: "/signals/llms-txt" },
      { label: "Trust signals", to: "/signals/trust-signals" },
    ],
    ctaText: "Test AI responses about your brand",
    ctaLink: "/app/citations",
  },
];
