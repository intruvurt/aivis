/**
 * Citation Ranking Engine
 *
 * Enterprise-grade niche competitive ranking detection:
 * - Asks multiple AI models to generate a Top 50/100 list for a given niche
 * - Detects where the target brand ranks in each list
 * - Tracks which model produced the ranking (primary vs fallback)
 * - Surfaces short-form model labels for display in the UI analysis report
 */

import { callAIProvider } from './aiProviders.js';
import { getPool } from './postgresql.js';
import type { NicheRankingEntry, NicheRankingResult, ModelShortName, ModelRole } from '../../../shared/types.js';

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

const MIN_LIST_ENTRIES = 5;
const MAX_LIST_ENTRIES = 200;
const MAX_BRAND_LENGTH = 120;
const TOP_LIST_LIMIT = 50;

// ─── Model short-name registry ──────────────────────────────────────────────

const MODEL_SHORT_NAME_MAP: Record<string, ModelShortName> = {
  // Current preferred models (synced with aiProviders.ts 2026-03-29)
  'openai/gpt-4.1': 'GPT-4.1',
  'openai/gpt-4.1-mini': 'GPT-4.1 Mini',
  'x-ai/grok-3': 'Grok 3',
  'x-ai/grok-3-mini': 'Grok 3 Mini',
  'google/gemini-2.5-flash': 'Gemini 2.5 Flash',
  'google/gemini-2.5-flash:free': 'Gemini 2.5 Flash',
  'mistralai/mistral-small-latest': 'Mistral Small',
  'deepseek/deepseek-chat-v3-0324': 'DeepSeek V3',
  'deepseek/deepseek-chat-v3-0324:free': 'DeepSeek V3',
  'deepseek/deepseek-r1': 'DeepSeek R1',
  'deepseek/deepseek-r1:free': 'DeepSeek R1',
  'meta-llama/llama-3.3-70b-instruct': 'Llama 3.3 70B',
  'meta-llama/llama-3.3-70b-instruct:free': 'Llama 3.3 70B',
  'meta-llama/llama-4-scout:free': 'Llama 4 Scout',
  'qwen/qwen3-32b': 'Qwen3 32B',
  'qwen/qwen3-32b:free': 'Qwen3 32B',
  // Anthropic models (validated on OpenRouter)
  'anthropic/claude-3.5-haiku': 'Claude 3.5 Haiku',
  'anthropic/claude-3.5-sonnet': 'Claude 3.5 Sonnet',
  'anthropic/claude-3-haiku': 'Claude 3 Haiku',
  // Legacy IDs (still valid on OpenRouter, kept for cache hits)
  'openai/gpt-4o': 'GPT-4o',
  'openai/gpt-4o-mini': 'GPT-4o Mini',
  'google/gemini-2.0-flash-exp': 'Gemini 2.0 Flash',
  'google/gemini-2.0-flash-001': 'Gemini 2.0 Flash',
  'google/gemma-3-27b-it': 'Gemma 3 27B',
  'google/gemma-3-27b-it:free': 'Gemma 3 27B',
  'mistralai/mistral-small-3.1-24b-instruct:free': 'Mistral Small 24B',
};

export function modelShortName(modelId: string): ModelShortName {
  return MODEL_SHORT_NAME_MAP[modelId] ?? modelId.split('/').pop()?.split(':')[0] ?? modelId;
}

// ─── Ranking model candidates (ordered: primary first, then fallbacks) ──────

// Synced with PROVIDERS chain in aiProviders.ts (2026-03-29)
const RANKING_MODEL_CHAIN: Array<{ model: string; role: ModelRole }> = [
  { model: 'openai/gpt-4.1-mini', role: 'primary' },
  { model: 'anthropic/claude-3.5-haiku', role: 'fallback' },
  { model: 'deepseek/deepseek-chat-v3-0324', role: 'fallback' },
  { model: 'google/gemini-2.5-flash', role: 'fallback' },
  { model: 'x-ai/grok-3-mini', role: 'fallback' },
  { model: 'meta-llama/llama-3.3-70b-instruct', role: 'fallback' },
  { model: 'mistralai/mistral-small-latest', role: 'fallback' },
];

