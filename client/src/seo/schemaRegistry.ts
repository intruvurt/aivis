/**
 * SCHEMA REGISTRY — Static per-route micro-graphs
 *
 * ARCHITECTURE (React SPA correct pattern):
 * - Each route is an independent crawl unit (Google sees per-snapshot state)
 * - Each schema is a STANDALONE micro-graph, not a layer in a global graph
 * - Shared @ids (org, founder, website, app) link them semantically
 * - BUT each route's graph stands alone and is complete
 *
 * Mental Model:
 * - NOT: "one distributed graph across 4 pages"
 * - YES: "four stable micro-graphs that share @id anchors"
 *
 * Implementation:
 * - schemaRegistry.ts exports static JSON objects (NO functions)
 * - Components import and inject via <script type="application/ld+json">
 * - Each route hydrates independently, no runtime concatenation
 * - LLM crawlers see stable entity hierarchy per-page
 */

export const BASE_URL = 'https://aivis.biz';

// ─────────────────────────────────────────────────────────────────────────
// SHARED @ID ANCHORS — Referenced across all micro-graphs
// ─────────────────────────────────────────────────────────────────────────

const SHARED_IDS = {
  org: 'https://aivis.biz/#org',
  founder: 'https://aivis.biz/#founder',
  website: 'https://aivis.biz/#website',
  app: 'https://aivis.biz/#app',
  method: 'https://aivis.biz/#method',
  terms: 'https://aivis.biz/#terms',
  dataset: 'https://aivis.biz/#dataset',
} as const;

// ─────────────────────────────────────────────────────────────────────────
// SCHEMA 1: LANDING PAGE MICRO-GRAPH (Identity Layer)
// ─────────────────────────────────────────────────────────────────────────

