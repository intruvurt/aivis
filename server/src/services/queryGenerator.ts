import { callAIProvider, ALIGNMENT_PRIMARY, FREE_PROVIDERS } from './aiProviders.js';
import { renderPrompt } from './promptRegistry.js';

export interface GeneratedQueries {
  queries: string[];
  industry: string;
  topics: string[];
  fallback?: boolean;
}

/**
 * Generate relevant search queries based on website content
 * These queries will be used to test AI platform citations
 */
export async function generateQueries(
  url: string,
  content: {
    title?: string;
    description?: string;
    keywords?: string[];
    topics?: string[];
    brandName?: string;
    entities?: string[];
    contentHighlights?: Array<{ found?: string; note?: string; area?: string }>;
    recommendations?: Array<{ title?: string; category?: string }>;
    keywordIntelligence?: Array<{ keyword?: string; intent?: string }>;
    faqCount?: number;
  },
  count: number = 50,
  apiKey: string
): Promise<GeneratedQueries> {
  const brandName = content.brandName || extractBrandFromUrl(url);
  const topics = content.topics || content.keywords || [];
  const entities = Array.isArray(content.entities) ? content.entities.filter(Boolean).slice(0, 6) : [];
  const quotableHighlights = Array.isArray(content.contentHighlights)
    ? content.contentHighlights
      .map((item) => String(item?.found || item?.note || '').replace(/\s+/g, ' ').trim())
      .filter((item) => item.length >= 18 && item.length <= 140)
      .slice(0, 5)
    : [];
  const recommendationThemes = Array.isArray(content.recommendations)
    ? content.recommendations.map((item) => String(item?.title || item?.category || '').trim()).filter(Boolean).slice(0, 5)
    : [];
  const keywordIntelligence = Array.isArray(content.keywordIntelligence)
    ? content.keywordIntelligence.map((item) => String(item?.keyword || '').trim()).filter(Boolean).slice(0, 8)
    : [];

  const promptConfig = renderPrompt('citations.query_pack', {
    count,
    brandName,
    url,
    title: content.title || 'N/A',
    description: content.description || 'N/A',
    topics,
    entities,
    keywordIntelligence,
    quotableHighlights,
    recommendationThemes,
    faqCount: content.faqCount || 0,
  });

  // Primary: use ALIGNMENT_PRIMARY (GPT-5 Nano) — reliable JSON output
  // Secondary: fallback to first free provider (Gemma 4 31B)
  const modelsToTry = [
    { model: ALIGNMENT_PRIMARY.model, endpoint: ALIGNMENT_PRIMARY.endpoint },
    { model: FREE_PROVIDERS[0].model, endpoint: FREE_PROVIDERS[0].endpoint },
  ];

  for (const { model, endpoint } of modelsToTry) {
    try {
      const response = await callAIProvider({
        provider: 'openrouter',
        model,
        prompt: promptConfig.prompt,
        apiKey,
        endpoint,
        opts: { max_tokens: 1200 },
      });

      if (!response) continue;

      // Clean and parse JSON
      const cleaned = response.trim().replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
      const parsed = JSON.parse(cleaned);

      if (!Array.isArray(parsed.queries) || parsed.queries.length === 0) continue;

      return {
        queries: parsed.queries.slice(0, count),
        industry: parsed.industry || 'Unknown',
        topics: parsed.topics || topics,
        fallback: false,
      };
    } catch (err: any) {
      console.error(`[QueryGenerator] Model ${model} failed:`, err?.message || err);
    }
  }

  console.warn('[QueryGenerator] All models failed — using template fallback');
  return { ...generateFallbackQueries(brandName, url, topics, count), fallback: true };
}

/**
 * Fallback query generation if AI fails
 */
function generateFallbackQueries(
  brandName: string,
  url: string,
  topics: string[],
  count: number
): GeneratedQueries {
  const primaryTopic = topics[0] || 'solution';
  const queries: string[] = [
    `What is ${brandName}?`,
    `Who is ${brandName} best for?`,
    `${brandName} review`,
    `${brandName} features`,
    `How does ${brandName} work?`,
    `Is ${brandName} worth it?`,
    `${brandName} pricing`,
    `${brandName} alternatives`,
    `${brandName} vs competitors`,
    `Best ${primaryTopic} tools`,
    `Best ${primaryTopic} software for teams`,
    `${brandName} use cases`,
    `${brandName} implementation workflow`,
    `${brandName} trust and compliance`,
    `${brandName} customer proof`,
  ];

  topics.slice(0, 5).forEach(topic => {
    queries.push(`Best ${topic} for ${brandName}`);
    queries.push(`How to use ${brandName} for ${topic}`);
    queries.push(`${brandName} for ${topic}`);
    queries.push(`Who should use ${brandName} for ${topic}`);
  });

  return {
    queries: Array.from(new Set(queries)).slice(0, count),
    industry: primaryTopic || 'General',
    topics: topics.slice(0, 5),
  };
}

/**
 * Extract brand name from URL
 */
function extractBrandFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    const parts = hostname.replace('www.', '').split('.');
    const brandPart = parts[0];
    // Capitalize first letter
    return brandPart.charAt(0).toUpperCase() + brandPart.slice(1);
  } catch {
    return 'The Brand';
  }
}

/**
 * Filter queries to those most likely to mention the brand
 * (Used to reduce API costs - test top queries first)
 */
export function prioritizeQueries(queries: string[], brandName: string): string[] {
  // Sort by likelihood of brand mention
  const scored = queries.map(q => {
    let score = 0;
    const lower = q.toLowerCase();
    const brand = brandName.toLowerCase();

    // Direct brand mention = highest priority
    if (lower.includes(brand)) score += 100;

    // Question words suggest informational queries (good for citations)
    if (/^(what|how|why|when|where|who|which|can|does|is)\s/i.test(q)) score += 20;

    // Comparison/alternative queries often mention multiple brands
    if (/\b(vs|versus|alternative|compare|better|best)\b/i.test(lower)) score += 15;

    // Review/opinion queries
    if (/\b(review|opinion|thoughts|experience|worth)\b/i.test(lower)) score += 10;

    return { query: q, score };
  });

  return scored.sort((a, b) => b.score - a.score).map(s => s.query);
}
