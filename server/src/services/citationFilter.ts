/**
 * citationFilter.ts
 *
 * Deterministic Filter for the citation pipeline.
 *
 * Architecture position:
 *   scraper (DOM snapshot) → evidenceExtractor → [citationFilter] → citeStream / scoring
 *
 * This module implements the "ML Auditor" layer:
 *
 *   1. UPSTREAM LOCK  — hashes the raw HTML at capture time (source_html_hash).
 *      Every cite is anchored to that hash, making it fully auditable.
 *
 *   2. RELIABILITY SCORING — deterministic classifier that evaluates:
 *        - Value volatility: does the raw value look like it changes every render?
 *        - Key stability:    is the evidence_key type known to be structurally stable?
 *        - Structure bonus:  is the evidence backed by a structured-data source?
 *        - Delta correction: was this key manually corrected in a previous fix cycle?
 *          If so, apply the stored correction delta to the score.
 *
 *   3. CITATION HANDLE — sha256(evidence_key + ':' + source + ':' + stable_value + ':' + html_hash)
 *      Issued ONLY when reliability_score ≥ CITATION_THRESHOLD (0.98).
 *      The handle is the "proof of citation" — it resolves back to the exact
 *      rendered HTML snapshot so any downstream consumer can verify the original source.
 *
 *   4. FIX-CYCLE TRAINING — when a citation is manually corrected, call
 *      `recordFixDelta(evidence_key, oldValue, newValue)`.
 *      The delta is stored in-process (and optionally persisted) so that
 *      future scoring tightens or loosens automatically for that evidence type.
 *
 * Design principle:
 *   The filter is NOT a generator. Its only job is to say "No" to any scraped
 *   evidence that doesn't perfectly align with the structure required for a
 *   valid, stable, auditable citation.
 */

import crypto from 'node:crypto';
import type { SSFREvidenceItem } from '../../../shared/types.js';
import type { CiteEntry, CitationFilterResult } from '../../../shared/types.js';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Minimum reliability score required to grant a Citation Handle. */
export const CITATION_THRESHOLD = 0.98;

/**
 * Evidence keys that are structurally stable by definition.
 * Schema.org and canonical links come from deterministic structured data;
 * they don't vary between renders of the same page version.
 */
const STABLE_KEYS = new Set([
  'organization_schema',
  'same_as_links',
  'canonical',
  'author_entity',
  'schema_type',
  'json_ld',
  'meta_description',
  'meta_title',
  'og_title',
  'og_description',
  'hreflang',
  'robots_txt',
  'llms_txt',
]);

/**
 * Evidence keys that are inherently volatile — their values are expected
 * to change between page renders (timestamps, nonces, session tokens, etc.).
 * Any cite built from these keys is disqualified regardless of the raw value.
 */
const VOLATILE_KEYS = new Set([
  'page_load_ms',
  'lcp_ms',
  'performance_metric',
  '__nonce',
  'csrf_token',
  'session_id',
  'request_id',
]);

/** Regex patterns that signal a volatile value regardless of key name. */
const VOLATILE_VALUE_PATTERNS: RegExp[] = [
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i, // UUID
  /\b[0-9]{10,13}\b/,          // Unix timestamps (seconds or ms)
  /\bnonce[=:]\s*[A-Za-z0-9+/=]{8,}/i, // Nonce patterns
  /aria-[a-z]+-[0-9]{4,}/i,   // Dynamic ARIA IDs (aria-controls-12345)
  /\bdata-reactid\b/i,         // React legacy dynamic IDs
  /\bdata-v-[0-9a-f]+\b/i,    // Vue scoped class hashes
  /\bcls-[0-9a-zA-Z]{6,}\b/,  // Emotion / CSS-in-JS class hashes
  /jss\d{3,}/,                 // JSS dynamic class names
];

// ── Fix-cycle delta store ─────────────────────────────────────────────────────

/**
 * In-process store for fix-cycle deltas.
 *
 * Schema: Map<evidence_key, CorrectionRecord>
 *
 * A positive delta means manual fixes determined this key is MORE reliable
 * than the base scorer thought. A negative delta means the opposite.
 *
 * In production this can be backed by the `analysis_cache` table or a
 * dedicated `citation_corrections` table — swap `deltaStore` for a DB query.
 */
interface CorrectionRecord {
  /** Cumulative score adjustment (capped to ±0.10) */
  delta: number;
  /** Number of manual corrections recorded */
  correction_count: number;
  /** Most recent corrected value for drift detection */
  last_corrected_value: string;
  /** Unix ms of last correction */
  last_corrected_at: number;
}

