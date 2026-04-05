/**
 * Intelligence Engine Analyze Endpoint
 * 
 * POST /api/analyze/intelligence
 * 
 * Phase 1 MVP: Runs the new intelligence engines
 * Simpler than legacy /api/analyze, focused on core 3 engines (Citation, Trust, Entity)
 * 
 * Future: Merge with legacy /api/analyze once proven
 */

import { Request, Response } from 'express';
import * as cheerio from 'cheerio';
import { scrapeWebsite } from '../services/scraper.js';
import { runAnalysisEngines } from '../services/engines/engineComposer.js';
import { getPool } from '../services/postgresql.js';
import { persistAuditRecord } from '../services/auditPersistenceService.js';
import { normalizePublicHttpUrl } from '../lib/urlSafety.js';
import type { CanonicalTier } from '../../../shared/types.js';
import { uiTierFromCanonical, getTierLimits } from '../../../shared/types.js';
import { lookupDomainAgeYears } from '../lib/utils/domainAge.js';

export async function intelligenceAnalyzeHandler(req: Request, res: Response): Promise<void> {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const startTime = Date.now();

  try {
    // ====================================================================
    // VALIDATION & AUTHORIZATION
    // ====================================================================

    const userId = String((req as any).user?.id || '').trim();
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized', code: 'NO_USER', request_id: requestId });
      return;
    }

    const userTierRaw = (req as any).user?.tier || 'observer';
    const tier = uiTierFromCanonical(userTierRaw) as CanonicalTier;

    // ====================================================================
    // INPUT VALIDATION
    // ====================================================================

    const { url: rawUrl } = req.body || {};
    if (!rawUrl || typeof rawUrl !== 'string') {
      res.status(400).json({ error: 'Missing or invalid URL', code: 'INVALID_URL', request_id: requestId });
      return;
    }

    // Normalize and validate URL (includes SSRF protection)
    const urlStr = String(rawUrl).trim();
    const urlResult = normalizePublicHttpUrl(urlStr, {
      allowPrivate: process.env.NODE_ENV !== 'production',
    });
    if (!urlResult.ok) {
      res.status(400).json({
        error: urlResult.error,
        code: 'URL_VALIDATION_FAILED',
        request_id: requestId,
      });
      return;
    }

    const targetUrl = urlResult.url;
    const analysisUrl = new URL(targetUrl);

    // ====================================================================
    // CHECK USAGE QUOTA
    // ====================================================================

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

    // Use usage_daily - same table as featureRoutes /status so counts stay in sync
    const usageResult = await getPool().query(
      `SELECT COALESCE(SUM(requests), 0) AS total_requests
       FROM usage_daily
       WHERE user_id = $1 AND date >= $2 AND date <= $3`,
      [userId, monthStart, monthEnd]
    );

    const used = Number(usageResult.rows?.[0]?.total_requests || 0);
    const limits = getTierLimits(tier);
    const remaining = Math.max(0, limits.scansPerMonth - used);

    if (remaining <= 0) {
      res.status(429).json({
        error: 'Monthly audit limit reached',
        tier,
        limit: limits.scansPerMonth,
        used,
        next_reset: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString(),
        request_id: requestId,
      });
      return;
    }

    // ====================================================================
    // SCRAPE WEBSITE
    // ====================================================================

    console.log(`[${requestId}] Scraping ${targetUrl}...`);

    const scraped = await scrapeWebsite(targetUrl);

    if (!scraped?.data?.html) {
      res.status(400).json({
        error: 'Failed to scrape website',
        code: 'SCRAPE_FAILED',
        details: 'No HTML extracted from target URL',
        request_id: requestId,
      });
      return;
    }

    // ====================================================================
    // RUN INTELLIGENCE ENGINES
    // ====================================================================

    console.log(`[${requestId}] Running intelligence engines for tier: ${tier}...`);

    // Real domain age via RDAP (non-blocking - falls back to 0 on timeout/failure)
    const domainAgeYears = await lookupDomainAgeYears(analysisUrl.hostname);

    const analysis = await runAnalysisEngines({
      html: scraped.data.html,
      url: targetUrl,
      domain: analysisUrl.hostname,
      tier,
      https_enabled: analysisUrl.protocol === 'https:',
      domain_age_years: domainAgeYears,
    });

    // ====================================================================
    // SAVE AUDIT RECORD - workspace_id required for share-link lookup
    // ====================================================================

    let savedAuditId: string | null = null;
    try {
      const workspaceId = (req as any).workspace?.id ?? null;
      savedAuditId = await persistAuditRecord({
        userId,
        workspaceId,
        url: targetUrl,
        visibilityScore: analysis.overall_ai_visibility_score,
        result: analysis as unknown as Record<string, unknown>,
        tierAtAnalysis: tier,
      });
    } catch (err) {
      console.warn(`[${requestId}] Failed to save audit record:`, err);
      // Non-critical - analysis still returned to client
    }

    // ====================================================================
    // RESPONSE
    // ====================================================================

    const responseTime = Date.now() - startTime;

    res.json({
      ...analysis,
      request_id: requestId,
      processing_time_ms: responseTime,
      ...(savedAuditId ? { audit_id: savedAuditId } : {}),
    });

    console.log(`[${requestId}] Analysis complete in ${responseTime}ms | Score: ${analysis.overall_ai_visibility_score} | Tier: ${tier}`);

  } catch (err) {
    console.error(`[${requestId}] Analysis error:`, err);

    res.status(500).json({
      error: 'Analysis failed',
      code: 'ANALYSIS_ERROR',
      request_id: requestId,
    });
  }
}
