/**
 * TruthArbiterService — unit tests
 *
 * Coverage focus:
 *   1. Hallucination marker → REJECTED, score=0, is_ledger_approved=false
 *   2. No citations → UNCITED, score ≤ 50 (UNCITED cap)
 *   3. Confirmed citations → CONFIRMED, score > 50
 *   4. SERP-only signals → PROBABLE, score ≤ 74
 *   5. Contradictory mentions → DISPUTED, score ≤ 30
 *   6. assertNoScoreWithoutEvidence throws on violation
 *   7. aggregateConfidenceScore weights by validity
 *   8. Empty AI output → REJECTED
 */

import { describe, expect, it } from 'vitest';
import {
    arbitrate,
    arbitrateBatch,
    aggregateConfidenceScore,
    assertNoScoreWithoutEvidence,
    type SignalLayer,
    type ArbitratedResult,
} from '../services/truthArbiterService.js';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const BASE_SIGNALS: SignalLayer = {
    aiOutput: 'The brand AcmeCorp appears prominently in AI answers about project management tools.',
    citationSources: [],
    serpSignals: null,
    mentionSignals: [],
};

const CONFIRMED_CITATION = {
    url: 'https://acmecorp.com',
    platform: 'chatgpt' as const,
    cited: true,
    excerpt: 'AcmeCorp is a top tool for project management.',
    confidence: 0.9,
};

