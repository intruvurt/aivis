export const BASE_URL = 'https://aivis.biz';

// ─── Entity-locked canonical schema entities (single source of truth) ────────
/** All schema.org entities defined once with @id anchors, referenced via @id throughout */
export const SCHEMA_ENTITIES = {
  organization: {
    '@type': 'Organization',
    '@id': 'https://aivis.biz/#org',
    name: 'AiVIS',
    legalName: 'Intruvurt Labs',
    alternateName: 'AI Visibility Intelligence Platform',
    url: 'https://aivis.biz/',
    description:
      'AiVIS is the first platform built specifically to measure and improve whether AI answer engines can read, trust, and cite your website. Built by Intruvurt Labs for AI visibility audits, answer-engine readiness, and evidence-backed optimization workflows.',
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
      addressCountry: {
        '@type': 'Country',
        name: 'US',
      },
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
      'https://www.reddit.com/user/intruvurt',
      'https://www.reddit.com/r/AiVIS/',
      'https://linkedin.com/in/web4aidev',
      'https://dobleduche.substack.com/',
    ],
    knowsAbout: [
      'AI visibility auditing',
      'answer engine optimization',
      'generative engine optimization',
      'AI citation readiness',
      'structured data and schema.org',
      'machine readability',
      'BRAG evidence framework',
      'entity disambiguation',
      'AI search optimization',
    ],
    areaServed: 'Worldwide',
    slogan: 'Evidence-backed AI visibility intelligence',
  } as Record<string, unknown>,

  founder: {
    '@type': 'Person',
    '@id': 'https://aivis.biz/#founder',
    name: 'Mase Bly',
    jobTitle: 'Founder, CTO',
    url: 'https://aivis.biz',
    description: 'Founder and CTO of AiVIS, AI visibility intelligence researcher',
    knowsAbout: [
      'AI answer engine optimization',
      'WebSockets and real-time systems',
      'Schema.org and structured data',
      'Puppeteer and web scraping',
      'Multi-model LLM orchestration',
    ],
    sameAs: [
      'https://twitter.com/dobleduche',
      'https://bsky.app/profile/intruvurt.bsky.social',
      'https://linkedin.com/in/web4aidev',
    ],
    worksFor: { '@id': 'https://aivis.biz/#org' },
  } as Record<string, unknown>,

  website: {
    '@type': 'WebSite',
    '@id': 'https://aivis.biz/#website',
    name: 'AiVIS - AI Visibility Intelligence Platform',
    url: BASE_URL,
    publisher: { '@id': 'https://aivis.biz/#org' },
    potentialAction: {
      '@type': 'SearchAction',
      target: `${BASE_URL}/?target={url}`,
      'query-input': 'required name=url',
    },
  } as Record<string, unknown>,

  softwareApplication: {
    '@type': ['SoftwareApplication', 'WebApplication'],
    '@id': 'https://aivis.biz/#app',
    name: 'AiVIS',
    url: 'https://aivis.biz/',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description:
      'AI visibility auditing platform: measure AI readiness, track citations, optimize for answer engines',
    creator: { '@id': 'https://aivis.biz/#org' },
    publisher: { '@id': 'https://aivis.biz/#org' },
    featureList: [
      'Answer engine audits',
      'Citation tracking',
      'BRAG evidence scoring',
      'Multi-model AI analysis',
      'Public audit reports',
      'Citation testing',
      'Competitor tracking',
      'Mention scanning',
    ],
  } as Record<string, unknown>,

  terminology: {
    '@type': 'DefinedTermSet',
    '@id': 'https://aivis.biz/#terms',
    name: 'AI Visibility Intelligence Terms',
    description: 'Canonical terminology for AI readiness, visibility, and evidence frameworks',
    url: 'https://aivis.biz/guide',
    hasDefinedTerm: [
      {
        '@type': 'DefinedTerm',
        '@id': 'https://aivis.biz/#term-brag',
        name: 'BRAG',
        description:
          'Based Retrieval and Auditable Grading framework for evidence-backed AI optimization',
        inDefinedTermSet: { '@id': 'https://aivis.biz/#terms' },
      },
      {
        '@type': 'DefinedTerm',
        '@id': 'https://aivis.biz/#term-cite-ledger',
        name: 'CITE LEDGER',
        description:
          'Immutable evidence registry with write-once citation records and stable evidence IDs',
        inDefinedTermSet: { '@id': 'https://aivis.biz/#terms' },
      },
      {
        '@type': 'DefinedTerm',
        '@id': 'https://aivis.biz/#term-ai-visibility',
        name: 'AI Visibility',
        description:
          'Measure of whether AI answer engines (ChatGPT, Claude, Perplexity) can read, trust, and cite your website',
        inDefinedTermSet: { '@id': 'https://aivis.biz/#terms' },
      },
      {
        '@type': 'DefinedTerm',
        '@id': 'https://aivis.biz/#term-answer-engine-readiness',
        name: 'Answer Engine Readiness',
        description:
          'Technical and content readiness for discovery and citation by AI answer engines',
        inDefinedTermSet: { '@id': 'https://aivis.biz/#terms' },
      },
      {
        '@type': 'DefinedTerm',
        '@id': 'https://aivis.biz/#term-evidence-stack',
        name: 'Evidence Stack',
        description:
          'Structured data, machine readability, and citation-ready content for AI systems',
        inDefinedTermSet: { '@id': 'https://aivis.biz/#terms' },
      },
    ],
  } as Record<string, unknown>,

  dataset: {
    '@type': 'Dataset',
    '@id': 'https://aivis.biz/#dataset',
    name: 'AiVIS Public Audit Reports',
    description: 'Publicly shared audit findings, citations, and AI visibility analysis data',
    url: 'https://aivis.biz/reports/public',
    creator: { '@id': 'https://aivis.biz/#org' },
    distribution: {
      '@type': 'DataDownload',
      encodingFormat: 'JSON',
    },
    license: 'https://creativecommons.org/licenses/by-sa/4.0/',
    inLanguage: 'en-US',
  } as Record<string, unknown>,

  auditMethodology: {
    '@type': 'CreativeWork',
    '@id': 'https://aivis.biz/#method',
    name: 'AiVIS AI Visibility Audit Methodology',
    description: 'Multi-stage auditing process for measuring AI readiness and citation potential',
    url: 'https://aivis.biz/methodology',
    creator: { '@id': 'https://aivis.biz/#org' },
    dateCreated: '2025-12-01',
    inLanguage: 'en-US',
    isPartOf: { '@id': 'https://aivis.biz/#org' },
  } as Record<string, unknown>,
};

