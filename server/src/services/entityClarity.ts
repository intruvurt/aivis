// server/src/services/entityClarity.ts
// Heuristic-based entity clarity scoring — NO AI calls.
// Prevents the primary GPT-4o Mini model from being rate-limited or put into
// backoff before the main AI1 analysis pipeline runs.

export interface EntityClarityResult {
  score: number; // 0-100
  excerpt?: string;
  notes?: string;
}

// Phrases that indicate a clear brand/entity description
const ABOUT_SIGNALS = [
  /\b(we are|we're)\b/i,
  /\b(our (company|team|mission|story|vision|platform|product))\b/i,
  /\b(founded|established) (in|by)\b/i,
  /\b(about us|who we are|our story)\b/i,
  /\b(headquartered|based in|located in)\b/i,
  /\b(specializ(e|es|ing)|dedicated to|committed to|focused on)\b/i,
  /\b(inc\.|llc|ltd|corp\.?|gmbh|pty|s\.a\.)\b/i,
  /\b(leading|premier|trusted|award[ -]winning)\b/i,
  /\b(providing|delivering|offering)\s+(solutions|services|products)\b/i,
  /\b(years of experience|since \d{4})\b/i,
];

// Structural signals that improve clarity
const STRUCTURE_SIGNALS = [
  /\bfaq\b/i,
  /<h[1-3][^>]*>.*?(about|team|company|who|mission|contact)/i,
  /"@type"\s*:\s*"Organization"/i,
  /"@type"\s*:\s*"(Person|LocalBusiness|Corporation)"/i,
  /\bschema\.org\b/i,
];

/**
 * Evaluate whether a page clearly explains who the organization/entity is,
 * using text heuristics (zero AI calls, zero latency, zero cost).
 */
export async function assessEntityClarity(
  pageText: string,
  _apiKey: string
): Promise<EntityClarityResult> {
  if (!pageText || pageText.length < 50) {
    return { score: 0, notes: 'Insufficient page content for entity clarity assessment' };
  }

  const text = pageText.substring(0, 5000);
  let score = 10; // baseline — page exists
  let bestExcerpt = '';

  // Check about-style signals
  let aboutHits = 0;
  for (const pattern of ABOUT_SIGNALS) {
    const match = text.match(pattern);
    if (match) {
      aboutHits++;
      if (!bestExcerpt && match.index !== undefined) {
        // Extract surrounding sentence as excerpt
        const start = Math.max(0, match.index - 60);
        const end = Math.min(text.length, match.index + match[0].length + 120);
        bestExcerpt = text.substring(start, end).replace(/\s+/g, ' ').trim();
      }
    }
  }
  // First 3 hits = 12 points each, diminishing after
  score += Math.min(aboutHits, 3) * 12 + Math.min(Math.max(0, aboutHits - 3), 4) * 5;

  // Structural signals
  let structHits = 0;
  for (const pattern of STRUCTURE_SIGNALS) {
    if (pattern.test(text)) structHits++;
  }
  score += Math.min(structHits, 3) * 8;

  // Word count factor — longer pages with entity signals are typically clearer
  const words = text.split(/\s+/).length;
  if (words > 200) score += 5;
  if (words > 500) score += 5;

  score = Math.min(100, Math.max(0, score));

  const result: EntityClarityResult = { score };
  if (bestExcerpt) result.excerpt = bestExcerpt;
  if (aboutHits === 0) result.notes = 'No clear entity/brand description found on page';
  else if (aboutHits >= 3) result.notes = `Strong entity clarity (${aboutHits} signals detected)`;
  else result.notes = `Moderate entity clarity (${aboutHits} signals detected)`;

  return result;
}
