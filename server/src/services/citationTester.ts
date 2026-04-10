import { callAIProvider } from './aiProviders.js';
import type { AICitationResult, WebSearchPresenceResult } from '../../../shared/types.js';
import { modelShortName } from './citationRankingEngine.js';
import { checkWebSearchPresence, checkBingSearchPresence, checkBraveSearchPresence, checkYahooSearchPresence } from './webSearch.js';
import { checkDDGPresence } from './duckDuckGoSearch.js';
import { checkWikipediaPresence } from './wikipediaSearch.js';

type ModelRole = 'primary' | 'fallback';
type CitationPlatform = 'chatgpt' | 'perplexity' | 'claude' | 'google_ai';

type ProviderCandidate = {
  provider: 'openrouter';
  model: string;
  endpoint: string;
};

type MentionAnalysis = {
  mentioned: boolean;
  position: number;
  excerpt: string;
  competitorsMentioned: string[];
};

interface GeminiDirectResult {
  content: string;
  model: string;
}

export interface CitationTestConfig {
  query: string;
  brandName: string;
  url: string;
  platforms?: CitationPlatform[];
  competitorUrls?: string[];
  entityContext?: { brandName?: string; domain?: string; description?: string; niche?: string };
}

export interface CitationTestResult {
  query: string;
  results: AICitationResult[];
  tested_at: string;
  /** Real web search verification (DDG HTML search), always runs - free, no key */
  web_search?: WebSearchPresenceResult;
  /** Bing web search verification, always runs - free, no key */
  bing_search?: WebSearchPresenceResult;
  /** DuckDuckGo Instant Answer presence check - always runs (free, no key) */
  ddg_search?: WebSearchPresenceResult;
  /** Brave web search verification - always runs, free, no key */
  brave_search?: WebSearchPresenceResult;
  /** Wikipedia presence verification - always runs, free, no key */
  wikipedia_search?: WebSearchPresenceResult;
  /** Yahoo web search verification - always runs, free, no key */
  yahoo_search?: WebSearchPresenceResult;
}

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_PLATFORMS: CitationPlatform[] = ['chatgpt', 'perplexity', 'claude', 'google_ai'];
const MODEL_MAX_TOKENS = 800;
const MODEL_TEMPERATURE = 0.4;
const GEMINI_TIMEOUT_MS = 30_000;
const WORKER_PARALLEL_LIMIT = 2;
const INTER_QUERY_DELAY_MS = 500;
const DEFAULT_FALLBACK_EXCERPT_LENGTH = 200;
const EXTENDED_FALLBACK_EXCERPT_LENGTH = 300;
const MIN_SUBSTANTIVE_EXCERPT_LENGTH = 20;

