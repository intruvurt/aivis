import type { ScrapeResult } from '../scraper.js';
import {
  orchestrateAudit,
  composeAuditReport,
  type AuditOrchestrationOutput,
  type ComposedAuditReport,
} from './auditOrchestrator.js';
import {
  runDeterministicAuditLayer,
  type DeterministicResult,
} from './deterministicPipeline.js';

export interface RunAuditPipelineInput {
  scrapeResult: ScrapeResult;
  tier: string;
  auditRunId?: string;
  userId?: string;
  includeDeterministic?: boolean;
}

export interface RunAuditPipelineOutput {
  modules: AuditOrchestrationOutput;
  report: ComposedAuditReport;
  deterministic: DeterministicResult | null;
}

/**
 * Canonical audit truth entry for deterministic + modular analysis.
 *
 * Use this instead of recomputing content/entity/technical/fix layers in
 * multiple call-sites. The deterministic pass is optional so existing flows
 * can adopt this incrementally without forcing DB writes.
 */
export async function runAuditPipeline(
  input: RunAuditPipelineInput,
): Promise<RunAuditPipelineOutput> {
  const modules = await orchestrateAudit({ scrapeResult: input.scrapeResult });
  const report = composeAuditReport(modules, input.tier);

  let deterministic: DeterministicResult | null = null;
  const shouldRunDeterministic = input.includeDeterministic !== false;

  if (shouldRunDeterministic && input.auditRunId && input.userId) {
    deterministic = await runDeterministicAuditLayer(
      input.auditRunId,
      input.userId,
      input.scrapeResult,
    );
  }

  return {
    modules,
    report,
    deterministic,
  };
}