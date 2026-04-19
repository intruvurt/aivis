# I've Run 500+ AI Visibility Audits on Websites. Here's What Separates Sites ChatGPT Cites From Ones It Ignores.

**Platform:** Reddit  
**Target subs:** r/SEO, r/ChatGPT, r/artificial, r/webdev, r/marketing, r/juststart, r/Entrepreneur  
**Format:** Long self-post (no link in title - link AiVIS.biz in body text naturally)  
**Tone:** First-person builder, data-driven findings, helpful not promotional  
**Estimated read time:** 12 min  

---

I've been building a tool called [AiVIS.biz](https://aivis.biz) for the past year and a half. It audits websites for AI citation readiness - meaning: can ChatGPT, Perplexity, Claude, and Google AI Overview actually parse, trust, and cite your content when someone asks a question your site should answer?

Over that time I've run somewhere north of 500 audits across SaaS products, e-commerce sites, local businesses, personal brands, news outlets, and B2B service pages. I've seen average scores as low as 12 (a well-known DTC brand with a fast, beautiful site that blocks every AI crawler) and as high as 94 (a boring-looking B2B consulting firm with pristine schema, 1,400-word service pages, and every FAQ formatted in Q&A heading pairs).

Here's what I've actually learned from all of it. No theory. Just patterns from running the audits.

---

## Finding 1: The Single Most Common Hard Blocker Is AI Crawler Rejection

I did not expect this going in. I thought the biggest problem would be schema markup or content thinness.

Nope. The most prevalent hard blocker - meaning a structural problem that caps your score at 60 regardless of everything else - is blocking AI crawlers in your robots.txt.

About 34% of sites I've audited are actively blocking at least one major AI crawler. GPTBot (OpenAI's crawler), ClaudeBot (Anthropic), PerplexityBot, or CCBot (Common Crawl, which feeds many AI training pipelines). Sometimes all of them.

The reason this happens is usually one of two things:

1. Someone read an article in 2023 about "blocking AI from stealing your content" and added disallow rules to their robots.txt without thinking through what that means for discoverability.
2. A CDN or security tool (Cloudflare, for example) applied blanket bot blocking rules and nobody noticed the AI crawlers were caught in the net.

Check your own robots.txt right now. Go to yourdomain.com/robots.txt and look for `User-agent: GPTBot`, `User-agent: ClaudeBot`, `User-agent: PerplexityBot`. If they have a `Disallow: /` under them, you are invisible to those models. Period. Those models will never voluntarily crawl you, which means your content is not in their real-time index and won't get cited in time-sensitive answers.

