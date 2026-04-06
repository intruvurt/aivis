/**
 * OCR Service — tesseract.js-powered image text extraction.
 *
 * Provides:
 *  - Single image OCR (`ocrImageFromUrl`)
 *  - Batch OCR for page images (`ocrPageImages`)
 *  - Content coverage comparison for dynamic fallback (`computeOcrCoverage`)
 *  - Context-alt generation from OCR text
 *
 * Used by:
 *  - scraper.ts  (extract text from on-page images during scrape)
 *  - server.ts   (Signal+ parallel OCR validation, dynamic fallback logic)
 */

import Tesseract from 'tesseract.js';

// ── Configuration ──────────────────────────────────────────────────────
const OCR_TIMEOUT_MS = 8_000;           // Per-image hard cap
const BATCH_CONCURRENCY = 3;            // Parallel image OCR slots
const MAX_IMAGES_PER_PAGE = 15;         // Don't OCR more than this per page
const MIN_IMAGE_BYTES = 2_000;          // Skip tiny icons / 1px trackers
const MIN_OCR_WORD_COUNT = 3;           // Discard trivially short results

// ── Types ──────────────────────────────────────────────────────────────

export interface OcrImageResult {
  src: string;
  alt: string;
  ocrText: string;
  confidence: number;      // 0–100 from tesseract
  wordCount: number;
  contextAlt: string;      // Generated alt text from OCR content
  citableSnippet: string;  // Best single-sentence extract for AI citation
}

export interface OcrPageResult {
  images: OcrImageResult[];
  totalOcrWords: number;
  processingTimeMs: number;
}

export interface OcrCoverage {
  /** Ratio of OCR-extracted words that overlap with scraped body text (0–1) */
  overlapRatio: number;
  /** Unique words found only in images, not in body text */
  uniqueOcrWords: string[];
  /** Whether the OCR provided meaningful additional content beyond the scrape */
  hasAdditionalContent: boolean;
  /** Total unique word count from OCR across all images */
  totalOcrUniqueWords: number;
}

// ── Internal helpers ───────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out (${ms}ms)`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

/** Extract a short "context alt" from OCR text — first meaningful sentence. */
function deriveContextAlt(ocrText: string): string {
  const sentences = ocrText.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 10);
  if (sentences.length === 0) return ocrText.substring(0, 120).trim();
  return sentences[0].substring(0, 150);
}

/** Extract the most citable sentence from OCR text. */
function deriveCitableSnippet(ocrText: string): string {
  const sentences = ocrText.split(/[.!?]+/).map((s) => s.trim()).filter((s) => {
    const words = s.split(/\s+/).length;
    return words >= 5 && words <= 40;
  });
  if (sentences.length === 0) return '';
  // Prefer longer informational sentences
  sentences.sort((a, b) => b.split(/\s+/).length - a.split(/\s+/).length);
  return sentences[0] + '.';
}