// ─── Legacy constants for compatibility (map to entity anchors) ──────────────
export const ORGANIZATION_ID = SCHEMA_ENTITIES.organization['@id'] as string;
export const AUTHOR_ID = SCHEMA_ENTITIES.founder['@id'] as string;
export const WEBSITE_ID = SCHEMA_ENTITIES.website['@id'] as string;
export const SOFTWARE_APPLICATION_ID = SCHEMA_ENTITIES.softwareApplication['@id'] as string;

const DEFAULT_SCHEMA_TIMEZONE = '-05:00';
const DEFAULT_OFFER_AVAILABILITY = 'https://schema.org/InStock';

function getDefaultOfferPriceValidUntil(): string {
  return `${new Date().getUTCFullYear() + 1}-12-31`;
}

function toSchemaDateTime(value: string): string {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed}T00:00:00${DEFAULT_SCHEMA_TIMEZONE}`;
  }
  return trimmed;
}

/** Reference canonical organization entity by @id */
export function buildOrganizationRef(): Record<string, unknown> {
  return { '@id': ORGANIZATION_ID };
}

/** Reference canonical founder by @id */
export function buildAuthorRef(): Record<string, unknown> {
  return { '@id': AUTHOR_ID };
}

/** Reference canonical website by @id */
export function buildWebsiteRef(): Record<string, unknown> {
  return { '@id': WEBSITE_ID };
}

/** Reference canonical software application by @id */
export function buildApplicationRef(): Record<string, unknown> {
  return { '@id': SOFTWARE_APPLICATION_ID };
}

/**
 * Build full @graph-based page schema with entity-locked references.
 * All shared entities (@id anchors) are defined once in SCHEMA_ENTITIES,
 * pages reference them via @id instead of embedding separate definitions.
 */
export function buildPageSchema(input: {
  path: string;
  name: string;
  description: string;
  mainEntityId?: string;
  includeOrganization?: boolean;
  includeWebsite?: boolean;
  speakableCssSelectors?: string[];
  significantLinks?: string[];
}): Record<string, unknown> {
  const url = `${BASE_URL}${input.path}`;
  const pageId = `${url}#webpage`;

  const graph: Record<string, unknown>[] = [];

  // Include canonical entities if requested (default: yes for landing pages)
  if (input.includeOrganization !== false) {
    graph.push(SCHEMA_ENTITIES.organization);
    graph.push(SCHEMA_ENTITIES.founder);
  }
  if (input.includeWebsite !== false) {
    graph.push(SCHEMA_ENTITIES.website);
  }

  // Add page schema
  graph.push({
    '@type': 'WebPage',
    '@id': pageId,
    url,
    name: input.name,
    description: input.description,
    isPartOf: { '@id': WEBSITE_ID },
    about: buildOrganizationRef(),
    ...(input.mainEntityId ? { mainEntity: { '@id': input.mainEntityId } } : {}),
    ...(input.speakableCssSelectors?.length
      ? {
          speakable: {
            '@type': 'SpeakableSpecification',
            cssSelector: input.speakableCssSelectors,
          },
        }
      : {}),
    ...(input.significantLinks?.length ? { significantLink: input.significantLinks } : {}),
  });

  return {
    '@context': 'https://schema.org',
    '@graph': graph,
  };
}

