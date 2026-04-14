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

/**
 * Validate and normalize an array of raw evidence items
 */
export function normalizeEvidenceArray(evidenceArray: unknown): NormalizedEvidenceItem[] {
  if (!Array.isArray(evidenceArray)) return [];

  return evidenceArray.map((item: RawEvidenceItem) => {
    const raw = typeof item?.evidence === 'string' ? item.evidence.trim() : '';
    const hasProof = raw.length > 0;

    return {
      category: typeof item?.category === 'string' ? item.category : 'General',
      finding: typeof item?.finding === 'string' ? item.finding : 'No finding specified',
      evidence: buildEvidence({
        proof: hasProof ? raw : null,
        source: typeof item?.source === 'string' ? item.source : 'AI Analysis',
        verifiedBy: 'AI Provider',
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
}