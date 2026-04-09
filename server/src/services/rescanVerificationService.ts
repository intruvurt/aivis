/**
 * Rescan Verification Service
 *
 * After fixpacks have been applied, this service re-runs the pipeline
 * on the same URL and produces a `RescanUplift` proof object comparing
 * the before/after scoring results.
 */

import { getPool } from './postgresql.js';
import { scrapeWebsite } from './scraper.js';
import { extractEvidenceFromScrape } from './evidenceExtractor.js';
import { evaluateSSFRRules } from './ssfrRuleEngine.js';
import { scoreEvidence } from './scoringEngine.js';
import type {
  RescanUplift,
  ScoringResult,
  CategoryScore,
  PipelineRunStatus,
} from '../../../shared/types.js';

/**
 * Re-scan a URL after fixpacks were applied, store the new score,
 * and persist the uplift proof on the pipeline run.
 */
export async function verifyRescan(
  runId: string,
  userId: string,
): Promise<RescanUplift> {
  // 1. Load the pipeline run
  const { rows } = await getPool().query(
    `SELECT * FROM pipeline_runs WHERE id = $1 AND user_id = $2`,
    [runId, userId],
  );
  const run = rows[0];
  if (!run) throw new Error(`Pipeline run ${runId} not found`);

  const beforeScoring = run.scoring_result as ScoringResult | null;
  if (!beforeScoring) throw new Error('No scoring result on pipeline run — cannot compare');

  // 2. Mark run as rescanning
  await setStatus(runId, 'rescanning');

  try {
    // 3. Re-scrape
    const scrapeResult = await scrapeWebsite(run.target_url);

    // 4. Re-extract evidence
    const evidence = extractEvidenceFromScrape(scrapeResult);

    // 5. Re-evaluate SSFR rules and apply score caps
    const ruleResults = evaluateSSFRRules(evidence);
    const failedBlockers = ruleResults.filter(r => r.is_hard_blocker && !r.passed && r.score_cap != null);

    // 6. Re-score
    const afterScoring = scoreEvidence(evidence);

    // 6b. Apply hard-blocker caps from rules (defensive — scoringEngine has its own caps,
    //     but rules may define tighter caps than evidence-level)
    if (failedBlockers.length > 0) {
      const minCap = Math.min(...failedBlockers.map(r => r.score_cap!));
      if (afterScoring.overall_score > minCap) {
        afterScoring.overall_score = minCap;
      }
    }

    // 7. Compute uplift
    const uplift = computeUplift(beforeScoring, afterScoring);

    // 8. Persist
    await getPool().query(
      `UPDATE pipeline_runs
       SET status = 'completed',
           rescan_uplift = $1::jsonb,
           updated_at = NOW()
       WHERE id = $2`,
      [JSON.stringify(uplift), runId],
    );

    return uplift;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await getPool().query(
      `UPDATE pipeline_runs
       SET status = 'failed',
           error_message = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [message.slice(0, 2000), runId],
    );
    throw err;
  }
}

// ─── Uplift computation ─────────────────────────────────────────────────────

function computeUplift(
  before: ScoringResult,
  after: ScoringResult,
): RescanUplift {
  const improvements: RescanUplift['improvements'] = [];

  for (const cat of after.categories) {
    const prev = before.categories.find((c: CategoryScore) => c.category === cat.category);
    const beforeScore = prev?.score_0_100 ?? 0;
    const delta = cat.score_0_100 - beforeScore;
    if (delta !== 0) {
      improvements.push({
        category: cat.category,
        delta,
        fix_classes_applied: cat.fix_classes,
      });
    }
  }

  return {
    score_before: before.overall_score,
    score_after: after.overall_score,
    score_delta: after.overall_score - before.overall_score,
    categories_before: before.categories,
    categories_after: after.categories,
    improvements,
    proof_timestamp: new Date().toISOString(),
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function setStatus(runId: string, status: PipelineRunStatus): Promise<void> {
  await getPool().query(
    `UPDATE pipeline_runs SET status = $1, updated_at = NOW() WHERE id = $2`,
    [status, runId],
  );
}