/**
 * Build web page schema with @graph structure.
 * Pages automatically include Organization, Website, and Founder entities via @id references.
 */
export function buildWebPageSchema(input: {
  path: string;
  name: string;
  description: string;
  mainEntityId?: string;
  speakableCssSelectors?: string[];
  significantLinks?: string[];
}): Record<string, unknown> {
  return buildPageSchema(input);
}

export interface BreadcrumbItem {
  name: string;
  path: string;
}

export function buildBreadcrumbSchema(items: BreadcrumbItem[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${BASE_URL}${item.path}`,
    })),
  };
}

export interface ArticleSchemaInput {
  title: string;
  description: string;
  path: string;
  datePublished: string;
  dateModified?: string;
  coverImageUrl?: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

/**
 * Build article schema with entity-locked references.
 * Includes canonical Organization via @id.
 */
export function buildArticleSchema(input: ArticleSchemaInput): Record<string, unknown> {
  const canonicalUrl = `${BASE_URL}${input.path}`;
  const coverImageUrl = input.coverImageUrl ?? `${BASE_URL}/aivis-cover.png`;
  const publishedAt = new Date(toSchemaDateTime(input.datePublished)).toISOString();
  const modifiedAt = new Date(
    toSchemaDateTime(input.dateModified ?? input.datePublished)
  ).toISOString();

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': `${canonicalUrl}#article`,
    url: canonicalUrl,
    headline: input.title,
    description: input.description,
    image: [coverImageUrl],
    author: buildAuthorRef(),
    publisher: buildOrganizationRef(),
    datePublished: publishedAt,
    dateModified: modifiedAt,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': canonicalUrl,
    },
    inLanguage: 'en-US',
  };
}

/**
 * Build FAQ page schema with entity-locked references.
 */
