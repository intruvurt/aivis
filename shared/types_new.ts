export { TIER_LIMITS, uiTierFromCanonical } from './types.js';
export type { CanonicalTier, LegacyTier } from './types.js';

export const CITATION_LEVELS = ['high', 'medium', 'low', 'unknown'] as const;
export type CitationLevel = typeof CITATION_LEVELS[number];

export interface CitationStrength {
  domain: string;
  strength: CitationLevel;
  notes?: string;
}