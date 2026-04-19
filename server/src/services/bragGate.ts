/**
 * BRAG Validation Gate — issues BRAG IDs only for evidence-backed findings.
 *
 * Primary:  calls Python FastAPI gate via /validate/brag
 * Fallback: TypeScript-side deterministic validation (same algorithm)
 *
 * Contract:
 *   - 0 validated findings → score 100 (nothing is wrong)
 *   - Each finding deducts by severity weight
 *   - Score = max(0, 100 − Σ deductions)
 *   - No finding surfaces to the user without a BRAG ID
 */

import crypto from 'crypto';
import type { BragFinding, BragValidationResult, CiteLedgerEntry } from '../../../shared/types.js';
import type { EvidenceItem } from './audit/evidenceLedger.js';
import type { RuleResult } from './audit/ruleEngine.js';
import { isPythonServiceAvailable } from './deepAnalysisClient.js';

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://127.0.0.1:3002';
const PYTHON_INTERNAL_KEY = process.env.PYTHON_INTERNAL_KEY || '';
const BRAG_GATE_TIMEOUT_MS = 12_000; // 12s max for BRAG validation

/** Severity weight map — how many points each level deducts from 100 */
const SEVERITY_WEIGHTS: Record<string, number> = {
    critical: 15,
    high: 8,
    medium: 4,
    low: 1.5,
    info: 0,
};

/** Rule ID → evidence key mapping for rule↔evidence cross-referencing */
const RULE_EVIDENCE_MAP: Record<string, string[]> = {
    C01: ['robots_ai_crawlers'],
    C02: ['ai_crawler_access'],
    C03: ['llms_txt'],
    I01: ['canonical'],
    I02: ['link_profile'],
    I03: ['link_profile'],
    I04: ['sitemap'],
    R01: ['page_load_ms'],
    R02: ['lcp_ms'],
    R03: ['image_count'],
    R04: ['image_alt_coverage'],
    M01: ['title'],
    M02: ['meta_description'],
    M03: ['og_title'],
    M04: ['og_description'],
    M05: ['og_image'],
    M06: ['lang'],
    S01: ['structured_data'],
    S02: ['structured_data'],
    S03: ['json_ld_completeness'],
    S04: ['structured_data'],
    E01: ['headings'],
    E02: ['headings'],
    E03: ['title', 'og_title'],
    CT01: ['word_count'],
    CT02: ['question_h2s'],
    CT03: ['tldr_block'],
    CI01: ['meta_description'],
    CI02: ['meta_description', 'og_description'],
    CI03: ['meta_description'],
    T01: ['structured_data'],
    T02: ['word_count'],
    T03: ['title', 'og_title'],
    EC01: ['ecommerce_platform'],
    EC02: ['product_schema'],
    EC03: ['offer_schema'],
    EC04: ['aggregate_rating_schema'],
    EC05: ['breadcrumb_schema'],
    AU01: ['structured_data'],
    AU02: ['link_profile'],
    AU03: ['structured_data'],
};

