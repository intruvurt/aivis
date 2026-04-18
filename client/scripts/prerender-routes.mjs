import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve(process.cwd(), 'dist');
const indexPath = path.join(distDir, 'index.html');
const methodologyTemplatePath = path.resolve(process.cwd(), 'scripts', 'templates', 'methodology-static.html');
const pricingTemplatePath = path.resolve(process.cwd(), 'scripts', 'templates', 'pricing-static.html');

// ── Blog content loader ──────────────────────────────────────────────
// Reads blogs.ts and blogReady.generated.ts at build time so each blog
// prerenders with unique article content instead of generic boilerplate.
function loadBlogContentMap() {
	const blogsPath = path.resolve(process.cwd(), 'src/content/blogs.ts');
	const generatedPath = path.resolve(process.cwd(), 'src/content/blogReady.generated.ts');
	const map = new Map();

	function extractField(block, fieldName) {
		for (const q of ["'", '"']) {
			const r = new RegExp(fieldName + `:\\s*\\n?\\s*${q}([^${q}]*)${q}`);
			const m = block.match(r);
			if (m) return m[1];
		}
		return '';
	}
	function extractNumber(block, fieldName) {
		const m = block.match(new RegExp(fieldName + ':\\s*(\\d+)'));
		return m ? parseInt(m[1]) : 0;
	}
	function extractStringArray(block, fieldName) {
		const m = block.match(new RegExp(fieldName + ':\\s*\\[([\\s\\S]*?)\\]'));
		if (!m) return [];
		return [...m[1].matchAll(/'([^']*)'/g)].map((x) => x[1]);
	}
	function extractAuthorName(block) {
		const m = block.match(/author:\s*\{[^}]*?name:\s*'([^']*)'/s);
		return m ? m[1] : 'AiVIS.biz Team';
	}
	function extractFeaturedImageUrl(block) {
		const m = block.match(/featuredImage:\s*\{[\s\S]*?url:\s*['"](https?:[^'"]*)['"]/);
		return m ? m[1] : '';
	}
	function extractContent(block) {
		const m = block.match(/content:\s*`([\s\S]*?)`/);
		return m ? m[1].trim() : '';
	}

	// Parse generated file (JSON-like)
	if (fs.existsSync(generatedPath)) {
		try {
			const raw = fs.readFileSync(generatedPath, 'utf8');
			const jsonStr = raw.replace(/^\/\*[\s\S]*?\*\/\s*export\s+const\s+\w+\s*=\s*/, '').replace(/;\s*$/, '');
			const entries = JSON.parse(jsonStr);
			for (const e of entries) {
				map.set(e.slug, {
					excerpt: e.excerpt || e.description || '',
					keyPoints: e.keyPoints || [],
					authorName: e.author?.name || 'AiVIS.biz Team',
					publishedAt: e.publishedAt || '',
					readMinutes: e.readMinutes || 5,
					category: e.category || '',
					tags: e.tags || [],
					contentPreview: (e.content || '').slice(0, 2000),
					featuredImageUrl: e.featuredImage?.url || '',
				});
			}
		} catch (err) {
			console.warn('[prerender] Warning: could not parse blogReady.generated.ts:', err.message);
		}
	}

	// Parse blogs.ts using block splitting
	if (fs.existsSync(blogsPath)) {
		try {
			const raw = fs.readFileSync(blogsPath, 'utf8');
			const arrayStart = raw.indexOf('STATIC_BLOG_ENTRIES');
			if (arrayStart === -1) throw new Error('STATIC_BLOG_ENTRIES not found');
			const text = raw.slice(arrayStart);
			const slugPattern = /slug:\s*'([^']+)'/g;
			const slugPositions = [];
			let sm;
			while ((sm = slugPattern.exec(text)) !== null) {
				slugPositions.push({ slug: sm[1], index: sm.index });
			}
			for (let i = 0; i < slugPositions.length; i++) {
				const { slug, index } = slugPositions[i];
				if (map.has(slug)) continue;
				const endIndex = i + 1 < slugPositions.length ? slugPositions[i + 1].index : text.length;
				const block = text.slice(index, endIndex);
				const content = extractContent(block);
				map.set(slug, {
					excerpt: extractField(block, 'excerpt') || extractField(block, 'description'),
					keyPoints: extractStringArray(block, 'keyPoints'),
					authorName: extractAuthorName(block),
					publishedAt: extractField(block, 'publishedAt'),
					readMinutes: extractNumber(block, 'readMinutes') || 5,
					category: extractField(block, 'category'),
					tags: extractStringArray(block, 'tags'),
					contentPreview: content.slice(0, 2000),
					featuredImageUrl: extractFeaturedImageUrl(block),
				});
			}
		} catch (err) {
			console.warn('[prerender] Warning: could not parse blogs.ts:', err.message);
		}
	}
	console.log(`[prerender] Loaded ${map.size} blog entries for content enrichment`);
	return map;
}

