import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/* ── Hoisted shared state ─────────────────────────────────────────────────── */

const authState = vi.hoisted(() => ({
  userId: 'user_nd_1',
  tier: 'alignment' as string,
  workspaceId: 'ws_nd_1',
}));

const mockRunDiscovery = vi.fn();
const mockListJobs = vi.fn();
const mockGetJob = vi.fn();
const mockAddDiscoveredToSchedule = vi.fn();

/* ── Mocks ────────────────────────────────────────────────────────────────── */

vi.mock('../middleware/authRequired.js', () => ({
  authRequired: (req: any, _res: any, next: any) => {
    req.user = { id: authState.userId, tier: authState.tier };
    next();
  },
}));

vi.mock('../middleware/workspaceRequired.js', () => ({
  workspaceRequired: (req: any, _res: any, next: any) => {
    req.workspace = { id: authState.workspaceId };
    next();
  },
}));

vi.mock('../services/postgresql.js', () => ({
  getPool: () => ({ query: vi.fn().mockResolvedValue({ rows: [] }) }),
  dbConfigured: () => true,
}));

vi.mock('../services/nicheDiscoveryService.js', () => ({
  runDiscovery: (...args: unknown[]) => mockRunDiscovery(...args),
  listJobs: (...args: unknown[]) => mockListJobs(...args),
  getJob: (...args: unknown[]) => mockGetJob(...args),
  addDiscoveredToSchedule: (...args: unknown[]) => mockAddDiscoveredToSchedule(...args),
  NICHE_DISCOVERY_MIGRATION: '',
}));

vi.mock('../services/scheduledRescanService.js', () => ({
  createScheduledRescan: vi.fn(),
  getScheduledRescans: vi.fn().mockResolvedValue([]),
  updateScheduledRescan: vi.fn(),
  deleteScheduledRescan: vi.fn(),
}));

vi.mock('../services/deployVerificationService.js', () => ({
  createDeployVerificationJob: vi.fn(),
  listDeployVerificationJobs: vi.fn().mockResolvedValue([]),
  updateDeployVerificationJob: vi.fn(),
}));

vi.mock('../services/deployHookService.js', () => ({
  createDeployHookEndpoint: vi.fn(),
  deleteDeployHookEndpoint: vi.fn(),
  listDeployHookEndpoints: vi.fn().mockResolvedValue([]),
  updateDeployHookEndpoint: vi.fn(),
}));

vi.mock('../services/apiKeyService.js', () => ({
  createApiKey: vi.fn(),
  listApiKeys: vi.fn().mockResolvedValue([]),
  revokeApiKey: vi.fn(),
  toggleApiKey: vi.fn(),
  validateApiKey: vi.fn(),
}));

vi.mock('../services/webhookService.js', () => ({
  createWebhook: vi.fn(),
  listWebhooks: vi.fn().mockResolvedValue([]),
  deleteWebhook: vi.fn(),
  toggleWebhook: vi.fn(),
  testWebhook: vi.fn(),
  updateWebhook: vi.fn(),
  getWebhookIntegrationCatalog: vi.fn().mockReturnValue([]),
}));

vi.mock('../services/brandingService.js', () => ({
  getBranding: vi.fn().mockResolvedValue(null),
  upsertBranding: vi.fn(),
  deleteBranding: vi.fn(),
}));

vi.mock('../services/reportPdfService.js', () => ({
  renderPdfFromHtml: vi.fn(),
}));

vi.mock('../services/reportDeliveryService.js', () => ({
  createReportDelivery: vi.fn(),
  deleteReportDelivery: vi.fn(),
  listReportDeliveries: vi.fn().mockResolvedValue([]),
  updateReportDelivery: vi.fn(),
}));

vi.mock('../services/scanPackCredits.js', () => ({
  consumePackCredits: vi.fn(),
  getAvailablePackCredits: vi.fn().mockResolvedValue(0),
}));

vi.mock('../services/notificationService.js', () => ({
  getUnreadNotificationCount: vi.fn().mockResolvedValue(0),
  listNotificationsForUser: vi.fn().mockResolvedValue([]),
  markAllNotificationsReadForUser: vi.fn(),
  markNotificationReadForUser: vi.fn(),
  getNotificationPreferences: vi.fn().mockResolvedValue({}),
  upsertNotificationPreferences: vi.fn(),
  NOTIFICATION_CATEGORIES: [],
}));

vi.mock('../services/scheduledPlatformNotifications.js', () => ({
  cancelScheduledPlatformNotification: vi.fn(),
  listScheduledPlatformNotifications: vi.fn().mockResolvedValue([]),
  publishPlatformNotificationImmediate: vi.fn(),
  publishScheduledPlatformNotificationNow: vi.fn(),
  schedulePlatformNotification: vi.fn(),
}));

vi.mock('../services/sseHub.js', () => ({
  addClient: vi.fn(),
}));

vi.mock('../lib/utils/jwt.js', () => ({
  verifyUserToken: vi.fn(),
}));

vi.mock('../models/User.js', () => ({
  getUserById: vi.fn(),
}));

vi.mock('../services/googleMeasurement.js', () => ({
  isGoogleMeasurementConfigured: vi.fn().mockReturnValue(false),
  isValidMeasurementEventName: vi.fn().mockReturnValue(true),
  sendMeasurementEvent: vi.fn(),
}));