const deltaStore = new Map<string, CorrectionRecord>();

/**
 * Record a manual fix-cycle correction.
 *
 * Call this whenever a user manually edits a citation — passes the old
 * scraped value and the corrected target value. The delta is computed and
 * stored so future scoring adjusts automatically.
 *
 * @param evidenceKey  - The normalised evidence key that was corrected
 * @param oldValue     - The raw value the scraper produced
 * @param newValue     - The corrected value the user provided
 */
export function recordFixDelta(
  evidenceKey: string,
  oldValue: string,
  newValue: string,
): void {
  const existing = deltaStore.get(evidenceKey);

  // If the user's corrected value matches the scraped value, it was a false
  // correction — reward reliability slightly.
  const valueDrift = oldValue.trim() === newValue.trim() ? 0.01 : -0.05;

  const newDelta = Math.max(-0.10, Math.min(0.10,
    (existing?.delta ?? 0) + valueDrift,
  ));

  deltaStore.set(evidenceKey, {
    delta: newDelta,
    correction_count: (existing?.correction_count ?? 0) + 1,
    last_corrected_value: newValue.slice(0, 512),
    last_corrected_at: Date.now(),
  });
}

/**
 * Read the current delta for a key (0 if no corrections recorded).
 * Exposed for observability and testing.
 */
export function getDelta(evidenceKey: string): number {
  return deltaStore.get(evidenceKey)?.delta ?? 0;
}

/**
 * Snapshot the full delta store (for persistence to DB).
 * Returns a stable JSON string keyed by evidence_key.
 */
export function exportDeltas(): Record<string, CorrectionRecord> {
  return Object.fromEntries(deltaStore);
}

/**
 * Restore deltas from a persisted snapshot (call at server startup).
 */
export function importDeltas(snapshot: Record<string, CorrectionRecord>): void {
  for (const [key, record] of Object.entries(snapshot)) {
    deltaStore.set(key, record);
  }
}

// ── Core scorer ───────────────────────────────────────────────────────────────

/**
 * Assess whether a raw value string is structurally volatile.
 * Returns 0.0 (stable) … 1.0 (highly volatile).
 */
function assessValueVolatility(rawValue: string): number {
  let volatility = 0;

  for (const pattern of VOLATILE_VALUE_PATTERNS) {
    if (pattern.test(rawValue)) {
      volatility += 0.25; // Each matching pattern adds 25% volatility
    }
  }

  // Very short values (≤2 chars) are often flags or booleans — stable.
  // Very long values (>2000 chars) are often HTML blobs — treat as partial.
  if (rawValue.length > 2000) volatility += 0.10;

  return Math.min(1.0, volatility);
}

/**
 * Compute the reliability score for a single evidence item.
 *
 * Scoring model:
 *   base              = confidence from extractEvidenceFromScrape (0.0–1.0)
 *   volatility_penalty = value volatility × 0.5  (max −0.50)
 *   key_penalty       = −1.0 if the key is in VOLATILE_KEYS
 *   structure_bonus   = +0.05 if backed by structured data
 *   delta_correction  = fix-cycle delta for this key (±0.10 max)
 *   final             = clamp(base − penalties + bonuses + delta, 0.0, 1.0)
 */
function scoreEvidence(
  item: SSFREvidenceItem,
  rawValueStr: string,
): {
  base: number;
  volatility_penalty: number;
  structure_bonus: number;
  delta_correction: number;
  final: number;
} {
  // Hard disqualification for intrinsically volatile keys
  if (VOLATILE_KEYS.has(item.evidence_key)) {
    return { base: 0, volatility_penalty: 1, structure_bonus: 0, delta_correction: 0, final: 0 };
  }

  const base = typeof item.confidence === 'number' ? Math.max(0, Math.min(1, item.confidence)) : 0.8;

  // Volatility penalty — scaled by 0.5 so a fully volatile value removes at
  // most 0.5 points, not disqualifying structurally-stable values entirely.
  const rawVolatility = assessValueVolatility(rawValueStr);
  const volatility_penalty = rawVolatility * 0.5;

  // Structure bonus: evidence backed by structured data (schema.org JSON-LD,
  // robots.txt, canonical links) is more stable than body text extraction.
  const structure_bonus =
    item.source === 'schema_org' || item.source === 'json_ld' || STABLE_KEYS.has(item.evidence_key)
      ? 0.05
      : 0;

  // Fix-cycle delta: learned from previous manual corrections
  const delta_correction = getDelta(item.evidence_key);

  const final = Math.max(0, Math.min(1, base - volatility_penalty + structure_bonus + delta_correction));

  return { base, volatility_penalty, structure_bonus, delta_correction, final };
}

