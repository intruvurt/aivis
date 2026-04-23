import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();

// ── Basic middleware ─────────────────────────────────────────────────
app.use(cors({ origin: 'https://aivis.biz' }));
app.use(express.json());

// ── View engine (EJS for server‑side rendering) ────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.set('views', path.join(__dirname, 'templates'));
app.set('view engine', 'ejs');

// ── Serve pre‑rendered static files (client build) ────────────────
app.use(express.static(path.join(__dirname, '..', 'client', 'dist')));

// ── Helper: render a page and inject schema.org JSON‑LD ────────────
function renderWithSchema(
  res: express.Response,
  view: string,
  schema: Record<string, unknown>,
  data: Record<string, unknown> = {}
) {
  return res.render(view, {
    ...data,
    jsonLd: JSON.stringify(schema, null, 2),
  });
}

// ── Schema builders (simplified; extend as needed) ─────────────────
const orgSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'AiVIS',
  url: 'https://aivis.biz',
  logo: 'https://aivis.biz/logo.png',
};
const webSiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'AiVIS',
  url: 'https://aivis.biz',
  potentialAction: {
    '@type': 'SearchAction',
    target: 'https://aivis.biz/search?q={search_term_string}',
    'query-input': 'required name=search_term_string',
  },
};

// ── Page routes ────────────────────────────────────────────────────

// Homepage – combines Organization + WebSite
app.get('/', (_req, res) => {
  renderWithSchema(res, 'home', { ...orgSchema, ...webSiteSchema });
});

// Ontology definitions: /what-is-:term
app.get('/what-is-:term', (req, res) => {
  const { term } = req.params;
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'DefinedTermSet',
    name: `${term} - AiVIS Glossary`,
    description: `Definition and explanation of ${term} in the context of AI visibility.`,
    hasDefinedTerm: {
      '@type': 'DefinedTerm',
      name: term,
      termCode: term,
      description: `A concise definition of ${term}.`,
    },
  };
  renderWithSchema(res, 'ontology', schema, { term });
});

// Audit methodology (static tech article)
app.get('/audit-methodology', (_req, res) => {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: 'AiVIS Audit Methodology',
    description: 'How AiVIS evaluates AI citation readiness across 9 dimensions.',
    author: { '@type': 'Organization', name: 'AiVIS' },
    datePublished: '2025-01-01',
  };
  renderWithSchema(res, 'audit-dimension', schema, { dimension: 'Audit Methodology' });
});

// Audit dimension pages – each with its own route for clarity
const auditDimensions = [
  'entity-resolution-audit',
  'indexation-audit',
  'semantic-consistency-audit',
  'citation-likelihood-audit',
  'structured-data-audit',
  'distributed-signals-audit',
  'ai-parsability-audit',
  'trust-vectors-audit',
];

auditDimensions.forEach((dimension) => {
  app.get(`/${dimension}`, (_req, res) => {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'TechArticle',
      headline: dimension.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      description: `Technical documentation for the ${dimension.replace(/-/g, ' ')} dimension of AI visibility.`,
      author: { '@type': 'Organization', name: 'AiVIS' },
    };
    renderWithSchema(res, 'audit-dimension', schema, { dimension });
  });
});

// Blog posts: /why-ai-*, /how-*, and dimension-specific analysis pages
// /why-ai-:slug
app.get('/why-ai-:slug', (req, res) => {
  const { slug } = req.params;
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: `Why AI ${slug.replace(/-/g, ' ')}`,
    author: { '@type': 'Organization', name: 'AiVIS' },
    datePublished: '2025-01-01',
  };
  renderWithSchema(res, 'blog-post', schema, { pageType: 'why-ai', slug });
});

// /how-:slug
app.get('/how-:slug', (req, res) => {
  const { slug } = req.params;
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: `How to ${slug.replace(/-/g, ' ')}`,
    author: { '@type': 'Organization', name: 'AiVIS' },
    datePublished: '2025-01-01',
  };
  renderWithSchema(res, 'blog-post', schema, { pageType: 'how', slug });
});

// /:dimension-audit-for-:industry
auditDimensions.forEach((dimension) => {
  app.get(`/${dimension}-for-:industry`, (req, res) => {
    const { industry } = req.params;
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: `${dimension.replace(/-/g, ' ')} for ${industry.replace(/-/g, ' ')}`,
      author: { '@type': 'Organization', name: 'AiVIS' },
      datePublished: '2025-01-01',
    };
    renderWithSchema(res, 'blog-post', schema, { pageType: 'audit-for', dimension, industry });
  });
});

// Use‑case pages: /for-:useCase
app.get('/for-:useCase', (req, res) => {
  const { useCase } = req.params;
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `AiVIS for ${useCase.replace(/-/g, ' ')}`,
    description: `How AiVIS helps ${useCase.replace(/-/g, ' ')} improve AI visibility.`,
  };
  renderWithSchema(res, 'static-page', schema, { pageType: 'for', useCase });
});

// Pricing & tier pages (static pages)
const staticPages = [
  'pricing',
  'observer-tier',
  'starter-tier',
  'alignment-tier',
  'signal-tier',
  'scorefix-tier',
];

staticPages.forEach((page) => {
  app.get(`/${page}`, (_req, res) => {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: page.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      url: `https://aivis.biz/${page}`,
    };
    renderWithSchema(res, 'static-page', schema, { pageType: page });
  });
});

// Dataset page
app.get('/dataset', (_req, res) => {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'AiVIS Citation Dataset',
    description: 'Weekly updated AI visibility citation data.',
    url: 'https://aivis.biz/dataset',
    dateModified: new Date().toISOString().split('T')[0],
  };
  renderWithSchema(res, 'dataset', schema);
});

// Catch‑all 404 for any undefined route
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

export default app;
