# I Tracked 9 Free Sources for Brand Mentions and Found Out Where AI Models Actually Pull From

**Platform:** Substack  
**Author:** dobleduche (intruvurt)  
**Newsletter name:** (your existing Substack)  
**Tags:** AI Visibility, Brand Monitoring, SEO, Digital Marketing, Artificial Intelligence  
**Subtitle/Hook:** Reddit, Hacker News, GitHub, Quora, Product Hunt, Mastodon, Google News, DuckDuckGo, Bing. Every one of these feeds AI training data. Here's what happens when you actually monitor all 9.  
**Topics:** Brand mention tracking, AI training data sources, citation authority, reputation monitoring, competitive intelligence  
**Estimated read time:** 10 min  

---

I've been building [AiVIS](https://aivis.biz/analyze) for over a year now and the question I keep getting is: "Where do AI models actually find information about my brand?"

Not where Google finds it. Where ChatGPT, Perplexity, Claude, and Google AI Overview find it.

The answer is more specific than most people expect. These models don't just crawl your website and decide whether to cite you. They pull from a web of third-party sources. Discussion forums. Code repositories. Q&A platforms. News feeds. Social networks. If your brand has organic mentions across these platforms, AI models trust you more. If you don't exist on them, you're a ghost.

So I built a system that monitors all of it. No API keys from you. No paid data providers. 9 free public sources, all scanned in parallel, with deduplication and frequency tracking built in.

Here's what I learned from watching it run across hundreds of brands.

---

## The 9 Sources and Why AI Models Care About Each One

