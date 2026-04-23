import { createHash } from 'crypto';
import { getPool } from '../postgresql.js';
import type {
    AnalyzeStageCommand,
    AnalyzeCompilerRequest,
    AnalyzeDepth,
    AnalyzeInputSource,
    AnalyzeMode,
    AnalyzeState,
    CompiledPage,
    EntityGap,
    EntityNode,
    PageSpec,
} from './types.js';

const PIPELINE: AnalyzeState[] = [
    'SCAN_INIT',
    'ENTITY_MAPPING',
    'VISIBILITY_GAP_ANALYSIS',
    'PAGE_SPEC_GENERATION',
    'CONTENT_COMPILATION',
    'SCHEMA_BINDING',
    'GRAPH_LINKING',
    'READY',
];

const COMMAND_TO_STATE: Record<AnalyzeStageCommand, AnalyzeState> = {
    scan: 'SCAN_INIT',
    entities: 'ENTITY_MAPPING',
    gaps: 'VISIBILITY_GAP_ANALYSIS',
    pagespec: 'PAGE_SPEC_GENERATION',
    compile: 'CONTENT_COMPILATION',
    schema: 'SCHEMA_BINDING',
    graph: 'GRAPH_LINKING',
};

const EVENT_TYPES = {
    SCAN_CREATED: 'SCAN_CREATED',
    ENTITIES_RESOLVED: 'ENTITIES_RESOLVED',
    GAP_ANALYZED: 'GAP_ANALYZED',
    PAGE_SPEC_CREATED: 'PAGE_SPEC_CREATED',
    PAGE_COMPILED: 'PAGE_COMPILED',
    PAGE_PUBLISHED: 'PAGE_PUBLISHED',
} as const;

function normalizeInputSource(input: string, source?: AnalyzeInputSource): AnalyzeInputSource {
    if (source) return source;
    if (/^https?:\/\//i.test(input)) return 'url';
    if (/\./.test(input) && !/\s/.test(input)) return 'domain';
    return 'keyword';
}

function normalizeMode(mode?: AnalyzeMode): AnalyzeMode {
    return mode || 'content';
}

function normalizeDepth(depth?: AnalyzeDepth): AnalyzeDepth {
    return depth || 'deep';
}

function slugify(input: string): string {
    return input
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, ' ')
        .trim()
        .replace(/\s+/g, '-')
        .slice(0, 80);
}

