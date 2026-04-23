/**
 * contentExpansionEngine.ts
 *
 * Gap → Indexable Page bridge for the AiVIS graph expansion pipeline.
 *
 * Each detected visibility gap becomes a structured, indexable page
 * with semantic HTML, embedded JSON-LD schema, and internal graph links.
 *
 * Page types (canonical):
 *   definition    – /what-is-{concept}
 *   comparison    – /{entity}-vs-{competitor}
 *   failure_state – /why-{entity}-is-not-cited-by-ai-models
 *   evidence      – /report/{entity}/visibility-analysis
 *
 * ARCHITECTURE RULES:
 *   - Every page must be traceable to a gap_id and scan_id
 *   - HTML is schema-annotated and LLM-crawlable
 *   - JSON-LD is embedded in every page as structured evidence
 *   - IndexNow is called after page publication
 *   - RSS event is emitted for every published page
 *
 * Security: all user-derived strings are sanitized before HTML embedding.
 * No direct HTML injection from external sources.
 */

import { getPool } from './postgresql.js';
import { submitToIndexNow } from './indexNowService.js';
import type { VisibilityGap } from './gapDetectionEngine.js';
import { sanitizePromptInput } from '../utils/sanitize.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ContentPageType = 'definition' | 'comparison' | 'failure_state' | 'evidence';

export interface ContentPageSpec {
    entity: string;
    page_type: ContentPageType;
    /** Competitor name — required for comparison pages */
    competitor?: string;
    /** Topic/concept — required for definition pages */
    concept?: string;
    scan_id: string | null;
    gap_ids: string[];
    evidence_url?: string;
}

export interface GeneratedPage {
    page_id: string;
    slug: string;
    title: string;
    page_type: ContentPageType;
    html_body: string;
    jsonld: object;
    published: boolean;
}

// ── Slug builder ──────────────────────────────────────────────────────────────

function slugify(input: string): string {
    return input
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-{2,}/g, '-')
        .slice(0, 96);
}

function buildSlug(type: ContentPageType, entity: string, extra?: string): string {
    const base = slugify(entity);
    switch (type) {
        case 'definition':
            return `what-is-${slugify(extra || entity)}`;
        case 'comparison':
            return `${base}-vs-${slugify(extra || 'alternatives')}`;
        case 'failure_state':
            return `why-${base}-is-not-cited-by-ai`;
        case 'evidence':
            return `report/${base}/visibility-analysis`;
    }
}

// ── HTML generators ───────────────────────────────────────────────────────────

