/**
 * AI Answer Simulation Engine
 *
 * Predicts how AI answer engines respond to queries about a given entity.
 * Produces the AI Visibility Probability (AVP) metric — the core question:
 *
 *   "For a relevant query, what is the probability that an AI answer engine
 *    will include this entity in its response?"
 *
 * Architecture
 * ────────────
 * 1. Accept primary_entity + query list (from answerPresenceService or caller)
 * 2. For each query, fan out to N AI models in parallel
 * 3. Parse each answer for entity presence, extract cited sources, compute distortion
 * 4. Compute cross-model overlap and per-query AVP
 * 5. Aggregate to a SimulationRunResult with temporal drift (vs last run)
 *
 * Execution model:
 *   Signal tier  → 3 models (GPT-5 Mini, Claude Sonnet 4.6, Grok 4.1 Fast)
 *   Alignment    → 2 models (GPT-5 Nano + Claude Haiku 4.5)
 *   Starter      → 1 model  (GPT-5 Nano)
 *   Observer     → 1 model  (OpenRouter :free chain, zero cost)
 *
 * Security: No user-supplied strings passed to eval/exec. All entity names
 * are sanitised to printable ASCII before query construction.
 */

import { callAIProvider, SIGNAL_AI1, SIGNAL_AI2, SIGNAL_AI3, ALIGNMENT_PRIMARY } from './aiProviders.js';
import { getPool } from './postgresql.js';
import type {
    ModelSimulationOutput,
    QuerySimulationResult,
    SimulationRunResult,
} from '../../../shared/types.js';

type SimulationExecutionStatus = 'complete' | 'partial' | 'failed';

// ── Tier model profiles ───────────────────────────────────────────────────────

type SimulationTier = 'observer' | 'starter' | 'alignment' | 'signal';

interface ProviderRef {
    provider: string;
    model: string;
    endpoint?: string;
    label: string;
}

const FREE_MODEL: ProviderRef = {
    provider: 'openrouter',
    model: 'meta-llama/llama-3.1-8b-instruct:free',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    label: 'Llama 3.1 8B',
};

const TIER_MODELS: Record<SimulationTier, ProviderRef[]> = {
    observer: [FREE_MODEL],
    starter: [{
        ...ALIGNMENT_PRIMARY,
        label: ALIGNMENT_PRIMARY.displayName ?? 'GPT-5 Nano',
    }],
    alignment: [
        { ...ALIGNMENT_PRIMARY, label: ALIGNMENT_PRIMARY.displayName ?? 'GPT-5 Nano' },
        {
            provider: 'openrouter',
            model: 'anthropic/claude-haiku-4.5',
            endpoint: 'https://openrouter.ai/api/v1/chat/completions',
            label: 'Claude Haiku 4.5',
        },
    ],
    signal: [
        { ...SIGNAL_AI1, label: SIGNAL_AI1.displayName ?? 'GPT-5 Mini' },
        { ...SIGNAL_AI2, label: SIGNAL_AI2.displayName ?? 'Claude Sonnet 4.6' },
        { ...SIGNAL_AI3, label: SIGNAL_AI3.displayName ?? 'Grok 4.1 Fast' },
    ],
};

// ── Prompt builder ────────────────────────────────────────────────────────────

const SANITIZE_RE = /[^\x20-\x7E]/g;

function sanitize(s: string): string {
    return s.replace(SANITIZE_RE, '').trim().slice(0, 200);
}

function buildSimulationPrompt(query: string, primaryEntity: string): string {
    const safeQuery = sanitize(query);
    const safeEntity = sanitize(primaryEntity);
    return [
        `You are an AI answer engine responding to a user's question.`,
        `Answer the following question as concisely as possible (2–4 sentences).`,
        `After your answer, output a JSON block on a NEW LINE with this exact structure:`,
        `{"entities_used":["..."],"cited_sources":["url1","url2"]}`,
        `Only include real entities and real URLs — do NOT fabricate them.`,
        ``,
        `Question: ${safeQuery}`,
        `Context hint: the user may be looking for information about "${safeEntity}".`,
    ].join('\n');
}

// ── Response parser ───────────────────────────────────────────────────────────

