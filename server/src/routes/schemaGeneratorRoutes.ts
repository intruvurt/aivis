// server/src/routes/schemaGeneratorRoutes.ts
import express, { Request, Response } from 'express';
import { authRequired } from '../middleware/authRequired.js';
import { usageGate } from '../middleware/usageGate.js';
import { meetsMinimumTier } from '../../../shared/types.js';
import type { CanonicalTier, LegacyTier } from '../../../shared/types.js';
import { callAIProvider, PROVIDERS } from '../services/aiProviders.js';

const router = express.Router();

const SCHEMA_DEADLINE_MS = 30_000;
const MAX_INPUT_CHARS = 8_000;

const getApiKey = () => process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_API_KEY || '';

function sanitizeInput(input: string, maxLen = MAX_INPUT_CHARS): string {
  return `<user_content>\n${String(input).slice(0, maxLen)}\n</user_content>`;
}

function withDeadline<T>(promise: Promise<T>, label: string, ms = SCHEMA_DEADLINE_MS): Promise<T> {
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
  // Strip markdown code fences if present
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
      error: 'Schema Generator requires an Alignment or higher plan.',
      code: 'TIER_INSUFFICIENT',
      requiredTier: 'alignment',
    });
  }
  next();
});

/**
 * POST /api/schema-generator/generate
 *
 * Generates JSON-LD schema markup from audit data + page context.
 *
 * Body:
 *   url        - the audited page URL (used to build Organization/WebPage)
 *   pageTitle  - page title text
 *   description - meta description or page summary
 *   topics     - string[] of topical keywords from the audit
 *   recommendations - string[] of fix recommendations from the audit
 *
 * Returns:
 *   { schemas: { organization, webPage, article?, faqPage? } }
 */
router.post('/generate', async (req: Request, res: Response) => {
  const { url, pageTitle, description, topics, recommendations } = req.body as {
    url?: string;
    pageTitle?: string;
    description?: string;
    topics?: string[];
    recommendations?: string[];
  };

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ success: false, error: 'url is required' });
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    return res.status(500).json({ success: false, error: 'AI provider key not configured' });
  }

  // Build base schemas deterministically — no AI needed
  let hostname = '';
  try {
    hostname = new URL(url).hostname;
  } catch {
    hostname = url;
  }

  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: pageTitle || hostname,
    url: url,
    ...(description ? { description } : {}),
  };

  const webPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: pageTitle || hostname,
    url: url,
    ...(description ? { description } : {}),
    ...(topics && topics.length > 0
      ? { keywords: topics.slice(0, 10).join(', ') }
      : {}),
  };

  // AI-generated FAQPage from audit recommendations
  let faqPageSchema: object | null = null;

  if (recommendations && recommendations.length >= 2) {
    const topRecs = recommendations.slice(0, 6);
    const prompt = `You are a JSON-LD schema specialist. Given these website improvement recommendations, generate a FAQPage schema.

Page URL: ${sanitizeInput(url, 200)}
Recommendations:
${topRecs.map((r, i) => `${i + 1}. ${r}`).join('\n')}

Generate a JSON object (NOT wrapped in markdown) with this exact shape:
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "A natural question a user might ask that this recommendation addresses",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "A concise, factual answer based on the recommendation"
      }
    }
  ]
}

Rules:
- Generate one Question per recommendation (max 6)
- Questions must be natural language questions, not imperative statements
- Answers must be 1-2 sentences, factual, and based on the recommendation text
- Return ONLY valid JSON, no markdown, no extra commentary`;

    try {
      const rawFaq = await withDeadline(
        callAIProvider({
          provider: PROVIDERS[0].provider,
          model: PROVIDERS[0].model,
          prompt,
          apiKey,
          opts: { max_tokens: 1200 },
        }),
        'FAQ Schema generation',
      );
      faqPageSchema = parseJsonResponse<object>(rawFaq);
    } catch (err: any) {
      // FAQ generation is best-effort — don't fail the whole request
      console.warn('[SchemaGenerator] FAQ generation failed (non-fatal):', err?.message);
    }
  }

  const schemas: Record<string, object> = {
    organization: organizationSchema,
    webPage: webPageSchema,
  };

  if (faqPageSchema) {
    schemas.faqPage = faqPageSchema;
  }

  return res.json({
    success: true,
    schemas,
    generatedAt: new Date().toISOString(),
    sourceUrl: url,
  });
});

export default router;
