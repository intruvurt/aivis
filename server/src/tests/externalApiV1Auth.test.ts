import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockValidateApiKey = vi.fn();
const mockUsageQuery = vi.fn();

vi.mock('../services/apiKeyService.js', () => ({
  validateApiKey: (...args: unknown[]) => mockValidateApiKey(...args),
}));

vi.mock('../services/postgresql.js', () => ({
  getPool: () => ({
    query: (...args: unknown[]) => mockUsageQuery(...args),
  }),
}));

import externalApiV1 from '../routes/externalApiV1.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1', externalApiV1);
  return app;
}

describe('externalApiV1 auth behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when authorization header is missing', async () => {
    const app = makeApp();

    const res = await request(app).get('/api/v1/usage');

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_API_KEY');
  });

  it('returns 403 with FEATURE_LOCKED when key tier is blocked', async () => {
    mockValidateApiKey.mockResolvedValue({ ok: false, reason: 'tier_blocked' });

    const app = makeApp();
    const res = await request(app)
      .get('/api/v1/usage')
      .set('Authorization', 'Bearer avis_blocked_key');

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FEATURE_LOCKED');
  });

  it('returns 401 API_KEY_EXPIRED when key is expired', async () => {
    mockValidateApiKey.mockResolvedValue({ ok: false, reason: 'expired' });

    const app = makeApp();
    const res = await request(app)
      .get('/api/v1/usage')
      .set('Authorization', 'Bearer avis_expired_key');

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('API_KEY_EXPIRED');
  });

  it('allows valid key and returns usage payload', async () => {
    mockValidateApiKey.mockResolvedValue({
      ok: true,
      keyId: 'key_1',
      userId: 'user_1',
      workspaceId: 'ws_1',
      scopes: ['read:audits', 'read:analytics'],
    });

    mockUsageQuery
      .mockResolvedValueOnce({ rows: [{ total: 5 }] })
      .mockResolvedValueOnce({ rows: [{ total: 12 }] })
      .mockResolvedValue({ rows: [] });

    const app = makeApp();
    const res = await request(app)
      .get('/api/v1/usage')
      .set('Authorization', 'Bearer avis_valid_key');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.apiKeyRequestsThisMonth).toBe(5);
    expect(res.body.data.workspaceRequestsThisMonth).toBe(12);
  });
});
