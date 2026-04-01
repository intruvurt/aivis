/**
 * Build a structured evidence object with verifiable proof
 * @param {Object} params - Evidence parameters
 * @param {string} params.proof - The verifiable proof/data
 * @param {string} params.source - Source of the evidence
 * @param {string} params.verifiedBy - Who/what verified this evidence
 * @param {string} params.description - Description of the evidence
 * @returns {Object} Structured evidence object
 */
export function buildEvidence({ proof, source, verifiedBy, description }) {
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
export function attachEvidenceToClaim(claim, evidenceObj) {
  return { ...claim, evidence: evidenceObj };
}

/**
 * Validate and normalize evidence array from AI response
 * @param {Array} evidenceArray - Array of evidence items
 * @returns {Array} Normalized evidence array with structured objects
 */
export function normalizeEvidenceArray(evidenceArray) {
  if (!Array.isArray(evidenceArray)) {
    return [];
  }

  return evidenceArray.map(item => {
    const hasProof = item.evidence && item.evidence.trim().length > 0;
    
    return {
      category: item.category || 'General',
      finding: item.finding || 'No finding specified',
      evidence: buildEvidence({
        proof: hasProof ? item.evidence : null,
        source: item.source || 'AI Analysis',
        verifiedBy: 'AI Provider',
        description: hasProof ? item.evidence : 'Evidence data not available for this finding'
      }),
      impact: item.impact || 'unknown',
      recommendation: item.recommendation || 'No recommendation provided',
      rawEvidence: item.evidence || null
    };
  });
}
