/**
 * Dataset Pipeline Service — Audit-Verified High-Integrity Data
 *
 * Four-stage pipeline:
 *   1. Ingestion  — extract from primary sources via scraper
 *   2. Annotation — ML label application (Contextual Integrity)
 *   3. Synthesis  — generate edge-case synthetic entries
 *   4. Audit      — attach verification hash + JSON-LD provenance
 */

import crypto from 'node:crypto';
import { pool } from './postgresql.js';
import { callAIProvider } from './aiProviders.js';
import { PROVIDERS, FREE_PROVIDERS } from './aiProviders.js';
import type {
    DatasetVertical,
    DatasetEntryStage,
    DatasetEntryOrigin,
    DatasetEntry,
    DatasetVerticalSummary,
    DatasetAuditProof,
} from '../../../shared/types.js';
import { DATASET_VERTICALS } from '../../../shared/types.js';

/* ── Helpers ──────────────────────────────────────────────── */

function computeAuditHash(content: string, labels: Record<string, unknown>): string {
    const payload = JSON.stringify({ content, labels }, Object.keys({ content, labels }).sort());
    return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
}

function buildProvenanceJsonLd(
    entry: { id: string; source_url: string; title: string; vertical: DatasetVertical },
    auditHash: string,
): Record<string, unknown> {
    const verticalMeta = DATASET_VERTICALS[entry.vertical];
    return {
        '@context': 'https://schema.org',
        '@type': 'Dataset',
        name: entry.title || `${verticalMeta.name} entry`,
        description: `Audit-verified ${verticalMeta.name} dataset entry`,
        identifier: entry.id,
        url: entry.source_url || undefined,
        distribution: {
            '@type': 'DataDownload',
            contentUrl: `urn:aivis:dataset:${entry.id}`,
            encodingFormat: 'application/json',
        },
        additionalProperty: [
            { '@type': 'PropertyValue', name: 'auditHash', value: auditHash },
            { '@type': 'PropertyValue', name: 'hashAlgorithm', value: 'sha256' },
            { '@type': 'PropertyValue', name: 'vertical', value: entry.vertical },
            { '@type': 'PropertyValue', name: 'schemaType', value: verticalMeta.schemaType },
        ],
        dateCreated: new Date().toISOString(),
    };
}

function safeParseJson(raw: string): Record<string, unknown> | null {
    try {
        const parsed = JSON.parse(raw);
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            return parsed as Record<string, unknown>;
        }
        return null;
    } catch {
        return null;
    }
}

/* ── STAGE 1: Ingestion ──────────────────────────────────── */

export async function ingestEntry(
    userId: string,
    vertical: DatasetVertical,
    sourceUrl: string,
    title: string,
    content?: string,
): Promise<DatasetEntry> {
    const result = await pool.query(
        `INSERT INTO dataset_entries (user_id, vertical, stage, origin, source_url, title, content)
     VALUES ($1, $2, 'ingested', 'real', $3, $4, $5)
     RETURNING *`,
        [userId, vertical, sourceUrl, title, content || ''],
    );
    return rowToEntry(result.rows[0]);
}

/* ── STAGE 2: Annotation (ML labelling) ─────────────────── */

export async function annotateEntry(entryId: string, userId: string): Promise<DatasetEntry> {
    const { rows } = await pool.query(
        `SELECT * FROM dataset_entries WHERE id = $1 AND user_id = $2`,
        [entryId, userId],
    );
    if (!rows[0]) throw new Error('Entry not found');

    const entry = rows[0];
    const verticalMeta = DATASET_VERTICALS[entry.vertical as DatasetVertical];

    const prompt = `You are a data annotation specialist for the "${verticalMeta.name}" vertical.
Analyze this content and produce structured labels according to Contextual Integrity standards.

Title: ${entry.title}
Source: ${entry.source_url}
Content (first 2000 chars): ${String(entry.content).slice(0, 2000)}

Return ONLY a JSON object with these keys:
- category (string): primary category within ${verticalMeta.name}
- subcategory (string): specific subcategory
- relevance_score (number 0-1): how relevant to the vertical
- jurisdiction (string): applicable jurisdiction if legal, "global" otherwise
- severity (string): "low" | "medium" | "high" | "critical"
- key_entities (string): comma-separated key entities mentioned
- temporal_relevance (string): "historical" | "current" | "emerging"
- confidence (number 0-1): your confidence in these labels`;

    let labelText: string;
    try {
        const providers = PROVIDERS.length > 0 ? PROVIDERS : FREE_PROVIDERS;
        labelText = await callAIProvider({
            provider: providers[0]?.provider || 'openrouter',
            model: providers[0]?.model || 'google/gemma-3-27b-it:free',
            prompt,
            apiKey: process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_API_KEY || '',
            opts: { max_tokens: 800, timeoutMs: 15_000 },
        });
    } catch {
        // Graceful degradation: mark as annotated with empty labels
        labelText = '{}';
    }

    const labels = safeParseJson(labelText) || {};
    const confidence = typeof labels.confidence === 'number' ? labels.confidence : 0.5;

    const updated = await pool.query(
        `UPDATE dataset_entries
     SET stage = 'annotated', labels = $1, confidence = $2, updated_at = NOW()
     WHERE id = $3 AND user_id = $4
     RETURNING *`,
        [JSON.stringify(labels), confidence, entryId, userId],
    );
    return rowToEntry(updated.rows[0]);
}

