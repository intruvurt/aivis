/**
 * Cite Ledger Metadata Generator
 *
 * Generates machine-readable cite-ledger blocks injected into page HTML.
 * This is the critical visibility layer that makes the audit evidence externally readable.
 *
 * Structure: { page, cites, entities, scores }
 * Injected as: <script type="application/json" id="cite-ledger">
 */

export interface CiteLedgerCitation {
    id: string;
    url: string;
    entity: string;
    confidence: number; // 0-100
    source: 'schema' | 'content' | 'metadata' | 'heading' | 'link';
    extractable: boolean;
}

export interface CiteLedgerEntity {
    id: string;
    name: string;
    type: 'organization' | 'person' | 'product' | 'concept';
    clarity_score: number; // 0-100
    mentions: number;
}

export interface CiteLedgerScores {
    crawl: number; // 0-100: How crawlable is the page
    semantic: number; // 0-100: How semantically rich is the page
    authority: number; // 0-100: How authoritative is the page for AI systems
    machine_readability: number; // 0-100: Overall machine-readability score
    citation_readiness: number; // 0-100: Citation readiness (0-100, mapped from A-F)
}

export interface CiteLedgerMeta {
    page: string; // Full canonical URL
    timestamp: string; // ISO 8601
    version: string; // Cite Ledger version (e.g., "1.0.0")

    // Evidence graph
    cites: CiteLedgerCitation[];
    entities: CiteLedgerEntity[];

    // Machine-readable scores
    scores: CiteLedgerScores;

    // Audit chain reference (for cryptographic verification)
    audit_chain?: {
        chain_hash?: string; // Previous entry hash for verification
        sequence?: number; // Sequence number in ledger
    };
}

/**
 * Generate a cite-ledger metadata block
 */
export function generateCiteLedgerMeta(input: {
    page: string;
    citations: CiteLedgerCitation[];
    entities: CiteLedgerEntity[];
    scores: CiteLedgerScores;
    auditChain?: { chain_hash?: string; sequence?: number };
}): CiteLedgerMeta {
    return {
        page: input.page,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        cites: input.citations,
        entities: input.entities,
        scores: input.scores,
        audit_chain: input.auditChain,
    };
}

/**
 * Generate HTML script block for cite-ledger injection
 */
export function generateCiteLedgerScriptBlock(meta: CiteLedgerMeta): string {
    return `<script type="application/json" id="cite-ledger">
${JSON.stringify(meta, null, 2)}
</script>`;
}

/**
 * Convert audit score letter grade (A-F) to 0-100 numeric score
 */
export function gradeToScore(grade: 'A' | 'B' | 'C' | 'D' | 'F' | string): number {
    const gradeScores: Record<string, number> = {
        'A': 90,
        'B': 80,
        'C': 70,
        'D': 60,
        'F': 0,
    };
    return gradeScores[grade] ?? 50;
}

/**
 * Extract citations and entities from audit payload
 * This would integrate with the actual audit response structure
 */
export function extractCitationsFromAudit(auditPayload: any): CiteLedgerCitation[] {
    // This is a placeholder — actual implementation would parse
    // the BRAG audit findings and extract machine-readable citations
    const citations: CiteLedgerCitation[] = [];

    // Example extraction logic (would be replaced with real audit structure):
    if (auditPayload?.findings) {
        auditPayload.findings.forEach((finding: any, index: number) => {
            if (finding.evidence_id) {
                citations.push({
                    id: finding.evidence_id,
                    url: auditPayload.url,
                    entity: finding.element_type || 'content',
                    confidence: finding.confidence ?? 75,
                    source: 'content',
                    extractable: !!finding.extract_ready,
                });
            }
        });
    }

    return citations;
}

/**
 * Extract entities from audit payload
 */
export function extractEntitiesFromAudit(auditPayload: any): CiteLedgerEntity[] {
    const entities: CiteLedgerEntity[] = [];

    // Example extraction logic:
    if (auditPayload?.entities) {
        auditPayload.entities.forEach((entity: any) => {
            entities.push({
                id: entity.id || entity.name.toLowerCase().replace(/\s+/g, '-'),
                name: entity.name,
                type: entity.type ?? 'organization',
                clarity_score: entity.clarity_score ?? 70,
                mentions: entity.mention_count ?? 1,
            });
        });
    }

    return entities;
}

/**
 * Generate scores object from audit response
 */
export function generateScoresFromAudit(auditPayload: any): CiteLedgerScores {
    // Map grades to numeric scores
    const grades = auditPayload?.category_grades || {};

    // Calculate machine-readability as average of relevant categories
    const readabilityRelevant = [
        gradeToScore(grades.schema_structured_data ?? 'C'),
        gradeToScore(grades.meta_tags_open_graph ?? 'C'),
        gradeToScore(grades.heading_structure ?? 'C'),
    ];
    const machineReadability =
        readabilityRelevant.reduce((a: number, b: number) => a + b, 0) / readabilityRelevant.length;

    return {
        crawl: gradeToScore(grades.technical_trust ?? 'C'),
        semantic: gradeToScore(grades.schema_structured_data ?? 'C'),
        authority: gradeToScore(grades.content_depth_quality ?? 'C'),
        machine_readability: Math.round(machineReadability),
        citation_readiness: auditPayload?.visibility_score ?? 50,
    };
}
