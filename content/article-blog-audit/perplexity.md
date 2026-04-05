I’d audit blogs and articles in five passes: intent/relevance, structure, SEO, AEO, and factual accuracy.

## 1. Intent, audience, and relevance

- Define target reader and intent (informational, commercial, transactional) and check if every section supports that intent. [wordstream](https://www.wordstream.com/blog/ws/2022/01/24/website-audit-checklist)
- Confirm the main question or problem is clearly stated early and fully answered in the piece. [yoast](https://yoast.com/seo-audit/)
- Remove or demote tangents that don’t help the reader reach the promised outcome. [yoast](https://yoast.com/seo-audit/)

## 2. Structure, readability, UX

- Check heading hierarchy: one H1, logical H2/H3 structure, no random level jumps. [yoast](https://yoast.com/seo-audit/)
- Ensure information flows logically: intro → key points/steps → examples → FAQs or next steps. [moz](https://moz.com/seo-audit-checklist)
- Scan for short paragraphs, scannable bullets, working internal links, and fixed spelling/grammar. [students.wlu](https://students.wlu.ca/programs/liberal-arts/digital-media-and-journalism/resources/accuracy-checklist.html)

## 3. Core SEO checks (on-page)

For a primary keyword (and a few related terms):

- Confirm keyword is in URL, title tag, meta description, H1, at least one H2, and naturally in body and image alts (no stuffing). [wordstream](https://www.wordstream.com/blog/ws/2022/01/24/website-audit-checklist)
- Check meta title/description length and that they are compelling, accurate, and aligned with searcher intent. [moz](https://moz.com/seo-audit-checklist)
- Verify the page is unique (not thin/duplicate), internally linked from relevant pages, and links out to useful sources. [wordstream](https://www.wordstream.com/blog/ws/2022/01/24/website-audit-checklist)

## 4. AEO (answer engine optimization) layer

- Identify core questions and turn them into explicit Q-style headings (e.g., “What is X?”, “How does X work?”). [cxl](https://cxl.com/blog/answer-engine-optimization-aeo-the-comprehensive-guide/)
- Under each, place a direct 40–60 word answer at the top of the section, then details below. [cxl](https://cxl.com/blog/answer-engine-optimization-aeo-the-comprehensive-guide/)
- Add a concise summary or FAQ section with self-contained Q&A pairs, using clear, complete sentences and semantic headings. [amsive](https://www.amsive.com/insights/seo/answer-engine-optimization-aeo-evolving-your-seo-strategy-in-the-age-of-ai-search/)

## 5. Factual accuracy and credibility

- Print or scan the article and underline each factual claim (names, dates, numbers, “biggest/first” statements). [students.wlu](https://students.wlu.ca/programs/liberal-arts/digital-media-and-journalism/resources/accuracy-checklist.html)
- Cross-check each with primary or reputable secondary sources; ensure quotes, statistics, and superlatives are properly attributed and verifiable. [www1.lasalle](http://www1.lasalle.edu/~beatty/310/ACES_CD/editing_and_writing/accuracy_and_fairness/Accuracychecklist.pdf)
- Confirm author bio, references, and external links signal expertise, authority, and up-to-date information. [researchevaluationconsulting](https://researchevaluationconsulting.com/article-credibility-checklist/)

## 6. Citation discovery, authority signals, and mention monitoring

This pass checks whether the article and the brand behind it are actually being found, cited, and discussed outside their own site. You can ace the first five passes and still be invisible in the citation layer.

### Entity clarity

- Verify the primary entity (brand, product, person) is named clearly in the first paragraph with: its name, what it does, who it serves, and why it matters. [cxl](https://cxl.com/blog/answer-engine-optimization-aeo-the-comprehensive-guide/)
- Confirm the entity name is used consistently throughout - no mid-article abbreviation switches, no ambiguous pronouns replacing the brand name.
- Check for strong co-occurrence: brand name, core topic, and supporting entities (platforms, competitors, concepts) should appear in proximity with clear semantic relationships.

### Authority signal inventory

Confirm the page carries these signals, flag any that are missing:

- Named author with bio or credentials
- Publication date and last-updated date
- Outbound citations to credible sources
- Inbound references from third-party domains (check via Ahrefs Webmaster Tools, free)
- Independent reviews, testimonials, or mentions from external sites
- Schema markup for author, organization, and article type

### Search operator mention sweeps

Run these queries regularly on Google and Bing. Replace placeholders with real values.

General web mentions:
- `"YourBrand" -site:yourdomain.com`
- `"YourBrand" OR "Your Brand" -site:yourdomain.com`
- `"YourBrand" "review" -site:yourdomain.com`
- `"yourdomain.com" -site:yourdomain.com`

Platform-specific:
- `"YourBrand" site:reddit.com` [spyfu](https://www.spyfu.com/blog/google-search-operators/)
- `"YourBrand" site:x.com` [spyfu](https://www.spyfu.com/blog/google-search-operators/)
- `"YourBrand" site:youtube.com`
- `"YourBrand" site:trustpilot.com`
- `"YourBrand" site:reddit.com OR site:stackexchange.com OR site:quora.com`

Competitor comparison:
- `"YourBrand" OR "CompetitorOne" OR "CompetitorTwo" -site:yourdomain.com` [spyfu](https://www.spyfu.com/blog/google-search-operators/)

Founder/team:
- `"YourFounder" "YourBrand"`
- `"YourFounder" "yourdomain.com"`

Negative sentiment:
- `"YourBrand" "scam" OR "fraud" -site:yourdomain.com`

Save these as browser bookmarks. Rerun weekly minimum. [ahrefs](https://ahrefs.com/blog/google-advanced-search-operators/)

### Free alert systems (no API keys needed)

- **Google Alerts** - unlimited alerts for brand, domain, founder, product names, and competitors across news, blogs, and web. Email delivery. [forumscout](https://forumscout.app/blog/free-social-listening-tools-for-your-brand-in-2024)
- **Talkwalker Alerts** - similar coverage with a different index. Good as a backup source. [forumscout](https://forumscout.app/blog/free-social-listening-tools-for-your-brand-in-2024)
- **F5Bot** - free email alerts for keywords on Reddit, Hacker News, and Lobsters. [serpstat](https://serpstat.com/blog/top-5-tools-to-track-your-brand-mentions/)
- **ForumScout** - free tier: 3 keyword alerts, ~100 mentions/month across forums, social, blogs, and news. 6-hourly updates, 14-day retention. [forumscout](https://forumscout.app/blog/free-social-listening-tools-for-your-brand-in-2024)

### Manual native platform searches

For platforms that resist scraping but have built-in search:

- **Twitter/X**: search brand name and hashtags, save as pinned searches or TweetDeck columns. [socialsonar](https://socialsonar.app/blogs/10-free-tools-brand-monitoring-insights)
- **Reddit**: search brand name, sort by "new" to catch fresh threads. [socialsonar](https://socialsonar.app/blogs/10-free-tools-brand-monitoring-insights)
- **YouTube**: search brand name and domain for video mentions and reviews.
- **Facebook/Instagram**: search brand name and hashtags, follow or save relevant results. [socialsonar](https://socialsonar.app/blogs/10-free-tools-brand-monitoring-insights)

### Mention logging workflow

Create a tracking sheet (CSV or spreadsheet) with these columns:

```
date_found, source_type, platform, query_used, author_or_site, title_or_thread, content_snippet, url, sentiment, priority, action_needed, owner, status, notes
```

Run weekly:
1. Rerun saved Google/Bing search operators [ahrefs](https://ahrefs.com/blog/google-advanced-search-operators/)
2. Check alert emails from Google Alerts, Talkwalker, F5Bot, ForumScout [serpstat](https://serpstat.com/blog/top-5-tools-to-track-your-brand-mentions/)
3. Scan native platform searches on X, Reddit, YouTube [socialsonar](https://socialsonar.app/blogs/10-free-tools-brand-monitoring-insights)
4. Log notable mentions into the tracking sheet
5. Flag items needing response, correction, amplification, or outreach

### Competing citation risk

For the top 3 queries the article targets, check who is currently cited by AI answer engines (Perplexity, ChatGPT, Google AI Overviews). If the article does not appear and competitors do, identify what they have: usually stronger entity clarity, better evidence density, or more third-party references. [amsive](https://www.amsive.com/insights/seo/answer-engine-optimization-aeo-evolving-your-seo-strategy-in-the-age-of-ai-search/)