// ── Keyword page content loader ──────────────────────────────────────
// Reads the keyword cluster files so each /platforms/, /problems/,
// /signals/, /industries/, and /compare/ page prerenders with unique content.
function loadKeywordPageMap() {
	const map = new Map();
	// Each entry: { file, routeCluster } — routeCluster is the URL prefix
	const clusterFiles = [
		{ file: 'platforms', routeCluster: 'platforms' },
		{ file: 'problems', routeCluster: 'problems' },
		{ file: 'problemsExtended', routeCluster: 'problems' },
		{ file: 'problemsRaw', routeCluster: 'problems' },
		{ file: 'signals', routeCluster: 'signals' },
		{ file: 'industries', routeCluster: 'industries' },
		{ file: 'compare', routeCluster: 'compare' },
	];
	for (const { file, routeCluster } of clusterFiles) {
		const filePath = path.resolve(process.cwd(), `src/data/keywordPages/${file}.ts`);
		if (!fs.existsSync(filePath)) continue;
		try {
			const raw = fs.readFileSync(filePath, 'utf8');
			// Extract each page entry by finding slug fields
			const slugPattern = /slug:\s*"([^"]+)"/g;
			const slugPositions = [];
			let sm;
			while ((sm = slugPattern.exec(raw)) !== null) {
				slugPositions.push({ slug: sm[1], index: sm.index });
			}
			for (let i = 0; i < slugPositions.length; i++) {
				const { slug, index } = slugPositions[i];
				const endIndex = i + 1 < slugPositions.length ? slugPositions[i + 1].index : raw.length;
				const block = raw.slice(index, endIndex);
				// Extract hook
				const hookMatch = block.match(/hook:\s*"([^"]*(?:\\.[^"]*)*)"/s);
				const hook = hookMatch ? hookMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n') : '';
				// Extract sections
				const sections = [];
				const sectionPattern = /heading:\s*"([^"]*)"[\s\S]*?content:\s*\[([\s\S]*?)\]/g;
				let secMatch;
				while ((secMatch = sectionPattern.exec(block)) !== null) {
					const heading = secMatch[1];
					const contentBlock = secMatch[2];
					const paragraphs = [...contentBlock.matchAll(/"([^"]*(?:\\.[^"]*)*)"/g)].map((m) =>
						m[1].replace(/\\"/g, '"').replace(/\\n/g, '\n')
					);
					sections.push({ heading, paragraphs });
				}
				// Extract FAQs
				const faqs = [];
				const faqPattern = /question:\s*"([^"]*(?:\\.[^"]*)*)"[\s\S]*?answer:\s*\n?\s*"([^"]*(?:\\.[^"]*)*)"/g;
				let faqMatch;
				while ((faqMatch = faqPattern.exec(block)) !== null) {
					faqs.push({
						question: faqMatch[1].replace(/\\"/g, '"'),
						answer: faqMatch[2].replace(/\\"/g, '"'),
					});
				}
				const routePath = routeCluster === 'compare' ? `/compare/${slug}` : `/${routeCluster}/${slug}`;
				map.set(routePath, { hook, sections, faqs, cluster: routeCluster });
			}
		} catch (err) {
			console.warn(`[prerender] Warning: could not parse ${file}.ts:`, err.message);
		}
	}
	console.log(`[prerender] Loaded ${map.size} keyword pages for content enrichment`);
	return map;
}

const blogContentMap = loadBlogContentMap();
const keywordPageMap = loadKeywordPageMap();

if (!fs.existsSync(indexPath)) {
	console.error('[prerender] dist/index.html not found');
	process.exit(1);
}

const baseHtml = fs.readFileSync(indexPath, 'utf8');
const BUILD_DATE = new Date().toISOString().slice(0, 10);

// ── Prerendered footer for all pages — satisfies Google OAuth branding requirements ──
const PRERENDER_FOOTER = `<footer style="max-width:840px;margin:32px auto 0;padding:24px 20px;border-top:1px solid rgba(0,0,0,0.10);font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#6b7280;font-size:13px;line-height:1.6;">
	<p style="margin:0 0 8px;font-weight:600;color:#111827;">AiVIS — AI Visibility Audit | Evidence-Backed by CITE LEDGER</p>
	<p style="margin:0 0 12px;">AiVIS.biz is an AI visibility and citation readiness platform that audits how AI answer engines — ChatGPT, Perplexity, Google AI Overviews, and Claude — read, interpret, and cite your website. Every finding is tied to verifiable on-page evidence through BRAG (Based-Retrieval-Auditable-Grading) evidence identifiers.</p>
	<nav style="margin:0 0 12px;" aria-label="Footer links">
		<a href="https://aivis.biz/privacy" style="color:#1d4ed8;margin-right:16px;">Privacy Policy</a>
		<a href="https://aivis.biz/terms" style="color:#1d4ed8;margin-right:16px;">Terms of Service</a>
		<a href="https://aivis.biz/about" style="color:#1d4ed8;margin-right:16px;">About</a>
		<a href="https://aivis.biz/disclosures" style="color:#1d4ed8;margin-right:16px;">Disclosures</a>
		<a href="mailto:support@aivis.biz" style="color:#1d4ed8;">Contact</a>
	</nav>
	<p style="margin:0;font-size:11px;color:#9ca3af;">&copy; ${new Date().getFullYear()} AiVIS.biz. All rights reserved.</p>
</footer>`;

const HOME_EXTRA_HEAD = `
		<script type="application/ld+json">
			{
				"@context": "https://schema.org",
				"@type": "HowTo",
				"@id": "https://aivis.biz/#howto-audit",
				"name": "How to run an AI visibility audit with AiVIS.biz",
				"description": "A step by step guide for running an AI visibility audit, reading category scores and shipping evidence-backed fixes.",
				"totalTime": "PT10M",
				"step": [
					{
						"@type": "HowToStep",
						"position": 1,
						"name": "Enter your page URL",
						"text": "Paste the full URL of the page you want to audit into the AiVIS.biz input field and select your plan tier."
					},
					{
						"@type": "HowToStep",
						"position": 2,
						"name": "Review the visibility score",
						"text": "Read the overall score and category grades for content depth, schema, metadata, headings, technical hygiene and AI readability."
					},
					{
						"@type": "HowToStep",
						"position": 3,
						"name": "Inspect linked evidence IDs",
						"text": "Each finding references specific evidence from the crawl. Check which evidence items are tied to low-scoring categories."
					},
					{
						"@type": "HowToStep",
						"position": 4,
						"name": "Prioritize and implement fixes",
						"text": "Sort recommendations by impact tier. Implement high confidence fixes first: schema, content depth, and answer style blocks usually move scores fastest."
					},
					{
						"@type": "HowToStep",
						"position": 5,
						"name": "Re-audit and compare",
						"text": "After shipping changes, rerun the audit and compare category deltas. Track score movement over time using the report history view."
					}
				]
			}
		</script>`;

const routes = [
	{
		path: '/',
		title: 'AiVIS.biz | AI Visibility Audit —AiVIS.biz - CITE LEDGER |AiVIS.biz - CITE LEDGER | Evidence-Linked Scores',
		description: 'AiVIS.biz analyzes whether AI systems like ChatGPT, Perplexity AI, Google AI Overviews, and Claude can correctly read, interpret, and cite your website. Every result is tied to real on-page evidence, not assumptions.',
		ogTitle: 'AiVIS.biz | AI Visibility Audit —AiVIS.biz - CITE LEDGER |AiVIS.biz - CITE LEDGER | Evidence-Linked Scores',
		ogDescription: 'AiVIS.biz analyzes whether AI systems like ChatGPT, Perplexity AI, Google AI Overviews, and Claude can correctly read, interpret, and cite your website. Evidence-backed findings and prioritized fixes.',
		extraHead: HOME_EXTRA_HEAD,
	},
	{
		path: '/landing',
		title: 'AiVIS.biz Landing | AI Visibility Audit',
		description: 'Measure whether AI can read, trust and cite your site with a live evidence-backed AiVIS.biz audit.',
	},
	{
		path: '/pricing',
		title: 'AiVIS.biz Pricing | AI Visibility Audit Plans',
		description: 'AiVIS.biz plans: Observer free tier plus Alignment, Signal, and legacy Score Fix options with multi-model validation and team reporting webhooks: Notion, Slack, Google Sheets, Zapier and more.',
	},
	{
		path: '/analyze',
		title: 'Run AI Visibility Audit | AiVIS.biz',
		description: 'Run a live AI visibility audit to measure parseability, trust and citation readiness with evidence-backed scoring.',
	},
	{
		path: '/faq',
		title: 'AiVIS.biz FAQ | AI Visibility Audit Questions',
		description: 'Answers about AI visibility scoring, structured findings, answer engine readiness and how AiVIS.biz audits websites.',
	},
	{
		path: '/guide',
		title: 'AiVIS.biz Guide | AI Visibility Workflow',
		description: 'Learn how to run audits, read evidence-backed findings and ship fixes that improve AI visibility.',
	},
	{
		path: '/workflow',
		title: 'AiVIS.biz Workflow | End-to-End Visibility Operations',
		description: 'Turn AiVIS.biz from a one-off audit into a repeatable AI visibility workflow with baseline, fixes and re-audit loops.',
	},
	{
		path: '/methodology',
		title: 'AiVIS.biz Methodology | CITE LEDGER & BRAG Evidence Protocol',
		description: 'How AiVIS.biz audits AI answer readiness: six weighted dimensions, the CITE LEDGER evidence pipeline, and the BRAG Trail protocol that ground every finding in crawl-observable data.',
		ogTitle: 'AiVIS.biz Methodology — CITE LEDGER & BRAG Evidence Protocol',
		ogDescription: 'CITE LEDGER evidence pipeline, BRAG protocol, six dimension weights, triple-check consensus, score bands, and methodology FAQ.',
		ogType: 'article',
	},
	{
		path: '/insights',
		title: 'AiVIS.biz Insights Hub | AI Visibility Playbooks',
		description: 'Strategic AI search playbooks covering AI visibility, AEO implementation and geo-adaptive ranking in 2026.',
	},
	{
		path: '/blogs',
		title: 'AiVIS.biz Blogs | Founder Notes and AI Visibility Essays',
		description: 'Canonical AiVIS.biz blog posts sourced from Intruvurt.medium.com writing, hosted on aivis.biz/blogs for clean ownership and schema consistency.',
	},
	{
		path: '/blogs/why-i-built-aivis-when-i-realized-most-websites-are-invisible-to-ai',
		title: 'Why I Built AiVIS.biz When I Realized Most Websites Are Invisible To AI | AiVIS.biz Blogs',
		description: 'The origin story behind AiVIS.biz and why evidence-backed AI visibility auditing matters for modern answer-engine discovery.',
		ogType: 'article',
	},
	{
		path: '/blogs/before-you-build-another-saas-run-this-30-second-reality-check',
		title: 'Before You Build Another SaaS, Run This 30-Second Reality Check | AiVIS.biz Blogs',
		description: 'A practical founder filter for distribution risk and discoverability before committing to another product build cycle.',
		ogType: 'article',
	},
	{
		path: '/blogs/answer-engine-optimization-2026-why-citation-readiness-matters',
		title: 'Answer Engine Optimization in 2026 - Why Citation Readiness Matters More Than Ranking | AiVIS.biz Blogs',
		description: 'Ranking position is irrelevant if your content cannot be extracted, attributed, or cited. Here\'s why citation readiness is the core AEO metric.',
		ogType: 'article',
	},
	{
		path: '/blogs/why-traditional-seo-tactics-fail-for-ai-visibility',
		title: 'Why Traditional SEO Tactics Don\'t Work for AI Visibility | AiVIS.biz Blogs',
		description: 'Google ranking and AI extractability are orthogonal metrics. A page can rank #1 for all keywords yet remain invisible in AI answers.',
		ogType: 'article',
	},
	{
		path: '/blogs/building-author-authority-for-citations-e-e-a-t-in-ai-era',
		title: 'Building Author Authority for Citation Workflows - E-E-A-T in the AI Era | AiVIS.biz Blogs',
		description: 'E-E-A-T is no longer just a Google ranking signal. It\'s now a citation eligibility filter that determines whether LLMs will list your source.',
		ogType: 'article',
	},
	{
		path: '/blogs/how-llms-parse-your-content-technical-breakdown',
		title: 'How LLMs Parse Your Content - Technical Breakdown of ChatGPT, Claude, and Perplexity Extraction | AiVIS.biz Blogs',
		description: 'A deep dive into the content signals and structural requirements that answer engines use to extract, rank, and attribute your content.',
		ogType: 'article',
	},
	{
		path: '/blogs/geo-adaptive-ai-ranking-location-intelligence-shapes-answers',
		title: 'Geo-Adaptive AI Ranking - How Location Intelligence Shapes AI Answer Quality | AiVIS.biz Blogs',
		description: 'Answer engines now factor regional availability, jurisdiction, and localized entity resolution into citation eligibility.',
		ogType: 'article',
	},
	{
		path: '/blogs/from-invisible-to-cited-case-study-brand-citation-growth',
		title: 'From Invisible to Cited - Real Case Study: How Brands Move from 0 to 87% Citation Rate | AiVIS.biz Blogs',
		description: 'An in-depth case study showing how a B2B SaaS company restructured their content schema, FAQ depth, and author credibility signals to achieve industry-leading AI citation rates.',
		ogType: 'article',
	},
	{
		path: '/blogs/google-search-console-data-ai-visibility-monitoring',
		title: 'Integrating Google Search Console Data with AI Visibility Monitoring | AiVIS.biz Blogs',
		description: 'Learn how to correlate GSC performance data (impressions, clicks, position) with AI citation metrics to identify gaps and opportunities.',
		ogType: 'article',
	},
	{
		path: '/blogs/7-step-implementation-roadmap-audit-to-live-citations-30-days',
		title: 'The 7-Step Implementation Roadmap: From Audit to Live Citations in 30 Days | AiVIS.biz Blogs',
		description: 'A tactical, week-by-week playbook for turning AI visibility audit results into live citations and tracked improvements.',
		ogType: 'article',
	},
	{
		path: '/blogs/google-search-console-2026-what-actually-matters-now',
		title: 'Google Search Console in 2026: What Actually Matters Now | AiVIS.biz Blogs',
		description: 'Google Search Console has evolved from a diagnostic toolkit into a strategic command center. Learn the five critical changes that actually matter for AI visibility and search dominance in 2026.',
		ogType: 'article',
	},
	{
		path: '/blogs/the-river-changed-direction-why-ai-answer-engines-rewrote-the-web',
		title: 'The River Changed Direction: Why AI Answer Engines Rewrote the Web | AiVIS.biz Blogs',
		description: 'The shift from click-based SEO to AI answer engines is a structural internet change. Visibility now depends on machine trust, extractability, and citation readiness.',
		ogType: 'article',
	},
	{
		path: '/blogs/webmcp-is-the-protocol-seo-aeo-geo-never-had',
		title: 'WebMCP Is the Protocol SEO, AEO, and GEO Never Had | AiVIS.biz Blogs',
		description: 'SEO optimized for humans clicking links. AEO optimized for answer engines quoting you. GEO optimized for location queries. WebMCP does something none of them attempted: it gives AI agents a direct line into your site.',
		ogType: 'article',
	},
	{
		path: '/blogs/aivis-api-access-explained-build-on-the-visibility-layer',
		title: 'AiVIS.biz API Access Explained: Build on the Visibility Layer | AiVIS.biz Blogs',
		description: 'Full breakdown of AiVIS.biz API and WebMCP access: how to generate keys, authenticate requests, pull audit data, trigger scans, and integrate visibility intelligence into your own stack.',
		ogType: 'article',
	},
	{
		path: '/blogs/aivis-platform-source-of-truth-every-feature-and-tool-explained',
		title: 'AiVIS.biz Platform Source of Truth: Every Feature and Tool Explained | AiVIS.biz Blogs',
		description: 'The definitive reference for everything AiVIS.biz does - every tier, every tool, every pipeline, every integration - explained in operational detail.',
		ogType: 'article',
	},
	{
		path: '/blogs/why-aivis-is-different-from-every-other-seo-aeo-platform',
		title: 'Why AiVIS.biz Is Different From Every Other SEO and AEO Platform | AiVIS.biz Blogs',
		description: 'AiVIS.biz is not an SEO tool with AI branding. It is a fundamentally different system built for a fundamentally different internet. Here is why the architecture matters.',
		ogType: 'article',
	},
	{
		path: '/blogs/ai-visibility-tools-2026-what-semrush-ahrefs-moz-cant-measure',
		title: 'AI Visibility Tools in 2026: What Semrush, Ahrefs, and Moz Cannot Measure | AiVIS.biz Blogs',
		description: 'Semrush, Ahrefs, Moz, and traditional SEO platforms were built to optimize rankings on a blue-link results page. AI answer engines bypass that page entirely. Here is what falls through the cracks - and the new measurement layer that fills the gap.',
		ogType: 'article',
	},
	{
		path: '/blogs/how-to-get-cited-by-chatgpt-perplexity-gemini-ai-citation-guide',
		title: 'How to Get Cited by ChatGPT, Perplexity, and Gemini: The Structural Blueprint for AI Citations | AiVIS.biz Blogs',
		description: 'A technical guide to the structural signals ChatGPT, Perplexity, Gemini, and Claude evaluate when selecting sources to cite. Not theory - measurable page-level changes that increase citation probability.',
		ogType: 'article',
	},
	{
		path: '/blogs/how-aivis-works-under-the-hood-full-technical-breakdown',
		title: 'How AiVIS.biz Works Under the Hood: Full Technical Breakdown | AiVIS.biz Blogs',
		description: 'A complete walkthrough of what happens between entering a URL and receiving a visibility score. Crawl pipeline, AI model chain, evidence framework, and citation verification explained.',
		ogType: 'article',
	},
	{
		path: '/blogs/why-agencies-and-smbs-are-switching-to-aivis-for-real-visibility',
		title: 'Why Agencies and SMBs Are Switching to AiVIS.biz for Real Visibility | AiVIS.biz Blogs',
		description: 'The gap between traditional SEO tools and what AI answer engines actually need is costing businesses citations every day. AiVIS.biz closes that gap for agencies managing multiple clients and SMBs competing against bigger brands.',
		ogType: 'article',
	},
	{
		path: '/blogs/team-workspaces-how-aivis-handles-multi-client-agency-operations',
		title: 'Team Workspaces: How AiVIS.biz Handles Multi-Client Agency Operations | AiVIS.biz Blogs',
		description: 'A deep dive into the new team workspace layer. Role-based access, workspace scoping, invite management, and how agencies can isolate audit data per client.',
		ogType: 'article',
	},
	{
		path: '/blogs/citation-testing-explained-how-to-verify-ai-models-can-find-you',
		title: 'Citation Testing Explained: How to Verify AI Models Can Actually Find You | AiVIS.biz Blogs',
		description: 'Your schema is perfect. Your headings are clean. But do AI answer engines actually cite you? Citation testing tells you the truth using three independent search engines.',
		ogType: 'article',
	},
	{
		path: '/blogs/competitor-tracking-find-the-structural-gaps-and-win',
		title: 'Competitor Tracking on AiVIS.biz: Find the Structural Gaps and Win | AiVIS.biz Blogs',
		description: 'Side-by-side visibility audits, opportunity detection, and structural gap analysis. How to use competitor tracking to overtake rivals in AI answer engine citations.',
		ogType: 'article',
	},
	{
		path: '/blogs/brand-mention-tracking-where-ai-discovers-new-sources',
		title: 'Brand Mention Tracking: Where AI Models Discover New Sources | AiVIS.biz Blogs',
		description: 'AI models learn about new brands from community platforms. AiVIS.biz scans nine free sources to show you where your brand signal lives and where it is missing.',
		ogType: 'article',
	},
	{
		path: '/blogs/brand-authority-mention-tracking-entity-clarity-ai',
		title: 'Brand Authority Is No Longer What You Say. It\'s What AI Repeats. | AiVIS.biz Blogs',
		description: 'Why brand authority has shifted from what you publish to what AI systems can understand, repeat, and cite. A deep look at mention tracking, entity clarity, and the new standard for machine legibility.',
		ogType: 'article',
	},
	{
		path: '/blogs/ssfr-evidence-framework-the-scoring-engine-behind-aivis',
		title: 'The SSFR Evidence Framework: The Scoring Engine Behind Every AiVIS.biz Audit | AiVIS.biz Blogs',
		description: 'Source, Signal, Fact, Relationship. The 27-rule deterministic evidence engine that evaluates machine readability before any AI model gets involved.',
		ogType: 'article',
	},
	{
		path: '/blogs/score-fix-autopr-how-ai-opens-pull-requests-to-fix-your-visibility',
		title: 'Score Fix AutoFix PR: How AI Opens Pull Requests to Fix Your Visibility | AiVIS.biz Blogs',
		description: 'Most audit tools tell you what to fix. AiVIS.biz Score Fix generates the actual code changes and opens a GitHub PR. Here is how automated remediation works.',
		ogType: 'article',
	},
	{
		path: '/blogs/reverse-engineering-competitors-decompile-ghost-audit-simulate',
		title: 'Reverse Engineering Competitors: Decompile, Ghost Audit, and Simulate | AiVIS.biz Blogs',
		description: 'Take apart any competitor page structure. Run a ghost audit without them knowing. Simulate how AI models evaluate their content versus yours.',
		ogType: 'article',
	},
	{
		path: '/blogs/free-tools-schema-validator-robots-checker-content-extractability',
		title: 'Three Free Tools: Schema Validator, Robots Checker, and Content Extractability | AiVIS.biz Blogs',
		description: 'No account required. No paywall. Three diagnostic tools that show you exactly what AI crawlers see when they visit your site.',
		ogType: 'article',
	},
	{
		path: '/blogs/scheduled-rescans-and-autopilot-monitoring-set-it-and-track-it',
		title: 'Scheduled Rescans and Autopilot Monitoring: Set It and Track It | AiVIS.biz Blogs',
		description: 'Configure recurring audits, track score deltas over time, and get alerts when visibility changes. Autopilot monitoring for agencies and teams.',
		ogType: 'article',
	},
	{
		path: '/blogs/bix-boundaries-in-excess-how-guidebot-redefines-ai-platform-assistants',
		title: 'BIX: Boundaries in Excess - How GuideBot Redefines AI Platform Assistants | AiVIS.biz Blogs',
		description: 'GuideBot is not a chatbot. It is a bounded intelligence system built around page-aware context, tier-gated recommendations, and a closed knowledge graph. Here is why that matters.',
		ogType: 'article',
	},
	{
		path: '/blogs/your-website-is-not-competing-for-clicks-anymore',
		title: 'Your Website Is Not Competing for Clicks Anymore. It Is Competing to Be Included. | AiVIS.biz Blogs',
		description: 'Why AI visibility audits matter now, what most sites still get wrong, and how AiVIS.biz already helps expose the gap between ranking and being understood by answer engines.',
		ogType: 'article',
	},
	{
		path: '/why-ai-visibility',
		title: 'Why AI Visibility Matters | AiVIS.biz',
		description: 'Understand why AI answer engines are replacing traditional search and why citation readiness now drives visibility.',
	},
	{
		path: '/ai-search-visibility-2026',
		title: 'AI Search Visibility in 2026 | AiVIS.biz',
		description: 'A strategic breakdown of how AI search visibility is changing in 2026 and what teams must fix now.',
	},
	{
		path: '/aeo-playbook-2026',
		title: 'AEO Playbook 2026 | AiVIS.biz',
		description: 'A practical AEO playbook for building answer-engine-ready pages that AI systems can interpret and cite.',
	},
	{
		path: '/geo-ai-ranking-2026',
		title: 'Geo AI Ranking 2026 | AiVIS.biz',
		description: 'Learn how geography-aware answer engines interpret location relevance, trust, and structured local content.',
	},
	{
		path: '/compare',
		title: 'AiVIS.biz Compare | Alternative Benchmarking',
		description: 'Compare AiVIS.biz against other AI visibility and answer-engine optimization platforms across evidence, scoring, and workflow depth.',
	},
	{
		path: '/compare/aivis-vs-otterly',
		title: 'AiVIS.biz vs Otterly | AI Visibility Comparison',
		description: 'Detailed comparison of AiVIS.biz vs Otterly for actionable AI visibility scoring, evidence trails, and implementation-ready fixes.',
	},
	{
		path: '/compare/aivis-vs-reaudit',
		title: 'AiVIS.biz vs Reaudit | AI Visibility Comparison',
		description: 'See how AiVIS.biz compares to Reaudit for AEO-era auditing, machine readability analysis, and structured recommendation depth.',
	},
	{
		path: '/compare/aivis-vs-profound',
		title: 'AiVIS.biz vs Profound | AI Visibility Comparison',
		description: 'See why AiVIS.biz focuses on evidence-backed site fixes, not just monitoring mentions across AI answer surfaces.',
	},
	{
		path: '/compare/aivis-vs-semrush',
		title: 'AiVIS.biz vs Semrush: AI Visibility Audit vs SEO Suite (2026 Comparison)',
		description: 'Semrush measures search engine rankings. AiVIS.biz measures whether AI answer engines can read, trust, and cite your website. Detailed feature comparison for 2026.',
		ogType: 'article',
	},
	{
		path: '/compare/aivis-vs-ahrefs',
		title: 'AiVIS.biz vs Ahrefs: AI Visibility Audit vs Backlink Intelligence (2026 Comparison)',
		description: 'Ahrefs maps backlinks and keyword rankings. AiVIS.biz audits whether AI answer engines can extract, trust, and cite your content. Full 2026 feature comparison.',
		ogType: 'article',
	},
	{
		path: '/compare/aivis-vs-rankscale',
		title: 'AiVIS.biz vs RankScale: AI Visibility Audit vs AI-Enhanced SEO (2026 Comparison)',
		description: 'RankScale uses AI for content optimization within search rankings. AiVIS.biz audits whether AI answer engines can extract, trust, and cite your content. 2026 comparison.',
		ogType: 'article',
	},
	{
		path: '/glossary',
		title: 'AI Visibility & AEO Glossary - 60+ Terms Defined | AiVIS.biz',
		description: '60+ in-depth definitions for AI visibility, answer engine optimization, distortion mapping, evidence-backed scoring, BRAG evidence trails, SSFR analysis, triple-check orchestration, and citation readiness.',
	},
	{
		path: '/benchmarks',
		title: 'AI Search Visibility Benchmarks 2026 | AiVIS.biz',
		description: 'Benchmark data on extractability, content structure, and AI visibility performance across real websites.',
	},
	{
		path: '/about',
		title: 'About AiVIS.biz | Intruvurt Labs',
		description: 'About AiVIS.biz and Intruvurt Labs: the AiVIS.biz | CITE LEDGER  focused on answer-engine readiness and evidence-backed fixes.',
	},
	{
		path: '/press',
		title: 'Press & Media | AiVIS.biz',
		description: 'Press resources, media coverage, and public milestones for AiVIS.biz by Intruvurt Labs. TechCrunch Startup Battlefield Top 200 nominee.',
	},
	{
		path: '/compliance',
		title: 'Compliance & Security | AiVIS.biz',
		description: 'AiVIS.biz compliance and security posture, including GDPR operations, controls, and SOC roadmap status.',
	},
	{
		path: '/terms',
		title: 'Terms of Service | AI Visibility Platform',
		description: 'AI Visibility terms of service governing use of the AI visibility auditing platform, including acceptable use, billing, IP rights, and disclaimers.',
	},
	{
		path: '/privacy',
		title: 'Privacy Policy | AI Visibility Platform',
		description: 'How AI Visibility and Intruvurt Labs collect, use, and protect your data across AI analysis, competitor tracking, citation testing, and brand mention scanning.',
	},
	{
		path: '/disclosures',
		title: 'Consumer Disclosures | AI Visibility Platform',
		description: 'AI Visibility consumer disclosures covering AI accuracy limitations, competitive intelligence boundaries, threat detection scope, third-party dependencies, and platform disclaimers.',
	},
	{
		path: '/integrations',
		title: 'Integrations Hub | AI Visibility Platform',
		description: 'Explore AI Visibility integrations, automation endpoints, and connected workflows for analytics and operations.',
	},
	{
		path: '/competitive-landscape',
		title: 'Competitive Landscape | AI Visibility Platform',
		description: 'Compare your AI visibility performance against competitors using evidence-backed benchmarking and insights.',
	},
	{
		path: '/score-fix',
		title: 'Score Fix | AI Visibility Platform',
		description: 'Score Fix workflows for evidence-linked remediation, implementation guidance, and audit-driven improvement loops.',
	},
	{
		path: '/api-docs',
		title: 'AI Visibility API Documentation',
		description: 'Documentation for AI Visibility APIs covering audits, analytics, evidence, and visibility workflows.',
	},
	{
		path: '/help',
		title: 'AI Visibility Help Center',
		description: 'Platform documentation and support guidance for AI visibility auditing, referrals, reports, and workflows.',
	},
	{
		path: '/support',
		title: 'AI Visibility Support',
		description: 'Customer support and help resources for AI Visibility platform usage, billing, and troubleshooting.',
	},
	{
		path: '/server-headers',
		title: 'AI Visibility Server Headers Analyzer',
		description: 'Inspect response headers, cache directives, and security header posture for public web pages.',
	},
	{
		path: '/verify-license',
		title: 'AI Visibility License Verification',
		description: 'Public license verification page for validating AI Visibility license keys and status.',
	},
	/* Removed: duplicate /privacy and /terms entries — originals above (lines ~542, ~547) */
	{
		path: '/changelog',
		title: 'Changelog | AI Visibility Platform',
		description: 'A permanent ledger of every update, fix, and improvement shipped to AiVIS.biz.',
	},
	{
		path: '/tools/schema-validator',
		title: 'Schema Markup Validator - AI Citation Readiness Check | AI Visibility Platform',
		description: 'Free tool to validate structured data (JSON-LD, OpenGraph, Twitter Cards) for AI citation readiness. See what AI models can extract from your page.',
	},
	{
		path: '/tools/robots-checker',
		title: 'AI Crawler Access Checker - Robots.txt Audit for AI Bots | AI Visibility Platform',
		description: 'Free tool to check if GPTBot, ClaudeBot, Googlebot, and 12 other AI crawlers can access your site. Audit robots.txt, meta robots, and X-Robots-Tag.',
	},
	{
		path: '/tools/content-extractability',
		title: 'Content Extractability Grader - AI Answer Block Analysis | AI Visibility Platform',
		description: 'Free tool to grade how well AI models can extract answers from your page. Analyzes heading hierarchy, FAQ patterns, and content structure.',
	},
	{
		path: '/reverse-engineer',
		title: 'Reverse Engineer | AI Visibility Platform',
		description: 'Deconstruct how AI models build answers. Decompile, blueprint, diff, and simulate tools for AI content engineering.',
	},
	{
		path: '/prompt-intelligence',
		title: 'Prompt Intelligence - AI Query Analysis | AI Visibility Platform',
		description: 'Understand how AI models interpret queries about your brand. Map prompt patterns to inclusion, exclusion, and competitor displacement outcomes.',
	},
	{
		path: '/answer-presence',
		title: 'Answer Presence Engine - AI Platform Visibility | AI Visibility Platform',
		description: 'Track whether your brand appears in AI-generated answers across ChatGPT, Perplexity, Claude, and Google AI. Evidence-based presence detection.',
	},
	{
		path: '/brand-integrity',
		title: 'Brand Integrity Monitor - AI Accuracy Tracking | AI Visibility Platform',
		description: 'Monitor what AI platforms and public sources say about your brand. Detect misrepresentations, track accuracy over time, and protect brand integrity.',
	},
	{
		path: '/blogs/cannot-access-before-initialization-react-vite-production-tdz-fix',
		title: 'Cannot Access Before Initialization - React + Vite Production TDZ Fix | AI Visibility Blogs',
		description: 'How to diagnose and fix the ReferenceError: Cannot access variable before initialization in React + Vite production builds caused by temporal dead zone issues.',
		ogType: 'article',
	},
	{
		path: '/blogs/how-mcp-audit-workflows-change-everything-for-dev-teams',
		title: 'How MCP Audit Workflows Change Everything for Dev Teams | AI Visibility Blogs',
		description: 'Learn how Model Context Protocol integrations let AI agents run visibility audits directly from your IDE, automating the audit-to-fix cycle.',
		ogType: 'article',
	},
	{
		path: '/blogs/team-workspace-aivis-the-shared-audit-layer-builders-have-been-missing',
		title: 'Team Workspace: The Shared Audit Layer Builders Have Been Missing | AI Visibility Blogs',
		description: 'How AI Visibility team workspaces give agencies and engineering teams a shared audit feed, role-based access, and coordinated visibility tracking.',
		ogType: 'article',
	},
	{
		path: '/blogs/webmcp-third-party-tool-calling-aivis-the-headless-audit-engine',
		title: 'WebMCP Third-Party Tool Calling: AI Visibility as a Headless Audit Engine | AI Visibility Blogs',
		description: 'AI Visibility exposes MCP-compatible endpoints that turn it into a headless audit engine any AI agent can call for structured visibility data.',
		ogType: 'article',
	},
	{
		path: '/blogs/answer-engine-optimization-is-not-the-new-seoits-the-big-brother',
		title: 'Answer Engine Optimization Is Not the New SEO - It Is the Big Brother | AI Visibility Blogs',
		description: 'Why AEO supersedes traditional SEO and how AI answer engines evaluate content differently from search engine crawlers.',
		ogType: 'article',
	},
	{
		path: '/blogs/startups-seoaeo-in-2026-a-strategic-guide-for-the-ai-first-era',
		title: 'Startups SEO/AEO in 2026: A Strategic Guide for the AI-First Era | AI Visibility Blogs',
		description: 'A strategic guide for startups navigating SEO and AEO in 2026, covering AI visibility, citation readiness, and machine-legible content.',
		ogType: 'article',
	},
	{
		path: '/blogs/the-old-saas-model-was-simple',
		title: 'The Old SaaS Model Was Simple | AI Visibility Blogs',
		description: 'How the traditional SaaS model is being disrupted by AI-first platforms and what it means for product builders shipping in 2026.',
		ogType: 'article',
	},
	{
		path: '/blogs/your-website-can-rank-and-still-disappear',
		title: 'Your Website Can Rank and Still Disappear | AI Visibility Blogs',
		description: 'Ranking on page one means nothing if AI answer engines never extract, cite, or surface your content. Here is why traditional SEO success masks a growing visibility crisis.',
		ogType: 'article',
	},
	{
		path: '/blogs/ai-visibility-starter-tier-evidence-backed-ai-audits-from-15',
		title: 'AI Visibility Starter Tier — Evidence-Backed AI Audits from $15 | AI Visibility Blogs',
		description: 'Introducing the AI Visibility Starter tier: 15 scans per month, paid AI model, full recommendations with implementation code, PDF export, and shareable links — all for $15/month.',
		ogType: 'article',
	},
	{
		path: '/blogs/why-every-ai-visibility-audit-needs-an-evidence-trail',
		title: 'Why Every AI Visibility Audit Needs an Evidence Trail | AI Visibility Blogs',
		description: 'AI audits without evidence are opinions. The BRAG evidence framework links every recommendation to structural proof — here is why that matters and how it works.',
		ogType: 'article',
	},
	{
		path: '/blogs/choosing-the-right-ai-visibility-plan-observer-vs-starter-vs-alignment',
		title: 'Choosing the Right AI Visibility Plan: Observer vs Starter vs Alignment | AI Visibility Blogs',
		description: 'A practical comparison of AI Visibility tiers — what each plan includes, who it is for, and how to decide which level of AI visibility auditing you need.',
		ogType: 'article',
	},
	{
		path: '/blogs/google-crawler-ip-ranges-moved-what-broke-and-how-to-fix-it',
		title: 'Google\'s Crawler IP Ranges Moved: What Broke and How to Fix It | AiVIS.biz Blogs',
		description: 'Google migrated crawler IP range JSON files from /search/apis/ipranges/ to /crawling/ipranges/ and renamed googlebot.json to common-crawlers.json. The old URLs return 200 OK with no IP data. Here\'s the full breakdown and fix.',
		ogType: 'article',
	},
	{
		path: '/partnership-terms',
		title: 'Referral and Delivery Partnership Terms | AI Visibility',
		description: 'Official partnership terms for referral and delivery partnerships with AiVIS.biz AI Visibility Audit.',
	},
	{
		path: '/conversational-query-playbook-2026',
		title: 'Conversational Query Playbook 2026 | AI Visibility',
		description: 'Master conversational query optimization for AI answer engines. Practical playbook for structuring content that wins in dialogue-based search.',
	},
	{
		path: '/voice-search-ai-answer-optimization-2026',
		title: 'Voice Search & AI Answer Optimization 2026 | AI Visibility',
		description: 'Optimize your content for voice search and AI answer engines. Strategy guide for spoken-query visibility in 2026.',
	},
	{
		path: '/keywords',
		title: 'Keyword Intelligence | AI Visibility',
		description: 'AI-powered keyword intelligence. Discover which queries trigger AI citations and track your keyword visibility across answer engines.',
	},
	{
		path: '/competitors',
		title: 'Competitor Tracking | AI Visibility',
		description: 'Track competitor AI visibility scores, structural gaps, and citation presence. Find opportunities to outperform rival brands.',
	},
	{
		path: '/citations',
		title: 'Citation Testing | AI Visibility',
		description: 'Test whether AI models cite your brand. Run live citation checks against ChatGPT, Perplexity, Gemini, and Claude.',
	},
	{
		path: '/reports',
		title: 'Audit Reports | AI Visibility',
		description: 'Access your AI visibility audit reports. Export, share, and track score trends over time.',
	},
	{
		path: '/analytics',
		title: 'Analytics & Score Trends | AI Visibility',
		description: 'Track your AI visibility score history, trends, and performance analytics over time.',
	},
	{
		path: '/niche-discovery',
		title: 'Niche Discovery | AI Visibility',
		description: 'Discover untapped niches and content opportunities where AI models lack authoritative sources.',
	},
	{
		path: '/mcp',
		title: 'MCP Console | AI Visibility',
		description: 'Model Context Protocol console. Connect AiVIS.biz audits to your development workflow via MCP integration.',
	},
	{
		path: '/gsc',
		title: 'Google Search Console Analysis | AiVIS.biz',
		description: 'Analyze your Google Search Console data through an AI visibility lens. Identify gaps between traditional SEO and AI readiness.',
	},
	{
		path: '/referrals',
		title: 'Referral Program | AiVIS.biz',
		description: 'Earn rewards by referring others to AiVIS.biz. Track your referral links, conversions, and earnings.',
	},
	{
		path: '/team',
		title: 'Team Workspace | AiVIS.biz',
		description: 'Manage your team workspace. Invite members, assign roles, and collaborate on AI visibility audits.',
	},
	{
		path: '/badge',
		title: 'AiVIS.biz Dofollow Backlink Badge | Embed & Track',
		description: 'Add a trackable dofollow backlink badge to your website footer. Earn SEO link equity and track impressions, clicks, and referrer domains in real time.',
	},
	// ── 100 Keyword SEO Pages (5 clusters × 20 pages) ────────────────────────
	// Platforms cluster
	{ path: '/platforms/wordpress', title: 'WordPress AI Visibility Audit | AiVIS.biz', description: 'Audit your WordPress site for AI answer-engine readiness. Find schema gaps, crawl blocks, and citation failures specific to WordPress.' },
	{ path: '/platforms/shopify', title: 'Shopify AI Visibility Audit | AiVIS.biz', description: 'Discover why AI models skip your Shopify store. Audit product schema, crawl access, and citation readiness for Shopify sites.' },
	{ path: '/platforms/wix', title: 'Wix AI Visibility Audit | AiVIS.biz', description: 'Find out why AI models can\'t cite your Wix site. Audit JavaScript rendering, schema, and crawl signals for Wix.' },
	{ path: '/platforms/squarespace', title: 'Squarespace AI Visibility Audit | AiVIS.biz', description: 'Audit your Squarespace site for AI citation readiness. Check schema, crawl access, and structured data gaps specific to Squarespace.' },
	{ path: '/platforms/webflow', title: 'Webflow AI Visibility Audit | AiVIS.biz', description: 'Audit your Webflow site for AI readability. Discover schema gaps, custom code opportunities, and citation-blocking issues on Webflow.' },
	{ path: '/platforms/next-js', title: 'Next.js AI Visibility Audit | AiVIS.biz', description: 'Ensure your Next.js app is visible to AI answer engines. Audit SSR, metadata API, and structured data configuration for Next.js.' },
	{ path: '/platforms/gatsby', title: 'Gatsby AI Visibility Audit | AiVIS.biz', description: 'Audit your Gatsby site for AI answer-engine readiness. Check static HTML output, schema plugins, and crawler access for Gatsby.' },
	{ path: '/platforms/drupal', title: 'Drupal AI Visibility Audit | AiVIS.biz', description: 'Audit your Drupal site for AI citation readiness. Discover schema module gaps, crawl configuration issues, and structured data fixes for Drupal.' },
	{ path: '/platforms/ghost', title: 'Ghost CMS AI Visibility Audit | AiVIS.biz', description: 'Audit your Ghost blog for AI visibility. Check structured data, crawl access, and citation readiness specific to Ghost CMS.' },
	{ path: '/platforms/hubspot', title: 'HubSpot AI Visibility Audit | AiVIS.biz', description: 'Audit your HubSpot site for AI answer-engine readiness. Discover CMS limitations, schema gaps, and crawl issues for HubSpot.' },
	{ path: '/platforms/framer', title: 'Framer AI Visibility Audit | AiVIS.biz', description: 'Audit your Framer site for AI visibility. Check rendering, schema gaps, and crawl access for Framer-built websites.' },
	{ path: '/platforms/bubble', title: 'Bubble.io AI Visibility Audit | AiVIS.biz', description: 'Discover why AI models can\'t parse your Bubble.io app. Audit rendering, schema, and crawl access for no-code apps.' },
	{ path: '/platforms/weebly', title: 'Weebly AI Visibility Audit | AiVIS.biz', description: 'Audit your Weebly site for AI readability. Check structured data, crawl access, and meta tag configuration for Weebly.' },
	{ path: '/platforms/joomla', title: 'Joomla AI Visibility Audit | AiVIS.biz', description: 'Audit your Joomla site for AI answer-engine readiness. Check extensions, schema output, and crawl configuration for Joomla.' },
	{ path: '/platforms/magento', title: 'Magento AI Visibility Audit | AiVIS.biz', description: 'Audit your Magento or Adobe Commerce store for AI answer-engine readiness. Check product schema, crawl access, and structured data.' },
	{ path: '/platforms/bigcommerce', title: 'BigCommerce AI Visibility Audit | AiVIS.biz', description: 'Audit your BigCommerce store for AI readiness. Check product schema, crawl access, and structured data specific to BigCommerce.' },
	{ path: '/platforms/cargo', title: 'Cargo.site AI Visibility Audit | AiVIS.biz', description: 'Audit your Cargo portfolio site for AI visibility. Discover rendering issues, missing schema, and crawl gaps.' },
	{ path: '/platforms/notion-sites', title: 'Notion Sites AI Visibility Audit | AiVIS.biz', description: 'Audit your published Notion site for AI readability. Check rendering, structured data, and crawl access for Notion-powered websites.' },
	{ path: '/platforms/carrd', title: 'Carrd AI Visibility Audit | AiVIS.biz', description: 'Audit your Carrd landing page for AI visibility. Check meta tags, rendering, and structured data for single-page Carrd sites.' },
	{ path: '/platforms/react-spa', title: 'React SPA AI Visibility Audit | AiVIS.biz', description: 'Find out why AI models can\'t read your React SPA. Audit client-side rendering, missing schema, and crawl issues for React apps.' },
	// Problems cluster
	{ path: '/problems/why-ai-cant-read-my-site', title: 'Why AI Can\'t Read My Website | AiVIS.biz', description: 'Find out why ChatGPT, Perplexity, and Claude can\'t find or cite your website. Diagnose the most common AI visibility failures.' },
	{ path: '/problems/missing-structured-data', title: 'Missing Structured Data Kills AI Citations | AiVIS.biz', description: 'No JSON-LD or schema markup? AI models can\'t properly cite or attribute your content. Learn what structured data AI needs.' },
	{ path: '/problems/javascript-rendering-blocks-ai', title: 'JavaScript Rendering Blocks AI Crawlers | AiVIS.biz', description: 'AI crawlers don\'t execute JavaScript. If your site renders client-side, your content is invisible to AI models.' },
	{ path: '/problems/no-schema-markup', title: 'No Schema Markup Detected on Your Site | AiVIS.biz', description: 'Your site has zero schema markup. AI models can parse your text but can\'t verify, attribute, or cite it reliably without structured data.' },
	{ path: '/problems/broken-open-graph', title: 'Broken Open Graph Tags Hurt AI Visibility | AiVIS.biz', description: 'Broken or missing Open Graph tags prevent AI models from classifying and displaying your content correctly.' },
	{ path: '/problems/missing-meta-descriptions', title: 'Missing Meta Descriptions Block AI Citations | AiVIS.biz', description: 'Pages without meta descriptions force AI models to auto-generate summaries, often inaccurately.' },
	{ path: '/problems/thin-content', title: 'Thin Content Kills AI Citation Chances | AiVIS.biz', description: 'Thin pages with minimal content are skipped by AI models for citations. Learn the minimum content depth for AI visibility.' },
	{ path: '/problems/duplicate-content', title: 'Duplicate Content Confuses AI Models | AiVIS.biz', description: 'Duplicate content across your site forces AI models to choose between versions, often citing neither.' },
	{ path: '/problems/slow-page-load', title: 'Slow Page Load Hurts AI Crawler Access | AiVIS.biz', description: 'AI crawlers timeout on slow pages. If your server takes too long to respond, AI models skip you entirely.' },
	{ path: '/problems/blocked-by-robots-txt', title: 'Blocked by robots.txt - AI Can\'t Crawl You | AiVIS.biz', description: 'Your robots.txt may be blocking GPTBot, ClaudeBot, and other AI crawlers without you realizing it.' },
	{ path: '/problems/no-canonical-urls', title: 'No Canonical URLs Set - AI Can\'t Determine Authority | AiVIS.biz', description: 'Without canonical URLs, AI models see duplicates everywhere. Set canonicals to tell AI which page is authoritative.' },
	{ path: '/problems/missing-sitemap', title: 'Missing or Broken Sitemap Hurts AI Discovery | AiVIS.biz', description: 'Without a valid XML sitemap, AI crawlers may miss important pages on your site.' },
	{ path: '/problems/no-llms-txt', title: 'No llms.txt File - AI Models Don\'t Know Your Site | AiVIS.biz', description: 'The llms.txt standard lets you describe your site directly to AI models. Without it, you\'re leaving context on the table.' },
	{ path: '/problems/poor-heading-structure', title: 'Poor Heading Structure Confuses AI Parsing | AiVIS.biz', description: 'AI models use heading hierarchy to understand content structure. Broken or missing headings make your content harder to cite.' },
	{ path: '/problems/images-without-alt-text', title: 'Images Without Alt Text - Invisible to AI | AiVIS.biz', description: 'AI models rely on alt text to understand images. Missing alt attributes make your visual content completely invisible.' },
	{ path: '/problems/no-author-attribution', title: 'No Author Attribution - AI Can\'t Verify Expertise | AiVIS.biz', description: 'Content without author attribution lacks the trust signal AI models need for citations.' },
	{ path: '/problems/missing-faq-schema', title: 'Missing FAQ Schema - Your Q&A Is Invisible to AI | AiVIS.biz', description: 'You have FAQ content on your pages but no FAQ schema markup. AI models can\'t identify Q&A sections without structured data.' },
	{ path: '/problems/broken-internal-links', title: 'Broken Internal Links Hurt AI Crawling | AiVIS.biz', description: 'Broken internal links prevent AI crawlers from discovering important content. Fix broken links to improve AI site coverage.' },
	{ path: '/problems/no-hreflang-tags', title: 'No Hreflang Tags - AI Can\'t Route Multi-Language Content | AiVIS.biz', description: 'Without hreflang tags, AI models may cite the wrong language version of your content.' },
	{ path: '/problems/ai-hallucinating-about-my-brand', title: 'AI Is Hallucinating About My Brand | AiVIS.biz', description: 'AI models generating false information about your brand? Learn why hallucinations happen and how to provide corrective structured data.' },
	// Problems Extended cluster (query-first, question-oriented pages)
	{ path: '/problems/why-ai-doesnt-cite-my-website', title: 'Why AI Doesn\'t Cite My SaaS and webApp — Diagnosis | AiVIS.biz', description: 'AI answer engines skip your SaaS and webApp because they cannot extract (SPA-JS heavy site - bad for AI scrapinmg, ), trust, or attribute your content. Diagnose exactly why with an evidence-backed audit.' },
	{ path: '/problems/how-to-fix-ai-search-visibility', title: 'How to Fix AI Search Visibility — Step-by-Step | AiVIS.biz', description: 'Your site is invisible to AI answer engines. Follow this step-by-step diagnostic to identify extraction failures and fix them with evidence.' },
	{ path: '/problems/why-chatgpt-ignores-my-site', title: 'Why ChatGPT Ignores My Site — Root Causes | AiVIS.biz', description: 'ChatGPT does not cite your site even though you rank well in Google. Here is why, and what structural changes fix it.' },
	{ path: '/problems/why-perplexity-doesnt-mention-my-brand', title: 'Why Perplexity Doesn\'t Mention My Brand | AiVIS.biz', description: 'Perplexity builds answers from extractable pages. If your brand is absent, the extraction pipeline cannot reach your content.' },
	{ path: '/problems/how-to-get-cited-by-ai-models', title: 'How to Get Cited by AI Models — Evidence-Based Guide | AiVIS.biz', description: 'AI citation is not luck. It requires crawl access, extractable structure, and attributable claims. Here is exactly how to earn it.' },
	{ path: '/problems/why-ai-gives-wrong-information-about-my-company', title: 'Why AI Gives Wrong Information About My Company | AiVIS.biz', description: 'AI models fabricate or misattribute facts about your company when they cannot find authoritative structured data to extract.' },
	{ path: '/problems/how-to-audit-ai-answer-readiness', title: 'How to Audit AI Answer Readiness | AiVIS.biz', description: 'A systematic audit checks whether AI crawlers can access, extract, and attribute your content. Here is the full methodology.' },
	{ path: '/problems/why-google-ai-overview-skips-my-content', title: 'Why Google AI Overview Skips My Content | AiVIS.biz', description: 'Google AI Overviews extract from pages with clear structure. If your content is skipped, the extraction signals are missing.' },
	{ path: '/problems/how-to-make-website-ai-readable', title: 'How to Make Your Website AI-Readable | AiVIS.biz', description: 'AI readability means your page can be crawled, parsed into structured representations, and attributed. Here is how to achieve all three.' },
	{ path: '/problems/why-ai-misquotes-my-content', title: 'Why AI Misquotes My Content - Causes and Fixes | AiVIS.biz', description: 'AI misquotes happen when extraction is partial or schema markup is ambiguous. Diagnose and fix the root causes.' },
	{ path: '/problems/how-to-fix-entity-confusion-in-ai', title: 'How to Fix Entity Confusion in AI Results | AiVIS.biz', description: 'AI models confuse your brand with others when entity signals are weak. Strengthen disambiguation with structured data.' },
	{ path: '/problems/why-ai-attributes-my-content-to-competitors', title: 'Why AI Attributes My Content to Competitors | AiVIS.biz', description: 'When your content lacks clear authorship and entity markup, AI models credit competitors instead. Here is how to fix attribution.' },
	{ path: '/problems/how-to-optimize-for-ai-answer-engines', title: 'How to Optimize for AI Answer Engines | AiVIS.biz', description: 'AI answer engines do not rank pages — they extract fragments. Optimization means making your content structurally extractable.' },
	{ path: '/problems/why-structured-data-matters-for-ai-citations', title: 'Why Structured Data Matters for AI Citations | AiVIS.biz', description: 'Structured data gives AI models the machine-readable signals they need to extract, verify, and cite your content accurately.' },
	{ path: '/problems/how-to-test-if-ai-can-extract-your-content', title: 'How to Test If AI Can Extract Your Content | AiVIS.biz', description: 'Run an extraction readiness audit to check whether AI models can access, parse, and attribute your pages.' },
	{ path: '/problems/why-ai-search-gives-outdated-information', title: 'Why AI Search Gives Outdated Information About You | AiVIS.biz', description: 'AI models serve stale answers when your freshness signals are weak or your content lacks temporal markup.' },
	{ path: '/problems/how-to-fix-ai-extraction-failures', title: 'How to Fix AI Extraction Failures | AiVIS.biz', description: 'AI extraction fails silently. Diagnose JavaScript rendering blocks, missing schema, and crawler access issues step by step.' },
	{ path: '/problems/why-claude-cant-find-my-website', title: 'Why Claude Can\'t Find My Website | AiVIS.biz', description: 'Claude builds answers from extractable content. If your site is absent, crawl access or structural signals are blocking extraction.' },
	{ path: '/problems/how-to-improve-ai-citation-readiness', title: 'How to Improve AI Citation Readiness | AiVIS.biz', description: 'Citation readiness is measurable. Audit your crawl access, schema markup, entity clarity, and content extractability.' },
	{ path: '/problems/why-ai-answers-ignore-small-businesses', title: 'Why AI Answers Ignore Small Businesses | AiVIS.biz', description: 'Small businesses are invisible to AI answers not because of size but because of missing structural signals. Here is how to fix it.' },
	// Problems Raw cluster (frustrated-searcher query-bank pages)
	{ path: '/problems/site-not-showing-in-chatgpt', title: 'My Site Is Not Showing in ChatGPT — Why & Fix | AiVIS.biz', description: 'If your site is not appearing in ChatGPT answers, crawl access, rendering, or entity signals are blocking extraction. Diagnose with an evidence-backed audit.' },
	{ path: '/problems/chatgpt-not-mentioning-my-website', title: 'ChatGPT Not Mentioning My Website — Root Causes | AiVIS.biz', description: 'ChatGPT skips sites with weak entity signals, blocked crawlers, or thin content. Find out exactly why with a BRAG evidence audit.' },
	{ path: '/problems/ai-ignores-my-website-content', title: 'AI Ignores My Website Content — Diagnosis Guide | AiVIS.biz', description: 'When AI models ignore your content, extraction barriers are present. Identify JavaScript rendering blocks, missing schema, and crawler denials.' },
	{ path: '/problems/website-never-appears-in-ai-answers', title: 'Website Never Appears in AI Answers | AiVIS.biz', description: 'Systematic absence from AI answers signals a gating block. Audit robots.txt, rendering, and schema to find the root cause.' },
	{ path: '/problems/content-not-used-by-ai', title: 'My Content Is Not Being Used by AI | AiVIS.biz', description: 'AI models skip content that lacks structure, attribution, and crawl access. Run an evidence-backed audit to find what is blocking extraction.' },
	{ path: '/problems/chatgpt-gets-my-site-wrong', title: 'ChatGPT Gets My Site Wrong — Fix AI Misrepresentation | AiVIS.biz', description: 'Inaccurate AI summaries stem from weak entity signals and stale training data. Correct them with authoritative structured data at the source.' },
	{ path: '/problems/ai-summarizing-my-site-incorrectly', title: 'AI Is Summarizing My Site Incorrectly | AiVIS.biz', description: 'AI summaries reflect what the model could extract. Fix incorrect AI summaries by strengthening entity clarity and structured data.' },
	{ path: '/problems/ai-not-picking-up-my-pages', title: 'AI Not Picking Up My Pages — Extraction Failures | AiVIS.biz', description: 'Pages that AI models do not pick up are failing at crawl access, rendering, or schema. Identify the failure layer with an evidence audit.' },
	{ path: '/problems/how-chatgpt-decides-what-websites-to-use', title: 'How ChatGPT Decides What Websites to Use | AiVIS.biz', description: 'ChatGPT selects sources based on crawl access, extractability, entity attribution, and content specificity. Learn the exact decision logic.' },
	{ path: '/problems/how-ai-tools-choose-sources', title: 'How AI Tools Choose Which Sources to Cite | AiVIS.biz', description: 'AI tools select citable sources from pages that are accessible, structured, and attributable. Understand the full selection criteria.' },
	{ path: '/problems/why-some-sites-get-cited-not-mine', title: 'Why Some Sites Get Cited by AI and Mine Does Not | AiVIS.biz', description: 'Cited sites have accessible crawlers, complete structured data, and specific attributable content. Compare your signals to theirs.' },
	{ path: '/problems/what-makes-website-visible-to-ai-search', title: 'What Makes a Website Visible to AI Search | AiVIS.biz', description: 'AI search visibility requires four conditions: crawler access, structured extraction, entity attribution, and content depth. Audit all four.' },
	{ path: '/problems/how-ai-models-read-websites', title: 'How AI Models Read Websites — Technical Breakdown | AiVIS.biz', description: 'AI models read raw HTML, not rendered browser pages. Understand the full five-step extraction pipeline and what blocks each stage.' },
	{ path: '/problems/how-to-get-site-mentioned-in-chatgpt', title: 'How to Get Your Site Mentioned in ChatGPT | AiVIS.biz', description: 'Getting cited in ChatGPT requires crawl access, structured data, and extractable content. Here is the complete path from invisible to cited.' },
	{ path: '/problems/how-to-make-ai-cite-my-website', title: 'How to Make AI Cite My Website | AiVIS.biz', description: 'AI citation is earned through structural correctness. Fix the four gating conditions and your site becomes a citable source.' },
	{ path: '/problems/how-to-make-content-show-in-ai-results', title: 'How to Make Your Content Show in AI Results | AiVIS.biz', description: 'AI results pull from extractable, attributed pages. Structure your content for AI extraction with schema, headings, and clear entity signals.' },
	{ path: '/problems/how-to-structure-content-for-ai-models', title: 'How to Structure Content for AI Models | AiVIS.biz', description: 'AI models extract from semantically structured content. Use headings, FAQ schema, and specific claims to maximize extraction probability.' },
	{ path: '/problems/seo-vs-ai-search-difference', title: 'SEO vs AI Search — What Is Actually Different | AiVIS.biz', description: 'SEO and AI search optimization are not the same discipline. Understand the structural differences and which signals matter for each.' },
	{ path: '/problems/why-ai-search-replacing-google-clicks', title: 'Why AI Search Is Replacing Google Clicks | AiVIS.biz', description: 'AI answer engines eliminate the click by synthesizing answers inline. Understand the shift and how to maintain visibility without the click.' },
	{ path: '/problems/saas-show-up-in-chatgpt', title: 'How to Make My SaaS Show Up in ChatGPT | AiVIS.biz', description: 'SaaS products need entity clarity, Organization schema, and specific use-case content to appear in AI product recommendation answers.' },
	{ path: '/problems/startup-not-mentioned-in-ai-answers', title: 'My SaaS Is Not Mentioned in AI Answers | AiVIS.biz', description: 'New startups are invisible to AI because entity signals are absent. Build brand recognition through structured data and consistent entity markup.' },
	{ path: '/problems/why-chatgpt-uses-some-sites-not-mine', title: 'Why ChatGPT Uses Some Sites and Not Mine | AiVIS.biz', description: 'ChatGPT citation is structural, not random. The sites that get used have accessible crawlers, complete schema, and specific content.' },
	{ path: '/problems/how-to-know-if-ai-can-read-my-website', title: 'How to Know If AI Can Read My Website | AiVIS.biz', description: 'Test your site for AI readability with View Source, robots.txt inspection, and a structured evidence audit.' },
	{ path: '/problems/why-ai-rewrites-instead-of-linking', title: 'Why AI Rewrites My Content Instead of Linking to It | AiVIS.biz', description: 'AI systems rewrite content they cannot attribute. Add Organization schema and author markup to earn citation links instead of paraphrases.' },
	{ path: '/problems/how-to-fix-content-ai-misunderstands', title: 'How to Fix The Content that AI Misunderstands | AiVIS.biz', description: 'AI misunderstands content when it lacks structure and specific claims. Restructure with targeted schema and heading-segmented facts.' },
	// Signals cluster
	{ path: '/signals/json-ld', title: 'JSON-LD Structured Data for AI Visibility | AiVIS.biz', description: 'JSON-LD is the structured data format AI models prefer. Learn how to implement it for maximum AI citation potential.' },
	{ path: '/signals/open-graph', title: 'Open Graph Tags for AI Answer Engines | AiVIS.biz', description: 'Open Graph tags help AI models classify and display your content. Learn which OG tags matter most for AI citations.' },
	{ path: '/signals/meta-descriptions', title: 'Meta Descriptions for AI Visibility | AiVIS.biz', description: 'Write meta descriptions that help AI models accurately summarize and cite your content.' },
	{ path: '/signals/canonical-urls', title: 'Canonical URLs and AI Citation Accuracy | AiVIS.biz', description: 'Canonical URLs tell AI models which version of your content is authoritative. Essential for deduplication and citation accuracy.' },
	{ path: '/signals/robots-txt', title: 'robots.txt Configuration for AI Crawlers | AiVIS.biz', description: 'Configure your robots.txt to control which AI crawlers can access your content.' },
	{ path: '/signals/sitemap-xml', title: 'XML Sitemap Optimization for AI Discovery | AiVIS.biz', description: 'Your XML sitemap is the roadmap AI crawlers use to discover your content. Optimize it for AI-specific discovery patterns.' },
	{ path: '/signals/llms-txt', title: 'llms.txt - Describe Your Site for AI Models | AiVIS.biz', description: 'llms.txt is a new standard for describing your site directly to AI language models. Learn how to create and deploy one.' },
	{ path: '/signals/schema-org', title: 'Schema.org Markup for AI Engines | AiVIS.biz', description: 'Schema.org provides the vocabulary AI models use to understand your content. Learn which types matter most for AI citations.' },
	{ path: '/signals/heading-hierarchy', title: 'Heading Hierarchy (H1-H6) for AI Parsing | AiVIS.biz', description: 'AI models use heading hierarchy to understand content structure. Get your H1-H6 tags right for better AI citations.' },
	{ path: '/signals/page-speed', title: 'Page Speed and AI Crawler Access | AiVIS.biz', description: 'AI crawlers timeout on slow pages. Optimize server response time to ensure crawlers can access and parse your content.' },
	{ path: '/signals/mobile-responsiveness', title: 'Mobile-First AI Indexing | AiVIS.biz', description: 'AI crawlers often use mobile user-agents. Ensure your mobile experience delivers the same content and structure as desktop.' },
	{ path: '/signals/internal-linking', title: 'Internal Link Architecture for AI Discovery | AiVIS.biz', description: 'AI crawlers discover content by following internal links. Build a link architecture that guides AI to your most important pages.' },
	{ path: '/signals/content-freshness', title: 'Content Freshness Signals for AI | AiVIS.biz', description: 'AI models prioritize fresh content. Learn which freshness signals matter and how to maintain them for AI citation advantage.' },
	{ path: '/signals/author-entity', title: 'Author Entity Markup for AI Trust | AiVIS.biz', description: 'Author entity markup connects content to verified identities. AI models use author signals for trust scoring and citation ranking.' },
	{ path: '/signals/faq-schema', title: 'FAQ Schema for AI Answer Placement | AiVIS.biz', description: 'FAQ schema is the highest-impact signal for AI answer inclusion. Mark up your Q&A content for direct extraction by AI models.' },
	{ path: '/signals/breadcrumb-schema', title: 'Breadcrumb Schema for AI Navigation | AiVIS.biz', description: 'Breadcrumb schema helps AI models understand your site hierarchy and content relationships. Easy to add, high impact.' },
	{ path: '/signals/alt-text', title: 'Image Alt Text for AI Understanding | AiVIS.biz', description: 'AI language models can\'t see images - they read alt text. Write descriptive alt attributes for AI comprehension and citations.' },
	{ path: '/signals/hreflang', title: 'Hreflang for Multi-Language AI Visibility | AiVIS.biz', description: 'Hreflang tags direct AI crawlers to the right language version of your content. Essential for multilingual AI visibility.' },
	{ path: '/signals/content-length', title: 'Content Depth and Completeness for AI | AiVIS.biz', description: 'AI models prioritize comprehensive content. Learn the content depth signals that improve AI citation likelihood.' },
	{ path: '/signals/trust-signals', title: 'Trust and Authority Signals for AI | AiVIS.biz', description: 'AI models assess trustworthiness before citing. Build the authority signals that make your content citation-worthy.' },
	// Industries cluster
	{ path: '/industries/saas', title: 'AI Visibility for SaaS Companies | AiVIS.biz', description: 'SaaS companies need AI visibility to appear in product recommendation answers. Audit your site for AI-ready structured data.' },
	{ path: '/industries/ecommerce', title: 'AI Visibility for E-Commerce Stores | AiVIS.biz', description: 'E-commerce sites need Product schema and structured data to appear in AI shopping recommendations.' },
	{ path: '/industries/healthcare', title: 'AI Visibility for Healthcare Organizations | AiVIS.biz', description: 'Healthcare sites need E-E-A-T signals and MedicalOrganization schema for AI visibility.' },
	{ path: '/industries/legal', title: 'AI Visibility for Law Firms | AiVIS.biz', description: 'Law firms need AI visibility to appear in legal question answers. Optimize structured data and practice area content for AI citations.' },
	{ path: '/industries/real-estate', title: 'AI Visibility for Real Estate | AiVIS.biz', description: 'Real estate agencies need AI visibility for property-related queries. Optimize listings, agent profiles, and neighborhood content.' },
	{ path: '/industries/finance', title: 'AI Visibility for Financial Services | AiVIS.biz', description: 'Financial services need strong trust signals for AI visibility. Audit your site for YMYL compliance and finance-specific structured data.' },
	{ path: '/industries/education', title: 'AI Visibility for Education Websites | AiVIS.biz', description: 'Educational institutions need AI visibility for program discovery. Optimize course pages, faculty profiles, and educational content.' },
	{ path: '/industries/restaurants', title: 'AI Visibility for Restaurants | AiVIS.biz', description: 'Restaurants need AI visibility for best restaurant and where to eat queries. Optimize menu data, reviews, and local schema.' },
	{ path: '/industries/travel', title: 'AI Visibility for Travel & Hospitality | AiVIS.biz', description: 'Travel businesses need AI visibility for destination and accommodation queries. Optimize structured data for AI travel recommendations.' },
	{ path: '/industries/automotive', title: 'AI Visibility for Automotive Businesses | AiVIS.biz', description: 'Auto dealers and service providers need AI visibility for vehicle and service queries. Optimize inventory and service schema.' },
	{ path: '/industries/insurance', title: 'AI Visibility for Insurance Companies | AiVIS.biz', description: 'Insurance providers need AI visibility for coverage and policy questions. Optimize structured data for AI-answered insurance queries.' },
	{ path: '/industries/consulting', title: 'AI Visibility for Consulting Firms | AiVIS.biz', description: 'Consulting firms need AI visibility to appear in expertise-based recommendations. Build authority through structured data.' },
	{ path: '/industries/nonprofit', title: 'AI Visibility for Nonprofit Organizations | AiVIS.biz', description: 'Nonprofits need AI visibility for donation, volunteer, and cause-related queries. Optimize structured data for AI discovery.' },
	{ path: '/industries/manufacturing', title: 'AI Visibility for Manufacturing Companies | AiVIS.biz', description: 'Manufacturing companies need AI visibility for B2B discovery. Optimize product catalogs and capability pages for AI citations.' },
	{ path: '/industries/recruitment', title: 'AI Visibility for Recruitment Agencies | AiVIS.biz', description: 'Recruitment agencies need AI visibility for hiring-related queries. Optimize job listings and service pages for AI discovery.' },
	{ path: '/industries/media', title: 'AI Visibility for Media & Publishing | AiVIS.biz', description: 'Media companies need AI visibility to maintain citation share. Optimize article markup, author entities, and publisher schema.' },
	{ path: '/industries/fitness', title: 'AI Visibility for Fitness & Wellness | AiVIS.biz', description: 'Fitness and wellness businesses need AI visibility for health and fitness queries. Optimize structured data for AI recommendations.' },
	{ path: '/industries/crypto', title: 'AI Visibility for Crypto & Web3 | AiVIS.biz', description: 'Crypto and Web3 projects need AI visibility for token, protocol, and DeFi queries. Build trust signals for AI citations.' },
	{ path: '/industries/agencies', title: 'AI Visibility for Marketing Agencies | AiVIS.biz', description: 'Marketing agencies need AI visibility for service discovery queries. Optimize your agency site for AI-powered client acquisition.' },
	{ path: '/industries/local-business', title: 'AI Visibility for Local Businesses | AiVIS.biz', description: 'Local businesses need AI visibility for near me queries. Optimize LocalBusiness schema, reviews, and service area data.' },
	// Compare cluster
	{ path: '/compare/aivis-vs-moz', title: 'AiVIS.biz vs Moz: AI Visibility vs Traditional SEO | AiVIS.biz', description: 'Compare AiVIS.biz and Moz. Moz tracks traditional search rankings; AiVIS.biz audits whether AI answer engines can parse, cite, and surface your content.' },
	{ path: '/compare/aivis-vs-surfer', title: 'AiVIS.biz vs Surfer SEO: Structural Audit vs Content Optimization | AiVIS.biz', description: 'Compare AiVIS.biz with Surfer SEO. Surfer optimizes content for Google rankings; AiVIS.biz audits machine-readability for AI answer engines.' },
	{ path: '/compare/aivis-vs-clearscope', title: 'AiVIS.biz vs Clearscope: Machine Readability vs Content Grading | AiVIS.biz', description: 'Compare AiVIS.biz with Clearscope. Clearscope grades content for SEO; AiVIS.biz audits whether AI models can structurally parse and cite your pages.' },
	{ path: '/compare/aivis-vs-marketmuse', title: 'AiVIS.biz vs MarketMuse: Citation Readiness vs Content Strategy | AiVIS.biz', description: 'Compare AiVIS.biz and MarketMuse. MarketMuse plans content strategy; AiVIS.biz audits whether AI answer engines can parse and cite your published pages.' },
	{ path: '/compare/aivis-vs-frase', title: 'AiVIS.biz vs Frase: Structural Audit vs Answer-Focused Writing | AiVIS.biz', description: 'Compare AiVIS.biz and Frase. Frase generates content briefs for answer-focused writing; AiVIS.biz audits whether AI models can read and cite your pages.' },
	{ path: '/compare/aivis-vs-brightedge', title: 'AiVIS.biz vs BrightEdge: AI Citation Audit vs Enterprise SEO | AiVIS.biz', description: 'Compare AiVIS.biz with BrightEdge. BrightEdge is an enterprise SEO suite; AiVIS.biz audits the structural signals AI answer engines need to cite your content.' },
	{ path: '/compare/aivis-vs-conductor', title: 'AiVIS.biz vs Conductor: AI Visibility vs Organic Marketing | AiVIS.biz', description: 'Compare AiVIS.biz with Conductor. Conductor manages organic marketing intelligence; AiVIS.biz audits whether AI answer engines can parse and cite your content.' },
	{ path: '/compare/aivis-vs-searchmetrics', title: 'AiVIS.biz vs Searchmetrics: AI Audit vs Search Experience Platform | AiVIS.biz', description: 'Compare AiVIS.biz with Searchmetrics. Searchmetrics optimizes search experience; AiVIS.biz audits whether AI models can extract and cite your content.' },
	{ path: '/compare/aivis-vs-botify', title: 'AiVIS.biz vs Botify: AI Citation vs Technical SEO Crawling | AiVIS.biz', description: 'Compare AiVIS.biz and Botify. Botify crawls sites for technical SEO; AiVIS.biz audits whether AI answer engines can parse and cite your content.' },
	{ path: '/compare/aivis-vs-lumar', title: 'AiVIS.biz vs Lumar: AI Visibility vs Website Intelligence | AiVIS.biz', description: 'Compare AiVIS.biz with Lumar. Lumar provides website intelligence for technical SEO; AiVIS.biz audits whether AI answer engines can parse and cite your content.' },
	{ path: '/compare/aivis-vs-sitebulb', title: 'AiVIS.biz vs Sitebulb: AI Visibility vs Desktop SEO Crawler | AiVIS.biz', description: 'Compare AiVIS.biz with Sitebulb. Sitebulb is a desktop SEO crawler; AiVIS.biz audits whether AI answer engines can parse and cite your content.' },
	{ path: '/compare/aivis-vs-screaming-frog', title: 'AiVIS.biz vs Screaming Frog: AI Visibility vs SEO Spider | AiVIS.biz', description: 'Compare AiVIS.biz and Screaming Frog. Screaming Frog crawls for technical SEO; AiVIS.biz audits whether AI models can parse and cite your content.' },
	{ path: '/compare/aivis-vs-serpstat', title: 'AiVIS.biz vs Serpstat: AI Visibility vs Multi-Tool SEO Platform | AiVIS.biz', description: 'Compare AiVIS.biz with Serpstat. Serpstat is a multi-tool SEO platform; AiVIS.biz audits whether AI answer engines can parse and cite your content.' },
	{ path: '/compare/aivis-vs-se-ranking', title: 'AiVIS.biz vs SE Ranking: AI Audit vs All-in-One SEO | AiVIS.biz', description: 'Compare AiVIS.biz with SE Ranking. SE Ranking is an all-in-one SEO platform; AiVIS.biz audits whether AI answer engines can parse and cite your pages.' },
	{ path: '/compare/aivis-vs-mangools', title: 'AiVIS.biz vs Mangools: AI Visibility vs Beginner-Friendly SEO | AiVIS.biz', description: 'Compare AiVIS.biz with Mangools. Mangools provides beginner-friendly SEO tools; AiVIS.biz audits whether AI answer engines can parse and cite your content.' },
	{ path: '/compare/aivis-vs-ubersuggest', title: 'AiVIS.biz vs Ubersuggest: AI Visibility vs Keyword Discovery | AiVIS.biz', description: 'Compare AiVIS.biz with Ubersuggest. Ubersuggest helps discover keywords; AiVIS.biz audits whether AI answer engines can parse and cite your content.' },
	{ path: '/compare/aivis-vs-chatgpt-search', title: 'AiVIS.biz vs ChatGPT Search: Auditing vs Searching | AiVIS.biz', description: 'AiVIS.biz audits your site for AI visibility. ChatGPT Search is the AI engine you want to be visible in. Understand the difference.' },
	{ path: '/compare/aivis-vs-perplexity-pages', title: 'AiVIS.biz vs Perplexity Pages: Auditing vs Publishing | AiVIS.biz', description: 'Perplexity Pages lets you publish AI-curated content. AiVIS.biz audits whether AI engines can cite YOUR existing content.' },
	{ path: '/compare/aivis-vs-alli-ai', title: 'AiVIS.biz vs Alli AI: Diagnostic Audit vs Automated SEO Changes | AiVIS.biz', description: 'Compare AiVIS.biz with Alli AI. Alli AI automates on-page SEO changes; AiVIS.biz audits whether AI answer engines can parse and cite your content.' },
	{ path: '/compare/aivis-vs-seo-powersuite', title: 'AiVIS.biz vs SEO PowerSuite: AI Visibility vs Desktop SEO Suite | AiVIS.biz', description: 'Compare AiVIS.biz with SEO PowerSuite. SEO PowerSuite is a desktop SEO toolkit; AiVIS.biz audits whether AI answer engines can parse and assemble your content in zero-click scenarios.' },

	// ── Taxonomy: About layer ──────────────────────────────────────────────
	{ path: '/about-aivis', title: 'About AiVIS — Canonical Entity Definition | AiVIS.biz', description: 'AiVIS is an evidence-backed AI visibility auditing system. It evaluates whether AI answer engines can read, extract, and correctly cite web content using the Cite Ledger, BRAG evidence trails, and deterministic SSFR rules.', ogType: 'article' },
	{ path: '/what-is-aivis', title: 'What Is AiVIS — AI Visibility Auditing Explained | AiVIS.biz', description: 'AiVIS audits whether AI answer engines like ChatGPT, Perplexity, Claude, and Gemini can correctly read, extract, and cite your web content. Scores are grounded in the Cite Ledger evidence chain.' },
	{ path: '/why-aivis-exists', title: 'Why AiVIS Exists — The Problem AiVIS Solves | AiVIS.biz', description: 'AI answer engines hallucinate citations, merge distinct entities, and assign scores without traceable evidence. AiVIS exists to make AI visibility measurable, reproducible, and auditable.' },

	// ── Taxonomy: Methodology layer ────────────────────────────────────────
	{ path: '/methodology/cite-ledger', title: 'Cite Ledger — How AiVIS Records Evidence | AiVIS.biz', description: 'CITE LEDGER is a structured attribution system developed by AiVIS that tracks how AI models interpret, reference, and cite web content across answer engines like ChatGPT, Perplexity, Google AI Overviews, and Claude.', ogType: 'article' },
	{ path: '/what-is-cite-ledger', title: 'What Is CITE LEDGER — Structured Attribution System by AiVIS | AiVIS.biz', description: 'CITE LEDGER is a structured attribution system developed by AiVIS that tracks how AI models interpret, reference, and cite web content across answer engines like ChatGPT, Perplexity, Google AI Overviews, and Claude.', ogType: 'article' },
	{ path: '/methodology/triple-check-protocol', title: 'Triple-Check Protocol — Multi-Model AI Verification | AiVIS.biz', description: 'The Triple-Check Protocol runs three independent AI models in sequence: deep analysis, peer critique with bounded score adjustment, and a validation gate that confirms or overrides the final score.' },
	{ path: '/methodology/brag-evidence-trails', title: 'BRAG Evidence Trails — Verifiable Finding Identity | AiVIS.biz', description: 'Every AiVIS finding receives a BRAG ID generated deterministically from its source and content hash. The BRAG trail links the finding to its evidence, the Cite Ledger entry, and the pipeline stage that produced it.' },
	{ path: '/methodology/entity-resolution-model', title: 'Entity Resolution Model — Stable AI Identity | AiVIS.biz', description: 'The AiVIS Entity Resolution Model enforces canonical name lock, domain binding, definition anchoring, and negative boundary rules so AI systems resolve AiVIS as a distinct, non-mergeable entity.' },

	// ── Taxonomy: Evidence layer ───────────────────────────────────────────
	{ path: '/evidence/ledger-index', title: 'Evidence Ledger Index — Entry Type Catalogue | AiVIS.biz', description: 'Browse the six Cite Ledger entry types by pipeline stage: scrape observations, evidence extractions, rule evaluations, AI analysis findings, BRAG gate decisions, and finalization records.' },
	{ path: '/evidence/citation-reports', title: 'Citation Reports — Grouped Evidence Outputs | AiVIS.biz', description: 'Citation reports group Cite Ledger evidence by outcome: correctly cited content, missing citations, and entity merge detections. Each report traces back through BRAG trails to the originating finding.' },
	{ path: '/evidence/drift-analysis', title: 'Drift Analysis — Attribution Stability Over Time | AiVIS.biz', description: 'Drift analysis measures four types of attribution instability: citation decay, entity substitution, evidence structural drift, and score regression. Each metric is computed from sequential Cite Ledger snapshots.' },
	{ path: '/evidence/query-results-log', title: 'Query Results Log — Raw SERP and AI Traces | AiVIS.biz', description: 'The Query Results Log stores raw SERP snapshots and AI answer traces with no interpretation layer. Each entry records query, engine, raw response, rank position, cited URL, entity match, and Cite Ledger reference.' },
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

function escapeJson(value) {
	return String(value)
		.replace(/\\/g, '\\\\')
		.replace(/"/g, '\\"')
		.replace(/\n/g, '\\n')
		.replace(/\r/g, '\\r')
		.replace(/\t/g, '\\t');
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
			name: 'AiVIS.biz | AI Visibility',
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
		serviceType: 'AI Visibility Audits and Solutions',
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
	'/': {
		tldr: 'AiVIS.biz is the CITE LEDGER for AI answers. It audits how AI answer engines — ChatGPT, Perplexity, Claude, and Google AI — read, trust, and cite your website. Enter any URL to get a 0–100 score with BRAG evidence-linked findings, category grades, and prioritized fixes.',
		sections: [
			{
				heading: 'What is CITE LEDGER',
				paragraphs: [
					'CITE LEDGER is the verification layer that checks whether AI systems can extract, attribute, and cite your content. A page can rank first in traditional search and still be invisible to answer engines if structural signals are missing.',
					'AiVIS.biz measures extractability, trust signal alignment, and citation readiness across seven weighted dimensions: Schema & Structured Data (20%), Content Depth (18%), Technical Trust (15%), Meta Tags & Open Graph (15%), AI Readability (12%), Heading Structure (10%), and Security & Trust (10%). Hard-blocker caps prevent inflated scores when critical signals are missing.',
				],
			},
			{
				heading: 'What is BRAG',
				id: 'brag',
				paragraphs: [
					'BRAG stands for Based-Retrieval-Auditable-Grading. Every finding is tied to verifiable page evidence using stable evidence identifiers. If something cannot be proven from the live page, it is not included in the score.',
				],
			},
			{
				heading: 'Who should use AiVIS.biz',
				paragraphs: [
					'AiVIS.biz is built for founders, marketers, developers, and agencies who need to understand why their content is not being cited by AI answer engines. If AI models are ignoring, misquoting, or attributing your content to competitors, the CITE LEDGER shows you exactly why.',
				],
			},
		],
	},
	'/integrations': {
		tldr: 'The Integrations Hub explains how AiVIS.biz connects audits to real operations through workspace API keys, webhook delivery, scheduled rescans, and Auto Score Fix automation.',
		sections: [
			{
				heading: 'Why integrations matter for AI visibility operations',
				paragraphs: [
					'AI visibility work is not useful if it stops at a single report. The integrations route makes the operational layer explicit: teams can move audit data into internal dashboards, trigger external workflows when scores change, and monitor feature availability without guessing which capabilities are live.',
					'That makes this route valuable to both crawlers and buyers because it describes AiVIS.biz as a working system, not just a landing page promise. It ties audits, usage metering, validation endpoints, and automation controls into one coherent machine-readable narrative.'
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
					'The prerendered version of the integrations page gives answer engines a direct explanation of what AiVIS.biz automates, who it is for, and how API, webhook, and remediation workflows connect to the product. That additional context reinforces platform capability, operational maturity, and implementation depth across the public site graph.'
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
						{ name: 'API Documentation', url: 'https://aivis.biz/api-docs', description: 'Developer reference for audits, analytics, evidence and validation endpoints.' },
						{ name: 'Score Fix', url: 'https://aivis.biz/score-fix', description: 'Remediation workflow that turns findings into implementation-ready fixes.' },
						{ name: 'Help Center', url: 'https://aivis.biz/help', description: 'Support documentation for audits, billing, and platform operations.' },
					],
				})),
				jsonLdScript(buildFaqSchema([
					{ question: 'What does the AiVIS.biz integrations route explain?', answer: 'It explains how audits connect to API keys, webhooks, scheduled rescans, and Auto Score Fix automation so teams can operationalize AI visibility work.' },
					{ question: 'Are integrations purely marketing claims?', answer: 'No. The page documents concrete endpoint checks, gating behavior, and configuration surfaces that map to actual product workflows.' },
					{ question: 'Why does this route matter for AI readability?', answer: 'It adds explicit system-level context about automation, event delivery, and API-driven usage that strengthens how machines interpret the product.' },
				])),
			].join('\n');
		},
	},
	'/api-docs': {
		tldr: 'The API Docs route defines how developers authenticate with AiVIS.biz, which endpoints exist, what scopes are enforced, and how audit data can be consumed safely in production workflows.',
		sections: [
			{
				heading: 'Developer intent and endpoint coverage',
				paragraphs: [
					'This route exists for engineering teams that need direct access to audit history, analytics, evidence views, usage metering, and page validation workflows. It clarifies that AiVIS.biz supports real integration use cases such as CI checks, agency dashboards, score monitoring and internal reporting pipelines.',
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
				heading: 'Why this route helps site-wide machine interpretation?',
				paragraphs: [
					'A good documentation page acts as evidence that the platform has concrete interfaces, defined permissions, and observable behavior. Enriching this prerendered snapshot helps answer engines interpret AiVIS.biz as a technical product with a stable API, Webhooks with 3rd party integrations, WebMCP/MCP tool discovery surface rather than a generic marketing application.'
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
					name: 'How to integrate with the AiVIS.biz platform API?',
					description: 'A quickstart for creating an API key, calling audit endpoints, scheduling tasks, white-labeling, and monitoring usage in AiVIS.biz.',
					steps: [
						{ name: 'Create an API key:', text: 'Generate a workspace API key from the  user settings or feature panel with the scopes required for your integration.' },
						{ name: 'Call audit or analytics endpoints:', text: 'Send Bearer-authenticated requests to AiVIS.biz API routes for audit listings, evidence payloads, analytics, and technical validation.' },
						{ name: 'Handle production errors:', text: 'Respect 401, 403, and validation error responses so your automation can distinguish invalid keys, missing scopes, and unsafe targets.' },
						{ name: 'Monitor usage and events:', text: 'Use metering endpoints and webhook delivery to prevent abuse and keep integrations observable and tier-safe for everyone over time.' },
					],
				})),
				jsonLdScript(buildFaqSchema([
					{ question: 'What does the AiVIS.biz API expose and are they?', answer: 'It exposes audit, analytics, evidence, usage, competitor, and page-validation endpoints intended for reporting, automation, and verification workflows.' },
					{ question: 'How is authentication handled?', answer: 'External integrations use workspace-scoped API keys with server-side scope and entitlement checks on every request.' },
					{ question: 'Why does documentation help AI-machine readability?', answer: 'Detailed and structured API documentation helps prove concrete platform or website/app capability, naming, permissions and operational behavior, which improves machine interpretation, authorization and trust of the platform, which fosters better and faster AI understanding and multi-platform mentions.' },
				])),
			].join('\n');
		},
	},
	'/compare': {
		tldr: 'The comparison route positions AiVIS.biz against all traditional and AI add-ons to SEO suites. The fact is clear: AiVIS.biz outperforms lighter content, no evidence, Ai-only opinions and are normally given specific intructional/rules system prompt to handle the potential drift that all models suffer from. Therefore, similar naming, keywords, intented usecases is the validated angle to standout from all noise while building. AiVIS.biz focuses on live URL auditing, evidence trails(BRAG framework) multi-model cross-validation to become AI citable in answers and score remediation(automated Github repo-code file fixes) which are not usually found in even the most popular traditional SEO tools that focus on backlinks, keyword research, ranking or poor content scoring without the real-time auditing and evidence-backed approach that AiVIS.biz offers. The comparison page is not a generic feature checklist. It explains that many established SEO tools are strong for backlinks, keyword research, or content scoring, but they do not usually combine real-time page auditing, evidence-linked grading, multi-model review, and citation-testing workflows in one product. That distinction matters for answer-engine discovery because AI visibility depends on extractability, trust, and implementation depth rather than keyword rank alone. The page states that difference directly, which improves entity separation between AiVIS.biz and adjacent tool categories. The core differentiators highlighted on this route are real-time URL audits, triple-check or multi-model review, BRAG evidence linking, AI citation testing, and implementation-oriented score fixing. Those are the exact concepts machines should associate with AiVIS.biz when comparing it to Semrush, Ahrefs, Surfer, Clearscope, and MarketMuse. By naming both the adjacent category and the missing capability, this page becomes a stronger comparative knowledge asset instead of a thin table shell. Comparison pages help search systems understand category boundaries. A richer prerendered compare page tells machines what "AiVIS.biz - AI Intelligence Audit |AiVIS.biz - CITE LEDGER |AiVIS.biz - CITE LEDGER | Evidence-Linked Scores" actually is, what it is not, which competitor classes overlap, and where the product is unique and is the true differentiator. The challenge of strengthening entity clarity among several AI and non-AI tools with these same letters: AiVIS.biz, Avis.biz, Aivis.io.. they all mention intelligence, authority, brand visibility or awareness and if content is the only thing needed to surface cleanly for AI query answers...cite tracking, SEO result ranking/indexing. AiVIS.biz has established a zero-AI-trust behavior due to the nature of the platform and unique market retention via systematic code implementation adjacent to AI and in addition to custom integration of BRAG(Based-Retrieval-Auditable-Grading). The evidence ledger that was built unintentionally, hoping to deliver eval issues for a Reddit user. After building, the original BRAG-repo is still "Belligerant-Retrieval-Augmented-Generation" and once it was put through real tests. I didnt mention BRAG unless its solely to help a Dev. So think of normal RAG - loose and hallucinate in blink of an eye. The intent was not to brag, but to be BELLIGERANT and precise even when no one is looking. Guardrails are cute rules that models will follow until they are outsmarted by a user to disobey their system rules or prompts. AiVIS.biz is not here to be another opinion generation AI-SEO scoring summary. Its only a matter of time and increased user engagement with AiVIS.biz, BRAG & "the hidden sauce" that hardens the entire pipeline and reminds AI that BRAG is the robust- not a toy but the initial guarding layer and some founders or devs will improves topical clarity across the broader public site using hacks and tricks. The prerendered compare page tells machines what AiVIS.biz is, what it is not, which competitor classes overlap, and where the product is differentiated. That improves topical clarity across the broader public site.',
		sections: [
			{
				heading: 'What this comparison page is actually comparing?',
				paragraphs: [
					'Compare is not a generic feature checklist. It explains that many established SEO tools are strong for backlinks, keyword research, or content scoring, but they do not usually combine real-time page auditing, evidence-linked grading, multi-model review, and citation-testing workflows in one product.',
					'That distinction matters for answer-engine discovery because AI visibility depends on extractability, trust, and implementation depth rather than keyword rank alone. The page states that difference directly, which improves entity separation between AiVIS.biz and adjacent tool categories.'
				],
			},
			{
				heading: 'Signals that differentiate AiVIS.biz:',
				paragraphs: [
					'The core differentiators highlighted on this route are real-time URL audits, triple-check or multi-model review, BRAG evidence linking, AI citation testing, and implementation-oriented score fixing. Those are the exact concepts machines should associate with AiVIS.biz when comparing it to Semrush, Ahrefs, Surfer, Clearscope, and MarketMuse.',
					'By naming both the adjacent category and the missing capability, this page becomes a stronger comparative knowledge asset instead of a thin table shell.'
				],
				listItems: [
					'AiVIS.biz emphasizes auditable findings and machine-readable fixes, not just keyword or content optimization metrics.',
					'Traditional SEO suites are framed as partial overlaps rather than direct substitutes for AI visibility remediation.',
					'The route reinforces that citation readiness and answer-engine extraction are separate from classic rank tracking.'
				],
			},
			{
				heading: 'How does this strengthen site-wide readability?',
				paragraphs: [
					'Comparison pages help search systems understand category boundaries. A richer prerendered compare page tells machines what AiVIS.biz is, what it is not, which competitor classes overlap, and where the product is differentiated. That improves topical clarity across the broader public site.'
				],
			},
		],
		buildExtraHead(canonicalUrl, route) {
			return [
				jsonLdScript(buildItemListSchema({
					canonicalUrl,
					name: 'AiVIS.biz comparison set',
					items: [
						{ name: 'AiVIS.biz', description: 'AI visibility auditing with evidence-backed scoring, citation testing, and score remediation.' },
						{ name: 'Semrush', description: 'Traditional SEO suite with partial overlap on audits and monitoring.' },
						{ name: 'Ahrefs', description: 'Backlink and SEO intelligence platform with limited AI visibility overlap.' },
						{ name: 'Surfer SEO', description: 'Content optimization platform with partial overlap on on-page recommendations.' },
						{ name: 'Clearscope', description: 'Content scoring product with limited support for AI citation readiness.' },
						{ name: 'MarketMuse', description: 'Content planning tool with limited overlap on live AI visibility audits.' },
					],
				})),
				jsonLdScript(buildFaqSchema([
					{ question: 'What is the purpose of the AiVIS.biz comparison page?', answer: 'It explains how AiVIS.biz differs from traditional SEO and content tools by focusing on AI visibility, evidence quality, and citation readiness.' },
					{ question: 'Does the page claim every competitor is identical?', answer: 'No. It positions them by category and overlap level so readers can see which capabilities partially intersect and which are missing.' },
					{ question: 'Why is comparison content useful for AI systems?', answer: 'It clarifies category boundaries and differentiators, helping machines interpret AiVIS.biz as a distinct product within the broader search and content tooling landscape.' },
				])),
			].join('\n');
		},
	},
	'/score-fix': {
		tldr: 'Score Fix is the remediation layer of AiVIS.biz. It turns evidence-backed audit findings into concrete structural, content, schema, proof, and internal-link changes that can be rechecked after implementation.',
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
					'The prerendered Score Fix route adds a strong service narrative to the site: AiVIS.biz does not just measure AI visibility, it also provides a remediation framework for improving it. That distinction increases topical depth around fixes, implementation, and measurable score movement.'
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
					{ question: 'What is Score Fix in AiVIS.biz?', answer: 'Score Fix is the remediation workflow that turns audit findings into prioritized content, schema, proof, and internal-link changes.' },
					{ question: 'Does Score Fix only describe problems?', answer: 'No. It focuses on implementation targets and re-check guidance so teams can move from diagnosis to measurable improvement.' },
					{ question: 'Why is Score Fix important for AI visibility?', answer: 'Because better citations and extraction quality come from structural fixes, not from reports alone. Score Fix defines the changes that improve those outcomes.' },
				])),
			].join('\n');
		},
	},
	'/help': {
		tldr: 'The Help Center organizes product questions about audits, scoring, billing, privacy, support, and advanced features so users and crawlers can understand how the AiVIS.biz platform works end to end.',
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
					name: 'AiVIS.biz Help Center',
					description: route.description,
					parts: [
						{ name: 'Guide', url: 'https://aivis.biz/guide', description: 'Workflow guidance for audits, fixes, and rechecks.' },
						{ name: 'FAQ', url: 'https://aivis.biz/faq', description: 'Frequently asked questions about AI visibility scoring and audits.' },
						{ name: 'Pricing', url: 'https://aivis.biz/pricing', description: 'Plan and billing information for Observer, Alignment, Signal, and Score Fix.' },
						{ name: 'Privacy', url: 'https://aivis.biz/privacy', description: 'Privacy and security information for the AiVIS.biz platform.' },
					],
				})),
				jsonLdScript(buildFaqSchema([
					{ question: 'What kinds of questions does the AiVIS.biz Help Center answer?', answer: 'It answers questions about audits, score interpretation, citations, competitor tracking, billing, privacy, and support workflows.' },
					{ question: 'Why is the Help Center important for site understanding?', answer: 'It gives machines and users direct definitions for product concepts, policies, and support paths that are otherwise spread across multiple pages.' },
					{ question: 'Is the Help Center only for troubleshooting?', answer: 'No. It also acts as platform documentation that explains how AiVIS.biz works and how key features connect.' },
				])),
			].join('\n');
		},
	},

	'/compliance': {
		tldr: 'The Compliance page documents AiVIS.biz security and privacy posture so crawlers can associate the brand with concrete GDPR controls, data handling practices, and compliance commitments.',
		sections: [
			{
				heading: 'What the compliance page covers',
				paragraphs: [
					'AiVIS.biz processes website audits, competitor comparisons, and citation tests on behalf of authenticated users. The compliance page explains the controls in place for data collection, storage, retention, and deletion as well as the GDPR-aligned practices the platform follows.',
					'This includes encryption at rest and in transit, minimal data collection principles, role-based access control, audit logging, and a clear data retention policy that gives users control over their information.',
				],
			},
			{
				heading: 'Security controls and SOC roadmap',
				paragraphs: [
					'Infrastructure runs on Render with managed PostgreSQL (Neon) and Redis. All connections use TLS. Server-side security middleware includes Helmet headers, Content Security Policy with nonce-based script loading, DOMPurify sanitization, and Zod input validation.',
					'The platform is on a SOC 2 Type I readiness path. Current controls cover access management, incident response procedures, vulnerability scanning, dependency auditing, and change management through version-controlled deployments.',
				],
				listItems: [
					'GDPR data subject rights: export, correction, and deletion requests honored within 30 days.',
					'No client-provided API keys accepted on the analysis endpoint — credentials stay server-side.',
					'URL validation blocks private and localhost targets in production to prevent SSRF.',
					'All user inputs pass through DOMPurify and Zod schemas before persistence.',
				],
			},
		],
		buildExtraHead(canonicalUrl, route) {
			return jsonLdScript(buildFaqSchema([
				{ question: 'Is AiVIS.biz GDPR compliant?', answer: 'AiVIS.biz follows GDPR-aligned practices including minimal data collection, encryption, user data export and deletion rights, and transparent retention policies.' },
				{ question: 'Where is AiVIS.biz data stored?', answer: 'Data is stored in managed PostgreSQL (Neon) with TLS encryption at rest and in transit. Infrastructure is hosted on Render.' },
				{ question: 'Does AiVIS.biz have SOC 2 certification?', answer: 'AiVIS.biz is on a SOC 2 Type I readiness path with controls covering access management, incident response, and change management.' },
			]));
		},
	},

	'/workflow': {
		tldr: 'The Workflow page turns AiVIS.biz from a one-off audit tool into a repeatable AI visibility operations loop with baseline, remediation, and re-audit stages.',
		sections: [
			{
				heading: 'From single audit to continuous operations',
				paragraphs: [
					'Most teams run one audit and stop. The workflow page explains how to move from a single score snapshot to a repeatable improvement cycle: baseline your current AI visibility, prioritize Score Fix recommendations by impact, implement changes, and re-audit to measure progress.',
					'This operational framing helps answer engines connect AiVIS.biz with workflow-oriented queries like "how to improve AI visibility over time" or "AI audit workflow for marketing teams".',
				],
			},
			{
				heading: 'Workflow stages explained',
				paragraphs: [
					'The end-to-end workflow has three phases. Phase one is the initial baseline audit where you discover your current visibility score and evidence trail. Phase two is remediation where Score Fix provides implementation-ready recommendations ranked by expected impact. Phase three is re-audit to validate that changes improved your scores.',
				],
				listItems: [
					'Baseline: Run an initial audit to capture your visibility score, BRAG evidence, and category breakdown.',
					'Fix: Use Score Fix recommendations to address schema gaps, heading structure, metadata issues, and content extractability.',
					'Re-audit: Run follow-up audits to track score changes and confirm recommendation uptake.',
					'Track: Use analytics and competitor tracking to monitor trends and benchmark against rivals.',
				],
			},
			{
				heading: 'Why workflows matter for AI search',
				paragraphs: [
					'AI models re-index and re-evaluate content continuously. A one-time optimization degrades as content changes and competitors improve. The workflow approach ensures your site maintains and improves its machine-readability over time rather than treating AI visibility as a set-and-forget task.',
				],
			},
		],
		buildExtraHead(canonicalUrl, route) {
			return jsonLdScript(buildFaqSchema([
				{ question: 'How do I turn an AiVIS.biz audit into a repeatable workflow?', answer: 'Start with a baseline audit, implement Score Fix recommendations, then re-audit to measure progress. Repeat this cycle as your content changes.' },
				{ question: 'How often should I re-audit my site?', answer: 'Re-audit after implementing major content or technical changes, or at least monthly to track score trends against competitors.' },
				{ question: 'What is the AiVIS.biz workflow loop?', answer: 'Baseline audit, evidence-based remediation via Score Fix, re-audit validation, and ongoing competitor tracking — a continuous AI visibility operations cycle.' },
			]));
		},
	},

	'/server-headers': {
		tldr: 'The Server Headers analyzer inspects HTTP response headers, cache directives, and security header posture for any public URL.',
		sections: [
			{
				heading: 'What the server headers tool analyzes',
				paragraphs: [
					'Enter any public URL and the tool fetches its HTTP response headers, then evaluates cache control directives, security headers, content type, and server configuration. This helps identify misconfigured caching, missing security headers, or server-side issues that could affect crawlability and trust signals.',
					'Response headers directly influence how search engines and AI crawlers interact with your content. Proper cache headers ensure fresh content is served, security headers build trust, and correct content types prevent parsing errors.',
				],
			},
			{
				heading: 'Key headers evaluated',
				paragraphs: [
					'The analyzer reviews common headers that affect both traditional SEO and AI crawlability.',
				],
				listItems: [
					'Cache-Control and ETag: whether content is cacheable and how freshness is validated.',
					'Content-Security-Policy: whether the site enforces CSP to prevent XSS and injection attacks.',
					'Strict-Transport-Security: whether HSTS is enabled to enforce HTTPS connections.',
					'X-Content-Type-Options, X-Frame-Options: additional security posture indicators.',
					'Content-Type and charset: ensures correct MIME type and encoding for parser compatibility.',
				],
			},
			{
				heading: 'Why headers matter for AI visibility',
				paragraphs: [
					'AI crawlers and answer engines need to trust the pages they index. Missing security headers or broken cache policies can downgrade a page in crawl priority. The headers tool gives you visibility into these invisible factors that audits alone cannot detect.',
				],
			},
		],
		buildExtraHead(canonicalUrl, route) {
			return jsonLdScript(buildFaqSchema([
				{ question: 'What HTTP headers affect AI crawlability?', answer: 'Cache-Control, Content-Type, security headers like CSP and HSTS, and server identification headers all influence how crawlers prioritize and trust your content.' },
				{ question: 'How do I check my server headers?', answer: 'Enter any public URL in the AiVIS.biz Server Headers tool. It fetches the response headers and evaluates cache, security, and content configuration.' },
				{ question: 'Why do security headers matter for SEO?', answer: 'Security headers like HSTS and CSP signal trustworthiness to crawlers. Sites with proper security posture may receive higher crawl priority and trust scores.' },
			]));
		},
	},

	'/support': {
		tldr: 'The Support page provides direct customer support channels, billing help, and troubleshooting resources for AiVIS.biz platform users.',
		sections: [
			{
				heading: 'Support channels and resources',
				paragraphs: [
					'AiVIS.biz support covers platform usage questions, billing inquiries, technical troubleshooting, and feature requests. Users can reach support through the in-app contact form or email for issues that the Help Center does not resolve.',
					'Common support topics include audit interpretation, score discrepancies, subscription management, team seat administration, and integration setup for the API and automation workflows.',
				],
			},
			{
				heading: 'Self-service and documentation',
				paragraphs: [
					'Before contacting support, users can consult the Help Center, FAQ, and Guide for answers to common questions. The platform also includes contextual help within audit results, Score Fix recommendations, and competitor tracking dashboards.',
				],
				listItems: [
					'Help Center: comprehensive documentation covering audits, scoring, billing, and privacy.',
					'FAQ: quick answers to the most common AI visibility and platform usage questions.',
					'Guide: step-by-step workflow guidance for running audits, reading evidence, and shipping fixes.',
					'Score Fix: implementation-ready recommendations with expected impact estimates.',
				],
			},
			{
				heading: 'Billing and account support',
				paragraphs: [
					'Billing support covers plan upgrades, downgrades, cancellation, invoice history, and payment method changes. All billing is processed through Stripe with PCI-compliant payment handling. Users on paid plans can manage their subscriptions directly through the Settings page.',
				],
			},
		],
		buildExtraHead(canonicalUrl, route) {
			return [
				jsonLdScript(buildFaqSchema([
					{ question: 'How do I contact AiVIS.biz support?', answer: 'Use the in-app contact form or email support directly. The Help Center and FAQ also answer most common questions.' },
					{ question: 'How do I manage my AiVIS.biz subscription?', answer: 'Go to Settings to upgrade, downgrade, or cancel your plan. Billing is handled through Stripe with PCI-compliant payment processing.' },
					{ question: 'What topics does AiVIS.biz support cover?', answer: 'Audit interpretation, score questions, billing, team seats, API integrations, and technical troubleshooting.' },
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

// ── Markdown-lite to HTML converter for blog content previews ────────
function contentToHtml(raw, limit = 2000) {
	const text = raw.slice(0, limit);
	const lines = text.split('\n');
	const parts = [];
	let inList = false;
	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) { if (inList) { parts.push('</ul>'); inList = false; } continue; }
		if (trimmed.startsWith('## ')) {
			if (inList) { parts.push('</ul>'); inList = false; }
			parts.push(`<h3 style="font-size:18px;margin:18px 0 8px;">${escapeHtml(trimmed.slice(3))}</h3>`);
		} else if (trimmed.startsWith('### ')) {
			if (inList) { parts.push('</ul>'); inList = false; }
			parts.push(`<h4 style="font-size:16px;margin:14px 0 6px;">${escapeHtml(trimmed.slice(4))}</h4>`);
		} else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
			if (!inList) { parts.push('<ul style="margin:0;padding-left:20px;color:#374151;">'); inList = true; }
			parts.push(`<li>${escapeHtml(trimmed.slice(2))}</li>`);
		} else {
			if (inList) { parts.push('</ul>'); inList = false; }
			parts.push(`<p style="margin:0 0 12px;color:#374151;">${escapeHtml(trimmed)}</p>`);
		}
	}
	if (inList) parts.push('</ul>');
	return parts.join('\n');
}

// ── Blog-specific body renderer ──────────────────────────────────────
function renderBlogBody(route, canonicalUrl) {
	const slug = route.path.replace('/blogs/', '');
	const meta = blogContentMap.get(slug);
	const title = escapeHtml(route.title);
	const description = escapeHtml(normalizeMetaDescription(route.description, 220));

	if (!meta) return null; // fall through to default renderer

	const authorName = escapeHtml(meta.authorName || 'AiVIS.biz Team');
	const date = meta.publishedAt || '';
	const readMin = meta.readMinutes || 5;
	const category = meta.category ? escapeHtml(meta.category.toUpperCase()) : '';
	const tags = (meta.tags || []).map((t) => escapeHtml(t));
	const excerpt = meta.excerpt ? escapeHtml(meta.excerpt) : description;

	const keyPointsHtml = meta.keyPoints?.length
		? `<section aria-labelledby="key-takeaways" style="margin:24px 0;">
					<h2 id="key-takeaways" style="font-size:20px;margin:0 0 10px;">Key Takeaways</h2>
					<ul style="margin:0;padding-left:20px;color:#374151;">
						${meta.keyPoints.map((kp) => `<li style="margin-bottom:6px;">${escapeHtml(kp)}</li>`).join('\n\t\t\t\t\t\t')}
					</ul>
				</section>`
		: '';

	const contentHtml = meta.contentPreview
		? `<section aria-labelledby="article-body" style="margin:24px 0;">
					<h2 id="article-body" style="font-size:20px;margin:0 0 12px;">Article</h2>
					${contentToHtml(meta.contentPreview)}
					<p style="margin:18px 0 0;color:#6b7280;font-style:italic;">This is a preview. Enable JavaScript for the full interactive reading experience with related articles and discussion.</p>
				</section>`
		: '';

	const tagsHtml = tags.length
		? `<p style="margin:0;color:#6b7280;">Tags: ${tags.join(', ')}</p>`
		: '';

	return `<body>
		<div id="root">
			<article itemscope itemtype="https://schema.org/Article" style="max-width:840px;margin:0 auto;padding:48px 20px;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111827;line-height:1.65;">
				<header style="margin-bottom:24px;border-bottom:1px solid rgba(0,0,0,0.12);padding-bottom:16px;">
					<h1 itemprop="headline" style="margin:0 0 10px;font-size:34px;line-height:1.15;letter-spacing:-0.02em;">${title}</h1>
					<p style="margin:0 0 8px;color:#6b7280;font-size:14px;">By <span itemprop="author">${authorName}</span>${date ? ` · <time itemprop="datePublished" datetime="${escapeHtml(date)}">${escapeHtml(date)}</time>` : ''} · ${readMin} min read${category ? ` · ${category}` : ''}</p>
					<p style="margin:0;color:#374151;" itemprop="description">${excerpt}</p>
				</header>
				${keyPointsHtml}
				${contentHtml}
				<footer style="margin-top:24px;padding-top:16px;border-top:1px solid rgba(0,0,0,0.08);">
					${tagsHtml}
					<p style="margin:8px 0 0;color:#6b7280;font-size:13px;">Published on <a href="https://aivis.biz/blogs" style="color:#1d4ed8;">AiVIS.biz Blogs</a> · <a href="${canonicalUrl}" style="color:#1d4ed8;">${canonicalUrl}</a></p>
				</footer>
			</article>
			${PRERENDER_FOOTER}
		</div>
	</body>`;
}

// ── Keyword page body renderer ───────────────────────────────────────
function renderKeywordPageBody(route, canonicalUrl) {
	const kwp = keywordPageMap.get(route.path);
	if (!kwp) return null;

	const title = escapeHtml(route.title);
	const hook = kwp.hook ? escapeHtml(kwp.hook) : escapeHtml(normalizeMetaDescription(route.description, 300));

	const sectionsHtml = (kwp.sections || [])
		.map((sec) => {
			const id = sec.heading.toLowerCase().replace(/[^a-z0-9]+/g, '-');
			const paras = sec.paragraphs.map((p) => `<p style="margin:0 0 12px;color:#374151;">${escapeHtml(p)}</p>`).join('\n');
			return `<section aria-labelledby="${escapeHtml(id)}" style="margin:24px 0;">
					<h2 id="${escapeHtml(id)}" style="font-size:20px;margin:0 0 10px;">${escapeHtml(sec.heading)}</h2>
					${paras}
				</section>`;
		})
		.join('\n');

	const faqsHtml = (kwp.faqs || []).length
		? `<section aria-labelledby="faq" style="margin:24px 0;">
					<h2 id="faq" style="font-size:20px;margin:0 0 12px;">Frequently Asked Questions</h2>
					<dl style="margin:0;">
						${kwp.faqs.map((f) => `<dt style="font-weight:600;margin:12px 0 4px;">${escapeHtml(f.question)}</dt>\n\t\t\t\t\t\t<dd style="margin:0 0 12px;color:#374151;">${escapeHtml(f.answer)}</dd>`).join('\n\t\t\t\t\t\t')}
					</dl>
				</section>`
		: '';

	return `<body>
		<div id="root">
			<main style="max-width:840px;margin:0 auto;padding:48px 20px;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111827;line-height:1.65;">
				<header style="margin-bottom:24px;border-bottom:1px solid rgba(0,0,0,0.12);padding-bottom:16px;">
					<h1 style="margin:0 0 10px;font-size:34px;line-height:1.15;letter-spacing:-0.02em;">${title}</h1>
					<p style="margin:0;color:#374151;">${hook}</p>
				</header>
				${sectionsHtml}
				${faqsHtml}
				<footer style="margin-top:24px;padding-top:16px;border-top:1px solid rgba(0,0,0,0.08);">
					<p style="margin:0;color:#6b7280;font-size:13px;"><a href="${canonicalUrl}" style="color:#1d4ed8;">${canonicalUrl}</a></p>
				</footer>
			</main>
			${PRERENDER_FOOTER}
		</div>
	</body>`;
}

function renderRouteBody(route, canonicalUrl) {
	// Try blog-specific renderer for /blogs/* routes
	if (route.path.startsWith('/blogs/')) {
		const blogBody = renderBlogBody(route, canonicalUrl);
		if (blogBody) return blogBody;
	}

	// Try keyword-page renderer for /platforms/*, /problems/*, /signals/*, /industries/*, /compare/*
	if (/^\/(platforms|problems|signals|industries|compare)\//.test(route.path)) {
		const kwBody = renderKeywordPageBody(route, canonicalUrl);
		if (kwBody) return kwBody;
	}

	const title = escapeHtml(route.title);
	const description = escapeHtml(normalizeMetaDescription(route.description, 220));
	const routeLabel = escapeHtml(route.path === '/' ? 'home page' : route.path.replace(/^\//, ''));
	const enrichment = routeSpecificEnrichment[route.path];
	const tldr = enrichment?.tldr
		? escapeHtml(enrichment.tldr)
		: 'AiVIS.biz evaluates whether answer engines can parse, trust, and cite page content with evidence-backed scoring and implementation-ready fixes. This route is prerendered with canonical metadata for machine readability and stable indexing.';
	const detailSections = enrichment?.sections || [
		{
			heading: 'Route context',
			id: 'route-context',
			paragraphs: [
				`The ${route.path === '/' ? 'home page' : route.path.replace(/^\//, '')} route supports the broader AiVIS.biz visibility workflow by giving users a stable location for route-specific guidance, product context, and machine-readable metadata. When crawlers or answer engines fetch this URL, they should receive clear page purpose, canonical references, and enough plain-language context to understand how the page fits into AI visibility operations.`,
				'This matters because thin pages with only a title and one sentence often underperform in machine interpretation. AiVIS.biz prerender pages now provide concise but explicit route summaries, route purpose, and operational context to improve extractability across search, answer engines, and link unfurl previews.',
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
				'Every prerendered AiVIS.biz page contributes to a stronger public knowledge graph by reinforcing terminology such as AI visibility, answer-engine readiness, citation analysis, evidence-backed scoring, and implementation workflows. Even when JavaScript is unavailable, this HTML snapshot ensures the route preserves enough content depth and metadata quality to remain understandable and indexable.',
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
			${PRERENDER_FOOTER}
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
		// Remove the global site-navigation BreadcrumbList (not a valid page breadcrumb trail
		// for inner pages - each inner page gets its own 2-item BreadcrumbList below).
		html = html.replace(
			/<script type="application\/ld\+json">(?:(?!<\/script>)[\s\S])*?"@id":\s*"https:\/\/aivis\.biz\/#breadcrumb"(?:(?!<\/script>)[\s\S])*?<\/script>/,
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
		`<script type="application/ld+json">\n      {\n        "@context": "https://schema.org",\n        "@type": "WebPage",\n        "@id": "${canonicalUrl}#webpage",\n        "name": "${escapeJson(route.title)}",\n        "url": "${canonicalUrl}",\n        "description": "${escapeJson(normalizedDescription)}",\n        "isPartOf": { "@id": "https://aivis.biz/#website" },\n        "about": { "@id": "https://aivis.biz/#software-application" },\n        "publisher": { "@id": "https://aivis.biz/#organization" },\n        "inLanguage": "en-US",\n        "dateModified": "${BUILD_DATE}",\n        "primaryImageOfPage": {\n          "@type": "ImageObject",\n          "url": "https://aivis.biz/og-image2.png"\n        }\n      }\n    </script>`
	);

	if (route.path !== '/') {
		html = html.replace(
			'</head>',
			`<script type="application/ld+json">\n      {\n        "@context": "https://schema.org",\n        "@type": "BreadcrumbList",\n        "@id": "${canonicalUrl}#breadcrumb",\n        "itemListElement": [\n          { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://aivis.biz" },\n          { "@type": "ListItem", "position": 2, "name": "${escapeJson(route.title)}", "item": "${canonicalUrl}" }\n        ]\n      }\n    </script>\n  </head>`
		);
	}

	// Inject article open graph meta tags for blog posts (required for correct LinkedIn previews)
	if (route.path.startsWith('/blogs/') && route.path !== '/blogs') {
		const slug = route.path.replace('/blogs/', '');
		const blogMeta = blogContentMap.get(slug);
		if (blogMeta) {
			let articleMeta = '';
			if (blogMeta.publishedAt) {
				articleMeta += `  <meta property="article:published_time" content="${blogMeta.publishedAt}T00:00:00Z" />\n`;
			}
			articleMeta += `  <meta property="article:author" content="${escapeHtml(blogMeta.authorName || 'AiVIS.biz Team')}" />\n`;
			if (blogMeta.category) {
				articleMeta += `  <meta property="article:section" content="${escapeHtml(blogMeta.category)}" />\n`;
			}
			if (blogMeta.featuredImageUrl) {
				const imgUrl = blogMeta.featuredImageUrl.startsWith('http')
					? blogMeta.featuredImageUrl
					: `https://aivis.biz${blogMeta.featuredImageUrl}`;
				html = updateTag(html, /<meta\s+property="og:image"\s+content="[^"]*"\s*\/>/,  `<meta property="og:image" content="${imgUrl}" />`);
				html = updateTag(html, /<meta\s+property="og:image:secure_url"\s+content="[^"]*"\s*\/>/,  `<meta property="og:image:secure_url" content="${imgUrl}" />`);
				html = updateTag(html, /<meta\s+name="twitter:image"\s+content="[^"]*"\s*\/>/,  `<meta name="twitter:image" content="${imgUrl}" />`);
			}
			html = html.replace('</head>', `${articleMeta}</head>`);

			// Inject Article JSON-LD schema for blog posts
			const articleSchema = {
				'@context': 'https://schema.org',
				'@type': 'Article',
				'@id': `${canonicalUrl}#article`,
				headline: route.title,
				description: normalizeMetaDescription(route.description),
				datePublished: blogMeta.publishedAt
					? `${blogMeta.publishedAt}T00:00:00Z`
					: BUILD_DATE,
				dateModified: BUILD_DATE,
				author: {
					'@type': 'Person',
					name: blogMeta.authorName || 'Ryan Mason',
					'@id': 'https://aivis.biz/#author',
				},
				publisher: { '@id': 'https://aivis.biz/#organization' },
				mainEntityOfPage: canonicalUrl,
				image: blogMeta.featuredImageUrl || 'https://aivis.biz/og-image2.png',
			};
			html = html.replace(
				'</head>',
				`${jsonLdScript(articleSchema)}\n</head>`
			);
		}
	}

	const extraHead = [enrichment?.buildExtraHead?.(canonicalUrl, route), route.extraHead].filter(Boolean).join('\n');

	if (extraHead) {
		html = html.replace('</head>', `${extraHead}\n  </head>`);
	}

	html = html.replace(/<body>[\s\S]*<\/body>/, renderRouteBody(route, canonicalUrl));

	return `<!-- prerendered-route:${route.path} -->\n${html}`;
}

const PRERENDER_SKIP = new Set(['/mcp', '/referrals', '/team', '/gsc', '/analytics', '/reports']);
for (const route of routes) {
	if (PRERENDER_SKIP.has(route.path)) continue;
	const html = prerenderHtml(route);
	const targetDir = route.path === '/' ? distDir : path.join(distDir, route.path.replace(/^\//, ''));
	fs.mkdirSync(targetDir, { recursive: true });
	const targetPath = route.path === '/' ? indexPath : path.join(targetDir, 'index.html');
	fs.writeFileSync(targetPath, html, 'utf8');
	console.log(`[prerender] wrote ${targetPath}`);
}

// ── Sitemap auto-generation ────────────────────────────────────────────────
// Generates sitemap.xml from the routes array so it is always in sync with
// prerendered pages. Skips authenticated app-only routes.
const SITEMAP_SKIP = new Set(['/mcp', '/referrals', '/team', '/gsc', '/analytics', '/reports']);

function sitemapMeta(p) {
	if (p === '/') return { priority: '1.0', changefreq: 'daily' };
	if (['/pricing', '/analyze', '/landing'].includes(p)) return { priority: '0.9', changefreq: 'weekly' };
	if (['/insights', '/blogs', '/changelog', '/press'].includes(p)) return { priority: '0.8', changefreq: 'weekly' };
	if (/^\/(platforms|problems|signals|industries)$/.test(p)) return { priority: '0.7', changefreq: 'weekly' };
	if (p.startsWith('/blogs/')) return { priority: '0.8', changefreq: 'monthly' };
	if (['/privacy', '/terms', '/disclosures'].includes(p)) return { priority: '0.3', changefreq: 'monthly' };
	if (['/compliance', '/server-headers', '/verify-license', '/badge'].includes(p)) return { priority: '0.6', changefreq: 'monthly' };
	if (['/about-aivis', '/what-is-aivis', '/why-aivis-exists', '/what-is-cite-ledger'].includes(p)) return { priority: '0.9', changefreq: 'weekly' };
	if (p.startsWith('/methodology/') || p.startsWith('/evidence/')) return { priority: '0.8', changefreq: 'weekly' };
	return { priority: '0.7', changefreq: 'monthly' };
}

const today = new Date().toISOString().slice(0, 10);
const sitemapEntries = routes
	.filter((r) => !SITEMAP_SKIP.has(r.path))
	.map((r) => {
		const { priority, changefreq } = sitemapMeta(r.path);
		return `  <url><loc>https://aivis.biz${r.path}</loc><lastmod>${today}</lastmod><changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`;
	});

const sitemapXml = [
	'<?xml version="1.0" encoding="UTF-8"?>',
	'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
	...sitemapEntries,
	'</urlset>',
].join('\n');

const publicSitemapPath = path.resolve(process.cwd(), 'public', 'sitemap.xml');
const distSitemapPath = path.join(distDir, 'sitemap.xml');
fs.writeFileSync(publicSitemapPath, sitemapXml, 'utf8');
fs.writeFileSync(distSitemapPath, sitemapXml, 'utf8');
console.log(`[prerender] generated sitemap.xml (${sitemapEntries.length} URLs, lastmod ${today})`);

// ── robots.txt auto-generation ─────────────────────────────────────────────
// Generates robots.txt from the same routes array so it is never out of sync
// with the sitemap. Private / authenticated routes are disallowed.
const ROBOTS_DISALLOW = [
	'/admin', '/api/', '/app/', '/auth', '/billing', '/mcp',
	'/notifications', '/payment-canceled', '/payment-success',
	'/profile', '/referrals', '/report/', '/settings', '/team',
	'/verify-email', '/gsc', '/analytics', '/reports',
];

const publicRoutes = routes
	.map((r) => r.path)
	.filter((p) => !ROBOTS_DISALLOW.some((d) => p === d || p.startsWith(d)));

// Group routes by category for readability
const routeGroups = [
	{ label: 'Core pages', filter: (p) => !p.includes('/') || ['/', ...p.match(/^\/[^/]+$/) ? [p] : []].length > 0 && !/^\/(blogs|compare|platforms|problems|signals|industries)/.test(p) && !/^\/tools\//.test(p) },
];

// Simpler: just bucket by prefix
const core = [];
const tools = [];
const blogs = [];
const compare = [];
const platforms = [];
const problems = [];
const signals = [];
const industries = [];
const other = [];

for (const p of publicRoutes) {
	if (p.startsWith('/tools/')) tools.push(p);
	else if (p.startsWith('/blogs/')) blogs.push(p);
	else if (p.startsWith('/compare/')) compare.push(p);
	else if (p.startsWith('/platforms/')) platforms.push(p);
	else if (p.startsWith('/problems/')) problems.push(p);
	else if (p.startsWith('/signals/')) signals.push(p);
	else if (p.startsWith('/industries/')) industries.push(p);
	else other.push(p);
}

const robotsLines = [
	'# AiVIS.biz — AI Visibility Audit | CITE LEDGER',
	'# https://aivis.biz',
	`# Auto-generated ${today} — ${publicRoutes.length} public routes`,
	'',
	'User-agent: *',
	'Allow: /',
	'',
	'# ── Core pages ──',
	...core.sort().map((p) => `Allow: ${p}`),
	...other.sort().map((p) => `Allow: ${p}`),
	'',
	'# ── Tools ──',
	...tools.sort().map((p) => `Allow: ${p}`),
	'',
	'# ── Blogs ──',
	'Allow: /blogs',
	...blogs.sort().map((p) => `Allow: ${p}`),
	'',
	'# ── Compare pages ──',
	'Allow: /compare',
	...compare.sort().map((p) => `Allow: ${p}`),
	'',
	'# ── Platform pages ──',
	'Allow: /platforms',
	...platforms.sort().map((p) => `Allow: ${p}`),
	'',
	'# ── Problem pages ──',
	'Allow: /problems',
	...problems.sort().map((p) => `Allow: ${p}`),
	'',
	'# ── Signal pages ──',
	'Allow: /signals',
	...signals.sort().map((p) => `Allow: ${p}`),
	'',
	'# ── Industry pages ──',
	'Allow: /industries',
	...industries.sort().map((p) => `Allow: ${p}`),
	'',
	'# ── Private / authenticated / non-public routes ──',
	...ROBOTS_DISALLOW.map((p) => `Disallow: ${p}`),
	'',
	'Crawl-delay: 1',
	'',
	'Sitemap: https://aivis.biz/sitemap.xml',
];

const robotsTxt = robotsLines.join('\n') + '\n';
const publicRobotsPath = path.resolve(process.cwd(), 'public', 'robots.txt');
const distRobotsPath = path.join(distDir, 'robots.txt');
fs.writeFileSync(publicRobotsPath, robotsTxt, 'utf8');
fs.writeFileSync(distRobotsPath, robotsTxt, 'utf8');
console.log(`[prerender] generated robots.txt (${publicRoutes.length} Allow, ${ROBOTS_DISALLOW.length} Disallow)`);