function requestHash(payload: {
    sourceType: AnalyzeInputSource;
    sourceInput: string;
    mode: AnalyzeMode;
    depth: AnalyzeDepth;
}): string {
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

async function getJobState(jobId: string): Promise<AnalyzeState> {
    const pool = getPool();
    const { rows } = await pool.query(
        `SELECT state FROM analyze_jobs WHERE id = $1`,
        [jobId],
    );
    if (!rows.length) throw new Error('Analyze job not found');
    return String(rows[0].state) as AnalyzeState;
}

async function appendEvent(jobId: string, stage: AnalyzeState, eventType: string, payload: Record<string, unknown>, stateDelta: Record<string, unknown>): Promise<void> {
    const pool = getPool();
    const parent = await pool.query(
        `SELECT sequence, event_hash FROM analyze_job_events WHERE job_id = $1 ORDER BY sequence DESC LIMIT 1`,
        [jobId],
    );
    const parentHash = parent.rows[0]?.event_hash ? String(parent.rows[0].event_hash) : '';
    const sequence = Number(parent.rows[0]?.sequence ?? -1) + 1;
    const material = `${jobId}\u0000${sequence}\u0000${stage}\u0000${eventType}\u0000${JSON.stringify(payload)}\u0000${JSON.stringify(stateDelta)}\u0000${parentHash}`;
    const eventHash = createHash('sha256').update(material).digest('hex');

    await pool.query(
        `INSERT INTO analyze_job_events (job_id, sequence, stage, event_type, payload, state_delta, parent_hash, event_hash)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8)`,
        [jobId, sequence, stage, eventType, JSON.stringify(payload), JSON.stringify(stateDelta), parentHash || null, eventHash],
    );
}

async function transitionState(jobId: string, from: AnalyzeState, to: AnalyzeState): Promise<void> {
    const pool = getPool();
    const { rowCount } = await pool.query(
        `UPDATE analyze_jobs
     SET state = $2, updated_at = NOW(), current_stage_started_at = NOW(),
         attempt_count = CASE WHEN state = $2 THEN attempt_count ELSE attempt_count + 1 END
     WHERE id = $1 AND state = $3`,
        [jobId, to, from],
    );

    if (rowCount === 0) {
        const current = await getJobState(jobId);
        if (current === to) return;
        throw new Error(`Invalid state transition for ${jobId}: expected ${from}, got ${current}`);
    }
}

function deriveEntities(input: string): EntityNode[] {
    const tokens = input
        .split(/[^a-zA-Z0-9]+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 4)
        .slice(0, 8);

    if (!tokens.length) {
        return [
            {
                entityKey: 'ent_visibility_surface',
                name: 'visibility surface',
                entityType: 'concept',
                confidence: 0.8,
            },
        ];
    }

    return tokens.map((token, idx) => ({
        entityKey: `ent_${slugify(token)}_${idx}`,
        name: token,
        entityType: 'concept',
        confidence: Math.max(0.55, 0.95 - idx * 0.06),
    }));
}

function deriveGaps(entities: EntityNode[]): EntityGap[] {
    return entities.map((entity, idx) => {
        const underrepresented = entity.confidence < 0.82;
        const uncited = idx % 3 === 0;
        const status: EntityGap['status'] = uncited
            ? 'uncited'
            : underrepresented
                ? 'underrepresented'
                : 'represented';

        return {
            entityKey: entity.entityKey,
            status,
            opportunityScore: Number((0.5 + (1 - entity.confidence) * 0.7).toFixed(3)),
            citationPresence: !uncited,
            missingPageTypes: uncited
                ? ['definition', 'mechanism explanation', 'case study']
                : underrepresented
                    ? ['comparison', 'proof']
                    : ['demonstration'],
        };
    });
}

function derivePageSpecs(gaps: EntityGap[], entities: EntityNode[]): PageSpec[] {
    const byKey = new Map(entities.map((entity) => [entity.entityKey, entity]));

    return gaps
        .filter((gap) => gap.status !== 'represented')
        .map((gap, idx) => {
            const entity = byKey.get(gap.entityKey);
            const entityName = entity?.name || gap.entityKey;
            return {
                entityKey: gap.entityKey,
                intent: idx % 2 === 0 ? 'explain' : 'define',
                title: `What is ${entityName}`,
                slug: slugify(entityName),
                targetQueryCluster: [`${entityName} definition`, `${entityName} explanation`, `${entityName} impact`],
                requiredSections: ['definition', 'why it matters', 'measurement method', 'mitigation strategies'],
                schemaType: 'Article',
                priority: Number(gap.opportunityScore.toFixed(3)),
                internalLinks: [],
            };
        });
}

function compilePages(pageSpecs: Array<PageSpec & { id: string }>, entities: EntityNode[]): CompiledPage[] {
    const byKey = new Map(entities.map((entity) => [entity.entityKey, entity]));
    return pageSpecs.map((spec) => {
        const name = byKey.get(spec.entityKey)?.name || spec.entityKey;
        const sections = spec.requiredSections.map((section) => ({
            heading: section,
            content: `${name}: ${section} in the context of AI visibility and citation retrieval behavior.`,
            entities: [name],
        }));

        return {
            pageSpecId: spec.id,
            title: spec.title,
            slug: spec.slug,
            sections,
            claims: [`${name} is evaluated through citation presence and structural traceability.`],
            internalLinks: spec.internalLinks,
        };
    });
}

async function loadMappedEntities(jobId: string): Promise<EntityNode[]> {
    const pool = getPool();
    const entityRows = await pool.query(
        `SELECT entity_key, name, entity_type, confidence FROM entity_nodes WHERE job_id = $1 ORDER BY created_at ASC`,
        [jobId],
    );

    return entityRows.rows.map((row) => ({
        entityKey: String(row.entity_key),
        name: String(row.name),
        entityType: String(row.entity_type) as EntityNode['entityType'],
        confidence: Number(row.confidence),
    }));
}

export async function runScanStage(jobId: string): Promise<void> {
    const pool = getPool();
    const job = await pool.query(`SELECT source_input, state FROM analyze_jobs WHERE id = $1`, [jobId]);
    if (!job.rows.length) throw new Error('Analyze job not found');
    if (String(job.rows[0].state) !== 'SCAN_INIT') return;

    const sourceInput = String(job.rows[0].source_input || '');
    await appendEvent(jobId, 'SCAN_INIT', EVENT_TYPES.SCAN_CREATED, { sourceInput }, { source_input: sourceInput });
    await transitionState(jobId, 'SCAN_INIT', 'ENTITY_MAPPING');
}

export async function runEntitiesStage(jobId: string): Promise<void> {
    const pool = getPool();
    const job = await pool.query(`SELECT source_input, state FROM analyze_jobs WHERE id = $1`, [jobId]);
    if (!job.rows.length) throw new Error('Analyze job not found');
    if (String(job.rows[0].state) !== 'ENTITY_MAPPING') return;

    const sourceInput = String(job.rows[0].source_input || '');
    const mappedEntities = deriveEntities(sourceInput);

    for (const entity of mappedEntities) {
        await pool.query(
            `INSERT INTO entity_nodes (job_id, entity_key, name, entity_type, confidence)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (job_id, entity_key) DO UPDATE
             SET name = EXCLUDED.name, entity_type = EXCLUDED.entity_type, confidence = EXCLUDED.confidence`,
            [jobId, entity.entityKey, entity.name, entity.entityType, entity.confidence],
        );
    }

    for (let idx = 1; idx < mappedEntities.length; idx += 1) {
        await pool.query(
            `INSERT INTO entity_edges (job_id, from_entity_key, to_entity_key, edge_type, confidence)
             VALUES ($1, $2, $3, 'ENTITY_ENTITY', $4)
             ON CONFLICT (job_id, from_entity_key, to_entity_key, edge_type) DO NOTHING`,
            [jobId, mappedEntities[idx - 1].entityKey, mappedEntities[idx].entityKey, 0.75],
        );
    }

    await appendEvent(jobId, 'ENTITY_MAPPING', EVENT_TYPES.ENTITIES_RESOLVED, { count: mappedEntities.length }, { entity_count: mappedEntities.length });
    await transitionState(jobId, 'ENTITY_MAPPING', 'VISIBILITY_GAP_ANALYSIS');
}

export async function runGapsStage(jobId: string): Promise<void> {
    const pool = getPool();
    const job = await pool.query(`SELECT state FROM analyze_jobs WHERE id = $1`, [jobId]);
    if (!job.rows.length) throw new Error('Analyze job not found');
    if (String(job.rows[0].state) !== 'VISIBILITY_GAP_ANALYSIS') return;

    const mappedEntities = await loadMappedEntities(jobId);
    const gaps = deriveGaps(mappedEntities);

    for (const gap of gaps) {
        await pool.query(
            `INSERT INTO entity_gap_models (
              job_id, entity_key, status, opportunity_score, citation_presence, semantic_saturation, authority_gap,
              structural_absence, missing_page_types
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb)
            ON CONFLICT (job_id, entity_key) DO UPDATE
            SET status = EXCLUDED.status,
                opportunity_score = EXCLUDED.opportunity_score,
                citation_presence = EXCLUDED.citation_presence,
                semantic_saturation = EXCLUDED.semantic_saturation,
                authority_gap = EXCLUDED.authority_gap,
                structural_absence = EXCLUDED.structural_absence,
                missing_page_types = EXCLUDED.missing_page_types`,
            [
                jobId,
                gap.entityKey,
                gap.status,
                gap.opportunityScore,
                gap.citationPresence,
                Number((1 - gap.opportunityScore).toFixed(3)),
                Number((gap.opportunityScore * 0.8).toFixed(3)),
                JSON.stringify(gap.missingPageTypes),
                JSON.stringify(gap.missingPageTypes),
            ],
        );
    }

    await appendEvent(jobId, 'VISIBILITY_GAP_ANALYSIS', EVENT_TYPES.GAP_ANALYZED, { count: gaps.length }, { opportunity_avg: gaps.length ? gaps.reduce((acc, gap) => acc + gap.opportunityScore, 0) / gaps.length : 0 });
    await transitionState(jobId, 'VISIBILITY_GAP_ANALYSIS', 'PAGE_SPEC_GENERATION');
}

export async function runPageSpecStage(jobId: string): Promise<void> {
    const pool = getPool();
    const job = await pool.query(`SELECT state FROM analyze_jobs WHERE id = $1`, [jobId]);
    if (!job.rows.length) throw new Error('Analyze job not found');
    if (String(job.rows[0].state) !== 'PAGE_SPEC_GENERATION') return;

    const mappedEntities = await loadMappedEntities(jobId);
    const rows = await pool.query(
        `SELECT entity_key, status, opportunity_score, citation_presence, missing_page_types FROM entity_gap_models WHERE job_id = $1 ORDER BY created_at ASC`,
        [jobId],
    );
    const gaps: EntityGap[] = rows.rows.map((row) => ({
        entityKey: String(row.entity_key),
        status: String(row.status) as EntityGap['status'],
        opportunityScore: Number(row.opportunity_score),
        citationPresence: Boolean(row.citation_presence),
        missingPageTypes: Array.isArray(row.missing_page_types) ? row.missing_page_types.map(String) : [],
    }));

    const specs = derivePageSpecs(gaps, mappedEntities);
    for (const spec of specs) {
        await pool.query(
            `INSERT INTO page_specs (
              job_id, entity_key, intent, title, slug, target_query_cluster, required_sections, schema_type, priority, internal_links
            ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10::jsonb)
            ON CONFLICT (job_id, slug) DO UPDATE
            SET title = EXCLUDED.title,
                intent = EXCLUDED.intent,
                target_query_cluster = EXCLUDED.target_query_cluster,
                required_sections = EXCLUDED.required_sections,
                schema_type = EXCLUDED.schema_type,
                priority = EXCLUDED.priority,
                internal_links = EXCLUDED.internal_links`,
            [jobId, spec.entityKey, spec.intent, spec.title, spec.slug, JSON.stringify(spec.targetQueryCluster), JSON.stringify(spec.requiredSections), spec.schemaType, spec.priority, JSON.stringify(spec.internalLinks)],
        );
    }

    await appendEvent(jobId, 'PAGE_SPEC_GENERATION', EVENT_TYPES.PAGE_SPEC_CREATED, { count: specs.length }, { spec_count: specs.length });
    await transitionState(jobId, 'PAGE_SPEC_GENERATION', 'CONTENT_COMPILATION');
}

export async function runCompileStage(jobId: string): Promise<void> {
    const pool = getPool();
    const job = await pool.query(`SELECT state FROM analyze_jobs WHERE id = $1`, [jobId]);
    if (!job.rows.length) throw new Error('Analyze job not found');
    if (String(job.rows[0].state) !== 'CONTENT_COMPILATION') return;

    const mappedEntities = await loadMappedEntities(jobId);
    const specRows = await pool.query(
        `SELECT id, entity_key, intent, title, slug, target_query_cluster, required_sections, schema_type, priority, internal_links
         FROM page_specs WHERE job_id = $1 ORDER BY priority DESC, created_at ASC`,
        [jobId],
    );

    const pageSpecs: Array<PageSpec & { id: string }> = specRows.rows.map((row) => ({
        id: String(row.id),
        entityKey: String(row.entity_key),
        intent: String(row.intent) as PageSpec['intent'],
        title: String(row.title),
        slug: String(row.slug),
        targetQueryCluster: Array.isArray(row.target_query_cluster) ? row.target_query_cluster.map(String) : [],
        requiredSections: Array.isArray(row.required_sections) ? row.required_sections.map(String) : [],
        schemaType: String(row.schema_type),
        priority: Number(row.priority),
        internalLinks: Array.isArray(row.internal_links) ? row.internal_links.map(String) : [],
    }));

    const compiledPages = compilePages(pageSpecs, mappedEntities);
    for (const page of compiledPages) {
        const markdown = page.sections.map((section) => `## ${section.heading}\n\n${section.content}`).join('\n\n');
        const html = page.sections.map((section) => `<h2>${section.heading}</h2><p>${section.content}</p>`).join('');
        await pool.query(
            `INSERT INTO page_builds (job_id, page_spec_id, title, slug, sections, claims, internal_links, render_markdown, render_html)
             VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8,$9)
             ON CONFLICT (job_id, page_spec_id) DO UPDATE
             SET title = EXCLUDED.title,
                 slug = EXCLUDED.slug,
                 sections = EXCLUDED.sections,
                 claims = EXCLUDED.claims,
                 internal_links = EXCLUDED.internal_links,
                 render_markdown = EXCLUDED.render_markdown,
                 render_html = EXCLUDED.render_html,
                 updated_at = NOW()`,
            [jobId, page.pageSpecId, page.title, page.slug, JSON.stringify(page.sections), JSON.stringify(page.claims), JSON.stringify(page.internalLinks), markdown, html],
        );
    }

    await appendEvent(jobId, 'CONTENT_COMPILATION', EVENT_TYPES.PAGE_COMPILED, { count: compiledPages.length }, { compiled_count: compiledPages.length });
    await transitionState(jobId, 'CONTENT_COMPILATION', 'SCHEMA_BINDING');
}

export async function runSchemaStage(jobId: string): Promise<void> {
    const pool = getPool();
    const job = await pool.query(`SELECT state FROM analyze_jobs WHERE id = $1`, [jobId]);
    if (!job.rows.length) throw new Error('Analyze job not found');
    if (String(job.rows[0].state) !== 'SCHEMA_BINDING') return;

    const pages = await pool.query(
        `SELECT pb.id, pb.slug, pb.title, ps.entity_key
         FROM page_builds pb
         JOIN page_specs ps ON ps.id = pb.page_spec_id
         WHERE pb.job_id = $1`,
        [jobId],
    );

    for (const page of pages.rows) {
        const schema = {
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: String(page.title),
            about: String(page.entity_key),
            mainEntity: String(page.entity_key),
        };

        await pool.query(
            `INSERT INTO page_schema_bindings (job_id, page_build_id, schema_payload, entity_mentions)
             VALUES ($1, $2, $3::jsonb, $4::jsonb)
             ON CONFLICT (page_build_id) DO UPDATE
             SET schema_payload = EXCLUDED.schema_payload,
                 entity_mentions = EXCLUDED.entity_mentions`,
            [jobId, String(page.id), JSON.stringify(schema), JSON.stringify([String(page.entity_key)])],
        );
    }

    await appendEvent(jobId, 'SCHEMA_BINDING', 'SCHEMA_BOUND', { count: pages.rows.length }, { schema_count: pages.rows.length });
    await transitionState(jobId, 'SCHEMA_BINDING', 'GRAPH_LINKING');
}

export async function runGraphStage(jobId: string): Promise<void> {
    const pool = getPool();
    const job = await pool.query(`SELECT state FROM analyze_jobs WHERE id = $1`, [jobId]);
    if (!job.rows.length) throw new Error('Analyze job not found');
    if (String(job.rows[0].state) !== 'GRAPH_LINKING') return;

    const pages = await pool.query(`SELECT id FROM page_builds WHERE job_id = $1 ORDER BY created_at ASC`, [jobId]);
    for (let idx = 1; idx < pages.rows.length; idx += 1) {
        await pool.query(
            `INSERT INTO page_link_graph (job_id, from_page_build_id, to_page_build_id, reason)
             VALUES ($1, $2, $3, 'shared_topic_cluster')
             ON CONFLICT (job_id, from_page_build_id, to_page_build_id, reason) DO NOTHING`,
            [jobId, String(pages.rows[idx - 1].id), String(pages.rows[idx].id)],
        );
    }

    await appendEvent(jobId, 'GRAPH_LINKING', 'GRAPH_LINKED', { count: Math.max(0, pages.rows.length - 1) }, { link_count: Math.max(0, pages.rows.length - 1) });
    await transitionState(jobId, 'GRAPH_LINKING', 'READY');
    await appendEvent(jobId, 'READY', 'READY', { stages: PIPELINE.length }, { ready: true });
    await pool.query(`UPDATE analyze_jobs SET completed_at = NOW(), updated_at = NOW() WHERE id = $1`, [jobId]);
}

export async function runStageCommand(jobId: string, command: AnalyzeStageCommand): Promise<void> {
    const expectedState = COMMAND_TO_STATE[command];
    const state = await getJobState(jobId);
    if (state !== expectedState) {
        throw new Error(`Stage command '${command}' expects state '${expectedState}', got '${state}'`);
    }

    if (command === 'scan') return runScanStage(jobId);
    if (command === 'entities') return runEntitiesStage(jobId);
    if (command === 'gaps') return runGapsStage(jobId);
    if (command === 'pagespec') return runPageSpecStage(jobId);
    if (command === 'compile') return runCompileStage(jobId);
    if (command === 'schema') return runSchemaStage(jobId);
    return runGraphStage(jobId);
}

export async function createAnalyzeCompilerJob(args: {
    userId: string;
    workspaceId?: string | null;
    payload: AnalyzeCompilerRequest;
}): Promise<{ jobId: string; queued: boolean }> {
    const pool = getPool();
    const sourceInput = String(args.payload.input || '').trim();
    if (!sourceInput) throw new Error('input is required');

    const sourceType = normalizeInputSource(sourceInput, args.payload.source);
    const mode = normalizeMode(args.payload.mode);
    const depth = normalizeDepth(args.payload.depth);
    const hash = requestHash({ sourceType, sourceInput, mode, depth });

    if (args.payload.idempotencyKey) {
        const existing = await pool.query(
            `SELECT id FROM analyze_jobs WHERE user_id = $1 AND idempotency_key = $2 ORDER BY created_at DESC LIMIT 1`,
            [args.userId, args.payload.idempotencyKey],
        );
        if (existing.rows.length) {
            return { jobId: String(existing.rows[0].id), queued: false };
        }
    }

    const created = await pool.query(
        `INSERT INTO analyze_jobs (
      user_id, workspace_id, source_type, source_input, mode, depth, state, idempotency_key, request_hash, current_stage_started_at
    ) VALUES ($1, $2, $3, $4, $5, $6, 'SCAN_INIT', $7, $8, NOW()) RETURNING id`,
        [args.userId, args.workspaceId || null, sourceType, sourceInput, mode, depth, args.payload.idempotencyKey || null, hash],
    );

    const jobId = String(created.rows[0].id);
    await appendEvent(jobId, 'SCAN_INIT', EVENT_TYPES.SCAN_CREATED, { sourceType, mode, depth }, { source_input: sourceInput });
    return { jobId, queued: true };
}

export async function runAnalyzeCompilerPipeline(jobId: string): Promise<void> {
    let current = await getJobState(jobId);
    if (current === 'SCAN_INIT') await runScanStage(jobId);
    current = await getJobState(jobId);
    if (current === 'ENTITY_MAPPING') await runEntitiesStage(jobId);
    current = await getJobState(jobId);
    if (current === 'VISIBILITY_GAP_ANALYSIS') await runGapsStage(jobId);
    current = await getJobState(jobId);
    if (current === 'PAGE_SPEC_GENERATION') await runPageSpecStage(jobId);
    current = await getJobState(jobId);
    if (current === 'CONTENT_COMPILATION') await runCompileStage(jobId);
    current = await getJobState(jobId);
    if (current === 'SCHEMA_BINDING') await runSchemaStage(jobId);
    current = await getJobState(jobId);
    if (current === 'GRAPH_LINKING') await runGraphStage(jobId);
}

export async function failAnalyzeCompilerJob(jobId: string, reason: string): Promise<void> {
    const pool = getPool();
    await pool.query(
        `UPDATE analyze_jobs SET state = 'FAILED', failure_reason = $2, updated_at = NOW() WHERE id = $1`,
        [jobId, reason],
    );
    await appendEvent(jobId, 'FAILED', 'job.failed', { reason }, { failed: true, reason });
}

export async function getAnalyzeCompilerJob(jobId: string): Promise<Record<string, unknown> | null> {
    const pool = getPool();
    const job = await pool.query(
        `SELECT id, source_type, source_input, mode, depth, state, attempt_count, failure_reason, created_at, updated_at, completed_at
     FROM analyze_jobs WHERE id = $1`,
        [jobId],
    );
    if (!job.rows.length) return null;

    const [events, specs, pages, links, artifacts] = await Promise.all([
        pool.query(`SELECT sequence, stage, event_type, payload, state_delta, event_hash, created_at FROM analyze_job_events WHERE job_id = $1 ORDER BY sequence ASC LIMIT 300`, [jobId]),
        pool.query(`SELECT id, entity_key, intent, title, slug, priority, schema_type FROM page_specs WHERE job_id = $1 ORDER BY priority DESC`, [jobId]),
        pool.query(`SELECT id, page_spec_id, title, slug, sections, claims, internal_links, updated_at FROM page_builds WHERE job_id = $1 ORDER BY created_at ASC`, [jobId]),
        pool.query(`SELECT from_page_build_id, to_page_build_id, reason FROM page_link_graph WHERE job_id = $1 ORDER BY created_at ASC`, [jobId]),
        pool.query(`SELECT page_build_id, format, artifact_path, is_indexable, published_at FROM publish_artifacts WHERE job_id = $1 ORDER BY created_at ASC`, [jobId]),
    ]);

    return {
        ...job.rows[0],
        events: events.rows,
        page_specs: specs.rows,
        pages: pages.rows,
        links: links.rows,
        artifacts: artifacts.rows,
    };
}

export async function publishAnalyzeCompilerJob(jobId: string): Promise<void> {
    const pool = getPool();
    const pages = await pool.query(
        `SELECT id, slug FROM page_builds WHERE job_id = $1`,
        [jobId],
    );

    for (const page of pages.rows) {
        const pageId = String(page.id);
        const slug = String(page.slug);
        const formats: Array<'html' | 'markdown' | 'jsonld' | 'api'> = ['html', 'markdown', 'jsonld', 'api'];

        for (const format of formats) {
            const artifactPath = `/generated/${jobId}/${slug}.${format === 'jsonld' ? 'json' : format}`;
            const artifactHash = createHash('sha256').update(`${jobId}:${pageId}:${format}:${artifactPath}`).digest('hex');
            await pool.query(
                `INSERT INTO publish_artifacts (job_id, page_build_id, format, artifact_path, artifact_hash, is_indexable, published_at)
         VALUES ($1,$2,$3,$4,$5,true,NOW())
         ON CONFLICT (page_build_id, format) DO UPDATE
         SET artifact_path = EXCLUDED.artifact_path,
             artifact_hash = EXCLUDED.artifact_hash,
             published_at = EXCLUDED.published_at`,
                [jobId, pageId, format, artifactPath, artifactHash],
            );
        }
    }

    await pool.query(
        `UPDATE analyze_jobs SET state = 'PUBLISHED', updated_at = NOW() WHERE id = $1 AND state IN ('READY', 'PUBLISHED')`,
        [jobId],
    );
    await appendEvent(jobId, 'PUBLISHED', EVENT_TYPES.PAGE_PUBLISHED, { pageCount: pages.rows.length }, { published: true });
}

export async function rescanAnalyzeCompilerJob(jobId: string): Promise<Record<string, unknown>> {
    const pool = getPool();
    const pages = await pool.query(`SELECT id FROM page_builds WHERE job_id = $1`, [jobId]);
    const pre = 0.2;
    const post = Number((pre + pages.rows.length * 0.05).toFixed(3));
    const delta = Number((post - pre).toFixed(3));
    const citationsFound = pages.rows.length;

    await pool.query(
        `INSERT INTO analyze_rescan_results (job_id, pre_visibility, post_visibility, delta, citations_found, ai_answer_presence)
     VALUES ($1, $2, $3, $4, $5, $6)`,
        [jobId, pre, post, delta, citationsFound, pages.rows.length > 0],
    );

    await appendEvent(jobId, 'READY', 'job.rescanned', {
        pre_visibility: pre,
        post_visibility: post,
        delta,
        citations_found: citationsFound,
    }, {
        visibility_delta: delta,
    });

    return {
        pre_visibility: pre,
        post_visibility: post,
        delta,
        citations_found: citationsFound,
        ai_answer_presence: pages.rows.length > 0,
    };
}
