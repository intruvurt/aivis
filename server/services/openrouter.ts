<<<<<<< Updated upstream
<<<<<<<< Updated upstream:server/services/openrouter.ts
<<<<<<< Updated upstream
<<<<<<<< Updated upstream:server/services/openrouter.ts
<<<<<<<< Updated upstream:server/services/openrouter.ts
import type { AnalysisResponse } from '../src/types'
import type { ScrapedData } from './scraper'
========
import type { AnalysisResponse } from '@/types'
import type { ScrapedData } from './scraper.ts'
>>>>>>>> Stashed changes:services/openrouter.ts
========
import type { AnalysisResponse } from '@/types'
import type { ScrapedData } from './scraper.ts'
>>>>>>>> Stashed changes:services/openrouter.ts

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function fetchWithTimeout(url, options, timeoutMs = 25_000) {
=======
import type { AnalysisResponse } from '../src/types'
import type { ScrapedData } from './scraper'
========
import type { AnalysisResponse } from '@/types'
import type { ScrapedData } from './scraper.ts'
>>>>>>>> Stashed changes:services/openrouter.ts

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

<<<<<<<< Updated upstream:server/services/openrouter.ts
=======
import type { AnalysisResponse } from '../src/types'
import type { ScrapedData } from './scraper'

function sleep(ms: number): Promise<void> {
  return new Promise((r: () => void) => setTimeout(r, ms))
}

>>>>>>> Stashed changes
interface FetchWithTimeoutOptions extends RequestInit {
  // You can extend this interface if you want to add custom fields later
}

async function fetchWithTimeout(
  url: string,
  options: FetchWithTimeoutOptions,
  timeoutMs: number = 25_000
): Promise<Response> {
<<<<<<< Updated upstream
>>>>>>> Stashed changes
========
async function fetchWithTimeout(url, options, timeoutMs = 25_000) {
>>>>>>>> Stashed changes:services/openrouter.ts
=======
>>>>>>> Stashed changes
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(id)
  }
}

function isRetryableStatus(status) {
  return status === 429 || (status >= 500 && status <= 599)
}

function isAbortError(err) {
  return (
    (err && typeof err === 'object' && err.name === 'AbortError') ||
    String(err?.message || err || '').toLowerCase().includes('abort')
  )
}

function parseRetryAfterMs(res) {
  const ra = res.headers?.get?.('retry-after')
  if (!ra) return null
  // retry-after can be seconds or a date; handle seconds
  const seconds = Number(ra)
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 30_000)
  return null
}

async function readErrorPayload(res) {
  const text = await res.text()
  try {
    const json = text ? JSON.parse(text) : null
    const msg = json?.error?.message || json?.message || json?.error || json?.detail || null
    return { text, json, msg }
  } catch {
    return { text, json: null, msg: text || null }
  }
}

/**
 * Gemini free via OpenRouter (server-side)
 * @param {string} prompt
 * @param {string} apiKey
 * @param {object} [opts]
 * @param {number} [opts.timeoutMs]
 * @param {number} [opts.maxAttempts]
 * @returns {Promise<string>}
 */
export async function geminiFreeViaOpenRouter(prompt: string, apiKey: string, opts: { timeoutMs?: number; maxAttempts?: number } = {}) {
  const timeoutMs = opts.timeoutMs ?? 25_000
  const maxAttempts = opts.maxAttempts ?? 3

  if (!apiKey) throw new Error('Missing OpenRouter API key.')

  const endpoint = 'https://openrouter.ai/api/v1/chat/completions'

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetchWithTimeout(
        endpoint,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://intruvurt.space',
            'X-Title': 'Intruvurt',
          },
          body: JSON.stringify({
            model: 'google/gemma-4-31b-it:free',
            messages: [{ role: 'user', content: String(prompt ?? '') }],
            temperature: 0.3,
            max_tokens: 1200,
          }),
        },
        timeoutMs
      )

      if (!res.ok) {
        const err = await readErrorPayload(res)

        // Retry 429/5xx with backoff (respect Retry-After if present)
        if (isRetryableStatus(res.status) && attempt < maxAttempts) {
          const retryAfterMs = parseRetryAfterMs(res)
          await sleep(retryAfterMs ?? 600 * attempt)
          continue
        }

        const detail = err.msg ? ` - ${err.msg}` : ''

        if (res.status === 401) {
          throw new Error(`OpenRouter 401 Unauthorized${detail}`)
        }
        if (res.status === 402) {
          throw new Error(`OpenRouter 402 Payment Required${detail}`)
        }
        if (res.status === 403) {
          throw new Error(`OpenRouter 403 Forbidden${detail}`)
        }
        if (res.status === 404) {
          throw new Error(`OpenRouter 404 Not Found${detail}`)
        }
        if (res.status === 429) {
          throw new Error(`OpenRouter 429 Rate Limited${detail}`)
        }

        throw new Error(`OpenRouter HTTP ${res.status}${detail}`)
      }

      const data = await res.json()
      const content = data?.choices?.[0]?.message?.content

      if (typeof content === 'string' && content.trim()) {
        return content
      }

      // Sometimes the provider returns tool calls / empty content.
      const finish = data?.choices?.[0]?.finish_reason
      throw new Error(
        `OpenRouter response had no message content (finish_reason=${finish || 'unknown'}).`
      )
    } catch (err) {
      // Retry timeouts/aborts
      if ((isAbortError(err) || String(err?.message || '').toLowerCase().includes('timeout')) && attempt < maxAttempts) {
        await sleep(600 * attempt)
        continue
      }
      throw err
    }
  }

  throw new Error('OpenRouter request failed after retries.')
}

