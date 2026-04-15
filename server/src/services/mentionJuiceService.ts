/**
 * MentionJuice Service
 *
 * Computes a credibility-weighted "Mention Juice Score" (0–100) for a brand
 * based on crawled brand mentions. Unlike the raw brand_health_score (which
 * weights sentiment + volume + diversity equally), MentionJuice applies
 * per-source authority multipliers derived from how strongly AI models weight
 * content from each platform during training and retrieval.
 *
 * Tier gate: Alignment+
 *
 * Score formula:
 *   sum(source_weight × sentiment_multiplier × recency_multiplier × mention_value)
 *   / theoretical_max × 100
 *
 * Tier thresholds:
 *   dominant  ≥ 75
 *   strong    ≥ 50
 *   moderate  ≥ 20
 *   weak      <  20
 */

import crypto from 'crypto';
import { getPool } from './postgresql.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type MentionJuiceTier = 'weak' | 'moderate' | 'strong' | 'dominant';

export interface MentionRow {
  source: string;
  url: string;
  title: string;
  snippet: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  published_at?: string | null;
}

export interface SourceBreakdown {
  count: number;
  weight: number;
  total_weighted: number;
  avg_sentiment: number;
}

export interface MentionJuiceResult {
  brand: string;
  domain: string;
  mention_juice_score: number;
  tier: MentionJuiceTier;
  total_mentions: number;
  credible_mentions: number;
  credibility_breakdown: Record<string, SourceBreakdown>;
  spam_filtered: number;
  duplicate_filtered: number;
  evidence_ids: string[];
  computed_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Source credibility weights
// These weights reflect how heavily AI models (GPT, Claude, Gemini, Perplexity)
// draw on content from each platform during training data curation and live
// retrieval. Wikipedia tops the list because it is directly used as a grounding
// source by most models; Reddit leads organic sources because of its outsized
// representation in Common Crawl and curated datasets.
// ─────────────────────────────────────────────────────────────────────────────

const SOURCE_WEIGHT: Record<string, number> = {
  wikipedia: 1.0,
  reddit: 0.85,
  hackernews: 0.80,
  stackoverflow: 0.80,
  github: 0.75,
  github_discussions: 0.72,
  google_news: 0.70,
  producthunt: 0.65,
  quora: 0.60,
  devto: 0.55,
  medium: 0.50,
  youtube: 0.50,
  lobsters: 0.45,
  bluesky: 0.35,
  twitter: 0.30,
  mastodon: 0.25,
  lemmy: 0.20,
  // Synthetic aggregation sources carry little citation value
  ddg_dork: 0.12,
  bing_dork: 0.12,
};

const DEFAULT_SOURCE_WEIGHT = 0.15;

// ─────────────────────────────────────────────────────────────────────────────
// Sentiment multipliers
// ─────────────────────────────────────────────────────────────────────────────

const SENTIMENT_MULTIPLIER: Record<string, number> = {
  positive: 1.2,
  neutral: 1.0,
  negative: 0.4, // Negative mentions actively hurt citation trustworthiness
};

/**
 * Recency multiplier — newer mentions are worth more because AI retrieval
 * systems (especially RAG pipelines) prioritise freshness.
 *
 * Age buckets:
 *   < 7 d  → 1.2
 *   < 30 d → 1.0
 *   < 90 d → 0.85
 *   < 365 d → 0.65
 *   older  → 0.45
 */
function recencyMultiplier(publishedAt?: string | null): number {
  if (!publishedAt) return 0.75; // unknown age — assume ~60 days
  const now = Date.now();
  const pub = new Date(publishedAt).getTime();
  if (isNaN(pub)) return 0.75;
  const days = (now - pub) / (1000 * 60 * 60 * 24);
  if (days < 7) return 1.2;
  if (days < 30) return 1.0;
  if (days < 90) return 0.85;
  if (days < 365) return 0.65;
  return 0.45;
}

/**
 * Deterministic evidence ID for a single credible mention.
 * sha256(brand + source + url + first 60 chars of snippet)
 */
function makeEvidenceId(brand: string, mention: MentionRow): string {
  const raw = `${brand.toLowerCase()}|${mention.source}|${mention.url}|${mention.snippet.slice(0, 60)}`;
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32);
}

// ─────────────────────────────────────────────────────────────────────────────
// Spam / duplicate detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if the mention looks like spam or forced duplicate content:
 *  - Same URL seen before (exact duplicate)
 *  - Snippet too short (< 30 chars) to carry real substance
 *  - Snippet body is near-identical (normalised edit distance) to a previously
 *    seen snippet — catches syndicated / auto-duplicated content
 */
