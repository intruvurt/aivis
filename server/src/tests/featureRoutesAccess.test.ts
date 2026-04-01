import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({
  userId: 'user_test_1',
  tier: 'observer' as string,
  workspaceId: 'ws_test_1',
}));

const mockCreateScheduledRescan = vi.fn();
const mockGetScheduledRescans = vi.fn();
const mockUpdateScheduledRescan = vi.fn();
const mockDeleteScheduledRescan = vi.fn();

const mockCreateApiKey = vi.fn();
const mockListApiKeys = vi.fn();
const mockRevokeApiKey = vi.fn();
const mockToggleApiKey = vi.fn();

const mockCreateWebhook = vi.fn();
const mockListWebhooks = vi.fn();
const mockDeleteWebhook = vi.fn();
const mockToggleWebhook = vi.fn();
const mockIsGoogleMeasurementConfigured = vi.fn();
const mockIsValidMeasurementEventName = vi.fn();
const mockSendMeasurementEvent = vi.fn();

const mockGetBranding = vi.fn();
const mockUpsertBranding = vi.fn();
const mockDeleteBranding = vi.fn();

vi.mock('../middleware/authRequired.js', () => ({
  authRequired: (req: any, _res: any, next: any) => {
    req.user = {
      id: authState.userId,
      tier: authState.tier,
    };
    next();
  },
}));

vi.mock('../middleware/workspaceRequired.js', () => ({
  workspaceRequired: (req: any, _res: any, next: any) => {
    req.workspace = {
      id: authState.workspaceId,
    };
    next();
  },
}));

vi.mock('../services/scheduledRescanService.js', () => ({
  createScheduledRescan: (...args: unknown[]) => mockCreateScheduledRescan(...args),
  getScheduledRescans: (...args: unknown[]) => mockGetScheduledRescans(...args),
  updateScheduledRescan: (...args: unknown[]) => mockUpdateScheduledRescan(...args),
  deleteScheduledRescan: (...args: unknown[]) => mockDeleteScheduledRescan(...args),
}));

vi.mock('../services/apiKeyService.js', () => ({
  createApiKey: (...args: unknown[]) => mockCreateApiKey(...args),
  listApiKeys: (...args: unknown[]) => mockListApiKeys(...args),
  revokeApiKey: (...args: unknown[]) => mockRevokeApiKey(...args),
  toggleApiKey: (...args: unknown[]) => mockToggleApiKey(...args),
  validateApiKey: vi.fn(),
}));

vi.mock('../services/webhookService.js', () => ({
  createWebhook: (...args: unknown[]) => mockCreateWebhook(...args),
  listWebhooks: (...args: unknown[]) => mockListWebhooks(...args),
  deleteWebhook: (...args: unknown[]) => mockDeleteWebhook(...args),
  toggleWebhook: (...args: unknown[]) => mockToggleWebhook(...args),
}));

vi.mock('../services/googleMeasurement.js', () => ({
  isGoogleMeasurementConfigured: (...args: unknown[]) => mockIsGoogleMeasurementConfigured(...args),
  isValidMeasurementEventName: (...args: unknown[]) => mockIsValidMeasurementEventName(...args),
  sendMeasurementEvent: (...args: unknown[]) => mockSendMeasurementEvent(...args),
}));

vi.mock('../services/brandingService.js', () => ({
  getBranding: (...args: unknown[]) => mockGetBranding(...args),
  upsertBranding: (...args: unknown[]) => mockUpsertBranding(...args),
  deleteBranding: (...args: unknown[]) => mockDeleteBranding(...args),
}));

import featureRoutes from '../routes/featureRoutes.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/features', featureRoutes);
  return app;
}

