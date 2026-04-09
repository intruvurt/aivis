/**
 * Pipeline Orchestrator - Ties together the self-healing audit pipeline.
 *
 * Core loop:
 *   1. Extract evidence (evidenceExtractor)
 *   2. Evaluate rules (ssfrRuleEngine)
 *   3. Score deterministically (scoringEngine)
 *   4. Classify findings (fixClassifier)
 *   5. Generate levelled fixpacks (levelledFixpackGenerator)
 *   6. Persist pipeline_runs record
 *
 * The orchestrator does NOT run the scraper or AI pipeline -
 * it operates on already-collected scrape + analysis data.
 */

import { getPool } from './postgresql.js';
import { extractEvidenceFromScrape, enrichEvidenceFromAnalysis } from './evidenceExtractor.js';
import { evaluateSSFRRules } from './ssfrRuleEngine.js';
import { scoreEvidence } from './scoringEngine.js';
import { classifyFindings } from './fixClassifier.js';
import { generateLevelledFixpacks } from './levelledFixpackGenerator.js';
import type { ScrapeResult } from './scraper.js';
import type {
  AnalysisResponse,
  PipelineRun,
  PipelineRunStatus,
  RemediationMode,
  ScoringResult,
  ClassificationResult,
  LevelledFixpack,
} from '../../../shared/types.js';

// ─── Pipeline execution ─────────────────────────────────────────────────────

export interface PipelineInput {
  userId: string;
  workspaceId?: string;
  targetUrl: string;
  auditId?: string;
  mode: RemediationMode;
  scrapeResult: ScrapeResult;
  analysisResult?: AnalysisResponse;
}

export interface PipelineOutput {
  run: PipelineRun;
  scoring: ScoringResult;
  classification: ClassificationResult;
  fixpacks: LevelledFixpack[];
}

/**
 * Execute the full pipeline: evidence → rules → score → classify → fixpacks.
 * Persists the run to the `pipeline_runs` table.
 */
export async function executePipeline(input: PipelineInput): Promise<PipelineOutput> {
  const runId = await createRun(input);

  try {
    // 1. Extract evidence from scrape data
    await updateRunStatus(runId, 'scanning');
    let evidence = extractEvidenceFromScrape(input.scrapeResult);

    // 2. Enrich with AI analysis if available
    if (input.analysisResult) {
      evidence = enrichEvidenceFromAnalysis(evidence, input.analysisResult);
    }

    // 3. Evaluate SSFR rules against evidence
    const ruleResults = evaluateSSFRRules(evidence);

    // 4. Score deterministically
    await updateRunStatus(runId, 'scoring');
    const scoring = scoreEvidence(evidence);

    // 5. Classify findings
    await updateRunStatus(runId, 'classifying');
    const classification = classifyFindings(ruleResults, evidence);

    // 6. Generate levelled fixpacks
    await updateRunStatus(runId, 'generating_fixpacks');
    const fixpacks = generateLevelledFixpacks(
      classification.findings,
      ruleResults,
      evidence,
      input.targetUrl,
    );

    // 7. Determine final status based on mode
    const finalStatus: PipelineRunStatus = input.mode === 'advisory'
      ? 'completed'
      : 'awaiting_approval';

    // 8. Persist results
    const run = await completeRun(runId, {
      status: finalStatus,
      scoring,
      classification,
      fixpacks,
    });

    return { run, scoring, classification, fixpacks };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await failRun(runId, message);
    throw err;
  }
}

// ─── Database operations ────────────────────────────────────────────────────

async function createRun(input: PipelineInput): Promise<string> {
  const { rows } = await getPool().query(
    `INSERT INTO pipeline_runs (user_id, workspace_id, target_url, mode, status, audit_id)
     VALUES ($1, $2, $3, $4, 'pending', $5)
     RETURNING id`,
    [input.userId, input.workspaceId ?? null, input.targetUrl, input.mode, input.auditId ?? null],
  );
  return rows[0].id;
}

async function updateRunStatus(runId: string, status: PipelineRunStatus): Promise<void> {
  await getPool().query(
    `UPDATE pipeline_runs SET status = $1, updated_at = NOW() WHERE id = $2`,
    [status, runId],
  );
}

async function completeRun(
  runId: string,
  data: {
    status: PipelineRunStatus;
    scoring: ScoringResult;
    classification: ClassificationResult;
    fixpacks: LevelledFixpack[];
  },
): Promise<PipelineRun> {
  const { rows } = await getPool().query(
    `UPDATE pipeline_runs
     SET status = $1,
         scoring_result = $2::jsonb,
         classification_result = $3::jsonb,
         fixpacks = $4::jsonb,
         updated_at = NOW()
     WHERE id = $5
     RETURNING *`,
    [
      data.status,
      JSON.stringify(data.scoring),
      JSON.stringify(data.classification),
      JSON.stringify(data.fixpacks),
      runId,
    ],
  );
  return rowToPipelineRun(rows[0]);
}

async function failRun(runId: string, errorMessage: string): Promise<void> {
  await getPool().query(
    `UPDATE pipeline_runs SET status = 'failed', error_message = $1, updated_at = NOW() WHERE id = $2`,
    [errorMessage.slice(0, 2000), runId],
  );
}

// ─── Query helpers ──────────────────────────────────────────────────────────

/**
 * Get a pipeline run by ID (with ownership check).
 */
export async function getPipelineRun(runId: string, userId: string): Promise<PipelineRun | null> {
  const { rows } = await getPool().query(
    `SELECT * FROM pipeline_runs WHERE id = $1 AND user_id = $2`,
    [runId, userId],
  );
  return rows[0] ? rowToPipelineRun(rows[0]) : null;
}

/**
 * List pipeline runs for a user, newest first.
 */
export async function listPipelineRuns(
  userId: string,
  limit = 20,
  offset = 0,
): Promise<{ runs: PipelineRun[]; total: number }> {
  const countResult = await getPool().query(
    `SELECT COUNT(*)::int AS total FROM pipeline_runs WHERE user_id = $1`,
    [userId],
  );

  const { rows } = await getPool().query(
    `SELECT * FROM pipeline_runs
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset],
  );

  return {
    runs: rows.map(rowToPipelineRun),
    total: countResult.rows[0]?.total ?? 0,
  };
}

/**
 * Get the most recent pipeline run for a URL.
 */
export async function getLatestRunForUrl(
  userId: string,
  targetUrl: string,
): Promise<PipelineRun | null> {
  const { rows } = await getPool().query(
    `SELECT * FROM pipeline_runs
     WHERE user_id = $1 AND LOWER(target_url) = LOWER($2)
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, targetUrl],
  );
  return rows[0] ? rowToPipelineRun(rows[0]) : null;
}

// ─── Row mapper ─────────────────────────────────────────────────────────────

function rowToPipelineRun(row: Record<string, unknown>): PipelineRun {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    workspace_id: row.workspace_id ? String(row.workspace_id) : null,
    target_url: String(row.target_url),
    mode: String(row.mode) as RemediationMode,
    status: String(row.status) as PipelineRunStatus,
    audit_id: row.audit_id ? String(row.audit_id) : null,
    scoring_result: (row.scoring_result as ScoringResult) ?? null,
    classification_result: (row.classification_result as ClassificationResult) ?? null,
    fixpacks: Array.isArray(row.fixpacks) ? row.fixpacks as LevelledFixpack[] : [],
    rescan_uplift: (row.rescan_uplift as PipelineRun['rescan_uplift']) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}
