import { getTierDisplayName, uiTierFromCanonical } from '../../../shared/types.js';
import type { AnalysisResponse, CanonicalTier, LegacyTier } from '../../../shared/types.js';
import { getPool } from './postgresql.js';

function slugify(input: string): string {
    return String(input || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-{2,}/g, '-')
        .slice(0, 96);
}

function parsePublicUrl(targetUrl: string): URL | null {
    try {
        return new URL(/^https?:\/\//i.test(targetUrl) ? targetUrl : `https://${targetUrl}`);
    } catch {
        return null;
    }
}

export function getPublicEntitySiteHost(targetUrl: string): string {
    const parsed = parsePublicUrl(targetUrl);
    return parsed?.hostname.toLowerCase().replace(/^www\./, '') || '';
}

export function buildPublicEntitySlug(targetUrl: string): string {
    const host = getPublicEntitySiteHost(targetUrl);
    const parts = host.split('.').filter(Boolean);
    const base = parts.length >= 2 ? parts[parts.length - 2] : host;
    return slugify(base || host || 'entity');
}

export function buildPublicEntityCanonicalTargetUrl(targetUrl: string): string {
    const parsed = parsePublicUrl(targetUrl);
    if (!parsed) return targetUrl;
    return `https://${parsed.hostname.toLowerCase().replace(/^www\./, '')}`;
}

function buildEntityName(targetUrl: string, result?: AnalysisResponse | null): string {
    const canonicalUrl = buildPublicEntityCanonicalTargetUrl(targetUrl);
    const host = getPublicEntitySiteHost(canonicalUrl);
    const pageTitle = String(result?.domain_intelligence?.page_title || '').trim();
    if (pageTitle) {
        const candidate = pageTitle.split(/[\-|•|·]/)[0]?.trim();
        if (candidate && candidate.length >= 2 && candidate.length <= 80) return candidate;
    }
    return host || targetUrl;
}

function buildEntityDefinition(name: string): string {
    return `${name} is an AI visibility audit target tracked by AiVIS to measure how answer engines interpret, trust, and cite the entity across public web surfaces.`;
}

function buildEvidenceLayer(result?: AnalysisResponse | null) {
    const ledger = Array.isArray(result?.brag_validation?.cite_ledger)
        ? result!.brag_validation!.cite_ledger
        : [];
    const findings = Array.isArray(result?.brag_validation?.findings)
        ? result!.brag_validation!.findings
        : [];

    return findings.slice(0, 12).map((finding, index) => {
        const ledgerEntry = ledger.find((entry) => entry.brag_id === finding.brag_id);
        return {
            identifier: finding.brag_id || `E${index + 1}`,
            title: finding.title,
            severity: finding.severity,
            confidence: finding.confidence,
            evidence_keys: finding.evidence_keys || [],
            content_hash: ledgerEntry?.content_hash || null,
            chain_hash: ledgerEntry?.chain_hash || null,
            timestamp: ledgerEntry?.timestamp || null,
        };
    });
}

function buildKeySignals(result?: AnalysisResponse | null): string[] {
    const signals = new Set<string>();

    for (const takeaway of result?.key_takeaways || []) {
        if (typeof takeaway === 'string' && takeaway.trim()) signals.add(takeaway.trim());
    }

    for (const schemaType of result?.schema_markup?.schema_types || []) {
        if (typeof schemaType === 'string' && schemaType.trim()) {
            signals.add(`Structured data detected: ${schemaType.trim()}`);
        }
    }

    if (result?.domain_intelligence?.entity_clarity_excerpt) {
        signals.add(`Entity clarity: ${String(result.domain_intelligence.entity_clarity_excerpt).trim()}`);
    }

    if (result?.technical_signals?.https_enabled) {
        signals.add('HTTPS is enabled on the audited target.');
    }

    return Array.from(signals).slice(0, 10);
}

export interface PublicEntitySnapshotSummary {
    audit_id: string;
    share_slug: string;
    share_path: string;
    entity_audit_path: string;
    created_at: string;
    visibility_score: number;
    summary: string;
    analysis_tier: CanonicalTier;
    analysis_tier_display: string;
    url: string;
}

export interface PublicEntityNodePayload {
    entity_slug: string;
    entity_name: string;
    canonical_target_url: string;
    canonical_entity_path: string;
    public_api_path: string;
    machine_endpoint_path: string;
    definition: string;
    latest_snapshot: PublicEntitySnapshotSummary;
    snapshots: PublicEntitySnapshotSummary[];
    evidence_layer: ReturnType<typeof buildEvidenceLayer>;
    key_signals: string[];
    latest_result: AnalysisResponse | null;
    latest_owner_tier: CanonicalTier;
}

export async function getPublicEntityNode(entitySlug: string): Promise<PublicEntityNodePayload | null> {
    const pool = getPool();
    const { rows } = await pool.query(
        `SELECT prl.slug, a.id, a.url, a.visibility_score, a.result, a.created_at, COALESCE(u.tier, 'observer') AS owner_tier
     FROM public_report_links prl
     JOIN audits a ON a.id = prl.audit_id
     JOIN users u ON u.id = a.user_id
     WHERE prl.is_active = TRUE
     ORDER BY a.created_at DESC
     LIMIT 500`
    );

    const candidateRows = rows.filter((row: any) => buildPublicEntitySlug(String(row.url || '')) === entitySlug);
    if (candidateRows.length === 0) return null;

    const latestRow = candidateRows[0] as any;
    const siteHost = getPublicEntitySiteHost(String(latestRow.url || ''));
    const filteredRows = candidateRows.filter((row: any) => getPublicEntitySiteHost(String(row.url || '')) === siteHost);
    if (filteredRows.length === 0) return null;

    const latestResult = (latestRow.result && typeof latestRow.result === 'object')
        ? (latestRow.result as AnalysisResponse)
        : null;
    const latestOwnerTier = uiTierFromCanonical((latestRow.owner_tier || 'observer') as CanonicalTier | LegacyTier);
    const entityName = buildEntityName(String(latestRow.url || ''), latestResult);
    const canonicalTargetUrl = buildPublicEntityCanonicalTargetUrl(String(latestRow.url || ''));
    const canonicalEntityPath = `/entity/${entitySlug}`;

    const snapshots: PublicEntitySnapshotSummary[] = filteredRows.slice(0, 25).map((row: any) => {
        const ownerTier = uiTierFromCanonical((row.owner_tier || 'observer') as CanonicalTier | LegacyTier);
        return {
            audit_id: String(row.id),
            share_slug: String(row.slug),
            share_path: `/reports/public/${String(row.slug)}`,
            entity_audit_path: `/entity/${entitySlug}/audit/${String(row.slug)}`,
            created_at: new Date(row.created_at).toISOString(),
            visibility_score: Number(row.visibility_score || 0),
            summary: String((row.result as AnalysisResponse | null)?.summary || ''),
            analysis_tier: ownerTier,
            analysis_tier_display: getTierDisplayName((row.owner_tier || 'observer') as CanonicalTier | LegacyTier),
            url: String(row.url || ''),
        };
    });

    return {
        entity_slug: entitySlug,
        entity_name: entityName,
        canonical_target_url: canonicalTargetUrl,
        canonical_entity_path: canonicalEntityPath,
        public_api_path: `/api/public/entities/${entitySlug}`,
        machine_endpoint_path: `/api/public/entities/${entitySlug}`,
        definition: buildEntityDefinition(entityName),
        latest_snapshot: snapshots[0],
        snapshots,
        evidence_layer: buildEvidenceLayer(latestResult),
        key_signals: buildKeySignals(latestResult),
        latest_result: latestResult,
        latest_owner_tier: latestOwnerTier,
    };
}

export async function listPublicEntitySitemapEntries(): Promise<Array<{ loc: string; lastmod: string }>> {
    const pool = getPool();
    const { rows } = await pool.query(
        `SELECT prl.slug, a.url, a.created_at
     FROM public_report_links prl
     JOIN audits a ON a.id = prl.audit_id
     WHERE prl.is_active = TRUE
     ORDER BY a.created_at DESC
     LIMIT 1000`
    );

    const entityMap = new Map<string, string>();
    const entries: Array<{ loc: string; lastmod: string }> = [];

    for (const row of rows as any[]) {
        const entitySlug = buildPublicEntitySlug(String(row.url || ''));
        const lastmod = new Date(row.created_at).toISOString().slice(0, 10);
        if (entitySlug && !entityMap.has(entitySlug)) {
            entityMap.set(entitySlug, lastmod);
            entries.push({ loc: `https://aivis.biz/entity/${entitySlug}`, lastmod });
        }
        entries.push({ loc: `https://aivis.biz/entity/${entitySlug}/audit/${String(row.slug)}`, lastmod });
    }

    return entries;
}