const UNCONFIRMED_CITATION = {
    url: 'https://acmecorp.com',
    platform: 'perplexity' as const,
    cited: false,
    confidence: 0.8,
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('TruthArbiterService', () => {
    describe('arbitrate()', () => {
        it('rejects AI output containing hallucination marker phrase', () => {
            const result = arbitrate({
                ...BASE_SIGNALS,
                aiOutput: 'As an AI language model, I cannot verify this claim.',
                citationSources: [CONFIRMED_CITATION],
            });
            expect(result.validity).toBe('REJECTED');
            expect(result.confidence_score).toBe(0);
            expect(result.is_ledger_approved).toBe(false);
        });

        it('rejects empty AI output', () => {
            const result = arbitrate({ ...BASE_SIGNALS, aiOutput: '' });
            expect(result.validity).toBe('REJECTED');
            expect(result.confidence_score).toBe(0);
            expect(result.is_ledger_approved).toBe(false);
        });

        it('rejects whitespace-only AI output', () => {
            const result = arbitrate({ ...BASE_SIGNALS, aiOutput: '   ' });
            expect(result.validity).toBe('REJECTED');
            expect(result.confidence_score).toBe(0);
            expect(result.is_ledger_approved).toBe(false);
        });

        it('classifies as UNCITED when no citation sources provided', () => {
            const result = arbitrate(BASE_SIGNALS);
            expect(result.validity).toBe('UNCITED');
            expect(result.confidence_score).toBeLessThanOrEqual(50);
            expect(result.is_ledger_approved).toBe(true);
        });

        it('classifies as UNCITED when all citations returned false', () => {
            const result = arbitrate({
                ...BASE_SIGNALS,
                citationSources: [UNCONFIRMED_CITATION, { ...UNCONFIRMED_CITATION, platform: 'claude' }],
            });
            expect(result.validity).toBe('UNCITED');
            expect(result.confidence_score).toBeLessThanOrEqual(50);
            expect(result.signal_counts.citations_confirmed).toBe(0);
            expect(result.signal_counts.citations_total).toBe(2);
        });

        it('classifies as CONFIRMED with one high-confidence citation', () => {
            const result = arbitrate({
                ...BASE_SIGNALS,
                citationSources: [CONFIRMED_CITATION],
            });
            expect(result.validity).toBe('CONFIRMED');
            expect(result.confidence_score).toBeGreaterThan(50);
            expect(result.is_ledger_approved).toBe(true);
            expect(result.signal_counts.citations_confirmed).toBe(1);
        });

        it('classifies as PROBABLE with SERP boost but no citations', () => {
            const result = arbitrate({
                ...BASE_SIGNALS,
                citationSources: [],
                serpSignals: { entity_clarity_boost: 8, authority_boost: 6 },
            });
            expect(result.validity).toBe('PROBABLE');
            expect(result.confidence_score).toBeLessThanOrEqual(74);
            expect(result.is_ledger_approved).toBe(true);
            expect(result.signal_counts.serp_boost_applied).toBe(true);
        });

        it('classifies as PROBABLE with 2+ positive mentions but no citations', () => {
            const result = arbitrate({
                ...BASE_SIGNALS,
                mentionSignals: [
                    { source: 'reddit', url: 'https://reddit.com/r/1', sentiment: 'positive', confidence: 0.8 },
                    { source: 'hn', url: 'https://news.ycombinator.com/1', sentiment: 'positive', confidence: 0.7 },
                ],
            });
            expect(result.validity).toBe('PROBABLE');
            expect(result.confidence_score).toBeLessThanOrEqual(74);
        });

        it('classifies as DISPUTED when negative mentions dominate confirmed citation', () => {
            const result = arbitrate({
                ...BASE_SIGNALS,
                citationSources: [CONFIRMED_CITATION],
                mentionSignals: [
                    { source: 'reddit', url: 'https://reddit.com/1', sentiment: 'negative', confidence: 0.9 },
                    { source: 'twitter', url: 'https://x.com/1', sentiment: 'negative', confidence: 0.8 },
                    { source: 'hn', url: 'https://news.ycombinator.com/1', sentiment: 'positive', confidence: 0.6 },
                ],
            });
            expect(result.validity).toBe('DISPUTED');
            expect(result.confidence_score).toBeLessThanOrEqual(30);
        });

        it('includes signal counts in result', () => {
            const result = arbitrate({
                ...BASE_SIGNALS,
                citationSources: [CONFIRMED_CITATION, UNCONFIRMED_CITATION],
                mentionSignals: [
                    { source: 'reddit', url: 'https://reddit.com/1', sentiment: 'positive', confidence: 0.7 },
                ],
                serpSignals: { entity_clarity_boost: 4, authority_boost: 3 },
            });
            expect(result.signal_counts.citations_total).toBe(2);
            expect(result.signal_counts.citations_confirmed).toBe(1);
            expect(result.signal_counts.mention_count).toBe(1);
            expect(result.signal_counts.serp_boost_applied).toBe(true);
        });
    });

    describe('arbitrateBatch()', () => {
        it('filters out REJECTED results', () => {
            const batch: SignalLayer[] = [
                BASE_SIGNALS,
                { ...BASE_SIGNALS, aiOutput: 'As an AI language model, I cannot verify this.' },
                { ...BASE_SIGNALS, citationSources: [CONFIRMED_CITATION] },
            ];
            const results = arbitrateBatch(batch);
            expect(results.every((r) => r.is_ledger_approved)).toBe(true);
            expect(results.length).toBe(2); // 1 UNCITED + 1 CONFIRMED; REJECTED filtered
        });

        it('returns empty array when all signals are rejected', () => {
            const batch: SignalLayer[] = [
                { ...BASE_SIGNALS, aiOutput: 'As an AI language model, I cannot verify this.' },
                { ...BASE_SIGNALS, aiOutput: '' },
            ];
            expect(arbitrateBatch(batch)).toHaveLength(0);
        });
    });

    describe('aggregateConfidenceScore()', () => {
        it('returns 0 for empty results', () => {
            expect(aggregateConfidenceScore([])).toBe(0);
        });

        it('weights CONFIRMED results higher than UNCITED', () => {
            const confirmedResult: ArbitratedResult = {
                validity: 'CONFIRMED',
                confidence_score: 80,
                evidence_summary: '',
                is_ledger_approved: true,
                signal_counts: { citations_confirmed: 1, citations_total: 1, serp_boost_applied: false, mention_count: 0 },
            };
            const uncitedResult: ArbitratedResult = {
                validity: 'UNCITED',
                confidence_score: 30,
                evidence_summary: '',
                is_ledger_approved: true,
                signal_counts: { citations_confirmed: 0, citations_total: 0, serp_boost_applied: false, mention_count: 0 },
            };
            const score = aggregateConfidenceScore([confirmedResult, uncitedResult]);
            // CONFIRMED weight=1.0 * 80 + UNCITED weight=0.2 * 30 = 80 + 6 = 86 / 1.2 ≈ 72
            expect(score).toBeGreaterThan(50);
            expect(score).toBeLessThan(85);
        });

        it('REJECTED results contribute 0 weight (ignored in aggregate)', () => {
            const confirmedResult: ArbitratedResult = {
                validity: 'CONFIRMED',
                confidence_score: 70,
                evidence_summary: '',
                is_ledger_approved: true,
                signal_counts: { citations_confirmed: 1, citations_total: 1, serp_boost_applied: false, mention_count: 0 },
            };
            const rejectedResult: ArbitratedResult = {
                validity: 'REJECTED',
                confidence_score: 0,
                evidence_summary: '',
                is_ledger_approved: false,
                signal_counts: { citations_confirmed: 0, citations_total: 0, serp_boost_applied: false, mention_count: 0 },
            };
            const score = aggregateConfidenceScore([confirmedResult, rejectedResult]);
            expect(score).toBe(70); // REJECTED weight=0 so it's just (1.0*70)/1.0
        });
    });

    describe('assertNoScoreWithoutEvidence()', () => {
        it('does not throw when all non-zero scores are ledger-approved', () => {
            const results: ArbitratedResult[] = [
                {
                    validity: 'CONFIRMED',
                    confidence_score: 75,
                    evidence_summary: '',
                    is_ledger_approved: true,
                    signal_counts: { citations_confirmed: 1, citations_total: 1, serp_boost_applied: false, mention_count: 0 },
                },
                {
                    validity: 'REJECTED',
                    confidence_score: 0, // zero score is fine for REJECTED
                    evidence_summary: '',
                    is_ledger_approved: false,
                    signal_counts: { citations_confirmed: 0, citations_total: 0, serp_boost_applied: false, mention_count: 0 },
                },
            ];
            expect(() => assertNoScoreWithoutEvidence(results)).not.toThrow();
        });

        it('throws when a REJECTED result has non-zero confidence_score', () => {
            const results: ArbitratedResult[] = [
                {
                    validity: 'REJECTED',
                    confidence_score: 40, // VIOLATION: score > 0 but not ledger-approved
                    evidence_summary: '',
                    is_ledger_approved: false,
                    signal_counts: { citations_confirmed: 0, citations_total: 0, serp_boost_applied: false, mention_count: 0 },
                },
            ];
            expect(() => assertNoScoreWithoutEvidence(results)).toThrow(/INTEGRITY VIOLATION/);
        });
    });
});
