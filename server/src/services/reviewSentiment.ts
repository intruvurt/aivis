// server/src/services/reviewSentiment.ts
// Heuristic-based review sentiment - NO AI calls.
// The old implementation used invalid model ID 'gpt-3.5-turbo' (not a valid
// OpenRouter model) which failed on every call and poisoned the provider backoff
// table. This heuristic version is instant, free, and reliable.
import type { ReviewSentimentResult } from '../../../shared/types.js';

// Positive/negative signal words for basic sentiment classification
const POSITIVE_WORDS = [
  'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'outstanding',
  'love', 'loved', 'best', 'perfect', 'awesome', 'incredible', 'superb',
  'recommend', 'recommended', 'helpful', 'impressed', 'reliable', 'exceptional',
  'professional', 'efficient', 'friendly', 'satisfied', 'happy', '5 star',
  '5/5', '4/5', '4 star', 'highly recommend', 'top notch', 'top-notch',
];
const NEGATIVE_WORDS = [
  'terrible', 'horrible', 'awful', 'worst', 'bad', 'poor', 'disappointing',
  'disappointed', 'scam', 'fraud', 'waste', 'broken', 'useless', 'hate',
  'avoid', 'unreliable', 'unprofessional', 'rude', 'slow', 'overpriced',
  '1 star', '1/5', '2/5', 'never again', 'do not', 'don\'t recommend',
];

const REVIEW_SIGNALS = /\b(review|customer|rating|stars?|experience|testimonial|feedback)\b/i;

interface SentenceResult {
  excerpt: string;
  sentiment: 'positive' | 'neutral' | 'negative';
}

function classifySentence(sentence: string): 'positive' | 'neutral' | 'negative' {
  const lower = sentence.toLowerCase();
  let pos = 0;
  let neg = 0;
  for (const w of POSITIVE_WORDS) { if (lower.includes(w)) pos++; }
  for (const w of NEGATIVE_WORDS) { if (lower.includes(w)) neg++; }
  if (pos > neg) return 'positive';
  if (neg > pos) return 'negative';
  return 'neutral';
}

/**
 * Extract review-like sentences and classify sentiment using word heuristics.
 * Zero AI calls, zero latency, zero cost.
 */
export async function analyzeReviewSentiment(
  pageText: string,
  _apiKey: string
): Promise<ReviewSentimentResult> {
  if (!pageText || pageText.length < 50) {
    return { score: 50, details: [] };
  }

  const text = pageText.substring(0, 5000);
  // Split into sentences
  const sentences = text
    .split(/[.!?\n]+/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length > 20 && s.length < 300);

  // Find review-like sentences
  const reviewSentences = sentences.filter((s) => REVIEW_SIGNALS.test(s));
  // If no explicit review sentences, use all sentences for general sentiment
  const candidates = reviewSentences.length > 0 ? reviewSentences : sentences;

  const details: SentenceResult[] = [];
  let posCount = 0;
  let negCount = 0;
  let neutralCount = 0;

  for (const s of candidates.slice(0, 8)) {
    const sentiment = classifySentence(s);
    if (sentiment === 'positive') posCount++;
    else if (sentiment === 'negative') negCount++;
    else neutralCount++;
    if (details.length < 5) {
      details.push({ excerpt: s.substring(0, 200), sentiment });
    }
  }

  const total = posCount + negCount + neutralCount;
  let score = 50; // neutral default
  if (total > 0) {
    // Weighted: positive pushes toward 100, negative toward 0
    score = Math.round(50 + ((posCount - negCount) / total) * 40);
    score = Math.min(100, Math.max(0, score));
  }

  const overall: 'positive' | 'neutral' | 'negative' =
    posCount > negCount ? 'positive' : negCount > posCount ? 'negative' : 'neutral';

  return { score, overall, details };
}
