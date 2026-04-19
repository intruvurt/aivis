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

import { Request, Response } from "express";
import * as cheerio from "cheerio";
import { scrapeWebsite } from "../services/scraper.js";
import { runAnalysisEngines } from "../services/engines/engineComposer.js";
import { getPool, getConnection } from "../services/postgresql.js";
import { persistAuditRecord } from "../services/auditPersistenceService.js";
import { createCiteEntry } from "../services/citeLedgerService.js";
import { normalizePublicHttpUrl } from "../lib/urlSafety.js";
import type { CanonicalTier, CiteEntry } from "../../../shared/types.js";
import { uiTierFromCanonical, getTierLimits } from "../../../shared/types.js";
import { lookupDomainAgeYears } from "../lib/utils/domainAge.js";

export async function intelligenceAnalyzeHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const startTime = Date.now();

  try {
    // ====================================================================
    // VALIDATION & AUTHORIZATION
    // ====================================================================

    const userId = String((req as any).user?.id || "").trim();
    if (!userId) {
      res.status(401).json({
        error: "Unauthorized",
        code: "NO_USER",
        request_id: requestId,
      });
      return;
    }

    const userTierRaw = (req as any).user?.tier || "observer";
    const tier = uiTierFromCanonical(userTierRaw) as CanonicalTier;

    // ====================================================================
    // INPUT VALIDATION
    // ====================================================================

    const { url: rawUrl } = req.body || {};
    if (!rawUrl || typeof rawUrl !== "string") {
      res.status(400).json({
        error: "Missing or invalid URL",
        code: "INVALID_URL",
        request_id: requestId,
      });
      return;
    }

    // Normalize and validate URL (includes SSRF protection)
    const urlStr = String(rawUrl).trim();
    const urlResult = normalizePublicHttpUrl(urlStr, {
      allowPrivate: process.env.NODE_ENV !== "production",
    });
    if (!urlResult.ok) {
      res.status(400).json({
        error: urlResult.error,
        code: "URL_VALIDATION_FAILED",
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
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .slice(0, 10);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString()
      .slice(0, 10);

    // Use usage_daily - same table as featureRoutes /status so counts stay in sync
    const usageResult = await getPool().query(
      `SELECT COALESCE(SUM(requests), 0) AS total_requests
       FROM usage_daily
       WHERE user_id = $1 AND date >= $2 AND date <= $3`,
      [userId, monthStart, monthEnd],
    );

    const used = Number(usageResult.rows?.[0]?.total_requests || 0);
    const limits = getTierLimits(tier);
    const remaining = Math.max(0, limits.scansPerMonth - used);

    if (remaining <= 0) {
      res.status(429).json({
        error: "Monthly audit limit reached",
        tier,
        limit: limits.scansPerMonth,
        used,
        next_reset: new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          1,
        ).toISOString(),
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
        error: "Failed to scrape website",
        code: "SCRAPE_FAILED",
        details: "No HTML extracted from target URL",
        request_id: requestId,
      });
      return;
    }

    // ====================================================================
    // RUN INTELLIGENCE ENGINES
    // ====================================================================

    console.log(
      `[${requestId}] Running intelligence engines for tier: ${tier}...`,
    );

    // Real domain age via RDAP (non-blocking - falls back to 0 on timeout/failure)
    const domainAgeYears = await lookupDomainAgeYears(analysisUrl.hostname);

    const analysis = await runAnalysisEngines({
      html: scraped.data.html,
      url: targetUrl,
      domain: analysisUrl.hostname,
      tier,
      https_enabled: analysisUrl.protocol === "https:",
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
    // RECORD CITE LEDGER ENTRIES FROM EVIDENCE EXTRACTED BY ENGINES
    // ====================================================================

    if (savedAuditId) {
      try {
        const client = await getConnection();
        try {
          // Extract citable sections from citation readiness engine
          if (analysis.citation_readiness?.data?.citable_sections) {
            const sections = analysis.citation_readiness.data.citable_sections;
            for (const section of sections) {
              await createCiteEntry(client, {
                url: targetUrl,
                audit_id: savedAuditId,
                source_type: "citation_engine",
                source_metadata: {
                  section_heading: section.section_heading,
                  page: section.page,
                },
                raw_evidence: section.extractable_text || "",
                extracted_signal: `Citable section: ${section.section_heading} (${section.word_count} words)`,
                confidence_score: section.confidence || 0.85,
                confidence_basis: `Extracted from ${section.page}`,
                interpretation: `Well-structured citable content with ${section.word_count} words and confidence ${section.confidence}`,
                entity_refs: [],
                related_findings: section.risk_factors || [],
                tags: [
                  "citable_section",
                  `confidence_${Math.round((section.confidence || 0.85) * 100)}`,
                ],
              } as unknown as Omit<
                CiteEntry,
                | "id"
                | "ledger_hash"
                | "raw_evidence_hash"
                | "created_at"
                | "updated_at"
              >);
            }
          }

          // Extract trust signals from trust layer engine
          if (analysis.trust_layer?.data?.signal_status) {
            const signals = analysis.trust_layer.data.signal_status;
            const trustSignals: string[] = [];
            if (signals.https_enabled) trustSignals.push("HTTPS enabled");
            if (signals.tls_certificate_trusted)
              trustSignals.push("TLS certificate trusted");
            if (signals.contact_info_present)
              trustSignals.push("Contact info present");
            if (signals.privacy_policy_accessible)
              trustSignals.push("Privacy policy accessible");

            if (trustSignals.length > 0) {
              await createCiteEntry(client, {
                url: targetUrl,
                audit_id: savedAuditId,
                source_type: "trust_layer",
                source_metadata: { signals_detected: trustSignals.length },
                raw_evidence: JSON.stringify(signals),
                extracted_signal: `Trust signals: ${trustSignals.join(", ")}`,
                confidence_score: 0.9,
                confidence_basis:
                  "Automated verification of security and trust indicators",
                interpretation: `Site demonstrates trust through ${trustSignals.join(", ")}`,
                entity_refs: [],
                tags: [
                  "trust_signal",
                  ...trustSignals
                    .map((s) => `trust_${s.toLowerCase().replace(/ /g, "_")}`)
                    .slice(0, 3),
                ],
              } as unknown as Omit<
                CiteEntry,
                | "id"
                | "ledger_hash"
                | "raw_evidence_hash"
                | "created_at"
                | "updated_at"
              >);
            }
          }

          // Extract entity clarity evidence
          if (analysis.entity_graph?.data?.primary_entity) {
            const entity = analysis.entity_graph.data.primary_entity;
            await createCiteEntry(client, {
              url: targetUrl,
              audit_id: savedAuditId,
              source_type: "entity_graph",
              source_metadata: {
                entity_name: entity.canonical_name,
                entity_type: "primary",
              },
              raw_evidence: JSON.stringify(entity),
              extracted_signal:
                `Clear identity: ${entity.canonical_name}` +
                (entity.aliases.length > 0
                  ? ` (${entity.aliases.length} aliases)`
                  : ""),
              confidence_score: entity.confidence || 0.85,
              confidence_basis:
                "Entity extraction and name consistency analysis",
              interpretation: `Primary entity "${entity.canonical_name}" clearly identified with ${entity.confidence} confidence`,
              entity_refs: [
                { name: entity.canonical_name, type: "organization" },
              ],
              tags: ["entity_identification", "primary_entity"],
            } as unknown as Omit<
              CiteEntry,
              | "id"
              | "ledger_hash"
              | "raw_evidence_hash"
              | "created_at"
              | "updated_at"
            >);
          }

          console.log(
            `[${requestId}] Recorded cite ledger entries for audit ${savedAuditId}`,
          );
        } finally {
          client.release();
        }
      } catch (err) {
        console.warn(`[${requestId}] Failed to record cite entries:`, err);
        // Non-critical - audit is already saved
      }
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

    console.log(
      `[${requestId}] Analysis complete in ${responseTime}ms | Score: ${analysis.overall_ai_visibility_score} | Tier: ${tier}`,
    );
  } catch (err) {
    console.error(`[${requestId}] Analysis error:`, err);

    res.status(500).json({
      error: "Analysis failed",
      code: "ANALYSIS_ERROR",
      request_id: requestId,
    });
  }
}
