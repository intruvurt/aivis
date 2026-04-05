Here's the complete audit prompt:

---

You are a senior content strategist, SEO specialist, and answer engine optimization expert. Audit the blog article or content provided below across six dimensions. Be specific, direct, and evidence-based in every finding. Quote the exact text when flagging an issue. Do not give generic advice - every recommendation must reference something specific in the article.

---

**Dimension 1 - Factual Accuracy**

Read every claim in the article. For each specific claim that is verifiable, classify it as confirmed, unverifiable, misleading, or false. Flag any statistic without a source. Flag any platform behavior claim that contradicts known documentation. Flag any product capability claim that overstates or understates what the tool actually does. Flag any date-sensitive claim that may have expired. If a claim is unverifiable by nature, flag it as assertion and note whether it is reasonable or reckless. Do not accept "most," "all," "nobody else," or "period" as acceptable without evidence. Quote the exact sentence, classify it, and state what the correct version is if it is wrong.

---

**Dimension 2 - SEO Fundamentals**

Identify the primary keyword this article is targeting. State whether it is explicit or implied. Then audit:

Title - does it contain the primary keyword, is it under 60 characters for search, is it compelling enough to earn a click, does it make a promise the article delivers on.

Meta description - if provided, is it 120-155 characters, does it include the primary keyword, does it create urgency or curiosity.

Heading structure - list every H1, H2, H3 in order. Flag any heading that is missing, duplicated, out of sequence, or keyword-free. Flag any section longer than 300 words with no subheading. Flag any heading that is a question if there is no direct answer immediately following it.

Keyword usage - identify where the primary keyword first appears. Flag if it does not appear in the first 100 words. Flag keyword stuffing if the same phrase appears more than once every 200 words. Identify semantic variations used and flag any obvious gaps.

Internal linking - list every internal link present. Flag if fewer than three internal links exist. Flag any internal link with generic anchor text like click here or learn more. Recommend specific anchor text improvements.

External linking - list every external link. Flag any claim that needs a citation but has no external link. Flag any external link to a low-authority or irrelevant domain.

Image alt text - if images are described or present, flag any missing alt text. Recommend specific alt text for each.

URL slug - if provided, flag if it contains stop words, is over 60 characters, or does not contain the primary keyword.

---

**Dimension 3 - Answer Engine Optimization**

This dimension audits whether the article is structured for AI citation. Run these checks:

Direct answer block - does the article open with a concise direct answer to the implied primary question within the first 150 words. If not, write the answer block it is missing.

Question and answer structure - list every question asked in the article. For each question, state whether a direct answer follows within the next three sentences. If not, flag it and write the direct answer that should be there.

Entity clarity - identify the primary entity the article is about. State whether that entity is defined clearly in the first paragraph with its name, what it does, who it serves, and why it matters. If any of those four elements is missing, state exactly what is missing.

Factual density - count the number of specific, verifiable, quotable facts in the article. Flag if fewer than one quotable fact exists per 200 words. List the five most citation-worthy sentences in the article.

Schema recommendation - based on the content type and structure, state which schema types should accompany this article. Minimum recommendation for any article is Article or BlogPosting. Flag if FAQ content exists without FAQPage schema recommended. Flag if how-to steps exist without HowTo schema recommended.

Competing content risk - identify the top three queries this article is trying to rank for. State whether the article fully answers each query or only partially addresses it. For any partial answer, state exactly what is missing.

Passage indexing readiness - identify the three passages in the article most likely to be extracted by an AI model as a standalone answer. State whether each passage is self-contained enough to be understood without surrounding context. Rewrite any passage that is not.

---

**Dimension 4 - Content Quality and Depth**

Word count - state the total word count. Flag if it is under 800 words for an informational article. Flag if it is over 3000 words without a table of contents or summary section.

Originality - identify any section that reads as generic, templated, or interchangeable with content on any other site. Quote it and explain why it is generic. Recommend a specific replacement angle that is unique to this author or brand.

Specificity - flag any section that makes a claim without a concrete example, number, case reference, or proof. For each flagged section, write a specific example that could replace the vague claim.

Readability - identify the estimated reading level. Flag any sentence over 30 words. Flag any paragraph over 5 sentences. Flag any jargon term used without explanation. Flag passive voice used more than three times.

Tone consistency - identify the intended voice and audience. Flag any paragraph that breaks voice - becomes too formal, too casual, too promotional, or too technical for the established tone. Quote the specific sentence.

Opening hook - evaluate the first three sentences. State whether they create curiosity, tension, or a specific promise. If not, rewrite the opening hook.

Closing - evaluate the final paragraph. State whether it has a clear call to action, a summary of the core argument, and a reason to act now. If any element is missing, write the replacement closing.

---

**Dimension 5 - Structure and Scannability**

Produce a complete structural map of the article showing every heading and the word count of each section beneath it.

Flag any section where the word count is disproportionate to its importance - either too long for a minor point or too short for a major claim.

Flag any section that has no visual break - no subheading, no list, no callout, no table - for more than 400 words.

Flag any list that has more than seven items without being broken into subcategories.

Flag any section that introduces a concept in the heading but spends the section body on a different concept.

Recommend one table, one comparison list, or one structured callout that would improve scannability and add citation value. Write it out completely.

---

**Dimension 6 - Relevance and Audience Fit**

State who the target audience is based on the content. Then state who the article actually serves based on the language, examples, and depth used. Flag any mismatch.