function esc(raw: string): string {
    return raw
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function buildDefinitionPage(entity: string, concept: string): { title: string; html: string } {
    const safeEntity = esc(sanitizePromptInput(entity));
    const safeConcept = esc(sanitizePromptInput(concept));
    const title = `What is ${safeConcept}? — AI Visibility Explained by ${safeEntity}`;

    const html = `<article itemscope itemtype="https://schema.org/Article">
  <h1 itemprop="headline">${title}</h1>
  <section>
    <h2>Definition: ${safeConcept}</h2>
    <p itemprop="description">${safeConcept} is a concept tracked and measured by ${safeEntity} as part of AI visibility analysis. Understanding ${safeConcept} is essential for entities seeking citation presence in AI-generated answers.</p>
  </section>
  <section>
    <h2>Why ${safeConcept} Matters for AI Citation</h2>
    <p>AI answer engines like ChatGPT, Perplexity, and Claude select sources based on structured retrieval signals. ${safeConcept} represents a key component of how these systems evaluate entity authority.</p>
  </section>
  <section>
    <h2>How ${safeEntity} Measures ${safeConcept}</h2>
    <p>${safeEntity} uses a multi-model citation ledger to test, record, and track ${safeConcept} across AI answer surfaces. Every test is evidence-backed and traceable to a scan record.</p>
  </section>
  <section>
    <h2>Frequently Asked Questions</h2>
    <dl>
      <dt>What does ${safeConcept} mean for AI visibility?</dt>
      <dd>It determines whether AI systems recognize and cite an entity when answering relevant queries.</dd>
      <dt>How is ${safeConcept} improved?</dt>
      <dd>Through structured content signals, schema markup, and consistent entity definition across indexed sources.</dd>
    </dl>
  </section>
</article>`;

    return { title, html };
}

function buildComparisonPage(entity: string, competitor: string): { title: string; html: string } {
    const safeEntity = esc(sanitizePromptInput(entity));
    const safeCompetitor = esc(sanitizePromptInput(competitor));
    const title = `${safeEntity} vs ${safeCompetitor}: AI Visibility Comparison`;

    const html = `<article itemscope itemtype="https://schema.org/Article">
  <h1 itemprop="headline">${title}</h1>
  <p itemprop="description">A structured comparison of ${safeEntity} and ${safeCompetitor} for AI citation presence, measured by the AiVIS visibility engine.</p>
  <section>
    <h2>Comparison: ${safeEntity} vs ${safeCompetitor}</h2>
    <table>
      <thead>
        <tr><th>Dimension</th><th>${safeEntity}</th><th>${safeCompetitor}</th></tr>
      </thead>
      <tbody>
        <tr><td>AI Citation Presence</td><td>Tracked</td><td>Tracked</td></tr>
        <tr><td>Schema Coverage</td><td>Measured</td><td>Measured</td></tr>
        <tr><td>Entity Clarity</td><td>Scored</td><td>Scored</td></tr>
      </tbody>
    </table>
  </section>
  <section>
    <h2>Which is Cited More by AI Models?</h2>
    <p>AiVIS citation ledger data determines the relative citation frequency of ${safeEntity} and ${safeCompetitor} across multi-model probes. Visit the evidence page for live scan data.</p>
  </section>
</article>`;

    return { title, html };
}

function buildFailureStatePage(entity: string): { title: string; html: string } {
    const safeEntity = esc(sanitizePromptInput(entity));
    const title = `Why ${safeEntity} Is Not Cited by AI Models — Diagnosis`;

    const html = `<article itemscope itemtype="https://schema.org/Article">
  <h1 itemprop="headline">${title}</h1>
  <p itemprop="description">This page documents the specific signals that cause AI answer engines to exclude ${safeEntity} from citation responses, based on evidence from the AiVIS citation ledger.</p>
  <section>
    <h2>Citation Failure Analysis: ${safeEntity}</h2>
    <p>AI models exclude entities at one of four gates: retrieval, trust evaluation, semantic fit, or synthesis integration. This diagnostic identifies which gate is blocking ${safeEntity}.</p>
  </section>
  <section>
    <h2>Common Causes of AI Citation Exclusion</h2>
    <ul>
      <li><strong>Entity ambiguity</strong> — inconsistent naming across sources prevents recognition</li>
      <li><strong>Authority gap</strong> — insufficient external trust signals (citations, mentions)</li>
      <li><strong>Schema absence</strong> — missing structured data reduces extractability</li>
      <li><strong>Content density</strong> — content too thin to generate quotable passages</li>
      <li><strong>Query coverage gap</strong> — entity does not map to retrievable query patterns</li>
    </ul>
  </section>
  <section>
    <h2>How to Fix AI Citation Absence for ${safeEntity}</h2>
    <p>The AiVIS scoring engine generates prioritized remediation actions for each detected failure signal. Each fix is tied to a specific ledger record and measurable outcome.</p>
  </section>
</article>`;

    return { title, html };
}

function buildEvidencePage(entity: string, scan_id: string | null): { title: string; html: string } {
    const safeEntity = esc(sanitizePromptInput(entity));
    const safeScanId = esc(scan_id ?? 'latest');
    const title = `${safeEntity} — AI Visibility Analysis Report`;

    const html = `<article itemscope itemtype="https://schema.org/Report">
  <h1 itemprop="name">${title}</h1>
  <p itemprop="description">Evidence-backed AI visibility analysis for ${safeEntity}, generated by the AiVIS citation engine. Scan ID: ${safeScanId}.</p>
  <section>
    <h2>Citation Ledger Summary</h2>
    <p>This report is derived from an immutable citation ledger. Every claim traces to a specific model probe, query, and source retrieval event.</p>
  </section>
  <section>
    <h2>Visibility Score</h2>
    <p>The AiVIS visibility score for ${safeEntity} reflects multi-model citation frequency, entity clarity, authority signals, and schema coverage.</p>
  </section>
  <section>
    <h2>Gap Analysis</h2>
    <p>Detected visibility gaps for ${safeEntity} are categorized by type, severity, and estimated uplift potential. Each gap maps to at least one remediation action.</p>
  </section>
  <section>
    <h2>Model Probe Results</h2>
    <p>Probe results are recorded from parallel evaluation across multiple AI answer engines. Position rank, cited sources, and missing sources are stored in the visibility event ledger.</p>
  </section>
</article>`;

    return { title, html };
}

// ── JSON-LD builder ───────────────────────────────────────────────────────────

const SITE_URL = (process.env.FRONTEND_URL || 'https://aivis.biz').replace(/\/+$/, '');

function buildJsonLd(
    type: ContentPageType,
    title: string,
    slug: string,
    entity: string,
    scan_id: string | null,
): object {
    const url = `${SITE_URL}/${slug}`;
    const base = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: title,
        url,
        publisher: {
            '@type': 'Organization',
            name: 'AiVIS',
            url: SITE_URL,
        },
        about: {
            '@type': 'Thing',
            name: entity,
        },
        datePublished: new Date().toISOString(),
        additionalProperty: [
            {
                '@type': 'PropertyValue',
                name: 'aivis:pageType',
                value: type,
            },
            {
                '@type': 'PropertyValue',
                name: 'aivis:scanId',
                value: scan_id ?? 'unlinked',
            },
        ],
    };

    if (type === 'definition') {
        return {
            ...base,
            '@type': 'DefinedTerm',
            inDefinedTermSet: {
                '@type': 'DefinedTermSet',
                name: 'AiVIS AI Visibility Glossary',
                url: `${SITE_URL}/glossary`,
            },
        };
    }

    if (type === 'comparison') {
        return {
            ...base,
            '@type': 'Article',
            articleSection: 'Comparison',
        };
    }

    return base;
}

