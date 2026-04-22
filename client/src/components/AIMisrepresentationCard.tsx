/**
 * AIMisrepresentationCard.tsx
 *
 * Single conversion-critical problem statement derived from AnalysisResponse.
 *
 * Priority chain:
 *   1. Displacement  – competitor cited instead of the entity
 *   2. Contradiction – multi-model disagreement (contradiction_report blockers)
 *   3. Fragmentation – entity clarity score critically low
 *   4. Absence       – zero citation coverage
 *   5. Partial       – below-threshold answer presence
 *
 * Every output must trace back to:
 *   - answer_presence   (entity-level evidence)
 *   - contradiction_report (multi-model misread)
 *   - competitor_hint   (displacement signal)
 *   - ai_platform_scores (per-engine absence)
 *
 * Server is authoritative. This card is a projection of ledger truth.
 */

import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import type { AnalysisResponse } from '../../../shared/types';

// ── Severity tiers ──────────────────────────────────────────────────────────

type Severity = 'critical' | 'high' | 'medium';

interface ProblemStatement {
  severity: Severity;
  label: string;
  headline: string;
  detail: string;
  /** Canonical failure type — drives styling + CTA copy */
  type: 'displacement' | 'contradiction' | 'fragmentation' | 'absence' | 'partial';
  /** Evidence trace items shown below headline */
  evidence: string[];
}

// ── Derive one dominant problem statement ───────────────────────────────────

export function deriveProblemStatement(result: AnalysisResponse): ProblemStatement | null {
  const ap = result.answer_presence;
  const cr = result.contradiction_report;
  const competitor = result.competitor_hint;
  const platforms = result.ai_platform_scores;
  const entity = ap?.primary_entity || result.brand_entities?.[0] || 'your brand';

  // — 1. Displacement: competitor cited, entity is not ——————————————————————
  if (competitor?.match_reasons?.length && ap && ap.citation_coverage_score < 40) {
    const evidence: string[] = [
      `Citation coverage: ${ap.citation_coverage_score}%`,
      ...competitor.match_reasons.slice(0, 2),
    ];
    if (ap.gaps?.length) {
      evidence.push(`${ap.gaps.length} confirmed citation gap${ap.gaps.length !== 1 ? 's' : ''}`);
    }
    return {
      severity: 'critical',
      type: 'displacement',
      label: 'AI DISPLACEMENT DETECTED',
      headline: `AI systems are citing another source where "${entity}" should appear.`,
      detail:
        'Alternative sources are winning the answer slot that belongs to your entity. ' +
        'This is not a ranking problem — it is a replacement problem. Fixing it requires ' +
        'entity clarity, citation reinforcement, and structural authority signals.',
      evidence,
    };
  }

  // — 2. Contradiction: multi-model disagreement ————————————————————————————
  if (cr && cr.blocker_count >= 2) {
    const worstPlatform = getWorstPlatform(platforms);
    const evidence: string[] = [
      `${cr.blocker_count} cross-model blockers detected`,
      worstPlatform
        ? `Lowest platform score: ${worstPlatform.platform} (${worstPlatform.score})`
        : null,
      ap ? `Entity clarity: ${ap.entity_clarity_score}%` : null,
    ].filter(Boolean) as string[];

    return {
      severity: 'critical',
      type: 'contradiction',
      label: 'AI CONTRADICTION DETECTED',
      headline: `AI systems disagree on what "${entity}" is or does.`,
      detail:
        'Different AI engines produce conflicting descriptions of your entity. ' +
        'This creates instability in citations — each model reaches a different ' +
        'conclusion, and none can safely include you as authoritative. Fix the ' +
        'signal contradictions before optimising for visibility.',
      evidence,
    };
  }

  // — 3. Fragmentation: entity split across interpretations  ————————————————
  if (ap && ap.entity_clarity_score < 35) {
    const evidence: string[] = [
      `Entity clarity: ${ap.entity_clarity_score}%`,
      `Aliases detected: ${ap.aliases?.length ?? 0}`,
      ap.gaps?.length ? `${ap.gaps.length} citation gap${ap.gaps.length !== 1 ? 's' : ''}` : null,
    ].filter(Boolean) as string[];

    return {
      severity: 'high',
      type: 'fragmentation',
      label: 'ENTITY FRAGMENTATION',
      headline: `"${entity}" is split into multiple conflicting interpretations across AI systems.`,
      detail:
        'AI systems cannot form a stable mental model of your brand because the signals ' +
        'conflict or are too sparse. Each model reconstructs your entity differently. ' +
        'Until your entity identity is unified and reinforced, citation probability ' +
        'will remain suppressed regardless of traffic or rankings.',
      evidence,
    };
  }

  // — 4. Absence: citation coverage is zero ————————————————————————————————
  if (ap && ap.citation_coverage_score === 0) {
    const missedPlatforms = getMissedPlatforms(platforms);
    const evidence: string[] = [
      'Citation coverage: 0%',
      `Queries tested: ${ap.queries_tested}`,
      `Mentions found: ${ap.mentions_found}`,
      missedPlatforms.length ? `Not found on: ${missedPlatforms.join(', ')}` : null,
    ].filter(Boolean) as string[];

    return {
      severity: 'critical',
      type: 'absence',
      label: 'COMPLETE CITATION ABSENCE',
      headline: `"${entity}" does not appear in any AI answer across all tested queries.`,
      detail:
        'Zero citation evidence. AI systems have no usable signal to include your entity in answers. ' +
        'This is the highest-risk visibility state: not ranked lower, but entirely absent ' +
        'from the answer layer. Structural, entity, and evidence fixes are all required before ' +
        'citation probability can register.',
      evidence,
    };
  }

  // — 5. Partial: below threshold but not zero ——————————————————————————————
  if (ap && ap.answer_presence_score < 50) {
    const evidence: string[] = [
      `Answer presence score: ${ap.answer_presence_score}%`,
      `Citation coverage: ${ap.citation_coverage_score}%`,
      `Authority alignment: ${ap.authority_alignment_score}%`,
    ];

    return {
      severity: 'high',
      type: 'partial',
      label: 'BELOW-THRESHOLD AI PRESENCE',
      headline: `"${entity}" appears in fewer than half of relevant AI answers.`,
      detail:
        'AI systems are inconsistently including your entity. Some queries surface it; ' +
        'most do not. This is the tipping-point state — small structural improvements ' +
        'can push citation probability above threshold and lock in stable visibility.',
      evidence,
    };
  }

  return null;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function getWorstPlatform(
  scores: AnalysisResponse['ai_platform_scores']
): { platform: string; score: number } | null {
  const pairs = Object.entries(scores) as [string, number][];
  if (!pairs.length) return null;
  const sorted = pairs.sort((a, b) => a[1] - b[1]);
  return { platform: sorted[0][0], score: sorted[0][1] };
}

function getMissedPlatforms(scores: AnalysisResponse['ai_platform_scores']): string[] {
  return (Object.entries(scores) as [string, number][])
    .filter(([, v]) => v < 20)
    .map(([k]) => k.replace('_', ' '))
    .slice(0, 3);
}

// ── Styling maps ─────────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<
  Severity,
  { border: string; bg: string; labelColor: string; headlineColor: string }
> = {
  critical: {
    border: 'border-red-500/35',
    bg: 'bg-red-500/6',
    labelColor: 'text-red-400',
    headlineColor: 'text-red-100',
  },
  high: {
    border: 'border-amber-400/30',
    bg: 'bg-amber-500/5',
    labelColor: 'text-amber-400',
    headlineColor: 'text-amber-100',
  },
  medium: {
    border: 'border-violet-400/25',
    bg: 'bg-violet-500/5',
    labelColor: 'text-violet-400',
    headlineColor: 'text-violet-100',
  },
};

const TYPE_ICON: Record<ProblemStatement['type'], string> = {
  displacement: '⇄',
  contradiction: '≠',
  fragmentation: '⊕',
  absence: '∅',
  partial: '◑',
};

// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  result: AnalysisResponse;
  /** When provided, "Fix" CTA links to the score-fix page with this URL pre-filled */
  targetUrl?: string;
}