You can check this free using the [AiVIS.biz Robots Checker](https://aivis.biz/tools/robots-checker) - it returns a letter grade (A through F) for each crawler separately. No account needed.

---

## Finding 2: Missing Organization Schema Is the Second Biggest Problem

The second most common hard blocker (caps your score at 75) is not having Organization or LocalBusiness JSON-LD on your page.

This is how AI models identify what kind of entity you are. Without it, they're guessing from context. And when AI models guess about entity type, the default behavior is conservatism - they skip you if there's any uncertainty.

Here's the exact minimum schema that satisfies the check:

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Your Company Name",
  "url": "https://yourdomain.com",
  "logo": "https://yourdomain.com/logo.png",
  "description": "One sentence about what you do.",
  "sameAs": [
    "https://linkedin.com/company/yourcompany",
    "https://twitter.com/yourhandle"
  ]
}
```

The `sameAs` array is critical. This is how AI models verify your entity exists across multiple platforms. Without at least 2 sameAs links pointing to active profiles, the Organization schema is half-useful. With them, the model can cross-reference your identity against its training data and confirm you're a known entity, not a made-up name.

If you're a LocalBusiness, use `@type: LocalBusiness` instead and add `telephone`, `address`, and `areaServed`. Same principle.

Put this in a `<script type="application/ld+json">` tag in your `<head>`. Deploy it sitewide, not just on your homepage.

---

## Finding 3: JavaScript-Rendered Content Doesn't Exist for 2 Out of 4 AI Models

This one is underappreciated and I keep seeing it on React and Next.js sites that don't have proper SSR or SSG configured.

Claude processes HTML. It does not execute JavaScript. If your page content is rendered client-side - meaning the HTML delivery from your server is essentially empty and the content appears after JavaScript runs - Claude literally sees no content.

Perplexity crawls with Chromium-based rendering (it does execute JS), but its parser still favors static, well-structured HTML because dynamic render timing introduces variability.

ChatGPT's Bing-index dependency means you're relying on Bingbot's crawl, and while Bingbot can execute JS, it defers JavaScript rendering and may not fully capture content in deeply async-loaded components.

The pattern I see repeatedly: a Next.js site with `getStaticProps` is fine. A React SPA where content loads from an API call after mount - the main text, the H1, the FAQs - is invisible to Claude and partially invisible to GPT.

Quick test: In Chrome DevTools, disable JavaScript (Settings > Debugger > Disable JavaScript) and reload your page. Whatever text is visible to you now is what Claude sees. If your value proposition, your main content, and your headings are all gone - you have a problem.

---

## Finding 4: Thin Content Traps

Content under 800 words is a soft blocker in the SSFR framework (caps at 65). I see a lot of service pages that are 280-400 words of marketing copy followed by a contact form.

That works fine for Google ads landing pages. It is terrible for AI citation.

AI models need text mass to confirm topical depth. A 320-word page tells the model: this is a teaser, not a source. A 1,200-word page with proper headings, FAQs at the bottom, and structured lists tells the model: this is an authoritative reference.

The fix is not to add fluff. It's to add structured information: expand each service section with "how it works," "who this is for," "common questions," "pricing context," "what's included/excluded." That information is useful to humans AND machines.

One pattern I've seen work very well: add an FAQ section at the bottom of every service or product page. Format the questions as actual H2 or H3 headings that are real questions ("How long does X take?" / "What's included in the Y plan?"). AI models specifically extract these for featured answer synthesis. I've audited sites where adding 5 FAQ headings to an existing page moved their citation score by 8-12 points.

---

## Finding 5: Sites With High Google Scores Have No Correlation With AI Visibility Scores

This is the one that surprises people most when I tell them. I've run the numbers. Domain Authority, Core Web Vitals, Google organic traffic - none of these have meaningful correlation with AI visibility scores in my dataset.

I've audited sites with DA 70+ that score 38 on AI visibility. I've audited DA 12 blogs that score 81 because the author obsesses over structured data and semantic clarity.

The reason: Google's ranking algorithm optimizes for a different signal set. AI models optimize for structural parsability, entity verification, and content extractability. A site with 4,000 backlinks and a thin, JS-heavy homepage is great for Google. It's invisible to Claude.

The two skill sets overlap somewhat (HTTPS, load speed, canonical URLs) but they diverge completely on schema markup, heading structure, content depth, and crawler access policy.

This is the underlying reason I built AiVIS.biz. People were trying to solve an AI visibility problem with SEO tools that don't measure AI visibility. You cannot optimize what you don't measure.

---

## Finding 6: The Pages That Get Cited Are Almost Never Homepages

When I look at which pages on a domain are actually cited in AI answers, it's almost never the homepage. It's the most information-dense, question-answering page they have.

For SaaS tools it's usually a comparison page, a features breakdown, or a use-case page. For B2B services it's a methodology or approach page. For local businesses it's sometimes the About page - if it actually has substantial information about the team, credentials, and process rather than 3 sentences and a stock photo.

The highest-scoring pages I've seen follow the same template:
- **Title tag** between 20-70 characters, clearly states topic + entity
- **One H1** that matches the title intent
- **Logical H2/H3 hierarchy** that doesn't skip levels
- **Content over 1,000 words** organized around specific sub-questions
- **At least one structured list or table** (AI models love list-formatted data for answer synthesis)
- **FAQ section** with real questions as headings
- **JSON-LD with @type = Article or FAQPage** if it's editorial content
- **External links** to authoritative sources (this signals academic/reference behavior, which AI models weight positively)
- **Author entity** declared in schema (especially for YMYL topics)

The homepage is for human visitors and Google. The deep-content pages are where AI citations actually happen.

---

## Finding 7: Page Speed Below ~2s FCP Has Almost No Impact. Above ~5s Does.

I've seen people panic about Core Web Vitals in the context of AI visibility. The data I have doesn't support this concern below a certain threshold.

AI models don't score your LCP or CLS. They fetch your page and parse the HTML. Below about a 5-second response time, I've seen no pattern suggesting faster pages score higher on AI visibility.

Above 5 seconds (or sites that sometimes timeout at 10-15s because of heavy server processing), the crawlers give up and move on. That creates incomplete data and scores drop. But the difference between a 0.8s page and a 2.5s page - irrelevant to AI visibility scores in my dataset.

Stop worrying about Core Web Vitals for AI citation purposes. Worry about whether your content is actually on the page when the crawler arrives.

---

## The 3 Changes That Move Scores the Most

If you can only do 3 things, here's what moves the needle fastest based on actual audit data:

**1. Fix your robots.txt** - Allow GPTBot, ClaudeBot, PerplexityBot. If they're currently blocked, this one change can move your score by 20-30 points immediately because it removes a hard cap.

**2. Add Organization JSON-LD with sameAs** - 20-30 minutes of work. Moves your score 10-15 points if it was missing.

**3. Add FAQ headings to your most important page** - Write 5-8 real questions your customers ask, formatted as H2 or H3 headings with answers in the paragraphs below. This improves your content structure score and creates citation-ready answer fragments.

None of this requires a developer. All three can be done with whatever CMS you're using.

---

## Free Audit Tools You Can Use Right Now

All of these are on AiVIS.biz and require no account:

- **Robots Checker** - [aivis.biz/tools/robots-checker](https://aivis.biz/tools/robots-checker) - graded A through F for each major AI crawler
- **Schema Validator** - [aivis.biz/tools/schema-validator](https://aivis.biz/tools/schema-validator) - checks JSON-LD, Open Graph, Twitter Cards, Microdata
- **Content Extractability** - [aivis.biz/tools/content-extractability](https://aivis.biz/tools/content-extractability) - heading hierarchy, list usage, content density

Full audit with visibility score: [aivis.biz/analyze](https://aivis.biz/analyze) - 3 free scans on the Observer tier, no credit card.

Happy to answer specific questions about results if you run an audit and share it here.
