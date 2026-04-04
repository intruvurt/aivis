/**
 * Engine Orchestrator & Composer
 * 
 * Runs all intelligence engines, composes results, and applies tier gating
 * This is the main entry point for analysis requests
 */

import type {
  CanonicalTier,
  IntelligenceAnalysisResponse,
  CitationReadinessOutput,
  TrustLayerOutput,
  EntityGraphOutput,
} from '../../../../shared/types.js';
import { runCitationReadinessEngine } from './citationEngine.js';
import { runTrustLayerEngine } from './trustEngine.js';
import { runEntityGraphEngine } from './entityEngine.js';
import { runAuditPipeline } from '../audit/pipeline.js';

export interface EngineComposerInput {
  html: string;
  url: string;
  domain: string;
  tier: CanonicalTier;
  https_enabled?: boolean;
  domain_age_years?: number;
  scrapeResult?: any;
}

interface ComparisonInsight {
  benchmarkScore: number;
  scoreGap: number;
  strengths: string[];
  weaknesses: string[];
}

interface RepairAction {
  title: string;
  estimatedImpact: number;
  reason: string;
}

interface RepairInsight {
  priorityActions: RepairAction[];
  projectedScoreAfterFixes: number;
}

function getEnginesForTierSafe(tier: CanonicalTier): {
  hasScanning: boolean;
  hasComparison: boolean;
  hasRepair: boolean;
} {
  const rank: Record<CanonicalTier, number> = {
    observer: 0,
    alignment: 1,
    signal: 2,
    scorefix: 3,
    agency: 4,
    enterprise: 5,
  };
  const current = rank[tier] ?? 0;
  return {
    hasScanning: true,
    hasComparison: current >= rank.alignment,
    hasRepair: current >= rank.scorefix,
  };
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }
  return out;
}

function scoreBenchmarkForTier(tier: CanonicalTier): number {
  switch (tier) {
    case 'observer':
      return 62;
    case 'alignment':
      return 74;
    case 'signal':
      return 82;
    case 'scorefix':
      return 88;
    default:
      return 70;
  }
}

function buildComparisonInsight(
  tier: CanonicalTier,
  citationScore: number,
  trustScore: number,
  entityScore: number,
): ComparisonInsight {
  const benchmarkScore = scoreBenchmarkForTier(tier);
  const categoryScores = [
    { key: 'Citation readiness', value: citationScore },
    { key: 'Trust layer', value: trustScore },
    { key: 'Entity clarity', value: entityScore },
  ];

  const strengths = categoryScores
    .filter((category) => category.value >= 80)
    .map((category) => `${category.key} is a visible strength (${category.value}/100)`);

  const weaknesses = categoryScores
    .filter((category) => category.value < 70)
    .sort((a, b) => a.value - b.value)
    .map((category) => `${category.key} is limiting AI visibility (${category.value}/100)`);

  const weightedScore = clampScore(citationScore * 0.4 + trustScore * 0.35 + entityScore * 0.25);

  return {
    benchmarkScore,
    scoreGap: weightedScore - benchmarkScore,
    strengths,
    weaknesses,
  };
}

function buildRepairInsight(
  overallScore: number,
  citationScore: number,
  trustScore: number,
  entityScore: number,
  allRecommendations: string[],
): RepairInsight {
  const scoreDeficits = [
    { title: 'Citation structure hardening', value: citationScore, reason: 'Improve section quotability and source clarity for model citations.' },
    { title: 'Trust signal remediation', value: trustScore, reason: 'Strengthen machine-verifiable trust evidence and policy accessibility.' },
    { title: 'Entity consistency upgrades', value: entityScore, reason: 'Unify entity mentions and organizational metadata across pages.' },
  ]
    .filter((item) => item.value < 85)
    .sort((a, b) => a.value - b.value);

  const priorityActions: RepairAction[] = scoreDeficits.slice(0, 3).map((item) => {
    const estimatedImpact = Math.max(4, Math.ceil((85 - item.value) / 5));
    return {
      title: item.title,
      estimatedImpact,
      reason: item.reason,
    };
  });

  if (priorityActions.length < 3) {
    for (const recommendation of allRecommendations) {
      if (priorityActions.length >= 3) break;
      priorityActions.push({
        title: recommendation,
        estimatedImpact: 3,
        reason: 'Mapped from engine recommendation to actionable implementation task.',
      });
    }
  }

  const projectedScoreAfterFixes = clampScore(
    overallScore + priorityActions.reduce((sum, action) => sum + action.estimatedImpact, 0),
  );

  return {
    priorityActions,
    projectedScoreAfterFixes,
  };
}

