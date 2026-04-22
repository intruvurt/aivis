import React, { useMemo, useState } from 'react';
import { ChevronDown, HelpCircle, Search } from 'lucide-react';
import { usePageMeta } from '../hooks/usePageMeta';
import PublicPageFrame from '../components/PublicPageFrame';
import { buildBreadcrumbSchema, buildFaqSchema, buildWebPageSchema } from '../lib/seoSchema';

interface FAQItem {
  question: string;
  /** Each string is one paragraph. Rich, citable, multi-paragraph answers. */
  answer: string[];
}

interface FAQCategory {
  id: string;
  label: string;
  items: FAQItem[];
}

const categories: FAQCategory[] = [
  // ── 0. Citation Intelligence Fundamentals ─────────────────────────────
  {
    id: 'citation-fundamentals',
    label: 'What AiVIS Is — Citation Intelligence Fundamentals',
    items: [
      {
        question: 'Is AiVIS an SEO tool?',
        answer: [
          'No. AiVIS is a citation intelligence system. It measures whether AI systems — ChatGPT, Perplexity, Gemini, Claude, Google AI Overviews — actually cite your content when generating answers.',
          'SEO tools measure search engine rankings, keyword positions, backlinks, and click traffic. AiVIS measures citation presence: whether your entity appears in AI-generated answers, which AI systems cite you, which queries trigger your citation, and which competitors displace you.',
          'These are fundamentally different engineering problems. A site can rank #1 in Google and be completely absent from AI answers. AiVIS measures the second problem — the one SEO tools cannot see.',
        ],
      },
      {
        question: 'Why is there no analytics dashboard showing traffic or engagement?',
        answer: [
          'Because traffic and engagement are not what this system measures. AiVIS tracks citation presence, citation absence, the causes of absence, and the corrective actions that increase citation probability.',
          "An analytics dashboard showing impressions, clicks, or bounce rates tells you how people interact with your site after they find it. AiVIS tells you whether AI systems find you at all — and why they don't when they don't.",
          'The output is not a chart of engagement metrics. It is a citation state map: where you are cited, where you are absent, what is causing the absence, and what structured actions would change it.',
        ],
      },
      {
        question: "What does the 'visibility score' actually measure?",
        answer: [
          'The visibility score is an expression of citation probability — the likelihood that AI answer systems will include your content when generating responses for relevant queries.',
          'It is not a traffic metric, not a ranking signal, and not a Google score. A score of 78/100 means: based on the current state of your entity signals, schema completeness, content extractability, and authority footprint, AI answer systems have a moderately high probability of citing you for relevant queries.',
          "The score is useful as a direction indicator. What matters more is the specific gap analysis that explains why the score is what it is — which systems cite you, which don't, which queries trigger your absence, and what would change it.",
        ],
      },
      {
        question: "What is a 'citation gap'?",
        answer: [
          'A citation gap is the state where a competitor appears in AI-generated answers for queries relevant to your category, but your entity does not. You are being displaced in the AI answer layer by another entity that has stronger citation signals.',
          "Citation gaps differ from keyword ranking gaps. A ranking gap means a competitor ranks above you for a search query. A citation gap means an AI system actively selected a competitor's content to answer a question in your domain — and your content was not considered, not extractable, or not trusted.",
          'The citation gap output in AiVIS shows: which queries trigger your absence, which entities fill the gap, what structural differences explain the gap, and what actions would close it. Gaps are not discovered by checking rankings — they are discovered by probing AI answer systems directly.',
        ],
      },
      {
        question: 'How long does it take to improve citation presence after fixing issues?',
        answer: [
          'It depends on what you fix. Structural fixes have different time horizons than content or authority fixes.',
          'Schema and technical fixes (robots.txt, rendering, JSON-LD): AI crawlers typically re-index within days to weeks after structural access is restored. Citation improvements from schema additions can appear within 2–4 weeks of the fix being live.',
          'Content depth and specificity improvements: AI models update retrieval preferences more slowly. Expect 4–8 weeks for meaningful citation signal changes. Authority and entity footprint building (Wikipedia mentions, sameAs coverage, external citations): the slowest category — typically 2–6 months of consistent external signal accumulation before citation probability shifts materially.',
        ],
      },
      {
        question: 'Does AiVIS guarantee that I will be cited by AI systems?',
        answer: [
          'No. AiVIS increases citation probability — it does not guarantee citation outcomes.',
          'AI systems make independent retrieval decisions based on query context, competing content quality, model version, and factors that cannot be fully predetermined. What AiVIS does is identify and resolve the specific obstacles that currently prevent citation: access blocks, entity disambiguation failures, schema gaps, content extractability failures, and authority signal deficits.',
          'Once those obstacles are resolved, your content competes on equal footing with cited sources. The system cannot control AI model behavior — it can only ensure your content is in the best possible position to be selected.',
        ],
      },
      {
        question: "What makes AiVIS different from SEO tools that claim to cover 'AI search'?",
        answer: [
          "The fundamental difference is what the system actually tests. Most tools that mention 'AI search' still measure traditional signals: keyword rankings, backlink counts, Core Web Vitals. They infer AI visibility from SEO proxy metrics.",
          'AiVIS tests AI answer systems directly. It submits queries to actual AI systems and records what they cite. It checks whether AI crawlers can access your content. It verifies whether your entity signals are sufficient for attribution. It builds an action graph from diagnosed absence — not from inferred SEO weakness.',
          'The second difference is the citation ledger: a persistent, verifiable record of when AI systems cited your content, which queries triggered the citations, and how citation patterns change over time. No SEO tool has this because no SEO tool is testing AI answer systems at the response layer.',
        ],
      },
      {
        question: 'What is the citation ledger?',
        answer: [
          'The citation ledger is the core truth store of the AiVIS system. It is an append-only record of citation events: when an AI system cited your content, which system cited it, which query triggered the citation, what position your content held in the answer, and what competing entities were cited alongside yours.',
          'The ledger exists because citation presence is not a moment-in-time metric — it is a pattern that evolves. A citation that appeared in Perplexity for a query last month may not appear today if a competitor improved their entity signals. The ledger captures this pattern and makes it auditable.',
          'Every insight and score in AiVIS traces back to ledger entries. If a finding cannot be traced to a ledger record, it does not exist in system logic. This is what makes outputs evidence-backed rather than inferred.',
        ],
      },
      {
        question:
          "Why does the system produce 'missing citations' rather than generic recommendations?",
        answer: [
          'Because diagnosis must precede prescription. The system first identifies citation absences — queries where your entity is absent from AI answers — then explains the causal chain behind each absence, then generates structured actions that address the specific cause.',
          "A generic recommendation ('improve your schema') tells you what category of action to take but not what absence it addresses, why you are absent, or how the action connects to a specific citation outcome. AiVIS produces an action graph: a structured plan tied to a diagnosed absence, with a specific action, the expected mechanism of improvement, and a verifiable outcome you can test.",
          'The difference matters because it determines whether you can prove improvement. If you follow a generic recommendation, you cannot verify it worked in the citation layer. If you follow an action graph tied to a specific absence, you can re-probe the same query after the fix and observe whether the absence resolved.',
        ],
      },
      {
        question: 'What is an action graph?',
        answer: [
          'An action graph is the structured output of the gap analysis stage. It is a plan: what is missing from your citation profile, why it is missing (the causal chain), what specific actions would address the cause, and what citation improvement is expected from each action.',
          'Unlike a recommendation list, an action graph is tied to evidence. Each node in the graph traces back to a specific citation absence in the ledger, a diagnosed cause (schema gap, access block, entity disambiguation failure, content extractability failure), a concrete action (add Organization JSON-LD, allow GPTBot in robots.txt, restructure FAQ content), and an expected outcome (citation probability increase for specific query types).',
          'Action graphs are produced after every scan and can be re-evaluated after fixes are applied. When fixes are verified, the corresponding absences resolve in the ledger and the action graph updates accordingly.',
        ],
      },
      {
        question: "Can I use AiVIS to analyze competitors' citation presence?",
        answer: [
          'Yes. The competitor analysis feature (Alignment+ tiers) lets you submit competitor URLs and compare their citation presence, entity strength, and schema coverage against yours.',
          'The comparison shows where competitors appear in AI answers that you do not, what entity signals give them citation advantage, and which specific structural differences — schema types, content extractability, entity disambiguation — explain the gap. This is not a keyword ranking comparison; it is a head-to-head analysis of who AI systems trust more and why.',
          'Competitor citation maps also reveal gap opportunities: queries where competitors have strong citations but structural weaknesses you could outpace with targeted improvements.',
        ],
      },
      {
        question: 'What is the most important metric to track in AiVIS?',
        answer: [
          'Citation presence across AI systems. Not your overall score, not traffic, not keyword rankings — the binary fact of whether AI systems cite you when answering questions in your domain.',
          'Score is directional — it tells you whether you are improving or declining. Traffic is a downstream effect — it may or may not move in proportion to citation improvement depending on query type and AI system behavior. Citation presence is the ground-truth signal: are you in the answer or not?',
          'Track it as a ratio: of the queries relevant to your entity, in how many AI systems, for what fraction of queries, does your content appear as a cited source? That ratio is what the system is designed to measure and improve — everything else is context.',
        ],
      },
    ],
  },

  // ── 1. The 2026 AI Search Shift ──────────────────────────────────────
  // (category index 1 — fundamentals are category 0 above)
  {
    id: 'ai-search-shift',
    label: 'The 2026 AI Search Shift',
    items: [
      {
        question: 'What actually changed in search between 2023 and 2026?',
        answer: [
          'The boundary between search engines, answer engines, and generative AI tools collapsed. By 2026, a single user query can be processed simultaneously by Google AI Overviews, ChatGPT browsing, Perplexity, Gemini, Claude, and platform-native AI summaries inside LinkedIn, Reddit, or Apple Intelligence. Each of those systems independently decides whether your website is a citable source — without coordinating with each other and without following any shared ranking standard.',
          'What this means practically: your site can rank #1 in Google and still be absent from every AI-generated answer about your own category. Conversely, a three-page startup with correct structured data and no backlinks can appear in ChatGPT product recommendations before an established competitor with ten years of domain authority.',
          "The core shift is architectural. Search engines ranked documents. Answer engines extract facts. The question is no longer 'how do I rank for this keyword?' — it is 'can an AI model extract a trusted, attributable answer fragment from my page?' Those are entirely different engineering problems.",
        ],
      },
      {
        question: "Why shouldn't I trust AI summaries of my own website as evidence of how I rank?",
        answer: [
          'AI-generated summaries of your site are not audits. They are reconstructions based on whatever the model was trained on — or whatever it could scrape in real time. Both paths are subject to fundamental reliability failures that make them dangerous to use as source-of-truth for your visibility status.',
          'Training data has a cutoff. If GPTBot last crawled your site six months ago and you have since added correct Organization schema and fixed your JavaScript rendering, a ChatGPT summary of your site still reflects the old state. You would be making remediation decisions based on stale evidence.',
          'More critically: AI models hallucinate entity attributes. A model may confidently tell you your site has FAQ schema when it has none, or that you are listed on Wikipedia when you are not. This is not rare — in testing across hundreds of sites, AI self-reports of schema coverage matched actual crawl-verified state roughly 60–70% of the time. Your actual crawl evidence is the only ground truth.',
          'AiVIS.biz generates findings from a live headless browser crawl of your actual URL. Every BRAG evidence ID corresponds to a specific, timestamped, crawl-observable field — not an inference. That is the difference between evidence and opinion.',
        ],
      },
      {
        question: 'What is an answer engine and how does it differ from a search engine?',
        answer: [
          'A search engine retrieves and ranks documents in response to a query and presents them as a list of links. The user clicks a link and lands on your website. Your site controls the experience from that point forward.',
          'An answer engine synthesizes a response directly. It extracts content from multiple sources, compresses it into a coherent answer, and delivers that answer without requiring the user to visit any website. The user may receive an answer that originated on your site and never know your site exists.',
          "In 2026, the distinction is blurring further: Google's AI Overviews are a search engine that behaves like an answer engine. Perplexity is an answer engine that behaves like a search engine by showing citations. ChatGPT with browsing is a generative model that fetches and cites in real time. What matters for your visibility is the same across all three: can an AI pipeline access your content, extract a useful fragment, and attribute it to your domain? That question is what AiVIS.biz audits.",
        ],
      },
      {
        question: 'Can any platform now provide an AI opinion about my site?',
        answer: [
          'Yes — and this is one of the most underappreciated risks of the 2026 AI ecosystem. Every major platform that has embedded AI summarization can now generate a description of your business based on whatever content their model has been trained on or can scrape in real time. This includes ChatGPT, Gemini in Google Workspace, Copilot in Microsoft Edge, Apple Intelligence, LinkedIn AI, Slack AI, and dozens of smaller tools.',
          'Each of these systems is making independent extraction decisions. If your entity signals are weak — inconsistent naming, no Organization schema, no sameAs links to verified profiles — each system fills in the gaps differently based on its own training corpus. The result is that different AI platforms describe your business differently, sometimes contradictorily.',
          'The only countermeasure is strong entity disambiguation at the source: consistent Organization JSON-LD across your site, sameAs links to all verified profiles, and specific, verifiable descriptions that resist paraphrase distortion. AiVIS.biz measures entity clarity as a scored dimension and flags every inconsistency with an evidence ID.',
        ],
      },
      {
        question:
          "How does AI act as a 'summary builder' for my site and what are the failure modes?",
        answer: [
          'When an AI system is asked about a topic your site covers, it activates as a summary builder: it locates candidate pages, extracts fragments, and synthesizes a response. Your site participates in this process in three distinct roles: training source (your content was in the pre-training corpus), retrieval source (your page is fetched in real time), or excluded entirely.',
          'The failure modes are specific. Failure mode one: your page is excluded at crawl time because robots.txt blocks AI bots or a CDN WAF rejects the user-agent. The summary is built without you. Failure mode two: your page is crawled but returns empty HTML because your site is a JavaScript SPA that renders in the browser. The model sees a shell. Failure mode three: your content is extracted but cannot be attributed — no Organization schema, no author, no sameAs links — so the summary uses your words but credits a competitor or no one.',
          "Failure mode four is the subtlest: your content IS extracted and attributed, but the extracted fragment is low specificity — too much marketing language, too few factual claims — so the model de-weights it in favor of a competitor's more factual page. This is where content depth and structure become extraction-competitive advantages.",
        ],
      },
    ],
  },

  // ── 2. BRAG Methodology & Evidence ───────────────────────────────────
  {
    id: 'brag-methodology',
    label: 'BRAG Methodology & Evidence',
    items: [
      {
        question: 'What is CITE LEDGER?',
        answer: [
          'CITE LEDGER is a structured attribution system developed by AiVIS that tracks how AI models interpret, reference, and cite web content across answer engines like ChatGPT, Perplexity, Google AI Overviews, and Claude.',
          'Every validated audit finding is recorded in a sequential, verifiable evidence chain where each entry carries a BRAG ID, content fingerprint, and traceability link connecting it to its predecessor. If a finding cannot be traced to a CITE LEDGER entry, it does not exist in system logic.',
          'Traditional audit tools produce scores without provenance. CITE LEDGER solves that gap: every score, every recommendation, and every evidence ID traces to a verifiable crawl observation that can be independently reproduced.',
        ],
      },
      {
        question: 'What is BRAG and why does evidence matter more than scores?',
        answer: [
          'BRAG is the evidence framework that powers every AiVIS.biz audit finding. It stands for Background, Reasoning, Action, Guidance — a structure that ensures every finding is grounded in a crawl-observable fact rather than a heuristic inference.',
          "Background establishes what was observed: the specific field, value, or absence of value found during the crawl. Reasoning explains why this matters specifically for AI extraction, not SEO in general. Action is the precise change required — not 'improve your schema' but 'add @type: Organization to the JSON-LD block at /index.html#L45 with name, url, and sameAs properties.' Guidance contextualizes the finding within the broader extraction pipeline.",
          'Scores without evidence are opinions. A 72/100 from a black-box tool tells you nothing about what to do first. A BRAG evidence trail with prioritized evidence IDs tells you exactly which crawl observation maps to which fix — and lets you verify the fix by re-running the audit after implementation. That verifiability is the difference between an audit tool and a recommendation engine.',
        ],
      },
      {
        question: 'How does the Python microservice validate BRAG findings?',
        answer: [
          'AiVIS.biz uses a Python-based validation microservice that runs parallel to the primary Node.js audit pipeline. When the headless browser crawl completes and the raw HTML is available, the Python service performs structured extraction analysis: it parses JSON-LD blobs, validates schema.org type hierarchies, verifies canonical URL consistency, and checks heading structure against the extracted body text.',
          "The Python service is intentionally separate from the AI model layer. This separation is architectural — it prevents the AI model's inferences from contaminating the evidence record. The Python service reports only what is provably true: schema is present or absent, a specific property exists at a specific path, a heading tag contains a specific string. The AI model then reasons about the significance of those facts and generates recommendations. The evidence and the reasoning are distinct layers.",
          'This architecture means that when an BRAG evidence ID is issued, it is backed by a deterministic Python extraction process, not an AI inference. If our Python validator says your site has no datePublished on Article schema, that is a ground-truth fact from the crawl — not a hallucination.',
        ],
      },
      {
        question: "What does 'evidence-backed' mean in practice for an audit finding?",
        answer: [
          "Every finding in an AiVIS.biz audit report includes a BRAG evidence ID that traces back to a specific observation in the crawl record. If the finding is 'Organization schema is missing,' the evidence ID links to the raw HTML response for your URL, the JSON-LD extraction log showing no application/ld+json blocks with @type: Organization, and the timestamp of the crawl.",
          'This matters because it makes findings verifiable, disputable, and reproducible. If you believe a finding is wrong, you can check the evidence ID against your live site. If you implement a fix, you can re-audit and observe the evidence ID resolve. If you are reporting progress to a client, you can show them the before/after evidence record — not just a score that changed.',
          "In agency and enterprise contexts, evidence chains are also legally relevant. If a client asks 'why did our AI visibility decline after this deployment?', an evidence trail pinpoints the exact crawl change — a new robots.txt rule, a rendering regression, a schema removal — at the exact timestamp it occurred.",
        ],
      },
      {
        question: 'What are the six scored dimensions and how are they weighted?',
        answer: [
          'AiVIS.biz scores every page across six extraction readiness dimensions, each reflecting a different layer of how AI systems evaluate and use web content.',
          'Content depth (20%): Does the page provide enough specific, verifiable claims for a model to extract something useful? Thin pages, promotional copy with no factual claims, and pages that restate the same idea multiple times all score poorly here.',
          'Schema coverage (20%): Is structured data present and complete? This includes Organization, Article, FAQ, Product, Service, BreadcrumbList, and HowTo types. Partial schema — a block missing required properties — scores lower than no schema.',
          'AI readability (20%): Can the content be extracted structurally? This measures semantic HTML quality, heading hierarchy, paragraph granularity, and the absence of extraction barriers like excessive inline JavaScript or cookie consent walls.',
          'Technical SEO baseline (15%): HTTPS, canonical URLs, correct status codes, page speed. These are prerequisites — a page cannot score well on extraction if it fails at the HTTP layer.',
          'Metadata quality (13%): Title tag, meta description, Open Graph tags, Twitter Card. These are the fields AI systems use to attribute and contextualize pages without reading the full body.',
          'Heading structure (12%): H1 through H3 hierarchy, consistency between H1 and page title, and whether headings segment content into extractable sections or serve decorative purposes only.',
        ],
      },
      {
        question: 'Why is a single fix sometimes worth 15 points but others worth 1?',
        answer: [
          'The scoring model treats certain signals as gating conditions rather than additive contributions. If GPTBot is blocked in robots.txt, that single observation effectively nullifies all other extraction investments — a perfectly structured page with complete schema that no AI crawler can access scores near zero for extraction value.',
          'Similarly, the absence of server-side rendering is a hard-blocking condition for JavaScript SPAs. No matter how complete your JSON-LD is, if the content is assembled by client-side JavaScript after the HTML response, AI crawlers receive the empty shell. All downstream score improvements are blocked until rendering is addressed.',
          'This is why fixing gating blocks first can produce 15–30 point score jumps from a single change. Once gating issues are resolved, the remaining dimensions contribute more linearly — each missing schema type or heading improvement adds two to five points.',
        ],
      },
    ],
  },

  // ── 3. How AI Reads Your Site ─────────────────────────────────────────
  {
    id: 'how-ai-reads-sites',
    label: 'How AI Reads Your Site',
    items: [
      {
        question: 'What is the full pipeline an AI crawler uses when it hits my page?',
        answer: [
          'Step one — HTTP request: The crawler sends a GET request with its specific user-agent string (e.g., GPTBot/1.0, ClaudeBot, PerplexityBot). Your server responds with an HTTP status code and the HTML document. If the response is 403, 429, or contains a robots.txt Disallow, the pipeline stops here.',
          "Step two — HTML parsing: The crawler parses the raw HTML response. It does not execute JavaScript in most cases. It looks for content in semantic elements (article, section, p, h1–h6), structured data in script[type='application/ld+json'] blocks, metadata in the head, and link relationships.",
          'Step three — Extraction: Text is extracted from semantic content zones. Navigation, footers, cookie banners, and ad containers are typically discarded. The extracted text is segmented by heading structure into labeled fragments.',
          'Step four — Attribution: The crawler records the source URL, domain, and entity metadata from JSON-LD. If Organization schema is present with a name and url, the domain is attributed to a named entity. If not, the content is recorded as anonymous or domain-only.',
          'Step five — Representation: The extracted, attributed fragments are stored in the crawl corpus (for training) or indexed for retrieval. Later, when a query matches, these fragments are candidates for inclusion in AI answers.',
        ],
      },
      {
        question:
          'What is the difference between how Google crawls my site and how ChatGPT crawls it?',
        answer: [
          'Googlebot executes JavaScript. It uses a two-wave crawling system: first crawl for raw HTML, then a deferred JavaScript rendering queue. Most modern JavaScript SPAs eventually get their content indexed by Google — it just takes longer.',
          'GPTBot, ClaudeBot, and PerplexityBot do not execute JavaScript. They receive the raw HTML server response and extract from that. If your site is a React, Vue, or Angular SPA without server-side rendering, these crawlers receive a near-empty HTML document with no extractable content.',
          "This is the single most common reason well-ranked sites are invisible to AI systems: they built for Google's two-wave rendering pipeline and never considered that AI crawlers operate at the raw HTTP response layer. The fix requires either server-side rendering (Next.js, Nuxt, SvelteKit), static pre-generation (Gatsby, Astro), or a dynamic rendering service that serves pre-rendered HTML to non-browser user-agents.",
        ],
      },
      {
        question: 'Can a CDN block AI crawlers without me knowing?',
        answer: [
          "Yes — and this is one of the most common silent failures in enterprise and mid-market sites. Cloudflare's Bot Fight Mode, Sucuri WAF, AWS Shield, Fastly bot management, and similar services block unknown or low-reputation user-agents by default. When first deployed, AI crawlers (GPTBot, ClaudeBot, PerplexityBot) had low reputation scores in these systems and were categorized alongside scrapers and DDoS bots.",
          'The failure mode is invisible because your CDN returns a 403 or a challenge page to the AI crawler, which looks like a successful response to you in the CDN logs. Your site loads fine in a browser. Your Google rankings are unaffected. But every AI crawler is silently blocked.',
          'The fix is to create explicit allowlist rules in your CDN configuration for the specific user-agent strings of AI crawlers you want to allow. AiVIS.biz detects CDN blocking during audits by testing with multiple AI crawler user-agents and flagging discrepancies between browser access and crawler access.',
        ],
      },
      {
        question: 'What is a JavaScript SPA and why is it invisible to AI?',
        answer: [
          'A Single Page Application (SPA) is a website architecture where the browser downloads a minimal HTML shell and a large JavaScript bundle. The JavaScript then executes in the browser, makes API calls, and dynamically builds the DOM — rendering all visible content after the initial server response.',
          "AI crawlers receive the initial server response: the HTML shell. That shell typically contains one div with an id like 'root' or 'app', a few script tags, and perhaps a loading spinner. There is no content, no headings, no text, no JSON-LD. From the AI crawler's perspective, the page is empty.",
          "This is architecturally invisible to most standard audit tools because audit tools often use a full browser that executes JavaScript. When they report 'content found,' they found what the browser rendered — not what the AI crawler received. AiVIS.biz audits include a raw HTTP response analysis that reports what AI crawlers actually receive, not what a browser renders.",
        ],
      },
      {
        question: 'What is llms.txt and should my site have one?',
        answer: [
          'llms.txt is an emerging convention for websites to provide AI models with a structured machine-readable summary of their content, purpose, and entity identity. It is analogous to robots.txt for AI training and retrieval contexts: a plain-text file at the root of your domain that a model can read to understand your site without parsing every page.',
          'A minimal llms.txt includes: your company name, canonical URL, what the company does (in plain, specific language), primary use cases, primary audience, and links to your most authoritative content pages. More advanced implementations include explicit statements about what content is and is not approved for AI training.',
          'AiVIS.biz checks for llms.txt presence during audits. While not yet universally used, it is a low-effort, high-signal addition for any site that wants to proactively shape how AI models represent it. A well-written llms.txt can reduce entity confusion significantly, particularly for newer or lesser-known brands.',
        ],
      },
      {
        question: 'Why does view-source disagree with what I see in my browser?',
        answer: [
          'View Source (Ctrl+U) shows the raw HTML document that the server sent before any JavaScript executed. This is exactly what an AI crawler receives. The browser developer tools (Inspect Element / F12) shows the current DOM state after JavaScript has executed, loaded data from APIs, and rendered components.',
          'For server-side rendered sites, these two views are nearly identical. For JavaScript SPAs, they diverge dramatically. View Source might show 200 bytes of HTML; Inspect Element shows the same page with 50,000 bytes of rendered content.',
          'This is the fastest manual test for AI crawler readiness: open your page with Ctrl+U (View Source) and look at the body. If you see mostly script tags with no readable text, paragraphs, or headings, AI crawlers are receiving nothing useful from your site.',
        ],
      },
      {
        question: 'What structured data types matter most for AI extraction?',
        answer: [
          'Organization is foundational — it establishes entity identity for your domain and links it to verified off-site profiles via sameAs. Without Organization schema, extracted content from your site has no authoritative publisher attribution.',
          'Article and NewsArticle are critical for content pages. They declare headline, datePublished, dateModified, author (using Person type), and publisher (linking to your Organization). These fields are the first thing retrieval systems check when deciding whether a source is attributable.',
          'FAQPage is the highest-leverage schema for question-format content. Each Question/Answer pair in FAQPage schema can be extracted directly into an AI answer as a pre-segmented, attributable Q-A unit. AI systems frequently use FAQ schema as the source for direct-answer responses.',
          'HowTo schema is valuable for procedural content. When properly structured with HowToStep objects, it allows AI systems to extract and present step-by-step instructions with attribution.',
          'Product and Service schemas matter for commercial visibility. When a user asks an AI tool to recommend a product or service, structured product/service pages with complete metadata (description, category, url) are significantly more likely to appear.',
        ],
      },
    ],
  },

  // ── 4. Security — SSRF, XSS, and Scraping ────────────────────────────
  {
    id: 'security',
    label: 'Security: SSRF, XSS & Scraping',
    items: [
      {
        question: 'What is SSRF and how does it relate to AI auditing tools?',
        answer: [
          'Server-Side Request Forgery (SSRF) is an attack where a server is tricked into making HTTP requests to unintended destinations — internal services, cloud metadata endpoints, or private infrastructure. In the context of AI auditing tools, SSRF is a critical design-time concern: any service that accepts a user-supplied URL and fetches it server-side is a potential SSRF vector.',
          'AiVIS.biz mitigates SSRF through a multi-layer validation pipeline. Every submitted URL is validated before the crawl begins: DNS resolution is performed server-side and the resolved IP address is checked against a blocklist covering all RFC-1918 private address ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16), loopback (127.0.0.0/8), link-local (169.254.0.0/16), and cloud metadata endpoints (169.254.169.254 — the AWS/GCP/Azure IMDS endpoint).',
          'Redirect chains are validated at every hop — not just the initial URL. A URL that passes the initial check but redirects to an internal endpoint through an open redirect is caught at the redirect resolution stage. This is enforced via the isSafeExternalUrl() function in securityMiddleware.ts, which the analyze endpoint calls before any HTTP request is made.',
        ],
      },
      {
        question: 'How does AiVIS.biz protect against XSS when rendering audit results?',
        answer: [
          'Audit results contain extracted content from third-party websites — AI-analyzed summaries, recommendation text, page titles, descriptions, and metadata values. Every string that originated from an external source is treated as untrusted input regardless of how it arrived.',
          'AiVIS.biz uses DOMPurify on the client side — specifically through the SafeHtml component and sanitizeInput() function — to sanitize all externally sourced strings before they are placed in the DOM. Configuration disables ALLOW_UNKNOWN_PROTOCOLS to prevent javascript: URI injection, and FORBID_ATTR includes event handlers.',
          'On the server side, user-supplied strings passed to database operations use parameterized queries exclusively — no string concatenation, no template interpolation of user data into SQL. TypeScript strict mode and Zod schema validation at the API boundary enforce that untrusted data cannot flow into execution paths without explicit validation.',
        ],
      },
      {
        question: "Why should AI NOT be the source of truth for your site's visibility?",
        answer: [
          'AI models reconstruct information from patterns in training data and real-time retrieval. Both mechanisms introduce systematic errors that disqualify AI from serving as an auditing ground truth.',
          'Training data lag: AI model training corpora are snapshots. A model trained with a September 2025 cutoff cannot know about a robots.txt change you made in October 2025. Asking ChatGPT whether GPTBot can access your site produces an answer based on whatever state your site was in during the training crawl — not today.',
          "Hallucination: AI models generate plausible-sounding facts that are factually incorrect. In testing across 500+ sites, AI self-reports of schema coverage were wrong approximately 35% of the time — either claiming schema exists that does not, or missing schema that does. An AI saying 'your site has FAQ schema' is not evidence. A Python parser reporting the presence of a specific JSON-LD block at a specific XPath is.",
          'Inconsistency: The same question about the same site asked to the same AI model on two separate occasions can produce different answers. Audit findings need to be deterministic and reproducible. Evidence from a timestamped crawl record is deterministic. An AI summary is not.',
        ],
      },
      {
        question:
          'Why is it dangerous to optimize your site based purely on what AI tools say about it?',
        answer: [
          "If you ask ChatGPT 'does my site have schema markup?' and it says yes, you may stop investigating. But ChatGPT's answer is based on whatever was in its training data or whatever it retrieved in that session. Your site may have had schema that was later removed by a deployment. The training data reflects the old state.",
          'More insidiously, AI tools can introduce confirmation bias loops. If you ask an AI to evaluate your site and it gives you a positive summary, you have received social proof from the very system whose judgment you are trying to influence. This is not evidence — it is circular validation.',
          'The correct source of truth is always the crawl record: what did a real HTTP request to your URL return at a specific timestamp? What JSON-LD was present at DOM parse time? What did the heading structure look like? These are deterministic, reproducible facts. Everything else is inference.',
        ],
      },
      {
        question: 'How does AiVIS.biz prevent AiVIS.biz itself from being scraped or abused?',
        answer: [
          'The /api/analyze endpoint requires JWT authentication, a valid account, a usage allowance check, and Zod schema validation of all parameters. There is no client-controlled API key path — the OpenRouter key and any other AI provider credentials exist only in server-side environment variables and are never transmitted to the client.',
          'Rate limiting, usage gating, and the incrementUsage middleware chain enforce that no authenticated user can make unlimited audit requests — even if they compromise their own account token. Audit requests are logged in the audits table with user ID, IP address, target URL, and response timestamp for monitoring.',
          "The Python microservice that handles validation is not directly reachable from the internet — it communicates only with the internal Express API over a private channel. This means even if an attacker found the validation service's internal address, they cannot invoke it directly.",
        ],
      },
      {
        question: 'What security headers does AiVIS.biz enforce?',
        answer: [
          'AiVIS.biz enforces a strict security header set on all responses. Strict-Transport-Security: max-age=31536000; includeSubDomains; preload forces HTTPS for all connections including future first-load requests. X-Frame-Options: DENY prevents clickjacking via iframe.',
          'Content-Security-Policy is applied with per-request nonces generated by the CSP middleware. Inline scripts require the nonce, and all external script sources are explicitly whitelisted. This prevents XSS payloads from executing even if they are somehow injected into the DOM.',
          'X-Content-Type-Options: nosniff prevents MIME type sniffing attacks. Referrer-Policy: strict-origin-when-cross-origin limits referrer data leakage on cross-origin navigations. Permissions-Policy disables access to sensitive browser APIs (camera, microphone, geolocation) that this application has no need for.',
        ],
      },
    ],
  },

  // ── 5. Getting Started & First Audit ─────────────────────────────────
  {
    id: 'getting-started',
    label: 'Getting Started',
    items: [
      {
        question: 'What is AiVIS.biz?',
        answer: [
          'AiVIS.biz is an evidence-backed AI extraction audit platform. It answers one question: can ChatGPT, Perplexity, Claude, Gemini, and Google AI Overviews actually access, extract, and cite your website — and if not, exactly what is blocking them?',
          "The word 'evidence-backed' is load-bearing. Every finding AiVIS.biz produces is traced to a specific crawl observation via a BRAG evidence ID. You are not told 'add schema' — you are told what schema type is missing, what property is absent, and what it costs you in extraction probability. The Python validation layer ensures these findings are deterministic and reproducible, not AI-inferred.",
          "AiVIS.biz is built for 2026's multi-platform AI reality: a world where your site needs to be extractable by a dozen different AI systems, not just rankable in one search engine.",
        ],
      },
      {
        question: 'Who specifically is AiVIS.biz built for?',
        answer: [
          'In-house marketing and technical SEO teams who have realized that their Google rankings are strong but their AI answer engine presence is absent or inaccurate. They need evidence to justify remediation investment to stakeholders.',
          'Development and DevOps teams who need to know whether a deployment changed their AI extraction readiness — and specifically which change caused a regression. The BRAG evidence trail and historical audit comparison tools answer this directly.',
          'Content strategists and SEOs pivoting from keyword optimization to AI citation optimization. The methodology is different, the signals are different, and the fix sequences are different.',
          'Digital agencies managing client portfolios where AI visibility is becoming a deliverable. AiVIS.biz supports multi-domain workflows, evidence trails that survive team changes, and client-shareable reports.',
          'Founders and startup operators who need to build entity recognition from zero — no Wikipedia page, no years of indexed content, no backlink history. The structured data and entity-building path is clear and achievable for new domains.',
        ],
      },
      {
        question: 'How long does an audit take?',
        answer: [
          'A standard audit completes in 30–90 seconds for most pages. The timeline decomposes as follows: HTTP crawl and page fetch takes 2–5 seconds. Python microservice validation of the scraped HTML runs in parallel and takes under 5 seconds. The AI analysis model processes the extracted signals and generates findings in 10–25 seconds depending on page complexity and model tier.',
          'Signal tier audits include a triple-check pipeline — three AI models in sequence — with the primary model targeting a 25-second deadline, a peer critique model handling score calibration, and a validation gate confirming or adjusting the final finding. Total runtime for Signal audits is typically 45–90 seconds.',
          'Pages that are very large (30,000+ words), heavily nested in JavaScript, or served from slow infrastructure can take longer. The pipeline has a 57-second total deadline with fallback model chains to ensure a result is always returned within this window.',
        ],
      },
      {
        question: 'What happens if my site is completely blocked to AI crawlers?',
        answer: [
          'If your site is blocked at the crawl stage — by robots.txt, CDN WAF, or server firewall — AiVIS.biz detects this and reports it as a critical gating finding. This is the highest-priority class of finding because all other extraction improvements are irrelevant until crawler access is restored.',
          'The BRAG evidence ID for a blocked crawl reports: the user-agent used for the test, the HTTP response code returned (typically 403, 429, or robots Disallow), and the specific rule in robots.txt or the CDN response header that caused the block. The action item is specific: what rule to change, in what file, with what values.',
          'Unblocking AI crawlers is typically a five-minute fix for robots.txt issues and a thirty-minute fix for CDN configuration. After unblocking, re-running the audit confirms access is restored before investing in downstream signal improvements.',
        ],
      },
      {
        question: 'Do I need technical knowledge to act on audit findings?',
        answer: [
          'No. Every AiVIS.biz finding includes a plain-language description of the problem, a specific action item, and in Starter and above tiers, implementation code ready to copy and paste. The code is generated for your specific site context — not generic examples.',
          "For example, an Organization schema finding for a SaaS company called 'Acme Analytics' at acme.com with a LinkedIn profile does not generate 'add Organization schema.' It generates the exact JSON-LD block with your company name, url, sameAs links, and the correct script tag to paste into your HTML head.",
          'Non-technical operators can share BRAG evidence findings directly with their developers using the shareable report link. The developer receives the specific evidence, the specific fix code, and the verification step — no ambiguity about what needs to change.',
        ],
      },
    ],
  },

  // ── 6. Analysis & Scoring ─────────────────────────────────────────────
  {
    id: 'analysis',
    label: 'Analysis & Scoring',
    items: [
      {
        question: 'What does the 0–100 score actually measure?',
        answer: [
          'The score is a composite extraction readiness index — a single number representing how confidently AI answer engines can access, parse, extract, and attribute content from your page. It is not a ranking score, a domain authority metric, or a Google Signal.',
          'Each of the six scored dimensions contributes to the composite with a fixed weight. A score of 85+ generally indicates strong extraction readiness with minor improvements possible. 60–84 indicates moderate readiness with specific, identifiable gaps. Below 60 indicates systematic extraction failures — typically one or more gating blocks — that are preventing reliable inclusion in AI answers.',
          'Scores are page-level, not domain-level. Your homepage may score 78 while a product page scores 42 because of missing schema. Prioritizing fixes based on page criticality and score gaps is the correct remediation strategy.',
        ],
      },
      {
        question: 'How is this different from a standard SEO audit?',
        answer: [
          "The fundamental difference is what success means. A traditional SEO audit optimizes for Google's ranking algorithm: backlinks, keyword relevance, Core Web Vitals, crawl budget. Success is measured in organic search positions and click-through rates.",
          'An AiVIS.biz audit optimizes for AI extraction pipelines: crawler access, schema completeness, rendering, entity attribution. Success is measured in extraction probability — the likelihood that an AI answer engine selects your page as a citable source for relevant queries.',
          'Many SEO best practices carry over (HTTPS, clean URLs, meta descriptions), many do not (backlinks have no effect on AI extraction), and several are actively reversed (some CDN configurations recommended for SEO performance inadvertently block AI crawlers). AiVIS.biz scores the dimensions that matter specifically for AI extraction, not the signals Google uses for ranking.',
        ],
      },
      {
        question: 'What is the triple-check pipeline on Signal tier?',
        answer: [
          'Signal tier audits use a three-model verification pipeline. The primary model — GPT-5 Mini — performs the initial deep analysis of all six extraction dimensions, generates 8–12 prioritized findings, and produces an initial score. It has a 25-second processing deadline.',
          'A second model — Claude Sonnet 4.6 — acts as a peer critique layer. It receives the primary findings and evaluates them for accuracy, completeness, and scoring calibration. It can adjust the score by -15 to +10 points and add additional findings the primary model missed. It runs within a 30-second secondary deadline.',
          'A third model — Grok 4.1 Fast — acts as a validation gate. It either confirms the post-critique score or overrides it with a final determination. Each model has a function-specific token budget (AI1: 5,000 tokens, AI2: 600, AI3: 400) to ensure the pipeline completes within the total 57-second deadline. The response always includes triple_check_enabled: true so the client can surface the multi-model confidence indicator.',
        ],
      },
      {
        question: 'What are recommendations based on and can I trust them?',
        answer: [
          'Every recommendation maps back to a specific evidence observation from the Python validation layer. The AI reasoning layer translates evidence into prioritized actions — but the evidence itself is deterministic and Python-generated, not inferred by the AI.',
          'Recommendations include an implementation priority (critical, high, medium, low), the specific change required, and on Starter and above tiers, a code implementation ready to deploy. The priority is determined by the dimensions the finding affects and the score impact of resolving the gap.',
          'You can validate every recommendation by checking whether the underlying evidence ID appears in your re-audit results after implementing the fix. If the fix was applied correctly, the evidence ID resolves — the finding disappears and the dimension score updates. This verification loop is the core quality mechanism that distinguishes evidence-backed findings from black-box recommendations.',
        ],
      },
      {
        question: 'Why does my score sometimes change between audits of the same page?',
        answer: [
          'Several legitimate causes exist for score variation between audits of an unchanged page. First, server response variability: if your server is under load, returns pages slower than usual, or intermittently returns different content states (A/B test variants, logged-in vs. logged-out views), the crawl catches different snapshots.',
          "Second, model variability: on Observer and Starter tiers, the AI reasoning layer uses free and standard models that have some response variability for non-deterministic outputs like extractability assessments. Signal tier's triple-check pipeline reduces this variability by requiring multi-model agreement.",
          'Third, genuine site changes: a recent deployment, a CMS update that modified meta tags, or a CDN configuration change can all affect audit results without you being aware. The BRAG evidence trail timestamps all findings, which helps isolate whether a score change correlates with a deployment.',
        ],
      },
      {
        question: 'How do I interpret 8–12 recommendations without knowing where to start?',
        answer: [
          "Recommendations are always ordered by extraction impact priority. Start with any finding marked 'critical' — these are gating blocks that prevent extraction entirely. Once gating blocks are resolved, move to 'high' priority findings. Do not skip levels — resolving a medium-priority heading structure issue while a critical robots.txt block persists has zero extraction value.",
          'Within the same priority tier, fix schema and rendering issues before content issues. Schema and rendering are binary checks for AI systems — present or absent. Content improvements are continuous but have lower impact per unit of effort.',
          'After implementing fixes, re-run the audit. The evidence trail shows which findings resolved and which persist. Use the score delta to communicate progress to stakeholders and to validate that the implementation was correct before moving to the next priority tier.',
        ],
      },
    ],
  },

  // ── 7. Plans & Pricing ────────────────────────────────────────────────
  {
    id: 'plans',
    label: 'Plans & Pricing',
    items: [
      {
        question: 'What does Observer (free) include?',
        answer: [
          'Observer tier includes 3 audits per month at no cost. Each audit produces a full extraction readiness score, identification of your top 3 critical blockers with BRAG evidence IDs, and a verdict-first summary that prioritizes the highest-impact issue on your page.',
          'Observer is intentionally scoped to let you verify value before committing. You get enough to understand whether a gating issue exists and whether fixing it is worth investigating on a deeper tier. What Observer does not include: full recommendation lists, implementation code, competitor tracking, or PDF/shareable report exports.',
          'For individual developers, founders, or anyone who wants to run monthly health checks on a single key page, Observer is a permanent free tool — not a trial.',
        ],
      },
      {
        question: 'What does Starter unlock at $15/month?',
        answer: [
          'Starter gives you 15 audits per month and the full recommendation suite. Every finding includes implementation code tailored to your specific page context — not generic examples but JSON-LD blocks, heading rewrites, and meta tag code generated for your actual domain and content.',
          'Starter audits use the same two-model pipeline as Alignment (GPT-5 Nano primary, Claude Haiku 4.5 fallback) at approximately $0.002 per audit — a cost structure that allows comprehensive analysis at consumer pricing.',
          'Shareable public report links and PDF exports are included on Starter. This makes it the practical tier for solo operators reporting to a client or a manager: you can generate an evidence-backed report that looks credible and links directly to the findings.',
        ],
      },
      {
        question: 'What is the difference between Alignment ($49/mo) and Signal ($149/mo)?',
        answer: [
          'Alignment gives you 60 audits per month, competitor tracking, mention monitoring across 19 free social and web sources (Reddit, HN, Mastodon, Google News, GitHub, Dev.to, YouTube, Bluesky, and more), and SerpAPI-enhanced entity clarity scoring.',
          'Signal gives you 110 audits per month and activates the triple-check pipeline: three AI models (GPT-5 Mini → Claude Sonnet 4.6 → Grok 4.1 Fast) run in sequence on every audit. This multi-model agreement mechanism significantly reduces false positives and produces higher-confidence findings. Signal also includes citation testing — you can query AI systems for your primary use cases and see whether your brand appears, in what position, and against which competitors.',
          'The practical difference: Alignment is the right tier if you are managing extraction readiness across a site and tracking competitive gaps. Signal is the right tier if you need to prove that findings are reliable enough to justify engineering investment, or if you are actively testing whether fixes translate into citation improvements.',
        ],
      },
      {
        question: 'What is Score Fix and how does the credit model work?',
        answer: [
          'Score Fix (AutoFix PR) is a $299/month subscription that includes 250 remediation credits per billing cycle. Each automated GitHub PR costs 10–25 credits depending on fix complexity — simple schema patches use fewer credits while multi-file content rewrites with FAQ blocks use more. 250 monthly credits typically cover 10–25 full remediation PRs.',
          'Score Fix includes everything in Signal plus automated GitHub PR generation via MCP, batch remediation across multiple URLs, and evidence-linked PR commits. AiVIS.biz generates a pull request (or equivalent deployment-ready code) for critical and high-priority findings across your site.',
          'Credits reset each billing cycle and are not carried over. A typical allocation for a 20-page site might use 5–15 credits per critical page. The generated implementations are reviewed before deployment and include verification audit runs.',
        ],
      },
      {
        question: 'Can I use AiVIS.biz for client reporting in an agency context?',
        answer: [
          'Yes. Alignment and Signal tiers are both designed for agency workflows. Shareable report links can be sent to clients without requiring them to create an AiVIS.biz account. PDF exports are formatted for client presentation with the BRAG evidence findings summarized in non-technical language.',
          "The evidence trail architecture is specifically valuable for agencies: when a client asks 'what changed since last month?' or 'why did our AI visibility score drop after the site redesign?', the historical audit comparison shows exactly which evidence IDs appeared or resolved between two audit timestamps.",
          'There is no branded white-label layer currently — reports are AiVIS.biz-branded. If agency white-labeling is a requirement for your workflow, reach out through the contact form.',
        ],
      },
    ],
  },

  // ── 8. Privacy & Security ─────────────────────────────────────────────
  {
    id: 'privacy',
    label: 'Privacy & Security',
    items: [
      {
        question: 'What data does AiVIS.biz store from my audits?',
        answer: [
          'AiVIS.biz stores the audit output — the score, dimension scores, BRAG findings, and recommendations — associated with your user ID, the target URL, and a timestamp. This is stored in the analysis_cache and audits tables in our PostgreSQL database.',
          'The raw HTML crawl response is used during the audit pipeline and is not persisted after analysis completes. We do not store the full page content of audited URLs — only the derived findings.',
          'Audit data is stored to enable history, comparison, and report access. It is not sold, not used to train external AI models, and not shared with third parties. You can delete your account and all associated audit data through Account Settings.',
        ],
      },
      {
        question: 'Is payment information stored by AiVIS.biz?',
        answer: [
          'No raw payment card data is stored or processed by AiVIS.biz servers. All payment processing is handled entirely by Stripe, a PCI DSS Level 1 certified payment processor. AiVIS.biz receives and stores only the Stripe customer ID and subscription status — no card numbers, CVV codes, or billing addresses.',
          'Subscription state changes (upgrades, downgrades, cancellations) are processed via Stripe webhooks — cryptographically signed requests that AiVIS.biz validates with the Stripe webhook secret before acting on. This prevents payment state manipulation by unauthorized parties.',
        ],
      },
      {
        question: 'Can I export or delete all my account data?',
        answer: [
          'Yes. Account Settings includes a data export flow that packages your profile, audit history, and associated findings into a downloadable JSON file.',
          'Account deletion is permanent and complete — it removes your user record, all associated sessions, all audit history, and all usage records from the database. It is not soft-deleted or anonymized: it is removed. After deletion, there is no recovery path.',
          'To comply with GDPR right-to-erasure requirements: deletion requests submitted through Settings are processed within 7 days. If you are a European resident and need to escalate a deletion request, contact info is in the Privacy Policy.',
        ],
      },
      {
        question: 'Does AiVIS.biz use my site data to train AI models?',
        answer: [
          'No. Crawled content from your site is used only to generate your specific audit findings and is not persisted after audit completion. AiVIS.biz does not use audit content, user-submitted URLs, or finding data to train any AI model.',
          'The AI analysis layer uses third-party models (OpenAI, Anthropic) via the OpenRouter API. The requests to these models include the extracted page signals but not raw page content or any personally identifiable information. Model providers have their own data usage policies — review their respective privacy policies for training data opt-out options.',
        ],
      },
    ],
  },

  // ── 9. Technical & Platform ───────────────────────────────────────────
  {
    id: 'platform',
    label: 'Technical & Platform',
    items: [
      {
        question: 'Is there an API for programmatic audit access?',
        answer: [
          'Yes. The External API (v1) is available on Starter and above tiers. API keys with the prefix avis_ are issued per account and can be used for Bearer token authentication on all /api/v1/* endpoints. OAuth 2.0 (RFC 6749) is also supported, with token exchange using avist_ prefixed tokens — enabling third-party integrations without sharing primary credentials.',
          'Available API endpoints include: POST /api/v1/analyze (trigger an audit), GET /api/v1/audits (retrieve audit history), GET /api/v1/analytics (score trends over time). The OpenAPI 3.0.3 specification is available at /api/v1/openapi.json for client code generation.',
          'Rate limits apply per tier. All API requests are logged and deducted from your monthly audit allowance. API keys can be rotated or revoked through Account Settings without affecting account access.',
        ],
      },
      {
        question: 'What is the MCP (Model Context Protocol) server?',
        answer: [
          'AiVIS.biz exposes a Model Context Protocol (MCP) JSON-RPC 2.0 server at /api/mcp/* for Alignment and above tiers. MCP is an emerging protocol that allows AI assistants (Claude, Cursor, custom agents) to invoke AiVIS.biz audit tools directly from their context window.',
          "This means you can run AiVIS.biz audits from within an AI coding assistant: type 'audit this URL for AI extraction readiness' and the assistant invokes the AiVIS.biz MCP tool, retrieves the findings, and incorporates them into its response. The 15+ MCP tools include audit execution, competitor comparison, mentor retrieval, and citation testing.",
          'WebMCP at /api/webmcp/* provides a browser-accessible surface of the same tools, useful for integration with browser-based AI agents. Both MCP and WebMCP accept API keys, OAuth tokens, and JWT authentication.',
        ],
      },
      {
        question: 'Does AiVIS.biz test whether my site is actually being cited in live AI answers?',
        answer: [
          'Yes. Citation testing (Signal tier) sends real queries to AI systems for your primary use cases and records which domains appear in responses, in what position, and with what context. This is a live test of AI answer engine output — not an inference about what should appear.',
          "A citation test might query 'best tools for auditing AI extraction readiness' and record every domain that appears in ChatGPT, Perplexity, and Google AI Overview responses. You can see whether your domain appears, where competitors appear, and how the results change after you implement fixes.",
          'Citation test results are stored in the citation_results table with the query, system, response, appearing domains, and timestamp. This longitudinal record lets you track whether extraction improvements translate into citation improvements over time.',
        ],
      },
      {
        question: 'Does AiVIS.biz monitor brand mentions across the web?',
        answer: [
          'Yes. Brand mention monitoring (Alignment and above) scans 19 free web sources for brand name appearances: Reddit, Hacker News, Mastodon, DuckDuckGo/Bing web dorks, Google News, GitHub, Quora, Product Hunt, Stack Overflow, Wikipedia, Dev.to, Medium, YouTube, Lobsters, Bluesky, Twitter/X, Lemmy, and GitHub Discussions.',
          'This monitoring requires no API keys for any of the 19 sources — it uses publicly accessible scraping methods with appropriate rate limiting and politeness headers. Mentions are stored in the brand_mentions table with source, URL, context, and timestamp.',
          'The mention monitoring is not social listening for sentiment analysis. Its primary purpose is entity visibility tracking: is your brand appearing in the sources AI systems are most likely to use when training or retrieving information about your category?',
        ],
      },
      {
        question: 'What is the competitor tracking feature?',
        answer: [
          'Competitor tracking (Alignment and above) lets you add competitor domains and run extraction readiness comparisons side-by-side. For each shared topic page, you can see your score vs. their score across all six dimensions and identify where the extraction gap exists.',
          'The comparison shows you not just that a competitor scores higher but specifically why: they have FAQ schema on five pages you have it on one; their Organization sameAs links to seven profiles, yours links to two; their content pages have Article schema with datePublished, yours do not.',
          'Opportunity detection analysis identifies topic areas where you have content but a competitor has stronger extraction signals — these are the highest-leverage pages to prioritize for schema and content improvements.',
        ],
      },
      {
        question: 'How does email verification work and can I change my email?',
        answer: [
          'Email verification is required before audit access is granted. After registration, a verification link is sent to your email using the Resend API. The link contains a signed token that expires after 24 hours. Clicking it marks your account as verified and activates your Observer allowance.',
          'Email address changes are handled through Account Settings. A verification loop is required for the new address before it is accepted. The old address receives a notification of the change. For security reasons, email changes require an active session with recent authentication — a session older than 24 hours prompts re-authentication before the change is processed.',
        ],
      },
    ],
  },

  // ── 10. Interpreting Results ──────────────────────────────────────────
  {
    id: 'interpreting-results',
    label: 'Interpreting Your Results',
    items: [
      {
        question: 'My site ranked #1 on Google last month — why is my AiVIS.biz score low?',
        answer: [
          "Google rankings and AI extraction readiness are independent properties of a web page. You can hold position #1 for a competitive keyword and simultaneously be completely inaccessible to AI crawlers. This is not a contradiction — it reflects that Google's ranking algorithm and AI extraction pipelines evaluate completely different signals.",
          'A common example: many high-ranking pages are JavaScript SPAs that Google has rendered and indexed through its deferred rendering pipeline. GPTBot does not use deferred rendering. That same page is invisible to GPTBot — empty HTML at the raw server response layer.',
          'The practical implication for 2026: Google rankings drive click traffic. AI extraction readiness drives answer engine presence. Both are required for full-spectrum visibility. Investing only in one produces a site that is strong in one context and absent in the other.',
        ],
      },
      {
        question: "What does a 'critical' vs 'high' vs 'medium' finding mean?",
        answer: [
          'Critical findings are gating blocks — issues that prevent AI extraction entirely, regardless of what other improvements you make. Examples: GPTBot blocked in robots.txt, CDN WAF blocking all AI user-agents, page served with no body content due to JavaScript rendering. These must be resolved first.',
          'High findings are significant gaps in extraction signal quality. Examples: missing Organization schema (anonymous content, no entity attribution), missing Article datePublished (content cannot be temporally attributed), client-side rendering that hides 80% of content. These produce weak or anonymous extraction.',
          'Medium findings reduce extraction quality but do not block it. Examples: heading structure that buries key information below H3, meta description missing or duplicated, Open Graph tags absent. Resolving these improves citation probability but the page can still be extracted without them.',
        ],
      },
      {
        question: 'How do I verify that my fixes actually worked?',
        answer: [
          'Re-run the AiVIS.biz audit on the same URL after deploying fixes. Every BRAG evidence ID from the previous audit either resolves (finding disappears, evidence confirmed absent) or persists (finding remains, evidence still observed). The score delta between the two audits reflects the aggregate improvement.',
          "For schema fixes: use schema.org's Structured Data Testing Tool or Rich Results Test to verify the JSON-LD is syntactically valid before running the AiVIS.biz audit. An invalid JSON-LD block that your site technically has still scores as missing because malformed schema is not extractable.",
          'For rendering fixes: use View Source (Ctrl+U) on your page. If the fix is correct, you should see the content in the raw HTML response now — not just in the browser-rendered DOM. AiVIS.biz will confirm this on re-audit.',
        ],
      },
      {
        question: "My audit found issues on a page I can't change — what do I do?",
        answer: [
          'If the blocked page is a CMS template or a system page (e.g., pagination, author archives), focus extraction investment on the pages you can control: your primary service pages, homepage, and key content pages. AI systems extract from wherever content is accessible — redirecting extraction investment to high-value pages you own is a legitimate prioritization strategy.',
          'For schema issues on pages where you cannot add JSON-LD directly, explore whether your CMS or platform has a structured data plugin or integration. WordPress has Yoast Schema, RankMath, and Schema Pro. Shopify supports JSON-LD injection via theme liquid. Webflow supports custom code injection in page settings.',
          'If a CDN or infrastructure constraint is blocking fixes, the BRAG evidence chain provides everything a devops team needs to understand the issue and the required change — the handoff from marketing to engineering is clean.',
        ],
      },
    ],
  },

  // ── 11. Specific Signal Questions ─────────────────────────────────────
  {
    id: 'signals',
    label: 'Specific Signals & Fixes',
    items: [
      {
        question: 'What exactly needs to be in my robots.txt to allow AI crawlers?',
        answer: [
          "The minimum required to allow all major AI crawlers is explicit User-agent allow rules for each crawler's bot name. Add the following block to your robots.txt, before any Disallow rules: User-agent: GPTBot / Allow: / (for ChatGPT/OpenAI), User-agent: ClaudeBot / Allow: / (for Claude/Anthropic), User-agent: PerplexityBot / Allow: / (for Perplexity), User-agent: anthropic-ai / Allow: / (secondary Anthropic agent), User-agent: GoogleBot / Allow: / (if not already present).",
          "If you have a blanket 'User-agent: * / Disallow: /' rule, you must add the explicit allow rules BEFORE the blanket rule — many robots.txt parsers process rules in order and the first matching rule takes precedence.",
          'After editing robots.txt, verify the result manually: visit yoursite.com/robots.txt in a browser and confirm the allow rules are present. Then run an AiVIS.biz audit — the robots.txt dimension check will confirm whether the rules are correctly parsed.',
        ],
      },
      {
        question: 'What does a complete Organization JSON-LD block look like?',
        answer: [
          "A minimal but complete Organization JSON-LD block for a SaaS company at https://example.com looks like this: { '@context': 'https://schema.org', '@type': 'Organization', '@id': 'https://example.com/#organization', 'name': 'Example Analytics', 'legalName': 'Example Analytics Inc.', 'url': 'https://example.com', 'foundingDate': '2023', 'description': 'Example Analytics audits website extraction readiness for AI answer engines.', 'sameAs': ['https://linkedin.com/company/example-analytics', 'https://twitter.com/exampleanalytics', 'https://github.com/example-analytics', 'https://producthunt.com/products/example-analytics'] }",
          "This block belongs in a script tag in your HTML head on every page: <script type='application/ld+json'>...</script>. It should be globally present — not just on the homepage.",
          'The most common errors: missing sameAs (eliminates cross-platform entity linking), using an inconsistent company name (different from what appears in page text or meta tags), and missing the @id property (prevents schema.org graph resolution). AiVIS.biz flags all three as specific evidence findings.',
        ],
      },
      {
        question: 'How do I add FAQ schema to my page?',
        answer: [
          "FAQ schema uses the FAQPage type with nested Question and Answer types. For a page with three questions, the block looks like: { '@context': 'https://schema.org', '@type': 'FAQPage', 'mainEntity': [{ '@type': 'Question', 'name': 'What does the score mean?', 'acceptedAnswer': { '@type': 'Answer', 'text': 'The full answer text here, written as a complete, citable statement.' }}, ... ] }",
          'The text property of acceptedAnswer should be a complete, standalone answer — not a brief fragment. AI systems extract the acceptedAnswer.text value directly. If it is a one-liner that omits context, the extracted answer is low-quality. Each answer should be at least two to three substantive sentences that an AI model could use as a direct response to the question.',
          "Place the FAQ schema script tag immediately after the last FAQ answer element in your HTML. Validators like schema.org's Structured Data Testing Tool flag FAQ schemas where the page does not contain visible Q-A content matching the schema — ensure your visible page content and schema content are consistent.",
        ],
      },
      {
        question: 'Why does content depth matter and how is it measured?',
        answer: [
          "Content depth (20% of the AiVIS.biz score) measures whether a page provides enough specific, verifiable information for an AI model to extract something genuinely useful. A page that says 'We help businesses grow with AI-powered solutions' gives an extraction pipeline almost nothing: no specific claims, no verifiable facts, no attributable statements.",
          'AiVIS.biz measures content depth by analyzing word count, claim specificity, factual density (ratio of verifiable statements to promotional language), and structural segmentation (whether headings break content into extractable sections). A page scores high on depth if it contains multiple specific, independently verifiable claims organized under clear headings.',
          "The practical improvement is not about writing longer content — it is about writing more specifically. Replace 'Our platform helps you understand your AI visibility' with 'Our audit runs across six scored dimensions: content depth (20%), schema coverage (20%), AI readability (20%), technical SEO (15%), metadata quality (13%), and heading structure (12%).' The second version has extractable specificity; the first does not.",
        ],
      },
      {
        question: 'What is a canonical URL and why does it matter for AI extraction?',
        answer: [
          "A canonical URL is the definitive URL for a piece of content, declared via the <link rel='canonical' href='...' /> tag in the HTML head. When the same page is accessible via multiple URLs (www vs non-www, HTTP vs HTTPS, trailing slash vs none, URL parameters), canonical declaration tells crawlers which URL is the authoritative version.",
          'For AI extraction specifically, canonical inconsistency creates entity confusion: if the same content is extracted from three different URL variants, each variant may receive separate attribution in the crawl corpus. This dilutes the extraction signal for your canonical page. AI systems that retrieve by URL may retrieve the non-canonical variant, which lacks the schema or entity signals you have optimized on the canonical.',
          'AiVIS.biz checks canonical declaration and consistency as part of the technical SEO dimension. The finding triggers if the canonical tag is missing, if it points to a different domain (a common CMS misconfiguration), or if the crawl returns a URL that does not match the declared canonical.',
        ],
      },
    ],
  },

  // ── 12. Core Kernel & Modes ─────────────────────────────────────────
  {
    id: 'core-kernel',
    label: 'Core Kernel, Modes, and Simulation',
    items: [
      {
        question: 'What is the AiVIS Core Kernel?',
        answer: [
          'The Core Kernel is the canonical reasoning spine that unifies Entity Graph, Citation Ledger, AI simulation outputs, temporal memory, and action compilation. It prevents scan, diagnosis, and remediation from drifting into disconnected tool surfaces.',
          'In practical terms, the kernel keeps every output traceable to evidence, every score grounded in ledger truth, and every fix linked to a verifiable outcome path.',
        ],
      },
      {
        question: 'Why does AiVIS use mode-based system states?',
        answer: [
          'AiVIS separates runtime intent into Scan, Observe, Diagnose, and Fix so each mode has one epistemic job. Scan ingests evidence, Observe structures it, Diagnose highlights contradictions and trust gaps, and Fix compiles deterministic remediation.',
          'This separation reduces UI drift and keeps each screen aligned with one truth operation instead of mixing dashboards, reports, and execution controls in the same surface.',
        ],
      },
      {
        question: 'What does the simulation layer add beyond citation tracking?',
        answer: [
          'Tracking tells you whether a model cited you in the past. Simulation estimates how multiple model behaviors are likely to reconstruct your content now, and where distortion or omission risk is highest.',
          'That enables predictive remediation: not just "you were missed," but "you are likely to be missed again unless these specific entity and structure fixes are applied."',
        ],
      },
      {
        question: 'How does temporal memory change decision quality?',
        answer: [
          'Temporal memory converts isolated snapshots into drift-aware history: when citation presence decays, when trust states fragment across engines, and when a fix produces durable lift vs short-lived movement.',
          'Without this timeline view, teams optimize on static reports. With it, teams optimize on verified trend behavior and cross-model stability.',
        ],
      },
    ],
  },
];

