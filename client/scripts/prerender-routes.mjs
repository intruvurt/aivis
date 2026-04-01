import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve(process.cwd(), 'dist');
const indexPath = path.join(distDir, 'index.html');
const methodologyTemplatePath = path.resolve(process.cwd(), 'scripts', 'templates', 'methodology-static.html');
const pricingTemplatePath = path.resolve(process.cwd(), 'scripts', 'templates', 'pricing-static.html');

if (!fs.existsSync(indexPath)) {
	console.error('[prerender] dist/index.html not found');
	process.exit(1);
}

const baseHtml = fs.readFileSync(indexPath, 'utf8');
const HOME_EXTRA_HEAD = `
		<script type="application/ld+json">
			{
				"@context": "https://schema.org",
				"@type": "HowTo",
				"@id": "https://aivis.biz/#howto-audit",
				"name": "How to run an AI visibility audit with AiVIS",
				"description": "A step-by-step guide for running an AI visibility audit, reading category scores, and shipping evidence-backed fixes.",
				"totalTime": "PT10M",
				"step": [
					{
						"@type": "HowToStep",
						"position": 1,
						"name": "Enter your page URL",
						"text": "Paste the full URL of the page you want to audit into the AiVIS input field and select your plan tier."
					},
					{
						"@type": "HowToStep",
						"position": 2,
						"name": "Review the visibility score",
						"text": "Read the overall score and category grades for content depth, schema, metadata, headings, technical hygiene, and AI readability."
					},
					{
						"@type": "HowToStep",
						"position": 3,
						"name": "Inspect linked evidence",
						"text": "Each finding references specific evidence from the crawl. Check which evidence items are tied to low-scoring categories."
					},
					{
						"@type": "HowToStep",
						"position": 4,
						"name": "Prioritize and implement fixes",
						"text": "Sort recommendations by impact tier. Implement high-confidence fixes first: schema, content depth, and answer-style blocks usually move scores fastest."
					},
					{
						"@type": "HowToStep",
						"position": 5,
						"name": "Re-audit and compare",
						"text": "After shipping changes, re-run the audit and compare category deltas. Track score movement over time using the report history view."
					}
				]
			}
		</script>`;