/**
 * Compute overall AI visibility score from component engines
 */
function computeOverallVisibilityScore(
  citationScore: number,
  trustScore: number,
  entityScore: number,
  promptScore?: number,
  hallucinationScore?: number
): number {
  // Weight: Citation (30%), Trust (25%), Entity (20%), Prompt (15%), Hallucination (10%)
  let total = 0;
  let weights = 0;

  total += citationScore * 0.30;
  weights += 0.30;

  total += trustScore * 0.25;
  weights += 0.25;

  total += entityScore * 0.20;
  weights += 0.20;

  if (typeof promptScore === 'number') {
    total += promptScore * 0.15;
    weights += 0.15;
  }

  if (typeof hallucinationScore === 'number') {
    // Invert: lower hallucination risk is better
    total += (100 - hallucinationScore) * 0.10;
    weights += 0.10;
  }

  // Normalize
  if (weights <= 0) return 0;
  return clampScore(total / weights);
}

/**
 * Compute hallucination risk score (0–100) from real page signals.
 *
 * Higher score = higher hallucination risk = worse for AI citation.
 * The score is INVERTED before being applied to overallScore so that
 * lower risk = higher contribution to visibility.
 *
 * Signals used (all derived from engine outputs already in scope):
 *   - Entity name variance:    inconsistent brand/product names force models to guess
 *   - Entity consistency ratio: low ratio means the canonical name is weakly established
 *   - Citation blockers:       pages that AI can't quote make models fill gaps with guesses
 *   - Quotability index:       thin/unquotable content = model invents surrounding context
 *   - Trust risk flags:        unverifiable contact/policy signals = model can't ground claims
 */
function computeHallucinationRiskScore(
  entityResult: EntityGraphOutput | null,
  citationResult: CitationReadinessOutput | null,
  trustResult: TrustLayerOutput | null,
): number {
  let risk = 0; // 0 = no risk, accumulates up to 100

  // ── Entity name variance (0–30 points of risk) ──────────────────────────
  // Each distinct variance issue adds 10 points; cap at 30
  const varianceIssues = entityResult?.data?.entity_mentions?.variance_issues?.length ?? 0;
  risk += Math.min(30, varianceIssues * 10);

  // ── Entity consistency ratio (0–20 points of risk) ───────────────────────
  // ratio < 0.5 → 20pts, < 0.7 → 12pts, < 0.9 → 5pts, ≥ 0.9 → 0pts
  const consistencyRatio = entityResult?.data?.entity_mentions?.consistency_ratio ?? 1;
  if (consistencyRatio < 0.5) risk += 20;
  else if (consistencyRatio < 0.7) risk += 12;
  else if (consistencyRatio < 0.9) risk += 5;

  // ── Citation blockers (0–25 points of risk) ──────────────────────────────
  // Each blocker (e.g. "no answer blocks", "JS-only content") adds 8pts; cap at 25
  const blockers = citationResult?.data?.blockers_to_citation?.length ?? 0;
  risk += Math.min(25, blockers * 8);

  // ── Quotability index (0–15 points of risk) ──────────────────────────────
  // quotability_index 0–1: low index = high risk
  const quotability = citationResult?.data?.quotability_index ?? 0;
  if (quotability < 0.2) risk += 15;
  else if (quotability < 0.5) risk += 8;
  else if (quotability < 0.75) risk += 3;

  // ── Trust risk flags (0–10 points of risk) ───────────────────────────────
  // Each trust risk flag (unverifiable contact, no privacy policy, etc.) adds 3pts; cap at 10
  const trustFlags = trustResult?.data?.risk_flags?.length ?? 0;
  risk += Math.min(10, trustFlags * 3);

  return clampScore(risk);
}

