import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQuery = vi.fn();

vi.mock('../middleware/authRequired.js', () => ({
  authRequired: (req: any, _res: any, next: any) => {
    req.user = { id: 'user_1', tier: 'signal' };
    next();
  },
}));

vi.mock('../middleware/workspaceRequired.js', () => ({
  workspaceRequired: (req: any, _res: any, next: any) => {
    req.workspace = { id: 'ws_1' };
    next();
  },
}));

vi.mock('../services/postgresql.js', () => ({
  getPool: () => ({ query: (...args: unknown[]) => mockQuery(...args) }),
}));

import complianceRoutes from '../routes/complianceRoutes.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/compliance', complianceRoutes);
  return app;
}

describe('Compliance routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/compliance/policy', () => {
    it('returns policy data without auth', async () => {
      const app = makeApp();

      const res = await request(app).get('/api/compliance/policy');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.policyVersion).toBeDefined();
      expect(res.body.data.privacyUrl).toBe('/privacy');
      expect(res.body.data.termsUrl).toBe('/terms');
      expect(res.body.data.consumerPolicy).toBeDefined();
      expect(res.body.data.disclaimer).toBeDefined();
    });
  });

  describe('GET /api/compliance/consent', () => {
    it('returns consent records for authenticated user', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ id: 'c1', consent_type: 'analytics', status: 'accepted' }],
      });

      const app = makeApp();
      const res = await request(app).get('/api/compliance/consent');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].consent_type).toBe('analytics');
    });

    it('returns 500 on DB error', async () => {
      mockQuery.mockRejectedValue(new Error('DB down'));

      const app = makeApp();
      const res = await request(app).get('/api/compliance/consent');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/compliance/consent', () => {
    it('records a valid consent', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ id: 'c1', consent_type: 'analytics', status: 'accepted' }],
      });

      const app = makeApp();
      const res = await request(app)
        .post('/api/compliance/consent')
        .send({ consentType: 'analytics', status: 'accepted' });

      expect(res.status).toBe(201);
      expect(mockQuery).toHaveBeenCalledOnce();
      const sql = String(mockQuery.mock.calls[0][0]);
      expect(sql).toContain('INSERT INTO user_consents');
    });

    it('rejects missing consentType', async () => {
      const app = makeApp();
      const res = await request(app)
        .post('/api/compliance/consent')
        .send({ status: 'accepted' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('consentType');
    });

    it('rejects invalid status', async () => {
      const app = makeApp();
      const res = await request(app)
        .post('/api/compliance/consent')
        .send({ consentType: 'analytics', status: 'maybe' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('status');
    });

    it('rejects unsupported consentType', async () => {
      const app = makeApp();
      const res = await request(app)
        .post('/api/compliance/consent')
        .send({ consentType: 'something_else', status: 'accepted' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('consentType');
    });

    it('accepts all valid consent types', async () => {
      const app = makeApp();
      const validTypes = ['analytics', 'marketing', 'terms', 'privacy', 'consumer_disclaimer'];

      for (const consentType of validTypes) {
        mockQuery.mockResolvedValue({ rows: [{ id: 'c1', consent_type: consentType }] });
        const res = await request(app)
          .post('/api/compliance/consent')
          .send({ consentType, status: 'accepted' });
        expect(res.status).toBe(201);
      }
    });

    it('accepts all valid status values', async () => {
      const app = makeApp();
      for (const status of ['accepted', 'declined', 'revoked']) {
        mockQuery.mockResolvedValue({ rows: [{ id: 'c1' }] });
        const res = await request(app)
          .post('/api/compliance/consent')
          .send({ consentType: 'analytics', status });
        expect(res.status).toBe(201);
      }
    });
  });
});