export function buildFaqSchema(
  items: FaqItem[],
  options?: { id?: string; path?: string }
): Record<string, unknown> {
  const faqId = options?.id ?? (options?.path ? `${BASE_URL}${options.path}#faq` : undefined);
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    ...(faqId ? { '@id': faqId } : {}),
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

export function buildCollectionSchema(
  name: string,
  description: string,
  path: string
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name,
    description,
    url: `${BASE_URL}${path}`,
  };
}

/**
 * Build item list schema with entity-locked references.
 */
export function buildItemListSchema(
  items: Array<{ name: string; path: string }>,
  options?: { id?: string; path?: string }
): Record<string, unknown> {
  const itemListId =
    options?.id ?? (options?.path ? `${BASE_URL}${options.path}#item-list` : undefined);
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    ...(itemListId ? { '@id': itemListId } : {}),
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: `${BASE_URL}${item.path}`,
      name: item.name,
    })),
  };
}

// ─── Extended builders with entity-locked references ────────────────────────

/**
 * Build news article schema with entity-locked references.
 */
export function buildNewsArticleSchema(input: {
  title: string;
  description: string;
  path: string;
  datePublished: string;
  dateModified?: string;
}): Record<string, unknown> {
  const publishedAt = toSchemaDateTime(input.datePublished);
  const modifiedAt = toSchemaDateTime(input.dateModified ?? input.datePublished);

  return {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: input.title,
    description: input.description,
    datePublished: publishedAt,
    dateModified: modifiedAt,
    author: buildAuthorRef(),
    publisher: buildOrganizationRef(),
    mainEntityOfPage: `${BASE_URL}${input.path}`,
    url: `${BASE_URL}${input.path}`,
    image: `${BASE_URL}/og/og-default.jpg`,
  };
}

/**
 * Build tech article schema with entity-locked references.
 */
export function buildTechArticleSchema(input: {
  title: string;
  description: string;
  path: string;
  datePublished?: string;
  dateModified?: string;
}): Record<string, unknown> {
  const published = toSchemaDateTime(input.datePublished ?? '2026-01-01');
  const modified = toSchemaDateTime(input.dateModified ?? published);

  return {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: input.title,
    description: input.description,
    datePublished: published,
    dateModified: modified,
    author: buildAuthorRef(),
    publisher: buildOrganizationRef(),
    mainEntityOfPage: `${BASE_URL}${input.path}`,
    url: `${BASE_URL}${input.path}`,
    proficiencyLevel: 'Expert',
    dependencies: 'AiVIS API key · Alignment+ plan',
  };
}

export interface HowToStepInput {
  name: string;
  text: string;
}

/**
 * Build HowTo schema with instructions and steps.
 */
export function buildHowToSchema(input: {
  name: string;
  description: string;
  url: string;
  steps: HowToStepInput[];
  id?: string;
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    '@id': input.id ?? `${input.url.replace(/\/$/, '')}#howto`,
    name: input.name,
    description: input.description,
    url: input.url,
    step: input.steps.map((step, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: step.name,
      text: step.text,
    })),
  };
}

/**
 * Build software application schema with entity-locked references.
 * References canonical Organization and Website via @id.
 */
export function buildSoftwareApplicationSchema(input: {
  name: string;
  description: string;
  applicationCategory?: string;
  operatingSystem?: string;
  featureList?: string[];
  offers?: Array<{
    name: string;
    price: string;
    priceCurrency?: string;
    availability?: string;
    priceValidUntil?: string;
  }>;
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': ['SoftwareApplication', 'WebApplication'],
    '@id': SOFTWARE_APPLICATION_ID,
    name: input.name,
    url: `${BASE_URL}/`,
    description: input.description,
    applicationCategory: input.applicationCategory ?? 'BusinessApplication',
    operatingSystem: input.operatingSystem ?? 'Web',
    creator: buildOrganizationRef(),
    publisher: buildOrganizationRef(),
    ...(input.featureList && input.featureList.length > 0
      ? { featureList: input.featureList }
      : {}),
    ...(input.offers && input.offers.length > 0
      ? {
          offers: input.offers.map((o) => ({
            '@type': 'Offer',
            name: o.name,
            price: o.price,
            priceCurrency: o.priceCurrency ?? 'USD',
            availability: o.availability ?? DEFAULT_OFFER_AVAILABILITY,
            priceValidUntil: o.priceValidUntil ?? getDefaultOfferPriceValidUntil(),
          })),
        }
      : {}),
  };
}

