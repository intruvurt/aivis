import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/* ── Hoisted shared state ─────────────────────────────────────────────────── */

const authState = vi.hoisted(() => ({
  userId: 'user_cite_1',
  tier: 'signal' as string,
}));

const mockQuery = vi.fn();
const mockGenerateQueries = vi.fn();
const mockPrioritizeQueries = vi.fn();
const mockTestMultipleQueries = vi.fn();
const mockCalculateCitationSummary = vi.fn();
const mockComputeCitationRankScore = vi.fn();

/* ── Mocks ────────────────────────────────────────────────────────────────── */

vi.mock('../middleware/authRequired.js', () => ({
  authRequired: (req: any, _res: any, next: any) => {
    req.user = { id: authState.userId, tier: authState.tier };
    next();
  },
}));

vi.mock('../services/postgresql.js', () => ({
  getPool: () => ({ query: mockQuery }),
  dbConfigured: () => true,
}));

vi.mock('../services/queryGenerator.js', () => ({
  generateQueries: (...args: unknown[]) => mockGenerateQueries(...args),
  prioritizeQueries: (...args: unknown[]) => mockPrioritizeQueries(...args),
}));

vi.mock('../services/citationTester.js', () => ({
  testMultipleQueries: (...args: unknown[]) => mockTestMultipleQueries(...args),
  calculateCitationSummary: (...args: unknown[]) => mockCalculateCitationSummary(...args),
  buildCitationPrompt: vi.fn().mockReturnValue('test prompt'),
}));

vi.mock('../services/toolCreditGate.js', () => ({
  gateToolAction: vi.fn().mockResolvedValue({
    allowed: true,
    creditCost: 0,
    creditsRemaining: 10,
    freeUsesRemaining: 5,
    reason: '',
  }),
}));

vi.mock('../services/milestoneService.js', () => ({
  checkCitationMilestones: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../services/citationRankingEngine.js', () => ({
  runNicheRanking: vi.fn(),
  getNicheRankingById: vi.fn(),
  getLatestNicheRanking: vi.fn(),
  listNicheRankings: vi.fn(),
}));

vi.mock('../services/citationScheduler.js', () => ({
  createScheduledJob: vi.fn(),
  listScheduledJobs: vi.fn(),
  getScheduledJob: vi.fn(),
  toggleScheduledJob: vi.fn(),
  deleteScheduledJob: vi.fn(),
  updateScheduledJobInterval: vi.fn(),
}));

vi.mock('../services/citationIntelligenceService.js', () => ({
  getMentionTrendHistory: vi.fn(),
  aggregateCompetitorShare: vi.fn(),
  buildConsistencyMatrix: vi.fn(),
  detectAndStoreDropAlert: vi.fn(),
  checkAndStoreCoOccurrences: vi.fn(),
  getStoredCoOccurrences: vi.fn(),
  recordMentionTrendSnapshot: vi.fn(),
  computeMentionQuality: vi.fn(),
}));

vi.mock('../services/citationRankScoreService.js', () => ({
  computeCitationRankScore: (...args: unknown[]) => mockComputeCitationRankScore(...args),
  saveCitationRankSnapshot: vi.fn().mockResolvedValue(undefined),
  getLatestCitationRankSnapshot: vi.fn(),
  getCitationRankHistory: vi.fn(),
}));

vi.mock('../services/webSearch.js', () => ({
  scrapeBingRaw: vi.fn().mockResolvedValue([]),
}));

vi.mock('../services/platformDirectSearch.js', () => ({
  hasDirectApi: vi.fn().mockReturnValue(false),
  searchPlatformDirect: vi.fn().mockResolvedValue([]),
}));

/* ── Import routes AFTER mocks ────────────────────────────────────────────── */

import citationRoutes from '../routes/citations.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/citations', citationRoutes);
  return app;
}

/* ── Tests ─────────────────────────────────────────────────────────────────── */

