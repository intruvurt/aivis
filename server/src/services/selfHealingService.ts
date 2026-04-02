import { getPool } from './postgresql.js';
import { buildFixPlan } from './autoVisibilityFixEngine.js';
import { getVisibilityHistory } from './realtimeVisibilityEngine.js';
import { emitAgencyEvent } from './agencyEventBus.js';

type HealingMode = 'manual' | 'assisted' | 'autonomous';

type CandidateRow = {
  user_id: string;
  url: string;
  latest_score: number;
  previous_score: number;
  latest_result: any;
};

const DEFAULT_INTERVAL_MINUTES = Math.max(5, Number(process.env.SELF_HEAL_INTERVAL_MINUTES || 360));
const DEFAULT_DROP_THRESHOLD = Math.max(5, Number(process.env.SELF_HEAL_DROP_THRESHOLD || 10));
const MIN_AUTO_CONFIDENCE = Math.max(0.5, Math.min(0.99, Number(process.env.SELF_HEAL_MIN_CONFIDENCE || 0.8)));

let loopTimer: ReturnType<typeof setInterval> | null = null;
let running = false;

function scoreConfidence(priorities: Array<{ priority: string }>): number {
  const high = priorities.filter((item) => item.priority === 'high').length;
  const medium = priorities.filter((item) => item.priority === 'medium').length;
  return Math.max(0, Math.min(1, high * 0.35 + medium * 0.2 + 0.25));
}

async function getPreference(userId: string) {
  const { rows } = await getPool().query(
    `SELECT mode, enabled, drop_threshold
       FROM self_healing_preferences
      WHERE user_id = $1`,
    [userId]
  );

  if (!rows.length) {
    return {
      mode: 'manual' as HealingMode,
      enabled: true,
      drop_threshold: DEFAULT_DROP_THRESHOLD,
    };
  }

  return {
    mode: (rows[0].mode as HealingMode) || 'manual',
    enabled: rows[0].enabled !== false,
    drop_threshold: Number(rows[0].drop_threshold || DEFAULT_DROP_THRESHOLD),
  };
}

function inferIssuesFromResult(result: any): Array<{ issue: string; severity: 'low' | 'medium' | 'high'; page: string }> {
  const recs = Array.isArray(result?.recommendations) ? result.recommendations : [];
  if (!recs.length) {
    return [
      { issue: 'not mentioned consistently across AI responses', severity: 'high', page: '/' },
      { issue: 'weak structure and heading hierarchy', severity: 'medium', page: '/pricing' },
    ];
  }

  return recs.slice(0, 5).map((rec: any) => ({
    issue: String(rec?.title || rec?.description || 'visibility issue').trim(),
    severity: rec?.priority === 'high' ? 'high' : rec?.priority === 'medium' ? 'medium' : 'low',
    page: '/pricing',
  }));
}

async function recordEvent(args: {
  userId: string;
  domain: string;
  beforeScore: number;
  afterScore: number;
  scoreDrop: number;
  mentionDrop: number;
  mode: HealingMode;
  status: string;
  confidence: number;
  fixPlan: any;
  reason: string;
}) {
  await getPool().query(
    `INSERT INTO self_healing_events (
      user_id, domain, before_score, after_score, score_drop, mention_drop,
      mode, status, confidence, reason, fix_plan, created_at, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,NOW(),NOW())`,
    [
      args.userId,
      args.domain,
      args.beforeScore,
      args.afterScore,
      args.scoreDrop,
      args.mentionDrop,
      args.mode,
      args.status,
      args.confidence,
      args.reason,
      JSON.stringify(args.fixPlan),
    ]
  );
}

async function evaluateCandidate(candidate: CandidateRow): Promise<void> {
  const domain = (() => {
    try {
      return new URL(candidate.url).hostname.toLowerCase();
    } catch {
      return '';
    }
  })();
  if (!domain) return;

  const preference = await getPreference(candidate.user_id);
  if (!preference.enabled) return;

  const scoreDrop = Number(candidate.previous_score) - Number(candidate.latest_score);
  if (scoreDrop < preference.drop_threshold) return;

  const history = await getVisibilityHistory(domain, 2);
  const mentionDrop = history.length >= 2
    ? Number(history[1].mention_rate || 0) - Number(history[0].mention_rate || 0)
    : 0;

  const issues = inferIssuesFromResult(candidate.latest_result);
  const fixPlan = buildFixPlan({
    domain,
    issues,
    yourMentionRate: Math.max(0, Number(history[0]?.mention_rate || 0)),
    competitorMentionRate: Math.max(0.35, Number(history[1]?.mention_rate || 0.7)),
    visibilityScore: Number(candidate.latest_score || 0),
  });

  const confidence = scoreConfidence(fixPlan.prioritizedFixes);
  let status = 'suggested';

  if (preference.mode === 'assisted') {
    status = 'awaiting_approval';
  } else if (preference.mode === 'autonomous') {
    status = confidence >= MIN_AUTO_CONFIDENCE ? 'auto_applied' : 'awaiting_approval';
  }

  await recordEvent({
    userId: candidate.user_id,
    domain,
    beforeScore: Number(candidate.previous_score || 0),
    afterScore: Number(candidate.latest_score || 0),
    scoreDrop,
    mentionDrop,
    mode: preference.mode,
    status,
    confidence,
    reason: `Score dropped by ${scoreDrop.toFixed(1)} points`,
    fixPlan,
  });

  await emitAgencyEvent('visibility.drop', {
    userId: candidate.user_id,
    domain,
    scoreDrop,
    beforeScore: Number(candidate.previous_score || 0),
    afterScore: Number(candidate.latest_score || 0),
  });

  if (status === 'auto_applied') {
    await emitAgencyEvent('fix.applied', {
      userId: candidate.user_id,
      domain,
      confidence,
      mode: preference.mode,
    });
  }
}

export async function runSelfHealingCycle(): Promise<{ processed: number }> {
  const { rows } = await getPool().query(
    `WITH ranked AS (
       SELECT
         user_id,
         url,
         visibility_score,
         result,
         created_at,
         ROW_NUMBER() OVER (PARTITION BY user_id, url ORDER BY created_at DESC) AS rn
       FROM audits
       WHERE status = 'completed'
         AND created_at >= NOW() - INTERVAL '14 days'
     )
     SELECT
       latest.user_id,
       latest.url,
       latest.visibility_score::float AS latest_score,
       prev.visibility_score::float AS previous_score,
       latest.result AS latest_result
     FROM ranked latest
     JOIN ranked prev
       ON prev.user_id = latest.user_id
      AND prev.url = latest.url
      AND prev.rn = 2
     WHERE latest.rn = 1
       AND (prev.visibility_score - latest.visibility_score) >= $1
     LIMIT 100`,
    [DEFAULT_DROP_THRESHOLD]
  );

  let processed = 0;
  for (const row of rows as CandidateRow[]) {
    try {
      await evaluateCandidate(row);
      processed += 1;
    } catch (err: any) {
      console.warn('[SelfHealing] candidate failed:', err?.message || err);
    }
  }

  return { processed };
}

export function startSelfHealingLoop(): void {
  if (loopTimer) return;
  loopTimer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await runSelfHealingCycle();
    } catch (err: any) {
      console.warn('[SelfHealing] cycle failed:', err?.message || err);
    } finally {
      running = false;
    }
  }, DEFAULT_INTERVAL_MINUTES * 60 * 1000);
}