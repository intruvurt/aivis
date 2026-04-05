/**
 * Entity Graph Engine
 * 
 * Analyzes brand identity consistency
 * Tracks: canonical name, aliases, consistency ratio, leadership clarity
 */

import * as cheerio from 'cheerio';
import type { EntityGraphOutput } from '../../../../shared/types.js';

interface EntityEngineInput {
  html: string;
  domain: string;
  target_url: string;
}

/**
 * Simple Levenshtein distance for string similarity
 */
function levenshteinDistance(s1: string, s2: string): number {
  const track = Array(s2.length + 1)
    .fill(null)
    .map(() => Array(s1.length + 1).fill(0));

  for (let i = 0; i <= s1.length; i += 1) {
    track[0][i] = i;
  }

  for (let j = 0; j <= s2.length; j += 1) {
    track[j][0] = j;
  }

  for (let j = 1; j <= s2.length; j += 1) {
    for (let i = 1; i <= s1.length; i += 1) {
      const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1,
        track[j - 1][i] + 1,
        track[j - 1][i - 1] + indicator
      );
    }
  }

  return track[s2.length][s1.length];
}

/**
 * Check if two strings are similar (for entity matching)
 */
function isSimilar(s1: string, s2: string, threshold = 0.8): boolean {
  const s1Lower = s1.toLowerCase().trim();
  const s2Lower = s2.toLowerCase().trim();

  if (s1Lower === s2Lower) return true;

  // Check if one is an abbreviation of the other
  if (s1Lower.replace(/\s+/g, '') === s2Lower.replace(/\s+/g, '')) return true;

  const distance = levenshteinDistance(s1Lower, s2Lower);
  const maxLen = Math.max(s1Lower.length, s2Lower.length);
  const similarity = 1 - distance / maxLen;

  return similarity >= threshold;
}

/**
 * Extract organization entity mentions from HTML
 */
function extractEntityMentions(html: string, domain: string): {
  mentions: string[];
  variance_issues: string[];
} {
  const $ = cheerio.load(html);
  const mentions = new Set<string>();
  const text = $.text();

  // Extract from title
  const title = $('title').text().trim();
  if (title) mentions.add(title);

  // Extract from h1
  $('h1').each((_idx, elem) => {
    const txt = $(elem).text().trim();
    if (txt && txt.length < 100) mentions.add(txt);
  });

  // Extract from og:site_name
  const ogSiteName = $('meta[property="og:site_name"]').attr('content');
  if (ogSiteName) mentions.add(ogSiteName);

  // Extract company name patterns
  const companyPattern = /(?:©|Copyright|\(c\))\s*(?:\d{4})?\s*([A-Z][A-Za-z0-9\s&,.-]+?)(?:\.|-|$|Inc|Ltd|LLC|Corp)/g;
  const companyMatches = text.match(companyPattern) || [];
  companyMatches.forEach((match) => {
    const name = match
      .replace(/©|Copyright|\(c\)|Inc|Ltd|LLC|Corp|-|\.$/g, '')
      .trim();
    if (name && name.length > 2) mentions.add(name);
  });

  // Variance analysis
  const variance_issues: string[] = [];
  const uniqueMentions = Array.from(mentions);

  if (uniqueMentions.length > 1) {
    for (let i = 0; i < uniqueMentions.length; i++) {
      for (let j = i + 1; j < uniqueMentions.length; j++) {
        if (!isSimilar(uniqueMentions[i], uniqueMentions[j], 0.85)) {
          variance_issues.push(`Inconsistent mention: "${uniqueMentions[i]}" vs "${uniqueMentions[j]}"`);
        }
      }
    }
  }

  return {
    mentions: uniqueMentions,
    variance_issues,
  };
}

/**
 * Find canonical name (most frequent, longest mention)
 */
function findCanonicalName(mentions: string[]): {
  canonical_name: string;
  aliases: string[];
  confidence: number;
} {
  if (mentions.length === 0) {
    return {
      canonical_name: 'Unknown',
      aliases: [],
      confidence: 0,
    };
  }

  // Group similar mentions
  const groups: string[][] = [];
  const processed = new Set<string>();

  mentions.forEach((mention) => {
    if (processed.has(mention)) return;

    const group = [mention];
    processed.add(mention);

    mentions.forEach((other) => {
      if (!processed.has(other) && isSimilar(mention, other, 0.85)) {
        group.push(other);
        processed.add(other);
      }
    });

    groups.push(group);
  });

  // Pick the largest group, prefer longest name in group
  const largestGroup = groups.reduce((best, group) =>
    group.length > best.length || (group.length === best.length && group[0].length > best[0].length)
      ? group
      : best
  );

  const canonical = largestGroup.sort((a, b) => b.length - a.length)[0];
  const aliases = largestGroup.filter((m) => m !== canonical);
  const consistency = (largestGroup.length / mentions.length) * 0.95 + 0.05;

  return {
    canonical_name: canonical,
    aliases,
    confidence: Math.min(0.99, consistency),
  };
}

/**
 * Extract leadership information
 */
