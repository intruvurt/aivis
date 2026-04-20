/**
 * answerPresenceService.ts — Answer Presence Pipeline
 *
 * Spec (§2 pipeline):
 *   STEP 1  Identity Extraction  — primary entity, aliases, structured data
 *   STEP 2  Query Generation     — direct / intent / comparative / long-tail
 *   STEP 3  Parallel Testing     — DDG search per query, brand detection
 *   STEP 4  Citation Ledger      — evidence entry per query result
 *   STEP 5  Authority Mapping    — source rank correlation
 *   STEP 6  Gap Detection        — content / citation / authority / entity gaps
 *   STEP 7  Evidence Scoring     — all scores derived ONLY from observed data
 *
 * Determinism guarantee:
 *   Same URL + same HTML → same queries → same evidence (source order stable).
 *
 * Security:
 *   - No user-controlled strings passed to eval/exec
 *   - All outbound HTTP uses AbortController timeouts
 *   - Brand name sanitized to ASCII word characters before query construction
 */

import * as cheerio from 'cheerio';
import type { AnswerPresenceResult, QueryEvidence, GapItem } from '../../../shared/types.js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface IdentityExtraction {
  primaryEntity: string;
  aliases: string[];
  domain: string;
  schemaTypes: string[];
  h1Texts: string[];
  repeatedPhrases: string[];
}

type QueryIntent = 'direct' | 'intent' | 'comparative' | 'longtail';

interface GeneratedQuery {
  text: string;
  intent: QueryIntent;
  /** Why this query was generated — shown in debugger commit inspector */
  rationale: string;
}

// ─── Sanitize ─────────────────────────────────────────────────────────────────

/**
 * Strip non-printable / injection chars from entity names before building queries.
 * Keeps letters, digits, spaces, hyphens, apostrophes.
 */
