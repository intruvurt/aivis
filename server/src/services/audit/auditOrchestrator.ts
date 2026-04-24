import type { ScrapeResult } from '../scraper.js';
import { analyzeContent } from './contentAnalysis.js';
import { analyzeEntityClarity } from './entityClarity.js';
import { analyzeTechnical } from './technicalAnalysis.js';
import { analyzePrivateExposureLite } from './privateExposureLite.js';
import { analyzeWithCloudflareUrlScanner } from './cloudflareUrlScannerService.js';
import type { ContentAnalysisResult } from './contentAnalysis.js';
import type { EntityClarityResult } from './entityClarity.js';
import type { TechnicalAnalysisResult } from './technicalAnalysis.js';
import type { PrivateExposureLiteResult } from './privateExposureLite.js';
import type { CloudflareUrlScannerResult } from './cloudflareUrlScannerService.js';
import type { AuditEvidence, AuditFinding, AuditFix, AuditScoreBreakdown } from '../../../../shared/types/audit.js';

export interface AuditOrchestrationInput {
  scrapeResult: ScrapeResult;
}

export interface AuditOrchestrationOutput {
  content: ContentAnalysisResult;
  entity: EntityClarityResult;
  technical: TechnicalAnalysisResult;
  privateExposure: PrivateExposureLiteResult;
  cloudflare: CloudflareUrlScannerResult;
}

export interface ComposedAuditReport {
  findings: AuditFinding[];
  evidence: AuditEvidence[];
  fixes: AuditFix[];
  scores: Partial<AuditScoreBreakdown>;
  completeness: number;
  confidence: number;
  constraints: string[];
}

/**
 * Main audit orchestrator that coordinates all analysis engines
 */
export async function orchestrateAudit(
  input: AuditOrchestrationInput,
): Promise<AuditOrchestrationOutput> {
  const scrape = input.scrapeResult;
  const html = scrape.data?.html || '';
  const finalUrl = scrape.url || '';

  if (!html) {
    const empty = {
      findings: [],
      evidence: [],
      fixes: [],
      scores: {},
      completeness: 0,
      confidence: 0,
      constraints: ['empty_html'],
    };

    return {
      content: empty,
      entity: empty,
      technical: empty,
      privateExposure: empty,
      cloudflare: empty,
    };
  }

  // Run analysis engines in parallel for performance
  const [content, entity, technical, privateExposure, cloudflare] = await Promise.all([
    analyzeContent({ html, finalUrl }),
    analyzeEntityClarity({ html, finalUrl }),
    analyzeTechnical({ html, finalUrl }),
    analyzePrivateExposureLite({ html, finalUrl }),
    analyzeWithCloudflareUrlScanner({ url: finalUrl }),
  ]);

  return {
    content,
    entity,
    technical,
    privateExposure,
    cloudflare,
  };
}

/**
 * Merge analysis results with tier-based filtering
 */
export function composeAuditReport(
  analysis: AuditOrchestrationOutput,
  _tier: string,
): ComposedAuditReport {
  const modules = [analysis.content, analysis.entity, analysis.technical, analysis.privateExposure, analysis.cloudflare];
  const findings = modules.flatMap((m) => m.findings);
  const evidence = dedupeById(modules.flatMap((m) => m.evidence));
  const fixes = dedupeById(modules.flatMap((m) => m.fixes));
  const constraints = Array.from(new Set(modules.flatMap((m) => m.constraints)));

  const scores: Partial<AuditScoreBreakdown> = mergeScores(modules.map((m) => m.scores));

  const completeness = Math.round(modules.reduce((sum, m) => sum + (m.completeness || 0), 0) / modules.length);
  const confidence = Math.round(modules.reduce((sum, m) => sum + (m.confidence || 0), 0) / modules.length);

  return {
    findings,
    evidence,
    fixes,
    scores,
    completeness,
    confidence,
    constraints,
  };
}

function mergeScores(scoreSets: Array<Partial<AuditScoreBreakdown>>): Partial<AuditScoreBreakdown> {
  const accum = new Map<keyof AuditScoreBreakdown, number[]>();
  scoreSets.forEach((set) => {
    (Object.entries(set) as Array<[keyof AuditScoreBreakdown, number | undefined]>).forEach(([key, value]) => {
      if (typeof value !== 'number') return;
      const list = accum.get(key) || [];
      list.push(value);
      accum.set(key, list);
    });
  });

  const merged: Partial<AuditScoreBreakdown> = {};
  accum.forEach((values, key) => {
    merged[key] = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  });
  return merged;
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const output: T[] = [];
  for (const item of items) {
    if (!item?.id || seen.has(item.id)) continue;
    seen.add(item.id);
    output.push(item);
  }
  return output;
}