export const landingSchema = {
  '@context': 'https://schema.org',
  '@graph': [
    // Organization (canonical identity)
    {
      '@type': 'Organization',
      '@id': SHARED_IDS.org,
      name: 'AiVIS',
      legalName: 'Intruvurt Labs',
      alternateName: 'AI Visibility Intelligence Platform',
      url: 'https://aivis.biz/',
      description:
        'AiVIS measures whether AI answer engines can read, trust, and cite your website.',
      logo: {
        '@type': 'ImageObject',
        url: `${BASE_URL}/aivis-logo.png`,
        contentUrl: `${BASE_URL}/aivis-logo.png`,
      },
      foundingDate: '2025-12-01',
      address: {
        '@type': 'PostalAddress',
        addressRegion: 'GA',
        postalCode: '30501',
        addressCountry: { '@type': 'Country', name: 'US' },
      },
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: 'support@aivis.biz',
        telephone: '+1-706-907-5299',
      },
      sameAs: [
        'https://twitter.com/dobleduche',
        'https://bsky.app/profile/intruvurt.bsky.social',
        'https://linkedin.com/in/web4aidev',
        'https://dobleduche.substack.com/',
      ],
      areaServed: 'Worldwide',
      slogan: 'Evidence-backed AI visibility intelligence',
    },

    // Founder (human authority)
    {
      '@type': 'Person',
      '@id': SHARED_IDS.founder,
      name: 'Mase Bly',
      jobTitle: 'Founder, CTO',
      url: 'https://aivis.biz',
      sameAs: ['https://twitter.com/dobleduche', 'https://linkedin.com/in/web4aidev'],
      worksFor: { '@id': SHARED_IDS.org },
    },

    // Website (portal reference)
    {
      '@type': 'WebSite',
      '@id': SHARED_IDS.website,
      name: 'AiVIS - AI Visibility Intelligence Platform',
      url: BASE_URL,
      publisher: { '@id': SHARED_IDS.org },
    },

    // SoftwareApplication (product reference)
    {
      '@type': ['SoftwareApplication', 'WebApplication'],
      '@id': SHARED_IDS.app,
      name: 'AiVIS',
      url: 'https://aivis.biz/',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      description:
        'AI visibility auditing platform for measuring how answer engines read, trust, and cite your website.',
      creator: { '@id': SHARED_IDS.org },
      publisher: { '@id': SHARED_IDS.org },
    },

    // WebPage (this page)
    {
      '@type': 'WebPage',
      '@id': 'https://aivis.biz/#webpage',
      url: 'https://aivis.biz/',
      name: 'AiVIS - AI Visibility Intelligence Platform',
      description: 'Measure and improve whether AI answer engines can read, trust, cite your site.',
      isPartOf: { '@id': SHARED_IDS.website },
      about: { '@id': SHARED_IDS.org },
    },

    // BreadcrumbList (navigation)
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: 'https://aivis.biz/',
        },
      ],
    },

    // ItemList (pricing tiers)
    {
      '@type': 'ItemList',
      '@id': SHARED_IDS.org + '#pricing-list',
      numberOfItems: 4,
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          url: 'https://aivis.biz/pricing#observer',
          name: 'Observer (Free) – 3 audits/month',
        },
        {
          '@type': 'ListItem',
          position: 2,
          url: 'https://aivis.biz/pricing#starter',
          name: 'Starter – 15 audits/month',
        },
        {
          '@type': 'ListItem',
          position: 3,
          url: 'https://aivis.biz/pricing#alignment',
          name: 'Alignment (Core) – 60 audits/month',
        },
        {
          '@type': 'ListItem',
          position: 4,
          url: 'https://aivis.biz/pricing#signal',
          name: 'Signal (Pro) – 110 audits/month',
        },
      ],
    },

    // Product (e-commerce schema)
    {
      '@type': 'Product',
      '@id': SHARED_IDS.app + '#product',
      name: 'AiVIS - AI Visibility Intelligence Platform',
      description:
        'AI visibility audit platform that scores how ChatGPT, Perplexity, Google AI and Claude read, trust cite your website.',
      url: 'https://aivis.biz/',
      brand: { '@type': 'Brand', name: 'AiVIS' },
      offers: [
        {
          '@type': 'Offer',
          name: 'Observer (Free)',
          price: '0',
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
          description: '3 AI visibility audits per month — free forever',
        },
        {
          '@type': 'Offer',
          name: 'Starter',
          price: '15',
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
          description: '15 audits/month with all recommendations and PDF exports',
        },
        {
          '@type': 'Offer',
          name: 'Alignment (Core)',
          price: '49',
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
          description: '60 audits/month with competitor tracking and citation workflows',
        },
        {
          '@type': 'Offer',
          name: 'Signal (Pro)',
          price: '149',
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
          description: '110 audits/month with triple-check AI and citation testing',
        },
      ],
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '4.6',
        bestRating: '5',
        worstRating: '1',
        ratingCount: '48',
        reviewCount: '12',
      },
      review: [
        {
          '@type': 'Review',
          author: { '@type': 'Person', name: 'Early adopter (Founder feedback)' },
          reviewBody:
            'Ran first audit scored 15. Applied fixes. Re-scanned at 52. Evidence IDs made it obvious what worked.',
          reviewRating: { '@type': 'Rating', ratingValue: '5', bestRating: '5' },
          datePublished: '2026-03-15',
        },
      ],
    },

    // FAQPage (homepage FAQ)
    {
      '@type': 'FAQPage',
      '@id': SHARED_IDS.org + '#faq',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'What is AiVIS and what does it audit?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'AiVIS measures AI visibility — how well AI answer engines like ChatGPT, Perplexity, Google AI and Claude can read, extract, trust and cite your page content. It fetches your live page and scores six evidence-backed categories.',
          },
        },
        {
          '@type': 'Question',
          name: 'How is AI visibility different from traditional SEO?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Traditional SEO targets keyword rankings and backlinks. AI answer engines synthesize responses from structured content — thin structure, missing schema or poor heading hierarchy means you get skipped, regardless of domain authority.',
          },
        },
        {
          '@type': 'Question',
          name: 'What is BRAG scoring?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: "BRAG (Based Retrieval and Auditable Grading) is AiVIS's evidence-backed scoring system. Every score has an immutable CITE LEDGER ID that links to the actual evidence extracted from your page. Learn more at /methodology.",
          },
        },
        {
          '@type': 'Question',
          name: 'Can I improve my AI visibility score?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. The audit includes 8-12 recommendations with exact implementation guidance. Structural improvements (schema, heading hierarchy, JSON-LD) show the biggest score increases. Re-scan after changes to measure impact.',
          },
        },
      ],
    },
  ],
} as const;

// ─────────────────────────────────────────────────────────────────────────
// SCHEMA 2: METHODOLOGY PAGE MICRO-GRAPH (Truth Layer)
// ─────────────────────────────────────────────────────────────────────────

