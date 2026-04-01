// client/src/utils/schemaMarkup.ts
/**
 * Generate schema.org structured data for better AI visibility and discoverability.
 * Supports Organization, Person, Content markup and more.
 */

export type SchemaType = 'Organization' | 'Person' | 'LocalBusiness' | 'CreativeWork' | 'Article' | 'FAQPage' | 'BreadcrumbList';

export interface SchemaMarkupOptions {
  type: SchemaType;
  [key: string]: any;
}

const DEFAULT_SCHEMA_TIMEZONE = '-05:00';
const DEFAULT_SCHEMA_ARTICLE_IMAGE = 'https://aivis.biz/aivis-cover.png';

function toSchemaDateTime(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed}T00:00:00${DEFAULT_SCHEMA_TIMEZONE}`;
  }
  return trimmed;
}

/**
 * Generate Organization schema markup
 */
export function generateOrganizationSchema(options: {
  name: string;
  url: string;
  logo?: string;
  description?: string;
  founder?: {
    name: string;
    jobTitle: string;
    url?: string;
  };
  foundingDate?: string;
  sameAs?: string[];
  address?: {
    addressCountry: string;
    addressLocality?: string;
  };
}): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: options.name,
    url: options.url,
    ...(options.logo && { logo: options.logo }),
    ...(options.description && { description: options.description }),
    ...(options.founder && {
      founder: {
        '@type': 'Person',
        name: options.founder.name,
        jobTitle: options.founder.jobTitle,
        ...(options.founder.url && { url: options.founder.url }),
      },
    }),
    ...(options.foundingDate && { foundingDate: options.foundingDate }),
    ...(options.sameAs && { sameAs: options.sameAs }),
    ...(options.address && {
      address: {
        '@type': 'PostalAddress',
        ...options.address,
      },
    }),
  };
}

/**
 * Generate Person schema markup
 */
export function generatePersonSchema(options: {
  name: string;
  jobTitle?: string;
  url?: string;
  image?: string;
  description?: string;
  sameAs?: string[];
}): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: options.name,
    ...(options.jobTitle && { jobTitle: options.jobTitle }),
    ...(options.url && { url: options.url }),
    ...(options.image && { image: options.image }),
    ...(options.description && { description: options.description }),
    ...(options.sameAs && { sameAs: options.sameAs }),
  };
}

/**
 * Generate LocalBusiness schema markup
 */
export function generateLocalBusinessSchema(options: {
  name: string;
  description?: string;
  url?: string;
  telephone?: string;
  address: {
    streetAddress?: string;
    addressLocality: string;
    addressRegion: string;
    postalCode?: string;
    addressCountry: string;
  };
  priceRange?: string;
}): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: options.name,
    ...(options.description && { description: options.description }),
    ...(options.url && { url: options.url }),
    ...(options.telephone && { telephone: options.telephone }),
    address: {
      '@type': 'PostalAddress',
      ...options.address,
    },
    ...(options.priceRange && { priceRange: options.priceRange }),
  };
}

/**
 * Generate Article schema markup
 */
export function generateArticleSchema(options: {
  headline: string;
  description?: string;
  image?: string;
  author?: string;
  datePublished?: string;
  dateModified?: string;
  url?: string;
  wordCount?: number;
}): object {
  const publishedAt = toSchemaDateTime(options.datePublished);
  const modifiedAt = toSchemaDateTime(options.dateModified);

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: options.headline,
    ...(options.description && { description: options.description }),
    image: options.image || DEFAULT_SCHEMA_ARTICLE_IMAGE,
    ...(options.author && { author: { '@type': 'Person', name: options.author } }),
    ...(publishedAt && { datePublished: publishedAt }),
    ...(modifiedAt && { dateModified: modifiedAt }),
    ...(options.url && { url: options.url }),
    ...(options.wordCount && { wordCount: options.wordCount }),
  };
}

/**
 * Generate FAQ Page schema markup
 */
export function generateFAQSchema(options: {
  faqs: Array<{
    question: string;
    answer: string;
  }>;
}): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: options.faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

/**
 * Generate Breadcrumb List schema markup
 */
export function generateBreadcrumbSchema(options: {
  items: Array<{
    name: string;
    url: string;
  }>;
}): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: options.items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/**
 * Inject schema markup into the document head
 */
export function injectSchemaMarkup(schema: object, id?: string): void {
  if (!globalThis.document) return; // SSR safety

  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(schema);
  if (id) script.id = id;

  document.head.appendChild(script);
}

/**
 * Remove schema markup by ID
 */
export function removeSchemaMarkup(id: string): void {
  if (!globalThis.document) return;
  const script = document.getElementById(id);
  if (script) script.remove();
}

/**
 * Generate all recommended schemas for a page
 */
export function generatePageSchemas(config: {
  organization: {
    name: string;
    url: string;
    logo?: string;
    description?: string;
    founder?: {
      name: string;
      jobTitle: string;
      url?: string;
    };
    foundingDate?: string;
  };
  page?: {
    headline: string;
    url?: string;
    description?: string;
    type?: 'Article' | 'WebPage' | 'About' | 'Guide';
  };
  breadcrumbs?: Array<{
    name: string;
    url: string;
  }>;
}): object[] {
  const schemas: object[] = [];

  // Add Organization schema
  schemas.push(
    generateOrganizationSchema({
      name: config.organization.name,
      url: config.organization.url,
      logo: config.organization.logo,
      description: config.organization.description,
      founder: config.organization.founder,
      foundingDate: config.organization.foundingDate,
    })
  );

  // Add Article/Page schema if provided
  if (config.page) {
    schemas.push(
      generateArticleSchema({
        headline: config.page.headline,
        url: config.page.url,
        description: config.page.description,
      })
    );
  }

  // Add Breadcrumb schema if provided
  if (config.breadcrumbs && config.breadcrumbs.length > 0) {
    schemas.push(generateBreadcrumbSchema({ items: config.breadcrumbs }));
  }

  return schemas;
}