/** Rec-title keyword → evidence keys for AI rec validation */
const KEYWORD_EVIDENCE_MAP: Record<string, string[]> = {
    schema: ['structured_data', 'json_ld_completeness', 'product_schema'],
    'json-ld': ['structured_data', 'json_ld_completeness'],
    'structured data': ['structured_data', 'json_ld_completeness'],
    title: ['title', 'og_title'],
    heading: ['headings'],
    h1: ['headings'],
    h2: ['headings', 'question_h2s'],
    'meta description': ['meta_description', 'og_description'],
    description: ['meta_description', 'og_description'],
    'open graph': ['og_title', 'og_description', 'og_image'],
    canonical: ['canonical'],
    robots: ['robots_ai_crawlers', 'ai_crawler_access'],
    crawl: ['robots_ai_crawlers', 'ai_crawler_access', 'llms_txt'],
    'llms.txt': ['llms_txt'],
    sitemap: ['sitemap'],
    image: ['image_count', 'image_alt_coverage', 'og_image'],
    'alt text': ['image_alt_coverage'],
    content: ['word_count', 'tldr_block'],
    faq: ['question_h2s'],
    question: ['question_h2s'],
    speed: ['page_load_ms', 'lcp_ms'],
    performance: ['page_load_ms', 'lcp_ms'],
    ecommerce: ['ecommerce_platform', 'product_schema', 'offer_schema'],
    product: ['product_schema'],
    breadcrumb: ['breadcrumb_schema'],
    rating: ['aggregate_rating_schema'],
    language: ['lang'],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sha256(data: string): string {
    return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

function canonicalJson(obj: unknown): string {
    return JSON.stringify(obj, Object.keys(obj as Record<string, unknown>).sort());
}

function bragId(source: string, key: string, evidenceSnapshot: string): string {
    const digest = sha256(`${source}|${key}|${evidenceSnapshot}`).slice(0, 12);
    return `BRAG-${source}-${digest}`;
}

// ---------------------------------------------------------------------------
// Input interfaces (from the server pipeline)
// ---------------------------------------------------------------------------

export interface BragGateInput {
    auditId: string;
    url: string;
    evidenceItems: EvidenceItem[];
    ruleResults: RuleResult[];
    aiRecommendations: Array<{
        title: string;
        description?: string;
        priority?: string;
        evidence_ids?: string[];
        category?: string;
        implementation?: string;
    }>;
    scrapeSummary?: {
        word_count?: number;
        title?: string;
        meta_description?: string;
        json_ld_blocks?: unknown[];
    };
}

// ---------------------------------------------------------------------------
// Main entry point — Python-first, TypeScript fallback
// ---------------------------------------------------------------------------

export async function runBragValidationGate(input: BragGateInput): Promise<BragValidationResult> {
    // Try the Python gate first — richer NLP cross-checks
    const pythonResult = await callPythonBragGate(input);
    if (pythonResult) return pythonResult;

    // Fallback: TypeScript deterministic validation (same core algorithm)
    return tsFallbackValidation(input);
}

// ---------------------------------------------------------------------------
// Python gate caller
// ---------------------------------------------------------------------------

async function callPythonBragGate(input: BragGateInput): Promise<BragValidationResult | null> {
    const available = await isPythonServiceAvailable();
    if (!available) return null;

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), BRAG_GATE_TIMEOUT_MS);

        const body = {
            audit_id: input.auditId,
            url: input.url,
            evidence_items: input.evidenceItems.map(ei => ({
                category: ei.category,
                key: ei.key,
                label: ei.label,
                value: typeof ei.value === 'string' ? ei.value : JSON.stringify(ei.value),
                status: ei.status,
                confidence: ei.confidence,
                notes: ei.notes,
            })),
            rule_results: input.ruleResults.map(rr => ({
                rule_id: rr.ruleId,
                family: rr.family,
                title: rr.title,
                description: rr.description,
                passed: rr.passed,
                severity: rr.severity,
                score_impact: rr.scoreImpact,
                is_hard_blocker: rr.hardBlocker,
                evidence_keys: rr.evidenceKeys,
                remediation: rr.remediationKey,
            })),
            ai_recommendations: input.aiRecommendations.map(rec => ({
                title: rec.title,
                description: rec.description || '',
                priority: rec.priority || 'medium',
                evidence_ids: rec.evidence_ids || [],
                category: rec.category || '',
            })),
            scrape_summary: input.scrapeSummary || {},
            internal_key: PYTHON_INTERNAL_KEY,
        };

        const res = await fetch(`${PYTHON_SERVICE_URL}/validate/brag`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!res.ok) {
            console.warn(`[brag-gate] Python /validate/brag returned ${res.status}`);
            return null;
        }

        const raw = await res.json() as Record<string, unknown>;
        return normalizePythonResult(raw);
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[brag-gate] Python gate failed, falling back to TS: ${msg}`);
        return null;
    }
}

function normalizePythonResult(raw: Record<string, unknown>): BragValidationResult {
    const findings = (Array.isArray(raw.findings) ? raw.findings : []).map((f: Record<string, unknown>) => ({
        brag_id: String(f.brag_id || ''),
        source: (f.source as BragFinding['source']) || 'python',
        rule_id: f.rule_id ? String(f.rule_id) : undefined,
        title: String(f.title || ''),
        severity: (f.severity as BragFinding['severity']) || 'medium',
        is_hard_blocker: Boolean(f.is_hard_blocker),
        evidence_keys: Array.isArray(f.evidence_keys) ? f.evidence_keys.map(String) : (f.evidence_key ? [String(f.evidence_key)] : []),
        evidence_statuses: Array.isArray(f.evidence_statuses) ? f.evidence_statuses.map(String) : (f.evidence_status ? [String(f.evidence_status)] : []),
        evidence_value: f.evidence_value ? String(f.evidence_value).slice(0, 500) : undefined,
        confidence: typeof f.confidence === 'number' ? f.confidence : 0.5,
        family: f.family ? String(f.family) : undefined,
        remediation: f.remediation ? String(f.remediation) : undefined,
    } satisfies BragFinding));

    const citeLedger = (Array.isArray(raw.cite_ledger) ? raw.cite_ledger : []).map((e: Record<string, unknown>) => ({
        sequence: typeof e.sequence === 'number' ? e.sequence : 0,
        brag_id: String(e.brag_id || ''),
        content_hash: String(e.content_hash || ''),
        previous_hash: String(e.previous_hash || ''),
        chain_hash: String(e.chain_hash || ''),
        timestamp: String(e.timestamp || ''),
    } satisfies CiteLedgerEntry));

    return {
        audit_id: String(raw.audit_id || ''),
        url: String(raw.url || ''),
        validated_at: String(raw.validated_at || new Date().toISOString()),
        findings,
        rejected_count: typeof raw.rejection_count === 'number' ? raw.rejection_count : 0,
        cite_ledger: citeLedger,
        derived_score: typeof raw.derived_score === 'number' ? raw.derived_score : 100,
        finding_count: findings.length,
        root_hash: String(raw.root_hash || '0'.repeat(64)),
        gate_version: String(raw.gate_version || 'brag-gate-python-v1'),
    };
}

// ---------------------------------------------------------------------------
// TypeScript fallback validation (mirrors Python brag_validator.py)
// ---------------------------------------------------------------------------

function tsFallbackValidation(input: BragGateInput): BragValidationResult {
    const timestamp = new Date().toISOString();

    const evidenceByKey = new Map<string, EvidenceItem>();
    for (const item of input.evidenceItems) {
        if (item.key) evidenceByKey.set(item.key, item);
    }

    const findings: BragFinding[] = [];
    let rejectedCount = 0;

    // 1. Validate failed rule-engine results
    for (const rule of input.ruleResults) {
        if (rule.passed) continue;

        // Use RULE_EVIDENCE_MAP to find keys for lookup, since evidenceIds are now EV-hashes
        const evidence = findRuleEvidence(rule.ruleId, [], evidenceByKey);
        if (!evidence) {
            rejectedCount++;
            continue;
        }

        const snapshot = canonicalJson({
            key: evidence.key,
            status: evidence.status,
            value: String(evidence.value ?? '').slice(0, 200),
        });

        findings.push({
            brag_id: bragId('rule', rule.ruleId, snapshot),
            source: 'rule',
            rule_id: rule.ruleId,
            title: rule.title,
            severity: rule.severity,
            is_hard_blocker: rule.hardBlocker,
            evidence_keys: [evidence.key],
            evidence_statuses: [evidence.status],
            evidence_value: String(evidence.value ?? '').slice(0, 500),
            confidence: 1.0,
            family: rule.family,
            remediation: rule.remediationKey ?? undefined,
        });
    }

    // 2. Validate AI recommendations
    for (const rec of input.aiRecommendations) {
        const matchedEvidence = findRecEvidence(rec, evidenceByKey);
        if (!matchedEvidence.length) {
            rejectedCount++;
            continue;
        }

        const primary = matchedEvidence[0];
        const snapshot = canonicalJson({
            key: primary.key,
            status: primary.status,
            value: String(primary.value ?? '').slice(0, 200),
        });

        const severityMap: Record<string, BragFinding['severity']> = {
            critical: 'critical',
            high: 'high',
            medium: 'medium',
            low: 'low',
        };
        const severity = severityMap[String(rec.priority ?? 'medium').toLowerCase()] ?? 'medium';

        findings.push({
            brag_id: bragId('ai', (rec.title || '').slice(0, 80), snapshot),
            source: 'ai',
            title: rec.title || 'Untitled recommendation',
            severity,
            is_hard_blocker: false,
            evidence_keys: matchedEvidence.map(e => e.key),
            evidence_statuses: matchedEvidence.map(e => e.status),
            confidence: Math.min(1, matchedEvidence.length * 0.3 + 0.4),
        });
    }

    // 3. Python-style cross-checks (thin content, title length, meta desc length)
    if (input.scrapeSummary) {
        const ss = input.scrapeSummary;

        if (typeof ss.word_count === 'number' && ss.word_count < 100) {
            findings.push({
                brag_id: bragId('python', 'thin_content', String(ss.word_count)),
                source: 'python',
                title: 'Critically thin content detected',
                severity: 'critical',
                is_hard_blocker: false,
                evidence_keys: ['word_count'],
                evidence_statuses: ['present'],
                evidence_value: String(ss.word_count),
                confidence: 1.0,
            });
        }

        if (ss.title && (ss.title.length < 10 || ss.title.length > 100)) {
            findings.push({
                brag_id: bragId('python', 'title_length', String(ss.title.length)),
                source: 'python',
                title: 'Title length outside optimal range',
                severity: 'medium',
                is_hard_blocker: false,
                evidence_keys: ['title'],
                evidence_statuses: ['present'],
                evidence_value: ss.title.slice(0, 100),
                confidence: 1.0,
            });
        }

        if (ss.meta_description && (ss.meta_description.length < 50 || ss.meta_description.length > 320)) {
            findings.push({
                brag_id: bragId('python', 'meta_desc_length', String(ss.meta_description.length)),
                source: 'python',
                title: 'Meta description length outside optimal range',
                severity: 'low',
                is_hard_blocker: false,
                evidence_keys: ['meta_description'],
                evidence_statuses: ['present'],
                evidence_value: ss.meta_description.slice(0, 200),
                confidence: 1.0,
            });
        }
    }

    // 4. Build cite ledger hash chain
    const citeLedger = buildChain(findings, timestamp);

    // 5. Derive score
    const totalDeduction = findings.reduce(
        (sum, f) => sum + (SEVERITY_WEIGHTS[f.severity] ?? 0),
        0,
    );
    const derivedScore = Math.max(0, Math.min(100, Math.round((100 - totalDeduction) * 100) / 100));

    return {
        audit_id: input.auditId,
        url: input.url,
        validated_at: timestamp,
        findings,
        rejected_count: rejectedCount,
        cite_ledger: citeLedger,
        derived_score: derivedScore,
        finding_count: findings.length,
        root_hash: citeLedger.length > 0 ? citeLedger[citeLedger.length - 1].chain_hash : '0'.repeat(64),
        gate_version: 'brag-gate-ts-v1',
    };
}

// ---------------------------------------------------------------------------
// Evidence resolution helpers
// ---------------------------------------------------------------------------

function findRuleEvidence(
    ruleId: string,
    directKeys: string[],
    evidenceByKey: Map<string, EvidenceItem>,
): EvidenceItem | null {
    // Direct evidence keys from the rule
    for (const key of directKeys) {
        const item = evidenceByKey.get(key);
        if (item) return item;
    }

    // Mapped evidence via RULE_EVIDENCE_MAP
    const mapped = RULE_EVIDENCE_MAP[ruleId];
    if (mapped) {
        for (const key of mapped) {
            const item = evidenceByKey.get(key);
            if (item) return item;
        }
    }

    return null;
}

function findRecEvidence(
    rec: { title: string; evidence_ids?: string[] },
    evidenceByKey: Map<string, EvidenceItem>,
): EvidenceItem[] {
    const matches: EvidenceItem[] = [];

    // Check explicit evidence_ids
    if (rec.evidence_ids?.length) {
        for (const eid of rec.evidence_ids) {
            const cleanKey = eid.replace(/^ev_/, '');
            const item = evidenceByKey.get(cleanKey) ?? evidenceByKey.get(eid);
            if (item && !matches.includes(item)) matches.push(item);
        }
    }

    if (matches.length > 0) return matches;

    // Keyword-based matching from title
    const titleLower = (rec.title || '').toLowerCase();
    for (const [keyword, keys] of Object.entries(KEYWORD_EVIDENCE_MAP)) {
        if (titleLower.includes(keyword)) {
            for (const key of keys) {
                const item = evidenceByKey.get(key);
                if (item && !matches.includes(item)) matches.push(item);
            }
        }
    }

    return matches;
}

// ---------------------------------------------------------------------------
// Hash chain builder (mirrors Python _build_chain)
// ---------------------------------------------------------------------------

function buildChain(findings: BragFinding[], timestamp: string): CiteLedgerEntry[] {
    const genesisHash = '0'.repeat(64);
    const chain: CiteLedgerEntry[] = [];
    let previousHash = genesisHash;

    for (let i = 0; i < findings.length; i++) {
        const f = findings[i];
        const contentHash = sha256(canonicalJson({
            brag_id: f.brag_id,
            source: f.source,
            title: f.title,
            severity: f.severity,
            evidence_key: f.evidence_keys[0] ?? '',
        }));
        const chainHash = sha256(previousHash + contentHash);

        chain.push({
            sequence: i,
            brag_id: f.brag_id,
            content_hash: contentHash,
            previous_hash: previousHash,
            chain_hash: chainHash,
            timestamp,
        });

        previousHash = chainHash;
    }

    return chain;
}

// ---------------------------------------------------------------------------
// DB persistence helper — writes validated BRAG findings to brag_trail
// ---------------------------------------------------------------------------

export async function persistBragTrail(
    pool: { query: (text: string, values: unknown[]) => Promise<unknown> },
    auditRunId: string,
    validation: BragValidationResult,
): Promise<void> {
    if (!validation.findings.length) return;

    const values: unknown[] = [];
    const placeholders: string[] = [];
    let paramIdx = 1;

    for (const f of validation.findings) {
        placeholders.push(
            `($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`,
        );
        values.push(
            auditRunId,
            f.brag_id,
            f.source,
            JSON.stringify(f.evidence_keys),
            JSON.stringify({
                title: f.title,
                severity: f.severity,
                family: f.family,
                confidence: f.confidence,
                evidence_value: f.evidence_value,
            }),
            f.title,
            f.confidence,
            f.is_hard_blocker,
            new Date().toISOString(),
        );
    }

    const sql = `
    INSERT INTO brag_trail (audit_run_id, recommendation_id, build_source, reference_ids, ground_output, audit_linkage, confidence, advisory_only, created_at)
    VALUES ${placeholders.join(', ')}
    ON CONFLICT DO NOTHING
  `;

    try {
        await pool.query(sql, values);
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[brag-gate] Failed to persist BRAG trail: ${msg}`);
    }
}

// ---------------------------------------------------------------------------
// Cite ledger persistence — stores the cryptographic chain
// ---------------------------------------------------------------------------

export async function persistCiteLedger(
    pool: { query: (text: string, values: unknown[]) => Promise<unknown> },
    auditRunId: string,
    citeLedger: CiteLedgerEntry[],
): Promise<void> {
    if (!citeLedger.length) return;

    const values: unknown[] = [];
    const placeholders: string[] = [];
    let paramIdx = 1;

    for (const entry of citeLedger) {
        placeholders.push(
            `($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`,
        );
        values.push(
            auditRunId,
            entry.sequence,
            entry.brag_id,
            entry.content_hash,
            entry.previous_hash,
            entry.chain_hash,
            entry.timestamp,
        );
    }

    const sql = `
    INSERT INTO cite_ledger (audit_run_id, sequence, brag_id, content_hash, previous_hash, chain_hash, created_at)
    VALUES ${placeholders.join(', ')}
    ON CONFLICT DO NOTHING
  `;

    try {
        await pool.query(sql, values);
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[brag-gate] Failed to persist cite ledger: ${msg}`);
    }
}
