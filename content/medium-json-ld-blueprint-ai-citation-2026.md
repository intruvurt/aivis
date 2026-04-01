# The JSON-LD Blueprint That Gets Your Website Cited by AI Models in 2026

**Platform:** Medium (The Startup publication), DEV.to, Hashnode  
**Author:** intruvurt  
**Tags:** JavaScript, JSON, SEO, AI, Web Development, Structured Data, Schema, LLM, Machine Learning  
**Subtitle/Hook:** The single most impactful technical change you can make to your website's citation readiness takes 45 minutes and requires zero framework changes. Here's the exact code.  
**Estimated read time:** 13 min  

---

I want to start with a statement that I can back up with data: the websites most likely to get cited by ChatGPT, Perplexity, Claude, and Google AI Overview in 2026 are not the ones with the most backlinks, the fastest load times, or the most content.

They're the ones with the clearest machine-readable identity declarations.

Specifically: well-formed JSON-LD schema markup.

After running AI visibility audits on hundreds of websites through [AiVIS](https://aivis.biz), I've found that JSON-LD quality is the single highest-leverage technical signal that determines citation eligibility. A site with mediocre content but excellent schema will consistently outperform a site with excellent content and mediocre or missing schema.

This post is going to give you the exact JSON-LD templates I've seen perform best, explain *why* each property matters to AI inference pipelines, and walk you through how to validate what you've built.

Let me be direct: this is not about SEO. This is about making your website legible to machines that are not Googlebot.

---

## Why JSON-LD Is Different From On-Page SEO

To understand why this matters, you need to understand how AI models retrieve and evaluate sources.

**Claude** processes HTML documents. It converts them to a markdown-like internal representation. It cannot execute JavaScript and it cannot see content that's loaded dynamically. What it *can* parse — reliably, consistently — is the raw content of `<script type="application/ld+json">` tags, because these are static strings embedded directly in the HTML source.

**ChatGPT** relies heavily on Bing's index for real-time web content. Bing's structured data parser extracts JSON-LD from pages and stores it in knowledge graph entries alongside the page content. When an entity or page is queried, Bing returns both the prose content and the structured data. ChatGPT has access to both. The schema data helps resolve entity ambiguity — meaning it helps the model confirm that "Acme Corp the accounting firm" and "Acme Corp" in a Reddit thread are the same entity.

**Perplexity** crawls with a Chromium-based renderer but prioritizes static HTML for speed. It uses structured data to classify source types. A page with `@type: FAQPage` gets treated differently by Perplexity's synthesis pipeline than a page with no schema — the former is flagged as a structured Q&A source and its question-answer pairs are candidates for direct answer extraction.

**Google AI Overview** has the most sophisticated schema processing of the four, inheriting years of Google's structured data investment. Schema in Google's context is almost a direct signal into AI answer construction. Pages with valid, complete structured data are more likely to be selected as sources because the model has high confidence about what kind of content it's dealing with.

In all four cases: schema reduces ambiguity. Reduced ambiguity increases citation probability.

---

## The Entity Declaration: Your Most Important Schema Block

Every page on your site that you want cited should have an Organization or Person entity declaration. This is the foundation everything else builds on.

### For businesses and SaaS products:

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Your Company Name",
  "alternateName": "YCN",
  "url": "https://yourdomain.com",
  "logo": {
    "@type": "ImageObject",
    "url": "https://yourdomain.com/logo.png",
    "width": 400,
    "height": 120
  },
  "description": "One precise sentence about what the company does and who it serves.",
  "foundingDate": "2022",
  "sameAs": [
    "https://linkedin.com/company/yourcompany",
    "https://twitter.com/yourhandle",
    "https://github.com/yourorg",
    "https://news.ycombinator.com/from?site=yourdomain.com"
  ],
  "contactPoint": {
    "@type": "ContactPoint",
    "contactType": "customer support",
    "availableLanguage": "English",
    "contactOption": "TollFree"
  },
  "knowsAbout": [
    "AI visibility",
    "structured data",
    "machine legibility",
    "citation readiness"
  ]
}
```

**Why each property matters:**

`alternateName` — Helps models resolve abbreviated references. If people refer to you as "YCN" anywhere on the web, this property connects the abbreviation to the full entity.

`sameAs` array — This is identity verification across the open web. Every entry is a cross-reference point that AI models use to confirm your entity is real and active. Minimum 2. Optimally 4-5. Include platforms where you're actually active—a dead Twitter with no posts since 2020 is noise.

`knowsAbout` — Declares your topical authority explicitly. Models use this to determine relevance during query matching. If your `knowsAbout` array includes the same terminology a user's query uses, your entity gets scored higher for relevance.

`foundingDate` — Signals entity age. AI models weight established entities more than recently-created ones for trust scoring. A company founded in 2019 has more implicit trust than one founded in 2026, especially for financial or health topics.

---

## Article Schema for Blog Posts and Editorial Content

Every blog post, guide, or editorial piece you want cited needs Article or BlogPosting schema on its individual page. Do not rely on homepage schema for article-level citations.

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Your Exact Article Title Here",
  "description": "Two to three sentence summary of what this article covers and who it's for.",
  "url": "https://yourdomain.com/blog/your-article-slug",
  "datePublished": "2026-01-15",
  "dateModified": "2026-03-01",
  "author": {
    "@type": "Person",
    "name": "Author Full Name",
    "url": "https://yourdomain.com/about/author-name",
    "sameAs": [
      "https://linkedin.com/in/authorhandle",
      "https://twitter.com/authorhandle"
    ]
  },
  "publisher": {
    "@type": "Organization",
    "name": "Your Company Name",
    "logo": {
      "@type": "ImageObject",
      "url": "https://yourdomain.com/logo.png"
    }
  },
  "image": {
    "@type": "ImageObject",
    "url": "https://yourdomain.com/blog/your-article-hero-image.jpg",
    "width": 1200,
    "height": 630
  },
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "https://yourdomain.com/blog/your-article-slug"
  },
  "articleSection": "AI Visibility",
  "keywords": ["AI citation", "structured data", "LLM optimization", "schema markup"],
  "wordCount": 1850
}
```

