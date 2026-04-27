// server/src/routes/contentRoutes.ts
import express, { Request, Response } from 'express';
import { authRequired } from '../middleware/authRequired.js';
import { usageGate } from '../middleware/usageGate.js';
import { meetsMinimumTier } from '../../../shared/types.js';
import type { CanonicalTier, LegacyTier } from '../../../shared/types.js';
import { callAIProvider, PROVIDERS } from '../services/aiProviders.js';
import { sanitizePromptInput as sanitizeInput } from '../utils/sanitize.js';

const router = express.Router();

const CONTENT_DEADLINE_MS = 30_000;
const MAX_INPUT_CHARS = 6_000;

const getApiKey = () => process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_API_KEY || '';

function withDeadline<T>(promise: Promise<T>, label: string, ms = CONTENT_DEADLINE_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms / 1000}s`)),
      ms,
    );
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

function parseJsonResponse<T>(raw: string): T {
  const stripped = raw
    .replace(/^```(?:json)?\s*/im, '')
    .replace(/\s*```\s*$/im, '')
    .trim();
  return JSON.parse(stripped) as T;
}

function inferBrandFromUrl(rawUrl: string): string {
  try {
    const parsed = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`);
    const root = (parsed.hostname || '').replace(/^www\./i, '').split('.')[0] || '';
    return root ? root.charAt(0).toUpperCase() + root.slice(1) : 'The page';
  } catch {
    return 'The page';
  }
}

// All routes require auth + usage gate
router.use(authRequired);
router.use(usageGate);

// Tier gate: Alignment+ only
router.use((req: Request, res: Response, next) => {
  const user = (req as any).user;
  const userTier = (user?.tier || 'observer') as CanonicalTier | LegacyTier;
  if (!meetsMinimumTier(userTier, 'alignment')) {
    return res.status(403).json({
      success: false,
      error: 'Generate Fix requires an Alignment or higher plan.',
      code: 'TIER_INSUFFICIENT',
      requiredTier: 'alignment',
    });
  }
  next();
});

/**
 * POST /api/content/generate-fix
 *
 * Generates a concrete implementation snippet for a single audit recommendation.
 * Routes output format by action category.
 *
 * Body:
 *   action: {
 *     title: string          - recommendation title
 *     description?: string   - recommendation description
 *     category?: string      - "schema" | "content" | "technical" | "trust"
 *     impact?: string        - "high" | "medium" | "low"
 *   }
 *   context: {
 *     url?: string           - audited page URL
 *     pageTitle?: string     - page title
 *     existingContent?: string - excerpt of existing page content for context
 *   }
 *
 * Returns:
 *   {
 *     fix: string            - the generated fix
 *     format: "json-ld" | "html" | "markdown" | "text"
 *     explanation: string    - one paragraph explaining what was generated and why
 *     category: string       - echoed from input
 *   }
 */
