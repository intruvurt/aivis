/**
 * Fix Decision Engine — Level 4 Self-Healing System
 *
 * Given a set of detected issues and the user's healing mode preference,
 * determines whether to: notify only | generate a PR | auto-merge the fix.
 *
 * Auto-merge eligibility rules (conservative by design):
 *   - Mode must be 'autonomous'
 *   - Fix type must be 'meta' or 'schema' (lower risk, no code logic)
 *   - Impact score must be ≥ 5
 *   - Confidence must be ≥ MIN_AUTO_CONFIDENCE (env: SELF_HEAL_MIN_CONFIDENCE, default 0.8)
 *   - Severity must be 'high'
 */

export type HealingMode = 'manual' | 'assisted' | 'autonomous';

export type FixType =
  | 'meta'
  | 'schema'
  | 'heading'
  | 'content'
  | 'internal_links'
  | 'canonical'
  | 'robots'
  | 'performance'
  | 'generic';

export type FixAction = 'notify' | 'generate_pr' | 'auto_merge';

export interface DetectedIssue {
  /** Human-readable description */
  issue: string;
  severity: 'low' | 'medium' | 'high';
  /** Page path (e.g. '/pricing') */
  page: string;
  /** Optional structured fix type */
  fix_type?: FixType;
  /** Estimated score improvement (0-100) */
  impact_score?: number;
  /** Whether this issue can be programmatically fixed */
  auto_fixable?: boolean;
}

export interface FixDecision {
  /** Recommended action */
  action: FixAction;
  /** Human-readable explanation of the decision */
  reason: string;
  /** 0-1 confidence that the decision is correct */
  confidence: number;
  /** Priority rank for ordering in the UI (higher = fix sooner) */
  priority_score: number;
  /** The issue that was evaluated */
  issue: DetectedIssue;
  /** Whether auto-merge is blocked (null when action !== 'auto_merge') */
  auto_merge_blocked_reason: string | null;
}

const MIN_AUTO_CONFIDENCE = Math.max(
  0.5,
  Math.min(0.99, Number(process.env.SELF_HEAL_MIN_CONFIDENCE || 0.8)),
);

/** Fix types safe for auto-merge (content-free, structural only) */
const AUTO_MERGE_SAFE_TYPES: ReadonlySet<FixType> = new Set(['meta', 'schema', 'canonical', 'robots']);

/**
 * Decide what to do with a single detected issue.
 */
export function decide(
  issue: DetectedIssue,
  mode: HealingMode,
  confidence: number,
): FixDecision {
  const impact = issue.impact_score ?? impactDefault(issue.severity);
  const effortWeight = effortScore(issue.fix_type ?? 'generic');
  const priority_score = Math.round((impact / Math.max(1, effortWeight)) * 10) / 10;

  // ── manual mode: always notify ─────────────────────────────────────────────
  if (mode === 'manual') {
    return {
      action: 'notify',
      reason: 'Mode is set to manual — notifying only, no automatic fix applied.',
      confidence,
      priority_score,
      issue,
      auto_merge_blocked_reason: 'mode=manual',
    };
  }

  // ── not auto-fixable: always notify ────────────────────────────────────────
  if (issue.auto_fixable === false) {
    return {
      action: 'notify',
      reason: `Issue "${issue.issue}" is not automatically fixable — manual review required.`,
      confidence,
      priority_score,
      issue,
      auto_merge_blocked_reason: 'not_auto_fixable',
    };
  }

  // ── assisted mode: generate a PR for review ────────────────────────────────
  if (mode === 'assisted') {
    return {
      action: 'generate_pr',
      reason: 'Mode is assisted — a PR will be opened for your review.',
      confidence,
      priority_score,
      issue,
      auto_merge_blocked_reason: 'mode=assisted',
    };
  }

  // ── autonomous mode: attempt auto-merge if safe ────────────────────────────
  const fixType = issue.fix_type ?? 'generic';

  if (!AUTO_MERGE_SAFE_TYPES.has(fixType)) {
    return {
      action: 'generate_pr',
      reason: `Fix type "${fixType}" is not in the auto-merge safe list — opening a PR for review.`,
      confidence,
      priority_score,
      issue,
      auto_merge_blocked_reason: `fix_type=${fixType}_not_safe`,
    };
  }

  if (confidence < MIN_AUTO_CONFIDENCE) {
    return {
      action: 'generate_pr',
      reason: `Confidence ${(confidence * 100).toFixed(0)}% is below threshold ${(MIN_AUTO_CONFIDENCE * 100).toFixed(0)}% — opening a PR for review.`,
      confidence,
      priority_score,
      issue,
      auto_merge_blocked_reason: `confidence_too_low`,
    };
  }

  if (issue.severity !== 'high') {
    return {
      action: 'generate_pr',
      reason: `Issue severity is "${issue.severity}" — auto-merge reserved for high-severity issues only.`,
      confidence,
      priority_score,
      issue,
      auto_merge_blocked_reason: `severity=${issue.severity}`,
    };
  }

  if (impact < 5) {
    return {
      action: 'generate_pr',
      reason: `Impact score ${impact} is below 5 — not worth auto-merging at this time.`,
      confidence,
      priority_score,
      issue,
      auto_merge_blocked_reason: `impact_too_low`,
    };
  }

  // All gates passed — safe to auto-merge
  return {
    action: 'auto_merge',
    reason: `Auto-merge approved: ${fixType} fix, severity=${issue.severity}, impact=${impact}, confidence=${(confidence * 100).toFixed(0)}%.`,
    confidence,
    priority_score,
    issue,
    auto_merge_blocked_reason: null,
  };
}

/**
 * Batch-decide for a list of issues and return sorted by priority_score DESC.
 */
export function decideAll(
  issues: DetectedIssue[],
  mode: HealingMode,
  confidence: number,
): FixDecision[] {
  return issues
    .map((issue) => decide(issue, mode, confidence))
    .sort((a, b) => b.priority_score - a.priority_score);
}

// ── Private helpers ──────────────────────────────────────────────────────────

function impactDefault(severity: 'low' | 'medium' | 'high'): number {
  switch (severity) {
    case 'high': return 8;
    case 'medium': return 5;
    case 'low': return 2;
  }
}

/** Approximate effort (1 = easy, 10 = hard) — higher effort = lower priority when impact is equal */
function effortScore(fixType: FixType): number {
  const map: Record<FixType, number> = {
    meta: 1,
    schema: 2,
    canonical: 1,
    robots: 1,
    heading: 3,
    internal_links: 4,
    content: 7,
    performance: 8,
    generic: 5,
  };
  return map[fixType] ?? 5;
}