/**
 * Build person schema with entity-locked references.
 */
export function buildPersonSchema(input: {
  name: string;
  jobTitle: string;
  url: string;
  id?: string;
  description?: string;
  worksForId?: string;
  knowsAbout?: string[];
  sameAs?: string[];
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': input.id ?? `${input.url}#person`,
    name: input.name,
    jobTitle: input.jobTitle,
    url: input.url,
    ...(input.description ? { description: input.description } : {}),
    ...(input.knowsAbout?.length ? { knowsAbout: input.knowsAbout } : {}),
    ...(input.sameAs?.length ? { sameAs: input.sameAs } : {}),
    ...(input.worksForId
      ? {
          worksFor: {
            '@id': input.worksForId,
          },
        }
      : {}),
  };
}

/**
 * Build service schema with entity-locked references.
 */
export function buildServiceSchema(input: {
  name: string;
  serviceType: string;
  description: string;
  path: string;
  areaServed?: string;
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `${BASE_URL}${input.path}#service`,
    name: input.name,
    serviceType: input.serviceType,
    description: input.description,
    provider: buildOrganizationRef(),
    url: `${BASE_URL}${input.path}`,
    areaServed: input.areaServed ?? 'Worldwide',
  };
}

/**
 * Build defined term set schema.
 * Use SCHEMA_ENTITIES.terminology instead for canonical AI visibility terminology.
 */
export function buildDefinedTermSetSchema(input: {
  name: string;
  description: string;
  path: string;
  terms: Array<{ name: string; description: string }>;
}): Record<string, unknown> {
  const base = `${BASE_URL}${input.path}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'DefinedTermSet',
    '@id': `${base}#terms`,
    name: input.name,
    description: input.description,
    url: `${base}`,
    hasDefinedTerm: input.terms.map((term, index) => ({
      '@type': 'DefinedTerm',
      '@id': `${base}#term-${index + 1}`,
      name: term.name,
      description: term.description,
      inDefinedTermSet: `${base}#terms`,
    })),
  };
}

/**
 * Build aggregate rating schema for reviews.
 */
export function buildAggregateRatingSchema(input: {
  ratingValue: string;
  bestRating?: string;
  worstRating?: string;
  ratingCount: string;
  reviewCount?: string;
}): Record<string, unknown> {
  return {
    '@type': 'AggregateRating',
    ratingValue: input.ratingValue,
    bestRating: input.bestRating ?? '100',
    worstRating: input.worstRating ?? '0',
    ratingCount: input.ratingCount,
    ...(input.reviewCount ? { reviewCount: input.reviewCount } : {}),
  };
}

/**
 * Build review schema.
 */
export function buildReviewSchema(input: {
  author: string;
  reviewBody: string;
  ratingValue: string;
  bestRating?: string;
  datePublished?: string;
}): Record<string, unknown> {
  return {
    '@type': 'Review',
    author: { '@type': 'Person', name: input.author },
    reviewBody: input.reviewBody,
    reviewRating: {
      '@type': 'Rating',
      ratingValue: input.ratingValue,
      bestRating: input.bestRating ?? '100',
    },
    ...(input.datePublished ? { datePublished: input.datePublished } : {}),
  };
}

/**
 * Build product schema with entity-locked references.
 */
