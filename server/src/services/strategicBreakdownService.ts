import type {
    AIPlatformScores,
    CategoryGrade,
    Recommendation,
    StrategicBreakdown,
    StrategicOperatingStage,
    CitationStateBand,
} from '../../../shared/types.js';
import { AIVIS_MASTER_SYSTEM_PROFILE } from '../constants/masterSystemProfile.js';

type BuildStrategicBreakdownInput = {
    visibilityScore: number;
    aiPlatformScores: AIPlatformScores;
    recommendations: Recommendation[];
    categoryGrades?: CategoryGrade[];
    hasCloudflareBotSignals: boolean;
    hasKnowledgeGraphSignals: boolean;
    hasQueryDemandSignals: boolean;
    hasSerpAnswerSignals: boolean;
    hasTechnicalHealthSignals: boolean;
    hasEvidenceFixIssues: boolean;
    hasBragVerification: boolean;
};

function citationBand(score: number): CitationStateBand {
    if (score >= 70) return 'citable';
    if (score >= 40) return 'emerging';
    return 'uncited';
}

function stageStatus(score: number): 'healthy' | 'watch' | 'critical' {
    if (score >= 70) return 'healthy';
    if (score >= 40) return 'watch';
    return 'critical';
}

function pickCategoryScore(categoryGrades: CategoryGrade[] | undefined, needle: RegExp, fallback = 0): number {
    if (!Array.isArray(categoryGrades) || categoryGrades.length === 0) return fallback;
    const match = categoryGrades.find((g) => needle.test(String(g.label || '')));
    if (!match) return fallback;
    return Math.max(0, Math.min(100, Number(match.score) || fallback));
}

function impactLiftLabel(rec: Recommendation): string {
    const raw = String(rec.estimatedVisibilityLoss || '').trim();
    if (raw) return raw;
    if (rec.priority === 'high') return '12-24%';
    if (rec.priority === 'medium') return '6-12%';
    return '2-6%';
}

