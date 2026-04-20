/**
 * TruthArbiterService — the single source of final output truth.
 *
 * ARCHITECTURAL RULE (from AGENTS.md):
 *   No UI, API, or AI response may fabricate visibility scores, authority
 *   claims, or presence assertions. All final output MUST pass through this
 *   service. No AI output is written to the response layer without
 *   TruthArbiter validation.
 *
 * Signal flow:
 *   AI inference output         ─┐
 *   citationTester evidence     ─┤→ TruthArbiter → ValidatedResult
 *   SERP signals                ─┤   (or REJECTED with reason)
 *   mention signals             ─┘
 *
 * Validity classification:
 *   CONFIRMED   — claim is backed by ≥1 citation source + no negative NER
 *   PROBABLE    — claim is backed by SERP or mention signals but no direct citation
 *   UNCITED     — claim exists only in AI inference; surfaced as gap
 *   DISPUTED    — claim contradicted by another signal layer; score penalty applied
 *   REJECTED    — claim fails structural validation (no source, hallucination markers)
 */

export type ValidityClass = 'CONFIRMED' | 'PROBABLE' | 'UNCITED' | 'DISPUTED' | 'REJECTED';

export interface SignalLayer {
    /** Raw text from the AI inference output */
    aiOutput: string;
    /** Citation records from citationTester (may be empty array) */
    citationSources: CitationSignal[];
    /** SERP signal boosts from serpService (may be null when tier < alignment) */
    serpSignals?: SerpSignal | null;
    /** Mention signals from mentionTracker (may be empty array) */
    mentionSignals?: MentionSignal[];
}

export interface CitationSignal {
    url: string;
    platform: 'chatgpt' | 'perplexity' | 'claude' | 'google_ai' | string;
    cited: boolean;
    excerpt?: string;
    confidence: number; // 0–1
}

export interface SerpSignal {
    entity_clarity_boost: number; // delta applied to entity_clarity_score
    authority_boost: number;      // delta applied to authority_score
    organic_position?: number;
}

export interface MentionSignal {
    source: string;
    url: string;
    sentiment?: 'positive' | 'neutral' | 'negative';
    confidence: number; // 0–1
}

export interface ArbitratedResult {
    /** Final validity classification — ONLY this is written to ledger/response */
    validity: ValidityClass;
    /**
     * Final confidence score (0–100).
     * Derived from citation coverage + signal corroboration.
     * AI inference alone cannot set this above 50 (UNCITED cap).
     */
    confidence_score: number;
    /**
     * Summary of which signals corroborated or disputed the claim.
     * Included in ledger for traceability.
     */
    evidence_summary: string;
    /**
     * Whether this result is safe to include in the final API response.
     * REJECTED claims must not be surfaced to the response layer.
     */
    is_ledger_approved: boolean;
    /** Signal counts for transparency */
    signal_counts: {
        citations_confirmed: number;
        citations_total: number;
        serp_boost_applied: boolean;
        mention_count: number;
    };
}

// ─── Score caps by ValidityClass ──────────────────────────────────────────────

const VALIDITY_SCORE_CAP: Record<ValidityClass, number> = {
    CONFIRMED: 100,
    PROBABLE: 74,   // SERP/mention-only: good but not citation-verified
    UNCITED: 50,    // AI-only: present in inference but no external confirmation
    DISPUTED: 30,   // Contradictory signals
    REJECTED: 0,    // Hard hallucination / structural failure
};

/** Classes that are safe to write to the ledger and response layer. */
const LEDGER_APPROVED_CLASSES = new Set<ValidityClass>(['CONFIRMED', 'PROBABLE', 'UNCITED', 'DISPUTED']);

// ─── Hallucination marker phrases ────────────────────────────────────────────

const HALLUCINATION_MARKERS = [
    'as an ai language model',
    'i cannot browse',
    'i do not have access to',
    'i cannot verify',
    'as of my knowledge cutoff',
    'i am not able to access',
    'this is a fictional',
];

// ─── Core arbitration logic ───────────────────────────────────────────────────

/**
 * Arbitrate all available signals and return a single ValidatedResult.
 *
 * This is the ONLY function that may produce a result object written to
 * the ledger or API response. All callers must go through here.
 */
