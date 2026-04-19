import { Router, Request, Response } from 'express';
import { authRequired } from '../middleware/authRequired.js';
import { workspaceRequired } from '../middleware/workspaceRequired.js';
import { getPool } from '../services/postgresql.js';

const router = Router();

const POLICY_VERSION = '2026-03-10';

router.get('/policy', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      policyVersion: POLICY_VERSION,
      privacyUrl: '/privacy',
      termsUrl: '/terms',
      consumerPolicy: {
        jurisdiction: 'Georgia, United States',
        summary: [
          'Users can request data export and account deletion from Settings.',
          'AiVIS.biz does not sell customer website data or account data.',
          'Billing is handled by Stripe; card details are never stored by AiVIS.biz.',
        ],
      },
      disclaimer: {
        summary:
          'AiVIS.biz provides technical AI-visibility diagnostics and recommendations. It is not legal, financial, or medical advice, and no specific ranking outcome is guaranteed.',
      },
      mobileStoreReadiness: {
        supportEmail: 'support@aivis.biz',
        dataDeletionFlow: 'Settings -> Privacy & Data -> Delete account',
        privacyPolicyPublic: true,
        termsPublic: true,
      },
      updatedAt: new Date().toISOString(),
    },
  });
});

router.use(authRequired);
router.use(workspaceRequired);

router.get('/consent', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT id, user_id, workspace_id, consent_type, status, policy_version, source, metadata, created_at, updated_at
       FROM user_consents
       WHERE user_id = $1 AND workspace_id = $2
       ORDER BY updated_at DESC`,
      [req.user!.id, req.workspace!.id]
    );

    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Compliance check failed. Please try again.' });
  }
});

router.post('/consent', async (req: Request, res: Response) => {
  try {
    const consentType = String(req.body?.consentType || '').trim().toLowerCase();
    const status = String(req.body?.status || '').trim().toLowerCase();
    const policyVersion = String(req.body?.policyVersion || POLICY_VERSION).trim();
    const source = String(req.body?.source || 'web').trim().toLowerCase();
    const metadata = req.body?.metadata && typeof req.body.metadata === 'object' ? req.body.metadata : {};

    if (!consentType) {
      return res.status(400).json({ success: false, error: 'consentType is required' });
    }

    const validStatuses = new Set(['accepted', 'declined', 'revoked']);
    if (!validStatuses.has(status)) {
      return res.status(400).json({ success: false, error: 'status must be accepted, declined, or revoked' });
    }

    const validTypes = new Set(['analytics', 'marketing', 'terms', 'privacy', 'consumer_disclaimer']);
    if (!validTypes.has(consentType)) {
      return res.status(400).json({ success: false, error: 'Unsupported consentType' });
    }

    const pool = getPool();
    const { rows } = await pool.query(
      `INSERT INTO user_consents (user_id, workspace_id, consent_type, status, policy_version, source, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id, workspace_id, consent_type)
       DO UPDATE SET
         status = EXCLUDED.status,
         policy_version = EXCLUDED.policy_version,
         source = EXCLUDED.source,
         metadata = EXCLUDED.metadata,
         updated_at = NOW()
       RETURNING id, user_id, workspace_id, consent_type, status, policy_version, source, metadata, created_at, updated_at`,
      [req.user!.id, req.workspace!.id, consentType, status, policyVersion, source, metadata]
    );

    return res.status(201).json({ success: true, data: rows[0] });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Compliance check failed. Please try again.' });
  }
});

/**
 * GET /api/compliance/audit-logs
 * Returns a unified activity log: scan runs + consent events for the authenticated user.
 * Sorted newest-first, capped at 200 rows total.
 */
router.get('/audit-logs', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const userId = req.user!.id;
    const limit = Math.min(Number(req.query.limit) || 100, 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const workspaceId = req.workspace!.id;

    // Scan activity from audits table
    const scansPromise = pool.query(
      `SELECT
         id,
         'scan_run'       AS action_type,
         url              AS subject,
         visibility_score AS detail_num,
         tier_at_analysis AS detail_text,
         created_at
       FROM audits
       WHERE user_id = $1
         AND workspace_id = $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [userId, workspaceId, limit]
    );

    // Consent events from user_consents table
    const consentsPromise = pool.query(
      `SELECT
         id,
         'consent_update'               AS action_type,
         consent_type                   AS subject,
         NULL::int                      AS detail_num,
         CONCAT(status, ' (', source, ')') AS detail_text,
         updated_at                     AS created_at
       FROM user_consents
       WHERE user_id = $1
         AND workspace_id = $2
       ORDER BY updated_at DESC
       LIMIT 50`,
      [userId, workspaceId]
    );

    const [scansResult, consentsResult] = await Promise.all([scansPromise, consentsPromise]);

    // Merge and sort by timestamp descending
    const combined = [
      ...scansResult.rows,
      ...consentsResult.rows,
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const page = combined.slice(offset, offset + limit);

    return res.json({
      success: true,
      data: page,
      meta: { total: combined.length, limit, offset },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to fetch audit logs.' });
  }
});

/**
 * GET /api/compliance/export
 * GDPR-style full data export for the authenticated user.
 * Returns JSON with profile, audits (metadata only, no result blob), consent records, and payments.
 */
router.get('/export', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const userId = req.user!.id;

    const exportWorkspaceId = req.workspace!.id;

    const [profileResult, auditsResult, consentsResult, paymentsResult] = await Promise.all([
      pool.query(
        `SELECT id, name, email, tier, created_at, updated_at FROM users WHERE id = $1`,
        [userId]
      ),
      pool.query(
        `SELECT id, url, visibility_score, tier_at_analysis, status, created_at
         FROM audits
         WHERE user_id = $1
           AND workspace_id = $2
         ORDER BY created_at DESC
         LIMIT 1000`,
        [userId, exportWorkspaceId]
      ),
      pool.query(
        `SELECT id, consent_type, status, policy_version, source, created_at, updated_at
         FROM user_consents
         WHERE user_id = $1
           AND workspace_id = $2
         ORDER BY updated_at DESC`,
        [userId, exportWorkspaceId]
      ),
      pool.query(
        `SELECT id, amount, currency, status, created_at
         FROM payments
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [userId]
      ),
    ]);

    const exportPayload = {
      exported_at: new Date().toISOString(),
      schema_version: '1.0',
      profile: profileResult.rows[0] ?? null,
      audits: auditsResult.rows,
      consent_records: consentsResult.rows,
      payments: paymentsResult.rows,
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="aivis-data-export-${new Date().toISOString().slice(0, 10)}.json"`
    );
    return res.status(200).json(exportPayload);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Data export failed. Please try again.' });
  }
});

export default router;
