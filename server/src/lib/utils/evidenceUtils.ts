// Evidence utilities for Evidence-backed site analysis for AI answers Platform

export type EvidenceStatus = 'verified' | 'unknown';

export interface Evidence {
  status: EvidenceStatus;
  proof: string | null;
  source: string | null;
  verifiedBy: string | null;
  description: string | null;
  timestamp: string;
}

export interface BuildEvidenceParams {
  proof: string | null;
  source?: string | null;
  verifiedBy?: string | null;
  description?: string | null;
}

/**
 * Build a structured evidence object with verifiable proof
 */
export function buildEvidence({
  proof,
  source = null,
  verifiedBy = null,
  description = null,
}: BuildEvidenceParams): Evidence {
  const timestamp = new Date().toISOString();
  const hasProof = proof != null && String(proof).trim().length > 0;

  return {
    status: hasProof ? 'verified' : 'unknown',
    proof: hasProof ? String(proof) : null,
    source,
    verifiedBy,
    description: hasProof ? description : description || 'No verifiable evidence was found.',
    timestamp,
  };
}

/**
 * Attach an evidence object to a claim
 */
export function attachEvidenceToClaim<T>(claim: T, evidenceObj: Evidence): T & { evidence: Evidence } {
  return { ...claim, evidence: evidenceObj };
}

export interface RawEvidenceItem {
  category?: unknown;
  finding?: unknown;
  evidence?: unknown;
  source?: unknown;
  verifiedBy?: unknown;
  verifier?: unknown;
  model?: unknown;
  provider?: unknown;
  sourceModel?: unknown;
  verificationTimestamp?: unknown;
  impact?: unknown;
  recommendation?: unknown;
}

export interface NormalizedEvidenceItem {
  category: string;
  finding: string;
  evidence: Evidence;
  impact: string;
  recommendation: string;
  rawEvidence: string | null;
}

export interface NormalizeEvidenceContext {
  auditId?: string;
  model?: string;
  provider?: string;
  requestId?: string;
  source?: string;
  sourceModel?: string;
  url?: string;
  verificationTimestamp?: string;
  verifiedBy?: string;
}

/**
 * Validate and normalize an array of raw evidence items
 */
export function normalizeEvidenceArray(
  evidenceArray: unknown,
  context: NormalizeEvidenceContext = {},
): NormalizedEvidenceItem[] {
  if (!Array.isArray(evidenceArray)) return [];

  const UNKNOWN_EVIDENCE_WARN_THRESHOLD = 3;
  let unknownEvidenceCount = 0;

  const normalized = evidenceArray.map((item: RawEvidenceItem) => {
    const raw = typeof item?.evidence === 'string' ? item.evidence.trim() : '';
    const hasProof = raw.length > 0;
    if (!hasProof) unknownEvidenceCount++;

    const provider =
      typeof item?.provider === 'string'
        ? item.provider.trim()
        : typeof context.provider === 'string'
          ? context.provider.trim()
          : '';
    const model =
      typeof item?.model === 'string'
        ? item.model.trim()
        : typeof item?.sourceModel === 'string'
          ? item.sourceModel.trim()
          : typeof context.model === 'string'
            ? context.model.trim()
            : typeof context.sourceModel === 'string'
              ? context.sourceModel.trim()
              : '';
    const explicitVerifier =
      typeof item?.verifiedBy === 'string'
        ? item.verifiedBy.trim()
        : typeof item?.verifier === 'string'
          ? item.verifier.trim()
          : typeof context.verifiedBy === 'string'
            ? context.verifiedBy.trim()
            : '';
    const verificationTimestamp =
      typeof item?.verificationTimestamp === 'string'
        ? item.verificationTimestamp.trim()
        : typeof context.verificationTimestamp === 'string'
          ? context.verificationTimestamp.trim()
          : '';

    const verifierLabel =
      explicitVerifier ||
      [provider, model].filter((part) => part.length > 0).join(' / ') ||
      'AI Provider';

    const verifierWithTimestamp = verificationTimestamp
      ? `${verifierLabel} @ ${verificationTimestamp}`
      : verifierLabel;

    return {
      category: typeof item?.category === 'string' ? item.category : 'General',
      finding: typeof item?.finding === 'string' ? item.finding : 'No finding specified',
      evidence: buildEvidence({
        proof: hasProof ? raw : null,
        source:
          typeof item?.source === 'string'
            ? item.source
            : typeof context.source === 'string'
              ? context.source
              : 'AI Analysis',
        verifiedBy: verifierWithTimestamp,
        description: hasProof ? raw : 'Evidence data not available for this finding',
      }),
      impact: typeof item?.impact === 'string' ? item.impact : 'unknown',
      recommendation:
        typeof item?.recommendation === 'string'
          ? item.recommendation
          : 'No recommendation provided',
      rawEvidence: hasProof ? raw : null,
    };
  });

  if (unknownEvidenceCount >= UNKNOWN_EVIDENCE_WARN_THRESHOLD) {
    const firstContext = {
      ...context,
      ...((evidenceArray.find((item) => item && typeof item === 'object') ?? {}) as Record<string, unknown>),
    } as Record<string, unknown>;
    const contextBits = [
      typeof firstContext.auditId === 'string' ? `audit=${firstContext.auditId}` : null,
      typeof firstContext.requestId === 'string' ? `request=${firstContext.requestId}` : null,
      typeof firstContext.url === 'string' ? `url=${firstContext.url}` : null,
      typeof firstContext.model === 'string' ? `model=${firstContext.model}` : null,
      typeof firstContext.sourceModel === 'string' ? `sourceModel=${firstContext.sourceModel}` : null,
    ].filter((value): value is string => Boolean(value));
    console.warn(
      `[evidence] High unknown evidence ratio: ${unknownEvidenceCount}/${normalized.length} items have no verifiable proof${contextBits.length ? ` (${contextBits.join(', ')})` : ''}.`,
    );
  }

  return normalized;
}