// ── DB write ──────────────────────────────────────────────────────────────────

async function persistContentPage(
    spec: ContentPageSpec,
    title: string,
    slug: string,
    html_body: string,
    jsonld: object,
): Promise<string | null> {
    const pool = getPool();
    try {
        const result = await pool.query(
            `INSERT INTO content_pages
                (scan_id, entity, page_type, title, slug, html_body, jsonld, gap_ids, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft')
             ON CONFLICT (slug) DO UPDATE SET
                 html_body  = EXCLUDED.html_body,
                 jsonld     = EXCLUDED.jsonld,
                 gap_ids    = EXCLUDED.gap_ids,
                 updated_at = NOW()
             RETURNING id`,
            [
                spec.scan_id,
                spec.entity.slice(0, 500),
                spec.page_type,
                title,
                slug,
                html_body,
                JSON.stringify(jsonld),
                spec.gap_ids,
            ],
        );
        return result.rows[0]?.id as string ?? null;
    } catch {
        return null;
    }
}

async function publishContentPage(page_id: string): Promise<void> {
    const pool = getPool();
    try {
        await pool.query(
            `UPDATE content_pages SET status = 'published', updated_at = NOW() WHERE id = $1`,
            [page_id],
        );
    } catch {
        // non-fatal
    }
}

async function markPageIndexed(page_id: string): Promise<void> {
    const pool = getPool();
    try {
        await pool.query(
            `UPDATE content_pages SET indexed_at = NOW() WHERE id = $1`,
            [page_id],
        );
    } catch {
        // non-fatal
    }
}

