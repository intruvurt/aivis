/**
 * graphExportService.ts
 *
 * JSON-LD @graph export for the AiVIS knowledge graph.
 *
 * Produces a schema.org-compatible @graph document from a scan's:
 *   - entity nodes
 *   - semantic relationship edges
 *   - citation ledger events
 *   - visibility probe results
 *   - generated content pages
 *
 * This is the machine-readable representation that LLMs use to
 * understand entity structure when crawling the AiVIS domain.
 *
 * Output conforms to:
 *   https://schema.org/Dataset (container)
 *   https://schema.org/Thing   (entities)
 *   https://schema.org/Article (content pages)
 *
 * Endpoint: GET /api/graph/export/:scanId
 */

import { getPool } from './postgresql.js';
import { getRelationshipsForScan } from './entityRelationshipEngine.js';
import { getVisibilityEventsForScan } from './visibilityEventLedger.js';
import { getContentPagesForScan } from './contentExpansionEngine.js';

const SITE_URL = (process.env.FRONTEND_URL || 'https://aivis.biz').replace(/\/+$/, '');

// ── Types ─────────────────────────────────────────────────────────────────────

export interface JsonLdGraphExport {
    '@context': string;
    '@type': 'Dataset';
    name: string;
    description: string;
    url: string;
    dateModified: string;
    publisher: {
        '@type': 'Organization';
        name: string;
        url: string;
    };
    scan_id: string;
    '@graph': JsonLdNode[];
}

export type JsonLdNode =
    | JsonLdEntity
    | JsonLdRelationship
    | JsonLdVisibilityEvent
    | JsonLdContentPage;

interface JsonLdEntity {
    '@type': 'Thing';
    '@id': string;
    name: string;
    identifier: string;
    'aivis:entityType'?: string;
}

interface JsonLdRelationship {
    '@type': 'PropertyValue';
    '@id': string;
    name: string;
    'aivis:fromEntity': string;
    'aivis:toEntity': string;
    'aivis:relationshipType': string;
    'aivis:strength': number;
    'aivis:evidenceUrl'?: string;
}

interface JsonLdVisibilityEvent {
    '@type': 'Action';
    '@id': string;
    name: string;
    'aivis:prompt': string;
    'aivis:modelUsed': string;
    'aivis:entityPresent': boolean;
    'aivis:positionRank'?: number;
    'aivis:citedSources': string[];
    'aivis:missingSources': string[];
    startTime: string;
}

interface JsonLdContentPage {
    '@type': 'Article';
    '@id': string;
    name: string;
    url: string;
    'aivis:pageType': string;
    'aivis:status': string;
}

// ── Entity fetcher ────────────────────────────────────────────────────────────

interface EntityRow {
    id: string;
    canonical_name: string;
    type: string | null;
}

async function getEntitiesForScan(scan_id: string): Promise<EntityRow[]> {
    const pool = getPool();
    try {
        const result = await pool.query(
            `SELECT DISTINCT e.id, e.canonical_name, e.type
             FROM entities e
             JOIN entity_relationships er
               ON (er.from_entity_id = e.id OR er.to_entity_id = e.id)
             WHERE er.scan_id = $1
             LIMIT 500`,
            [scan_id],
        );
        return result.rows as EntityRow[];
    } catch {
        return [];
    }
}

// ── Graph builder ─────────────────────────────────────────────────────────────

