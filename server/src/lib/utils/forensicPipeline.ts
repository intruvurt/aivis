// server/src/lib/utils/forensicPipeline.ts

import { validateAndNormalizeUrl } from './urlValidator.js';
import { performDiscovery, performCrawl } from './webCrawler.js';
import { extractContent } from './contentExtractor.js';
import { performTechnicalChecks } from './technicalChecker.js';
import { analyzeContentClarity } from './contentAnalyzer.js';
import {
  computeScores as calculateScores,
  determineVisibilityStatus,
  generateRisks,
} from './scoringEngine.js';
import type { ComputedScores } from './scoringEngine.js';
import { buildEvidence } from './evidenceUtils.js';

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

type Evidence = ReturnType<typeof buildEvidence>;

type Stage1Result = {
  valid: boolean;
  normalizedUrl?: string;
  evidence: Evidence[];
  errors: string[];
};

type Stage2Result = {
  evidence: Evidence[];
  discoveryData: unknown;
};

type Stage3Result = {
  evidence: Evidence[];
  crawlData: {
    content?: unknown;
    [k: string]: unknown;
  };
};

type Stage4Result = {
  evidence: Evidence[];
  extractedData: unknown;
};

type Stage5Result = {
  evidence: Evidence[];
  technicalData: unknown;
};

type Stage6Result = {
  evidence: Evidence[];
  contentData: unknown;
};

type PipelineStages = {
  inputNormalization?: Stage1Result;
  discovery?: Stage2Result;
  crawl?: Stage3Result;
  extraction?: Stage4Result;
  technicalChecks?: Stage5Result;
  contentClarity?: Stage6Result;
};

export type PipelineResult = {
  success: boolean;
  stages: PipelineStages;
  allEvidence: Evidence[];
  scores: ComputedScores;
  visibilityStatus?: string;
  risks: unknown[];
  recommendations: {
    priority: 'high' | 'medium' | 'low';
    action: string;
    impact: string;
  }[];
  errors: string[];
  meta: {
    startedAt: string;
    finishedAt?: string;
    elapsedMs?: number;
    deadlineMs: number;
    timedOut: boolean;
  };
};

/* -------------------------------------------------------------------------- */
/*                                  HELPERS                                   */
/* -------------------------------------------------------------------------- */

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  return 'Unknown error';
}

class PipelineTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PipelineTimeoutError';
  }
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
  signal?: AbortSignal
): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new PipelineTimeoutError(`No time left for ${label}`);
  }

  let timer: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new PipelineTimeoutError(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  const abortPromise =
    signal &&
    new Promise<never>((_, reject) => {
      if (signal.aborted) {
        reject(new PipelineTimeoutError(`${label} aborted`));
        return;
      }
      signal.addEventListener(
        'abort',
        () => reject(new PipelineTimeoutError(`${label} aborted`)),
        { once: true }
      );
    });

  try {
    return await Promise.race(
      abortPromise ? [promise, timeoutPromise, abortPromise] : [promise, timeoutPromise]
    );
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/* -------------------------------------------------------------------------- */
/*                                MAIN PIPELINE                               */
/* -------------------------------------------------------------------------- */

const DEFAULT_PIPELINE_DEADLINE_MS = 52_000;
const DEFAULT_FLUSH_BUFFER_MS = 6_000;

export async function runForensicPipeline(
  inputUrl: string,
  opts?: {
    deadlineMs?: number;
    flushBufferMs?: number;
    signal?: AbortSignal;
  }
): Promise<PipelineResult> {
  const startedAt = Date.now();
  const deadlineMs = opts?.deadlineMs ?? DEFAULT_PIPELINE_DEADLINE_MS;
  const flushBufferMs = opts?.flushBufferMs ?? DEFAULT_FLUSH_BUFFER_MS;

  const controller = new AbortController();
  const upstreamSignal = opts?.signal;

  if (upstreamSignal) {
    if (upstreamSignal.aborted) controller.abort();
    else upstreamSignal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  const result: PipelineResult = {
    success: false,
    stages: {},
    allEvidence: [],
    scores: { overall: 0, components: { content: 0, technical: 0, ux: 0, aiOptimization: 0 } },
    risks: [],
    recommendations: [],
    errors: [],
    meta: {
      startedAt: new Date(startedAt).toISOString(),
      deadlineMs,
      timedOut: false,
    },
  };

  const timeLeft = () => Math.max(0, deadlineMs - (Date.now() - startedAt));

  const finish = (): PipelineResult => {
    result.meta.finishedAt = new Date().toISOString();
    result.meta.elapsedMs = Date.now() - startedAt;
    return result;
  };

  try {
    const stage1 = validateAndNormalizeUrl(inputUrl);
    result.stages.inputNormalization = stage1;
    result.allEvidence.push(...stage1.evidence);

    if (!stage1.valid) {
      result.errors.push(...stage1.errors);
      return finish();
    }

    const normalizedUrl = stage1.normalizedUrl ?? inputUrl;

    if (timeLeft() <= flushBufferMs + 500) {
      result.meta.timedOut = true;
      result.errors.push('Pipeline halted early: insufficient time budget (pre-flight).');
      return finish();
    }

    const stage2 = await withTimeout(
      performDiscovery(normalizedUrl),
      timeLeft() - flushBufferMs,
      'discovery',
      controller.signal
    );

    result.stages.discovery = stage2;
    result.allEvidence.push(...stage2.evidence);

    const stage3 = await withTimeout(
      performCrawl(normalizedUrl),
      timeLeft() - flushBufferMs,
      'crawl',
      controller.signal
    );

    result.stages.crawl = stage3;
    result.allEvidence.push(...stage3.evidence);

    if (!stage3.crawlData?.content) {
      result.errors.push('Failed to fetch page content');
      return finish();
    }

    const stage4 = extractContent(String(stage3.crawlData.content), normalizedUrl);
    result.stages.extraction = stage4;
    result.allEvidence.push(...stage4.evidence);

    const stage5 = performTechnicalChecks(stage3.crawlData, stage4.extractedData, normalizedUrl);
    result.stages.technicalChecks = stage5;
    result.allEvidence.push(...stage5.evidence);

    const stage6 = analyzeContentClarity(stage4.extractedData, normalizedUrl);
    result.stages.contentClarity = stage6;
    result.allEvidence.push(...stage6.evidence);

    const computedScores = calculateScores(
      result.allEvidence as any[],
      stage2.discoveryData,
      stage5.technicalData,
      stage6.contentData
    );

    result.scores = computedScores;

    result.visibilityStatus = determineVisibilityStatus(result.scores.overall);

    const risks = generateRisks(result.scores, stage5.technicalData, stage6.contentData);

    result.risks = risks;

    result.recommendations = risks.map((risk: { severity?: string; description?: string; message?: string; impact?: string }) => ({
      priority:
        risk.severity === 'high'
          ? 'high'
          : risk.severity === 'medium'
          ? 'medium'
          : 'low',
      action: `Address: ${risk.description ?? risk.message ?? 'identified issue'}`,
      impact: risk.impact ?? 'Improves AI visibility',
    }));

    result.success = true;
    return finish();
  } catch (error: unknown) {
    if (error instanceof PipelineTimeoutError) {
      result.meta.timedOut = true;
      controller.abort();
    }

    result.errors.push(`Pipeline execution error: ${errMsg(error)}`);
    return finish();
  }
}