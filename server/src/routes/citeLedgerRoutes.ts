/**
 * CITE LEDGER API ROUTES
 * 
 * Endpoints for accessing and expanding the immutable truth layer.
 * All responses are read-only and fully auditable.
 */

import { Router, Request, Response } from 'express';
import { authRequired } from '../middleware/authMiddleware.js';
import { citeLedgerService } from '../services/citeLedgerService.js';
import { getConnection } from '../services/postgresql.js';

export const citeLedgerRoutes = Router();

/**
 * GET /api/cite-ledger/stats
 * Platform health metrics (no auth required - public insight)
 */
citeLedgerRoutes.get(
  '/cite-ledger/stats',
  async (req: Request, res: Response) => {
    try {
      const client = await getConnection();
      const stats = await citeLedgerService.getCiteLedgerStats(client);
      client.release();

      res.json({
        status: 'ok',
        data: stats,
        timestamp: Date.now(),
      });
    } catch (err: any) {
      console.error('[Cite Ledger] Stats error:', err);
      res.status(500).json({
        error: 'Failed to fetch cite ledger stats',
        code: 'CITE_STATS_ERROR',
      });
    }
  }
);

/**
 * GET /api/audits/:auditId/cites
 * All cite entries for an audit (authenticated)
 */
citeLedgerRoutes.get(
  '/audits/:auditId/cites',
  authRequired,
  async (req: Request, res: Response) => {
    try {
      const { auditId } = req.params;
      const client = await getConnection();
      const cites = await citeLedgerService.getAuditCites(client, auditId);
      client.release();

      res.json({
        status: 'ok',
        audit_id: auditId,
        cite_count: cites.length,
        cites,
        timestamp: Date.now(),
      });
    } catch (err: any) {
      console.error('[Cite Ledger] Get audit cites error:', err);
      res.status(500).json({
        error: 'Failed to fetch audit cites',
        code: 'CITE_FETCH_ERROR',
      });
    }
  }
);

/**
 * GET /api/cites/:citeId
 * Single cite entry with full provenance (authenticated)
 */
citeLedgerRoutes.get(
  '/cites/:citeId',
  authRequired,
  async (req: Request, res: Response) => {
    try {
      const { citeId } = req.params;
      const client = await getConnection();

      // Get full cite with provenance
      const expansion = await citeLedgerService.expandCiteWithProvenance(client, citeId);
      
      if (!expansion) {
        client.release();
        return res.status(404).json({
          error: 'Cite not found',
          code: 'CITE_NOT_FOUND',
        });
      }

      // Verify integrity
      const integrityCheck = await citeLedgerService.verifyCiteIntegrity(client, citeId);
      client.release();

      res.json({
        status: 'ok',
        cite: expansion.cite,
        context: expansion.context,
        provenance: expansion.chain_provenance,
        integrity: integrityCheck,
        timestamp: Date.now(),
      });
    } catch (err: any) {
      console.error('[Cite Ledger] Get cite error:', err);
      res.status(500).json({
        error: 'Failed to fetch cite',
        code: 'CITE_FETCH_ERROR',
      });
    }
  }
);

/**
 * GET /api/cites/:citeId/verify
 * Verify cite hasn't been tampered with (authenticated)
 */
citeLedgerRoutes.get(
  '/cites/:citeId/verify',
  authRequired,
  async (req: Request, res: Response) => {
    try {
      const { citeId } = req.params;
      const client = await getConnection();
      const verification = await citeLedgerService.verifyCiteIntegrity(client, citeId);
      client.release();

      res.json({
        status: 'ok',
        cite_id: citeId,
        ...verification,
        timestamp: Date.now(),
      });
    } catch (err: any) {
      console.error('[Cite Ledger] Verification error:', err);
      res.status(500).json({
        error: 'Failed to verify cite',
        code: 'CITE_VERIFY_ERROR',
      });
    }
  }
);

/**
 * POST /api/analyze (UPDATED)
 * Creates cite entries as part of audit analysis
 * 
 * This endpoint now:
 * 1. Runs audit as before
 * 2. Creates cite entries for each evidence source
 * 3. Returns audit WITH proof of cite lineage
 */

/**
 * GET /api/audits/:auditId/evidence-chain
 * Full evidence chain for a visibility score (authenticated)
 */
citeLedgerRoutes.get(
  '/audits/:auditId/evidence-chain',
  authRequired,
  async (req: Request, res: Response) => {
    try {
      const { auditId } = req.params;
      const client = await getConnection();

      // Get all cites for this audit
      const cites = await citeLedgerService.getAuditCites(client, auditId);

      // Group by category
      const byCategory = cites.reduce((acc: any, cite: any) => {
        const cat = cite.source_type;
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push({
          id: cite.id,
          signal: cite.extracted_signal,
          confidence: cite.confidence_score,
          created: cite.created_at,
        });
        return acc;
      }, {});

      // Calculate aggregate confidence
      const avgConfidence = cites.length > 0
        ? cites.reduce((sum: number, c: any) => sum + c.confidence_score, 0) / cites.length
        : 0;

      client.release();

      res.json({
        status: 'ok',
        audit_id: auditId,
        total_cite_entries: cites.length,
        avg_confidence: parseFloat((avgConfidence * 100).toFixed(1)),
        evidence_by_source: byCategory,
        timestamp: Date.now(),
      });
    } catch (err: any) {
      console.error('[Cite Ledger] Evidence chain error:', err);
      res.status(500).json({
        error: 'Failed to fetch evidence chain',
        code: 'EVIDENCE_CHAIN_ERROR',
      });
    }
  }
);

export default citeLedgerRoutes;
