/**
 * CITE LEDGER - Constitutional Truth Layer
 *
 * Every insight, score, and fix in AIVIS must ultimately resolve back to
 * immutable cite entries. This is not a feature—it's the foundational
 * evidence graph that makes the entire platform auditable, provable, and trustworthy.
 */

/**
 * SOURCE TYPES - Where evidence originates
 */
export type CiteSourceType =
  | "html_crawl" // Raw HTML parsing from target URL
  | "json_ld_schema" // Structured data from page
  | "og_tags" // Open Graph / social meta
  | "serp_result" // External SERP mention
  | "backlink" // Link graph signal
  | "registry_match" // Historical pattern match
  | "ai_extraction" // AI model interpretation
  | "server_metadata" // HTTP headers, response codes
  | "entity_reference" // Cross-entity link
  | "audit_comparison"; // Before/after evidence

/**
 * CITE ENTRY - Atomic unit of verifiable evidence
 *
 * Non-negotiable properties:
 * - Source type must be explicit
 * - Raw evidence must be preserved unchanged
 * - Interpretation must be separate from raw data
 * - Confidence must be quantified
 * - Hash enables tamper detection and deduplication
 */
export interface CiteEntry {
  // Identification
  id: string; // UUID, immutable
  url: string; // Target URL analyzed
  audit_id?: string; // Parent audit reference

  // Source tracking
  source_type: CiteSourceType;
  source_metadata?: {
    crawl_timestamp?: number;
    http_status?: number;
    header_signature?: string;
    selector?: string; // CSS/XPath for HTML sources
    model_name?: string; // AI model if AI extraction
    [key: string]: unknown;
  };

  // Evidence preservation (immutable)
  raw_evidence: string; // Original extracted data, unchanged
  raw_evidence_hash: string; // SHA-256 of raw evidence

  // Interpretation (separate from raw)
  extracted_signal: string; // What the evidence means
  entity_refs: EntityReference[]; // Entities mentioned in signal

  // Credibility
  confidence_score: number; // 0.0-1.0
  confidence_basis?: string; // Why we trust this confidence level

  // Audit trail
  interpretation: string; // How signal connects to findings
  related_findings?: string[]; // Finding IDs that depend on this cite
  related_fixes?: string[]; // Fix IDs derived from this cite

  // Temporal
  created_at: number; // Unix timestamp (immutable)
  updated_at: number; // If recalculated
  expires_at?: number; // When evidence becomes stale

  // Tamper detection
  ledger_hash: string; // SHA-256 of this entire entry
  previous_hash?: string; // Chain link to prior version

  // Metadata
  tags?: string[]; // "entity-dilution", "missing-canonical", etc.
  [key: string]: unknown; // Extensibility
}

/**
 * ENTITY REFERENCE - Link between cite entry and entities
 */
export interface EntityReference {
  entity_id?: string; // If registered in entity graph
  entity_name: string;
  entity_type: "organization" | "person" | "product" | "service" | "brand";
  confidence: number; // 0.0-1.0
  context?: string; // Why this entity is mentioned
}

/**
 * REGISTRY ENTRY - Pattern library derived from cite entries
 *
 * NOT raw data storage—learned patterns from cite ledger.
 * Each registry entry is backed by cite IDs for full traceability.
 */
export interface RegistryEntry {
  // Identification
  fingerprint: string; // Hash of issue signature
  detected_pattern: string; // "missing-canonical", "entity-dilution", etc.

  // Evidence lineage
  related_cite_ids: string[]; // All cites that built this pattern
  cite_count: number; // How many times seen

  // Pattern metadata
  first_seen: number; // Earliest cite timestamp
  last_seen: number; // Most recent cite timestamp
  recency_decay: number; // 0.0-1.0 (how stale is it?)

  // Fix tracking
  fix_history: FixAction[]; // Attempts to remediate
  success_rate: number; // How often fixes work
  avg_confidence: number; // Average confidence across cites