**Critical properties for AI citation specifically:**

`dateModified` — Never omit this. AI models weight content freshness. A `datePublished` without a `dateModified` signals that the content has never been updated since it was originally posted. For fast-moving topics, this tanks your citation probability. Even minor content updates should trigger a `dateModified` update.

`author.sameAs` — Author identity verification is how AI models score expertise claims. Claude specifically uses author entity data to evaluate whether a source is trustworthy for YMYL (Your Money or Your Life) topics — health, finance, legal, major decisions. A named author linked to a verifiable LinkedIn profile carries significantly more trust weight than an anonymous post.

`wordCount` — Yes, declare it explicitly. AI models checking content depth use this as a quick sufficiency signal. A declared `wordCount: 350` tells the model upfront that this is a thin piece. A declared `wordCount: 2100` signals depth without requiring the model to count.

`articleSection` — Maps your content to a topical category. Helps models file your content correctly in their internal relevance ranking.

---

## FAQPage Schema: The Citation Machine

I've saved this one for its own section because FAQPage schema is the highest citation-density markup type available.

When Perplexity processes a query, its answer synthesis pipeline specifically looks for structured Q&A pairs. FAQPage schema is a declaration that says: *this page contains a collection of question-answer pairs on a defined topic*. This is structurally identical to how AI models process queries. A user asks a question. The model synthesizes an answer. If your FAQ has the question the user asked, your page is a near-exact match for citation.

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is the most important technical factor for AI citation readiness?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "JSON-LD structured data, specifically Organization schema with sameAs identity verification and Article or FAQPage markup on content pages. Without entity declaration schema, AI models cannot reliably identify and trust your site as a citation source."
      }
    },
    {
      "@type": "Question",
      "name": "How do I check if my website is blocking AI crawlers?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Check your robots.txt file at yourdomain.com/robots.txt and look for User-agent entries for GPTBot, ClaudeBot, PerplexityBot, and CCBot. If any of these have a Disallow: / rule, that crawler cannot access your content. Use the AiVIS Robots Checker at aivis.biz/tools/robots-checker for a graded assessment."
      }
    },
    {
      "@type": "Question",
      "name": "Does Core Web Vitals performance affect AI citation?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Minimally. AI models don't score LCP or CLS. Page load time only becomes a factor when response time exceeds 5-6 seconds, at which point crawlers may time out. Below that threshold, PageSpeed scores have no meaningful correlation with AI visibility scores."
      }
    }
  ]
}
```

**Implementation rules:**

- Keep answers between 40-160 words. Long enough to be substantive. Short enough that the full answer can be extracted as a snippet.
- Write answers as complete, standalone statements. The answer to "How do I X?" should be fully comprehensible without reading the question.
- Use 5-10 Q&A pairs per page minimum. Under 5 is sparse. Over 15 starts adding noise.
- The questions you include should be real questions your audience actually asks — pull from customer support emails, sales call notes, Reddit threads, and "People also ask" boxes.

---

## Product/Service Schema for SaaS and B2B Pages

If you're running a SaaS product or a B2B service, your pricing and features pages need schema that declares what you offer, who it's for, and how much it costs.

```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Your Product Name",
  "url": "https://yourdomain.com",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Web",
  "description": "What your product does in 2-3 sentences. Be specific about the problem it solves and who it solves it for.",
  "offers": {
    "@type": "Offer",
    "name": "Starter Plan",
    "description": "Basic feature set for individual users",
    "price": "49.00",
    "priceCurrency": "USD",
    "priceSpecification": {
      "@type": "UnitPriceSpecification",
      "price": "49.00",
      "priceCurrency": "USD",
      "unitText": "MONTH"
    },
    "availability": "https://schema.org/InStock"
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.7",
    "reviewCount": "128",
    "bestRating": "5",
    "worstRating": "1"
  },
  "creator": {
    "@type": "Organization",
    "name": "Your Company Name",
    "url": "https://yourdomain.com"
  }
}
```

The `aggregateRating` property is especially important if you have genuine reviews anywhere. AI models use rating data as a proxy trust signal — a product with 128 verified reviews is more legitimate than one with none, even if the product quality is identical. Pull your Trustpilot, G2, or Product Hunt aggregate rating and declare it here. Keep it current — stale or inaccurate review data that contradicts what's on third-party review platforms will damage trust rather than build it.

---

## The llms.txt File: The Missing Piece Most Sites Haven't Added

This is emerging infrastructure and worth setting up now rather than waiting.

`llms.txt` is a proposed standard (analogous to `robots.txt`) that lets you declare AI-specific crawl guidelines and provide a curated map of your content for LLM processing. You host it at `yourdomain.com/llms.txt`.

The basic format:

```
# Company Name

