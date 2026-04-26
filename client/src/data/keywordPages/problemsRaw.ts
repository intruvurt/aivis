import type { KeywordPage } from "./types";

/**
 * 25 "raw searcher intent" pages targeting emotional, frustrated, and
 * fix-intent queries from the AiVIS.biz query bank. These are the queries
 * people actually type when confused, worried, or ready to act.
 *
 * Categories:
 *   1. Raw frustration (8 pages) — closest to actual typed queries
 *   2. Problem → diagnosis (5 pages) — mid-funnel understanding
 *   3. Fix intent (4 pages) — highest-converting money keywords
 *   4. Comparison / curiosity (2 pages) — traffic builders
 *   5. Founder / builder mindset (2 pages) — target audience
 *   6. High-signal long queries (4 pages) — under-targeted gold
 */
export const problemRawPages: KeywordPage[] = [
    // ── Category 1: Raw Frustration ─────────────────────────────────────

    {
        slug: "site-not-showing-in-chatgpt",
        cluster: "problems",
        title: "Why Is My Site Not Showing in ChatGPT",
        metaTitle: "Why Is My Site Not Showing in ChatGPT? | AiVIS.biz",
        metaDescription:
            "Your site isn't showing in ChatGPT answers because GPTBot can't extract your content. Check crawler access, rendering, and schema in one audit.",
        primaryKeyword: "site not showing in chatgpt",
        secondaryKeyword: "ChatGPT ignoring my website",
        hook: "You search ChatGPT for something you know your site covers — and it cites three competitors but not you. This is not a ranking problem. It is an extraction problem.",
        sections: [
            {
                heading: "ChatGPT doesn't rank sites — it extracts from them",
                content: [
                    "Traditional search engines position pages in a ranked list. ChatGPT synthesizes answers by extracting fragments from crawlable pages. If GPTBot cannot access your page, or cannot parse the content once it gets there, your site does not exist in that answer.",
                    "Being indexed by Google says nothing about ChatGPT access. The two systems use different crawlers, different extraction pipelines, and different signals for source selection.",
                ],
            },
            {
                heading: "Three reasons your site is not included",
                content: [
                    "1. GPTBot is blocked. Check your robots.txt file for 'User-agent: GPTBot'. If it says 'Disallow: /' — or if your CDN blocks unknown bots — ChatGPT cannot crawl you at all.",
                    "2. Client-side rendering. ChatGPT's crawlers do not execute JavaScript. If your site renders in the browser, the crawler sees an empty HTML shell. Your content is invisible.",
                    "3. No structured data. Without JSON-LD (Organization, Article, FAQ), ChatGPT cannot reliably attribute extracted content to your domain. It may use the content but credit someone else.",
                ],
            },
            {
                heading: "How to fix it fast",
                content: [
                    "Run an AiVIS.biz audit. It checks all three failure points — crawler access, rendering, and schema completeness — and tells you specifically what is broken and how to fix it.",
                    "Observer tier is free. You get a score, your top 3 blockers, and exactly where the extraction pipeline breaks down for your URL.",
                ],
            },
        ],
        faqs: [
            {
                question: "Does ChatGPT Plus vs free affect which sites it uses?",
                answer:
                    "ChatGPT Plus with browsing uses real-time GPTBot crawls. The free tier relies more on training data. Both benefit from strong extraction signals — if your site is structured correctly, it shows up in both contexts.",
            },
            {
                question: "How long after fixing issues will I appear in ChatGPT?",
                answer:
                    "Real-time browsing can pick up changes within days. Training data updates take weeks to months depending on OpenAI's crawl cadence.",
            },
        ],
        internalLinks: [
            { label: "Run a free audit", to: "/app/analyze" },
            { label: "Blocked by robots.txt", to: "/problems/blocked-by-robots-txt" },
            { label: "JavaScript rendering blocks AI", to: "/problems/javascript-rendering-blocks-ai" },
            { label: "Guide: common failures", to: "/guide#common-failures" },
        ],
        ctaText: "Find out why ChatGPT skips you",
        ctaLink: "/app/analyze",
    },

    {
        slug: "chatgpt-not-mentioning-my-website",
        cluster: "problems",
        title: "ChatGPT Not Mentioning My Website — Why",
        metaTitle: "ChatGPT Not Mentioning My Website | AiVIS.biz",
        metaDescription:
            "ChatGPT skips sites with blocked crawlers, missing schema, or client-side rendering. Diagnose your exact block with an evidence-backed audit.",
        primaryKeyword: "chatgpt not mentioning my website",
        secondaryKeyword: "chatgpt not citing my site",
        hook: "You know your site has the best answer. ChatGPT knows your competitors instead. The gap is structural — not about content quality.",
        sections: [
            {
                heading: "Mention vs citation: what ChatGPT actually does",
                content: [
                    "When ChatGPT uses content from your site, it can do one of two things: cite you (mention your domain as a source) or use your content without attribution. Both require the same prerequisite: GPTBot must be able to access and extract your page.",
                    "If ChatGPT never mentions your site at all, the extraction is failing before it even starts. The answer to why is almost always in your robots.txt, rendering stack, or missing schema.",
                ],
            },
            {
                heading: "The extraction checklist ChatGPT applies to every source",
                content: [
                    "Can GPTBot access the page? (robots.txt, CDN bot protection, rate limiting)",
                    "Is the content in the HTML at response time? (server-side rendering vs client-side)",
                    "Is there structured data to identify the publisher? (Organization JSON-LD)",
                    "Are the claims specific and verifiable? (content depth and structure)",
                    "All four must be true for your site to appear reliably. AiVIS.biz checks all four with BRAG Evidence IDs tracing each finding to your crawl results.",
                ],
            },
        ],
        faqs: [
            {
                question: "Can I submit my site directly to ChatGPT?",
                answer:
                    "There is no direct submission. ChatGPT discovers content through GPTBot crawls. The correct path is to make your site structurally accessible to GPTBot and ensure content is extractable.",
            },
            {
                question: "What if my competitor has weaker content but still gets mentioned?",
                answer:
                    "Extraction readiness beats content quality in the AI pipeline. A structurally sound page with moderate content often outperforms a brilliant but poorly-structured page. Fix your signals first.",
            },
        ],
        internalLinks: [
            { label: "Run a free audit", to: "/app/analyze" },
            { label: "Why ChatGPT ignores my site", to: "/problems/why-chatgpt-ignores-my-site" },
            { label: "Missing structured data", to: "/problems/missing-structured-data" },
            { label: "Guide: execute fixes", to: "/guide#execute-fixes" },
        ],
        ctaText: "Diagnose the gap",
        ctaLink: "/app/analyze",
    },

    {
        slug: "ai-ignores-my-website-content",
        cluster: "problems",
        title: "Why Does AI Ignore My Website Content",
        metaTitle: "Why AI Ignores My Website Content | AiVIS.biz",
        metaDescription:
            "AI ignores website content it cannot extract, trust, or attribute. Diagnose the exact signal failures that make your content invisible to AI answers.",
        primaryKeyword: "why does ai ignore my website content",
        secondaryKeyword: "ai skipping my website",
        hook: "AI does not ignore your content out of preference. It ignores it because something in the extraction chain broke. Let's find exactly where.",
        sections: [
            {
                heading: "AI doesn't read — it extracts",
                content: [
                    "Human readers can understand poorly structured content through context and patience. AI extraction pipelines cannot. They look for specific structural signals: headings, schema markup, rendered HTML, entity metadata. If the signals are missing, the extraction yields nothing usable.",
                    "This is why technically thin but structurally sound pages often outperform rich but unstructured content in AI answers.",
                ],
            },
            {
                heading: "The full chain that must not break",
                content: [
                    "Step 1 — Crawler access: Your robots.txt must allow GPTBot, ClaudeBot, and PerplexityBot. Most CDN configurations block them silently.",
                    "Step 2 — Content delivery: Content must be in the HTML server response, not assembled by JavaScript in the browser.",
                    "Step 3 — Structure: Semantic headings, Organization/Article/FAQ JSON-LD, canonical URLs.",
                    "Step 4 — Attribution: datePublished, author, publisher declared. Without these, the extracted fragment has no verifiable source.",
                ],
            },
        ],
        faqs: [
            {
                question: "Does Google indexing mean AI can use my content?",
                answer:
                    "No. Google crawling and AI extraction are independent processes with different crawlers and different structural requirements. Google can index a page that AI models cannot extract.",
            },
            {
                question: "My content ranks well in Google but never appears in AI answers — why?",
                answer:
                    "SEO ranking signals (backlinks, keyword relevance) are orthogonal to AI extraction signals (schema, rendering, crawler access). You can dominate Google results and still fail AI extraction entirely.",
            },
        ],
        internalLinks: [
            { label: "Run a free audit", to: "/app/analyze" },
            { label: "How AI models read websites", to: "/problems/how-ai-models-read-websites" },
            { label: "No schema markup", to: "/problems/no-schema-markup" },
            { label: "Guide: run first audit", to: "/guide#run-first-audit" },
        ],
        ctaText: "Find your extraction block",
        ctaLink: "/app/analyze",
    },

    {
        slug: "website-never-appears-in-ai-answers",
        cluster: "problems",
        title: "My Website Never Appears in AI Answers",
        metaTitle: "My Website Never Appears in AI Answers — Why & Fix | AiVIS.biz",
        metaDescription:
            "If your website never appears in ChatGPT, Perplexity, or Google AI answers, the extraction pipeline is blocked. Find and fix the exact cause.",
        primaryKeyword: "website never appears in ai answers",
        secondaryKeyword: "not included in ai answers",
        hook: "Every topic you cover. Every question you answer. None of it shows up in AI responses. This is not bad luck — it is a systematic extraction failure.",
        sections: [
            {
                heading: "What 'never appearing' tells you",
                content: [
                    "If your site consistently fails to appear across multiple AI systems (ChatGPT, Perplexity, Google AI, Claude), the problem is upstream. It is not about which AI you are targeting — it is about whether any AI can access and parse your content at all.",
                    "The most common upstream failures are: robots.txt blocking all AI crawlers, client-side rendering with no SSR fallback, and complete absence of JSON-LD structured data.",
                ],
            },
            {
                heading: "Ordered priority fix list",
                content: [
                    "1. Robots.txt audit — verify GPTBot, ClaudeBot, PerplexityBot are all allowed. This takes five minutes and unblocks everything downstream.",
                    "2. View Source check — right-click, View Source (not Inspect Element). If the body is empty, you need server-side rendering.",
                    "3. JSON-LD add — one Organization schema block with name, url, sameAs links is enough to establish entity identity.",
                    "4. Full AiVIS.biz audit — once the basics are in place, run a full extraction audit to find secondary and tertiary blockers across all seven dimensions.",
                ],
            },
        ],
        faqs: [
            {
                question: "Is there a way to test if AI can reach my site without a paid tool?",
                answer:
                    "Yes. Check robots.txt manually, view page source to test for client-side rendering, and validate JSON-LD at schema.org/validator. AiVIS.biz Observer tier is also free and automates all three checks.",
            },
            {
                question: "Does having a sitemap help AI find my content?",
                answer:
                    "A sitemap helps AI crawlers discover pages but does not override robots.txt restrictions or fix rendering failures. It is a secondary signal — fix access and rendering first.",
            },
        ],
        internalLinks: [
            { label: "Run a free audit", to: "/app/analyze" },
            { label: "How to audit AI answer readiness", to: "/problems/how-to-audit-ai-answer-readiness" },
            { label: "Blocked by robots.txt", to: "/problems/blocked-by-robots-txt" },
            { label: "Guide: baseline setup", to: "/guide#baseline-setup" },
        ],
        ctaText: "Break through AI invisibility",
        ctaLink: "/app/analyze",
    },

    {
        slug: "content-not-used-by-ai",
        cluster: "problems",
        title: "Why Is My Content Not Used by AI",
        metaTitle: "Why Is My Content Not Used by AI? | AiVIS.biz",
        metaDescription:
            "AI doesn't use content it can't extract reliably. Find out exactly why your content is being passed over and what structural changes fix it.",
        primaryKeyword: "content not used by ai",
        secondaryKeyword: "ai not using my content",
        hook: "You publish. AI ignores. Your content goes unused not because it is bad but because the extraction signal is broken.",
        sections: [
            {
                heading: "Content quality vs content extractability",
                content: [
                    "AI models do not read content the way humans do. They process structured signals — headings, schema, rendered HTML, entity declarations. A page with brilliant prose but no JSON-LD and no headings below H1 gives AI almost nothing extractable.",
                    "Conversely, a page with moderate content quality but clean structure, full schema markup, and correct headings delivers a strong extraction signal. In the AI pipeline, extractability beats eloquence.",
                ],
            },
            {
                heading: "Making your content AI-usable",
                content: [
                    "Use specific, atomic statements: one verifiable claim per paragraph. Avoid long blocks of undifferentiated prose — AI models compress pages and ambiguous blocks lose precision in compression.",
                    "Add FAQ schema for any Q&A content. FAQ is the single highest-impact schema type for AI extraction — it provides pre-segmented question-answer pairs that AI models can extract directly.",
                    "Declare authorship and publication date. Without Author and datePublished, extracted content lacks temporal and entity context, which reduces citation probability.",
                ],
            },
        ],
        faqs: [
            {
                question: "Does word count matter for AI extraction?",
                answer:
                    "Content depth is a scoring dimension (20% weight). Thin content (under ~300 words) tends to extract poorly because there is not enough signal. But word count without structure is not the answer — depth and specificity matter more than length alone.",
            },
            {
                question: "Will AI use content from behind a login wall?",
                answer:
                    "No. AI crawlers cannot authenticate. Content behind login, paywalls, or cookie consent gates is inaccessible to AI extraction. Only publicly accessible content can be used.",
            },
        ],
        internalLinks: [
            { label: "Run a free audit", to: "/app/analyze" },
            { label: "Thin content problem", to: "/problems/thin-content" },
            { label: "FAQ schema signal", to: "/signals/faq-schema" },
            { label: "Guide: read results correctly", to: "/guide#read-results-correctly" },
        ],
        ctaText: "See what's blocking your content",
        ctaLink: "/app/analyze",
    },

    {
        slug: "chatgpt-gets-my-site-wrong",
        cluster: "problems",
        title: "Why Does ChatGPT Get My Site Wrong",
        metaTitle: "Why Does ChatGPT Get My Website Wrong? | AiVIS.biz",
        metaDescription:
            "ChatGPT fabricates or misrepresents your site when it can't find reliable entity data. Fix the structured data that gives ChatGPT the right answer.",
        primaryKeyword: "chatgpt gets my site wrong",
        secondaryKeyword: "chatgpt wrong information about my website",
        hook: "ChatGPT describes your company incorrectly, misrepresents your services, or confuses you with someone else. This is not a model error — it is an entity signal failure on your site.",
        sections: [
            {
                heading: "Why ChatGPT generates wrong information about you",
                content: [
                    "ChatGPT reconstructs answers from extracted signals. If your Organization schema is incomplete, your business name is inconsistent across pages, or your company lacks sameAs links to verified profiles — ChatGPT fills the gaps from its training data. Training data can be outdated, mixed up with other entities, or simply wrong.",
                    "The model is not lying. It is doing its best with incomplete extraction inputs. Fix the inputs and the outputs improve.",
                ],
            },
            {
                heading: "The specific signals that determine what ChatGPT says about you",
                content: [
                    "Organization JSON-LD: name, legalName, url — establishes canonical identity.",
                    "sameAs links: LinkedIn, GitHub, Twitter/X, Product Hunt, Crunchbase — connects your domain to verified off-site identity.",
                    "foundingDate and description — prevents ChatGPT from applying stale training data about similar entities.",
                    "Consistent naming: the exact same entity name across every page, in JSON-LD, in body copy, and in metadata.",
                    "AiVIS.biz audits all of these and identifies which are missing, inconsistent, or incomplete.",
                ],
            },
        ],
        faqs: [
            {
                question: "Can I report wrong information to ChatGPT?",
                answer:
                    "OpenAI has a feedback mechanism but no guaranteed correction timeline. The more reliable path is fixing your own extraction signals — when ChatGPT recrawls, the corrected signals flow into responses.",
            },
            {
                question: "What if ChatGPT uses correct information from an old version of my site?",
                answer:
                    "Add dateModified to your schema and update your sitemap timestamp. This signals to GPTBot that content has changed and increases the probability of a fresh crawl.",
            },
        ],
        internalLinks: [
            { label: "Run a free audit", to: "/app/analyze" },
            { label: "AI wrong info about my company", to: "/problems/why-ai-gives-wrong-information-about-my-company" },
            { label: "Fix entity confusion", to: "/problems/how-to-fix-entity-confusion-in-ai" },
            { label: "Schema signals", to: "/signals/schema-org" },
        ],
        ctaText: "Fix what ChatGPT gets wrong",
        ctaLink: "/app/analyze",
    },

    {
        slug: "ai-summarizing-my-site-incorrectly",
        cluster: "problems",
        title: "AI Is Summarizing My Site Incorrectly",
        metaTitle: "AI Summarizing My Website Incorrectly — Fix It | AiVIS.biz",
        metaDescription:
            "When AI summarizes your site incorrectly, the extraction inputs are ambiguous. Fix entity signals, schema, and content structure to get accurate AI summaries.",
        primaryKeyword: "ai summarizing my site incorrectly",
        secondaryKeyword: "ai wrong summary of my website",
        hook: "AI describes your business in a way that ranges from slightly off to completely wrong. Every inaccuracy maps to a missing or ambiguous signal on your site.",
        sections: [
            {
                heading: "How AI builds a summary of your site",
                content: [
                    "AI models construct summaries by extracting your page title, H1, meta description, Organization schema, and body content. They compress these inputs into a representation and reproduce it when asked about your business.",
                    "If any of these signals contradict each other — or if they are missing — the summary is assembled from incomplete inputs and the result is inaccurate. The most common contradictions: H1 says one thing, meta description says another, and Organization schema says something different.",
                ],
            },
            {
                heading: "Align your signals to fix the summary",
                content: [
                    "1. Make your H1 and page title say the same thing about who you are and what you do.",
                    "2. Keep your Organization schema description consistent with your meta description.",
                    "3. Remove or noindex outdated pages that may be feeding incorrect historical data.",
                    "4. Add dateModified to prompt recrawling after updates.",
                    "Run an AiVIS.biz audit to identify contradictions and inconsistencies across all signals.",
                ],
            },
        ],
        faqs: [
            {
                question: "Why does AI summarize one of my pages correctly but another incorrectly?",
                answer:
                    "Different pages have different schema coverage, content depth, and heading structure. A page with full JSON-LD and clear headings will be summarized more accurately than a page with none. AiVIS.biz audits individual pages so you can prioritize fixes.",
            },
            {
                question: "Can a competitors site be causing AI to misrepresent mine?",
                answer:
                    "Yes — entity confusion. If your competitor has stronger entity signals, AI may blend or conflate the two entities. Strengthening your own signals disambiguates the entities in the model's representation.",
            },
        ],
        internalLinks: [
            { label: "Run a free audit", to: "/app/analyze" },
            { label: "AI misquotes my content", to: "/problems/why-ai-misquotes-my-content" },
            { label: "AI wrong info about company", to: "/problems/why-ai-gives-wrong-information-about-my-company" },
            { label: "Guide: execute fixes", to: "/guide#execute-fixes" },
        ],
        ctaText: "Get AI to say the right things",
        ctaLink: "/app/analyze",
    },

    {
        slug: "ai-not-picking-up-my-pages",
        cluster: "problems",
        title: "Why Is AI Not Picking Up My Pages",
        metaTitle: "Why AI Isn't Picking Up My Pages | AiVIS.biz",
        metaDescription:
            "AI crawlers fail to pick up pages that are blocked, client-rendered, or missing schema. Check all three with a free AiVIS.biz audit.",
        primaryKeyword: "ai not picking up my pages",
        secondaryKeyword: "ai not crawling my website",
        hook: "Your pages exist. They load fine in a browser. AI still does not use them. The browser experience and the AI crawl experience are not the same.",
        sections: [
            {
                heading: "What 'not picking up' actually means",
                content: [
                    "There are three distinct failure modes that all look like 'AI isn't finding my pages.'",
                    "Fail 1 — Access blocked: The crawler never reaches the page. Cause: robots.txt Disallow, CDN WAF, or rate limiting. Symptom: completely absent across all AI systems.",
                    "Fail 2 — Content not delivered: The crawler reaches the page but gets empty HTML. Cause: client-side rendering. Symptom: AI has no content to extract.",
                    "Fail 3 — No attribution: Content extracted but not attributed. Cause: missing schema. Symptom: AI may use your content but cite someone else, or generate a response without naming you.",
                ],
            },
            {
                heading: "Which pages to audit first",
                content: [
                    "Start with your highest-value pages: primary service page, homepage, and one authoritative content page. If these fail extraction, everything downstream is irrelevant.",
                    "AiVIS.biz lets you audit any URL and tracks historical scores. Run baseline audits on your core pages, fix the blockers, and re-audit to measure improvement.",
                ],
            },
        ],
        faqs: [
            {
                question: "Does page indexation in Google guarantee AI will pick it up?",
                answer:
                    "No. Google indexation and AI extraction are completely independent processes. Use Google Search Console to verify Google indexation; use AiVIS.biz to verify AI extraction readiness.",
            },
            {
                question: "Can a CDN prevent AI from picking up my pages?",
                answer:
                    "Yes. Cloudflare Bot Fight Mode, Sucuri WAF, and similar services often block AI crawlers by default. Configure explicit allowances for GPTBot, ClaudeBot, and PerplexityBot.",
            },
        ],
        internalLinks: [
            { label: "Run a free audit", to: "/app/analyze" },
            { label: "JavaScript rendering blocks AI", to: "/problems/javascript-rendering-blocks-ai" },
            { label: "Blocked by robots.txt", to: "/problems/blocked-by-robots-txt" },
            { label: "Missing structured data", to: "/problems/missing-structured-data" },
        ],
        ctaText: "Find out which pages are blocked",
        ctaLink: "/app/analyze",
    },

    // ── Category 2: Problem → Diagnosis ─────────────────────────────────

    {
        slug: "how-chatgpt-decides-what-websites-to-use",
        cluster: "problems",
        title: "How Does ChatGPT Decide What Websites to Use",
        metaTitle: "How ChatGPT Decides What Websites to Use | AiVIS.biz",
        metaDescription:
            "ChatGPT selects sources based on crawl access, extraction quality, entity clarity, and content specificity — not backlinks or domain authority.",
        primaryKeyword: "how does chatgpt decide what websites to use",
        secondaryKeyword: "chatgpt source selection",
        hook: "ChatGPT does not have a whitelist of preferred sites. It uses whatever it can extract. What it can extract depends entirely on how your site is structured.",
        sections: [
            {
                heading: "The four-stage source selection process",
                content: [
                    "Stage 1 — Crawl: GPTBot (and browsing) crawls candidate pages. Pages blocked by robots.txt, CDN, or rendering failures are eliminated here.",
                    "Stage 2 — Extraction: The crawler parses the HTML. Pages with clear structure, semantic headings, and JSON-LD produce high-quality extraction. Pages without produce noise or nothing.",
                    "Stage 3 — Attribution: The model checks for entity signals. Organization, Author, datePublished. Sources without these are used anonymously or not at all.",
                    "Stage 4 — Selection: Among all candidate extractions for a given query, the model weighs content specificity, structural quality, and temporal recency. The most attributable, specific, extractable source wins.",
                ],
            },
            {
                heading: "What does NOT affect ChatGPT source selection",
                content: [
                    "Backlinks: ChatGPT does not process link graphs the way Google does.",
                    "Domain authority: Moz DA and similar metrics have no bearing on AI extraction.",
                    "Keyword density: AI models extract semantic meaning, not keyword patterns.",
                    "Social signals: Follower counts and engagement metrics are not extraction inputs.",
                    "That means these factors also do not protect you — a high-authority site with poor extraction readiness is still skipped.",
                ],
            },
        ],
        faqs: [
            {
                question: "Can I pay OpenAI to be included in ChatGPT answers?",
                answer:
                    "No. ChatGPT source selection is not a paid placement. It is a function of structural extraction readiness. The path to inclusion is technical, not commercial.",
            },
            {
                question: "Does ChatGPT use different criteria for different types of queries?",
                answer:
                    "Yes. Informational queries prefer content with FAQ schema and clear headings. Commercial queries may favor sites with Product or Service schema. Brand queries depend heavily on Organization schema and sameAs links.",
            },
        ],
        internalLinks: [
            { label: "Run a free audit", to: "/app/analyze" },
            { label: "Why AI doesn't cite my website", to: "/problems/why-ai-doesnt-cite-my-website" },
            { label: "Methodology", to: "/methodology" },
            { label: "Guide: run first audit", to: "/guide#run-first-audit" },
        ],
        ctaText: "See if ChatGPT can extract your site",
        ctaLink: "/app/analyze",
    },

    {
        slug: "how-ai-tools-choose-sources",
        cluster: "problems",
        title: "How Do AI Tools Choose Their Sources",
        metaTitle: "How AI Tools Choose Their Sources — Explained | AiVIS.biz",
        metaDescription:
            "AI answer engines choose sources based on extraction quality, not SEO ranking. Learn the exact signals that determine whether you get cited.",
        primaryKeyword: "how do ai tools choose sources",
        secondaryKeyword: "ai source selection criteria",
        hook: "ChatGPT, Perplexity, Gemini, and Google AI Overview all use different systems — but they share the same source selection fundamentals. Understanding them is the first step to being included.",
        sections: [
            {
                heading: "Source selection across AI answer engines",
                content: [
                    "Different AI tools weight signals differently, but all require:  crawler access, parseable content, and attributable entity identity.",
                    "Perplexity is the most citation-transparent — it explicitly names sources in its answers. ChatGPT with browsing cites when the crawl corpus supports it. Google AI Overview draws from the search index but applies additional extraction quality filters. Claude relies more on training data but uses ClaudeBot for real-time web access.",
                ],
            },
            {
                heading: "The common signal stack that works across all AI tools",
                content: [
                    "Robots.txt: Allow all major AI crawlers (GPTBot, PerplexityBot, ClaudeBot, anthropic-ai, Googlebot).",
                    "Server-side rendering: HTML content must be in the server response.",
                    "Organization JSON-LD: name, url, sameAs at minimum.",
                    "Article JSON-LD on content pages: headline, datePublished, author.",
                    "FAQ JSON-LD for Q&A content: highest extraction priority across all engines.",
                    "These five elements cover the floor requirements for all major AI tools simultaneously.",
                ],
            },
        ],
        faqs: [
            {
                question: "Do different AI tools weight structured data differently?",
                answer:
                    "Yes, to some degree. But JSON-LD is universally recognized across all major AI answer engines. Implementing it comprehensively is the safest cross-platform strategy.",
            },
            {
                question: "Is there a way to be preferred over competitors in AI source selection?",
                answer:
                    "The competitive edge comes from completeness: more schema types, more specific content, stronger entity identity. AiVIS.biz competitor tracking (Alignment tier) compares your extraction readiness against competitor domains.",
            },
        ],
        internalLinks: [
            { label: "Run a free audit", to: "/app/analyze" },
            { label: "How to get cited by AI models", to: "/problems/how-to-get-cited-by-ai-models" },
            { label: "JSON-LD signals", to: "/signals/json-ld" },
            { label: "Competitor tracking", to: "/competitors" },
        ],
        ctaText: "Get included across AI tools",
        ctaLink: "/app/analyze",
    },

    {
        slug: "why-some-sites-get-cited-not-mine",
        cluster: "problems",
        title: "Why Some Sites Get Cited in AI Answers and Not Mine",
        metaTitle: "Why Some Sites Get Cited in AI Answers and Not Mine | AiVIS.biz",
        metaDescription:
            "Sites that get cited in AI answers have stronger extraction signals: crawler access, structured data, content specificity. Here's how to close the gap.",
        primaryKeyword: "why some sites get cited in ai answers not mine",
        secondaryKeyword: "what sites get cited by ai",
        hook: "You and a competitor cover the same topic. They get cited. You do not. The difference is structural — and it is measurable.",
        sections: [
            {
                heading: "What citations sites have that non-cited sites don't",
                content: [
                    "When AiVIS.biz audits both sides of this comparison, the gap almost always comes down to three things: complete structured data, accessible crawler pathways, and specific content claims.",
                    "Cited sites typically have Organization JSON-LD with sameAs links, Article/FAQ schema on content pages, and content written in atomic, verifiable statements. Non-cited sites typically have no schema, blocked crawlers, or promotional content that lacks extractable specifics.",
                ],
            },
            {
                heading: "How to close the gap",
                content: [
                    "Run an AiVIS.biz audit on your page and your competitor's page. The competitor analysis (Alignment tier) gives you a side-by-side extraction readiness comparison.",
                    "Identify where their structural signals are stronger. Then close each gap systematically — schema first, then rendering, then content depth.",
                    "Citation is competitive. You are not just convincing AI to include you — you are outperforming the competitor's extraction readiness on shared topics.",
                ],
            },
        ],
        faqs: [
            {
                question: "Is there a shortcut to get cited faster than fixing all of this?",
                answer:
                    "The fastest path is fixing access blockers and adding Organization + FAQ JSON-LD — two changes that can be made in an afternoon and typically produce measurable results within a crawl cycle.",
            },
            {
                question: "Does getting cited in Perplexity make it more likely to be cited in ChatGPT?",
                answer:
                    "Not directly. But both cite for the same structural reasons. Fixing extraction readiness for one engine tends to improve citation probability across all engines simultaneously.",
            },
        ],
        internalLinks: [
            { label: "Run a free audit", to: "/app/analyze" },
            { label: "AI attributes content to competitors", to: "/problems/why-ai-attributes-my-content-to-competitors" },
            { label: "Competitor tracking", to: "/competitors" },
            { label: "Pricing", to: "/pricing" },
        ],
        ctaText: "See why competitors beat you",
        ctaLink: "/app/analyze",
    },

    {
        slug: "what-makes-website-visible-to-ai-search",
        cluster: "problems",
        title: "What Makes a Website Visible to AI Search",
        metaTitle: "What Makes a Website Visible to AI Search | AiVIS.biz",
        metaDescription:
            "AI search visibility depends on crawler access, structured data, server-side rendering, and content extractability — not rankings or domain authority.",
        primaryKeyword: "what makes a website visible to ai search",
        secondaryKeyword: "ai search visibility factors",
        hook: "AI search visibility is not the same as Google search visibility. The signals are different. This is the complete picture.",
        sections: [
            {
                heading: "The seven dimensions AI search evaluates",
                content: [
                    "1. Schema & Structured Data (20%): Is JSON-LD present to declare entity identity and content type?",
                    "2. Content Depth & Quality (18%): Does your page provide enough specific, verifiable claims for AI to extract something useful?",
                    "3. Meta Tags & Open Graph (15%): Meta title, meta description, Open Graph tags — complete and consistent.",
                    "4. Technical SEO (15%): HTTPS, canonical URLs, proper rendering, page speed.",
                    "5. AI Readability & Citability (12%): Can the content be parsed structurally — headings, semantic HTML, atomic claims?",
                    "6. Heading Structure (10%): Clear H1→H2→H3 hierarchy that segments content for extraction.",
                    "7. Security & Trust (10%): Robots.txt accessibility, AI crawler allowances, author entity verification, and link diversity.",
                ],
            },
            {
                heading: "What Google visibility does and doesn't transfer",
                content: [
                    "Technical SEO overlap: HTTPS, canonical URLs, page speed, and proper HTML structure benefit both Google and AI visibility.",
                    "Does not transfer: backlinks, keyword density, domain authority, social signals. These Google signals have no direct equivalent in the AI extraction pipeline.",
                    "New requirements: crawler allowances for AI bots (robots.txt), JSON-LD entity schema, and server-side rendering or pre-rendering for client-heavy sites.",
                ],
            },
        ],
        faqs: [
            {
                question: "Is AI search visibility the same for all AI tools?",
                answer:
                    "The core requirements are shared (crawler access, schema, rendering), but different tools weight context differently. ChatGPT's browsing favors recency, Perplexity favors citation-dense content, and Google AI Overview favors structured Q&A markup.",
            },
            {
                question: "How is AI search visibility measured?",
                answer:
                    "AiVIS.biz measures it across seven scored dimensions, producing a composite 0–100 score with BRAG evidence IDs tracing each dimension to crawl observations.",
            },
        ],
        internalLinks: [
            { label: "Run a free audit", to: "/app/analyze" },
            { label: "Methodology", to: "/methodology" },
            { label: "How to optimize for AI answer engines", to: "/problems/how-to-optimize-for-ai-answer-engines" },
            { label: "Guide: tool routing", to: "/guide#tool-routing" },
        ],
        ctaText: "Measure your AI search visibility",
        ctaLink: "/app/analyze",
    },

    {
        slug: "how-ai-models-read-websites",
        cluster: "problems",
        title: "How Do AI Models Read Websites",
        metaTitle: "How AI Models Read Websites — Technical Explainer | AiVIS.biz",
        metaDescription:
            "AI models don't read websites like humans. They extract signals from HTML: headings, schema, rendered text, and metadata. Here's the full process.",
        primaryKeyword: "how do ai models read websites",
        secondaryKeyword: "how ai crawls websites",
        hook: "Understanding exactly how AI reads your site is the most valuable thing you can do before optimizing anything. The process is completely different from what a human sees.",
        sections: [
            {
                heading: "Step-by-step: how AI models access and parse a webpage",
                content: [
                    "Step 1 — HTTP request: The AI crawler sends an HTTP GET request with a specific user-agent (GPTBot, ClaudeBot, PerplexityBot). Your server responds with the HTML document.",
                    "Step 2 — HTML parsing: The crawler parses the raw HTML. It looks for content in the <body>, structured data in <script type='application/ld+json'>, metadata in <head>, and heading hierarchy throughout.",
                    "Step 3 — Content extraction: Text is extracted from semantic elements: <h1>, <h2>, <p>, <article>, <section>. Navigation, footers, and ads are typically de-weighted or discarded.",
                    "Step 4 — Representation: The extracted content is compressed into a latent representation (for training data) or structured fragments (for real-time retrieval).",
                    "Step 5 — Attribution: The crawler records the source URL, domain, and any entity metadata from JSON-LD.",
                ],
            },
            {
                heading: "What AI models cannot do when reading websites",
                content: [
                    "Execute JavaScript. Most AI crawlers do not run client-side JavaScript. SPA content that appears after JS execution is invisible.",
                    "Authenticate. Content behind login or cookie consent walls is inaccessible.",
                    "Process images without alt text. Images without alt attributes deliver no text signal.",
                    "Interpret layout. AI crawlers extract text content; visual hierarchy and design are irrelevant.",
                ],
            },
        ],
        faqs: [
            {
                question: "Do all AI crawlers read websites the same way?",
                answer:
                    "Roughly the same. The core pipeline (HTTP request → HTML parse → text extraction → representation) is shared. Differences are in JavaScript execution capability (some newer crawlers handle JS), crawl frequency, and attribution weighting.",
            },
            {
                question: "Can I see what an AI crawler sees on my page?",
                answer:
                    "Use 'View Source' in your browser to see the raw HTML — that is the closest approximation of what an AI crawler receives. AiVIS.biz replicates the crawl experience more precisely using a headless browser with AI crawler user-agents.",
            },
        ],
        internalLinks: [
            { label: "Run a free audit", to: "/app/analyze" },
            { label: "How to make website AI-readable", to: "/problems/how-to-make-website-ai-readable" },
            { label: "JavaScript rendering blocks AI", to: "/problems/javascript-rendering-blocks-ai" },
            { label: "Guide: start here", to: "/guide#start-here" },
        ],
        ctaText: "See what AI sees on your site",
        ctaLink: "/app/analyze",
    },

    // ── Category 3: Fix Intent ───────────────────────────────────────────

    {
        slug: "how-to-get-site-mentioned-in-chatgpt",
        cluster: "problems",
        title: "How to Get Your Site Mentioned in ChatGPT",
        metaTitle: "How to Get Your Site Mentioned in ChatGPT | AiVIS.biz",
        metaDescription:
            "Getting mentioned in ChatGPT requires GPTBot access, server-side rendering, and complete JSON-LD. Here's the full fix sequence.",
        primaryKeyword: "how to get my site mentioned in chatgpt",
        secondaryKeyword: "get website in chatgpt answers",
        hook: "Getting your site mentioned in ChatGPT is achievable in a week. Not by paying, not by publishing more content — by fixing the three structural things GPTBot requires.",
        sections: [
            {
                heading: "The three-step fix sequence",
                content: [
                    "Step 1 — Unblock GPTBot. Edit your robots.txt to allow GPTBot explicitly. If you use Cloudflare, check Bot Fight Mode settings. Verify with: curl -A GPTBot https://yoursite.com/robots.txt",
                    "Step 2 — Ensure server-side rendering. If your site is a React/Vue/Angular SPA without SSR, ChatGPT receives empty HTML. Next.js, Astro, or static pre-rendering solves this. Check with View Source.",
                    "Step 3 — Add Organization JSON-LD. In your <head>: a single JSON-LD block with @type: Organization, name, url, sameAs links (LinkedIn, GitHub, Twitter). This gives ChatGPT a verified identity to attribute content to.",
                ],
            },
            {
                heading: "After the basics: maximize citation probability",
                content: [
                    "Add Article schema with datePublished, author, and publisher to your top content pages.",
                    "Add FAQ schema to any page with question-answer format. ChatGPT heavily extracts FAQs for direct inclusion in answers.",
                    "Write specific, verifiable statements instead of marketing language. ChatGPT prefers factual claims over promotional copy.",
                    "Run an AiVIS.biz audit to find secondary blockers after the three primary issues are fixed.",
                ],
            },
        ],
        faqs: [
            {
                question: "How long after fixing robots.txt will ChatGPT recrawl?",
                answer:
                    "GPTBot crawl frequency varies, but most sites are recrawled within days to a few weeks after robots.txt changes. For browsing (real-time), the change takes effect on the next ChatGPT browsing session that queries your topic.",
            },
            {
                question: "Does my page need to rank in Google to appear in ChatGPT?",
                answer:
                    "No. ChatGPT's browsing crawls independently of Google. However, pages that rank well in Google tend to have stronger structural signals, which correlates with ChatGPT citation readiness.",
            },
        ],
        internalLinks: [
            { label: "Run a free audit", to: "/app/analyze" },
            { label: "Why ChatGPT ignores my site", to: "/problems/why-chatgpt-ignores-my-site" },
            { label: "JSON-LD guide", to: "/signals/json-ld" },
            { label: "Guide: execute fixes", to: "/guide#execute-fixes" },
        ],
        ctaText: "Audit your ChatGPT readiness",
        ctaLink: "/app/analyze",
    },

    {
        slug: "how-to-make-ai-cite-my-website",
        cluster: "problems",
        title: "How to Make AI Cite My Website",
        metaTitle: "How to Make AI Cite My Website — Complete Guide | AiVIS.biz",
        metaDescription:
            "AI citation requires three things: crawl access, extractable structure, and declared entity identity. Here is exactly how to achieve all three.",
        primaryKeyword: "how to make ai cite my website",
        secondaryKeyword: "get ai to cite my site",
        hook: "AI citation is not luck. It is not authority. It is the output of three specific structural conditions that you can implement on any site.",
        sections: [
            {
                heading: "The citation requirements — in order of impact",
                content: [
                    "1. Crawl access (critical): GPTBot, ClaudeBot, and PerplexityBot must reach your page. Check robots.txt and CDN bot settings. Without this, everything else is irrelevant.",
                    "2. Extractable content (high impact): Server-side rendered HTML, semantic headings, clear paragraph structure. AI models extract fragments — make each fragment usable independently.",
                    "3. Entity attribution (high impact): Organization JSON-LD with sameAs links. Author schema on content pages. datePublished on all dated content. This is what converts extracted content into a citation.",
                ],
            },
            {
                heading: "Citation-optimized content structure",
                content: [
                    "For informational pages: H1 states the topic, H2 headings answer sub-questions, paragraphs contain one verifiable claim each. Add FAQ JSON-LD for the question-answer blocks.",
                    "For product/service pages: Product or Service schema with description, offers, and category. Organization schema linking to your brand identity.",
                    "For all pages: meta description summarizes the page's main claim in under 160 characters. Canonical URL set and consistent.",
                ],
            },
        ],
        faqs: [
            {
                question: "Is citation the same as a link back to my site?",
                answer:
                    "Not always. Some AI tools cite with a link (Perplexity, ChatGPT browsing). Others use your content without linking (training-data responses). Extraction readiness improves both types of citation.",
            },
            {
                question: "What is the single highest-impact change I can make today?",
                answer:
                    "Check robots.txt and unblock AI crawlers. This is a five-minute edit that eliminates the most common reason sites are never cited — the crawler could never even reach the page.",
            },
        ],
        internalLinks: [
            { label: "Run a free audit", to: "/app/analyze" },
            { label: "How to get cited by AI models", to: "/problems/how-to-get-cited-by-ai-models" },
            { label: "How to improve AI citation readiness", to: "/problems/how-to-improve-ai-citation-readiness" },
            { label: "Guide: retest and prove", to: "/guide#retest-and-prove" },
        ],
        ctaText: "Start earning AI citations",
        ctaLink: "/app/analyze",
    },

    {
        slug: "how-to-make-content-show-in-ai-results",
        cluster: "problems",
        title: "How to Make My Content Show in AI Results",
        metaTitle: "How to Make Content Show in AI Results | AiVIS.biz",
        metaDescription:
            "AI results pull from extractable, attributed content. Structure your pages correctly and your content gets included — not paraphrased and credited elsewhere.",
        primaryKeyword: "how to make my content show in ai results",
        secondaryKeyword: "content visibility in ai results",
        hook: "Your content is being paraphrased in AI results, credited to someone else, or simply absent. Here is how to change that.",
        sections: [
            {
                heading: " The content format AI results extract from",
                content: [
                    "AI extraction works best on content that is: specific (not vague), structured (headings and schema), atomic (one claim per paragraph), and attributed (author, date, organization).",
                    "The worst-performing content in AI results: long, rambling paragraphs with no headings; promotional copy with no specific claims; JavaScript-rendered pages; pages with no schema markup.",
                    "The best-performing: Q&A formatted with FAQ schema, how-to steps with HowTo schema, factual claims with Article schema and datePublished.",
                ],
            },
            {
                heading: "Quick wins for getting content into AI results",
                content: [
                    "First: rewrite your top three pages. Replace vague benefit statements with specific factual claims. Add or restructure headings so each H2 answers a discrete question.",
                    "Second: add FAQ schema to every page with Q&A content. Takes 15 minutes per page and is the single highest-leverage schema change for AI result inclusion.",
                    "Third: run an AiVIS.biz audit to see the full extraction signal picture — schema coverage, rendering issues, heading structure, and metadata across all seven dimensions.",
                ],
            },
        ],
        faqs: [
            {
                question: "Does viral or popular content get shown in AI results more?",
                answer:
                    "Not from a structural standpoint. AI extraction does not use social signals, share counts, or traffic metrics. Structural readiness (schema, rendering, attribution) is what determines extraction — not virality.",
            },
            {
                question: "Will AI show my content verbatim or rewrite it?",
                answer:
                    "AI models typically paraphrase unless they have explicit citation instructions. FAQ schema and precise factual claims are the closest to verbatim extraction — the model lifts the Q-A pair directly.",
            },
        ],
        internalLinks: [
            { label: "Run a free audit", to: "/app/analyze" },
            { label: "FAQ schema signal", to: "/signals/faq-schema" },
            { label: "Content depth", to: "/problems/thin-content" },
            { label: "Guide: execute fixes", to: "/guide#execute-fixes" },
        ],
        ctaText: "Get your content into AI results",
        ctaLink: "/app/analyze",
    },

    {
        slug: "how-to-structure-content-for-ai-models",
        cluster: "problems",
        title: "How to Structure Content for AI Models",
        metaTitle: "How to Structure Content for AI Models | AiVIS.biz",
        metaDescription:
            "AI models extract from structured content: semantic headings, atomic claims, FAQ markup, and JSON-LD. This is the complete structure guide.",
        primaryKeyword: "how to structure content for ai models",
        secondaryKeyword: "ai content structure best practices",
        hook: "Content structure for AI models is different from content structure for human readers. Optimize for extraction, not engagement.",
        sections: [
            {
                heading: "The extraction-first content structure",
                content: [
                    "H1: single, clear statement of the page topic. No cleverness — clarity.",
                    "H2: each heading should answer a specific question related to the H1 topic. Write H2s as if they are FAQ entries.",
                    "Paragraphs: one verifiable claim per paragraph. Atomic. Avoid compound sentences that mix two claims.",
                    "Lists: use for steps, requirements, and enumerable facts. AI models extract lists efficiently.",
                    "Conclusion: summarize the page's main claim in two sentences. AI models often extract the final summary.",
                ],
            },
            {
                heading: "Schema markup by content type",
                content: [
                    "Blog posts and articles: Article schema with headline, datePublished, author (Person schema), publisher (Organization).",
                    "FAQ content: FAQPage schema with Question and Answer for each pair.",
                    "How-to guides: HowTo schema with HowToStep for each numbered step.",
                    "Product/service pages: Product or Service schema with description and offers.",
                    "All pages: Organization schema in the site header (once globally), BreadcrumbList for hierarchy, canonical URL.",
                ],
            },
        ],
        faqs: [
            {
                question: "Should I write shorter content for AI or longer?",
                answer:
                    "Content depth matters (20% of AiVIS.biz score), but length without structure is noise. Target 600+ words with clear headings, specific claims, and schema markup. Quality of structure over raw word count.",
            },
            {
                question: "Do I need to restructure my entire site for AI?",
                answer:
                    "No. Start with your highest-value pages. Apply the content structure to your primary service page, homepage, and top content page. Then expand. AiVIS.biz tracks individual page scores so you can measure improvement page by page.",
            },
        ],
        internalLinks: [
            { label: "Run a free audit", to: "/app/analyze" },
            { label: "Heading structure signal", to: "/signals/heading-hierarchy" },
            { label: "Schema.org signals", to: "/signals/schema-org" },
            { label: "Guide: execute fixes", to: "/guide#execute-fixes" },
        ],
        ctaText: "Audit your content structure",
        ctaLink: "/app/analyze",
    },

    // ── Category 4: Comparison / Curiosity ──────────────────────────────

    {
        slug: "seo-vs-ai-search-difference",
        cluster: "problems",
        title: "SEO vs AI Search: What's Actually Different",
        metaTitle: "SEO vs AI Search — What's Different & What Transfers | AiVIS.biz",
        metaDescription:
            "SEO and AI search optimization share some fundamentals but diverge on source selection criteria. Here's exactly what transfers and what doesn't.",
        primaryKeyword: "seo vs ai search what's different",
        secondaryKeyword: "seo versus ai search",
        hook: "You have been doing SEO for years. Does it help with AI search? Some of it does. Most of it doesn't. Here is the precise breakdown.",
        sections: [
            {
                heading: "What transfers from SEO to AI search",
                content: [
                    "Technical SEO: HTTPS, canonical URLs, proper status codes, clean URL structure, page speed. These are universal web quality signals that both systems value.",
                    "Structured content: Clear headings, semantic HTML, good meta descriptions. These help both Google and AI crawlers parse your content.",
                    "Content quality: Depth, specificity, and factual accuracy matter in both systems — for different reasons. Google weights them for ranking; AI models weight them for extraction.",
                ],
            },
            {
                heading: "What does NOT transfer (and what replaces it)",
                content: [
                    "Backlinks: Do not affect AI extraction at all. Replaced by: entity schema with sameAs links to verified profiles.",
                    "Domain authority: No bearing on AI source selection. Replaced by: JSON-LD completeness and content attribution.",
                    "Keyword density: AI models extract semantic meaning. Keyword percentage is irrelevant. Replaced by: specific, verifiable claims in natural language.",
                    "Title tag optimization: Matters less individually. Replaced by: the alignment of H1, Organization schema description, and meta description as a consistent entity signal.",
                    "AI search specifically requires: robots.txt allowances for AI crawlers, server-side rendering, and JSON-LD entity declarations. These have no SEO equivalent.",
                ],
            },
        ],
        faqs: [
            {
                question: "Should I replace my SEO efforts with AI search optimization?",
                answer:
                    "No. They complement each other. A well-structured site optimized for both captures traditional search clicks and AI answer engine citations. The overlap is large enough that most AI optimizations also improve SEO.",
            },
            {
                question: "Is AiVIS.biz an SEO tool?",
                answer:
                    "AiVIS.biz is an AI extraction readiness audit tool. It overlaps with SEO on technical signals but focuses specifically on whether AI models can access, extract, and attribute your content — not on Google rankings.",
            },
        ],
        internalLinks: [
            { label: "Run a free audit", to: "/app/analyze" },
            { label: "What makes a website visible to AI search", to: "/problems/what-makes-website-visible-to-ai-search" },
            { label: "Methodology", to: "/methodology" },
            { label: "AiVIS.biz vs SEO tools", to: "/compare/aivis-vs-moz" },
        ],
        ctaText: "See your AI search readiness",
        ctaLink: "/app/analyze",
    },

    {
        slug: "why-ai-search-replacing-google-clicks",
        cluster: "problems",
        title: "Why AI Search Is Replacing Google Clicks",
        metaTitle: "Why AI Search Is Replacing Google Clicks | AiVIS.biz",
        metaDescription:
            "AI answer engines synthesize answers instead of linking to results. Understand the shift and what it means for your site's traffic and visibility.",
        primaryKeyword: "why ai search is replacing google clicks",
        secondaryKeyword: "ai search vs google traffic",
        hook: "Google traffic is declining for informational queries. The clicks that used to land on your site are now absorbed by AI answers that never send a user anywhere. Here is what that means and what to do about it.",
        sections: [
            {
                heading: "The mechanism behind the traffic shift",
                content: [
                    "Traditional search: user queries Google, sees ten blue links, clicks one or more, lands on website.",
                    "AI search: user queries ChatGPT/Perplexity/Google AI, receives a synthesized answer with source citations. Many users get their answer without clicking any link.",
                    "The content still exists on your site. AI extracted it, or extracted from a competitor, to build the answer. Your site either participated as a cited source — or was bypassed entirely.",
                ],
            },
            {
                heading: "Two strategies for the AI search era",
                content: [
                    "Strategy 1 — Be the cited source: When AI uses your content to build the answer, you appear as a source citation in Perplexity, ChatGPT, and Google AI Overview. Users who want depth click through. This is the citation optimization path.",
                    "Strategy 2 — Target queries AI answers poorly: Find long-tail, specific, or highly personalized queries that AI consistently answers inadequately. These still drive clicks because the AI answer is insufficient.",
                    "AiVIS.biz supports Strategy 1 with extraction readiness audits and citation testing, and Strategy 2 with niche discovery tools (Alignment tier).",
                ],
            },
        ],
        faqs: [
            {
                question: "Is this shift permanent?",
                answer:
                    "The AI answer engine trend is structural and growing. The percentage of queries answered without a click has increased consistently. Planning for citation optimization now is the preparation for where search is heading.",
            },
            {
                question: "Will Google ever roll back AI Overviews?",
                answer:
                    "There have been quality adjustments, but the AI Overview direction is confirmed. Optimizing for both traditional SEO and AI extraction readiness simultaneously is the safest strategy.",
            },
        ],
        internalLinks: [
            { label: "Run a free audit", to: "/app/analyze" },
            { label: "How to optimize for AI answer engines", to: "/problems/how-to-optimize-for-ai-answer-engines" },
            { label: "Citation testing", to: "/citations" },
            { label: "Guide: start here", to: "/guide#start-here" },
        ],
        ctaText: "Adapt to AI search now",
        ctaLink: "/app/analyze",
    },

    // ── Category 5: Founder / Builder Mindset ───────────────────────────

    {
        slug: "saas-show-up-in-chatgpt",
        cluster: "problems",
        title: "How to Make My SaaS Show Up in ChatGPT",
        metaTitle: "How to Make Your SaaS Show Up in ChatGPT | AiVIS.biz",
        metaDescription:
            "SaaS products need SoftwareApplication schema, feature-specific landing pages, and clear entity identity to appear in ChatGPT product recommendations.",
        primaryKeyword: "how to make my saas show up in chatgpt",
        secondaryKeyword: "saas chatgpt visibility",
        hook: "Someone asks ChatGPT for 'the best tool for X' — your tool does X, and ChatGPT recommends three competitors. Here is why that happens and what to fix.",
        sections: [
            {
                heading: "How ChatGPT decides which SaaS tools to recommend",
                content: [
                    "When ChatGPT recommends tools, it draws on two sources: training data (from web crawls before the knowledge cutoff) and real-time browsing. Your SaaS product needs strong extraction signals in both.",
                    "For training data: your product pages, directory listings (G2, Capterra, Product Hunt), and documentation must have been structurally sound at the time of OpenAI's last major crawl.",
                    "For browsing: your site must be accessible to GPTBot right now, with SoftwareApplication or Product schema that declares your product's category and capabilities.",
                ],
            },
            {
                heading: "SaaS-specific optimization steps",
                content: [
                    "Add SoftwareApplication JSON-LD to your product home page: name, description, applicationCategory, offers/price, featureList.",
                    "Create specific use-case landing pages for your primary categories. ChatGPT recommendation context matches against 'best tool for [specific use case]' — vague 'all-in-one' positioning extracts poorly.",
                    "Claim and complete your Product Hunt, G2, Capterra, and Crunchbase listings with consistent naming. Add sameAs links from your Organization schema to all profiles.",
                    "Run an AiVIS.biz audit on your product pages — SaaS pages often fail on schema coverage and content specificity.",
                ],
            },
        ],
        faqs: [
            {
                question: "Does being on Product Hunt help with ChatGPT mentions?",
                answer:
                    "Yes. Product Hunt is indexed by AI systems and provides external entity confirmation for your product. It makes your sameAs linkage stronger and gives AI models an additional extraction source.",
            },
            {
                question: "How do I know if ChatGPT currently recommends my competitor instead of me?",
                answer:
                    "AiVIS.biz citation testing (Signal tier) queries AI models for your primary use cases and reports which brands appear, in what position, and compared to your domain.",
            },
        ],
        internalLinks: [
            { label: "Run a free audit", to: "/app/analyze" },
            { label: "SaaS AI visibility guide", to: "/industries/saas" },
            { label: "Citation testing", to: "/citations" },
            { label: "Why AI doesn't cite my website", to: "/problems/why-ai-doesnt-cite-my-website" },
        ],
        ctaText: "Audit your SaaS extraction readiness",
        ctaLink: "/app/analyze",
    },

    {
        slug: "startup-not-mentioned-in-ai-answers",
        cluster: "problems",
        title: "Why My Startup Is Not Mentioned in AI Answers",
        metaTitle: "Why My Startup Isn't in AI Answers — Fix It | AiVIS.biz",
        metaDescription:
            "Startups are absent from AI answers because of weak entity signals, not weak products. Fix Organization schema, sameAs links, and content structure.",
        primaryKeyword: "startup not mentioned in ai answers",
        secondaryKeyword: "startup invisible to ai",
        hook: "Your startup is solving a real problem. AI answers about that problem never mention you. This is an entity signal problem, not a product problem.",
        sections: [
            {
                heading: "Why startups are disproportionately absent from AI answers",
                content: [
                    "Established companies have years of indexed content, third-party mentions, and directory listings that build entity density in AI crawl corpora. A new startup has none of that history.",
                    "But this is not unfixable. The structural signals that build AI entity recognition can be established quickly: Organization schema with verified profile links, specific use-case content pages, and a few strategic directory listings.",
                ],
            },
            {
                heading: "Startup-specific entity building checklist",
                content: [
                    "1. Organization JSON-LD on homepage: name, url, legalName, description, foundingDate, founder (Person schema), sameAs.",
                    "2. sameAs profiles to build: LinkedIn Company, Twitter/X, GitHub, Product Hunt (for tech), Crunchbase or AngelList, Wikipedia if applicable.",
                    "3. One authoritative feature/product landing page per primary use case. Write specific claims, not broad positioning.",
                    "4. llms.txt at your site root: explicitly declare your product category, founder, and canonical use cases. AI models can read this to build entity context without relying solely on content parsing.",
                    "5. AiVIS.biz audit to identify specific extraction gaps in your current site.",
                ],
            },
        ],
        faqs: [
            {
                question: "Does a startup need many pages to appear in AI answers?",
                answer:
                    "No. Even a 5-page startup site with correct Organization schema, one strong product page with SoftwareApplication or Service schema, and a working llms.txt can appear in AI answers. Quality and structure beat quantity.",
            },
            {
                question: "How long before a new startup starts appearing in AI answers?",
                answer:
                    "With all structural signals in place, real-time AI browsing tools (Perplexity, ChatGPT browsing) can pick up new content within days to weeks. Training-data incorporation takes longer — months — but structural readiness prepares you for both.",
            },
        ],
        internalLinks: [
            { label: "Run a free audit", to: "/app/analyze" },
            { label: "Fix entity confusion in AI", to: "/problems/how-to-fix-entity-confusion-in-ai" },
            { label: "llms.txt signal", to: "/signals/llms-txt" },
            { label: "Schema.org guide", to: "/signals/schema-org" },
        ],
        ctaText: "Build your startup's AI entity",
        ctaLink: "/app/analyze",
    },

    // ── Category 6: High-Signal Long Queries ────────────────────────────

    {
        slug: "why-chatgpt-uses-some-sites-not-mine",
        cluster: "problems",
        title: "Why Does ChatGPT Use Some Websites as Sources But Not Mine",
        metaTitle: "Why ChatGPT Uses Some Websites as Sources But Not Mine | AiVIS.biz",
        metaDescription:
            "ChatGPT uses sites that pass all four extraction stages: crawler access, rendered content, structured data, and specific claims. Here's the gap diagnosis.",
        primaryKeyword: "why does chatgpt use some websites as sources but not mine",
        secondaryKeyword: "chatgpt sources some websites but not others",
        hook: "You have watched ChatGPT cite a blog with half your content depth and a domain you've never heard of. You have the better answer. They have better extraction signals.",
        sections: [
            {
                heading: "The full comparison: why that site gets cited and yours doesn't",
                content: [
                    "ChatGPT-cited sites consistently share these five traits: (1) robots.txt explicitly allows GPTBot, (2) content is server-rendered and in the HTML response, (3) Organization and/or Article JSON-LD is present, (4) content is written in specific, verifiable statements rather than vague marketing language, (5) datePublished metadata is present on content.",
                    "The site you are comparing yourself to probably has all five. Your site may be missing one or more — and that single gap is enough to remove you from the candidate pool.",
                ],
            },
            {
                heading: "How to find your gap vs a specific competitor",
                content: [
                    "Run an AiVIS.biz audit on your page. Then (on Alignment tier) run a competitor audit on the page that is getting cited. The side-by-side comparison shows exactly where their extraction signals are stronger.",
                    "In most cases, the gap is narrower than it appears. One missing schema type, one robots.txt entry, one rendering fix — and the extraction quality equalizes or surpasses.",
                ],
            },
        ],
        faqs: [
            {
                question: "Does the site that gets cited always have better content?",
                answer:
                    "Not always. In AiVIS.biz's audit data, structurally strong sites with moderate content often outrank structurally weak sites with brilliant content. Extraction readiness is more deterministic than content quality in the AI pipeline.",
            },
            {
                question: "Can I use AiVIS.biz to audit the competitor who is being cited instead of me?",
                answer:
                    "Yes. Alignment tier includes competitor tracking and side-by-side extraction readiness comparison across shared topic pages.",
            },
        ],
        internalLinks: [
            { label: "Run a free audit", to: "/app/analyze" },
            { label: "Why AI attributes content to competitors", to: "/problems/why-ai-attributes-my-content-to-competitors" },
            { label: "Competitor tracking", to: "/competitors" },
            { label: "Pricing", to: "/pricing" },
        ],
        ctaText: "Compare against what's being cited",
        ctaLink: "/app/analyze",
    },

    {
        slug: "how-to-know-if-ai-can-read-my-website",
        cluster: "problems",
        title: "How to Know If AI Can Read My Website Correctly",
        metaTitle: "How to Know If AI Can Read Your Website | AiVIS.biz",
        metaDescription:
            "Test if AI can read your website with manual checks (robots.txt, View Source) and an AiVIS.biz audit across all seven extraction dimensions.",
        primaryKeyword: "how to know if ai can read my website",
        secondaryKeyword: "test ai website readability",
        hook: "You cannot see what AI sees on your site. Here is how to check — quickly, specifically, and without guessing.",
        sections: [
            {
                heading: "Manual test sequence (5 minutes)",
                content: [
                    "Test 1 — robots.txt: Visit yoursite.com/robots.txt. Search for GPTBot, ClaudeBot, PerplexityBot, anthropic-ai. If any say 'Disallow: /', that crawler is blocked.",
                    "Test 2 — View Source: Right-click your page, View Source (not Inspect). Look at the <body>. If it contains mostly script tags with minimal text content, your site is client-rendered. AI cannot read it.",
                    "Test 3 — JSON-LD check: In View Source, search for 'application/ld+json'. If not found, your site has no structured data. If found, check for @type: Organization at minimum.",
                    "Test 4 — Meta description: In View Source, search for 'name=\"description\"'. If missing, your meta description is absent.",
                ],
            },
            {
                heading: "After manual checks: run a full audit",
                content: [
                    "Manual checks cover the four most critical failure points. But there are 50+ extraction signals across seven dimensions. An AiVIS.biz audit checks all of them in under two minutes, assigns a composite score, and provides prioritized fix recommendations with BRAG evidence IDs.",
                    "Observer tier is free. Enter any URL and get your extraction readiness assessment with your top blockers identified.",
                ],
            },
        ],
        faqs: [
            {
                question: "Is there a way to simulate exactly what GPTBot sees?",
                answer:
                    "AiVIS.biz uses a headless Chromium browser with AI crawler user-agents to fetch pages, simulating the AI crawl experience more closely than standard tools. The rendering and extraction simulation is the closest proxy to actual GPTBot behavior.",
            },
            {
                question: "My View Source shows some content, but not all of it — what does that mean?",
                answer:
                    "Partial server-side rendering means some content is available to AI crawlers but some is not. The content missing from View Source is JavaScript-rendered and invisible to most AI crawlers. Run an AiVIS.biz audit to see exactly which content is and isn't extractable.",
            },
        ],
        internalLinks: [
            { label: "Run a free audit", to: "/app/analyze" },
            { label: "Test if AI can extract your content", to: "/problems/how-to-test-if-ai-can-extract-your-content" },
            { label: "How AI models read websites", to: "/problems/how-ai-models-read-websites" },
            { label: "Guide: run first audit", to: "/guide#run-first-audit" },
        ],
        ctaText: "Get the full AI readability test",
        ctaLink: "/app/analyze",
    },

    {
        slug: "why-ai-rewrites-instead-of-linking",
        cluster: "problems",
        title: "Why Does AI Rewrite My Content Instead of Linking to It",
        metaTitle: "Why AI Rewrites Content Instead of Linking | AiVIS.biz",
        metaDescription:
            "AI models rewrite and paraphrase by design. To get cited with attribution instead of paraphrased without credit, you need specific entity signals.",
        primaryKeyword: "why does ai rewrite my content instead of linking it",
        secondaryKeyword: "ai paraphrasing instead of citing",
        hook: "Your content ends up in AI answers — rewritten and uncredited. This is technically worse than being ignored: someone else's AI answer is being built on your work.",
        sections: [
            {
                heading: "Why AI paraphrases instead of citing",
                content: [
                    "AI model architecture: language models reconstruct responses from latent representations of training data. They do not look up pages and quote them. They generate text that reflects what they learned from your content, usually without explicit attribution.",
                    "Real-time retrieval tools (ChatGPT browsing, Perplexity) are different — they do need to cite sources because they are explicitly retrieving and presenting information. But even these systems only cite sources they can attribute to a domain with entity clarity.",
                ],
            },
            {
                heading: "Increasing attribution vs. paraphrase in AI responses",
                content: [
                    "For real-time tools (Perplexity, ChatGPT browsing): The more clearly your Organization and Article schema declares your entity identity, the more likely these tools are to cite you by name. Anonymous content gets paraphrased; attributed content gets cited.",
                    "For training-data tools (Claude, Gemini base): You cannot force direct citation, but strong entity signals and consistent domain presence make your entity more recognizable in model responses.",
                    "FAQ schema is the highest-leverage format change: it creates attribution-ready Q-A pairs that retrieval systems can directly cite rather than paraphrase.",
                ],
            },
        ],
        faqs: [
            {
                question: "Is there any way to prevent AI from using my content?",
                answer:
                    "You can block AI crawlers in robots.txt. This prevents training data collection and real-time retrieval. However, this also eliminates citation opportunities entirely. The robots exclusion decision is a tradeoff — opt out completely or optimize for cited inclusion.",
            },
            {
                question: "Can I technically claim intellectual property on AI-generated content that came from my site?",
                answer:
                    "This is an evolving legal area. The practical approach is to optimize for cited attribution, which gives your brand credit and drives traffic — and to use structural signals that make your domain identifiable as the source.",
            },
        ],
        internalLinks: [
            { label: "Run a free audit", to: "/app/analyze" },
            { label: "How to make AI cite my website", to: "/problems/how-to-make-ai-cite-my-website" },
            { label: "FAQ schema", to: "/signals/faq-schema" },
            { label: "Blocked by robots.txt", to: "/problems/blocked-by-robots-txt" },
        ],
        ctaText: "Earn attribution instead of paraphrase",
        ctaLink: "/app/analyze",
    },

    {
        slug: "how-to-fix-content-ai-misunderstands",
        cluster: "problems",
        title: "How to Fix Content That AI Misunderstands",
        metaTitle: "Fix Content That AI Misunderstands | AiVIS.biz",
        metaDescription:
            "AI misunderstands content when extraction signals are ambiguous. Fix headings, schema, entity declarations, and content specificity for accurate AI interpretation.",
        primaryKeyword: "how to fix content that ai misunderstands",
        secondaryKeyword: "ai misinterpreting my content",
        hook: "AI misunderstands your content when the extraction inputs are ambiguous. Every misinterpretation has a structural cause — and a structural fix.",
        sections: [
            {
                heading: "Diagnosing why AI misunderstands your content",
                content: [
                    "Cause 1 — Ambiguous entity: Your Organization schema is missing or incomplete. AI cannot determine whether content about 'Acme' refers to your company, a competitor with a similar name, or the fictional company from cartoons.",
                    "Cause 2 — Mixed topics on one page: A single page covers multiple distinct topics without clear heading separation. AI extracts the page as a single bloc and the mixed content produces an incoherent summary.",
                    "Cause 3 — Promotional language: Sentences like 'We are the leading solution for...' are extraction noise. AI models extract factual claims, not superlatives. Replace with: 'Our product does X for Y, in Z time.'",
                    "Cause 4 — Missing temporal context: Undated content can be attributed to wrong contexts. Add datePublished even to evergreen content.",
                ],
            },
            {
                heading: "Content fixes for accurate AI interpretation",
                content: [
                    "Heading fix: Each H2 should address a single, specific sub-topic. If your H2 is 'Our Features', replace it with what the feature does: 'Automated extraction audit in under 2 minutes'.",
                    "Schema fix: Add complete Organization JSON-LD with legalName and sameAs. Add Article schema with datePublished and author to content pages.",
                    "Language fix: Replace benefit statements with specific, verifiable function descriptions. Run the page through an AiVIS.biz audit — the content depth dimension measures this.",
                    "Entity clarity fix: Use the exact same entity name in schema, in body copy, and in meta tags. Consistency is the disambiguation signal.",
                ],
            },
        ],
        faqs: [
            {
                question: "Will improving content structure break my existing SEO?",
                answer:
                    "No. The structural improvements (semantic headings, schema, specific claims) also align with Google's quality guidelines. AI extraction improvements almost always coincide with SEO quality improvements.",
            },
            {
                question: "How long before AI corrects its interpretation after I fix the signals?",
                answer:
                    "For real-time retrieval tools, the next crawl reflects your changes — days to weeks. For training-data models, interpretation updates happen on model update cycles — weeks to months.",
            },
        ],
        internalLinks: [
            { label: "Run a free audit", to: "/app/analyze" },
            { label: "AI misquotes my content", to: "/problems/why-ai-misquotes-my-content" },
            { label: "AI summarizing incorrectly", to: "/problems/ai-summarizing-my-site-incorrectly" },
            { label: "Guide: read results correctly", to: "/guide#read-results-correctly" },
        ],
        ctaText: "Find what's causing misinterpretation",
        ctaLink: "/app/analyze",
    },
];
