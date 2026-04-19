/**
 * JSON-LD Schema Validator
 *
 * Validates all generated JSON-LD blocks against schema.org schemas using Ajv.
 * Runs at build time to ensure machine-readability and prevent downstream AI indexing failures.
 */

import Ajv, { type JSONSchemaType } from 'ajv';

export interface ValidationError {
  path: string;
  dataPath: string;
  schemaPath: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  schema: string;
  errors: ValidationError[];
}

const ajv = new Ajv({ strict: false, allErrors: true });

/**
 * Base schema properties required by all schema.org types
 */
const baseSchemaProperties = {
  '@context': { type: 'string', const: 'https://schema.org' },
  '@type': { type: 'string' },
  '@id': { type: 'string' },
};

/**
 * JSON Schema for schema.org Organization
 */
const organizationSchema: JSONSchemaType<any> = {
  type: 'object',
  properties: {
    '@context': { type: 'string', const: 'https://schema.org' },
    '@type': { type: 'string', const: 'Organization' },
    '@id': { type: 'string' },
    name: { type: 'string' },
    alternateName: { type: 'string' },
    url: { type: 'string', format: 'uri' },
    description: { type: 'string' },
    logo: {
      type: 'object',
      properties: {
        '@type': { type: 'string', const: 'ImageObject' },
        url: { type: 'string', format: 'uri' },
        contentUrl: { type: 'string', format: 'uri' },
      },
    },
    foundingDate: { type: 'string' },
    contactPoint: {
      type: 'object',
      properties: {
        '@type': { type: 'string', const: 'ContactPoint' },
        email: { type: 'string', format: 'email' },
        telephone: { type: 'string' },
      },
    },
    sameAs: { type: 'array', items: { type: 'string', format: 'uri' } },
  },
  required: ['@context', '@type', 'name'],
};

/**
 * JSON Schema for schema.org WebSite
 */
const websiteSchema: JSONSchemaType<any> = {
  type: 'object',
  properties: {
    '@context': { type: 'string', const: 'https://schema.org' },
    '@type': { type: 'string', const: 'WebSite' },
    '@id': { type: 'string' },
    name: { type: 'string' },
    url: { type: 'string', format: 'uri' },
    publisher: { type: 'object' },
  },
  required: ['@context', '@type', 'name', 'url'],
};

/**
 * JSON Schema for schema.org WebPage
 */
const webpageSchema: JSONSchemaType<any> = {
  type: 'object',
  properties: {
    '@context': { type: 'string', const: 'https://schema.org' },
    '@type': { type: 'string', const: 'WebPage' },
    '@id': { type: 'string' },
    url: { type: 'string', format: 'uri' },
    name: { type: 'string' },
    description: { type: 'string' },
  },
  required: ['@context', '@type', 'url'],
};

/**
 * JSON Schema for schema.org Article
 */
const articleSchema: JSONSchemaType<any> = {
  type: 'object',
  properties: {
    '@context': { type: 'string', const: 'https://schema.org' },
    '@type': { type: 'string', const: 'Article' },
    '@id': { type: 'string' },
    url: { type: 'string', format: 'uri' },
    headline: { type: 'string' },
    description: { type: 'string' },
    image: { oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
    datePublished: { type: 'string', format: 'date-time' },
    dateModified: { type: 'string', format: 'date-time' },
  },
  required: ['@context', '@type', 'headline', 'datePublished'],
};

/**
 * JSON Schema for schema.org FAQPage
 */
const faqPageSchema: JSONSchemaType<any> = {
  type: 'object',
  properties: {
    '@context': { type: 'string', const: 'https://schema.org' },
    '@type': { type: 'string', const: 'FAQPage' },
    '@id': { type: 'string' },
    mainEntity: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          '@type': { type: 'string', const: 'Question' },
          name: { type: 'string' },
          acceptedAnswer: {
            type: 'object',
            properties: {
              '@type': { type: 'string', const: 'Answer' },
              text: { type: 'string' },
            },
          },
        },
      },
    },
  },
  required: ['@context', '@type', 'mainEntity'],
};

/**
 * JSON Schema for schema.org BreadcrumbList
 */