const STOPWORDS = new Set([
  'the', 'and', 'with', 'for', 'that', 'this', 'from', 'your', 'you', 'are', 'was', 'were', 'has',
  'have', 'will', 'its', 'our', 'their', 'about', 'into', 'over', 'under', 'between', 'within',
  'https', 'http', 'www', 'com', 'org', 'net', 'app', 'site', 'page', 'home', 'blog', 'news', 'learn'
])

const CRYPTO_KEYWORDS = [
  'crypto', 'cryptocurrency', 'blockchain', 'token', 'tokens', 'wallet', 'staking', 'defi', 'dex',
  'nft', 'web3', 'airdrop', 'stablecoin', 'bridge', 'mint', 'chain', 'ledger', 'smart contract'
]

const ASSET_MAP = new Map([
  ['Bitcoin', ['bitcoin', 'btc']],
  ['Ethereum', ['ethereum', 'eth']],
  ['Solana', ['solana', 'sol']],
  ['USDT', ['usdt', 'tether']],
  ['USDC', ['usdc', 'usd coin']],
  ['BNB', ['bnb', 'binance coin']],
  ['Polygon', ['polygon', 'matic']],
  ['Avalanche', ['avalanche', 'avax']],
  ['Chainlink', ['chainlink', 'link']],
  ['Litecoin', ['litecoin', 'ltc']]
])

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function toArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : []
}

function unique<T>(value: T[]): T[] {
  return Array.from(new Set(value))
}

function normalizeText(value) {
  return String(value ?? '').trim()
}

function tokenize(text) {
  return normalizeText(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word && !STOPWORDS.has(word) && word.length > 2)
}