vi.mock('../services/privateExposureScanService.js', () => ({
  runPrivateExposureScan: vi.fn(),
}));

vi.mock('../services/auditTruthService.js', () => ({
  listAuditTruthHistory: vi.fn().mockResolvedValue([]),
}));

vi.mock('../services/milestoneService.js', () => ({
  getUserMilestones: vi.fn().mockResolvedValue([]),
  getNextMilestones: vi.fn().mockResolvedValue([]),
}));

vi.mock('../services/toolCreditGate.js', () => ({
  getToolUsageSummary: vi.fn().mockResolvedValue({}),
  gateToolAction: vi.fn().mockResolvedValue({ allowed: true }),
}));

/* ── Import routes AFTER mocks ────────────────────────────────────────────── */

import featureRoutes from '../routes/featureRoutes.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/features', featureRoutes);
  return app;
}

/* ── Tests ─────────────────────────────────────────────────────────────────── */

describe('Niche Discovery Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.userId = 'user_nd_1';
    authState.tier = 'alignment';
    authState.workspaceId = 'ws_nd_1';
  });

  describe('tier gating', () => {
    it('blocks observer (no scheduled rescans feature)', async () => {
      authState.tier = 'observer';
      const app = makeApp();
      const res = await request(app)
        .post('/api/features/niche-discovery')
        .send({ query: 'plumbers in Austin' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('allows alignment tier', async () => {
      mockRunDiscovery.mockResolvedValueOnce({
        id: 'job_1',
        status: 'completed',
        discovered_urls: [
          { url: 'https://example-plumber.com', name: 'Example Plumber', valid: true, duplicate: false },
        ],
      });

      const app = makeApp();
      const res = await request(app)
        .post('/api/features/niche-discovery')
        .send({ query: 'plumbers in Austin', location: 'Austin TX' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.job.discovered_urls).toHaveLength(1);
    });
  });

  describe('POST /api/features/niche-discovery', () => {
    it('requires query parameter', async () => {
      const app = makeApp();
      const res = await request(app)
        .post('/api/features/niche-discovery')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('query is required');
    });

    it('rejects overly long query', async () => {
      const app = makeApp();
      const res = await request(app)
        .post('/api/features/niche-discovery')
        .send({ query: 'x'.repeat(201) });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('200 characters');
    });

    it('passes workspace context to runDiscovery', async () => {
      mockRunDiscovery.mockResolvedValueOnce({
        id: 'job_2',
        status: 'completed',
        discovered_urls: [],
      });

      const app = makeApp();
      await request(app)
        .post('/api/features/niche-discovery')
        .send({ query: 'dentists', location: 'NYC' });

      expect(mockRunDiscovery).toHaveBeenCalledWith(
        'user_nd_1',
        'ws_nd_1',
        'dentists',
        'NYC',
      );
    });

    it('returns 422 when discovery finds no URLs', async () => {
      mockRunDiscovery.mockResolvedValueOnce({
        id: 'job_3',
        status: 'failed',
        error: 'No business URLs found. Try broadening the niche.',
      });

      const app = makeApp();
      const res = await request(app)
        .post('/api/features/niche-discovery')
        .send({ query: 'obscure niche' });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('No business URLs found');
    });

    it('handles service crash gracefully', async () => {
      mockRunDiscovery.mockRejectedValueOnce(new Error('DB connection lost'));

      const app = makeApp();
      const res = await request(app)
        .post('/api/features/niche-discovery')
        .send({ query: 'lawyers' });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/features/niche-discovery', () => {
    it('lists past discovery jobs', async () => {
      mockListJobs.mockResolvedValueOnce([
        { id: 'job_1', query: 'plumbers', status: 'completed' },
      ]);

      const app = makeApp();
      const res = await request(app).get('/api/features/niche-discovery');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.jobs).toHaveLength(1);
      expect(mockListJobs).toHaveBeenCalledWith('user_nd_1', 'ws_nd_1', 20);
    });
  });

  describe('GET /api/features/niche-discovery/:id', () => {
    it('returns a specific job', async () => {
      mockGetJob.mockResolvedValueOnce({
        id: 'job_1',
        status: 'completed',
        discovered_urls: [],
      });

      const app = makeApp();
      const res = await request(app).get('/api/features/niche-discovery/job_1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 404 for missing job', async () => {
      mockGetJob.mockResolvedValueOnce(null);

      const app = makeApp();
      const res = await request(app).get('/api/features/niche-discovery/nonexistent');

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/features/niche-discovery/:id/schedule', () => {
    it('rejects empty urls array', async () => {
      const app = makeApp();
      const res = await request(app)
        .post('/api/features/niche-discovery/job_1/schedule')
        .send({ urls: [] });

      expect(res.status).toBe(400);
    });

    it('schedules selected URLs', async () => {
      mockAddDiscoveredToSchedule.mockResolvedValueOnce({
        scheduled: 2,
        skipped: 0,
      });

      const app = makeApp();
      const res = await request(app)
        .post('/api/features/niche-discovery/job_1/schedule')
        .send({
          urls: ['https://example.com', 'https://test.com'],
          frequency: 'weekly',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockAddDiscoveredToSchedule).toHaveBeenCalledWith(
        'user_nd_1',
        'ws_nd_1',
        'job_1',
        ['https://example.com', 'https://test.com'],
        'weekly',
      );
    });
  });
});
