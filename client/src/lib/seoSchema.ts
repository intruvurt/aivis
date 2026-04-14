export const BASE_URL = 'https://aivis.biz';
export const ORGANIZATION_ID = `${BASE_URL}/#organization`;
export const WEBSITE_ID = `${BASE_URL}/#website`;
export const SOFTWARE_APPLICATION_ID = `${BASE_URL}/#software-application`;
export const AUTHOR_ID = `${BASE_URL}/#author`;
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

export function buildOrganizationSchema(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: 'AiVIS',
    legalName: 'Intruvurt Labs',
    alternateName: 'AI Visibility Intelligence Platform',
    url: `${BASE_URL}/`,
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
      'https://twitter.com/intruvurt',
      'https://twitter.com/odinarysol',
      'https://twitter.com/nimrevxyz',
      'https://github.com/dobleduche',
      'https://github.com/dobleduche/brag',
      'https://bsky.app/profile/intruvurt.bsky.social',
      'https://www.reddit.com/user/intruvurt',
      'https://www.reddit.com/user/renomase',
      'https://www.reddit.com/r/AiVIS/',
      'https://www.youtube.com/@mediatechmele',
      'https://linkedin.com/in/web4aidev',
      'https://www.linkedin.com/posts/web4aidev_aivis-audits-how-ai-systems-read-a-website-share-7447000684455071745-tDOK',
      'https://www.producthunt.com/products/aivis-ai-visibility-intelligence-audit',
      'https://relaxstart.com/startup/ai-visibility-intelligence-platform',
      'https://dobleduche.substack.com/',
      'https://dobleduche.substack.com/p/best-startup-launch-platforms-for',
      'https://dobleduche.substack.com/p/your-website-is-not-competing-for',
      'https://dobleduche.substack.com/p/the-quiet-shift-why-websites-now',
      'https://intruvurtlabs.substack.com/',
      'https://intruvurt.medium.com/why-i-built-aivis-when-i-realized-most-websites-are-invisible-to-ai-ac7ad86ccbf8',
      'https://intruvurt.medium.com/before-you-build-another-saas-run-this-30-second-reality-check-af7b1bb30bcc',
      'https://intruvurt.medium.com/answer-engine-optimization-aeo-2026',
      'https://intruvurt.medium.com/why-seo-fails-for-ai-visibility',
      'https://intruvurt.medium.com/eeat-ai-citations',
      'https://intruvurt.medium.com/llm-content-extraction-breakdown',
      'https://intruvurt.medium.com/geo-ai-ranking',
      'https://intruvurt.medium.com/case-study-citation-growth',
      'https://intruvurt.medium.com/gsc-ai-visibility',
      'https://intruvurt.medium.com/implementation-roadmap',
      'https://intruvurt.medium.com/google-search-console-2026',
      'https://intruvurt.blogspot.com/2026/04/platforms-that-move-builders-ai-visibility.html',
      'https://intruvurt.blogspot.com/2026/04/ai-brand-mentions-9-sources-citation.html',
      'https://intruvurt.blogspot.com/2026/04/brand-authority-mention-tracking-entity-clarity-ai.html',
      'https://dev.to/aivisbiz/i-audited-500-websites-json-ld-is-the-1-factor-for-ai-citation-29m4',
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
  };
}

/** Canonical organization reference - always use this instead of bare { name: 'AiVIS' } */
export function buildOrganizationRef(): Record<string, unknown> {
  return {
    '@id': ORGANIZATION_ID,
  };
}

export function buildAuthorRef(): Record<string, unknown> {
  return {
    '@id': AUTHOR_ID,
  };
}

export function buildWebSiteSchema(name = 'AiVIS - AI Visibility Intelligence Platform'): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name,
    url: BASE_URL,
    publisher: buildOrganizationRef(),
    potentialAction: {
      '@type': 'SearchAction',
      target: `${BASE_URL}/?target={url}`,
      'query-input': 'required name=url',
    },
  };
}

export function buildWebPageSchema(input: {
  path: string;
  name: string;
  description: string;
  mainEntityId?: string;
  speakableCssSelectors?: string[];
  significantLinks?: string[];
}): Record<string, unknown> {
  const url = `${BASE_URL}${input.path}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${url}#webpage`,
    url,
    name: input.name,
    description: input.description,
    isPartOf: {
      '@id': WEBSITE_ID,
    },
    about: buildOrganizationRef(),
    ...(input.mainEntityId
      ? {
        mainEntity: {
          '@id': input.mainEntityId,
        },
      }
      : {}),
    ...(input.speakableCssSelectors?.length
      ? {
        speakable: {
          '@type': 'SpeakableSpecification',
          cssSelector: input.speakableCssSelectors,
        },
      }
      : {}),
    ...(input.significantLinks?.length
      ? { significantLink: input.significantLinks }
      : {}),
  };
}

export interface BreadcrumbItem {
  name: string;
  path: string;
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

export function buildArticleSchema(input: ArticleSchemaInput): Record<string, unknown> {
  const canonicalUrl = `${BASE_URL}${input.path}`;
  const coverImageUrl = input.coverImageUrl ?? `${BASE_URL}/aivis-cover.png`;
  const publishedAt = new Date(toSchemaDateTime(input.datePublished)).toISOString();
  const modifiedAt = new Date(toSchemaDateTime(input.dateModified ?? input.datePublished)).toISOString();

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

export function buildCollectionSchema(name: string, description: string, path: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name,
    description,
    url: `${BASE_URL}${path}`,
  };
}

export function buildItemListSchema(
  items: Array<{ name: string; path: string }>,
  options?: { id?: string; path?: string }
): Record<string, unknown> {
  const itemListId = options?.id ?? (options?.path ? `${BASE_URL}${options.path}#item-list` : undefined);
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

// ─── Extended builders ────────────────────────────────────────────────────────

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
    author: buildOrganizationRef(),
    publisher: buildOrganizationRef(),
    mainEntityOfPage: `${BASE_URL}${input.path}`,
    url: `${BASE_URL}${input.path}`,
    image: `${BASE_URL}/og/og-default.jpg`,
  };
}

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
    author: buildOrganizationRef(),
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

export function buildProductSchema(input: {
  name: string;
  description: string;
  url?: string;
  image?: string;
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
    ...(input.image ? { image: input.image } : {}),
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