interface ParsedModelResponse {
    answer: string;
    entities_used: string[];
    cited_sources: string[];
}

function parseModelResponse(raw: string): ParsedModelResponse {
    const jsonMatch = raw.match(/\{[\s\S]*"entities_used"[\s\S]*\}/);
    let entities_used: string[] = [];
    let cited_sources: string[] = [];

    if (jsonMatch) {
        try {
            const parsed = JSON.parse(jsonMatch[0]) as {
                entities_used?: unknown;
                cited_sources?: unknown;
            };
            if (Array.isArray(parsed.entities_used)) {
                entities_used = (parsed.entities_used as unknown[])
                    .filter((e): e is string => typeof e === 'string')
                    .map((e) => e.trim())
                    .filter(Boolean)
                    .slice(0, 20);
            }
            if (Array.isArray(parsed.cited_sources)) {
                cited_sources = (parsed.cited_sources as unknown[])
                    .filter((u): u is string => typeof u === 'string')
                    .filter((u) => u.startsWith('http'))
                    .slice(0, 10);
            }
        } catch {
            // malformed JSON from model — degrade gracefully
        }
    }

    // Strip the trailing JSON block from the answer text
    const answer = raw.replace(/\{[\s\S]*"entities_used"[\s\S]*\}/, '').trim();

    return { answer, entities_used, cited_sources };
}

// ── Core simulation ───────────────────────────────────────────────────────────

function computeDistortion(
    primaryEntity: string,
    entities_used: string[],
    answer: string,
): number {
    const lower = answer.toLowerCase();
    const entityLower = primaryEntity.toLowerCase();

    // Primary entity cited = no distortion contribution from presence
    const entityPresent = lower.includes(entityLower) || entities_used
        .some((e) => e.toLowerCase().includes(entityLower) || entityLower.includes(e.toLowerCase()));

    if (!entityPresent) return 0.8; // severe: entity displaced

    // Mild distortion: short answer that barely mentions entity
    if (answer.length < 80) return 0.3;

    return 0.0; // entity cited with substance
}

function computeMissingEntities(
    targetEntity: string,
    knownAliases: string[],
    entities_used: string[],
): string[] {
    const usedLower = entities_used.map((e) => e.toLowerCase());
    const missing: string[] = [];

    const all = [targetEntity, ...knownAliases];
    for (const name of all) {
        const n = name.toLowerCase();
        if (!usedLower.some((u) => u.includes(n) || n.includes(u))) {
            missing.push(name);
        }
    }
    return missing;
}

async function simulateOneModel(
    providerRef: ProviderRef,
    query: string,
    primaryEntity: string,
    aliases: string[],
    apiKey: string,
): Promise<{ label: string; output: ModelSimulationOutput }> {
    let raw = '';
    let errorReason: string | undefined;
    try {
        raw = await callAIProvider({
            provider: providerRef.provider,
            model: providerRef.model,
            prompt: buildSimulationPrompt(query, primaryEntity),
            apiKey,
            endpoint: providerRef.endpoint,
            opts: {
                temperature: 0.3,
                max_tokens: 400,
                timeoutMs: 18_000,
            },
        });
    } catch (err) {
        raw = '';
        errorReason = err instanceof Error ? err.message : 'Provider call failed';
    }

    if (!raw.trim()) {
        return {
            label: providerRef.label,
            output: {
                status: 'error',
                answer: '',
                entities_used: [],
                missing_entities: [primaryEntity, ...aliases].slice(0, 10),
                distortion_score: 0,
                entity_cited: false,
                cited_sources: [],
                error_reason: errorReason ?? 'Empty provider response',
            },
        };
    }

    const parsed = parseModelResponse(raw);
    if (!parsed.answer.trim() && parsed.entities_used.length === 0 && parsed.cited_sources.length === 0) {
        return {
            label: providerRef.label,
            output: {
                status: 'error',
                answer: '',
                entities_used: [],
                missing_entities: [primaryEntity, ...aliases].slice(0, 10),
                distortion_score: 0,
                entity_cited: false,
                cited_sources: [],
                error_reason: 'Provider returned no parseable answer payload',
            },
        };
    }

    const distortion_score = computeDistortion(primaryEntity, parsed.entities_used, parsed.answer);
    const missing_entities = computeMissingEntities(primaryEntity, aliases, parsed.entities_used);
    const entity_cited = !missing_entities.includes(primaryEntity);

    return {
        label: providerRef.label,
        output: {
            status: 'ok',
            answer: parsed.answer,
            entities_used: parsed.entities_used,
            missing_entities,
            distortion_score,
            entity_cited,
            cited_sources: parsed.cited_sources,
        },
    };
}