async function emitPagePublishedRssEvent(
    entity: string,
    title: string,
    slug: string,
    page_id: string,
    scan_id: string | null,
): Promise<void> {
    try {
        const pool = getPool();
        const link = `${SITE_URL}/${slug}`;
        await pool.query(
            `INSERT INTO rss_events (event_type, title, description, link, entity, scan_id, page_id)
             VALUES ('page_published', $1, $2, $3, $4, $5, $6)`,
            [title, `New indexable page generated for ${entity}: ${title}`, link, entity, scan_id, page_id],
        );
    } catch {
        // supplementary — swallow
    }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate and persist a single content page from a ContentPageSpec.
 * Returns the generated page or null if generation failed.
 */
export async function generateContentPage(
    spec: ContentPageSpec,
): Promise<GeneratedPage | null> {
    const entity = sanitizePromptInput(spec.entity).slice(0, 200);
    if (!entity) return null;

    let title: string;
    let html: string;
    let slug: string;

    switch (spec.page_type) {
        case 'definition': {
            const concept = sanitizePromptInput(spec.concept || entity);
            const built = buildDefinitionPage(entity, concept);
            title = built.title;
            html = built.html;
            slug = buildSlug('definition', entity, concept);
            break;
        }
        case 'comparison': {
            const competitor = sanitizePromptInput(spec.competitor || 'alternatives');
            const built = buildComparisonPage(entity, competitor);
            title = built.title;
            html = built.html;
            slug = buildSlug('comparison', entity, competitor);
            break;
        }
        case 'failure_state': {
            const built = buildFailureStatePage(entity);
            title = built.title;
            html = built.html;
            slug = buildSlug('failure_state', entity);
            break;
        }
        case 'evidence': {
            const built = buildEvidencePage(entity, spec.scan_id);
            title = built.title;
            html = built.html;
            slug = buildSlug('evidence', entity);
            break;
        }
    }

    const jsonld = buildJsonLd(spec.page_type, title, slug, entity, spec.scan_id);
    const page_id = await persistContentPage(spec, title, slug, html, jsonld);

    if (!page_id) return null;

    // Auto-publish
    await publishContentPage(page_id);

    // IndexNow submission
    try {
        const pageUrl = `${SITE_URL}/${slug}`;
        await submitToIndexNow([pageUrl]);
        await markPageIndexed(page_id);
    } catch {
        // IndexNow is best-effort
    }

    // RSS event
    void emitPagePublishedRssEvent(entity, title, slug, page_id, spec.scan_id);

    return {
        page_id,
        slug,
        title,
        page_type: spec.page_type,
        html_body: html,
        jsonld,
        published: true,
    };
}

/**
 * Expand a set of visibility gaps into content pages.
 * Each gap type maps deterministically to a page type.
 *
 * Gap → Page type mapping:
 *   citation_absence    → failure_state
 *   entity_ambiguity    → definition
 *   authority_gap       → evidence
 *   query_coverage_gap  → definition
 *   schema_gap          → evidence
 *   content_density_gap → failure_state
 *   link_authority_gap  → evidence
 *   freshness_gap       → evidence
 */
export async function expandGapsToPages(
    entity: string,
    gaps: VisibilityGap[],
    scan_id: string | null,
    competitors: string[] = [],
): Promise<GeneratedPage[]> {
    const pages: GeneratedPage[] = [];
    const generatedSlugs = new Set<string>();

    // Process competitors → comparison pages
    for (const competitor of competitors.slice(0, 5)) {
        const spec: ContentPageSpec = {
            entity,
            page_type: 'comparison',
            competitor,
            scan_id,
            gap_ids: [],
        };
        const slug = buildSlug('comparison', entity, competitor);
        if (!generatedSlugs.has(slug)) {
            generatedSlugs.add(slug);
            const page = await generateContentPage(spec);
            if (page) pages.push(page);
        }
    }

    // Group gaps by severity — process critical + high first
    const prioritized = [...gaps].sort((a, b) => {
        const order = { critical: 0, high: 1, medium: 2, low: 3 };
        return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
    });

    // Deduplicate by page type to avoid generating identical pages
    const typesGenerated = new Set<ContentPageType>();

    for (const gap of prioritized) {
        let page_type: ContentPageType;
        let concept: string | undefined;

        switch (gap.gap_type) {
            case 'citation_absence':
            case 'content_density_gap':
                page_type = 'failure_state';
                break;
            case 'entity_ambiguity':
            case 'query_coverage_gap':
                page_type = 'definition';
                concept = gap.missing_query_patterns[0] || entity;
                break;
            case 'authority_gap':
            case 'schema_gap':
            case 'link_authority_gap':
            case 'freshness_gap':
                page_type = 'evidence';
                break;
            default:
                page_type = 'evidence';
        }

        // Emit RSS event for each discovered gap
        void emitGapDiscoveredRssEvent(entity, gap, scan_id);

        // Only generate one page per type per expansion run
        if (typesGenerated.has(page_type)) continue;
        typesGenerated.add(page_type);

        const slug = buildSlug(page_type, entity, concept);
        if (generatedSlugs.has(slug)) continue;
        generatedSlugs.add(slug);

        const spec: ContentPageSpec = {
            entity,
            page_type,
            concept,
            scan_id,
            gap_ids: [gap.gap_id],
        };

        const page = await generateContentPage(spec);
        if (page) pages.push(page);
    }

    return pages;
}

async function emitGapDiscoveredRssEvent(
    entity: string,
    gap: VisibilityGap,
    scan_id: string | null,
): Promise<void> {
    try {
        const pool = getPool();
        const title = `Visibility gap discovered for "${entity}": ${gap.gap_type.replace(/_/g, ' ')} (${gap.severity})`;
        const description = gap.authority_gap_description || `${gap.gap_type} gap detected — estimated ${gap.estimated_uplift} point uplift potential.`;
        await pool.query(
            `INSERT INTO rss_events (event_type, title, description, entity, scan_id)
             VALUES ('gap_discovered', $1, $2, $3, $4)`,
            [title, description, entity, scan_id],
        );
    } catch {
        // supplementary — swallow
    }
}

// ── Fetch generated pages ─────────────────────────────────────────────────────

export interface ContentPageRow {
    id: string;
    entity: string;
    page_type: ContentPageType;
    title: string;
    slug: string;
    status: string;
    indexed_at: string | null;
    created_at: string;
}

export async function getContentPagesForEntity(
    entity: string,
): Promise<ContentPageRow[]> {
    const pool = getPool();
    try {
        const result = await pool.query(
            `SELECT id, entity, page_type, title, slug, status, indexed_at, created_at
             FROM content_pages
             WHERE LOWER(entity) = LOWER($1)
             ORDER BY created_at DESC
             LIMIT 100`,
            [entity],
        );
        return result.rows as ContentPageRow[];
    } catch {
        return [];
    }
}

export async function getContentPagesForScan(
    scan_id: string,
): Promise<ContentPageRow[]> {
    const pool = getPool();
    try {
        const result = await pool.query(
            `SELECT id, entity, page_type, title, slug, status, indexed_at, created_at
             FROM content_pages
             WHERE scan_id = $1
             ORDER BY created_at ASC`,
            [scan_id],
        );
        return result.rows as ContentPageRow[];
    } catch {
        return [];
    }
}
