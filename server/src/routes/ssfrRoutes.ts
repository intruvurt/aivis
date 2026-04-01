import { Router } from 'express';
import type { Request, Response } from 'express';
import { authRequired } from '../middleware/authRequired.js';
import { getPool } from '../services/postgresql.js';
import { loadSSFRResults, verifyFixpack, reverifyAudit } from '../services/ssfrVerificationService.js';
import { extractEvidenceFromScrape, enrichEvidenceFromAnalysis } from '../services/evidenceExtractor.js';
import { evaluateSSFRRules, buildSSFRSummary } from '../services/ssfrRuleEngine.js';
import { generateFixpacks } from '../services/fixpackGenerator.js';

const router = Router();

// All SSFR routes require authentication
router.use(authRequired);

// ─── GET /api/ssfr/:auditId — Full SSFR results for an audit ───────────────

router.get('/:auditId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const auditId = String(req.params.auditId);
    const pool = getPool();

    // Verify audit belongs to user
    const auditResult = await pool.query(
      'SELECT id FROM audits WHERE id = $1 AND user_id = $2',
      [auditId, userId],
    );
    if (auditResult.rowCount === 0) {
      return res.status(404).json({ error: 'Audit not found' });
    }

    const data = await loadSSFRResults(pool, auditId);
    if (!data) {
      return res.status(404).json({ error: 'No SSFR data for this audit' });
    }

    const summary = buildSSFRSummary(data.ruleResults);

    return res.json({
      audit_id: auditId,
      evidence: data.evidence,
      rule_results: data.ruleResults,
      fixpacks: data.fixpacks,
      summary,
    });
  } catch (err: any) {
    console.error('[SSFR] Get results error:', err);
    return res.status(500).json({ error: 'Failed to fetch SSFR results' });
  }
});

// ─── GET /api/ssfr/:auditId/fixpacks — Fixpacks only ───────────────────────

router.get('/:auditId/fixpacks', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const auditId = String(req.params.auditId);
    const pool = getPool();

    const auditResult = await pool.query(
      'SELECT id FROM audits WHERE id = $1 AND user_id = $2',
      [auditId, userId],
    );
    if (auditResult.rowCount === 0) {
      return res.status(404).json({ error: 'Audit not found' });
    }

    const fpResult = await pool.query(
      `SELECT id, type, title, summary, priority, assets, auto_generatable, verification_status, based_on_rule_ids, created_at
       FROM audit_fixpacks WHERE audit_id = $1 ORDER BY
         CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END,
         created_at`,
      [auditId],
    );

    return res.json({ audit_id: auditId, fixpacks: fpResult.rows });
  } catch (err: any) {
    console.error('[SSFR] Get fixpacks error:', err);
    return res.status(500).json({ error: 'Failed to fetch fixpacks' });
  }
});

// ─── POST /api/ssfr/:auditId/fixpacks/:fixpackId/verify — Verify one fixpack

router.post('/:auditId/fixpacks/:fixpackId/verify', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const auditId = String(req.params.auditId);
    const fixpackId = String(req.params.fixpackId);
    const pool = getPool();

    // Verify ownership
    const auditResult = await pool.query(
      'SELECT id, result FROM audits WHERE id = $1 AND user_id = $2',
      [auditId, userId],
    );
    if (auditResult.rowCount === 0) {
      return res.status(404).json({ error: 'Audit not found' });
    }

    // Load current evidence for re-evaluation
    const ssfrData = await loadSSFRResults(pool, auditId);
    if (!ssfrData) {
      return res.status(404).json({ error: 'No SSFR data for this audit' });
    }

    const result = await verifyFixpack(pool, auditId, fixpackId, ssfrData.evidence);

    return res.json({ fixpack_id: fixpackId, ...result });
  } catch (err: any) {
    console.error('[SSFR] Verify fixpack error:', err);
    return res.status(500).json({ error: 'Failed to verify fixpack' });
  }
});

// ─── POST /api/ssfr/:auditId/reverify — Re-verify all fixpacks ─────────────

router.post('/:auditId/reverify', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const auditId = String(req.params.auditId);
    const pool = getPool();

    const auditResult = await pool.query(
      'SELECT id FROM audits WHERE id = $1 AND user_id = $2',
      [auditId, userId],
    );
    if (auditResult.rowCount === 0) {
      return res.status(404).json({ error: 'Audit not found' });
    }

    const ssfrData = await loadSSFRResults(pool, auditId);
    if (!ssfrData) {
      return res.status(404).json({ error: 'No SSFR data for this audit' });
    }

    const result = await reverifyAudit(pool, auditId, ssfrData.evidence);

    return res.json({ audit_id: auditId, ...result });
  } catch (err: any) {
    console.error('[SSFR] Reverify error:', err);
    return res.status(500).json({ error: 'Failed to reverify audit' });
  }
});

// ─── GET /api/ssfr/:auditId/summary — Summary stats only ───────────────────

router.get('/:auditId/summary', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const auditId = String(req.params.auditId);
    const pool = getPool();

    const auditResult = await pool.query(
      'SELECT id FROM audits WHERE id = $1 AND user_id = $2',
      [auditId, userId],
    );
    if (auditResult.rowCount === 0) {
      return res.status(404).json({ error: 'Audit not found' });
    }

    const data = await loadSSFRResults(pool, auditId);
    if (!data) {
      return res.status(404).json({ error: 'No SSFR data for this audit' });
    }

    const summary = buildSSFRSummary(data.ruleResults);

    return res.json({ audit_id: auditId, summary });
  } catch (err: any) {
    console.error('[SSFR] Get summary error:', err);
    return res.status(500).json({ error: 'Failed to fetch SSFR summary' });
  }
});

export default router;