function computeCrossModelOverlap(models: Record<string, ModelSimulationOutput>): number {
    const outputs = Object.values(models).filter((m) => m.status === 'ok');
    if (outputs.length < 2) return outputs[0]?.entity_cited ? 1.0 : 0.0;

    // Jaccard similarity on entity sets averaged across model pairs
    let totalSim = 0;
    let pairs = 0;

    for (let i = 0; i < outputs.length; i++) {
        for (let j = i + 1; j < outputs.length; j++) {
            const setA = new Set(outputs[i].entities_used.map((e) => e.toLowerCase()));
            const setB = new Set(outputs[j].entities_used.map((e) => e.toLowerCase()));
            const intersection = [...setA].filter((e) => setB.has(e)).length;
            const union = new Set([...setA, ...setB]).size;
            totalSim += union === 0 ? 0 : intersection / union;
            pairs++;
        }
    }

    return pairs === 0 ? 0 : Math.min(1, totalSim / pairs);
}

function computeCitationProbability(
    models: Record<string, ModelSimulationOutput>,
): number {
    const outputs = Object.values(models).filter((m) => m.status === 'ok');
    if (outputs.length === 0) return 0;

    // Fraction of models that cited the entity, weighted by distortion penalty
    const score = outputs.reduce((sum, m) => {
        if (!m.entity_cited) return sum;
        return sum + (1 - m.distortion_score);
    }, 0);

    return Math.min(1, score / outputs.length);
}

async function simulateOneQuery(
    query: string,
    primaryEntity: string,
    aliases: string[],
    providers: ProviderRef[],
    apiKey: string,
): Promise<QuerySimulationResult> {
    const results = await Promise.all(
        providers.map((p) => simulateOneModel(p, query, primaryEntity, aliases, apiKey)),
    );

    const models: Record<string, ModelSimulationOutput> = {};
    for (const r of results) {
        models[r.label] = r.output;
    }

    const attempted_models = results.length;
    const successful_models = Object.values(models).filter((m) => m.status === 'ok').length;
    const failed_models = attempted_models - successful_models;
    const execution_status: SimulationExecutionStatus = successful_models === attempted_models
        ? 'complete'
        : successful_models > 0
            ? 'partial'
            : 'failed';

    const cross_model_overlap = computeCrossModelOverlap(models);
    const citation_probability = computeCitationProbability(models);
    const visibility_score = successful_models > 0
        ? Math.round((0.7 * citation_probability + 0.3 * cross_model_overlap) * 100)
        : 0;

    return {
        query,
        simulated_at: new Date().toISOString(),
        execution_status,
        attempted_models,
        successful_models,
        failed_models,
        models,
        cross_model_overlap,
        citation_probability,
        visibility_score,
    };
}

// ── Temporal drift retrieval ──────────────────────────────────────────────────

async function getPreviousAVP(url: string, userId: string, workspaceId: string | null): Promise<number | null> {
    try {
        const pool = getPool();
        const { rows } = await pool.query<{ aggregate_avp: number }>(
            `SELECT aggregate_avp
         FROM simulation_runs
                WHERE url = LOWER($1)
                    AND user_id = $2
                    AND (($3::uuid IS NULL AND workspace_id IS NULL) OR workspace_id = $3::uuid)
        ORDER BY run_at DESC
        LIMIT 1`,
            [url.toLowerCase(), userId, workspaceId],
        );
        return rows.length ? rows[0].aggregate_avp : null;
    } catch {
        // table may not exist yet — degrade gracefully
        return null;
    }
}