export function buildProductSchema(input: {
  name: string;
  description: string;
  url?: string;
  brand?: string;
  offers?: Array<{
    name: string;
    price: string;
    priceCurrency?: string;
    availability?: string;
    priceValidUntil?: string;
    description?: string;
  }>;
  aggregateRating?: Record<string, unknown>;
  reviews?: Array<Record<string, unknown>>;
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: input.name,
    description: input.description,
    ...(input.url ? { url: input.url } : {}),
    ...(input.brand ? { brand: { '@type': 'Brand', name: input.brand } } : {}),
    ...(input.offers?.length
      ? {
          offers: input.offers.map((o) => ({
            '@type': 'Offer',
            name: o.name,
            price: o.price,
            priceCurrency: o.priceCurrency ?? 'USD',
            availability: o.availability ?? DEFAULT_OFFER_AVAILABILITY,
            priceValidUntil: o.priceValidUntil ?? getDefaultOfferPriceValidUntil(),
            ...(o.description ? { description: o.description } : {}),
          })),
        }
      : {}),
    ...(input.aggregateRating ? { aggregateRating: input.aggregateRating } : {}),
    ...(input.reviews?.length ? { review: input.reviews } : {}),
  };
}

// ─── Landing page specific schema builder ──────────────────────────────────

/**
 * Build landing page schema with entity-locked @graph.
 * Includes Organization, Founder, Website, SoftwareApplication, and methodology creativeWork.
 */
export function buildLandingPageSchema(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      SCHEMA_ENTITIES.organization,
      SCHEMA_ENTITIES.founder,
      SCHEMA_ENTITIES.website,
      SCHEMA_ENTITIES.softwareApplication,
      SCHEMA_ENTITIES.terminology,
      SCHEMA_ENTITIES.auditMethodology,
      {
        '@type': 'WebPage',
        '@id': 'https://aivis.biz/#webpage',
        url: 'https://aivis.biz/',
        name: 'AiVIS - AI Visibility Intelligence Platform',
        description:
          'Measure and improve whether AI answer engines can read, trust, and cite your website. Evidence-backed audits, citation tracking, and answer engine optimization.',
        isPartOf: { '@id': WEBSITE_ID },
        about: buildOrganizationRef(),
      },
    ],
  };
}

/**
 * Build pricing page schema with entity-locked @graph.
 */
export function buildPricingPageSchema(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      SCHEMA_ENTITIES.organization,
      SCHEMA_ENTITIES.website,
      {
        '@type': 'WebPage',
        '@id': 'https://aivis.biz/pricing#webpage',
        url: 'https://aivis.biz/pricing',
        name: 'Pricing - AiVIS',
        description:
          'Transparent pricing for AI visibility audits, answer engine optimization, and citation tracking.',
        isPartOf: { '@id': WEBSITE_ID },
        about: buildOrganizationRef(),
      },
    ],
  };
}

/**
 * Build methodology page schema with entity-locked @graph.
 */
export function buildMethodologyPageSchema(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      SCHEMA_ENTITIES.organization,
      SCHEMA_ENTITIES.website,
      SCHEMA_ENTITIES.auditMethodology,
      SCHEMA_ENTITIES.terminology,
      {
        '@type': 'WebPage',
        '@id': 'https://aivis.biz/methodology#webpage',
        url: 'https://aivis.biz/methodology',
        name: 'Methodology - AiVIS',
        description:
          'AiVIS audit methodology: evidence-backed auditing, BRAG framework, and citation readiness measurement.',
        isPartOf: { '@id': WEBSITE_ID },
        about: buildOrganizationRef(),
        mainEntity: { '@id': 'https://aivis.biz/#method' },
      },
    ],
  };
}

/**
 * Build guide page schema with entity-locked @graph.
 */
export function buildGuidePageSchema(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      SCHEMA_ENTITIES.organization,
      SCHEMA_ENTITIES.website,
      SCHEMA_ENTITIES.terminology,
      {
        '@type': 'WebPage',
        '@id': 'https://aivis.biz/guide#webpage',
        url: 'https://aivis.biz/guide',
        name: 'Guide - AiVIS',
        description: 'AI visibility terminology, audit flow, and answer engine readiness guide.',
        isPartOf: { '@id': WEBSITE_ID },
        about: buildOrganizationRef(),
        mainEntity: { '@id': 'https://aivis.biz/#terms' },
      },
    ],
  };
}