function AccordionItem({
  item,
  isOpen,
  onToggle,
  panelId,
}: {
  item: FAQItem;
  isOpen: boolean;
  onToggle: () => void;
  panelId: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 text-left"
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
      >
        <span className="text-base font-semibold text-white">{item.question}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-white/45 transition ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen ? (
        <div id={panelId} className="mt-4 space-y-3">
          {item.answer.map((para, i) => (
            <p key={i} className="text-sm leading-7 text-white/64">
              {para}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function FAQ() {
  const [query, setQuery] = useState('');
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});

  const allItems = categories.flatMap((category) => category.items);

  usePageMeta({
    title: 'AiVIS.biz FAQ | Citation intelligence, plans, scoring, and platform answers',
    description:
      'What AiVIS is, how citation gaps work, the citation ledger, action graphs, pricing, methodology, privacy, and scoring.',
    path: '/faq',
    structuredData: [
      buildWebPageSchema({
        path: '/faq',
        name: 'AiVIS.biz FAQ',
        description:
          'What AiVIS is, how citation gaps work, the citation ledger, action graphs, pricing, methodology, privacy, and scoring.',
      }),
      buildFaqSchema(
        allItems.map((item) => ({ question: item.question, answer: item.answer.join(' ') }))
      ),
      buildBreadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'FAQ', path: '/faq' },
      ]),
    ],
  });

  const filteredCategories = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return categories;
    return categories
      .map((category) => ({
        ...category,
        items: category.items.filter((item) =>
          `${item.question} ${item.answer.join(' ')}`.toLowerCase().includes(needle)
        ),
      }))
      .filter((category) => category.items.length > 0);
  }, [query]);

  return (
    <PublicPageFrame
      icon={HelpCircle}
      title="Frequently asked questions"
      subtitle="Citation intelligence answers across Scan, Observe, Diagnose, Fix, and simulation."
      backTo="/"
      maxWidthClass="max-w-5xl"
    >
      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-white/48">
          Search the FAQ
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/34" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Pricing, data retention, scoring, API access..."
            className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3 pl-11 pr-4 text-sm text-white placeholder:text-white/32 focus:outline-none focus:ring-2 focus:ring-orange-400/70"
          />
        </div>
      </section>

      <div className="mt-8 space-y-10">
        {filteredCategories.map((category) => (
          <section key={category.id}>
            <h2 className="text-xl font-semibold tracking-tight text-white">{category.label}</h2>
            <div className="mt-4 space-y-3">
              {category.items.map((item) => {
                const key = `${category.id}:${item.question}`;
                return (
                  <AccordionItem
                    key={key}
                    item={item}
                    panelId={`faq-panel-${category.id}-${item.question.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                    isOpen={Boolean(openMap[key])}
                    onToggle={() => setOpenMap((prev) => ({ ...prev, [key]: !prev[key] }))}
                  />
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </PublicPageFrame>
  );
}
