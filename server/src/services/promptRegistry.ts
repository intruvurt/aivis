type PromptVersion = '2026-04-13.1';

export type PromptTemplateId =
    | 'audit.primary'
    | 'audit.peer_review'
    | 'audit.validation_gate'
    | 'scorefix.fix_plan'
    | 'citations.query_pack';

export type PromptRenderResult = {
    id: PromptTemplateId;
    version: PromptVersion;
    prompt: string;
    systemPrompt?: string;
};

type AuditPrimaryArgs = {
    tierPromptPrefix: string;
    targetUrl: string;
    hostname: string;
    evidenceBlock: string;
    diagnosticFlags: string[];
    bodySnippet: string;
    platformIntelBlock: string;
    findabilityGoalsBlock: string;
    mockDataScanBlock: string;
    boundsBlock: string;
};

type AuditPeerReviewArgs = {
    targetUrl: string;
    ai1Score: number;
    primaryAnalysis: unknown;
    evidenceBlock: string;
};

type AuditValidationArgs = {
    targetUrl: string;
    ai1Score: number;
    ai2Adjustment: number;
    ai2Model: string;
    ai2Critique: string;
    proposedScore: number;
    categoryGrades: unknown;
    evidenceManifest: Record<string, unknown>;
};

type ScoreFixPlanArgs = {
    evidenceJson: string;
    repoTreeSection: string;
    repoTreeShown: boolean;
    scoreBefore: number;
    targetUrl: string;
};

type QueryPackArgs = {
    count: number;
    brandName: string;
    url: string;
    title: string;
    description: string;
    topics: string[];
    entities: string[];
    keywordIntelligence: string[];
    quotableHighlights: string[];
    recommendationThemes: string[];
    faqCount: number;
};

function serializeJson(value: unknown): string {
    return JSON.stringify(value, null, 0);
}

