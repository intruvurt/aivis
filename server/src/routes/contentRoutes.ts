// server/src/routes/contentRoutes.ts
import express, { Request, Response } from 'express';
import { authRequired } from '../middleware/authRequired.js';
import { usageGate } from '../middleware/usageGate.js';
import { meetsMinimumTier } from '../../../shared/types.js';
import type { CanonicalTier, LegacyTier } from '../../../shared/types.js';
import { callAIProvider, PROVIDERS } from '../services/aiProviders.js';

const router = express.Router();

const CONTENT_DEADLINE_MS = 30_000;
const MAX_INPUT_CHARS = 6_000;

const getApiKey = () => process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_API_KEY || '';

function sanitizeInput(input: string, maxLen = MAX_INPUT_CHARS): string {
  return `<user_content>\n${String(input).slice(0, maxLen)}\n</user_content>`;
}

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
This could be a paragraph, a FAQ section, a structured list, or a heading + supporting text — whatever best addresses the recommendation.
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

export default router;