export async function buildGraphExport(scan_id: string): Promise<JsonLdGraphExport> {
    // Fetch all sources concurrently
    const [entities, relationships, visibilityEvents, contentPages] = await Promise.all([
        getEntitiesForScan(scan_id),
        getRelationshipsForScan(scan_id),
        getVisibilityEventsForScan(scan_id),
        getContentPagesForScan(scan_id),
    ]);

    const nodes: JsonLdNode[] = [];

    // Entity nodes
    for (const entity of entities) {
        nodes.push({
            '@type': 'Thing',
            '@id': `${SITE_URL}/entities/${entity.id}`,
            name: entity.canonical_name,
            identifier: entity.id,
            'aivis:entityType': entity.type ?? undefined,
        });
    }

    // Relationship edges
    for (const rel of relationships) {
        nodes.push({
            '@type': 'PropertyValue',
            '@id': `${SITE_URL}/relationships/${rel.id}`,
            name: `${rel.from_canonical} ${rel.relationship_type.replace(/_/g, ' ')} ${rel.to_canonical}`,
            'aivis:fromEntity': rel.from_canonical,
            'aivis:toEntity': rel.to_canonical,
            'aivis:relationshipType': rel.relationship_type,
            'aivis:strength': rel.strength,
            'aivis:evidenceUrl': rel.evidence_url ?? undefined,
        });
    }

    // Visibility events (probe records)
    for (const event of visibilityEvents) {
        nodes.push({
            '@type': 'Action',
            '@id': `${SITE_URL}/visibility-events/${event.id}`,
            name: `Probe: "${event.prompt.slice(0, 80)}" via ${event.model_used}`,
            'aivis:prompt': event.prompt,
            'aivis:modelUsed': event.model_used,
            'aivis:entityPresent': event.entity_present,
            'aivis:positionRank': event.position_rank ?? undefined,
            'aivis:citedSources': event.cited_sources,
            'aivis:missingSources': event.missing_sources,
            startTime: event.probed_at,
        });
    }

    // Content pages
    for (const page of contentPages) {
        nodes.push({
            '@type': 'Article',
            '@id': `${SITE_URL}/${page.slug}`,
            name: page.title,
            url: `${SITE_URL}/${page.slug}`,
            'aivis:pageType': page.page_type,
            'aivis:status': page.status,
        });
    }

    return {
        '@context': 'https://schema.org',
        '@type': 'Dataset',
        name: `AiVIS Graph Export — Scan ${scan_id}`,
        description: `Structured knowledge graph of entity relationships, visibility events, and content pages derived from AiVIS scan ${scan_id}.`,
        url: `${SITE_URL}/api/graph/export/${scan_id}`,
        dateModified: new Date().toISOString(),
        publisher: {
            '@type': 'Organization',
            name: 'AiVIS',
            url: SITE_URL,
        },
        scan_id,
        '@graph': nodes,
    };
}

/**
 * Build a compact summary graph for embedding in page <head> JSON-LD.
 * Excludes visibility event detail — only entities + relationships.
 */
export async function buildEmbeddableGraphSnippet(
    entity: string,
): Promise<object> {
    const pool = getPool();

    try {
        // Get entity ID
        const entityRow = await pool.query(
            `SELECT id, canonical_name, type FROM entities WHERE LOWER(canonical_name) = LOWER($1) LIMIT 1`,
            [entity],
        );
        if (!entityRow.rows.length) {
            return { '@context': 'https://schema.org', '@type': 'Thing', name: entity };
        }

        const entityId = entityRow.rows[0].id as string;

        // Get outbound relationships
        const relRows = await pool.query(
            `SELECT er.relationship_type, te.canonical_name AS to_canonical, er.strength
             FROM entity_relationships er
             JOIN entities te ON te.id = er.to_entity_id
             WHERE er.from_entity_id = $1
             ORDER BY er.strength DESC
             LIMIT 20`,
            [entityId],
        );

        const relatedEntities = relRows.rows.map((r: any) => ({
            '@type': 'Thing',
            name: r.to_canonical as string,
            'aivis:relationship': r.relationship_type as string,
            'aivis:strength': r.strength as number,
        }));

        return {
            '@context': 'https://schema.org',
            '@type': 'Thing',
            name: entity,
            identifier: entityId,
            relatedLink: relatedEntities,
        };
    } catch {
        return { '@context': 'https://schema.org', '@type': 'Thing', name: entity };
    }
}
