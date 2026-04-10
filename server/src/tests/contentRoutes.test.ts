import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCallAIProvider = vi.fn();
const mockAuthTier = vi.hoisted(() => ({ value: 'alignment' as string }));

vi.mock('../middleware/authRequired.js', () => ({
  authRequired: (req: any, _res: any, next: any) => {
    req.user = { id: 'user_1', tier: mockAuthTier.value };
    next();
  },
}));

vi.mock('../middleware/usageGate.js', () => ({
  usageGate: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../services/aiProviders.js', () => ({
  callAIProvider: (...args: unknown[]) => mockCallAIProvider(...args),
  PROVIDERS: [{ provider: 'openrouter', model: 'gpt-5-nano' }],
}));

import contentRoutes from '../routes/contentRoutes.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/content', contentRoutes);
  return app;
}

describe('POST /api/content/generate-fix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthTier.value = 'alignment';
    process.env.OPENROUTER_API_KEY = 'test-key';
  });

  it('returns 403 for observer tier', async () => {
    mockAuthTier.value = 'observer';
    const app = makeApp();

    const res = await request(app)
      .post('/api/content/generate-fix')
      .send({ action: { title: 'Add H1' } });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('TIER_INSUFFICIENT');
  });

  it('returns 400 when action.title is missing', async () => {
    const app = makeApp();

    const res = await request(app)
      .post('/api/content/generate-fix')
      .send({ action: {} });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/title.*required/i);
  });

  it('returns 400 when action is missing entirely', async () => {
    const app = makeApp();

    const res = await request(app)
      .post('/api/content/generate-fix')
      .send({});

    expect(res.status).toBe(400);
  });

  it('generates a content fix for a schema category', async () => {
    mockCallAIProvider.mockResolvedValue(
      '<script type="application/ld+json">{"@type":"FAQPage"}</script>\n\nExplanation: This adds a FAQPage schema block.',
    );

    const app = makeApp();

    const res = await request(app)
      .post('/api/content/generate-fix')
      .send({
        action: { title: 'Add FAQPage Schema', category: 'schema', impact: 'medium' },
        context: { url: 'https://example.com', pageTitle: 'Example' },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.format).toBe('json-ld');
    expect(res.body.fix).toContain('FAQPage');
    expect(res.body.explanation).toContain('FAQPage');
    expect(res.body.category).toBe('schema');
  });

  it('generates markdown for a content category', async () => {
    mockCallAIProvider.mockResolvedValue(
      '## What is AI Visibility?\n\nAI visibility measures how...\n\nExplanation: This expands content depth.',
    );

    const app = makeApp();

    const res = await request(app)
      .post('/api/content/generate-fix')
      .send({
        action: { title: 'Increase Content Length', category: 'content', impact: 'high' },
      });

    expect(res.status).toBe(200);
    expect(res.body.format).toBe('markdown');
    expect(res.body.fix).toContain('AI Visibility');
    expect(res.body.explanation).toContain('content depth');
  });

  it('generates text for a technical category', async () => {
    mockCallAIProvider.mockResolvedValue(
      'Cache-Control: public, max-age=86400\n\nExplanation: This adds browser caching headers.',
    );

    const app = makeApp();

    const res = await request(app)
      .post('/api/content/generate-fix')
      .send({
        action: { title: 'Add Cache Headers', category: 'technical', impact: 'low' },
      });

    expect(res.status).toBe(200);
    expect(res.body.format).toBe('text');
    expect(res.body.fix).toContain('Cache-Control');
  });

  it('returns default explanation when AI does not include one', async () => {
    mockCallAIProvider.mockResolvedValue('<script>some fix</script>');

    const app = makeApp();

    const res = await request(app)
      .post('/api/content/generate-fix')
      .send({
        action: { title: 'Add Schema', category: 'schema' },
      });

    expect(res.status).toBe(200);
    expect(res.body.explanation).toContain('AI visibility');
  });

  it('returns 500 when AI provider call fails', async () => {
    mockCallAIProvider.mockRejectedValue(new Error('provider down'));

    const app = makeApp();

    const res = await request(app)
      .post('/api/content/generate-fix')
      .send({ action: { title: 'Fix something' } });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  it('allows signal and scorefix tiers', async () => {
    mockCallAIProvider.mockResolvedValue('Fix content\n\nExplanation: done');
    const app = makeApp();

    for (const tier of ['signal', 'scorefix']) {
      mockAuthTier.value = tier;
      const res = await request(app)
        .post('/api/content/generate-fix')
        .send({ action: { title: 'Add H1' } });
      expect(res.status).toBe(200);
    }
  });
});
