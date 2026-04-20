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
import type { SerpEvidenceInput, KgEvidenceInput } from './evidenceLedger.js';
import { isSERPAvailable, fetchSERPSignals } from '../serpService.js';
import { searchKnowledgeGraph } from '../googleKnowledgeGraph.js';
import { isGeekflareAvailable, fetchGeekflareEnrichment, type GeekflareEnrichment } from '../geekflareService.js';

export interface RunAuditPipelineInput {
  scrapeResult: ScrapeResult;
  tier: string;
  auditRunId?: string;
  userId?: string;
  includeDeterministic?: boolean;
  /** Brand name used for SERP + KG enrichment. Falls back to hostname if omitted. */
  brand?: string;
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
    // ── Enrich with real SERP + KG signals ───────────────────────────────────
    const targetUrl = input.scrapeResult.url ?? '';
    const hostname = (() => {
      try { return new URL(targetUrl).hostname.replace(/^www\./, ''); } catch { return ''; }
    })();
    const brand = input.brand?.trim() || hostname;

    let serpEvidence: SerpEvidenceInput | undefined;
    let kgEvidence: KgEvidenceInput | undefined;
    let geekflareEvidence: GeekflareEnrichment | undefined;

    // Run SERP + KG + Geekflare in parallel, non-blocking on failure
    const [serpResult, kgResult, gfResult] = await Promise.allSettled([
      isSERPAvailable() && brand
        ? fetchSERPSignals(brand, hostname)
        : Promise.resolve(null),
      (process.env.GOOGLE_KG_KEY || process.env.GOOGLE_KG_API_KEY) && brand
        ? searchKnowledgeGraph(brand, { limit: 3 })
        : Promise.resolve(null),
      isGeekflareAvailable() && targetUrl
        ? fetchGeekflareEnrichment(targetUrl)
        : Promise.resolve(null),
    ]);

    if (serpResult.status === 'fulfilled' && serpResult.value) {
      const s = serpResult.value;
      serpEvidence = {
        organicPosition: s.organic_position,
        hasFeaturedSnippet: s.featured_snippet,
        hasKnowledgePanel: s.knowledge_panel,
        knowledgePanelData: s.knowledge_panel_data
          ? (s.knowledge_panel_data as unknown as Record<string, unknown>)
          : undefined,
        paaQuestions: s.paa_questions,
        richResults: s.rich_results,
      };
    }

    if (kgResult.status === 'fulfilled' && kgResult.value) {
      const topEntity = kgResult.value.entities[0];
      if (topEntity) {
        kgEvidence = {
          entityPresent: true,
          entityTypes: topEntity.types,
          entityDescription: topEntity.description || topEntity.detailed_description,
          resultScore: topEntity.result_score,
          kgId: topEntity.kg_id,
        };
      } else if (kgResult.value.raw_count === 0) {
        kgEvidence = { entityPresent: false };
      }
    }

    if (gfResult.status === 'fulfilled' && gfResult.value) {
      geekflareEvidence = gfResult.value;
    }
    // ─────────────────────────────────────────────────────────────────────────

    deterministic = await runDeterministicAuditLayer(
      input.auditRunId,
      input.userId,
      input.scrapeResult,
      { serpEvidence, kgEvidence, geekflareEvidence, brand: brand || undefined },
    );
  }

  return {
    modules,
    report,
    deterministic,
  };
}