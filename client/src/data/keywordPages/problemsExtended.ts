import type { KeywordPage } from "./types";

/**
 * 20 additional problem-diagnostic pages targeting high-intent
 * AI-answer search queries. These complement the original 20
 * technical problem pages with query-first, question-oriented content.
 */
export const problemExtendedPages: KeywordPage[] = [
    {
        slug: "why-ai-doesnt-cite-my-website",
        cluster: "problems",
        title: "Why AI Doesn't Cite My Website",
        metaTitle: "Why AI Doesn't Cite My Website — Diagnosis | AiVIS.biz",
        metaDescription:
            "AI answer engines skip your site because they cannot extract, trust, or attribute your content. Diagnose exactly why with an evidence-backed audit.",
        primaryKeyword: "why ai doesn't cite my website",
        secondaryKeyword: "ai citation failure",
        hook: "Your content exists. Your site is indexed. But when someone asks ChatGPT, Perplexity, or Gemini a question you clearly answer — your site is nowhere in the response. Here is why, and what to fix.",
        sections: [
            {
                heading: "AI citation is not the same as search ranking",
                content: [
                    "Traditional search engines rank pages by relevance and authority signals. AI answer engines extract fragments from pages and reconstruct answers. A page can rank #1 in Google and still never appear in an AI-generated answer — because the extraction fails silently.",
                    "Citation requires three conditions: the AI crawler can access your page, the content can be extracted into a usable representation, and the extracted claims can be attributed back to your domain. If any of these breaks, you are invisible to AI answers.",
                ],
            },
            {
                heading: "The five most common extraction failures",
                content: [
                    "1. Blocked crawlers: Your robots.txt blocks GPTBot, ClaudeBot, or PerplexityBot. Many CDN and security configurations add blanket blocks for unknown user agents.",
                    "2. Client-side rendering: Your site uses React, Vue, or Angular without server-side rendering. AI crawlers receive an empty HTML shell with no content to extract.",
                    "3. Missing structured data: Without JSON-LD schema (Organization, Article, FAQ), AI models cannot reliably identify who published the content or when.",
                    "4. Thin or vague content: AI models compress pages into latent representations. Shallow content produces a weak signal that gets overridden by denser, more specific competitors.",
                    "5. No entity clarity: If your Organization schema is missing or incomplete, AI models cannot disambiguate your brand from similarly named entities.",
                ],
            },
            {
                heading: "How to diagnose citation failure",
                content: [
                    "Run an AiVIS.biz audit on your URL. The audit crawls your page exactly as AI models do, evaluates six extraction-readiness dimensions, and identifies which signals are present, missing, or broken.",
                    "Each finding includes a BRAG Evidence ID that traces the issue to the specific crawl observation. Fixes are prioritized by impact — start with the highest-confidence, highest-impact issues.",
                ],
            },
        ],
        faqs: [
            {
                question: "Can a high Google ranking guarantee AI citations?",
                answer:
                    "No. Google ranking and AI citation use different mechanisms. A page can rank #1 in traditional search and still be invisible to AI answer engines if the extraction pipeline fails.",
            },
            {
                question: "How long does it take to start appearing in AI answers?",
                answer:
                    "After fixing extraction issues, most sites see changes within 2–4 weeks as AI crawlers re-index the updated content. The timeline depends on crawl frequency and model update cycles.",
            },
        ],
        internalLinks: [
            { label: "Run a free audit", to: "/app/analyze" },
            { label: "Methodology", to: "/methodology" },
            { label: "Missing structured data", to: "/problems/missing-structured-data" },
            { label: "Blocked by robots.txt", to: "/problems/blocked-by-robots-txt" },
        ],
        ctaText: "Diagnose your citation failure",
        ctaLink: "/app/analyze",
    },
    {
        slug: "how-to-fix-ai-search-visibility",
        cluster: "problems",
        title: "How to Fix AI Search Visibility",
        metaTitle: "How to Fix AI Search Visibility — Step by Step | AiVIS.biz",
        metaDescription:
            "Fix your AI search visibility with evidence-backed audits. Identify extraction failures, add missing signals, and make your content citable by AI answer engines.",
        primaryKeyword: "how to fix ai search visibility",
        secondaryKeyword: "ai visibility fix",
        hook: "AI search visibility is not about keywords or backlinks. It is about whether AI models can structurally extract, trust, and cite your content. Here is how to fix it.",
        sections: [
            {
                heading: "Step 1: Audit your current extraction readiness",
                content: [
                    "Before fixing anything, you need a baseline. Run an AiVIS.biz audit to see exactly how AI models interpret your site right now. The audit scores six dimensions: content depth, schema coverage, AI readability, technical SEO, metadata quality, and heading structure.",
                    "Each dimension targets a specific failure mode in the AI extraction pipeline. Your lowest-scoring dimensions reveal the highest-impact fixes.",
                ],
            },
            {
                heading: "Step 2: Fix access and technical blockers",
                content: [
                    "Check robots.txt for GPTBot, ClaudeBot, and PerplexityBot blocks. Verify server-side rendering is enabled. Confirm HTTPS is enforced and canonical URLs are set. These are floor-level requirements — if AI crawlers cannot access your content, nothing else matters.",
                ],
            },
            {
                heading: "Step 3: Add structured data and entity signals",
                content: [
                    "Add JSON-LD schema: Organization (establishes entity identity), Article or BlogPosting (for content pages), FAQ (for Q&A content), and BreadcrumbList (for hierarchy). Ensure datePublished, author, and publisher properties are present and accurate.",
                    "Structured data is the primary mechanism AI models use for entity disambiguation. Without it, your content may be attributed to a competitor or to no source at all.",
                ],
            },
            {
                heading: "Step 4: Re-audit and track improvement",
                content: [
                    "After implementing fixes, re-audit to measure the delta. AiVIS.biz stores your previous baseline, so you can see exactly which issues were resolved, which regressed, and what score improvement resulted from each change.",
                ],
            },
        ],
        faqs: [
            {
                question: "How quickly will fixes improve AI visibility?",
                answer:
                    "Most structural fixes (schema, robots.txt, SSR) take effect within 2–4 weeks as AI crawlers re-index. Content improvements may take longer depending on crawl frequency.",
            },
            {
                question: "Do I need to redesign my site?",
                answer:
                    "Rarely. Most AI extraction fixes are configuration changes: updating robots.txt, adding JSON-LD, enabling SSR. No visual redesign is typically required.",
            },
        ],
        internalLinks: [
            { label: "Run a free audit", to: "/app/analyze" },
            { label: "Schema markup guide", to: "/signals/schema-org" },
            { label: "Robots.txt issues", to: "/problems/blocked-by-robots-txt" },
            { label: "Pricing", to: "/pricing" },
        ],
        ctaText: "Start fixing your AI visibility",
        ctaLink: "/app/analyze",
    },
    {
        slug: "why-chatgpt-ignores-my-site",
        cluster: "problems",
        title: "Why ChatGPT Ignores My Website",
        metaTitle: "Why ChatGPT Ignores My Website — Fix It | AiVIS.biz",
        metaDescription:
            "ChatGPT skips your site because GPTBot can't extract your content. Diagnose blocked crawlers, missing schema, and rendering issues with an evidence-backed audit.",
        primaryKeyword: "why chatgpt ignores my website",
        secondaryKeyword: "chatgpt can't find my site",
        hook: "ChatGPT with browsing and SearchGPT use GPTBot to crawl and extract content. If GPTBot cannot access, parse, or attribute your page, ChatGPT will cite someone else — or hallucinate.",
        sections: [
            {
                heading: "How ChatGPT decides what to cite",
                content: [
                    "When ChatGPT generates a response that draws on web content, it relies on GPTBot's crawl corpus and real-time browsing results. The model extracts fragments, compresses them, and reconstructs an answer. Pages that provide clear, atomic claims with structured metadata get cited. Pages that are vague, unstructured, or inaccessible get skipped.",
                    "ChatGPT does not 'ignore' your site out of preference. It ignores your site because the extraction pipeline failed at one or more stages.",
                ],
            },
            {
                heading: "Check if GPTBot can access your site",
                content: [
                    "Open your robots.txt file and search for GPTBot. If you see 'Disallow: /' under the GPTBot user-agent, ChatGPT cannot crawl any page on your site. Many CDN security configurations (Cloudflare Bot Fight Mode, Sucuri WAF) also block GPTBot by default.",
                    "An AiVIS.biz audit checks GPTBot access as part of the technical SEO dimension and flags blocked crawlers as high-confidence findings.",
                ],
            },
            {
                heading: "Ensure your content is extractable",
                content: [
                    "Even if GPTBot can access your page, it still needs to extract usable content. Client-side-only rendering produces an empty shell. Missing JSON-LD means the model cannot identify the publisher. Vague headings make it harder for the model to segment and attribute claims.",
                    "AiVIS.biz audits all six extraction dimensions and provides specific, code-level fix recommendations for each failure.",
                ],
            },
        ],
        faqs: [
            {
                question: "Does blocking GPTBot affect ChatGPT answers about my brand?",
                answer:
                    "Yes. If GPTBot is blocked, ChatGPT cannot crawl your site for real-time information. It may still have older training data, but real-time answers and citations will exclude your content.",
            },
            {
                question: "Can I allow GPTBot without allowing all AI crawlers?",
                answer:
                    "Yes. You can selectively allow GPTBot in robots.txt while blocking other crawlers. Each AI crawler has a different user-agent string.",
            },
        ],
        internalLinks: [
            { label: "Run a free audit", to: "/app/analyze" },
            { label: "Blocked by robots.txt", to: "/problems/blocked-by-robots-txt" },
            { label: "JavaScript rendering issues", to: "/problems/javascript-rendering-blocks-ai" },
            { label: "Platform guides", to: "/platforms" },
        ],
        ctaText: "Check if ChatGPT can read your site",
        ctaLink: "/app/analyze",
    },
    {
        slug: "why-perplexity-doesnt-mention-my-brand",
        cluster: "problems",
        title: "Why Perplexity Doesn't Mention My Brand",
        metaTitle: "Why Perplexity Doesn't Mention My Brand | AiVIS.biz",
        metaDescription:
            "Perplexity cites sources with clear entity identity and extractable claims. If your brand is missing, diagnose the extraction failure with an evidence-backed audit.",
        primaryKeyword: "perplexity doesn't mention my brand",
        secondaryKeyword: "perplexity ai citation",
        hook: "Perplexity is one of the most citation-heavy AI answer engines — it explicitly links to sources. If your brand is never cited, the problem is not relevance. It is extraction readiness.",
        sections: [
            {
                heading: "How Perplexity selects sources",
                content: [
                    "Perplexity uses PerplexityBot to crawl content and combines it with real-time web search results. When generating an answer, it retrieves candidate sources, evaluates extraction quality, and cites the sources it can most reliably attribute claims to.",
                    "Pages with clear entity identity (Organization schema), verifiable dates, and specific claims are cited more frequently than generic, unstructured content.",
                ],
            },
            {
                heading: "Common reasons Perplexity skips your brand",
                content: [
                    "PerplexityBot is blocked in robots.txt. Your site has no Organization or Article JSON-LD. Your content is too generic to extract specific, citable claims. Your page uses client-side rendering and delivers an empty HTML shell.",
                    "Perplexity also de-prioritizes sources with thin content or missing publication dates. If your article has no datePublished property, it may be treated as undated and deprioritized against timestamped alternatives.",
                ],
            },
            {
                heading: "How to get cited by Perplexity",
                content: [
                    "Allow PerplexityBot in robots.txt. Add Organization, Article, and FAQ JSON-LD. Include datePublished and author metadata. Write content with specific, verifiable claims rather than generalized advice. Run an AiVIS.biz audit to identify and fix the specific extraction failures.",
                ],
            },
        ],
        faqs: [
            {
                question: "Does Perplexity use a different crawler than ChatGPT?",
                answer:
                    "Yes. Perplexity uses PerplexityBot, ChatGPT uses GPTBot. Each has independent crawl behavior and robots.txt directives. You need to allow both separately.",
            },
            {
                question: "Can I test if Perplexity would cite my content?",
                answer:
                    "AiVIS.biz citation testing (Signal tier) evaluates whether your brand appears in AI answers and reports mention presence, position, and overlap with competitors.",
            },
        ],
        internalLinks: [
            { label: "Run a free audit", to: "/app/analyze" },
            { label: "Citation testing", to: "/citations" },
            { label: "Missing structured data", to: "/problems/missing-structured-data" },
            { label: "Signal tier", to: "/pricing" },
        ],
        ctaText: "Diagnose your Perplexity absence",
        ctaLink: "/app/analyze",
    },
    {
        slug: "how-to-get-cited-by-ai-models",
        cluster: "problems",
        title: "How to Get Cited by AI Answer Models",
        metaTitle: "How to Get Cited by AI Models — Evidence-Backed Guide | AiVIS.biz",
        metaDescription:
            "AI models cite content they can extract and trust. Learn the structural requirements for citation by ChatGPT, Perplexity, Gemini, and Claude.",
        primaryKeyword: "how to get cited by ai models",
        secondaryKeyword: "ai model citation requirements",
        hook: "AI citation is not earned through authority alone. It is earned through extraction readiness — providing the structural signals AI models need to extract, attribute, and reproduce your content.",
        sections: [
            {
                heading: "The three requirements for AI citation",
                content: [
                    "1. Access: AI crawlers (GPTBot, ClaudeBot, PerplexityBot) must be able to reach and render your page. Check robots.txt, CDN bot protection, and SSR configuration.",
                    "2. Extraction: The content must be parseable into discrete, verifiable claims. Clear headings, structured data, and atomic statements beat prose-heavy narrative.",
                    "3. Attribution: The page must declare entity identity through Organization schema, author metadata, and publication dates so the model can attribute claims to your domain.",
                ],
            },
            {
                heading: "Structural signals that increase citation probability",
                content: [
                    "JSON-LD Organization schema with name, url, and sameAs properties. Article schema with headline, datePublished, author, and publisher. FAQ schema for Q&A content. Clear H1 → H2 → H3 hierarchy. Meta descriptions that summarize the page's main claim. llms.txt file declaring canonical pages and entity identity.",
                ],
            },
            {
                heading: "What does not help with AI citation",
                content: [
                    "Backlink volume has no direct effect on AI extraction. Social media followers do not affect citation eligibility. Domain age is not a factor. Keyword density is irrelevant — AI models extract semantic meaning, not keyword matches.",
                    "Focus on extraction readiness: clear structure, declared identity, and verifiable claims.",
                ],
            },
        ],
        faqs: [
            {
                question: "Is there a guaranteed way to be cited by AI?",
                answer:
                    "No. Citation depends on query relevance, competitive content, and model behavior. AiVIS.biz measures structural readiness — providing the signals AI models need. The probability increases significantly, but no tool can guarantee citation.",
            },
            {
                question: "Which AI models are most likely to cite sources?",
                answer:
                    "Perplexity, ChatGPT with browsing, and Google AI Overview are the most citation-heavy. Claude and Gemini cite less frequently but still benefit from structured content.",
            },
        ],
        internalLinks: [
            { label: "Run a free audit", to: "/app/analyze" },
            { label: "Methodology", to: "/methodology" },
            { label: "Schema signals", to: "/signals/json-ld" },
            { label: "Why AI doesn't cite you", to: "/problems/why-ai-doesnt-cite-my-website" },
        ],
        ctaText: "Audit your citation readiness",
        ctaLink: "/app/analyze",
    },
    {
        slug: "why-ai-gives-wrong-information-about-my-company",
        cluster: "problems",
        title: "Why AI Gives Wrong Information About My Company",
        metaTitle: "Why AI Gives Wrong Info About My Company | AiVIS.biz",
        metaDescription:
            "AI models hallucinate about your company because they cannot extract reliable entity data from your site. Fix entity confusion with an evidence-backed audit.",
        primaryKeyword: "ai wrong information about my company",
        secondaryKeyword: "ai hallucinating company info",
        hook: "When AI says something wrong about your company, the problem is rarely the AI model itself. The problem is that your site does not provide the signals AI needs to get it right.",
        sections: [
            {
                heading: "Why AI models get company information wrong",
                content: [
                    "AI models reconstruct answers from extracted fragments. If your site lacks Organization schema, the model cannot reliably identify your company name, location, founding date, or services. It fills the gaps with training data — which may be outdated, incorrect, or confused with similarly-named entities.",
                    "Entity confusion is one of the most common AI extraction failures. Without clear JSON-LD declaring who you are, AI models may attribute your claims to a competitor or merge your identity with another business.",
                ],
            },
            {
                heading: "Common causes of AI misinformation",
                content: [
                    "Missing or incomplete Organization schema. No author attribution on content pages. Inconsistent business name across pages (e.g., 'Acme Inc.' on one page, 'Acme' on another). No sameAs links to verified profiles. Outdated information still accessible to crawlers.",
                    "These are all extraction inputs. When they are absent or inconsistent, AI models hallucinate. When they are present and consistent, models reproduce accurately.",
                ],
            },
            {
                heading: "How to fix it",
                content: [
                    "Add Organization JSON-LD with name, url, legalName, sameAs, and foundingDate. Use consistent naming across all pages. Add author attribution to content. Remove or noindex outdated content that could confuse models. Run an AiVIS.biz audit to identify all entity clarity gaps.",
                ],
            },
        ],
        faqs: [
            {
                question: "Can I force AI models to correct wrong information?",
                answer:
                    "You cannot directly edit AI model outputs. But you can fix the extraction inputs — the signals on your site that AI models use to generate answers. When the inputs are clear, the outputs follow.",
            },
            {
                question: "How do I know if AI is confusing my brand with another?",
                answer:
                    "AiVIS.biz citation testing can detect entity confusion by evaluating whether your brand appears correctly in AI answers across multiple models.",
            },
        ],
        internalLinks: [
            { label: "Run a free audit", to: "/app/analyze" },
            { label: "AI hallucination fixes", to: "/problems/ai-hallucinating-about-my-brand" },
            { label: "Schema coverage", to: "/signals/schema-org" },
            { label: "Citation testing", to: "/citations" },
        ],
        ctaText: "Fix what AI gets wrong about you",
        ctaLink: "/app/analyze",
    },
    {
        slug: "how-to-audit-ai-answer-readiness",
        cluster: "problems",
        title: "How to Audit AI Answer Readiness",
        metaTitle: "How to Audit AI Answer Readiness — Complete Guide | AiVIS.biz",
        metaDescription:
            "Audit whether AI models can extract and cite your content. Six evidence-backed dimensions, BRAG protocol, and actionable fix recommendations.",
        primaryKeyword: "audit ai answer readiness",
        secondaryKeyword: "ai readiness audit",
        hook: "An AI answer readiness audit measures whether your content is structurally prepared for extraction by ChatGPT, Perplexity, Gemini, Claude, and other answer engines. Here is what the audit evaluates and why.",
        sections: [
            {
                heading: "What an AI readiness audit measures",
                content: [
                    "Unlike a traditional SEO audit focused on rankings and backlinks, an AI readiness audit evaluates extraction fidelity: can AI models access your page, parse the content, identify the publisher, and reproduce claims accurately?",
                    "AiVIS.biz audits six dimensions: content depth (20%), schema coverage (20%), AI readability (20%), technical SEO (15%), metadata quality (13%), and heading structure (12%). Each dimension targets a specific extraction failure mode.",
                ],
            },
            {
                heading: "How the BRAG evidence protocol works",
                content: [
                    "Every finding in an AiVIS.biz audit includes a BRAG Evidence ID (Based Retrieval and Auditable Grading). This ID links the finding to the source signal on your page, the extraction rule that triggered it, and the scoring dimension it affects.",
                    "The protocol eliminates speculative recommendations. If AiVIS.biz cannot observe a signal on the page, it does not generate a finding for it. Every recommendation maps to verified crawl evidence.",
                ],
            },
            {
                heading: "Running your first audit",
                content: [
                    "Enter any public URL into AiVIS.biz. The system crawls the page via headless browser, extracts all structural signals, scores six dimensions, and delivers a composite score from 0 to 100 with prioritized fix recommendations.",
                    "Observer tier (free) provides the score and top blockers. Starter and above provide all recommendations with implementation code and evidence detail.",
                ],
            },
        ],
        faqs: [
            {
                question: "How often should I audit my pages?",
                answer:
                    "After any significant content or structural change, and at minimum monthly. AI model behavior evolves, so periodic re-audits catch both site regressions and model-side changes.",
            },
            {
                question: "Can I audit competitor pages?",
                answer:
                    "Yes. On Alignment tier and above, you can add competitor domains and compare extraction readiness across shared topics.",
            },
        ],
        internalLinks: [
            { label: "Run a free audit", to: "/app/analyze" },
            { label: "Methodology", to: "/methodology" },
            { label: "Pricing", to: "/pricing" },
            { label: "BRAG protocol", to: "/glossary" },
        ],
        ctaText: "Run your first audit",
        ctaLink: "/app/analyze",
    },
    {
        slug: "why-google-ai-overview-skips-my-content",
        cluster: "problems",
        title: "Why Google AI Overview Skips My Content",
        metaTitle: "Why Google AI Overview Skips My Content | AiVIS.biz",
        metaDescription:
            "Google AI Overviews extract from pages with clear structure and entity signals. If your content is skipped, diagnose extraction failures with AiVIS.biz.",
        primaryKeyword: "google ai overview skips my content",
        secondaryKeyword: "google ai overview optimization",
        hook: "Google AI Overviews synthesize answers from multiple sources. If your content never appears — even when you rank organically — the extraction pipeline is failing.",
        sections: [
            {
                heading: "How Google AI Overview selects sources",
                content: [
                    "Google AI Overview uses a combination of the existing search index and real-time extraction to synthesize answers. Pages that provide clear, structured claims with verifiable metadata are preferentially selected. The system favors pages with strong schema coverage, authoritative entity identity, and answer-ready formatting.",
                    "Being indexed by Google is not enough. The AI Overview pipeline applies additional extraction quality filters that traditional organic results do not.",
                ],
            },
            {
                heading: "Why your content gets skipped",
                content: [
                    "Missing FAQ or HowTo schema — AI Overview heavily favors structured Q&A content. No clear entity identity — without Organization schema, your claims are harder to attribute. Vague headings — generic H2 tags like 'Our Services' do not help AI segment and extract specific claims. Content is too promotional — AI Overview prefers informational, factual content over marketing copy.",
                ],
            },
            {
                heading: "How to optimize for AI Overview",
                content: [
                    "Add FAQ schema for question-answer pairs. Use specific, descriptive headings that match common queries. Include datePublished and author metadata. Write atomic, factual claims rather than marketing language. Run an AiVIS.biz audit to identify the specific gaps.",
                ],
            },
        ],
        faqs: [
            {
                question: "Does organic ranking guarantee AI Overview inclusion?",
                answer:
                    "No. Organic ranking and AI Overview inclusion are separate processes. Many #1-ranked pages are not included in AI Overviews because the AI extraction layer has different structural requirements.",
            },
            {
                question: "Can I control which content AI Overview extracts?",
                answer:
                    "You cannot precisely control extraction. But you can maximize extraction readiness by providing clear structure, schema, and answer-ready formatting that matching the query intent.",
            },
        ],
        internalLinks: [
            { label: "Run a free audit", to: "/app/analyze" },
            { label: "FAQ schema", to: "/problems/missing-faq-schema" },
            { label: "Heading structure", to: "/problems/poor-heading-structure" },
            { label: "AI readability", to: "/signals/ai-readability" },
        ],
        ctaText: "Audit your AI Overview readiness",
        ctaLink: "/app/analyze",
    },
    {
        slug: "how-to-make-website-ai-readable",
        cluster: "problems",
        title: "How to Make Your Website AI-Readable",
        metaTitle: "How to Make Your Website AI-Readable | AiVIS.biz",
        metaDescription:
            "AI readability means your content can be structurally extracted by AI models. Fix rendering, schema, headings, and content structure for AI extraction.",
        primaryKeyword: "make website ai readable",
        secondaryKeyword: "ai readable website",
        hook: "AI-readable means more than human-readable. It means your content can be structurally extracted, entity-attributed, and faithfully reproduced by AI answer engines.",
        sections: [
            {
                heading: "What AI readability actually means",
                content: [
                    "A page is AI-readable when: (1) AI crawlers can access and render it, (2) the content can be parsed into discrete claims, (3) entity identity is declared through structured data, and (4) the structure supports segmented extraction rather than requiring the full page to be understood as a single block.",
                    "Most websites are human-readable but not AI-readable. The gap between the two is where extraction failures occur.",
                ],
            },
            {
                heading: "Server-side rendering is non-negotiable",
                content: [
                    "AI crawlers (GPTBot, ClaudeBot, PerplexityBot) typically do not execute JavaScript. If your site relies on client-side rendering, the crawler receives an empty HTML shell. Server-side rendering (SSR), static site generation (SSG), or pre-rendering is required for AI readability.",
                ],
            },
            {
                heading: "Structure content for extraction, not just reading",
                content: [
                    "Use one H1 per page that clearly states the topic. Use H2 and H3 headings that match common questions about the topic. Write in atomic claims: one verifiable statement per paragraph rather than dense multi-claim blocks.",
                    "Add JSON-LD schema: Organization, Article, FAQ where applicable. Include datePublished and author. Ensure canonical URLs are set and consistent.",
                ],
            },
            {
                heading: "Test with an extraction-focused audit",
                content: [
                    "Traditional SEO tools test for ranking signals. AiVIS.biz tests for extraction readiness — whether AI models can access, parse, and cite your content. The audit scores six dimensions and provides specific code-level fixes.",
                ],
            },
        ],
        faqs: [
            {
                question: "Is AI readability different from accessibility?",
                answer:
                    "Yes. Web accessibility focuses on human users with disabilities. AI readability focuses on whether machines can structurally extract and attribute content. Some practices overlap (semantic HTML, clear headings), but the requirements diverge significantly.",
            },
            {
                question: "Which CMS platforms are most AI-readable by default?",
                answer:
                    "Static site generators (Next.js, Astro, Hugo) with SSR/SSG tend to be most AI-readable. WordPress with good schema plugins is reasonable. SPAs without SSR (vanilla React, Vue) are the least AI-readable.",
            },
        ],
        internalLinks: [
            { label: "Run a free audit", to: "/app/analyze" },
            { label: "JavaScript rendering issues", to: "/problems/javascript-rendering-blocks-ai" },
            { label: "Platform guides", to: "/platforms" },
            { label: "Schema signals", to: "/signals/json-ld" },
        ],
        ctaText: "Test your AI readability",
        ctaLink: "/app/analyze",
    },
    {
        slug: "why-ai-misquotes-my-content",
        cluster: "problems",
        title: "Why AI Misquotes My Content",
        metaTitle: "Why AI Misquotes My Content — Fix Extraction Errors | AiVIS.biz",
        metaDescription:
            "AI misquotes happen when extraction is partial or entity attribution fails. Diagnose and fix the structural causes with an evidence-backed audit.",
        primaryKeyword: "ai misquotes my content",
        secondaryKeyword: "ai misattribution fix",
        hook: "AI is not trying to misquote you. It is reconstructing an answer from compressed fragments — and if the extraction was incomplete or ambiguous, the reconstruction is wrong.",
        sections: [
            {
                heading: "How AI misquotation happens",
                content: [
                    "AI models extract fragments from your page, compress them into latent representations, and reconstruct answers when queried. If the original extraction was partial (missing context), ambiguous (unclear entity), or conflated with other sources, the reconstructed answer will misrepresent your content.",
                    "This is not hallucination in the traditional sense. It is extraction failure that propagates through the reconstruction pipeline.",
                ],
            },
            {
                heading: "Structural causes of misquotation",
                content: [
                    "Vague or generic content that lacks specific claims. Missing author and publisher metadata that prevents attribution. No datePublished property, causing the model to treat your claim as undated and potentially conflate it with other sources. Multiple entities discussed on the same page without clear schema separation.",
                ],
            },
            {
                heading: "How to reduce misquotation risk",
                content: [
                    "Write atomic, specific claims. Declare entity identity with Organization and Author schema. Add datePublished to timestamped content. Use clear headings that segment topics. Run an AiVIS.biz audit to identify extraction points where ambiguity enters the pipeline.",
                ],
            },
        ],
        faqs: [
            {
                question: "Can I correct a misquote in AI output?",
                answer:
                    "You cannot directly edit model outputs. But you can fix the extraction inputs on your site — the structural signals the model uses to generate the answer. Improved inputs lead to improved outputs over time.",
            },
            {
                question: "Is misquotation more common with some AI models?",
                answer:
                    "Yes. Models with smaller context windows and less sophisticated retrieval are more prone to extraction-based misquotation. The risk varies by model architecture.",
            },
        ],
        internalLinks: [
            { label: "Run a free audit", to: "/app/analyze" },
            { label: "Entity confusion fix", to: "/problems/how-to-fix-entity-confusion-in-ai" },
            { label: "Author attribution", to: "/problems/no-author-attribution" },
            { label: "Content depth", to: "/problems/thin-content" },
        ],
        ctaText: "Diagnose misquotation sources",
        ctaLink: "/app/analyze",
    },
    {
        slug: "how-to-fix-entity-confusion-in-ai",
        cluster: "problems",
        title: "How to Fix Entity Confusion in AI Answers",
        metaTitle: "Fix Entity Confusion in AI Answers | AiVIS.biz",
        metaDescription:
            "AI confuses your brand with competitors because your entity signals are missing or ambiguous. Fix entity disambiguation with structured data and clear identity.",
        primaryKeyword: "fix entity confusion ai",
        secondaryKeyword: "ai entity disambiguation",
        hook: "When AI answers attribute your work to someone else — or confuse your brand with a similarly-named entity — the root cause is almost always missing or incomplete entity signals on your site.",
        sections: [
            {
                heading: "What entity confusion looks like",
                content: [
                    "AI says your competitor founded the product you built. AI merges information about two companies with similar names. AI attributes your blog post to a different author. AI states incorrect founding date, location, or service offerings.",
                    "All of these are entity disambiguation failures. The model could not reliably determine which entity to attribute claims to, so it guessed — incorrectly.",
                ],
            },
            {
                heading: "Why entity confusion happens",
                content: [
                    "Missing Organization JSON-LD. No sameAs links connecting your domain to verified profiles (LinkedIn, GitHub, Twitter, Wikipedia). Inconsistent naming across pages. No author Person schema on content pages. No legalName property to distinguish your entity from others with similar trading names.",
                ],
            },
            {
                heading: "How to fix it",
                content: [
                    "Add comprehensive Organization JSON-LD: name, legalName, url, sameAs (all verified profiles), foundingDate, founder, address. Add Person schema for content authors with sameAs links. Use the exact same entity name across every page. Add author metadata to every content page.",
                    "AiVIS.biz audits entity clarity as part of the schema coverage dimension and flags missing disambiguation signals.",
                ],
            },
        ],
        faqs: [
            {
                question: "How many sameAs links do I need?",
                answer:
                    "Include every verified profile: LinkedIn, GitHub, Twitter/X, Wikipedia, Product Hunt, Crunchbase. More sameAs links provide stronger entity signals. Quality matters more than quantity — only link to profiles you control.",
            },
            {
                question: "Can entity confusion affect my competitors too?",
                answer:
                    "Yes. Entity confusion is bidirectional — if AI confuses you with a competitor, it may also confuse the competitor with you. Fixing your entity signals benefits clarity for both.",
            },
        ],
        internalLinks: [
            { label: "Run a free audit", to: "/app/analyze" },
            { label: "Schema markup", to: "/signals/schema-org" },
            { label: "AI hallucination", to: "/problems/ai-hallucinating-about-my-brand" },
            { label: "Author attribution", to: "/problems/no-author-attribution" },
        ],
        ctaText: "Fix your entity identity",
        ctaLink: "/app/analyze",
    },
    {
        slug: "why-ai-attributes-my-content-to-competitors",
        cluster: "problems",
        title: "Why AI Attributes My Content to Competitors",
        metaTitle: "Why AI Gives My Content to Competitors | AiVIS.biz",
        metaDescription:
            "AI models attribute your claims to competitors when your entity signals are weaker than theirs. Diagnose and fix attribution failures with AiVIS.biz.",
        primaryKeyword: "ai attributes content to competitors",
        secondaryKeyword: "ai competitor attribution",
        hook: "You wrote the content. A competitor gets the citation. This happens when your entity identity is weaker than your competitor's — and AI models default to the source with clearer attribution signals.",
        sections: [
            {
                heading: "Attribution is a competition",
                content: [
                    "When multiple sources cover the same topic, AI models must decide which source to cite. The model evaluates extraction quality, entity clarity, and structural reliability. If your competitor has Organization schema, dated content, and clear authorship while you have none, the model attributes the shared knowledge to them.",
                    "This is not plagiarism by AI. It is competitive extraction — the source with stronger signals wins the attribution.",
                ],
            },
            {
                heading: "Signals that determine attribution priority",
                content: [
                    "Organization schema with sameAs links to verified profiles. datePublished property — earlier publication dates can establish priority. Author Person schema with credentials. Domain-level trust signals (HTTPS, consistent canonical URLs). Content specificity — more specific claims are harder to attribute to a generic source.",
                ],
            },
            {
                heading: "How to win back attribution",
                content: [
                    "Audit your pages and your competitor's pages with AiVIS.biz to compare extraction readiness. Identify where their signals are stronger. Fix your Organization schema, add datePublished metadata, and ensure your content makes specific, attributable claims. The goal is to make the extraction path to your domain clearer than the path to your competitor.",
                ],
            },
        ],
        faqs: [
            {
                question: "Can AiVIS.biz compare my extraction readiness against competitors?",
                answer:
                    "Yes. Alignment tier and above includes competitor tracking, which compares your audit score and extraction signals against competitor domains on shared topics.",
            },
            {
                question: "Does publishing first help with AI attribution?",
                answer:
                    "Yes. datePublished metadata can establish temporal priority. While AI models weigh many factors, having a verifiable earlier publication date is a meaningful attribution signal.",
            },
        ],
        internalLinks: [
            { label: "Run a free audit", to: "/app/analyze" },
            { label: "Competitor tracking", to: "/competitors" },
            { label: "Entity confusion fix", to: "/problems/how-to-fix-entity-confusion-in-ai" },
            { label: "Pricing", to: "/pricing" },
        ],
        ctaText: "Compare your extraction readiness",
        ctaLink: "/app/analyze",
    },
    {
        slug: "how-to-optimize-for-ai-answer-engines",
        cluster: "problems",
        title: "How to Optimize for AI Answer Engines",
        metaTitle: "How to Optimize for AI Answer Engines — AEO Guide | AiVIS.biz",
        metaDescription:
            "Answer engine optimization (AEO) requires extraction readiness, not just ranking signals. Learn the structural requirements for ChatGPT, Perplexity, and Gemini.",
        primaryKeyword: "optimize for ai answer engines",
        secondaryKeyword: "answer engine optimization",
        hook: "Answer engine optimization is not traditional SEO with a new name. AI answer engines extract, compress, and reconstruct — not rank. Optimization means making your content extraction-ready.",
        sections: [
            {
                heading: "AEO vs SEO: what actually changed",
                content: [
                    "SEO optimizes for position in a ranked list. AEO optimizes for inclusion in a synthesized answer. The inputs are different: AI models care about extraction quality, entity clarity, and claim specificity — not backlink profiles, keyword density, or domain authority.",
                    "A page can be perfectly optimized for SEO and completely invisible to AI answer engines. The two disciplines overlap on structural basics (headings, metadata) but diverge on what matters for extraction.",
                ],
            },
            {
                heading: "Core AEO requirements",
                content: [
                    "1. Crawler access: Allow GPTBot, ClaudeBot, PerplexityBot, and Googlebot in robots.txt. 2. Server-side rendering: Ensure content is in the HTML response, not generated by JavaScript. 3. Structured data: Organization, Article, FAQ, BreadcrumbList JSON-LD. 4. Answer-ready formatting: Clear headings, atomic claims, Q&A structure. 5. Entity identity: Consistent naming, sameAs links, author metadata.",
                ],
            },
            {
                heading: "Measuring AEO performance",
                content: [
                    "AiVIS.biz provides an evidence-backed AEO score across six dimensions. Unlike generic SEO scores, the AiVIS.biz score is specifically calibrated for AI extraction readiness. Each finding maps to a crawl-observable signal through the BRAG evidence protocol.",
                ],
            },
        ],
        faqs: [
            {
                question: "Do I need AEO if I already do SEO?",
                answer:
                    "Yes. SEO and AEO have overlapping but distinct requirements. Many SEO-optimized pages fail AI extraction checks. AEO addresses the extraction-specific gaps that SEO does not cover.",
            },
            {
                question: "Is AEO only relevant for ChatGPT?",
                answer:
                    "No. AEO applies to all AI answer engines: ChatGPT, Perplexity, Gemini, Claude, Copilot, Brave AI, Google AI Overview, and others. The structural requirements are shared.",
            },
        ],
        internalLinks: [
            { label: "Run a free audit", to: "/app/analyze" },
            { label: "Methodology", to: "/methodology" },
            { label: "AEO blog", to: "/blogs/answer-engine-optimization-2026-why-citation-readiness-matters" },
            { label: "Signal tier", to: "/pricing" },
        ],
        ctaText: "Start optimizing for AI answers",
        ctaLink: "/app/analyze",
    },
    {
        slug: "why-structured-data-matters-for-ai-citations",
        cluster: "problems",
        title: "Why Structured Data Matters for AI Citations",
        metaTitle: "Why Structured Data Matters for AI Citations | AiVIS.biz",
        metaDescription:
            "JSON-LD structured data is the primary mechanism AI models use for entity disambiguation and attribution. Without it, your content is extractable but not citable.",
        primaryKeyword: "structured data ai citations",
        secondaryKeyword: "json-ld ai importance",
        hook: "AI models can read your content without structured data. But they cannot reliably cite it. JSON-LD is the bridge between extraction and attribution.",
        sections: [
            {
                heading: "Extraction vs attribution",
                content: [
                    "AI models can extract text from any HTML page. But extraction is not citation. Citation requires attribution — the model must know who published the content, when, and in what context. JSON-LD structured data provides this attribution layer.",
                    "Without Organization schema, the model cannot determine the publisher. Without datePublished, it cannot establish temporal priority. Without author metadata, it cannot attribute claims to a specific person or entity.",
                ],
            },
            {
                heading: "Which schema types matter most for citation",
                content: [
                    "Organization: establishes entity identity, connects to verified profiles via sameAs. Article/BlogPosting: declares content type, author, publication date. FAQ: marks Q&A content for direct extraction. BreadcrumbList: provides hierarchical context. Person: identifies content authors with credentials and profiles.",
                    "AiVIS.biz evaluates 18+ schema.org types as part of the schema coverage dimension.",
                ],
            },
            {
                heading: "The compounding effect",
                content: [
                    "Pages with one schema type see moderate improvement. Pages with Organization + Article + FAQ + BreadcrumbList see significantly higher extraction fidelity and citation rates. The combination creates a complete entity context that AI models can use for confident attribution.",
                ],
            },
        ],
        faqs: [
            {
                question: "Is JSON-LD the only format AI models use?",
                answer:
                    "JSON-LD is the preferred format. Microdata and RDFa are technically parseable but less reliably processed by AI extraction pipelines. Use JSON-LD for maximum compatibility.",
            },
            {
                question: "Can structured data alone improve my AiVIS.biz score?",
                answer:
                    "Schema coverage is 20% of the composite score. Adding comprehensive JSON-LD can improve your score significantly, especially if you are starting from zero schema coverage.",
            },
        ],
        internalLinks: [
            { label: "Run a free audit", to: "/app/analyze" },
            { label: "Missing structured data", to: "/problems/missing-structured-data" },
            { label: "Schema signals", to: "/signals/json-ld" },
            { label: "No schema markup", to: "/problems/no-schema-markup" },
        ],
        ctaText: "Check your schema coverage",
        ctaLink: "/app/analyze",
    },
    {
        slug: "how-to-test-if-ai-can-extract-your-content",
        cluster: "problems",
        title: "How to Test If AI Can Extract Your Content",
        metaTitle: "Test If AI Can Extract Your Content | AiVIS.biz",
        metaDescription:
            "Test whether AI models can extract and cite your content with an evidence-backed audit. Check rendering, schema, headings, and readability across six dimensions.",
        primaryKeyword: "test if ai can extract content",
        secondaryKeyword: "ai content extraction test",
        hook: "You think your content is visible to AI. But have you tested it? AI crawlers see a different version of your site than your browser shows you.",
        sections: [
            {
                heading: "View source, not inspect element",
                content: [
                    "The first test is simple: right-click your page and select 'View Source' (not Inspect Element). If the HTML body is mostly empty — just a <div id='root'></div> and script tags — your site is client-rendered. AI crawlers see that empty shell, not your actual content.",
                    "Inspect Element shows the DOM after JavaScript execution. View Source shows what the server delivers. AI crawlers receive the server's response.",
                ],
            },
            {
                heading: "Check robots.txt for AI crawler blocks",
                content: [
                    "Visit yoursite.com/robots.txt and search for GPTBot, ClaudeBot, PerplexityBot, Googlebot. If any of these are blocked with 'Disallow: /', that crawler cannot access any page on your site. Many security configurations add these blocks by default.",
                ],
            },
            {
                heading: "Run an extraction-focused audit",
                content: [
                    "Manual checks cover the basics. For a comprehensive extraction readiness assessment, run an AiVIS.biz audit. The audit crawls your page via headless browser (simulating AI crawler behavior), evaluates all six extraction dimensions, and reports specific findings with evidence IDs.",
                    "Each finding tells you exactly what is missing and how to fix it — no guesswork, no generic advice.",
                ],
            },
        ],
        faqs: [
            {
                question: "Can I test for free?",
                answer:
                    "Yes. Observer tier is free forever and provides the audit score plus your top 3 blockers. Full recommendations with implementation code require Starter or above.",
            },
            {
                question: "How often should I test?",
                answer:
                    "Test after any structural change (new schema, robots.txt update, SSR migration). Monthly re-audits catch drift from AI model behavior changes.",
            },
        ],
        internalLinks: [
            { label: "Run a free audit", to: "/app/analyze" },
            { label: "JavaScript rendering", to: "/problems/javascript-rendering-blocks-ai" },
            { label: "Robots.txt issues", to: "/problems/blocked-by-robots-txt" },
            { label: "Methodology", to: "/methodology" },
        ],
        ctaText: "Test your extraction readiness",
        ctaLink: "/app/analyze",
    },
    {
        slug: "why-ai-search-gives-outdated-information",
        cluster: "problems",
        title: "Why AI Search Gives Outdated Information About You",
        metaTitle: "Why AI Gives Outdated Info About Your Site | AiVIS.biz",
        metaDescription:
            "AI models serve outdated information because your site lacks freshness signals. Fix datePublished, recrawl cadence, and content structure to stay current.",
        primaryKeyword: "ai search outdated information",
        secondaryKeyword: "ai stale content",
        hook: "You updated your website months ago. AI still cites the old version. This happens because AI models lack the freshness signals needed to prioritize your updated content.",
        sections: [
            {
                heading: "Why AI serves stale content",
                content: [
                    "AI models maintain a crawl corpus that is periodically updated. If your page does not signal recency (dateModified, updated sitemaps, fresh canonical URLs), the model may continue using an older cached version of your content.",
                    "Some AI models also weight training data more heavily than real-time crawl data. If the training set captured an older version of your page, that version may persist in model outputs even after a crawl update.",
                ],
            },
            {
                heading: "Freshness signals that matter",
                content: [
                    "dateModified in Article/BlogPosting JSON-LD. Updated lastmod dates in sitemap.xml. Fresh content changes that trigger re-crawling. Consistent canonical URLs (URL changes can reset crawl history). llms.txt with canonical page listings.",
                ],
            },
            {
                heading: "How to force recency",
                content: [
                    "Update dateModified metadata after every content revision. Resubmit your sitemap after major changes. Ensure your content management system updates lastmod timestamps automatically. Run an AiVIS.biz re-audit to verify the updated signals are in place.",
                ],
            },
        ],
        faqs: [
            {
                question: "How long does it take for AI to pick up content changes?",
                answer:
                    "Varies by model. Perplexity and ChatGPT with browsing can pick up changes within days. Training-data models (Claude, Gemini) may take weeks to months depending on retraining cycles.",
            },
            {
                question: "Can I force ChatGPT to use my latest content?",
                answer:
                    "Not directly. But ensuring GPTBot access, updated dateModified metadata, and current sitemap timestamps maximizes the probability that new crawls capture your changes.",
            },
        ],
        internalLinks: [
            { label: "Run a free audit", to: "/app/analyze" },
            { label: "Missing sitemap", to: "/problems/missing-sitemap" },
            { label: "Canonical URLs", to: "/problems/no-canonical-urls" },
            { label: "Schema signals", to: "/signals/json-ld" },
        ],
        ctaText: "Check your freshness signals",
        ctaLink: "/app/analyze",
    },
    {
        slug: "how-to-fix-ai-extraction-failures",
        cluster: "problems",
        title: "How to Fix AI Extraction Failures",
        metaTitle: "Fix AI Extraction Failures — Diagnosis & Code Fixes | AiVIS.biz",
        metaDescription:
            "AI extraction failures happen when crawlers can't access, parse, or attribute your content. Diagnose and fix each failure type with evidence-backed guidance.",
        primaryKeyword: "fix ai extraction failures",
        secondaryKeyword: "ai content extraction fix",
        hook: "An extraction failure is any point where the AI pipeline breaks between accessing your page and reproducing your content in an answer. Each failure type has a specific structural fix.",
        sections: [
            {
                heading: "Types of extraction failure",
                content: [
                    "Access failure: AI crawlers are blocked by robots.txt, WAF, CDN, or rate limiting. The crawler never sees your content. Fix: update robots.txt, whitelist AI crawlers, configure CDN bot protection.",
                    "Rendering failure: Your page uses client-side rendering. The crawler receives empty HTML. Fix: enable SSR, SSG, or pre-rendering.",
                    "Parsing failure: Content exists but lacks structural markers. No headings, no schema, no clear segmentation. The model extracts but cannot organize the content. Fix: add semantic HTML, heading hierarchy, JSON-LD.",
                    "Attribution failure: Content is extracted but cannot be attributed. Missing Organization schema, no author, no dates. Fix: add complete entity metadata.",
                ],
            },
            {
                heading: "Prioritizing fixes by impact",
                content: [
                    "Access failures block everything downstream — fix them first. Rendering failures have the second-highest impact since they eliminate all content delivery. Parsing and attribution failures are fixable incrementally and typically produce measurable score improvements within one audit cycle.",
                ],
            },
            {
                heading: "Using AiVIS.biz to fix extraction failures",
                content: [
                    "Run an audit. Each finding includes a BRAG Evidence ID linking to the specific extraction failure. Starter tier and above provides implementation code for each fix. Score Fix (one-time purchase) automates the fixes as GitHub pull requests.",
                ],
            },
        ],
        faqs: [
            {
                question: "What percentage of sites have AI extraction failures?",
                answer:
                    "Based on AiVIS.biz audit data, the majority of sites have at least one significant extraction failure. Missing structured data, blocked AI crawlers, and client-side rendering are the most common.",
            },
            {
                question: "Can Score Fix automatically fix extraction failures?",
                answer:
                    "Score Fix translates audit findings into code-level changes and ships them as GitHub pull requests. It covers schema additions, metadata fixes, heading corrections, robots.txt updates, and llms.txt generation.",
            },
        ],
        internalLinks: [
            { label: "Run a free audit", to: "/app/analyze" },
            { label: "Score Fix", to: "/pricing" },
            { label: "Blocked by robots.txt", to: "/problems/blocked-by-robots-txt" },
            { label: "JavaScript rendering", to: "/problems/javascript-rendering-blocks-ai" },
        ],
        ctaText: "Diagnose your extraction failures",
        ctaLink: "/app/analyze",
    },
    {
        slug: "why-claude-cant-find-my-website",
        cluster: "problems",
        title: "Why Claude Can't Find My Website",
        metaTitle: "Why Claude Can't Find Your Website | AiVIS.biz",
        metaDescription:
            "Claude uses ClaudeBot and training data to access web content. If Claude can't find your site, diagnose crawler blocks and extraction failures with AiVIS.biz.",
        primaryKeyword: "claude can't find my website",
        secondaryKeyword: "claude ai website access",
        hook: "Claude (by Anthropic) combines training data with real-time web access via ClaudeBot. If Claude gives wrong or missing information about your site, the extraction pipeline is failing.",
        sections: [
            {
                heading: "How Claude accesses web content",
                content: [
                    "Claude uses two pathways: pre-trained knowledge (from its training corpus) and real-time web access via ClaudeBot. The training corpus captures a snapshot of the web — if your content was not well-structured at the time of training, Claude's base knowledge may be incomplete or incorrect.",
                    "ClaudeBot respects robots.txt directives. If your robots.txt blocks Anthropic's crawler (User-agent: ClaudeBot or User-agent: anthropic-ai), Claude cannot access your content for real-time responses.",
                ],
            },
            {
                heading: "Common reasons Claude misses your site",
                content: [
                    "ClaudeBot blocked in robots.txt. Your site was poorly structured at training time and no fresh crawl updates have occurred. Client-side rendering delivers empty HTML to ClaudeBot. Missing entity metadata prevents Claude from attributing content to your domain.",
                ],
            },
            {
                heading: "Fixing Claude access",
                content: [
                    "Allow ClaudeBot in robots.txt. Ensure server-side rendering. Add Organization and Article JSON-LD. Write clear, attributable content. Run an AiVIS.biz audit to identify the specific gaps in your extraction readiness for Claude and other models.",
                ],
            },
        ],
        faqs: [
            {
                question: "Does Claude use a different crawler than ChatGPT?",
                answer:
                    "Yes. Claude uses ClaudeBot (or anthropic-ai), while ChatGPT uses GPTBot. Each requires separate robots.txt allowances.",
            },
            {
                question: "Can I test what Claude knows about my site?",
                answer:
                    "AiVIS.biz citation testing evaluates brand presence across multiple AI models including Claude. You can see whether Claude mentions your brand and how accurately.",
            },
        ],
        internalLinks: [
            { label: "Run a free audit", to: "/app/analyze" },
            { label: "Blocked by robots.txt", to: "/problems/blocked-by-robots-txt" },
            { label: "ChatGPT ignoring your site", to: "/problems/why-chatgpt-ignores-my-site" },
            { label: "Citation testing", to: "/citations" },
        ],
        ctaText: "Check if Claude can extract your content",
        ctaLink: "/app/analyze",
    },
    {
        slug: "how-to-improve-ai-citation-readiness",
        cluster: "problems",
        title: "How to Improve AI Citation Readiness",
        metaTitle: "Improve AI Citation Readiness — Actionable Guide | AiVIS.biz",
        metaDescription:
            "Citation readiness means your content provides the structural signals AI needs to extract, attribute, and cite. Improve it with structured data, clear content, and BRAG-backed fixes.",
        primaryKeyword: "improve ai citation readiness",
        secondaryKeyword: "citation readiness optimization",
        hook: "Citation readiness is the probability that an AI answer engine can accurately extract, attribute, and cite your content. It is measurable, improvable, and directly tied to structural signals on your page.",
        sections: [
            {
                heading: "What citation readiness includes",
                content: [
                    "Citation readiness is a composite of: crawler access (can AI reach your page), content extractability (can AI parse your content into usable fragments), entity identity (can AI determine who published the content), temporal context (can AI determine when it was published), and competitive positioning (is your content structurally stronger than alternatives).",
                ],
            },
            {
                heading: "High-impact improvements",
                content: [
                    "1. Add Organization JSON-LD with sameAs links to verified profiles. This is often the single highest-impact fix for citation readiness.",
                    "2. Add Article/BlogPosting schema with datePublished, author, and publisher to every content page.",
                    "3. Add FAQ schema for any page with Q&A content. AI models heavily favor structured Q&A for direct extraction.",
                    "4. Ensure your H1 clearly states the page topic and H2/H3 headings match common search queries.",
                    "5. Write atomic claims — one verifiable statement per paragraph. AI extracts fragments, not essays.",
                ],
            },
            {
                heading: "Measuring improvement",
                content: [
                    "Run an AiVIS.biz audit before and after changes. The stored baseline enables precise delta tracking — you can see exactly which fixes improved which dimensions and by how much.",
                    "Signal tier adds citation testing: direct measurement of whether your brand appears in AI answers across ChatGPT, Perplexity, Gemini, and other models.",
                ],
            },
        ],
        faqs: [
            {
                question: "What is a good citation readiness score?",
                answer:
                    "Pages scoring 70+ on the AiVIS.biz audit are generally citation-ready. Pages scoring 80+ are routinely cited as primary sources. The exact threshold depends on competitive landscape.",
            },
            {
                question: "Can I improve citation readiness without technical skills?",
                answer:
                    "Yes. Many improvements are content-level: better headings, more specific claims, FAQ structure. The most technical fix (JSON-LD) can be generated by AiVIS.biz Score Fix or added manually with a simple script tag.",
            },
        ],
        internalLinks: [
            { label: "Run a free audit", to: "/app/analyze" },
            { label: "Methodology", to: "/methodology" },
            { label: "How to get cited", to: "/problems/how-to-get-cited-by-ai-models" },
            { label: "Citation testing", to: "/citations" },
        ],
        ctaText: "Measure your citation readiness",
        ctaLink: "/app/analyze",
    },
    {
        slug: "why-ai-answers-ignore-small-businesses",
        cluster: "problems",
        title: "Why AI Answers Ignore Small Businesses",
        metaTitle: "Why AI Ignores Small Businesses — Fix It | AiVIS.biz",
        metaDescription:
            "AI doesn't ignore small businesses by design. It ignores any site with weak extraction signals. Small businesses can compete by fixing structural readiness.",
        primaryKeyword: "ai answers ignore small businesses",
        secondaryKeyword: "small business ai visibility",
        hook: "AI answer engines do not have a bias against small businesses. They have a bias toward structurally strong content. Most small business sites lack the extraction signals AI needs — and that is fixable.",
        sections: [
            {
                heading: "Why small businesses are disproportionately affected",
                content: [
                    "Most small business websites use template builders (Wix, Squarespace, WordPress.com) with default configurations that lack JSON-LD schema, block AI crawlers, or produce thin content. Enterprise sites typically have dedicated SEO teams that add structured data and configure crawler access.",
                    "The result is a structural gap, not a size gap. A well-structured 10-page small business site can outperform a poorly-structured enterprise site in AI extraction readiness.",
                ],
            },
            {
                heading: "What small businesses can fix today",
                content: [
                    "1. Check robots.txt — many hosted platforms block AI crawlers by default. 2. Add Organization JSON-LD with business name, address, sameAs, and founding date. 3. Add FAQ schema for your most common customer questions. 4. Write specific service descriptions instead of generic marketing copy. 5. Run an AiVIS.biz audit to identify your highest-impact fixes.",
                ],
            },
            {
                heading: "The advantage of being specific",
                content: [
                    "Small businesses often have a natural advantage: specificity. A local plumber who writes detailed answers to specific plumbing questions can be more citable than a national directory with generic listings. AI models prefer specific, verifiable claims over broad generalities.",
                    "The key is providing those specific claims in a structure AI can extract — headings, schema, and clean HTML.",
                ],
            },
        ],
        faqs: [
            {
                question: "Does business size affect AI citation probability?",
                answer:
                    "Not directly. AI models evaluate structural extraction readiness, not company size. A 5-person consultancy with excellent schema and content structure can be cited ahead of a Fortune 500 company with a poorly-structured site.",
            },
            {
                question: "How much does it cost to fix AI visibility for a small business?",
                answer:
                    "AiVIS.biz Observer tier is free forever. Most structural fixes (robots.txt, JSON-LD, headings) are free to implement. Starter tier at $15/month provides full recommendations with implementation code.",
            },
        ],
        internalLinks: [
            { label: "Run a free audit", to: "/app/analyze" },
            { label: "Industry guides", to: "/industries" },
            { label: "Platform guides", to: "/platforms" },
            { label: "Pricing", to: "/pricing" },
        ],
        ctaText: "Audit your small business site",
        ctaLink: "/app/analyze",
    },
];
