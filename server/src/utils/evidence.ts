/**
 * Build a structured evidence object with verifiable proof
 * @param {Object} params - Evidence parameters
 * @param {string} params.proof - The verifiable proof/data
 * @param {string} params.source - Source of the evidence
 * @param {string} params.verifiedBy - Who/what verified this evidence
 * @param {string} params.description - Description of the evidence
 * @returns {Object} Structured evidence object
 */
export function buildEvidence({ proof, source, verifiedBy = null, description }: { proof: string | null; source?: string | null; verifiedBy?: string | null; description?: string | null }) {
  if (proof) {
    return {
      status: 'verified',
      proof,
      source: source || null,
      verifiedBy: verifiedBy || null,
      description: description || null,
      timestamp: new Date().toISOString()
    };
  } else {
    return {
      status: 'unknown',
      proof: null,
      source: source || null,
      description: description || 'No verifiable evidence was found.',
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Attach evidence object to a claim
 * @param {Object} claim - The claim object
 * @param {Object} evidenceObj - The evidence object to attach
 * @returns {Object} Claim with attached evidence
 */
export function attachEvidenceToClaim(claim: any, evidenceObj: any) {
  return { ...claim, evidence: evidenceObj };
}

/**
 * Validate and normalize evidence array from AI response
 * @param {Array} evidenceArray - Array of evidence items
 * @returns {Array} Normalized evidence array with structured objects
 */
export function normalizeEvidenceArray(evidenceArray: any[]) {
  if (!Array.isArray(evidenceArray)) {
    return [];
  }

  const UNKNOWN_EVIDENCE_WARN_THRESHOLD = 3;
  let unknownEvidenceCount = 0;

  const normalizedEvidence = evidenceArray.map(item => {
    const hasProof = item.evidence && item.evidence.trim().length > 0;
    if (!hasProof) unknownEvidenceCount++;

    const provider = typeof item?.provider === 'string' ? item.provider.trim() : '';
    const model =
      typeof item?.model === 'string'
        ? item.model.trim()
        : typeof item?.sourceModel === 'string'
          ? item.sourceModel.trim()
          : '';
    const explicitVerifier =
      typeof item?.verifiedBy === 'string'
        ? item.verifiedBy.trim()
        : typeof item?.verifier === 'string'
          ? item.verifier.trim()
          : '';
    const verificationTimestamp =
      typeof item?.verificationTimestamp === 'string' ? item.verificationTimestamp.trim() : '';

    const verifierLabel =
      explicitVerifier ||
      [provider, model].filter((part: string) => part.length > 0).join(' / ') ||
      'AI Provider';

    const verifierWithTimestamp = verificationTimestamp
      ? `${verifierLabel} @ ${verificationTimestamp}`
      : verifierLabel;

    return {
      category: item.category || 'General',
      finding: item.finding || 'No finding specified',
      evidence: buildEvidence({
        proof: hasProof ? item.evidence : null,
        source: item.source || 'AI Analysis',
        verifiedBy: verifierWithTimestamp,
        description: hasProof ? item.evidence : 'Evidence data not available for this finding'
      }),
      impact: item.impact || 'unknown',
      recommendation: item.recommendation || 'No recommendation provided',
      rawEvidence: item.evidence || null
    };
  });

  if (unknownEvidenceCount >= UNKNOWN_EVIDENCE_WARN_THRESHOLD) {
    console.warn(
      `[evidence] High unknown evidence ratio: ${unknownEvidenceCount}/${normalizedEvidence.length} items have no verifiable proof.`,
    );
  }

  return normalizedEvidence;
}