const PLATFORM_MODEL_CANDIDATES: Record<CitationPlatform, ProviderCandidate[]> = {
  chatgpt: [
    { provider: 'openrouter', model: 'openai/gpt-5-nano', endpoint: OPENROUTER_ENDPOINT },
    { provider: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct', endpoint: OPENROUTER_ENDPOINT },
    { provider: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct:free', endpoint: OPENROUTER_ENDPOINT },
    { provider: 'openrouter', model: 'google/gemma-3-27b-it:free', endpoint: OPENROUTER_ENDPOINT },
    { provider: 'openrouter', model: 'google/gemma-3-27b-it', endpoint: OPENROUTER_ENDPOINT },
  ],
  perplexity: [
    { provider: 'openrouter', model: 'deepseek/deepseek-v3.2', endpoint: OPENROUTER_ENDPOINT },
    { provider: 'openrouter', model: 'openai/gpt-5-nano', endpoint: OPENROUTER_ENDPOINT },
    { provider: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct', endpoint: OPENROUTER_ENDPOINT },
    { provider: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct:free', endpoint: OPENROUTER_ENDPOINT },
    { provider: 'openrouter', model: 'google/gemma-3-27b-it:free', endpoint: OPENROUTER_ENDPOINT },
  ],
  claude: [
    { provider: 'openrouter', model: 'anthropic/claude-haiku-4.5', endpoint: OPENROUTER_ENDPOINT },
    { provider: 'openrouter', model: 'anthropic/claude-sonnet-4', endpoint: OPENROUTER_ENDPOINT },
    { provider: 'openrouter', model: 'google/gemma-3-27b-it', endpoint: OPENROUTER_ENDPOINT },
    { provider: 'openrouter', model: 'openai/gpt-5-nano', endpoint: OPENROUTER_ENDPOINT },
    { provider: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct:free', endpoint: OPENROUTER_ENDPOINT },
    { provider: 'openrouter', model: 'google/gemma-3-27b-it:free', endpoint: OPENROUTER_ENDPOINT },
  ],
  google_ai: [
    { provider: 'openrouter', model: 'google/gemini-2.5-flash', endpoint: OPENROUTER_ENDPOINT },
    { provider: 'openrouter', model: 'google/gemma-3-27b-it:free', endpoint: OPENROUTER_ENDPOINT },
    { provider: 'openrouter', model: 'google/gemma-3-27b-it', endpoint: OPENROUTER_ENDPOINT },
    { provider: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct:free', endpoint: OPENROUTER_ENDPOINT },
    { provider: 'openrouter', model: 'openai/gpt-5-nano', endpoint: OPENROUTER_ENDPOINT },
  ],
};

const PLATFORM_PROMPT_CONTEXT: Record<CitationPlatform, string> = {
  chatgpt: `
You are simulating ChatGPT with browsing.
Retrieval profile:
- Candidate source discovery is biased toward indexed pages and directly fetchable pages.
- Pages with strong title/H1/entity alignment are more retrievable.
- JSON-LD, canonical clarity, and clean HTML structure increase trust.
- Prefer explicit factual blocks over narrative fluff.
- If evidence is weak or fragmented, reduce confidence and avoid mention inflation.
Citation behavior:
- Mention only brands or domains that would plausibly survive retrieval and synthesis.
- If citing, name concrete domains.
- Do not fabricate article titles, quotes, or browsing actions.`,

  perplexity: `
You are simulating Perplexity-style answer synthesis over live retrieval.
Retrieval profile:
- Candidate sources are selected using semantic relevance, not exact keyword overlap.
- High-density factual sections, entity-rich headings, and concise answer blocks score better.
- Sources that answer the query near the opening of a section are preferred.
- Shallow intros and delayed answers are penalized.
Citation behavior:
- Inline source-domain grounding is expected.
- If a domain is not retrieval-worthy for this query, do not mention it.
- Diversity helps, but weak sources should not be included just to create variety.`,

  claude: `
You are simulating Claude with web_fetch-like page reading.
Retrieval profile:
- Server-rendered, markdown-friendly, parseable HTML is favored.
- JavaScript-dependent content is often under-resolved.
- Pages with single-topic focus, coherent heading hierarchy, and explicit trust signals are preferred.
- Entity ambiguity, weak schema relationships, or fragmented rendering reduce retrievability.
Citation behavior:
- Cite only if source authority and parseability are clear.
- If evidence quality is low, answer cautiously and avoid forced brand inclusion.`,

  google_ai: `
You are simulating Google AI Overview synthesis.
Retrieval profile:
- Prefer specialized pages with strong topical authority and structured data.
- Favor cross-source consensus, E-E-A-T cues, factual consistency, and freshness where relevant.
- Prefer pages with FAQ, schema, and entity disambiguation when query intent is informational.
- Penalize generic pages with weak topic specialization.
Citation behavior:
- Use 3-5 diverse domains when possible.
- Only mention brands or domains that plausibly appear in a top synthesis set.
- Avoid over-crediting a source when the answer likely comes from consensus summarization.`,
};

const PLATFORM_SYSTEM_PROMPTS: Record<CitationPlatform, string> = {
  chatgpt: `You are a retrieval-grounded answer engine simulation.
Your output must reflect realistic browsing constraints.
Never fabricate source access.
Never mention a domain unless it plausibly contributed to the answer.
If source support is weak, say so.
Respond in plain text using:
Answer:
Sources considered:
Confidence:`,

  perplexity: `You are a semantic retrieval and citation engine simulation.
Your job is not to be helpful at all costs; your job is to be retrieval-faithful.
No fabricated sources.
No forced mentions.
No unsupported inline citations.
Respond in plain text using:
Answer:
Sources considered:
Confidence:`,

  claude: `You are a parseability-sensitive answer engine simulation.
Assume only server-rendered content is available.
Avoid claims that depend on unseen JavaScript-rendered data.
Prefer omission over speculation.
Respond in plain text using:
Answer:
Sources considered:
Confidence:`,

  google_ai: `You are a multi-source synthesis engine simulation.
Only include brands or domains that would plausibly survive a consensus answer-generation pipeline.
Avoid single-source overfitting.
Do not present guesswork as sourced fact.
Respond in plain text using:
Answer:
Sources considered:
Confidence:`,
};

export function buildCitationPrompt(
  query: string,
  platform?: CitationPlatform,
  entityContext?: { brandName?: string; domain?: string; description?: string; niche?: string },
): string {
  const normalizedQuery = normalizePromptInput(query);
  const platformContext = platform ? PLATFORM_PROMPT_CONTEXT[platform] ?? '' : '';

  // Build entity grounding block so the model knows which entity is being tested
  let entityBlock = '';
  if (entityContext?.brandName || entityContext?.domain) {
    const parts: string[] = [];
    if (entityContext.brandName) parts.push(`Target entity: "${entityContext.brandName}"`);
    if (entityContext.domain) parts.push(`Official domain: ${entityContext.domain}`);
    if (entityContext.niche) parts.push(`Niche: ${entityContext.niche}`);
    if (entityContext.description) parts.push(`Description: ${entityContext.description}`);
    entityBlock = `\n\nEntity context for citation detection (do NOT force-include this entity — only mention it if retrieval evidence supports it):\n${parts.join('\n')}`;
  }

  return `You are simulating a production answer engine under retrieval constraints.${platformContext}

Your task is to answer the user query exactly as a real answer engine would if it had access to web retrieval.

Strict operating rules:
- Do not ask follow-up questions.
- Do not request more URLs, documents, or clarification.
- Do not invent citations, sources, or brands.
- Do not imply a source was retrieved unless you explicitly name the source domain.
- Separate sourced claims from general reasoning.
- If the answer cannot confidently mention a brand or domain, say so plainly.
- Prefer omission over speculation.
- Prefer exact entities, domains, products, and organizations over vague nouns.
- If multiple sources would normally be needed, synthesize only what would survive cross-source agreement.

Output contract:
1. Give a direct answer first.
2. Then provide a short section called "Sources considered" listing domain names only.
3. Then provide a short section called "Confidence" with one of: high, moderate, low.
4. If the answer does not support mentioning the target brand or domain, do not force it in.
${entityBlock}
User query: ${normalizedQuery}`;
}

function normalizePromptInput(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function getGeminiApiKey(): string | null {
  return process.env.GEMINI_API_KEY || null;
}

function extractProviderErrorPayload(response: string): string | null {
  const trimmed = response.trim();
  if (!trimmed.startsWith('{')) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    return typeof parsed.error === 'string' && parsed.error.trim() ? parsed.error.trim() : null;
  } catch {
    return null;
  }
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }

  return 'Unknown error';
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function truncateForExcerpt(value: string, maxLength: number): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength)}...` : trimmed;
}

function splitSentences(value: string): string[] {
  return value
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
  }
}

function splitResponseSections(response: string): {
  answerText: string;
  sourcesText: string;
  confidenceText: string;
} {
  const normalized = response.replace(/\r/g, '').trim();

  const sourcesMatch = normalized.match(/(?:^|\n)Sources considered\s*:\s*/i);
  const confidenceMatch = normalized.match(/(?:^|\n)Confidence\s*:\s*/i);

  const sourcesIndex = sourcesMatch?.index ?? -1;
  const confidenceIndex = confidenceMatch?.index ?? -1;

  const answerEnd = [sourcesIndex, confidenceIndex].filter((index) => index >= 0).sort((a, b) => a - b)[0] ?? normalized.length;
  const answerText = normalized.slice(0, answerEnd).trim();

  let sourcesText = '';
  if (sourcesIndex >= 0) {
    const sourcesStart = sourcesIndex + sourcesMatch![0].length;
    const sourcesEnd = confidenceIndex > sourcesIndex ? confidenceIndex : normalized.length;
    sourcesText = normalized.slice(sourcesStart, sourcesEnd).trim();
  }

  let confidenceText = '';
  if (confidenceIndex >= 0) {
    const confidenceStart = confidenceIndex + confidenceMatch![0].length;
    confidenceText = normalized.slice(confidenceStart).trim();
  }

  return { answerText, sourcesText, confidenceText };
}

function buildMentionPatterns(brandName: string, hostname: string): RegExp[] {
  const patterns = new Set<string>();
  const trimmedBrand = brandName.trim().toLowerCase();
  const compactBrand = trimmedBrand.replace(/\s+/g, ' ');

  if (compactBrand) {
    patterns.add(`\\b${escapeRegExp(compactBrand)}\\b`);
    const brandNoSpace = compactBrand.replace(/\s+/g, '');
    if (brandNoSpace && brandNoSpace !== compactBrand && brandNoSpace.length >= 4) {
      patterns.add(`\\b${escapeRegExp(brandNoSpace)}\\b`);
    }
  }

  if (hostname) {
    patterns.add(`\\b${escapeRegExp(hostname)}\\b`);
  }

  return Array.from(patterns, (pattern) => new RegExp(pattern, 'i'));
}

function hasDomainMentionInSources(sourcesText: string, hostname: string): boolean {
  if (!sourcesText.trim() || !hostname) {
    return false;
  }

  const sourceLines = sourcesText
    .split(/[,\n]+/)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);

  return sourceLines.some((line) => line === hostname || line.includes(hostname));
}

function containsNegativeMentionContext(responseLower: string, brandName: string, hostname: string): boolean {
  const negativePhrases = [
    'could not find',
    "couldn't find",
    'no results',
    'i could not find',
    "i couldn't find",
    'no information',
    'not found',
    'did not find',
    "didn't find",
    'unable to find',
    'could not verify',
    "couldn't verify",
    'unable to verify',
    'did not mention',
    "didn't mention",
    'not mentioned',
    'not recommending',
    'would not mention',
    'does not mention',
    'doesn\'t mention',
  ];

  const needles = [brandName.trim().toLowerCase(), hostname].filter(Boolean);
  return negativePhrases.some((phrase) =>
    needles.some((needle) =>
      responseLower.includes(`${phrase} ${needle}`) ||
      responseLower.includes(`${phrase} any ${needle}`) ||
      responseLower.includes(`${needle} ${phrase}`)
    )
  );
}

function extractExcerpt(response: string, mentionPatterns: RegExp[]): string {
  const sentences = splitSentences(response);

  for (let index = 0; index < sentences.length; index += 1) {
    const sentence = sentences[index];
    if (mentionPatterns.some((pattern) => pattern.test(sentence))) {
      const context = sentences.slice(index, index + 2).join(' ');
      return context.trim();
    }
  }

  return truncateForExcerpt(response, EXTENDED_FALLBACK_EXCERPT_LENGTH);
}

function detectFirstMentionPosition(response: string, mentionPatterns: RegExp[]): number {
  const sentences = splitSentences(response);

  for (let index = 0; index < sentences.length; index += 1) {
    if (mentionPatterns.some((pattern) => pattern.test(sentences[index]))) {
      return index + 1;
    }
  }

  return 0;
}

function isCommonCompetitorRootLabel(label: string): boolean {
  const common = new Set([
    'best', 'tools', 'guide', 'blog', 'docs', 'help', 'home', 'app', 'apps',
    'data', 'search', 'seo', 'ai', 'web', 'cloud', 'labs', 'news', 'media',
  ]);
  return common.has(label);
}

function findCompetitorMentions(response: string, competitorUrls: string[]): string[] {
  const seen = new Set<string>();
  const mentioned: string[] = [];

  for (const competitorUrl of competitorUrls) {
    const hostname = extractHostname(competitorUrl);
    const label = hostname.split('.')[0];
    const patterns = [
      new RegExp(`\\b${escapeRegExp(hostname)}\\b`, 'i'),
      ...(label && label.length >= 5 && !isCommonCompetitorRootLabel(label)
        ? [new RegExp(`\\b${escapeRegExp(label)}\\b`, 'i')]
        : []),
    ];

    const matched = patterns.some((pattern) => pattern.test(response));
    if (matched && !seen.has(competitorUrl)) {
      seen.add(competitorUrl);
      mentioned.push(competitorUrl);
    }
  }

  return mentioned;
}

function excerptHasSubstantiveSupport(excerpt: string, brandName: string, hostname: string): boolean {
  if (!excerpt || excerpt.length < MIN_SUBSTANTIVE_EXCERPT_LENGTH) {
    return false;
  }

  const lower = excerpt.toLowerCase();
  const brandLower = brandName.trim().toLowerCase();
  const hasBrand = brandLower ? lower.includes(brandLower) : false;
  const hasHost = hostname ? lower.includes(hostname) : false;

  if (!hasBrand && !hasHost) {
    return false;
  }

  const meaningfulVerbs = [
    'recommend', 'use', 'consider', 'choose', 'compare', 'prefer', 'include', 'mention',
    'cite', 'surface', 'rank', 'trust', 'highlight', 'works', 'useful', 'good', 'strong',
  ];

  return meaningfulVerbs.some((verb) => lower.includes(verb)) || excerpt.length >= 40;
}

function analyzeMention(
  response: string,
  brandName: string,
  url: string,
  competitorUrls: string[],
): MentionAnalysis {
  const normalizedResponse = response.trim();
  const lowerResponse = normalizedResponse.toLowerCase();
  const hostname = extractHostname(url);
  const mentionPatterns = buildMentionPatterns(brandName, hostname);
  const { answerText, sourcesText } = splitResponseSections(normalizedResponse);

  const hasAnswerMentionSignal = mentionPatterns.some((pattern) => pattern.test(answerText));
  const hasSourceMentionSignal = hasDomainMentionInSources(sourcesText, hostname);
  const hasNegativeContext = containsNegativeMentionContext(lowerResponse, brandName, hostname);
  const competitorsMentioned = findCompetitorMentions(answerText || normalizedResponse, competitorUrls);

  if (hasNegativeContext) {
    return {
      mentioned: false,
      position: 0,
      excerpt: truncateForExcerpt(answerText || normalizedResponse, DEFAULT_FALLBACK_EXCERPT_LENGTH),
      competitorsMentioned,
    };
  }

  const excerpt = extractExcerpt(answerText || normalizedResponse, mentionPatterns);
  const position = detectFirstMentionPosition(answerText || normalizedResponse, mentionPatterns);

  const hasSubstantiveAnswerSupport =
    hasAnswerMentionSignal && excerptHasSubstantiveSupport(excerpt, brandName, hostname);

  if (!hasSubstantiveAnswerSupport) {
    return {
      mentioned: false,
      position: 0,
      excerpt: truncateForExcerpt(answerText || normalizedResponse, DEFAULT_FALLBACK_EXCERPT_LENGTH),
      competitorsMentioned,
    };
  }

  const urlMatches = Array.from(excerpt.matchAll(/https?:\/\/[^\s)]+/g), (match) => match[0]);
  if (urlMatches.length > 0) {
    const competitorHosts = new Set(competitorUrls.map((competitorUrl) => extractHostname(competitorUrl)));
    const excerptContainsTargetLink = urlMatches.some((matchedUrl) => extractHostname(matchedUrl) === hostname);
    const excerptContainsKnownCompetitorLink = urlMatches.some((matchedUrl) => competitorHosts.has(extractHostname(matchedUrl)));

    if (!excerptContainsTargetLink && !excerptContainsKnownCompetitorLink && !hasSourceMentionSignal) {
      return {
        mentioned: false,
        position: 0,
        excerpt: truncateForExcerpt(answerText || normalizedResponse, EXTENDED_FALLBACK_EXCERPT_LENGTH),
        competitorsMentioned,
      };
    }
  }

  return {
    mentioned: true,
    position,
    excerpt,
    competitorsMentioned,
  };
}

async function callGeminiDirect(query: string): Promise<GeminiDirectResult> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const model = 'gemini-2.5-flash';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const prompt = buildCitationPrompt(query, 'google_ai');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }],
        }],
        generationConfig: {
          maxOutputTokens: MODEL_MAX_TOKENS,
          temperature: 0.3,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Gemini API ${response.status}: ${body.slice(0, 200)}`);
    }

    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };

    const content = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim() ?? '';
    if (!content) {
      throw new Error('Empty response from Gemini');
    }

    return { content, model: `google/${model}` };
  } catch (error: unknown) {
    if (isAbortError(error)) {
      throw new Error(`Gemini API request timed out after ${GEMINI_TIMEOUT_MS}ms`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function testQueryCitations(
  config: CitationTestConfig,
  apiKey: string,
): Promise<CitationTestResult> {
  const platforms = config.platforms ?? DEFAULT_PLATFORMS;
  const competitorUrls = config.competitorUrls ?? [];
  const results: AICitationResult[] = [];

  const webSearchPromise = checkWebSearchPresence(config.query, config.brandName, config.url, competitorUrls)
    .catch((error: unknown) => {
      console.warn(`[CitationTester] DDG Web Search failed: ${toErrorMessage(error)}`);
      return null;
    });

  const bingPromise = checkBingSearchPresence(config.query, config.brandName, config.url, competitorUrls)
    .catch((error: unknown) => {
      console.warn(`[CitationTester] Bing Web Search failed: ${toErrorMessage(error)}`);
      return null;
    });

  const ddgPromise = checkDDGPresence(config.query, config.brandName, config.url, competitorUrls)
    .catch((error: unknown) => {
      console.warn(`[CitationTester] DuckDuckGo Instant failed: ${toErrorMessage(error)}`);
      return null;
    });

  const bravePromise = checkBraveSearchPresence(config.query, config.brandName, config.url, competitorUrls)
    .catch((error: unknown) => {
      console.warn(`[CitationTester] Brave Web Search failed: ${toErrorMessage(error)}`);
      return null;
    });

  const wikiPromise = checkWikipediaPresence(config.query, config.brandName, config.url, competitorUrls)
    .catch((error: unknown) => {
      console.warn(`[CitationTester] Wikipedia Search failed: ${toErrorMessage(error)}`);
      return null;
    });

  const yahooPromise = checkYahooSearchPresence(config.query, config.brandName, config.url, competitorUrls)
    .catch((error: unknown) => {
      console.warn(`[CitationTester] Yahoo Web Search failed: ${toErrorMessage(error)}`);
      return null;
    });

  for (const platform of platforms) {
    try {
      const result = await testSinglePlatform(
        config.query,
        config.brandName,
        config.url,
        platform,
        competitorUrls,
        apiKey,
        config.entityContext,
      );
      results.push(result);
    } catch (error: unknown) {
      const rawMessage = toErrorMessage(error);
      console.error(`[CitationTester] Error testing ${platform}: ${rawMessage}`);
      // Sanitize error message — strip potential API keys or internal paths
      const safeMessage = rawMessage.length > 120 ? rawMessage.slice(0, 120) + '...' : rawMessage;
      const sanitized = safeMessage.replace(/sk-[a-zA-Z0-9_-]{10,}/g, '[key]').replace(/[A-Za-z]:\\[^\s]+/g, '[path]');
      results.push({
        id: `${Date.now()}_${platform}`,
        query: config.query,
        platform,
        mentioned: false,
        position: 0,
        excerpt: `Error: ${sanitized}`,
        competitors_mentioned: [],
        created_at: new Date().toISOString(),
      });
    }
  }

  const [webSearchResult, bingResult, ddgResult, braveResult, wikiResult, yahooResult] = await Promise.all([
    webSearchPromise,
    bingPromise,
    ddgPromise,
    bravePromise,
    wikiPromise,
    yahooPromise,
  ]);

  return {
    query: config.query,
    results,
    tested_at: new Date().toISOString(),
    web_search: webSearchResult ?? undefined,
    bing_search: bingResult ?? undefined,
    ddg_search: ddgResult ?? undefined,
    brave_search: braveResult ?? undefined,
    wikipedia_search: wikiResult ?? undefined,
    yahoo_search: yahooResult ?? undefined,
  };
}

async function testSinglePlatform(
  query: string,
  brandName: string,
  url: string,
  platform: CitationPlatform,
  competitorUrls: string[],
  apiKey: string,
  entityContext?: { brandName?: string; domain?: string; description?: string; niche?: string },
): Promise<AICitationResult> {
  if (platform === 'google_ai' && getGeminiApiKey()) {
    try {
      const direct = await callGeminiDirect(query);
      const analysis = analyzeMention(direct.content, brandName, url, competitorUrls);

      console.log(
        `[CitationTester] Gemini DIRECT: query="${query.slice(0, 60)}", mentioned=${analysis.mentioned}`,
      );

      return {
        id: `${Date.now()}_${platform}`,
        query,
        platform,
        mentioned: analysis.mentioned,
        position: analysis.mentioned ? Math.max(analysis.position, 1) : 0,
        excerpt: analysis.excerpt,
        competitors_mentioned: analysis.competitorsMentioned,
        created_at: new Date().toISOString(),
        model_used: direct.model,
        model_short: modelShortName(direct.model),
        model_role: 'primary',
        source_type: 'direct',
      };
    } catch (error: unknown) {
      console.warn(
        `[CitationTester] Gemini direct failed: ${toErrorMessage(error)}. Falling back to OpenRouter proxy.`,
      );
    }
  }

  const candidates = PLATFORM_MODEL_CANDIDATES[platform];
  if (!candidates?.length) {
    throw new Error(`Unknown platform: ${platform}`);
  }

  const prompt = buildCitationPrompt(query, platform, entityContext);
  let lastError: Error | null = null;
  let response = '';
  let usedModel = '';
  let usedModelRole: ModelRole = 'primary';

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    try {
      response = await callAIProvider({
        provider: candidate.provider,
        model: candidate.model,
        prompt,
        apiKey,
        endpoint: candidate.endpoint,
        opts: {
          max_tokens: MODEL_MAX_TOKENS,
          temperature: MODEL_TEMPERATURE,
          responseFormat: 'text',
          systemPrompt: PLATFORM_SYSTEM_PROMPTS[platform] ??
            'You are an answer engine. Respond in plain text and answer the user query directly. Never ask for more input or URLs.',
        },
      });

      const providerError = extractProviderErrorPayload(response);
      if (providerError) {
        throw new Error(`Model returned non-answer payload: ${providerError}`);
      }

      if (!response.trim()) {
        throw new Error('Empty response from AI platform');
      }

      usedModel = candidate.model;
      usedModelRole = index === 0 ? 'primary' : 'fallback';
      break;
    } catch (error: unknown) {
      const message = toErrorMessage(error);
      lastError = new Error(message);
      console.warn(
        `[CitationTester] ${platform} model ${candidate.model} failed: ${message}. Trying next fallback model.`,
      );
    }
  }

  if (!response) {
    throw lastError ?? new Error('All fallback models failed');
  }

  const analysis = analyzeMention(response, brandName, url, competitorUrls);

  return {
    id: `${Date.now()}_${platform}`,
    query,
    platform,
    mentioned: analysis.mentioned,
    position: analysis.position,
    excerpt: analysis.excerpt,
    competitors_mentioned: analysis.competitorsMentioned,
    created_at: new Date().toISOString(),
    model_used: usedModel || undefined,
    model_short: usedModel ? modelShortName(usedModel) : undefined,
    model_role: usedModel ? usedModelRole : undefined,
    source_type: 'simulated',
  };
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function average(values: number[]): number {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

export async function testMultipleQueries(
  queries: string[],
  brandName: string,
  url: string,
  platforms: CitationPlatform[],
  competitorUrls: string[],
  apiKey: string,
  progressCallback?: (current: number, total: number) => void,
  entityContext?: { brandName?: string; domain?: string; description?: string; niche?: string },
): Promise<CitationTestResult[]> {
  const jobs = queries.map((query, index) => ({ query, index }));
  const orderedResults: Array<CitationTestResult | undefined> = new Array(queries.length);
  let completed = 0;

  const worker = async (): Promise<void> => {
    while (jobs.length > 0) {
      const job = jobs.shift();
      if (!job) {
        break;
      }

      let result: CitationTestResult;
      try {
        result = await testQueryCitations(
          {
            query: job.query,
            brandName,
            url,
            platforms,
            competitorUrls,
            entityContext,
          },
          apiKey,
        );
      } catch (queryErr: unknown) {
        console.error(`[CitationTester] Query "${job.query.slice(0, 60)}" failed entirely: ${toErrorMessage(queryErr)}`);
        result = {
          query: job.query,
          results: platforms.map(p => ({
            id: `${Date.now()}_${p}`,
            query: job.query,
            platform: p,
            mentioned: false,
            position: 0,
            excerpt: `Error: query test failed`,
            competitors_mentioned: [],
            created_at: new Date().toISOString(),
          })),
          tested_at: new Date().toISOString(),
        };
      }

      orderedResults[job.index] = result;
      completed += 1;
      progressCallback?.(completed, queries.length);

      await new Promise((resolve) => setTimeout(resolve, INTER_QUERY_DELAY_MS));
    }
  };

  const workers = Array.from(
    { length: Math.min(WORKER_PARALLEL_LIMIT, queries.length) },
    () => worker(),
  );

  await Promise.all(workers);
  return orderedResults.filter(isPresent);
}

export function calculateCitationSummary(results: CitationTestResult[]): {
  total_queries: number;
  mention_rate: number;
  avg_position: number;
  platforms: Record<string, number>;
  web_search_found_rate?: number;
  web_search_avg_position?: number;
  bing_found_rate?: number;
  bing_avg_position?: number;
  ddg_found_rate?: number;
  ddg_avg_position?: number;
  wikipedia_found_rate?: number;
  wikipedia_avg_position?: number;
  brave_found_rate?: number;
  brave_avg_position?: number;
  yahoo_found_rate?: number;
  yahoo_avg_position?: number;
} {
  const allResults = results.flatMap((result) => result.results);
  const mentioned = allResults.filter((result) => result.mentioned);

  const platforms: Record<string, number> = {};
  for (const result of mentioned) {
    platforms[result.platform] = (platforms[result.platform] || 0) + 1;
  }

  const webSearchResults = results.map((result) => result.web_search).filter(isPresent);
  const webSearchFound = webSearchResults.filter((result) => result.found);

  const bingResults = results.map((result) => result.bing_search).filter(isPresent);
  const bingFound = bingResults.filter((result) => result.found);

  const ddgResults = results.map((result) => result.ddg_search).filter(isPresent);
  const ddgFound = ddgResults.filter((result) => result.found);

  const wikiResults = results.map((result) => (result as any).wikipedia_search).filter(isPresent);
  const wikiFound = wikiResults.filter((result: any) => result.found);

  const braveResults = results.map((result) => result.brave_search).filter(isPresent);
  const braveFound = braveResults.filter((result) => result.found);

  const yahooResults = results.map((result) => result.yahoo_search).filter(isPresent);
  const yahooFound = yahooResults.filter((result) => result.found);

  const mentionRate = allResults.length > 0 ? (mentioned.length / allResults.length) * 100 : 0;
  const avgPosition = average(mentioned.map((result) => result.position));
  const webSearchAvgPos = average(webSearchFound.map((result) => result.position));
  const bingAvgPos = average(bingFound.map((result) => result.position));
  const ddgAvgPos = average(ddgFound.map((result) => result.position));
  const wikiAvgPos = average(wikiFound.map((result: any) => result.position));
  const braveAvgPos = average(braveFound.map((result) => result.position));
  const yahooAvgPos = average(yahooFound.map((result) => result.position));

  return {
    total_queries: results.length,
    mention_rate: Math.round(mentionRate * 10) / 10,
    avg_position: Math.round(avgPosition * 10) / 10,
    platforms,
    ...(webSearchResults.length > 0 && {
      web_search_found_rate: Math.round((webSearchFound.length / webSearchResults.length) * 1000) / 10,
    }),
    ...(webSearchFound.length > 0 && {
      web_search_avg_position: Math.round(webSearchAvgPos * 10) / 10,
    }),
    ...(bingResults.length > 0 && {
      bing_found_rate: Math.round((bingFound.length / bingResults.length) * 1000) / 10,
    }),
    ...(bingFound.length > 0 && {
      bing_avg_position: Math.round(bingAvgPos * 10) / 10,
    }),
    ...(ddgResults.length > 0 && {
      ddg_found_rate: Math.round((ddgFound.length / ddgResults.length) * 1000) / 10,
    }),
    ...(ddgFound.length > 0 && {
      ddg_avg_position: Math.round(ddgAvgPos * 10) / 10,
    }),
    ...(wikiResults.length > 0 && {
      wikipedia_found_rate: Math.round((wikiFound.length / wikiResults.length) * 1000) / 10,
    }),
    ...(wikiFound.length > 0 && {
      wikipedia_avg_position: Math.round(wikiAvgPos * 10) / 10,
    }),
    ...(braveResults.length > 0 && {
      brave_found_rate: Math.round((braveFound.length / braveResults.length) * 1000) / 10,
    }),
    ...(braveFound.length > 0 && {
      brave_avg_position: Math.round(braveAvgPos * 10) / 10,
    }),
    ...(yahooResults.length > 0 && {
      yahoo_found_rate: Math.round((yahooFound.length / yahooResults.length) * 1000) / 10,
    }),
    ...(yahooFound.length > 0 && {
      yahoo_avg_position: Math.round(yahooAvgPos * 10) / 10,
    }),
  };
}