// ── Citation Handle generator ─────────────────────────────────────────────────

/**
 * Compute the Citation Handle — a sha256 fingerprint that:
 *   - Encodes the exact evidence key and source
 *   - Encodes a stable snapshot of the value (first 512 chars)
 *   - Anchors to the html_hash of the page render
 *
 * This handle allows downstream consumers to resolve a citation back to the
 * exact rendered HTML that produced it.
 */
function computeHandle(
  evidenceKey: string,
  source: string,
  stableValue: string,
  htmlHash: string,
): string {
  return crypto
    .createHash('sha256')
    .update(`${evidenceKey}:${source}:${stableValue.slice(0, 512)}:${htmlHash}`)
    .digest('hex');
}

// ── Stable cite ID ─────────────────────────────────────────────────────────────

function citeId(evidenceKey: string, source: string): string {
  return crypto
    .createHash('sha1')
    .update(`${evidenceKey}:${source}`)
    .digest('hex')
    .slice(0, 16);
}

/** Convert an evidence value to its human-readable signal string (≤120 chars) */
function toSignal(evidenceKey: string, value: unknown): string {
  if (typeof value === 'string') return value.slice(0, 120);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `${value.length} item(s)`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value as object).join(', ');
    return keys ? `{${keys.slice(0, 80)}}` : 'structured data present';
  }
  return 'present';
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface CitationFilterOptions {
  /** SHA-256 of the raw HTML snapshot (mandatory — ties every cite to its source) */
  htmlHash: string;
  /** Override the acceptance threshold (defaults to CITATION_THRESHOLD = 0.98) */
  threshold?: number;
}

/**
 * Filter a batch of evidence items through the citation reliability scorer.
 *
 * Returns one `CitationFilterResult` per input item.
 * - `accepted: true`  → cite received a Citation Handle and should be emitted
 * - `accepted: false` → cite was rejected; log the reason, do NOT emit to stream
 *
 * @param items   - Raw evidence items from evidenceExtractor
 * @param options - Must include htmlHash anchoring cites to the page render
 */
export function filterCitations(
  items: SSFREvidenceItem[],
  options: CitationFilterOptions,
): CitationFilterResult[] {
  const { htmlHash, threshold = CITATION_THRESHOLD } = options;

  return items.map((item): CitationFilterResult => {
    const rawValueStr = toSignal(item.evidence_key, item.value);
    const scoreBreakdown = scoreEvidence(item, rawValueStr);

    const accepted = scoreBreakdown.final >= threshold;
    const citation_handle = accepted
      ? computeHandle(item.evidence_key, item.source, rawValueStr, htmlHash)
      : null;

    let rejection_reason: string | undefined;
    if (!accepted) {
      if (VOLATILE_KEYS.has(item.evidence_key)) {
        rejection_reason = `evidence_key '${item.evidence_key}' is classified as intrinsically volatile`;
      } else if (scoreBreakdown.volatility_penalty > 0.2) {
        rejection_reason = `value volatility too high (penalty: ${scoreBreakdown.volatility_penalty.toFixed(3)})`;
      } else {
        rejection_reason = `reliability score ${scoreBreakdown.final.toFixed(4)} < threshold ${threshold}`;
      }
    }

    const cite: CiteEntry = {
      id: citeId(item.evidence_key, item.source),
      raw_evidence: rawValueStr,
      extracted_signal: `${item.evidence_key} — ${item.status}`,
      evidence_key: item.evidence_key,
      timestamp: Date.now(),
      reliability_score: scoreBreakdown.final,
      citation_handle,
      source_html_hash: htmlHash,
    };

    return {
      cite,
      accepted,
      rejection_reason,
      score_breakdown: scoreBreakdown,
    };
  });
}

/**
 * Compute the HTML snapshot hash.
 * Call once per scrape — pass the returned hash to `filterCitations()`.
 * The hash is immutable: same HTML → same hash, always.
 */
export function hashHtmlSnapshot(html: string): string {
  return crypto.createHash('sha256').update(html, 'utf8').digest('hex');
}
