/**
 * Deep Analysis Client - calls the Python FastAPI microservice.
 *
 * The Python service provides NLP-powered content analysis,
 * cryptographic evidence ledger, enhanced document parsing,
 * and content fingerprinting.
 *
 * Optional: if the Python service is unavailable, the Node pipeline
 * continues without deep analysis. Results merge into the audit
 * response under `deep_analysis`.
 */

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://127.0.0.1:3002';
const PYTHON_INTERNAL_KEY = process.env.PYTHON_INTERNAL_KEY || '';
const PYTHON_TIMEOUT_MS = 15_000; // 15s max per call

let _serviceAvailable: boolean | null = null;
let _lastHealthCheck = 0;
const HEALTH_CHECK_INTERVAL_MS = 60_000; // Re-check every 60s

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

/** Returns the last-known availability without triggering a new health check. */
export function getCachedPythonAvailability(): boolean {
  return _serviceAvailable === true;
}

export async function isPythonServiceAvailable(): Promise<boolean> {
  const now = Date.now();
  if (_serviceAvailable !== null && now - _lastHealthCheck < HEALTH_CHECK_INTERVAL_MS) {
    return _serviceAvailable;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3_000);

    const res = await fetch(`${PYTHON_SERVICE_URL}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    _serviceAvailable = res.ok;
    _lastHealthCheck = now;
    return _serviceAvailable;
  } catch {
    _serviceAvailable = false;
    _lastHealthCheck = now;
    return false;
  }
}

// ---------------------------------------------------------------------------
// Internal HTTP helper
// ---------------------------------------------------------------------------

async function pyPost<T = unknown>(path: string, body: Record<string, unknown>): Promise<T | null> {
  const available = await isPythonServiceAvailable();
  if (!available) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PYTHON_TIMEOUT_MS);

    const payload = { ...body, internal_key: PYTHON_INTERNAL_KEY };

    const res = await fetch(`${PYTHON_SERVICE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`[deep-analysis] Python ${path} returned ${res.status}`);
      return null;
    }

    return await res.json() as T;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[deep-analysis] Python ${path} failed: ${message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface DeepContentAnalysis {
  readability: {
    flesch_reading_ease: number;
    flesch_kincaid_grade: number;
    gunning_fog: number;
    reading_level: string;
    word_count: number;
    sentence_count: number;
    avg_sentence_length: number;
  };
  entities: {
    organizations: string[];
    products: string[];
    technologies: string[];
    people: string[];
    total_entity_count: number;
    entity_density: number;
  };
  semantic_density: {
    lexical_diversity: number;
    content_words_ratio: number;
    density_grade: string;
  };
  content_quality: {
    content_depth: string;
    definition_patterns: number;
    list_patterns: number;
    title_coherence: number;
    meta_relevance: number;
    ai_citability_signals: Record<string, boolean>;
  };
  question_coverage: {
    questions_found: number;
    ai_query_readiness: string;
    total_query_patterns: number;
  };
  evidence: Array<{
    id: string;
    source: string;
    key: string;
    value: unknown;
    verdict: string;
    detail: string;
  }>;
  processing_time_ms: number;
}

/**
 * Run deep NLP analysis on page content via the Python service.
 */
export async function analyzeContentDeep(params: {
  url: string;
  html?: string;
  text?: string;
  title?: string;
  meta_description?: string;
  headings?: string[];
  json_ld_blocks?: string[];
}): Promise<DeepContentAnalysis | null> {
  return pyPost<DeepContentAnalysis>('/analyze/content', params);
}

export interface EvidenceLedgerResult {
  audit_id: string;
  url: string;
  recorded_at: string;
  entry_count: number;
  root_hash: string;
  chain: Array<{
    sequence: number;
    evidence_id: string;
    content_hash: string;
    chain_hash: string;
  }>;
}

/**
 * Record evidence entries in the cryptographic ledger.
 */
export async function recordEvidenceLedger(params: {
  audit_id: string;
  url: string;
  evidence_entries: Array<Record<string, unknown>>;
}): Promise<EvidenceLedgerResult | null> {
  return pyPost<EvidenceLedgerResult>('/evidence/record', params);
}

/**
 * Verify integrity of an evidence chain.
 */
export async function verifyEvidenceLedger(params: {
  audit_id: string;
  url: string;
  evidence_entries: Array<Record<string, unknown>>;
}): Promise<{ chain_intact: boolean; root_hash: string } | null> {
  return pyPost('/evidence/verify', params);
}

export interface ContentFingerprint {
  url: string;
  fingerprint: string;
  token_count: number;
  method: string;
}

/**
 * Generate a content fingerprint for deduplication / change detection.
 */
export async function generateFingerprint(params: {
  text: string;
  url?: string;
}): Promise<ContentFingerprint | null> {
  return pyPost<ContentFingerprint>('/fingerprint/generate', params);
}

/**
 * Compare two content fingerprints.
 */
export async function compareFingerprints(params: {
  fingerprint_a: string;
  fingerprint_b: string;
}): Promise<{
  similarity_percent: number;
  is_near_duplicate: boolean;
  hamming_distance: number;
} | null> {
  return pyPost('/fingerprint/compare', params);
}

export interface DocumentAnalysis {
  filename: string;
  text: string;
  word_count: number;
  headings: string[];
  pages: number;
  title: string;
  nlp_analysis?: DeepContentAnalysis;
  processing_time_ms: number;
}

/**
 * Parse and analyze an uploaded document (PDF, DOCX, etc.)
 */
export async function analyzeDocument(params: {
  filename: string;
  content_base64: string;
  mime_type: string;
}): Promise<DocumentAnalysis | null> {
  return pyPost<DocumentAnalysis>('/analyze/document', params);
}

export interface RawDocumentEventPayload {
  docId: string;
  url: string;
  source: string;
  text: string;
  timestamp: number;
  engagement?: {
    likes?: number;
    upvotes?: number;
    comments?: number;
    shares?: number;
  };
}

export interface RawDocumentProcessResult {
  docId: string;
  edgesCreated: number;
  entitiesUpdated: string[];
  edges?: Array<{
    entityId: string;
    chunkId: string;
    docId: string;
    type: 'direct' | 'semantic' | 'paraphrase' | 'ai_summary';
    similarity: number;
    confidence: number;
    sourceAuthority: number;
    engagementScore: number;
    timestamp: number;
  }>;
}

/**
 * Process a normalized ingestion event through Python intelligence workers.
 */
export async function processRawDocumentEvent(
  params: RawDocumentEventPayload
): Promise<RawDocumentProcessResult | null> {
  return pyPost<RawDocumentProcessResult>('/process/raw-document', params as unknown as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// OCR Cross-Check
// ---------------------------------------------------------------------------

export interface OcrCrossCheckResult {
  url: string;
  evidence_quality: number;       // 0–100
  overlap_ratio: number;          // 0–1
  unique_ocr_terms: number;
  scrape_coverage_ratio: number;  // 0–1
  recommendation: 'use_scrape' | 'use_python_payload' | 'augment_with_ocr' | 'no_ocr_content';
  processing_time_ms: number;
}

/**
 * Cross-check OCR-extracted image text against scraped body content.
 * Used by Signal+ tiers for dynamic fallback decisions.
 */
export async function ocrCrossCheck(params: {
  url: string;
  scraped_text: string;
  ocr_texts: string[];
  scraped_word_count: number;
  ocr_word_count: number;
}): Promise<OcrCrossCheckResult | null> {
  return pyPost<OcrCrossCheckResult>('/analyze/ocr-crosscheck', params);
}