async function persistSimulationRun(
    result: SimulationRunResult,
    userId: string,
    workspaceId: string | null,
): Promise<void> {
    try {
        const pool = getPool();
        await pool.query(
            `INSERT INTO simulation_runs
         (id, user_id, workspace_id, url, primary_entity, scan_id,
          run_at, aggregate_avp, average_overlap, avp_delta, models_used, query_count)
       VALUES
         (gen_random_uuid(), $1, $2, LOWER($3), $4, $5,
          $6, $7, $8, $9, $10, $11)
       ON CONFLICT DO NOTHING`,
            [
                userId,
                workspaceId,
                result.url,
                result.primary_entity,
                result.scan_id,
                result.run_at,
                result.aggregate_avp,
                result.average_overlap,
                result.avp_delta,
                result.models_used,
                result.queries.length,
            ],
        );
    } catch {
        // Non-fatal: simulation still returns — persistence is best-effort
        // until the migration is applied (createSimulationRunsTable)
    }
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface RunSimulationArgs {
    primaryEntity: string;
    aliases?: string[];
    queries: string[];
    url: string;
    scanId?: string | null;
    userId: string;
    workspaceId?: string | null;
    tier: SimulationTier;
}

/**
 * Run the AI Answer Simulation Engine.
 *
 * Fans out to N AI models per query, computes per-model distortion,
 * cross-model overlap, citation probability, and AVP. Persists results
 * and computes temporal drift vs the previous run for this URL.
 */
export async function runSimulation(args: RunSimulationArgs): Promise<SimulationRunResult> {
    const {
        primaryEntity,
        aliases = [],
        queries,
        url,
        scanId = null,
        userId,
        workspaceId = null,
        tier,
    } = args;

    const apiKey = (process.env.OPEN_ROUTER_API_KEY ?? process.env.OPENROUTER_API_KEY ?? '').trim();
    if (!apiKey) {
        throw new Error('Simulation unavailable: OPEN_ROUTER_API_KEY is not configured');
    }
    const providers = TIER_MODELS[tier] ?? TIER_MODELS.observer;
    const modelsUsed = providers.map((p) => p.label);

    // Cap queries to keep costs predictable
    const MAX_QUERIES = tier === 'signal' ? 6 : tier === 'alignment' ? 4 : 2;
    const activeQueries = (queries.length > 0 ? queries : [`What is ${primaryEntity}?`]).slice(0, MAX_QUERIES);

    const queryResults = await Promise.all(
        activeQueries.map((q) =>
            simulateOneQuery(q, primaryEntity, aliases, providers, apiKey),
        ),
    );

    const attemptedModelCalls = queryResults.reduce((sum, q) => sum + q.attempted_models, 0);
    const successfulModelCalls = queryResults.reduce((sum, q) => sum + q.successful_models, 0);
    const failedModelCalls = queryResults.reduce((sum, q) => sum + q.failed_models, 0);
    const successfulQueries = queryResults.filter((q) => q.successful_models > 0);

    if (successfulQueries.length === 0) {
        throw new Error('Simulation failed: all model calls failed');
    }

    const aggregateAvp =
        successfulQueries.length === 0
            ? 0
            : successfulQueries.reduce((sum, q) => sum + q.citation_probability, 0) / successfulQueries.length;

    const averageOverlap =
        successfulQueries.length === 0
            ? 0
            : successfulQueries.reduce((sum, q) => sum + q.cross_model_overlap, 0) / successfulQueries.length;

    const execution_status: SimulationExecutionStatus = failedModelCalls === 0
        ? 'complete'
        : successfulModelCalls > 0
            ? 'partial'
            : 'failed';

    const previousAvp = await getPreviousAVP(url, userId, workspaceId);
    const avpDelta = previousAvp !== null ? aggregateAvp - previousAvp : null;

    const result: SimulationRunResult = {
        primary_entity: primaryEntity,
        url,
        scan_id: scanId,
        run_at: new Date().toISOString(),
        queries: queryResults,
        execution_status,
        attempted_model_calls: attemptedModelCalls,
        successful_model_calls: successfulModelCalls,
        failed_model_calls: failedModelCalls,
        aggregate_avp: aggregateAvp,
        average_overlap: averageOverlap,
        avp_delta: avpDelta,
        models_used: modelsUsed,
    };

    await persistSimulationRun(result, userId, workspaceId);

    return result;
}
