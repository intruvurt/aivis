# Why AI Models Skip Your Website (And the 28-Rule Framework That Fixes It)

**Platform:** Medium  
**Author:** intruvurt  
**Publication tags:** Artificial Intelligence, SEO, Web Development, Machine Learning, Content Strategy  
**Subtitle/Hook:** Your site might rank on Google. But ChatGPT, Perplexity, and Claude don't use Google rankings to decide who gets cited. Here's what they actually check.  
**Topics:** AI visibility scoring, SSFR framework, structured data, citation mechanics, machine legibility  
**Estimated read time:** 11 min  

---

I spent the last year studying how AI answer engines decide which websites to cite. Not how Google ranks pages. How ChatGPT, Perplexity, Claude, and Google AI Overview pick the 3-5 sources they synthesize into an answer.

The answer is uncomfortable for most website owners: these models don't care about your keyword density, your backlink profile, or your domain authority score. They care about whether your page is machine-legible. Whether the structure of your content, your metadata, your schema markup, and your technical setup make it possible for an inference pipeline to parse, trust, and attribute your site in under 200 milliseconds.

Most websites fail that test. Not because the content is bad, but because the structural signals AI models need don't exist on the page.

So I built a scoring framework to measure exactly that. It runs on [AiVIS](https://aivis.biz/analyze), and it evaluates 28 deterministic rules across 4 categories. No vibes. No AI guessing about AI. Hard structural checks with pass/fail outcomes.

Let me walk you through how it actually works.

---

## The Problem with Traditional SEO Metrics

Here's what most people don't realize: AI models don't crawl the web the way Googlebot does.

Perplexity runs real-time web crawls with semantic similarity matching. It fetches your page, converts it to clean text, and scores how well the content answers the user's query. It doesn't care about your PageRank.

Claude processes server-rendered HTML converted to markdown. It doesn't execute JavaScript at all. If your content requires client-side rendering to be visible, Claude literally cannot see it.

ChatGPT relies heavily on Bing index data and entity resolution. If Bing doesn't understand what your site is about, ChatGPT won't cite you.

Google AI Overview pulls from 3-5 diverse sources and weighs E-E-A-T signals. But it's synthesizing answers, not listing blue links. The selection criteria are fundamentally different from organic search ranking.

Traditional SEO tools measure the wrong thing for this new reality. Domain authority doesn't predict AI citation. Keyword rankings don't predict AI citation. The only thing that predicts AI citation is whether your page is structurally readable, semantically clear, and trust-verified at the markup level.

That's what the SSFR framework measures.

---

## What SSFR Actually Stands For

SSFR = Source, Signal, Fact, Relationship.

These are the four families of structural checks that determine whether an AI model can extract, trust, and cite your content. Each family contains 7-8 individual rules, totaling 28 checks per audit. Every rule is deterministic. There's no model inference involved in the scoring itself. The system scrapes your page and checks whether specific structural elements exist, are properly formatted, and meet minimum thresholds.

Here's the breakdown.

### SOURCE (8 rules)

Source rules answer one question: can an AI model identify who you are and whether you're a legitimate entity?

The most critical check is Organization or LocalBusiness schema. If your page doesn't have JSON-LD that declares what kind of entity you are, AI models have to guess. And when they guess, they usually skip you entirely. This is a hard blocker in SSFR. If you fail it, your score caps at 75 no matter what else you do right.

Other Source checks include: SameAs social links (at least 2 connected profiles that verify your entity across platforms), author entity in schema (so AI knows who wrote the content), canonical URL declared (so crawlers don't split your identity across duplicate pages), robots.txt accessibility (hard blocker, caps at 80 if missing), AI crawler access (if you're blocking GPTBot, ClaudeBot, or PerplexityBot, your score caps at 60), and llms.txt presence (the emerging standard for declaring AI-specific crawl policies).

You can check your AI crawler access for free right now using the [AiVIS Robots Checker](https://aivis.biz/tools/robots-checker). It detects GPTBot, ClaudeBot, PerplexityBot, CCBot, Anthropic, and others. Letter grade, A through F, no login required.

### SIGNAL (8 rules)

Signal rules check whether your page communicates its topic clearly through standard HTML metadata.

Title tag between 20-70 characters is a hard blocker (caps at 70 if missing). Meta description must exist. Open Graph tags need to be complete (title, description, image) so social previews and AI summaries have clean data to pull. JSON-LD must be present with at least one block (hard blocker, caps at 75). Exactly one H1 tag. Proper heading hierarchy (H1 to H2 to H3, not jumping levels). Sitemap.xml present and accessible. Language attribute declared on the HTML element.

These are table stakes. But you'd be amazed how many production sites fail 3 or 4 of these simultaneously. The [AiVIS Schema Validator](https://aivis.biz/tools/schema-validator) checks JSON-LD, Open Graph, Twitter Cards, and Microdata in one pass. Free, no account needed.

### FACT (7 rules)

Fact rules measure whether your content has enough substance and structure for an AI model to extract meaningful answers.

Content must be at least 800 words. That's a hard blocker (caps at 65 if under). You need at least 3 question-format headings (these are the exact structures AI models use for featured-answer extraction). A TL;DR or summary block helps models identify your key claims quickly. Image alt text coverage needs to be at least 90%. At least 3 internal links (proving your site has depth). At least 2 external links (proving your content references authoritative sources, which AI models interpret as a trust signal).

The word count requirement isn't arbitrary. AI models processing content for citation need enough text to confirm topical depth. Thin pages get classified as supplementary, not authoritative.

Test your content structure with the free [AiVIS Content Extractability Tool](https://aivis.biz/tools/content-extractability). It grades your heading hierarchy, list usage, code blocks, and content density on the same A-F scale.

### RELATIONSHIP (5 rules)

Relationship rules check whether your page connects to a broader trust network.

Multiple schema types (at least 3) prove your page describes a rich entity graph, not just a flat article. Balanced internal-to-external link ratio (at least 0.15) shows you're part of a web of references, not an isolated page. Page LCP under 2500ms (Core Web Vital) because slow pages get deprioritized by crawlers that run on time budgets. No critical contradictions in your structured data. GEO source verification passed (your geographic and entity claims are consistent).

---

## How Scoring Works

Every rule either passes or fails. There are no partial scores at the rule level.

Each rule also has a weight. Some rules are hard blockers, meaning if you fail them, your total score is capped regardless of everything else. The caps stack: if you fail AI crawler access (cap 60) and Organization schema (cap 75), your effective ceiling is 60.

Final scores map to letter grades: 80-100 is A (excellent AI visibility), 60-79 is B (good with gaps), 40-59 is C (fair but at risk), 20-39 is D (poor), 0-19 is F (effectively invisible).

The full scoring runs on every audit at [AiVIS](https://aivis.biz/analyze), across all tiers including the free Observer plan (10 scans per month, no credit card).

---

## Why Deterministic Scoring Matters

Here's the thing about using AI to evaluate AI readiness: it's circular. If you ask GPT-4 "is this page optimized for AI models?", you get a probabilistic answer shaped by training data, not by the actual crawl-time behavior of inference pipelines.

SSFR doesn't do that. Every rule checks a concrete structural fact about your page. JSON-LD either exists or it doesn't. Your robots.txt either allows GPTBot or it doesn't. Your heading hierarchy either follows the spec or it doesn't.

The AI models in the [AiVIS pipeline](https://aivis.biz/methodology) are used for content analysis, recommendation generation, and cross-validation. But the score itself is computed deterministically from your page structure. That's what makes it reproducible and auditable. Run the same URL twice, you get the same structural scores (content-based AI recommendations may vary, structural scores won't).

On Signal and Score Fix tiers, the content analysis runs through a [triple-check pipeline](https://aivis.biz/methodology). Three separate AI models (GPT-4o Mini, Claude 3.5 Haiku, and a validation gate) cross-check each other's work. If any stage fails, the system degrades gracefully to the prior stage's output instead of crashing your audit.

---

## What You Can Do Right Now (Free)

Before you spend a dollar, AiVIS gives you three completely free tools. No login. No API keys. No trial period.

**[Schema Validator](https://aivis.biz/tools/schema-validator)** — Paste any URL and get a full JSON-LD, Open Graph, Twitter Card, and Microdata validation with a letter grade.

**[Robots Checker](https://aivis.biz/tools/robots-checker)** — See exactly which AI crawlers your robots.txt allows or blocks. Detects GPTBot, ClaudeBot, PerplexityBot, and more.

**[Content Extractability](https://aivis.biz/tools/content-extractability)** — Grades how easily AI models can extract structured answers from your page content.

These cover the highest-impact SSFR failures I see. Most sites lose 15-25 points on schema and robots issues alone. Fix those first.

---

## When Free Tools Aren't Enough

If you want the full 28-rule SSFR audit with recommendations, the free Observer tier at [AiVIS](https://aivis.biz/pricing) gives you 10 scans a month.

Need more depth? The Alignment tier ($49/month, 60 scans) adds [competitor tracking](https://aivis.biz/competitors) with head-to-head comparisons across schema coverage, content depth, and page speed. It also adds [brand mention tracking](https://aivis.biz/mentions) across 9 free sources (Reddit, Hacker News, Mastodon, DuckDuckGo, Bing, Google News, GitHub, Quora, Product Hunt) and [reverse engineering tools](https://aivis.biz/reverse-engineer) that decompose how AI models think about content in your niche.

Signal tier ($149/month, 110 scans) unlocks the triple-check pipeline, [citation testing](https://aivis.biz/citations) across 3 search engines with AI platform simulation, and API access for programmatic audits.

The point isn't to upsell you. The point is that AI visibility is measurable, and the measurements are structural, not magical. Whether you use the free tools or the full platform, start by understanding what AI models actually see when they look at your site.

Because right now, most of them see nothing.

---

**Run your first audit free at [AiVIS.biz](https://aivis.biz)**