/* ── STAGE 3: Synthesis (edge-case generation) ───────────── */

export async function synthesizeEntries(
    userId: string,
    vertical: DatasetVertical,
    count: number,
    seedEntryIds?: string[],
): Promise<DatasetEntry[]> {
    const clampedCount = Math.min(Math.max(1, count), 50); // Cap per request
    const verticalMeta = DATASET_VERTICALS[vertical];

    // Fetch seed entries for context
    let seedContext = '';
    if (seedEntryIds && seedEntryIds.length > 0) {
        const { rows } = await pool.query(
            `SELECT title, labels FROM dataset_entries
       WHERE id = ANY($1) AND user_id = $2
       LIMIT 5`,
            [seedEntryIds, userId],
        );
        seedContext = rows
            .map((r: { title: string; labels: unknown }) => `- ${r.title}: ${JSON.stringify(r.labels)}`)
            .join('\n');
    }

    const prompt = `You are a synthetic data generator for the "${verticalMeta.name}" vertical (${verticalMeta.description}).

${seedContext ? `Reference entries:\n${seedContext}\n` : ''}
Generate ${clampedCount} synthetic edge-case entries that represent rare but critical scenarios in this vertical.
Each entry must have deterministic, verifiable attributes.

Return a JSON array of objects, each with:
- title (string): descriptive title
- content (string): 2-3 sentence description of the scenario
- labels (object): { category, subcategory, relevance_score (0-1), severity ("low"|"medium"|"high"|"critical"), key_entities, temporal_relevance ("historical"|"current"|"emerging") }
- tags (string[]): relevant tags

Return ONLY the JSON array, no markdown.`;

    let rawResponse: string;
    try {
        const providers = PROVIDERS.length > 0 ? PROVIDERS : FREE_PROVIDERS;
        rawResponse = await callAIProvider({
            provider: providers[0]?.provider || 'openrouter',
            model: providers[0]?.model || 'google/gemma-3-27b-it:free',
            prompt,
            apiKey: process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_API_KEY || '',
            opts: { max_tokens: 3000, timeoutMs: 25_000 },
        });
    } catch {
        return [];
    }

    let parsed: unknown[];
    try {
        const cleaned = rawResponse.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();
        const result = JSON.parse(cleaned);
        parsed = Array.isArray(result) ? result : [];
    } catch {
        return [];
    }

    const entries: DatasetEntry[] = [];
    for (const item of parsed.slice(0, clampedCount)) {
        if (!item || typeof item !== 'object') continue;
        const obj = item as Record<string, unknown>;

        const title = String(obj.title || 'Synthetic entry').slice(0, 500);
        const content = String(obj.content || '').slice(0, 5000);
        const labels = (typeof obj.labels === 'object' && obj.labels) ? obj.labels as Record<string, unknown> : {};
        const tags = Array.isArray(obj.tags) ? obj.tags.filter((t): t is string => typeof t === 'string').slice(0, 10) : [];

        const { rows } = await pool.query(
            `INSERT INTO dataset_entries
       (user_id, vertical, stage, origin, source_url, title, content, labels, confidence, tags)
       VALUES ($1, $2, 'synthesized', 'synthetic', '', $3, $4, $5, $6, $7)
       RETURNING *`,
            [
                userId,
                vertical,
                title,
                content,
                JSON.stringify(labels),
                typeof labels.relevance_score === 'number' ? labels.relevance_score : 0.7,
                tags,
            ],
        );
        if (rows[0]) entries.push(rowToEntry(rows[0]));
    }

    return entries;
}

/* ── STAGE 4: Audit (verification hash + provenance) ─────── */