export function AIMisrepresentationCard({ result, targetUrl }: Props) {
  const problem = deriveProblemStatement(result);
  if (!problem) return null;

  const styles = SEVERITY_STYLES[problem.severity];
  const fixHref = targetUrl
    ? `/app/score-fix?url=${encodeURIComponent(targetUrl)}`
    : '/app/score-fix';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.15 }}
      className={`rounded-2xl border ${styles.border} ${styles.bg} p-5 mt-5`}
      aria-label="AI misrepresentation report"
    >
      {/* Label row */}
      <div className="flex items-center gap-2 mb-3">
        <span className={`font-mono text-xl leading-none ${styles.labelColor}`} aria-hidden="true">
          {TYPE_ICON[problem.type]}
        </span>
        <span className={`text-[10px] font-bold uppercase tracking-widest ${styles.labelColor}`}>
          {problem.label}
        </span>
      </div>

      {/* Headline — the single dominant statement */}
      <p className={`text-sm font-semibold leading-snug mb-3 ${styles.headlineColor}`}>
        {problem.headline}
      </p>

      {/* Detail explanation */}
      <p className="text-xs text-white/55 leading-relaxed mb-4">{problem.detail}</p>

      {/* Evidence trace */}
      <div className="space-y-1 mb-4">
        {problem.evidence.map((item) => (
          <div key={item} className="flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-white/20 shrink-0" />
            <span className="text-[11px] font-mono text-white/45">{item}</span>
          </div>
        ))}
      </div>

      {/* CTA row */}
      <div className="flex flex-wrap gap-2 pt-1 border-t border-white/8">
        <Link
          to={fixHref}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
            problem.severity === 'critical'
              ? 'bg-red-500/20 text-red-200 hover:bg-red-500/30 border border-red-400/25'
              : 'bg-amber-500/15 text-amber-200 hover:bg-amber-500/25 border border-amber-400/20'
          }`}
        >
          Fix this →
        </Link>
        <Link
          to="/blogs/when-ai-speaks-are-you-inside-the-answer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/50 hover:text-white/75 transition-colors"
        >
          Understand why
        </Link>
      </div>
    </motion.div>
  );
}