export function buildStrategicBreakdown(
    input: BuildStrategicBreakdownInput,
): StrategicBreakdown {
    const scores = input.aiPlatformScores;
    const avgEngine =
        Math.round((scores.chatgpt + scores.perplexity + scores.google_ai + scores.claude) / 4);

    const engineStates: StrategicBreakdown['citation_state']['engine_states'] = {
        chatgpt: citationBand(scores.chatgpt),
        perplexity: citationBand(scores.perplexity),
        google_ai: citationBand(scores.google_ai),
        claude: citationBand(scores.claude),
    };

    const uncitedEngines = (Object.entries(engineStates) as Array<[keyof AIPlatformScores, CitationStateBand]>)
        .filter(([, band]) => band === 'uncited')
        .map(([engine]) => engine);

    const categoryScoreAvg =
        input.categoryGrades && input.categoryGrades.length > 0
            ? Math.round(
                input.categoryGrades.reduce((sum, g) => sum + (Number(g.score) || 0), 0) /
                input.categoryGrades.length,
            )
            : input.visibilityScore;

    const detectStage: StrategicOperatingStage = {
        stage: 'detect',
        status: stageStatus(avgEngine),
        rationale:
            avgEngine >= 70
                ? 'AI engines show citation-ready extraction and answer inclusion potential.'
                : avgEngine >= 40
                    ? 'AI engines partially detect content but citation confidence is inconsistent.'
                    : 'AI engines currently skip or weakly resolve this content in answer flows.',
        corrective_action:
            avgEngine < 70
                ? 'Increase answer-ready blocks, entity clarity, and schema coverage for extraction reliability.'
                : undefined,
    };

    const resolveStage: StrategicOperatingStage = {
        stage: 'resolve',
        status: input.hasEvidenceFixIssues ? 'watch' : 'healthy',
        rationale: input.hasEvidenceFixIssues
            ? 'Evidence gate identified citation blockers requiring remediation before trust convergence.'
            : 'Evidence and trust signals are coherent with low contradiction pressure.',
        corrective_action: input.hasEvidenceFixIssues
            ? 'Resolve high-severity evidence-fix issues and remove hard blockers first.'
            : undefined,
    };

    const actStage: StrategicOperatingStage = {
        stage: 'act',
        status: input.recommendations.some((r) => r.priority === 'high') ? 'watch' : 'healthy',
        rationale:
            input.recommendations.length > 0
                ? `${input.recommendations.length} corrective actions are mapped to expected citation lift.`
                : 'No corrective action path generated from this run.',
        corrective_action:
            input.recommendations.length > 0
                ? 'Execute top-ranked fixes in order of priority and re-scan after deployment.'
                : 'Run another analysis with richer content to generate a remediation path.',
    };

    const verifyStage: StrategicOperatingStage = {
        stage: 'verify',
        status: input.hasBragVerification ? 'healthy' : 'watch',
        rationale: input.hasBragVerification
            ? 'BRAG validation and ledger chain are available for verification replay.'
            : 'Verification chain metadata is partial; confidence should be treated as provisional.',
        corrective_action: input.hasBragVerification
            ? undefined
            : 'Enable full evidence validation to strengthen post-fix verification confidence.',
    };

    const monitorSignalsCount = [
        input.hasCloudflareBotSignals,
        input.hasKnowledgeGraphSignals,
        input.hasQueryDemandSignals,
        input.hasSerpAnswerSignals,
        input.hasTechnicalHealthSignals,
    ].filter(Boolean).length;
    const minSources = AIVIS_MASTER_SYSTEM_PROFILE.source_requirements.minimum_sources_required;
    const sourceRequirementMet = monitorSignalsCount >= minSources;

    const moduleScores = {
        ai_citation_readiness: Math.round((avgEngine + input.visibilityScore) / 2),
        entity_authority: pickCategoryScore(input.categoryGrades, /entity|trust|authority/i, input.visibilityScore),
        content_completeness: pickCategoryScore(input.categoryGrades, /content|readability|heading/i, input.visibilityScore),
        schema_readiness: pickCategoryScore(input.categoryGrades, /schema|structured/i, input.visibilityScore),
        technical_health: pickCategoryScore(input.categoryGrades, /technical|security|meta|open graph/i, input.visibilityScore),
    };

    const monitorStage: StrategicOperatingStage = {
        stage: 'monitor',
        status: monitorSignalsCount >= 4 ? 'healthy' : monitorSignalsCount >= 2 ? 'watch' : 'critical',
        rationale:
            monitorSignalsCount >= 4
                ? 'Signal coverage is broad enough for continuous citation monitoring.'
                : monitorSignalsCount >= 2
                    ? 'Monitoring is partially instrumented; some blind spots remain.'
                    : 'Signal coverage is sparse and can miss displacement or freshness drift.',
        corrective_action:
            monitorSignalsCount >= 4
                ? undefined
                : 'Connect remaining signal sources to reduce monitoring blind spots.',
    };

    const correctiveActionPaths = input.recommendations
        .slice()
        .sort((a, b) => {
            const rank = { high: 0, medium: 1, low: 2 };
            return (rank[a.priority] ?? 2) - (rank[b.priority] ?? 2);
        })
        .slice(0, 5)
        .map((rec) => ({
            title: rec.title,
            priority: rec.priority,
            category: rec.category,
            expected_citation_lift: impactLiftLabel(rec),
            implementation: rec.implementation || rec.description,
        }));

    return {
        category: 'ai_citation_intelligence',
        positioning: {
            core_question: 'Will AI quote you or skip you entirely?',
            value_proposition:
                'AiVIS measures AI citation probability and maps evidence-backed corrective actions.',
        },
        master_system: {
            version: AIVIS_MASTER_SYSTEM_PROFILE.version,
            tagline: AIVIS_MASTER_SYSTEM_PROFILE.identity.tagline,
            score_weights: AIVIS_MASTER_SYSTEM_PROFILE.scoring_weights,
            source_policy: {
                minimum_sources_required: minSources,
                active_sources: monitorSignalsCount,
                requirement_met: sourceRequirementMet,
            },
            output_modes: AIVIS_MASTER_SYSTEM_PROFILE.output_modes.map((mode) => ({
                key: mode.key,
                enabled: true,
            })),
            module_scores: AIVIS_MASTER_SYSTEM_PROFILE.modules.map((module) => {
                const score = moduleScores[module.key];
                return {
                    key: module.key,
                    label: module.label,
                    weight: AIVIS_MASTER_SYSTEM_PROFILE.scoring_weights[module.key],
                    score,
                    status: stageStatus(score),
                    explanation: module.intent,
                };
            }),
        },
        citation_state: {
            overall: citationBand(Math.round((avgEngine + categoryScoreAvg + input.visibilityScore) / 3)),
            average_engine_score: avgEngine,
            engine_states: engineStates,
            uncited_engines: uncitedEngines,
        },
        api_signal_coverage: {
            cloudflare_bot_signals: input.hasCloudflareBotSignals,
            knowledge_graph_signals: input.hasKnowledgeGraphSignals,
            query_demand_signals: input.hasQueryDemandSignals,
            serp_answer_signals: input.hasSerpAnswerSignals,
            technical_health_signals: input.hasTechnicalHealthSignals,
            active_count: monitorSignalsCount,
            minimum_required: minSources,
            requirement_met: sourceRequirementMet,
        },
        operating_model: [detectStage, resolveStage, actStage, verifyStage, monitorStage],
        corrective_action_paths: correctiveActionPaths,
        generated_at: new Date().toISOString(),
    };
}