export const methodologySchema = {
  '@context': 'https://schema.org',
  '@graph': [
    // Organization (identity anchor)
    {
      '@type': 'Organization',
      '@id': SHARED_IDS.org,
      name: 'AiVIS',
      url: 'https://aivis.biz/',
    },

    // WebSite (portal reference)
    {
      '@type': 'WebSite',
      '@id': SHARED_IDS.website,
      name: 'AiVIS - AI Visibility Intelligence Platform',
      url: BASE_URL,
    },

    // CreativeWork – Methodology (defines BRAG and CITE LEDGER)
    {
      '@type': 'CreativeWork',
      '@id': SHARED_IDS.method,
      name: 'BRAG Methodology – Based Retrieval and Auditable Grading',
      url: 'https://aivis.biz/methodology',
      description:
        'AiVIS audit methodology using BRAG scoring framework. Evidence-backed grading with immutable CITE LEDGER IDs for every score.',
      author: { '@id': SHARED_IDS.org },
      datePublished: '2025-12-01',
      inLanguage: 'en',
      abstract:
        'BRAG (Based Retrieval and Auditable Grading) is a structured audit methodology for measuring AI visibility. Each score is backed by extracted evidence with an immutable ID in the CITE LEDGER registry.',
      hasPart: [
        {
          '@type': 'DefinedTerm',
          name: 'BRAG',
          description:
            'Based Retrieval and Auditable Grading. Evidence-backed scoring system where every score links to actual extracted evidence via CITE LEDGER ID.',
        },
        {
          '@type': 'DefinedTerm',
          name: 'CITE LEDGER',
          description:
            'Immutable write-once evidence registry. Every CITE LEDGER ID is stable across re-scans. Links evidence extraction to audit score. Enables citation verification.',
        },
      ],
    },

    // Reference to Vocabulary/DefinedTermSet
    {
      '@type': 'DefinedTermSet',
      '@id': SHARED_IDS.terms,
      name: 'AI Visibility Terminology',
      description: 'Canonical terms and definitions used in BRAG methodology.',
      url: 'https://aivis.biz/guide',
    },

    // WebPage (this page)
    {
      '@type': 'WebPage',
      '@id': 'https://aivis.biz/methodology#webpage',
      url: 'https://aivis.biz/methodology',
      name: 'Audit Methodology – BRAG Framework',
      description:
        'BRAG (Based Retrieval and Auditable Grading) methodology. Evidence structure, CITE LEDGER, scoring rules.',
      isPartOf: { '@id': SHARED_IDS.website },
      about: { '@id': SHARED_IDS.method },
    },

    // BreadcrumbList (navigation)
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: 'https://aivis.biz/',
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Methodology',
          item: 'https://aivis.biz/methodology',
        },
      ],
    },

    // FAQPage (methodology-specific)
    {
      '@type': 'FAQPage',
      '@id': 'https://aivis.biz/methodology#faq',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'What is BRAG scoring?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: "BRAG (Based Retrieval and Auditable Grading) is AiVIS's methodology for scoring AI visibility. Every score is backed by evidence extracted from your page with an immutable CITE LEDGER ID.",
          },
        },
        {
          '@type': 'Question',
          name: 'What is CITE LEDGER?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'CITE LEDGER is an immutable write-once registry of evidence. Every audit generates CITE LEDGER IDs that are stable across re-scans. Link to evidence: aivis.biz/cite/[ID].',
          },
        },
      ],
    },
  ],
} as const;

// ─────────────────────────────────────────────────────────────────────────
// SCHEMA 3: VOCABULARY/GUIDE PAGE MICRO-GRAPH (Semantic Layer)
// ─────────────────────────────────────────────────────────────────────────

export const vocabularySchema = {
  '@context': 'https://schema.org',
  '@graph': [
    // Organization (identity anchor)
    {
      '@type': 'Organization',
      '@id': SHARED_IDS.org,
      name: 'AiVIS',
      url: 'https://aivis.biz/',
    },

    // WebSite (portal reference)
    {
      '@type': 'WebSite',
      '@id': SHARED_IDS.website,
      name: 'AiVIS - AI Visibility Intelligence Platform',
      url: BASE_URL,
    },

    // DefinedTermSet – Full Vocabulary
    {
      '@type': 'DefinedTermSet',
      '@id': SHARED_IDS.terms,
      name: 'AI Visibility Intelligence Terminology',
      url: 'https://aivis.biz/guide',
      description:
        'Canonical terms and definitions for AI visibility, citation readiness, evidence structure, and entity clarity.',
      definedTermCategory: ['Framework', 'Infrastructure', 'Measurement', 'Metadata', 'SEO'],
      hasDefinedTerm: [
        {
          '@type': 'DefinedTerm',
          name: 'BRAG',
          identifier: 'brag',
          url: 'https://aivis.biz/guide#brag',
          description:
            'Based Retrieval and Auditable Grading. Evidence-backed scoring framework where every score attaches an immutable CITE LEDGER ID.',
          sameAs: ['https://schema.org/DefinedTerm'],
        },
        {
          '@type': 'DefinedTerm',
          name: 'CITE LEDGER',
          identifier: 'cite-ledger',
          url: 'https://aivis.biz/guide#cite-ledger',
          description:
            'Immutable write-once evidence registry. Every CITE LEDGER ID is stable and links to extracted evidence.',
        },
        {
          '@type': 'DefinedTerm',
          name: 'AI Visibility',
          identifier: 'ai-visibility',
          url: 'https://aivis.biz/guide#ai-visibility',
          description:
            'Measure of how well AI answer engines (ChatGPT, Perplexity, Claude, Google AI) can read, extract, trust, and cite a web page.',
        },
        {
          '@type': 'DefinedTerm',
          name: 'Entity Clarity',
          identifier: 'entity-clarity',
          url: 'https://aivis.biz/guide#entity-clarity',
          description:
            'How clearly a web page identifies itself via schema.org entities with stable @id references. Reduces extraction confusion.',
        },
        {
          '@type': 'DefinedTerm',
          name: 'Citation Readiness',
          identifier: 'citation-readiness',
          url: 'https://aivis.biz/guide#citation-readiness',
          description:
            'Whether a page is structured to be cited by AI systems. Measured by evidence extractability, metadata quality, and entity clarity.',
        },
        {
          '@type': 'DefinedTerm',
          name: 'AEO',
          identifier: 'aeo',
          url: 'https://aivis.biz/guide#aeo',
          description:
            'Answer Engine Optimization. Structural and metadata practices specific to AI answer engines, distinct from traditional SEO.',
        },
        {
          '@type': 'DefinedTerm',
          name: 'Evidence Stack',
          identifier: 'evidence-stack',
          url: 'https://aivis.biz/guide#evidence-stack',
          description:
            'Layered extractable content: JSON-LD schema → Semantic HTML → Heading hierarchy → Plain text. All layers must align for high citation confidence.',
        },
      ],
    },

    // WebPage (this page)
    {
      '@type': 'WebPage',
      '@id': 'https://aivis.biz/guide#webpage',
      url: 'https://aivis.biz/guide',
      name: 'AI Visibility Terminology Guide',
      description:
        'Canonical definitions: BRAG, CITE LEDGER, AI Visibility, Entity Clarity, Citation Readiness, AEO, Evidence Stack.',
      isPartOf: { '@id': SHARED_IDS.website },
      about: { '@id': SHARED_IDS.terms },
    },

    // BreadcrumbList
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: 'https://aivis.biz/',
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Guide',
          item: 'https://aivis.biz/guide',
        },
      ],
    },
  ],
} as const;