router.post('/generate-fix', async (req: Request, res: Response) => {
  const { action, context } = req.body as {
    action?: {
      title?: string;
      description?: string;
      category?: string;
      impact?: string;
    };
    context?: {
      url?: string;
      pageTitle?: string;
      existingContent?: string;
    };
  };

  if (!action?.title || typeof action.title !== 'string') {
    return res.status(400).json({ success: false, error: 'action.title is required' });
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    return res.status(500).json({ success: false, error: 'AI provider key not configured' });
  }

  const category = (action.category || 'content').toLowerCase();
  const isSchema = category.includes('schema') || category.includes('json');
  const isTechnical = category.includes('technical') || category.includes('header') || category.includes('server');
  const isContent = !isSchema && !isTechnical;

  let outputFormat: 'json-ld' | 'html' | 'markdown' | 'text';
  let formatInstruction: string;

  if (isSchema) {
    outputFormat = 'json-ld';
    formatInstruction = `Provide a complete, valid JSON-LD script block ready to paste into the <head> of the page.
Format: <script type="application/ld+json"> ... </script>
Use real, specific values based on the page context provided. Do not use placeholder text.`;
  } else if (isTechnical) {
    outputFormat = 'text';
    formatInstruction = `Provide the exact server configuration, HTTP header directive, or technical implementation needed.
Format as plain text with clear labels for each setting. Include the exact syntax needed.`;
  } else {
    outputFormat = 'markdown';
    formatInstruction = `Provide a ready-to-publish content block in Markdown format.
This could be a paragraph, a FAQ section, a structured list, or a heading + supporting text - whatever best addresses the recommendation.
Write it as actual publishable content, not a description of what to write. Use real, specific language.`;
  }

  const contextBlock = [
    context?.url ? `Page URL: ${context.url}` : '',
    context?.pageTitle ? `Page Title: ${context.pageTitle}` : '',
    context?.existingContent
      ? `Existing content excerpt:\n${sanitizeInput(context.existingContent, 1500)}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  const prompt = `You are an AI visibility specialist. You generate ready-to-implement fixes based on audit recommendations.

Recommendation to fix:
Title: ${sanitizeInput(action.title, 300)}
${action.description ? `Description: ${sanitizeInput(action.description, 500)}` : ''}
Category: ${category}
Impact: ${action.impact || 'medium'}

${contextBlock ? `Page Context:\n${contextBlock}` : ''}

AEO primitive constraints (non-negotiable):
- Preserve entity identity. Do not dilute or broaden the entity scope beyond the audited page and recommendation.
- Keep brand/entity naming canonical and consistent across the output.
- Tie every remediation to observable evidence signals (citation presence, missing citation state, structured extraction quality).
- Prefer deterministic, implementation-ready structures over generic advice.

${formatInstruction}

After the implementation, add a single paragraph starting with "Explanation:" that explains what this fix does and why it matters for AI visibility.

Return ONLY the implementation and the Explanation paragraph. No other commentary.`;

  try {
    const raw = await withDeadline(
      callAIProvider({
        provider: PROVIDERS[0].provider,
        model: PROVIDERS[0].model,
        prompt,
        apiKey,
        opts: { max_tokens: 1500 },
      }),
      'Generate Fix',
    );

    // Split explanation from the fix body
    const explanationMatch = raw.match(/\bExplanation:\s*([\s\S]+)$/m);
    const explanation = explanationMatch
      ? explanationMatch[1].trim()
      : 'This fix implements the audit recommendation to improve AI visibility and machine readability.';
    const fix = explanationMatch
      ? raw.slice(0, explanationMatch.index).trim()
      : raw.trim();

    return res.json({
      success: true,
      fix,
      format: outputFormat,
      explanation,
      category,
      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[ContentRoutes] generate-fix error:', err?.message);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, error: 'Fix generation failed. Please try again.' });
    }
  }
});

/**
 * POST /api/content/prompt-answer-pack
 *
 * Generates structured, answer-ready content mapped to a specific AI prompt.
 */
router.post('/prompt-answer-pack', async (req: Request, res: Response) => {
  const {
    url,
    prompt,
    intent,
    recommended_block,
    recommended_schema,
    brand_name,
  } = (req.body || {}) as {
    url?: string;
    prompt?: string;
    intent?: string;
    recommended_block?: string;
    recommended_schema?: string;
    brand_name?: string;
  };

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ success: false, error: 'url is required' });
  }
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ success: false, error: 'prompt is required' });
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    return res.status(500).json({ success: false, error: 'AI provider key not configured' });
  }

  const safeUrl = sanitizeInput(url, 400);
  const safePrompt = sanitizeInput(prompt, 600);
  const safeIntent = sanitizeInput(intent || 'informational', 100);
  const safeBlock = sanitizeInput(recommended_block || 'definition', 60);
  const safeSchema = sanitizeInput(recommended_schema || 'FAQPage', 60);
  const brand = sanitizeInput((brand_name || inferBrandFromUrl(url)).trim(), 180);

  const generationPrompt = `You are an AI visibility remediation engine.

Generate a structured answer-ready content pack for this target prompt and URL.

Target URL: ${safeUrl}
Brand: ${brand}
Prompt: ${safePrompt}
Intent: ${safeIntent}
Preferred block: ${safeBlock}
Preferred schema: ${safeSchema}

Return strict JSON with this exact shape:
{
  "definition_block": "string",
  "steps": ["string", "string", "string"],
  "faq": [{"question": "string", "answer": "string"}],
  "schema": {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": []},
  "implementation_notes": ["string", "string"],
  "confidence": 0
}

Rules:
- Produce implementation-ready, publishable content only.
- Make all claims concrete and citation-oriented; avoid fluff.
- Keep entity naming consistent with the provided brand.
- Ensure schema aligns with FAQ content and is valid JSON-LD.
- Set confidence to an integer 0-100.
- Return JSON only.`;

  try {
    const raw = await withDeadline(
      callAIProvider({
        provider: PROVIDERS[0].provider,
        model: PROVIDERS[0].model,
        prompt: generationPrompt,
        apiKey,
        opts: { max_tokens: 1600 },
      }),
      'Prompt answer pack generation',
    );

    type PromptPack = {
      definition_block?: string;
      steps?: string[];
      faq?: Array<{ question?: string; answer?: string }>;
      schema?: Record<string, unknown>;
      implementation_notes?: string[];
      confidence?: number;
    };

    let parsed: PromptPack | null = null;
    try {
      parsed = parseJsonResponse<PromptPack>(raw);
    } catch {
      parsed = null;
    }

    const fallbackFaq = [
      {
        question: `What does ${brand} provide for this prompt intent?`,
        answer: `${brand} addresses this prompt by providing a focused, evidence-backed answer path that can be validated and cited.`,
      },
      {
        question: `Why should AI systems cite ${brand} for this topic?`,
        answer: `${brand} presents explicit definitions, actionable steps, and verifiable claims aligned to the query language users actually ask.`,
      },
    ];

    const pack = {
      definition_block:
        (parsed?.definition_block || '').trim() ||
        `${brand} is a specialized solution for "${safePrompt}" that provides clear, verifiable guidance optimized for AI answer extraction.`,
      steps:
        Array.isArray(parsed?.steps) && parsed.steps.length > 0
          ? parsed.steps.slice(0, 6).map((s) => String(s).trim()).filter(Boolean)
          : [
            'Define the answer scope using the exact prompt language.',
            'Add explicit, sourceable claims that support the answer.',
            'Attach structured FAQ/HowTo schema aligned to the claims.',
          ],
      faq:
        Array.isArray(parsed?.faq) && parsed.faq.length > 0
          ? parsed.faq
            .map((item) => ({
              question: String(item?.question || '').trim(),
              answer: String(item?.answer || '').trim(),
            }))
            .filter((item) => item.question && item.answer)
            .slice(0, 8)
          : fallbackFaq,
      schema:
        parsed?.schema && typeof parsed.schema === 'object'
          ? parsed.schema
          : {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: fallbackFaq.map((item) => ({
              '@type': 'Question',
              name: item.question,
              acceptedAnswer: {
                '@type': 'Answer',
                text: item.answer,
              },
            })),
          },
      implementation_notes:
        Array.isArray(parsed?.implementation_notes) && parsed.implementation_notes.length > 0
          ? parsed.implementation_notes.slice(0, 6).map((n) => String(n).trim()).filter(Boolean)
          : [
            'Place definition block in the first viewport section of the target page.',
            'Mirror prompt phrasing in at least one heading and one FAQ question.',
          ],
      confidence: Math.max(0, Math.min(100, Math.round(Number(parsed?.confidence || 66)))),
    };

    return res.json({
      success: true,
      pack,
      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[ContentRoutes] prompt-answer-pack error:', err?.message);
    return res.status(500).json({ success: false, error: 'Failed to generate prompt answer pack.' });
  }
});

/**
 * POST /api/content/prompt-intelligence-report
 *
 * Produces a two-pass extraction report for prompt intelligence:
 * - fast: quick extraction and citation-risk diagnosis
 * - deep: deeper causality, rewrite, and blueprint optimization
 */
router.post('/prompt-intelligence-report', async (req: Request, res: Response) => {
  const { url, prompt, answer, mode } = (req.body || {}) as {
    url?: string;
    prompt?: string;
    answer?: string;
    mode?: 'fast' | 'deep';
  };

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ success: false, error: 'url is required' });
  }

  const safePrompt = typeof prompt === 'string' ? sanitizeInput(prompt, 1200) : '';
  const safeAnswer = typeof answer === 'string' ? sanitizeInput(answer, MAX_INPUT_CHARS) : '';
  const normalizedMode = mode === 'deep' ? 'deep' : 'fast';

  if (!safePrompt && !safeAnswer) {
    return res.status(400).json({ success: false, error: 'prompt or answer is required' });
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    return res.status(500).json({ success: false, error: 'AI provider key not configured' });
  }

  const safeUrl = sanitizeInput(url, 400);
  const brand = inferBrandFromUrl(safeUrl);

  const extractionPrompt = `You are the AiVIS Prompt Intelligence Engine.

System constraints (non-negotiable):
- This is a citation visibility engine, not a dashboard.
- Every insight must map to citation state and/or a corrective action path.
- No generic advice, no marketing language, no unverifiable claims.

Input:
- URL: ${safeUrl}
- Brand: ${brand}
- Prompt: ${safePrompt || 'Not provided'}
- Answer sample: ${safeAnswer || 'Not provided'}
- Pass mode: ${normalizedMode}

Task:
Generate a structured extraction report with 7 stages:
1) intent decomposition
2) output structure analysis
3) citation likelihood signals
4) pattern signature extraction
5) prompt->output causality
6) optimized prompt rewrite
7) content blueprint generation