  // Metadata
  urls: string[]; // All unique URLs with this pattern
  entity_refs?: EntityReference[];
  [key: string]: unknown;
}

/**
 * FIX ACTION - Remediation backed by cite evidence
 *
 * Every fix recommendation must cite why it's needed.
 * Every fix result must cite what changed.
 */
export interface FixAction {
  id: string;
  registry_fingerprint: string; // Which pattern it addresses
  cite_ids: string[]; // Evidence supporting this fix

  // What to fix
  category: string; // "schema", "content", "structure", etc.
  finding_type: string; // Specific issue
  description: string;

  // How to fix it
  action_type: "add" | "update" | "remove" | "reorder";
  target_selector?: string; // DOM selector or page section
  before_value?: string; // Current value (from cite)
  after_value?: string; // Proposed value
  implementation_code?: string; // Example fix

  // Expected impact
  expected_effect: string; // What improves (semantic, technical, authority)
  confidence_in_effect: number; // 0.0-1.0

  // Status
  status: "proposed" | "implemented" | "verified" | "reverted";
  timestamp: number;
  result_cite_ids?: string[]; // Cites proving fix worked

  [key: string]: unknown;
}

/**
 * VISIBILITY SCORE - Derived from cite ledger
 *
 * NOT a black box. Every point is traceable to cite entries.
 */
export interface ScoreWithEvidence {
  total_score: number; // 0-100
  score_timestamp: number; // When calculated

  // Category scores (each must cite its evidence)
  categories: {
    name: string; // "Content Depth", "Schema", etc.
    weight: number; // 0.0-1.0, sums to 1.0
    raw_score: number; // 0-100
    evidence_cite_ids: string[]; // All cites that built this score
    supporting_cites: number; // Count of supporting evidence
  }[];

  // Audit trail
  created_from_cite_ids: string[]; // All cites included in this score
  score_methodology: string; // How score was calculated
  confidence_in_score: number; // 0.0-1.0

  // Reasoning (expandable in UI)
  reasoning: {
    strong_areas: string[]; // Why score is this high
    weak_areas: string[]; // Why it's not higher
    next_highest_impact_fixes: string[]; // Fix IDs to improve most
  };
}

/**
 * AUDIT RESULT - Links all layers
 *
 * Immutable record of what was found, when, and why.
 */
export interface AuditWithCiteLedger {
  audit_id: string;
  url: string;
  user_id: string;
  workspace_id?: string;

  // When audited
  created_at: number;
  completed_at?: number;

  // What was found (backed by cite ledger)
  cite_entry_ids: string[]; // All evidence gathered
  cite_count: number;

  // Scores (all derived from cites)
  visibility_score: ScoreWithEvidence;

  // Findings (each cites its evidence)
  findings: {
    id: string;
    category: string;
    severity: "critical" | "high" | "medium" | "low";
    description: string;
    cite_ids: string[]; // Proof this finding exists
    related_fixes: FixAction[]; // Remediation options
  }[];

  // Reproducibility
  audit_hash: string; // Full audit checksum
  is_reproducible: boolean; // Can re-run same cites?

  [key: string]: unknown;
}

/**
 * CITE LEDGER API RESPONSES
 * These prove the truth layer is working
 */
export interface CiteExpansionResponse {
  cite: CiteEntry;
  context: {
    related_cites: CiteEntry[];
    registry_patterns: RegistryEntry[];
    associated_fixes: FixAction[];
  };
  chain_provenance: {
    why_this_cite_matters: string;
    how_score_depends_on_it: string;
    recommendation_impact: string;
  };
}

/**
 * CITE LEDGER STATS - Platform health
 */
export interface CiteLedgerStats {
  total_entries: number;
  entries_last_24h: number;
  unique_urls: number;
  average_entries_per_audit: number;
  source_type_distribution: Record<CiteSourceType, number>;
  average_confidence: number;
  registry_patterns_learned: number;
  most_common_patterns: Array<{
    pattern: string;
    count: number;
    success_rate: number;
  }>;
}