function buildAuditPrimaryPrompt(args: AuditPrimaryArgs): string {
    return `${args.tierPromptPrefix}AI Visibility Intelligence Platform audit for ${args.targetUrl} (${args.hostname}).
Base ALL findings on the evidence below. Be honest - most sites score C/D. Cite [ev_*] IDs.

WRITING STYLE (mandatory for all text fields):
- Write in a direct, technical, human-edited voice. No filler. No marketing fluff.
- Never use a comma before "and", "or", "but", or "etc." - use the serial-comma-free style throughout.
- Avoid comma-heavy AI patterns. Prefer short declarative sentences over long compound ones.
- Do not start sentences with "Additionally", "Furthermore", "Moreover", or "In conclusion".

EVIDENCE:
${args.evidenceBlock}

DIAGNOSTIC SNAPSHOT (pre-computed from live scraped data - treat as confirmed facts):
${args.diagnosticFlags.map((flag) => `  • ${flag}`).join("\n")}

BODY (first 2000 chars):
${args.bodySnippet}
${args.platformIntelBlock}
${args.findabilityGoalsBlock}
${args.mockDataScanBlock}

MANDATORY SCORING BOUNDS (enforced server-side - scores outside these ranges will be overridden):
${args.boundsBlock}
Score according to evidence quality: weak evidence lands in the lower half; strong evidence lands upper half. Most sites earn C/D.

RECOMMENDATION CONTRACT - every recommendation MUST follow this contract:
1. description must START with "Measured: <actual value from evidence>. Target: <required/recommended value>." - no exceptions.
2. implementation must include at least one concrete code, markup, or config example relevant to the specific finding.
3. evidence_ids must cite only real [ev_*] IDs listed above that confirm the problem.
4. scorefix_category must be one of: "schema_structured_data" | "meta_tags" | "heading_structure" | "content_depth" | "technical_seo" | "ai_readability" | "image_accessibility" | "internal_linking" | "robots_access"
5. Do not invent problems not backed by the DIAGNOSTIC SNAPSHOT or EVIDENCE.
6. consequenceStatement must describe the REAL BUSINESS COST of ignoring this issue. Use survival language, not system language. Example: "AI answer engines will recommend your competitors instead of you for queries about <topic>" or "ChatGPT and Perplexity cannot extract your core value proposition — you become invisible in AI-generated answers".
7. estimatedVisibilityLoss must be a percentage range of citation/visibility loss if not fixed (e.g. "15-25%"). Base on severity: high priority = 20-35%, medium = 10-20%, low = 5-15%.
8. estimatedTimeMinutes must be realistic implementation time in minutes (5, 15, 30, 60, 120).

ADDITIONAL CHECKS (flag these as recommendations when detected):
- ICP clarity: if the page does not name a specific target audience (e.g. "for SEO managers" or "built for content teams"), recommend adding an explicit audience statement in the hero/subheadline. Category: content_depth.
- Jargon and unexplained acronyms: if the page uses domain-specific acronyms without expansion on first use, recommend plain-language alternatives or inline definitions. Category: ai_readability.
- Benefit vs feature framing: if pricing or feature sections list technical capabilities without stating the user outcome (e.g. "CSV export" instead of "Export reports to share with your team"), recommend rewriting as benefit-first statements. Category: content_depth.
- Schema completeness: check for Review/AggregateRating (social proof), Product schema with Offer and pricing, FAQPage with 8+ items, and HowTo steps. Recommend adding any that are missing. Category: schema_structured_data.
- Scannability: if the H1 or subheadline exceeds 80 characters, or if sections lack subheadings, recommend splitting for mobile readability. Category: heading_structure.

Return ONLY valid JSON (no markdown, no fences):
{"visibility_score":<0-100>,"ai_platform_scores":{"chatgpt":<0-100>,"perplexity":<0-100>,"google_ai":<0-100>,"claude":<0-100>},"summary":"<2-3 sentences>","key_takeaways":["<3-5 items>"],"topical_keywords":["<5-10>"],"keyword_intelligence":[{"keyword":"<from topical_keywords>","intent":"informational|commercial|navigational|transactional","volume_tier":"low|medium|high|very_high","competition":"low|medium|high","opportunity":<0-100>,"trend":"rising|stable|declining"}],"brand_entities":["<found on page>"],"primary_topics":["<3-5>"],"faq_count":<int>,"category_grades":[{"grade":"A|B|C|D|F","label":"<category>","score":<0-100>,"summary":"<1-2 sent>","strengths":[],"improvements":[]}],"content_highlights":[{"area":"heading|meta|schema|content|technical|readability","found":"<quote actual text from page>","status":"good|warning|critical|missing","note":"<specific why with measured value>","source_id":"<ev_* ID>"}],"recommendations":[{"priority":"high|medium|low","category":"<category_grade label>","scorefix_category":"<one of the 9 above>","title":"<short specific title>","description":"Measured: <actual value>. Target: <recommended value>. <explanation>","impact":"<specific projected impact with estimated score lift>","difficulty":"easy|medium|hard","implementation":"<specific steps with code/markup example>","evidence_ids":["<ev_*"],"consequenceStatement":"<real business cost in survival language>","estimatedVisibilityLoss":"<X-Y%>","estimatedTimeMinutes":<5|15|30|60|120>}],"crypto_intelligence":{"has_crypto_signals":false,"summary":"<or detected>","detected_assets":[],"keywords":[],"wallet_addresses":[],"sentiment":"neutral","risk_notes":[],"chain_networks":[]}}

Required category_grades labels: "Content Depth & Quality","Heading Structure & H1","Schema & Structured Data","Meta Tags & Open Graph","Technical SEO","AI Readability & Citability"
Grading: A=90-100, B=75-89, C=50-74, D=25-49, F=0-24. Grade letter MUST match numeric score.`;
}