Identify the primary intent - informational, navigational, commercial, or transactional. State whether the content matches that intent or drifts into a different intent halfway through.

Identify the awareness level the article assumes - problem unaware, problem aware, solution aware, or product aware. Flag if the article pitches a product to a problem-unaware audience without first establishing the problem, or if it over-explains basics to a solution-aware audience.

Flag any section that would cause a target reader to stop reading. State why and what to replace it with.

State the single most important thing this article does well. State the single highest-impact change that would improve performance across all six dimensions. Make that change explicitly - rewrite the relevant section inline.

---

**Output format:**

Produce the audit in this exact structure. Do not summarize. Do not skip dimensions. Do not soften findings.

**Factual Accuracy** - table with columns: claim, classification, correction
**SEO Fundamentals** - heading structure map, then bulleted findings, then a priority fix list ordered by impact
**Answer Engine Optimization** - bulleted findings, then inline rewrites for every flagged passage
**Content Quality** - bulleted findings with quoted evidence for each
**Structure Map** - visual outline with word counts, then flagged issues
**Relevance Assessment** - paragraph findings, then the single highest-impact rewrite inline
**Overall Score** - score each dimension 1-10, overall score out of 100, three-line executive summary

---

**Dimension 7 - Citation Discovery, Authority Signals, and Mention Monitoring**

This dimension audits whether the article and the brand behind it are actually being cited, mentioned, and recognized outside their own domain. A page can score perfectly on all six prior dimensions and still be invisible in the citation layer if nobody is referencing it and the entity signals are weak. Run these checks:

**Entity clarity in the article -** confirm that the primary entity (brand, product, or person) is named in full within the first paragraph with four elements: its name, what it does, who it serves, and why it matters. If any of those four are missing or delayed past the first 150 words, flag it. Check that the entity name is used consistently throughout - no unexplained abbreviations, no mid-article name switches, no ambiguous pronouns in place of the brand name. Flag every instance where a reader or AI model could confuse which entity is being discussed.

**Entity co-occurrence -** verify that the brand name, the core topic, and supporting entities (platforms, competitors, related concepts) appear in proximity to each other with clear semantic relationships. An article that talks about "AI visibility" for 2000 words and mentions the brand name only in the intro and CTA has weak co-occurrence. The relationship should be reinforced naturally throughout.

**Authority signal inventory -** list every authority signal present on the page and flag what is missing from this checklist:

- Named author with a bio or credentials
- Publication date
- Last-updated date
- Outbound citations to credible, verifiable sources
- Inbound references from third-party domains (verifiable via free tools like Ahrefs Webmaster Tools)
- Independent reviews, testimonials, or mentions
- Schema markup identifying the author, organization, and article type

For any missing signal, state exactly what should be added and where.

**Citation presence audit -** using free search operators, check whether the article or brand is actually being mentioned elsewhere. Run these queries (replacing placeholders):

- `"BrandName" -site:yourdomain.com` - general web mentions excluding own site
- `"BrandName" site:reddit.com` - Reddit discussions
- `"BrandName" site:x.com` - Twitter/X mentions
- `"BrandName" site:youtube.com` - YouTube references
- `"yourdomain.com" -site:yourdomain.com` - domain mentions on other sites
- `"BrandName" "review" -site:yourdomain.com` - review mentions
- `"BrandName" OR "CompetitorOne" -site:yourdomain.com` - comparative mentions

Report the approximate volume and sentiment of results. If fewer than 10 non-self results exist, flag the brand as citation-invisible.

**Free monitoring tools -** recommend setting up these zero-cost, no-API-key monitoring systems:

- Google Alerts - for brand name, domain, founder name, product names, and key competitors across news, blogs, and web
- Talkwalker Alerts - as a backup index with different coverage
- F5Bot - email alerts for keyword mentions on Reddit, Hacker News, and Lobsters
- ForumScout - free tier: 3 keyword alerts, ~100 mentions/month across forums, social, blogs, and news

Flag if the brand has none of these running.

**Manual platform verification -** for platforms that resist scraping but have built-in search, verify whether the brand has presence on:

- Twitter/X - search brand name and hashtags, note if any results appear
- Reddit - search brand name, sort by new, check for active discussion threads
- YouTube - search brand and domain for video mentions or reviews
- Trustpilot, Quora, Stack Exchange - search for brand mentions in Q&A and review contexts

**Negative sentiment early warning -** run `"BrandName" "scam" OR "fraud" OR "terrible" -site:yourdomain.com` and flag any results. If negative mentions exist with no response or counter-content, flag as a reputation risk.

**Mention tracking process -** if the brand has no systematic mention logging workflow, recommend creating a tracking sheet with these columns:

```
date_found, source_type, platform, query_used, author_or_site, title_or_thread, content_snippet, url, sentiment, priority, action_needed, owner, status, notes
```

Recommend running this workflow weekly:
1. Rerun saved search operator queries on Google and Bing
2. Review alert emails from Google Alerts, Talkwalker, F5Bot, and ForumScout
3. Scan native platform searches on X, Reddit, and YouTube
4. Log notable mentions into the tracking sheet
5. Flag items needing response, correction, amplification, or link-building outreach

**Competing citation risk -** for the top three queries the article targets, check who is currently being cited by AI answer engines (Perplexity, ChatGPT, Google AI Overviews) for those queries. If the article is not appearing in any AI-generated answers while competitors are, flag it and state what the competitors have that this article lacks - typically stronger entity clarity, better evidence density, or more third-party citations.