function extractKeywords(text, limit = 10) {
  const counts = new Map()
  for (const word of tokenize(text)) {
    counts.set(word, (counts.get(word) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word)
}

function extractWalletAddresses(text: string): string[] {
  const found = new Set<string>()
  const btc = text.match(/\b(?:bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}\b/g) || []
  const eth = text.match(/\b0x[a-fA-F0-9]{40}\b/g) || []
  for (const address of [...btc, ...eth]) {
    found.add(address)
  }
  return Array.from(found)
}

function detectCryptoSignals(text: string) {
  const lower = text.toLowerCase()
  const keywords = CRYPTO_KEYWORDS.filter(keyword => lower.includes(keyword))
  const detected_assets: string[] = []
  for (const [asset, terms] of ASSET_MAP.entries()) {
    if (terms.some(term => lower.includes(term))) detected_assets.push(asset)
  }
  const wallet_addresses = extractWalletAddresses(text)
  const has_crypto_signals = keywords.length > 0 || detected_assets.length > 0 || wallet_addresses.length > 0

  const summary = has_crypto_signals
    ? `Crypto-related signals detected: ${unique([...detected_assets, ...keywords]).slice(0, 6).join(', ')}.`
    : 'No explicit crypto, token, or blockchain signals found on the primary page content.'

  return {
    has_crypto_signals,
    summary,
    detected_assets: unique(detected_assets),
    keywords: unique(keywords),
    wallet_addresses,
    sentiment: 'neutral' as const,
    risk_notes: has_crypto_signals ? ['Verify regulatory disclosures for any token mentions.'] : []
  }
}

function buildFallbackRecommendations(scraped) {
  const recs = []
  if (!scraped.structured_data.has_organization_schema) {
    recs.push({
      priority: 'high',
      category: 'Schema',
      title: 'Add Organization schema markup',
      description: 'AI crawlers prioritize clear entity definitions. Add Organization schema to reinforce brand identity.',
      impact: 'Boost entity recognition across AI models',
      difficulty: 'medium',
      implementation: 'Add JSON-LD Organization schema to the homepage head section.'
    })
  }
  if (!scraped.has_proper_h1) {
    recs.push({
      priority: 'high',
      category: 'Content',
      title: 'Ensure exactly one descriptive H1',
      description: 'Multiple or missing H1 tags weaken AI understanding of page focus.',
      impact: 'Improved topical clarity for LLMs',
      difficulty: 'easy',
      implementation: 'Use one H1 that mirrors the primary topic and brand promise.'
    })
  }
  if (scraped.structured_data.json_ld_count === 0) {
    recs.push({
      priority: 'medium',
      category: 'Schema',
      title: 'Implement structured data',
      description: 'Structured data helps AI models surface your page as a trusted source.',
      impact: 'Higher likelihood of AI citation',
      difficulty: 'medium',
      implementation: 'Add JSON-LD for Organization, WebSite, and FAQPage where relevant.'
    })
  }
  if (scraped.word_count < 350) {
    recs.push({
      priority: 'medium',
      category: 'Content',
      title: 'Expand core content depth',
      description: 'Thin content reduces visibility in generative answers. Aim for richer coverage.',
      impact: 'More extractable facts for AI results',
      difficulty: 'medium',
      implementation: 'Add 2-3 subsections addressing common user questions.'
    })
  }
  if (recs.length === 0) {
    recs.push({
      priority: 'low',
      category: 'Optimization',
      title: 'Keep content freshness high',
      description: 'Regular updates maintain AI confidence in your information.',
      impact: 'Sustained visibility over time',
      difficulty: 'easy',
      implementation: 'Schedule monthly content refreshes for key pages.'
    })
  }
  return recs.slice(0, 6)
}

function buildFallbackAnalysis(targetUrl, scraped) {
  const https_enabled = targetUrl.startsWith('https://')
  let score = 45
  score += scraped.has_proper_h1 ? 12 : 0
  score += scraped.structured_data.json_ld_count > 0 ? 10 : 0
  score += scraped.structured_data.has_organization_schema ? 8 : 0
  score += scraped.structured_data.has_faq_schema ? 6 : 0
  score += scraped.word_count > 300 ? 6 : 0
  score += scraped.word_count > 800 ? 4 : 0
  score += scraped.response_time_ms < 2000 ? 5 : 0
  score -= scraped.response_time_ms > 8000 ? 5 : 0
  score = clamp(score, 20, 98)

  const basePlatform = {
    chatgpt: clamp(score + 2, 0, 100),
    perplexity: clamp(score - 4, 0, 100),
    google_ai: clamp(score + 6, 0, 100),
    claude: clamp(score - 1, 0, 100)
  }

  const textBlob = [
    scraped.title,
    scraped.description,
    ...scraped.headings.h1,
    ...scraped.headings.h2,
    ...scraped.headings.h3,
    ...Object.values(scraped.meta_tags),
    scraped.open_graph.title,
    scraped.open_graph.description
  ]
    .filter(Boolean)
    .join(' ')

  const topical_keywords = extractKeywords(textBlob, 8)
  const brand_entities = unique(
    [scraped.open_graph.site_name, scraped.title?.split('|')?.[0]]
      .map(normalizeText)
      .filter(Boolean)
  )

  const cryptoSignals = detectCryptoSignals(textBlob)

  const summary = `The page emphasizes ${topical_keywords.slice(0, 3).join(', ') || 'core brand content'} with ${scraped.word_count} words and ${scraped.structured_data.json_ld_count} structured data blocks.`

  const key_takeaways = [
    scraped.has_proper_h1 ? 'Clear H1 hierarchy detected.' : 'H1 hierarchy needs refinement.',
    scraped.structured_data.json_ld_count > 0
      ? `Structured data present (${scraped.structured_data.schema_types.join(', ') || 'JSON-LD'}).`
      : 'No structured data detected.',
    scraped.response_time_ms < 2500 ? 'Fast response time supports AI crawlability.' : 'Improve response time for faster AI ingestion.'
  ]

  return {
    visibility_score: score,
    ai_platform_scores: basePlatform,
    recommendations: buildFallbackRecommendations(scraped),
    schema_markup: {
      json_ld_count: scraped.structured_data.json_ld_count,
      has_organization_schema: scraped.structured_data.has_organization_schema,
      has_faq_schema: scraped.structured_data.has_faq_schema,
      schema_types: scraped.structured_data.schema_types
    },
    content_analysis: {
      word_count: scraped.word_count,
      headings: scraped.headings.counts,
      has_proper_h1: scraped.has_proper_h1,
      faq_count: scraped.faq_count
    },
    summary,
    key_takeaways,
    topical_keywords,
    brand_entities,
    domain_intelligence: {
      domain: new URL(targetUrl).hostname,
      page_title: scraped.title,
      page_description: scraped.description,
      canonical_url: scraped.canonical,
      language: scraped.language,
      robots: scraped.robots,
      primary_topics: topical_keywords
    },
    technical_signals: {
      response_time_ms: scraped.response_time_ms,
      status_code: scraped.status_code,
      content_length: scraped.content_length,
      image_count: scraped.image_count,
      link_count: scraped.link_count,
      https_enabled
    },
    crypto_intelligence: cryptoSignals,
    url: targetUrl,
    analyzed_at: new Date().toISOString()
  }
}

function parseJsonFromText(raw) {
  if (!raw) return null
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1) return null
  const candidate = raw.slice(start, end + 1)
  try {
    return JSON.parse(candidate)
  } catch {
    return null
  }
}

function normalizeRecommendations(recs) {
  if (!Array.isArray(recs)) return []
  return recs
    .map(rec => ({
      priority: rec.priority,
      category: rec.category,
      title: rec.title,
      description: rec.description,
      impact: rec.impact,
      difficulty: rec.difficulty,
      implementation: rec.implementation
    }))
    .filter(rec => rec.title && rec.description && rec.implementation)
}

function mergeCryptoSignals(base, ai) {
  if (!ai || typeof ai !== 'object') return base
  return {
    ...base,
    summary: normalizeText(ai.summary) || base.summary,
    detected_assets: unique([...base.detected_assets, ...toArray(ai.detected_assets)]),
    keywords: unique([...base.keywords, ...toArray(ai.keywords)]),
    wallet_addresses: unique([...base.wallet_addresses, ...toArray(ai.wallet_addresses)]),
    sentiment: ['positive', 'negative', 'neutral'].includes(ai.sentiment) ? ai.sentiment : base.sentiment,
    risk_notes: unique([...base.risk_notes, ...toArray(ai.risk_notes)])
  }
}

function mergeAnalysis(base, ai) {
  if (!ai || typeof ai !== 'object') return base

  const visibility_score = Number.isFinite(Number(ai.visibility_score))
    ? clamp(Number(ai.visibility_score), 0, 100)
    : base.visibility_score

  const ai_platform_scores = {
    chatgpt: Number.isFinite(Number(ai?.ai_platform_scores?.chatgpt))
      ? clamp(Number(ai.ai_platform_scores.chatgpt), 0, 100)
      : base.ai_platform_scores.chatgpt,
    perplexity: Number.isFinite(Number(ai?.ai_platform_scores?.perplexity))
      ? clamp(Number(ai.ai_platform_scores.perplexity), 0, 100)
      : base.ai_platform_scores.perplexity,
    google_ai: Number.isFinite(Number(ai?.ai_platform_scores?.google_ai))
      ? clamp(Number(ai.ai_platform_scores.google_ai), 0, 100)
      : base.ai_platform_scores.google_ai,
    claude: Number.isFinite(Number(ai?.ai_platform_scores?.claude))
      ? clamp(Number(ai.ai_platform_scores.claude), 0, 100)
      : base.ai_platform_scores.claude
  }

  const summary = normalizeText(ai.summary) || base.summary
  const key_takeaways = toArray(ai.key_takeaways).slice(0, 6)
  const topical_keywords = unique([...base.topical_keywords, ...toArray(ai.topical_keywords)]).slice(0, 12)
  const brand_entities = unique([...base.brand_entities, ...toArray(ai.brand_entities)]).slice(0, 8)
  const recommendations = normalizeRecommendations(ai.recommendations)

  return {
    ...base,
    visibility_score,
    ai_platform_scores,
    summary,
    key_takeaways: key_takeaways.length ? key_takeaways : base.key_takeaways,
    topical_keywords,
    brand_entities,
    recommendations: recommendations.length ? recommendations : base.recommendations,
    crypto_intelligence: mergeCryptoSignals(base.crypto_intelligence, ai.crypto_intelligence)
  }
}

/**
 * Legacy single-prompt analysis (deprecated - use analyzeUrlWithPipeline for new code)
 * Kept for backward compatibility
 */
export async function analyzeUrlWithOpenRouter(
  targetUrl: string,
  apiKey: string,
  scraped: ScrapedData
): Promise<AnalysisResponse> {
  const baseAnalysis = buildFallbackAnalysis(targetUrl, scraped)

  // Use the new pipeline if available, fall back to legacy
  try {
    const { runAnalysisPipeline, toLegacyFormat } = await import('./aiPipeline')
    const pipelineResult = await runAnalysisPipeline(targetUrl, scraped)
    const legacyResult = toLegacyFormat(pipelineResult, targetUrl)

    // Merge with base analysis to ensure all fields are present
    return {
      ...baseAnalysis,
      visibility_score: legacyResult.visibility_score as number,
      ai_platform_scores: legacyResult.ai_platform_scores as typeof baseAnalysis.ai_platform_scores,
      recommendations: (legacyResult.recommendations as any[]) || baseAnalysis.recommendations,
      summary: (legacyResult.summary as string) || baseAnalysis.summary,
      key_takeaways: (legacyResult.key_takeaways as string[]) || baseAnalysis.key_takeaways,
      analyzed_at: (legacyResult.analyzed_at as string) || baseAnalysis.analyzed_at,
    }
  } catch (pipelineErr) {
    console.warn('Pipeline analysis failed, using legacy fallback:', pipelineErr?.message || pipelineErr)
  }

  // Legacy fallback prompt (simplified - no longer the primary analysis method)
  const prompt = `You are an AI visibility analyst. Using the scraped page data, return JSON only.

Required JSON shape:
{
  "visibility_score": number (0-100),
  "ai_platform_scores": { "chatgpt": number, "perplexity": number, "google_ai": number, "claude": number },
  "summary": string,
  "key_takeaways": string[] (max 6),
  "topical_keywords": string[],
  "brand_entities": string[],
  "recommendations": [
    { "priority": "high"|"medium"|"low", "category": string, "title": string, "description": string, "impact": string, "difficulty": "easy"|"medium"|"hard", "implementation": string }
  ]
}

Page URL: ${targetUrl}
Title: ${scraped.title}
Description: ${scraped.description}
Word Count: ${scraped.word_count}
H1 Count: ${scraped.headings.counts.h1}
Schema Types: ${scraped.structured_data.schema_types.join(', ') || 'none'}
Headings: ${[...scraped.headings.h1, ...scraped.headings.h2].slice(0, 10).join(' | ')}
`

  try {
    const responseText = await geminiFreeViaOpenRouter(prompt, apiKey, { maxAttempts: 2, timeoutMs: 22000 })
    const parsed = parseJsonFromText(responseText)
    return mergeAnalysis(baseAnalysis, parsed)
  } catch (err) {
    console.warn('OpenRouter analysis fallback used:', err?.message || err)
    return baseAnalysis
  }
}

/**
 * New multi-stage pipeline analysis with evidence-based reasoning
 * Uses 5 specialized AI stages: Evidence Normalizer, Draft Analyzer, Critic, Validator, UI Explainer
 */
export async function analyzeUrlWithPipeline(
  targetUrl: string,
  scraped: ScrapedData
): Promise<{
  legacy: AnalysisResponse;
  pipeline: import('./aiPipeline').PipelineResult;
}> {
  const { runAnalysisPipeline, toLegacyFormat } = await import('./aiPipeline')

  const pipelineResult = await runAnalysisPipeline(targetUrl, scraped)
  const legacyResult = toLegacyFormat(pipelineResult, targetUrl)

  // Build full legacy response
  const baseAnalysis = buildFallbackAnalysis(targetUrl, scraped)
  const legacy: AnalysisResponse = {
    ...baseAnalysis,
    visibility_score: legacyResult.visibility_score as number,
    ai_platform_scores: legacyResult.ai_platform_scores as typeof baseAnalysis.ai_platform_scores,
    recommendations: (legacyResult.recommendations as any[]) || baseAnalysis.recommendations,
    summary: (legacyResult.summary as string) || baseAnalysis.summary,
    key_takeaways: (legacyResult.key_takeaways as string[]) || baseAnalysis.key_takeaways,
    analyzed_at: (legacyResult.analyzed_at as string) || baseAnalysis.analyzed_at,
  }

  return { legacy, pipeline: pipelineResult }
}