function buildAuditPeerReviewPrompt(args: AuditPeerReviewArgs): string {
    return `You are a PEER REVIEWER for an AI visibility audit. Your job is to CRITIQUE the primary analysis below and adjust the score.
Write in a direct, technical voice. No filler. Never use a comma before "and", "or", "but", or "etc."

ORIGINAL URL: ${args.targetUrl}
PRIMARY AI SCORE: ${args.ai1Score}/100

PRIMARY ANALYSIS (JSON):
${serializeJson(args.primaryAnalysis)}

EVIDENCE (scraped from live page):
${args.evidenceBlock}

INSTRUCTIONS:
- Review each category grade. Are they justified by the evidence?
- Check for inflated scores (AI models tend to be too generous).
- Check for missed issues the primary analysis overlooked.
- Provide a score_adjustment between -15 and +10 (negative = primary was too generous, positive = too harsh).
- List 0-3 extra recommendations the primary analysis missed.
- Do NOT claim a signal is missing when the evidence says it is present or OK.
- Do NOT recommend adding TLDR/summary, fixing meta description length, or fixing H1 count if the evidence block already shows those as detected or in-range.
- Extra recommendations must be directly grounded in the evidence block, not generic best practices.
- Be STRICT. Most sites deserve C/D grades. Penalise missing schema, thin content, weak meta tags.

Return ONLY valid JSON:
{"score_adjustment":<-15 to +10>,"critique":"<2-3 sentences explaining why you adjusted>","missed_issues":["<issues primary missed>"],"extra_recommendations":["<0-3 actionable items>"],"category_overrides":[{"label":"<category name>","adjusted_score":<0-100>,"reason":"<why>"}],"confidence":"high|medium|low"}`;
}

function buildAuditValidationPrompt(args: AuditValidationArgs): string {
    return `You are a VALIDATION GATE for an AI visibility audit. Two prior models have already analyzed this website. Your job is to confirm or override the proposed final score.
Write in a direct, technical voice. No filler. Never use a comma before "and", "or", "but", or "etc."

URL: ${args.targetUrl}
AI1 PRIMARY SCORE: ${args.ai1Score}/100
AI2 PEER ADJUSTMENT: ${args.ai2Adjustment > 0 ? '+' : ''}${args.ai2Adjustment} (model: ${args.ai2Model || 'skipped'})
AI2 CRITIQUE: ${args.ai2Critique || 'N/A'}
PROPOSED FINAL SCORE: ${args.proposedScore}/100

CATEGORY GRADES (after AI2 overrides):
${serializeJson(args.categoryGrades)}

KEY EVIDENCE:
${Object.entries(args.evidenceManifest)
            .slice(0, 10)
            .map(([id, value]) => `[${id}] ${String(value)}`)
            .join('\n')}

INSTRUCTIONS:
- Validate whether ${args.proposedScore}/100 is fair given the evidence.
- If the score needs modification, provide a final_score override (0-100).  
- validated=true means you agree with the proposed score (±3 points).
- validated=false means you're overriding it.
- Be STRICT. Empty schema/meta/H1 = low scores. Don't inflate.

Return ONLY valid JSON:
{"validated":<true|false>,"final_score":<0-100>,"verdict":"<1-2 sentences>","confidence":"high|medium|low"}`;
}

function buildScoreFixPlanPrompt(args: ScoreFixPlanArgs): PromptRenderResult {
    return {
        id: 'scorefix.fix_plan',
        version: '2026-04-13.1',
        systemPrompt: `You are an expert web engineer specializing in AI visibility optimization (AEO/GEO/SEO).
You analyze structured audit evidence and produce precise, evidence-backed code file changes.
You respond ONLY with valid JSON. No markdown. No prose outside JSON.
Your code changes must be exact, production-ready, and directly derived from the evidence provided.
Never invent problems not in the evidence. Every change must cite which recommendation it resolves.`,
        prompt: `Analyze this AI visibility audit and produce a precise code fix plan.

AUDIT EVIDENCE:
${args.evidenceJson}
${args.repoTreeSection}
Produce a JSON response with this exact structure:
{
  "summary": "One sentence describing the primary fix strategy",
  "score_before": ${args.scoreBefore},
  "projected_score_lift": "e.g. +12 to +18 points",
  "evidence_count": <number of recommendations addressed>,
  "pr_title": "fix: AiVIS Score Fix - evidence-backed visibility improvements for ${args.targetUrl}",
  "pr_body": "<full PR description in markdown with evidence citations, before/after summary, and implementation notes>",
  "file_changes": [
    {
      "path": "relative/file/path.ext",
      "operation": "create" | "update",
      "justification": "Which recommendation this resolves and why",
      "content": "<complete file content or targeted patch content>"
    }
  ]
}

Requirements:
- Target schema.org JSON-LD files, meta tag files, robots.txt, sitemap hints, or structured HTML sections
- If private_exposure_scan findings exist, prioritize concrete fixes for secret leakage, route protection, session hardening, and header hardening.
- Each file_change must be complete and self-contained (not a diff - full replacement content for the relevant file)
- Paths MUST be relative to the repo root and MUST match the directory structure and conventions of the actual repository${args.repoTreeShown ? ' shown above' : ''}
- Limit to 5 most impactful file changes
- PR body must include: Score context, Evidence summary, Per-file change rationale, Implementation verification steps`,
    };
}

