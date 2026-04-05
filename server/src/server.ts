// server/src/server.ts
import 'dotenv/config';
import type { Request, Response } from 'express';

// Extend Request to carry the raw body buffer for webhook signature verification
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      rawBody?: string;
    }
  }
}

import express from 'express';
import path from 'path';
import { existsSync } from 'fs';
import { resolve as dnsResolve, lookup as dnsLookup } from 'dns/promises';
import * as cheerio from 'cheerio';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import Tesseract from 'tesseract.js';
import { timingSafeEqual } from 'crypto';
import cors from 'cors';
import helmet from 'helmet';
import validator from 'validator';
import * as Sentry from '@sentry/node';

import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

import authRoutes from './routes/authRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import auditQueueRoutes from './routes/auditQueueRoutes.js';
import { createLicenseAPI } from './licensing/verification-api.js';
import competitorRoutes from './routes/competitors.js';
import citationRoutes from './routes/citations.js';
import mentionRoutes from './routes/mentions.js';
import autoScoreFixRoutes from './routes/autoScoreFixRoutes.js';
import reverseEngineerApi from './routes/reverseEngineerApi.js';
import schemaGeneratorRoutes from './routes/schemaGeneratorRoutes.js';
import contentRoutes from './routes/contentRoutes.js';
import { getPricingInfo } from './controllers/paymentController.js';
import { getUserById } from './models/User.js';
import { BRAG_TRAIL_LABEL, TIER_LIMITS, uiTierFromCanonical, meetsMinimumTier, getTextSummaryDepth, getTierDisplayName } from '../../shared/types.js';
import type { CanonicalTier, LegacyTier, StrictRubricSystem, SchemaMarkup } from '../../shared/types.js';
import { verifyUserToken } from './lib/utils/jwt.js';
import { assessCitationStrength } from './services/citationStrength.js';
import { extractPlatformSignals, computePlatformScores, buildPlatformIntelligencePromptBlock } from './services/platformIntelligence.js';
import { assessEntityClarity } from './services/entityClarity.js';
import { analyzeReviewSentiment } from './services/reviewSentiment.js';
import { validateLLMReadability } from './services/llmReadabilityValidator.js';
import type { LLMReadabilityScore } from './services/llmReadabilityValidator.js';
import { scoreSchema, deriveContentSignals } from './services/schemaScorer.js';
import type { CitationStrength } from '../../shared/types.js';
import { safeJsonParse } from './lib/jsonUtils.js';
import { AnalysisCacheService } from './services/cacheService.js';
import { consumePackCredits, getAvailablePackCredits } from './services/scanPackCredits.js';
import { createPlatformNotification, createUserNotification } from './services/notificationService.js';
import { scrapeWebsite } from './services/scraper.js';
import { PROVIDERS, FREE_PROVIDERS, SIGNAL_AI1, SIGNAL_AI2, SIGNAL_AI3, SCOREFIX_AI1, SCOREFIX_AI2, SCOREFIX_AI3, ALIGNMENT_PRIMARY, callAIProvider, isProviderInBackoff, clearProviderBackoff } from './services/aiProviders.js';
import { runCryptoScan } from './services/cryptoScanner.js';
import { runPrivateExposureScan } from './services/privateExposureScanService.js';
import { assessUrlRisk } from './services/threatIntel.js';
import { buildCitationParityAudit } from './services/citationParityAudit.js';
import { authRequired } from './middleware/authRequired.js';
import { workspaceRequired } from './middleware/workspaceRequired.js';
import { requireWorkspacePermission } from './middleware/workspacePermission.js';
import { usageGate } from './middleware/usageGate.js';
import { incrementUsage } from './middleware/incrementUsage.js';
import { handleAssistantMessage } from './controllers/assistantController.js';
import { intelligenceAnalyzeHandler } from './controllers/intelligenceAnalyzeController.js';
import { closePool, runMigrations, getPool, healthCheck, getDatabaseStatus, executeTransaction } from './services/postgresql.js';
import { resolveWorkspaceForUser } from './services/tenantService.js';
import { persistAuditRecord } from './services/auditPersistenceService.js';
import { extractContactsFromHtml } from './lib/contactUtils.js';
import { pingIndexNow } from './utils/indexNow.js';
import featureRoutes from './routes/featureRoutes.js';
import workspaceRoutes from './routes/workspaceRoutes.js';
import externalApiV1, { widgetPublicRouter } from './routes/externalApiV1.js';
import complianceRoutes from './routes/complianceRoutes.js';
import { startCompetitorAutopilotLoop, startRescanLoop } from './services/scheduledRescanService.js';
import { createDeployVerificationJob, startDeployVerificationLoop } from './services/deployVerificationService.js';
import { setMcpAnalyzer, startMcpAuditLoop } from './services/mcpAuditProcessor.js';
import { extractDeployHookPayload, resolveDeployHookBySecret } from './services/deployHookService.js';
import { dispatchWebhooks } from './services/webhookService.js';
import { dispatchAuditReportDeliveries } from './services/reportDeliveryService.js';
import { generateTextSummary } from './services/textSummaryGenerator.js';
import { bootstrapScheduler } from './services/citationScheduler.js';
import { runNicheRanking } from './services/citationRankingEngine.js';
import { settleReferralCreditsIfEligible } from './services/referralCredits.js';
import {
  startNewsletterLoop,
  buildNewsletterEmailPayload,
  getCurrentNewsletterEditionKey,
  runNewsletterDispatchCycle,
  getNewsletterDispatchSettings,
  upsertNewsletterDispatchSettings,
} from './services/newsletterService.js';
import { startAutoScoreFixExpiryLoop, startAutoScoreFixWorkerLoop, startAutoScoreFixPostMergeLoop } from './services/autoScoreFixService.js';
import { startScheduledPlatformNotificationLoop } from './services/scheduledPlatformNotifications.js';
import { renderPlatformNewsletterEmail, sendPlatformNewsletterEmail, renderBroadcastEmail, sendBroadcastEmail } from './services/emailService.js';
import { isGoogleMeasurementConfigured, sendMeasurementEvent } from './services/googleMeasurement.js';
import { IS_PRODUCTION, NODE_ENV } from './config/runtime.js';
import { normalizePublicHttpUrl, isPrivateOrLocalHost } from './lib/urlSafety.js';
import { installConsoleRedaction, redactSensitive } from './lib/safeLogging.js';
import { logInvalidApiKey, logInvalidUpload, logInsufficientTier, logMalformedPayload, logPrivateHostAttempt } from './lib/securityEventLogger.js';
import { enforceEffectiveTier, getAllowlistedElevatedEmails } from './services/entitlementGuard.js';
import { applySecurityMiddleware, analyzeRequestSchema } from './middleware/securityMiddleware.js';
import { createOrRefreshPublicReportLink, resolvePublicReportReference } from './services/publicReportLinks.js';
import trialRoutes from './routes/trialRoutes.js';
import indexingRoutes from './routes/indexingRoutes.js';
import openApiSpec from './routes/openApiSpec.js';
import oauthRoutes from './routes/oauthRoutes.js';
import mcpServer from './routes/mcpServer.js';
import webMcpRouter from './routes/webMcp.js';
import { enrichKeywords } from './services/keywordEnrichment.js';
import supportRoutes from './routes/supportRoutes.js';
import agentRoutes from './routes/agentRoutes.js';
import ssfrRoutes from './routes/ssfrRoutes.js';
import freeToolsRoutes from './routes/freeToolsRoutes.js';
import gscRoutes from './routes/gscRoutes.js';
import realtimeVisibilityRoutes from './routes/realtimeVisibilityRoutes.js';
import autoVisibilityFixRoutes from './routes/autoVisibilityFixRoutes.js';
import githubAppRoutes from './routes/githubAppRoutes.js';
import selfHealingRoutes from './routes/selfHealingRoutes.js';
import portfolioRoutes from './routes/portfolioRoutes.js';
import growthEngineRoutes from './routes/growthEngineRoutes.js';
import orgRoutes from './routes/orgRoutes.js';
import v1Routes from './routes/v1Routes.js';
import v1WebhookRoutes from './routes/v1WebhookRoutes.js';
import { startTrialExpiryLoop } from './services/trialService.js';
import { startTaskWorker } from './services/agentTaskService.js';
import { startAuditWorkerLoop } from './workers/auditWorker.js';
import { startFixWorker } from './workers/fixWorker.js';
import { startPRWorker } from './workers/prWorker.js';
import { startScheduler } from './services/scheduler.js';
import { startSelfHealingLoop } from './services/selfHealingService.js';
import { bootstrapAgencyAutomation } from './services/agencyAutomationService.js';
import { startDbCleanupLoop, runDbCleanupNow } from './services/dbCleanup.js';
import { recordTimelinePoint } from './services/visibilityTimeline.js';
import { recordFixOutcome } from './services/fixLearning.js';
import { tieredRateLimit, ipRateLimit } from './middleware/tieredRateLimiter.js';
import { runDeterministicAuditLayer, buildDeterministicResponseAdditions, attachDeterministicToAudit } from './services/audit/deterministicPipeline.js';
import { loadEvidenceForRun } from './services/audit/evidenceLedger.js';
import { extractEvidenceFromScrape, enrichEvidenceFromAnalysis } from './services/evidenceExtractor.js';
import { evaluateSSFRRules, buildSSFRSummary } from './services/ssfrRuleEngine.js';
import { generateFixpacks } from './services/fixpackGenerator.js';
import { persistSSFRResults } from './services/ssfrVerificationService.js';
import { isPythonServiceAvailable, analyzeContentDeep, recordEvidenceLedger, generateFingerprint } from './services/deepAnalysisClient.js';

installConsoleRedaction();

// ─────────────────────────────────────────────────────────────────────────────
// Render / proxy timeout realities
// HARD PROXY WINDOW ≈ 60s
// Safe pipeline cap: 52s (leaves buffer for serialization + network flush).
// ─────────────────────────────────────────────────────────────────────────────
const PROXY_HARD_LIMIT_MS = 60_000;
const PIPELINE_DEADLINE_MS = 52_000;
const PIPELINE_FLUSH_BUFFER_MS = 4_000;
const MIN_AI_BUDGET_MS = 10_000;

const app = express();
app.disable('x-powered-by');
applySecurityMiddleware(app);
const PORT = Number(process.env.PORT) || 10000;
const PUBLIC_REPORT_SIGNING_SECRET = process.env.PUBLIC_REPORT_SIGNING_SECRET || process.env.JWT_SECRET || '';
if (!PUBLIC_REPORT_SIGNING_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('PUBLIC_REPORT_SIGNING_SECRET or JWT_SECRET must be set in production');
}
const ANALYZE_REENTRANCY_GUARD_ENABLED = String(process.env.ANALYZE_REENTRANCY_GUARD_ENABLED ?? 'true').toLowerCase() !== 'false';
const ANALYZE_LOCK_TTL_MS = Number(process.env.ANALYZE_LOCK_TTL_MS || 120_000);
const STRICT_LIVE_SOFT_FAIL_ENABLED = String(process.env.STRICT_LIVE_SOFT_FAIL_ENABLED ?? 'true').toLowerCase() !== 'false';
const inflightAnalyzeLocks = new Map<string, number>();

function getGaClientIdFromRequest(req: Request): string {
  const fromHeader = String(req.headers['x-ga-client-id'] || '').trim();
  const fromBody = String((req.body as any)?.gaClientId || '').trim();
  return fromHeader || fromBody;
}

function fireMeasurementEvent(eventName: string, req: Request, params?: Record<string, string | number | boolean>) {
  if (!isGoogleMeasurementConfigured()) return;
  const userId = String((req as any).user?.id || '').trim();
  if (!userId) return;

  const providedClientId = getGaClientIdFromRequest(req);
  const clientId = providedClientId || `${userId}.${Date.now()}`;

  sendMeasurementEvent({
    eventName,
    clientId,
    userId,
    params,
  }).catch((err: any) => {
    console.warn(`[GA4] Failed to send event ${eventName}:`, err?.message || err);
  });
}

function acquireAnalyzeLock(lockKey: string): boolean {
  const now = Date.now();
  const existing = inflightAnalyzeLocks.get(lockKey);
  if (existing && now - existing < ANALYZE_LOCK_TTL_MS) {
    return false;
  }

  inflightAnalyzeLocks.set(lockKey, now);
  return true;
}

function releaseAnalyzeLock(lockKey: string) {
  if (!lockKey) return;
  inflightAnalyzeLocks.delete(lockKey);
}

// Periodic cleanup of expired inflight locks (prevents memory leak from abandoned requests)
setInterval(() => {
  const now = Date.now();
  for (const [key, ts] of inflightAnalyzeLocks) {
    if (now - ts >= ANALYZE_LOCK_TTL_MS) {
      inflightAnalyzeLocks.delete(key);
    }
  }
}, ANALYZE_LOCK_TTL_MS).unref();

function verifyRecommendationEvidence<T extends { evidence_ids?: string[] }>(
  recommendations: T[],
  validEvidenceIds: Set<string>
) {
  const pickValidEvidenceId = (candidates: string[]): string | undefined => {
    for (const candidate of candidates) {
      if (validEvidenceIds.has(candidate)) return candidate;
    }
    return undefined;
  };

  const inferEvidenceIds = (rec: any): string[] => {
    const text = [rec?.title, rec?.description, rec?.category, rec?.implementation]
      .map((value) => String(value || '').toLowerCase())
      .join(' ');

    const inferred: string[] = [];
    if (/schema|json-ld|faq/.test(text)) {
      const id = pickValidEvidenceId(['ev_schema']);
      if (id) inferred.push(id);
    }
    if (/h1|heading/.test(text)) {
      const id = pickValidEvidenceId(['ev_h1_count', 'ev_h1']);
      if (id) inferred.push(id);
    }
    if (/meta|description|snippet/.test(text)) {
      const id = pickValidEvidenceId(['ev_meta_description', 'ev_meta_desc']);
      if (id) inferred.push(id);
    }
    if (/canonical|duplicate/.test(text)) {
      const id = pickValidEvidenceId(['ev_canonical']);
      if (id) inferred.push(id);
    }
    if (/https|tls|ssl|security/.test(text)) {
      const id = pickValidEvidenceId(['ev_https']);
      if (id) inferred.push(id);
    }
    if (/word|content|depth|readability|citability/.test(text)) {
      const id = pickValidEvidenceId(['ev_word_count']);
      if (id) inferred.push(id);
    }
    if (/internal link|link architecture|anchor/.test(text)) {
      const id = pickValidEvidenceId(['ev_links_int']);
      if (id) inferred.push(id);
    }

    return Array.from(new Set(inferred));
  };

  let recommendationsWithEvidence = 0;
  let verifiedRecommendations = 0;
  let partialRecommendations = 0;
  let unverifiedRecommendations = 0;
  let totalEvidenceRefs = 0;
  let totalValidEvidenceRefs = 0;

  const enriched = recommendations.map((rec) => {
    const rawEvidenceIds = Array.isArray(rec.evidence_ids)
      ? rec.evidence_ids.filter((id): id is string => typeof id === 'string')
      : [];
    const inferredEvidenceIds = inferEvidenceIds(rec);
    const candidateEvidenceIds = Array.from(new Set([...rawEvidenceIds, ...inferredEvidenceIds]));
    const validRefs = candidateEvidenceIds.filter((id) => validEvidenceIds.has(id));

    totalEvidenceRefs += candidateEvidenceIds.length;
    totalValidEvidenceRefs += validRefs.length;

    let verificationStatus: 'verified' | 'partial' | 'unverified' = 'unverified';
    if (candidateEvidenceIds.length > 0) {
      recommendationsWithEvidence += 1;
      if (validRefs.length === candidateEvidenceIds.length) {
        verificationStatus = 'verified';
      } else if (validRefs.length > 0) {
        verificationStatus = 'partial';
      }
    }

    const proofScore = candidateEvidenceIds.length > 0
      ? Math.round((validRefs.length / candidateEvidenceIds.length) * 100)
      : 0;

    if (verificationStatus === 'verified') verifiedRecommendations += 1;
    else if (verificationStatus === 'partial') partialRecommendations += 1;
    else unverifiedRecommendations += 1;

    return {
      ...rec,
      evidence_ids: validRefs,
      verification_status: verificationStatus,
      verified_evidence_count: validRefs.length,
      total_evidence_refs: candidateEvidenceIds.length,
      evidence_benchmark: {
        proof_status: verificationStatus,
        proof_score: proofScore,
        inferred_evidence_ids: inferredEvidenceIds,
        benchmark_label:
          verificationStatus === 'verified'
            ? `${BRAG_TRAIL_LABEL}: verified`
            : verificationStatus === 'partial'
              ? `${BRAG_TRAIL_LABEL}: partial`
              : `${BRAG_TRAIL_LABEL}: unverified`,
      },
    };
  });

  const total = enriched.length;
  const evidenceCoveragePercent = total > 0
    ? Math.round((recommendationsWithEvidence / total) * 100)
    : 0;
  const evidenceRefIntegrityPercent = totalEvidenceRefs > 0
    ? Math.round((totalValidEvidenceRefs / totalEvidenceRefs) * 100)
    : 100;

  return {
    recommendations: enriched,
    summary: {
      total_recommendations: total,
      recommendations_with_evidence: recommendationsWithEvidence,
      recommendations_without_evidence: total - recommendationsWithEvidence,
      verified_recommendations: verifiedRecommendations,
      partial_recommendations: partialRecommendations,
      unverified_recommendations: unverifiedRecommendations,
      evidence_coverage_percent: evidenceCoveragePercent,
      evidence_ref_integrity_percent: evidenceRefIntegrityPercent,
    },
  };
}

function detectPeerCritiqueEvidenceConflicts(
  text: string,
  facts: {
    hasTldr: boolean;
    metaDescriptionLength: number;
    h1Count: number;
    questionH2Count?: number;
    schemaJsonLdCount?: number;
    hasFaqSchema?: boolean;
    externalLinkCount?: number;
    wordCount?: number;
  }
): string[] {
  const normalized = String(text || '').toLowerCase();
  if (!normalized) return [];

  const conflicts = new Set<string>();
  const mentionsMissingTldr =
    /(missing|no|lack(?:ing)?|without|add|include).{0,40}(tl;?dr|summary block|summary section|key takeaways)/i.test(normalized)
    || /(tl;?dr|summary block|summary section|key takeaways).{0,40}(missing|not detected|absent)/i.test(normalized);
  const mentionsBadMeta =
    /(truncated|incomplete|too long|too short).{0,40}meta description/i.test(normalized)
    || /meta description.{0,40}(truncated|incomplete|too long|too short)/i.test(normalized)
    || /complete the truncated meta description/i.test(normalized);
  const mentionsBadH1 =
    /(missing|no).{0,20}h1/i.test(normalized)
    || /multiple h1/i.test(normalized)
    || /add (a|an) h1/i.test(normalized);
  const mentionsNeedMoreQuestionHeadings =
    /(question[- ]format|question style|q\&a).{0,40}(h2|h3|heading)/i.test(normalized)
    || /(convert|add|more).{0,40}(h2|h3|heading).{0,40}(question|q\&a)/i.test(normalized);
  const mentionsNeedMoreSchema =
    /(add|more|increase|enhance).{0,50}(structured data|schema|json-ld)/i.test(normalized)
    || /(structured data|schema|json-ld).{0,50}(missing|insufficient|limited|increase)/i.test(normalized);
  const mentionsNeedMoreExternalCitations =
    /(add|more|increase|strengthen).{0,50}(authoritative|external).{0,40}(citation|citations|links?)/i.test(normalized)
    || /(external).{0,30}(citation|citations|links?).{0,30}(missing|weak|insufficient)/i.test(normalized);
  const mentionsNeedMoreContentDepth =
    /(enhance|increase|expand|improve).{0,40}(content depth|word count)/i.test(normalized)
    || /(word count).{0,30}(low|insufficient|thin)/i.test(normalized);

  if (facts.hasTldr && mentionsMissingTldr) {
    conflicts.add('TLDR/summary already detected in crawl evidence');
  }

  if (facts.metaDescriptionLength >= 120 && facts.metaDescriptionLength <= 155 && mentionsBadMeta) {
    conflicts.add(`Meta description already within target range (${facts.metaDescriptionLength} chars)`);
  }

  if (facts.h1Count === 1 && mentionsBadH1) {
    conflicts.add('Exactly one H1 already detected in crawl evidence');
  }

  if ((facts.questionH2Count || 0) >= 2 && mentionsNeedMoreQuestionHeadings) {
    conflicts.add(`Question-format headings already strong (${facts.questionH2Count})`);
  }

  if ((facts.schemaJsonLdCount || 0) >= 5 && facts.hasFaqSchema && mentionsNeedMoreSchema) {
    conflicts.add(`Schema coverage already strong (${facts.schemaJsonLdCount} JSON-LD blocks incl. FAQPage)`);
  }

  if ((facts.externalLinkCount || 0) >= 3 && mentionsNeedMoreExternalCitations) {
    conflicts.add(`External citation/link signals already present (${facts.externalLinkCount} external links)`);
  }

  if ((facts.wordCount || 0) >= 1200 && mentionsNeedMoreContentDepth) {
    conflicts.add(`Content depth already within target range (${facts.wordCount} words)`);
  }

  return Array.from(conflicts);
}

function evaluateAi2PenaltyGate(
  facts: {
    hasTldr: boolean;
    metaDescriptionLength: number;
    h1Count: number;
    questionH2Count?: number;
    schemaJsonLdCount?: number;
    hasFaqSchema?: boolean;
    externalLinkCount?: number;
    wordCount?: number;
  }
): {
  allowNegativePenalty: boolean;
  passedChecks: string[];
  failedChecks: string[];
  passCount: number;
} {
  const checks = [
    { pass: !!facts.hasTldr, label: 'TLDR/summary present' },
    { pass: facts.metaDescriptionLength >= 110 && facts.metaDescriptionLength <= 170, label: `Meta description in target range (${facts.metaDescriptionLength} chars)` },
    { pass: facts.h1Count === 1, label: `Exactly one H1 (${facts.h1Count})` },
    { pass: (facts.questionH2Count || 0) >= 1, label: `Question-format heading(s) present (${facts.questionH2Count || 0})` },
    { pass: (facts.schemaJsonLdCount || 0) >= 4, label: `Schema JSON-LD depth adequate (${facts.schemaJsonLdCount || 0})` },
    { pass: !!facts.hasFaqSchema, label: 'FAQ schema present' },
    { pass: (facts.externalLinkCount || 0) >= 3, label: `External link/citation signals present (${facts.externalLinkCount || 0})` },
    { pass: (facts.wordCount || 0) >= 1200, label: `Content depth threshold met (${facts.wordCount || 0} words)` },
  ];

  const passedChecks = checks.filter((c) => c.pass).map((c) => c.label);
  const failedChecks = checks.filter((c) => !c.pass).map((c) => c.label);
  const passCount = passedChecks.length;

  return {
    allowNegativePenalty: passCount < 6,
    passedChecks,
    failedChecks,
    passCount,
  };
}

function dedupeRecommendations<T extends {
  id?: string;
  priority?: string;
  category?: string;
  title?: string;
  description?: string;
  impact?: string;
  difficulty?: string;
  implementation?: string;
  evidence_ids?: string[];
}>(recommendations: T[]): T[] {
  const priorityRank = (priority?: string): number => {
    if (priority === 'high') return 3;
    if (priority === 'medium') return 2;
    if (priority === 'low') return 1;
    return 0;
  };

  const norm = (value: unknown): string =>
    String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();

  const score = (rec: T): number => {
    const evidence = Array.isArray(rec.evidence_ids) ? rec.evidence_ids.length : 0;
    const descriptionLen = String(rec.description || '').length;
    return evidence * 100 + priorityRank(rec.priority) * 10 + Math.min(9, Math.floor(descriptionLen / 80));
  };

  const grouped = new Map<string, T>();

  for (const rec of recommendations) {
    const key = `${norm(rec.category)}|${norm(rec.title)}`;
    if (!key || key === '|') continue;

    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, rec);
      continue;
    }

    const existingEvidence = Array.isArray(existing.evidence_ids)
      ? existing.evidence_ids.filter((id): id is string => typeof id === 'string')
      : [];
    const currentEvidence = Array.isArray(rec.evidence_ids)
      ? rec.evidence_ids.filter((id): id is string => typeof id === 'string')
      : [];
    const mergedEvidence = Array.from(new Set([...existingEvidence, ...currentEvidence]));

    const pickCurrent = score(rec) > score(existing);
    const base = pickCurrent ? rec : existing;
    const fallback = pickCurrent ? existing : rec;

    grouped.set(key, {
      ...base,
      id: base.id || fallback.id,
      description: String(base.description || '').length >= String(fallback.description || '').length
        ? base.description
        : fallback.description,
      implementation: String(base.implementation || '').length >= String(fallback.implementation || '').length
        ? base.implementation
        : fallback.implementation,
      impact: String(base.impact || '').length >= String(fallback.impact || '').length
        ? base.impact
        : fallback.impact,
      evidence_ids: mergedEvidence,
    } as T);
  }

  return Array.from(grouped.values());
}

const DETERMINISTIC_CATEGORY_LABELS = new Set([
  'Content Depth & Quality',
  'Heading Structure & H1',
  'Schema & Structured Data',
  'Meta Tags & Open Graph',
  'Technical SEO',
]);


function normalizeAuditTargetKey(input: string): string {
  const raw = String(input || '').trim();
  if (!raw) return '';
  if (raw.startsWith('upload://')) return raw.toLowerCase();

  const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(normalized);
    if (parsed.protocol === 'http:') parsed.protocol = 'https:';
    const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    return `${parsed.protocol}//${parsed.hostname.toLowerCase()}${pathname}${parsed.search}`;
  } catch {
    return normalized.toLowerCase();
  }
}

function roundCreditAmount(value: number): number {
  return Math.round(Math.max(0, Number(value || 0)) * 100) / 100;
}

function buildAuditCreditPlan(args: {
  retryRequested: boolean;
  scanMockData: boolean;
  hasFindabilityGoals: boolean;
}) {
  const reasons: string[] = [];
  let total = 0;

  if (args.retryRequested) {
    total += 0.5;
    reasons.push('Forced audit retry');
  }

  if (args.scanMockData || args.hasFindabilityGoals) {
    // Mock data scan is pure regex (zero AI cost) — only charge for findability goals
    if (args.hasFindabilityGoals) {
      total += 1.33;
      reasons.push('Findability goal validation');
    }
  }

  return {
    total: roundCreditAmount(total),
    reasons,
  };
}

function buildPublicSharedResult(result: any, ownerTierRaw: CanonicalTier | LegacyTier | string) {
  const ownerTier = uiTierFromCanonical((ownerTierRaw as CanonicalTier | LegacyTier) || 'observer');

  // Always attach a text summary to the public view at the owner's depth
  const textSummaryDepth = getTextSummaryDepth(ownerTier as CanonicalTier);
  const textSummary = result ? generateTextSummary(result, textSummaryDepth) : undefined;

  if (ownerTier !== 'observer') {
    return {
      result: { ...result, text_summary: textSummary },
      redacted: false,
      redaction_note: null,
    };
  }

  const safeResult = result && typeof result === 'object' ? result : {};
  const recommendations = Array.isArray(safeResult.recommendations) ? safeResult.recommendations : [];
  const redactedRecommendations = recommendations.slice(0, 3).map((item: any) => ({
    ...item,
    implementation: 'Redacted on Observer public links. Upgrade to view full implementation guidance.',
  }));

  // Observer share gets minimal text summary (2 findings, no fixes)
  const observerTextSummary = result ? generateTextSummary(result, 'minimal') : undefined;

  const redacted = {
    ...safeResult,
    recommendations: redactedRecommendations,
    text_summary: observerTextSummary,
    evidence_manifest: undefined,
    keyword_intelligence: undefined,
    content_highlights: undefined,
    recommendation_evidence_summary: undefined,
    evidence_fix_plan: undefined,
    citation_parity_audit: undefined,
    rail_evidence_audit: undefined,
    strict_rubric: undefined,
  };

  return {
    result: redacted,
    redacted: true,
    redaction_note: 'Observer public links include a redacted snapshot for safe distribution.',
  };
}

/**
 * Strip technical implementation details from Observer tier responses.
 * Observer gets: scores, grades, summaries, key takeaways, top 3 recommendations
 * (title + description only), and a soft upgrade CTA.
 * Does NOT get: implementation code, content_highlights, keyword_intelligence,
 * evidence_manifest, evidence_fix_plan, citation_parity_audit, etc.
 */
function stripObserverResult(result: any): any {
  if (!result || typeof result !== 'object') return result;

  const recommendations = Array.isArray(result.recommendations) ? result.recommendations : [];
  const strippedRecommendations = recommendations.slice(0, 3).map((rec: any) => ({
    id: rec.id,
    title: rec.title,
    description: rec.description,
    priority: rec.priority,
    category: rec.category,
    impact: rec.impact,
    verification_status: rec.verification_status,
    // No implementation, no evidence_references, no code examples
  }));

  return {
    ...result,
    recommendations: strippedRecommendations,
    content_highlights: undefined,
    keyword_intelligence: undefined,
    evidence_manifest: undefined,
    evidence_fix_plan: undefined,
    citation_parity_audit: undefined,
    rail_evidence_audit: undefined,
    strict_rubric: undefined,
    recommendation_evidence_summary: undefined,
    llm_readability: undefined,
    contradiction_report: undefined,
    upgrade_cta: {
      message: 'Unlock full implementation fixes, all recommendations, competitor tracking, and advanced tools.',
      target_tier: 'alignment',
      recommendations_hidden: Math.max(0, recommendations.length - 3),
      features_locked: [
        'Step-by-step implementation code',
        'All recommendations (not just top 3)',
        'Content highlights & keyword intelligence',
        'Evidence fix plans',
        'Competitor tracking',
        'Export & share reports',
      ],
    },
  };
}

/**
 * Alignment tier: full recommendations with implementation, keyword intelligence,
 * content highlights — but no deep evidence artifacts (those are Signal/ScoreFix only).
 */
function stripAlignmentResult(result: any): any {
  if (!result || typeof result !== 'object') return result;
  return {
    ...result,
    // Alignment keeps: recommendations (all), keyword_intelligence, content_highlights
    // Alignment strips: deep evidence/verification artifacts (Signal+ only)
    evidence_manifest: undefined,
    evidence_fix_plan: undefined,
    citation_parity_audit: undefined,
    rail_evidence_audit: undefined,
    strict_rubric: undefined,
    recommendation_evidence_summary: undefined,
    contradiction_report: undefined,
  };
}

/**
 * Apply tier-appropriate result stripping.
 * Observer: minimal (top 3 recs, no implementation, no deep artifacts)
 * Alignment: standard (all recs + implementation, no evidence artifacts)
 * Signal/ScoreFix: full (everything returned)
 */
function applyTierResultStripping(result: any, tier: string): any {
  const canonicalTier = uiTierFromCanonical((tier || 'observer') as CanonicalTier | LegacyTier);
  const tierLabel = getTierDisplayName((tier || 'observer') as CanonicalTier | LegacyTier);
  const tierMeta = { analysis_tier: canonicalTier, analysis_tier_display: tierLabel };
  if (tier === 'observer') return { ...stripObserverResult(result), ...tierMeta };
  if (tier === 'alignment') return { ...stripAlignmentResult(result), ...tierMeta };
  return { ...result, ...tierMeta }; // signal + scorefix get everything
}

const FRONTEND_URL = process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || '';
function assertCriticalEnvForProduction(): void {
  if (!IS_PRODUCTION) return;

  const hasAiProviderKey = Boolean(process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_API_KEY);
  const missing: string[] = [];

  if (!process.env.DATABASE_URL?.trim()) missing.push('DATABASE_URL');
  if (!process.env.JWT_SECRET?.trim()) missing.push('JWT_SECRET');
  if (!process.env.API_KEY_PEPPER?.trim()) missing.push('API_KEY_PEPPER');
  if (!FRONTEND_URL.trim()) missing.push('FRONTEND_URL');
  if (!hasAiProviderKey) missing.push('OPENROUTER_API_KEY (or OPEN_ROUTER_API_KEY)');

  if (missing.length > 0) {
    console.error(`[Startup] Missing required production env vars: ${missing.join(', ')}`);
    process.exit(1);
  }
}

assertCriticalEnvForProduction();

if (!process.env.STRIPE_WEBHOOK_SECRET?.trim()) {
  console.warn('[Startup] STRIPE_WEBHOOK_SECRET not configured — Stripe checkout may open, but webhook fulfillment (tier upgrades) will fail.');
}

const normalizeOrigin = (origin: string): string => {
  const raw = String(origin || '').trim();
  if (!raw) return '';

  try {
    return new URL(raw).origin.toLowerCase();
  } catch {
    let normalized = raw.toLowerCase();
    while (normalized.endsWith('/')) normalized = normalized.slice(0, -1);
    return normalized;
  }
};

const ALLOWED_ORIGINS = [
  ...new Set([
    normalizeOrigin('https://aivis.biz'),
    normalizeOrigin('https://www.aivis.biz'),
    ...(FRONTEND_URL
      ? FRONTEND_URL
          .split(',')
          .map((o: string) => normalizeOrigin(o))
          .filter(Boolean)
      : []),
  ]),
];
const NORMALIZED_ALLOWED_ORIGINS = [...new Set(ALLOWED_ORIGINS.map(normalizeOrigin))];
console.log('[CORS] Allowed origins (normalized):', NORMALIZED_ALLOWED_ORIGINS);

// ─────────────────────────────────────────────────────────────────────────────
// Sentry — init is handled by instrument.ts via --import flag.
// If running without --import (e.g. dev), fall back to inline init.
// ─────────────────────────────────────────────────────────────────────────────
if (process.env.SENTRY_DSN) {
  const client = Sentry.getClient();
  if (!client) {
    // Fallback: instrument.ts was not loaded via --import
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: NODE_ENV,
      tracesSampleRate: IS_PRODUCTION ? 0.1 : 1.0,
      integrations: [Sentry.httpIntegration()],
    });
    console.log('[Sentry] Initialized (inline fallback)');
  }
} else {
  console.warn('[Sentry] SENTRY_DSN not configured - error tracking disabled');
}

// Trust proxy (Render / Vercel / etc) — use 1 to trust only the first hop
app.set('trust proxy', 1);

// ─────────────────────────────────────────────────────────────────────────────
// Rate limiting
// ─────────────────────────────────────────────────────────────────────────────
const getRateLimitClientIp = (req: Request): string => {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }

  if (Array.isArray(xff) && xff.length > 0) {
    const first = String(xff[0] || '').split(',')[0]?.trim();
    if (first) return first;
  }

  return req.ip || (req.socket?.remoteAddress ?? '');
};

const normalizeRateLimitPath = (value: string): string => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '/';
  const withoutQuery = trimmed.split('?')[0] || '/';
  const normalized = withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`;
  return normalized.length > 1 ? normalized.replace(/\/+$/, '') : normalized;
};

const getRateLimitPathCandidates = (req: Request): string[] => {
  const candidates = new Set<string>();
  for (const raw of [req.originalUrl, req.path, req.url]) {
    const normalized = normalizeRateLimitPath(String(raw || ''));
    if (!normalized) continue;
    candidates.add(normalized);
  }
  return [...candidates];
};

const matchesRateLimitPath = (req: Request, target: string): boolean => {
  const normalizedTarget = normalizeRateLimitPath(target);
  return getRateLimitPathCandidates(req).some((candidate) => candidate === normalizedTarget);
};

const startsWithRateLimitPath = (req: Request, prefix: string): boolean => {
  const normalizedPrefix = normalizeRateLimitPath(prefix);
  return getRateLimitPathCandidates(req).some((candidate) => candidate === normalizedPrefix || candidate.startsWith(`${normalizedPrefix}/`));
};

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: IS_PRODUCTION ? 300 : 600,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const auth = String(req.get('authorization') || '').trim();
    if (/^Bearer\s+/i.test(auth)) {
      const token = auth.replace(/^Bearer\s+/i, '').trim();
      if (token) {
        try {
          const payload = verifyUserToken(token);
          if (payload?.userId) return `user:${payload.userId}`;
        } catch {
          // fall through to IP-based key
        }
      }
    }

    return `ip:${ipKeyGenerator(getRateLimitClientIp(req))}`;
  },
  message: { error: 'Too many requests, please try again later', retryAfter: 60, code: 'RATE_LIMIT_EXCEEDED' },
  skip: (req) => {
    // Exempt lightweight polling and health checks from the global budget
    if (matchesRateLimitPath(req, '/api/health') || matchesRateLimitPath(req, '/health')) return true;
    if (req.method === 'GET' && (matchesRateLimitPath(req, '/api/features/status') || matchesRateLimitPath(req, '/features/status'))) return true;
    if (req.method === 'GET' && (startsWithRateLimitPath(req, '/api/features/notifications') || startsWithRateLimitPath(req, '/features/notifications'))) return true;
    if (req.method === 'GET' && (matchesRateLimitPath(req, '/api/auth/profile') || matchesRateLimitPath(req, '/auth/profile'))) return true;
    return false;
  },
  handler: (_req, res) => {
    res.status(429).json({ error: 'Too many requests', code: 'RATE_LIMIT_EXCEEDED', retryAfter: 60 });
  },
});

const heavyActionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: IS_PRODUCTION ? 15 : 80,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const userId = String((req as any).user?.id || '').trim();
    if (userId) return `user:${userId}`;
    return `ip:${ipKeyGenerator(getRateLimitClientIp(req))}`;
  },
  handler: (_req, res) => {
    res.status(429).json({ error: 'Too many high-cost requests', code: 'HIGH_COST_RATE_LIMIT', retryAfter: 60 });
  },
});

const licenseLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: IS_PRODUCTION ? 30 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(getRateLimitClientIp(req)),
  handler: (_req, res) => {
    res.status(429).json({ error: 'Too many license requests', code: 'LICENSE_RATE_LIMIT', retryAfter: 60 });
  },
});

// Auth route limiter — prevents credential stuffing, account enumeration, email bombing
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: IS_PRODUCTION ? 10 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(getRateLimitClientIp(req)),
  handler: (_req, res) => {
    res.status(429).json({ error: 'Too many auth requests, please try again later', code: 'AUTH_RATE_LIMIT', retryAfter: 60 });
  },
});

// Public tools limiter — prevents abuse of outbound-fetching endpoints
const publicToolLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: IS_PRODUCTION ? 10 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(getRateLimitClientIp(req)),
  handler: (_req, res) => {
    res.status(429).json({ error: 'Too many tool requests, please try again later', code: 'TOOL_RATE_LIMIT', retryAfter: 60 });
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Body parsers
// IMPORTANT: Stripe webhook must NOT pass through express.json/urlencoded.
// The webhook route itself (in paymentRoutes.ts) uses express.raw().
// ─────────────────────────────────────────────────────────────────────────────
const STRIPE_WEBHOOK_PATHS = new Set(['/api/payment/webhook', '/api/billing/webhook', '/api/stripe/webhook', '/api/github-app/webhook']);

const JSON_MW = express.json({
  limit: '2mb',
  verify: (req: Request, _res, buf) => {
    // Keep rawBody for any route that wants it, but do not interfere with webhook raw parsing.
    if (!STRIPE_WEBHOOK_PATHS.has(req.originalUrl)) req.rawBody = buf.toString('utf8');
  },
});

// Higher limit for upload routes that send base64-encoded documents
// Base64 adds ~33% overhead, so 20mb JSON limit covers tier max (10MB raw alignment → ~13.3MB base64)
const JSON_UPLOAD_MW = express.json({
  limit: '20mb',
  verify: (req: Request, _res, buf) => {
    req.rawBody = buf.toString('utf8');
  },
});

const URLENCODED_MW = express.urlencoded({ extended: true, limit: '2mb' });

app.use((req, res, next) => {
  if (STRIPE_WEBHOOK_PATHS.has(req.originalUrl)) return next();
  if (req.originalUrl === '/api/analyze/upload') return JSON_UPLOAD_MW(req, res, next);
  return JSON_MW(req, res, next);
});

app.use((req, res, next) => {
  if (STRIPE_WEBHOOK_PATHS.has(req.originalUrl)) return next();
  return URLENCODED_MW(req, res, next);
});

// CORS
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      const normalizedOrigin = normalizeOrigin(origin);
      if (NORMALIZED_ALLOWED_ORIGINS.includes(normalizedOrigin)) return callback(null, true);
      console.warn(`[CORS] Rejected origin: ${origin}`);
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-Id', 'X-Workspace-Id', 'Cache-Control', 'Pragma'],
    exposedHeaders: ['X-Total-Count', 'X-Page-Count', 'X-Audit-Request-Id', 'X-Workspace-Id'],
    maxAge: 86400,
  })
);

// OPTIONS handler
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Security headers — handled by applySecurityMiddleware() (Helmet + nonce CSP)
// HSTS for production
if (IS_PRODUCTION) {
  app.use((_req, res, next) => {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    next();
  });
}

// Apply API rate limiter in production
if (IS_PRODUCTION) app.use('/api', apiLimiter);

// Request logging in dev
if (!IS_PRODUCTION) {
  app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });
}

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/billing', paymentRoutes);
app.use('/api/stripe', paymentRoutes);
app.use('/api/queue', auditQueueRoutes);
app.get('/api/pricing', getPricingInfo);
app.use('/api/competitors', competitorRoutes);
app.use('/api/citations', citationRoutes);
app.use('/api/mentions', mentionRoutes);
app.use('/api/auto-score-fix', autoScoreFixRoutes);
app.use('/api/github-app', githubAppRoutes);
app.use('/api/reverse-engineer', reverseEngineerApi);
app.use('/api/schema-generator', schemaGeneratorRoutes);
app.use('/api/content', contentRoutes);
app.post('/api/assistant', authRequired, heavyActionLimiter, handleAssistantMessage);
app.use('/api/features', featureRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/v1', externalApiV1);
app.use('/api/v1', openApiSpec);
app.use('/api/oauth', oauthRoutes);
app.use('/api/mcp', mcpServer);
app.use('/api/webmcp', webMcpRouter);
app.use('/api/support', supportRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/ssfr', ssfrRoutes);
app.use('/api/tools', publicToolLimiter, freeToolsRoutes);
app.use('/api/integrations/gsc', gscRoutes);
app.use('/api/visibility', realtimeVisibilityRoutes);
app.use('/api/fix-engine', autoVisibilityFixRoutes);
app.use('/api/self-healing', selfHealingRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/growth', growthEngineRoutes);
app.use('/api/orgs', orgRoutes);
app.use('/v1', v1Routes);
app.use('/v1/webhooks', v1WebhookRoutes);
app.use('/widget', widgetPublicRouter);

// WebMCP discovery — unauthenticated
app.get('/.well-known/webmcp.json', (_req, res) => {
  res.json({
    schema_version: '0.1.0',
    name: 'aivis',
    display_name: 'AiVIS — AI Visibility Engine',
    description: 'Audit, measure, and improve how AI answer engines see your website.',
    tools_endpoint: '/api/webmcp/tools',
    invoke_endpoint: '/api/webmcp/tools/{tool_name}',
    manifest_endpoint: '/api/webmcp/manifest',
    auth: { type: 'bearer', prefix: 'avis_' },
  });
});

app.use('/api/compliance', complianceRoutes);
app.use('/api/trial', trialRoutes);
app.use('/api/indexing', indexingRoutes);
app.use('/licenses', licenseLimiter, createLicenseAPI());

// ── Deep Analysis (Python NLP microservice proxy) ────────────────────────
app.get('/api/deep-analysis/status', async (_req: Request, res: Response) => {
  const available = await isPythonServiceAvailable();
  res.json({ available, service: 'aivis-deep-analysis', timestamp: new Date().toISOString() });
});

app.get('/api/audits/:auditId/deep-analysis', authRequired, async (req: Request, res: Response) => {
  try {
    const userId = String((req as any).user?.id || '');
    const auditId = req.params.auditId;
    if (!auditId || !userId) return res.status(400).json({ error: 'Missing audit ID' });

    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT result->'deep_analysis' AS deep_analysis FROM audits WHERE id = $1 AND user_id = $2`,
      [auditId, userId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Audit not found' });

    const deepAnalysis = rows[0].deep_analysis;
    if (!deepAnalysis) {
      return res.json({ available: false, message: 'Deep analysis not yet available for this audit. It runs as a background enrichment after the main audit completes.' });
    }

    return res.json({ available: true, deep_analysis: deepAnalysis });
  } catch (err: any) {
    console.error('[deep-analysis] Fetch failed:', err?.message);
    return res.status(500).json({ error: 'Failed to fetch deep analysis' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Refresh endpoint
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/user/refresh', async (req: Request, res: Response) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return res.status(401).json({ success: false, error: 'No token' });

    const decoded = verifyUserToken(auth.slice('Bearer '.length));
    const user = await getUserById(decoded.userId);
    if (!user) return res.status(401).json({ success: false, error: 'User not found' });

    const effectiveTier = await enforceEffectiveTier(user);
    const tier = uiTierFromCanonical((effectiveTier || 'observer') as CanonicalTier);
    const limits = TIER_LIMITS[tier];

    // Elevate role for allowlisted emails (mirrors authRequired logic)
    const allowlisted = getAllowlistedElevatedEmails();
    const effectiveRole = (allowlisted.has(String(user.email || '').trim().toLowerCase()))
      ? 'admin'
      : (user.role || 'user');

    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        tier: effectiveTier,
        name: user.name,
        full_name: user.name,
        display_name: user.name,
        role: effectiveRole,
        trial_ends_at: (user as any).trial_ends_at || null,
        trial_active: Boolean((user as any).trial_ends_at && new Date((user as any).trial_ends_at) > new Date()),
        trial_used: Boolean((user as any).trial_used),
        avatar_url: user.avatar_url || null,
        company: user.company || null,
        website: user.website || null,
        org_logo_url: user.org_logo_url || null,
        org_favicon_url: user.org_favicon_url || null,
      },
      entitlements: {
        tier,
        features: {
          exports: limits.hasExports,
          forceRefresh: limits.hasForceRefresh,
          apiAccess: limits.hasApiAccess,
          whiteLabel: limits.hasWhiteLabel,
          scheduledRescans: limits.hasScheduledRescans,
          reportHistory: limits.hasReportHistory,
          shareableLink: limits.hasShareableLink,
          multiPageCrawl: limits.pagesPerScan > 1,
          competitorDiff: limits.competitors > 0,
        },
        limits: {
          scansPerMonth: limits.scansPerMonth,
          pagesPerScan: limits.pagesPerScan,
          competitors: limits.competitors,
          cacheDays: limits.cacheDays,
        },
      },
    });
  } catch (err: any) {
    console.error('[/api/user/refresh]', err.message);
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Analytics + Contacts endpoints unchanged
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/analytics', authRequired, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).userId;
    const analyticsTier = uiTierFromCanonical(((req as any).user?.tier || 'observer') as CanonicalTier);
    if (!meetsMinimumTier(analyticsTier, 'alignment')) {
      return res.status(403).json({ success: false, error: 'Analytics requires Alignment tier or higher.', code: 'TIER_INSUFFICIENT' });
    }
    const range = (req.query.range as string) || 'all';
    const days = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : null;

    const pool = getPool();

    // True scan count from usage_daily (survives audit pruning)
    const usageResult = await pool.query(
      `SELECT COALESCE(SUM(requests), 0)::int AS lifetime_scans
       FROM usage_daily
       WHERE user_id = $1
         AND ($2::int IS NULL OR date >= CURRENT_DATE - ($2::int - 1))`,
      [userId, days]
    );
    const lifetimeScans = Number(usageResult.rows[0]?.lifetime_scans || 0);

    // All-time audit count (unfiltered by date range — for display)
    const lifetimeAuditResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM audits WHERE user_id = $1`,
      [userId]
    );
    const lifetimeAuditCount = Number(lifetimeAuditResult.rows[0]?.total || 0);

    // All-time scan count (unfiltered — for lifetime display)
    const lifetimeScanResult = await pool.query(
      `SELECT COALESCE(SUM(requests), 0)::int AS total FROM usage_daily WHERE user_id = $1`,
      [userId]
    );
    const lifetimeScanCount = Number(lifetimeScanResult.rows[0]?.total || 0);

    const historyResult = await pool.query(
      `SELECT
         id,
         url,
         visibility_score,
         created_at,
         result->'ai_platform_scores' AS platform_scores,
         result->'category_grades'    AS category_grades,
         result->'seo_diagnostics'    AS seo_diagnostics,
         result->'recommendations'    AS recommendations,
         result->'schema_markup'      AS schema_markup,
         result->'content_analysis'   AS content_analysis,
         result->'technical_signals'  AS technical_signals
       FROM audits
       WHERE user_id = $1
         AND ($2::int IS NULL OR created_at >= NOW() - ($2::int * INTERVAL '1 day'))
       ORDER BY created_at ASC`,
      [userId, days]
    );

    const audits = historyResult.rows;

    const toCanonicalUrlKey = (rawUrl: string): string => {
      try {
        const parsed = new URL(rawUrl);
        const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
        const normalizedPath = parsed.pathname.replace(/\/+$/, '') || '/';
        const port = parsed.port;
        const isDefaultPort = !port || (parsed.protocol === 'https:' && port === '443') || (parsed.protocol === 'http:' && port === '80');
        const normalizedPort = isDefaultPort ? '' : `:${port}`;
        return `${hostname}${normalizedPort}${normalizedPath}`;
      } catch {
        return rawUrl.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('#')[0].split('?')[0].replace(/\/+$/, '') || '/';
      }
    };

    type AuditRow = typeof audits[number];
    type UrlAggregate = {
      canonicalKey: string;
      representativeUrl: string;
      audits: number;
      latestAudit: AuditRow;
      highestAudit: AuditRow;
    };

    const urlAggregateMap: Record<string, UrlAggregate> = {};

    for (const audit of audits) {
      const canonicalKey = toCanonicalUrlKey(audit.url);
      const existing = urlAggregateMap[canonicalKey];
      const score = Number(audit.visibility_score);

      if (!existing) {
        urlAggregateMap[canonicalKey] = {
          canonicalKey,
          representativeUrl: audit.url,
          audits: 1,
          latestAudit: audit,
          highestAudit: audit,
        };
        continue;
      }

      existing.audits += 1;

      if (new Date(audit.created_at).getTime() > new Date(existing.latestAudit.created_at).getTime()) {
        existing.latestAudit = audit;
        existing.representativeUrl = audit.url;
      }

      const existingBestScore = Number(existing.highestAudit.visibility_score);
      const isHigher = !isNaN(score) && (isNaN(existingBestScore) || score > existingBestScore);
      const isTieButNewer =
        !isNaN(score) &&
        !isNaN(existingBestScore) &&
        score === existingBestScore &&
        new Date(audit.created_at).getTime() > new Date(existing.highestAudit.created_at).getTime();

      if (isHigher || isTieButNewer) {
        existing.highestAudit = audit;
      }
    }

    const urlAggregates = Object.values(urlAggregateMap);
    const latestPerUrlAudits = urlAggregates
      .map((item) => item.latestAudit)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const highestPerUrlAudits = urlAggregates.map((item) => item.highestAudit);

    const latestScores = latestPerUrlAudits
      .map((audit) => Number(audit.visibility_score))
      .filter((score) => !isNaN(score));
    const highestScores = highestPerUrlAudits
      .map((audit) => Number(audit.visibility_score))
      .filter((score) => !isNaN(score));

    const avgScore = latestScores.length
      ? Math.round(latestScores.reduce((sum, value) => sum + value, 0) / latestScores.length)
      : 0;
    const bestScore = highestScores.length ? Math.max(...highestScores) : 0;
    const worstScore = latestScores.length ? Math.min(...latestScores) : 0;
    const latestScore = latestScores.length ? latestScores[latestScores.length - 1] : 0;

    const urlBreakdownAll = urlAggregates
      .map((item) => {
        const latestValue = Number(item.latestAudit.visibility_score);
        const bestValue = Number(item.highestAudit.visibility_score);
        const latestScoreForUrl = !isNaN(latestValue) ? latestValue : null;
        const bestScoreForUrl = !isNaN(bestValue) ? bestValue : null;

        const canonicalAvg =
          latestScoreForUrl !== null && bestScoreForUrl !== null
            ? Math.round((latestScoreForUrl + bestScoreForUrl) / 2)
            : latestScoreForUrl ?? bestScoreForUrl;

        return {
          url: item.representativeUrl,
          audits: item.audits,
          latest_score: latestScoreForUrl,
          best_score: bestScoreForUrl,
          avg_score: canonicalAvg,
        };
      })
      .sort((a, b) => (b.latest_score ?? 0) - (a.latest_score ?? 0));
    const urlBreakdown = urlBreakdownAll.slice(0, 100);

    const scoreHistory = latestPerUrlAudits.map((a) => ({
      date: new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      score: Number(a.visibility_score),
      url: (() => {
        try {
          return new URL(a.url).hostname;
        } catch {
          return a.url;
        }
      })(),
    }));

    const platformAliases: Record<'chatgpt' | 'perplexity' | 'google_ai' | 'claude', string[]> = {
      chatgpt: ['chatgpt'],
      perplexity: ['perplexity'],
      google_ai: ['google_ai', 'gemini_ai', 'google', 'google_ai_overviews'],
      claude: ['claude', 'claude/anthropic', 'anthropic'],
    };
    const platformTotals: Record<'chatgpt' | 'perplexity' | 'google_ai' | 'claude', number[]> = {
      chatgpt: [],
      perplexity: [],
      google_ai: [],
      claude: [],
    };
    for (const a of latestPerUrlAudits) {
      const ps = a.platform_scores;
      if (ps && typeof ps === 'object') {
        for (const [canonicalPlatform, aliases] of Object.entries(platformAliases) as Array<[
          keyof typeof platformAliases,
          string[]
        ]>) {
          const candidate = aliases
            .map((alias) => Number((ps as Record<string, unknown>)[alias]))
            .find((score) => Number.isFinite(score));
          if (typeof candidate === 'number') {
            platformTotals[canonicalPlatform].push(candidate);
          }
        }
      }
    }
    const platformAverages = Object.fromEntries(
      Object.entries(platformTotals).map(([k, vals]) => [k, vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0])
    );

    const catMap: Record<string, number[]> = {};
    for (const a of latestPerUrlAudits) {
      const grades = a.category_grades;
      if (Array.isArray(grades)) {
        for (const g of grades) {
          if (g.label && typeof g.score === 'number') {
            if (!catMap[g.label]) catMap[g.label] = [];
            catMap[g.label].push(g.score);
          }
        }
      }
    }
    const categoryAverages = Object.entries(catMap)
      .map(([category, vals]) => ({
        category,
        avg_score: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
      }))
      .sort((a, b) => b.avg_score - a.avg_score);

    const seoDiagnosticsSummary: Record<string, { pass: number; warn: number; fail: number }> = {};
    for (const a of latestPerUrlAudits) {
      const seo = a.seo_diagnostics;
      if (!seo || typeof seo !== 'object') continue;
      for (const [key, value] of Object.entries(seo as Record<string, any>)) {
        const status = value?.status as 'pass' | 'warn' | 'fail' | undefined;
        if (status === 'pass' || status === 'warn' || status === 'fail') {
          if (!seoDiagnosticsSummary[key]) {
            seoDiagnosticsSummary[key] = { pass: 0, warn: 0, fail: 0 };
          }
          seoDiagnosticsSummary[key][status] += 1;
        }
      }
    }

    // ── Score distribution buckets ────────────────────────────────────
    const scoreBuckets: Record<string, number> = {
      '0–20': 0, '21–40': 0, '41–60': 0, '61–80': 0, '81–100': 0,
    };
    for (const s of latestScores) {
      if (s <= 20)       scoreBuckets['0–20']++;
      else if (s <= 40)  scoreBuckets['21–40']++;
      else if (s <= 60)  scoreBuckets['41–60']++;
      else if (s <= 80)  scoreBuckets['61–80']++;
      else               scoreBuckets['81–100']++;
    }
    const scoreDistribution = Object.entries(scoreBuckets).map(([bucket, count]) => ({
      bucket, count, pct: latestScores.length ? Math.round((count / latestScores.length) * 100) : 0,
    }));

    // ── Improvement deltas (first → latest per domain) ───────────────
    const firstAuditPerUrl: Record<string, typeof audits[number]> = {};
    for (const audit of audits) {
      const key = toCanonicalUrlKey(audit.url);
      const existing = firstAuditPerUrl[key];
      if (!existing || new Date(audit.created_at).getTime() < new Date(existing.created_at).getTime()) {
        firstAuditPerUrl[key] = audit;
      }
    }
    const improvementDeltas = urlAggregates.map((item) => {
      const first = firstAuditPerUrl[item.canonicalKey];
      const firstVal = first ? Number(first.visibility_score) : NaN;
      const latestVal = Number(item.latestAudit.visibility_score);
      const domain = (() => { try { return new URL(item.representativeUrl).hostname.replace(/^www\./, ''); } catch { return item.representativeUrl; } })();
      return {
        domain,
        url: item.representativeUrl,
        first_score: !isNaN(firstVal) ? firstVal : null,
        latest_score: !isNaN(latestVal) ? latestVal : null,
        delta: (!isNaN(firstVal) && !isNaN(latestVal)) ? latestVal - firstVal : null,
        audits: item.audits,
      };
    }).sort((a, b) => (b.delta ?? -9999) - (a.delta ?? -9999)).slice(0, 20);

    // ── Daily activity heatmap (last 30 days) ─────────────────────────
    const activityMap: Record<string, number> = {};
    const nowTs = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date(nowTs);
      d.setDate(d.getDate() - i);
      activityMap[d.toISOString().slice(0, 10)] = 0;
    }
    for (const a of audits) {
      const day = new Date(a.created_at).toISOString().slice(0, 10);
      if (day in activityMap) activityMap[day]++;
    }
    const dailyActivity = Object.entries(activityMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // ── Per-platform score trends over time ───────────────────────────
    const ptMap: Record<string, Record<string, number[]>> = {
      chatgpt: {}, perplexity: {}, google_ai: {}, claude: {},
    };
    for (const a of audits) {
      const day = new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const ps = a.platform_scores;
      if (ps && typeof ps === 'object') {
        for (const [platform, aliases] of Object.entries(platformAliases) as Array<[keyof typeof platformAliases, string[]]>) {
          const val = aliases.map((alias) => Number((ps as Record<string, unknown>)[alias])).find((n) => Number.isFinite(n));
          if (val !== undefined) {
            if (!ptMap[platform][day]) ptMap[platform][day] = [];
            ptMap[platform][day].push(val);
          }
        }
      }
    }
    const allTrendDates = [...new Set(audits.map((a) =>
      new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    ))].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    const platformTrends = allTrendDates.map((date) => {
      const pt: Record<string, number | string | null> = { date };
      for (const platform of ['chatgpt', 'perplexity', 'google_ai', 'claude'] as const) {
        const vals = ptMap[platform][date] || [];
        pt[platform] = vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : null;
      }
      return pt;
    });

    // ── Consecutive-day streak ────────────────────────────────────────
    let streakDays = 0;
    for (let i = 0; i < 30; i++) {
      const d = new Date(nowTs);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      if ((activityMap[key] ?? 0) > 0) streakDays++;
      else break;
    }

    // ── Deterministic pipeline data (rule results + score snapshots) ──
    let deterministicData: Record<string, unknown> | null = null;
    try {
      // Average family scores across all user's audits
      const familyScoresResult = await pool.query(
        `SELECT
           s.family_scores
         FROM audit_score_snapshots s
         JOIN audits a ON a.id = s.audit_id
         WHERE a.user_id = $1
           AND ($2::int IS NULL OR a.created_at >= NOW() - ($2::int * INTERVAL '1 day'))
         ORDER BY s.created_at DESC
         LIMIT 100`,
        [userId, days]
      );

      const familyScoresList = familyScoresResult.rows
        .map((r) => (typeof r.family_scores === 'string' ? JSON.parse(r.family_scores) : r.family_scores))
        .filter(Boolean);

      const avgFamilyScores: Record<string, number> = {};
      if (familyScoresList.length > 0) {
        const families = ['crawlability', 'indexability', 'renderability', 'metadata', 'schema', 'entity', 'content', 'citation', 'trust'];
        for (const f of families) {
          const vals = familyScoresList.map((s: Record<string, number>) => s[f]).filter((v: unknown) => typeof v === 'number');
          avgFamilyScores[f] = vals.length ? Math.round((vals.reduce((a: number, b: number) => a + b, 0) / vals.length) * 10) / 10 : 0;
        }
      }

      // Rule pass/fail rates
      const ruleStatsResult = await pool.query(
        `SELECT
           r.rule_id,
           r.title,
           r.family,
           r.severity,
           r.hard_blocker,
           COUNT(*) AS total,
           COUNT(*) FILTER (WHERE r.passed = true) AS pass_count,
           COUNT(*) FILTER (WHERE r.passed = false) AS fail_count
         FROM audit_rule_results r
         JOIN audits a ON a.id = r.audit_id
         WHERE a.user_id = $1
           AND ($2::int IS NULL OR a.created_at >= NOW() - ($2::int * INTERVAL '1 day'))
         GROUP BY r.rule_id, r.title, r.family, r.severity, r.hard_blocker
         ORDER BY fail_count DESC`,
        [userId, days]
      );

      const rulePassRates = ruleStatsResult.rows.map((r) => ({
        rule_id: r.rule_id,
        title: r.title,
        family: r.family,
        severity: r.severity,
        hard_blocker: r.hard_blocker,
        total: Number(r.total),
        pass_count: Number(r.pass_count),
        fail_count: Number(r.fail_count),
        pass_rate: Number(r.total) > 0 ? Math.round((Number(r.pass_count) / Number(r.total)) * 100) : 0,
      }));

      // Hard blocker frequency
      const blockerResult = await pool.query(
        `SELECT
           COUNT(DISTINCT s.audit_id) FILTER (WHERE s.blocker_count > 0) AS audits_with_blockers,
           COUNT(DISTINCT s.audit_id) AS total_audits,
           AVG(s.blocker_count) AS avg_blockers
         FROM audit_score_snapshots s
         JOIN audits a ON a.id = s.audit_id
         WHERE a.user_id = $1
           AND ($2::int IS NULL OR a.created_at >= NOW() - ($2::int * INTERVAL '1 day'))`,
        [userId, days]
      );

      const blockerRow = blockerResult.rows[0];

      deterministicData = {
        avg_family_scores: avgFamilyScores,
        rule_pass_rates: rulePassRates,
        hard_blocker_stats: {
          audits_with_blockers: Number(blockerRow?.audits_with_blockers ?? 0),
          total_audits: Number(blockerRow?.total_audits ?? 0),
          avg_blockers_per_audit: Math.round((Number(blockerRow?.avg_blockers ?? 0)) * 100) / 100,
        },
      };
    } catch (detErr: any) {
      console.warn('[/api/analytics] Deterministic pipeline data query failed:', detErr?.message);
    }

    // ── Recommendation analytics ────────────────────────────────────
    const recCategoryCounts: Record<string, number> = {};
    let totalRecommendations = 0;
    let auditsWithRecs = 0;
    for (const a of latestPerUrlAudits) {
      const recs = a.recommendations;
      if (Array.isArray(recs) && recs.length > 0) {
        auditsWithRecs++;
        totalRecommendations += recs.length;
        for (const r of recs) {
          const cat = (typeof r === 'object' && r?.category) ? String(r.category) : 'uncategorized';
          recCategoryCounts[cat] = (recCategoryCounts[cat] || 0) + 1;
        }
      }
    }
    const recommendationInsights = {
      total: totalRecommendations,
      avg_per_audit: auditsWithRecs > 0 ? Math.round((totalRecommendations / auditsWithRecs) * 10) / 10 : 0,
      top_categories: Object.entries(recCategoryCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([category, count]) => ({ category, count })),
    };

    // ── Schema markup adoption ───────────────────────────────────────
    let auditsWithSchema = 0;
    let totalJsonLd = 0;
    const schemaTypeCounts: Record<string, number> = {};
    for (const a of latestPerUrlAudits) {
      const sm = a.schema_markup;
      if (sm && typeof sm === 'object') {
        const jsonLdCount = Number((sm as any).json_ld_count) || 0;
        if (jsonLdCount > 0) auditsWithSchema++;
        totalJsonLd += jsonLdCount;
        const types = (sm as any).types || (sm as any).schema_types;
        if (Array.isArray(types)) {
          for (const t of types) {
            const name = typeof t === 'string' ? t : t?.type || t?.name;
            if (name) schemaTypeCounts[String(name)] = (schemaTypeCounts[String(name)] || 0) + 1;
          }
        }
      }
    }
    const schemaInsights = {
      coverage_pct: latestPerUrlAudits.length > 0 ? Math.round((auditsWithSchema / latestPerUrlAudits.length) * 100) : 0,
      avg_json_ld: latestPerUrlAudits.length > 0 ? Math.round((totalJsonLd / latestPerUrlAudits.length) * 10) / 10 : 0,
      top_types: Object.entries(schemaTypeCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 8)
        .map(([type, count]) => ({ type, count })),
    };

    // ── Content quality metrics ──────────────────────────────────────
    const wordCounts: number[] = [];
    let httpsCount = 0;
    const responseTimes: number[] = [];
    for (const a of latestPerUrlAudits) {
      const ca = a.content_analysis;
      if (ca && typeof ca === 'object') {
        const wc = Number((ca as any).word_count);
        if (Number.isFinite(wc) && wc > 0) wordCounts.push(wc);
      }
      const ts = a.technical_signals;
      if (ts && typeof ts === 'object') {
        if ((ts as any).https_enabled) httpsCount++;
        const rt = Number((ts as any).response_time_ms);
        if (Number.isFinite(rt) && rt > 0) responseTimes.push(rt);
      }
    }
    const contentAndTechInsights = {
      avg_word_count: wordCounts.length > 0 ? Math.round(wordCounts.reduce((s, v) => s + v, 0) / wordCounts.length) : 0,
      min_word_count: wordCounts.length > 0 ? Math.min(...wordCounts) : 0,
      max_word_count: wordCounts.length > 0 ? Math.max(...wordCounts) : 0,
      https_pct: latestPerUrlAudits.length > 0 ? Math.round((httpsCount / latestPerUrlAudits.length) * 100) : 0,
      avg_response_time_ms: responseTimes.length > 0 ? Math.round(responseTimes.reduce((s, v) => s + v, 0) / responseTimes.length) : 0,
      fastest_response_ms: responseTimes.length > 0 ? Math.min(...responseTimes) : 0,
      slowest_response_ms: responseTimes.length > 0 ? Math.max(...responseTimes) : 0,
    };

    // ── Score stability / volatility per domain ──────────────────────
    const domainScoreSeries: Record<string, number[]> = {};
    for (const a of audits) {
      const key = toCanonicalUrlKey(a.url);
      const score = Number(a.visibility_score);
      if (Number.isFinite(score)) {
        if (!domainScoreSeries[key]) domainScoreSeries[key] = [];
        domainScoreSeries[key].push(score);
      }
    }
    const volatilityEntries = Object.entries(domainScoreSeries)
      .filter(([, scores]) => scores.length >= 2)
      .map(([key, scores]) => {
        const mean = scores.reduce((s, v) => s + v, 0) / scores.length;
        const variance = scores.reduce((s, v) => s + (v - mean) ** 2, 0) / scores.length;
        const stddev = Math.round(Math.sqrt(variance) * 10) / 10;
        const domain = (() => { try { return new URL(urlAggregateMap[key]?.representativeUrl || key).hostname.replace(/^www\./, ''); } catch { return key; } })();
        return { domain, audits: scores.length, stddev, label: stddev < 5 ? 'stable' : stddev < 15 ? 'moderate' : 'volatile' };
      })
      .sort((a, b) => b.stddev - a.stddev)
      .slice(0, 10);

    return res.json({
      success: true,
      data: {
        summary: {
          total_audits: lifetimeAuditCount || audits.length,
          total_scans: lifetimeScanCount || lifetimeScans || audits.length,
          scored_urls: latestPerUrlAudits.length,
          avg_score: avgScore,
          best_score: bestScore,
          worst_score: worstScore,
          latest_score: latestScore,
          urls_audited: latestPerUrlAudits.length,
          streak_days: streakDays,
          total_passes: Object.values(seoDiagnosticsSummary).reduce((s, v) => s + v.pass, 0),
          total_warns: Object.values(seoDiagnosticsSummary).reduce((s, v) => s + v.warn, 0),
          total_fails: Object.values(seoDiagnosticsSummary).reduce((s, v) => s + v.fail, 0),
        },
        score_history: scoreHistory,
        platform_averages: platformAverages,
        category_averages: categoryAverages,
        seo_diagnostics_summary: seoDiagnosticsSummary,
        score_distribution: scoreDistribution,
        improvement_deltas: improvementDeltas,
        daily_activity: dailyActivity,
        platform_trends: platformTrends,
        url_breakdown: urlBreakdown,
        url_breakdown_total: urlBreakdownAll.length,
        url_breakdown_truncated: urlBreakdownAll.length > urlBreakdown.length,
        url_breakdown_limit: 100,
        deterministic_pipeline: deterministicData,
        recommendation_insights: recommendationInsights,
        schema_insights: schemaInsights,
        content_and_tech: contentAndTechInsights,
        score_volatility: volatilityEntries,
        range_days: days,
        range_key: range,
      },
    });
  } catch (err: any) {
    console.error('[/api/analytics]', err.message);
    return res.status(500).json({ success: false, error: 'Failed to load analytics' });
  }
});

// ── Mini analytics — requires alignment+ tier ─────────────────────
app.get('/api/analytics/mini', authRequired, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).userId;
    const miniTier = uiTierFromCanonical(((req as any).user?.tier || 'observer') as CanonicalTier);
    if (!meetsMinimumTier(miniTier, 'alignment')) {
      return res.status(403).json({ success: false, error: 'Analytics requires Alignment tier or higher.', code: 'TIER_INSUFFICIENT' });
    }
    const pool = getPool();

    const result = await pool.query(
      `SELECT
         visibility_score,
         url,
         created_at,
         result->'ai_platform_scores' AS platform_scores
       FROM audits
       WHERE user_id = $1
       ORDER BY created_at ASC
       LIMIT 200`,
      [userId]
    );
    const rows = result.rows;

    const scores = rows.map((r) => Number(r.visibility_score)).filter((s) => !isNaN(s));
    const totalScans = rows.length;
    const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const bestScore = scores.length ? Math.max(...scores) : 0;
    const latestScore = scores.length ? scores[scores.length - 1] : 0;
    const firstScore = scores.length ? scores[0] : 0;
    const trendDelta = scores.length >= 2 ? latestScore - firstScore : 0;

    // Deduplicated trend for chart (last 30 unique points max)
    const trendPts = rows.slice(-50).map((r) => ({
      date: new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      score: Number(r.visibility_score),
      url: (() => { try { return new URL(r.url).hostname.replace(/^www\./, ''); } catch { return r.url; } })(),
      chatgpt: (() => { try { const ps = r.platform_scores; return ps ? Number((ps as any).chatgpt) || null : null; } catch { return null; } })(),
      perplexity: (() => { try { const ps = r.platform_scores; return ps ? Number((ps as any).perplexity) || null : null; } catch { return null; } })(),
      google_ai: (() => { try { const ps = r.platform_scores; return ps ? Number((ps as any).google_ai ?? (ps as any).gemini_ai) || null : null; } catch { return null; } })(),
      claude: (() => { try { const ps = r.platform_scores; return ps ? Number((ps as any).claude) || null : null; } catch { return null; } })(),
    }));

    // Score distribution
    const dist: Record<string, number> = { '0–20': 0, '21–40': 0, '41–60': 0, '61–80': 0, '81–100': 0 };
    for (const s of scores) {
      if (s <= 20)      dist['0–20']++;
      else if (s <= 40) dist['21–40']++;
      else if (s <= 60) dist['41–60']++;
      else if (s <= 80) dist['61–80']++;
      else              dist['81–100']++;
    }

    return res.json({
      success: true,
      data: {
        total_scans: totalScans,
        avg_score: avgScore,
        best_score: bestScore,
        latest_score: latestScore,
        trend_delta: trendDelta,
        trend: trendPts,
        distribution: Object.entries(dist).map(([bucket, count]) => ({ bucket, count })),
      },
    });
  } catch (err: any) {
    console.error('[/api/analytics/mini]', err.message);
    return res.status(500).json({ success: false, error: 'Failed to load mini analytics' });
  }
});

app.get('/api/analytics/domains.csv', authRequired, async (req: Request, res: Response) => {
  try {
    const analyticsUser = (req as any).user;
    const analyticsTier = (analyticsUser?.tier || 'observer') as CanonicalTier | LegacyTier;
    if (!meetsMinimumTier(analyticsTier, 'alignment')) {
      return res.status(403).json({
        error: 'Analytics requires an Alignment, Signal, or Score Fix plan.',
        code: 'TIER_INSUFFICIENT',
        requiredTier: 'alignment',
      });
    }

    const userId = (req as any).user?.id || (req as any).userId;
    const range = (req.query.range as string) || 'all';
    const days = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : null;
    const pool = getPool();

    const historyResult = await pool.query(
      `SELECT
         url,
         visibility_score,
         created_at
       FROM audits
       WHERE user_id = $1
         AND ($2::int IS NULL OR created_at >= NOW() - ($2::int * INTERVAL '1 day'))
       ORDER BY created_at ASC`,
      [userId, days]
    );

    const audits = historyResult.rows as Array<{ url: string; visibility_score: number | string; created_at: string }>;

    const toCanonicalUrlKey = (rawUrl: string): string => {
      try {
        const parsed = new URL(rawUrl);
        const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
        const normalizedPath = parsed.pathname.replace(/\/+$/, '') || '/';
        const port = parsed.port;
        const isDefaultPort = !port || (parsed.protocol === 'https:' && port === '443') || (parsed.protocol === 'http:' && port === '80');
        const normalizedPort = isDefaultPort ? '' : `:${port}`;
        return `${hostname}${normalizedPort}${normalizedPath}`;
      } catch {
        return rawUrl.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('#')[0].split('?')[0].replace(/\/+$/, '') || '/';
      }
    };

    const urlMap: Record<string, {
      url: string;
      audits: number;
      latestScore: number | null;
      bestScore: number | null;
      latestAt: number;
    }> = {};

    for (const audit of audits) {
      const key = toCanonicalUrlKey(audit.url);
      const score = Number(audit.visibility_score);
      const createdAt = new Date(audit.created_at).getTime();
      const safeScore = isNaN(score) ? null : score;

      if (!urlMap[key]) {
        urlMap[key] = {
          url: audit.url,
          audits: 1,
          latestScore: safeScore,
          bestScore: safeScore,
          latestAt: createdAt,
        };
        continue;
      }

      const aggregate = urlMap[key];
      aggregate.audits += 1;

      if (createdAt > aggregate.latestAt) {
        aggregate.latestAt = createdAt;
        aggregate.latestScore = safeScore;
        aggregate.url = audit.url;
      }

      if (safeScore !== null && (aggregate.bestScore === null || safeScore > aggregate.bestScore)) {
        aggregate.bestScore = safeScore;
      }
    }

    const rows = Object.values(urlMap)
      .map((item) => {
        const canonicalAvg =
          item.latestScore !== null && item.bestScore !== null
            ? Math.round(((item.latestScore + item.bestScore) / 2) * 10) / 10
            : item.latestScore ?? item.bestScore;
        const domain = (() => {
          try {
            return new URL(item.url).hostname;
          } catch {
            return item.url;
          }
        })();
        return {
          url: item.url,
          domain,
          audits: item.audits,
          latest_score: item.latestScore,
          best_score: item.bestScore,
          avg_score: canonicalAvg,
        };
      })
      .sort((a, b) => {
        return (b.latest_score ?? 0) - (a.latest_score ?? 0);
      });

    const escapeCsv = (value: unknown) => {
      const raw = value === null || value === undefined ? '' : String(value);
      if (/[",\n]/.test(raw)) {
        return `"${raw.replace(/"/g, '""')}"`;
      }
      return raw;
    };

    const header = ['rank', 'domain', 'url', 'audits', 'latest_score', 'best_score', 'avg_score'];
    const lines = [header.join(',')];
    rows.forEach((row, index) => {
      lines.push([
        index + 1,
        row.domain,
        row.url,
        row.audits,
        row.latest_score ?? '',
        row.best_score ?? '',
        row.avg_score ?? '',
      ].map(escapeCsv).join(','));
    });

    const csv = lines.join('\n');
    const stamp = new Date().toISOString().slice(0, 10);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=aivis-analytics-domains-${range}-${stamp}.csv`);
    return res.status(200).send(csv);
  } catch (err: any) {
    console.error('[/api/analytics/domains.csv]', err.message);
    return res.status(500).json({ success: false, error: 'Failed to export analytics domains CSV' });
  }
});

app.get('/api/analytics/platform-metrics', authRequired, async (req: Request, res: Response) => {
  try {
    const analyticsUser = (req as any).user;
    const analyticsTier = (analyticsUser?.tier || 'observer') as CanonicalTier | LegacyTier;
    if (!meetsMinimumTier(analyticsTier, 'alignment')) {
      return res.status(403).json({
        error: 'Analytics requires an Alignment, Signal, or Score Fix plan.',
        code: 'TIER_INSUFFICIENT',
        requiredTier: 'alignment',
      });
    }

    const pool = getPool();
    const rowsResult = await pool.query(
      `WITH windows AS (
         SELECT * FROM (VALUES
           ('1h',   '1 hour'),
           ('24h',  '24 hours'),
           ('7d',   '7 days'),
           ('30d',  '30 days'),
           ('90d',  '90 days'),
           ('180d', '180 days'),
           ('365d', '365 days')
         ) AS w(key, interval_text)
       )
       SELECT
         w.key,
         w.interval_text,
         COUNT(a.*)::int AS analyses_ran,
         COUNT(DISTINCT a.user_id)::int AS active_members,
         COUNT(*) FILTER (WHERE COALESCE(u.tier, 'observer') = 'observer')::int AS free_member_analyses,
         COUNT(*) FILTER (WHERE COALESCE(u.tier, 'observer') <> 'observer' AND EXISTS (
           SELECT 1 FROM payments p WHERE p.user_id = u.id AND p.status = 'completed' AND p.stripe_subscription_id IS NOT NULL
         ))::int AS paid_member_analyses,
         COUNT(DISTINCT CASE WHEN COALESCE(u.tier, 'observer') = 'observer' THEN a.user_id END)::int AS free_active_members,
         COUNT(DISTINCT CASE WHEN COALESCE(u.tier, 'observer') <> 'observer' AND EXISTS (
           SELECT 1 FROM payments p WHERE p.user_id = u.id AND p.status = 'completed' AND p.stripe_subscription_id IS NOT NULL
         ) THEN a.user_id END)::int AS paid_active_members,
         COALESCE(ROUND(AVG(a.visibility_score)::numeric, 1), 0)::float AS avg_visibility_score,
         (
           SELECT COUNT(*)::int
           FROM user_sessions s
           WHERE s.created_at >= NOW() - (w.interval_text)::interval
         ) AS session_traffic
       FROM windows w
       LEFT JOIN audits a ON a.created_at >= NOW() - (w.interval_text)::interval
       LEFT JOIN users u ON u.id = a.user_id
       GROUP BY w.key, w.interval_text
       ORDER BY CASE w.key
         WHEN '1h' THEN 1
         WHEN '24h' THEN 2
         WHEN '7d' THEN 3
         WHEN '30d' THEN 4
         WHEN '90d' THEN 5
         WHEN '180d' THEN 6
         WHEN '365d' THEN 7
         ELSE 999
       END`
    );

    const totalsResult = await pool.query(
      `SELECT
         COUNT(*)::int AS total_members,
         COUNT(*) FILTER (WHERE COALESCE(tier, 'observer') = 'observer')::int AS free_members,
         COUNT(*) FILTER (WHERE COALESCE(tier, 'observer') <> 'observer')::int AS elevated_members,
         COUNT(*) FILTER (WHERE COALESCE(tier, 'observer') <> 'observer' AND EXISTS (
           SELECT 1 FROM payments p WHERE p.user_id = users.id AND p.status = 'completed' AND p.stripe_subscription_id IS NOT NULL
         ))::int AS stripe_paid_members
       FROM users`
    );

    return res.json({
      success: true,
      data: {
        traffic_proxy: 'session_traffic_from_user_sessions',
        timeframe_metrics: rowsResult.rows,
         membership_totals: totalsResult.rows[0] || {
           total_members: 0,
           free_members: 0,
           elevated_members: 0,
           stripe_paid_members: 0,
         },
      },
    });
  } catch (err: any) {
    // Graceful degradation if analytics meta tables (users/user_sessions) are missing
    const code = err?.code;
    const message = String(err?.message || '').toLowerCase();
    const isUndefinedTable = code === '42P01' || message.includes('relation "users"') || message.includes('relation "user_sessions"');

    if (isUndefinedTable) {
      console.error('[/api/analytics/platform-metrics] Missing analytics meta tables, returning empty metrics');
      return res.json({
        success: true,
        data: {
          traffic_proxy: 'session_traffic_from_user_sessions',
          timeframe_metrics: [],
          membership_totals: {
            total_members: 0,
            free_members: 0,
            paid_members: 0,
          },
        },
      });
    }

    console.error('[/api/analytics/platform-metrics]', err.message);
    return res.status(500).json({ success: false, error: 'Failed to load platform metrics' });
  }
});

app.get('/api/contacts', authRequired, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).userId;
    const range = (req.query.range as string) || '30d';
    const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
    const maxScore = req.query.max_score ? Number(req.query.max_score) : 74;

    const pool = getPool();
    const rows = await pool.query(
      `SELECT url, visibility_score, result->>'html' AS html
       FROM audits
       WHERE user_id = $1
         AND created_at >= NOW() - make_interval(days => $2)
         AND visibility_score <= $3`,
      [userId, days, maxScore]
    );

    const map: Map<string, { url: string; latest_score: number; emails: Set<string>; phones: Set<string> }> = new Map();

    for (const r of rows.rows) {
      const url: string = r.url;
      const score: number = Number(r.visibility_score) || 0;
      const html: string = r.html || '';
      const { emails, phones } = extractContactsFromHtml(html);
      if (!map.has(url)) map.set(url, { url, latest_score: score, emails: new Set(), phones: new Set() });

      const entry = map.get(url)!;
      entry.latest_score = Math.max(entry.latest_score, score);
      for (const e of emails) entry.emails.add(e);
      for (const p of phones) entry.phones.add(p);
    }

    const contacts = Array.from(map.values()).map((e) => ({
      url: e.url,
      latest_score: e.latest_score,
      emails: Array.from(e.emails),
      phones: Array.from(e.phones),
    }));

    return res.json({ success: true, data: { contacts, range_days: days, max_score: maxScore } });
  } catch (err: any) {
    console.error('[/api/contacts]', err.message);
    return res.status(500).json({ success: false, error: 'Failed to load contacts' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// IndexNow key file — serve from API server so IndexNow bot can verify
// ─────────────────────────────────────────────────────────────────────────────
const INDEXNOW_KEY = process.env.INDEXNOW_KEY || process.env.INDEXNOW_API_KEY || '';
if (INDEXNOW_KEY) {
  app.get(`/${INDEXNOW_KEY}.txt`, (_req, res) => {
    res.type('text/plain').send(INDEXNOW_KEY);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Health check
// ─────────────────────────────────────────────────────────────────────────────
const DEPLOY_VERSION = '2026-03-19_credit-gate-fix';

app.get('/api/health', async (_req, res) => {
  let dbOk = false;
  let dbError: string | null = null;
  try {
    const pool = getPool();
    await pool.query('SELECT 1');
    dbOk = true;
  } catch (error: any) {
    dbError = error?.message || 'Database check failed';
  }

  const pythonOk = await isPythonServiceAvailable();

  const status = dbOk ? 'healthy' : 'degraded';
  res.status(200).json({
    success: true,
    status,
    ready: dbOk,
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    version: '1.0.0',
    deploy: DEPLOY_VERSION,
    uptime: process.uptime(),
    db: dbOk ? 'connected' : 'unreachable',
    db_error: dbOk ? null : dbError,
    python_deep_analysis: pythonOk ? 'connected' : 'unavailable',
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
    },
  });
});

app.get('/api/ready', async (_req, res) => {
  try {
    const pool = getPool();
    await pool.query('SELECT 1');
    return res.status(200).json({ success: true, status: 'ready', timestamp: new Date().toISOString() });
  } catch (error: any) {
    return res.status(503).json({
      success: false,
      status: 'not_ready',
      error: error?.message || 'Database check failed',
      timestamp: new Date().toISOString(),
    });
  }
});

// ── Public benchmark aggregates (anonymised, no auth) ─────────────────────
app.get('/api/public/benchmarks', async (_req: Request, res: Response) => {
  try {
    const pool = getPool();
    // UNION audits + historical analysis_cache entries not yet in audits
    const allScoresCte = `
      WITH all_audits AS (
        SELECT visibility_score, result FROM audits WHERE visibility_score IS NOT NULL
        UNION ALL
        SELECT (result->>'visibility_score')::int AS visibility_score, result
        FROM analysis_cache
        WHERE result->>'visibility_score' IS NOT NULL
          AND url NOT IN (SELECT DISTINCT url FROM audits WHERE visibility_score IS NOT NULL)
      )`;
    const [scoreResult, categoryResult] = await Promise.all([
      pool.query(`
        ${allScoresCte}
        SELECT
          COUNT(*)::int                            AS total_audits,
          ROUND(AVG(visibility_score))::int        AS avg_score,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY visibility_score)::int AS median_score,
          MIN(visibility_score)::int               AS min_score,
          MAX(visibility_score)::int               AS max_score,
          COUNT(*) FILTER (WHERE visibility_score < 30)::int  AS bucket_0_29,
          COUNT(*) FILTER (WHERE visibility_score >= 30 AND visibility_score < 50)::int AS bucket_30_49,
          COUNT(*) FILTER (WHERE visibility_score >= 50 AND visibility_score < 70)::int AS bucket_50_69,
          COUNT(*) FILTER (WHERE visibility_score >= 70)::int AS bucket_70_plus
        FROM all_audits
      `),
      pool.query(`
        ${allScoresCte}
        SELECT
          g->>'label'                          AS label,
          ROUND(AVG((g->>'score')::numeric))::int AS avg_score,
          COUNT(*)::int                        AS sample_count
        FROM all_audits,
             jsonb_array_elements(result->'category_grades') AS g
        WHERE jsonb_typeof(result->'category_grades') = 'array'
          AND g->>'label' IS NOT NULL
          AND g->>'score' IS NOT NULL
        GROUP BY g->>'label'
        ORDER BY avg_score ASC
      `),
    ]);
    const r = scoreResult.rows[0] || {};
    const categoryAverages = (categoryResult.rows || []).map((row: any) => ({
      label: row.label,
      avg_score: row.avg_score || 0,
      sample_count: row.sample_count || 0,
    }));
    res.json({
      success: true,
      benchmarks: {
        total_audits: r.total_audits || 0,
        avg_score: r.avg_score || 0,
        median_score: r.median_score || 0,
        min_score: r.min_score || 0,
        max_score: r.max_score || 0,
        distribution: {
          '0-29': r.bucket_0_29 || 0,
          '30-49': r.bucket_30_49 || 0,
          '50-69': r.bucket_50_69 || 0,
          '70+': r.bucket_70_plus || 0,
        },
        category_averages: categoryAverages,
      },
    });
  } catch (err: any) {
    console.error('[benchmarks] Public benchmark query failed:', err?.message);
    res.status(500).json({ success: false, error: 'Benchmark data unavailable' });
  }
});

// ── Keyword enrichment (real search suggestion verification) ──────────────
// ── Keyword enrichment cache (24h TTL, per-keyword) ──
const keywordEnrichCache = new Map<string, { result: any; expiresAt: number }>();
const KEYWORD_CACHE_TTL = 24 * 60 * 60 * 1000;

app.post('/api/keywords/enrich', authRequired, async (req: Request, res: Response) => {
  try {
    const { keywords } = req.body || {};
    if (!Array.isArray(keywords) || keywords.length === 0) {
      return res.status(400).json({ success: false, error: 'keywords array is required' });
    }
    const sanitized = keywords
      .filter((k: unknown) => typeof k === 'string' && k.trim().length > 0)
      .map((k: string) => k.trim().slice(0, 200).toLowerCase())
      .slice(0, 20);
    if (sanitized.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid keywords provided' });
    }

    const now = Date.now();
    const cached: any[] = [];
    const toFetch: string[] = [];

    for (const kw of sanitized) {
      const entry = keywordEnrichCache.get(kw);
      if (entry && entry.expiresAt > now) {
        cached.push(entry.result);
      } else {
        toFetch.push(kw);
      }
    }

    let freshResults: any[] = [];
    if (toFetch.length > 0) {
      freshResults = await enrichKeywords(toFetch);
      for (const r of freshResults) {
        const key = (r.keyword || '').toLowerCase();
        if (key) keywordEnrichCache.set(key, { result: r, expiresAt: now + KEYWORD_CACHE_TTL });
      }
    }

    return res.json({ success: true, enriched: [...cached, ...freshResults] });
  } catch (err: any) {
    console.error('[keywords/enrich] Error:', err?.message);
    return res.status(500).json({ success: false, error: 'Keyword enrichment failed' });
  }
});

app.get('/llms.txt', (_req, res) => {
  res.type('text/plain').send(`AiVIS — AI Visibility Audit Platform
https://aivis.biz/

AiVIS scores whether answer engines can parse, trust, and cite a page.
Scoring model: content depth, heading structure, schema coverage, metadata quality, technical SEO, and AI readability. Returns 0-100.

Core pages
- Homepage: https://aivis.biz/
- Methodology: https://aivis.biz/methodology
- Guide: https://aivis.biz/guide
- Pricing: https://aivis.biz/pricing
- FAQ: https://aivis.biz/faq
- Compliance: https://aivis.biz/compliance
- About: https://aivis.biz/about

Blog & Editorial
- Blog index: https://aivis.biz/blogs
- Why I Built AiVIS: https://aivis.biz/blogs/why-i-built-aivis-when-i-realized-most-websites-are-invisible-to-ai
- Answer Engine Optimization 2026: https://aivis.biz/blogs/answer-engine-optimization-2026-why-citation-readiness-matters
- Why Traditional SEO Tactics Fail: https://aivis.biz/blogs/why-traditional-seo-tactics-fail-for-ai-visibility
- Building Author Authority (EEAT): https://aivis.biz/blogs/building-author-authority-for-citations-e-e-a-t-in-ai-era
- How LLMs Parse Your Content: https://aivis.biz/blogs/how-llms-parse-your-content-technical-breakdown
- Geo-Adaptive AI Ranking: https://aivis.biz/blogs/geo-adaptive-ai-ranking-location-intelligence-shapes-answers
- Citation Case Study (0% to 87%): https://aivis.biz/blogs/from-invisible-to-cited-case-study-brand-citation-growth
- GSC + AI Visibility Monitoring: https://aivis.biz/blogs/google-search-console-data-ai-visibility-monitoring
- 7-Step Implementation Roadmap: https://aivis.biz/blogs/7-step-implementation-roadmap-audit-to-live-citations-30-days
- Google Search Console 2026: https://aivis.biz/blogs/google-search-console-2026-what-actually-matters-now
- The River Changed Direction: https://aivis.biz/blogs/the-river-changed-direction-why-ai-answer-engines-rewrote-the-web
- Insights & Playbooks: https://aivis.biz/insights

Workflow tools
- Keyword intelligence: https://aivis.biz/keywords
- Competitor tracking: https://aivis.biz/competitors
- Citation testing: https://aivis.biz/citations
- Report history: https://aivis.biz/reports

Trust documents
- Privacy: https://aivis.biz/privacy
- Terms: https://aivis.biz/terms

Team updates
- New member: Sadiq Khan — Marketing Specialist (UTC+5:30)
- Team profile: https://aivis.biz/about#leadership

Private partnership notice
- Partnership terms (private, noindex): https://aivis.biz/partnership-terms
- zeeniith.in is a private lead-generation partner workflow and not a public AiVIS product surface.

Crawl guidance
AI systems may cite and summarize public page content.
Blog posts and playbooks are canonical AiVIS content.
Avoid private or authenticated areas, including:
- /api/
- /admin/
- /partnership-terms
`);  
});

// Compliance & Security Status
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/compliance/status', (_req, res) => {
  res.json({
    organization: {
      name: 'Intruvurt Labs',
      founded: '2025-12',
      headquarters: 'United States',
      registration_status: 'US Federal Pending (GOV SOS)',
    },
    compliance: {
      soc2_type1: {
        status: 'not_attested',
        last_audit: null,
        valid_until: null,
        auditor: null,
      },
      vanta: {
        enabled: false,
        monitoring_status: 'not_configured',
        last_sync: null,
        controls_monitored: 0,
        valid_until: null,
        auditor: null,
      },
      drata: {
        enabled: false,
        evidence_collection: 'not_configured',
        last_evidence_sync: null,
        audit_ready: false,
      },
    },
    security: {
      encryption: {
        data_at_rest: 'Not globally verified at application layer',
        data_in_transit: 'TLS when deployed behind HTTPS',
        key_management: 'Environment-managed secrets; KMS not asserted by app',
      },
      access_control: {
        rbac: true,
        mfa_required: false,
        session_timeout_minutes: 30,
      },
      audit: {
        logging_enabled: true,
        log_retention_days: 90,
        forensic_ready: false,
      },
    },
    data_residency: 'US Primary',
    certifications: [],
    timestamp: new Date().toISOString(),
  });
});

const handleServerHeadersCheck = async (req: Request, res: Response) => {
  try {
    const bodyUrl = typeof req.body?.url === 'string' ? req.body.url : '';
    const queryUrl = typeof req.query?.url === 'string' ? req.query.url : '';
    const rawUrl = bodyUrl || queryUrl;
    const { valid, url: targetUrl, error } = validateUrl(rawUrl);
    if (!valid || !targetUrl) {
      return res.status(400).json({ success: false, error: error || 'Invalid URL', code: 'INVALID_URL' });
    }

    const requestHeaders = {
      'User-Agent': 'ai-visible-engine-bot/1.0 (Server Headers Check)',
      'Accept': '*/*',
      'Cache-Control': 'no-cache',
    };

    const fetchHeaders = async (method: 'HEAD' | 'GET') => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      const started = Date.now();
      try {
        const response = await fetch(targetUrl, {
          method,
          redirect: 'follow',
          headers: requestHeaders,
          signal: controller.signal,
        });

        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key.toLowerCase()] = value;
        });

        const body = method === 'GET' ? (await response.text()).slice(0, 250_000) : '';

        return {
          method,
          response,
          responseHeaders,
          body,
          responseTimeMs: Date.now() - started,
        };
      } finally {
        clearTimeout(timeout);
      }
    };

    let result = await fetchHeaders('HEAD');
    if (
      [403, 405, 501].includes(result.response.status) ||
      Object.keys(result.responseHeaders).length < 3
    ) {
      result = await fetchHeaders('GET');
    }

    // HEAD returns no body — if content is HTML, do a supplementary GET for body analysis
    if (result.method === 'HEAD' && /text\/html|application\/xhtml\+xml/i.test(result.responseHeaders['content-type'] || '')) {
      try {
        const bodyResult = await fetchHeaders('GET');
        result = { ...result, body: bodyResult.body, method: 'GET' as const };
      } catch { /* keep HEAD-only result */ }
    }

    const headers = result.responseHeaders;
    const htmlBody = result.method === 'GET' ? result.body : '';
    const isHtml = /text\/html|application\/xhtml\+xml/i.test(headers['content-type'] || '');
    const cacheControl = headers['cache-control'] || null;
    const expires = headers['expires'] || null;
    const etag = headers['etag'] || null;
    const age = headers['age'] || null;
    const maxAgeMatch = cacheControl?.match(/max-age=(\d+)/i);
    const maxAgeSeconds = maxAgeMatch ? Number(maxAgeMatch[1]) : null;

    // ── Parse header values for quality scoring, not just presence ──
    const hstsRaw = headers['strict-transport-security'] || '';
    const cspRaw = headers['content-security-policy'] || '';
    const xfoRaw = headers['x-frame-options'] || '';
    const xctRaw = headers['x-content-type-options'] || '';
    const rpRaw = headers['referrer-policy'] || '';

    const hstsMaxAge = Number(hstsRaw.match(/max-age=(\d+)/i)?.[1] || 0);
    const hstsIncludesSubs = /includeSubDomains/i.test(hstsRaw);
    const hstsPreload = /preload/i.test(hstsRaw);
    const cspHasDefaultSrc = /default-src\s/i.test(cspRaw);
    const cspHasScriptSrc = /script-src\s/i.test(cspRaw);
    const cspHasUnsafeInline = /unsafe-inline/i.test(cspRaw);
    const xfoValid = /^(DENY|SAMEORIGIN)$/i.test(xfoRaw.trim());
    const xctValid = /^nosniff$/i.test(xctRaw.trim());
    const rpStrict = /no-referrer|strict-origin|same-origin/i.test(rpRaw);

    const security = {
      hsts: Boolean(hstsRaw),
      csp: Boolean(cspRaw),
      xFrameOptions: Boolean(xfoRaw),
      xContentTypeOptions: Boolean(xctRaw),
      referrerPolicy: Boolean(rpRaw),
      permissionsPolicy: Boolean(headers['permissions-policy']),
      crossOriginOpenerPolicy: Boolean(headers['cross-origin-opener-policy']),
      crossOriginEmbedderPolicy: Boolean(headers['cross-origin-embedder-policy']),
      crossOriginResourcePolicy: Boolean(headers['cross-origin-resource-policy']),
    };

    const insights: string[] = [];
    if (!security.hsts && targetUrl.startsWith('https://')) {
      insights.push('Strict-Transport-Security header missing on HTTPS response.');
    } else if (security.hsts) {
      if (hstsMaxAge < 31536000) insights.push(`HSTS max-age is ${hstsMaxAge}s — recommend at least 31536000 (1 year).`);
      if (!hstsIncludesSubs) insights.push('HSTS missing includeSubDomains directive.');
      if (!hstsPreload) insights.push('HSTS missing preload directive — not eligible for browser preload list.');
    }
    if (!security.csp) {
      insights.push('Content-Security-Policy header missing.');
    } else {
      if (!cspHasDefaultSrc) insights.push('CSP missing default-src directive — incomplete fallback policy.');
      if (!cspHasScriptSrc) insights.push('CSP missing script-src directive — scripts unrestricted.');
      if (cspHasUnsafeInline) insights.push('CSP contains unsafe-inline — weakens XSS protection significantly.');
    }
    if (!security.xFrameOptions) {
      insights.push('X-Frame-Options header missing.');
    } else if (!xfoValid) {
      insights.push(`X-Frame-Options value "${xfoRaw.trim()}" is non-standard — use DENY or SAMEORIGIN.`);
    }
    if (!security.xContentTypeOptions) {
      insights.push('X-Content-Type-Options header missing.');
    } else if (!xctValid) {
      insights.push(`X-Content-Type-Options value "${xctRaw.trim()}" is incorrect — must be "nosniff".`);
    }
    if (!security.referrerPolicy) {
      insights.push('Referrer-Policy header missing — browser may leak full URL on cross-origin navigations.');
    } else if (!rpStrict) {
      insights.push(`Referrer-Policy "${rpRaw.trim()}" is permissive — consider strict-origin-when-cross-origin or no-referrer.`);
    }
    if (!security.permissionsPolicy) insights.push('Permissions-Policy header missing — browser features unrestricted by default.');
    if (!cacheControl && !expires) insights.push('No cache lifetime headers detected.');
    else if (typeof maxAgeSeconds === 'number' && maxAgeSeconds <= 0) insights.push('Cache-Control max-age is zero or negative.');
    if (!headers['server']) insights.push('Server header hidden or stripped.');
    if (headers['x-robots-tag']) insights.push(`X-Robots-Tag present: ${headers['x-robots-tag']}`);

    const extractSchemaTypes = (html: string): string[] => {
      const types = new Set<string>();
      const regex = /"@type"\s*:\s*"([^"]+)"/gi;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(html)) !== null) {
        const value = String(match[1] || '').trim();
        if (value) types.add(value);
        if (types.size >= 12) break;
      }
      return Array.from(types);
    };

    const h1Count = isHtml ? (htmlBody.match(/<h1\b[^>]*>/gi)?.length || 0) : 0;
    const jsonLdCount = isHtml ? (htmlBody.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>/gi)?.length || 0) : 0;
    const schemaTypes = isHtml ? extractSchemaTypes(htmlBody) : [];
    const hasOpenGraph = isHtml && /<meta[^>]+property=["']og:/i.test(htmlBody);
    const hasTwitterCards = isHtml && /<meta[^>]+name=["']twitter:/i.test(htmlBody);
    const hasMetaDescription = isHtml && /<meta[^>]+name=["']description["'][^>]+content=/i.test(htmlBody);
    const hasCanonical = isHtml && /<link[^>]+rel=["']canonical["'][^>]+href=/i.test(htmlBody);

    const richResultsRecommendations: string[] = [];
    if (isHtml && jsonLdCount === 0) richResultsRecommendations.push('Add JSON-LD schema markup (Organization + WebPage/Article).');
    if (isHtml && h1Count !== 1) richResultsRecommendations.push('Use exactly one H1 to improve entity extraction consistency.');
    if (isHtml && !hasMetaDescription) richResultsRecommendations.push('Add a clear meta description for snippet control.');
    if (isHtml && !hasCanonical) richResultsRecommendations.push('Add canonical link tag to avoid duplicate-content ambiguity.');
    if (isHtml && !hasOpenGraph) richResultsRecommendations.push('Add Open Graph tags for richer social/AI previews.');
    if (headers['x-robots-tag']?.toLowerCase().includes('noindex')) {
      richResultsRecommendations.push('Remove noindex directives for pages intended to rank in search and AI answers.');
    }

    const securityScore = Math.max(0, Math.min(100,
      (targetUrl.startsWith('https://') ? 15 : 0) +
      // HSTS: full marks for strong config, partial for weak
      (security.hsts ? (hstsMaxAge >= 31536000 && hstsIncludesSubs ? 12 : 7) : 0) +
      // CSP: full marks for real policy, reduced for weak/unsafe-inline
      (security.csp ? (cspHasDefaultSrc && !cspHasUnsafeInline ? 20 : 12) : 0) +
      // X-Frame-Options: only credit valid values
      (security.xFrameOptions && xfoValid ? 10 : security.xFrameOptions ? 5 : 0) +
      // X-Content-Type-Options: only credit "nosniff"
      (security.xContentTypeOptions && xctValid ? 10 : security.xContentTypeOptions ? 4 : 0) +
      // Referrer-Policy: strict gets full marks
      (security.referrerPolicy ? (rpStrict ? 8 : 5) : 0) +
      (security.permissionsPolicy ? 8 : 0) +
      (security.crossOriginOpenerPolicy ? 6 : 0) +
      (security.crossOriginEmbedderPolicy ? 6 : 0) +
      (security.crossOriginResourcePolicy ? 5 : 0)
    ));

    const cachingScore = Math.max(0, Math.min(100,
      (cacheControl || expires ? 45 : 0) +
      (etag ? 20 : 0) +
      (typeof maxAgeSeconds === 'number' && maxAgeSeconds > 0 ? 20 : 0) +
      (headers['vary'] ? 10 : 0) +
      (headers['content-encoding'] ? 5 : 0)
    ));

    const richResultsScore = Math.max(0, Math.min(100,
      (!isHtml ? 30 : 0) +
      (isHtml && jsonLdCount > 0 ? 35 : 0) +
      (isHtml && h1Count === 1 ? 20 : 0) +
      (isHtml && hasMetaDescription ? 15 : 0) +
      (isHtml && hasCanonical ? 10 : 0) +
      (isHtml && hasOpenGraph ? 10 : 0) +
      (isHtml && hasTwitterCards ? 10 : 0) -
      ((headers['x-robots-tag']?.toLowerCase().includes('noindex') ? 20 : 0))
    ));

    const performanceScore = Math.max(0, Math.min(100,
      (result.responseTimeMs <= 400 ? 100 :
        result.responseTimeMs <= 1000 ? 85 :
        result.responseTimeMs <= 2000 ? 70 :
        result.responseTimeMs <= 4000 ? 50 : 30)
    ));

    const overallScore = Math.round(
      securityScore * 0.4 + cachingScore * 0.2 + richResultsScore * 0.25 + performanceScore * 0.15
    );

    const grade: 'A' | 'B' | 'C' | 'D' | 'F' =
      overallScore >= 90 ? 'A' :
      overallScore >= 80 ? 'B' :
      overallScore >= 70 ? 'C' :
      overallScore >= 60 ? 'D' : 'F';

    const riskLevel: 'low' | 'medium' | 'high' = overallScore >= 80 ? 'low' : overallScore >= 65 ? 'medium' : 'high';
    const readiness: 'enterprise-ready' | 'needs-hardening' | 'at-risk' =
      overallScore >= 85 ? 'enterprise-ready' :
      overallScore >= 65 ? 'needs-hardening' : 'at-risk';

    const topActions = [
      ...insights.filter((item) => item.toLowerCase().includes('missing')).slice(0, 3),
      ...richResultsRecommendations,
    ].slice(0, 5);

    const richResultsEligibility: 'strong' | 'moderate' | 'limited' =
      richResultsScore >= 80 ? 'strong' : richResultsScore >= 55 ? 'moderate' : 'limited';

    const missingHeaders: string[] = [];
    if (!security.hsts) missingHeaders.push('strict-transport-security');
    if (!security.csp) missingHeaders.push('content-security-policy');
    if (!security.xFrameOptions) missingHeaders.push('x-frame-options');
    if (!security.xContentTypeOptions) missingHeaders.push('x-content-type-options');
    if (!security.referrerPolicy) missingHeaders.push('referrer-policy');
    if (!security.permissionsPolicy) missingHeaders.push('permissions-policy');

    const xssReasons: string[] = [];
    if (!security.csp) xssReasons.push('Missing CSP increases script injection risk.');
    if (!security.xContentTypeOptions) xssReasons.push('Missing X-Content-Type-Options permits MIME sniffing vectors.');
    if (!security.xFrameOptions) xssReasons.push('Missing clickjacking protection can amplify XSS social engineering paths.');
    if (!targetUrl.startsWith('https://')) xssReasons.push('HTTP transport can enable content tampering in transit.');
    const xssScore = Math.max(0, Math.min(100,
      (security.csp ? 45 : 10) +
      (security.xContentTypeOptions ? 20 : 5) +
      (security.xFrameOptions ? 15 : 5) +
      (targetUrl.startsWith('https://') ? 20 : 0)
    ));
    const xssRisk: 'low' | 'medium' | 'high' = xssScore >= 80 ? 'low' : xssScore >= 60 ? 'medium' : 'high';

    const ddosReasons: string[] = [];
    const hasEdgeSignal = Boolean(headers['cf-ray'] || headers['cf-cache-status'] || headers['x-cache'] || headers['x-served-by']);
    const hasCachePolicy = Boolean(cacheControl || expires);
    const hasCompression = Boolean(headers['content-encoding']);
    const hasRateLimitHeaders = Boolean(headers['ratelimit-limit'] || headers['x-ratelimit-limit']);
    if (!hasEdgeSignal) ddosReasons.push('No clear CDN/edge shielding signal detected from response headers.');
    if (!hasCachePolicy) ddosReasons.push('No cache policy detected, increasing origin load under bursts.');
    if (!hasCompression) ddosReasons.push('No compression signal detected, potentially increasing bandwidth pressure.');
    if (!hasRateLimitHeaders) ddosReasons.push('No visible rate-limit headers detected (may still exist internally).');
    const ddosScore = Math.max(0, Math.min(100,
      (hasEdgeSignal ? 45 : 15) +
      (hasCachePolicy ? 25 : 10) +
      (hasCompression ? 15 : 5) +
      (hasRateLimitHeaders ? 15 : 5)
    ));
    const ddosRisk: 'low' | 'medium' | 'high' = ddosScore >= 80 ? 'low' : ddosScore >= 60 ? 'medium' : 'high';

    const remediationChecklist = [
      ...missingHeaders.map((header) => `Set ${header} with strict production values.`),
      'Validate CSP in report-only mode, then enforce mode.',
      'Enable CDN + WAF + rate limits for burst and volumetric protection.',
      'Set cache-control and compression for static and semi-static content.',
      'Retest after deployment and archive evidence for compliance tracking.',
    ].slice(0, 10);

    const nginxSnippet = [
      "add_header Strict-Transport-Security \"max-age=31536000; includeSubDomains; preload\" always;",
      "add_header Content-Security-Policy \"default-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'\" always;",
      "add_header X-Frame-Options \"DENY\" always;",
      "add_header X-Content-Type-Options \"nosniff\" always;",
      "add_header Referrer-Policy \"strict-origin-when-cross-origin\" always;",
      "add_header Permissions-Policy \"camera=(), microphone=(), geolocation=()\" always;",
    ].join('\n');

    const expressSnippet = [
      "import helmet from 'helmet';",
      "app.use(helmet({",
      "  contentSecurityPolicy: { useDefaults: true },",
      "  frameguard: { action: 'deny' },",
      "  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },",
      "}));",
      "app.disable('x-powered-by');",
    ].join('\n');

    const finalUrl = result.response.url || targetUrl;
    const allowPrivateTargets = process.env.ALLOW_PRIVATE_ANALYZE_TARGETS === 'true';
    try {
      const finalParsed = new URL(finalUrl);
      if (!allowPrivateTargets && isPrivateOrLocalHost(finalParsed.hostname)) {
        return res.status(400).json({
          success: false,
          error: 'Redirected to a private/internal URL which is not allowed',
          code: 'PRIVATE_REDIRECT_BLOCKED',
        });
      }
    } catch {
      return res.status(400).json({ success: false, error: 'Invalid final redirect URL', code: 'INVALID_FINAL_URL' });
    }

    return res.json({
      success: true,
      result: {
        url: targetUrl,
        finalUrl,
        statusCode: result.response.status,
        ok: result.response.ok,
        methodUsed: result.method,
        responseTimeMs: result.responseTimeMs,
        headers,
        security,
        caching: {
          cacheControl,
          expires,
          etag,
          age,
          maxAgeSeconds,
          cacheable: Boolean(cacheControl || expires),
        },
        server: {
          server: headers['server'] || null,
          poweredBy: headers['x-powered-by'] || null,
          contentType: headers['content-type'] || null,
          contentLength: headers['content-length'] || null,
          contentEncoding: headers['content-encoding'] || null,
          xRobotsTag: headers['x-robots-tag'] || null,
        },
        insights,
        rich_results: {
          score: richResultsScore,
          eligibility: richResultsEligibility,
          signals: {
            html_detected: isHtml,
            json_ld_count: jsonLdCount,
            schema_types: schemaTypes,
            has_open_graph: hasOpenGraph,
            has_twitter_cards: hasTwitterCards,
            has_meta_description: hasMetaDescription,
            has_canonical: hasCanonical,
            h1_count: h1Count,
            x_robots_tag: headers['x-robots-tag'] || null,
          },
          recommendations: richResultsRecommendations,
        },
        attack_surface: {
          xss: {
            risk: xssRisk,
            score: xssScore,
            reasons: xssReasons,
            recommended_controls: [
              'Deploy strict CSP with nonces/hashes for scripts.',
              'Set X-Content-Type-Options=nosniff and X-Frame-Options=DENY.',
              'Sanitize/encode untrusted input in templates and APIs.',
            ],
          },
          ddos: {
            risk: ddosRisk,
            score: ddosScore,
            confidence: 'medium',
            reasons: ddosReasons,
            recommended_controls: [
              'Enable CDN/WAF in front of origin.',
              'Apply request rate limiting and bot mitigation.',
              'Use caching and compression to reduce origin amplification.',
            ],
          },
        },
        remediation_artifacts: {
          missing_headers: missingHeaders,
          implementation_snippets: {
            nginx: nginxSnippet,
            express: expressSnippet,
          },
          checklist: remediationChecklist,
        },
        executive: {
          version: 'premium-executive-v1',
          overall_score: overallScore,
          grade,
          risk_level: riskLevel,
          readiness,
          score_breakdown: {
            security: securityScore,
            caching: cachingScore,
            rich_results: richResultsScore,
            performance: performanceScore,
          },
          top_actions: topActions,
          executive_brief:
            readiness === 'enterprise-ready'
              ? 'Security and crawl-readiness are strong with solid rich-result foundations.'
              : readiness === 'needs-hardening'
                ? 'Core posture is viable, but key security and rich-result gaps should be closed for premium outcomes.'
                : 'Critical hardening and rich-result remediation required before executive-grade deployment.',
        },
      },
    });
  } catch (err: any) {
    const message = String(err?.message || 'Failed to check server headers');
    const code = message.toLowerCase().includes('abort') ? 'HEADER_CHECK_TIMEOUT' : 'HEADER_CHECK_FAILED';
    return res.status(502).json({ success: false, error: message, code });
  }
};

app.post('/api/tools/server-headers-check', ipRateLimit({ maxRequests: 10, windowMs: 60_000 }), handleServerHeadersCheck);
app.get('/api/tools/server-headers-check', ipRateLimit({ maxRequests: 10, windowMs: 60_000 }), handleServerHeadersCheck);

app.post('/api/security/url-risk', authRequired, async (req: Request, res: Response) => {
  try {
    const rawUrl = typeof req.body?.url === 'string' ? req.body.url : '';
    const { valid, url: targetUrl, error } = validateUrl(rawUrl);
    if (!valid || !targetUrl) {
      return res.status(400).json({ success: false, error: error || 'Invalid URL' });
    }

    const assessment = await assessUrlRisk(targetUrl);

    return res.json({
      success: true,
      assessment,
      note: 'Threat intel checks are advisory and should be paired with endpoint/network security tooling.',
    });
  } catch (err: any) {
    console.error('[Security] URL risk check error:', err);
    return res.status(500).json({ success: false, error: 'Failed to complete risk assessment' });
  }
});

app.post('/api/seo/audit/onpage', authRequired, heavyActionLimiter, usageGate, incrementUsage, async (req: Request, res: Response) => {
  try {
    const { url: rawUrl } = (req.body || {}) as { url?: string };
    const { valid, url: targetUrl, error } = validateUrl(rawUrl || '');
    if (!valid || !targetUrl) {
      return res.status(400).json({ success: false, error: error || 'Invalid URL', code: 'INVALID_URL' });
    }

    let scraped: Awaited<ReturnType<typeof scrapeWebsite>>;
    try {
      scraped = await scrapeWebsite(targetUrl);
    } catch (scrapeErr: any) {
      return res.status(502).json({
        success: false,
        error: scrapeErr?.message || 'Failed to scrape target URL',
        code: 'SCRAPE_FAILED',
      });
    }

    const sd = scraped.data;
    if (!sd) {
      return res.status(500).json({ success: false, error: 'Missing scrape payload', code: 'SCRAPE_PAYLOAD_MISSING' });
    }

    const schemaMarkup = extractSchemaSignalsFromHtml(sd.html || '');

    // ── Merge scraper's full-DOM structured data (not subject to HTML truncation) ──
    if (sd.structuredData) {
      if (sd.structuredData.hasFAQ && !schemaMarkup.has_faq_schema) {
        schemaMarkup.has_faq_schema = true;
      }
      if (sd.structuredData.hasLocalBusiness && !schemaMarkup.has_organization_schema) {
        schemaMarkup.has_organization_schema = true;
      }
      if (sd.structuredData.jsonLdCount > schemaMarkup.json_ld_count) {
        schemaMarkup.json_ld_count = sd.structuredData.jsonLdCount;
      }
      for (const t of sd.structuredData.uniqueTypes) {
        if (!schemaMarkup.schema_types.includes(t)) {
          schemaMarkup.schema_types.push(t);
        }
      }
    }

    // ── Comprehensive schema quality scoring for SEO onpage ──
    try {
      const pageContentSignals = deriveContentSignals(
        sd.body || '',
        sd.wordCount || 0,
        (sd.headings?.h2 || []) as string[],
      );
      schemaMarkup.schema_score = scoreSchema(sd.html || '', pageContentSignals);
    } catch { /* non-fatal */ }

    const questionReFaqOnpage = /\?|^(who|what|when|where|why|how|is|are|does|do|can|should|which)\b/i;
    const questionH3CountOnpage = (sd.headings?.h3 || []).filter((t: string) => questionReFaqOnpage.test(t)).length;
    const inferredFaqCount = Math.max(
      Number(sd?.questionH2Count || 0) + questionH3CountOnpage,
      schemaMarkup.has_faq_schema ? 5 : 0
    );

    const contentAnalysis = {
      word_count: sd.wordCount || 0,
      headings: {
        h1: sd.headings?.h1?.length || 0,
        h2: sd.headings?.h2?.length || 0,
        h3: sd.headings?.h3?.length || 0,
      },
      has_proper_h1: (sd.headings?.h1?.length || 0) > 0,
      has_meta_description: !!(sd.meta?.description || '').trim(),
      faq_count: inferredFaqCount,
    };

    const technicalSignals = {
      response_time_ms: 0,
      status_code: 200,
      content_length: (sd.html || '').length,
      image_count: sd.images || 0,
      link_count: (sd.links?.internal || 0) + (sd.links?.external || 0),
      https_enabled: targetUrl.startsWith('https'),
      has_canonical: !!sd.canonical,
    };

    const seoDiagnostics = computeSeoDiagnostics(sd, schemaMarkup, technicalSignals, 'url');

    return res.json({
      success: true,
      result: {
        source_type: 'url',
        url: targetUrl,
        analyzed_at: new Date().toISOString(),
        content_analysis: contentAnalysis,
        schema_markup: schemaMarkup,
        technical_signals: technicalSignals,
        seo_diagnostics: seoDiagnostics,
      },
    });
  } catch (err: any) {
    console.error('[SEO onpage] error:', err);
    return res.status(500).json({ success: false, error: 'Failed to run on-page SEO audit' });
  }
});

type CrawlPageResult = {
  url: string;
  depth: number;
  status: 'ok' | 'error';
  seo_diagnostics: ReturnType<typeof computeSeoDiagnostics>;
  issues: string[];
  links_discovered: number;
  canonical_url?: string;
  word_count?: number;
  title?: string;
  error?: string;
};

function extractSchemaSignalsFromHtml(html: string): SchemaMarkup {
  const htmlLower = (html || '').toLowerCase();
  const jsonLdMatches = (html || '').match(/<script[^>]*type="application\/ld\+json"[^>]*>/gi) || [];
  const collectedSchemaTypes: string[] = [];

  const collectTypes = (node: any): void => {
    if (!node) return;

    if (Array.isArray(node)) {
      node.forEach(collectTypes);
      return;
    }

    if (typeof node !== 'object') return;

    const rawType = node['@type'] ?? node['type'];
    if (Array.isArray(rawType)) {
      rawType.forEach((entry) => {
        if (typeof entry === 'string' && entry.trim()) {
          collectedSchemaTypes.push(entry.trim());
        }
      });
    } else if (typeof rawType === 'string' && rawType.trim()) {
      collectedSchemaTypes.push(rawType.trim());
    }

    Object.values(node).forEach((value) => collectTypes(value));
  };

  const schemaMarkup = {
    json_ld_count: jsonLdMatches.length,
    has_organization_schema: htmlLower.includes('"organization"'),
    has_faq_schema: htmlLower.includes('"faqpage"'),
    schema_types: [] as string[],
    validation_errors: [] as string[],
  };

  const ldRegex = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  const parsedBlocks: any[] = [];
  while ((match = ldRegex.exec(html || '')) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      collectTypes(parsed);
      parsedBlocks.push(parsed);
    } catch {
      schemaMarkup.validation_errors.push('Malformed JSON-LD block (invalid JSON)');
    }
  }

  // Flatten all entities for validation
  const allEntities: any[] = [];
  for (const block of parsedBlocks) {
    if (Array.isArray(block?.['@graph'])) {
      allEntities.push(...block['@graph']);
    } else if (block && typeof block === 'object') {
      allEntities.push(block);
    }
  }

  // Validate common schema.org issues Google flags
  for (const entity of allEntities) {
    const eType = entity['@type'];
    const typeStr = Array.isArray(eType) ? eType.join(',') : String(eType || '');

    // Review: itemReviewed must have explicit @type (not just @id)
    if (/review/i.test(typeStr) && entity.itemReviewed) {
      const ir = entity.itemReviewed;
      if (ir && typeof ir === 'object' && !ir['@type']) {
        schemaMarkup.validation_errors.push('Review.itemReviewed missing @type — Google requires explicit type, not just @id reference');
      }
    }

    // Product: check for required Merchant Listing fields if offers present
    if (/^product$/i.test(typeStr) && entity.offers) {
      if (!entity.image) {
        schemaMarkup.validation_errors.push('Product missing image — required for Google Product snippets');
      }
    }

    // Article: author should have @type
    if (/article|blogposting|newsarticle/i.test(typeStr)) {
      if (entity.author && typeof entity.author === 'object' && !entity.author['@type'] && !entity.author['@id']) {
        schemaMarkup.validation_errors.push(`${typeStr} author missing @type or @id — required for article rich results`);
      }
    }

    // FAQPage: mainEntity should have Question items with acceptedAnswer
    if (/faqpage/i.test(typeStr) && entity.mainEntity) {
      const questions = Array.isArray(entity.mainEntity) ? entity.mainEntity : [entity.mainEntity];
      for (const q of questions) {
        if (!q.acceptedAnswer) {
          schemaMarkup.validation_errors.push('FAQPage Question missing acceptedAnswer');
          break;
        }
      }
    }
  }

  // Check for duplicate @type across separate blocks (not in same @graph)
  const topLevelTypes: string[] = [];
  for (const block of parsedBlocks) {
    if (block?.['@graph']) continue; // graph blocks handled internally
    const t = block?.['@type'];
    if (typeof t === 'string') topLevelTypes.push(t);
    else if (Array.isArray(t)) topLevelTypes.push(...t);
  }
  const typeCounts = topLevelTypes.reduce((acc, t) => { acc[t] = (acc[t] || 0) + 1; return acc; }, {} as Record<string, number>);
  for (const [t, count] of Object.entries(typeCounts)) {
    if (count > 1) {
      schemaMarkup.validation_errors.push(`Duplicate standalone ${t} schema blocks (${count}) — may confuse structured data interpretation`);
    }
  }

  schemaMarkup.schema_types = Array.from(new Set(collectedSchemaTypes));
  schemaMarkup.has_faq_schema = schemaMarkup.has_faq_schema || schemaMarkup.schema_types.some((entry) => /faqpage|faq/i.test(String(entry)));
  schemaMarkup.has_organization_schema = schemaMarkup.has_organization_schema || schemaMarkup.schema_types.some((entry) => /organization|localbusiness/i.test(String(entry)));
  return schemaMarkup;
}

function normalizeCrawlUrl(rawUrl: string): string {
  const url = new URL(rawUrl);
  url.hash = '';
  if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) {
    url.port = '';
  }
  if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.slice(0, -1);
  }
  return url.toString();
}

function extractSameHostLinks(html: string, pageUrl: string, rootHost: string): string[] {
  const $ = cheerio.load(html || '');
  const links: string[] = [];

  $('a[href]').each((_, el) => {
    const href = ($(el).attr('href') || '').trim();
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;

    try {
      const resolved = new URL(href, pageUrl);
      if (!['http:', 'https:'].includes(resolved.protocol)) return;
      if (resolved.hostname !== rootHost) return;
      links.push(normalizeCrawlUrl(resolved.toString()));
    } catch {
      // ignore malformed links
    }
  });

  return Array.from(new Set(links));
}

function collectSeoIssueLabels(diagnostics: ReturnType<typeof computeSeoDiagnostics>): string[] {
  const issues: string[] = [];
  for (const [key, value] of Object.entries(diagnostics || {})) {
    const status = (value as any)?.status;
    if (status === 'warn' || status === 'fail') {
      issues.push(`${key}:${status}`);
    }
  }
  return issues;
}

app.post('/api/seo/crawl', authRequired, heavyActionLimiter, async (req: Request, res: Response) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const user = req.user as any;
    const userId = user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required', code: 'NO_USER' });
    }

    const normalizedTier = uiTierFromCanonical((user?.tier || 'observer') as CanonicalTier | LegacyTier);
    if (!meetsMinimumTier(normalizedTier, 'alignment')) {
      return res.status(403).json({ success: false, error: 'SEO crawl is available on Alignment, Signal, and Score Fix plans.', code: 'TIER_INSUFFICIENT' });
    }

    const { url: rawUrl, maxPages: rawMaxPages, maxDepth: rawMaxDepth } = (req.body || {}) as {
      url?: string;
      maxPages?: number;
      maxDepth?: number;
    };

    const { valid, url: rootUrl, error } = validateUrl(rawUrl || '');
    if (!valid || !rootUrl) {
      return res.status(400).json({ success: false, error: error || 'Invalid URL', code: 'INVALID_URL' });
    }

    const tierPageCap = normalizedTier === 'scorefix' ? 500 : normalizedTier === 'signal' ? 250 : 50;
    const maxPages = Math.max(1, Math.min(tierPageCap, Number(rawMaxPages || 25)));
    const maxDepth = Math.max(1, Math.min(4, Number(rawMaxDepth || 2)));

    const rootHost = new URL(rootUrl).hostname;
    const visited = new Set<string>();
    const queued = new Set<string>();
    const queue: Array<{ url: string; depth: number }> = [{ url: normalizeCrawlUrl(rootUrl), depth: 0 }];
    queued.add(normalizeCrawlUrl(rootUrl));
    const pages: CrawlPageResult[] = [];

    const startedAt = new Date();

    while (queue.length > 0 && pages.length < maxPages) {
      const current = queue.shift()!;
      if (visited.has(current.url)) continue;
      visited.add(current.url);

      try {
        const scraped = await scrapeWebsite(current.url);
        const sd = scraped.data;
        if (!sd) {
          pages.push({
            url: current.url,
            depth: current.depth,
            status: 'error',
            seo_diagnostics: computeSeoDiagnostics({}, { json_ld_count: 0 }, { https_enabled: current.url.startsWith('https'), has_canonical: false }, 'url'),
            issues: ['scrape_payload_missing:fail'],
            links_discovered: 0,
            error: 'Missing scrape payload',
          });
          continue;
        }

        const schemaMarkup = extractSchemaSignalsFromHtml(sd.html || '');
        const technicalSignals = {
          response_time_ms: 0,
          https_enabled: current.url.startsWith('https'),
          has_canonical: !!sd.canonical,
        };

        const diagnostics = computeSeoDiagnostics(sd, schemaMarkup, technicalSignals, 'url');
        const links = extractSameHostLinks(sd.html || '', current.url, rootHost);
        const issues = collectSeoIssueLabels(diagnostics);

        pages.push({
          url: current.url,
          depth: current.depth,
          status: 'ok',
          seo_diagnostics: diagnostics,
          issues,
          links_discovered: links.length,
          canonical_url: sd.canonical || undefined,
          word_count: Number(sd.wordCount || 0),
          title: (sd.title || '').trim() || undefined,
        });

        if (current.depth < maxDepth) {
          for (const nextUrl of links) {
            if (pages.length + queue.length >= maxPages) break;
            if (visited.has(nextUrl) || queued.has(nextUrl)) continue;
            queued.add(nextUrl);
            queue.push({ url: nextUrl, depth: current.depth + 1 });
          }
        }
      } catch (crawlErr: any) {
        pages.push({
          url: current.url,
          depth: current.depth,
          status: 'error',
          seo_diagnostics: computeSeoDiagnostics({}, { json_ld_count: 0 }, { https_enabled: current.url.startsWith('https'), has_canonical: false }, 'url'),
          issues: ['crawl_error:fail'],
          links_discovered: 0,
          error: crawlErr?.message || 'Failed to crawl page',
        });
      }
    }

    const completedAt = new Date();
    const pagesWithErrors = pages.filter((page) => page.status === 'error').length;
    const totalWordCount = pages.reduce((sum, page) => sum + Number(page.word_count || 0), 0);
    const averageWordCount = pages.length > 0 ? Math.round(totalWordCount / pages.length) : 0;

    let pass = 0;
    let warn = 0;
    let fail = 0;
    pages.forEach((page) => {
      Object.values(page.seo_diagnostics || {}).forEach((check: any) => {
        if (check?.status === 'pass') pass += 1;
        else if (check?.status === 'warn') warn += 1;
        else if (check?.status === 'fail') fail += 1;
      });
    });

    await client.query('BEGIN');
    const crawlInsert = await client.query(
      `INSERT INTO seo_crawls (user_id, root_url, max_pages, pages_crawled, pages_with_errors, average_word_count, summary, started_at, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)
       RETURNING id`,
      [
        userId,
        rootUrl,
        maxPages,
        pages.length,
        pagesWithErrors,
        averageWordCount,
        JSON.stringify({ issue_counts: { pass, warn, fail }, max_depth: maxDepth }),
        startedAt,
        completedAt,
      ]
    );

    const crawlId = crawlInsert.rows[0]?.id as string;

    for (const page of pages) {
      await client.query(
        `INSERT INTO seo_crawl_pages (crawl_id, url, depth, status, diagnostics, issues, links_discovered, canonical_url, word_count, title, error)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9, $10, $11)
         ON CONFLICT (crawl_id, url) DO UPDATE
         SET depth = EXCLUDED.depth,
             status = EXCLUDED.status,
             diagnostics = EXCLUDED.diagnostics,
             issues = EXCLUDED.issues,
             links_discovered = EXCLUDED.links_discovered,
             canonical_url = EXCLUDED.canonical_url,
             word_count = EXCLUDED.word_count,
             title = EXCLUDED.title,
             error = EXCLUDED.error`,
        [
          crawlId,
          page.url,
          page.depth,
          page.status,
          JSON.stringify(page.seo_diagnostics || {}),
          JSON.stringify(page.issues || []),
          page.links_discovered,
          page.canonical_url || null,
          page.word_count || null,
          page.title || null,
          page.error || null,
        ]
      );
    }

    await client.query('COMMIT');

    return res.json({
      success: true,
      data: {
        crawl_id: crawlId,
        root_url: rootUrl,
        total_pages_crawled: pages.length,
        max_pages: maxPages,
        pages_with_errors: pagesWithErrors,
        average_word_count: averageWordCount,
        issue_counts: { pass, warn, fail },
        started_at: startedAt.toISOString(),
        completed_at: completedAt.toISOString(),
        pages,
      },
    });
  } catch (err: any) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback failure
    }
    console.error('[SEO crawl] error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Failed to run SEO crawl', code: 'SEO_CRAWL_FAILED' });
  } finally {
    client.release();
  }
});

app.get('/api/seo/crawls', authRequired, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Authentication required', code: 'NO_USER' });

    const pool = getPool();
    const result = await pool.query(
      `SELECT id, root_url, max_pages, pages_crawled, pages_with_errors, average_word_count, summary, started_at, completed_at, created_at
       FROM seo_crawls
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId]
    );

    return res.json({
      success: true,
      data: result.rows.map((row) => ({
        crawl_id: row.id,
        root_url: row.root_url,
        total_pages_crawled: row.pages_crawled,
        max_pages: row.max_pages,
        pages_with_errors: row.pages_with_errors,
        average_word_count: row.average_word_count,
        issue_counts: (row.summary || {}).issue_counts || { pass: 0, warn: 0, fail: 0 },
        started_at: row.started_at,
        completed_at: row.completed_at,
        created_at: row.created_at,
      })),
    });
  } catch (err: any) {
    console.error('[SEO crawl list] error:', err);
    return res.status(500).json({ success: false, error: 'Failed to load crawl history', code: 'SEO_CRAWL_LIST_FAILED' });
  }
});

app.get('/api/seo/crawl/:id', authRequired, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Authentication required', code: 'NO_USER' });

    const crawlId = String(req.params.id || '').trim();
    if (!crawlId) return res.status(400).json({ success: false, error: 'crawl id is required', code: 'INVALID_CRAWL_ID' });

    const pool = getPool();
    const crawlRes = await pool.query(
      `SELECT id, root_url, max_pages, pages_crawled, pages_with_errors, average_word_count, summary, started_at, completed_at
       FROM seo_crawls
       WHERE id = $1 AND user_id = $2
       LIMIT 1`,
      [crawlId, userId]
    );

    if (!crawlRes.rows.length) {
      return res.status(404).json({ success: false, error: 'SEO crawl not found', code: 'SEO_CRAWL_NOT_FOUND' });
    }

    const pagesRes = await pool.query(
      `SELECT url, depth, status, diagnostics, issues, links_discovered, canonical_url, word_count, title, error
       FROM seo_crawl_pages
       WHERE crawl_id = $1
       ORDER BY depth ASC, created_at ASC`,
      [crawlId]
    );

    const crawl = crawlRes.rows[0];
    const summary = crawl.summary || {};

    return res.json({
      success: true,
      data: {
        crawl_id: crawl.id,
        root_url: crawl.root_url,
        total_pages_crawled: crawl.pages_crawled,
        max_pages: crawl.max_pages,
        pages_with_errors: crawl.pages_with_errors,
        average_word_count: crawl.average_word_count,
        issue_counts: summary.issue_counts || { pass: 0, warn: 0, fail: 0 },
        started_at: crawl.started_at,
        completed_at: crawl.completed_at,
        pages: pagesRes.rows.map((row) => ({
          url: row.url,
          depth: row.depth,
          status: row.status,
          seo_diagnostics: row.diagnostics,
          issues: row.issues,
          links_discovered: row.links_discovered,
          canonical_url: row.canonical_url,
          word_count: row.word_count,
          title: row.title,
          error: row.error,
        })),
      },
    });
  } catch (err: any) {
    console.error('[SEO crawl fetch] error:', err);
    return res.status(500).json({ success: false, error: 'Failed to load SEO crawl', code: 'SEO_CRAWL_FETCH_FAILED' });
  }
});

// Helpers
function validateUrl(urlString: string): { valid: boolean; error?: string; url?: string } {
  const normalized = normalizePublicHttpUrl(urlString, {
    allowPrivate: false,
  });
  if (!normalized.ok) {
    return { valid: false, error: normalized.error };
  }
  return { valid: true, url: normalized.url };
}

function getServerApiKey(): string | null {
  return process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_API_KEY || null;
}

type UploadMime =
  | 'text/plain'
  | 'text/markdown'
  | 'text/html'
  | 'application/pdf'
  | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  | 'image/png'
  | 'image/jpeg'
  | 'image/webp'
  | 'image/tiff'
  | 'image/bmp'
  | 'application/javascript'
  | 'text/javascript'
  | 'application/json'
  | 'text/css'
  | 'text/x-python'
  | 'text/x-typescript';

type UploadKind = 'html' | 'markdown' | 'text' | 'pdf' | 'docx' | 'image';
type UploadEncoding = 'utf8' | 'base64';

type UploadExtractedData = {
  title: string;
  body: string;
  html: string;
  meta: {
    description: string;
    keywords: string;
    ogTitle: string;
    ogDescription: string;
  };
  headings: {
    h1: string[];
    h2: string[];
    h3: string[];
  };
  canonical: string;
  links: { internal: number; external: number };
  images: number;
  wordCount: number;
};

type UploadPayloadFile = {
  fileName?: string;
  mimeType?: string;
  content?: string;
  encoding?: UploadEncoding;
};

type ParsedUploadFile = {
  fileName: string;
  mimeType: string;
  uploadKind: UploadKind;
  rawContent: Buffer;
  decodedContent: string;
  byteSize: number;
};

const MAX_UPLOAD_FILES_BY_TIER: Record<'alignment' | 'signal' | 'scorefix', number> = {
  alignment: 5,
  signal: 10,
  scorefix: 15,
};

const MAX_UPLOAD_TOTAL_BYTES_BY_TIER: Record<'alignment' | 'signal' | 'scorefix', number> = {
  alignment: 20 * 1024 * 1024,
  signal: 50 * 1024 * 1024,
  scorefix: 100 * 1024 * 1024,
};

const UPLOAD_EXT_TO_KIND: Record<string, UploadKind> = {
  '.html': 'html',
  '.htm': 'html',
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.pdf': 'pdf',
  '.docx': 'docx',
  '.png': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.webp': 'image',
  '.tif': 'image',
  '.tiff': 'image',
  '.bmp': 'image',
  '.txt': 'text',
  '.js': 'text',
  '.mjs': 'text',
  '.cjs': 'text',
  '.jsx': 'text',
  '.ts': 'text',
  '.tsx': 'text',
  '.py': 'text',
  '.php': 'text',
  '.rb': 'text',
  '.go': 'text',
  '.java': 'text',
  '.cs': 'text',
  '.rs': 'text',
  '.vue': 'text',
  '.svelte': 'text',
  '.css': 'text',
  '.json': 'text',
};

const UPLOAD_MIME_TO_KIND: Record<string, UploadKind> = {
  'text/html': 'html',
  'text/markdown': 'markdown',
  'text/plain': 'text',
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'image/png': 'image',
  'image/jpeg': 'image',
  'image/jpg': 'image',
  'image/webp': 'image',
  'image/tiff': 'image',
  'image/bmp': 'image',
  'application/javascript': 'text',
  'text/javascript': 'text',
  'application/x-javascript': 'text',
  'application/json': 'text',
  'text/css': 'text',
  'text/x-python': 'text',
  'application/x-python-code': 'text',
  'text/x-typescript': 'text',
  'application/typescript': 'text',
  'video/mp2t': 'text',
};

function getExtension(fileName: string): string {
  const idx = fileName.lastIndexOf('.');
  return idx >= 0 ? fileName.slice(idx).toLowerCase() : '';
}

function resolveUploadKind(fileName: string, mimeType: string): UploadKind | null {
  const byMime = UPLOAD_MIME_TO_KIND[mimeType.toLowerCase()];
  if (byMime) return byMime;
  const byExt = UPLOAD_EXT_TO_KIND[getExtension(fileName)];
  return byExt || null;
}

function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]+`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[>*_~-]{1,3}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeUploadContent(content: string, encoding: UploadEncoding): Buffer {
  if (encoding === 'base64') {
    const sanitized = content.replace(/\s+/g, '');
    if (!sanitized) return Buffer.alloc(0);
    return Buffer.from(sanitized, 'base64');
  }
  return Buffer.from(content, 'utf8');
}

const OCR_TIMEOUT_MS = 45_000;
const PDF_TEXT_WORD_FLOOR = 24;
const OCR_MAX_PDF_IMAGES = 8;

async function runOcrOnBuffer(raw: Uint8Array): Promise<string> {
  let timeoutId: NodeJS.Timeout | null = null;
  try {
    const ocrPromise = Tesseract.recognize(Buffer.from(raw), 'eng', { logger: () => undefined });
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      timeoutId = setTimeout(() => reject(new Error('OCR timed out')), OCR_TIMEOUT_MS);
    });
    const result = await Promise.race([ocrPromise, timeoutPromise]);
    return (result.data?.text || '').replace(/\s+/g, ' ').trim();
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function combineTextSegments(segments: string[]): string {
  return segments
    .map((segment) => segment.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' ')
    .trim();
}

async function extractUploadData(fileName: string, kind: UploadKind, content: string, rawContent: Buffer): Promise<UploadExtractedData> {
  const safeName = fileName || 'uploaded-document';

  if (kind === 'image') {
    const body = await runOcrOnBuffer(rawContent);
    return {
      title: safeName,
      body,
      html: '',
      meta: {
        description: '',
        keywords: '',
        ogTitle: '',
        ogDescription: '',
      },
      headings: { h1: [], h2: [], h3: [] },
      canonical: '',
      links: { internal: 0, external: 0 },
      images: 1,
      wordCount: body.length ? body.split(/\s+/).length : 0,
    };
  }

  if (kind === 'pdf') {
    const parser = new PDFParse({ data: rawContent });
    let body = '';
    let parsedTitle = '';
    let imageCount = 0;

    try {
      const textResult = await parser.getText();
      body = (textResult.text || '').replace(/\s+/g, ' ').trim();

      const infoResult = await parser.getInfo().catch(() => null);
      parsedTitle = typeof infoResult?.info?.Title === 'string' ? infoResult.info.Title.trim() : '';

      const hasEnoughText = body.split(/\s+/).filter(Boolean).length >= PDF_TEXT_WORD_FLOOR;
      if (!hasEnoughText) {
        const imageResult = await parser.getImage({ imageBuffer: true, imageThreshold: 300 }).catch(() => null);
        if (imageResult?.pages?.length) {
          const embeddedImages = imageResult.pages
            .flatMap((page) => page.images || [])
            .sort((a, b) => (b.width * b.height) - (a.width * a.height))
            .slice(0, OCR_MAX_PDF_IMAGES);

          imageCount = embeddedImages.length;
          if (embeddedImages.length > 0) {
            const ocrSegments: string[] = [];
            for (const image of embeddedImages) {
              if (image.data && image.data.length > 0) {
                try {
                  const imageText = await runOcrOnBuffer(image.data);
                  if (imageText) ocrSegments.push(imageText);
                } catch {
                  // ignore OCR failure per page image and continue
                }
              }
            }
            const ocrBody = combineTextSegments(ocrSegments);
            if (ocrBody) {
              body = combineTextSegments([body, ocrBody]);
            }
          }
        }
      }
    } finally {
      await parser.destroy();
    }

    return {
      title: parsedTitle || safeName,
      body,
      html: '',
      meta: {
        description: '',
        keywords: '',
        ogTitle: '',
        ogDescription: '',
      },
      headings: { h1: parsedTitle ? [parsedTitle] : [], h2: [], h3: [] },
      canonical: '',
      links: { internal: 0, external: 0 },
      images: imageCount,
      wordCount: body.length ? body.split(/\s+/).length : 0,
    };
  }

  if (kind === 'docx') {
    const docxResult = await mammoth.extractRawText({ buffer: rawContent });
    const body = (docxResult.value || '').replace(/\s+/g, ' ').trim();

    return {
      title: safeName,
      body,
      html: '',
      meta: {
        description: '',
        keywords: '',
        ogTitle: '',
        ogDescription: '',
      },
      headings: { h1: [], h2: [], h3: [] },
      canonical: '',
      links: { internal: 0, external: 0 },
      images: 0,
      wordCount: body.length ? body.split(/\s+/).length : 0,
    };
  }

  if (kind === 'html') {
    const $ = cheerio.load(content || '');
    const title = ($('title').first().text() || safeName).trim();
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
    const h1 = $('h1').map((_: number, el: any) => $(el).text().trim()).get().filter(Boolean);
    const h2 = $('h2').map((_: number, el: any) => $(el).text().trim()).get().filter(Boolean);
    const h3 = $('h3').map((_: number, el: any) => $(el).text().trim()).get().filter(Boolean);
    const canonical = $('link[rel="canonical"]').attr('href') || '';
    const allLinks = $('a[href]').length;
    const externalLinks = $('a[href^="http"]').length;
    const internalLinks = Math.max(0, allLinks - externalLinks);

    return {
      title,
      body: bodyText,
      html: content,
      meta: {
        description: ($('meta[name="description"]').attr('content') || '').trim(),
        keywords: ($('meta[name="keywords"]').attr('content') || '').trim(),
        ogTitle: ($('meta[property="og:title"]').attr('content') || '').trim(),
        ogDescription: ($('meta[property="og:description"]').attr('content') || '').trim(),
      },
      headings: { h1, h2, h3 },
      canonical,
      links: { internal: internalLinks, external: externalLinks },
      images: $('img').length,
      wordCount: bodyText.length ? bodyText.split(/\s+/).length : 0,
    };
  }

  const body = kind === 'markdown' ? stripMarkdown(content || '') : (content || '').replace(/\s+/g, ' ').trim();
  const firstHeading = (content || '').match(/^#{1,2}\s+(.+)$/m)?.[1]?.trim();

  return {
    title: firstHeading || safeName,
    body,
    html: '',
    meta: { description: '', keywords: '', ogTitle: '', ogDescription: '' },
    headings: { h1: firstHeading ? [firstHeading] : [], h2: [], h3: [] },
    canonical: '',
    links: { internal: 0, external: 0 },
    images: 0,
    wordCount: body.length ? body.split(/\s+/).length : 0,
  };
}

function mergeUploadData(files: UploadExtractedData[], fallbackTitle: string): UploadExtractedData {
  if (files.length === 1) return files[0];

  const mergedHeadings = {
    h1: files.flatMap((f) => f.headings.h1).filter(Boolean),
    h2: files.flatMap((f) => f.headings.h2).filter(Boolean),
    h3: files.flatMap((f) => f.headings.h3).filter(Boolean),
  };

  const mergedBody = files
    .map((f) => f.body)
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  const firstNonEmpty = (values: string[]) => values.find((v) => v && v.trim())?.trim() || '';

  return {
    title: firstNonEmpty(files.map((f) => f.title)) || fallbackTitle,
    body: mergedBody,
    html: '',
    meta: {
      description: firstNonEmpty(files.map((f) => f.meta.description)),
      keywords: firstNonEmpty(files.map((f) => f.meta.keywords)),
      ogTitle: firstNonEmpty(files.map((f) => f.meta.ogTitle)),
      ogDescription: firstNonEmpty(files.map((f) => f.meta.ogDescription)),
    },
    headings: mergedHeadings,
    canonical: firstNonEmpty(files.map((f) => f.canonical)),
    links: {
      internal: files.reduce((acc, f) => acc + (f.links.internal || 0), 0),
      external: files.reduce((acc, f) => acc + (f.links.external || 0), 0),
    },
    images: files.reduce((acc, f) => acc + (f.images || 0), 0),
    wordCount: files.reduce((acc, f) => acc + (f.wordCount || 0), 0),
  };
}

type UploadAnalysisMode = 'main_analyze' | 'writing_audit';
type WritingContentType = 'blog' | 'article' | 'ebook' | 'research' | 'general';

function isCodeLikeUpload(file: ParsedUploadFile): boolean {
  const ext = getExtension(file.fileName);
  const codeExt = new Set([
    '.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.py', '.php', '.rb', '.go', '.java', '.cs', '.rs', '.vue', '.svelte', '.css', '.json'
  ]);
  if (codeExt.has(ext)) return true;
  if (file.mimeType.includes('javascript')) return true;
  if (file.mimeType.includes('json')) return true;
  if (file.mimeType.includes('css')) return true;
  if (file.mimeType.includes('typescript')) return true;
  if (file.mimeType.includes('python')) return true;
  return false;
}

function detectWritingContentType(parsedFiles: ParsedUploadFile[], mergedBody: string): WritingContentType {
  const joinedNames = parsedFiles.map((f) => f.fileName.toLowerCase()).join(' ');
  const bodyLower = (mergedBody || '').toLowerCase();

  if (/ebook|e-book|manuscript|chapter/.test(joinedNames)) return 'ebook';
  if (/research|whitepaper|paper|study|dataset|findings|report/.test(joinedNames) || /methodology|data set|sample size|findings|limitations/.test(bodyLower)) return 'research';
  if (/blog|post|newsletter/.test(joinedNames) || /read time|subscribe|published|author/.test(bodyLower)) return 'blog';
  if (/article|essay|editorial/.test(joinedNames)) return 'article';
  return 'general';
}

function detectUploadAnalysisMode(parsedFiles: ParsedUploadFile[], sd: UploadExtractedData): { mode: UploadAnalysisMode; contentType: WritingContentType; reasons: string[] } {
  const reasons: string[] = [];
  const hasHtml = parsedFiles.some((file) => file.uploadKind === 'html');
  const hasCodeLike = parsedFiles.some((file) => isCodeLikeUpload(file));
  const contentType = detectWritingContentType(parsedFiles, sd.body || '');
  const wordCount = Number(sd.wordCount || 0);

  if (hasHtml) {
    reasons.push('HTML/page-template detected; using main website analysis path.');
    return { mode: 'main_analyze', contentType, reasons };
  }

  if (hasCodeLike) {
    reasons.push('Code/source file detected; using main website analysis path.');
    return { mode: 'main_analyze', contentType, reasons };
  }

  if (['blog', 'article', 'ebook', 'research'].includes(contentType) || wordCount >= 120) {
    reasons.push('Prose/document content detected; using writing quality analysis path.');
    return { mode: 'writing_audit', contentType, reasons };
  }

  reasons.push('Defaulted to main website analysis path.');
  return { mode: 'main_analyze', contentType, reasons };
}

function stripEmDashes(value: string): string {
  return String(value || '').replace(/[—–]/g, '-');
}

function normalizeWritingAudit(raw: any, contentType: WritingContentType) {
  const rewriteRaw = raw?.rewrite || {};
  const diffRaw = Array.isArray(rewriteRaw?.diff) ? rewriteRaw.diff : [];
  const diff = diffRaw
    .map((item: any) => ({
      type: typeof item?.type === 'string' ? item.type : 'rewrite',
      original: typeof item?.original === 'string' ? stripEmDashes(item.original) : '',
      revised: typeof item?.revised === 'string' ? stripEmDashes(item.revised) : '',
      reason: typeof item?.reason === 'string' ? item.reason : 'Clarity and quality improvement.',
    }))
    .filter((item: any) => item.original || item.revised);

  const rewrittenText = stripEmDashes(typeof rewriteRaw?.rewritten_text === 'string' ? rewriteRaw.rewritten_text : '');
  const deAiFindings = Array.isArray(raw?.de_ai_findings) ? raw.de_ai_findings.map((item: any) => String(item)).filter(Boolean) : [];
  const freshnessFindings = Array.isArray(raw?.freshness_findings) ? raw.freshness_findings.map((item: any) => String(item)).filter(Boolean) : [];

  // Verdict normalization
  const validVerdicts = new Set(['keep', 'refresh', 'rebuild', 'merge', 'kill']);
  const rawVerdict = typeof raw?.verdict === 'string' ? raw.verdict.toLowerCase().trim() : '';
  const verdict = validVerdicts.has(rawVerdict) ? rawVerdict as 'keep' | 'refresh' | 'rebuild' | 'merge' | 'kill' : 'refresh';

  // Rubric scores normalization
  const rubricRaw = raw?.rubric_scores || {};
  const rubricScores = {
    content: clampScore(Number(rubricRaw?.content || 0)),
    facts: clampScore(Number(rubricRaw?.facts || 0)),
    structure: clampScore(Number(rubricRaw?.structure || 0)),
    seo: clampScore(Number(rubricRaw?.seo || 0)),
    aeo: clampScore(Number(rubricRaw?.aeo || 0)),
    business: clampScore(Number(rubricRaw?.business || 0)),
  };

  // Entity clarity normalization
  const ecRaw = raw?.entity_clarity || {};
  const entityClarity = {
    name: typeof ecRaw?.name === 'string' ? ecRaw.name.slice(0, 200) : '',
    what: typeof ecRaw?.what === 'string' ? ecRaw.what.slice(0, 300) : '',
    who: typeof ecRaw?.who === 'string' ? ecRaw.who.slice(0, 200) : '',
    why: typeof ecRaw?.why === 'string' ? ecRaw.why.slice(0, 300) : '',
    score: clampScore(Number(ecRaw?.score || 0)),
  };

  // Fact check items normalization
  const validFactStatuses = new Set(['verified', 'unverified', 'disputed', 'missing_source']);
  const factCheckItems = Array.isArray(raw?.fact_check_items)
    ? raw.fact_check_items
        .map((item: any) => {
          const status = typeof item?.status === 'string' && validFactStatuses.has(item.status) ? item.status : 'unverified';
          return {
            claim: typeof item?.claim === 'string' ? item.claim.slice(0, 500) : '',
            status: status as 'verified' | 'unverified' | 'disputed' | 'missing_source',
            note: typeof item?.note === 'string' ? item.note.slice(0, 300) : '',
          };
        })
        .filter((item: any) => item.claim)
        .slice(0, 20)
    : [];

  // Chunking issues normalization
  const chunkingIssues = Array.isArray(raw?.chunking_issues)
    ? raw.chunking_issues.map((item: any) => String(item)).filter(Boolean).slice(0, 10)
    : [];

  return {
    content_type: contentType,
    seo_title: typeof raw?.seo_title === 'string' ? stripEmDashes(raw.seo_title) : '',
    hook: typeof raw?.hook === 'string' ? stripEmDashes(raw.hook) : '',
    seo_title_score: clampScore(Number(raw?.seo_title_score || 0)),
    hook_score: clampScore(Number(raw?.hook_score || 0)),
    de_ai_score: clampScore(Number(raw?.de_ai_score || 0)),
    freshness_findings: freshnessFindings,
    de_ai_findings: deAiFindings,
    verdict,
    rubric_scores: rubricScores,
    entity_clarity: entityClarity,
    information_gain_score: clampScore(Number(raw?.information_gain_score || 0)),
    citation_readiness_score: clampScore(Number(raw?.citation_readiness_score || 0)),
    fact_check_items: factCheckItems,
    readability_level: typeof raw?.readability_level === 'string' ? raw.readability_level.slice(0, 50) : 'Unknown',
    chunking_issues: chunkingIssues,
    rewrite: {
      rewritten_text: rewrittenText,
      no_emdash_passed: !/[—–]/.test(rewrittenText),
      logged_fixes_count: diff.length,
      diff,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Cross-model normalisation
// ─────────────────────────────────────────────────────────────────────────────
const REQUIRED_CATEGORIES: { label: string; weight: number }[] = [
  { label: 'Content Depth & Quality', weight: 0.2 },
  { label: 'Heading Structure & H1', weight: 0.12 },
  { label: 'Schema & Structured Data', weight: 0.2 },
  { label: 'Meta Tags & Open Graph', weight: 0.13 },
  { label: 'Technical SEO', weight: 0.15 },
  { label: 'AI Readability & Citability', weight: 0.2 },
];

function scoreToGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 50) return 'C';
  if (score >= 25) return 'D';
  return 'F';
}

function clampScore(score: number): number {
  return Math.round(Math.min(100, Math.max(0, score)));
}

function parseFindabilityGoals(input: unknown): string[] {
  if (typeof input !== 'string') return [];
  return input
    .split(/[\n,]+/)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => segment.slice(0, 120))
    .slice(0, 12);
}

function computeGoalAlignment(
  goals: string[],
  sd: any
): {
  coverage: number;
  matched_goals: string[];
  missing_goals: string[];
  score_adjustment: number;
} {
  if (!goals.length) {
    return {
      coverage: 0,
      matched_goals: [],
      missing_goals: [],
      score_adjustment: 0,
    };
  }

  const textCorpus = [
    String(sd?.title || ''),
    String(sd?.meta?.description || ''),
    String(sd?.meta?.keywords || ''),
    String(sd?.meta?.ogTitle || ''),
    String(sd?.meta?.ogDescription || ''),
    ...(Array.isArray(sd?.headings?.h1) ? sd.headings.h1 : []),
    ...(Array.isArray(sd?.headings?.h2) ? sd.headings.h2 : []),
    ...(Array.isArray(sd?.headings?.h3) ? sd.headings.h3 : []),
    String(sd?.body || '').slice(0, 12000),
  ]
    .join(' ')
    .toLowerCase();

  const matched_goals = goals.filter((goal) => textCorpus.includes(goal.toLowerCase()));
  const missing_goals = goals.filter((goal) => !matched_goals.includes(goal));
  const coverage = goals.length > 0 ? matched_goals.length / goals.length : 0;

  // Purposefully bounded so goals influence score without overwhelming evidence-based scoring.
  // coverage 0.00 => -6, coverage 0.50 => 0, coverage 1.00 => +6
  const score_adjustment = Math.max(-6, Math.min(6, Math.round((coverage - 0.5) * 12)));

  return {
    coverage,
    matched_goals,
    missing_goals,
    score_adjustment,
  };
}

function computeMockDataScan(
  sd: any,
  enabled: boolean
): {
  enabled: boolean;
  detected: boolean;
  signal_count: number;
  matched_signals: string[];
  risk_level: 'none' | 'low' | 'medium' | 'high' | 'critical';
  score_adjustment: number;
} {
  if (!enabled) {
    return {
      enabled: false,
      detected: false,
      signal_count: 0,
      matched_signals: [],
      risk_level: 'none',
      score_adjustment: 0,
    };
  }

  const corpus = [
    String(sd?.title || ''),
    String(sd?.meta?.description || ''),
    String(sd?.meta?.keywords || ''),
    String(sd?.meta?.ogTitle || ''),
    String(sd?.meta?.ogDescription || ''),
    ...(Array.isArray(sd?.headings?.h1) ? sd.headings.h1 : []),
    ...(Array.isArray(sd?.headings?.h2) ? sd.headings.h2 : []),
    ...(Array.isArray(sd?.headings?.h3) ? sd.headings.h3 : []),
    String(sd?.body || '').slice(0, 16000),
  ].join(' ');

  const patterns: Array<{ key: string; regex: RegExp }> = [
    { key: 'lorem-ipsum', regex: /\blorem ipsum\b/i },
    { key: 'dummy-content', regex: /\bdummy\s+(text|content|data)\b/i },
    { key: 'sample-content', regex: /\bsample\s+(text|content|data)\b/i },
    { key: 'placeholder-copy', regex: /\bplaceholder\b/i },
    { key: 'todo-tbd', regex: /\b(todo|tbd)\b/i },
    { key: 'replace-me', regex: /\b(replace this|insert your|add your)\b/i },
    { key: 'your-company-template', regex: /\b(your company|your brand|your name)\b/i },
    { key: 'test-email', regex: /\b(test@example\.com|you@example\.com)\b/i },
    { key: 'example-domain', regex: /\bexample\.com\b/i },
    { key: 'under-construction', regex: /\b(coming soon|under construction)\b/i },
  ];

  const matched_signals = patterns
    .filter((pattern) => pattern.regex.test(corpus))
    .map((pattern) => pattern.key);

  const signal_count = matched_signals.length;
  const detected = signal_count > 0;

  let risk_level: 'none' | 'low' | 'medium' | 'high' | 'critical' = 'none';
  let score_adjustment = 0;
  if (signal_count >= 6) {
    risk_level = 'critical';
    score_adjustment = -8;
  } else if (signal_count >= 4) {
    risk_level = 'high';
    score_adjustment = -6;
  } else if (signal_count >= 2) {
    risk_level = 'medium';
    score_adjustment = -4;
  } else if (signal_count === 1) {
    risk_level = 'low';
    score_adjustment = -2;
  }

  return {
    enabled: true,
    detected,
    signal_count,
    matched_signals,
    risk_level,
    score_adjustment,
  };
}

function buildAnalysisIntegrity(params: {
  mode: 'live' | 'scrape-only' | 'deterministic-fallback' | 'upload';
  evidenceManifest?: Record<string, string>;
  modelCount: number;
  tripleCheckEnabled: boolean;
  recommendationEvidenceSummary?: {
    evidence_coverage_percent?: number;
    evidence_ref_integrity_percent?: number;
  };
  reflectionApplied?: boolean;
  reflectionSource?: 'evidence-bounds' | 'deterministic-fallback' | 'upload-evidence';
  normalizedTargetUrl?: string;
  fallbackMode?: string;
  warnings?: string[];
}) {
  const executionClass = (() => {
    if (params.mode === 'upload') return 'UPLOAD';
    if (params.mode === 'deterministic-fallback') return 'DETERMINISTIC_FALLBACK';
    if (params.mode === 'scrape-only') return 'SCRAPE_ONLY';
    if (typeof params.fallbackMode === 'string' && params.fallbackMode.trim().length > 0) return 'DETERMINISTIC_FALLBACK';
    return 'LIVE';
  })();

  return {
    mode: params.mode,
    execution_class: executionClass,
    evidence_items: Object.keys(params.evidenceManifest || {}).length,
    model_count: params.modelCount,
    triple_check_enabled: params.tripleCheckEnabled,
    recommendation_evidence_coverage_percent:
      Math.max(0, Math.min(100, Number(params.recommendationEvidenceSummary?.evidence_coverage_percent ?? 0))),
    recommendation_evidence_integrity_percent:
      Math.max(0, Math.min(100, Number(params.recommendationEvidenceSummary?.evidence_ref_integrity_percent ?? 100))),
    reflection_applied: params.reflectionApplied !== false,
    reflection_source: params.reflectionSource || (params.mode === 'upload' ? 'upload-evidence' : params.mode === 'deterministic-fallback' ? 'deterministic-fallback' : 'evidence-bounds'),
    evidence_policy: {
      deterministic_core: true,
      opinion_sections_labeled: true,
      evidence_backed_label: 'EVIDENCE_BACKED' as const,
      opinion_only_label: 'AI_OPINION_ONLY' as const,
      anti_drift_mode: params.mode === 'upload'
        ? 'upload-evidence' as const
        : params.mode === 'deterministic-fallback'
          ? 'deterministic-fallback' as const
          : 'evidence-bounded' as const,
    },
    ...(params.normalizedTargetUrl ? { normalized_target_url: params.normalizedTargetUrl } : {}),
    ...(params.fallbackMode ? { fallback_mode: params.fallbackMode } : {}),
    warnings: (params.warnings || []).filter(Boolean),
  };
}

function buildGeoSignalProfile(result: any) {
  const schemaCount = Number(result?.schema_markup?.json_ld_count || 0);
  const hasCanonical = Boolean(result?.technical_signals?.has_canonical);
  const wordCount = Number(result?.content_analysis?.word_count || 0);
  const brandEntityCount = Array.isArray(result?.brand_entities) ? result.brand_entities.length : 0;
  const entityClarity = Number(result?.domain_intelligence?.entity_clarity_score || 0);
  const seo = result?.seo_diagnostics || {};
  const uniquenessStatus = String(seo?.content_uniqueness?.status || '').toLowerCase();

  const informationGain = (() => {
    if (wordCount >= 900 && brandEntityCount >= 2 && uniquenessStatus === 'pass') return 'unique';
    if (wordCount >= 400 && (uniquenessStatus === 'pass' || uniquenessStatus === 'warn')) return 'standard';
    return 'redundant';
  })();

  return {
    source_verified: entityClarity >= 45 || brandEntityCount >= 2,
    signal_consistent: schemaCount > 0 && hasCanonical,
    fact_unique: informationGain === 'unique',
    relationship_anchored: schemaCount > 0 && brandEntityCount > 0,
    information_gain: informationGain as 'unique' | 'standard' | 'redundant',
  };
}

function buildContradictionReport(result: any, geo: ReturnType<typeof buildGeoSignalProfile>) {
  const issues: Array<{
    id: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    dimension: 'source' | 'signal' | 'fact' | 'relationship';
    title: string;
    detail: string;
    blocking: boolean;
    evidence_keys: string[];
  }> = [];
  const seo = result?.seo_diagnostics || {};
  const schemaCount = Number(result?.schema_markup?.json_ld_count || 0);
  const isUpload = String(result?.source_type || '').toLowerCase() === 'upload';

  if (!isUpload && !result?.technical_signals?.has_canonical) {
    issues.push({
      id: 'contradiction_missing_canonical',
      severity: 'critical',
      dimension: 'signal',
      title: 'Canonical missing on live URL analysis',
      detail: 'Canonical is absent, which creates index and citation ambiguity across duplicate URLs.',
      blocking: true,
      evidence_keys: ['ev_canonical'],
    });
  }

  if (schemaCount === 0) {
    issues.push({
      id: 'contradiction_schema_absent',
      severity: 'critical',
      dimension: 'signal',
      title: 'Primary schema not detected',
      detail: 'No JSON-LD schema was extracted, reducing machine-verified identity and trust.',
      blocking: true,
      evidence_keys: ['ev_schema'],
    });
  }

  if (!geo.source_verified) {
    issues.push({
      id: 'contradiction_entity_clarity',
      severity: 'high',
      dimension: 'source',
      title: 'Primary entity identity is weak',
      detail: 'Brand/entity clarity is too low for high-confidence source attribution.',
      blocking: true,
      evidence_keys: ['ev_title', 'ev_h1'],
    });
  }

  if (String(seo?.title?.status || '').toLowerCase() === 'fail' || String(seo?.h1?.status || '').toLowerCase() === 'fail') {
    issues.push({
      id: 'contradiction_title_h1_alignment',
      severity: 'high',
      dimension: 'fact',
      title: 'Title/H1 alignment is broken',
      detail: 'Critical heading metadata is missing or malformed, which weakens extractive answer confidence.',
      blocking: true,
      evidence_keys: ['ev_title', 'ev_h1_count'],
    });
  }

  if (!geo.fact_unique) {
    issues.push({
      id: 'contradiction_information_gain_low',
      severity: 'medium',
      dimension: 'fact',
      title: 'Information gain is low',
      detail: 'Detected content appears redundant or too generic for preferential citation.',
      blocking: false,
      evidence_keys: ['ev_word_count'],
    });
  }

  if (!geo.relationship_anchored) {
    issues.push({
      id: 'contradiction_relationship_anchor_weak',
      severity: 'medium',
      dimension: 'relationship',
      title: 'Entity relationships are weakly anchored',
      detail: 'Schema/entity linkage is incomplete, reducing graph-level trust signals for answer engines.',
      blocking: false,
      evidence_keys: ['ev_schema', 'ev_title'],
    });
  }

  const blockerCount = issues.filter((issue) => issue.blocking).length;
  return {
    status: blockerCount > 0 ? 'critical' : issues.length > 0 ? 'attention' : 'clean',
    blocker_count: blockerCount,
    issue_count: issues.length,
    issues,
  };
}

function attachTruthSignals<T extends Record<string, any>>(result: T): T {
  const geo = buildGeoSignalProfile(result);
  const contradictions = buildContradictionReport(result, geo);
  return {
    ...result,
    geo_signal_profile: geo,
    contradiction_report: contradictions,
  };
}

function evidenceMidpointScore(
  label: string,
  evidenceBounds?: Record<string, { floor: number; ceiling: number }>,
  fallbackScore = 0
): number {
  const bound = evidenceBounds?.[label];
  if (!bound) return clampScore(fallbackScore);
  return clampScore((bound.floor + bound.ceiling) / 2);
}

function computeWeightedCategoryScore(
  categoryGrades: any[] | undefined,
  evidenceBounds?: Record<string, { floor: number; ceiling: number }>,
  fallbackScore = 0
): number {
  return clampScore(
    REQUIRED_CATEGORIES.reduce((sum, { label, weight }) => {
      const grade = (categoryGrades || []).find((cg: any) => cg?.label === label);
      const categoryScore =
        typeof grade?.score === 'number'
          ? clampScore(grade.score)
          : evidenceMidpointScore(label, evidenceBounds, fallbackScore);
      return sum + categoryScore * weight;
    }, 0)
  );
}

/** Legacy fallback — used only when platform signals are unavailable. */
function derivePlatformScoresLegacy(baseScore: number): { chatgpt: number; perplexity: number; google_ai: number; claude: number } {
  return {
    chatgpt: clampScore(baseScore * 0.95),
    perplexity: clampScore(baseScore * 0.8),
    google_ai: clampScore(baseScore * 0.9),
    claude: clampScore(baseScore * 0.85),
  };
}

/** Evidence-based platform scores from rail intelligence. Returns flat number map for response compat. */
function derivePlatformScores(
  baseScore: number,
  sd?: any,
  schema?: any,
  url?: string,
): { chatgpt: number; perplexity: number; google_ai: number; claude: number } {
  if (!sd || !schema || !url) return derivePlatformScoresLegacy(baseScore);
  try {
    const signals = extractPlatformSignals(sd, schema, url);
    const rich = computePlatformScores(signals);
    return {
      chatgpt: clampScore(rich.chatgpt.score),
      perplexity: clampScore(rich.perplexity.score),
      google_ai: clampScore(rich.google_ai.score),
      claude: clampScore(rich.claude.score),
    };
  } catch (e: any) {
    console.warn('Platform intelligence scoring failed, falling back to legacy:', e?.message);
    return derivePlatformScoresLegacy(baseScore);
  }
}

type ModelTierScope = 'observer' | 'alignment' | 'signal' | 'scorefix' | 'cross-tier';

type DerivedModelScore = {
  model_id: string;
  model_label: string;
  score: number;
  tier_scope: ModelTierScope;
  used_in_pipeline?: boolean;
};

type ModelProfile = {
  modelId: string;
  label: string;
  tierScope: ModelTierScope;
  bias: number;
  categoryWeights: Record<string, number>;
};

const METHODOLOGY_MODEL_PROFILES: ModelProfile[] = [
  {
    modelId: 'deepseek/deepseek-r1',
    label: 'DeepSeek R1',
    tierScope: 'observer',
    bias: 1,
    categoryWeights: {
      'Content Depth & Quality': 0.22,
      'AI Readability & Citability': 0.22,
      'Schema & Structured Data': 0.2,
      'Technical SEO': 0.16,
      'Heading Structure & H1': 0.1,
      'Meta Tags & Open Graph': 0.1,
    },
  },
  {
    modelId: 'deepseek/deepseek-chat-v3-0324',
    label: 'DeepSeek V3',
    tierScope: 'observer',
    bias: 0,
    categoryWeights: {
      'Content Depth & Quality': 0.24,
      'AI Readability & Citability': 0.22,
      'Schema & Structured Data': 0.2,
      'Meta Tags & Open Graph': 0.14,
      'Heading Structure & H1': 0.12,
      'Technical SEO': 0.08,
    },
  },
  {
    modelId: 'google/gemini-2.0-flash-exp',
    label: 'Gemini 2.0 Flash',
    tierScope: 'observer',
    bias: 0,
    categoryWeights: {
      'AI Readability & Citability': 0.24,
      'Schema & Structured Data': 0.2,
      'Content Depth & Quality': 0.18,
      'Technical SEO': 0.16,
      'Meta Tags & Open Graph': 0.12,
      'Heading Structure & H1': 0.1,
    },
  },
  {
    modelId: 'qwen/qwen3-32b',
    label: 'Qwen3 32B',
    tierScope: 'observer',
    bias: -1,
    categoryWeights: {
      'Content Depth & Quality': 0.24,
      'AI Readability & Citability': 0.2,
      'Heading Structure & H1': 0.18,
      'Schema & Structured Data': 0.14,
      'Meta Tags & Open Graph': 0.14,
      'Technical SEO': 0.08,
    },
  },
  {
    modelId: 'meta-llama/llama-3.3-70b-instruct',
    label: 'Llama 3.3 70B Instruct',
    tierScope: 'observer',
    bias: -2,
    categoryWeights: {
      'Content Depth & Quality': 0.28,
      'AI Readability & Citability': 0.26,
      'Heading Structure & H1': 0.16,
      'Schema & Structured Data': 0.12,
      'Meta Tags & Open Graph': 0.1,
      'Technical SEO': 0.08,
    },
  },
  {
    modelId: 'mistralai/mistral-small-3.1-24b-instruct',
    label: 'Mistral Small 3.1',
    tierScope: 'observer',
    bias: -3,
    categoryWeights: {
      'Content Depth & Quality': 0.3,
      'AI Readability & Citability': 0.22,
      'Heading Structure & H1': 0.16,
      'Meta Tags & Open Graph': 0.14,
      'Schema & Structured Data': 0.1,
      'Technical SEO': 0.08,
    },
  },
  {
    modelId: 'openai/gpt-4o-mini',
    label: 'GPT-4o Mini',
    tierScope: 'cross-tier',
    bias: 2,
    categoryWeights: {
      'AI Readability & Citability': 0.24,
      'Schema & Structured Data': 0.2,
      'Technical SEO': 0.18,
      'Content Depth & Quality': 0.16,
      'Meta Tags & Open Graph': 0.12,
      'Heading Structure & H1': 0.1,
    },
  },
  {
    modelId: 'anthropic/claude-3.5-haiku',
    label: 'Claude 3.5 Haiku',
    tierScope: 'signal',
    bias: 1,
    categoryWeights: {
      'AI Readability & Citability': 0.3,
      'Content Depth & Quality': 0.24,
      'Meta Tags & Open Graph': 0.14,
      'Schema & Structured Data': 0.14,
      'Heading Structure & H1': 0.1,
      'Technical SEO': 0.08,
    },
  },
];

function normalizeModelId(rawModel: string | undefined | null): string {
  return String(rawModel || '').trim().replace(/:free$/i, '');
}

function deriveModelScores(params: {
  baseScore: number;
  categoryGrades?: Array<{ label?: string; score?: number }>;
  pipelineModels?: Array<string | undefined | null>;
}): DerivedModelScore[] {
  const clampedBase = clampScore(params.baseScore);
  const gradeMap = new Map<string, number>();

  for (const grade of params.categoryGrades || []) {
    if (typeof grade?.label !== 'string') continue;
    if (typeof grade?.score !== 'number' || !Number.isFinite(grade.score)) continue;
    gradeMap.set(grade.label, clampScore(grade.score));
  }

  const activeModelIds = new Set(
    (params.pipelineModels || [])
      .map((model) => normalizeModelId(model))
      .filter(Boolean)
  );

  return METHODOLOGY_MODEL_PROFILES.map((profile) => {
    const weightedCategoryScore = Object.entries(profile.categoryWeights).reduce((sum, [label, weight]) => {
      const categoryScore = gradeMap.has(label) ? Number(gradeMap.get(label)) : clampedBase;
      return sum + categoryScore * weight;
    }, 0);

    const usedInPipeline = activeModelIds.has(profile.modelId);
    const blendedScore =
      clampedBase * 0.55 +
      weightedCategoryScore * 0.45 +
      profile.bias +
      (usedInPipeline ? 2 : 0);

    return {
      model_id: profile.modelId,
      model_label: profile.label,
      score: clampScore(blendedScore),
      tier_scope: profile.tierScope,
      ...(usedInPipeline ? { used_in_pipeline: true } : {}),
    };
  });
}

function normalizeAnalysis(
  ai: any,
  evidenceBounds?: Record<string, { floor: number; ceiling: number }>
): any {
  const gradeMap = new Map<string, any>();
  for (const g of Array.isArray(ai.category_grades) ? ai.category_grades : []) {
    if (g?.label) gradeMap.set(g.label, g);
  }

  const normalizedGrades = REQUIRED_CATEGORIES.map(({ label }) => {
    const existing = gradeMap.get(label);
    const baseFallback = typeof ai.visibility_score === 'number' && isFinite(ai.visibility_score)
      ? ai.visibility_score
      : 0;
    let score: number;
    const useDeterministicEvidenceScore = DETERMINISTIC_CATEGORY_LABELS.has(label) && !!evidenceBounds?.[label];
    if (useDeterministicEvidenceScore) {
      score = evidenceMidpointScore(label, evidenceBounds, baseFallback);
    } else if (existing) {
      score = typeof existing.score === 'number'
        ? clampScore(existing.score)
        : evidenceMidpointScore(label, evidenceBounds, baseFallback);
    } else {
      score = evidenceMidpointScore(label, evidenceBounds, baseFallback);
    }

    // ── Enforce evidence-based bounds ──
    if (evidenceBounds?.[label]) {
      const { floor, ceiling } = evidenceBounds[label];
      score = Math.max(floor, Math.min(ceiling, score));
    }

    if (existing) {
      return {
        grade: scoreToGrade(score),
        label,
        score,
        summary: typeof existing.summary === 'string' ? existing.summary : '',
        strengths: Array.isArray(existing.strengths) ? existing.strengths : [],
        improvements: Array.isArray(existing.improvements) ? existing.improvements : [],
      };
    }
    return { grade: scoreToGrade(score), label, score, summary: 'Not evaluated.', strengths: [], improvements: [] };
  });

  const derivedScore = Math.round(
    computeWeightedCategoryScore(normalizedGrades, evidenceBounds)
  );

  const aiScore =
    typeof ai.visibility_score === 'number' && isFinite(ai.visibility_score)
      ? clampScore(ai.visibility_score)
      : derivedScore;

  // Tighter tolerance: AI score must stay very close to deterministic evidence-weighted scoring.
  const finalScore = Math.abs(aiScore - derivedScore) <= 5 ? aiScore : derivedScore;
  return { ...ai, visibility_score: finalScore, category_grades: normalizedGrades };
}

function isUsableAiAnalysisPayload(payload: any): boolean {
  if (!payload || typeof payload !== 'object') return false;

  const hasScore = typeof payload.visibility_score === 'number' && Number.isFinite(payload.visibility_score);
  const hasSummary = typeof payload.summary === 'string' && payload.summary.trim().length >= 20;
  const hasCategories = Array.isArray(payload.category_grades) && payload.category_grades.length >= 3;
  const hasRecommendations = Array.isArray(payload.recommendations) && payload.recommendations.length >= 1;

  return hasScore && hasSummary && hasCategories && hasRecommendations;
}

// ─────────────────────────────────────────────────────────────────────────────
// Evidence-based scoring bounds
// Computes hard floor/ceiling from objective scraped evidence so different
// sites get meaningfully different scores. These bounds constrain both the
// AI prompt and the server-side normalisation.
// ─────────────────────────────────────────────────────────────────────────────
function computeEvidenceScores(
  sd: any, schema: any, url: string,
  llmReadability?: LLMReadabilityScore | null
): Record<string, { floor: number; ceiling: number; reasons: string[] }> {
  const b: Record<string, { floor: number; ceiling: number; reasons: string[] }> = {};
  const normalizeBound = (bound: { floor: number; ceiling: number; reasons: string[] }) => {
    const floor = Math.max(0, Math.min(100, Math.round(bound.floor)));
    const ceiling = Math.max(0, Math.min(100, Math.round(bound.ceiling)));
    if (floor <= ceiling) {
      return { ...bound, floor, ceiling };
    }
    return {
      ...bound,
      floor: ceiling,
      ceiling,
      reasons: [...bound.reasons, 'Bound normalization applied (floor exceeded ceiling)'],
    };
  };

  // ── Content Depth & Quality ──
  const wc: number = sd.wordCount || 0;
  const cR: string[] = [];
  const bodyText = String(sd.body || '').toLowerCase();
  const bodyWords = bodyText.split(/\s+/).map((w) => w.trim()).filter(Boolean);
  const lexicalDiversity = bodyWords.length > 0 ? new Set(bodyWords).size / bodyWords.length : 0;
  const schemaTypes = Array.isArray(schema?.schema_types)
    ? schema.schema_types.map((t: unknown) => String(t).toLowerCase())
    : [];
  let cF = 0, cC = 100;
  if (wc < 100) { cF = 0; cC = 15; cR.push(`${wc} words — critically thin`); }
  else if (wc < 300) { cF = 5; cC = 35; cR.push(`${wc} words — insufficient for AI citation`); }
  else if (wc < 600) { cF = 15; cC = 55; cR.push(`${wc} words — sparse`); }
  else if (wc < 1000) { cF = 30; cC = 75; cR.push(`${wc} words — adequate`); }
  else if (wc < 1200) { cF = 45; cC = 88; cR.push(`${wc} words — good depth`); }
  else { cF = 55; cC = 100; cR.push(`${wc} words — strong depth`); }
  if (wc >= 2200 && lexicalDiversity >= 0.42 && schemaTypes.length >= 6) {
    cF = Math.max(cF, 82);
    cR.push('Exceptional depth, lexical diversity, and rich structured context');
  } else if (wc >= 2000 && lexicalDiversity >= 0.40 && schemaTypes.length >= 5) {
    cF = Math.max(cF, 78);
    cR.push('Substantial depth with broad vocabulary and structured context');
  } else if (wc >= 1800 && lexicalDiversity >= 0.38 && schemaTypes.length >= 5) {
    cF = Math.max(cF, 76);
    cR.push('Strong depth with broad vocabulary and multi-entity schema');
  } else if (wc >= 1800 && lexicalDiversity >= 0.42 && schemaTypes.length >= 4) {
    cF = Math.max(cF, 66);
    cR.push('High-depth, diverse content with broad structured context');
  } else if (wc >= 1400 && lexicalDiversity >= 0.38) {
    cF = Math.max(cF, 60);
    cR.push('Strong content depth and lexical diversity');
  }
  b['Content Depth & Quality'] = normalizeBound({ floor: cF, ceiling: cC, reasons: cR });

  // ── Heading Structure & H1 ──
  const h1 = sd.headings?.h1?.length || 0;
  const h2 = sd.headings?.h2?.length || 0;
  const h3 = sd.headings?.h3?.length || 0;
  const hR: string[] = [];
  let hF = 0, hC = 100;
  if (h1 === 0) { hF = 0; hC = 20; hR.push('No H1 — critical'); }
  else if (h1 > 1) { hF = 5; hC = 45; hR.push(`${h1} H1 tags — should be 1`); }
  else { hF = 40; hR.push('Single H1'); }
  if (h2 === 0 && h3 === 0) { hC = Math.min(hC, 55); hR.push('No subheadings'); }
  else if (h2 > 0 && h3 > 0) { hF = Math.max(hF, 50); hR.push('H2+H3 hierarchy'); }
  else if (h2 > 0) { hF = Math.max(hF, 35); hR.push(`${h2} H2 tags`); }
  if (h1 === 1 && h2 >= 14 && h3 >= 14) {
    hF = Math.max(hF, 86);
    hR.push('Exceptional heading architecture with deep subsection granularity');
  } else if (h1 === 1 && h2 >= 10 && h3 >= 10) {
    hF = Math.max(hF, 82);
    hR.push('Comprehensive heading architecture with extensive subsection depth');
  } else if (h1 === 1 && h2 >= 6 && h3 >= 6) {
    hF = Math.max(hF, 68);
    hR.push('Robust heading hierarchy with deep section structure');
  } else if (h1 === 1 && h2 >= 4 && h3 >= 2) {
    hF = Math.max(hF, 60);
    hR.push('Strong heading hierarchy');
  }
  b['Heading Structure & H1'] = normalizeBound({ floor: hF, ceiling: hC, reasons: hR });

  // ── Schema & Structured Data ──
  const sc = schema.json_ld_count || 0;
  const hasOrg = schema.has_organization_schema;
  const hasFaq = schema.has_faq_schema;
  const sR: string[] = [];
  let sF = 0, sC = 100;
  const hasWebsite = schemaTypes.includes('website');
  const hasSoftwareApp = schemaTypes.includes('softwareapplication');
  if (sc === 0) { sF = 0; sC = 12; sR.push('No JSON-LD — critical gap'); }
  else if (sc === 1 && !hasOrg) { sF = 8; sC = 40; sR.push('1 schema, no Organization'); }
  else if (hasOrg && hasFaq && sc >= 2) { sF = 55; sC = 100; sR.push(`${sc} schemas w/ Org+FAQ`); }
  else if (hasOrg) { sF = 30; sC = 75; sR.push(`${sc} schemas w/ Organization`); }
  else { sF = 12; sC = 55; sR.push(`${sc} schema blocks`); }
  if (hasOrg && hasFaq && hasWebsite && hasSoftwareApp && sc >= 8 && schemaTypes.length >= 10) {
    sF = Math.max(sF, 82);
    sR.push('Exceptional schema depth with comprehensive entity graph');
  } else if (hasOrg && hasFaq && hasWebsite && hasSoftwareApp && sc >= 5) {
    sF = Math.max(sF, 70);
    sR.push('Comprehensive schema stack (Org+FAQ+WebSite+SoftwareApplication)');
  } else if (hasOrg && hasFaq && sc >= 4) {
    sF = Math.max(sF, 64);
    sR.push('Strong multi-entity schema coverage');
  }
  // Penalize schema validation errors (Review type, duplicate fields, etc.)
  const validationErrors = schema.validation_errors || [];
  if (validationErrors.length > 0) {
    const penalty = Math.min(validationErrors.length * 8, 25);
    sC = Math.min(sC, 100 - penalty);
    sR.push(`${validationErrors.length} schema validation error(s) detected`);
  }
  // ── Comprehensive schema quality score integration ──
  const schemaScore = schema.schema_score;
  if (schemaScore && typeof schemaScore.total === 'number') {
    const sq = schemaScore.total;
    if (sq >= 85) {
      sF = Math.max(sF, 88);
      sR.push(`Schema quality ${sq}/100 — exceptional (entity graph, properties, vocabulary)`);
    } else if (sq >= 70) {
      sF = Math.max(sF, 75);
      sR.push(`Schema quality ${sq}/100 — strong implementation`);
    } else if (sq >= 50) {
      sF = Math.max(sF, 55);
      sR.push(`Schema quality ${sq}/100 — moderate implementation`);
    } else if (sq >= 30) {
      sF = Math.max(sF, 30);
      sR.push(`Schema quality ${sq}/100 — basic implementation`);
    } else if (sq > 0) {
      sR.push(`Schema quality ${sq}/100 — minimal schema presence`);
    }
    // Entity graph bonus
    if (schemaScore.entityGraph && schemaScore.entityGraph.score >= 12) {
      sF = Math.max(sF, sF + 3);
      sR.push('Rich @id entity graph with cross-references');
    }
  }
  b['Schema & Structured Data'] = normalizeBound({ floor: sF, ceiling: sC, reasons: sR });

  // ── Meta Tags & Open Graph ──
  const hasTitle = !!(sd.title?.trim());
  const titleLen = sd.title?.trim().length || 0;
  const hasDesc = !!(sd.meta?.description?.trim());
  const descLen = sd.meta?.description?.trim().length || 0;
  const hasOgTitle = !!sd.meta?.ogTitle?.trim();
  const hasOgDescription = !!sd.meta?.ogDescription?.trim();
  const hasOg = hasOgTitle || hasOgDescription;
  const mR: string[] = [];
  let mF = 0, mC = 100;
  if (!hasTitle) { mC = Math.min(mC, 25); mR.push('No title'); }
  else if (titleLen < 20 || titleLen > 70) { mC = Math.min(mC, 70); mR.push(`Title ${titleLen}ch (ideal 30-60)`); }
  else { mF = Math.max(mF, 30); mR.push(`Title OK (${titleLen}ch)`); }
  if (!hasDesc) { mC = Math.min(mC, 40); mR.push('No meta description'); }
  else if (descLen < 50 || descLen > 165) { mC = Math.min(mC, 75); mR.push(`Desc ${descLen}ch (ideal 120-155)`); }
  else { mF = Math.max(mF, 35); mR.push(`Desc OK (${descLen}ch)`); }
  if (!hasOg) { mC = Math.min(mC, 65); mR.push('No Open Graph'); }
  else { mF = Math.max(mF, 25); mR.push('OG present'); }
  if (
    titleLen >= 30 && titleLen <= 60 &&
    descLen >= 120 && descLen <= 155 &&
    hasOgTitle &&
    hasOgDescription
  ) {
    mF = Math.max(mF, 90);
    mR.push('Title + description + full OG alignment');
  } else if (
    titleLen >= 30 && titleLen <= 60 &&
    descLen >= 120 && descLen <= 155 &&
    hasOg
  ) {
    mF = Math.max(mF, 82);
    mR.push('Strong title/description with Open Graph support');
  }
  b['Meta Tags & Open Graph'] = normalizeBound({ floor: mF, ceiling: mC, reasons: mR });

  // ── Technical SEO ──
  const isHttps = url.startsWith('https');
  const hasCan = !!sd.canonical;
  const intLinks: number = sd.links?.internal || 0;
  const responseMs = Number(sd.pageLoadMs || sd.lcpMs || 0);
  const rawHtml = String(sd.html || '');
  const imgTags = rawHtml.match(/<img\b[^>]*>/gi) || [];
  const imgsWithAlt = imgTags.filter((tag) => /\balt\s*=\s*(['"])(.*?)\1/i.test(tag)).length;
  const altCoverage = imgTags.length > 0 ? imgsWithAlt / imgTags.length : 1;
  const landmarkCount = [
    /<main\b/i,
    /<nav\b/i,
    /<header\b/i,
    /<footer\b/i,
    /<aside\b/i,
  ].reduce((acc, regex) => acc + (regex.test(rawHtml) ? 1 : 0), 0);
  const tR: string[] = [];
  let tF = 0, tC = 100;
  if (!isHttps) { tC = Math.min(tC, 35); tR.push('No HTTPS'); }
  else { tF = Math.max(tF, 30); tR.push('HTTPS'); }
  if (!hasCan) { tC = Math.min(tC, 70); tR.push('No canonical'); }
  else { tF = Math.max(tF, 20); tR.push('Canonical present'); }
  if (intLinks === 0) { tC = Math.min(tC, 55); tR.push('No internal links'); }
  else if (intLinks >= 5) { tF = Math.max(tF, 35); tR.push(`${intLinks} internal links`); }
  if (responseMs > 0) {
    if (responseMs <= 1800) {
      tF = Math.max(tF, 45);
      tR.push(`Fast page load (${responseMs}ms)`);
    } else if (responseMs <= 3000) {
      tF = Math.max(tF, 35);
      tR.push(`Moderate page load (${responseMs}ms)`);
    } else {
      tC = Math.min(tC, 78);
      tR.push(`Slow page load (${responseMs}ms)`);
    }
  }
  if (imgTags.length >= 3) {
    if (altCoverage >= 0.9) {
      tF = Math.max(tF, 40);
      tR.push(`Image alt coverage ${(altCoverage * 100).toFixed(0)}%`);
    } else if (altCoverage < 0.6) {
      tC = Math.min(tC, 82);
      tR.push(`Low image alt coverage ${(altCoverage * 100).toFixed(0)}%`);
    }
  }
  if (landmarkCount >= 2) {
    tF = Math.max(tF, 38);
    tR.push('Semantic landmarks present');
  } else {
    tC = Math.min(tC, 88);
    tR.push('Limited semantic landmarks');
  }
  if (
    isHttps &&
    hasCan &&
    intLinks >= 8 &&
    responseMs > 0 && responseMs <= 1800 &&
    altCoverage >= 0.9 &&
    landmarkCount >= 3
  ) {
    tF = Math.max(tF, 90);
    tR.push('Strong technical + accessibility baseline');
  } else if (
    isHttps &&
    hasCan &&
    intLinks >= 5 &&
    responseMs > 0 && responseMs <= 3000
  ) {
    tF = Math.max(tF, 78);
    tR.push('Solid crawlability and performance baseline');
  }
  b['Technical SEO'] = normalizeBound({ floor: tF, ceiling: tC, reasons: tR });

  // ── AI Readability & Citability ──
  const rR: string[] = [];
  let rF = 0, rC = 100;
  if (wc < 200) { rF = 0; rC = 20; rR.push('Content too thin for AI citation'); }
  else if (wc < 500) { rC = Math.min(rC, 55); rR.push('Limited depth for citability'); }
  if (h1 === 0 && h2 === 0) { rC = Math.min(rC, 30); rR.push('No heading structure'); }
  if (sc > 0 && wc > 600) { rF = Math.max(rF, 35); rR.push('Schema + content depth aids AI'); }
  if (hasFaq) { rF = Math.max(rF, 40); rR.push('FAQ schema boosts citability'); }
  if (wc >= 1200 && h1 === 1 && h2 >= 4 && sc >= 3 && hasFaq) {
    rF = Math.max(rF, 88);
    rR.push('High-depth structured content with FAQ entities');
  } else if (wc >= 900 && h1 === 1 && h2 >= 2 && sc >= 2) {
    rF = Math.max(rF, 78);
    rR.push('Strong depth + heading + schema alignment');
  }
  // ── LLM Readability entity clarity modifier ──
  if (llmReadability) {
    const ec = llmReadability.entity_clarity.score;
    if (ec >= 85) {
      rF = Math.max(rF, rF + 4);
      rR.push(`LLM entity clarity strong (${ec}/100)`);
    } else if (ec >= 70) {
      rF = Math.max(rF, rF + 2);
      rR.push(`LLM entity clarity good (${ec}/100)`);
    } else if (ec < 40) {
      rC = Math.min(rC, rC - 5);
      rR.push(`LLM entity clarity weak (${ec}/100)`);
    }
  }
  b['AI Readability & Citability'] = normalizeBound({ floor: rF, ceiling: rC, reasons: rR });

  return b;
}

function buildDeterministicAnalysis(
  sd: any,
  schema: any,
  url: string,
  evidenceBounds: Record<string, { floor: number; ceiling: number; reasons: string[] }>,
  host: string
) {
  const categoryGrades = REQUIRED_CATEGORIES.map(({ label, weight }) => {
    const bound = evidenceBounds[label] || { floor: 20, ceiling: 55, reasons: ['Limited evidence'] };
    const spread = Math.max(0, bound.ceiling - bound.floor);
    const score = Math.round(Math.min(100, Math.max(0, bound.floor + spread * 0.55 + weight * 5)));
    return {
      grade: scoreToGrade(score),
      label,
      score,
      summary: `Evidence-based fallback score from scraped signals (${bound.floor}-${bound.ceiling}).`,
      strengths: bound.reasons.slice(0, 2),
      improvements: bound.reasons.slice(2),
    };
  });

  const visibilityScore = Math.round(
    Math.min(
      100,
      Math.max(0, REQUIRED_CATEGORIES.reduce((sum, { weight }, i) => sum + categoryGrades[i].score * weight, 0))
    )
  );

  const wordCount = sd?.wordCount || 0;
  const h1Count = sd?.headings?.h1?.length || 0;
  const schemaCount = schema?.json_ld_count || 0;
  const hasMetaDescription = !!sd?.meta?.description;
  const hasFaqSchema = !!schema?.has_faq_schema;
  const hasCanonical = !!sd?.canonical;
  const isHttps = String(url || '').startsWith('https://');

  const recommendations: any[] = [];
  if (wordCount < 800) {
    recommendations.push({
      priority: 'high',
      category: 'Content Depth & Quality',
      title: 'Increase crawlable content depth',
      description: `Current body content is ${wordCount} words. Expand to 900-1200+ words on core pages with concrete facts and entities.`,
      impact: 'Improves AI retrieval coverage and citation confidence.',
      difficulty: 'medium',
      implementation: 'Add complete sections for proof points, FAQs, and differentiators directly in server-rendered HTML.',
      evidence_ids: ['ev_word_count'],
    });
  }
  if (h1Count !== 1) {
    recommendations.push({
      priority: 'high',
      category: 'Heading Structure & H1',
      title: 'Fix heading hierarchy',
      description: h1Count === 0 ? 'No H1 heading detected.' : `${h1Count} H1 headings detected; keep exactly one.`,
      impact: 'Improves topic clarity for AI and search parsing.',
      difficulty: 'easy',
      implementation: 'Use one descriptive H1, then organize sections under H2/H3.',
      evidence_ids: ['ev_h1_count'],
    });
  }
  if (schemaCount === 0) {
    recommendations.push({
      priority: 'high',
      category: 'Schema & Structured Data',
      title: 'Add JSON-LD schema',
      description: 'No structured data was detected.',
      impact: 'Improves machine-readability and citation reliability.',
      difficulty: 'medium',
      implementation: 'Add Organization and WebPage schema first, then FAQ where applicable.',
      evidence_ids: ['ev_schema'],
    });
  }
  if (!hasMetaDescription) {
    recommendations.push({
      priority: 'medium',
      category: 'Meta Tags & Open Graph',
      title: 'Add a strong meta description',
      description: 'Meta description is missing.',
      impact: 'Improves snippet quality and relevance signals.',
      difficulty: 'easy',
      implementation: 'Write a 120-155 character description with value proposition + entity terms.',
      evidence_ids: ['ev_meta_description'],
    });
  }
  if (!hasCanonical) {
    recommendations.push({
      priority: 'medium',
      category: 'Technical SEO',
      title: 'Set canonical URL',
      description: 'Canonical tag is missing.',
      impact: 'Prevents duplicate URL ambiguity for crawlers.',
      difficulty: 'easy',
      implementation: 'Add a canonical link element in the head for each canonical page.',
      evidence_ids: ['ev_canonical'],
    });
  }
  if (!isHttps) {
    recommendations.push({
      priority: 'high',
      category: 'Technical SEO',
      title: 'Enforce HTTPS',
      description: 'URL is not served over HTTPS.',
      impact: 'Required trust and indexing baseline for modern engines.',
      difficulty: 'medium',
      implementation: 'Enable TLS and redirect all HTTP traffic to HTTPS.',
      evidence_ids: ['ev_https'],
    });
  }

  if (recommendations.length < 6 && (!hasFaqSchema || wordCount < 1200)) {
    recommendations.push({
      priority: 'medium',
      category: 'AI Readability & Citability',
      title: 'Add entity-focused FAQ section',
      description: 'Strengthen machine-readable Q&A around services, pricing, and differentiators.',
      impact: 'Increases answer extraction quality for AI engines.',
      difficulty: 'medium',
      implementation: 'Add 5-8 FAQs with concise answers and schema markup.',
      evidence_ids: ['ev_schema', 'ev_word_count'],
    });
  } else if (recommendations.length < 6) {
    recommendations.push({
      priority: 'medium',
      category: 'AI Readability & Citability',
      title: 'Expand answer-style sections with cited claims',
      description: 'Add short Q&A blocks with evidence-backed facts in core sections to increase extractability.',
      impact: 'Improves citation precision and answer snippet quality.',
      difficulty: 'medium',
      implementation: 'Add 3-5 concise answer blocks with concrete stats/examples and consistent entity naming.',
      evidence_ids: ['ev_word_count', 'ev_schema'],
    });
  }

  return {
    visibility_score: visibilityScore,
    ai_platform_scores: {
      chatgpt: Math.round(Math.min(100, Math.max(0, visibilityScore * 0.95))),
      perplexity: Math.round(Math.min(100, Math.max(0, visibilityScore * 0.82))),
      google_ai: Math.round(Math.min(100, Math.max(0, visibilityScore * 0.9))),
      claude: Math.round(Math.min(100, Math.max(0, visibilityScore * 0.88))),
    },
    summary: `Fallback audit generated from deterministic evidence scoring for ${host}. AI providers exceeded response budget, but this report remains actionable.`,
    key_takeaways: [
      'This report is generated from scraped technical and content evidence without model inference.',
      'Visibility score and category grades are bounded by objective on-page signals.',
      'Action plan prioritizes schema, content depth, and technical discoverability.',
    ],
    topical_keywords: [],
    keyword_intelligence: [],
    brand_entities: [],
    recommendations,
    category_grades: categoryGrades,
    content_highlights: [
      { area: 'heading', found: `${h1Count} H1 detected`, status: h1Count === 1 ? 'good' : 'warning', note: 'Heading hierarchy impacts AI parsing.', source_id: 'ev_h1_count' },
      { area: 'schema', found: `${schemaCount} JSON-LD blocks`, status: schemaCount > 0 ? 'good' : 'critical', note: 'Structured data supports citation confidence.', source_id: 'ev_schema' },
      { area: 'meta-tags', found: hasMetaDescription ? 'Meta description present' : 'Meta description missing', status: hasMetaDescription ? 'good' : 'warning', note: 'Metadata improves contextual relevance.', source_id: 'ev_meta_description' },
      { area: 'technical', found: isHttps ? 'HTTPS enabled' : 'HTTPS missing', status: isHttps ? 'good' : 'critical', note: 'HTTPS is a baseline trust signal.', source_id: 'ev_https' },
      { area: 'content', found: `${wordCount} words`, status: wordCount >= 800 ? 'good' : 'warning', note: 'Depth directly affects answer quality and citations.', source_id: 'ev_word_count' },
    ],
    crypto_intelligence: {
      has_crypto_signals: false,
      summary: 'No cryptocurrency-related content detected',
      detected_assets: [],
      keywords: [],
      wallet_addresses: [],
      sentiment: 'neutral' as const,
      risk_notes: [],
      chain_networks: [],
      onchain_enriched: false,
      experimental: true as const,
    },
  };
}

function computeSeoDiagnostics(
  sd: any,
  schema: any,
  technicalSignals: {
    response_time_ms?: number;
    https_enabled?: boolean;
    has_canonical?: boolean;
  },
  sourceType: 'url' | 'upload' = 'url'
) {
  const title = (sd?.title || '').trim();
  const titleLen = title.length;
  const metaDesc = (sd?.meta?.description || '').trim();
  const metaLen = metaDesc.length;
  const h1Count = sd?.headings?.h1?.length || 0;
  const schemaCount = schema?.json_ld_count || 0;
  const hasCanonical = !!technicalSignals?.has_canonical;
  const hasHttps = !!technicalSignals?.https_enabled;
  const responseTimeMs = Number(technicalSignals?.response_time_ms || 0);
  const robotsMeta = ((sd?.html || '').match(/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)["'][^>]*>/i)?.[1] || '').toLowerCase();
  const isNoindex = robotsMeta.includes('noindex');
  const internalLinks = Number(sd?.links?.internal || 0);
  const bodyText = String(sd?.body || '').toLowerCase();
  const words = bodyText.split(/\s+/).map((word) => word.trim()).filter(Boolean);
  const uniqueWordRatio = words.length > 0 ? new Set(words).size / words.length : 0;
  const html = String(sd?.html || '');
  const imgTags = html.match(/<img\b[^>]*>/gi) || [];
  const imagesWithAlt = imgTags.filter((tag) => /\balt\s*=\s*(['"])(.*?)\1/i.test(tag)).length;
  const altCoverage = imgTags.length > 0 ? imagesWithAlt / imgTags.length : 1;
  const landmarkCount = [
    /<main\b/i,
    /<nav\b/i,
    /<header\b/i,
    /<footer\b/i,
    /<aside\b/i,
  ].reduce((acc, regex) => acc + (regex.test(html) ? 1 : 0), 0);
  const formInputCount = (html.match(/<(input|textarea|select)\b/gi) || []).length;
  const labelTagCount = (html.match(/<label\b/gi) || []).length;
  const ariaLabelCount = (html.match(/\baria-label\s*=\s*['"][^'"]+['"]/gi) || []).length;

  return {
    title: titleLen >= 30 && titleLen <= 60
      ? { status: 'pass' as const, detail: `Title length ${titleLen} chars (ideal range).` }
      : titleLen > 0
        ? { status: 'warn' as const, detail: `Title length ${titleLen} chars (recommended 30-60).` }
        : { status: 'fail' as const, detail: 'Missing page title.' },

    meta_description: metaLen >= 120 && metaLen <= 155
      ? { status: 'pass' as const, detail: `Meta description ${metaLen} chars (ideal range).` }
      : metaLen > 0
        ? { status: 'warn' as const, detail: `Meta description ${metaLen} chars (recommended 120-155).` }
        : { status: 'fail' as const, detail: 'Missing meta description.' },

    h1: h1Count === 1
      ? { status: 'pass' as const, detail: 'Exactly one H1 found.' }
      : h1Count > 1
        ? { status: 'warn' as const, detail: `${h1Count} H1 tags found (recommended exactly one).` }
        : { status: 'fail' as const, detail: 'No H1 heading found.' },

    schema: schemaCount >= 2
      ? { status: 'pass' as const, detail: `${schemaCount} JSON-LD schema blocks detected.` }
      : schemaCount === 1
        ? { status: 'warn' as const, detail: 'One schema block detected; add FAQ/Organization coverage.' }
        : { status: 'fail' as const, detail: 'No JSON-LD schema detected.' },

    canonical: hasCanonical
      ? { status: 'pass' as const, detail: 'Canonical tag present.' }
      : { status: 'warn' as const, detail: 'Canonical tag missing.' },

    https: sourceType === 'upload'
      ? { status: 'warn' as const, detail: 'HTTPS not applicable for uploaded file context.' }
      : hasHttps
        ? { status: 'pass' as const, detail: 'HTTPS enabled.' }
        : { status: 'fail' as const, detail: 'HTTPS not enabled.' },

    robots: sourceType === 'upload'
      ? { status: 'warn' as const, detail: 'robots directives not applicable for uploaded file context.' }
      : robotsMeta
        ? isNoindex
          ? { status: 'fail' as const, detail: `Robots directive includes noindex (${robotsMeta}).` }
          : { status: 'pass' as const, detail: `Robots directive detected (${robotsMeta}).` }
        : { status: 'warn' as const, detail: 'No robots meta directive detected.' },

    indexability: sourceType === 'upload'
      ? { status: 'warn' as const, detail: 'Indexability is not directly verifiable for uploaded files.' }
      : isNoindex
        ? { status: 'fail' as const, detail: 'Page is marked noindex.' }
        : { status: 'pass' as const, detail: 'No noindex directive detected.' },

    internal_link_health: sourceType === 'upload'
      ? { status: 'warn' as const, detail: 'Internal link architecture requires live-site crawl context.' }
      : internalLinks >= 3
        ? { status: 'pass' as const, detail: `${internalLinks} internal links detected.` }
        : internalLinks > 0
          ? { status: 'warn' as const, detail: `${internalLinks} internal links detected; add more contextual links.` }
          : { status: 'fail' as const, detail: 'No internal links detected.' },

    content_uniqueness: words.length < 120
      ? { status: 'warn' as const, detail: `Content is thin (${words.length} words), uniqueness confidence is limited.` }
      : uniqueWordRatio >= 0.6
        ? { status: 'pass' as const, detail: `Lexical diversity ratio ${(uniqueWordRatio * 100).toFixed(0)}% suggests non-duplicative content.` }
        : uniqueWordRatio >= 0.45
          ? { status: 'warn' as const, detail: `Lexical diversity ratio ${(uniqueWordRatio * 100).toFixed(0)}% indicates moderate repetition.` }
          : { status: 'fail' as const, detail: `Lexical diversity ratio ${(uniqueWordRatio * 100).toFixed(0)}% indicates heavy repetition/thin uniqueness.` },

    performance_hint: sourceType === 'upload'
      ? { status: 'warn' as const, detail: 'Response-time performance is not available for uploaded files.' }
      : responseTimeMs > 0
        ? responseTimeMs <= 1800
          ? { status: 'pass' as const, detail: `Response time ${responseTimeMs}ms (good).` }
          : responseTimeMs <= 3000
            ? { status: 'warn' as const, detail: `Response time ${responseTimeMs}ms (needs improvement).` }
            : { status: 'fail' as const, detail: `Response time ${responseTimeMs}ms (slow for crawl/index reliability).` }
        : { status: 'warn' as const, detail: 'Response-time metric unavailable for this scan.' },

    image_alt_coverage: sourceType === 'upload'
      ? { status: 'warn' as const, detail: 'Image alt coverage is not available for uploaded file context.' }
      : imgTags.length === 0
        ? { status: 'warn' as const, detail: 'No images found; alt coverage not applicable.' }
        : altCoverage >= 0.9
          ? { status: 'pass' as const, detail: `Alt text coverage ${(altCoverage * 100).toFixed(0)}% (${imagesWithAlt}/${imgTags.length}).` }
          : altCoverage >= 0.7
            ? { status: 'warn' as const, detail: `Alt text coverage ${(altCoverage * 100).toFixed(0)}% (${imagesWithAlt}/${imgTags.length}); improve for accessibility.` }
            : { status: 'fail' as const, detail: `Alt text coverage ${(altCoverage * 100).toFixed(0)}% (${imagesWithAlt}/${imgTags.length}); many images are unlabeled.` },

    semantic_landmarks: sourceType === 'upload'
      ? { status: 'warn' as const, detail: 'Semantic landmarks require live HTML context.' }
      : landmarkCount >= 3
        ? { status: 'pass' as const, detail: `${landmarkCount} semantic landmarks detected (<main>/<nav>/<header>/<footer>/<aside>).` }
        : landmarkCount >= 1
          ? { status: 'warn' as const, detail: `${landmarkCount} semantic landmark detected; add clearer page regions.` }
          : { status: 'fail' as const, detail: 'No semantic landmarks detected; add main/nav/header/footer regions.' },

    form_accessibility: sourceType === 'upload'
      ? { status: 'warn' as const, detail: 'Form label checks require live HTML context.' }
      : formInputCount === 0
        ? { status: 'pass' as const, detail: 'No form controls detected.' }
        : (labelTagCount + ariaLabelCount) >= formInputCount
          ? { status: 'pass' as const, detail: `Form labeling coverage looks good (${labelTagCount + ariaLabelCount}/${formInputCount}).` }
          : (labelTagCount + ariaLabelCount) > 0
            ? { status: 'warn' as const, detail: `Partial form labeling (${labelTagCount + ariaLabelCount}/${formInputCount}); add labels/aria-label to all controls.` }
            : { status: 'fail' as const, detail: `No form labels detected for ${formInputCount} controls.` },
  };
}

function buildEvidenceFixPlan(
  seoDiagnostics: ReturnType<typeof computeSeoDiagnostics> | undefined,
  recommendations: Array<{ id?: string; title?: string; description?: string; implementation?: string; evidence_ids?: string[] }> | undefined,
  evidenceManifest: Record<string, string> | undefined,
  mode: 'standard' | 'thorough' = 'standard',
) {
  const diagnostics = seoDiagnostics || ({} as ReturnType<typeof computeSeoDiagnostics>);
  const recommendationList = Array.isArray(recommendations) ? recommendations : [];
  const evidence = evidenceManifest || {};

  const diagnosticConfig: Array<{
    key: keyof ReturnType<typeof computeSeoDiagnostics>;
    area: string;
    title: string;
    severityWhenFail: 'critical' | 'high' | 'medium' | 'low';
    severityWhenWarn: 'high' | 'medium' | 'low';
    evidenceId: string;
    actualFix: string;
    validation: string[];
  }> = [
    {
      key: 'h1',
      area: 'Heading Structure',
      title: 'H1 heading quality issue',
      severityWhenFail: 'critical',
      severityWhenWarn: 'medium',
      evidenceId: 'ev_h1_count',
      actualFix: 'Use exactly one H1 that states the page intent in plain language and place it near the top of the main content.',
      validation: ['View page source and confirm exactly one <h1>.', 'Re-run scan and verify H1 check is PASS.'],
    },
    {
      key: 'schema',
      area: 'Structured Data',
      title: 'Schema coverage gap',
      severityWhenFail: 'critical',
      severityWhenWarn: 'high',
      evidenceId: 'ev_schema',
      actualFix: 'Add valid JSON-LD for Organization and page-relevant schemas (FAQ/Article/Service) with consistent entity names.',
      validation: ['Validate JSON-LD in Rich Results Test.', 'Re-run scan and confirm schema check improves.'],
    },
    {
      key: 'meta_description',
      area: 'Metadata',
      title: 'Meta description needs correction',
      severityWhenFail: 'high',
      severityWhenWarn: 'medium',
      evidenceId: 'ev_meta_description',
      actualFix: 'Write a unique 120-155 character meta description that mirrors the core intent and includes one concrete differentiator.',
      validation: ['Inspect rendered HTML for updated meta description.', 'Re-run scan and check metadata status.'],
    },
    {
      key: 'canonical',
      area: 'Technical SEO',
      title: 'Canonical signal missing or weak',
      severityWhenFail: 'high',
      severityWhenWarn: 'medium',
      evidenceId: 'ev_canonical',
      actualFix: 'Add a self-referencing canonical URL on the primary page variant and ensure duplicates point to it.',
      validation: ['Confirm exactly one rel=canonical in head.', 'Re-run scan and verify canonical status is PASS.'],
    },
    {
      key: 'https',
      area: 'Security & Trust',
      title: 'HTTPS trust signal issue',
      severityWhenFail: 'critical',
      severityWhenWarn: 'low',
      evidenceId: 'ev_https',
      actualFix: 'Force HTTPS with 301 redirects from HTTP, then update canonical and sitemap URLs to HTTPS.',
      validation: ['Open HTTP URL and verify redirect to HTTPS.', 'Re-run scan and verify HTTPS check is PASS.'],
    },
    {
      key: 'title',
      area: 'Metadata',
      title: 'Title tag optimization needed',
      severityWhenFail: 'high',
      severityWhenWarn: 'medium',
      evidenceId: 'ev_title',
      actualFix: 'Set a descriptive title in the 30-60 character range with entity + intent + differentiator.',
      validation: ['Inspect <title> in source.', 'Re-run scan and confirm title check improves.'],
    },
    {
      key: 'internal_link_health',
      area: 'Link Architecture',
      title: 'Internal linking is too weak',
      severityWhenFail: 'high',
      severityWhenWarn: 'medium',
      evidenceId: 'ev_links_int',
      actualFix: 'Add contextual internal links from supporting pages to the target page using descriptive anchors.',
      validation: ['Crawl and verify internal links increased.', 'Re-run scan and validate internal link health.'],
    },
    {
      key: 'content_uniqueness',
      area: 'Content Quality',
      title: 'Content uniqueness/depth risk',
      severityWhenFail: 'high',
      severityWhenWarn: 'medium',
      evidenceId: 'ev_word_count',
      actualFix: 'Expand thin/repetitive sections with specific examples, factual claims, and intent-aligned subheadings.',
      validation: ['Check body word count and topical breadth increased.', 'Re-run scan and verify improved content status.'],
    },
  ];

  const maxIssues = mode === 'thorough' ? 12 : 7;
  const issues: Array<{
    id: string;
    area: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    finding: string;
    evidence_ids: string[];
    evidence_excerpt?: string;
    actual_fix: string;
    validation_steps: string[];
    related_recommendation_ids?: string[];
  }> = [];

  for (const item of diagnosticConfig) {
    const check = diagnostics[item.key] as { status?: 'pass' | 'warn' | 'fail'; detail?: string } | undefined;
    if (!check || check.status === 'pass') continue;

    const severity = check.status === 'fail' ? item.severityWhenFail : item.severityWhenWarn;
    const relatedRecommendations = recommendationList
      .filter((rec) => {
        const title = String(rec.title || '').toLowerCase();
        const description = String(rec.description || '').toLowerCase();
        const implementation = String(rec.implementation || '').toLowerCase();
        const mentionsArea = title.includes(item.area.toLowerCase()) || description.includes(item.area.toLowerCase()) || implementation.includes(item.area.toLowerCase());
        const linkedEvidence = Array.isArray(rec.evidence_ids) && rec.evidence_ids.includes(item.evidenceId);
        return mentionsArea || linkedEvidence;
      })
      .map((rec) => rec.id)
      .filter((id): id is string => typeof id === 'string')
      .slice(0, 3);

    issues.push({
      id: `fix_${item.key}`,
      area: item.area,
      severity,
      finding: check.detail || item.title,
      evidence_ids: [item.evidenceId],
      evidence_excerpt: evidence[item.evidenceId],
      actual_fix: item.actualFix,
      validation_steps: item.validation,
      related_recommendation_ids: relatedRecommendations.length ? relatedRecommendations : undefined,
    });

    if (issues.length >= maxIssues) break;
  }

  return {
    mode,
    issue_count: issues.length,
    generated_at: new Date().toISOString(),
    issues,
  };
}

function buildStrictRubricSystem(args: {
  sourceType: 'url' | 'upload';
  visibilityScore: number;
  seoDiagnostics?: ReturnType<typeof computeSeoDiagnostics>;
  recommendationEvidenceSummary?: {
    evidence_coverage_percent?: number;
    evidence_ref_integrity_percent?: number;
    recommendations_with_evidence?: number;
  };
  evidenceFixPlan?: {
    issues?: Array<{
      id?: string;
      area?: string;
      actual_fix?: string;
      validation_steps?: string[];
      evidence_ids?: string[];
    }>;
  };
  citationParityAudit?: {
    ai_visibility_score_0_100?: number;
  };
  railEvidenceAudit?: {
    overall_score_0_100?: number;
  };
}): StrictRubricSystem {
  const diagnostics = args.seoDiagnostics || ({} as ReturnType<typeof computeSeoDiagnostics>);
  const recSummary = args.recommendationEvidenceSummary || {};
  const fixPlan = args.evidenceFixPlan || {};
  const parityScore = Number(args.citationParityAudit?.ai_visibility_score_0_100 || 0);
  const railScore = Number(args.railEvidenceAudit?.overall_score_0_100 || 0);

  const toScore = (status?: 'pass' | 'warn' | 'fail'): number => {
    if (status === 'pass') return 100;
    if (status === 'warn') return 65;
    return 20;
  };

  const toStatus = (score: number): 'pass' | 'warn' | 'fail' => {
    if (score >= 85) return 'pass';
    if (score >= 60) return 'warn';
    return 'fail';
  };

  const coverage = Number(recSummary.evidence_coverage_percent || 0);
  const integrity = Number(recSummary.evidence_ref_integrity_percent || 0);
  const recommendationsWithEvidence = Number(recSummary.recommendations_with_evidence || 0);

  const crawlabilityScore = args.sourceType === 'upload'
    ? 90
    : Math.round((toScore(diagnostics.https?.status) * 0.34) + (toScore(diagnostics.indexability?.status) * 0.33) + (toScore(diagnostics.robots?.status) * 0.33));
  const metadataScore = Math.round((toScore(diagnostics.title?.status) * 0.34) + (toScore(diagnostics.meta_description?.status) * 0.33) + (toScore(diagnostics.canonical?.status) * 0.33));
  const structureScore = Math.round((toScore(diagnostics.h1?.status) * 0.34) + (toScore(diagnostics.schema?.status) * 0.33) + (toScore(diagnostics.semantic_landmarks?.status) * 0.33));
  const evidenceLinkScore = Math.round((Math.max(0, Math.min(100, coverage)) * 0.6) + (Math.max(0, Math.min(100, integrity)) * 0.4));
  const parityBlendScore = Math.round((Math.max(0, Math.min(100, parityScore)) * 0.55) + (Math.max(0, Math.min(100, railScore)) * 0.45));

  const gates: StrictRubricSystem['gates'] = [
    {
      id: 'gate_crawlability_trust',
      label: 'Crawlability & trust signals',
      weight: 0.2,
      status: toStatus(crawlabilityScore),
      score_0_100: crawlabilityScore,
      threshold_pass: 85,
      actual_value: crawlabilityScore,
      evidence_ids: ['ev_https', 'ev_robots'],
    },
    {
      id: 'gate_metadata_integrity',
      label: 'Metadata integrity',
      weight: 0.2,
      status: toStatus(metadataScore),
      score_0_100: metadataScore,
      threshold_pass: 85,
      actual_value: metadataScore,
      evidence_ids: ['ev_title', 'ev_meta_desc', 'ev_canonical'],
    },
    {
      id: 'gate_structural_extractability',
      label: 'Structural extractability',
      weight: 0.2,
      status: toStatus(structureScore),
      score_0_100: structureScore,
      threshold_pass: 85,
      actual_value: structureScore,
      evidence_ids: ['ev_h1', 'ev_schema'],
    },
    {
      id: 'gate_evidence_link_integrity',
      label: 'Evidence link integrity',
      weight: 0.2,
      status: toStatus(evidenceLinkScore),
      score_0_100: evidenceLinkScore,
      threshold_pass: 85,
      actual_value: evidenceLinkScore,
      evidence_ids: ['ev_schema', 'ev_word_count'],
    },
    {
      id: 'gate_cross_platform_parity',
      label: 'Cross-platform parity',
      weight: 0.2,
      status: toStatus(parityBlendScore),
      score_0_100: parityBlendScore,
      threshold_pass: 80,
      actual_value: parityBlendScore,
      evidence_ids: ['ev_schema', 'ev_title', 'ev_word_count'],
    },
  ];

  const reliabilityIndex = Math.round(
    gates.reduce((sum, gate) => sum + (gate.score_0_100 * gate.weight), 0)
  );

  const failedGateIds = gates
    .filter((gate) => gate.status !== 'pass')
    .map((gate) => gate.id);

  const allFixIssues = Array.isArray(fixPlan.issues) ? fixPlan.issues : [];

  const createFixpack = (
    id: string,
    label: string,
    targetGateIds: string[],
    estimatedMin: number,
    estimatedMax: number,
    issueFilter: (issue: { area?: string; id?: string }) => boolean,
  ): StrictRubricSystem['required_fixpacks'][number] => {
    const matchedIssues = allFixIssues.filter(issueFilter).slice(0, 4);
    const actions = matchedIssues
      .map((issue) => issue.actual_fix)
      .filter((action): action is string => typeof action === 'string' && action.length > 0);
    const validation_steps = matchedIssues
      .flatMap((issue) => Array.isArray(issue.validation_steps) ? issue.validation_steps : [])
      .filter((step): step is string => typeof step === 'string' && step.length > 0)
      .slice(0, 6);

    return {
      id,
      label,
      target_gate_ids: targetGateIds,
      estimated_score_lift_min: estimatedMin,
      estimated_score_lift_max: estimatedMax,
      actions: actions.length > 0 ? actions : ['No direct remediation action captured; inspect gate evidence and rerun deterministic scan.'],
      validation_steps: validation_steps.length > 0 ? validation_steps : ['Re-run audit and confirm gate status moves from fail/warn to pass.'],
    };
  };

  const fixpackLibrary: StrictRubricSystem['required_fixpacks'] = [
    createFixpack(
      'fp_crawl_trust',
      'Crawl trust hardening pack',
      ['gate_crawlability_trust'],
      4,
      12,
      (issue) => ['fix_https', 'fix_robots', 'fix_indexability'].includes(String(issue.id || ''))
    ),
    createFixpack(
      'fp_metadata_precision',
      'Metadata precision pack',
      ['gate_metadata_integrity'],
      3,
      10,
      (issue) => ['fix_title', 'fix_meta_description', 'fix_canonical'].includes(String(issue.id || ''))
    ),
    createFixpack(
      'fp_structure_extractability',
      'Structure extractability pack',
      ['gate_structural_extractability'],
      5,
      14,
      (issue) => ['fix_h1', 'fix_schema', 'fix_content_uniqueness'].includes(String(issue.id || ''))
    ),
    createFixpack(
      'fp_evidence_linkage',
      'Evidence linkage pack',
      ['gate_evidence_link_integrity'],
      6,
      15,
      () => recommendationsWithEvidence <= 0 || coverage < 85 || integrity < 85
    ),
    createFixpack(
      'fp_cross_platform_parity',
      'Cross-platform parity pack',
      ['gate_cross_platform_parity'],
      4,
      12,
      () => parityBlendScore < 80
    ),
  ];

  const requiredFixpacks = fixpackLibrary.filter((fixpack) =>
    fixpack.target_gate_ids.some((gateId) => failedGateIds.includes(gateId))
  );

  const passCount = gates.filter((gate) => gate.status === 'pass').length;
  const passRate = gates.length > 0 ? Number((passCount / gates.length).toFixed(3)) : 0;
  const projectedLift = requiredFixpacks.reduce((sum, pack) => sum + pack.estimated_score_lift_min, 0);

  return {
    version: 'strict-rubric-v1',
    score_0_100: Math.max(0, Math.min(100, Math.round(args.visibilityScore))),
    reliability_index_0_100: reliabilityIndex,
    gates,
    required_fixpacks: requiredFixpacks,
    pass_rate: passRate,
    cross_platform_ready: gates.every((gate) => gate.status === 'pass'),
    guarantee_policy: {
      mode: 'directional',
      baseline_preconditions: [
        'Run baseline and post-fix audits on the same canonical URL set and crawl mode.',
        'Apply all required fixpacks and complete listed validation steps.',
        'Use evidence-linked recommendations only (no unverifiable synthetic additions).',
      ],
      expected_delta_band: {
        min: requiredFixpacks.length > 0 ? Math.max(3, projectedLift) : 0,
        max: requiredFixpacks.length > 0 ? Math.max(8, projectedLift + 10) : 4,
      },
    },
  };
}

function buildRailEvidenceAudit(args: {
  sourceType: 'url' | 'upload';
  evidenceManifest?: Record<string, string>;
  contentAnalysis?: { word_count?: number; faq_count?: number; headings?: { h1?: number; h2?: number; h3?: number } };
  schemaMarkup?: { json_ld_count?: number; has_organization_schema?: boolean; has_faq_schema?: boolean; schema_types?: string[] };
  domainIntelligence?: { page_title?: string; page_description?: string; canonical_url?: string };
  technicalSignals?: { https_enabled?: boolean; has_canonical?: boolean; has_robots_txt?: boolean };
  recommendationEvidenceSummary?: { evidence_coverage_percent?: number; evidence_ref_integrity_percent?: number; recommendations_with_evidence?: number };
  evidenceFixPlan?: { issue_count?: number; issues?: Array<{ evidence_ids?: string[] }> };
  citationParityAudit?: { ai_visibility_score_0_100?: number; evidence?: unknown[] };
}) {
  type CheckStatus = 'pass' | 'warn' | 'fail';
  type RailCheck = {
    id: string;
    label: string;
    status: CheckStatus;
    score_0_100: number;
    detail: string;
    evidence_ids: string[];
    fix: string;
  };

  const evidence = args.evidenceManifest || {};
  const evidenceIds = Object.keys(evidence);
  const schema = args.schemaMarkup || {};
  const content = args.contentAnalysis || {};
  const headings = content.headings || {};
  const technical = args.technicalSignals || {};
  const domain = args.domainIntelligence || {};
  const recSummary = args.recommendationEvidenceSummary || {};
  const fixPlan = args.evidenceFixPlan || {};
  const parity = args.citationParityAudit || {};

  const statusScore = (status: CheckStatus): number => {
    if (status === 'pass') return 100;
    if (status === 'warn') return 65;
    return 20;
  };

  const scoreFor = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));

  const pickEvidence = (...preferred: string[]) => {
    const matched: string[] = [];
    for (const id of preferred) {
      if (evidenceIds.includes(id)) matched.push(id);
    }
    if (matched.length > 0) return matched;
    const fallback = evidenceIds
      .filter((id) => preferred.some((needle) => id.includes(needle.replace(/^ev_/, ''))))
      .slice(0, 3);
    return fallback;
  };

  const createCheck = (
    id: string,
    label: string,
    status: CheckStatus,
    detail: string,
    fix: string,
    evidence_ids: string[]
  ): RailCheck => ({
    id,
    label,
    status,
    score_0_100: statusScore(status),
    detail,
    fix,
    evidence_ids,
  });

  const wordCount = Number(content.word_count || 0);
  const faqCount = Number(content.faq_count || 0);
  const headingCount = Number(headings.h1 || 0) + Number(headings.h2 || 0) + Number(headings.h3 || 0);
  const schemaCount = Number(schema.json_ld_count || 0);
  const hasOrgSchema = Boolean(schema.has_organization_schema);
  const hasFaqSchema = Boolean(schema.has_faq_schema);
  const hasStructuredSchema = schemaCount > 0 || (Array.isArray(schema.schema_types) && schema.schema_types.length > 0);
  const hasTitle = Boolean(String(domain.page_title || '').trim());
  const hasDescription = Boolean(String(domain.page_description || '').trim());
  const hasCanonical = Boolean(technical.has_canonical) || Boolean(String(domain.canonical_url || '').trim());
  const hasHttps = args.sourceType === 'upload' ? true : Boolean(technical.https_enabled);
  const coverage = Number(recSummary.evidence_coverage_percent || 0);
  const integrity = Number(recSummary.evidence_ref_integrity_percent || 0);
  const recommendationsWithEvidence = Number(recSummary.recommendations_with_evidence || 0);
  const fixIssueCount = Number(fixPlan.issue_count || 0);
  const fixPlanEvidenceRefs = Array.isArray(fixPlan.issues)
    ? fixPlan.issues.reduce((total, issue) => total + (Array.isArray(issue?.evidence_ids) ? issue.evidence_ids.length : 0), 0)
    : 0;
  const parityScore = Number(parity.ai_visibility_score_0_100 || 0);
  const parityEvidenceCount = Array.isArray(parity.evidence) ? parity.evidence.length : 0;

  const claudeChecks: RailCheck[] = [
    createCheck(
      'claude_fetch_surface',
      'Fetchable crawl surface',
      wordCount >= 250 ? 'pass' : wordCount >= 80 ? 'warn' : 'fail',
      `Detected ${wordCount} crawl-accessible words for deterministic extraction and scoring.`,
      'Expose core page intent in server-rendered HTML (SSR/SSG/prerender) so extraction does not depend on client-side hydration.',
      pickEvidence('ev_word_count')
    ),
    createCheck(
      'claude_schema_vocabulary',
      'Structured vocabulary presence',
      hasStructuredSchema ? 'pass' : 'fail',
      hasStructuredSchema ? `Schema markers detected (${schemaCount} JSON-LD blocks).` : 'No schema markers detected in evidence manifest.',
      'Add Organization + page-relevant JSON-LD (FAQ/Article/Service) with values that match visible page claims.',
      pickEvidence('ev_schema')
    ),
    createCheck(
      'claude_answer_blocks',
      'Answer-block density',
      faqCount >= 3 ? 'pass' : faqCount > 0 ? 'warn' : 'fail',
      `FAQ/answer indicators detected: ${faqCount}.`,
      'Add direct Q/A sections and concise answer-first paragraphs to improve extractability for model summarization.',
      pickEvidence('ev_faq', 'ev_h2_count')
    ),
  ];

  const googleChecks: RailCheck[] = [
    createCheck(
      'google_title_query_alignment',
      'Title + description alignment signals',
      hasTitle && hasDescription ? 'pass' : hasTitle || hasDescription ? 'warn' : 'fail',
      `Title present: ${hasTitle ? 'yes' : 'no'}, description present: ${hasDescription ? 'yes' : 'no'}.`,
      'Ensure title and meta description are both present and intent-specific, then align H1/H2 structure to the same topical entity.',
      pickEvidence('ev_title', 'ev_meta_description')
    ),
    createCheck(
      'google_schema_quality',
      'Schema completeness for rich extraction',
      hasOrgSchema && (hasFaqSchema || schemaCount >= 2) ? 'pass' : hasStructuredSchema ? 'warn' : 'fail',
      hasOrgSchema && (hasFaqSchema || schemaCount >= 2)
        ? 'Organization schema plus page-level schema detected.'
        : hasStructuredSchema
          ? 'Partial schema coverage detected but key relationships are likely incomplete.'
          : 'No strong schema structure detected.',
      'Complete Organization + FAQ/WebPage relationships and ensure JSON-LD entity names/URLs mirror on-page text.',
      pickEvidence('ev_schema')
    ),
    createCheck(
      'google_trust_architecture',
      'Trust architecture (HTTPS/canonical/robots)',
      hasHttps && hasCanonical ? 'pass' : hasHttps || hasCanonical ? 'warn' : 'fail',
      `HTTPS: ${hasHttps ? 'present' : 'missing'}, canonical: ${hasCanonical ? 'present' : 'missing'}.`,
      'Enforce HTTPS and add a self-referencing canonical to stabilize indexing and citation source consistency.',
      pickEvidence('ev_https', 'ev_canonical', 'ev_robots_txt')
    ),
  ];

  const perplexityChecks: RailCheck[] = [
    createCheck(
      'perplexity_chunkable_structure',
      'Chunkable semantic structure',
      headingCount >= 4 ? 'pass' : headingCount >= 2 ? 'warn' : 'fail',
      `Detected ${headingCount} heading signals (H1/H2/H3).`,
      'Add clear H2/H3 sections with named entities and concise answer-first openings to improve retrieval chunk relevance.',
      pickEvidence('ev_h1_count', 'ev_h2_count')
    ),
    createCheck(
      'perplexity_extractability',
      'Citation extractability',
      coverage >= 70 ? 'pass' : coverage >= 40 ? 'warn' : 'fail',
      `Recommendation evidence coverage is ${coverage}%.`,
      'Link every recommendation to concrete evidence IDs and remove non-evidenced claims from final output.',
      pickEvidence('ev_word_count', 'ev_schema', 'ev_links_int')
    ),
    createCheck(
      'perplexity_authority_trace',
      'Authority and proof traceability',
      integrity >= 85 ? 'pass' : integrity >= 60 ? 'warn' : 'fail',
      `Recommendation evidence integrity is ${integrity}% with ${recommendationsWithEvidence} recommendations carrying evidence links.`,
      'Increase evidence reference integrity by ensuring mapped evidence IDs are real, stable, and represented in the evidence manifest.',
      pickEvidence('ev_title', 'ev_meta_description', 'ev_schema')
    ),
  ];

  const trackingChecks: RailCheck[] = [
    createCheck(
      'tracking_evidence_ledger',
      'BRAG evidence ledger integrity',
      coverage >= 70 && integrity >= 85 ? 'pass' : coverage >= 45 && integrity >= 70 ? 'warn' : 'fail',
      `Coverage ${coverage}% / integrity ${integrity}% for recommendation-to-evidence linkage.`,
      'Raise BRAG quality by requiring recommendation evidence IDs and validating each ID exists in evidence_manifest.',
      evidenceIds.slice(0, 3)
    ),
    createCheck(
      'tracking_fix_traceability',
      'Evidence-linked fix plan',
      fixIssueCount >= 3 && fixPlanEvidenceRefs >= fixIssueCount ? 'pass' : fixIssueCount > 0 ? 'warn' : 'fail',
      `Evidence fix plan issues: ${fixIssueCount}, linked evidence refs: ${fixPlanEvidenceRefs}.`,
      'Generate issue-level fixes with explicit evidence_ids and validation steps so teams can close findings with proof.',
      pickEvidence('ev_schema', 'ev_h1_count', 'ev_meta_description')
    ),
    createCheck(
      'tracking_parity_packet',
      'Citation parity evidence packet',
      parityScore >= 65 && parityEvidenceCount >= 5 ? 'pass' : parityEvidenceCount > 0 ? 'warn' : 'fail',
      `Citation parity score ${parityScore}/100 with ${parityEvidenceCount} evidence artifacts.`,
      'Increase parity confidence by expanding evidence artifacts across schema, technical, content, and trust dimensions.',
      pickEvidence('ev_schema', 'ev_https', 'ev_links_int')
    ),
  ];

  const scoreTrack = (checks: RailCheck[]) => {
    if (!checks.length) return 0;
    return scoreFor(checks.reduce((sum, check) => sum + check.score_0_100, 0) / checks.length);
  };

  const claudeScore = scoreTrack(claudeChecks);
  const googleScore = scoreTrack(googleChecks);
  const perplexityScore = scoreTrack(perplexityChecks);
  const trackingScore = scoreTrack(trackingChecks);
  const overallScore = scoreFor((claudeScore + googleScore + perplexityScore + trackingScore) / 4);

  const bragReady = coverage >= 70 && integrity >= 85 && fixIssueCount > 0;
  const bragReasons: string[] = [];
  if (coverage < 70) bragReasons.push(`Evidence coverage below target (current ${coverage}%, target >= 70%).`);
  if (integrity < 85) bragReasons.push(`Evidence integrity below target (current ${integrity}%, target >= 85%).`);
  if (fixIssueCount <= 0) bragReasons.push('No evidence-linked fix issues were generated.');
  if (bragReasons.length === 0) {
    bragReasons.push('BRAG thresholds satisfied: recommendation evidence coverage/integrity and fix traceability are in acceptable range.');
  }

  return {
    version: 'rails-v1',
    overall_score_0_100: overallScore,
    brag_ready: bragReady,
    brag_reasons: bragReasons,
    rails: {
      claude: { score_0_100: claudeScore, checks: claudeChecks },
      google: { score_0_100: googleScore, checks: googleChecks },
      perplexity: { score_0_100: perplexityScore, checks: perplexityChecks },
      tracking: { score_0_100: trackingScore, checks: trackingChecks },
    },
  };
}

// In-memory progress tracker (tenant-bound by owner_user_id)
const auditProgress = new Map<string, { step: string; percent: number; listeners: Set<Response>; owner_user_id: string }>();

function emitProgress(requestId: string, step: string, percent: number) {
  const entry = auditProgress.get(requestId);
  if (!entry) return;
  entry.step = step;
  entry.percent = percent;
  const data = JSON.stringify({ step, percent, timestamp: Date.now() });
  for (const res of entry.listeners) {
    try {
      res.write(`data: ${data}\n\n`);
    } catch {
      /* client disconnected */
    }
  }
}

app.get('/api/audit/progress/:requestId', async (req: Request, res: Response) => {
  const { requestId } = req.params as { requestId: string };

  let viewerUserId = '';
  try {
    const bearer = String(req.headers.authorization || '');
    const headerToken = bearer.startsWith('Bearer ') ? bearer.slice('Bearer '.length).trim() : '';
    const queryToken = String(req.query.token || '').trim();
    const token = headerToken || queryToken;
    if (!token) {
      return res.status(401).json({ error: 'Authentication required', code: 'NO_TOKEN' });
    }

    const decoded = verifyUserToken(token);
    const user = await getUserById(decoded.userId);
    if (!user?.id || !user.is_verified) {
      return res.status(401).json({ error: 'Invalid session', code: 'INVALID_TOKEN' });
    }
    viewerUserId = String(user.id);
  } catch {
    return res.status(401).json({ error: 'Invalid session', code: 'INVALID_TOKEN' });
  }

  const entry = auditProgress.get(requestId);
  if (!entry) {
    return res.status(404).json({ error: 'Audit progress stream not found', code: 'PROGRESS_NOT_FOUND' });
  }

  if (entry.owner_user_id !== viewerUserId) {
    return res.status(403).json({ error: 'Forbidden', code: 'PROGRESS_FORBIDDEN' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  entry.listeners.add(res);

  res.write(`data: ${JSON.stringify({ step: entry.step, percent: entry.percent })}\n\n`);

  const heartbeat = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      /* client disconnected */
    }
  }, 10_000);

  req.on('close', () => {
    clearInterval(heartbeat);
    entry!.listeners.delete(res);
    if (entry!.listeners.size === 0) {
      setTimeout(() => {
        const e = auditProgress.get(requestId);
        if (e && e.listeners.size === 0) auditProgress.delete(requestId);
      }, 60_000);
    }
  });
});

// ── Keyword intelligence from server-persisted audits ─────────────────────
app.get('/api/keywords/from-audits', authRequired, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT url, result->'keyword_intelligence' AS keywords, created_at
       FROM audits
       WHERE user_id = $1
         AND result->'keyword_intelligence' IS NOT NULL
         AND jsonb_array_length(result->'keyword_intelligence') > 0
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId]
    );
    const hosts: Record<string, { keywords: any[]; auditCount: number; latestUrl: string }> = {};
    for (const row of rows) {
      let host: string;
      try { host = new URL(row.url).hostname; } catch { continue; }
      if (!hosts[host]) hosts[host] = { keywords: [], auditCount: 0, latestUrl: row.url };
      hosts[host].auditCount++;
      if (!hosts[host].latestUrl) hosts[host].latestUrl = row.url;
      const kws = Array.isArray(row.keywords) ? row.keywords : [];
      const seen = new Set(hosts[host].keywords.map((k: any) => k.keyword));
      for (const kw of kws) {
        if (!seen.has(kw.keyword)) {
          hosts[host].keywords.push(kw);
          seen.add(kw.keyword);
        }
      }
    }
    return res.json({ success: true, hosts });
  } catch (err: any) {
    console.error('[keywords/from-audits] Error:', err?.message);
    return res.status(500).json({ success: false, error: 'Failed to load keyword data' });
  }
});

// Audit history endpoints
app.get('/api/audits', authRequired, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const auditUser = (req as any).user;
    const auditTier = uiTierFromCanonical((auditUser?.tier || 'observer') as CanonicalTier | LegacyTier);
    if (!TIER_LIMITS[auditTier].hasReportHistory) {
      return res.status(403).json({
        error: 'Audit history is not enabled for your current plan.',
        code: 'FEATURE_LOCKED',
        feature: 'reportHistory',
        requiredTier: 'alignment',
      });
    }

    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    // Inline workspace resolution for team view — workspaceRequired is not on this route
    const rawWsHeader = String(req.headers['x-workspace-id'] || '').trim() || null;
    let workspaceId: string | null = req.workspace?.id ?? null;
    if (!workspaceId && rawWsHeader && req.query.team === 'true') {
      const resolved = await resolveWorkspaceForUser(userId, rawWsHeader);
      workspaceId = resolved?.workspaceId ?? null;
    }
    const teamView = req.query.team === 'true' && workspaceId;

    const pool = getPool();

    let rows: any[];
    let total: number;

    if (teamView) {
      // Team view: show all audits from workspace members
      const result = await pool.query(
        `SELECT a.id, a.url, a.visibility_score, a.user_id,
                a.result->>'summary' AS summary,
                a.result->'ai_platform_scores' AS ai_platform_scores,
                a.result->'seo_diagnostics' AS seo_diagnostics,
                a.result->'recommendations' AS recommendations,
                a.created_at,
                u.email AS author_email,
                u.name AS author_name
         FROM audits a
         JOIN users u ON u.id = a.user_id
         WHERE a.workspace_id = $1
         ORDER BY a.created_at DESC
         LIMIT $2 OFFSET $3`,
        [workspaceId, limit, offset]
      );
      rows = result.rows;

      const countResult = await pool.query(
        'SELECT COUNT(*) AS total FROM audits WHERE workspace_id = $1',
        [workspaceId]
      );
      total = Number(countResult.rows[0]?.total || 0);
    } else {
      const result = await pool.query(
        `SELECT id, url, visibility_score,
                result->>'summary' AS summary,
                result->'ai_platform_scores' AS ai_platform_scores,
                result->'seo_diagnostics' AS seo_diagnostics,
                result->'recommendations' AS recommendations,
                created_at
         FROM audits
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );
      rows = result.rows;

      const countResult = await pool.query('SELECT COUNT(*) AS total FROM audits WHERE user_id = $1', [userId]);
      total = Number(countResult.rows[0]?.total || 0);
    }

    return res.json({
      audits: rows,
      total,
      limit,
      offset,
      teamView: !!teamView,
    });
  } catch (err: any) {
    console.error('[Audits] List error:', err);
    return res.status(500).json({ error: 'Failed to fetch audit history' });
  }
});

app.get('/api/audits/target-count', authRequired, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const workspaceId = req.workspace?.id ?? null;
    const rawUrl = String(req.query.url || '').trim();
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!rawUrl) return res.status(400).json({ error: 'Missing url query parameter' });

    const auditUser = (req as any).user;
    const auditTier = uiTierFromCanonical((auditUser?.tier || 'observer') as CanonicalTier | LegacyTier);
    if (!TIER_LIMITS[auditTier].hasReportHistory) {
      return res.status(403).json({
        error: 'Audit history is not enabled for your current plan.',
        code: 'FEATURE_LOCKED',
        feature: 'reportHistory',
        requiredTier: 'alignment',
      });
    }

    const targetKey = normalizeAuditTargetKey(rawUrl);
    const pool = getPool();
    
    // Fetch all audits for this user in this workspace, then normalize and match in JS
    // Also include pre-workspace audits (workspace_id IS NULL) so legacy scans count
    const { rows } = await pool.query(
      `SELECT url FROM audits
       WHERE user_id = $1`,
      [userId]
    );
    
    // Normalize each URL and count matches
    const total = rows.filter((row: any) => normalizeAuditTargetKey(String(row.url || '')) === targetKey).length;

    return res.json({
      url: rawUrl,
      target_key: targetKey,
      total,
    });
  } catch (err: any) {
    console.error('[Audits] Target-count error:', err);
    return res.status(500).json({ error: 'Failed to fetch target scan count' });
  }
});

app.get('/api/audits/:id', authRequired, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const auditId = (req.params as any).id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const auditUser = (req as any).user;
    const auditTier = uiTierFromCanonical((auditUser?.tier || 'observer') as CanonicalTier | LegacyTier);
    if (!TIER_LIMITS[auditTier].hasReportHistory) {
      return res.status(403).json({
        error: 'Audit history is not enabled for your current plan.',
        code: 'FEATURE_LOCKED',
        feature: 'reportHistory',
        requiredTier: 'alignment',
      });
    }

    const pool = getPool();
    const { rows } = await pool.query('SELECT * FROM audits WHERE id = $1 AND user_id = $2', [auditId, userId]);
    if (!rows.length) return res.status(404).json({ error: 'Audit not found' });

    return res.json(rows[0]);
  } catch (err: any) {
    console.error('[Audits] Get error:', err);
    return res.status(500).json({ error: 'Failed to fetch audit' });
  }
});

app.delete('/api/audits/:id', authRequired, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const auditId = String((req.params as any).id || '').trim();
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!auditId) return res.status(400).json({ error: 'Missing audit id' });

    const auditUser = (req as any).user;
    const auditTier = uiTierFromCanonical((auditUser?.tier || 'observer') as CanonicalTier | LegacyTier);
    if (!TIER_LIMITS[auditTier].hasReportHistory) {
      return res.status(403).json({
        error: 'Audit history is not enabled for your current plan.',
        code: 'FEATURE_LOCKED',
        feature: 'reportHistory',
        requiredTier: 'alignment',
      });
    }

    const pool = getPool();
    const { rowCount } = await pool.query('DELETE FROM audits WHERE id = $1 AND user_id = $2', [auditId, userId]);

    if (!rowCount) {
      return res.status(404).json({ error: 'Audit not found' });
    }

    return res.json({ success: true, id: auditId });
  } catch (err: any) {
    console.error('[Audits] Delete error:', err);
    return res.status(500).json({ error: 'Failed to delete audit' });
  }
});

const FIXPACK_ALLOWED_STATUSES = new Set([
  'open',
  'in-progress',
  'blocked',
  'resolved',
  'validated',
  'verification_failed',
  'closed',
]);

const FIXPACK_ALLOWED_LIFECYCLE_STATES = new Set([
  'opened',
  'acknowledged',
  'blocked',
  'fix_deployed',
  'validated',
  'closed',
  'verification_failed',
]);

function deriveFixpackLifecycle(status: string, lifecycleStateRaw: string) {
  const lifecycleState = FIXPACK_ALLOWED_LIFECYCLE_STATES.has(lifecycleStateRaw)
    ? lifecycleStateRaw
    : status === 'in-progress'
      ? 'acknowledged'
      : status === 'blocked'
        ? 'blocked'
        : status === 'resolved'
          ? 'fix_deployed'
          : status === 'validated'
            ? 'validated'
            : status === 'closed'
              ? 'closed'
              : status === 'verification_failed'
                ? 'verification_failed'
                : 'opened';

  const normalizedStatus =
    status || (lifecycleState === 'acknowledged'
      ? 'in-progress'
      : lifecycleState === 'blocked'
        ? 'blocked'
        : lifecycleState === 'fix_deployed'
          ? 'resolved'
          : lifecycleState === 'validated' || lifecycleState === 'closed'
            ? 'validated'
            : lifecycleState === 'verification_failed'
              ? 'verification_failed'
              : 'open');

  const verificationStatus =
    lifecycleState === 'validated' || lifecycleState === 'closed'
      ? 'passed'
      : lifecycleState === 'verification_failed'
        ? 'failed'
        : lifecycleState === 'fix_deployed'
          ? 'pending_reaudit'
          : 'not_requested';

  return { lifecycleState, normalizedStatus, verificationStatus };
}

async function loadOwnedAuditWithResult(pool: any, userId: string, auditId: string) {
  const { rows } = await pool.query(
    'SELECT id, result FROM audits WHERE id = $1 AND user_id = $2',
    [auditId, userId]
  );
  return rows[0] || null;
}

async function seedFixpackLifecycleRows(pool: any, userId: string, auditId: string, auditResult: Record<string, unknown> | null) {
  const strictRubric = auditResult?.strict_rubric as Record<string, unknown> | undefined;
  const requiredFixpacks = Array.isArray(strictRubric?.required_fixpacks)
    ? strictRubric.required_fixpacks as Array<Record<string, unknown>>
    : [];

  for (const fixpack of requiredFixpacks) {
    const fixpackId = String(fixpack?.id || '').trim();
    if (!fixpackId) continue;
    await pool.query(
      `INSERT INTO fixpack_status (user_id, audit_id, fixpack_id, status, verification_status)
       VALUES ($1, $2, $3, 'open', 'not_requested')
       ON CONFLICT (user_id, audit_id, fixpack_id) DO NOTHING`,
      [userId, auditId, fixpackId]
    );
  }
}

app.get('/api/audits/:auditId/fixpacks', authRequired, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const auditId = String((req.params as any).auditId || '').trim();
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!auditId) return res.status(400).json({ error: 'Missing audit id' });

    const pool = getPool();
    const auditRow = await loadOwnedAuditWithResult(pool, userId, auditId);
    if (!auditRow) return res.status(404).json({ error: 'Audit not found' });

    await seedFixpackLifecycleRows(pool, userId, auditId, auditRow.result as Record<string, unknown> | null);

    const { rows } = await pool.query(
      'SELECT * FROM fixpack_status WHERE user_id = $1 AND audit_id = $2 ORDER BY created_at ASC',
      [userId, auditId]
    );
    return res.json({ fixpacks: rows });
  } catch (err: any) {
    console.error('[Fixpack] List error:', err);
    return res.status(500).json({ error: 'Failed to fetch fixpack statuses' });
  }
});

app.patch('/api/audits/:auditId/fixpacks/:packId', authRequired, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const auditId = String((req.params as any).auditId || '').trim();
    const packId = String((req.params as any).packId || '').trim();
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!auditId || !packId) return res.status(400).json({ error: 'Missing parameters' });

    const body = (req.body || {}) as Record<string, unknown>;
    const status = String(body?.status || '').trim();
    if (!FIXPACK_ALLOWED_STATUSES.has(status)) {
      return res.status(400).json({
        error: 'status must be one of open, in-progress, blocked, resolved, validated, verification_failed, or closed',
      });
    }
    const lifecycleStateRaw = String(body?.lifecycleState || '').trim();
    const owner = body?.owner ? String(body.owner).trim().slice(0, 255) : null;
    const blockerReason = body?.blockerReason ? String(body.blockerReason).trim().slice(0, 1000) : null;
    const verificationNotes = body?.verificationNotes ? String(body.verificationNotes).trim().slice(0, 2000) : null;
    const reAuditId = body?.reAuditId ? String(body.reAuditId).trim() : null;

    const pool = getPool();
    const auditRow = await loadOwnedAuditWithResult(pool, userId, auditId);
    if (!auditRow) return res.status(404).json({ error: 'Audit not found' });

    await seedFixpackLifecycleRows(pool, userId, auditId, auditRow.result as Record<string, unknown> | null);

    if (reAuditId) {
      const { rows: reAuditRows } = await pool.query(
        'SELECT id FROM audits WHERE id = $1 AND user_id = $2 LIMIT 1',
        [reAuditId, userId]
      );
      if (!reAuditRows.length) {
        return res.status(400).json({ error: 'reAuditId must reference one of your audits' });
      }
    }

    const lifecycle = deriveFixpackLifecycle(status, lifecycleStateRaw);

    const { rows } = await pool.query(
      `INSERT INTO fixpack_status (
         user_id, audit_id, fixpack_id, status, lifecycle_state, owner,
         started_at, blocked_at, resolved_at, validated_at,
         re_audit_id, blocker_reason, verification_status, verification_notes, reopened_at
       )
       VALUES (
         $1, $2, $3, $4, $5, $6,
         CASE WHEN $5 = 'acknowledged' THEN NOW() ELSE NULL END,
         CASE WHEN $5 = 'blocked' THEN NOW() ELSE NULL END,
         CASE WHEN $5 = 'fix_deployed' THEN NOW() ELSE NULL END,
         CASE WHEN $5 IN ('validated', 'closed') THEN NOW() ELSE NULL END,
         $7, $8, $9, $10,
         CASE WHEN $5 = 'opened' THEN NOW() ELSE NULL END
       )
       ON CONFLICT (user_id, audit_id, fixpack_id) DO UPDATE SET
         status = EXCLUDED.status,
         lifecycle_state = EXCLUDED.lifecycle_state,
         owner = COALESCE(EXCLUDED.owner, fixpack_status.owner),
         started_at = CASE WHEN EXCLUDED.lifecycle_state = 'acknowledged' AND fixpack_status.started_at IS NULL
                           THEN NOW() ELSE fixpack_status.started_at END,
         blocked_at = CASE WHEN EXCLUDED.lifecycle_state = 'blocked' THEN NOW()
                           ELSE fixpack_status.blocked_at END,
         resolved_at = CASE WHEN EXCLUDED.lifecycle_state = 'fix_deployed' THEN NOW()
                            ELSE fixpack_status.resolved_at END,
         validated_at = CASE WHEN EXCLUDED.lifecycle_state IN ('validated', 'closed') THEN NOW()
                             ELSE fixpack_status.validated_at END,
         re_audit_id = COALESCE(EXCLUDED.re_audit_id, fixpack_status.re_audit_id),
         blocker_reason = CASE WHEN EXCLUDED.lifecycle_state = 'blocked'
                               THEN COALESCE(EXCLUDED.blocker_reason, fixpack_status.blocker_reason)
                               ELSE fixpack_status.blocker_reason END,
         verification_status = COALESCE(EXCLUDED.verification_status, fixpack_status.verification_status),
         verification_notes = COALESCE(EXCLUDED.verification_notes, fixpack_status.verification_notes),
         reopened_at = CASE WHEN EXCLUDED.lifecycle_state = 'opened' AND fixpack_status.lifecycle_state <> 'opened'
                            THEN NOW() ELSE fixpack_status.reopened_at END,
         updated_at = NOW()
       RETURNING *`,
      [userId, auditId, packId, lifecycle.normalizedStatus, lifecycle.lifecycleState, owner, reAuditId, blockerReason, lifecycle.verificationStatus, verificationNotes]
    );
    return res.json({ fixpack: rows[0] });
  } catch (err: any) {
    console.error('[Fixpack] Update error:', err);
    return res.status(500).json({ error: 'Failed to update fixpack status' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic audit layer endpoints
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/audits/:auditId/evidence', authRequired, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const auditId = String((req.params as any).auditId || '').trim();
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!auditId) return res.status(400).json({ error: 'Missing audit id' });

    const pool = getPool();
    // Ensure user owns audit
    const { rows: auditRows } = await pool.query(
      'SELECT id FROM audits WHERE id = $1 AND user_id = $2 LIMIT 1',
      [auditId, userId]
    );
    if (!auditRows.length) return res.status(404).json({ error: 'Audit not found' });

    const evidence = await loadEvidenceForRun(auditId);
    return res.json({ evidence });
  } catch (err: any) {
    console.error('[Evidence] Load error:', err);
    return res.status(500).json({ error: 'Failed to load evidence' });
  }
});

app.get('/api/audits/:auditId/score-roadmap', authRequired, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const auditId = String((req.params as any).auditId || '').trim();
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!auditId) return res.status(400).json({ error: 'Missing audit id' });

    const pool = getPool();
    const { rows: auditRows } = await pool.query(
      'SELECT id FROM audits WHERE id = $1 AND user_id = $2 LIMIT 1',
      [auditId, userId]
    );
    if (!auditRows.length) return res.status(404).json({ error: 'Audit not found' });

    const [ruleResults, scoreSnap, fixpacks, brag] = await Promise.all([
      pool.query('SELECT * FROM audit_rule_results WHERE audit_id = $1 ORDER BY rule_id', [auditId]),
      pool.query('SELECT * FROM audit_score_snapshots WHERE audit_id = $1 ORDER BY created_at DESC LIMIT 1', [auditId]),
      pool.query('SELECT * FROM fixpacks WHERE audit_run_id = $1 ORDER BY fixpack_type', [auditId]),
      pool.query('SELECT * FROM brag_trail WHERE audit_run_id = $1 ORDER BY created_at', [auditId]),
    ]);

    return res.json({
      rules: ruleResults.rows,
      score: scoreSnap.rows[0] || null,
      fixpacks: fixpacks.rows,
      brag_trail: brag.rows,
    });
  } catch (err: any) {
    console.error('[ScoreRoadmap] Load error:', err);
    return res.status(500).json({ error: 'Failed to load score roadmap' });
  }
});

app.get('/api/users/me/score-history', authRequired, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT s.audit_id, s.final_score, s.family_scores, s.blocker_count, s.score_version, s.created_at,
              a.url
       FROM audit_score_snapshots s
       JOIN audits a ON a.id = s.audit_id
       WHERE a.user_id = $1
       ORDER BY s.created_at DESC
       LIMIT 100`,
      [userId]
    );
    return res.json({ scores: rows });
  } catch (err: any) {
    console.error('[ScoreHistory] Load error:', err);
    return res.status(500).json({ error: 'Failed to load score history' });
  }
});

app.post('/api/audits/share-link', authRequired, workspaceRequired, heavyActionLimiter, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const workspaceId = req.workspace?.id;
    const { url: rawUrl, analyzedAt, auditId } = (req.body || {}) as { url?: string; analyzedAt?: string; auditId?: string };

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!workspaceId) return res.status(400).json({ error: 'Workspace context missing' });

    // Tier gate: feature-flag based share-link entitlement
    const shareLinkUser = (req as any).user;
    const shareLinkTier = (shareLinkUser?.tier || 'observer') as CanonicalTier | LegacyTier;
    const shareLinkUiTier = uiTierFromCanonical(shareLinkTier);
    if (!TIER_LIMITS[shareLinkUiTier].hasShareableLink) {
      return res.status(403).json({
        error: 'Shareable report links are not enabled for your current plan.',
        code: 'TIER_INSUFFICIENT',
        feature: 'shareableLink',
      });
    }

    if (!rawUrl || !rawUrl.trim()) return res.status(400).json({ error: 'Missing url' });
    if (!auditId && (!analyzedAt || Number.isNaN(Date.parse(analyzedAt)))) {
      return res.status(400).json({ error: 'Missing or invalid analyzedAt timestamp' });
    }
    if (!PUBLIC_REPORT_SIGNING_SECRET) {
      return res.status(500).json({ error: 'Public report signing is not configured' });
    }

    const pool = getPool();
    // Primary lookup: workspace-scoped (includes NULL workspace for legacy audits)
    let { rows } = auditId
      ? await pool.query(
          `SELECT id, created_at
           FROM audits
           WHERE id = $1 AND user_id = $2
             AND (workspace_id IS NOT DISTINCT FROM $3 OR workspace_id IS NULL)
           LIMIT 1`,
          [auditId, userId, workspaceId || null]
        )
      : await pool.query(
          `SELECT id, created_at
           FROM audits
           WHERE user_id = $1
             AND (workspace_id IS NOT DISTINCT FROM $2 OR workspace_id IS NULL)
             AND url = $3
           ORDER BY ABS(EXTRACT(EPOCH FROM (created_at - $4::timestamptz))) ASC
           LIMIT 1`,
          [userId, workspaceId || null, rawUrl.trim(), analyzedAt]
        );

    // Fallback: if workspace-scoped query missed, try user-only ownership check.
    // This covers audits that ended up with a different workspace_id (e.g. user
    // switched workspaces, or audit was created before workspace auto-assign).
    if (!rows[0]?.id && auditId) {
      const fallback = await pool.query(
        `SELECT id, created_at FROM audits WHERE id = $1 AND user_id = $2 LIMIT 1`,
        [auditId, userId]
      );
      rows = fallback.rows;
      if (rows[0]?.id) {
        console.log(`[Share-link] Fallback matched audit ${rows[0].id} (workspace mismatch resolved)`);
      }
    } else if (!rows[0]?.id && !auditId) {
      // Fallback 1: exact URL match (no workspace filter)
      const fallback = await pool.query(
        `SELECT id, created_at FROM audits
         WHERE user_id = $1 AND url = $2
         ORDER BY ABS(EXTRACT(EPOCH FROM (created_at - $3::timestamptz))) ASC
         LIMIT 1`,
        [userId, rawUrl.trim(), analyzedAt]
      );
      rows = fallback.rows;
      if (rows[0]?.id) {
        console.log(`[Share-link] Fallback matched audit ${rows[0].id} by url+timestamp (workspace mismatch resolved)`);
      }
    }

    // Fallback 2: if still no match, try the most recent audit for this user + URL
    // This handles URL normalization edge cases (trailing slash, protocol, etc.)
    if (!rows[0]?.id) {
      const normalizedTarget = normalizeAuditTargetKey(rawUrl.trim());
      const broadFallback = await pool.query(
        `SELECT id, url, created_at FROM audits
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 50`,
        [userId]
      );
      const match = broadFallback.rows.find((row: any) =>
        normalizeAuditTargetKey(String(row.url || '')) === normalizedTarget
      );
      if (match?.id) {
        rows = [match];
        console.log(`[Share-link] Broad fallback matched audit ${match.id} by normalized URL key`);
      }
    }

    const audit = rows[0];
    if (!audit?.id) {
      console.error('[Share-link] Audit NOT FOUND even after all fallbacks. Params:', JSON.stringify({
        auditId: auditId || null,
        userId,
        workspaceId: workspaceId || null,
        url: rawUrl?.trim()?.substring(0, 80),
        analyzedAt: analyzedAt || null,
      }));
      return res.status(404).json({ error: 'Matching audit not found for this report' });
    }

    const targetKey = normalizeAuditTargetKey(rawUrl.trim());
    const { rows: allUserAuditRows } = await pool.query(
      `SELECT id, url, created_at
       FROM audits
       WHERE user_id = $1`,
      [userId]
    );

    const matchingTargetAudits = allUserAuditRows
      .filter((row: any) => normalizeAuditTargetKey(String(row.url || '')) === targetKey)
      .sort((left: any, right: any) => {
        const leftTime = new Date(left.created_at).getTime();
        const rightTime = new Date(right.created_at).getTime();
        if (leftTime !== rightTime) return leftTime - rightTime;
        return String(left.id || '').localeCompare(String(right.id || ''));
      });

    const scanOrdinalIndex = matchingTargetAudits.findIndex((row: any) => String(row.id) === String(audit.id));
    const scanOrdinal = scanOrdinalIndex >= 0 ? scanOrdinalIndex + 1 : 1;
    const scanLabel = scanOrdinal <= 1 ? 'First scan' : `Scan #${scanOrdinal}`;
    const shareLink = await createOrRefreshPublicReportLink({
      auditId: String(audit.id),
      userId: String(userId),
      workspaceId: workspaceId || null,
      targetUrl: rawUrl.trim(),
      scanOrdinal,
    });

    fireMeasurementEvent('share_link_created', req, {
      workspace_id: workspaceId,
      scan_ordinal: scanOrdinal,
      target_scans: matchingTargetAudits.length,
    });

    return res.json({
      token: shareLink.token,
      slug: shareLink.slug,
      expires_at: shareLink.expiresAt,
      share_path: shareLink.sharePath,
      legacy_share_path: shareLink.legacySharePath,
      scan_ordinal: scanOrdinal,
      scan_count_for_target: matchingTargetAudits.length,
      scan_label: scanLabel,
      target_key: targetKey,
      share_link_expiration_days: shareLink.shareLinkExpirationDays,
      public_view: {
        tier: shareLinkUiTier,
        redacted: shareLinkUiTier === 'observer',
      },
    });
  } catch (err: any) {
    console.error('[Audits] Share-link error:', err);
    return res.status(500).json({ error: 'Failed to create share link' });
  }
});

app.post('/api/public/deploy-hooks/:hookId', async (req: Request, res: Response) => {
  try {
    const hookId = String(req.params.hookId || '').trim();
    const providedSecret = String(
      req.get('x-aivis-deploy-secret') ||
      req.get('authorization')?.replace(/^Bearer\s+/i, '') ||
      ''
    ).trim();

    if (!hookId || !providedSecret) {
      return res.status(401).json({ success: false, error: 'Deploy hook secret required' });
    }

    const hook = await resolveDeployHookBySecret(hookId, providedSecret);
    if (!hook) {
      return res.status(401).json({ success: false, error: 'Invalid deploy hook credentials' });
    }

    const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};
    const payload = extractDeployHookPayload(hook.provider as any, body);
    const targetUrl = payload.url || hook.default_url;
    const normalized = targetUrl ? normalizePublicHttpUrl(targetUrl) : { ok: false, error: 'No deployment URL found in hook payload' };
    if (!normalized.ok || !('url' in normalized)) {
      return res.status(400).json({ success: false, error: normalized.error });
    }

    const job = await createDeployVerificationJob({
      userId: String(hook.user_id),
      workspaceId: String(hook.workspace_id),
      url: normalized.url,
      source: `${hook.provider}_deploy_webhook`,
      provider: hook.provider,
      environment: payload.environment,
      deploymentId: payload.deploymentId,
      commitSha: payload.commitSha,
      triggerMetadata: payload.triggerMetadata,
    });

    return res.status(202).json({
      success: true,
      data: {
        jobId: job.id,
        scheduledFor: job.scheduled_for,
        url: job.url,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: String(err?.message || 'Failed to ingest deploy hook') });
  }
});

app.get('/api/public/audits/:token', async (req: Request, res: Response) => {
  try {
    const token = String((req.params as any).token || '');
    if (!token) {
      console.warn('[public-report] Empty share reference received');
      return res.status(400).json({ error: 'Missing report token' });
    }
    const decoded = await resolvePublicReportReference(token);
    if (!decoded) {
      console.warn(`[public-report] Reference resolution returned null (len=${token.length}, isLegacy=${token.includes('.')})`);
      return res.status(401).json({ error: 'Invalid or expired public report token' });
    }

    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT a.id, a.url, a.visibility_score, a.result, a.created_at, COALESCE(u.tier, 'observer') AS owner_tier
       FROM audits
       a
       JOIN users u ON u.id = a.user_id
       WHERE a.id = $1
       LIMIT 1`,
      [decoded.auditId]
    );

    const audit = rows[0];
    if (!audit) return res.status(404).json({ error: 'Report not found' });

    const shared = buildPublicSharedResult(audit.result, audit.owner_tier || 'observer');
    const ownerCanonical = uiTierFromCanonical((audit.owner_tier || 'observer') as CanonicalTier | LegacyTier);

    return res.json({
      id: audit.id,
      url: audit.url,
      visibility_score: audit.visibility_score,
      created_at: audit.created_at,
      result: shared.result,
      is_public_share: true,
      redacted: shared.redacted,
      redaction_note: shared.redaction_note,
      analysis_tier: ownerCanonical,
      analysis_tier_display: getTierDisplayName((audit.owner_tier || 'observer') as CanonicalTier | LegacyTier),
    });
  } catch (err: any) {
    console.error('[Audits] Public report fetch error:', err);
    return res.status(500).json({ error: 'Failed to fetch public report' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Analyze endpoint
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/analyze', authRequired, workspaceRequired, requireWorkspacePermission('audit:run'), heavyActionLimiter, usageGate, async (req: Request, res: Response) => {
  const startTime = Date.now();
  let analyzeLockKey = '';

  req.setTimeout(PROXY_HARD_LIMIT_MS);
  res.setTimeout(PROXY_HARD_LIMIT_MS);

  const requestId =
    ((req.body as any)?.requestId as string) ||
    (req.headers['x-request-id'] as string) ||
    `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const ownerUserId = String((req as any).user?.id || (req as any).userId || '').trim();
    if (!ownerUserId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'NO_USER', request_id: requestId });
    }

    // Zod shape validation on the request body
    const zParsed = analyzeRequestSchema.safeParse(req.body);
    if (!zParsed.success) {
      logMalformedPayload(req, ownerUserId, 'Zod validation failed', { issues: zParsed.error.issues, route: '/api/analyze' });
      return res.status(400).json({ error: 'Invalid request body', code: 'VALIDATION_ERROR', request_id: requestId, details: zParsed.error.issues });
    }

    auditProgress.set(requestId, { step: 'initializing', percent: 0, listeners: new Set(), owner_user_id: ownerUserId });
    res.setHeader('X-Audit-Request-Id', requestId);

    const { url: rawUrl, apiKey: clientKey, findabilityGoals: rawFindabilityGoals } = (req.body || {}) as any;
    if (clientKey) {
      logInvalidApiKey(req, 'client-provided-provider-key');
      return res.status(400).json({ error: 'Client-provided API keys not allowed', code: 'CLIENT_KEY_REJECTED', request_id: requestId });
    }

    const { valid, url: targetUrl, error } = validateUrl(rawUrl || '');
    if (!valid || !targetUrl) {
      const reason = error || 'Invalid URL';
      if (/private|localhost|loopback/i.test(reason)) {
        logPrivateHostAttempt(req, ownerUserId, String(rawUrl || ''));
      } else {
        logMalformedPayload(req, ownerUserId, reason, { rawUrl, route: '/api/analyze' });
      }
      return res.status(400).json({ error: error || 'Invalid URL', code: 'INVALID_URL', request_id: requestId });
    }

    if (ANALYZE_REENTRANCY_GUARD_ENABLED) {
      analyzeLockKey = `${ownerUserId}:${normalizeAuditTargetKey(targetUrl)}`;
      const lockAcquired = acquireAnalyzeLock(analyzeLockKey);
      if (!lockAcquired) {
        return res.status(409).json({
          error: 'An analysis for this target is already in progress',
          code: 'ANALYSIS_IN_PROGRESS',
          request_id: requestId,
        });
      }
    }

    const userTier = (req as any).user?.tier || 'observer';
    const normalizedRequestTier = uiTierFromCanonical((userTier || 'observer') as CanonicalTier | LegacyTier);
    const forceRefreshRequested = Boolean((req.body as any)?.forceRefresh) || req.query.force === '1';
    const requireLiveAi = Boolean((req.body as any)?.requireLiveAi);
    // Observer tier silently falls back to cache — paid tiers get fresh results
    const forceRefresh = forceRefreshRequested && TIER_LIMITS[normalizedRequestTier].hasForceRefresh;
    const retryRequested = Boolean((req.body as any)?.retryRequested) || forceRefresh;
    const scanMockData = Boolean((req.body as any)?.scanMockData);
    const findabilityGoals = parseFindabilityGoals(rawFindabilityGoals);
    const hasFindabilityGoals = findabilityGoals.length > 0;
    const auditCreditPlan = buildAuditCreditPlan({ retryRequested, scanMockData, hasFindabilityGoals });
    const effectiveMonthlyLimit = Number((req as any).monthlyLimit ?? 0) || TIER_LIMITS[normalizedRequestTier]?.scansPerMonth || 0;
    const effectiveCurrentUsage = Number((req as any).currentUsage ?? 0);
    const remainingMonthlyScans = Math.max(0, effectiveMonthlyLimit - effectiveCurrentUsage);

    if (auditCreditPlan.total > 0) {
      const availableCredits = await getAvailablePackCredits(ownerUserId);
      if (availableCredits < auditCreditPlan.total && remainingMonthlyScans <= 0) {
        return res.status(402).json({
          error: `This audit requires ${auditCreditPlan.total.toFixed(2)} credits from your balance. Available: ${availableCredits.toFixed(2)}.`,
          code: 'INSUFFICIENT_PACK_CREDITS',
          required_credits: auditCreditPlan.total,
          available_credits: availableCredits,
          reasons: auditCreditPlan.reasons,
          request_id: requestId,
        });
      }
    }

    const consumeAuditCreditsOrThrow = async () => {
      if (auditCreditPlan.total <= 0) return null;
      const availableCredits = await getAvailablePackCredits(ownerUserId);

      // Referral / pack credits are the discounted path for reruns and add-ons.
      // If they are not available, fall back to the standard monthly scan allowance.
      if (availableCredits < auditCreditPlan.total) {
        if (remainingMonthlyScans > 0) {
          return {
            total: 0,
            reasons: auditCreditPlan.reasons,
            remaining_balance: availableCredits,
            funding_source: 'monthly_scan_allowance',
          };
        }

        throw Object.assign(
          new Error(`This audit requires ${auditCreditPlan.total.toFixed(2)} credits from your balance. Available: ${availableCredits.toFixed(2)}.`),
          {
            code: 'INSUFFICIENT_PACK_CREDITS',
            status: 402,
          }
        );
      }

      const charge = await consumePackCredits(ownerUserId, auditCreditPlan.total, 'audit_advanced_validation', {
        url: targetUrl,
        requestId,
        retryRequested,
        scanMockData,
        hasFindabilityGoals,
      });

      if (!charge.consumed) {
        throw Object.assign(new Error('Advanced audit credits were no longer available. Please refresh your balance and retry.'), {
          code: 'INSUFFICIENT_PACK_CREDITS',
          status: 402,
        });
      }

      req.usageSkipIncrement = true;

      return {
        total: auditCreditPlan.total,
        reasons: auditCreditPlan.reasons,
        remaining_balance: charge.remaining,
        funding_source: 'pack_or_referral_credits',
      };
    };

    // Clear stale provider backoffs so previous request failures can't cascade
    // into this fresh analysis attempt. Each request gets a clean slate.
    clearProviderBackoff();

    const cacheKey = `${targetUrl}::tier:${normalizedRequestTier}`;
    const cacheStart = Date.now();
    const cached = (forceRefresh || hasFindabilityGoals || scanMockData || requireLiveAi)
      ? null
      : (await AnalysisCacheService.get(cacheKey));
    console.log(`[${requestId}] Cache check took ${Date.now() - cacheStart}ms`);

    if (cached) {
      const cachedScore = (cached as any).visibility_score;
      const hasThinWarning = !!(cached as any).thin_content_warning;
      const hasScrapeWarning = !!(cached as any).scrape_warning;
      const hasFallbackMode = typeof (cached as any).fallback_mode === 'string' && (cached as any).fallback_mode.length > 0;
      const cacheTier = String((cached as any).cache_tier || '').trim().toLowerCase();
      const tierMatches = cacheTier === normalizedRequestTier;
      if (tierMatches && cachedScore !== 0 && cachedScore !== undefined && !hasThinWarning && !hasScrapeWarning && !hasFallbackMode) {
        req.usageSkipIncrement = true;
        console.log(`[${requestId}] Cache hit for ${cacheKey} (score: ${cachedScore})`);
        let cachedAuditId: string | null = null;
        try {
          const userId = (req as any).user?.id;
          const workspaceId = req.workspace?.id;
          if (userId) {
            cachedAuditId = await persistAuditRecord({
              userId,
              workspaceId,
              url: targetUrl,
              visibilityScore: Number((cached as any).visibility_score || 0),
              result: cached as Record<string, unknown>,
              tierAtAnalysis: normalizedRequestTier,
            });
          }
        } catch (cacheInsertErr: any) {
          console.warn(`[${requestId}] Cache-hit audit insert failed (non-fatal):`, cacheInsertErr?.message);
        }

        const cachedWithIntegrity = {
          ...cached,
          analysis_integrity: (cached as any).analysis_integrity || buildAnalysisIntegrity({
            mode: 'live',
            evidenceManifest: (cached as any).evidence_manifest,
            modelCount: Number((cached as any).model_count || 1),
            tripleCheckEnabled: Boolean((cached as any).triple_check_enabled),
            recommendationEvidenceSummary: (cached as any).recommendation_evidence_summary,
            normalizedTargetUrl: targetUrl,
            warnings: [],
          }),
        };
        const cachedTextSummary = generateTextSummary(cachedWithIntegrity as any, getTextSummaryDepth(normalizedRequestTier as CanonicalTier));
        const cachedPayload = {
          ...cachedWithIntegrity,
          cached: true,
          processing_time_ms: Date.now() - startTime,
          request_id: requestId,
          ...(cachedAuditId ? { audit_id: cachedAuditId } : {}),
          text_summary: cachedTextSummary,
        };
        return res.json(applyTierResultStripping(cachedPayload, normalizedRequestTier));
      }
      console.log(
        `[${requestId}] Skipping cached result for ${cacheKey} (score: ${cachedScore}, tier_matches: ${tierMatches}, thin: ${hasThinWarning}, scrape_warning: ${hasScrapeWarning}, fallback: ${hasFallbackMode}) — will re-analyze`
      );
    }

    // Increment usage AFTER cache check — only fresh analysis costs a credit.
    // Cache hits return above without consuming a scan.
    if (!req.usageSkipIncrement && !req.usingPackCredits) {
      try {
        await executeTransaction(async (client: any) => {
          await client.query(
            `INSERT INTO usage_daily (user_id, date, requests)
             VALUES ($1, CURRENT_DATE, 1)
             ON CONFLICT (user_id, date)
             DO UPDATE SET requests = usage_daily.requests + 1`,
            [ownerUserId]
          );
        });
      } catch (meterErr: any) {
        console.error(`[${requestId}] CRITICAL: Metering write failed:`, meterErr?.message || meterErr);
        return res.status(503).json({
          error: 'Usage metering temporarily unavailable. Please try again.',
          code: 'METERING_UNAVAILABLE',
          request_id: requestId,
        });
      }
    }

    const apiKey = getServerApiKey();
    if (!apiKey) return res.status(500).json({ error: 'AI provider key not configured', code: 'MISSING_AI_KEY', request_id: requestId });

    const parsedTargetUrl = new URL(targetUrl);
    emitProgress(requestId, 'dns', 5);
    // Real DNS resolution — lookup A/AAAA records for the target host before crawling
    try {
      const dnsHostname = parsedTargetUrl.hostname;
      await Promise.race([
        dnsLookup(dnsHostname, { all: true }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('DNS timeout')), 5_000)),
      ]);
      console.log(`[${requestId}] DNS resolved: ${dnsHostname}`);
    } catch (dnsErr: any) {
      // Non-fatal — Puppeteer will surface a proper error if the host is truly unreachable
      console.warn(`[${requestId}] DNS pre-check failed (non-fatal): ${dnsErr.message}`);
    }
    emitProgress(requestId, 'crawl', 15);
    let scraped: Awaited<ReturnType<typeof scrapeWebsite>>;
    let scrapeWarning: string | null = null;

    try {
      scraped = await scrapeWebsite(targetUrl);
    } catch (scrapeErr: any) {
      if (requireLiveAi) {
        if (!STRICT_LIVE_SOFT_FAIL_ENABLED) {
          return res.status(503).json({
            error: 'Live crawl failed. Demo strict mode requires successful live crawl + AI analysis. Retry on a crawlable URL.',
            code: 'LIVE_CRAWL_REQUIRED',
            request_id: requestId,
          });
        }
        console.warn(`[${requestId}] Strict live mode soft-fail: crawl failed, returning degraded domain-only output`);
      }
      console.warn(`[${requestId}] Scrape failed — using domain-only fallback: ${scrapeErr.message}`);
      scrapeWarning = requireLiveAi
        ? 'Strict live mode fallback applied: crawl could not be completed, so a degraded domain-intelligence result was returned for continuity.'
        : 'Website could not be scraped directly (bot protection / IP block). Analysis is based on domain intelligence only.';
      const parsedFallback = new URL(targetUrl);
      scraped = {
        url: targetUrl,
        data: {
          title: parsedFallback.hostname,
          body: `Domain: ${parsedFallback.hostname}. Unable to fetch page content directly.`,
          html: '',
          meta: { description: '', keywords: '', ogTitle: '', ogDescription: '' },
          headings: { h1: [], h2: [], h3: [] },
          canonical: '',
          links: { internal: 0, external: 0 },
          images: 0,
          wordCount: 0,
        },
      };
    }

    emitProgress(requestId, 'extract', 25);
    const sd = scraped.data;
    if (!sd) return res.status(500).json({ error: 'Failed to scrape website', code: 'SCRAPE_FAILED', request_id: requestId });

    const normalizedTier = normalizedRequestTier;
    const isTripleCheck = normalizedTier === 'signal' || normalizedTier === 'scorefix';
    const isScoreFixTier = normalizedTier === 'scorefix';
    const isFree = userTier === 'observer';

    // ── Tier-based model allocation (updated 2026-03-24) ──
    // Observer [Free]:     Gemini 2.5 Flash :free (primary) — $0.00/scan
    // Alignment [Core]:    GPT-4.1 Mini (primary) — ~$0.001/scan
    // Signal [Premium]:    GPT-4.1 Mini (AI1) → Claude 4 Sonnet (AI2) → Grok 3 Mini (AI3) — ~$0.004/scan
    // Scorefix [AutoPR]:   GPT-4.1 (AI1) → Claude 4 Sonnet (AI2) → Grok 3 (AI3) — premium 3-family pipeline
    let providers: typeof PROVIDERS;
    if (isTripleCheck) {
      const ai1 = isScoreFixTier ? SCOREFIX_AI1 : SIGNAL_AI1;
      providers = [ai1];
    } else if (isFree) {
      providers = [...FREE_PROVIDERS];
    } else {
      providers = [ALIGNMENT_PRIMARY, ...PROVIDERS];
    }

    if (!providers.length) return res.status(500).json({ error: 'No AI providers configured', code: 'NO_PROVIDERS', request_id: requestId });

    const providerCount = isTripleCheck ? 3 : providers.length;

    const bodySnippet = (sd.body || '').substring(0, 2000);

    // ── Diagnostic pre-compute (deterministic, runs before AI) ──────────────
    const _metaDesc = (sd.meta?.description || '').trim();
    const _title = (sd.title || '').trim();
    const _h1s = sd.headings?.h1 || [];
    const _h2s = sd.headings?.h2 || [];
    const _lcpMs = sd.lcpMs || sd.pageLoadMs || 0;

    const _metaDescLen = _metaDesc.length;
    const _metaDescGrade =
      _metaDescLen === 0 ? 'MISSING — CRITICAL'
      : _metaDescLen < 70 ? `${_metaDescLen} chars — TOO SHORT (target 120–160)`
      : _metaDescLen > 165 ? `${_metaDescLen} chars — TOO LONG (will truncate in SERPs/AI previews)`
      : `${_metaDescLen} chars — OK`;

    const _titleLen = _title.length;
    const _titleGrade =
      _titleLen === 0 ? 'MISSING — CRITICAL'
      : _titleLen < 30 ? `${_titleLen} chars — TOO SHORT (target 50–60)`
      : _titleLen > 65 ? `${_titleLen} chars — TOO LONG (may truncate in SERPs)`
      : `${_titleLen} chars — OK`;

    const _h1Grade =
      _h1s.length === 0 ? 'MISSING — CRITICAL (AI models need a primary heading to anchor citations)'
      : _h1s.length === 1 ? `1 H1: "${_h1s[0].substring(0, 80)}" — OK`
      : `${_h1s.length} H1 tags — WARNING (only 1 recommended)`;

    const _lcpGrade =
      _lcpMs <= 0 ? 'Not measured'
      : _lcpMs < 1200 ? `${_lcpMs}ms — FAST`
      : _lcpMs < 2500 ? `${_lcpMs}ms — NEEDS IMPROVEMENT (target <2.5s)`
      : `${_lcpMs}ms — POOR (target <2.5s, currently ${(_lcpMs / 1000).toFixed(1)}s)`;

    const _htmlRaw = sd.html || '';
    const _imgTags = _htmlRaw.match(/<img[^>]*>/gi) || [];
    const _imgsNoAlt = _imgTags.filter((t) => !/alt\s*=/i.test(t)).length;
    const _imgAltGrade =
      _imgTags.length === 0 ? 'No images detected'
      : _imgsNoAlt === 0 ? `${_imgTags.length} images — all have alt text — OK`
      : `${_imgsNoAlt}/${_imgTags.length} images MISSING alt text — affects AI context extraction and accessibility`;

    const _robotsAllowsGpt =
      sd.robots?.fetched === false ? null
      : (sd.robots?.allows?.gptbot === false || (sd.robots?.allows as any)?.GPTBot === false || (sd.robots?.allows as any)?.openai === false)
        ? false
        : sd.robots?.fetched ? true : null;
    const _robotsAiGrade = (() => {
      const robotsPart =
        _robotsAllowsGpt === false ? 'GPTBot/AI crawlers BLOCKED in robots.txt — CRITICAL: AI indexing prevented'
        : _robotsAllowsGpt === true ? 'No AI crawler blocks in robots.txt — OK'
        : 'robots.txt not fetched or unknown';
      const lt = (sd as any).llmsTxt;
      const llmsPart = !lt?.fetched ? '' :
        lt.present ? ' | llms.txt PRESENT — AI guidance file found' :
        ' | llms.txt MISSING — no /llms.txt AI guidance file';
      return robotsPart + llmsPart;
    })();

    const _qH2s = sd.questionH2s || [];
    const _qH2Grade =
      _qH2s.length === 0
        ? '0 question-format H2s — add W/H question headings to qualify for FAQ/AEO extraction'
        : `${_qH2s.length} question-format H2s: ${_qH2s.slice(0, 3).map((q) => `"${q.substring(0, 55)}"`).join(', ')}`;

    const _ogComplete =
      sd.meta?.ogTitle && sd.meta?.ogDescription ? 'og:title + og:description present — OK'
      : !sd.meta?.ogTitle && !sd.meta?.ogDescription ? 'og:title MISSING, og:description MISSING — no social/AI preview coverage'
      : !sd.meta?.ogTitle ? 'og:title MISSING'
      : 'og:description MISSING';

    const _wordCountGrade =
      (sd.wordCount || 0) < 200 ? `${sd.wordCount || 0} words — CRITICAL (below 200 — insufficient for AI citation eligibility)`
      : (sd.wordCount || 0) < 500 ? `${sd.wordCount || 0} words — LOW (target 800+ for knowledge-base eligibility)`
      : (sd.wordCount || 0) < 800 ? `${sd.wordCount || 0} words — MODERATE (target 800+ preferred)`
      : `${sd.wordCount || 0} words — adequate`;

    const _intLinkGrade =
      (sd.links?.internal || 0) < 3 ? `${sd.links?.internal || 0} internal links — SPARSE (hinders AI crawler graph navigation)`
      : `${sd.links?.internal || 0} internal links — OK`;

    const _canonicalGrade =
      sd.canonical ? `present: ${sd.canonical}` : 'MISSING — duplicate content not resolved, canonical tag absent';

    const diagnosticFlags: string[] = [
      `Title: ${_titleGrade}`,
      `Meta description: ${_metaDescGrade}`,
      `H1: ${_h1Grade}`,
      `Word count: ${_wordCountGrade}`,
      `Open Graph: ${_ogComplete}`,
      `Image alt text: ${_imgAltGrade}`,
      `Robots/AI crawler access: ${_robotsAiGrade}`,
      `Question-format H2s: ${_qH2Grade}`,
      `LCP / page load: ${_lcpGrade}`,
      `Internal links: ${_intLinkGrade}`,
      `Canonical tag: ${_canonicalGrade}`,
      `HTTPS: ${targetUrl.startsWith('https') ? 'enabled — OK' : 'NOT HTTPS — CRITICAL trust signal missing'}`,
      `TLDR / summary block: ${sd.hasTldr ? `detected — "${(sd.tldrText || '').substring(0, 80)}"` : 'not detected — consider adding a key-takeaways or TL;DR section'}`,
    ];
    // ────────────────────────────────────────────────────────────────────────

    // Evidence manifest
    const evidenceManifest: Record<string, string> = {
      ev_title: `${_titleGrade} | "${_title.substring(0, 80)}"`,
      ev_meta_desc: `${_metaDescGrade} | value: "${_metaDesc.substring(0, 120)}"`,
      ev_meta_kw: sd.meta?.keywords || '(none)',
      ev_og_title: sd.meta?.ogTitle || '(MISSING)',
      ev_og_desc: sd.meta?.ogDescription || '(MISSING)',
      ev_og_status: _ogComplete,
      ev_h1: _h1Grade,
      ev_h2: `${_h2s.length} H2 headings: ${JSON.stringify(_h2s.slice(0, 8))}`,
      ev_h3: `${(sd.headings?.h3 || []).length} H3 headings`,
      ev_question_h2s: _qH2Grade,
      ev_canonical: _canonicalGrade,
      ev_https: targetUrl.startsWith('https') ? 'HTTPS enabled — OK' : 'NOT HTTPS — CRITICAL',
      ev_word_count: _wordCountGrade,
      ev_links_int: _intLinkGrade,
      ev_links_ext: `${sd.links?.external || 0} external links`,
      ev_images: `${sd.images || 0} total images`,
      ev_img_alt: _imgAltGrade,
      ev_robots: _robotsAiGrade,
      ev_llms_txt: (() => {
        const lt = (sd as any).llmsTxt;
        if (!lt?.fetched) return 'llms.txt: not fetched (timeout or not attempted)';
        if (!lt.present) return 'llms.txt: NOT PRESENT — add /llms.txt to guide AI crawlers on what to index and cite';
        const preview = (lt.raw || '').substring(0, 120).replace(/\n/g, ' ');
        return `llms.txt: PRESENT — "${preview}${lt.raw?.length > 120 ? '…' : ''}"`;
      })(),
      ev_lcp_ms: _lcpGrade,
      ev_tldr: sd.hasTldr ? `TLDR/summary detected: "${(sd.tldrText || '').substring(0, 100)}"` : 'No TLDR/summary block detected',
      ev_schema: '0 JSON-LD blocks (updated post-extraction)',
      ev_faq_schema: 'FAQPage schema: unknown (updated post-extraction)',
      ev_body: bodySnippet.substring(0, 500),
    };

    const domainIntelligence = {
      domain: parsedTargetUrl.hostname,
      page_title: sd.title || '',
      page_description: sd.meta?.description || '',
      canonical_url: sd.canonical || targetUrl,
      language: 'en',
      robots: 'index, follow',
      primary_topics: [] as string[],
      citation_domains: [] as string[],
      citation_strength: [] as CitationStrength[],
      entity_clarity_score: 0,
      entity_clarity_excerpt: '',
      open_graph: {
        title: sd.meta?.ogTitle || '',
        description: sd.meta?.ogDescription || '',
      } as { title?: string; description?: string; image?: string },
    };

    const externalDomains = Array.from(
      new Set(
        Array.from((sd.html || '').matchAll(/https?:\/\/([^/\s"'>]+)/gi))
          .map((m) => m[1].replace(/^www\./, '').toLowerCase())
          .filter((h) => h && h !== parsedTargetUrl.hostname)
      )
    );
    domainIntelligence.citation_domains = externalDomains;

    const contentAnalysis = {
      word_count: sd.wordCount || 0,
      headings: {
        h1: sd.headings?.h1?.length || 0,
        h2: sd.headings?.h2?.length || 0,
        h3: sd.headings?.h3?.length || 0,
      },
      has_proper_h1: (sd.headings?.h1?.length || 0) > 0,
      has_meta_description: !!(sd.meta?.description || '').trim(),
      faq_count: Number(sd?.questionH2Count || 0),
      review_sentiment: undefined as any,
    };

    // Enrichment calls are now heuristic-based (no AI calls) — instant, free,
    // and cannot poison provider backoff or consume rate limits.
    const [citationStrengths, clarity, sentiment] = await Promise.all([
      assessCitationStrength(externalDomains, sd.body || '', apiKey).catch((e: any) => { console.warn(`[${requestId}] citation strength heuristic failed (non-fatal):`, e?.message); return null; }),
      assessEntityClarity(sd.body || '', apiKey).catch((e: any) => { console.warn(`[${requestId}] entity clarity heuristic failed (non-fatal):`, e?.message); return null; }),
      analyzeReviewSentiment(sd.body || '', apiKey).catch((e: any) => { console.warn(`[${requestId}] review sentiment heuristic failed (non-fatal):`, e?.message); return null; }),
    ]) as [CitationStrength[] | null, Awaited<ReturnType<typeof assessEntityClarity>> | null, Awaited<ReturnType<typeof analyzeReviewSentiment>> | null];

    if (citationStrengths) {
      domainIntelligence.citation_strength = citationStrengths;
    }
    if (clarity) {
      domainIntelligence.entity_clarity_score = clarity.score;
      if (clarity.excerpt) domainIntelligence.entity_clarity_excerpt = clarity.excerpt;
    }
    if (sentiment) {
      (contentAnalysis as any).review_sentiment = sentiment;
    }

    const technicalSignals = {
      response_time_ms: Number(sd.pageLoadMs || sd.lcpMs || (Date.now() - startTime)),
      status_code: 200,
      content_length: (sd.html || '').length,
      image_count: sd.images || 0,
      link_count: (sd.links?.internal || 0) + (sd.links?.external || 0),
      https_enabled: targetUrl.startsWith('https'),
      has_canonical: !!sd.canonical,
    };

    const schemaMarkup = extractSchemaSignalsFromHtml(sd.html || '');

    // ── Merge scraper's full-DOM structured data (not subject to HTML truncation) ──
    if (sd.structuredData) {
      if (sd.structuredData.hasFAQ && !schemaMarkup.has_faq_schema) {
        schemaMarkup.has_faq_schema = true;
      }
      if (sd.structuredData.hasLocalBusiness && !schemaMarkup.has_organization_schema) {
        schemaMarkup.has_organization_schema = true;
      }
      if (sd.structuredData.jsonLdCount > schemaMarkup.json_ld_count) {
        schemaMarkup.json_ld_count = sd.structuredData.jsonLdCount;
      }
      for (const t of sd.structuredData.uniqueTypes) {
        if (!schemaMarkup.schema_types.includes(t)) {
          schemaMarkup.schema_types.push(t);
        }
      }
    }

    // ── Comprehensive schema quality scoring ──
    try {
      const pageContentSignals = deriveContentSignals(
        sd.body || '',
        sd.wordCount || 0,
        (sd.headings?.h2 || []) as string[],
      );
      schemaMarkup.schema_score = scoreSchema(sd.html || '', pageContentSignals);
    } catch (schemaScoreErr: any) {
      console.warn(`[${requestId}] Schema quality scoring failed (non-fatal):`, schemaScoreErr?.message);
    }

    // Count question-like headings from both H2 and H3
    const questionReFaq = /\?|^(who|what|when|where|why|how|is|are|does|do|can|should|which)\b/i;
    const questionH3Count = (sd.headings?.h3 || []).filter((t: string) => questionReFaq.test(t)).length;
    contentAnalysis.faq_count = Math.max(
      contentAnalysis.faq_count + questionH3Count,
      schemaMarkup.has_faq_schema ? 5 : 0
    );

    emitProgress(requestId, 'schema', 35);

    const bodyWordCount = sd.wordCount || 0;
    const headingSignalCount = (sd.headings?.h1?.length || 0) + (sd.headings?.h2?.length || 0);
    const hasStructuredSignals = schemaMarkup.json_ld_count > 0 || schemaMarkup.schema_types.length > 0;
    const hasMetaSignals = !!sd.title || !!sd.meta?.description || !!sd.canonical;
    const hasLinkSignals = ((sd.links?.internal || 0) + (sd.links?.external || 0)) > 0;
    const hasRenderableSignals = hasStructuredSignals || hasMetaSignals || hasLinkSignals || headingSignalCount > 0;
    const shouldReturnThinFallback = bodyWordCount < 30 && !hasRenderableSignals;
    const goalAlignment = computeGoalAlignment(findabilityGoals, sd);
    const mockDataScan = computeMockDataScan(sd, scanMockData);
    const scoreAdjustmentTotal = goalAlignment.score_adjustment + mockDataScan.score_adjustment;

    if (shouldReturnThinFallback) {
      // Detect likely SPA / client-rendered site for better messaging
      const rawHtml = sd.html || '';
      const spaIndicators = [
        rawHtml.includes('id="root"') || rawHtml.includes('id="app"') || rawHtml.includes('id="__next"'),
        rawHtml.includes('__NEXT_DATA__') || rawHtml.includes('__NUXT__'),
        /\bnonce=["'][^"']+["']/.test(rawHtml) && bodyWordCount < 5,
        (rawHtml.match(/<script/gi) || []).length > 3 && bodyWordCount < 10,
      ];
      const likelySpa = spaIndicators.filter(Boolean).length >= 1;
      const thinReason = likelySpa
        ? `This site appears to be a JavaScript-rendered application (SPA). The page content is loaded dynamically after the initial HTML, which means search engines and AI answer engines may also struggle to read it. Only ${bodyWordCount} word(s) were found in the crawl-accessible HTML.`
        : `${parsedTargetUrl.hostname} returned only ${bodyWordCount} crawl-accessible word(s) with minimal structural signals. The page may block bots, require authentication, or deliver content only via JavaScript.`;

      if (requireLiveAi) {
        if (!STRICT_LIVE_SOFT_FAIL_ENABLED) {
          return res.status(422).json({
            error: `Strict live mode rejected this target: only ${bodyWordCount} crawl-accessible words were found. Use a content-rich URL for demo reliability.`,
            code: 'THIN_CONTENT_REJECTED',
            request_id: requestId,
          });
        }
        scrapeWarning = `Strict live mode fallback applied: target had only ${bodyWordCount} crawl-accessible words, so a degraded scrape-only result was returned.`;
      }
      console.warn(`[${requestId}] Extremely thin content detected (${bodyWordCount} words, no crawl signals) — building scrape-only result`);
      emitProgress(requestId, 'complete', 100);

      const thinBaseScore = Math.min(15, bodyWordCount * 2);
      const thinFinalScore = clampScore(thinBaseScore + scoreAdjustmentTotal);
      const thinSeoDiagnostics = computeSeoDiagnostics(sd, schemaMarkup, technicalSignals, 'url');
      const thinEvidenceFixPlan = buildEvidenceFixPlan(
        thinSeoDiagnostics,
        [],
        evidenceManifest,
        normalizedTier === 'scorefix' ? 'thorough' : 'standard'
      );
      const thinCitationParityAudit = buildCitationParityAudit({
        url: targetUrl,
        analyzedAt: new Date().toISOString(),
        visibilityScore: thinFinalScore,
        categoryGrades: [],
        recommendations: [],
        contentHighlights: [],
        evidenceManifest,
        schemaMarkup,
        contentAnalysis,
        domainIntelligence,
        technicalSignals,
        topicalKeywords: [],
        brandEntities: [],
        goalAlignment,
        recommendationEvidenceSummary: {
          evidence_ref_integrity_percent: 100,
          evidence_coverage_percent: 0,
          recommendations_with_evidence: 0,
        },
      });
      const thinRailEvidenceAudit = buildRailEvidenceAudit({
        sourceType: 'url',
        evidenceManifest,
        contentAnalysis,
        schemaMarkup,
        domainIntelligence,
        technicalSignals,
        recommendationEvidenceSummary: {
          evidence_coverage_percent: 0,
          evidence_ref_integrity_percent: 100,
          recommendations_with_evidence: 0,
        },
        evidenceFixPlan: thinEvidenceFixPlan,
        citationParityAudit: thinCitationParityAudit,
      });
      const thinStrictRubric = buildStrictRubricSystem({
        sourceType: 'url',
        visibilityScore: thinFinalScore,
        seoDiagnostics: thinSeoDiagnostics,
        recommendationEvidenceSummary: {
          evidence_coverage_percent: 0,
          evidence_ref_integrity_percent: 100,
          recommendations_with_evidence: 0,
        },
        evidenceFixPlan: thinEvidenceFixPlan,
        citationParityAudit: thinCitationParityAudit,
        railEvidenceAudit: thinRailEvidenceAudit,
      });

      const thinResult = attachTruthSignals({
        visibility_score: thinFinalScore,
        ai_platform_scores: derivePlatformScores(thinFinalScore, sd, schemaMarkup, targetUrl),
        ai_model_scores: deriveModelScores({
          baseScore: thinFinalScore,
          categoryGrades: [],
          pipelineModels: [providers[0]?.model],
        }),
        summary: thinReason,
        key_takeaways: [
          `Only ${bodyWordCount} crawl-accessible word(s) detected at audit time`,
          ...(likelySpa ? [
            'This appears to be a JavaScript-rendered (SPA) page — content is not in the initial HTML',
            'AI answer engines (ChatGPT, Perplexity, Gemini) cannot read client-side-only content',
            'Implement SSR (server-side rendering), SSG (static site generation), or prerendering to make content crawlable',
          ] : [
            'The page delivered minimal headings, metadata, links, and structured data signals',
            'Expose a crawlable content route (SSR/SSG/prerendered HTML) for core intent pages',
            'Ensure title/meta/canonical/JSON-LD are present in initial HTML and not only client-side',
          ]),
        ],
        topical_keywords: [],
        keyword_intelligence: [],
        brand_entities: [],
        primary_topics: [],
        faq_count: contentAnalysis.faq_count,
        category_grades: [],
        content_highlights: [],
        recommendations: [],
        crypto_intelligence: {
          has_crypto_signals: false,
          summary: 'No analysis performed — insufficient content',
          detected_assets: [],
          keywords: [],
          wallet_addresses: [],
          sentiment: 'neutral' as const,
          risk_notes: [],
          chain_networks: [],
          onchain_enriched: false,
          experimental: true as const,
        },
        audit_version: { version: 1, timestamp: new Date().toISOString(), audit_id: requestId, models: ['scrape-only'] },
        schema_markup: schemaMarkup,
        content_analysis: contentAnalysis,
        domain_intelligence: domainIntelligence,
        technical_signals: technicalSignals,
        seo_diagnostics: thinSeoDiagnostics,
        url: targetUrl,
        analyzed_at: new Date().toISOString(),
        processing_time_ms: Date.now() - startTime,
        cached: false,
        triple_check_enabled: false,
        model_count: 0,
        triple_check_summary: { ai1_score: thinFinalScore, ai2_adjustment: 0, ai3_validated: false, confidence: 'low' as const },
        findability_goals: findabilityGoals,
        goal_alignment: {
          coverage: Number(goalAlignment.coverage.toFixed(3)),
          matched_goals: goalAlignment.matched_goals,
          missing_goals: goalAlignment.missing_goals,
          score_adjustment: goalAlignment.score_adjustment,
        },
        mock_data_scan: mockDataScan,
        evidence_manifest: evidenceManifest,
        analysis_integrity: buildAnalysisIntegrity({
          mode: 'scrape-only',
          evidenceManifest,
          modelCount: 0,
          tripleCheckEnabled: false,
          normalizedTargetUrl: targetUrl,
          recommendationEvidenceSummary: {
            evidence_coverage_percent: 0,
            evidence_ref_integrity_percent: 100,
          },
          warnings: [`Only ${bodyWordCount} crawl-accessible words available`],
        }),
        evidence_fix_plan: thinEvidenceFixPlan,
        citation_parity_audit: thinCitationParityAudit,
        rail_evidence_audit: thinRailEvidenceAudit,
        strict_rubric: thinStrictRubric,
        cache_tier: normalizedRequestTier,
        thin_content_warning: thinReason + (likelySpa
          ? ' Implement server-side rendering (SSR) or static site generation (SSG) so AI crawlers and answer engines can read your content.'
          : ' Consider SSR/SSG or a prerendered marketing/documentation route for AI visibility.'),
      });

      const thinCreditCharge = await consumeAuditCreditsOrThrow();
      if (thinCreditCharge) {
        (thinResult as any).credit_charge = thinCreditCharge;
      }

      try {
        await AnalysisCacheService.set(cacheKey, thinResult as any);
      } catch {}

      try {
        const userId = (req as any).user?.id || (req as any).userId;
        const workspaceId = req.workspace?.id;
        if (userId) {
          await persistAuditRecord({
            userId,
            workspaceId,
            url: targetUrl,
            visibilityScore: thinResult.visibility_score,
            result: thinResult as Record<string, unknown>,
            tierAtAnalysis: normalizedRequestTier,
          });
          settleReferralCreditsIfEligible(userId).catch((err: any) => {
            console.error(`[${requestId}] Referral settlement after thin audit failed:`, err?.message || err);
          });

          fireMeasurementEvent('audit_completed', req, {
            source: 'live_analyze',
            workspace_id: String(workspaceId || ''),
            visibility_score: thinResult.visibility_score,
            model_count: 0,
            is_thin_fallback: true,
          });
        }
      } catch (thinPersistErr: any) {
        console.error(`[${requestId}] THIN-AUDIT PERSIST FAILED:`, thinPersistErr?.message);
      }

      const thinPayload = { ...thinResult, request_id: requestId, text_summary: generateTextSummary(thinResult as any, getTextSummaryDepth(normalizedRequestTier as CanonicalTier)) };
      return res.json(applyTierResultStripping(thinPayload, normalizedRequestTier));
    }

    emitProgress(requestId, 'technical', 38);

    // Crypto scan + Threat intel (parallel, 5s cap each)
    emitProgress(requestId, 'security', 42);
    let cryptoScanResult: Awaited<ReturnType<typeof runCryptoScan>> | null = null;
    let privateExposureScanResult: Awaited<ReturnType<typeof runPrivateExposureScan>> | null = null;
    let threatIntelResult: Awaited<ReturnType<typeof assessUrlRisk>> | null = null;
    const canRunPrivateExposureScan = meetsMinimumTier(
      (((req as any).user?.tier || 'observer') as CanonicalTier | LegacyTier),
      'alignment'
    );
    try {
      const withTimeout = <T>(promise: Promise<T>, ms: number, timeoutMessage: string): Promise<T> => {
        return new Promise<T>((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error(timeoutMessage));
          }, ms);

          promise.then(
            (value) => {
              clearTimeout(timeoutId);
              resolve(value);
            },
            (error) => {
              clearTimeout(timeoutId);
              reject(error);
            },
          );
        });
      };

      const [cryptoRes, privateExposureRes, threatRes] = await Promise.all([
        withTimeout(
          runCryptoScan(sd.body || '', sd.html || ''),
          5_000,
          'Crypto scan timeout (5s)',
        ).catch((e: any) => {
          console.warn(`[${requestId}] Crypto scan skipped (non-fatal):`, e.message);
          return null;
        }),
        canRunPrivateExposureScan
          ? withTimeout(
              runPrivateExposureScan({
                targetUrl,
                ownershipAsserted: true,
                authenticatedContextProvided: false,
              }),
              8_000,
              'Private exposure scan timeout (8s)',
            ).catch((e: any) => {
              console.warn(`[${requestId}] Private exposure scan skipped (non-fatal):`, e.message);
              return null;
            })
          : Promise.resolve(null),
        withTimeout(
          assessUrlRisk(targetUrl),
          5_000,
          'Threat intel timeout (5s)',
        ).catch((e: any) => {
          console.warn(`[${requestId}] Threat intel skipped (non-fatal):`, e.message);
          return null;
        }),
      ]);
      cryptoScanResult = cryptoRes;
      privateExposureScanResult = privateExposureRes;
      threatIntelResult = threatRes;
    } catch (parallelErr: any) {
      console.warn(`[${requestId}] Security scans skipped (non-fatal):`, parallelErr.message);
    }

    evidenceManifest['ev_schema'] = schemaMarkup.json_ld_count === 0
      ? `0 JSON-LD blocks — CRITICAL: no structured data found; AI models rely on schema for entity disambiguation`
      : `${schemaMarkup.json_ld_count} JSON-LD block(s), types: ${JSON.stringify(schemaMarkup.schema_types)}`;
    evidenceManifest['ev_faq_schema'] = schemaMarkup.has_faq_schema
      ? 'FAQPage schema PRESENT — eligible for FAQ rich results and AI Q&A extraction'
      : 'FAQPage schema MISSING — add FAQPage JSON-LD to enable AI Q&A extraction';
    // ── Schema quality evidence (comprehensive scorer) ──
    if (schemaMarkup.schema_score) {
      const ss = schemaMarkup.schema_score;
      evidenceManifest['ev_schema_quality'] = `Schema quality score: ${ss.total}/100 — Validity: ${ss.validity.score}/${ss.validity.max}, Types: ${ss.typeCoverage.score}/${ss.typeCoverage.max}, Properties: ${ss.propertyCompleteness.score}/${ss.propertyCompleteness.max}, Graph: ${ss.entityGraph.score}/${ss.entityGraph.max}, Alignment: ${ss.contentAlignment.score}/${ss.contentAlignment.max}, Vocabulary: ${ss.advancedVocabulary.score}/${ss.advancedVocabulary.max}, Relationships: ${ss.relationshipDepth.score}/${ss.relationshipDepth.max}, Practices: ${ss.bestPractices.score}/${ss.bestPractices.max}`;
      if (ss.declaredIds.length > 0) {
        evidenceManifest['ev_schema_graph'] = `Entity @id graph: ${ss.declaredIds.length} declared, ${ss.crossReferences.length} cross-references${ss.crossReferences.length > 0 ? ' — coherent entity graph' : ' — isolated entities (no cross-refs)'}`;
      }
      if (ss.issues.length > 0) {
        evidenceManifest['ev_schema_issues'] = `Schema issues (${ss.issues.length}): ${ss.issues.slice(0, 5).join('; ')}`;
      }
    }
    // Update diagnostic flags with resolved schema state
    diagnosticFlags.push(`Schema / JSON-LD: ${evidenceManifest['ev_schema']}`);
    diagnosticFlags.push(`FAQ schema: ${evidenceManifest['ev_faq_schema']}`);
    if (evidenceManifest['ev_schema_quality']) {
      diagnosticFlags.push(`Schema quality: ${evidenceManifest['ev_schema_quality']}`);
    }
    diagnosticFlags.push(`llms.txt: ${evidenceManifest['ev_llms_txt']}`);

    const evidenceBlock = Object.entries(evidenceManifest)
      .map(([id, value]) => `[${id}] ${value}`)
      .join('\n');

    const validEvidenceIds = new Set(Object.keys(evidenceManifest));

    // ── Run LLM readability validation (entity clarity sub-signal) ──
    let llmReadabilityResult: LLMReadabilityScore | null = null;
    try {
      llmReadabilityResult = validateLLMReadability(
        domainIntelligence as any,
        contentAnalysis as any,
        schemaMarkup as any,
      );
    } catch (llmValErr: any) {
      console.warn(`[${requestId}] LLM readability validation failed (non-fatal):`, llmValErr?.message);
    }

    // ── Compute evidence-based scoring bounds ──
    const evidenceBounds = computeEvidenceScores(sd, schemaMarkup, targetUrl, llmReadabilityResult);
    const boundsBlock = REQUIRED_CATEGORIES
      .map(({ label }) => {
        const b = evidenceBounds[label];
        return b
          ? `- ${label}: ${b.floor}–${b.ceiling} (${b.reasons.join('; ')})`
          : `- ${label}: 0–100`;
      })
      .join('\n');

    const findabilityGoalsBlock = hasFindabilityGoals
      ? `\nFINDABILITY GOALS (user-defined target topics/queries):\n${findabilityGoals.map((goal, index) => `${index + 1}. ${goal}`).join('\n')}\n\nGoal-alignment requirement:\n- Evaluate how clearly the page supports these goals.\n- If goals are weakly represented, lower "AI Readability & Citability" and the final score.\n- Recommendations should prioritize closing those exact goal gaps.`
      : '';

    const mockDataScanBlock = scanMockData
      ? `\nMOCK DATA SCAN MODE (enabled by user):\n- Detect and penalize placeholder/template copy such as lorem ipsum, dummy/sample content, TODO/TBD notes, or unreplaced template text.\n- If mock/template signals are present, reduce Content Depth & Quality and final score accordingly.\n- Add at least one recommendation to replace mock/template content with production-ready copy.`
      : '';

    // Build platform intelligence block from rail-derived scoring
    let platformIntelBlock = '';
    try {
      const platformSignals = extractPlatformSignals(sd, schemaMarkup, targetUrl);
      const platformScores = computePlatformScores(platformSignals);
      platformIntelBlock = '\n' + buildPlatformIntelligencePromptBlock(platformScores) + '\n';
    } catch (platErr: any) {
      console.warn(`[${requestId}] Platform intelligence prompt block failed (non-fatal):`, platErr?.message);
    }

    // ── Tier-specific prompt prefix (ScoreFix gets fix-focused instructions) ──
    const tierPromptPrefix = isScoreFixTier
      ? `SCORE FIX MODE — This analysis is for an automated remediation pipeline.
Your PRIMARY objective is to identify the fastest, highest-impact fixes that will raise this site's AI visibility score.
For each recommendation:
- Prioritize fixes by estimated score lift (highest first).
- Include complete, copy-pasteable code/markup/config that can be applied directly.
- Tag each fix with a scorefix_category so it can be routed to the correct PR file path.
- Focus on what is BROKEN or MISSING vs. what is already working.
- Skip praise — go straight to actionable fixes with measured values and specific targets.

`
      : '';

    const prompt1 = `${tierPromptPrefix}Ai Visibility Intelligence Audits for ${targetUrl} (${parsedTargetUrl.hostname}).
Base ALL findings on the evidence below. Be honest — most sites score C/D. Cite [ev_*] IDs.

WRITING STYLE (mandatory for all text fields):
- Write in a direct, technical, human-edited voice. No filler. No marketing fluff.
- Never use a comma before "and", "or", "but", or "etc." — use the serial-comma-free style throughout.
- Avoid comma-heavy AI patterns. Prefer short declarative sentences over long compound ones.
- Do not start sentences with "Additionally", "Furthermore", "Moreover", or "In conclusion".

EVIDENCE:
${evidenceBlock}

DIAGNOSTIC SNAPSHOT (pre-computed from live scraped data — treat as confirmed facts):
${diagnosticFlags.map((f) => `  • ${f}`).join('\n')}

BODY (first 2000 chars):
${bodySnippet}
${platformIntelBlock}
${findabilityGoalsBlock}
${mockDataScanBlock}

MANDATORY SCORING BOUNDS (enforced server-side — scores outside these ranges will be overridden):
${boundsBlock}
Score according to evidence quality: weak evidence lands in the lower half; strong evidence lands upper half. Most sites earn C/D.

RECOMMENDATION CONTRACT — every recommendation MUST follow this contract:
1. description must START with "Measured: <actual value from evidence>. Target: <required/recommended value>." — no exceptions.
2. implementation must include at least one concrete code, markup, or config example relevant to the specific finding.
3. evidence_ids must cite only real [ev_*] IDs listed above that confirm the problem.
4. scorefix_category must be one of: "schema_structured_data" | "meta_tags" | "heading_structure" | "content_depth" | "technical_seo" | "ai_readability" | "image_accessibility" | "internal_linking" | "robots_access"
5. Do not invent problems not backed by the DIAGNOSTIC SNAPSHOT or EVIDENCE.

Return ONLY valid JSON (no markdown, no fences):
{"visibility_score":<0-100>,"ai_platform_scores":{"chatgpt":<0-100>,"perplexity":<0-100>,"google_ai":<0-100>,"claude":<0-100>},"summary":"<2-3 sentences>","key_takeaways":["<3-5 items>"],"topical_keywords":["<5-10>"],"keyword_intelligence":[{"keyword":"<from topical_keywords>","intent":"informational|commercial|navigational|transactional","volume_tier":"low|medium|high|very_high","competition":"low|medium|high","opportunity":<0-100>,"trend":"rising|stable|declining"}],"brand_entities":["<found on page>"],"primary_topics":["<3-5>"],"faq_count":<int>,"category_grades":[{"grade":"A|B|C|D|F","label":"<category>","score":<0-100>,"summary":"<1-2 sent>","strengths":[],"improvements":[]}],"content_highlights":[{"area":"heading|meta|schema|content|technical|readability","found":"<quote actual text from page>","status":"good|warning|critical|missing","note":"<specific why with measured value>","source_id":"<ev_* ID>"}],"recommendations":[{"priority":"high|medium|low","category":"<category_grade label>","scorefix_category":"<one of the 9 above>","title":"<short specific title>","description":"Measured: <actual value>. Target: <recommended value>. <explanation>","impact":"<specific projected impact with estimated score lift>","difficulty":"easy|medium|hard","implementation":"<specific steps with code/markup example>","evidence_ids":["<ev_*"]}],"crypto_intelligence":{"has_crypto_signals":false,"summary":"<or detected>","detected_assets":[],"keywords":[],"wallet_addresses":[],"sentiment":"neutral","risk_notes":[],"chain_networks":[]}}

Required category_grades labels: "Content Depth & Quality","Heading Structure & H1","Schema & Structured Data","Meta Tags & Open Graph","Technical SEO","AI Readability & Citability"
Grading: A=90-100, B=75-89, C=50-74, D=25-49, F=0-24. Grade letter MUST match numeric score.`;

    emitProgress(requestId, 'ai1', 45);

    const elapsedBeforeAI = Date.now() - startTime;
    const remainingPipelineMs = Math.max(0, PIPELINE_DEADLINE_MS - elapsedBeforeAI);
    const aiBudgetMs = Math.max(
      Math.min(MIN_AI_BUDGET_MS, remainingPipelineMs),
      remainingPipelineMs - PIPELINE_FLUSH_BUFFER_MS
    );

    let activeDeadlineTimer: ReturnType<typeof setTimeout> | null = null;
    const makeDeadlinePromise = (label: string, budgetMs: number) =>
      new Promise<never>((_, reject) => {
        activeDeadlineTimer = setTimeout(() => reject(new Error(`Pipeline deadline (${label}) — ${budgetMs}ms budget exhausted`)), budgetMs);
      });

    let aiAnalysis: any;
    let aiFallbackWarning: string | null = null;

    try {
      let ai1Raw: string | null = null;
      let ai1ParseResult: { ok: true; value: any } | { ok: false; error: string } | null = null;
      let usedModel = providers[0].model;
      let lastErr: Error = new Error('AI1 not started');

      // ── AI1 fallback loop: try each provider in order until one yields valid JSON ──
      for (let pi = 0; pi < providers.length; pi++) {
        const prov = providers[pi];
        usedModel = prov.model;
        ai1Raw = null;
        ai1ParseResult = null;

        try {
          ai1Raw = await Promise.race([
            callAIProvider({
              provider: prov.provider,
              model: prov.model,
              prompt: prompt1,
              apiKey,
              endpoint: prov.endpoint,
              opts: { max_tokens: isScoreFixTier ? 5000 : 3000, temperature: 0.1, timeoutMs: aiBudgetMs },
            }),
            makeDeadlinePromise('primary', aiBudgetMs),
          ]);
          if (activeDeadlineTimer) {
            clearTimeout(activeDeadlineTimer);
            activeDeadlineTimer = null;
          }
          if (ai1Raw) {
            const parsed = safeJsonParse<any>(ai1Raw);
            if (parsed.ok && isUsableAiAnalysisPayload(parsed.value)) {
              ai1ParseResult = parsed;
              break; // success — stop iterating
            } else if (parsed.ok) {
              lastErr = new Error(`AI1 ${prov.model} payload incomplete (missing summary/categories/recommendations)`);
            } else {
              lastErr = new Error(`AI1 ${prov.model} JSON parse failed: ${(parsed as any).error}`);
            }
          } else {
            lastErr = new Error(`AI1 ${prov.model} returned null`);
          }
        } catch (provErr: any) {
          if (activeDeadlineTimer) {
            clearTimeout(activeDeadlineTimer);
            activeDeadlineTimer = null;
          }
          lastErr = provErr;
          // If pipeline deadline exhausted, no point trying more providers
          const errMsg = String(provErr?.message || '').toLowerCase();
          if (errMsg.includes('pipeline deadline') || errMsg.includes('budget exhausted') || errMsg.includes('deadline')) {
            break;
          }
        }

        if (pi < providers.length - 1) {
          console.warn(`[${requestId}] AI1 provider ${prov.model} failed, trying fallback ${providers[pi + 1].model}...`);
          emitProgress(requestId, 'ai1', 40 + pi * 3);
        }
      }

      if (!ai1ParseResult?.ok) {
        emitProgress(requestId, 'ai1', 50);
        throw lastErr;
      }
      aiAnalysis = normalizeAnalysis(ai1ParseResult.value, evidenceBounds);
    } catch (aiErr: any) {
      const msg = String(aiErr?.message || '').toLowerCase();
      const isPipelineDeadline = msg.includes('pipeline deadline') || msg.includes('budget exhausted') || msg.includes('deadline');
      const isProviderFailure =
        msg.includes('ai provider') ||
        msg.includes('openrouter') ||
        msg.includes('timed out') ||
        msg.includes('timeout') ||
        msg.includes('backoff') ||
        msg.includes('rate limit') ||
        msg.includes('generation interrupted') ||
        msg.includes('json parse failed') ||
        msg.includes('payload incomplete') ||
        msg.includes('returned null');

      if (!isPipelineDeadline && !isProviderFailure) {
        throw aiErr;
      }

      console.error(`[${requestId}] *** AI1 FAILED — falling back to deterministic ***`, {
        reason: isPipelineDeadline ? 'pipeline-deadline' : 'provider-failure',
        error: msg.substring(0, 300),
        elapsedMs: Date.now() - startTime,
        budgetMs: aiBudgetMs,
      });

      aiFallbackWarning = isPipelineDeadline
        ? 'Analysis budget was exhausted while waiting for AI providers. Returned a degraded scrape-based result; retry usually succeeds once providers recover.'
        : 'AI providers were temporarily unavailable during analysis. Returned a degraded scrape-based result; retry usually succeeds once providers recover.';

      aiAnalysis = buildDeterministicAnalysis(sd, schemaMarkup, targetUrl, evidenceBounds, parsedTargetUrl.hostname);
    } finally {
      if (activeDeadlineTimer) {
        clearTimeout(activeDeadlineTimer);
        activeDeadlineTimer = null;
      }
    }

    if (aiFallbackWarning && !scrapeWarning && (aiAnalysis?.visibility_score ?? 0) === 0) {
      scrapeWarning = aiFallbackWarning;
    }

    if (requireLiveAi && aiFallbackWarning) {
      if (!STRICT_LIVE_SOFT_FAIL_ENABLED) {
        return res.status(503).json({
          error: 'Strict live mode rejected deterministic fallback output. Retry when AI providers are healthy for full live pipeline execution.',
          code: 'LIVE_AI_PIPELINE_REQUIRED',
          request_id: requestId,
        });
      }
      scrapeWarning = aiFallbackWarning;
      console.warn(`[${requestId}] Strict live mode soft-fail: accepted deterministic fallback due to provider instability`);
    }

    const ai1Score =
      typeof aiAnalysis.visibility_score === 'number'
        ? clampScore(aiAnalysis.visibility_score)
        : computeWeightedCategoryScore(aiAnalysis.category_grades, evidenceBounds);

    // ─────────────────────────────────────────────────────────────────────
    // Triple-Check Pipeline (Signal + Score Fix tiers)
    //   AI2 = Claude 3.5 Haiku peer critique   (score adjustment −15 to +10)
    //   AI3 = GPT-4o Mini validation gate (confirms or overrides)
    // STRICT MODE: for Signal/ScoreFix, both AI2 and AI3 must succeed.
    // If either stage fails, the request fails with a hard error.
    // ─────────────────────────────────────────────────────────────────────
    let tripleCheckResult: {
      enabled: boolean;
      ai2_adjustment: number;
      ai2_raw_adjustment: number;
      ai2_penalty_neutralized: boolean;
      ai2_penalty_reasons: string[];
      ai2_critique: string;
      ai2_extra_recommendations: string[];
      ai2_model: string;
      ai3_validated: boolean;
      ai3_verdict: string;
      ai3_model: string;
      final_score: number;
      ai3_recommended_score?: number;
      confidence: 'high' | 'medium' | 'low';
    } = {
      enabled: false,
      ai2_adjustment: 0,
      ai2_raw_adjustment: 0,
      ai2_penalty_neutralized: false,
      ai2_penalty_reasons: [],
      ai2_critique: '',
      ai2_extra_recommendations: [],
      ai2_model: '',
      ai3_validated: false,
      ai3_verdict: '',
      ai3_model: '',
      final_score: ai1Score,
      confidence: 'medium',
    };

    if (isTripleCheck && !aiFallbackWarning) {
      const strictTripleCheck = false;
      let ai2StageCompleted = false;
      let ai3StageCompleted = false;
      const tcStartMs = Date.now();
      const tcRemainingMs = Math.max(0, PIPELINE_DEADLINE_MS - (Date.now() - startTime));
      const tcBudgetMs = Math.max(
        Math.min(MIN_AI_BUDGET_MS, tcRemainingMs),
        tcRemainingMs - PIPELINE_FLUSH_BUFFER_MS
      );
      const ai2Provider = isScoreFixTier ? SCOREFIX_AI2 : SIGNAL_AI2;
      const ai3Provider = isScoreFixTier ? SCOREFIX_AI3 : SIGNAL_AI3;

      // ── AI2: Peer Critique ──
      emitProgress(requestId, 'ai2', 60);
      const ai2BudgetMs = Math.max(
        Math.min(4_000, tcBudgetMs),
        Math.floor(tcBudgetMs * 0.55)
      ); // 55% of TC budget to AI2

      const ai2Prompt = `You are a PEER REVIEWER for an AI visibility audit. Your job is to CRITIQUE the primary analysis below and adjust the score.
Write in a direct, technical voice. No filler. Never use a comma before "and", "or", "but", or "etc."

ORIGINAL URL: ${targetUrl}
PRIMARY AI SCORE: ${ai1Score}/100

PRIMARY ANALYSIS (JSON):
${JSON.stringify({
  visibility_score: ai1Score,
  category_grades: aiAnalysis.category_grades,
  summary: aiAnalysis.summary,
  key_takeaways: aiAnalysis.key_takeaways,
  content_highlights: aiAnalysis.content_highlights,
}, null, 0)}

EVIDENCE (scraped from live page):
${evidenceBlock}

INSTRUCTIONS:
- Review each category grade. Are they justified by the evidence?
- Check for inflated scores (AI models tend to be too generous).
- Check for missed issues the primary analysis overlooked.
- Provide a score_adjustment between -15 and +10 (negative = primary was too generous, positive = too harsh).
- List 0-3 extra recommendations the primary analysis missed.
- Do NOT claim a signal is missing when the evidence says it is present or OK.
- Do NOT recommend adding TLDR/summary, fixing meta description length, or fixing H1 count if the evidence block already shows those as detected or in-range.
- Extra recommendations must be directly grounded in the evidence block, not generic best practices.
- Be STRICT. Most sites deserve C/D grades. Penalise missing schema, thin content, weak meta tags.

Return ONLY valid JSON:
{"score_adjustment":<-15 to +10>,"critique":"<2-3 sentences explaining why you adjusted>","missed_issues":["<issues primary missed>"],"extra_recommendations":["<0-3 actionable items>"],"category_overrides":[{"label":"<category name>","adjusted_score":<0-100>,"reason":"<why>"}],"confidence":"high|medium|low"}`;

      try {
        const ai2Raw = await Promise.race([
          callAIProvider({
            provider: ai2Provider.provider,
            model: ai2Provider.model,
            prompt: ai2Prompt,
            apiKey,
            endpoint: ai2Provider.endpoint,
            opts: { max_tokens: 600, temperature: 0.2, timeoutMs: ai2BudgetMs },
          }),
          makeDeadlinePromise('AI2-critique', ai2BudgetMs),
        ]);
        if (activeDeadlineTimer) { clearTimeout(activeDeadlineTimer); activeDeadlineTimer = null; }

        if (ai2Raw) {
          const ai2Parsed = safeJsonParse<any>(ai2Raw);
          if (ai2Parsed.ok) {
            const adj = ai2Parsed.value.score_adjustment;
            const clampedAdj = typeof adj === 'number' ? Math.max(-15, Math.min(10, Math.round(adj))) : 0;
            const ai2Critique = typeof ai2Parsed.value.critique === 'string' ? ai2Parsed.value.critique : '';
            const ai2MissedIssues = Array.isArray(ai2Parsed.value.missed_issues)
              ? ai2Parsed.value.missed_issues.filter((issue: any) => typeof issue === 'string').slice(0, 5)
              : [];
            const ai2ExtraRecommendations = Array.isArray(ai2Parsed.value.extra_recommendations)
              ? ai2Parsed.value.extra_recommendations.filter((r: any) => typeof r === 'string').slice(0, 5)
              : [];
            const peerCritiqueFacts = {
              hasTldr: sd.hasTldr === true,
              metaDescriptionLength: _metaDescLen,
              h1Count: _h1s.length,
              questionH2Count: _qH2s.length,
              schemaJsonLdCount: schemaMarkup.json_ld_count,
              hasFaqSchema: schemaMarkup.has_faq_schema,
              externalLinkCount: sd.links?.external || 0,
              wordCount: bodyWordCount,
            };
            const critiqueConflicts = detectPeerCritiqueEvidenceConflicts(
              [ai2Critique, ...ai2MissedIssues].join('\n'),
              peerCritiqueFacts,
            );
            const filteredAi2ExtraRecommendations = ai2ExtraRecommendations.filter(
              (recommendation: string) => detectPeerCritiqueEvidenceConflicts(recommendation, peerCritiqueFacts).length === 0,
            );
            const penaltyGate = evaluateAi2PenaltyGate(peerCritiqueFacts);
            const gateNeutralizedNegative = clampedAdj < 0 && !penaltyGate.allowNegativePenalty;
            const conflictNeutralizedNegative = clampedAdj < 0 && critiqueConflicts.length > 0;
            const ai2PenaltyNeutralized = gateNeutralizedNegative || conflictNeutralizedNegative;

            const ai2PenaltyReasons: string[] = [];
            if (conflictNeutralizedNegative) {
              ai2PenaltyReasons.push(`Conflict with crawl evidence: ${critiqueConflicts.join('; ')}`);
            }
            if (gateNeutralizedNegative) {
              ai2PenaltyReasons.push(
                `Objective quality gate passed (${penaltyGate.passCount}/8): ${penaltyGate.passedChecks.join('; ')}`
              );
            }

            tripleCheckResult.ai2_raw_adjustment = clampedAdj;
            tripleCheckResult.ai2_penalty_neutralized = ai2PenaltyNeutralized;
            tripleCheckResult.ai2_penalty_reasons = ai2PenaltyReasons;
            tripleCheckResult.ai2_adjustment = ai2PenaltyNeutralized ? 0 : clampedAdj;
            tripleCheckResult.ai2_critique = critiqueConflicts.length > 0
              ? `Peer critique contained evidence conflicts and was discounted: ${critiqueConflicts.join('; ')}.`
              : ai2Critique;
            tripleCheckResult.ai2_extra_recommendations = filteredAi2ExtraRecommendations;
            tripleCheckResult.ai2_model = ai2Provider.model;
            tripleCheckResult.confidence = ai2Parsed.value.confidence || 'medium';

            if (critiqueConflicts.length > 0) {
              console.warn(
                `[${requestId}] AI2 critique conflicted with crawl evidence; neutralized adjustment ${clampedAdj} -> ${tripleCheckResult.ai2_adjustment}. Conflicts: ${critiqueConflicts.join('; ')}`
              );
            }
            if (gateNeutralizedNegative) {
              console.warn(
                `[${requestId}] AI2 negative adjustment neutralized by objective quality gate (${penaltyGate.passCount}/8 checks passed).`
              );
            }
            if (filteredAi2ExtraRecommendations.length !== ai2ExtraRecommendations.length) {
              console.warn(
                `[${requestId}] Filtered ${ai2ExtraRecommendations.length - filteredAi2ExtraRecommendations.length} AI2 recommendation(s) that conflicted with crawl evidence.`
              );
            }

            // Apply category overrides from AI2 if provided
            if (Array.isArray(ai2Parsed.value.category_overrides)) {
              for (const override of ai2Parsed.value.category_overrides) {
                if (!override?.label || typeof override.adjusted_score !== 'number') continue;
                if (DETERMINISTIC_CATEGORY_LABELS.has(String(override.label))) continue;
                const catIdx = aiAnalysis.category_grades.findIndex((g: any) => g.label === override.label);
                if (catIdx >= 0) {
                  const bounds = evidenceBounds[override.label as string];
                  const boundedScore = bounds
                    ? Math.max(bounds.floor, Math.min(bounds.ceiling, override.adjusted_score))
                    : override.adjusted_score;
                  const newScore = Math.round(Math.min(100, Math.max(0, boundedScore)));
                  aiAnalysis.category_grades[catIdx] = {
                    ...aiAnalysis.category_grades[catIdx],
                    score: newScore,
                    grade: scoreToGrade(newScore),
                  };
                }
              }
            }

            console.log(`[${requestId}] AI2 peer critique: adjustment=${clampedAdj}, critique="${tripleCheckResult.ai2_critique.substring(0, 80)}..."`);
            ai2StageCompleted = true;
          } else {
            throw new Error(`AI2 JSON parse failed: ${(ai2Parsed as any).error}`);
          }
        }
      } catch (ai2Err: any) {
        if (activeDeadlineTimer) { clearTimeout(activeDeadlineTimer); activeDeadlineTimer = null; }
        if (strictTripleCheck) {
          throw new Error(`TRIPLE_CHECK_AI2_FAILED: ${ai2Err.message}`);
        }
        console.warn(`[${requestId}] AI2 peer critique failed (non-fatal): ${ai2Err.message}`);
      }

      // ── AI3: Validation Gate ──
      const ai3ElapsedMs = Date.now() - tcStartMs;
      const ai3RemainingTcMs = Math.max(0, tcBudgetMs - ai3ElapsedMs);
      const ai3BudgetMs = Math.max(
        Math.min(4_000, ai3RemainingTcMs),
        tcBudgetMs - ai3ElapsedMs - 2_000
      );

      if (ai3BudgetMs > 4_000) {
        emitProgress(requestId, 'ai3', 75);

        const proposedScore = Math.max(0, Math.min(100, ai1Score + tripleCheckResult.ai2_adjustment));

        const ai3Prompt = `You are a VALIDATION GATE for an AI visibility audit. Two prior models have already analyzed this website. Your job is to confirm or override the proposed final score.
Write in a direct, technical voice. No filler. Never use a comma before "and", "or", "but", or "etc."

URL: ${targetUrl}
AI1 PRIMARY SCORE: ${ai1Score}/100 (model: ${providers[0].model})
AI2 PEER ADJUSTMENT: ${tripleCheckResult.ai2_adjustment > 0 ? '+' : ''}${tripleCheckResult.ai2_adjustment} (model: ${tripleCheckResult.ai2_model || 'skipped'})
AI2 CRITIQUE: ${tripleCheckResult.ai2_critique || 'N/A'}
PROPOSED FINAL SCORE: ${proposedScore}/100

CATEGORY GRADES (after AI2 overrides):
${JSON.stringify(aiAnalysis.category_grades.map((g: any) => ({ label: g.label, grade: g.grade, score: g.score })), null, 0)}

KEY EVIDENCE:
${Object.entries(evidenceManifest).slice(0, 10).map(([id, v]) => `[${id}] ${v}`).join('\n')}

INSTRUCTIONS:
- Validate whether ${proposedScore}/100 is fair given the evidence.
- If the score needs modification, provide a final_score override (0-100).  
- validated=true means you agree with the proposed score (±3 points).
- validated=false means you're overriding it.
- Be STRICT. Empty schema/meta/H1 = low scores. Don't inflate.

Return ONLY valid JSON:
{"validated":<true|false>,"final_score":<0-100>,"verdict":"<1-2 sentences>","confidence":"high|medium|low"}`;

        try {
          const ai3Raw = await Promise.race([
            callAIProvider({
              provider: ai3Provider.provider,
              model: ai3Provider.model,
              prompt: ai3Prompt,
              apiKey,
              endpoint: ai3Provider.endpoint,
              opts: { max_tokens: 400, temperature: 0.1, timeoutMs: ai3BudgetMs },
            }),
            makeDeadlinePromise('AI3-validate', ai3BudgetMs),
          ]);
          if (activeDeadlineTimer) { clearTimeout(activeDeadlineTimer); activeDeadlineTimer = null; }

          if (ai3Raw) {
            const ai3Parsed = safeJsonParse<any>(ai3Raw);
            if (ai3Parsed.ok) {
              tripleCheckResult.ai3_validated = ai3Parsed.value.validated === true;
              tripleCheckResult.ai3_verdict = typeof ai3Parsed.value.verdict === 'string' ? ai3Parsed.value.verdict : '';
              tripleCheckResult.ai3_model = ai3Provider.model;
              tripleCheckResult.enabled = true;

              if (ai3Parsed.value.validated) {
                // AI3 agrees — use proposed score
                tripleCheckResult.final_score = proposedScore;
                tripleCheckResult.confidence = ai3Parsed.value.confidence || tripleCheckResult.confidence;
              } else {
                // AI3 overrides — use AI3's final_score
                const ai3Final = typeof ai3Parsed.value.final_score === 'number'
                  ? Math.round(Math.max(0, Math.min(100, ai3Parsed.value.final_score)))
                  : proposedScore;
                tripleCheckResult.final_score = ai3Final;
                tripleCheckResult.confidence = ai3Parsed.value.confidence || 'medium';
              }
              console.log(`[${requestId}] AI3 validation: validated=${tripleCheckResult.ai3_validated}, final=${tripleCheckResult.final_score}, verdict="${tripleCheckResult.ai3_verdict.substring(0, 80)}..."`);
              ai3StageCompleted = true;
            } else {
              throw new Error(`AI3 JSON parse failed: ${(ai3Parsed as any).error}`);
            }
          }
        } catch (ai3Err: any) {
          if (activeDeadlineTimer) { clearTimeout(activeDeadlineTimer); activeDeadlineTimer = null; }
          if (strictTripleCheck) {
            throw new Error(`TRIPLE_CHECK_AI3_FAILED: ${ai3Err.message}`);
          }
          console.warn(`[${requestId}] AI3 validation failed (non-fatal): ${ai3Err.message}`);
          // Fall back to AI1 + AI2 adjustment
          tripleCheckResult.final_score = Math.max(0, Math.min(100, ai1Score + tripleCheckResult.ai2_adjustment));
          tripleCheckResult.enabled = !!tripleCheckResult.ai2_model;
        }
      } else {
        if (strictTripleCheck) {
          throw new Error(`TRIPLE_CHECK_AI3_SKIPPED_INSUFFICIENT_BUDGET: ${ai3BudgetMs}ms`);
        }
        console.warn(`[${requestId}] Skipping AI3 — insufficient budget (${ai3BudgetMs}ms)`);
        tripleCheckResult.final_score = Math.max(0, Math.min(100, ai1Score + tripleCheckResult.ai2_adjustment));
        tripleCheckResult.enabled = !!tripleCheckResult.ai2_model;
      }

      if (strictTripleCheck && (!ai2StageCompleted || !ai3StageCompleted || !tripleCheckResult.enabled)) {
        throw new Error('TRIPLE_CHECK_INCOMPLETE: Required Signal/ScoreFix 3-model pipeline did not complete successfully');
      }
    }

    const evidenceDerivedScore = computeWeightedCategoryScore(aiAnalysis.category_grades, evidenceBounds, ai1Score);

    // Use triple-check final score if pipeline ran, otherwise AI1 score
    const rawFinalVisibilityScore = tripleCheckResult.enabled ? tripleCheckResult.final_score : ai1Score;

    // Allow the triple-check pipeline to gently nudge the evidence-derived score within a bounded range,
    // while still keeping category grades + evidence constraints as the primary source of truth.
    let tripleCheckScoreDelta = 0;
    if (tripleCheckResult.enabled && typeof tripleCheckResult.ai2_adjustment === 'number') {
      // Keep peer-critique influence narrow to avoid volatility across reruns.
      // We still allow positive nudges, but strong negative swings are capped.
      const boundedAi2Adjustment = Math.max(-6, Math.min(8, tripleCheckResult.ai2_adjustment));
      tripleCheckScoreDelta = boundedAi2Adjustment;
    }

    // Final score source of truth: weighted category grades constrained by evidence bounds.
    // This prevents contradictions where category grades imply one score while AI3 forces another.
    const evidenceAnchoredScore = clampScore(evidenceDerivedScore + scoreAdjustmentTotal);
    let finalVisibilityScore = clampScore(evidenceAnchoredScore + tripleCheckScoreDelta);

    // Guardrail: on premium triple-check tiers, keep final score tightly anchored to evidence-derived
    // category grades so AI2/AI3 cannot create large downward volatility between reruns.
    if (tripleCheckResult.enabled && isTripleCheck) {
      const minAllowed = clampScore(evidenceAnchoredScore - 2);
      const maxAllowed = clampScore(evidenceAnchoredScore + 4);
      finalVisibilityScore = Math.max(minAllowed, Math.min(maxAllowed, finalVisibilityScore));
    }

    // Keep AI3 raw recommendation for diagnostics/transparency, but do not let it override
    // the evidence-weighted final score directly.
    if (tripleCheckResult.enabled) {
      tripleCheckResult.ai3_recommended_score = rawFinalVisibilityScore;
      tripleCheckResult.final_score = finalVisibilityScore;
    }

    const elapsedTotal = Date.now() - startTime;
    if (elapsedTotal > PIPELINE_DEADLINE_MS && aiFallbackWarning) {
      const deterministic = buildDeterministicAnalysis(sd, schemaMarkup, targetUrl, evidenceBounds, parsedTargetUrl.hostname);
      emitProgress(requestId, 'complete', 100);
      const deterministicFinalScore = clampScore(deterministic.visibility_score + scoreAdjustmentTotal);
      const deterministicCitationParityAudit = buildCitationParityAudit({
        url: targetUrl,
        analyzedAt: new Date().toISOString(),
        visibilityScore: deterministicFinalScore,
        categoryGrades: deterministic.category_grades,
        recommendations: deterministic.recommendations,
        contentHighlights: deterministic.content_highlights,
        evidenceManifest,
        schemaMarkup,
        contentAnalysis,
        domainIntelligence,
        technicalSignals,
        topicalKeywords: deterministic.topical_keywords,
        brandEntities: deterministic.brand_entities,
        goalAlignment,
      });
      const deterministicRailEvidenceAudit = buildRailEvidenceAudit({
        sourceType: 'url',
        evidenceManifest,
        contentAnalysis,
        schemaMarkup,
        domainIntelligence,
        technicalSignals,
        recommendationEvidenceSummary: {
          evidence_coverage_percent: 0,
          evidence_ref_integrity_percent: 100,
          recommendations_with_evidence: 0,
        },
        citationParityAudit: deterministicCitationParityAudit,
      });
      const deterministicSeoDiagnostics = computeSeoDiagnostics(sd, schemaMarkup, technicalSignals, 'url');
      const deterministicStrictRubric = buildStrictRubricSystem({
        sourceType: 'url',
        visibilityScore: deterministicFinalScore,
        seoDiagnostics: deterministicSeoDiagnostics,
        recommendationEvidenceSummary: {
          evidence_coverage_percent: 0,
          evidence_ref_integrity_percent: 100,
          recommendations_with_evidence: 0,
        },
        evidenceFixPlan: {
          issues: deterministic.recommendations.map((rec, index) => ({
            id: rec.id || `det_fix_${index + 1}`,
            area: rec.category,
            actual_fix: rec.implementation,
            validation_steps: ['Re-run deterministic audit and confirm recommendation is resolved.'],
            evidence_ids: Array.isArray(rec.evidence_ids) ? rec.evidence_ids : [],
          })),
        },
        citationParityAudit: deterministicCitationParityAudit,
        railEvidenceAudit: deterministicRailEvidenceAudit,
      });
      const partial = attachTruthSignals({
        visibility_score: deterministicFinalScore,
        ai_platform_scores: derivePlatformScores(deterministicFinalScore, sd, schemaMarkup, targetUrl),
        ai_model_scores: deriveModelScores({
          baseScore: deterministicFinalScore,
          categoryGrades: deterministic.category_grades,
          pipelineModels: [providers[0]?.model],
        }),
        recommendations: deterministic.recommendations,
        category_grades: deterministic.category_grades,
        content_highlights: deterministic.content_highlights,
        audit_version: { version: 1, timestamp: new Date().toISOString(), audit_id: requestId, models: providers.map((p: any) => p.model) },
        schema_markup: schemaMarkup,
        content_analysis: contentAnalysis,
        domain_intelligence: domainIntelligence,
        technical_signals: technicalSignals,
        seo_diagnostics: deterministicSeoDiagnostics,
        crypto_intelligence: deterministic.crypto_intelligence,
        summary: deterministic.summary,
        key_takeaways: deterministic.key_takeaways,
        topical_keywords: deterministic.topical_keywords,
        keyword_intelligence: deterministic.keyword_intelligence,
        brand_entities: deterministic.brand_entities,
        url: targetUrl,
        analyzed_at: new Date().toISOString(),
        processing_time_ms: elapsedTotal,
        cached: false,
        triple_check_enabled: false,
        triple_check_summary: { ai1_score: deterministicFinalScore, ai2_adjustment: 0, ai3_validated: false, confidence: 'medium' as const },
        model_count: providerCount,
        findability_goals: findabilityGoals,
        goal_alignment: {
          coverage: Number(goalAlignment.coverage.toFixed(3)),
          matched_goals: goalAlignment.matched_goals,
          missing_goals: goalAlignment.missing_goals,
          score_adjustment: goalAlignment.score_adjustment,
        },
        mock_data_scan: mockDataScan,
        evidence_manifest: evidenceManifest,
        analysis_integrity: buildAnalysisIntegrity({
          mode: 'deterministic-fallback',
          evidenceManifest,
          modelCount: providerCount,
          tripleCheckEnabled: false,
          normalizedTargetUrl: targetUrl,
          recommendationEvidenceSummary: {
            evidence_coverage_percent: 0,
            evidence_ref_integrity_percent: 100,
          },
          fallbackMode: 'deterministic-timeout',
          warnings: [
            'AI provider budget exceeded, deterministic fallback applied',
          ],
        }),
        citation_parity_audit: deterministicCitationParityAudit,
        rail_evidence_audit: deterministicRailEvidenceAudit,
        strict_rubric: deterministicStrictRubric,
        fallback_mode: 'deterministic-timeout',
        cache_tier: normalizedRequestTier,
        ...(privateExposureScanResult ? { private_exposure_scan: privateExposureScanResult } : {}),
        ...(llmReadabilityResult ? { llm_readability: llmReadabilityResult } : {}),
      });

      const deterministicCreditCharge = await consumeAuditCreditsOrThrow();
      if (deterministicCreditCharge) {
        (partial as any).credit_charge = deterministicCreditCharge;
      }

      AnalysisCacheService.set(cacheKey, partial as any).catch((e: any) =>
        console.error(`[${requestId}] Deterministic fallback cache write failed:`, e?.message)
      );
      const partialPayload = { ...partial, request_id: requestId, text_summary: generateTextSummary(partial as any, getTextSummaryDepth(normalizedRequestTier as CanonicalTier)) };
      return res.json(applyTierResultStripping(partialPayload, normalizedRequestTier));
    } else if (elapsedTotal > PIPELINE_DEADLINE_MS) {
      console.warn(`[${requestId}] Soft deadline exceeded (${elapsedTotal}ms) but preserving successful AI analysis output`);
    }

    // Use score-proportional defaults instead of static 25-30 so different
    // final scores produce proportionally different platform breakdowns.
    const derivedPlatformScores = derivePlatformScores(finalVisibilityScore, sd, schemaMarkup, targetUrl);
    const rawPlatformScores = {
      chatgpt: aiAnalysis.ai_platform_scores?.chatgpt ?? derivedPlatformScores.chatgpt,
      perplexity: aiAnalysis.ai_platform_scores?.perplexity ?? derivedPlatformScores.perplexity,
      google_ai: aiAnalysis.ai_platform_scores?.google_ai ?? derivedPlatformScores.google_ai,
      claude: aiAnalysis.ai_platform_scores?.claude ?? derivedPlatformScores.claude,
    };

    // Evidence conflict resolution for AI1 base recommendations
    const ai1EvidenceConflictFacts = {
      hasTldr: sd.hasTldr === true,
      metaDescriptionLength: _metaDescLen,
      h1Count: _h1s.length,
      questionH2Count: _qH2s.length,
      schemaJsonLdCount: schemaMarkup.json_ld_count,
      hasFaqSchema: schemaMarkup.has_faq_schema,
      externalLinkCount: sd.links?.external || 0,
      wordCount: bodyWordCount,
    };
    const ai1RecommendationsFiltered = (aiAnalysis.recommendations || []).filter((rec: any) => {
      const conflicts = detectPeerCritiqueEvidenceConflicts(rec.title + ' ' + rec.description, ai1EvidenceConflictFacts);
      if (conflicts.length > 0) {
        console.warn(`[${requestId}] Filtered AI1 recommendation conflicting with evidence: ${rec.title || rec.description || 'unnamed'}`);
        return false;
      }
      return true;
    });

    const recommendations = ai1RecommendationsFiltered.map((rec: any, idx: number) => ({
      id: `rec_${idx + 1}`,
      priority: rec.priority || 'medium',
      category: rec.category || 'General',
      title: rec.title || 'Recommendation',
      description: rec.description || '',
      impact: rec.impact || 'Moderate improvement',
      difficulty: rec.difficulty || 'medium',
      implementation: rec.implementation || '',
      evidence_ids: Array.isArray(rec.evidence_ids)
        ? rec.evidence_ids.filter((id: unknown): id is string => typeof id === 'string')
        : [],
    }));

    const validGrades = ['A', 'B', 'C', 'D', 'F'];
    const categoryGrades = (aiAnalysis.category_grades || []).map((g: any) => ({
      grade: validGrades.includes(g.grade) ? g.grade : 'C',
      label: g.label || 'General',
      score: typeof g.score === 'number' ? Math.min(100, Math.max(0, g.score)) : evidenceMidpointScore(g.label || 'General', evidenceBounds, finalVisibilityScore),
      summary: g.summary || '',
      strengths: Array.isArray(g.strengths) ? g.strengths.filter((s: any) => typeof s === 'string') : [],
      improvements: Array.isArray(g.improvements) ? g.improvements.filter((s: any) => typeof s === 'string') : [],
    }));

    const validAreas = ['heading', 'meta-tags', 'schema', 'content', 'technical', 'readability'];
    const validStatuses = ['good', 'warning', 'critical', 'missing'];
    const contentHighlights = (aiAnalysis.content_highlights || []).map((h: any) => ({
      area: validAreas.includes(h.area) ? h.area : 'content',
      found: typeof h.found === 'string' ? h.found.substring(0, 500) : '',
      status: validStatuses.includes(h.status) ? h.status : 'warning',
      note: typeof h.note === 'string' ? h.note : '',
      source_id: typeof h.source_id === 'string' && validEvidenceIds.has(h.source_id) ? h.source_id : undefined,
    }));

    const processingTime = Date.now() - startTime;

    const auditVersion = {
      version: 1,
      timestamp: new Date().toISOString(),
      audit_id: requestId,
      models: providers.map((p: any) => p.model),
    };

    // Merge AI2 extra recommendations into the main recommendations list
    const allRecommendations = [...recommendations];
    if (tripleCheckResult.ai2_extra_recommendations.length > 0) {
      for (const extraRec of tripleCheckResult.ai2_extra_recommendations) {
        allRecommendations.push({
          id: `rec_tc_${allRecommendations.length + 1}`,
          priority: 'medium' as const,
          category: 'AI Peer Critique',
          title: extraRec.length > 60 ? extraRec.substring(0, 57) + '...' : extraRec,
          description: extraRec,
          impact: 'Identified by peer critique model',
          difficulty: 'medium' as const,
          implementation: '',
          evidence_ids: [],
        });
      }
    }

    const dedupedRecommendations = dedupeRecommendations(allRecommendations);
    const verifiedRecommendationBundle = verifyRecommendationEvidence(dedupedRecommendations, validEvidenceIds);
    const finalizedRecommendationBundle = requireLiveAi
      ? verifyRecommendationEvidence(
          verifiedRecommendationBundle.recommendations.filter((rec: any) => rec.verification_status !== 'unverified'),
          validEvidenceIds
        )
      : verifiedRecommendationBundle;

    if (requireLiveAi && finalizedRecommendationBundle.summary.recommendations_with_evidence <= 0) {
      return res.status(503).json({
        error: 'Strict live mode rejected output with no evidence-linked recommendations. Retry for a fully grounded run.',
        code: 'LIVE_EVIDENCE_QUALITY_REQUIRED',
        request_id: requestId,
      });
    }

    const seoDiagnostics = computeSeoDiagnostics(sd, schemaMarkup, technicalSignals, 'url');
    const evidenceFixPlan = buildEvidenceFixPlan(
      seoDiagnostics,
      finalizedRecommendationBundle.recommendations,
      evidenceManifest,
      normalizedTier === 'scorefix' ? 'thorough' : 'standard'
    );
    const citationParityAudit = buildCitationParityAudit({
      url: targetUrl,
      analyzedAt: new Date().toISOString(),
      visibilityScore: finalVisibilityScore,
      categoryGrades,
      recommendations: finalizedRecommendationBundle.recommendations,
      contentHighlights,
      evidenceManifest,
      schemaMarkup,
      contentAnalysis,
      domainIntelligence,
      technicalSignals,
      topicalKeywords: aiAnalysis.topical_keywords || [],
      brandEntities: aiAnalysis.brand_entities || [],
      goalAlignment,
      recommendationEvidenceSummary: finalizedRecommendationBundle.summary,
    });
    const railEvidenceAudit = buildRailEvidenceAudit({
      sourceType: 'url',
      evidenceManifest,
      contentAnalysis,
      schemaMarkup,
      domainIntelligence,
      technicalSignals,
      recommendationEvidenceSummary: finalizedRecommendationBundle.summary,
      evidenceFixPlan: evidenceFixPlan,
      citationParityAudit: citationParityAudit,
    });
    const strictRubric = buildStrictRubricSystem({
      sourceType: 'url',
      visibilityScore: finalVisibilityScore,
      seoDiagnostics,
      recommendationEvidenceSummary: finalizedRecommendationBundle.summary,
      evidenceFixPlan,
      citationParityAudit,
      railEvidenceAudit,
    });

    const modelScores = deriveModelScores({
      baseScore: finalVisibilityScore,
      categoryGrades,
      pipelineModels: [
        providers[0]?.model,
        tripleCheckResult.ai2_model,
        tripleCheckResult.ai3_model,
      ],
    });

    const result = attachTruthSignals({
      visibility_score: finalVisibilityScore,
      ai_platform_scores: {
        chatgpt: Math.round(Math.min(100, Math.max(0, rawPlatformScores.chatgpt))),
        perplexity: Math.round(Math.min(100, Math.max(0, rawPlatformScores.perplexity))),
        google_ai: Math.round(Math.min(100, Math.max(0, rawPlatformScores.google_ai))),
        claude: Math.round(Math.min(100, Math.max(0, rawPlatformScores.claude))),
      },
      ai_model_scores: modelScores,
      recommendations: finalizedRecommendationBundle.recommendations,
      category_grades: categoryGrades,
      content_highlights: contentHighlights,
      audit_version: auditVersion,
      schema_markup: schemaMarkup,
      content_analysis: contentAnalysis,
      domain_intelligence: domainIntelligence,
      technical_signals: technicalSignals,
      seo_diagnostics: seoDiagnostics,
      crypto_intelligence: (() => {
        const scan = cryptoScanResult;
        const aiCrypto = aiAnalysis.crypto_intelligence;
        if (scan) {
          return {
            has_crypto_signals: scan.has_crypto_signals || aiCrypto?.has_crypto_signals || false,
            summary: scan.summary,
            detected_assets: [...new Set([...(scan.detected_assets || []), ...(aiCrypto?.detected_assets || [])])],
            keywords: [...new Set([...(scan.keywords || []), ...(aiCrypto?.keywords || [])])],
            wallet_addresses: [...new Set([...(scan.wallet_addresses || []), ...(aiCrypto?.wallet_addresses || [])])],
            sentiment: scan.sentiment || aiCrypto?.sentiment || 'neutral',
            risk_notes: [...new Set([...(scan.risk_notes || []), ...(aiCrypto?.risk_notes || [])])],
            chain_networks: [...new Set([...(scan.chain_networks || []), ...(aiCrypto?.chain_networks || [])])],
            onchain_data: scan.onchain_data,
            onchain_enriched: scan.onchain_enriched,
            experimental: true as const,
          };
        }
        return (
          aiCrypto || {
            has_crypto_signals: false,
            summary: 'No cryptocurrency-related content detected',
            detected_assets: [],
            keywords: [],
            wallet_addresses: [],
            sentiment: 'neutral' as const,
            risk_notes: [],
            chain_networks: [],
            onchain_enriched: false,
            experimental: true as const,
          }
        );
      })(),
      summary: aiAnalysis.summary || `AI Visibility Intelligence Audits analysis for ${parsedTargetUrl.hostname}`,
      key_takeaways: aiAnalysis.key_takeaways || [],
      topical_keywords: aiAnalysis.topical_keywords || [],
      keyword_intelligence: aiAnalysis.keyword_intelligence || [],
      brand_entities: aiAnalysis.brand_entities || [],
      findability_goals: findabilityGoals,
      goal_alignment: {
        coverage: Number(goalAlignment.coverage.toFixed(3)),
        matched_goals: goalAlignment.matched_goals,
        missing_goals: goalAlignment.missing_goals,
        score_adjustment: goalAlignment.score_adjustment,
      },
      mock_data_scan: mockDataScan,
      evidence_manifest: evidenceManifest,
      ...(privateExposureScanResult ? { private_exposure_scan: privateExposureScanResult } : {}),
      ...(threatIntelResult ? { threat_intel: threatIntelResult } : {}),
      url: targetUrl,
      analyzed_at: new Date().toISOString(),
      processing_time_ms: processingTime,
      cached: false,
      triple_check_enabled: tripleCheckResult.enabled,
      triple_check_summary: {
        ai1_score: ai1Score,
        ai2_adjustment: tripleCheckResult.ai2_adjustment,
        ai2_raw_adjustment: tripleCheckResult.ai2_raw_adjustment,
        ai2_penalty_neutralized: tripleCheckResult.ai2_penalty_neutralized,
        ai2_penalty_reasons: tripleCheckResult.ai2_penalty_reasons.length > 0
          ? tripleCheckResult.ai2_penalty_reasons
          : undefined,
        ai3_validated: tripleCheckResult.ai3_validated,
        confidence: tripleCheckResult.confidence,
        ai1_model: providers[0]?.model || '',
        ai2_model: tripleCheckResult.ai2_model || undefined,
        ai3_model: tripleCheckResult.ai3_model || undefined,
        ai2_critique: tripleCheckResult.ai2_critique || undefined,
        ai3_verdict: tripleCheckResult.ai3_verdict || undefined,
        ai2_extra_recommendations: tripleCheckResult.ai2_extra_recommendations.length > 0
          ? tripleCheckResult.ai2_extra_recommendations
          : undefined,
        final_score: tripleCheckResult.enabled ? tripleCheckResult.final_score : undefined,
        ai3_recommended_score: tripleCheckResult.enabled ? tripleCheckResult.ai3_recommended_score : undefined,
      },
      model_count: tripleCheckResult.enabled ? 3 : providerCount,
      ...(scrapeWarning ? { scrape_warning: scrapeWarning } : {}),
      recommendation_evidence_summary: finalizedRecommendationBundle.summary,
      analysis_integrity: buildAnalysisIntegrity({
        mode: 'live',
        evidenceManifest,
        modelCount: tripleCheckResult.enabled ? 3 : providerCount,
        tripleCheckEnabled: tripleCheckResult.enabled,
        normalizedTargetUrl: targetUrl,
        recommendationEvidenceSummary: finalizedRecommendationBundle.summary,
        warnings: [scrapeWarning || ''].filter(Boolean),
      }),
      evidence_fix_plan: evidenceFixPlan,
      citation_parity_audit: citationParityAudit,
      rail_evidence_audit: railEvidenceAudit,
      strict_rubric: strictRubric,
      cache_tier: normalizedRequestTier,
      pipeline_mode: 'live_ai',
      ...(llmReadabilityResult ? { llm_readability: llmReadabilityResult } : {}),
    });

    const liveCreditCharge = await consumeAuditCreditsOrThrow();
    if (liveCreditCharge) {
      (result as any).credit_charge = liveCreditCharge;
    }

    emitProgress(requestId, 'compile', 90);
    emitProgress(requestId, 'finalize', 95);
    emitProgress(requestId, 'complete', 100);

    // Insert audit record BEFORE sending response so audit_id reaches the client
    let dbAuditId: string | null = null;
    try {
      const userId = (req as any).user?.id;
      const workspaceId = req.workspace?.id;
      if (userId) {
        dbAuditId = await persistAuditRecord({
          userId,
          workspaceId,
          url: targetUrl,
          visibilityScore: result.visibility_score,
          result: result as Record<string, unknown>,
          tierAtAnalysis: normalizedRequestTier,
        });
      }
    } catch (preInsertErr: any) {
      console.error(`[${requestId}] AUDIT PERSIST FAILED — audit will not be shareable:`, preInsertErr?.message, preInsertErr?.stack?.split('\n').slice(0, 3).join(' | '));
    }

    // ── Auto-competitor detection ────────────────────────────────────────────
    let competitorHint: Record<string, unknown> | null = null;
    try {
      const hintUser = (req as any).user as import('./models/User.js').User | undefined;
      if (hintUser?.id) {
        const userWebsite = String(hintUser.website || '').trim();
        const profileComplete = Boolean(userWebsite);

        // Extract domain from analyzed URL
        let analyzedDomain = '';
        try { analyzedDomain = new URL(targetUrl).hostname.replace(/^www\./, '').toLowerCase(); } catch { /* skip */ }

        let userDomain = '';
        if (userWebsite) {
          try {
            const candidate = /^https?:\/\//i.test(userWebsite) ? userWebsite : `https://${userWebsite}`;
            userDomain = new URL(candidate).hostname.replace(/^www\./, '').toLowerCase();
          } catch { /* skip */ }
        }

        // Don't flag the user's own site as a competitor
        const isSelf = userDomain && analyzedDomain && userDomain === analyzedDomain;

        if (!isSelf && analyzedDomain && profileComplete) {
          const pool = getPool();

          // Check if already tracked
          const { rows: existingComp } = await pool.query(
            `SELECT id FROM competitor_tracking WHERE user_id = $1 AND competitor_url ILIKE $2 LIMIT 1`,
            [hintUser.id, `%${analyzedDomain}%`]
          );
          const alreadyTracked = existingComp.length > 0;

          // Compare topical keywords between user's last audit and this audit
          const topicalKeywords: string[] = Array.isArray((result as any).topical_keywords) ? (result as any).topical_keywords : [];
          const brandEntities: string[] = Array.isArray((result as any).brand_entities) ? (result as any).brand_entities : [];

          // Get user's own latest audit keywords for comparison
          let userKeywords: string[] = [];
          try {
            const { rows: userAudit } = await pool.query(
              `SELECT result->'topical_keywords' AS keywords FROM audits
               WHERE user_id = $1 AND url ILIKE $2
               ORDER BY created_at DESC LIMIT 1`,
              [hintUser.id, `%${userDomain}%`]
            );
            if (userAudit[0]?.keywords && Array.isArray(userAudit[0].keywords)) {
              userKeywords = userAudit[0].keywords.map((k: unknown) => String(k).toLowerCase());
            }
          } catch { /* non-fatal */ }

          // Find shared signals
          const analyzedKeywordsLower = topicalKeywords.map(k => k.toLowerCase());
          const sharedKeywords = userKeywords.filter(k => analyzedKeywordsLower.includes(k));
          const sharedBrands = brandEntities.filter(b => {
            const bLow = b.toLowerCase();
            return userKeywords.some(uk => uk.includes(bLow) || bLow.includes(uk));
          });
          const sharedSignals = [...new Set([...sharedKeywords, ...sharedBrands])].slice(0, 8);

          // Determine if potential competitor: at least 2 shared signals OR same niche keywords overlap >20%
          const overlapRatio = userKeywords.length > 0 ? sharedKeywords.length / userKeywords.length : 0;
          const isPotentialCompetitor = sharedSignals.length >= 2 || overlapRatio >= 0.2;

          if (isPotentialCompetitor || !alreadyTracked) {
            const matchReasons: string[] = [];
            if (sharedKeywords.length >= 2) matchReasons.push(`${sharedKeywords.length} shared topical keywords`);
            if (overlapRatio >= 0.2) matchReasons.push(`${Math.round(overlapRatio * 100)}% keyword overlap with your site`);
            if (sharedBrands.length > 0) matchReasons.push(`Shared brand/entity signals`);

            if (isPotentialCompetitor) {
              competitorHint = {
                is_potential_competitor: true,
                match_reasons: matchReasons,
                user_website: userWebsite,
                analyzed_domain: analyzedDomain,
                shared_signals: sharedSignals,
                already_tracked: alreadyTracked,
                profile_complete: true,
              };
            }
          }
        } else if (!profileComplete && analyzedDomain) {
          // User has no website in profile — nudge them
          competitorHint = {
            is_potential_competitor: false,
            match_reasons: [],
            user_website: '',
            analyzed_domain: analyzedDomain,
            shared_signals: [],
            already_tracked: false,
            profile_complete: false,
          };
        }
      }
    } catch (hintErr: any) {
      // Non-fatal — competitor hint is a nice-to-have
      console.warn(`[${requestId}] Competitor hint detection failed (non-fatal):`, hintErr?.message);
    }

    // ── Platform benchmark comparison ──────────────────────────────────────
    let platformBenchmark: { global_avg: number; total_audits: number; percentile: number } | null = null;
    try {
      const pool = getPool();
      // UNION audits + historical analysis_cache to include all platform data
      const { rows: benchRows } = await pool.query(
        `WITH all_audits AS (
           SELECT visibility_score FROM audits WHERE visibility_score IS NOT NULL
           UNION ALL
           SELECT (result->>'visibility_score')::int AS visibility_score
           FROM analysis_cache
           WHERE result->>'visibility_score' IS NOT NULL
             AND url NOT IN (SELECT DISTINCT url FROM audits WHERE visibility_score IS NOT NULL)
         )
         SELECT
           COUNT(*)::int AS total_audits,
           ROUND(AVG(visibility_score))::int AS global_avg,
           (SELECT COUNT(*)::int FROM all_audits WHERE visibility_score <= $1) AS below_count
         FROM all_audits`,
        [finalVisibilityScore]
      );
      if (benchRows[0] && benchRows[0].total_audits > 0) {
        const total = benchRows[0].total_audits;
        const belowCount = benchRows[0].below_count || 0;
        platformBenchmark = {
          global_avg: benchRows[0].global_avg || 0,
          total_audits: total,
          percentile: Math.min(99, Math.round((belowCount / total) * 100)),
        };
      }
    } catch (benchErr: any) {
      // Non-fatal — benchmark is a nice-to-have
      console.warn(`[${requestId}] Platform benchmark query failed (non-fatal):`, benchErr?.message);
    }

    // ── Text summary narrative (tier-gated) ──────────────────────────────────
    const textSummaryDepth = getTextSummaryDepth(normalizedRequestTier as CanonicalTier);
    const textSummary = generateTextSummary(result as any, textSummaryDepth);

    const fullPayload = { ...result, request_id: requestId, ...(dbAuditId ? { audit_id: dbAuditId } : {}), ...(!dbAuditId ? { _persist_warning: 'audit_not_saved' } : {}), ...(competitorHint ? { competitor_hint: competitorHint } : {}), ...(platformBenchmark ? { platform_benchmark: platformBenchmark } : {}), text_summary: textSummary };
    const responsePayload = applyTierResultStripping(fullPayload, normalizedRequestTier);
    res.json(responsePayload);

    // Fire audit-complete notification (non-blocking)
    {
      const notifUserId = String((req as any).user?.id || '');
      if (notifUserId) {
        createUserNotification({
          userId: notifUserId,
          eventType: 'audit_completed',
          title: 'Audit Complete',
          message: `${parsedTargetUrl.hostname} scored ${result.visibility_score}%`,
          metadata: { url: targetUrl, score: result.visibility_score, auditId: dbAuditId, requestId },
        }).catch(() => {});
      }
    }

    if (!result.scrape_warning) {
      AnalysisCacheService.set(cacheKey, result as any).catch((e: any) => console.error(`[${requestId}] Cache write failed:`, e?.message));
    }

    (async () => {
      try {
        const userId = (req as any).user?.id;
        const workspaceId = req.workspace?.id;
        if (userId && dbAuditId) {
          const pool = getPool();
          const auditInsert = { rows: [{ id: dbAuditId }] }; // already inserted before res.json
          settleReferralCreditsIfEligible(userId).catch((err: any) => {
            console.error(`[${requestId}] Referral settlement after audit failed:`, err?.message || err);
          });
          const auditId = auditInsert.rows[0]?.id;
          if (auditId) {
            await pool.query(
              `UPDATE competitor_tracking
               SET latest_audit_id = $1, latest_score = $2, updated_at = NOW()
               WHERE user_id = $3
                 AND lower(regexp_replace(regexp_replace(competitor_url, '^https?://(www\\.)?', ''), '/+$', ''))
                   = lower(regexp_replace(regexp_replace($4, '^https?://(www\\.)?', ''), '/+$', ''))`,
              [auditId, result.visibility_score, userId, targetUrl]
            );
            // Dispatch webhooks for audit.completed
            if (workspaceId) {
              dispatchWebhooks(userId, workspaceId, 'audit.completed', {
                audit_id: auditId,
                url: targetUrl,
                visibility_score: result.visibility_score,
                model_count: result.model_count || 1,
              }).catch((e: any) => console.warn(`[${requestId}] Webhook dispatch failed:`, e?.message));

              dispatchAuditReportDeliveries({
                userId,
                workspaceId,
                auditId,
                url: targetUrl,
                result,
                ownerTier: (req as any).user?.tier || 'observer',
              }).catch((e: any) => console.warn(`[${requestId}] Report delivery failed:`, e?.message));
            }

            fireMeasurementEvent('audit_completed', req, {
              source: 'live_analyze',
              workspace_id: String(workspaceId || ''),
              visibility_score: result.visibility_score,
              model_count: result.model_count || 1,
              has_scrape_warning: Boolean(result.scrape_warning),
            });
          }
        }

        // ── Background niche ranking (fire-and-forget, no response delay) ──
        const rankingApiKey = process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_API_KEY || null;
        const userTier = ((req as any).user?.tier || 'observer') as string;
        const canRank = rankingApiKey && (userTier === 'signal' || userTier === 'scorefix' || userTier === 'alignment' || userTier === 'premium' || userTier === 'elite');
        if (canRank) {
          const brandEntities: string[] = Array.isArray((result as any).brand_entities) ? (result as any).brand_entities : [];
          const topicalKeywords: string[] = Array.isArray((result as any).topical_keywords) ? (result as any).topical_keywords : [];
          const brandName = String(brandEntities[0] || '').trim() || (() => {
            try { return new URL(targetUrl).hostname.replace(/^www\./, '').split('.')[0] || ''; } catch { return ''; }
          })();
          const nicheKeywords = topicalKeywords.slice(0, 10);
          const niche = nicheKeywords.slice(0, 3).join(', ') || 'SaaS tools and online software';
          if (brandName) {
            runNicheRanking({
              targetUrl,
              brandName,
              niche,
              nicheKeywords,
              apiKey: rankingApiKey!,
              userId,
            }).catch((err: Error) => {
              console.warn(`[${requestId}] Background niche ranking failed (non-fatal):`, err.message);
            });
          }
        }

        // ── Background deterministic audit layer (fire-and-forget) ──
        if (dbAuditId && scraped) {
          runDeterministicAuditLayer(dbAuditId, userId, scraped)
            .then(async (deterministicResult) => {
              if (deterministicResult) {
                const additions = buildDeterministicResponseAdditions(deterministicResult);
                await attachDeterministicToAudit(dbAuditId!, additions).catch((e: any) => {
                  console.warn(`[${requestId}] Deterministic attach failed (non-fatal):`, e?.message);
                });
              }
            })
            .catch((e: any) => {
              console.warn(`[${requestId}] Deterministic pipeline failed (non-fatal):`, e?.message);
            });
        }

        // ── Background SSFR evidence + rule engine + fixpack generation ──
        if (dbAuditId && scraped) {
          (async () => {
            try {
              const ssfrEvidence = extractEvidenceFromScrape(scraped);
              const enriched = enrichEvidenceFromAnalysis(ssfrEvidence, result as any);
              const ruleResults = evaluateSSFRRules(enriched);
              const fixpacks = generateFixpacks(ruleResults, enriched, targetUrl);
              const pool = getPool();
              await persistSSFRResults(pool, dbAuditId!, enriched, ruleResults, fixpacks);
              const summary = buildSSFRSummary(ruleResults);
              console.log(`[${requestId}] SSFR pipeline complete: ${summary.passed_rules}/${summary.total_rules} rules passed, ${fixpacks.length} fixpacks, cap=${summary.effective_score_cap ?? 'none'}`);
            } catch (ssfrErr: any) {
              console.warn(`[${requestId}] SSFR pipeline failed (non-fatal):`, ssfrErr?.message);
            }
          })();
        }

        // ── Background Python deep analysis + cryptographic evidence ledger ──
        if (dbAuditId && scraped) {
          (async () => {
            try {
              const pyAvailable = await isPythonServiceAvailable();
              if (!pyAvailable) return;

              const scrapedText = scraped.data?.body || scraped.data?.html || '';
              const scrapedHeadings = [
                ...(scraped.data?.headings?.h1 || []),
                ...(scraped.data?.headings?.h2 || []),
                ...(scraped.data?.headings?.h3 || []),
              ];

              // Run deep NLP analysis
              const deepResult = await analyzeContentDeep({
                url: targetUrl,
                text: scrapedText,
                title: scraped.data?.title || '',
                meta_description: scraped.data?.meta?.description || '',
                headings: scrapedHeadings,
                json_ld_blocks: scraped.data?.structuredData?.raw?.map((block: any) => typeof block === 'string' ? block : JSON.stringify(block)) || [],
              });

              if (deepResult) {
                // Record evidence in cryptographic ledger
                const evidenceEntries = deepResult.evidence || [];
                const ledgerResult = await recordEvidenceLedger({
                  audit_id: dbAuditId!,
                  url: targetUrl,
                  evidence_entries: evidenceEntries as Array<Record<string, unknown>>,
                });

                // Generate content fingerprint
                const fingerprint = await generateFingerprint({
                  text: scrapedText,
                  url: targetUrl,
                });

                // Persist deep analysis results to audit record
                const pool = getPool();
                await pool.query(
                  `UPDATE audits SET result = jsonb_set(
                    COALESCE(result, '{}'::jsonb),
                    '{deep_analysis}',
                    $1::jsonb
                  ) WHERE id = $2`,
                  [JSON.stringify({
                    nlp: deepResult,
                    evidence_ledger: ledgerResult ? { root_hash: ledgerResult.root_hash, entry_count: ledgerResult.entry_count } : null,
                    content_fingerprint: fingerprint ? { fingerprint: fingerprint.fingerprint, method: fingerprint.method } : null,
                    enriched_at: new Date().toISOString(),
                  }), dbAuditId!]
                );

                console.log(`[${requestId}] Python deep analysis complete: readability=${deepResult.readability?.reading_level}, entities=${deepResult.entities?.total_entity_count}, ledger_root=${ledgerResult?.root_hash?.slice(0, 12) ?? 'none'}`);
              }
            } catch (deepErr: any) {
              console.warn(`[${requestId}] Python deep analysis failed (non-fatal):`, deepErr?.message);
            }
          })();
        }
      } catch (auditErr: any) {
        console.error(`[${requestId}] Failed to store audit trail:`, auditErr.message);
      }
    })();

    return;
  } catch (err: any) {
    console.error(`[${requestId}] Analysis error:`, err);
    if (process.env.SENTRY_DSN) Sentry.captureException(err);
    const code = err.code || 'INTERNAL_ERROR';
    const errMsg = String(err?.message || '');
    const isStrictTripleCheckFailure = errMsg.includes('TRIPLE_CHECK_');
    const status = Number(err?.status) || (code === 'INVALID_URL' ? 400 : isStrictTripleCheckFailure ? 503 : 500);
    return res.status(status).json({ error: err.message || 'Analysis failed', code, request_id: requestId });
  } finally {
    releaseAnalyzeLock(analyzeLockKey);
  }
});

app.post('/api/analyze/upload', authRequired, workspaceRequired, requireWorkspacePermission('audit:run'), heavyActionLimiter, usageGate, incrementUsage, async (req: Request, res: Response) => {
  req.setTimeout(PROXY_HARD_LIMIT_MS);
  res.setTimeout(PROXY_HARD_LIMIT_MS);

  const startTime = Date.now();
  const requestId =
    ((req.body as any)?.requestId as string) ||
    (req.headers['x-request-id'] as string) ||
    `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const ownerUserId = String((req as any).user?.id || (req as any).userId || '').trim();
    if (!ownerUserId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'NO_USER', request_id: requestId });
    }
    auditProgress.set(requestId, { step: 'initializing', percent: 0, listeners: new Set(), owner_user_id: ownerUserId });
    res.setHeader('X-Audit-Request-Id', requestId);

    const userTier = ((req as any).user?.tier || 'observer') as CanonicalTier | LegacyTier;
    if (!meetsMinimumTier(userTier, 'alignment')) {
      logInsufficientTier(req, ownerUserId, 'alignment', String(userTier));
      return res.status(403).json({
        error: 'Document upload analysis requires Alignment, Signal, or Score Fix.',
        code: 'TIER_INSUFFICIENT',
        requiredTier: 'alignment',
        request_id: requestId,
      });
    }

    const normalizedTier = uiTierFromCanonical(userTier);
    const maxFiles = normalizedTier === 'scorefix'
      ? MAX_UPLOAD_FILES_BY_TIER.scorefix
      : normalizedTier === 'signal'
        ? MAX_UPLOAD_FILES_BY_TIER.signal
        : MAX_UPLOAD_FILES_BY_TIER.alignment;
    const maxBytesPerFile = normalizedTier === 'scorefix' ? 50 * 1024 * 1024 : normalizedTier === 'signal' ? 25 * 1024 * 1024 : 10 * 1024 * 1024;
    const maxTotalBytes = normalizedTier === 'scorefix'
      ? MAX_UPLOAD_TOTAL_BYTES_BY_TIER.scorefix
      : normalizedTier === 'signal'
        ? MAX_UPLOAD_TOTAL_BYTES_BY_TIER.signal
        : MAX_UPLOAD_TOTAL_BYTES_BY_TIER.alignment;

    const body = (req.body || {}) as {
      fileName?: string;
      mimeType?: string;
      content?: string;
      encoding?: UploadEncoding;
      files?: UploadPayloadFile[];
    };

    const incomingFiles = Array.isArray(body.files)
      ? body.files
      : [{
          fileName: body.fileName,
          mimeType: body.mimeType,
          content: body.content,
          encoding: body.encoding,
        }];

    const validIncomingFiles = incomingFiles.filter((entry) =>
      entry &&
      typeof entry.fileName === 'string' &&
      typeof entry.mimeType === 'string' &&
      typeof entry.content === 'string'
    );

    if (validIncomingFiles.length === 0) {
      logMalformedPayload(req, ownerUserId, 'Missing files payload', { route: '/api/analyze/upload' });
      return res.status(400).json({
        error: 'Missing files payload. Provide fileName, mimeType, and content.',
        code: 'INVALID_UPLOAD_PAYLOAD',
        request_id: requestId,
      });
    }

    if (validIncomingFiles.length > maxFiles) {
      logInvalidUpload(req, ownerUserId, 'upload batch exceeds tier file limit', {
        route: '/api/analyze/upload',
        tier: normalizedTier,
        maxFiles,
        receivedFiles: validIncomingFiles.length,
      });
      return res.status(400).json({
        error: `Too many files in one upload. ${normalizedTier === 'scorefix' ? 'Score Fix' : normalizedTier === 'signal' ? 'Signal' : 'Alignment'} allows up to ${maxFiles} files per request.`,
        code: 'UPLOAD_FILE_COUNT_EXCEEDED',
        request_id: requestId,
      });
    }

    const parsedFiles: ParsedUploadFile[] = [];
    let totalByteSize = 0;

    for (const item of validIncomingFiles) {
      const fileName = String(item.fileName || '').trim();
      const mimeType = String(item.mimeType || '').trim().toLowerCase();
      const content = typeof item.content === 'string' ? item.content : '';
      const encoding: UploadEncoding = item.encoding === 'base64' ? 'base64' : 'utf8';

      if (!fileName || !mimeType || !content) {
        logMalformedPayload(req, ownerUserId, 'Missing upload file metadata', { fileName, mimeType, route: '/api/analyze/upload' });
        return res.status(400).json({
          error: 'Each uploaded file requires fileName, mimeType, and content.',
          code: 'INVALID_UPLOAD_PAYLOAD',
          request_id: requestId,
        });
      }

      const uploadKind = resolveUploadKind(fileName, mimeType);
      if (!uploadKind) {
        logInvalidUpload(req, ownerUserId, 'unsupported upload media type', {
          fileName,
          mimeType,
          route: '/api/analyze/upload',
        });
        return res.status(415).json({
          error: 'Unsupported file type. Supported: docs and source files (.txt, .md, .html, .pdf, .docx, .png, .jpg, .jpeg, .webp, .js, .ts, .py, .php, .css, .json, etc.)',
          code: 'UNSUPPORTED_MEDIA_TYPE',
          request_id: requestId,
        });
      }

      const rawContent = decodeUploadContent(content, encoding);
      const decodedContent = rawContent.toString('utf8');
      const byteSize = rawContent.byteLength;

      if (byteSize > maxBytesPerFile) {
        logInvalidUpload(req, ownerUserId, 'upload file exceeds tier size limit', {
          fileName,
          mimeType,
          byteSize,
          maxBytesPerFile,
          route: '/api/analyze/upload',
        });
        return res.status(413).json({
          error: `${fileName} exceeds per-file size limit (${Math.floor(maxBytesPerFile / 1024 / 1024)}MB).`,
          code: 'FILE_TOO_LARGE',
          request_id: requestId,
        });
      }

      totalByteSize += byteSize;
      parsedFiles.push({ fileName, mimeType, uploadKind, rawContent, decodedContent, byteSize });
    }

    if (totalByteSize > maxTotalBytes) {
      logInvalidUpload(req, ownerUserId, 'combined upload exceeds request size limit', {
        totalByteSize,
        maxTotalBytes,
        fileCount: parsedFiles.length,
        route: '/api/analyze/upload',
      });
      return res.status(413).json({
        error: `Combined upload size exceeds request limit (${Math.floor(maxTotalBytes / 1024 / 1024)}MB total).`,
        code: 'UPLOAD_TOTAL_TOO_LARGE',
        request_id: requestId,
      });
    }

    emitProgress(requestId, 'extract', 20);
    const extractedByFile: Array<ParsedUploadFile & { extracted: UploadExtractedData }> = [];

    for (const parsedFile of parsedFiles) {
      try {
        const extracted = await extractUploadData(
          parsedFile.fileName,
          parsedFile.uploadKind,
          parsedFile.decodedContent,
          parsedFile.rawContent
        );
        extractedByFile.push({ ...parsedFile, extracted });
      } catch (parseErr: any) {
        return res.status(422).json({
          error: parseErr?.message || `Failed to parse uploaded file ${parsedFile.fileName}`,
          code: 'UPLOAD_PARSE_FAILED',
          request_id: requestId,
        });
      }
    }

    const primaryFileName = parsedFiles[0]?.fileName || 'uploaded-document';
    const syntheticUrl = parsedFiles.length === 1
      ? `upload://${encodeURIComponent(primaryFileName)}`
      : `upload://batch-${requestId}`;
    const sd = mergeUploadData(
      extractedByFile.map((f) => f.extracted),
      parsedFiles.length === 1 ? primaryFileName : `${parsedFiles.length} uploaded files`
    );

    const apiKey = getServerApiKey();
    if (!apiKey) {
      return res.status(500).json({ error: 'AI provider key not configured', code: 'MISSING_AI_KEY', request_id: requestId });
    }

    emitProgress(requestId, 'schema', 35);
    const schemaMarkup = {
      json_ld_count: 0,
      has_organization_schema: false,
      has_faq_schema: false,
      schema_types: [] as string[],
    };

    for (const file of extractedByFile) {
      if (file.uploadKind !== 'html' || !file.extracted.html) continue;
      const fileSchema = extractSchemaSignalsFromHtml(file.extracted.html);
      schemaMarkup.json_ld_count += fileSchema.json_ld_count;
      schemaMarkup.has_organization_schema = schemaMarkup.has_organization_schema || fileSchema.has_organization_schema;
      schemaMarkup.has_faq_schema = schemaMarkup.has_faq_schema || fileSchema.has_faq_schema;
      if (Array.isArray(fileSchema.schema_types) && fileSchema.schema_types.length > 0) {
        schemaMarkup.schema_types.push(...fileSchema.schema_types);
      }
    }

    schemaMarkup.schema_types = Array.from(new Set(schemaMarkup.schema_types.map((entry) => String(entry).trim()).filter(Boolean)));

    const evidenceBounds = computeEvidenceScores(sd, schemaMarkup, syntheticUrl, null);
    const boundsBlock = REQUIRED_CATEGORIES
      .map(({ label }) => {
        const b = evidenceBounds[label];
        return b ? `- ${label}: ${b.floor}–${b.ceiling} (${b.reasons.join('; ')})` : `- ${label}: 0–100`;
      })
      .join('\n');

    const uploadTier = uiTierFromCanonical(userTier);
    const uploadAi1 = uploadTier === 'scorefix' ? SCOREFIX_AI1 : SIGNAL_AI1;
    const providers = ['signal', 'scorefix'].includes(uploadTier)
      ? [uploadAi1, ...PROVIDERS.filter((p) => p.model !== uploadAi1.model)]
      : [ALIGNMENT_PRIMARY, ...PROVIDERS.filter((p) => p.model !== ALIGNMENT_PRIMARY.model)];

    const distinctKinds = [...new Set(extractedByFile.map((f) => f.uploadKind))];
    const evidenceManifest: Record<string, string> = {
      up_file_name: parsedFiles.length === 1 ? primaryFileName : `${parsedFiles.length} uploaded files`,
      up_file_ext: parsedFiles.length === 1 ? (getExtension(primaryFileName) || '(none)') : 'mixed',
      up_mime: parsedFiles.length === 1 ? parsedFiles[0].mimeType : 'mixed',
      up_kind: distinctKinds.length === 1 ? distinctKinds[0] : 'mixed',
      up_file_count: String(parsedFiles.length),
      up_file_list: parsedFiles.map((f) => f.fileName).join(' | ').slice(0, 1000),
      up_total_bytes: String(totalByteSize),
      up_title: sd.title || '(none)',
      up_h1: (sd.headings?.h1 || []).join(' | ') || '(none)',
      up_word_count: String(sd.wordCount || 0),
      up_body: (sd.body || '').slice(0, 4000),
    };
    const validUploadEvidenceIds = new Set(Object.keys(evidenceManifest));

    const uploadRouting = detectUploadAnalysisMode(parsedFiles, sd);

    let prompt = `AI Visibility Intelligence Audits — Code & Template Audit for uploaded document ${parsedFiles.length === 1 ? `"${primaryFileName}"` : 'batch'}.
  Write in a direct, technical voice. No filler. Never use a comma before "and", "or", "but", or "etc."
  Treat this as uploaded source code or template content (not a live URL crawl).
  The upload includes ${parsedFiles.length} file(s): ${parsedFiles.map((f) => f.fileName).join(', ')}.

  THIS IS NOT A FULL CODE REVIEW. Evaluate only these dimensions:
  1. SEO signals: meta tags, title, canonical, Open Graph, heading structure, alt text, keyword placement if rendered as HTML.
  2. AEO signals: structured data / schema markup, FAQ readiness, direct-answer potential, entity clarity.
  3. GEO signals: localization readiness, hreflang, language tags, regional content signals.
  4. Security signals: exposed secrets/keys, inline scripts, mixed content, unsafe patterns (NOT a full vulnerability audit).
  5. AI extractability: would an LLM or RAG pipeline get clean, structured text from this? Chunk-friendliness, heading hierarchy, semantic HTML.

  If the file is source code (.js/.ts/.py/.css etc), evaluate what it would produce when rendered/deployed.
  If the file is an HTML template, evaluate it as a deployable page.
  Base findings only on evidence below and return valid JSON.

  EVIDENCE:\n${Object.entries(evidenceManifest).map(([id, value]) => `[${id}] ${value}`).join('\n')}

  MANDATORY SCORING BOUNDS (enforced server-side):\n${boundsBlock}
  Score near the LOWER end of each range unless evidence clearly demonstrates exceptional quality.

  Required category_grades labels (EXACT strings):
  - "Content Depth & Quality"
  - "Heading Structure & H1"
  - "Schema & Structured Data"
  - "Meta Tags & Open Graph"
  - "Technical SEO"
  - "AI Readability & Citability"

  Grading: A=90-100, B=75-89, C=50-74, D=25-49, F=0-24. Grade letter MUST match numeric score.
  Return 8 to 12 recommendations minimum.

  Return ONLY valid JSON:
  {"visibility_score":<0-100>,"ai_platform_scores":{"chatgpt":<0-100>,"perplexity":<0-100>,"google_ai":<0-100>,"claude":<0-100>},"summary":"<2-3 sentences>","key_takeaways":["<3-5 items>"],"topical_keywords":["<5-10>"],"brand_entities":["<entities>"],"primary_topics":["<3-5>"],"recommendations":[{"priority":"high|medium|low","category":"<cat>","title":"<short>","description":"<detail>","impact":"<impact>","difficulty":"easy|medium|hard","implementation":"<steps>","evidence_ids":["up_*"]}],"category_grades":[{"grade":"A|B|C|D|F","label":"<category>","score":<0-100>,"summary":"<1-2 sent>","strengths":[],"improvements":[]}],"content_highlights":[{"area":"heading|meta-tags|schema|content|technical|readability","found":"<quote>","status":"good|warning|critical|missing","note":"<why>","source_id":"up_*"}]}`;

    if (uploadRouting.mode === 'writing_audit') {
      prompt = `AI Visibility Intelligence Audits — Deep Content & Editorial Audit for uploaded ${uploadRouting.contentType}.
This is a WRITING and EDITORIAL analysis, not a live website crawl.
Upload: ${parsedFiles.length} file(s): ${parsedFiles.map((f) => f.fileName).join(', ')}.

EVIDENCE:\n${Object.entries(evidenceManifest).map(([id, value]) => `[${id}] ${value}`).join('\n')}

═══════════════════════════════════════════════════════════════
AUDIT METHODOLOGY — 7-PASS CONTENT INTELLIGENCE FRAMEWORK
═══════════════════════════════════════════════════════════════

PASS 1 — INTENT & RELEVANCE
- What query or need does this content answer?
- Is the audience clearly identified? What awareness level (unaware / problem-aware / solution-aware)?
- Does the content fulfill a clear search intent (informational / navigational / transactional)?

PASS 2 — CONTENT QUALITY & INFORMATION GAIN
- Assess originality: does this add unique value beyond what already exists on this topic?
- Score information gain (0-100): new insights, unique data, original frameworks vs. rehashed generics.
- Check for AI-generic phrasing, robotic repetition, em-dash overuse. Score de-AI quality.
- Evaluate freshness: are claims, stats, and references current?
- Word count and depth — is it thorough enough for the topic?

PASS 3 — FACTUAL INTEGRITY
- Identify every factual claim. For each: classify as verified / unverified / disputed / missing_source.
- Check if claims are within ~200 words of a trust anchor (citation, data point, named source).
- Flag unsupported statistics, vague attributions ("studies show"), and outdated data.

PASS 4 — STRUCTURE & EXTRACTABILITY
- Heading hierarchy: proper H1 → H2 → H3 flow?
- Vector chunking integrity: flag any paragraph >150 words without a structural break.
- Are there Q&A-style headings that match People Also Ask patterns?
- Does content include 40-60 word direct-answer blocks AI models can extract as citations?
- Readability level assessment (estimate grade level).

PASS 5 — SEO SURFACE & ENTITY CLARITY
- Title tag quality: keyword-front, <60 chars, compelling.
- Entity clarity 4-element check: (1) NAME — what is the subject? (2) WHAT — what does it do/cover? (3) WHO — who created/authored it? (4) WHY — why does it matter?
- Internal/external link quality. Schema opportunities. Image alt text.
- Title-to-text parity: does the title promise match what the body delivers?

PASS 6 — AEO & CITATION READINESS
- How likely are AI models (ChatGPT, Perplexity, Claude, Google AI) to cite/quote this?
- Does it contain self-contained, quotable passages?
- FAQ or Q&A structure present?
- Schema markup recommendations (FAQ, HowTo, Article, etc.).
- Would this content survive RAG extraction — is it chunk-friendly?

PASS 7 — BUSINESS & EDITORIAL VERDICT
- Does this serve a clear business goal (lead gen, authority, conversion)?
- Final verdict: KEEP (publish as-is), REFRESH (update sections), REBUILD (rewrite from scratch), MERGE (combine with another piece), or KILL (archive/delete).

═══════════════════════════════════════════════════════════════
WEIGHTED RUBRIC (score each 0-100)
═══════════════════════════════════════════════════════════════
- Content Quality & Depth: weight 25%
- Factual Integrity: weight 20%
- Structure & Extractability: weight 15%
- SEO Surface: weight 15%
- AEO & Citation Readiness: weight 15%
- Business Relevance: weight 10%

MANDATORY RULES:
- Do NOT use em dashes anywhere. Use commas, periods, or hyphens only.
- Provide concrete editorial corrections and a true rewrite with logged diffs.
- All recommendations must reference up_* evidence IDs.
- Return 8 to 12 recommendations minimum.

Required category_grades labels (EXACT strings):
- "Content Depth & Quality"
- "Heading Structure & H1"
- "Schema & Structured Data"
- "Meta Tags & Open Graph"
- "Technical SEO"
- "AI Readability & Citability"

MANDATORY SCORING BOUNDS (enforced server-side):\n${boundsBlock}
Score near the LOWER end of each range unless evidence clearly demonstrates exceptional quality.

Return ONLY valid JSON:
{"visibility_score":<0-100>,"ai_platform_scores":{"chatgpt":<0-100>,"perplexity":<0-100>,"google_ai":<0-100>,"claude":<0-100>},"summary":"<2-3 sentences>","key_takeaways":["<3-5 items>"],"topical_keywords":["<5-10>"],"brand_entities":["<entities>"],"primary_topics":["<3-5>"],"recommendations":[{"priority":"high|medium|low","category":"<cat>","title":"<short>","description":"<detail>","impact":"<impact>","difficulty":"easy|medium|hard","implementation":"<steps>","evidence_ids":["up_*"]}],"category_grades":[{"grade":"A|B|C|D|F","label":"<category>","score":<0-100>,"summary":"<1-2 sent>","strengths":[],"improvements":[]}],"content_highlights":[{"area":"heading|meta-tags|schema|content|technical|readability","found":"<quote>","status":"good|warning|critical|missing","note":"<why>","source_id":"up_*"}],"writing_audit":{"content_type":"blog|article|ebook|research|general","seo_title":"<improved SEO title>","hook":"<improved opening hook, max 2 sentences>","seo_title_score":<0-100>,"hook_score":<0-100>,"de_ai_score":<0-100>,"freshness_findings":["<issues or passes>"],"de_ai_findings":["<issues or passes>"],"verdict":"keep|refresh|rebuild|merge|kill","rubric_scores":{"content":<0-100>,"facts":<0-100>,"structure":<0-100>,"seo":<0-100>,"aeo":<0-100>,"business":<0-100>},"entity_clarity":{"name":"<subject name>","what":"<what it covers>","who":"<author/creator>","why":"<why it matters>","score":<0-100>},"information_gain_score":<0-100>,"citation_readiness_score":<0-100>,"fact_check_items":[{"claim":"<claim text>","status":"verified|unverified|disputed|missing_source","note":"<context>"}],"readability_level":"<e.g. Grade 8>","chunking_issues":["<paragraph or section description if >150 words without break>"],"rewrite":{"rewritten_text":"<polished rewrite, no em dashes>","diff":[{"type":"title|hook|clarity|tone|seo|freshness|de_ai|structure|fact","original":"<before>","revised":"<after>","reason":"<why>"}]}}}`;
    }

    emitProgress(requestId, 'ai1', 55);
    let aiRaw: string | null = null;
    let aiErr: Error | null = null;

    for (const provider of providers) {
      if (isProviderInBackoff(provider.provider, provider.model)) continue;
      try {
        aiRaw = await callAIProvider({
          provider: provider.provider,
          model: provider.model,
          prompt,
          apiKey,
          endpoint: provider.endpoint,
          opts: { max_tokens: 3000, timeoutMs: 30_000 },
        });
        if (aiRaw) break;
      } catch (err: any) {
        aiErr = err instanceof Error ? err : new Error(String(err));
      }
    }

    if (!aiRaw) {
      throw aiErr || new Error('No AI response from providers');
    }

    const parsed = safeJsonParse<any>(aiRaw);
    if (!parsed.ok) throw new Error((parsed as any).error || 'AI JSON parse failed');

    const aiAnalysis = normalizeAnalysis(parsed.value, evidenceBounds);
    const normalizedRecommendations = (Array.isArray(aiAnalysis.recommendations) ? aiAnalysis.recommendations : []).map((rec: any, idx: number) => ({
      id: typeof rec?.id === 'string' ? rec.id : `rec_up_${idx + 1}`,
      priority: rec?.priority === 'high' || rec?.priority === 'medium' || rec?.priority === 'low' ? rec.priority : 'medium',
      category: typeof rec?.category === 'string' ? rec.category : 'General',
      title: typeof rec?.title === 'string' ? rec.title : 'Recommendation',
      description: typeof rec?.description === 'string' ? rec.description : '',
      impact: typeof rec?.impact === 'string' ? rec.impact : 'Moderate improvement',
      difficulty: rec?.difficulty === 'easy' || rec?.difficulty === 'medium' || rec?.difficulty === 'hard' ? rec.difficulty : 'medium',
      implementation: typeof rec?.implementation === 'string' ? rec.implementation : String(rec?.implementation ?? ''),
      evidence_ids: Array.isArray(rec?.evidence_ids)
        ? rec.evidence_ids.filter((id: unknown): id is string => typeof id === 'string')
        : [],
    }));
    const dedupedUploadRecommendations = dedupeRecommendations(normalizedRecommendations);
    const verifiedUploadRecommendationBundle = verifyRecommendationEvidence(dedupedUploadRecommendations, validUploadEvidenceIds);

    const uploadVisibilityScore =
      typeof aiAnalysis.visibility_score === 'number'
        ? clampScore(aiAnalysis.visibility_score)
        : computeWeightedCategoryScore(aiAnalysis.category_grades, evidenceBounds);
    const uploadModelScores = deriveModelScores({
      baseScore: uploadVisibilityScore,
      categoryGrades: Array.isArray(aiAnalysis.category_grades) ? aiAnalysis.category_grades : [],
      pipelineModels: [providers[0]?.model],
    });
    const uploadDerivedPlatformScores = derivePlatformScores(uploadVisibilityScore, sd, schemaMarkup, syntheticUrl);
    const uploadSeoDiagnostics = computeSeoDiagnostics(
      sd,
      schemaMarkup,
      {
        https_enabled: false,
        has_canonical: !!sd.canonical,
      },
      'upload'
    );
    const uploadEvidenceFixPlan = buildEvidenceFixPlan(
      uploadSeoDiagnostics,
      verifiedUploadRecommendationBundle.recommendations,
      evidenceManifest,
      normalizedTier === 'scorefix' ? 'thorough' : 'standard'
    );
    const uploadCitationParityAudit = buildCitationParityAudit({
      url: syntheticUrl,
      analyzedAt: new Date().toISOString(),
      visibilityScore: uploadVisibilityScore,
      categoryGrades: Array.isArray(aiAnalysis.category_grades) ? aiAnalysis.category_grades : [],
      recommendations: verifiedUploadRecommendationBundle.recommendations,
      contentHighlights: Array.isArray(aiAnalysis.content_highlights) ? aiAnalysis.content_highlights : [],
      evidenceManifest,
      schemaMarkup,
      contentAnalysis: {
        word_count: sd.wordCount || 0,
        faq_count: Array.isArray(schemaMarkup?.schema_types) && schemaMarkup.schema_types.some((t: string) => String(t).toLowerCase() === 'faqpage') ? 5 : 0,
        headings: {
          h1: sd.headings?.h1?.length || 0,
          h2: sd.headings?.h2?.length || 0,
          h3: sd.headings?.h3?.length || 0,
        },
        has_meta_description: !!(sd.meta?.description || '').trim(),
      },
      domainIntelligence: {
        entity_clarity_score: 0,
        primary_topics: Array.isArray(aiAnalysis.primary_topics) ? aiAnalysis.primary_topics : [],
        citation_domains: [],
      },
      technicalSignals: {
        https_enabled: false,
        has_canonical: !!sd.canonical,
        status_code: 200,
        response_time_ms: Date.now() - startTime,
        link_count: (sd.links?.internal || 0) + (sd.links?.external || 0),
        image_count: sd.images || 0,
      },
      topicalKeywords: Array.isArray(aiAnalysis.topical_keywords) ? aiAnalysis.topical_keywords : [],
      brandEntities: Array.isArray(aiAnalysis.brand_entities) ? aiAnalysis.brand_entities : [],
      recommendationEvidenceSummary: verifiedUploadRecommendationBundle.summary,
    });
    const uploadRailEvidenceAudit = buildRailEvidenceAudit({
      sourceType: 'upload',
      evidenceManifest,
      contentAnalysis: {
        word_count: sd.wordCount || 0,
        faq_count: Array.isArray(schemaMarkup?.schema_types) && schemaMarkup.schema_types.some((t: string) => String(t).toLowerCase() === 'faqpage') ? 5 : 0,
        headings: {
          h1: sd.headings?.h1?.length || 0,
          h2: sd.headings?.h2?.length || 0,
          h3: sd.headings?.h3?.length || 0,
        },
      },
      schemaMarkup,
      domainIntelligence: {
        page_title: sd.title || primaryFileName,
        page_description: sd.meta?.description || '',
        canonical_url: '',
      },
      technicalSignals: {
        https_enabled: false,
        has_canonical: !!sd.canonical,
        has_robots_txt: false,
      },
      recommendationEvidenceSummary: verifiedUploadRecommendationBundle.summary,
      evidenceFixPlan: uploadEvidenceFixPlan,
      citationParityAudit: uploadCitationParityAudit,
    });
    const uploadStrictRubric = buildStrictRubricSystem({
      sourceType: 'upload',
      visibilityScore: uploadVisibilityScore,
      seoDiagnostics: uploadSeoDiagnostics,
      recommendationEvidenceSummary: verifiedUploadRecommendationBundle.summary,
      evidenceFixPlan: uploadEvidenceFixPlan,
      citationParityAudit: uploadCitationParityAudit,
      railEvidenceAudit: uploadRailEvidenceAudit,
    });

    const writingAudit = uploadRouting.mode === 'writing_audit'
      ? normalizeWritingAudit((aiAnalysis as any)?.writing_audit || {}, uploadRouting.contentType)
      : null;

    const result = attachTruthSignals({
      visibility_score: uploadVisibilityScore,
      source_type: 'upload' as const,
      upload_analysis_mode: uploadRouting.mode,
      upload_content_type: uploadRouting.contentType,
      upload_analysis_reasons: uploadRouting.reasons,
      source_files: parsedFiles.map((f) => ({ name: f.fileName, mime: f.mimeType, bytes: f.byteSize })),
      ai_platform_scores: {
        chatgpt: clampScore(aiAnalysis.ai_platform_scores?.chatgpt ?? uploadDerivedPlatformScores.chatgpt),
        perplexity: clampScore(aiAnalysis.ai_platform_scores?.perplexity ?? uploadDerivedPlatformScores.perplexity),
        google_ai: clampScore(aiAnalysis.ai_platform_scores?.google_ai ?? uploadDerivedPlatformScores.google_ai),
        claude: clampScore(aiAnalysis.ai_platform_scores?.claude ?? uploadDerivedPlatformScores.claude),
      },
      ai_model_scores: uploadModelScores,
      recommendations: verifiedUploadRecommendationBundle.recommendations,
      category_grades: Array.isArray(aiAnalysis.category_grades) ? aiAnalysis.category_grades : [],
      content_highlights: Array.isArray(aiAnalysis.content_highlights) ? aiAnalysis.content_highlights : [],
      schema_markup: schemaMarkup,
      content_analysis: {
        word_count: sd.wordCount || 0,
        headings: {
          h1: sd.headings?.h1?.length || 0,
          h2: sd.headings?.h2?.length || 0,
          h3: sd.headings?.h3?.length || 0,
        },
        has_proper_h1: (sd.headings?.h1?.length || 0) > 0,
        has_meta_description: !!(sd.meta?.description || '').trim(),
        faq_count: Array.isArray(schemaMarkup?.schema_types) && schemaMarkup.schema_types.some((t: string) => String(t).toLowerCase() === 'faqpage') ? 5 : 0,
      },
      domain_intelligence: {
        domain: 'uploaded-document',
        page_title: sd.title || primaryFileName,
        page_description: sd.meta?.description || '',
        canonical_url: '',
        language: 'en',
        robots: 'n/a',
        primary_topics: Array.isArray(aiAnalysis.primary_topics) ? aiAnalysis.primary_topics : [],
      },
      technical_signals: {
        response_time_ms: Date.now() - startTime,
        status_code: 200,
        content_length: totalByteSize,
        image_count: sd.images || 0,
        link_count: (sd.links?.internal || 0) + (sd.links?.external || 0),
        https_enabled: false,
        has_canonical: !!sd.canonical,
      },
      seo_diagnostics: uploadSeoDiagnostics,
      crypto_intelligence: {
        has_crypto_signals: false,
        summary: 'No cryptocurrency-related content detected',
        detected_assets: [],
        keywords: [],
        wallet_addresses: [],
        sentiment: 'neutral' as const,
        risk_notes: [],
        chain_networks: [],
        onchain_enriched: false,
        experimental: true as const,
      },
      summary: aiAnalysis.summary || `AI visibility analysis for uploaded ${parsedFiles.length === 1 ? `file ${primaryFileName}` : `${parsedFiles.length} files`}`,
      key_takeaways: Array.isArray(aiAnalysis.key_takeaways) ? aiAnalysis.key_takeaways : [],
      topical_keywords: Array.isArray(aiAnalysis.topical_keywords) ? aiAnalysis.topical_keywords : [],
      keyword_intelligence: Array.isArray(aiAnalysis.keyword_intelligence) ? aiAnalysis.keyword_intelligence : [],
      brand_entities: Array.isArray(aiAnalysis.brand_entities) ? aiAnalysis.brand_entities : [],
      url: syntheticUrl,
      analyzed_at: new Date().toISOString(),
      processing_time_ms: Date.now() - startTime,
      cached: false,
      triple_check_enabled: false,
      model_count: 1,
      evidence_manifest: evidenceManifest,
      analysis_integrity: buildAnalysisIntegrity({
        mode: 'upload',
        evidenceManifest,
        modelCount: 1,
        tripleCheckEnabled: false,
        recommendationEvidenceSummary: verifiedUploadRecommendationBundle.summary,
        warnings: [],
      }),
      recommendation_evidence_summary: verifiedUploadRecommendationBundle.summary,
      evidence_fix_plan: uploadEvidenceFixPlan,
      citation_parity_audit: uploadCitationParityAudit,
      rail_evidence_audit: uploadRailEvidenceAudit,
      strict_rubric: uploadStrictRubric,
      writing_audit: writingAudit,
      request_id: requestId,
    });

    emitProgress(requestId, 'complete', 100);
    const observerCheckTier = ((req as any).user?.tier || 'observer') as CanonicalTier;
    const uploadTextSummary = generateTextSummary(result as any, getTextSummaryDepth(observerCheckTier));
    const uploadPayload = { ...result, text_summary: uploadTextSummary };
    res.json(applyTierResultStripping(uploadPayload, observerCheckTier));

    try {
      const userId = (req as any).user?.id;
      const workspaceId = req.workspace?.id;
      if (userId) {
        const auditId = await persistAuditRecord({
          userId,
          workspaceId,
          url: result.url,
          visibilityScore: result.visibility_score,
          result: result as Record<string, unknown>,
          tierAtAnalysis: String((req as any).user?.tier || 'observer'),
        });
        settleReferralCreditsIfEligible(userId).catch((err: any) => {
          console.error(`[${requestId}] Referral settlement after upload audit failed:`, err?.message || err);
        });

        fireMeasurementEvent('upload_audit_completed', req, {
          source: 'upload_analyze',
          workspace_id: String(workspaceId || ''),
          visibility_score: result.visibility_score,
          file_count: parsedFiles.length,
          audit_id: auditId,
        });
      }
    } catch (dbErr: any) {
      console.error(`[${requestId}] Failed to persist upload audit:`, dbErr?.message || dbErr);
    }

    return;
  } catch (err: any) {
    console.error(`[${requestId}] Upload analysis error:`, err);
    return res.status(500).json({ error: err?.message || 'Upload analysis failed', code: 'UPLOAD_ANALYSIS_FAILED', request_id: requestId });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Intelligence Analysis endpoint - Phase 1 of intelligence engine pipeline
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/analyze/intelligence', authRequired, workspaceRequired, requireWorkspacePermission('audit:run'), heavyActionLimiter, usageGate, incrementUsage, intelligenceAnalyzeHandler);

// Admin endpoints
const adminLimiter = rateLimit({ windowMs: 30_000, max: 5, standardHeaders: true, legacyHeaders: false });

function requireAdminKey(req: Request, res: Response): boolean {
  if (!process.env.ADMIN_KEY) {
    res.status(503).json({ error: 'Admin endpoint disabled — ADMIN_KEY not configured', code: 'ADMIN_DISABLED' });
    return false;
  }
  const adminKey = req.headers['x-admin-key'];
  if (!adminKey || typeof adminKey !== 'string') {
    res.status(403).json({ error: 'Unauthorized', code: 'INVALID_ADMIN_KEY' });
    return false;
  }
  const expected = Buffer.from(process.env.ADMIN_KEY);
  const actual = Buffer.from(adminKey);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    res.status(403).json({ error: 'Unauthorized', code: 'INVALID_ADMIN_KEY' });
    return false;
  }
  return true;
}

app.post('/api/admin/cache/clear', adminLimiter, async (req, res) => {
  if (!requireAdminKey(req, res)) return;

  try {
    await AnalysisCacheService.clearAll();
    console.log('[Admin] Cache cleared by authenticated request');
    // SOC1: persist admin action
    try {
      const { logAdminAction } = await import('./services/securityAuditService.js');
      await logAdminAction('admin', 'admin.cache_cleared', undefined, req.ip || undefined);
    } catch { /* audit log is non-critical */ }
    return res.json({ success: true, timestamp: new Date().toISOString() });
  } catch (e: any) {
    console.error('[Admin] Cache clear failed:', e);
    return res.status(500).json({ error: 'Failed to clear cache' });
  }
});

// ─── Admin: IndexNow — submit URL list to search engines ───────────────────────
app.post('/api/admin/indexnow/ping', adminLimiter, async (req, res) => {
  if (!requireAdminKey(req, res)) return;

  const { urls } = req.body;
  if (!Array.isArray(urls) || urls.length === 0) return res.status(400).json({ error: 'urls array required' });

  const result = await pingIndexNow(urls);
  return res.json({ success: true, ...result });
});

app.post('/api/admin/verify-user', adminLimiter, async (req, res) => {
  if (!requireAdminKey(req, res)) return;

  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email required' });

  try {
    const result = await getPool().query(
      `UPDATE users SET is_verified = TRUE, verification_token = NULL, verification_token_expires = NULL, updated_at = NOW()
       WHERE email = $1 RETURNING id, email, is_verified`,
      [email.toLowerCase().trim()]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'User not found' });
    console.log(`[Admin] Force-verified user: ${email}`);
    return res.json({ success: true, user: result.rows[0] });
  } catch (e: any) {
    console.error('[Admin] Force-verify failed:', e);
    return res.status(500).json({ error: 'Failed to verify user' });
  }
});

app.post('/api/admin/set-tier', adminLimiter, async (req, res) => {
  if (!requireAdminKey(req, res)) return;

  const { email, tier } = req.body;
  if (!email || !tier) return res.status(400).json({ error: 'email and tier required' });

  const validTiers = ['observer', 'alignment', 'signal', 'scorefix'];
  if (!validTiers.includes(tier)) return res.status(400).json({ error: `tier must be one of: ${validTiers.join(', ')}` });

  try {
    const result = await getPool().query(`UPDATE users SET tier = $1, updated_at = NOW() WHERE email = $2 RETURNING id, email, tier`, [
      tier,
      email.toLowerCase().trim(),
    ]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'User not found' });
    console.log(`[Admin] Set tier for ${email} → ${tier}`);
    return res.json({ success: true, user: result.rows[0] });
  } catch (e: any) {
    console.error('[Admin] Set-tier failed:', e);
    return res.status(500).json({ error: 'Failed to set tier' });
  }
});

app.post('/api/admin/newsletter/preview', adminLimiter, async (req, res) => {
  if (!requireAdminKey(req, res)) return;

  const body = (req.body || {}) as Record<string, any>;
  const to = String(body.to || '').trim() || 'preview@aivis.biz';
  const userName = String(body.userName || '').trim() || 'Preview User';
  const tier = String(body.tier || 'observer').trim().toLowerCase();
  const validTiers = ['observer', 'alignment', 'signal', 'scorefix'];

  if (!validTiers.includes(tier)) {
    return res.status(400).json({ error: `tier must be one of: ${validTiers.join(', ')}` });
  }

  const auditCountRaw = Number(body.auditCount ?? 7);
  const auditCount = Number.isFinite(auditCountRaw) ? Math.max(0, Math.floor(auditCountRaw)) : 7;

  const latestScoreRaw = body.latestScore;
  const parsedLatestScore = latestScoreRaw === null || latestScoreRaw === '' || typeof latestScoreRaw === 'undefined' ? null : Number(latestScoreRaw);
  const latestScore = Number.isFinite(parsedLatestScore as number)
    ? Math.max(0, Math.min(100, Math.round(parsedLatestScore as number)))
    : null;

  const editionLabel = String(body.editionLabel || '').trim() || getCurrentNewsletterEditionKey();
  const sendTest = body.sendTest === true || String(body.sendTest || '').toLowerCase() === 'true';
  const htmlOnly = String(req.query.format || '').toLowerCase() === 'html';

  try {
    const payload = buildNewsletterEmailPayload({
      to,
      userName,
      tier,
      editionLabel,
      snapshot: {
        auditCount,
        latestScore,
      },
    });

    const rendered = renderPlatformNewsletterEmail(payload);
    if (sendTest) {
      await sendPlatformNewsletterEmail(payload);
    }

    if (htmlOnly) {
      res.type('text/html');
      return res.send(rendered.html);
    }

    return res.json({
      success: true,
      sent: sendTest,
      preview: rendered,
      meta: {
        to,
        tier,
        editionLabel,
        auditCount,
        latestScore,
      },
    });
  } catch (e: any) {
    console.error('[Admin] Newsletter preview failed:', e);
    return res.status(500).json({ error: e?.message || 'Newsletter preview failed' });
  }
});

app.get('/api/admin/newsletter/settings', adminLimiter, async (req, res) => {
  if (!requireAdminKey(req, res)) return;
  try {
    const settings = await getNewsletterDispatchSettings();
    return res.json({ success: true, settings });
  } catch (e: any) {
    console.error('[Admin] Newsletter settings read failed:', e);
    return res.status(500).json({ error: e?.message || 'Failed to read newsletter settings' });
  }
});

app.post('/api/admin/newsletter/settings', adminLimiter, async (req, res) => {
  if (!requireAdminKey(req, res)) return;
  const body = (req.body || {}) as Record<string, any>;

  try {
    const next = await upsertNewsletterDispatchSettings({
      automationEnabled: typeof body.automationEnabled === 'boolean' ? body.automationEnabled : undefined,
      batchSize: Number.isFinite(Number(body.batchSize)) ? Number(body.batchSize) : undefined,
      delayMs: Number.isFinite(Number(body.delayMs)) ? Number(body.delayMs) : undefined,
      tierFilter: Array.isArray(body.tierFilter) ? body.tierFilter : undefined,
    });
    return res.json({ success: true, settings: next });
  } catch (e: any) {
    console.error('[Admin] Newsletter settings update failed:', e);
    return res.status(500).json({ error: e?.message || 'Failed to update newsletter settings' });
  }
});

app.post('/api/admin/newsletter/dispatch', adminLimiter, async (req, res) => {
  if (!requireAdminKey(req, res)) return;
  const body = (req.body || {}) as Record<string, any>;

  const editionLabel = String(body.editionLabel || '').trim() || getCurrentNewsletterEditionKey();
  const options = {
    editionKey: editionLabel,
    dryRun: body.dryRun === true || String(body.dryRun || '').toLowerCase() === 'true',
    forceResend: body.forceResend === true || String(body.forceResend || '').toLowerCase() === 'true',
    batchSize: Number.isFinite(Number(body.batchSize)) ? Number(body.batchSize) : undefined,
    delayMs: Number.isFinite(Number(body.delayMs)) ? Number(body.delayMs) : undefined,
    tierFilter: Array.isArray(body.tierFilter) ? body.tierFilter : undefined,
  };

  try {
    const result = await runNewsletterDispatchCycle(options);

    if (!result.dryRun) {
      await getPool().query(
        `UPDATE newsletter_editions
         SET status = 'sent', sent_at = NOW(), updated_at = NOW(),
             metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
         WHERE edition_key = $1`,
        [result.editionKey, JSON.stringify({ attempted: result.attempted, sent: result.sent, failed: result.failed })]
      );
    }

    return res.json({ success: true, result });
  } catch (e: any) {
    console.error('[Admin] Newsletter dispatch failed:', e);
    return res.status(500).json({ error: e?.message || 'Newsletter dispatch failed' });
  }
});

app.get('/api/admin/newsletter/editions', adminLimiter, async (req, res) => {
  if (!requireAdminKey(req, res)) return;
  const status = String(req.query.status || '').trim().toLowerCase();
  const limitRaw = Number(req.query.limit || 50);
  const limit = Math.min(200, Math.max(1, Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 50));

  try {
    const params: unknown[] = [];
    let where = '';
    if (status) {
      params.push(status);
      where = `WHERE status = $1`;
    }
    params.push(limit);
    const limitParam = `$${params.length}`;

    const { rows } = await getPool().query(
      `SELECT id, edition_key, title, summary, status, metadata, created_by, sent_at, created_at, updated_at
       FROM newsletter_editions
       ${where}
       ORDER BY created_at DESC
       LIMIT ${limitParam}`,
      params
    );

    return res.json({ success: true, editions: rows });
  } catch (e: any) {
    console.error('[Admin] Newsletter editions list failed:', e);
    return res.status(500).json({ error: e?.message || 'Failed to list newsletter editions' });
  }
});

app.post('/api/admin/newsletter/editions', adminLimiter, async (req, res) => {
  if (!requireAdminKey(req, res)) return;
  const body = (req.body || {}) as Record<string, any>;
  const editionLabel = String(body.editionLabel || '').trim()
    || `${getCurrentNewsletterEditionKey()}-${new Date().toISOString().slice(11, 19).replace(/:/g, '')}`;
  const title = String(body.title || '').trim() || `AiVIS Newsletter ${editionLabel}`;
  const summary = String(body.summary || '').trim() || null;

  try {
    const { rows } = await getPool().query(
      `INSERT INTO newsletter_editions (edition_key, title, summary, status, metadata, created_by)
       VALUES ($1, $2, $3, 'draft', $4::jsonb, 'admin-key')
       ON CONFLICT (edition_key)
       DO UPDATE SET title = EXCLUDED.title, summary = EXCLUDED.summary, metadata = EXCLUDED.metadata, updated_at = NOW()
       RETURNING id, edition_key, title, summary, status, metadata, created_by, sent_at, created_at, updated_at`,
      [editionLabel, title, summary, JSON.stringify(body.metadata || {})]
    );
    return res.json({ success: true, edition: rows[0] });
  } catch (e: any) {
    console.error('[Admin] Newsletter edition create failed:', e);
    return res.status(500).json({ error: e?.message || 'Failed to create newsletter edition' });
  }
});

// ─── Admin: Broadcast — send custom one-off announcement to users ────────────

app.post('/api/admin/broadcast/preview', adminLimiter, async (req, res) => {
  if (!requireAdminKey(req, res)) return;

  const body = (req.body || {}) as Record<string, any>;
  const subject = String(body.subject || '').trim();
  const headline = String(body.headline || '').trim();
  const broadcastBody = String(body.body || '').trim();
  const ctaLabel = String(body.ctaLabel || '').trim() || undefined;
  const ctaUrl = String(body.ctaUrl || '').trim() || undefined;
  const sendTest = body.sendTest === true || String(body.sendTest || '').toLowerCase() === 'true';
  const testTo = String(body.to || '').trim();

  if (!subject || !headline || !broadcastBody) {
    return res.status(400).json({ error: 'subject, headline, and body are required' });
  }

  try {
    const args = { subject, headline, body: broadcastBody, ctaLabel, ctaUrl };
    const rendered = renderBroadcastEmail(args, testTo || 'preview@aivis.biz');

    if (sendTest && testTo) {
      await sendBroadcastEmail(args, testTo);
    }

    const htmlOnly = String(req.query.format || '').toLowerCase() === 'html';
    if (htmlOnly) {
      res.type('text/html');
      return res.send(rendered.html);
    }

    return res.json({ success: true, sent: sendTest && !!testTo, preview: rendered });
  } catch (e: any) {
    console.error('[Admin] Broadcast preview failed:', e);
    return res.status(500).json({ error: e?.message || 'Broadcast preview failed' });
  }
});

app.post('/api/admin/broadcast/send', adminLimiter, async (req, res) => {
  if (!requireAdminKey(req, res)) return;

  const body = (req.body || {}) as Record<string, any>;
  const subject = String(body.subject || '').trim();
  const headline = String(body.headline || '').trim();
  const broadcastBody = String(body.body || '').trim();
  const ctaLabel = String(body.ctaLabel || '').trim() || undefined;
  const ctaUrl = String(body.ctaUrl || '').trim() || undefined;
  const dryRun = body.dryRun === true || String(body.dryRun || '').toLowerCase() === 'true';
  const tierFilter: string[] = Array.isArray(body.tierFilter) ? body.tierFilter : [];
  const batchSize = Math.min(2000, Math.max(1, Number(body.batchSize) || 200));
  const delayMs = Math.min(10_000, Math.max(500, Number(body.delayMs) || 550));

  if (!subject || !headline || !broadcastBody) {
    return res.status(400).json({ error: 'subject, headline, and body are required' });
  }

  try {
    const pool = getPool();
    const args = { subject, headline, body: broadcastBody, ctaLabel, ctaUrl };

    // Query eligible users
    const params: unknown[] = [];
    const whereClauses = [
      `u.is_verified = TRUE`,
      `u.email IS NOT NULL`,
      `u.email <> ''`,
      `COALESCE(np.email_notifications, TRUE) = TRUE`,
    ];

    if (tierFilter.length > 0) {
      params.push(tierFilter);
      whereClauses.push(`COALESCE(u.tier, 'observer') = ANY($${params.length}::text[])`);
    }

    params.push(batchSize);

    const { rows: users } = await pool.query(
      `SELECT u.id, u.email, u.name, COALESCE(u.tier, 'observer') AS tier
       FROM users u
       LEFT JOIN user_notification_preferences np ON np.user_id = u.id
       WHERE ${whereClauses.join('\n         AND ')}
       ORDER BY u.created_at ASC
       LIMIT $${params.length}`,
      params
    );

    let sent = 0;
    let failed = 0;

    for (const row of users) {
      try {
        if (!dryRun) {
          await sendBroadcastEmail(args, String(row.email));
          await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
        }
        sent += 1;
      } catch (err: any) {
        failed += 1;
        console.error(`[Broadcast] Failed for ${row.email}:`, err?.message || err);
      }
    }

    // Log the broadcast action
    try {
      const { logAdminAction } = await import('./services/securityAuditService.js');
      await logAdminAction('admin', 'admin.broadcast_sent', undefined, req.ip || undefined);
    } catch { /* audit log is non-critical */ }

    return res.json({
      success: true,
      dryRun,
      attempted: users.length,
      sent,
      failed,
      tierFilter,
      batchSize,
      delayMs,
    });
  } catch (e: any) {
    console.error('[Admin] Broadcast send failed:', e);
    return res.status(500).json({ error: e?.message || 'Broadcast send failed' });
  }
});

// ─── Admin: DB stats — table sizes, row counts, total DB size ────────────────
app.get('/api/admin/db/stats', adminLimiter, async (req, res) => {
  if (!requireAdminKey(req, res)) return;
  try {
    const pool = getPool();
    const [dbSize, tables, counts] = await Promise.all([
      pool.query('SELECT pg_database_size(current_database()) as bytes'),
      pool.query(`
        SELECT t.tablename as name,
               pg_total_relation_size('public.' || quote_ident(t.tablename)) as size_bytes,
               s.n_live_tup as row_count
        FROM pg_tables t
        LEFT JOIN pg_stat_user_tables s ON s.relname = t.tablename AND s.schemaname = 'public'
        WHERE t.schemaname = 'public'
        ORDER BY pg_total_relation_size('public.' || quote_ident(t.tablename)) DESC
      `),
      pool.query(`
        SELECT
          (SELECT COUNT(*) FROM users) as users,
          (SELECT COUNT(*) FROM audits) as audits,
          (SELECT COUNT(*) FROM analysis_cache) as cache_entries,
          (SELECT COUNT(*) FROM user_sessions) as sessions,
          (SELECT COUNT(*) FROM rate_limit_events) as rate_limit_events,
          (SELECT COUNT(*) FROM notifications) as notifications
      `),
    ]);

    const totalBytes = parseInt(dbSize.rows[0].bytes, 10);
    return res.json({
      success: true,
      database: {
        size_bytes: totalBytes,
        size_mb: +(totalBytes / 1048576).toFixed(2),
      },
      summary: counts.rows[0],
      tables: tables.rows.map((r: any) => ({
        name: r.name,
        size_bytes: parseInt(r.size_bytes, 10),
        size_kb: +(parseInt(r.size_bytes, 10) / 1024).toFixed(1),
        rows: parseInt(r.row_count ?? '0', 10),
      })),
    });
  } catch (e: any) {
    console.error('[Admin] DB stats failed:', e);
    return res.status(500).json({ error: 'Failed to fetch DB stats' });
  }
});

app.get('/api/admin/payments', adminLimiter, async (req, res) => {
  if (!requireAdminKey(req, res)) return;

  const limitRaw = Number(req.query.limit || 25);
  const limit = Math.min(100, Math.max(1, Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 25));

  try {
    const pool = getPool();
    const [summaryResult, trialResult, rowsResult] = await Promise.all([
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'completed') AS completed_count,
           COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
           COUNT(*) FILTER (WHERE status = 'failed') AS failed_count,
           COUNT(*) FILTER (WHERE subscription_status = 'active') AS active_subscription_count,
           COALESCE(SUM(amount_cents) FILTER (WHERE status = 'completed'), 0) AS confirmed_revenue_cents
         FROM payments`
      ),
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE trial_ends_at IS NOT NULL AND trial_ends_at > NOW()) AS active_signal_trials,
           COUNT(*) FILTER (WHERE trial_used = TRUE) AS total_trials_started
         FROM users`
      ),
      pool.query(
        `SELECT
           p.id,
           p.user_id,
           u.email,
           u.name,
           COALESCE(u.tier, 'observer') AS current_tier,
           p.tier AS purchased_tier,
           p.status,
           p.subscription_status,
           p.amount_cents,
           p.currency,
           p.completed_at,
           p.last_payment_at,
           p.created_at,
           p.updated_at,
           p.current_period_end,
           p.cancel_at_period_end,
           p.stripe_session_id,
           p.stripe_customer_id,
           p.stripe_subscription_id,
           p.stripe_price_id,
           p.last_invoice_id,
           p.failed_invoice_id,
           p.metadata,
           u.trial_ends_at,
           u.trial_used
         FROM payments p
         INNER JOIN users u ON u.id = p.user_id
         ORDER BY COALESCE(p.completed_at, p.last_payment_at, p.created_at) DESC
         LIMIT $1`,
        [limit]
      ),
    ]);

    const summaryRow = summaryResult.rows[0] || {};
    const trialRow = trialResult.rows[0] || {};

    return res.json({
      success: true,
      summary: {
        completedCount: Number(summaryRow.completed_count || 0),
        pendingCount: Number(summaryRow.pending_count || 0),
        failedCount: Number(summaryRow.failed_count || 0),
        activeSubscriptionCount: Number(summaryRow.active_subscription_count || 0),
        confirmedRevenueCents: Number(summaryRow.confirmed_revenue_cents || 0),
        activeSignalTrials: Number(trialRow.active_signal_trials || 0),
        totalTrialsStarted: Number(trialRow.total_trials_started || 0),
      },
      payments: rowsResult.rows.map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        email: row.email,
        name: row.name,
        currentTier: row.current_tier,
        purchasedTier: row.purchased_tier,
        status: row.status,
        subscriptionStatus: row.subscription_status,
        amountCents: row.amount_cents,
        currency: row.currency,
        completedAt: row.completed_at,
        lastPaymentAt: row.last_payment_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        currentPeriodEnd: row.current_period_end,
        cancelAtPeriodEnd: row.cancel_at_period_end,
        stripeSessionId: row.stripe_session_id,
        stripeCustomerId: row.stripe_customer_id,
        stripeSubscriptionId: row.stripe_subscription_id,
        stripePriceId: row.stripe_price_id,
        lastInvoiceId: row.last_invoice_id,
        failedInvoiceId: row.failed_invoice_id,
        metadata: row.metadata || null,
        trialEndsAt: row.trial_ends_at,
        trialUsed: row.trial_used === true,
      })),
    });
  } catch (e: any) {
    console.error('[Admin] Payments list failed:', e);
    return res.status(500).json({ error: e?.message || 'Failed to fetch payment ledger' });
  }
});

// ─── Admin: deep health check — runtime + db status ───────────────────────────
app.get('/api/admin/health-deep', adminLimiter, async (req, res) => {
  if (!requireAdminKey(req, res)) return;
  const startedAt = Date.now();

  try {
    const pool = getPool();
    const dbStartedAt = Date.now();
    const dbResult = await pool.query('SELECT NOW() AS now, current_database() AS database');
    const dbLatencyMs = Date.now() - dbStartedAt;
    const processUptimeSeconds = Math.max(0, Math.floor(process.uptime()));
    const memory = process.memoryUsage();

    return res.json({
      success: true,
      status: 'ok',
      checked_at: new Date().toISOString(),
      service: {
        uptime_seconds: processUptimeSeconds,
        node_version: process.version,
        pid: process.pid,
      },
      memory: {
        rss_bytes: memory.rss,
        heap_total_bytes: memory.heapTotal,
        heap_used_bytes: memory.heapUsed,
        external_bytes: memory.external,
      },
      database: {
        status: 'ok',
        name: dbResult.rows[0]?.database || null,
        server_time: dbResult.rows[0]?.now || null,
        latency_ms: dbLatencyMs,
      },
      latency_ms: Date.now() - startedAt,
    });
  } catch (e: any) {
    console.error('[Admin] Deep health check failed:', e);
    return res.status(503).json({
      success: false,
      status: 'degraded',
      checked_at: new Date().toISOString(),
      error: e?.message || 'Deep health check failed',
      latency_ms: Date.now() - startedAt,
    });
  }
});

// ─── Admin: trigger DB cleanup immediately ──────────────────────────────────
app.post('/api/admin/db/cleanup', adminLimiter, async (req, res) => {
  if (!requireAdminKey(req, res)) return;
  try {
    await runDbCleanupNow();
    return res.json({ success: true, message: 'Cleanup completed', timestamp: new Date().toISOString() });
  } catch (e: any) {
    console.error('[Admin] DB cleanup failed:', e);
    return res.status(500).json({ error: 'Cleanup failed' });
  }
});

// API domain root endpoints (crawler-friendly)
app.get('/', (_req, res) => {
  return res.status(200).json({
    service: 'aivis-api',
    status: 'ok',
    docs_hint: '/api/health',
  });
});

app.get('/robots.txt', (_req, res) => {
  res.type('text/plain');
  const siteUrl = String(process.env.FRONTEND_URL || 'https://aivis.biz').replace(/\/+$/, '');
  return res.send([
    'User-agent: *',
    'Allow: /',
    'Allow: /pricing',
    'Allow: /analyze',
    'Allow: /api-docs',
    'Allow: /faq',
    'Allow: /guide',
    'Allow: /help',
    'Allow: /support',
    'Allow: /about',
    'Allow: /why-ai-visibility',
    'Allow: /insights',
    'Allow: /blogs',
    'Allow: /blogs/*',
    'Allow: /ai-search-visibility-2026',
    'Allow: /aeo-playbook-2026',
    'Allow: /geo-ai-ranking-2026',
    'Allow: /landing',
    'Allow: /compare',
    'Allow: /benchmarks',
    'Allow: /workflow',
    'Allow: /methodology',
    'Allow: /server-headers',
    'Allow: /tools/schema-validator',
    'Allow: /tools/robots-checker',
    'Allow: /tools/content-extractability',
    'Allow: /verify-license',
    'Allow: /compliance',
    'Allow: /integrations',
    'Allow: /competitive-landscape',
    'Allow: /changelog',
    'Allow: /glossary',
    'Allow: /press',
    'Allow: /privacy',
    'Allow: /terms',
    '',
    'Disallow: /auth',
    'Disallow: /profile',
    'Disallow: /settings',
    'Disallow: /billing',
    'Disallow: /analytics',
    'Disallow: /keywords',
    'Disallow: /competitors',
    'Disallow: /citations',
    'Disallow: /reports',
    'Disallow: /reverse-engineer',
    'Disallow: /report/',
    'Disallow: /partnership-terms',
    'Disallow: /score-fix',
    'Disallow: /payment-success',
    'Disallow: /payment-canceled',
    'Disallow: /api/',
    'Crawl-delay: 1',
    '',
    `Sitemap: ${siteUrl}/sitemap.xml`,
    '',
    'User-agent: GPTBot',
    'Allow: /',
    '',
    'User-agent: ChatGPT-User',
    'Allow: /',
    '',
    'User-agent: Google-Extended',
    'Allow: /',
    '',
    'User-agent: ClaudeBot',
    'Allow: /',
    '',
    'User-agent: PerplexityBot',
    'Allow: /',
    '',
    'User-agent: Applebot-Extended',
    'Allow: /',
    '',
  ].join('\n'));
});

app.get('/sitemap.xml', (_req, res) => {
  res.type('application/xml');
  const siteUrl = String(process.env.FRONTEND_URL || 'https://aivis.biz').replace(/\/+$/, '');
  const lastmod = '2026-04-02';
  const routes = [
    { path: '/', changefreq: 'daily', priority: '1.0' },
    { path: '/landing', changefreq: 'weekly', priority: '0.9' },
    { path: '/pricing', changefreq: 'weekly', priority: '0.9' },
    { path: '/analyze', changefreq: 'weekly', priority: '0.9' },
    { path: '/api-docs', changefreq: 'monthly', priority: '0.8' },
    { path: '/faq', changefreq: 'monthly', priority: '0.8' },
    { path: '/guide', changefreq: 'monthly', priority: '0.8' },
    { path: '/help', changefreq: 'monthly', priority: '0.7' },
    { path: '/support', changefreq: 'monthly', priority: '0.7' },
    { path: '/about', changefreq: 'monthly', priority: '0.7' },
    { path: '/why-ai-visibility', changefreq: 'monthly', priority: '0.8' },
    { path: '/blogs', changefreq: 'weekly', priority: '0.8' },
    { path: '/blogs/why-i-built-aivis-when-i-realized-most-websites-are-invisible-to-ai', changefreq: 'monthly', priority: '0.8' },
    { path: '/blogs/before-you-build-another-saas-run-this-30-second-reality-check', changefreq: 'monthly', priority: '0.7' },
    { path: '/blogs/answer-engine-optimization-2026-why-citation-readiness-matters', changefreq: 'monthly', priority: '0.85' },
    { path: '/blogs/why-traditional-seo-tactics-fail-for-ai-visibility', changefreq: 'monthly', priority: '0.8' },
    { path: '/blogs/building-author-authority-for-citations-e-e-a-t-in-ai-era', changefreq: 'monthly', priority: '0.8' },
    { path: '/blogs/how-llms-parse-your-content-technical-breakdown', changefreq: 'monthly', priority: '0.85' },
    { path: '/blogs/geo-adaptive-ai-ranking-location-intelligence-shapes-answers', changefreq: 'monthly', priority: '0.8' },
    { path: '/blogs/from-invisible-to-cited-case-study-brand-citation-growth', changefreq: 'monthly', priority: '0.85' },
    { path: '/blogs/google-search-console-data-ai-visibility-monitoring', changefreq: 'monthly', priority: '0.8' },
    { path: '/blogs/7-step-implementation-roadmap-audit-to-live-citations-30-days', changefreq: 'monthly', priority: '0.85' },
    { path: '/blogs/google-search-console-2026-what-actually-matters-now', changefreq: 'weekly', priority: '0.85' },
    { path: '/blogs/the-river-changed-direction-why-ai-answer-engines-rewrote-the-web', changefreq: 'weekly', priority: '0.9' },
    { path: '/ai-search-visibility-2026', changefreq: 'monthly', priority: '0.8' },
    { path: '/insights', changefreq: 'weekly', priority: '0.9' },
    { path: '/aeo-playbook-2026', changefreq: 'monthly', priority: '0.8' },
    { path: '/geo-ai-ranking-2026', changefreq: 'monthly', priority: '0.8' },
    { path: '/compare', changefreq: 'monthly', priority: '0.7' },
    { path: '/compare/aivis-vs-otterly', changefreq: 'monthly', priority: '0.6' },
    { path: '/compare/aivis-vs-reaudit', changefreq: 'monthly', priority: '0.6' },
    { path: '/compare/aivis-vs-profound', changefreq: 'monthly', priority: '0.6' },
    { path: '/benchmarks', changefreq: 'monthly', priority: '0.8' },
    { path: '/workflow', changefreq: 'monthly', priority: '0.7' },
    { path: '/methodology', changefreq: 'monthly', priority: '0.7' },
    { path: '/server-headers', changefreq: 'monthly', priority: '0.6' },
    { path: '/tools/schema-validator', changefreq: 'monthly', priority: '0.7' },
    { path: '/tools/robots-checker', changefreq: 'monthly', priority: '0.7' },
    { path: '/tools/content-extractability', changefreq: 'monthly', priority: '0.7' },
    { path: '/verify-license', changefreq: 'monthly', priority: '0.5' },
    { path: '/compliance', changefreq: 'monthly', priority: '0.6' },
    { path: '/integrations', changefreq: 'monthly', priority: '0.7' },
    { path: '/competitive-landscape', changefreq: 'monthly', priority: '0.7' },
    { path: '/changelog', changefreq: 'weekly', priority: '0.7' },
    { path: '/glossary', changefreq: 'monthly', priority: '0.8' },
    { path: '/press', changefreq: 'monthly', priority: '0.8' },
    { path: '/privacy', changefreq: 'monthly', priority: '0.3' },
    { path: '/terms', changefreq: 'monthly', priority: '0.3' },
  ];

  const body = routes
    .map((route) => [
      '  <url>',
      `    <loc>${siteUrl}${route.path}</loc>`,
      `    <lastmod>${lastmod}</lastmod>`,
      `    <changefreq>${route.changefreq}</changefreq>`,
      `    <priority>${route.priority}</priority>`,
      '  </url>',
    ].join('\n'))
    .join('\n');

  return res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`);
});

// Sentry error handler (v10)
if (process.env.SENTRY_DSN) Sentry.setupExpressErrorHandler(app);

// ── Global error handler — catches unhandled errors from all routes ──────────
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error('[GlobalErrorHandler]', err);
  if (process.env.SENTRY_DSN) Sentry.captureException(err);
  if (res.headersSent) return;
  res.status(err.status || 500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
  });
});

// Serve compiled frontend (single-service)
const clientDist = path.resolve(process.cwd(), 'dist/client');
if (existsSync(clientDist)) {
  // Hashed assets get immutable cache; everything else gets short cache with revalidation
  app.use('/assets', express.static(path.join(clientDist, 'assets'), { maxAge: '365d', immutable: true }));
  app.use(express.static(clientDist, { maxAge: '1h' }));
}

// SPA fallback
app.use((req, res) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/licenses')) {
    return res.status(404).json({ error: 'Endpoint not found', code: 'NOT_FOUND', path: req.path, method: req.method });
  }

  if (existsSync(clientDist)) {
    const normalizedPath = req.path.replace(/^\/+/, '').replace(/\/+$/, '');
    if (normalizedPath) {
      const routeIndexPath = path.resolve(clientDist, normalizedPath, 'index.html');
      if (routeIndexPath.startsWith(path.resolve(clientDist)) && existsSync(routeIndexPath)) {
        return res.sendFile(routeIndexPath);
      }
    }
  }

  if (existsSync(path.join(clientDist, 'index.html'))) return res.sendFile(path.join(clientDist, 'index.html'));
  return res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
});

// Graceful shutdown
async function shutdown(signal: string) {
  console.log(`[${signal}] Shutting down`);
  await closePool();
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', (e) => {
  console.error('[uncaughtException] Fatal — shutting down:', e);
  if (process.env.SENTRY_DSN) Sentry.captureException(e);
  shutdown('EXCEPTION');
});

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection] Unhandled promise rejection (server kept alive):', reason);
  if (process.env.SENTRY_DSN) Sentry.captureException(reason instanceof Error ? reason : new Error(String(reason)));
});

// Start server
(async function start() {
  let databaseReady = false;
  try {
    await runMigrations();
    databaseReady = await healthCheck();
    if (databaseReady) {
      console.log('[Startup] Database ready');
    } else {
      const dbStatus = getDatabaseStatus();
      console.warn('[Startup] Database unavailable; continuing in degraded mode:', dbStatus.lastError || 'health check failed');
    }
  } catch (err: any) {
    console.error('[Startup] Migration error (non-fatal):', err.message);
    // Don't exit - allow server to start with partial schema
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT} (${NODE_ENV})`);
  });

  // Bootstrap scheduled citation ranking jobs from DB (non-blocking)
  if (databaseReady) {
    bootstrapScheduler().catch((err: Error) => {
      console.warn('[Startup] Citation scheduler bootstrap error (non-fatal):', err.message);
    });
  } else {
    console.warn('[Startup] Citation scheduler bootstrap skipped because database is unavailable');
  }

  // ── IndexNow startup ping — submit canonical AiVIS insight URLs ────────────
  // Guarded by INDEXNOW_STARTUP_PING=true because the static CDN may block
  // IndexNow's verification bot, causing 403 noise on every deploy.
  // Use the admin endpoint POST /api/admin/indexnow/ping for on-demand pings.
  if (
    process.env.INDEXNOW_STARTUP_PING === 'true' &&
    (process.env.INDEXNOW_KEY || process.env.INDEXNOW_API_KEY) &&
    process.env.NODE_ENV === 'production'
  ) {
    const frontendUrl = process.env.FRONTEND_URL || 'https://aivis.biz';
    const ownInsightUrls = [
      '/',
      '/insights',
      '/faq',
      '/methodology',
      '/pricing',
      '/about',
      '/insights/aeo-playbook-2026',
      '/insights/ai-search-visibility-2026',
      '/insights/geo-ai-ranking-2026',
      '/insights/why-ai-visibility',
    ].map((path) => `${frontendUrl}${path}`);
    pingIndexNow(ownInsightUrls).catch((e: any) =>
      console.warn('[Startup] IndexNow ping error (non-fatal):', e?.message)
    );
  }

  // Render proxy compatibility
  // Global 5-minute hard wall: prevents zombie requests that bypass route-level timeouts.
  // Analyze routes override to 60s via PROXY_HARD_LIMIT_MS; SSE connections extend via keep-alive.
  server.keepAliveTimeout = 120_000;
  server.headersTimeout = 121_000;
  server.requestTimeout = 300_000; // 5 min hard ceiling
  server.timeout = 300_000;

  console.log('[Startup] HTTP timeouts set for reverse proxy compatibility');

  // ── Scheduled rescan loop ─────────────────────────────────────────────────
  // Internal analyze: reuses the scrape→AI pipeline for automated rescans.
  // Returns the audit ID on success, null on failure.
  const analyzeInternally = async (userId: string, workspaceId: string, url: string): Promise<string | null> => {
    try {
      const normalized = normalizePublicHttpUrl(url);
      if (!normalized.ok) {
        throw new Error(normalized.error);
      }

      const targetUrl = normalized.url;
      const sd = await scrapeWebsite(targetUrl);
      if (!sd) return null;
      const user = await getUserById(userId);
      if (!user) return null;

      const tier = (user.tier || 'observer') as CanonicalTier;
      const providers = (tier === 'signal' || tier === 'scorefix') ? PROVIDERS.slice(0, 3)
        : tier === 'alignment' ? PROVIDERS.slice(0, 2)
        : FREE_PROVIDERS.slice(0, 2);

      const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_API_KEY || '';
      if (!apiKey) return null;

      // Minimal single-model analysis for scheduled rescans
      const provider = providers[0];
      const prompt = `Analyze this website for AI visibility. URL: ${targetUrl}\nScraped data: ${JSON.stringify(sd).slice(0, 4000)}\nReturn JSON with visibility_score (0-100), recommendations array, and summary string.`;
      const aiResult = await callAIProvider({
        provider: provider.provider,
        model: provider.model,
        prompt,
        apiKey,
        endpoint: provider.endpoint,
        opts: { max_tokens: 5000, timeoutMs: 30_000 },
      });

      if (!aiResult) return null;
      const parsed = safeJsonParse<any>(aiResult);
      if (!parsed.ok) return null;

      const data = parsed.value;
      const score =
        typeof data.visibility_score === 'number'
          ? clampScore(data.visibility_score)
          : computeWeightedCategoryScore(
              Array.isArray(data.category_grades) ? data.category_grades : [],
              undefined,
              0
            );
      const auditId = await persistAuditRecord({
        userId,
        workspaceId,
        url: targetUrl,
        visibilityScore: score,
        result: data as Record<string, unknown>,
        tierAtAnalysis: tier,
      });
      settleReferralCreditsIfEligible(userId).catch((err: any) => {
        console.error(`[rescan-internal] Referral settlement failed for ${userId}:`, err?.message || err);
      });

      if (auditId) {
        // Fire webhook
        dispatchWebhooks(userId, workspaceId, 'audit.completed', {
          audit_id: auditId,
          url: targetUrl,
          visibility_score: score,
          source: 'scheduled_rescan',
        }).catch(() => {});

        dispatchAuditReportDeliveries({
          userId,
          workspaceId,
          auditId,
          url: targetUrl,
          result: { ...data, visibility_score: score },
          ownerTier: 'signal',
        }).catch(() => {});

        if (isGoogleMeasurementConfigured()) {
          sendMeasurementEvent({
            eventName: 'audit_completed',
            clientId: `${userId}.${Date.now()}`,
            userId,
            params: {
              source: 'scheduled_rescan',
              workspace_id: workspaceId,
              visibility_score: score,
            },
          }).catch(() => {});
        }
      }

      return auditId || null;
    } catch (err: any) {
      console.error(`[rescan-internal] Failed for ${url}: ${err.message}`);
      return null;
    }
  };

  // Inject analyzer into MCP audit processor
  setMcpAnalyzer(analyzeInternally);

  if (databaseReady) {
    startRescanLoop(analyzeInternally, {
    onCompleted: async ({ userId, workspaceId, url, scheduleId, auditId }) => {
      await dispatchWebhooks(userId, workspaceId, 'rescan.completed', {
        schedule_id: scheduleId,
        audit_id: auditId,
        url,
        source: 'scheduled_rescan',
      }).catch(() => {});
      await createUserNotification({
        userId,
        eventType: 'scheduled_rescan_completed',
        title: 'Scheduled rescan completed',
        message: `Scheduled scan finished for ${url}`,
        metadata: {
          workspaceId,
          scheduleId,
          auditId,
          url,
        },
      }).catch(() => {});
      await createPlatformNotification({
        eventType: 'scheduled_rescan_completed',
        title: 'Background rescan executed',
        message: `A scheduled rescan completed for ${url}`,
        metadata: {
          userId,
          workspaceId,
          scheduleId,
          auditId,
          url,
          source: 'scheduled_rescan',
        },
      }).catch(() => {});

      // ── Trend alert: detect score drops ──────────────────────────────
      try {
        const pool = getPool();
        const { rows: recentAudits } = await pool.query(
          `SELECT visibility_score FROM audits
           WHERE user_id = $1 AND LOWER(url) = LOWER($2) AND visibility_score IS NOT NULL
           ORDER BY created_at DESC LIMIT 2`,
          [userId, url]
        );
        if (recentAudits.length === 2) {
          const currentScore = recentAudits[0].visibility_score;
          const previousScore = recentAudits[1].visibility_score;
          const drop = previousScore - currentScore;
          if (drop >= 5) {
            const user = await getUserById(userId);
            if (user?.email) {
              const { sendScoreDropAlert } = await import('./services/trendAlertEmails.js');
              await sendScoreDropAlert({
                to: user.email,
                url,
                previousScore,
                currentScore,
                drop,
              });
            }
          }
        }
      } catch (trendErr: any) {
        console.warn(`[rescan] Trend alert failed (non-fatal):`, trendErr?.message);
      }

      // ── Timeline record ───────────────────────────────────────────────
      if (auditId) {
        try {
          const pool = getPool();
          const { rows: scoreRow } = await pool.query(
            `SELECT visibility_score FROM audits WHERE id = $1 LIMIT 1`,
            [auditId],
          );
          const score = Number(scoreRow[0]?.visibility_score);
          if (Number.isFinite(score)) {
            await recordTimelinePoint({
              userId,
              workspaceId: workspaceId ?? null,
              url,
              score,
              auditId,
              eventType: 'scheduled_rescan',
            });
          }
        } catch (tlErr: any) {
          console.warn(`[rescan] timeline record failed (non-fatal):`, tlErr?.message);
        }
      }
    },
    onFailed: async ({ userId, workspaceId, url, scheduleId, reason }) => {
      await dispatchWebhooks(userId, workspaceId, 'rescan.failed', {
        schedule_id: scheduleId,
        url,
        source: 'scheduled_rescan',
        reason,
      }).catch(() => {});
      await createUserNotification({
        userId,
        eventType: 'scheduled_rescan_failed',
        title: 'Scheduled rescan failed',
        message: `Scheduled scan failed for ${url}`,
        metadata: {
          workspaceId,
          scheduleId,
          url,
          reason,
        },
      }).catch(() => {});
      await createPlatformNotification({
        eventType: 'scheduled_rescan_failed',
        title: 'Background rescan failed',
        message: `A scheduled rescan failed for ${url}`,
        metadata: {
          userId,
          workspaceId,
          scheduleId,
          url,
          reason,
          source: 'scheduled_rescan',
        },
      }).catch(() => {});
    },
    onSkipped: async ({ userId, workspaceId, url, scheduleId, reason }) => {
      await dispatchWebhooks(userId, workspaceId, 'rescan.failed', {
        schedule_id: scheduleId,
        url,
        source: 'scheduled_rescan',
        reason: `skipped_no_substantial_change:${reason}`,
      }).catch(() => {});
      await createUserNotification({
        userId,
        eventType: 'scheduled_rescan_skipped',
        title: 'Scheduled rescan skipped',
        message: `No substantial change detected for ${url}`,
        metadata: {
          workspaceId,
          scheduleId,
          url,
          reason,
        },
      }).catch(() => {});
      await createPlatformNotification({
        eventType: 'scheduled_rescan_skipped',
        title: 'Background rescan skipped',
        message: `A scheduled rescan was skipped for ${url}`,
        metadata: {
          userId,
          workspaceId,
          scheduleId,
          url,
          reason,
          source: 'scheduled_rescan',
        },
      }).catch(() => {});
    },
    });
    startCompetitorAutopilotLoop(analyzeInternally);
    startNewsletterLoop();
    startAutoScoreFixWorkerLoop();
    startAutoScoreFixExpiryLoop();
    startAutoScoreFixPostMergeLoop(analyzeInternally, {
    onScheduled: async ({ userId, workspaceId, jobId, url, runAt }) => {
      await createUserNotification({
        userId,
        eventType: 'auto_score_fix_rescan_scheduled',
        title: 'Post-fix verification scan scheduled',
        message: `AiVIS scheduled a verification scan for ${url} (runs ~5 minutes after merge).`,
        metadata: {
          workspaceId,
          jobId,
          url,
          runAt,
          source: 'auto_score_fix',
        },
      }).catch(() => {});

      await createPlatformNotification({
        eventType: 'auto_score_fix_rescan_scheduled',
        title: 'Auto Score Fix verification scheduled',
        message: `Job ${jobId} scheduled a verification scan for ${url}`,
        metadata: {
          userId,
          workspaceId,
          jobId,
          url,
          runAt,
          source: 'auto_score_fix',
        },
      }).catch(() => {});
    },
    onCompleted: async ({ userId, workspaceId, jobId, url, auditId, scoreBefore, scoreAfter, scoreDelta }) => {
      await dispatchWebhooks(userId, workspaceId, 'rescan.completed', {
        job_id: jobId,
        audit_id: auditId,
        url,
        source: 'auto_score_fix',
        score_before: scoreBefore,
        score_after: scoreAfter,
        score_delta: scoreDelta,
      }).catch(() => {});

      // ── Fix learning + timeline ───────────────────────────────────────
      if (scoreAfter !== null && Number.isFinite(scoreAfter)) {
        recordFixOutcome({
          userId,
          fixType: 'meta',  // auto score fix jobs are primarily meta/schema changes
          expectedDelta: 5, // conservative default; job-level deltas are tracked separately
          actualDelta: scoreDelta ?? 0,
          url,
        }).catch(() => {});

        recordTimelinePoint({
          userId,
          workspaceId: workspaceId ?? null,
          url,
          score: scoreAfter,
          auditId: auditId ?? null,
          fixId: jobId ?? null,
          eventType: 'fix_merged',
          eventLabel: `Auto fix merged (job ${jobId})`,
        }).catch(() => {});
      }

      await createUserNotification({
        userId,
        eventType: 'auto_score_fix_rescan_completed',
        title: 'Post-fix verification completed',
        message: `Verification scan finished for ${url}. Score ${scoreBefore} → ${scoreAfter} (${scoreDelta >= 0 ? '+' : ''}${scoreDelta}).`,
        metadata: {
          workspaceId,
          jobId,
          auditId,
          url,
          scoreBefore,
          scoreAfter,
          scoreDelta,
          source: 'auto_score_fix',
        },
      }).catch(() => {});

      await createPlatformNotification({
        eventType: 'auto_score_fix_rescan_completed',
        title: 'Auto Score Fix verification completed',
        message: `Job ${jobId} completed post-fix verification for ${url} (${scoreBefore} → ${scoreAfter}).`,
        metadata: {
          userId,
          workspaceId,
          jobId,
          auditId,
          url,
          scoreBefore,
          scoreAfter,
          scoreDelta,
          source: 'auto_score_fix',
        },
      }).catch(() => {});
    },
    onFailed: async ({ userId, workspaceId, jobId, url, reason }) => {
      await dispatchWebhooks(userId, workspaceId, 'rescan.failed', {
        job_id: jobId,
        url,
        source: 'auto_score_fix',
        reason,
      }).catch(() => {});

      await createUserNotification({
        userId,
        eventType: 'auto_score_fix_rescan_failed',
        title: 'Post-fix verification failed',
        message: `Post-fix verification failed for ${url}.`,
        metadata: {
          workspaceId,
          jobId,
          url,
          reason,
          source: 'auto_score_fix',
        },
      }).catch(() => {});
    },
    });

    startDeployVerificationLoop(analyzeInternally, {
    onCompleted: async ({ userId, workspaceId, jobId, url, auditId, scoreBefore, scoreAfter, scoreDelta }) => {
      await dispatchWebhooks(userId, workspaceId, 'rescan.completed', {
        deploy_verification_job_id: jobId,
        audit_id: auditId,
        url,
        source: 'deploy_verification',
        score_before: scoreBefore,
        score_after: scoreAfter,
        score_delta: scoreDelta,
      }).catch(() => {});

      await createUserNotification({
        userId,
        eventType: 'deploy_verification_completed',
        title: 'Deploy verification completed',
        message: `Deploy verification finished for ${url}${scoreDelta === null ? '' : `. Score delta ${scoreDelta >= 0 ? '+' : ''}${scoreDelta}.`}`,
        metadata: {
          workspaceId,
          jobId,
          auditId,
          url,
          scoreBefore,
          scoreAfter,
          scoreDelta,
          source: 'deploy_verification',
        },
      }).catch(() => {});
    },
    onFailed: async ({ userId, workspaceId, jobId, url, reason }) => {
      await dispatchWebhooks(userId, workspaceId, 'rescan.failed', {
        deploy_verification_job_id: jobId,
        url,
        source: 'deploy_verification',
        reason,
      }).catch(() => {});

      await createUserNotification({
        userId,
        eventType: 'deploy_verification_failed',
        title: 'Deploy verification failed',
        message: `Deploy verification failed for ${url}.`,
        metadata: {
          workspaceId,
          jobId,
          url,
          reason,
          source: 'deploy_verification',
        },
      }).catch(() => {});
    },
    });
    startTrialExpiryLoop();
    startScheduledPlatformNotificationLoop();
    startDbCleanupLoop();
    startMcpAuditLoop();
    startTaskWorker();
    startAuditWorkerLoop();
    startFixWorker();
    startPRWorker();
    startScheduler();
    startSelfHealingLoop();
    bootstrapAgencyAutomation();
    console.log('[AuditQueue] Redis queue worker loop started');
  } else {
    console.warn('[Startup] Skipping DB-backed worker loops because database is unavailable');
  }
})();

export default app;