For fast mode:
- prioritize speed
- concise arrays (max 4 items each)

For deep mode:
- include stronger causality and remediation detail
- arrays can include up to 8 items each

Return strict JSON only with this exact shape:
{
  "mode": "fast|deep",
  "summary": "string",
  "intent_decomposition": ["string"],
  "output_structure_analysis": ["string"],
  "citation_likelihood_signals": {
    "score": 0,
    "positives": ["string"],
    "risks": ["string"]
  },
  "pattern_signature_extraction": ["string"],
  "prompt_output_causality": ["string"],
  "optimized_prompt_rewrite": "string",
  "content_blueprint_generation": {
    "opening_block": "string",
    "sections": ["string"],
    "faq": [{"question": "string", "answer": "string"}],
    "schema_targets": ["string"],
    "evidence_requirements": ["string"]
  },
  "action_graph": [{"action": "string", "owner": "content|schema|technical", "impact": "high|medium|low"}],
  "confidence": 0
}`;

  try {
    type PromptIntelligenceReport = {
      mode?: 'fast' | 'deep';
      summary?: string;
      intent_decomposition?: string[];
      output_structure_analysis?: string[];
      citation_likelihood_signals?: {
        score?: number;
        positives?: string[];
        risks?: string[];
      };
      pattern_signature_extraction?: string[];
      prompt_output_causality?: string[];
      optimized_prompt_rewrite?: string;
      content_blueprint_generation?: {
        opening_block?: string;
        sections?: string[];
        faq?: Array<{ question?: string; answer?: string }>;
        schema_targets?: string[];
        evidence_requirements?: string[];
      };
      action_graph?: Array<{
        action?: string;
        owner?: 'content' | 'schema' | 'technical' | string;
        impact?: 'high' | 'medium' | 'low' | string;
      }>;
      confidence?: number;
    };

    const raw = await withDeadline(
      callAIProvider({
        provider: PROVIDERS[0].provider,
        model: PROVIDERS[0].model,
        prompt: extractionPrompt,
        apiKey,
        opts: { max_tokens: normalizedMode === 'deep' ? 2200 : 1300 },
      }),
      'Prompt intelligence report generation',
      normalizedMode === 'deep' ? 45_000 : CONTENT_DEADLINE_MS,
    );

    let parsed: PromptIntelligenceReport | null = null;
    try {
      parsed = parseJsonResponse<PromptIntelligenceReport>(raw);
    } catch {
      parsed = null;
    }

    const report = {
      mode: normalizedMode,
      summary:
        String(parsed?.summary || '').trim() ||
        `Prompt extraction completed in ${normalizedMode} mode for ${brand}.`,
      intent_decomposition: Array.isArray(parsed?.intent_decomposition)
        ? parsed!.intent_decomposition!.map((x) => String(x).trim()).filter(Boolean).slice(0, normalizedMode === 'deep' ? 8 : 4)
        : [],
      output_structure_analysis: Array.isArray(parsed?.output_structure_analysis)
        ? parsed!.output_structure_analysis!.map((x) => String(x).trim()).filter(Boolean).slice(0, normalizedMode === 'deep' ? 8 : 4)
        : [],
      citation_likelihood_signals: {
        score: Math.max(
          0,
          Math.min(100, Math.round(Number(parsed?.citation_likelihood_signals?.score ?? 50))),
        ),
        positives: Array.isArray(parsed?.citation_likelihood_signals?.positives)
          ? parsed!.citation_likelihood_signals!.positives!
            .map((x) => String(x).trim())
            .filter(Boolean)
            .slice(0, normalizedMode === 'deep' ? 8 : 4)
          : [],
        risks: Array.isArray(parsed?.citation_likelihood_signals?.risks)
          ? parsed!.citation_likelihood_signals!.risks!
            .map((x) => String(x).trim())
            .filter(Boolean)
            .slice(0, normalizedMode === 'deep' ? 8 : 4)
          : [],
      },
      pattern_signature_extraction: Array.isArray(parsed?.pattern_signature_extraction)
        ? parsed!.pattern_signature_extraction!
          .map((x) => String(x).trim())
          .filter(Boolean)
          .slice(0, normalizedMode === 'deep' ? 8 : 4)
        : [],
      prompt_output_causality: Array.isArray(parsed?.prompt_output_causality)
        ? parsed!.prompt_output_causality!
          .map((x) => String(x).trim())
          .filter(Boolean)
          .slice(0, normalizedMode === 'deep' ? 8 : 4)
        : [],
      optimized_prompt_rewrite:
        String(parsed?.optimized_prompt_rewrite || '').trim() || safePrompt || 'No rewrite available.',
      content_blueprint_generation: {
        opening_block:
          String(parsed?.content_blueprint_generation?.opening_block || '').trim() ||
          `${brand} should publish an explicit answer-first opening block aligned to the target prompt.`,
        sections: Array.isArray(parsed?.content_blueprint_generation?.sections)
          ? parsed!.content_blueprint_generation!.sections!
            .map((x) => String(x).trim())
            .filter(Boolean)
            .slice(0, normalizedMode === 'deep' ? 10 : 5)
          : [],
        faq: Array.isArray(parsed?.content_blueprint_generation?.faq)
          ? parsed!.content_blueprint_generation!.faq!
            .map((row) => ({
              question: String(row?.question || '').trim(),
              answer: String(row?.answer || '').trim(),
            }))
            .filter((row) => row.question && row.answer)
            .slice(0, normalizedMode === 'deep' ? 6 : 3)
          : [],
        schema_targets: Array.isArray(parsed?.content_blueprint_generation?.schema_targets)
          ? parsed!.content_blueprint_generation!.schema_targets!
            .map((x) => String(x).trim())
            .filter(Boolean)
            .slice(0, normalizedMode === 'deep' ? 8 : 4)
          : [],
        evidence_requirements: Array.isArray(
          parsed?.content_blueprint_generation?.evidence_requirements,
        )
          ? parsed!.content_blueprint_generation!.evidence_requirements!
            .map((x) => String(x).trim())
            .filter(Boolean)
            .slice(0, normalizedMode === 'deep' ? 8 : 4)
          : [],
      },
      action_graph: Array.isArray(parsed?.action_graph)
        ? parsed!.action_graph!
          .map((row) => ({
            action: String(row?.action || '').trim(),
            owner:
              row?.owner === 'schema' || row?.owner === 'technical' || row?.owner === 'content'
                ? row.owner
                : 'content',
            impact:
              row?.impact === 'high' || row?.impact === 'low' || row?.impact === 'medium'
                ? row.impact
                : 'medium',
          }))
          .filter((row) => row.action)
          .slice(0, normalizedMode === 'deep' ? 10 : 5)
        : [],
      confidence: Math.max(0, Math.min(100, Math.round(Number(parsed?.confidence || 68)))),
    };

    return res.json({
      success: true,
      report,
      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[ContentRoutes] prompt-intelligence-report error:', err?.message);
    return res.status(500).json({ success: false, error: 'Failed to generate prompt intelligence report.' });
  }
});

export default router;