/** Resolve potentially relative image URL against base. */
function resolveImageUrl(src: string, baseUrl: string): string | null {
  try {
    // Already absolute
    if (/^https?:\/\//i.test(src)) return src;
    // Data URIs and blob URLs can't be fetched
    if (src.startsWith('data:') || src.startsWith('blob:')) return null;
    return new URL(src, baseUrl).href;
  } catch {
    return null;
  }
}

// ── Core OCR ───────────────────────────────────────────────────────────

/**
 * OCR a single image from URL. Returns null if the image can't be read
 * or produces no meaningful text.
 */
export async function ocrImageFromUrl(
  imageUrl: string,
  existingAlt: string = '',
): Promise<OcrImageResult | null> {
  try {
    const result = await withTimeout(
      Tesseract.recognize(imageUrl, 'eng', { logger: () => {} }),
      OCR_TIMEOUT_MS,
      `OCR ${imageUrl.substring(0, 60)}`,
    );

    const text = (result.data.text || '').trim();
    const confidence = result.data.confidence ?? 0;
    const wordCount = text.split(/\s+/).filter(Boolean).length;

    if (wordCount < MIN_OCR_WORD_COUNT || confidence < 30) return null;

    return {
      src: imageUrl,
      alt: existingAlt,
      ocrText: text.substring(0, 2000),
      confidence: Math.round(confidence),
      wordCount,
      contextAlt: deriveContextAlt(text),
      citableSnippet: deriveCitableSnippet(text),
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[OCR] Failed for ${imageUrl.substring(0, 80)}: ${msg}`);
    return null;
  }
}

/**
 * OCR all qualifying images from a scraped page.
 *
 * @param images - Array of `{ src, alt }` objects extracted during scrape
 * @param baseUrl - The page URL for resolving relative image paths
 */
export async function ocrPageImages(
  images: Array<{ src: string; alt: string }>,
  baseUrl: string,
): Promise<OcrPageResult> {
  const start = Date.now();

  // Filter and resolve URLs
  const candidates = images
    .slice(0, MAX_IMAGES_PER_PAGE)
    .map((img) => ({ ...img, resolved: resolveImageUrl(img.src, baseUrl) }))
    .filter((img): img is typeof img & { resolved: string } => img.resolved !== null);

  if (candidates.length === 0) {
    return { images: [], totalOcrWords: 0, processingTimeMs: 0 };
  }

  // Process in batches of BATCH_CONCURRENCY
  const results: OcrImageResult[] = [];
  for (let i = 0; i < candidates.length; i += BATCH_CONCURRENCY) {
    const batch = candidates.slice(i, i + BATCH_CONCURRENCY);
    const batchResults = await Promise.allSettled(
      batch.map((img) => ocrImageFromUrl(img.resolved, img.alt)),
    );
    for (const r of batchResults) {
      if (r.status === 'fulfilled' && r.value) {
        results.push(r.value);
      }
    }
  }

  const totalOcrWords = results.reduce((sum, r) => sum + r.wordCount, 0);

  return {
    images: results,
    totalOcrWords,
    processingTimeMs: Date.now() - start,
  };
}

// ── Coverage comparison ────────────────────────────────────────────────

/**
 * Compare OCR-extracted text against the main scraped body text.
 * Used for dynamic fallback decision:
 *   - If scrapeBodyWordCount < 60% of expected AND python cross-check ≥ 85%,
 *     switch to Python payload for analysis.
 */
export function computeOcrCoverage(
  ocrResults: OcrImageResult[],
  bodyText: string,
): OcrCoverage {
  if (ocrResults.length === 0) {
    return { overlapRatio: 1, uniqueOcrWords: [], hasAdditionalContent: false, totalOcrUniqueWords: 0 };
  }

  const bodyWords = new Set(
    bodyText.toLowerCase().split(/\s+/).filter((w) => w.length > 2),
  );

  const allOcrWords: string[] = [];
  for (const r of ocrResults) {
    const words = r.ocrText.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    allOcrWords.push(...words);
  }

  const uniqueOcrSet = new Set(allOcrWords);
  let overlapCount = 0;
  const uniqueOnly: string[] = [];

  for (const word of uniqueOcrSet) {
    if (bodyWords.has(word)) {
      overlapCount++;
    } else {
      uniqueOnly.push(word);
    }
  }

  const overlapRatio = uniqueOcrSet.size > 0 ? overlapCount / uniqueOcrSet.size : 1;

  return {
    overlapRatio,
    uniqueOcrWords: uniqueOnly.slice(0, 100),
    hasAdditionalContent: uniqueOnly.length > 5,
    totalOcrUniqueWords: uniqueOcrSet.size,
  };
}

/**
 * Build an evidence-compatible OCR context block for injection into
 * the AI prompt's evidence manifest. Maps OCR findings to evidence IDs
 * so the model can cite them in recommendations.
 */
export function buildOcrEvidenceBlock(
  ocrResult: OcrPageResult,
): Record<string, string> {
  const evidence: Record<string, string> = {};

  if (ocrResult.images.length === 0) {
    evidence['ev_ocr_images'] = 'No readable text detected in page images via OCR';
    return evidence;
  }

  evidence['ev_ocr_images'] = `OCR extracted text from ${ocrResult.images.length} image(s), total ${ocrResult.totalOcrWords} words, avg confidence ${Math.round(ocrResult.images.reduce((s, i) => s + i.confidence, 0) / ocrResult.images.length)}%`;

  // Individual image evidence entries (top 5 most content-rich)
  const sorted = [...ocrResult.images].sort((a, b) => b.wordCount - a.wordCount);
  for (let i = 0; i < Math.min(5, sorted.length); i++) {
    const img = sorted[i];
    const altStatus = img.alt ? `alt="${img.alt.substring(0, 60)}"` : 'NO alt text';
    evidence[`ev_ocr_img_${i + 1}`] = `Image OCR (${altStatus}): "${img.ocrText.substring(0, 150)}..." (${img.wordCount} words, ${img.confidence}% confidence). Context-alt: "${img.contextAlt}"`;
  }

  // Images with missing alt but OCR text found — strong recommendation signal
  const missingAltWithText = ocrResult.images.filter((i) => !i.alt && i.wordCount > 5);
  if (missingAltWithText.length > 0) {
    evidence['ev_ocr_missing_alt'] = `${missingAltWithText.length} image(s) have readable text content but NO alt attribute — accessibility and AI citation gap. OCR-suggested alts available.`;
  }

  return evidence;
}