function buildDuplicateDetector() {
  const seenUrls = new Set<string>();
  // Store first 80 chars of each seen snippet for near-dup detection
  const seenSnippetFingerprints = new Set<string>();

  return function isDuplicate(mention: MentionRow): boolean {
    const url = mention.url.trim().toLowerCase().replace(/\/$/, '');
    if (seenUrls.has(url)) return true;
    seenUrls.add(url);

    if (mention.snippet.trim().length < 30) return true; // too thin to be real

    // Near-duplicate check: normalise whitespace + lowercase, take first 80 chars
    const fingerprint = mention.snippet
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .slice(0, 80);
    if (seenSnippetFingerprints.has(fingerprint)) return true;
    seenSnippetFingerprints.add(fingerprint);

    return false;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Core scoring function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute the MentionJuice score for a brand given its crawled mention rows.
 * This is a pure CPU function — no DB access.
 */
export function computeMentionJuice(
  brand: string,
  domain: string,
  mentions: MentionRow[],
): MentionJuiceResult {
  const isDuplicate = buildDuplicateDetector();
  let spamFiltered = 0;
  let duplicateFiltered = 0;

  const breakdown: Record<string, SourceBreakdown> = {};
  const evidenceIds: string[] = [];

  let weightedSum = 0;
  // Theoretical max = sum of all mention weights if every mention were
  // wikipedia + positive + brand-new. Cap at 100 to keep score meaningful.
  // We use total valid mentions × best possible weight (wikipedia × 1.2 × 1.2).
  const PER_MENTION_MAX = 1.0 * 1.2 * 1.2; // 1.44

  let credibleCount = 0;

  for (const mention of mentions) {
    // ── Spam / duplicate filter ──
    if (isDuplicate(mention)) {
      duplicateFiltered++;
      continue;
    }

    const source = (mention.source || 'unknown').toLowerCase();
    const weight = SOURCE_WEIGHT[source] ?? DEFAULT_SOURCE_WEIGHT;

    // Sources below 0.15 threshold are treated as spam (dork aggregations with
    // no real organic signal).
    if (weight < 0.15) {
      spamFiltered++;
      continue;
    }

    const sentMultiplier = SENTIMENT_MULTIPLIER[mention.sentiment || 'neutral'] ?? 1.0;
    const recMultiplier = recencyMultiplier(mention.published_at);

    const mentionValue = weight * sentMultiplier * recMultiplier;
    weightedSum += mentionValue;
    credibleCount++;

    // Build breakdown
    if (!breakdown[source]) {
      breakdown[source] = { count: 0, weight, total_weighted: 0, avg_sentiment: 0 };
    }
    breakdown[source].count++;
    breakdown[source].total_weighted += mentionValue;
    // running average of (sentMultiplier - 1) as sentiment proxy
    breakdown[source].avg_sentiment =
      (breakdown[source].avg_sentiment * (breakdown[source].count - 1) + (sentMultiplier - 1)) /
      breakdown[source].count;

    // Collect evidence ID for credible mentions
    evidenceIds.push(makeEvidenceId(brand, mention));
  }

  // Normalise: cap at credibleCount × PER_MENTION_MAX so score stays 0–100
  const maxPossible = Math.max(credibleCount * PER_MENTION_MAX, 1);
  const rawScore = Math.min((weightedSum / maxPossible) * 100, 100);

  // Apply a log-scale volume bonus so very broad coverage still rewards above
  // a handful of premium citations:
  // bonus = log2(1 + credibleCount) * 3  (capped at 15 pts)
  const volumeBonus = Math.min(Math.log2(1 + credibleCount) * 3, 15);
  const finalScore = Math.min(rawScore + volumeBonus, 100);

  const rounded = Math.round(finalScore * 10) / 10;

  return {
    brand,
    domain,
    mention_juice_score: rounded,
    tier: juiceTier(rounded),
    total_mentions: mentions.length,
    credible_mentions: credibleCount,
    credibility_breakdown: breakdown,
    spam_filtered: spamFiltered,
    duplicate_filtered: duplicateFiltered,
    evidence_ids: [...new Set(evidenceIds)], // deduplicated
    computed_at: new Date().toISOString(),
  };
}

function juiceTier(score: number): MentionJuiceTier {
  if (score >= 75) return 'dominant';
  if (score >= 50) return 'strong';
  if (score >= 20) return 'moderate';
  return 'weak';
}

// ─────────────────────────────────────────────────────────────────────────────
// DB persistence
// ─────────────────────────────────────────────────────────────────────────────

export async function saveMentionJuiceSnapshot(
  userId: string,
  result: MentionJuiceResult,
): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO mention_juice_snapshots
       (user_id, brand, domain, mention_juice_score, tier, total_mentions,
        credibility_breakdown, spam_filtered, duplicate_filtered, evidence_ids, computed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      userId,
      result.brand,
      result.domain,
      result.mention_juice_score,
      result.tier,
      result.total_mentions,
      JSON.stringify(result.credibility_breakdown),
      result.spam_filtered,
      result.duplicate_filtered,
      JSON.stringify(result.evidence_ids),
      result.computed_at,
    ],
  );
}

export async function getLatestMentionJuiceSnapshot(
  userId: string,
  brand: string,
): Promise<MentionJuiceResult | null> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT * FROM mention_juice_snapshots
     WHERE user_id = $1 AND brand = $2
     ORDER BY computed_at DESC
     LIMIT 1`,
    [userId, brand],
  );
  if (!rows[0]) return null;
  const row = rows[0];
  return {
    brand: row.brand,
    domain: row.domain,
    mention_juice_score: parseFloat(row.mention_juice_score),
    tier: row.tier as MentionJuiceTier,
    total_mentions: row.total_mentions,
    credible_mentions: row.total_mentions - row.spam_filtered - row.duplicate_filtered,
    credibility_breakdown: row.credibility_breakdown ?? {},
    spam_filtered: row.spam_filtered,
    duplicate_filtered: row.duplicate_filtered,
    evidence_ids: row.evidence_ids ?? [],
    computed_at: row.computed_at,
  };
}

export async function getMentionJuiceHistory(
  userId: string,
  brand: string,
  limit = 30,
): Promise<Array<{ mention_juice_score: number; tier: string; computed_at: string }>> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT mention_juice_score, tier, computed_at
     FROM mention_juice_snapshots
     WHERE user_id = $1 AND brand = $2
     ORDER BY computed_at DESC
     LIMIT $3`,
    [userId, brand, limit],
  );
  return rows.map((r) => ({
    mention_juice_score: parseFloat(r.mention_juice_score),
    tier: r.tier,
    computed_at: r.computed_at,
  }));
}