describe('Citation Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.userId = 'user_cite_1';
    authState.tier = 'signal';
    // Default: mock environment with API key
    process.env.OPENROUTER_API_KEY = 'test-key-for-citations';
    // Default: all pool.query calls return empty rows
    mockQuery.mockResolvedValue({ rows: [] });
  });

  describe('tier gating', () => {
    it('blocks observer from generate-queries with 403', async () => {
      authState.tier = 'observer';
      const app = makeApp();
      const res = await request(app)
        .post('/api/citations/generate-queries')
        .send({ url: 'https://example.com' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('TIER_INSUFFICIENT');
    });

    it('allows alignment tier to generate-queries', async () => {
      authState.tier = 'alignment';
      mockGenerateQueries.mockResolvedValueOnce({
        queries: ['best CRM software 2025', 'how to choose a CRM'],
        industry: 'software',
        topics: ['CRM', 'software'],
      });
      mockPrioritizeQueries.mockReturnValueOnce([
        'best CRM software 2025',
        'how to choose a CRM',
      ]);

      const app = makeApp();
      const res = await request(app)
        .post('/api/citations/generate-queries')
        .send({ url: 'https://example.com' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('allows signal tier to generate-queries', async () => {
      mockGenerateQueries.mockResolvedValueOnce({
        queries: ['best CRM software 2025', 'how to choose a CRM'],
        industry: 'software',
        topics: ['CRM', 'software'],
      });
      mockPrioritizeQueries.mockReturnValueOnce([
        'best CRM software 2025',
        'how to choose a CRM',
      ]);

      const app = makeApp();
      const res = await request(app)
        .post('/api/citations/generate-queries')
        .send({ url: 'https://example.com' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.queries)).toBe(true);
    });

    it('blocks observer from citation tests', async () => {
      authState.tier = 'observer';
      const app = makeApp();
      const res = await request(app)
        .get('/api/citations/tests');

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('TIER_INSUFFICIENT');
    });
  });

  describe('POST /api/citations/generate-queries', () => {
    it('requires URL in body', async () => {
      const app = makeApp();
      const res = await request(app)
        .post('/api/citations/generate-queries')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('URL');
    });

    it('returns 500 when API key is missing', async () => {
      delete process.env.OPENROUTER_API_KEY;
      delete process.env.OPEN_ROUTER_API_KEY;

      const app = makeApp();
      const res = await request(app)
        .post('/api/citations/generate-queries')
        .send({ url: 'https://example.com' });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain('AI provider key not configured');
    });

    it('handles AI generation failure gracefully', async () => {
      mockGenerateQueries.mockRejectedValueOnce(new Error('OpenRouter rate limited'));

      const app = makeApp();
      const res = await request(app)
        .post('/api/citations/generate-queries')
        .send({ url: 'https://example.com' });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain('generate');
    });
  });

  describe('POST /api/citations/test (startCitationTest)', () => {
    it('requires URL and queries', async () => {
      const app = makeApp();
      const res = await request(app)
        .post('/api/citations/test')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('URL and queries');
    });

    it('creates citation test successfully', async () => {
      // Mock: gateToolAction (already mocked globally)
      // Mock: monthly usage check then INSERT citation test
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'ct_123' }] });

      const app = makeApp();
      const res = await request(app)
        .post('/api/citations/test')
        .send({
          url: 'https://example.com',
          queries: ['best CRM software', 'how to choose CRM'],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.test_id).toBe('ct_123');
      expect(res.body.status).toBe('pending');
    });

    it('rejects invalid URL', async () => {
      const app = makeApp();
      const res = await request(app)
        .post('/api/citations/test')
        .send({
          url: 'ftp://invalid-protocol.com',
          queries: ['test query'],
        });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/citations/tests (listCitationTests)', () => {
    it('returns test list with pagination', async () => {
      const fakeTests = [
        { id: 'ct_1', url: 'https://example.com', status: 'completed', summary: {}, created_at: '2025-01-01', completed_at: '2025-01-01' },
      ];
      mockQuery
        .mockResolvedValueOnce({ rows: fakeTests }) // list query
        .mockResolvedValueOnce({ rows: [{ total: '1' }] }); // count query

      const app = makeApp();
      const res = await request(app).get('/api/citations/tests');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.tests).toHaveLength(1);
      expect(res.body.total).toBe(1);
    });

    it('handles empty results', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ total: '0' }] });

      const app = makeApp();
      const res = await request(app).get('/api/citations/tests');

      expect(res.status).toBe(200);
      expect(res.body.tests).toHaveLength(0);
      expect(res.body.total).toBe(0);
    });
  });

  describe('GET /api/citations/test/:id', () => {
    it('returns test result', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'ct_1',
          url: 'https://example.com',
          status: 'completed',
          results: [],
          summary: { total_queries: 5, mention_rate: 0.4 },
          created_at: '2025-01-01',
          completed_at: '2025-01-01',
        }],
      });

      const app = makeApp();
      const res = await request(app).get('/api/citations/test/ct_1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 404 for non-existent test', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const app = makeApp();
      const res = await request(app).get('/api/citations/test/nonexistent');

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/citations/rank-score', () => {
    it('auto-generates top20 queries when queries are omitted', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          url: 'https://example.com',
          result: {
            brand_entities: ['Example Brand'],
            topical_keywords: ['citation engine'],
            primary_topics: ['AI visibility'],
            recommendations: [],
            faq_count: 3,
            domain_intelligence: { page_title: 'Example Brand - AI Visibility' },
          },
          created_at: '2026-01-01T00:00:00.000Z',
        }],
      });

      mockGenerateQueries.mockResolvedValueOnce({
        queries: ['example brand ai visibility', 'example brand citation engine'],
        industry: 'ai_visibility',
        topics: ['citations'],
        fallback: false,
      });
      mockPrioritizeQueries.mockReturnValueOnce([
        'example brand ai visibility',
        'example brand citation engine',
      ]);
      mockComputeCitationRankScore.mockResolvedValueOnce({
        score: 61,
        confidence: 0.82,
        tier: 'signal',
      });

      const app = makeApp();
      const res = await request(app)
        .post('/api/citations/rank-score')
        .send({ url: 'https://example.com' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.auto_generated_queries).toBe(true);
      expect(Array.isArray(res.body.top20_queries)).toBe(true);
      expect(res.body.top20_queries.length).toBeGreaterThan(0);
      expect(mockComputeCitationRankScore).toHaveBeenCalledTimes(1);
    });

    it('rejects more than 20 explicitly provided queries', async () => {
      const app = makeApp();
      const tooManyQueries = Array.from({ length: 21 }, (_, i) => `query ${i + 1}`);

      const res = await request(app)
        .post('/api/citations/rank-score')
        .send({
          brand: 'Example Brand',
          url: 'https://example.com',
          queries: tooManyQueries,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Maximum 20 queries');
    });
  });
});