const routes = [
	{
		path: '/',
		title: 'AiVIS | AI Visibility Audit for ChatGPT, Perplexity, Claude',
		description: 'AiVIS audits how ChatGPT, Perplexity, Claude, and Google AI read your site and returns a visibility score with evidence-linked fixes.',
		ogTitle: 'AiVIS — AI Visibility Audit for Answer Engines',
		ogDescription: 'Audit how ChatGPT, Perplexity, Claude, and Google AI interpret your site with evidence-linked findings and prioritized fixes.',
		extraHead: HOME_EXTRA_HEAD,
	},
	{
		path: '/landing',
		title: 'AiVIS Landing | AI Visibility Intelligence Audits',
		description: 'Measure whether AI can read, trust, and cite your site with a live evidence-backed AiVIS audit.',
	},
	{
		path: '/pricing',
		title: 'AiVIS Pricing | AI Visibility Audit Plans',
		description: 'AiVIS plans: Observer free tier plus Alignment, Signal, and legacy Score Fix options with multi-model validation and team reporting.',
	},
	{
		path: '/analyze',
		title: 'Run AI Visibility Audit | AiVIS',
		description: 'Run a live AI visibility audit to measure parseability, trust, and citation readiness with evidence-backed scoring.',
	},
	{
		path: '/faq',
		title: 'AiVIS FAQ | AI Visibility Audit Questions',
		description: 'Answers about AI visibility scoring, structured findings, answer-engine readiness, and how AiVIS audits websites.',
	},
	{
		path: '/guide',
		title: 'AiVIS Guide | AI Visibility Workflow',
		description: 'Learn how to run audits, read evidence-backed findings, and ship fixes that improve AI visibility.',
	},
	{
		path: '/workflow',
		title: 'AiVIS Workflow | End-to-End Visibility Operations',
		description: 'Turn AiVIS from a one-off audit into a repeatable AI visibility workflow with baseline, fixes, and re-audit loops.',
	},
	{
		path: '/methodology',
		title: 'AiVIS Methodology | How AI Visibility Scoring Works',
		description: 'How AiVIS scores AI visibility: 6-category evidence model covering content, schema, headings, metadata, and technical SEO with BRAG trail docs.',
		ogTitle: 'AiVIS Methodology - Evidence Grounded AI Visibility Scoring',
		ogDescription: 'The complete scoring framework behind AiVIS audits: dimension weights, validation logic, BRAG trail protocol, and how scores translate to real citation improvements.',
		ogType: 'article',
	},
	{
		path: '/insights',
		title: 'AiVIS Insights Hub | AI Visibility Playbooks',
		description: 'Strategic AI search playbooks covering AI visibility, AEO implementation, and geo-adaptive ranking in 2026.',
	},
	{
		path: '/blogs',
		title: 'AiVIS Blogs | Founder Notes and AI Visibility Essays',
		description: 'Canonical AiVIS blog posts sourced from Intruvurt writing, hosted on aivis.biz/blogs for clean ownership and schema consistency.',
	},
	{
		path: '/blogs/why-i-built-aivis-when-i-realized-most-websites-are-invisible-to-ai',
		title: 'Why I Built AiVIS When I Realized Most Websites Are Invisible To AI | AiVIS Blogs',
		description: 'The origin story behind AiVIS and why evidence-backed AI visibility auditing matters for modern answer-engine discovery.',
		ogType: 'article',
	},
	{
		path: '/blogs/before-you-build-another-saas-run-this-30-second-reality-check',
		title: 'Before You Build Another SaaS, Run This 30-Second Reality Check | AiVIS Blogs',
		description: 'A practical founder filter for distribution risk and discoverability before committing to another product build cycle.',
		ogType: 'article',
	},
	{
		path: '/blogs/answer-engine-optimization-2026-why-citation-readiness-matters',
		title: 'Answer Engine Optimization in 2026 — Why Citation Readiness Matters More Than Ranking | AiVIS Blogs',
		description: 'Ranking position is irrelevant if your content cannot be extracted, attributed, or cited. Here\'s why citation readiness is the core AEO metric.',
		ogType: 'article',
	},
	{
		path: '/blogs/why-traditional-seo-tactics-fail-for-ai-visibility',
		title: 'Why Traditional SEO Tactics Don\'t Work for AI Visibility | AiVIS Blogs',
		description: 'Google ranking and AI extractability are orthogonal metrics. A page can rank #1 for all keywords yet remain invisible in AI answers.',
		ogType: 'article',
	},
	{
		path: '/blogs/building-author-authority-for-citations-e-e-a-t-in-ai-era',
		title: 'Building Author Authority for Citation Workflows — E-E-A-T in the AI Era | AiVIS Blogs',
		description: 'E-E-A-T is no longer just a Google ranking signal. It\'s now a citation eligibility filter that determines whether LLMs will list your source.',
		ogType: 'article',
	},
	{
		path: '/blogs/how-llms-parse-your-content-technical-breakdown',
		title: 'How LLMs Parse Your Content — Technical Breakdown of ChatGPT, Claude, and Perplexity Extraction | AiVIS Blogs',
		description: 'A deep dive into the content signals and structural requirements that answer engines use to extract, rank, and attribute your content.',
		ogType: 'article',
	},
	{
		path: '/blogs/geo-adaptive-ai-ranking-location-intelligence-shapes-answers',
		title: 'Geo-Adaptive AI Ranking — How Location Intelligence Shapes AI Answer Quality | AiVIS Blogs',
		description: 'Answer engines now factor regional availability, jurisdiction, and localized entity resolution into citation eligibility.',
		ogType: 'article',
	},
	{
		path: '/blogs/from-invisible-to-cited-case-study-brand-citation-growth',
		title: 'From Invisible to Cited — Real Case Study: How Brands Move from 0 to 87% Citation Rate | AiVIS Blogs',
		description: 'An in-depth case study showing how a B2B SaaS company restructured their content schema, FAQ depth, and author credibility signals to achieve industry-leading AI citation rates.',
		ogType: 'article',
	},
	{
		path: '/blogs/google-search-console-data-ai-visibility-monitoring',
		title: 'Integrating Google Search Console Data with AI Visibility Monitoring | AiVIS Blogs',
		description: 'Learn how to correlate GSC performance data (impressions, clicks, position) with AI citation metrics to identify gaps and opportunities.',
		ogType: 'article',
	},
	{
		path: '/blogs/7-step-implementation-roadmap-audit-to-live-citations-30-days',
		title: 'The 7-Step Implementation Roadmap: From Audit to Live Citations in 30 Days | AiVIS Blogs',
		description: 'A tactical, week-by-week playbook for turning AI visibility audit results into live citations and tracked improvements.',
		ogType: 'article',
	},
	{
		path: '/blogs/google-search-console-2026-what-actually-matters-now',
		title: 'Google Search Console in 2026: What Actually Matters Now | AiVIS Blogs',
		description: 'Google Search Console has evolved from a diagnostic toolkit into a strategic command center. Learn the five critical changes that actually matter for AI visibility and search dominance in 2026.',
		ogType: 'article',
	},
	{
		path: '/blogs/the-river-changed-direction-why-ai-answer-engines-rewrote-the-web',
		title: 'The River Changed Direction: Why AI Answer Engines Rewrote the Web | AiVIS Blogs',
		description: 'The shift from click-based SEO to AI answer engines is a structural internet change. Visibility now depends on machine trust, extractability, and citation readiness.',
		ogType: 'article',
	},
	{
		path: '/blogs/webmcp-is-the-protocol-seo-aeo-geo-never-had',
		title: 'WebMCP Is the Protocol SEO, AEO, and GEO Never Had | AiVIS Blogs',
		description: 'SEO optimized for humans clicking links. AEO optimized for answer engines quoting you. GEO optimized for location queries. WebMCP does something none of them attempted: it gives AI agents a direct line into your site.',
		ogType: 'article',
	},
	{
		path: '/blogs/aivis-api-access-explained-build-on-the-visibility-layer',
		title: 'AiVIS API Access Explained: Build on the Visibility Layer | AiVIS Blogs',
		description: 'Full breakdown of AiVIS API and WebMCP access: how to generate keys, authenticate requests, pull audit data, trigger scans, and integrate visibility intelligence into your own stack.',
		ogType: 'article',
	},
	{
		path: '/blogs/aivis-platform-source-of-truth-every-feature-and-tool-explained',
		title: 'AiVIS Platform Source of Truth: Every Feature and Tool Explained | AiVIS Blogs',
		description: 'The definitive reference for everything AiVIS does — every tier, every tool, every pipeline, every integration — explained in operational detail.',
		ogType: 'article',
	},
	{
		path: '/blogs/why-aivis-is-different-from-every-other-seo-aeo-platform',
		title: 'Why AiVIS Is Different From Every Other SEO and AEO Platform | AiVIS Blogs',
		description: 'AiVIS is not an SEO tool with AI branding. It is a fundamentally different system built for a fundamentally different internet. Here is why the architecture matters.',
		ogType: 'article',
	},
	{
		path: '/blogs/ai-visibility-tools-2026-what-semrush-ahrefs-moz-cant-measure',
		title: 'AI Visibility Tools in 2026: What Semrush, Ahrefs, and Moz Cannot Measure | AiVIS Blogs',
		description: 'Semrush, Ahrefs, Moz, and traditional SEO platforms were built to optimize rankings on a blue-link results page. AI answer engines bypass that page entirely. Here is what falls through the cracks — and the new measurement layer that fills the gap.',
		ogType: 'article',
	},
	{
		path: '/blogs/how-to-get-cited-by-chatgpt-perplexity-gemini-ai-citation-guide',
		title: 'How to Get Cited by ChatGPT, Perplexity, and Gemini: The Structural Blueprint for AI Citations | AiVIS Blogs',
		description: 'A technical guide to the structural signals ChatGPT, Perplexity, Gemini, and Claude evaluate when selecting sources to cite. Not theory — measurable page-level changes that increase citation probability.',
		ogType: 'article',
	},
	{
		path: '/blogs/how-aivis-works-under-the-hood-full-technical-breakdown',
		title: 'How AiVIS Works Under the Hood: Full Technical Breakdown | AiVIS Blogs',
		description: 'A complete walkthrough of what happens between entering a URL and receiving a visibility score. Crawl pipeline, AI model chain, evidence framework, and citation verification explained.',
		ogType: 'article',
	},
	{
		path: '/blogs/why-agencies-and-smbs-are-switching-to-aivis-for-real-visibility',
		title: 'Why Agencies and SMBs Are Switching to AiVIS for Real Visibility | AiVIS Blogs',
		description: 'The gap between traditional SEO tools and what AI answer engines actually need is costing businesses citations every day. AiVIS closes that gap for agencies managing multiple clients and SMBs competing against bigger brands.',
		ogType: 'article',
	},
	{
		path: '/blogs/team-workspaces-how-aivis-handles-multi-client-agency-operations',
		title: 'Team Workspaces: How AiVIS Handles Multi-Client Agency Operations | AiVIS Blogs',
		description: 'A deep dive into the new team workspace layer. Role-based access, workspace scoping, invite management, and how agencies can isolate audit data per client.',
		ogType: 'article',
	},
	{
		path: '/blogs/citation-testing-explained-how-to-verify-ai-models-can-find-you',
		title: 'Citation Testing Explained: How to Verify AI Models Can Actually Find You | AiVIS Blogs',
		description: 'Your schema is perfect. Your headings are clean. But do AI answer engines actually cite you? Citation testing tells you the truth using three independent search engines.',
		ogType: 'article',
	},
	{
		path: '/blogs/competitor-tracking-find-the-structural-gaps-and-win',
		title: 'Competitor Tracking on AiVIS: Find the Structural Gaps and Win | AiVIS Blogs',
		description: 'Side-by-side visibility audits, opportunity detection, and structural gap analysis. How to use competitor tracking to overtake rivals in AI answer engine citations.',
		ogType: 'article',
	},
	{
		path: '/blogs/brand-mention-tracking-where-ai-discovers-new-sources',
		title: 'Brand Mention Tracking: Where AI Models Discover New Sources | AiVIS Blogs',
		description: 'AI models learn about new brands from community platforms. AiVIS scans nine free sources to show you where your brand signal lives and where it is missing.',
		ogType: 'article',
	},
	{
		path: '/blogs/ssfr-evidence-framework-the-scoring-engine-behind-aivis',
		title: 'The SSFR Evidence Framework: The Scoring Engine Behind Every AiVIS Audit | AiVIS Blogs',
		description: 'Source, Signal, Fact, Relationship. The 27-rule deterministic evidence engine that evaluates machine readability before any AI model gets involved.',
		ogType: 'article',
	},
	{
		path: '/blogs/score-fix-autopr-how-ai-opens-pull-requests-to-fix-your-visibility',
		title: 'Score Fix AutoPR: How AI Opens Pull Requests to Fix Your Visibility | AiVIS Blogs',
		description: 'Most audit tools tell you what to fix. AiVIS Score Fix generates the actual code changes and opens a GitHub PR. Here is how automated remediation works.',
		ogType: 'article',
	},
	{
		path: '/blogs/reverse-engineering-competitors-decompile-ghost-audit-simulate',
		title: 'Reverse Engineering Competitors: Decompile, Ghost Audit, and Simulate | AiVIS Blogs',
		description: 'Take apart any competitor page structure. Run a ghost audit without them knowing. Simulate how AI models evaluate their content versus yours.',
		ogType: 'article',
	},
	{
		path: '/blogs/free-tools-schema-validator-robots-checker-content-extractability',
		title: 'Three Free Tools: Schema Validator, Robots Checker, and Content Extractability | AiVIS Blogs',
		description: 'No account required. No paywall. Three diagnostic tools that show you exactly what AI crawlers see when they visit your site.',
		ogType: 'article',
	},
	{
		path: '/blogs/scheduled-rescans-and-autopilot-monitoring-set-it-and-track-it',
		title: 'Scheduled Rescans and Autopilot Monitoring: Set It and Track It | AiVIS Blogs',
		description: 'Configure recurring audits, track score deltas over time, and get alerts when visibility changes. Autopilot monitoring for agencies and teams.',
		ogType: 'article',
	},
	{
		path: '/blogs/bix-boundaries-in-excess-how-guidebot-redefines-ai-platform-assistants',
		title: 'BIX: Boundaries in Excess — How GuideBot Redefines AI Platform Assistants | AiVIS Blogs',
		description: 'GuideBot is not a chatbot. It is a bounded intelligence system built around page-aware context, tier-gated recommendations, and a closed knowledge graph. Here is why that matters.',
		ogType: 'article',
	},
	{
		path: '/blogs/your-website-is-not-competing-for-clicks-anymore',
		title: 'Your Website Is Not Competing for Clicks Anymore. It Is Competing to Be Included. | AiVIS Blogs',
		description: 'Why AI visibility audits matter now, what most sites still get wrong, and how AiVIS already helps expose the gap between ranking and being understood by answer engines.',
		ogType: 'article',
	},
	{
		path: '/why-ai-visibility',
		title: 'Why AI Visibility Matters | AiVIS',
		description: 'Understand why AI answer engines are replacing traditional search and why citation readiness now drives visibility.',
	},
	{
		path: '/ai-search-visibility-2026',
		title: 'AI Search Visibility in 2026 | AiVIS',
		description: 'A strategic breakdown of how AI search visibility is changing in 2026 and what teams must fix now.',
	},
	{
		path: '/aeo-playbook-2026',
		title: 'AEO Playbook 2026 | AiVIS',
		description: 'A practical AEO playbook for building answer-engine-ready pages that AI systems can interpret and cite.',
	},
	{
		path: '/geo-ai-ranking-2026',
		title: 'Geo AI Ranking 2026 | AiVIS',
		description: 'Learn how geography-aware answer engines interpret location relevance, trust, and structured local content.',
	},
	{
		path: '/compare',
		title: 'AiVIS Compare | Alternative Benchmarking',
		description: 'Compare AiVIS against other AI visibility and answer-engine optimization platforms across evidence, scoring, and workflow depth.',
	},
	{
		path: '/compare/aivis-vs-otterly',
		title: 'AiVIS vs Otterly | AI Visibility Comparison',
		description: 'Detailed comparison of AiVIS vs Otterly for actionable AI visibility scoring, evidence trails, and implementation-ready fixes.',
	},
	{
		path: '/compare/aivis-vs-reaudit',
		title: 'AiVIS vs Reaudit | AI Visibility Comparison',
		description: 'See how AiVIS compares to Reaudit for AEO-era auditing, machine readability analysis, and structured recommendation depth.',
	},
	{
		path: '/compare/aivis-vs-profound',
		title: 'AiVIS vs Profound | AI Visibility Comparison',
		description: 'See why AiVIS focuses on evidence-backed site fixes, not just monitoring mentions across AI answer surfaces.',
	},
	{
		path: '/compare/aivis-vs-semrush',
		title: 'AiVIS vs Semrush: AI Visibility Audit vs SEO Suite (2026 Comparison)',
		description: 'Semrush measures search engine rankings. AiVIS measures whether AI answer engines can read, trust, and cite your website. Detailed feature comparison for 2026.',
		ogType: 'article',
	},
	{
		path: '/compare/aivis-vs-ahrefs',
		title: 'AiVIS vs Ahrefs: AI Visibility Audit vs Backlink Intelligence (2026 Comparison)',
		description: 'Ahrefs maps backlinks and keyword rankings. AiVIS audits whether AI answer engines can extract, trust, and cite your content. Full 2026 feature comparison.',
		ogType: 'article',
	},
	{
		path: '/compare/aivis-vs-rankscale',
		title: 'AiVIS vs RankScale: AI Visibility Audit vs AI-Enhanced SEO (2026 Comparison)',
		description: 'RankScale uses AI for content optimization within search rankings. AiVIS audits whether AI answer engines can extract, trust, and cite your content. 2026 comparison.',
		ogType: 'article',
	},
	{
		path: '/glossary',
		title: 'AI Visibility & AEO Glossary — Key Terms Defined | AiVIS',
		description: 'Comprehensive glossary of AI visibility, answer engine optimization (AEO), and AI citation readiness terms. Definitions for AI Visibility Score, content extractability, entity clarity, Triple-Check validation, and more.',
	},
	{
		path: '/benchmarks',
		title: 'AI Search Visibility Benchmarks 2026 | AiVIS',
		description: 'Benchmark data on extractability, content structure, and AI visibility performance across real websites.',
	},
	{
		path: '/about',
		title: 'About AiVIS | Intruvurt Labs',
		description: 'About AiVIS and Intruvurt Labs: the AI visibility audit platform focused on answer-engine readiness and evidence-backed fixes.',
	},
	{
		path: '/press',
		title: 'Press & Media | AiVIS',
		description: 'Press resources, media coverage, and public milestones for AiVIS by Intruvurt Labs. TechCrunch Startup Battlefield Top 200 nominee.',
	},
	{
		path: '/compliance',
		title: 'Compliance & Security | AiVIS',
		description: 'AiVIS compliance and security posture, including GDPR operations, controls, and SOC roadmap status.',
	},
	{
		path: '/integrations',
		title: 'Integrations Hub | AiVIS',
		description: 'Explore AiVIS integrations, automation endpoints, and connected workflows for analytics and operations.',
	},
	{
		path: '/competitive-landscape',
		title: 'Competitive Landscape | AiVIS',
		description: 'Compare your AI visibility performance against competitors using evidence-backed benchmarking and insights.',
	},
	{
		path: '/score-fix',
		title: 'Score Fix | AiVIS',
		description: 'Score Fix workflows for evidence-linked remediation, implementation guidance, and audit-driven improvement loops.',
	},
	{
		path: '/api-docs',
		title: 'AiVIS API Documentation',
		description: 'Documentation for AiVIS APIs covering audits, analytics, evidence, and visibility workflows.',
	},
	{
		path: '/help',
		title: 'AiVIS Help Center',
		description: 'Platform documentation and support guidance for AI visibility auditing, referrals, reports, and workflows.',
	},
	{
		path: '/support',
		title: 'AiVIS Support',
		description: 'Customer support and help resources for AiVIS platform usage, billing, and troubleshooting.',
	},
	{
		path: '/server-headers',
		title: 'AiVIS Server Headers Analyzer',
		description: 'Inspect response headers, cache directives, and security header posture for public web pages.',
	},
	{
		path: '/verify-license',
		title: 'AiVIS License Verification',
		description: 'Public license verification page for validating AiVIS license keys and status.',
	},
	{
		path: '/privacy',
		title: 'AiVIS Privacy Policy',
		description: 'Review AiVIS data collection, storage, and privacy practices for the AI visibility platform.',
	},
	{
		path: '/terms',
		title: 'AiVIS Terms of Service',
		description: 'Terms and conditions for using AiVIS and its AI visibility audit, reporting, and optimization workflows.',
	},
	{
		path: '/changelog',
		title: 'Changelog | AiVIS',
		description: 'A permanent ledger of every update, fix, and improvement shipped to AI Visibility Engine.',
	},
	{
		path: '/indexing',
		title: 'URL Indexing & IndexNow | AiVIS',
		description: 'Check Google and Bing indexing status and submit URLs via IndexNow for faster crawl discovery.',
	},
	{
		path: '/tools/schema-validator',
		title: 'Schema Markup Validator — AI Citation Readiness Check | AiVIS',
		description: 'Free tool to validate structured data (JSON-LD, OpenGraph, Twitter Cards) for AI citation readiness. See what AI models can extract from your page.',
	},
	{
		path: '/tools/robots-checker',
		title: 'AI Crawler Access Checker — Robots.txt Audit for AI Bots | AiVIS',
		description: 'Free tool to check if GPTBot, ClaudeBot, Googlebot, and 12 other AI crawlers can access your site. Audit robots.txt, meta robots, and X-Robots-Tag.',
	},
	{
		path: '/tools/content-extractability',
		title: 'Content Extractability Grader — AI Answer Block Analysis | AiVIS',
		description: 'Free tool to grade how well AI models can extract answers from your page. Analyzes heading hierarchy, FAQ patterns, and content structure.',
	},
	{
		path: '/reverse-engineer',
		title: 'Reverse Engineer | AiVIS',
		description: 'Deconstruct how AI models build answers. Decompile, blueprint, diff, and simulate tools for AI content engineering.',
	},
	{
		path: '/prompt-intelligence',
		title: 'Prompt Intelligence — AI Query Analysis | AiVIS',
		description: 'Understand how AI models interpret queries about your brand. Map prompt patterns to inclusion, exclusion, and competitor displacement outcomes.',
	},
	{
		path: '/answer-presence',
		title: 'Answer Presence Engine — AI Platform Visibility | AiVIS',
		description: 'Track whether your brand appears in AI-generated answers across ChatGPT, Perplexity, Claude, and Google AI. Evidence-based presence detection.',
	},
	{
		path: '/brand-integrity',
		title: 'Brand Integrity Monitor — AI Accuracy Tracking | AiVIS',
		description: 'Monitor what AI platforms and public sources say about your brand. Detect misrepresentations, track accuracy over time, and protect brand integrity.',
	},
	{
		path: '/blogs/cannot-access-before-initialization-react-vite-production-tdz-fix',
		title: 'Cannot Access Before Initialization — React + Vite Production TDZ Fix | AiVIS Blogs',
		description: 'How to diagnose and fix the ReferenceError: Cannot access variable before initialization in React + Vite production builds caused by temporal dead zone issues.',
		ogType: 'article',
	},
	{
		path: '/blogs/how-mcp-audit-workflows-change-everything-for-dev-teams',
		title: 'How MCP Audit Workflows Change Everything for Dev Teams | AiVIS Blogs',
		description: 'Learn how Model Context Protocol integrations let AI agents run visibility audits directly from your IDE, automating the audit-to-fix cycle.',
		ogType: 'article',
	},
	{
		path: '/blogs/team-workspace-aivis-the-shared-audit-layer-builders-have-been-missing',
		title: 'Team Workspace: The Shared Audit Layer Builders Have Been Missing | AiVIS Blogs',
		description: 'How AiVIS team workspaces give agencies and engineering teams a shared audit feed, role-based access, and coordinated visibility tracking.',
		ogType: 'article',
	},
	{
		path: '/blogs/webmcp-third-party-tool-calling-aivis-the-headless-audit-engine',
		title: 'WebMCP Third-Party Tool Calling: AiVIS as a Headless Audit Engine | AiVIS Blogs',
		description: 'AiVIS exposes MCP-compatible endpoints that turn it into a headless audit engine any AI agent can call for structured visibility data.',
		ogType: 'article',
	},
	{
		path: '/blogs/answer-engine-optimization-is-not-the-new-seoits-the-big-brother',
		title: 'Answer Engine Optimization Is Not the New SEO — It Is the Big Brother | AiVIS Blogs',
		description: 'Why AEO supersedes traditional SEO and how AI answer engines evaluate content differently from search engine crawlers.',
		ogType: 'article',
	},
	{
		path: '/blogs/startups-seoaeo-in-2026-a-strategic-guide-for-the-ai-first-era',
		title: 'Startups SEO/AEO in 2026: A Strategic Guide for the AI-First Era | AiVIS Blogs',
		description: 'A strategic guide for startups navigating SEO and AEO in 2026, covering AI visibility, citation readiness, and machine-legible content.',
		ogType: 'article',
	},
	{
		path: '/blogs/the-old-saas-model-was-simple',
		title: 'The Old SaaS Model Was Simple | AiVIS Blogs',
		description: 'How the traditional SaaS model is being disrupted by AI-first platforms and what it means for product builders shipping in 2026.',
		ogType: 'article',
	},
	{
		path: '/blogs/json-ld-schema-strategy-get-cited-by-ai-models',
		title: 'How to Build a JSON-LD Schema Strategy That Gets Your Site Cited by AI Models | AiVIS Blogs',
		description: 'A technical implementation guide for JSON-LD schema strategies that increase citation probability across ChatGPT, Perplexity, Claude, and Gemini.',
		ogType: 'article',
	},
	{
		path: '/blogs/google-search-console-hiding-ai-visibility-gaps',
		title: 'Why Your Google Search Console Data Is Hiding Your AI Visibility Gaps | AiVIS Blogs',
		description: 'Google Search Console measures crawl health and keyword rankings but cannot detect whether AI answer engines can extract, trust, or cite your content.',
		ogType: 'article',
	},
	{
		path: '/blogs/answer-engine-optimization-complete-guide-small-business',
		title: 'The Complete Guide to Answer Engine Optimization for Small Business Websites | AiVIS Blogs',
		description: 'A practical AEO guide for small business owners covering schema markup, FAQ structure, content extractability, and citation readiness for AI answer engines.',
		ogType: 'article',
	},
	{
		path: '/blogs/entity-clarity-why-ai-models-cite-some-brands-ignore-others',
		title: 'Entity Clarity: Why AI Models Cite Some Brands and Ignore Others | AiVIS Blogs',
		description: 'AI models cite brands with clear entity signals. Learn what entity clarity means, how LLMs resolve brand identity, and what to fix on your site.',
		ogType: 'article',
	},
	{
		path: '/blogs/how-to-audit-website-ai-readiness-10-minutes',
		title: 'How to Audit Your Website for AI Readiness in Under 10 Minutes | AiVIS Blogs',
		description: 'A practical checklist for auditing your website AI readiness in under 10 minutes, covering schema, headings, FAQ blocks, metadata, and content structure.',
		ogType: 'article',
	},
	{
		path: '/blogs/death-of-click-through-rates-what-replaces-ctr-ai-answers',
		title: 'The Death of Click-Through Rates: What Replaces CTR When AI Answers the Question | AiVIS Blogs',
		description: 'CTR was the lingua franca of web marketing. AI answer engines bypass clicks entirely. Here are the new metrics that matter for visibility in 2026.',
		ogType: 'article',
	},
	{
		path: '/partnership-terms',
		title: 'Referral and Delivery Partnership Terms | AiVIS',
		description: 'Official partnership terms for referral and delivery partnerships with AiVIS AI Visibility Intelligence.',
	},
	{
		path: '/conversational-query-playbook-2026',
		title: 'Conversational Query Playbook 2026 | AiVIS',
		description: 'Master conversational query optimization for AI answer engines. Practical playbook for structuring content that wins in dialogue-based search.',
	},
	{
		path: '/voice-search-ai-answer-optimization-2026',
		title: 'Voice Search & AI Answer Optimization 2026 | AiVIS',
		description: 'Optimize your content for voice search and AI answer engines. Strategy guide for spoken-query visibility in 2026.',
	},
	{
		path: '/keywords',
		title: 'Keyword Intelligence | AiVIS',
		description: 'AI-powered keyword intelligence. Discover which queries trigger AI citations and track your keyword visibility across answer engines.',
	},
	{
		path: '/competitors',
		title: 'Competitor Tracking | AiVIS',
		description: 'Track competitor AI visibility scores, structural gaps, and citation presence. Find opportunities to outperform rival brands.',
	},
	{
		path: '/citations',
		title: 'Citation Testing | AiVIS',
		description: 'Test whether AI models cite your brand. Run live citation checks against ChatGPT, Perplexity, Gemini, and Claude.',
	},
	{
		path: '/reports',
		title: 'Audit Reports | AiVIS',
		description: 'Access your AI visibility audit reports. Export, share, and track score trends over time.',
	},
	{
		path: '/analytics',
		title: 'Analytics & Score Trends | AiVIS',
		description: 'Track your AI visibility score history, trends, and performance analytics over time.',
	},
	{
		path: '/niche-discovery',
		title: 'Niche Discovery | AiVIS',
		description: 'Discover untapped niches and content opportunities where AI models lack authoritative sources.',
	},
	{
		path: '/mcp',
		title: 'MCP Console | AiVIS',
		description: 'Model Context Protocol console. Connect AiVIS audits to your development workflow via MCP integration.',
	},
	{
		path: '/gsc',
		title: 'Google Search Console Analysis | AiVIS',
		description: 'Analyze your Google Search Console data through an AI visibility lens. Identify gaps between traditional SEO and AI readiness.',
	},
	{
		path: '/referrals',
		title: 'Referral Program | AiVIS',
		description: 'Earn rewards by referring others to AiVIS. Track your referral links, conversions, and earnings.',
	},
	{
		path: '/team',
		title: 'Team Workspace | AiVIS',
		description: 'Manage your team workspace. Invite members, assign roles, and collaborate on AI visibility audits.',
	},
];