> A one-sentence description of what your site is and who it's for.

## Core Content
- [Product Overview](https://yourdomain.com/product): Main product description
- [Pricing](https://yourdomain.com/pricing): Current plans and pricing
- [How It Works](https://yourdomain.com/how-it-works): Technical methodology
- [Documentation](https://docs.yourdomain.com): Full technical documentation
- [Case Studies](https://yourdomain.com/case-studies): Customer results

## Blog / Articles
- [Getting Started Guide](https://yourdomain.com/blog/getting-started): Beginner guide
- [Best Practices](https://yourdomain.com/blog/best-practices): Advanced usage patterns

## Optional
- [API Reference](https://docs.yourdomain.com/api): Developer API documentation
```

Perplexity and some Anthropic crawlers are already actively checking for `llms.txt` as a navigation aid. Sites that have it provide a pre-curated list of their most important pages, helping crawlers prioritize high-value content over boilerplate and navigation pages.

Implementation: Create the file, host it at the root of your domain, and declare its existence in your Organization schema with a `url` property pointing to it. Then add it to your sitemap.

---

## Validating What You've Built

Never assume your schema is working correctly after implementation. Schema bugs are silent — they don't throw errors or break anything. They just fail to be parsed.

**Google Rich Results Test** — the canonical validator. Paste your URL or raw JSON-LD and it will flag invalid properties, missing required fields, and deprecation warnings. Use this for every schema type except FAQPage, where Google has reduced their rich result surface.

**Schema.org Validator** — schema.org/validator — validates against the full Schema.org vocabulary, which is broader than what Google enforces. Catches issues that Google's tool misses.

**AiVIS Schema Validator** — [aivis.biz/tools/schema-validator](https://aivis.biz/tools/schema-validator) — validates JSON-LD but also checks Open Graph, Twitter Card, and Microdata simultaneously in one pass. Specifically tests for the properties AI citation pipelines care about, not just what Google surfaces. Free, no account.

**Browser DevTools quick check** — In Chrome, go to your page, open DevTools, go to Elements, and search for `application/ld+json`. You should see your JSON-LD blocks as static script tags. If you don't see them — if your schema is being injected by JavaScript after page load — Claude and other non-JS-executing scrapers cannot see it. Inline it in your server-rendered HTML.

---

## The Implementation Priority Order

If you're starting from scratch or auditing a site that has no schema currently, here's the order to implement:

1. **Organization schema** on every page (global include via your layout/template)
2. **llms.txt** at your domain root
3. **Article schema** on every blog post, guide, and editorial piece
4. **FAQPage schema** on your most-visited service/product/docs pages
5. **SoftwareApplication or Product schema** on your pricing/features pages
6. **BreadcrumbList schema** on all pages beyond 1 level deep

The first two take an evening. Steps 3-5 take a week of systematic page-by-page work if you have 20-50 pages. Step 6 is usually handled by a few lines in your CMS or static site generator.

After implementation, run a full AI visibility audit to see where your score lands and what else is flagged. The schema is one layer. Crawler access, content depth, heading structure, and page performance compose the rest of the picture.

Full audit at [aivis.biz/analyze](https://aivis.biz/analyze). Observer tier is free with 10 audits. Schema implementation questions welcome in the comments.
