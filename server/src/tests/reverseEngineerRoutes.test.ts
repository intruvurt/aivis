import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/* ── Hoisted shared state ─────────────────────────────────────────────────── */

const authState = vi.hoisted(() => ({
  userId: 'user_re_1',
  tier: 'alignment' as string,
}));

const mockDecompileAnswer = vi.fn();
const mockGenerateCompetitorGhost = vi.fn();
const mockAnalyzeModelPreferences = vi.fn();
const mockSimulateVisibility = vi.fn();
const mockRewriteContentVoice = vi.fn();
const mockScrapeWebsite = vi.fn();

/* ── Mocks ────────────────────────────────────────────────────────────────── */

vi.mock('../middleware/authRequired.js', () => ({
  authRequired: (req: any, _res: any, next: any) => {
    req.user = { id: authState.userId, tier: authState.tier };
    next();
  },
}));

vi.mock('../middleware/usageGate.js', () => ({
  usageGate: (_req: any, _res: any, next: any) => next(),
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

vi.mock('./reverseEngineerRoutes.js', () => ({
  decompileAnswer: (...args: unknown[]) => mockDecompileAnswer(...args),
  generateCompetitorGhost: (...args: unknown[]) => mockGenerateCompetitorGhost(...args),
  analyzeModelPreferences: (...args: unknown[]) => mockAnalyzeModelPreferences(...args),
  simulateVisibility: (...args: unknown[]) => mockSimulateVisibility(...args),
  rewriteContentVoice: (...args: unknown[]) => mockRewriteContentVoice(...args),
}));

vi.mock('../services/scraper.js', () => ({
  scrapeWebsite: (...args: unknown[]) => mockScrapeWebsite(...args),
}));

/* ── Import routes AFTER mocks ────────────────────────────────────────────── */

import reverseEngineerApi from '../routes/reverseEngineerApi.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/reverse-engineer', reverseEngineerApi);
  return app;
}

/* ── Tests ─────────────────────────────────────────────────────────────────── */

describe('Reverse Engineer (Prompt Intelligence) Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.userId = 'user_re_1';
    authState.tier = 'alignment';
    process.env.OPENROUTER_API_KEY = 'test-key-for-re';
  });

  describe('tier gating', () => {
    it('blocks observer tier with 403', async () => {
      authState.tier = 'observer';
      const app = makeApp();
      const res = await request(app)
        .post('/api/reverse-engineer/decompile')
        .send({ answer: 'A long enough test answer for decompilation analysis here.' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('TIER_INSUFFICIENT');
    });

    it('allows alignment tier', async () => {
      mockDecompileAnswer.mockResolvedValueOnce({
        sourceTypes: [],
        structuralPatterns: [],
        semanticClusters: [],
      });

      const app = makeApp();
      const res = await request(app)
        .post('/api/reverse-engineer/decompile')
        .send({ answer: 'A long enough test answer for decompilation analysis here.' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('allows signal tier', async () => {
      authState.tier = 'signal';
      mockDecompileAnswer.mockResolvedValueOnce({
        sourceTypes: [],
        structuralPatterns: [],
        semanticClusters: [],
      });

      const app = makeApp();
      const res = await request(app)
        .post('/api/reverse-engineer/decompile')
        .send({ answer: 'A long enough test answer for decompilation analysis here.' });

      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/reverse-engineer/decompile', () => {
    it('rejects answer shorter than 20 chars', async () => {
      const app = makeApp();
      const res = await request(app)
        .post('/api/reverse-engineer/decompile')
        .send({ answer: 'too short' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('min 20 characters');
    });

    it('rejects missing answer', async () => {
      const app = makeApp();
      const res = await request(app)
        .post('/api/reverse-engineer/decompile')
        .send({});

      expect(res.status).toBe(400);
    });

    it('returns decomposition on success', async () => {
      mockDecompileAnswer.mockResolvedValueOnce({
        sourceTypes: [{ type: 'how_to_guide', confidence: 0.9 }],
        structuralPatterns: [{ pattern: 'numbered_list', frequency: 3 }],
        semanticClusters: [{ topic: 'CRM', entities: ['Salesforce'] }],
      });

      const app = makeApp();
      const res = await request(app)
        .post('/api/reverse-engineer/decompile')
        .send({ answer: 'Here is a detailed guide on how to choose the best CRM software for your business...' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.sourceTypes).toHaveLength(1);
    });

    it('handles AI failure gracefully', async () => {
      mockDecompileAnswer.mockRejectedValueOnce(new Error('AI provider key not configured'));

      const app = makeApp();
      const res = await request(app)
        .post('/api/reverse-engineer/decompile')
        .send({ answer: 'A long enough test answer for decompilation analysis here.' });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Analysis failed');
    });
  });

  describe('POST /api/reverse-engineer/ghost', () => {
    it('rejects query shorter than 3 chars', async () => {
      const app = makeApp();
      const res = await request(app)
        .post('/api/reverse-engineer/ghost')
        .send({ query: 'ab' });

      expect(res.status).toBe(400);
    });

    it('generates blueprint on success', async () => {
      mockGenerateCompetitorGhost.mockResolvedValueOnce({
        sections: ['Introduction', 'Features', 'Pricing'],
        schemaRecommendations: ['FAQPage', 'Product'],
      });

      const app = makeApp();
      const res = await request(app)
        .post('/api/reverse-engineer/ghost')
        .send({ query: 'best project management software' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.sections).toBeDefined();
    });
  });

  describe('POST /api/reverse-engineer/model-diff', () => {
    it('compares model preferences', async () => {
      mockAnalyzeModelPreferences.mockResolvedValueOnce({
        models: [
          { model: 'gpt-4', preferences: ['structured data'] },
          { model: 'claude', preferences: ['detailed explanations'] },
        ],
      });

      const app = makeApp();
      const res = await request(app)
        .post('/api/reverse-engineer/model-diff')
        .send({ query: 'best CRM for startups' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/reverse-engineer/simulate', () => {
    it('rejects missing URL', async () => {
      const app = makeApp();
      const res = await request(app)
        .post('/api/reverse-engineer/simulate')
        .send({});

      expect(res.status).toBe(400);
    });

    it('scrapes page and simulates visibility', async () => {
      mockScrapeWebsite.mockResolvedValueOnce({
        title: 'Test Page',
        content: 'Some content',
        html: '<html></html>',
      });
      mockSimulateVisibility.mockResolvedValueOnce({
        currentScore: 65,
        recommendations: ['Add FAQ schema'],
      });

      const app = makeApp();
      const res = await request(app)
        .post('/api/reverse-engineer/simulate')
        .send({ url: 'https://example.com' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.currentScore).toBe(65);
    });
  });

  describe('POST /api/reverse-engineer/rewrite', () => {
    it('rejects content shorter than 30 chars', async () => {
      const app = makeApp();
      const res = await request(app)
        .post('/api/reverse-engineer/rewrite')
        .send({ content: 'too short' });

      expect(res.status).toBe(400);
    });

    it('rewrites content with voice preset', async () => {
      mockRewriteContentVoice.mockResolvedValueOnce({
        rewritten: 'Rewritten content goes here with improvements...',
        changes: ['Added citations', 'Improved structure'],
      });

      const app = makeApp();
      const res = await request(app)
        .post('/api/reverse-engineer/rewrite')
        .send({
          content: 'This is a piece of content that is long enough to meet the minimum character requirement for rewriting.',
          voicePreset: 'authoritative',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('defaults to authoritative preset for invalid choice', async () => {
      mockRewriteContentVoice.mockResolvedValueOnce({ rewritten: 'OK', changes: [] });

      const app = makeApp();
      const res = await request(app)
        .post('/api/reverse-engineer/rewrite')
        .send({
          content: 'This is a piece of content that is long enough to be rewritten by the voice preset system.',
          voicePreset: 'invalid_preset',
        });

      expect(res.status).toBe(200);
      expect(mockRewriteContentVoice).toHaveBeenCalledWith(
        expect.any(String),
        'authoritative',
        undefined,
      );
    });
  });

  describe('credit gating', () => {
    it('blocks when credits exhausted', async () => {
      const { gateToolAction } = await import('../services/toolCreditGate.js');
      (gateToolAction as any).mockResolvedValueOnce({
        allowed: false,
        creditCost: 1,
        creditsRemaining: 0,
        freeUsesRemaining: 0,
        reason: 'Monthly free allowance exhausted. Purchase credits to continue.',
      });

      const app = makeApp();
      const res = await request(app)
        .post('/api/reverse-engineer/decompile')
        .send({ answer: 'A long enough test answer for decompilation analysis here.' });

      expect(res.status).toBe(402);
      expect(res.body.code).toBe('CREDITS_REQUIRED');
    });
  });
});
