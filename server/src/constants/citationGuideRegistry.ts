export type CitationReasonCode =
  | 'CRAWLER_BLOCKED'
  | 'NO_STRUCTURED_DATA'
  | 'MISSING_ENTITY_IDENTITY'
  | 'NO_TITLE_OR_WEAK_TITLE'
  | 'NO_META_DESCRIPTION'
  | 'THIN_OR_NON_ANSWER_CONTENT'
  | 'WEAK_HEADING_STRUCTURE'
  | 'MISSING_LLM_GUIDANCE'
  | 'LOW_TRUST_LINK_SIGNALS'
  | 'SLOW_OR_UNSTABLE_TECHNICAL_SURFACE';

export interface CitationGuideReference {
  id: string;
  title: string;
  version: string;
  sha256: string;
  repoPath: string;
  sourceUri: string;
  registeredAt: string;
}

const AI_CITATION_REASONS_GUIDE: CitationGuideReference = {
  id: 'guide.ai-citation-reasons.v1',
  title: 'AI Citation Reasons Guide',
  version: '2026-04-28.1',
  sha256: '8D7621907E1119C89342F6B6903AFE9C7A95CB4FFB164BCB9CB2F8EA0F571961',
  repoPath: 'server/registry/citation-guides/ai_citation_reasons_guide.pdf',
  sourceUri: 'file:///C:/Users/Ma$e/Downloads/ai_citation_reasons_guide.pdf',
  registeredAt: '2026-04-28T00:00:00.000Z',
};

const EVIDENCE_KEY_TO_REASON: Record<string, CitationReasonCode> = {
  ai_crawler_access: 'CRAWLER_BLOCKED',
  robots_txt: 'CRAWLER_BLOCKED',
  json_ld_schemas: 'NO_STRUCTURED_DATA',
  organization_schema: 'MISSING_ENTITY_IDENTITY',
  same_as_links: 'MISSING_ENTITY_IDENTITY',
  author_entity: 'MISSING_ENTITY_IDENTITY',
  title_tag: 'NO_TITLE_OR_WEAK_TITLE',
  meta_description: 'NO_META_DESCRIPTION',
  word_count: 'THIN_OR_NON_ANSWER_CONTENT',
  tldr_block: 'THIN_OR_NON_ANSWER_CONTENT',
  question_headings: 'THIN_OR_NON_ANSWER_CONTENT',
  h1_heading: 'WEAK_HEADING_STRUCTURE',
  heading_hierarchy: 'WEAK_HEADING_STRUCTURE',
  llms_txt: 'MISSING_LLM_GUIDANCE',
  external_links: 'LOW_TRUST_LINK_SIGNALS',
  link_diversity: 'LOW_TRUST_LINK_SIGNALS',
  performance: 'SLOW_OR_UNSTABLE_TECHNICAL_SURFACE',
};

export function getCitationGuideReferences(): CitationGuideReference[] {
  return [AI_CITATION_REASONS_GUIDE];
}

export function getCitationGuideReferenceIds(): string[] {
  return getCitationGuideReferences().map((guide) => guide.id);
}

export function mapEvidenceKeyToCitationReason(
  evidenceKey: string,
): CitationReasonCode | null {
  return EVIDENCE_KEY_TO_REASON[evidenceKey] || null;
}