function extractLeadership(html: string): {
  has_leadership: boolean;
  leadership_consistent: boolean;
  department_clarity: 'good' | 'partial' | 'poor';
} {
  const $ = cheerio.load(html);
  const text = $.text().toLowerCase();

  // Look for founder/CEO/leadership mentions
  const hasLeadership =
    /founder|ceo|chief|president|executive|leadership|team/i.test(text) &&
    /[A-Z][a-z]+\s+[A-Z][a-z]+/i.test($.text()); // At least one name-like pattern

  // Check if multiple team members mentioned (consistency check)
  const teamNamePattern = /[A-Z][a-z]+\s+[A-Z][a-z]+/g;
  const names = ($.text().match(teamNamePattern) || []).slice(0, 5);
  const nameConsistency = names.length > 1;

  // Department clarity: look for "department" or "team" sections
  const departmentMentions =
    ($('h2, h3')
      .text()
      .match(/team|department|division|group/gi) || []).length > 0;

  let deptClarity: 'good' | 'partial' | 'poor' = 'poor';
  if (departmentMentions) deptClarity = 'good';
  else if (hasLeadership) deptClarity = 'partial';

  return {
    has_leadership: hasLeadership,
    leadership_consistent: nameConsistency,
    department_clarity: deptClarity,
  };
}

/**
 * Extract location consistency
 */
function extractLocation(html: string): {
  location: string;
  consistency: boolean;
} {
  const $ = cheerio.load(html);
  const text = $.text();

  // Look for common location patterns
  const addressPattern = /(?:based\s+in|located\s+in|office\s+in)\s+([A-Z][a-z]+(?:,?\s+[A-Z]{2})?)/i;
  const directAddressPattern = /(\d+\s+[A-Z][a-z]+\s+(?:St|Ave|Blvd|Rd),?\s+[A-Z][a-z]+,?\s+[A-Z]{2})/g;

  const match = text.match(addressPattern);
  const location = match ? match[1] : 'Unknown';

  // Check if location is mentioned multiple times (consistency)
  const locationMentions = text.match(new RegExp(location, 'gi')) || [];
  const consistency = locationMentions.length > 1;

  return { location, consistency };
}

/**
 * Calculate entity clarity score
 */
function calculateEntityClarityScore(
  canonicalName: any,
  mentions: string[],
  leadership: any,
  gapCount: number
): number {
  let score = 100;

  // Deduct for name inconsistency
  if (canonicalName.confidence < 0.8) score -= 20;
  else if (canonicalName.confidence < 0.9) score -= 10;

  // Deduct for too many aliases
  if (canonicalName.aliases.length > 5) score -= 10;
  else if (canonicalName.aliases.length > 2) score -= 5;

  // Deduct for missing leadership
  if (!leadership.has_leadership) score -= 15;
  else if (!leadership.leadership_consistent) score -= 8;

  // Bonus for clear departments
  if (leadership.department_clarity === 'good') score += 5;

  // Deduct for gaps
  score -= Math.min(20, gapCount * 5);

  return Math.max(0, Math.min(100, score));
}

/**
 * Main Entity Graph Engine
 */
export async function runEntityGraphEngine(input: EntityEngineInput): Promise<EntityGraphOutput> {
  const startTime = Date.now();

  try {
    // Extract entity signals
    const { mentions, variance_issues } = extractEntityMentions(input.html, input.domain);
    const canonical = findCanonicalName(mentions);
    const leadership = extractLeadership(input.html);
    const { location } = extractLocation(input.html);

    // Calculate score
    const entity_clarity_score = calculateEntityClarityScore(canonical, mentions, leadership, variance_issues.length);

    // Entity consistency ratio
    const consistency_ratio = canonical.confidence;

    // Recommendations
    const recommendations: string[] = [];
    if (consistency_ratio < 0.8) {
      recommendations.push(`Standardize brand name to "${canonical.canonical_name}" across all pages`);
    }
    if (!leadership.has_leadership) {
      recommendations.push('Add founder/team bios to increase entity authority');
    }
    if (variance_issues.length > 0) {
      recommendations.push(`Fix name inconsistencies: ${variance_issues[0]}`);
    }

    return {
      status: 'success',
      timeMs: Date.now() - startTime,
      data: {
        entity_clarity_score,
        primary_entity: {
          canonical_name: canonical.canonical_name,
          aliases: canonical.aliases,
          confidence: canonical.confidence,
          primary_location: location,
        },
        entity_mentions: {
          count: mentions.length,
          consistency_ratio: consistency_ratio,
          variance_issues: variance_issues.slice(0, 5),
        },
        organization_clarity: {
          has_leadership: leadership.has_leadership,
          leadership_consistent: leadership.leadership_consistent,
          department_clarity: leadership.department_clarity,
        },
        recommendations,
      },
    };
  } catch (error) {
    return {
      status: 'failed',
      timeMs: Date.now() - startTime,
      errors: [String(error)],
      data: {
        entity_clarity_score: 0,
        primary_entity: {
          canonical_name: 'Error',
          aliases: [],
          confidence: 0,
          primary_location: 'Unknown',
        },
        entity_mentions: {
          count: 0,
          consistency_ratio: 0,
          variance_issues: [],
        },
        organization_clarity: {
          has_leadership: false,
          leadership_consistent: false,
          department_clarity: 'poor',
        },
        recommendations: ['Run the engine again after fixing HTML errors'],
      },
    };
  }
}