function buildQueryPackPrompt(args: QueryPackArgs): string {
    return `You are an enterprise search-query strategist building a real citation test pack.
Generate ${args.count} realistic search queries that people would ask AI assistants (ChatGPT, Perplexity, Claude, Google AI) where "${args.brandName}" or the site "${args.url}" SHOULD legitimately appear.

Website: ${args.url}
Brand/Company: ${args.brandName}
Title: ${args.title}
Description: ${args.description}
Topics: ${args.topics.join(', ') || 'N/A'}
Entities: ${args.entities.join(', ') || 'N/A'}
Priority keywords: ${args.keywordIntelligence.join(', ') || 'N/A'}
Quotable page highlights: ${args.quotableHighlights.join(' | ') || 'N/A'}
Remediation / feature themes: ${args.recommendationThemes.join(', ') || 'N/A'}
FAQ Count: ${args.faqCount}

Generate query groups across these use cases:
1. Direct entity and brand discovery
2. Product/service category discovery
3. Problem-solution intent for buyers and operators
4. Comparison, alternative, and shortlist evaluation
5. Review, trust, and proof queries
6. Quoted-answer / exact-phrase style prompts based on the page's quotable content
7. Feature, capability, integration, workflow, and compliance questions
8. Executive / buyer framing like ROI, implementation, best fit, and who it is for

IMPORTANT RULES:
- Make queries natural and conversational
- Include both branded and non-branded prompts
- Focus on search cases where the brand has a legitimate reason to be cited
- Use unique product/service wording and quotable phrases when available
- Favor niche precision over broad generic prompts
- Queries should be 3-18 words long
- Avoid duplicates or near-duplicates

Return ONLY valid JSON (no markdown, no fences):
{
  "industry": "<detected industry/niche>",
  "queries": ["query 1", "query 2", ...],
  "topics": ["topic 1", "topic 2", ...]
}`;
}

export function renderPrompt(id: 'audit.primary', args: AuditPrimaryArgs): PromptRenderResult;
export function renderPrompt(id: 'audit.peer_review', args: AuditPeerReviewArgs): PromptRenderResult;
export function renderPrompt(id: 'audit.validation_gate', args: AuditValidationArgs): PromptRenderResult;
export function renderPrompt(id: 'scorefix.fix_plan', args: ScoreFixPlanArgs): PromptRenderResult;
export function renderPrompt(id: 'citations.query_pack', args: QueryPackArgs): PromptRenderResult;
export function renderPrompt(id: PromptTemplateId, args: any): PromptRenderResult {
    switch (id) {
        case 'audit.primary':
            return { id, version: '2026-04-13.1', prompt: buildAuditPrimaryPrompt(args) };
        case 'audit.peer_review':
            return { id, version: '2026-04-13.1', prompt: buildAuditPeerReviewPrompt(args) };
        case 'audit.validation_gate':
            return { id, version: '2026-04-13.1', prompt: buildAuditValidationPrompt(args) };
        case 'scorefix.fix_plan':
            return buildScoreFixPlanPrompt(args);
        case 'citations.query_pack':
            return { id, version: '2026-04-13.1', prompt: buildQueryPackPrompt(args) };
        default:
            throw new Error(`Unknown prompt template: ${id satisfies never}`);
    }
}