export function arbitrate(signals: SignalLayer): ArbitratedResult {
    const { aiOutput, citationSources, serpSignals, mentionSignals = [] } = signals;

    // ── 1. REJECT on hallucination markers ──────────────────────────────────
    const aiLower = aiOutput.toLowerCase();
    const hasHallucinationMarker = HALLUCINATION_MARKERS.some((m) => aiLower.includes(m));
    if (hasHallucinationMarker) {
        return {
            validity: 'REJECTED',
            confidence_score: 0,
            evidence_summary: 'AI output contains hallucination marker phrase. Claim rejected.',
            is_ledger_approved: false,
            signal_counts: {
                citations_confirmed: 0,
                citations_total: citationSources.length,
                serp_boost_applied: false,
                mention_count: mentionSignals.length,
            },
        };
    }

    // ── 2. Score structural integrity ────────────────────────────────────────
    if (!aiOutput || aiOutput.trim().length < 10) {
        return {
            validity: 'REJECTED',
            confidence_score: 0,
            evidence_summary: 'AI output is empty or too short to evaluate.',
            is_ledger_approved: false,
            signal_counts: {
                citations_confirmed: 0,
                citations_total: citationSources.length,
                serp_boost_applied: false,
                mention_count: mentionSignals.length,
            },
        };
    }

    // ── 3. Count confirmed citations ──────────────────────────────────────────
    const confirmedCitations = citationSources.filter((c) => c.cited && c.confidence >= 0.5);
    const citationScore = confirmedCitations.length > 0
        ? Math.min(100, 40 + confirmedCitations.length * 15 +
            confirmedCitations.reduce((sum, c) => sum + c.confidence, 0) * 10)
        : 0;

    // ── 4. Add SERP boost ─────────────────────────────────────────────────────
    const serpBoost = serpSignals
        ? Math.min(15, (serpSignals.entity_clarity_boost + serpSignals.authority_boost) / 2)
        : 0;

    // ── 5. Add mention signal weight ─────────────────────────────────────────
    const positiveMentions = mentionSignals.filter(
        (m) => m.sentiment !== 'negative' && m.confidence >= 0.4,
    );
    const mentionBoost = Math.min(10, positiveMentions.length * 2);

    // ── 6. Classify validity ─────────────────────────────────────────────────
    let validity: ValidityClass;
    if (confirmedCitations.length >= 1) {
        // Check for dispute: negative mentions > positive mentions
        const negativeMentions = mentionSignals.filter((m) => m.sentiment === 'negative');
        if (negativeMentions.length > positiveMentions.length && negativeMentions.length >= 2) {
            validity = 'DISPUTED';
        } else {
            validity = 'CONFIRMED';
        }
    } else if (serpBoost > 5 || positiveMentions.length >= 2) {
        validity = 'PROBABLE';
    } else if (citationSources.length > 0 && citationSources.every((c) => !c.cited)) {
        // All citation tests returned false = explicitly not cited
        validity = 'UNCITED';
    } else {
        // No citation test run or all inconclusive
        validity = 'UNCITED';
    }

    // ── 7. Compute final score (capped by validity class) ────────────────────
    const rawScore = Math.round(citationScore + serpBoost + mentionBoost);
    const cap = VALIDITY_SCORE_CAP[validity];
    const confidence_score = Math.min(cap, Math.max(0, rawScore));

    // ── 8. Build evidence summary ─────────────────────────────────────────────
    const summaryParts: string[] = [];
    if (confirmedCitations.length > 0) {
        summaryParts.push(
            `${confirmedCitations.length} citation(s) confirmed on: ${confirmedCitations.map((c) => c.platform).join(', ')}.`,
        );
    } else {
        summaryParts.push(`No confirmed citations (${citationSources.length} platform(s) tested).`);
    }
    if (serpSignals) {
        summaryParts.push(`SERP boost: +${serpBoost.toFixed(1)} pts.`);
    }
    if (positiveMentions.length > 0) {
        summaryParts.push(`${positiveMentions.length} positive external mention(s).`);
    }

    return {
        validity,
        confidence_score,
        evidence_summary: summaryParts.join(' '),
        is_ledger_approved: LEDGER_APPROVED_CLASSES.has(validity),
        signal_counts: {
            citations_confirmed: confirmedCitations.length,
            citations_total: citationSources.length,
            serp_boost_applied: serpBoost > 0,
            mention_count: mentionSignals.length,
        },
    };
}

/**
 * Batch arbitrate a list of claim signals.
 * Returns only ledger-approved results; rejected claims are filtered.
 */
export function arbitrateBatch(
    signalBatch: SignalLayer[],
): ArbitratedResult[] {
    return signalBatch
        .map(arbitrate)
        .filter((r) => r.is_ledger_approved);
}

/**
 * Produce an aggregate confidence score from an array of ArbitratedResults.
 * Used by the scoring engine to derive the final visibility score.
 *
 * Weighting:
 *   CONFIRMED  = weight 1.0
 *   PROBABLE   = weight 0.6
 *   UNCITED    = weight 0.2  (these exist as gaps, still affect score)
 *   DISPUTED   = weight 0.1
 */
export function aggregateConfidenceScore(results: ArbitratedResult[]): number {
    if (results.length === 0) return 0;

    const WEIGHT: Record<ValidityClass, number> = {
        CONFIRMED: 1.0,
        PROBABLE: 0.6,
        UNCITED: 0.2,
        DISPUTED: 0.1,
        REJECTED: 0,
    };

    const totalWeight = results.reduce((sum, r) => sum + WEIGHT[r.validity], 0);
    const weightedSum = results.reduce(
        (sum, r) => sum + r.confidence_score * WEIGHT[r.validity],
        0,
    );

    return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
}

/**
 * Validate that a set of results satisfies the No-Score-Without-Evidence rule.
 * Throws if any result with a non-zero score lacks ledger approval.
 *
 * AGENTS.md §1: "No UI, API, or AI response may fabricate visibility scores."
 */
export function assertNoScoreWithoutEvidence(results: ArbitratedResult[]): void {
    const violations = results.filter((r) => !r.is_ledger_approved && r.confidence_score > 0);
    if (violations.length > 0) {
        throw new Error(
            `[TruthArbiter] INTEGRITY VIOLATION: ${violations.length} result(s) have non-zero ` +
            `confidence_score but are not ledger-approved. REJECTED claims must have score=0.`,
        );
    }
}