// Citation verification model chain
// Synced with PROVIDERS chain in aiProviders.ts (2026-03-29)
const CITATION_VERIFY_CHAIN: Array<{ model: string; role: ModelRole; platform: string }> = [
  { model: 'openai/gpt-4.1-mini', role: 'primary', platform: 'chatgpt' },
  { model: 'anthropic/claude-3.5-haiku', role: 'primary', platform: 'claude' },
  { model: 'deepseek/deepseek-chat-v3-0324', role: 'primary', platform: 'perplexity' },
  { model: 'google/gemini-2.5-flash', role: 'fallback', platform: 'google_ai' },
];

// ─── Prompt builders ─────────────────────────────────────────────────────────

function buildTop50Prompt(niche: string, keywords: string[]): string {
  const nicheContext = keywords.length > 0
    ? `Niche context: ${keywords.slice(0, 8).join(', ')}.`
    : '';

  return `You are a senior market analyst. Generate a ranked list of the top ${TOP_LIST_LIMIT} most real, notable, and authoritative products, services, SaaS tools, or businesses in the niche "${niche}". ${nicheContext}

RULES:
- Rank from #1 to #${TOP_LIST_LIMIT}
- Use only the real brand or product name — no descriptions
- Format: one per line as "RANK. BRAND_NAME"
- Include real SaaS, companies, tools, and platforms only — no placeholders
- If the niche has fewer than ${TOP_LIST_LIMIT} notable entities, list all you can find
- Do not include commentary before or after the list

Begin the list now:`;
}

function buildRankCheckPrompt(brandName: string, niche: string, top50List: string): string {
  return `Below is a ranked list of the top ${TOP_LIST_LIMIT} brands in the "${niche}" niche.

LIST:
${top50List.slice(0, 4000)}

TASK: Is "${brandName}" present in this list? If yes, at what rank?
Reply with ONLY this JSON (no explanation, no markdown):
{"found": true/false, "rank": NUMBER_OR_NULL, "matched_as": "EXACT_NAME_OR_NULL"}`;
}

function buildCitationVerifyPrompt(brandName: string, niche: string, keywords: string[]): string {
  const nicheContext = keywords.length > 0
    ? `Niche context: ${keywords.slice(0, 8).join(', ')}.`
    : '';

  return `Answer this user question as an answer engine would:

"What are the best ${niche} tools? Does ${brandName} appear among the top recommendations?"

${nicheContext}

Rules:
- Give a direct answer first.
- If ${brandName} is not a strong recommendation, say so plainly.
- Do not force-include ${brandName}.
- End with a section exactly named "Sources considered:" and list domain names only.
- No markdown tables.`;
}