// ─────────────────────────────────────────────────────────────────────────
// SCHEMA 4: DATASET PAGE MICRO-GRAPH (Machine Layer)
// ─────────────────────────────────────────────────────────────────────────

export const datasetSchema = {
  '@context': 'https://schema.org',
  '@graph': [
    // Organization (identity anchor)
    {
      '@type': 'Organization',
      '@id': SHARED_IDS.org,
      name: 'AiVIS',
      url: 'https://aivis.biz/',
    },

    // WebSite (portal reference)
    {
      '@type': 'WebSite',
      '@id': SHARED_IDS.website,
      name: 'AiVIS - AI Visibility Intelligence Platform',
      url: BASE_URL,
    },

    // Dataset – Public Audits
    {
      '@type': 'Dataset',
      '@id': SHARED_IDS.dataset,
      name: 'AiVIS Public Audit Dataset',
      url: 'https://aivis.biz/dataset',
      description:
        'Public AI visibility audits. Machine-readable evidence stacks, CITE LEDGER mappings, scoring breakdowns.',
      creator: { '@id': SHARED_IDS.org },
      publisher: { '@id': SHARED_IDS.org },
      datePublished: '2025-12-01',
      inLanguage: 'en',
      license: 'https://creativecommons.org/licenses/by/4.0/',
      distribution: [
        {
          '@type': 'DataDownload',
          encodingFormat: 'application/json',
          contentUrl: 'https://aivis.biz/api/v1/audits/public',
          name: 'Public Audits (JSON API)',
          description: 'Machine-readable public audits with evidence stacks.',
        },
        {
          '@type': 'DataDownload',
          encodingFormat: 'text/csv',
          contentUrl: 'https://aivis.biz/dataset/export.csv',
          name: 'Public Audits (CSV)',
          description: 'CSV export of public audits.',
        },
      ],
      keywords: ['AI visibility', 'evidence', 'citation', 'BRAG', 'CITE LEDGER'],
      spatialCoverage: 'Global',
      temporalCoverage: '2025-12-01/..',
    },

    // WebPage (this page)
    {
      '@type': 'WebPage',
      '@id': 'https://aivis.biz/dataset#webpage',
      url: 'https://aivis.biz/dataset',
      name: 'Public Audit Dataset',
      description: 'API, downloads, evidence structure. Machine-readable access to public audits.',
      isPartOf: { '@id': SHARED_IDS.website },
      about: { '@id': SHARED_IDS.dataset },
    },

    // BreadcrumbList
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: 'https://aivis.biz/',
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Dataset',
          item: 'https://aivis.biz/dataset',
        },
      ],
    },
  ],
} as const;

// Export all schemas
export const schemas = {
  landing: landingSchema,
  methodology: methodologySchema,
  vocabulary: vocabularySchema,
  dataset: datasetSchema,
} as const;