const breadcrumbListSchema: JSONSchemaType<any> = {
  type: 'object',
  properties: {
    '@context': { type: 'string', const: 'https://schema.org' },
    '@type': { type: 'string', const: 'BreadcrumbList' },
    itemListElement: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          '@type': { type: 'string', const: 'ListItem' },
          position: { type: 'number' },
          name: { type: 'string' },
          item: { type: 'string', format: 'uri' },
        },
      },
    },
  },
  required: ['@context', '@type', 'itemListElement'],
};

/**
 * JSON Schema for schema.org ItemList
 */
const itemListSchema: JSONSchemaType<any> = {
  type: 'object',
  properties: {
    '@context': { type: 'string', const: 'https://schema.org' },
    '@type': { type: 'string', const: 'ItemList' },
    '@id': { type: 'string' },
    numberOfItems: { type: 'number' },
    itemListElement: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          '@type': { type: 'string', const: 'ListItem' },
          position: { type: 'number' },
          url: { type: 'string', format: 'uri' },
          name: { type: 'string' },
        },
      },
    },
  },
  required: ['@context', '@type'],
};

/**
 * Validators map: maps schema @type to validation function
 */
const validators = new Map([
  ['Organization', ajv.compile(organizationSchema)],
  ['WebSite', ajv.compile(websiteSchema)],
  ['WebPage', ajv.compile(webpageSchema)],
  ['Article', ajv.compile(articleSchema)],
  ['FAQPage', ajv.compile(faqPageSchema)],
  ['BreadcrumbList', ajv.compile(breadcrumbListSchema)],
  ['ItemList', ajv.compile(itemListSchema)],
]);

/**
 * Validate a single JSON-LD schema
 */
export function validateJsonLdSchema(schema: Record<string, unknown>): ValidationResult {
  const schemaType = schema['@type'] as string;
  const validator = validators.get(schemaType);

  if (!validator) {
    return {
      isValid: true, // Skip validation if schema type is not in our map
      schema: schemaType,
      errors: [],
    };
  }

  const isValid = validator(schema);
  const errors: ValidationError[] = (validator.errors || []).map((err) => ({
    path: err.instancePath || '/unknown',
    dataPath: err.dataPath || '',
    schemaPath: err.schemaPath || '',
    message: err.message || 'Unknown error',
  }));

  return {
    isValid: isValid as boolean,
    schema: schemaType,
    errors,
  };
}

/**
 * Validate an array of JSON-LD schemas (as would be injected into HTML)
 */
export function validateJsonLdArray(schemas: Record<string, unknown>[]): ValidationResult[] {
  return schemas.map((schema) => validateJsonLdSchema(schema));
}

/**
 * Check if all validation results pass
 */
export function isAllValid(results: ValidationResult[]): boolean {
  return results.every((r) => r.isValid);
}

/**
 * Format validation errors for console output (build error message)
 */
export function formatValidationErrors(results: ValidationResult[]): string {
  const failures = results.filter((r) => !r.isValid);
  if (failures.length === 0) {
    return '';
  }

  const lines = failures
    .flatMap((result) =>
      result.errors.map(
        (err) => `  [@type: ${result.schema}] ${err.dataPath || '/'} — ${err.message}`
      )
    );

  return lines.join('\n');
}

/**
 * Validate JSON-LD compatibility with schema.org specs
 * Returns array of errors; empty array means all valid
 */
export function validateProductionJsonLd(htmlContent: string): string[] {
  const errors: string[] = [];

  // Extract JSON-LD blocks from HTML
  const jsonLdBlocks = htmlContent.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g) || [];

  jsonLdBlocks.forEach((block, index) => {
    try {
      const json = block.replace(/<script[^>]*>|<\/script>/g, '').trim();
      const parsed = JSON.parse(json);

      // Determine if single object or array
      const schemas = Array.isArray(parsed) ? parsed : [parsed];
      const validationResults = validateJsonLdArray(schemas);

      validationResults.forEach((result) => {
        if (!result.isValid) {
          errors.push(`Block #${index + 1} [@type: ${result.schema}]: ${formatValidationErrors([result])}`);
        }
      });
    } catch (e) {
      errors.push(`Block #${index + 1}: Invalid JSON — ${(e as Error).message}`);
    }
  });

  return errors;
}