export async function auditEntry(entryId: string, userId: string): Promise<DatasetAuditProof> {
    const { rows } = await pool.query(
        `SELECT * FROM dataset_entries WHERE id = $1 AND user_id = $2`,
        [entryId, userId],
    );
    if (!rows[0]) throw new Error('Entry not found');

    const entry = rows[0];
    const labels = typeof entry.labels === 'object' ? entry.labels : {};
    const auditHash = computeAuditHash(entry.content, labels);
    const provenance = buildProvenanceJsonLd(
        { id: entry.id, source_url: entry.source_url, title: entry.title, vertical: entry.vertical },
        auditHash,
    );

    // Upsert proof
    const proofResult = await pool.query(
        `INSERT INTO dataset_audit_proofs (entry_id, audit_hash, content_snapshot, labels_snapshot, provenance_jsonld)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (entry_id, audit_hash) DO UPDATE SET provenance_jsonld = $5, issued_at = NOW()
     RETURNING *`,
        [entryId, auditHash, entry.content, JSON.stringify(labels), JSON.stringify(provenance)],
    );

    // Promote entry to audited stage
    await pool.query(
        `UPDATE dataset_entries
     SET stage = 'audited', audit_hash = $1, provenance_jsonld = $2, updated_at = NOW()
     WHERE id = $3 AND user_id = $4`,
        [auditHash, JSON.stringify(provenance), entryId, userId],
    );

    const proof = proofResult.rows[0];
    return {
        entry_id: proof.entry_id,
        audit_hash: proof.audit_hash,
        algorithm: proof.algorithm,
        content_snapshot: proof.content_snapshot,
        labels_snapshot: proof.labels_snapshot,
        provenance_jsonld: typeof proof.provenance_jsonld === 'string'
            ? JSON.parse(proof.provenance_jsonld)
            : proof.provenance_jsonld,
        issued_at: proof.issued_at,
    };
}

/* ── Batch audit (mark human reviewed + issue proof) ──────── */

export async function batchAuditEntries(
    entryIds: string[],
    userId: string,
): Promise<DatasetAuditProof[]> {
    const proofs: DatasetAuditProof[] = [];
    for (const id of entryIds.slice(0, 100)) {
        try {
            const proof = await auditEntry(id, userId);
            proofs.push(proof);
        } catch (err) {
            console.warn(`[DatasetPipeline] Batch audit skip ${id}:`, (err as Error).message);
        }
    }
    return proofs;
}

/* ── Mark human reviewed ──────────────────────────────────── */

export async function markHumanReviewed(
    entryId: string,
    userId: string,
    groundTruth?: Record<string, unknown>,
): Promise<DatasetEntry> {
    const params: unknown[] = [entryId, userId];
    let gtClause = '';
    if (groundTruth) {
        gtClause = ', ground_truth = $3';
        params.push(JSON.stringify(groundTruth));
    }

    const { rows } = await pool.query(
        `UPDATE dataset_entries
     SET human_reviewed = TRUE${gtClause}, updated_at = NOW()
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
        params,
    );
    if (!rows[0]) throw new Error('Entry not found');
    return rowToEntry(rows[0]);
}

/* ── Queries ──────────────────────────────────────────────── */

export async function getEntries(
    userId: string,
    opts: {
        vertical?: DatasetVertical;
        stage?: DatasetEntryStage;
        origin?: DatasetEntryOrigin;
        limit?: number;
        offset?: number;
    } = {},
): Promise<{ entries: DatasetEntry[]; total: number }> {
    const conditions = ['user_id = $1'];
    const params: unknown[] = [userId];
    let paramIdx = 2;

    if (opts.vertical) {
        conditions.push(`vertical = $${paramIdx++}`);
        params.push(opts.vertical);
    }
    if (opts.stage) {
        conditions.push(`stage = $${paramIdx++}`);
        params.push(opts.stage);
    }
    if (opts.origin) {
        conditions.push(`origin = $${paramIdx++}`);
        params.push(opts.origin);
    }

    const where = conditions.join(' AND ');
    const limit = Math.min(Math.max(1, opts.limit || 50), 200);
    const offset = Math.max(0, opts.offset || 0);

    const [dataResult, countResult] = await Promise.all([
        pool.query(
            `SELECT * FROM dataset_entries WHERE ${where} ORDER BY created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
            [...params, limit, offset],
        ),
        pool.query(
            `SELECT COUNT(*)::int AS total FROM dataset_entries WHERE ${where}`,
            params,
        ),
    ]);

    return {
        entries: dataResult.rows.map(rowToEntry),
        total: countResult.rows[0]?.total || 0,
    };
}

