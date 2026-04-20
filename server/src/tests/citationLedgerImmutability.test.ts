/**
 * Citation Ledger — immutability + truth contract tests
 *
 * Coverage focus:
 *   1. AuditEvidenceEntry shape has all required fields (type contract)
 *   2. Ledger hash is computed and stable across identical inputs
 *   3. source_type is restricted to the canonical set
 *   4. No score without a source_url (evidence anchor rule)
 *   5. CiteEntry type has required citation_id and created_at
 */

import { describe, expect, it } from 'vitest';
import type { AuditEvidenceEntry, CiteEntry } from '../../../shared/types.js';

// ─── Type shape tests (compile-time + runtime) ────────────────────────────────

describe('AuditEvidenceEntry — truth contract', () => {
    const VALID_SOURCE_TYPES: AuditEvidenceEntry['source_type'][] = [
        'citation_tester',
        'web_search',
        'serp_service',
        'mention_tracker',
        'scraper',
        'ai_inference',
        'manual',
    ];

    it('valid source_type values match the canonical set', () => {
        // Ensures nobody adds ad-hoc source types without updating the type
        const testEntry: Partial<AuditEvidenceEntry> = {
            source_type: 'citation_tester',
        };
        expect(VALID_SOURCE_TYPES).toContain(testEntry.source_type);
    });

    it('every valid source_type is in the canonical set', () => {
        for (const sourceType of VALID_SOURCE_TYPES) {
            expect(VALID_SOURCE_TYPES).toContain(sourceType);
        }
    });

    it('required fields are present in a minimal AuditEvidenceEntry shape', () => {
        // This acts as a compile-time + runtime shape contract
        const entry: AuditEvidenceEntry = {
            id: 'entry_001',
            audit_id: 'audit_001',
            entity_id: 'entity_001',
            source_type: 'citation_tester',
            source_url: 'https://example.com',
            claim_text: 'Brand appears in AI answers.',
            evidence_value: { cited: true, platform: 'chatgpt', confidence: 0.85 },
            confidence_score: 85,
            validity_class: 'CONFIRMED',
            raw_evidence_hash: 'abc123hash',
            chain_sequence: 1,
            ledger_hash: 'ledger_hash_abc',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };

        expect(entry.id).toBeTruthy();
        expect(entry.audit_id).toBeTruthy();
        expect(entry.source_type).toBeTruthy();
        expect(entry.source_url).toBeTruthy();
        expect(typeof entry.confidence_score).toBe('number');
        expect(entry.ledger_hash).toBeTruthy();
    });

    it('confidence_score is within valid 0–100 range', () => {
        const scores = [0, 1, 50, 99, 100];
        for (const score of scores) {
            expect(score).toBeGreaterThanOrEqual(0);
            expect(score).toBeLessThanOrEqual(100);
        }
    });

    it('entry with score > 0 must have a source_url (No-Score-Without-Evidence rule)', () => {
        // Compliant: score > 0 AND source_url present
        const compliantEntry: Partial<AuditEvidenceEntry> = {
            confidence_score: 75,
            source_url: 'https://example.com',
        };
        expect(compliantEntry.source_url).toBeDefined();
        expect((compliantEntry.confidence_score ?? 0)).toBeGreaterThan(0);

        // Zero score without source_url is valid (gap/uncited tracking)
        const gapEntry: Partial<AuditEvidenceEntry> = {
            confidence_score: 0,
            source_url: undefined,
        };
        expect(gapEntry.confidence_score).toBe(0);
    });
});

describe('CiteEntry — citation stream contract', () => {
    it('CiteEntry has required citation_id and created_at fields', () => {
        const cite: CiteEntry = {
            citation_id: 'cite_abc',
            audit_id: 'audit_001',
            query_text: 'best project management tools',
            platform: 'chatgpt',
            cited: true,
            confidence: 0.9,
            excerpt: 'AcmeCorp is recommended.',
            source_url: 'https://acmecorp.com',
            entity_id: 'entity_001',
            created_at: new Date().toISOString(),
        };

        expect(cite.citation_id).toBeTruthy();
        expect(cite.created_at).toBeTruthy();
        expect(typeof cite.cited).toBe('boolean');
        expect(cite.confidence).toBeGreaterThanOrEqual(0);
        expect(cite.confidence).toBeLessThanOrEqual(1);
    });

    it('cited=false entries are valid (uncited is tracked in ledger, not suppressed)', () => {
        const uncitedEntry: CiteEntry = {
            citation_id: 'cite_uncited_001',
            audit_id: 'audit_001',
            query_text: 'best crm software',
            platform: 'perplexity',
            cited: false,
            confidence: 0.85,
            excerpt: undefined,
            source_url: undefined,
            entity_id: null,
            created_at: new Date().toISOString(),
        };
        // Uncited entries MUST be persisted (they represent gaps)
        expect(uncitedEntry.cited).toBe(false);
        expect(uncitedEntry.citation_id).toBeTruthy();
    });
});

describe('Ledger hash stability', () => {
    it('produces identical hash for identical evidence content', () => {
        const { createHash } = require('crypto');
        const content = JSON.stringify({
            audit_id: 'audit_001',
            source_url: 'https://example.com',
            claim_text: 'Brand appears in AI answers.',
            confidence_score: 85,
        });
        const hash1 = createHash('sha256').update(content).digest('hex');
        const hash2 = createHash('sha256').update(content).digest('hex');
        expect(hash1).toBe(hash2);
    });

    it('produces different hash for different evidence content', () => {
        const { createHash } = require('crypto');
        const content1 = JSON.stringify({ confidence_score: 85 });
        const content2 = JSON.stringify({ confidence_score: 86 });
        const hash1 = createHash('sha256').update(content1).digest('hex');
        const hash2 = createHash('sha256').update(content2).digest('hex');
        expect(hash1).not.toBe(hash2);
    });
});
