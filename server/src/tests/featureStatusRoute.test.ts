import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetScheduledRescans = vi.fn();
const mockListDeployVerificationJobs = vi.fn();
const mockListApiKeys = vi.fn();
const mockListWebhooks = vi.fn();
const mockListReportDeliveries = vi.fn();
const mockUsageQuery = vi.fn();
const mockGetUnreadNotificationCount = vi.fn();
const mockGetUserMilestones = vi.fn();
const mockGetNextMilestones = vi.fn();
const mockGetToolUsageSummary = vi.fn();

const mockUserTier = vi.hoisted(() => ({ value: 'signal' as string }));

vi.mock('../middleware/authRequired.js', () => ({
  authRequired: (req: any, _res: any, next: any) => {
    req.user = { id: 'user_123', tier: mockUserTier.value };
    next();
  },
}));

vi.mock('../middleware/workspaceRequired.js', () => ({
  workspaceRequired: (req: any, _res: any, next: any) => {
    req.workspace = { id: 'ws_123' };
    next();
  },
}));

vi.mock('../services/scheduledRescanService.js', () => ({
  createScheduledRescan: vi.fn(),
  getScheduledRescans: (...args: unknown[]) => mockGetScheduledRescans(...args),
  updateScheduledRescan: vi.fn(),
  deleteScheduledRescan: vi.fn(),
}));

vi.mock('../services/deployVerificationService.js', () => ({
  createDeployVerificationJob: vi.fn(),
  listDeployVerificationJobs: (...args: unknown[]) => mockListDeployVerificationJobs(...args),
  updateDeployVerificationJob: vi.fn(),
}));

vi.mock('../services/deployHookService.js', () => ({
  createDeployHookEndpoint: vi.fn(),
  deleteDeployHookEndpoint: vi.fn(),
  listDeployHookEndpoints: vi.fn(),
  updateDeployHookEndpoint: vi.fn(),
}));

vi.mock('../services/apiKeyService.js', () => ({
  createApiKey: vi.fn(),
  listApiKeys: (...args: unknown[]) => mockListApiKeys(...args),
  revokeApiKey: vi.fn(),
  toggleApiKey: vi.fn(),
}));

vi.mock('../services/webhookService.js', () => ({
  createWebhook: vi.fn(),
  listWebhooks: (...args: unknown[]) => mockListWebhooks(...args),
  deleteWebhook: vi.fn(),
  toggleWebhook: vi.fn(),
  testWebhook: vi.fn(),
  updateWebhook: vi.fn(),
  getWebhookIntegrationCatalog: vi.fn(),
}));

vi.mock('../services/brandingService.js', () => ({
  getBranding: vi.fn(),
  upsertBranding: vi.fn(),
  deleteBranding: vi.fn(),
}));

vi.mock('../services/reportDeliveryService.js', () => ({
  createReportDelivery: vi.fn(),
  deleteReportDelivery: vi.fn(),
  listReportDeliveries: (...args: unknown[]) => mockListReportDeliveries(...args),
  updateReportDelivery: vi.fn(),
}));

vi.mock('../services/reportPdfService.js', () => ({
  renderPdfFromHtml: vi.fn(),
}));

vi.mock('../services/notificationService.js', () => ({
  getUnreadNotificationCount: (...args: unknown[]) => mockGetUnreadNotificationCount(...args),
  listNotificationsForUser: vi.fn(),
  markAllNotificationsReadForUser: vi.fn(),
  markNotificationReadForUser: vi.fn(),
}));

vi.mock('../services/scheduledPlatformNotifications.js', () => ({
  cancelScheduledPlatformNotification: vi.fn(),
  listScheduledPlatformNotifications: vi.fn(),
  publishPlatformNotificationImmediate: vi.fn(),
  publishScheduledPlatformNotificationNow: vi.fn(),
  schedulePlatformNotification: vi.fn(),
}));

vi.mock('../services/nicheDiscoveryService.js', () => ({
  runDiscovery: vi.fn(),
  addDiscoveredToSchedule: vi.fn(),
  getJob: vi.fn(),
  listJobs: vi.fn(),
}));

vi.mock('../services/scanPackCredits.js', () => ({
  consumePackCredits: vi.fn(),
  getAvailablePackCredits: vi.fn(),
}));

vi.mock('../services/sseHub.js', () => ({
  addClient: vi.fn(),
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
  listAuditTruthHistory: vi.fn(),
}));

vi.mock('../services/milestoneService.js', () => ({
  getUserMilestones: (...args: unknown[]) => mockGetUserMilestones(...args),
  getNextMilestones: (...args: unknown[]) => mockGetNextMilestones(...args),
}));

vi.mock('../services/toolCreditGate.js', () => ({
  getToolUsageSummary: (...args: unknown[]) => mockGetToolUsageSummary(...args),
}));

vi.mock('../lib/urlSafety.js', () => ({
  normalizePublicHttpUrl: vi.fn().mockReturnValue({ ok: true, normalized: 'https://example.com' }),
}));

vi.mock('../lib/utils/jwt.js', () => ({
  verifyUserToken: vi.fn(),
}));

