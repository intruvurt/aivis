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
          'AiVIS does not sell customer website data or account data.',
          'Billing is handled by Stripe; card details are never stored by AiVIS.',
        ],
      },
      disclaimer: {
        summary:
          'AiVIS provides technical AI-visibility diagnostics and recommendations. It is not legal, financial, or medical advice, and no specific ranking outcome is guaranteed.',
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

export default router;