function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function updateTag(html, regex, replacement) {
	return regex.test(html) ? html.replace(regex, replacement) : html;
}

function escapeHtml(value) {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function normalizeMetaDescription(value, maxLength = 160) {
	const compact = String(value || '').replace(/\s+/g, ' ').trim();
	if (!compact) return '';
	if (compact.length <= maxLength) return compact;
	const clipped = compact.slice(0, maxLength);
	const lastSpace = clipped.lastIndexOf(' ');
	return `${(lastSpace > 80 ? clipped.slice(0, lastSpace) : clipped).trim()}...`;
}

function jsonLdScript(data) {
	return `<script type="application/ld+json">\n${JSON.stringify(data, null, 2)}\n</script>`;
}

function buildFaqSchema(items) {
	return {
		'@context': 'https://schema.org',
		'@type': 'FAQPage',
		mainEntity: items.map((item) => ({
			'@type': 'Question',
			name: item.question,
			acceptedAnswer: {
				'@type': 'Answer',
				text: item.answer,
			},
		})),
	};
}

function buildCollectionPageSchema({ canonicalUrl, name, description, parts = [] }) {
	return {
		'@context': 'https://schema.org',
		'@type': 'CollectionPage',
		'@id': `${canonicalUrl}#collection`,
		url: canonicalUrl,
		name,
		description,
		isPartOf: { '@id': 'https://aivis.biz/#website' },
		about: { '@id': 'https://aivis.biz/#product' },
		hasPart: parts.map((part, index) => ({
			'@type': 'WebPage',
			position: index + 1,
			name: part.name,
			url: part.url,
			description: part.description,
		})),
	};
}

function buildTechArticleSchema({ canonicalUrl, title, description, about, steps = [] }) {
	return {
		'@context': 'https://schema.org',
		'@type': 'TechArticle',
		'@id': `${canonicalUrl}#article`,
		headline: title,
		url: canonicalUrl,
		description,
		mainEntityOfPage: canonicalUrl,
		datePublished: '2026-01-01',
		dateModified: '2026-03-17',
		author: {
			'@type': 'Organization',
			name: 'AiVIS',
			url: 'https://aivis.biz/',
		},
		publisher: { '@id': 'https://aivis.biz/#organization' },
		about,
		articleSection: steps,
	};
}

function buildHowToSchema({ canonicalUrl, name, description, steps }) {
	return {
		'@context': 'https://schema.org',
		'@type': 'HowTo',
		'@id': `${canonicalUrl}#howto`,
		name,
		description,
		totalTime: 'PT10M',
		step: steps.map((step, index) => ({
			'@type': 'HowToStep',
			position: index + 1,
			name: step.name,
			text: step.text,
		})),
	};
}

function buildItemListSchema({ canonicalUrl, name, items }) {
	return {
		'@context': 'https://schema.org',
		'@type': 'ItemList',
		'@id': `${canonicalUrl}#comparison-list`,
		name,
		itemListElement: items.map((item, index) => ({
			'@type': 'ListItem',
			position: index + 1,
			name: item.name,
			description: item.description,
		})),
	};
}

function buildServiceSchema({ canonicalUrl, name, description, audience, deliverables }) {
	return {
		'@context': 'https://schema.org',
		'@type': 'Service',
		'@id': `${canonicalUrl}#service`,
		url: canonicalUrl,
		name,
		description,
		serviceType: 'AI visibility remediation',
		provider: { '@id': 'https://aivis.biz/#organization' },
		audience: {
			'@type': 'Audience',
			audienceType: audience,
		},
		hasOfferCatalog: {
			'@type': 'OfferCatalog',
			name: 'Score Fix deliverables',
			itemListElement: deliverables.map((item, index) => ({
				'@type': 'Offer',
				position: index + 1,
				itemOffered: {
					'@type': 'Service',
					name: item,
				},
			})),
		},
	};
}

const routeSpecificEnrichment = {
	'/integrations': {
		tldr: 'The Integrations Hub explains how AiVIS connects audits to real operations through workspace API keys, webhook delivery, scheduled rescans, and Auto Score Fix automation.',
		sections: [
			{
				heading: 'Why integrations matter for AI visibility operations',
				paragraphs: [
					'AI visibility work is not useful if it stops at a single report. The integrations route makes the operational layer explicit: teams can move audit data into internal dashboards, trigger external workflows when scores change, and monitor feature availability without guessing which capabilities are live.',
					'That makes this route valuable to both crawlers and buyers because it describes AiVIS as a working system, not just a landing page promise. It ties audits, usage metering, validation endpoints, and automation controls into one coherent machine-readable narrative.'
				],
			},
			{
				heading: 'Core integration workflows',
				paragraphs: [
					'Workspace-scoped API keys support programmatic access for reporting systems, agency dashboards, and validation pipelines. Webhook delivery sends audit and automation events to downstream tools such as Slack, Discord, Zapier, and custom endpoints so teams can act on score movement without polling.',
					'Scheduled rescans keep important URLs under continuous review, while Auto Score Fix converts validated findings into implementation-ready remediation changes against connected repositories. Together these workflows connect measurement, verification, and action.'
				],
				listItems: [
					'Feature status checks expose whether API access, webhooks, and automation are enabled for the current workspace tier.',
					'Endpoint validation confirms whether core routes are reachable or intentionally gated by auth, credits, or plan restrictions.',
					'Integration controls centralize configuration that would otherwise be buried inside advanced settings.'
				],
			},
			{
				heading: 'What machine-readable depth this page adds',
				paragraphs: [
					'The prerendered version of the integrations page gives answer engines a direct explanation of what AiVIS automates, who it is for, and how API, webhook, and remediation workflows connect to the product. That additional context reinforces platform capability, operational maturity, and implementation depth across the public site graph.'
				],
			},
		],
		buildExtraHead(canonicalUrl, route) {
			return [
				jsonLdScript(buildCollectionPageSchema({
					canonicalUrl,
					name: route.title,
					description: route.description,
					parts: [
						{ name: 'API Documentation', url: 'https://aivis.biz/api-docs', description: 'Developer reference for audits, analytics, evidence, and validation endpoints.' },
						{ name: 'Score Fix', url: 'https://aivis.biz/score-fix', description: 'Remediation workflow that turns findings into implementation-ready fixes.' },
						{ name: 'Help Center', url: 'https://aivis.biz/help', description: 'Support documentation for audits, billing, and platform operations.' },
					],
				})),
				jsonLdScript(buildFaqSchema([
					{ question: 'What does the AiVIS integrations route explain?', answer: 'It explains how audits connect to API keys, webhooks, scheduled rescans, and Auto Score Fix automation so teams can operationalize AI visibility work.' },
					{ question: 'Are integrations purely marketing claims?', answer: 'No. The page documents concrete endpoint checks, gating behavior, and configuration surfaces that map to actual product workflows.' },
					{ question: 'Why does this route matter for AI readability?', answer: 'It adds explicit system-level context about automation, event delivery, and API-driven usage that strengthens how machines interpret the product.' },
				])),
			].join('\n');
		},
	},
	'/api-docs': {
		tldr: 'The API Docs route defines how developers authenticate with AiVIS, which endpoints exist, what scopes are enforced, and how audit data can be consumed safely in production workflows.',
		sections: [
			{
				heading: 'Developer intent and endpoint coverage',
				paragraphs: [
					'This route exists for engineering teams that need direct access to audit history, analytics, evidence views, usage metering, and page validation workflows. It clarifies that AiVIS supports real integration use cases such as CI checks, agency dashboards, score monitoring, and internal reporting pipelines.',
					'For AI readability, the important signal is specificity. The page names authentication patterns, route groups, scopes, and common error states instead of relying on vague statements about having an API.'
				],
			},
			{
				heading: 'Production-safe API behavior',
				paragraphs: [
					'API keys are workspace-scoped and evaluated server-side for entitlement, scope, and revocation state. The documentation route also explains that session-auth feature routes are distinct from public API key workflows, which helps machines and humans distinguish management surfaces from external integration endpoints.',
					'The page also describes how common failure modes work in practice: invalid keys return 401, missing scope returns 403, and unsupported or unsafe targets fail validation. This operational detail strengthens trust and reduces ambiguity around how the product behaves under real load.'
				],
				listItems: [
					'Endpoint groups include audits, analytics, evidence, competitors, usage, and technical page validation.',
					'Key scopes such as read:audits and read:analytics define what integrations can access.',
					'Webhook dispatch and usage tracking reinforce that the API is meant for ongoing automation, not just one-off demos.'
				],
			},
			{
				heading: 'Why this route helps site-wide machine interpretation',
				paragraphs: [
					'A good documentation page acts as evidence that the platform has concrete interfaces, defined permissions, and observable behavior. Enriching this prerendered snapshot helps answer engines interpret AiVIS as a technical product with a stable API surface rather than a generic marketing application.'
				],
			},
		],
		buildExtraHead(canonicalUrl, route) {
			return [
				jsonLdScript(buildTechArticleSchema({
					canonicalUrl,
					title: route.title,
					description: route.description,
					about: [
						'API key authentication',
						'Audit and analytics endpoints',
						'Usage metering and webhook integrations',
					],
					steps: ['Quickstart', 'Authentication', 'Endpoint Surface', 'Troubleshooting'],
				})),
				jsonLdScript(buildHowToSchema({
					canonicalUrl,
					name: 'How to integrate with the AiVIS API',
					description: 'A quickstart for creating an API key, calling audit endpoints, and monitoring usage in AiVIS.',
					steps: [
						{ name: 'Create an API key', text: 'Generate a workspace API key from the product settings or feature panel with the scopes required for your integration.' },
						{ name: 'Call audit or analytics endpoints', text: 'Send Bearer-authenticated requests to AiVIS API routes for audit listings, evidence payloads, analytics, and technical validation.' },
						{ name: 'Handle production errors', text: 'Respect 401, 403, and validation error responses so your automation can distinguish invalid keys, missing scopes, and unsafe targets.' },
						{ name: 'Monitor usage and events', text: 'Use metering endpoints and webhook delivery to keep integrations observable and tier-safe over time.' },
					],
				})),
				jsonLdScript(buildFaqSchema([
					{ question: 'What does the AiVIS API expose?', answer: 'It exposes audit, analytics, evidence, usage, competitor, and page-validation endpoints intended for reporting, automation, and verification workflows.' },
					{ question: 'How is authentication handled?', answer: 'External integrations use workspace-scoped API keys with server-side scope and entitlement checks on every request.' },
					{ question: 'Why does documentation help AI readability?', answer: 'Detailed API documentation proves concrete product capability, naming, permissions, and operational behavior, which improves machine interpretation of the platform.' },
				])),
			].join('\n');
		},
	},
	'/compare': {
		tldr: 'The comparison route positions AiVIS against traditional SEO suites and lighter content tools by focusing on live URL auditing, evidence trails, multi-model validation, and AI citation readiness.',
		sections: [
			{
				heading: 'What this comparison page is actually comparing',
				paragraphs: [
					'Compare is not a generic feature checklist. It explains that many established SEO tools are strong for backlinks, keyword research, or content scoring, but they do not usually combine real-time page auditing, evidence-linked grading, multi-model review, and citation-testing workflows in one product.',
					'That distinction matters for answer-engine discovery because AI visibility depends on extractability, trust, and implementation depth rather than keyword rank alone. The page states that difference directly, which improves entity separation between AiVIS and adjacent tool categories.'
				],
			},
			{
				heading: 'Signals that differentiate AiVIS',
				paragraphs: [
					'The core differentiators highlighted on this route are real-time URL audits, triple-check or multi-model review, BRAG evidence linking, AI citation testing, and implementation-oriented score fixing. Those are the exact concepts machines should associate with AiVIS when comparing it to Semrush, Ahrefs, Surfer, Clearscope, and MarketMuse.',
					'By naming both the adjacent category and the missing capability, this page becomes a stronger comparative knowledge asset instead of a thin table shell.'
				],
				listItems: [
					'AiVIS emphasizes auditable findings and machine-readable fixes, not just keyword or content optimization metrics.',
					'Traditional SEO suites are framed as partial overlaps rather than direct substitutes for AI visibility remediation.',
					'The route reinforces that citation readiness and answer-engine extraction are separate from classic rank tracking.'
				],
			},
			{
				heading: 'How this strengthens site-wide readability',
				paragraphs: [
					'Comparison pages help search systems understand category boundaries. A richer prerendered compare page tells machines what AiVIS is, what it is not, which competitor classes overlap, and where the product is differentiated. That improves topical clarity across the broader public site.'
				],
			},
		],
		buildExtraHead(canonicalUrl, route) {
			return [
				jsonLdScript(buildItemListSchema({
					canonicalUrl,
					name: 'AiVIS comparison set',
					items: [
						{ name: 'AiVIS', description: 'AI visibility auditing with evidence-backed scoring, citation testing, and score remediation.' },
						{ name: 'Semrush', description: 'Traditional SEO suite with partial overlap on audits and monitoring.' },
						{ name: 'Ahrefs', description: 'Backlink and SEO intelligence platform with limited AI visibility overlap.' },
						{ name: 'Surfer SEO', description: 'Content optimization platform with partial overlap on on-page recommendations.' },
						{ name: 'Clearscope', description: 'Content scoring product with limited support for AI citation readiness.' },
						{ name: 'MarketMuse', description: 'Content planning tool with limited overlap on live AI visibility audits.' },
					],
				})),
				jsonLdScript(buildFaqSchema([
					{ question: 'What is the purpose of the AiVIS comparison page?', answer: 'It explains how AiVIS differs from traditional SEO and content tools by focusing on AI visibility, evidence quality, and citation readiness.' },
					{ question: 'Does the page claim every competitor is identical?', answer: 'No. It positions them by category and overlap level so readers can see which capabilities partially intersect and which are missing.' },
					{ question: 'Why is comparison content useful for AI systems?', answer: 'It clarifies category boundaries and differentiators, helping machines interpret AiVIS as a distinct product within the broader search and content tooling landscape.' },
				])),
			].join('\n');
		},
	},
	'/score-fix': {
		tldr: 'Score Fix is the remediation layer of AiVIS. It turns evidence-backed audit findings into concrete structural, content, schema, proof, and internal-link changes that can be rechecked after implementation.',
		sections: [
			{
				heading: 'From diagnosis to remediation',
				paragraphs: [
					'Audit products often stop after pointing out problems. Score Fix exists to close that gap by mapping low-scoring issues to specific remediation targets such as clearer category language, stronger answer blocks, aligned schema, proof sections, and better internal linking.',
					'This route is valuable because it explains the operational meaning of a fix plan. The product is not only telling users that a page is weak for AI extraction; it is defining how that page should be rewritten and what should be rechecked after changes ship.'
				],
			},
			{
				heading: 'What a Score Fix pack includes',
				paragraphs: [
					'The fix workflow prioritizes the blockers that usually hold back machine interpretation: weak entity clarity, thin answer blocks, missing proof layers, schema-content mismatch, weak topical reinforcement, and stale trust signals. Deliverables are designed to move those variables in a measurable way.',
					'Because the route names both the blockers and the outputs, it helps answer engines connect the term Score Fix to real remediation work instead of treating it as a vague marketing phrase.'
				],
				listItems: [
					'Entity rewrite guidance for headings, hero copy, and service framing.',
					'Answer-block and FAQ recommendations that improve direct retrieval.',
					'Schema, proof, and internal-link recommendations tied to implementation order and re-audit loops.'
				],
			},
			{
				heading: 'Why this page improves public AI readability',
				paragraphs: [
					'The prerendered Score Fix route adds a strong service narrative to the site: AiVIS does not just measure AI visibility, it also provides a remediation framework for improving it. That distinction increases topical depth around fixes, implementation, and measurable score movement.'
				],
			},
		],
		buildExtraHead(canonicalUrl, route) {
			return [
				jsonLdScript(buildServiceSchema({
					canonicalUrl,
					name: 'AI Visibility Score Fix',
					description: route.description,
					audience: 'Local businesses, SaaS teams, agencies, and service operators',
					deliverables: [
						'Entity rewrite pack',
						'Answer-block remediation pack',
						'Proof and evidence reinforcement pack',
						'Schema and internal-link alignment pack',
						'Re-check and verification guidance',
					],
				})),
				jsonLdScript(buildFaqSchema([
					{ question: 'What is Score Fix in AiVIS?', answer: 'Score Fix is the remediation workflow that turns audit findings into prioritized content, schema, proof, and internal-link changes.' },
					{ question: 'Does Score Fix only describe problems?', answer: 'No. It focuses on implementation targets and re-check guidance so teams can move from diagnosis to measurable improvement.' },
					{ question: 'Why is Score Fix important for AI visibility?', answer: 'Because better citations and extraction quality come from structural fixes, not from reports alone. Score Fix defines the changes that improve those outcomes.' },
				])),
			].join('\n');
		},
	},
	'/help': {
		tldr: 'The Help Center organizes product questions about audits, scoring, billing, privacy, support, and advanced features so users and crawlers can understand how the AiVIS platform works end to end.',
		sections: [
			{
				heading: 'What the Help Center covers',
				paragraphs: [
					'The help route is a broad documentation layer rather than a generic contact page. It explains how first audits work, how scores are calculated, what BRAG evidence means, which paid features unlock citations or competitor tracking, how billing behaves, and what security controls are in place.',
					'This kind of broad, factual support content is useful to answer engines because it associates the brand with operational definitions, policy explanations, and concrete product terminology across multiple user intents.'
				],
			},
			{
				heading: 'Support paths and product education',
				paragraphs: [
					'The route brings together customer support, technical troubleshooting, pricing questions, citation workflows, reverse-engineer tooling, and privacy answers. It also points users toward deeper pages such as the guide, FAQ, pricing, privacy, and settings routes when a topic needs more than a short answer.',
					'For site-wide readability this matters because support content closes semantic gaps that pure marketing pages often leave open. It provides the plain-language definitions and operational clarifications that help machines interpret the rest of the product correctly.'
				],
				listItems: [
					'Getting started guidance explains first audits, score ranges, and public URL restrictions.',
					'Feature documentation covers competitor tracking, citation testing, reverse engineering, and report sharing.',
					'Billing and privacy sections reinforce plan structure, cancellation behavior, and data handling practices.'
				],
			},
			{
				heading: 'Why this route is high-value for prerendering',
				paragraphs: [
					'A rich Help Center snapshot gives crawlers a stable, high-density knowledge page full of definitions, product concepts, and user-intent answers. That makes it one of the strongest routes for improving site-wide AI readability because it spans audits, workflows, pricing, and support in one place.'
				],
			},
		],
		buildExtraHead(canonicalUrl, route) {
			return [
				jsonLdScript(buildCollectionPageSchema({
					canonicalUrl,
					name: 'AiVIS Help Center',
					description: route.description,
					parts: [
						{ name: 'Guide', url: 'https://aivis.biz/guide', description: 'Workflow guidance for audits, fixes, and rechecks.' },
						{ name: 'FAQ', url: 'https://aivis.biz/faq', description: 'Frequently asked questions about AI visibility scoring and audits.' },
						{ name: 'Pricing', url: 'https://aivis.biz/pricing', description: 'Plan and billing information for Observer, Alignment, Signal, and Score Fix.' },
						{ name: 'Privacy', url: 'https://aivis.biz/privacy', description: 'Privacy and security information for the AiVIS platform.' },
					],
				})),
				jsonLdScript(buildFaqSchema([
					{ question: 'What kinds of questions does the AiVIS Help Center answer?', answer: 'It answers questions about audits, score interpretation, citations, competitor tracking, billing, privacy, and support workflows.' },
					{ question: 'Why is the Help Center important for site understanding?', answer: 'It gives machines and users direct definitions for product concepts, policies, and support paths that are otherwise spread across multiple pages.' },
					{ question: 'Is the Help Center only for troubleshooting?', answer: 'No. It also acts as platform documentation that explains how AiVIS works and how key features connect.' },
				])),
			].join('\n');
		},
	},
};

function renderSection(section) {
	const paragraphs = (section.paragraphs || [])
		.map((paragraph) => `<p style="margin: 0 0 12px; color: #374151;">${escapeHtml(paragraph)}</p>`)
		.join('');
	const list = section.listItems?.length
		? `<ul style="margin: 0; padding-left: 20px; color: #374151;">${section.listItems
			.map((item) => `<li>${escapeHtml(item)}</li>`)
			.join('')}</ul>`
		: '';

	return `<section aria-labelledby="${escapeHtml(section.id || section.heading.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}" style="margin-top: 18px;">
				<h2 id="${escapeHtml(section.id || section.heading.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}" style="font-size: 20px; margin: 0 0 10px;">${escapeHtml(section.heading)}</h2>
				${paragraphs}${list}
			</section>`;
}

function renderRouteBody(route, canonicalUrl) {
	const title = escapeHtml(route.title);
	const description = escapeHtml(normalizeMetaDescription(route.description, 220));
	const routeLabel = escapeHtml(route.path === '/' ? 'home page' : route.path.replace(/^\//, ''));
	const enrichment = routeSpecificEnrichment[route.path];
	const tldr = enrichment?.tldr
		? escapeHtml(enrichment.tldr)
		: 'AiVIS evaluates whether answer engines can parse, trust, and cite page content with evidence-backed scoring and implementation-ready fixes. This route is prerendered with canonical metadata for machine readability and stable indexing.';
	const detailSections = enrichment?.sections || [
		{
			heading: 'Route context',
			id: 'route-context',
			paragraphs: [
				`The ${route.path === '/' ? 'home page' : route.path.replace(/^\//, '')} route supports the broader AiVIS visibility workflow by giving users a stable location for route-specific guidance, product context, and machine-readable metadata. When crawlers or answer engines fetch this URL, they should receive clear page purpose, canonical references, and enough plain-language context to understand how the page fits into AI visibility operations.`,
				'This matters because thin pages with only a title and one sentence often underperform in machine interpretation. AiVIS prerender pages now provide concise but explicit route summaries, route purpose, and operational context to improve extractability across search, answer engines, and link unfurl previews.',
			],
		},
		{
			heading: 'AI visibility signals',
			id: 'signals',
			listItems: [
				'Clear heading hierarchy and unambiguous intent mapping.',
				'Structured metadata consistency across title, description, Open Graph, and canonical URL.',
				'Entity and schema clarity for citation-readiness in answer engines.',
				'Actionable audit loops: baseline scan, implementation, and re-audit verification.',
			],
		},
		{
			heading: 'What this page contributes',
			id: 'next-step',
			paragraphs: [
				'Every prerendered AiVIS page contributes to a stronger public knowledge graph by reinforcing terminology such as AI visibility, answer-engine readiness, citation analysis, evidence-backed scoring, and implementation workflows. Even when JavaScript is unavailable, this HTML snapshot ensures the route preserves enough content depth and metadata quality to remain understandable and indexable.',
			],
		},
	];

	return `<body>
		<div id="root">
			<main style="max-width: 840px; margin: 0 auto; padding: 48px 20px; font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #111827; line-height: 1.65;">
				<header style="margin-bottom: 24px; border-bottom: 1px solid rgba(0,0,0,0.12); padding-bottom: 16px;">
					<h1 style="margin: 0 0 10px; font-size: 34px; line-height: 1.15; letter-spacing: -0.02em;">${title}</h1>
					<p style="margin: 0; color: #374151;">${description}</p>
				</header>
				<section aria-labelledby="tldr" style="margin-bottom: 16px;">
					<h2 id="tldr" style="font-size: 20px; margin: 0 0 10px;">TLDR</h2>
					<p style="margin: 0; color: #374151;">${tldr}</p>
				</section>
				<section aria-labelledby="prerender-note">
					<h2 id="prerender-note" style="font-size: 20px; margin: 0 0 10px;">Prerendered route snapshot</h2>
					<p style="margin: 0 0 12px; color: #4b5563;">This HTML snapshot ensures route-specific crawlable content and metadata for <strong>${escapeHtml(route.path)}</strong>.</p>
					<p style="margin: 0; color: #4b5563;">Canonical URL: <a href="${canonicalUrl}" style="color:#1d4ed8;">${canonicalUrl}</a></p>
				</section>
				${detailSections.map((section) => renderSection(section)).join('')}
			</main>
		</div>
	</body>`;
}

function prerenderHtml(route) {
	if (route.path === '/pricing' && fs.existsSync(pricingTemplatePath)) {
		return fs.readFileSync(pricingTemplatePath, 'utf8');
	}

	if (route.path === '/methodology' && fs.existsSync(methodologyTemplatePath)) {
		return fs.readFileSync(methodologyTemplatePath, 'utf8');
	}

	const canonicalUrl = `https://aivis.biz${route.path === '/' ? '' : route.path}`;
	const ogTitle = route.ogTitle || route.title;
	const normalizedDescription = normalizeMetaDescription(route.description);
	const ogDescription = normalizeMetaDescription(route.ogDescription || route.description);
	const ogType = route.ogType || 'website';
	const enrichment = routeSpecificEnrichment[route.path];
	let html = baseHtml;

	if (route.path !== '/') {
		html = html.replace(
			/<script type="application\/ld\+json">(?:(?!<\/script>)[\s\S])*?"@id":\s*"https:\/\/aivis\.biz\/#homepage-article"(?:(?!<\/script>)[\s\S])*?<\/script>/,
			''
		);
	}

	html = updateTag(html, /<title>.*?<\/title>/s, `<title>${route.title}</title>`);
	html = updateTag(html, /<meta\s+name="description"\s+content="[^"]*"\s*\/>/, `<meta name="description" content="${normalizedDescription}" />`);
	html = updateTag(html, /<link\s+rel="canonical"\s+href="[^"]*"\s*\/>/, `<link rel="canonical" href="${canonicalUrl}" />`);
	html = updateTag(html, /<meta\s+property="og:type"\s+content="[^"]*"\s*\/>/, `<meta property="og:type" content="${ogType}" />`);
	html = updateTag(html, /<meta\s+property="og:title"\s+content="[^"]*"\s*\/>/, `<meta property="og:title" content="${ogTitle}" />`);
	html = updateTag(html, /<meta\s+property="og:description"\s+content="[^"]*"\s*\/>/, `<meta property="og:description" content="${ogDescription}" />`);
	html = updateTag(html, /<meta\s+property="og:url"\s+content="[^"]*"\s*\/>/, `<meta property="og:url" content="${canonicalUrl}" />`);
	html = updateTag(html, /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/>/, `<meta name="twitter:title" content="${ogTitle}" />`);
	html = updateTag(html, /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/>/, `<meta name="twitter:description" content="${ogDescription}" />`);

	// Use negative lookahead to prevent crossing </script> boundaries.
	// The old regex used [\s\S]*? which consumed SoftwareApplication, Organization,
	// and WebSite blocks along with WebPage, leaving only 2 JSON-LD blocks in output.
	html = html.replace(
		/<script type="application\/ld\+json">(?:(?!<\/script>)[\s\S])*?"@type":\s*"WebPage"(?:(?!<\/script>)[\s\S])*?<\/script>/,
		`<script type="application/ld+json">\n      {\n        "@context": "https://schema.org",\n        "@type": "WebPage",\n        "@id": "${canonicalUrl}#webpage",\n        "name": "${route.title}",\n        "url": "${canonicalUrl}",\n        "description": "${normalizedDescription}",\n        "isPartOf": { "@id": "https://aivis.biz/#website" },\n        "about": { "@id": "https://aivis.biz/#software-application" },\n        "publisher": { "@id": "https://aivis.biz/#organization" },\n        "inLanguage": "en-US",\n        "dateModified": "2026-03-15",\n        "primaryImageOfPage": {\n          "@type": "ImageObject",\n          "url": "https://aivis.biz/og-image2.png"\n        }\n      }\n    </script>`
	);

	if (route.path !== '/') {
		html = html.replace(
			'</head>',
			`<script type="application/ld+json">\n      {\n        "@context": "https://schema.org",\n        "@type": "BreadcrumbList",\n        "itemListElement": [\n          { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://aivis.biz/" },\n          { "@type": "ListItem", "position": 2, "name": "${escapeHtml(route.title)}", "item": "${canonicalUrl}" }\n        ]\n      }\n    </script>\n  </head>`
		);
	}

	const extraHead = [enrichment?.buildExtraHead?.(canonicalUrl, route), route.extraHead].filter(Boolean).join('\n');

	if (extraHead) {
		html = html.replace('</head>', `${extraHead}\n  </head>`);
	}

	if (route.path !== '/') {
		html = html.replace(/<body>[\s\S]*<\/body>/, renderRouteBody(route, canonicalUrl));
	}

	return `<!-- prerendered-route:${route.path} -->\n${html}`;
}

for (const route of routes) {
	const html = prerenderHtml(route);
	const targetDir = route.path === '/' ? distDir : path.join(distDir, route.path.replace(/^\//, ''));
	fs.mkdirSync(targetDir, { recursive: true });
	const targetPath = route.path === '/' ? indexPath : path.join(targetDir, 'index.html');
	fs.writeFileSync(targetPath, html, 'utf8');
	console.log(`[prerender] wrote ${targetPath}`);
}