/**
 * Main orchestrator function
 * Runs engines based on tier, gates outputs, returns gated response
 */
export async function runAnalysisEngines(input: EngineComposerInput): Promise<IntelligenceAnalysisResponse> {
  const startTime = Date.now();
  const timerBreakdown: Record<string, number> = {};

  // Determine which engines this tier can run
  const engineAccess = getEnginesForTierSafe(input.tier);

  let citationResult: CitationReadinessOutput | null = null;
  let trustResult: TrustLayerOutput | null = null;
  let entityResult: EntityGraphOutput | null = null;

  // ========================================================================
  // PHASE: Scan Engines (all tiers get these)
  // ========================================================================

  // Engine 1: Citation Readiness
  try {
    const t0 = Date.now();
    citationResult = await runCitationReadinessEngine({
      html: input.html,
      domain: input.domain,
      target_url: input.url,
    });
    timerBreakdown['citation'] = Date.now() - t0;
  } catch (err) {
    console.error('[Engine] Citation engine failed:', err);
    citationResult = {
      status: 'failed',
      timeMs: Date.now() - startTime,
      errors: [String(err)],
      data: {
        citation_readiness_score: 0,
        quotability_index: 0,
        citable_sections: [],
        blockers_to_citation: ['Citation engine failed'],
        recommendations: [],
      },
    };
  }

  // Engine 2: Trust Layer
  try {
    const t0 = Date.now();
    trustResult = await runTrustLayerEngine({
      html: input.html,
      domain: input.domain,
      target_url: input.url,
      https_enabled: input.https_enabled,
      domain_age_years: input.domain_age_years,
    });
    timerBreakdown['trust'] = Date.now() - t0;
  } catch (err) {
    console.error('[Engine] Trust engine failed:', err);
    trustResult = {
      status: 'failed',
      timeMs: Date.now() - startTime,
      errors: [String(err)],
      data: {
        trust_score: 0,
        signal_status: {
          https_enabled: false,
          domain_age_years: 0,
          tls_certificate_trusted: false,
          contact_info_present: false,
          privacy_policy_accessible: false,
          external_trust_signals: [],
        },
        entity_consistency: {
          name_variance: 1,
          location_matches: false,
          business_category_consistent: false,
          contact_info_trustworthy: false,
        },
        risk_flags: ['Trust engine failed'],
        recommendations: [],
      },
    };
  }

  // Engine 3: Entity Graph
  try {
    const t0 = Date.now();
    entityResult = await runEntityGraphEngine({
      html: input.html,
      domain: input.domain,
      target_url: input.url,
    });
    timerBreakdown['entity'] = Date.now() - t0;
  } catch (err) {
    console.error('[Engine] Entity engine failed:', err);
    entityResult = {
      status: 'failed',
      timeMs: Date.now() - startTime,
      errors: [String(err)],
      data: {
        entity_clarity_score: 0,
        primary_entity: {
          canonical_name: 'Unknown',
          aliases: [],
          confidence: 0,
          primary_location: 'Unknown',
        },
        entity_mentions: {
          count: 0,
          consistency_ratio: 0,
          variance_issues: [],
        },
        organization_clarity: {
          has_leadership: false,
          leadership_consistent: false,
          department_clarity: 'poor',
        },
        recommendations: [],
      },
    };
  }

  const citationScore = citationResult?.data?.citation_readiness_score ?? 0;
  const trustScore = trustResult?.data?.trust_score ?? 0;
  const entityScore = entityResult?.data?.entity_clarity_score ?? 0;

  let promptScore: number | undefined;
  let hallucinationScore: number | undefined;
  let comparisonInsight: ComparisonInsight | null = null;
  let repairInsight: RepairInsight | null = null;

  // ========================================================================
  // PHASE: Comparison Intelligence (Alignment+)
  // ========================================================================
  if (engineAccess.hasComparison) {
    comparisonInsight = buildComparisonInsight(input.tier, citationScore, trustScore, entityScore);

    if (comparisonInsight.weaknesses.length > 0 && trustResult?.data?.recommendations) {
      trustResult.data.recommendations = dedupeStrings([
        ...trustResult.data.recommendations,
        ...comparisonInsight.weaknesses,
      ]);
    }

    // Blend cross-engine calibration into optional score components.
    promptScore = clampScore((citationScore + entityScore) / 2);
    hallucinationScore = computeHallucinationRiskScore(entityResult, citationResult, trustResult);
  }

  // Preliminary score used only inside the repair block for impact estimation.
  // The final blended overallScore (with audit modules) is declared below.
  const preliminaryScore = computeOverallVisibilityScore(
    citationScore,
    trustScore,
    entityScore,
    promptScore,
    hallucinationScore,
  );

  // ========================================================================
  // PHASE: Repair Intelligence (Scorefix)
  // ========================================================================
  if (engineAccess.hasRepair) {
    const allRecommendations = dedupeStrings([
      ...(citationResult?.data?.recommendations ?? []),
      ...(trustResult?.data?.recommendations ?? []),
      ...(entityResult?.data?.recommendations ?? []),
    ]);

    repairInsight = buildRepairInsight(
      preliminaryScore,
      citationScore,
      trustScore,
      entityScore,
      allRecommendations,
    );

    const repairRecommendations = repairInsight.priorityActions.map(
      (action) => `${action.title} (estimated +${action.estimatedImpact} points)`,
    );

    if (citationResult?.data?.recommendations) {
      citationResult.data.recommendations = dedupeStrings([
        ...citationResult.data.recommendations,
        ...repairRecommendations,
      ]);
    }
  }
  const auditPipeline = await runAuditPipeline({
    scrapeResult: input.scrapeResult
      ? input.scrapeResult
      : ({ url: input.url, data: { html: input.html, title: '', body: '' } } as any),
    tier: input.tier,
    includeDeterministic: false,
  });
  const auditModules = auditPipeline.modules;
  const auditReport = auditPipeline.report;

  const structuralSupportScore = Math.round(
    [
      auditReport.scores.interpretability,
      auditReport.scores.extractability,
      auditReport.scores.structuralClarity,
      auditReport.scores.trustEntityClarity,
      auditReport.scores.technicalIntegrity,
      auditReport.scores.securityExposure ? 100 - auditReport.scores.securityExposure : undefined,
    ]
      .filter((v): v is number => typeof v === 'number')
      .reduce((sum, value, _, arr) => sum + value / arr.length, 0),
  );

  const overallScore = Math.round(
    (computeOverallVisibilityScore(citationScore, trustScore, entityScore, promptScore, hallucinationScore) * 0.7) +
    (structuralSupportScore * 0.3)
  );

  const totalTimeMs = Date.now() - startTime;

  // Build base response (visible to all tiers)
  const response: IntelligenceAnalysisResponse & { audit_report?: any; analysis_coverage?: any } = {
    url: input.url,
    analyzed_at: new Date().toISOString(),
    tier: input.tier,
    processing_time_ms: totalTimeMs,
    is_cached: false,

    // Always visible
    overall_ai_visibility_score: overallScore,
    citation_readiness_score: citationScore,
    trust_score: trustScore,
    entity_clarity_score: entityScore,

    // Engine outputs
    citation_readiness: citationResult,
    trust_layer: trustResult,
    entity_graph: entityResult,
  };

  console.log(
    `[Analysis] Completed in ${totalTimeMs}ms | Tier: ${input.tier} | Score: ${overallScore}` +
      (comparisonInsight ? ` | Benchmark gap: ${comparisonInsight.scoreGap}` : '') +
      (repairInsight
        ? ` | Repair plan: ${repairInsight.priorityActions.length} actions, projected ${repairInsight.projectedScoreAfterFixes}`
        : ''),
  );
  response.audit_report = auditReport;
  response.analysis_coverage = {
    modules: {
      content: auditModules.content,
      entity: auditModules.entity,
      technical: auditModules.technical,
      privateExposure: auditModules.privateExposure,
    },
    completeness: auditReport.completeness,
    confidence: auditReport.confidence,
    constraints: auditReport.constraints,
    timer_breakdown: timerBreakdown,
  };

  console.log(`[Analysis] Completed in ${totalTimeMs}ms | Tier: ${input.tier} | Score: ${overallScore}`);

  return response;
}