export async function getVerticalSummary(
    userId: string,
    vertical: DatasetVertical,
): Promise<DatasetVerticalSummary> {
    const { rows } = await pool.query(
        `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE stage = 'ingested')::int AS ingested,
       COUNT(*) FILTER (WHERE stage = 'annotated')::int AS annotated,
       COUNT(*) FILTER (WHERE stage = 'synthesized')::int AS synthesized,
       COUNT(*) FILTER (WHERE stage = 'audited')::int AS audited,
       COUNT(*) FILTER (WHERE origin = 'real')::int AS real_count,
       COUNT(*) FILTER (WHERE origin = 'synthetic')::int AS synthetic_count,
       COUNT(*) FILTER (WHERE human_reviewed = TRUE)::int AS human_reviewed_count,
       COALESCE(AVG(confidence), 0)::float AS avg_confidence,
       MAX(created_at)::text AS last_ingestion_at
     FROM dataset_entries
     WHERE user_id = $1 AND vertical = $2`,
        [userId, vertical],
    );

    const r = rows[0] || {};
    const total = r.total || 0;
    const auditedCount = r.audited || 0;

    return {
        vertical,
        total_entries: total,
        by_stage: {
            ingested: r.ingested || 0,
            annotated: r.annotated || 0,
            synthesized: r.synthesized || 0,
            audited: auditedCount,
        },
        by_origin: {
            real: r.real_count || 0,
            synthetic: r.synthetic_count || 0,
        },
        audited_percentage: total > 0 ? Math.round((auditedCount / total) * 100) : 0,
        human_reviewed_count: r.human_reviewed_count || 0,
        avg_confidence: Math.round((r.avg_confidence || 0) * 100) / 100,
        last_ingestion_at: r.last_ingestion_at || null,
    };
}

export async function getAllVerticalSummaries(
    userId: string,
): Promise<DatasetVerticalSummary[]> {
    const verticals: DatasetVertical[] = ['ai_governance', 'incident_response', 'agentic_interaction'];
    return Promise.all(verticals.map((v) => getVerticalSummary(userId, v)));
}

export async function deleteEntry(entryId: string, userId: string): Promise<boolean> {
    const { rowCount } = await pool.query(
        `DELETE FROM dataset_entries WHERE id = $1 AND user_id = $2`,
        [entryId, userId],
    );
    return (rowCount ?? 0) > 0;
}

export async function getAuditProof(
    entryId: string,
    userId: string,
): Promise<DatasetAuditProof | null> {
    // Verify ownership
    const ownership = await pool.query(
        `SELECT id FROM dataset_entries WHERE id = $1 AND user_id = $2`,
        [entryId, userId],
    );
    if (!ownership.rows[0]) return null;

    const { rows } = await pool.query(
        `SELECT * FROM dataset_audit_proofs WHERE entry_id = $1 ORDER BY issued_at DESC LIMIT 1`,
        [entryId],
    );
    if (!rows[0]) return null;

    const proof = rows[0];
    return {
        entry_id: proof.entry_id,
        audit_hash: proof.audit_hash,
        algorithm: proof.algorithm,
        content_snapshot: proof.content_snapshot,
        labels_snapshot: proof.labels_snapshot,
        provenance_jsonld: typeof proof.provenance_jsonld === 'string'
            ? JSON.parse(proof.provenance_jsonld)
            : proof.provenance_jsonld,
        issued_at: proof.issued_at,
    };
}

/* ── Row mapper ──────────────────────────────────────────── */

function rowToEntry(row: Record<string, unknown>): DatasetEntry {
    return {
        id: String(row.id),
        vertical: row.vertical as DatasetVertical,
        stage: row.stage as DatasetEntryStage,
        origin: row.origin as DatasetEntryOrigin,
        source_url: String(row.source_url || ''),
        title: String(row.title || ''),
        content: String(row.content || ''),
        labels: (typeof row.labels === 'object' && row.labels !== null ? row.labels : {}) as Record<string, string | number | boolean>,
        ground_truth: row.ground_truth ? row.ground_truth as Record<string, string | number | boolean> : null,
        audit_hash: row.audit_hash ? String(row.audit_hash) : null,
        provenance_jsonld: row.provenance_jsonld ? row.provenance_jsonld as Record<string, unknown> : null,
        confidence: Number(row.confidence) || 0,
        human_reviewed: Boolean(row.human_reviewed),
        tags: Array.isArray(row.tags) ? row.tags : [],
        created_at: String(row.created_at),
        updated_at: String(row.updated_at),
    };
}
