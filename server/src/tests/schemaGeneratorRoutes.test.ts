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

import schemaGeneratorRoutes from '../routes/schemaGeneratorRoutes.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/schema-generator', schemaGeneratorRoutes);
  return app;
}

describe('POST /api/schema-generator/generate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthTier.value = 'alignment';
    process.env.OPENROUTER_API_KEY = 'test-key';
  });

  it('returns 403 for observer tier', async () => {
    mockAuthTier.value = 'observer';
    const app = makeApp();

    const res = await request(app)
      .post('/api/schema-generator/generate')
      .send({ url: 'https://example.com' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('TIER_INSUFFICIENT');
  });

  it('returns 400 when url is missing', async () => {
    const app = makeApp();

    const res = await request(app)
      .post('/api/schema-generator/generate')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/url.*required/i);
  });

  it('returns Organization + WebPage schemas without AI when no recommendations', async () => {
    const app = makeApp();

    const res = await request(app)
      .post('/api/schema-generator/generate')
      .send({
        url: 'https://example.com',
        pageTitle: 'Example Site',
        description: 'A test site',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.schemas.organization['@type']).toBe('Organization');
    expect(res.body.schemas.organization.name).toBe('Example Site');
    expect(res.body.schemas.webPage['@type']).toBe('WebPage');
    expect(res.body.schemas.webPage.url).toBe('https://example.com');
    expect(res.body.schemas.faqPage).toBeUndefined();
    expect(mockCallAIProvider).not.toHaveBeenCalled();
  });

  it('generates FAQPage schema via AI when recommendations are provided', async () => {
    const faqJson = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        { '@type': 'Question', name: 'Why add an H1?', acceptedAnswer: { '@type': 'Answer', text: 'H1 helps AI systems.' } },
        { '@type': 'Question', name: 'Why expand content?', acceptedAnswer: { '@type': 'Answer', text: 'More content improves citation.' } },
      ],
    });
    mockCallAIProvider.mockResolvedValue(faqJson);

    const app = makeApp();

    const res = await request(app)
      .post('/api/schema-generator/generate')
      .send({
        url: 'https://example.com',
        pageTitle: 'Example',
        recommendations: ['Add H1 heading', 'Expand content depth'],
      });

    expect(res.status).toBe(200);
    expect(res.body.schemas.faqPage).toBeDefined();
    expect(res.body.schemas.faqPage['@type']).toBe('FAQPage');
    expect(mockCallAIProvider).toHaveBeenCalledOnce();
  });

  it('returns schemas without FAQ when AI call fails (graceful degradation)', async () => {
    mockCallAIProvider.mockRejectedValue(new Error('AI timeout'));

    const app = makeApp();

    const res = await request(app)
      .post('/api/schema-generator/generate')
      .send({
        url: 'https://example.com',
        recommendations: ['Add H1 heading', 'Expand content depth'],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.schemas.organization).toBeDefined();
    expect(res.body.schemas.webPage).toBeDefined();
    expect(res.body.schemas.faqPage).toBeUndefined();
  });

  it('allows signal tier users', async () => {
    mockAuthTier.value = 'signal';
    const app = makeApp();

    const res = await request(app)
      .post('/api/schema-generator/generate')
      .send({ url: 'https://example.com' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('allows scorefix tier users', async () => {
    mockAuthTier.value = 'scorefix';
    const app = makeApp();

    const res = await request(app)
      .post('/api/schema-generator/generate')
      .send({ url: 'https://example.com' });

    expect(res.status).toBe(200);
  });

  it('includes topics as keywords in WebPage schema', async () => {
    const app = makeApp();

    const res = await request(app)
      .post('/api/schema-generator/generate')
      .send({
        url: 'https://example.com',
        topics: ['AI visibility', 'SEO', 'schema markup'],
      });

    expect(res.status).toBe(200);
    expect(res.body.schemas.webPage.keywords).toContain('AI visibility');
    expect(res.body.schemas.webPage.keywords).toContain('SEO');
  });
});