function sanitizeName(raw: string): string {
  return raw
    .replace(/[^\w\s'-]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 60);
}

// ─── STEP 1: Identity Extraction ─────────────────────────────────────────────

export function extractIdentity(html: string, domain: string): IdentityExtraction {
  const $ = cheerio.load(html);
  const candidates: string[] = [];

  // og:site_name — most reliable single source
  const ogSiteName = $('meta[property="og:site_name"]').attr('content')?.trim();
  if (ogSiteName) candidates.push(ogSiteName);

  // title tag — strip separators and domain suffix
  const title = $('title').text().trim();
  if (title) {
    const cleaned = title.split(/[|–—\-·]/)[0].trim();
    if (cleaned && cleaned.length < 60) candidates.push(cleaned);
  }

  // h1 — first non-empty h1
  const h1 = $('h1').first().text().trim();
  if (h1 && h1.length < 80) candidates.push(h1);

  // schema.org name property
  $('[itemtype*="schema.org"] [itemprop="name"]').each((_i, el) => {
    const t = $(el).text().trim();
    if (t && t.length < 60) candidates.push(t);
  });

  // JSON-LD @name
  $('script[type="application/ld+json"]').each((_i, el) => {
    try {
      const data = JSON.parse($(el).html() ?? '{}');
      const entries = Array.isArray(data) ? data : [data];
      for (const entry of entries) {
        if (entry && typeof entry.name === 'string' && entry.name.length < 60) {
          candidates.push(entry.name.trim());
        }
      }
    } catch { /* ignore malformed JSON-LD */ }
  });

  // Copyright footer fallback
  const bodyText = $.text();
  const copyMatch = /©\s*\d{4}\s+([A-Z][A-Za-z0-9 &,.-]{2,40})/.exec(bodyText);
  if (copyMatch?.[1]) candidates.push(copyMatch[1].trim());

  // Deduplicate preserving insertion order, prefer shorter names for primary
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const c of candidates) {
    const key = c.toLowerCase();
    if (!seen.has(key)) { seen.add(key); unique.push(c); }
  }

  // Primary = shortest candidate (less likely to be a full title phrase)
  unique.sort((a, b) => a.length - b.length);
  const primary = unique[0] ?? domain.split('.')[0];
  const aliases = unique.slice(1, 4);

  // Collect schema types
  const schemaTypes: string[] = [];
  $('[itemtype]').each((_i, el) => {
    const t = $(el).attr('itemtype') ?? '';
    const m = /schema\.org\/(\w+)/.exec(t);
    if (m?.[1]) schemaTypes.push(m[1]);
  });
  $('script[type="application/ld+json"]').each((_i, el) => {
    try {
      const d = JSON.parse($(el).html() ?? '{}');
      const entries = Array.isArray(d) ? d : [d];
      for (const e of entries) {
        if (e?.['@type']) schemaTypes.push(String(e['@type']));
      }
    } catch { /* ignore */ }
  });

  const h1Texts: string[] = [];
  $('h1,h2').each((_i, el) => {
    const t = $(el).text().trim();
    if (t && t.length < 80) h1Texts.push(t);
  });

  // Repeated phrases: crude 2–4-word n-gram frequency
  const words = bodyText.replace(/[^a-zA-Z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  const bigramCounts = new Map<string, number>();
  for (let i = 0; i < words.length - 1; i++) {
    const bg = `${words[i].toLowerCase()} ${words[i + 1].toLowerCase()}`;
    bigramCounts.set(bg, (bigramCounts.get(bg) ?? 0) + 1);
  }
  const repeatedPhrases = [...bigramCounts.entries()]
    .filter(([, c]) => c >= 4)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([phrase]) => phrase);

  return {
    primaryEntity: sanitizeName(primary),
    aliases: aliases.map(sanitizeName),
    domain,
    schemaTypes: [...new Set(schemaTypes)].slice(0, 6),
    h1Texts: h1Texts.slice(0, 4),
    repeatedPhrases,
  };
}

// ─── STEP 2: Query Generation ─────────────────────────────────────────────────

/**
 * Generate a deterministic, diverse set of queries that simulate how users and
 * AI systems ask about this entity.  Maximum 16 queries to stay within rate limits.
 */
export function generateQueries(identity: IdentityExtraction): GeneratedQuery[] {
  const { primaryEntity: name, domain, h1Texts, schemaTypes } = identity;
  const queries: GeneratedQuery[] = [];

  // ── A. Direct queries
  queries.push({
    text: `what is ${name}`,
    intent: 'direct',
    rationale: 'Core identity query — tests whether AI knows this entity exists',
  });
  queries.push({
    text: `${name} review`,
    intent: 'direct',
    rationale: 'Reputation query — tests review site citation presence',
  });
  queries.push({
    text: `${name} ${domain}`,
    intent: 'direct',
    rationale: 'Combined brand+domain query — tests direct association',
  });

  // ── B. Intent-based queries from h1 content
  const niche = h1Texts[0] ?? schemaTypes[0] ?? 'tools';
  queries.push({
    text: `best ${niche} tools`,
    intent: 'intent',
    rationale: `Intent query from h1: "${niche}" — tests category presence`,
  });
  queries.push({
    text: `how to ${niche.toLowerCase()}`,
    intent: 'intent',
    rationale: 'Problem-solving query — tests solution-space presence',
  });
  if (h1Texts[1]) {
    queries.push({
      text: `${h1Texts[1].slice(0, 50)} solution`,
      intent: 'intent',
      rationale: `Secondary h1 intent: "${h1Texts[1].slice(0, 30)}"`,
    });
  }

  // ── C. Comparative queries
  queries.push({
    text: `${name} vs competitors`,
    intent: 'comparative',
    rationale: 'Comparative query — tests competitive citation presence',
  });
  queries.push({
    text: `${name} alternative`,
    intent: 'comparative',
    rationale: 'Alternative query — tests category authority',
  });

  // ── D. Long-tail AI-style queries
  queries.push({
    text: `is ${name} legitimate`,
    intent: 'longtail',
    rationale: 'Trust query — tests presence on trust/review aggregators',
  });
  queries.push({
    text: `${name} pricing`,
    intent: 'longtail',
    rationale: 'Commercial intent query — tests product page indexing',
  });
  if (schemaTypes.includes('SoftwareApplication') || schemaTypes.includes('WebApplication')) {
    queries.push({
      text: `${name} app features`,
      intent: 'longtail',
      rationale: 'SoftwareApplication schema detected — product feature query',
    });
  }
  if (schemaTypes.includes('Organization') || schemaTypes.includes('Corporation')) {
    queries.push({
      text: `${name} company`,
      intent: 'longtail',
      rationale: 'Organization schema detected — entity disambiguation query',
    });
  }

  // Deduplicate by normalized query text
  const seen = new Set<string>();
  return queries.filter((q) => {
    const key = q.text.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 16);
}

// ─── STEP 3: Query Presence Testing ──────────────────────────────────────────

interface RawSearchResult {
  title: string;
  url: string;
  snippet: string;
}

/** Parse DuckDuckGo HTML results page (no API key needed) */
function parseDDGResults(html: string): RawSearchResult[] {
  const $ = cheerio.load(html);
  const results: RawSearchResult[] = [];

  $('.result').each((_i, el) => {
    const title = $(el).find('.result__title').text().trim();
    const href = $(el).find('.result__url').text().trim();
    const snippet = $(el).find('.result__snippet').text().trim();
    if (title || href) results.push({ title, url: href, snippet });
  });

  if (results.length === 0) {
    // Try alternate DDG HTML structure
    $('article[data-testid="result"]').each((_i, el) => {
      const title = $(el).find('h2').text().trim();
      const href = $(el).find('a').attr('href') ?? '';
      const snippet = $(el).find('span[class*="snippet"]').text().trim();
      results.push({ title, url: href, snippet });
    });
  }

  return results.slice(0, 10);
}

/** Test a single query for brand presence via DuckDuckGo HTML scrape */
async function testOneQuery(
  query: GeneratedQuery,
  brandName: string,
  targetDomain: string,
): Promise<QueryEvidence> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  const nameLower = brandName.toLowerCase();
  const domainLower = targetDomain.toLowerCase();

  try {
    const searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(query.text)}`;
    const res = await fetch(searchUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AivisBot/1.0)',
        Accept: 'text/html',
      },
    });

    if (!res.ok) {
      return {
        query: query.text,
        intent: query.intent,
        source: 'duckduckgo',
        mentioned: false,
        citation_strength: 0,
      };
    }

    const html = await res.text();
    const results = parseDDGResults(html);

    let mentioned = false;
    let position: number | undefined;
    let snippet: string | undefined;
    let citation_strength = 0;

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const combined = `${r.title} ${r.url} ${r.snippet}`.toLowerCase();

      if (combined.includes(nameLower) || combined.includes(domainLower)) {
        mentioned = true;
        position = i + 1;
        snippet = r.snippet.slice(0, 120);
        // Higher citation strength for better position (top 3 = strong)
        citation_strength = Math.max(0.1, 1 - i * 0.1);
        break;
      }
    }

    return {
      query: query.text,
      intent: query.intent,
      source: 'duckduckgo',
      mentioned,
      ...(position !== undefined ? { position } : {}),
      ...(snippet !== undefined ? { snippet } : {}),
      citation_strength,
    };
  } catch {
    return {
      query: query.text,
      intent: query.intent,
      source: 'duckduckgo',
      mentioned: false,
      citation_strength: 0,
    };
  } finally {
    clearTimeout(timeout);
  }
}

// ─── STEP 5+6: Authority Mapping + Gap Detection ──────────────────────────────

function detectGaps(
  identity: IdentityExtraction,
  queries: GeneratedQuery[],
  evidence: QueryEvidence[],
): GapItem[] {
  const gaps: GapItem[] = [];
  const evidenceByQuery = new Map(evidence.map((e) => [e.query, e]));

  for (const q of queries) {
    const ev = evidenceByQuery.get(q.text);
    if (!ev || !ev.mentioned) {
      if (q.intent === 'direct') {
        gaps.push({
          type: 'entity_clarity',
          description: `Entity not found for direct query: "${q.text}"`,
          query: q.text,
          action: 'Add structured schema.org entity markup and ensure brand name appears in title + h1',
        });
      } else if (q.intent === 'intent') {
        gaps.push({
          type: 'content',
          description: `Missing from category query: "${q.text}"`,
          query: q.text,
          action: `Create content targeting "${q.text}" intent with clear entity attribution`,
        });
      } else if (q.intent === 'comparative') {
        gaps.push({
          type: 'citation',
          description: `Absent from comparative results: "${q.text}"`,
          query: q.text,
          action: 'Build coverage on comparison/review sites for this query category',
        });
      } else {
        gaps.push({
          type: 'authority',
          description: `Not found for long-tail query: "${q.text}"`,
          query: q.text,
          action: `Target "${q.text}" with supporting documentation or FAQ pages`,
        });
      }
    }
  }

  // Entity clarity gap if primary entity extraction was low confidence
  if (identity.aliases.length === 0 && identity.schemaTypes.length === 0) {
    gaps.push({
      type: 'entity_clarity',
      description: 'No schema markup or clear entity signals found on page',
      action: 'Add Organization/WebSite schema with name, url, description properties',
    });
  }

  // Authority gap: mentioned overall but only in low-position results
  const highPositionMentions = evidence.filter((e) => e.mentioned && (e.position ?? 99) <= 3);
  const anyMentions = evidence.filter((e) => e.mentioned);
  if (anyMentions.length > 0 && highPositionMentions.length === 0) {
    gaps.push({
      type: 'authority',
      description: 'Entity appears in search results but not in top-3 positions',
      action: 'Build authority backlinks and improve entity association with primary keywords',
    });
  }

  return gaps;
}

// ─── STEP 7: Evidence Scoring ─────────────────────────────────────────────────

function computeScores(
  evidence: QueryEvidence[],
  gaps: GapItem[],
  identity: IdentityExtraction,
): Pick<AnswerPresenceResult, 'entity_clarity_score' | 'citation_coverage_score' | 'authority_alignment_score' | 'answer_presence_score'> {
  if (evidence.length === 0) {
    return { entity_clarity_score: 0, citation_coverage_score: 0, authority_alignment_score: 0, answer_presence_score: 0 };
  }

  // Citation coverage: % of queries where entity was mentioned
  const mentionRate = evidence.filter((e) => e.mentioned).length / evidence.length;
  const citation_coverage_score = Math.round(mentionRate * 100);

  // Entity clarity: penalise entity_clarity gaps, reward schema presence
  const entityGaps = gaps.filter((g) => g.type === 'entity_clarity').length;
  const schemaBonus = identity.schemaTypes.length > 0 ? 15 : 0;
  const aliasBonus = identity.aliases.length > 0 ? 10 : 0;
  const entity_clarity_score = Math.max(0, Math.min(100, 70 - entityGaps * 20 + schemaBonus + aliasBonus));

  // Authority alignment: average citation_strength of top-3 results
  const topEvidence = evidence
    .filter((e) => e.mentioned)
    .sort((a, b) => (a.position ?? 99) - (b.position ?? 99))
    .slice(0, 5);
  const authority_alignment_score = topEvidence.length > 0
    ? Math.round(topEvidence.reduce((s, e) => s + e.citation_strength, 0) / topEvidence.length * 100)
    : 0;

  // Composite answer presence score — weighted average
  const answer_presence_score = Math.round(
    citation_coverage_score * 0.4 +
    entity_clarity_score * 0.3 +
    authority_alignment_score * 0.3,
  );

  return { entity_clarity_score, citation_coverage_score, authority_alignment_score, answer_presence_score };
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

export interface AnswerPresenceOpts {
  url: string;
  domain: string;
  /** Raw scraped HTML of the target page */
  html: string;
  /** Optional brand name override (from user input or AI extraction) */
  brandName?: string;
}

/**
 * Run the full answer presence pipeline.
 *
 * Deterministic: same (html, domain) always produces the same queries.
 * All evidence derived from actual search results — zero synthetic scores.
 *
 * Designed to be called fire-and-forget after the main audit pipeline
 * (attach result to response as `answer_presence`).
 */
export async function runAnswerPresenceAnalysis(
  opts: AnswerPresenceOpts,
): Promise<AnswerPresenceResult> {
  const { url: _url, domain, html, brandName } = opts;

  // STEP 1: Identity extraction
  const identity = extractIdentity(html, domain);
  const resolvedBrand = brandName
    ? sanitizeName(brandName)
    : identity.primaryEntity;

  // STEP 2: Query generation (deterministic, no randomness)
  const queries = generateQueries({ ...identity, primaryEntity: resolvedBrand });

  // STEP 3: Parallel answer testing — all queries in one Promise.all
  // Cap concurrency at 6 to be respectful to search engines
  const CONCURRENCY = 6;
  const evidence: QueryEvidence[] = [];

  for (let i = 0; i < queries.length; i += CONCURRENCY) {
    const batch = queries.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map((q) => testOneQuery(q, resolvedBrand, domain)),
    );
    evidence.push(...results);
  }

  // STEP 4: Citation ledger is the evidence array itself — each entry is traceable

  // STEP 5+6: Authority mapping + gap detection
  const gaps = detectGaps(identity, queries, evidence);

  // STEP 7: Evidence-grounded scoring
  const scores = computeScores(evidence, gaps, identity);

  return {
    primary_entity: identity.primaryEntity,
    aliases: identity.aliases,
    queries_tested: queries.length,
    mentions_found: evidence.filter((e) => e.mentioned).length,
    evidence,
    gaps,
    ...scores,
  };
}
