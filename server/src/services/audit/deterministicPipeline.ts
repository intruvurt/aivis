/**
 * Deterministic Pipeline Orchestrator - ties evidence → rules → score → fixpacks.
 *
 * This layer runs AFTER the AI analysis pipeline completes.
 * It never throws - if any step fails, it degrades gracefully.
 *
 * Entry point: runDeterministicAuditLayer()
 *
 * Called non-blocking after res.json() in the analyze handler:
 *   runDeterministicAuditLayer(...)
 *     .then(additions => attachToAudit(auditId, additions))
 *     .catch(err => console.error(...))
 */

import {
  extractEvidenceFromScrapedData,
  persistEvidenceItems,
  buildSerpEvidenceItems,
  type EvidenceLedger,
  type SerpEvidenceInput,
  type KgEvidenceInput,
} from './evidenceLedger.js';
import {
  evaluateRules,
  computeScore,
  persistRuleResults,
  persistScoreSnapshot,
  type RuleResult,
  type ScoreSnapshot,
} from './ruleEngine.js';
import {
  detectFramework,
  generateFixpacks,
  buildBRAGTrail,
  persistFixpacks,
  persistBRAGTrail,
  type Fixpack,
  type BRAGTrailEntry,
} from './fixpackGenerator.js';
import { getPool } from '../postgresql.js';
import type { ScrapeResult } from '../scraper.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DeterministicResult {
  evidenceLedger: EvidenceLedger;
  ruleResults: RuleResult[];
  scoreSnapshot: ScoreSnapshot;
  fixpacks: Fixpack[];
  bragTrail: BRAGTrailEntry[];
  frameworkDetected: string;
}

export interface DeterministicResponseAdditions {
  deterministic_score: number;
  deterministic_score_version: string;
  family_scores: Record<string, number>;
  hard_blocker_count: number;
  score_cap: number | null;
  evidence_count: number;
  contradiction_count: number;
  rules_passed: number;
  rules_failed: number;
  fixpack_count: number;
  framework_detected: string;
}

// ─── Main orchestrator ────────────────────────────────────────────────────────

export async function runDeterministicAuditLayer(
  auditRunId: string,
  userId: string,
  scrapeResult: ScrapeResult,
  opts?: {
    /** Pre-fetched SERP signals to inject as evidence (optional — skipped when no SERP key) */
    serpEvidence?: SerpEvidenceInput;
    /** Pre-fetched Knowledge Graph entity data to inject as evidence (optional) */
    kgEvidence?: KgEvidenceInput;
    /** Brand name used for SERP/KG labelling */
    brand?: string;
  },
): Promise<DeterministicResult> {
  // 1. Extract deterministic evidence from scrape data
  const ledger = extractEvidenceFromScrapedData(auditRunId, scrapeResult);

  // 2. Inject real SERP + KG evidence items when available
  if (opts?.serpEvidence || opts?.kgEvidence) {
    const externalItems = buildSerpEvidenceItems({
      serp: opts.serpEvidence,
      kg: opts.kgEvidence,
      brand: opts.brand,
    });
    ledger.items.push(...externalItems);
  }

  // 3. Run rule engine against augmented evidence
  const ruleResults = evaluateRules(ledger.items, ledger.contradictions.length);

  // 4. Compute score
  const scoreSnapshot = computeScore(ruleResults);

  // 5. Detect framework
  const framework = detectFramework(scrapeResult.data.html || '');

  // 6. Generate fixpacks
  const fixpacks = generateFixpacks(ruleResults, ledger.items, scoreSnapshot, framework);

  // 7. Build BRAG trail
  const bragTrail = buildBRAGTrail(fixpacks, ruleResults);

  // 8. Persist everything (best-effort, non-blocking within the pipeline)
  await persistAll(auditRunId, userId, scrapeResult.url, ledger, ruleResults, scoreSnapshot, fixpacks, bragTrail, framework);

  return {
    evidenceLedger: ledger,
    ruleResults,
    scoreSnapshot,
    fixpacks,
    bragTrail,
    frameworkDetected: framework,
  };
}

// ─── Response builder ─────────────────────────────────────────────────────────

export function buildDeterministicResponseAdditions(
  result: DeterministicResult,
): DeterministicResponseAdditions {
  return {
    deterministic_score: result.scoreSnapshot.finalScore,
    deterministic_score_version: result.scoreSnapshot.scoreVersion,
    family_scores: { ...result.scoreSnapshot.familyScores },
    hard_blocker_count: result.scoreSnapshot.hardBlockerCount,
    score_cap: result.scoreSnapshot.scoreCap,
    evidence_count: result.evidenceLedger.items.length,
    contradiction_count: result.evidenceLedger.contradictions.length,
    rules_passed: result.ruleResults.filter((r) => r.passed).length,
    rules_failed: result.ruleResults.filter((r) => !r.passed).length,
    fixpack_count: result.fixpacks.length,
    framework_detected: result.frameworkDetected,
  };
}

// ─── Persistence orchestrator ─────────────────────────────────────────────────

async function persistAll(
  auditRunId: string,
  userId: string,
  url: string,
  ledger: EvidenceLedger,
  ruleResults: RuleResult[],
  scoreSnapshot: ScoreSnapshot,
  fixpacks: Fixpack[],
  bragTrail: BRAGTrailEntry[],
  framework: string,
): Promise<void> {
  try {
    await persistEvidenceItems(auditRunId, url, ledger.items);
  } catch (err: any) {
    console.error(`[DeterministicPipeline] Evidence persist failed:`, err?.message);
  }

  try {
    await persistRuleResults(auditRunId, ruleResults);
  } catch (err: any) {
    console.error(`[DeterministicPipeline] Rule results persist failed:`, err?.message);
  }

  try {
    await persistScoreSnapshot(auditRunId, userId, url, scoreSnapshot, framework);
  } catch (err: any) {
    console.error(`[DeterministicPipeline] Score snapshot persist failed:`, err?.message);
  }

  try {
    await persistFixpacks(auditRunId, userId, fixpacks);
  } catch (err: any) {
    console.error(`[DeterministicPipeline] Fixpacks persist failed:`, err?.message);
  }

  try {
    await persistBRAGTrail(auditRunId, bragTrail);
  } catch (err: any) {
    console.error(`[DeterministicPipeline] BRAG trail persist failed:`, err?.message);
  }
}

// ─── Attach deterministic results to existing audit record ────────────────────

export async function attachDeterministicToAudit(
  auditRunId: string,
  additions: DeterministicResponseAdditions,
): Promise<void> {
  const pool = getPool();

  try {
    await pool.query(
      `UPDATE audits
       SET result = result || $2::jsonb,
           updated_at = NOW()
       WHERE id = $1`,
      [auditRunId, JSON.stringify({ deterministic: additions })],
    );
  } catch (err: any) {
    console.error(`[DeterministicPipeline] Failed to attach to audit ${auditRunId}:`, err?.message);
  }
}