vi.mock('../models/User.js', () => ({
  getUserById: vi.fn(),
}));

vi.mock('../middleware/usageEnforcement.js', () => ({
  enforceFeature: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../services/postgresql.js', () => ({
  dbConfigured: true,
  getPool: () => ({
    query: (...args: unknown[]) => mockUsageQuery(...args),
  }),
}));

import featureRoutes from '../routes/featureRoutes.js';

describe('GET /api/features/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserTier.value = 'signal';
    mockGetUnreadNotificationCount.mockResolvedValue(0);
    mockGetUserMilestones.mockResolvedValue([]);
    mockGetNextMilestones.mockResolvedValue([]);
    mockGetToolUsageSummary.mockResolvedValue(null);
  });

  it('returns live feature availability, counts, and generatedAt for signal tier', async () => {
    mockGetScheduledRescans.mockResolvedValue([{ id: 'r1' }, { id: 'r2' }]);
    mockListDeployVerificationJobs.mockResolvedValue([{ id: 'd1' }]);
    mockListApiKeys.mockResolvedValue([{ id: 'k1' }]);
    mockListWebhooks.mockResolvedValue([{ id: 'w1' }, { id: 'w2' }]);
    mockListReportDeliveries.mockResolvedValue([]);
    mockUsageQuery
      .mockResolvedValueOnce({ rows: [{ total_requests: 12 }] })
      .mockResolvedValueOnce({ rows: [{ credits_remaining: 9 }] })
      .mockResolvedValueOnce({ rows: [{ total_earned: 25 }] })
      .mockResolvedValueOnce({ rows: [{ trial_ends_at: null, trial_used: false }] });

    const app = express();
    app.use(express.json());
    app.use('/api/features', featureRoutes);

    const res = await request(app).get('/api/features/status');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.generatedAt).toBe('string');
    expect(res.body.data.tier).toBe('signal');
    expect(res.body.data.capabilities).toEqual({
      pagesPerScan: 15,
      competitors: 8,
      hasExports: true,
      hasReportHistory: true,
      hasApiAccess: true,
      hasScheduledRescans: true,
      hasShareableLink: true,
    });
    expect(res.body.data.usage).toEqual({
      monthlyLimit: 110,
      usedThisMonth: 12,
      remainingThisMonth: 98,
    });
    expect(res.body.data.credits).toEqual({
      packCreditsRemaining: 9,
      referralCreditsEarnedTotal: 25,
      totalAuditCreditsAvailable: 107,
    });
    expect(res.body.data.features.scheduledRescans).toEqual(
      expect.objectContaining({ available: true, count: 2 }),
    );
    expect(res.body.data.features.apiAccess).toEqual(
      expect.objectContaining({ available: true, keyCount: 1 }),
    );
    expect(res.body.data.features.webhooks).toEqual(
      expect.objectContaining({ available: true, count: 2 }),
    );

    expect(mockGetScheduledRescans).toHaveBeenCalledWith('user_123', 'ws_123');
    expect(mockListApiKeys).toHaveBeenCalledWith('user_123', 'ws_123');
    expect(mockListWebhooks).toHaveBeenCalledWith('user_123', 'ws_123');
  });

  it('returns unavailable state for observer tier without calling feature services', async () => {
    mockUserTier.value = 'observer';
    mockUsageQuery
      .mockResolvedValueOnce({ rows: [{ total_requests: 3 }] })
      .mockResolvedValueOnce({ rows: [{ credits_remaining: 0 }] })
      .mockResolvedValueOnce({ rows: [{ total_earned: 0 }] })
      .mockResolvedValueOnce({ rows: [{ trial_ends_at: null, trial_used: false }] });

    const app = express();
    app.use(express.json());
    app.use('/api/features', featureRoutes);

    const res = await request(app).get('/api/features/status');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tier).toBe('observer');
    expect(res.body.data.capabilities).toEqual({
      pagesPerScan: 1,
      competitors: 0,
      hasExports: false,
      hasReportHistory: true,
      hasApiAccess: false,
      hasScheduledRescans: false,
      hasShareableLink: true,
    });
    expect(res.body.data.usage).toEqual({
      monthlyLimit: 10,
      usedThisMonth: 3,
      remainingThisMonth: 7,
    });
    expect(res.body.data.credits).toEqual({
      packCreditsRemaining: 0,
      referralCreditsEarnedTotal: 0,
      totalAuditCreditsAvailable: 7,
    });
    expect(res.body.data.features.scheduledRescans).toEqual(
      expect.objectContaining({ available: false, count: 0 }),
    );
    expect(res.body.data.features.apiAccess).toEqual(
      expect.objectContaining({ available: false, keyCount: 0 }),
    );
    expect(res.body.data.features.webhooks).toEqual(
      expect.objectContaining({ available: false, count: 0 }),
    );

    expect(mockGetScheduledRescans).not.toHaveBeenCalled();
    expect(mockListApiKeys).not.toHaveBeenCalled();
    expect(mockListWebhooks).not.toHaveBeenCalled();
  });
});