The [AiVIS Brand Mention Tracker](https://aivis.biz/mentions) runs scans across 9 platforms simultaneously. Each one matters for a different reason.

### 1. Reddit

Reddit is probably the single most important third-party signal for AI citation. ChatGPT's training data includes massive Reddit archives. Perplexity actively crawls Reddit threads for real-time answers. When someone asks an AI model "what's the best tool for X" and your brand shows up in Reddit threads with upvotes and genuine discussion, that's a citation-ready signal.

AiVIS queries Reddit's public JSON API to find posts and comments mentioning your brand. It distinguishes between direct promotion (you posting about yourself), organic problem-solving mentions (someone recommending you unprompted), and neutral references.

### 2. Hacker News

HN is smaller than Reddit but disproportionately weighted by AI models because of the technical credibility of its user base. A front-page HN post about your product generates training signal that persists in model weights for years.

AiVIS uses the Algolia-powered HN search API to find stories and discussion threads. If your brand has been discussed on HN, even once, that mention lives in every major model's training corpus.

### 3. GitHub

Code repositories are a massive but underrated AI training source. Every major language model was trained on GitHub data. If your brand has repos, issues, discussions, or README references on GitHub, AI models have internalized that context.

AiVIS hits GitHub's REST search API to find repository-level mentions. This is especially powerful for developer tools, SaaS products, and anything with a technical audience.

### 4. Mastodon

The fediverse is growing and AI models are paying attention. Mastodon's public API on mastodon.social provides real-time access to posts mentioning your brand. It's smaller in volume but the signal-to-noise ratio is high because Mastodon's user base skews informed and deliberate.

### 5. DuckDuckGo Dork

This is a web-wide sweep. AiVIS runs a `"your brand" -site:yourdomain.com` dork through DuckDuckGo HTML search. The `-site:` exclusion filters out your own pages, leaving only third-party mentions. Every result is a page where someone else is talking about you.

This catches blog posts, forum threads, review sites, and niche directories that don't have their own API.

### 6. Bing Dork

Same pattern as DuckDuckGo but through Bing HTML. The overlap isn't 100%. Bing indexes some pages DuckDuckGo misses and vice versa. Running both catches more.

This matters specifically because ChatGPT relies on Bing index data. If Bing can find third-party mentions of your brand, ChatGPT is more likely to surface you in answers.

### 7. Google News

Google News RSS feeds capture press coverage and news mentions. AI models weight news sources heavily for freshness and authority signals. If your brand has been covered by a news outlet, that coverage shows up here.

### 8. Quora

Quora is a direct Q&A platform, which means it maps almost perfectly to how AI models process queries. When someone asks "What is the best X?" on Quora and your brand appears in answers, that's structurally identical to how an AI model processes the same question.

AiVIS finds Quora mentions via a `site:quora.com "your brand"` search through Bing.

### 9. Product Hunt

Product Hunt is a launch and discovery platform. For SaaS, developer tools, and consumer products, a Product Hunt presence signals that your brand exists in the product ecosystem, not just the content ecosystem. AI models that index Product Hunt pages will associate your brand with your product category.

AiVIS itself is listed on Product Hunt — [check it out here](https://www.producthunt.com/products/aivis-ai-visibility-intelligence-audit). That listing is part of the same trust signal this article describes: an independent product directory confirming the brand exists outside its own domain.

---

## What One Scan Actually Looks Like

When you run a brand mention scan on [AiVIS](https://aivis.biz/mentions), all 9 sources run in parallel. You get back a unified timeline showing:

- **Source breakdown** - which platforms mention you and how often
- **Mention frequency** - are mentions increasing, flat, or declining
- **Deduplication** - the same mention found on DuckDuckGo and Bing only counts once
- **Timeline view** - when mentions happened, not just that they exist

This runs on the Alignment tier and above ($49/month). If you're on Alignment, you also get weekly email digests summarizing new mentions. You don't have to check the dashboard every day. The system watches for you and sends a report.

---

## What I Found Running This Across Real Brands

The brands that AI models cite most consistently have one thing in common: organic third-party mentions across at least 4 of these 9 sources. Not paid placements. Not self-promotion. Real people on real platforms talking about the brand in context.

Here's the pattern that predicts AI citation:

**Reddit + HN + one Q&A platform + one news source = high citation probability.**

If your brand has genuine discussion threads on Reddit with upvotes, a Hacker News appearance, answers on Quora or Stack Overflow, and at least one news mention, AI models have enough independent signal to treat you as a credible entity.

Brands that only exist on their own website and their own social media profiles are essentially invisible to this trust calculation. The AI model sees: "This entity claims things about itself, but nobody else confirms it." That's a weak citation signal.

---

## How This Connects to the Full Visibility Picture

Brand mentions are one piece of the AI visibility puzzle. They feed into what I call the trust layer. AI models are doing a version of the same thing human researchers do: looking for independent confirmation before citing a source.

The other layers matter too:

**Structural clarity** is whether an AI model can even parse your page. That's what the [SSFR scoring framework](https://aivis.biz/methodology) measures across 28 deterministic rules. JSON-LD, heading hierarchy, content depth, robots.txt access, AI crawler permissions. You can test the critical ones for free with the [Schema Validator](https://aivis.biz/tools/schema-validator), [Robots Checker](https://aivis.biz/tools/robots-checker), and [Content Extractability Tool](https://aivis.biz/tools/content-extractability).

**Citation testing** is whether your brand actually appears when AI platforms answer queries in your niche. The [AiVIS Citation Tracker](https://aivis.biz/citations) tests this across 3 search engines (DuckDuckGo, Bing, DDG Instant Answer) running in parallel, simulating how ChatGPT, Perplexity, Claude, and Google AI would handle the query. Available on Signal tier and above.

**Competitive positioning** shows where you stand relative to competitors. [AiVIS Competitor Tracking](https://aivis.biz/competitors) runs head-to-head comparisons across schema coverage, content depth, heading structure, FAQ count, meta descriptions, and page speed. It finds specific opportunities where competitors have something you don't. Available on Alignment tier and above.

**Reverse engineering** is the deep layer. The [AiVIS Reverse Engineer](https://aivis.biz/reverse-engineer) suite has 4 tools: Answer Decompiler (breaks down AI answers into source types and structural patterns), Competitor Ghost (generates ideal page blueprints for any query), Model Preference Diff (compares how different AI models weight the same content), and Visibility Simulator (forecasts your citation probability across GPT-4, Claude, Perplexity, and Gemini with before-and-after simulations).

Brand mentions connect to all of this. The structural checks confirm your page is readable. The citation tests confirm you're getting cited. The competitor analysis shows your relative position. And the mention tracker confirms that the broader internet treats you as a real entity. Together, they close the loop.

---

## The Part Nobody Talks About: Training Data Lag

Here's something most people miss. The mentions that matter most for current AI models aren't the ones posted yesterday. They're the ones that existed when the model was last trained or when the search index was last crawled.

Reddit posts from 6 months ago are already baked into GPT-4's weights. A Hacker News thread from last year is permanent training signal. Your GitHub README is in every model that trained on The Stack.

This means brand mention tracking isn't just about what's happening now. It's about building a corpus of third-party references that future model training runs will ingest. Every organic mention today is a citation signal for the next model version.

That's why monitoring matters. You need to know whether your mention footprint is growing or shrinking over time. A brand that was discussed actively 2 years ago but has gone quiet is losing ground to competitors who are generating fresh mentions.

The [AiVIS analytics dashboard](https://aivis.biz/analytics) tracks your visibility score over time alongside these signals. Set up [scheduled rescans](https://aivis.biz/analyze) and the system monitors your position automatically. Alignment tier supports monthly rescans (up to 2 schedules). Signal tier supports daily, weekly, biweekly, or monthly (up to 10 schedules).

---

## What to Do If You Have Zero Mentions

If you run a brand mention scan and find nothing across all 9 sources, that's actually useful information. It means AI models have no independent verification of your existence. Your citation probability is close to zero regardless of how good your on-site SEO is.

The fix isn't to spam these platforms. It's to create genuine presence where your audience already exists:

1. Answer real questions on Reddit in your niche (without being promotional)
2. Ship something worth discussing on Hacker News
3. Maintain an active GitHub presence if you're technical
4. Write substantive Quora answers in your expertise area
5. Get your product on [Product Hunt](https://www.producthunt.com/) if you're launching something — this is exactly what [AiVIS did](https://www.producthunt.com/products/aivis-ai-visibility-intelligence-audit) to establish product ecosystem presence

These aren't SEO hacks. They're real presence signals that both humans and AI models interpret as credibility.

---

## The Bottom Line

AI models don't live in a vacuum. They're synthesizing answers from a mesh of sources, and the platforms I listed above are specifically the ones that feed current model training and retrieval pipelines.

If your brand doesn't exist across these platforms, you're asking AI to cite an entity it has no independent evidence for. That's a losing position.

The fact that you can monitor all 9 for free (no API keys, all public data) on [AiVIS](https://aivis.biz/mentions) means there's no excuse not to at least know where you stand.

Start with a mention scan. See which platforms know you exist. Then build from there.

[Try AiVIS free at aivis.biz](https://aivis.biz)

---

*Previous issue: [Your Website Is Invisible to AI and You Don't Even Know It](https://open.substack.com/pub/dobleduche/p/i-used-to-build-websites-so-people?r=iut19&utm_campaign=post&utm_medium=web)*

*The platform: [AiVIS | AI Visibility Audit |AiVIS.biz - CITE LEDGER |AiVIS - CITE LEDGER | Evidence-Linked Scores ](https://aivis.biz)*
