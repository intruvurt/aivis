/**
 * Evidence types for AI visibility analysis
 */

export interface Evidence {
  id: string;
  audit_id: string;
  type: EvidenceType;
  source: string;
  content: string;
  relevance_score: number;
  extracted_at: string;
}

export type EvidenceType =
  | 'schema_markup'
  | 'meta_tags'
  | 'heading_structure'
  | 'faq_content'
  | 'structured_data'
  | 'citation'
  | 'entity';

export interface EvidenceExtraction {
  url: string;
  evidences: Evidence[];
  extraction_time_ms: number;
}

export interface CitationEvidence {
  text: string;
  source_url: string;
  context: string;
  confidence: number;
}

export interface EntityEvidence {
  name: string;
  type: string;
  mentions: number;
  contexts: string[];
}