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
    foundingDate: '2025-12',
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