// ─── Parsing / matching helpers ─────────────────────────────────────────────

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeLoose(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function normalizeTight(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function tokenizeBrand(value: string): string[] {
  return normalizeLoose(value).split(/\s+/).filter(Boolean);
}

function isGenericToken(token: string): boolean {
  return token.length < 3 || [
    'ai', 'app', 'hq', 'io', 'co', 'inc', 'labs', 'lab', 'tools', 'tool', 'software',
    'platform', 'systems', 'group', 'agency', 'studio', 'blog', 'search', 'guide',
  ].includes(token);
}

function buildBrandMentionRegexes(targetBrand: string): RegExp[] {
  const loose = normalizeLoose(targetBrand);
  const tight = normalizeTight(targetBrand);
  const tokens = tokenizeBrand(targetBrand).filter((token) => !isGenericToken(token));

  const patterns = new Set<string>();

  if (loose) {
    patterns.add(`\\b${escapeRegex(loose).replace(/\s+/g, '\\s+')}\\b`);
    patterns.add(`\\b${escapeRegex(loose).replace(/\s+/g, '[-\\s]*')}\\b`);
  }

  if (tight && tight.length >= 4) {
    patterns.add(`\\b${escapeRegex(tight)}\\b`);
  }

  if (tokens.length >= 2) {
    patterns.add(`\\b${tokens.map(escapeRegex).join('[-\\s]+')}\\b`);
  }

  return Array.from(patterns).map((pattern) => new RegExp(pattern, 'i'));
}

function hasBrandMention(text: string, targetBrand: string): boolean {
  const subject = normalizeLoose(text);
  return buildBrandMentionRegexes(targetBrand).some((regex) => regex.test(subject));
}

function splitAnswerAndSources(response: string): { answer: string; sources: string } {
  const marker = /\bSources considered:\s*/i;
  const match = marker.exec(response);
  if (!match || match.index < 0) {
    return { answer: response.trim(), sources: '' };
  }

  const answer = response.slice(0, match.index).trim();
  const sources = response.slice(match.index + match[0].length).trim();
  return { answer, sources };
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function safeErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function safeJsonParse<T>(text: string): T | null {
  const trim = text.trim();
  try {
    return JSON.parse(trim) as T;
  } catch {
    const start = trim.indexOf('{');
    const end = trim.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(trim.slice(start, end + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function safeParseJsonArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

function parseNumberedList(text: string): Array<{ rank: number; brand: string }> {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const entries: Array<{ rank: number; brand: string }> = [];
  const rankLineRe = /^(\d{1,3})[.)\-:]\s*(.+)$/;

  for (const line of lines) {
    const m = line.match(rankLineRe);
    if (!m) continue;
    const rank = parseInt(m[1], 10);
    const brand = m[2]
      .replace(/\*\*/g, '')
      .replace(/\s+/g, ' ')
      .replace(/^["'`]+|["'`]+$/g, '')
      .trim();

    if (rank >= 1 && rank <= MAX_LIST_ENTRIES && brand.length >= 1 && brand.length <= MAX_BRAND_LENGTH) {
      entries.push({ rank, brand });
    }
  }

  const seen = new Set<number>();
  return entries.filter(({ rank }) => {
    if (seen.has(rank)) return false;
    seen.add(rank);
    return true;
  });
}

function brandMatchesTarget(brand: string, targetBrand: string): boolean {
  const brandLoose = normalizeLoose(brand);
  const targetLoose = normalizeLoose(targetBrand);
  const brandTight = normalizeTight(brand);
  const targetTight = normalizeTight(targetBrand);

  if (!brandLoose || !targetLoose || !brandTight || !targetTight) return false;
  if (brandTight === targetTight) return true;

  const brandTokens = tokenizeBrand(brand).filter((token) => !isGenericToken(token));
  const targetTokens = tokenizeBrand(targetBrand).filter((token) => !isGenericToken(token));

  if (brandTokens.length >= 2 && targetTokens.length >= 2) {
    return brandTokens.join(' ') === targetTokens.join(' ');
  }

  if (brandTokens.length === 1 && targetTokens.length === 1) {
    return brandTokens[0] === targetTokens[0] && brandTokens[0].length >= 4;
  }

  return false;
}

function hasNegativeMentionContext(answerText: string, brandName: string): boolean {
  const loose = normalizeLoose(brandName);
  if (!loose) return false;

  const patterns = [
    new RegExp(`\\b(?:not|never|does not|did not|would not|is not|isn't|was not|wasn't)\\s+mention(?:ed|s)?\\b.*\\b${escapeRegex(loose).replace(/\s+/g, '\\s+')}\\b`, 'i'),
    new RegExp(`\\b(?:could not|couldn't|cannot|can't|unable to|did not|does not)\\s+(?:find|verify|identify|recommend)\\b.*\\b${escapeRegex(loose).replace(/\s+/g, '\\s+')}\\b`, 'i'),
    new RegExp(`\\b${escapeRegex(loose).replace(/\s+/g, '\\s+')}\\b.*\\b(?:not recommended|not included|not listed|not mentioned|not found)\\b`, 'i'),
  ];

  return patterns.some((pattern) => pattern.test(answerText));
}

function findMentionPosition(answerText: string, brandName: string): number | null {
  const sentences = splitSentences(answerText);
  for (let i = 0; i < sentences.length; i++) {
    if (hasBrandMention(sentences[i], brandName)) {
      return i + 1;
    }
  }
  return null;
}

function parseSourceDomains(text: string): string[] {
  return text
    .split(/\r?\n|,/)
    .map((line) => line.trim().replace(/^[-*•]\s*/, '').replace(/^https?:\/\//i, '').replace(/\/.*$/, '').toLowerCase())
    .filter(Boolean);
}

function hasSubstantiveMention(answerText: string, brandName: string): boolean {
  if (!hasBrandMention(answerText, brandName)) return false;
  if (hasNegativeMentionContext(answerText, brandName)) return false;

  const sentences = splitSentences(answerText);
  const supportingSentence = sentences.find((sentence) => hasBrandMention(sentence, brandName));
  return Boolean(supportingSentence && supportingSentence.length >= 20);
}

// ─── Core ranking engine ─────────────────────────────────────────────────────

export interface RankingEngineInput {
  targetUrl: string;
  brandName: string;
  niche: string;
  nicheKeywords: string[];
  apiKey: string;
  userId?: string;
  scheduledJobId?: string;
}

/**
 * Generate the niche top-50 list using the model chain.
 * Returns the raw list text, which model was used, and its role.
 */
async function generateNicheList(
  niche: string,
  keywords: string[],
  apiKey: string
): Promise<{ text: string; model: string; role: ModelRole } | null> {
  const prompt = buildTop50Prompt(niche, keywords);

  for (const candidate of RANKING_MODEL_CHAIN) {
    try {
      const response = await callAIProvider({
        provider: 'openrouter',
        model: candidate.model,
        prompt,
        apiKey,
        endpoint: OPENROUTER_ENDPOINT,
        opts: {
          max_tokens: 2000,
          temperature: 0.2,
          responseFormat: 'text',
          timeoutMs: 25000,
          systemPrompt: 'You are a market analyst producing authoritative ranked competitor lists. Respond only with the numbered list.',
        },
      });

      if (!response || response.trim().length < 50) {
        throw new Error('Response too short');
      }

      const parsed = parseNumberedList(response);
      if (parsed.length < MIN_LIST_ENTRIES) {
        throw new Error(`Numbered list too short: ${parsed.length} entries`);
      }

      return { text: response, model: candidate.model, role: candidate.role };
    } catch (err: unknown) {
      console.warn(`[NicheRanking] ${candidate.model} failed: ${safeErrorMessage(err)}`);
      continue;
    }
  }

  return null;
}

/**
 * Check if the target brand appears in the top list, using the rank-check model chain.
 */
async function verifyBrandRank(
  brand: string,
  niche: string,
  top50Raw: string,
  apiKey: string
): Promise<{ found: boolean; rank: number | null; modelUsed: string; modelRole: ModelRole } | null> {
  const prompt = buildRankCheckPrompt(brand, niche, top50Raw);

  for (const candidate of RANKING_MODEL_CHAIN) {
    try {
      const response = await callAIProvider({
        provider: 'openrouter',
        model: candidate.model,
        prompt,
        apiKey,
        endpoint: OPENROUTER_ENDPOINT,
        opts: {
          max_tokens: 120,
          temperature: 0.0,
          responseFormat: 'json_object',
          timeoutMs: 15000,
          systemPrompt: 'You are a strict classifier. Reply only with the requested JSON object.',
        },
      });

      const parsed = safeJsonParse<{ found: boolean; rank: number | null; matched_as: string | null }>(response);
      if (parsed !== null && typeof parsed.found === 'boolean') {
        const validRank = typeof parsed.rank === 'number' && parsed.rank >= 1 && parsed.rank <= MAX_LIST_ENTRIES
          ? parsed.rank
          : null;

        return {
          found: parsed.found && validRank !== null,
          rank: validRank,
          modelUsed: candidate.model,
          modelRole: candidate.role,
        };
      }

      throw new Error('Invalid JSON response');
    } catch (err: unknown) {
      console.warn(`[NicheRanking:verify] ${candidate.model} failed: ${safeErrorMessage(err)}`);
      continue;
    }
  }

  return null;
}

/**
 * Run citation verification across multiple platforms to check whether each platform
 * cites the brand in context of the niche.
 */
async function runCitationVerification(
  brandName: string,
  niche: string,
  keywords: string[],
  apiKey: string
): Promise<NicheRankingResult['citation_models_used']> {
  const prompt = buildCitationVerifyPrompt(brandName, niche, keywords);
  const results: NicheRankingResult['citation_models_used'] = [];

  for (const candidate of CITATION_VERIFY_CHAIN) {
    try {
      const response = await callAIProvider({
        provider: 'openrouter',
        model: candidate.model,
        prompt,
        apiKey,
        endpoint: OPENROUTER_ENDPOINT,
        opts: {
          max_tokens: 500,
          temperature: 0.2,
          responseFormat: 'text',
          timeoutMs: 20000,
          systemPrompt: `You are a retrieval-faithful answer engine. Mention ${brandName} only if it is genuinely supported as a top recommendation for ${niche}.`,
        },
      });

      if (!response || response.trim().length < 30) {
        throw new Error('Response too short');
      }

      const { answer, sources } = splitAnswerAndSources(response);
      const mentionedInAnswer = hasSubstantiveMention(answer, brandName);
      const position = mentionedInAnswer ? findMentionPosition(answer, brandName) : null;

      const sourceDomains = parseSourceDomains(sources);
      const sourceEchoOnly = !mentionedInAnswer && sourceDomains.some((domain) => hasBrandMention(domain, brandName));

      results.push({
        platform: candidate.platform,
        model_id: candidate.model,
        model_short: modelShortName(candidate.model),
        role: candidate.role,
        mentioned: mentionedInAnswer && !sourceEchoOnly,
        position,
      });
    } catch (err: unknown) {
      console.warn(`[NicheRanking:cite] ${candidate.model}/${candidate.platform} failed: ${safeErrorMessage(err)}`);
      results.push({
        platform: candidate.platform,
        model_id: candidate.model,
        model_short: modelShortName(candidate.model),
        role: candidate.role,
        mentioned: false,
        position: null,
      });
    }
  }

  return results;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run the full niche ranking pipeline for a given target.
 * Returns a NicheRankingResult ready for storage + display.
 */
export async function runNicheRanking(input: RankingEngineInput): Promise<NicheRankingResult | null> {
  const { targetUrl, brandName, niche, nicheKeywords, apiKey, userId, scheduledJobId } = input;

  if (!brandName || !niche) {
    console.warn('[NicheRanking] Missing brandName or niche — skipping');
    return null;
  }

  console.log(`[NicheRanking] Starting: brand="${brandName}" niche="${niche}"`);

  const listResult = await generateNicheList(niche, nicheKeywords, apiKey);
  if (!listResult) {
    console.warn('[NicheRanking] All list-generation models failed');
    return null;
  }

  const parsedEntries = parseNumberedList(listResult.text);

  const buildEntries = (max: number): NicheRankingEntry[] =>
    parsedEntries
      .filter((e) => e.rank <= max)
      .map((e) => ({
        rank: e.rank,
        brand_name: e.brand,
        is_target: brandMatchesTarget(e.brand, brandName),
        citation_excerpt: undefined,
      }));

  const top50 = buildEntries(50);
  const top100 = buildEntries(100);

  let targetRank: number | null =
    parsedEntries.find((e) => brandMatchesTarget(e.brand, brandName))?.rank ?? null;

  if (targetRank === null) {
    const verification = await verifyBrandRank(brandName, niche, listResult.text, apiKey);
    if (verification?.found && verification.rank !== null) {
      targetRank = verification.rank;
    }
  }

  if (targetRank !== null) {
    [top50, top100].forEach((list) => {
      const entry = list.find((e) => e.rank === targetRank);
      if (entry) entry.is_target = true;
    });
  }

  const citationModelsUsed = await runCitationVerification(
    brandName,
    niche,
    nicheKeywords,
    apiKey
  );

  const ranAtIso = new Date().toISOString();

  const result: NicheRankingResult = {
    id: `niche_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    target_url: targetUrl,
    brand_name: brandName,
    niche,
    niche_keywords: nicheKeywords,
    target_rank: targetRank,
    in_top_50: targetRank !== null && targetRank <= 50,
    in_top_100: targetRank !== null && targetRank <= 100,
    top_50: top50,
    top_100: top100,
    ranking_model_id: listResult.model,
    ranking_model_short: modelShortName(listResult.model),
    ranking_model_role: listResult.role,
    citation_models_used: citationModelsUsed,
    ran_at: ranAtIso,
    scheduled_job_id: scheduledJobId,
  };

  try {
    const pool = getPool();
    await pool.query(
      `INSERT INTO citation_niche_rankings
        (id, user_id, target_url, brand_name, niche, niche_keywords, target_rank,
         in_top_50, in_top_100, top_50, top_100,
         ranking_model_id, ranking_model_short, ranking_model_role,
         citation_models_used, scheduled_job_id, ran_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       ON CONFLICT (id) DO NOTHING`,
      [
        result.id,
        userId ?? null,
        targetUrl,
        brandName,
        niche,
        nicheKeywords,
        targetRank,
        result.in_top_50,
        result.in_top_100,
        JSON.stringify(top50),
        JSON.stringify(top100),
        listResult.model,
        modelShortName(listResult.model),
        listResult.role,
        JSON.stringify(citationModelsUsed),
        scheduledJobId ?? null,
        ranAtIso,
      ]
    );
  } catch (err: unknown) {
    console.warn('[NicheRanking] DB persist failed (non-fatal):', safeErrorMessage(err));
  }

  console.log(
    `[NicheRanking] Done: brand="${brandName}" rank=${targetRank ?? 'not ranked'} in_top_50=${result.in_top_50}`
  );

  return result;
}

/**
 * Fetch the most recent niche ranking result for a given URL from DB.
 */
export async function getLatestNicheRanking(
  userId: string,
  targetUrl: string
): Promise<NicheRankingResult | null> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT * FROM citation_niche_rankings
     WHERE user_id = $1 AND target_url = $2
     ORDER BY ran_at DESC
     LIMIT 1`,
    [userId, targetUrl]
  );
  if (!rows.length) return null;
  return dbRowToResult(rows[0]);
}

/**
 * Fetch a specific niche ranking by id.
 */
export async function getNicheRankingById(
  id: string,
  userId: string
): Promise<NicheRankingResult | null> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT * FROM citation_niche_rankings WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  if (!rows.length) return null;
  return dbRowToResult(rows[0]);
}

/**
 * List all niche rankings for a user (most recent first).
 */
export async function listNicheRankings(
  userId: string,
  limit = 20
): Promise<NicheRankingResult[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT * FROM citation_niche_rankings
     WHERE user_id = $1
     ORDER BY ran_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return rows.map(dbRowToResult);
}

function dbRowToResult(row: Record<string, unknown>): NicheRankingResult {
  return {
    id: String(row.id ?? ''),
    target_url: String(row.target_url ?? ''),
    brand_name: String(row.brand_name ?? ''),
    niche: String(row.niche ?? ''),
    niche_keywords: safeParseJsonArray<string>(row.niche_keywords),
    target_rank: typeof row.target_rank === 'number' ? row.target_rank : null,
    in_top_50: Boolean(row.in_top_50),
    in_top_100: Boolean(row.in_top_100),
    top_50: safeParseJsonArray<NicheRankingEntry>(row.top_50),
    top_100: safeParseJsonArray<NicheRankingEntry>(row.top_100),
    ranking_model_id: String(row.ranking_model_id ?? ''),
    ranking_model_short: (row.ranking_model_short ?? '') as ModelShortName,
    ranking_model_role: (row.ranking_model_role ?? 'primary') as ModelRole,
    citation_models_used: safeParseJsonArray<NonNullable<NicheRankingResult['citation_models_used']>[number]>(row.citation_models_used),
    ran_at: row.ran_at instanceof Date ? row.ran_at.toISOString() : String(row.ran_at ?? ''),
    scheduled_job_id: typeof row.scheduled_job_id === 'string' ? row.scheduled_job_id : undefined,
  };
}
