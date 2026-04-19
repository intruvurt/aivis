/**
 * AUDIT OUTPUT TYPES — Shared Contract for Enterprise Audit Engine
 *
 * These types define the output format for the hardened audit system.
 * Used across server (audit generation) and client (display/export).
 */

import type { CanonicalTier } from "../types.js";

export interface AuditEvidenceRecord {
  evidence_id: string;
  type:
    | "html"
    | "schema"
    | "serp"
    | "mention"
    | "directory"
    | "social"
    | "inference";
  source: string;
  extract: string;
  confidence: number; // 0.0-1.0
}

export interface AuditDimension {
  name: string;
  score: number; // 0.0-1.0
  status: "pass" | "warning" | "fail";
  findings: string[];
  evidence_ids: string[];
}

export interface AuditFinding {
  category: string;
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  evidence_ids: string[];
  remediation?: string;
}

export interface CiteMetadata {
  id: string; // Unique audit ID
  url: string;
  timestamp: string; // ISO 8601
  metadata_hash: string; // SHA256 of this record (CITE LEDGER compatible)
  tier: CanonicalTier;
}

export interface CiteLedgerReference {
  framework: string; // "CITE LEDGER™"
  definition_anchor: string; // URL to canonical definition block (https://aivis.biz#citation-core)
  evidence_model: string; // "BRAG (Based-Retrieval-Auditable-Grading)"
  specification_url: string; // URL to full specification
}

export interface AuditResult {
  // Metadata
  cite: CiteMetadata;
  cite_ledger: CiteLedgerReference; // Points all findings back to canonical framework

  // 8-Dimension Scoring
  dimensions: {
    entity_resolution: AuditDimension;
    indexation: AuditDimension;
    semantic_consistency: AuditDimension;
    citation_likelihood: AuditDimension;
    structured_data: AuditDimension;
    distributed_signals: AuditDimension;
    ai_parsability: AuditDimension;
    trust_vectors: AuditDimension;
  };

  // Composite Score
  overall_score: number; // 0.0-1.0
  visibility_category:
    | "invisible"
    | "minimal"
    | "found"
    | "recognized"
    | "prominent";

  // Critical Issues
  critical_findings: AuditFinding[];
  recommendations: AuditFinding[];

  // Evidence Ledger
  evidence: AuditEvidenceRecord[];

  // Metadata
  evidence_count: number;
  confidence_median: number;
}

// Audit request/response for API
export interface AuditRequest {
  url: string;
  tier?: CanonicalTier;
  include_evidence?: boolean;
}

export interface AuditAPIResponse {
  success: boolean;
  result?: AuditResult;
  error?: string;
}