describe('featureRoutes tier gating + workspace scoping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.userId = 'user_test_1';
    authState.workspaceId = 'ws_test_1';
    authState.tier = 'observer';
  });

  describe('scheduled rescans', () => {
    it('blocks observer tier with 403', async () => {
      const app = makeApp();
      const res = await request(app).get('/api/features/scheduled-rescans');

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(String(res.body.error || '').toLowerCase()).toContain('upgrade');
      expect(mockGetScheduledRescans).not.toHaveBeenCalled();
    });

    it('allows signal tier and passes user/workspace to service', async () => {
      authState.tier = 'signal';
      mockGetScheduledRescans.mockResolvedValue([{ id: 'rescan_1' }]);

      const app = makeApp();
      const res = await request(app).get('/api/features/scheduled-rescans');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([{ id: 'rescan_1' }]);
      expect(mockGetScheduledRescans).toHaveBeenCalledWith('user_test_1', 'ws_test_1');
    });
  });

  describe('api keys', () => {
    it('blocks observer tier with 403', async () => {
      const app = makeApp();
      const res = await request(app).get('/api/features/api-keys');

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(mockListApiKeys).not.toHaveBeenCalled();
    });

    it('creates API key for signal tier with workspace context', async () => {
      authState.tier = 'signal';
      mockCreateApiKey.mockResolvedValue({ id: 'key_1', plaintext_key: 'avis_abc' });

      const app = makeApp();
      const res = await request(app)
        .post('/api/features/api-keys')
        .send({ name: 'Production', scopes: ['read:audits'] });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(mockCreateApiKey).toHaveBeenCalledWith('user_test_1', 'ws_test_1', 'Production', ['read:audits'], 'signal');
    });
  });

  describe('webhooks', () => {
    it('blocks observer tier with 403', async () => {
      const app = makeApp();
      const res = await request(app).get('/api/features/webhooks');

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(mockListWebhooks).not.toHaveBeenCalled();
    });

    it('toggles webhook for signal tier using workspace scope', async () => {
      authState.tier = 'signal';
      mockToggleWebhook.mockResolvedValue({ id: 'wh_1', enabled: false });

      const app = makeApp();
      const res = await request(app)
        .patch('/api/features/webhooks/wh_1')
        .send({ enabled: false });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockToggleWebhook).toHaveBeenCalledWith('wh_1', 'user_test_1', 'ws_test_1', false);
    });
  });

  describe('measurement protocol events', () => {
    it('blocks observer tier with 403', async () => {
      const app = makeApp();
      const res = await request(app)
        .post('/api/features/analytics/measurement-event')
        .send({ eventName: 'audit_completed' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(mockSendMeasurementEvent).not.toHaveBeenCalled();
    });

    it('accepts valid event for signal tier', async () => {
      authState.tier = 'signal';
      mockIsGoogleMeasurementConfigured.mockReturnValue(true);
      mockIsValidMeasurementEventName.mockReturnValue(true);
      mockSendMeasurementEvent.mockResolvedValue({ ok: true, status: 204 });

      const app = makeApp();
      const res = await request(app)
        .post('/api/features/analytics/measurement-event')
        .send({ eventName: 'audit_completed', eventParams: { source: 'dashboard' }, clientId: '1234.5678' });

      expect(res.status).toBe(202);
      expect(res.body.success).toBe(true);
      expect(mockSendMeasurementEvent).toHaveBeenCalledWith({
        eventName: 'audit_completed',
        clientId: '1234.5678',
        userId: 'user_test_1',
        params: { source: 'dashboard' },
      });
    });
  });

  describe('branding (white-label)', () => {
    it('blocks observer tier with 403', async () => {
      const app = makeApp();
      const res = await request(app).get('/api/features/branding');

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(mockGetBranding).not.toHaveBeenCalled();
    });

    it('updates branding for signal tier with workspace context', async () => {
      authState.tier = 'signal';
      mockUpsertBranding.mockResolvedValue({ id: 'brand_1', company_name: 'Acme' });

      const app = makeApp();
      const res = await request(app)
        .put('/api/features/branding')
        .send({ company_name: 'Acme', primary_color: '#0ea5e9' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockUpsertBranding).toHaveBeenCalledWith('user_test_1', 'ws_test_1', {
        company_name: 'Acme',
        logo_url: undefined,
        logo_base64: undefined,
        primary_color: '#0ea5e9',
        accent_color: undefined,
        footer_text: undefined,
      });
    });
  });
});
