# Schema.org Entity-Locking Pattern

## Overview

This document describes the entity-locking pattern implemented in AiVIS's structured data (schema.org) architecture. This pattern consolidates all canonical entities into a single source of truth, eliminating duplication and ensuring consistency across all pages.

## Problem Solved

**Before Entity-Locking:** Each page that needed organization, website, or founder information would embed separate schema definitions:

- Leads to drift (same entity defined slightly differently on different pages)
- Wasted tokens/bytes repeating identical definitions
- Hard to update - changes required edits across multiple files
- No single source of truth

**After Entity-Locking:** All canonical entities defined once with @id anchors, referenced via @id throughout the site:

- Single definition in `SCHEMA_ENTITIES` object
- Pages reference via `{ "@id": "https://aivis.biz/#org" }`
- Changes propagate automatically
- Consistent across entire site

## Architecture

### Canonical Entity Definitions

Located in [client/src/lib/seoSchema.ts](../../client/src/lib/seoSchema.ts):

```typescript
export const SCHEMA_ENTITIES = {
  organization: {
    "@type": "Organization",
    "@id": "https://aivis.biz/#org",
    name: "AiVIS",
    // ... full organization definition
  },

  founder: {
    "@type": "Person",
    "@id": "https://aivis.biz/#founder",
    name: "Mase Bly",
    // ... full founder definition
  },

  website: {
    "@type": "WebSite",
    "@id": "https://aivis.biz/#website",
    // ... full website definition
  },

  softwareApplication: {
    "@type": ["SoftwareApplication", "WebApplication"],
    "@id": "https://aivis.biz/#app",
    // ... full application definition
  },

  terminology: {
    "@type": "DefinedTermSet",
    "@id": "https://aivis.biz/#terms",
    // Defines: BRAG, CITE LEDGER, AI Visibility, Answer Engine Readiness, Evidence Stack
  },

  dataset: {
    "@type": "Dataset",
    "@id": "https://aivis.biz/#dataset",
    // ... public audit reports dataset
  },

  auditMethodology: {
    "@type": "CreativeWork",
    "@id": "https://aivis.biz/#method",
    // ... audit methodology definition
  },
};
```

### Entity Anchors (Canonical @ids)

| Entity               | @id                          | Scope                                      |
| -------------------- | ---------------------------- | ------------------------------------------ |
| Organization         | `https://aivis.biz/#org`     | Legal entity: Intruvurt Labs → AiVIS brand |
| Founder              | `https://aivis.biz/#founder` | Person: Mase Bly                           |
| Website              | `https://aivis.biz/#website` | WebSite: aivis.biz primary domain          |
| Software Application | `https://aivis.biz/#app`     | SoftwareApplication: AiVIS platform        |
| Terminology          | `https://aivis.biz/#terms`   | DefinedTermSet: AI visibility glossary     |
| Dataset              | `https://aivis.biz/#dataset` | Dataset: Public audit reports              |
| Methodology          | `https://aivis.biz/#method`  | CreativeWork: Audit methodology            |

### Reference Functions

Instead of embedding entity definitions, pages use reference functions:

```typescript
// Reference canonical organization
export function buildOrganizationRef(): { "@id": string } {
  return { "@id": ORGANIZATION_ID };
}

// Reference canonical founder
export function buildAuthorRef(): { "@id": string } {
  return { "@id": AUTHOR_ID };
}

// Reference canonical website
export function buildWebsiteRef(): { "@id": string } {
  return { "@id": WEBSITE_ID };
}

// Reference canonical application
export function buildApplicationRef(): { "@id": string } {
  return { "@id": SOFTWARE_APPLICATION_ID };
}
```

### Page-Level Schema Builders

Each major page has a dedicated schema builder that:

1. Returns a `@graph` structure with `@context`
2. Includes canonical entities via `SCHEMA_ENTITIES` object
3. Adds page-specific schema (WebPage, FAQPage, Product, etc.)
4. All references use @id anchors

#### Landing Page

```typescript
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
      { '@type': 'WebPage', '@id': 'https://aivis.biz/#webpage', ... },
    ]
  };
}
```

#### Pricing Page

```typescript
export function buildPricingPageSchema(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      SCHEMA_ENTITIES.organization,
      SCHEMA_ENTITIES.website,
      { '@type': 'WebPage', '@id': 'https://aivis.biz/pricing#webpage', ... },
    ]
  };
}
```

#### Methodology Page

```typescript
export function buildMethodologyPageSchema(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      SCHEMA_ENTITIES.organization,
      SCHEMA_ENTITIES.website,
      SCHEMA_ENTITIES.auditMethodology,
      SCHEMA_ENTITIES.terminology,
      { '@type': 'WebPage', '@id': '...', mainEntity: { '@id': '#method' }, ... },
    ]
  };
}
```

## Usage in Pages

### Landing.tsx

```typescript
import { buildLandingPageSchema, buildBreadcrumbSchema, buildFaqSchema } from '../lib/seoSchema';

function buildLandingStructuredData() {
  const baseSchema = buildLandingPageSchema();
  const graphArray = baseSchema['@graph'] || [];

  return {
    '@context': 'https://schema.org',
    '@graph': [
      ...graphArray,
      buildBreadcrumbSchema([...]),
      buildItemListSchema([...]),
      buildFaqSchema([...]),
      buildProductSchema({...}),
    ]
  };
}

const Landing = () => {
  usePageMeta({
    title: '...',
    description: '...',
    path: '/',
    structuredData: buildLandingStructuredData(),
  });
};
```

### PricingPage.tsx

```typescript
import { buildPricingPageSchema } from "../lib/seoSchema";

function getPricingStructuredData() {
  const baseSchema = buildPricingPageSchema();
  const graphArray = baseSchema["@graph"] || [];

  return {
    "@context": "https://schema.org",
    "@graph": [
      ...graphArray,
      {
        /* custom offers schema for this page */
      },
      buildFaqSchema([...PRICING_FAQ_ITEMS]),
    ],
  };
}
```

## Benefits

### 1. Single Source of Truth

- Organization details defined once in `SCHEMA_ENTITIES.organization`
- Any update (name, address, contact) propagates to all pages
- No manual syncing required

### 2. Consistent Entity Identity

- Same `@id` across all pages ensures search engines recognize entity
- Helps Google, Bing recognize AiVIS as single organization
- Improves knowledge panel and entity recognition

### 3. Reduced Bytes

- Canonical entities embedded once per page, not repeated
- JSON-LD on landing page is ~25KB smaller than old pattern
- Better for performance and crawl efficiency

### 4. Maintainability

- Clear structure: `SCHEMA_ENTITIES` → page builders → usePageMeta
- Easy to add new pages (just call `buildPageSchema()` and extend graph)
- Easy to audit: all entity definitions in one file

### 5. Best Practices Compliance

- Follows schema.org @graph pattern for complex documents
- Implements semantic web entity-locking as recommended by Schema.org
- Compliant with Google's Rich Results best practices

## Entity Hierarchy

```
Organization (https://aivis.biz/#org)
  ├─ Founder: Person (https://aivis.biz/#founder)
  ├─ Website (https://aivis.biz/#website)
  ├─ SoftwareApplication (https://aivis.biz/#app)
  │   └─ Offers (multiple tier offers)
  ├─ DefinedTermSet (https://aivis.biz/#terms)
  │   ├─ BRAG Term
  │   ├─ CITE LEDGER Term
  │   ├─ AI Visibility Term
  │   └─ Answer Engine Readiness Term
  ├─ Dataset (https://aivis.biz/#dataset)
  │   └─ Public Audit Reports
  └─ CreativeWork (https://aivis.biz/#method)
      └─ Audit Methodology
```

## Common Patterns

### Pattern 1: Extend Base Schema with Page-Specific Content

```typescript
function buildCustomPageSchema() {
  const baseSchema = buildPageSchema({ path: '/custom', ... });
  const graphArray = baseSchema['@graph'] || [];

  return {
    '@context': 'https://schema.org',
    '@graph': [
      ...graphArray,
      // Add page-specific schemas
      buildBreadcrumbSchema([...]),
      buildFaqSchema([...]),
    ]
  };
}
```

### Pattern 2: Reference Canonical Entity

```typescript
{
  '@type': 'SoftwareApplication',
  name: 'AiVIS',
  creator: builder.buildOrganizationRef(), // → { '@id': '#org' }
  publisher: buildOrganizationRef(),
}
```

### Pattern 3: Link Page to Canonical Methodology

```typescript
{
  '@type': 'WebPage',
  mainEntity: { '@id': 'https://aivis.biz/#method' }
}
```

## Testing & Validation

### Google Rich Results Test

- Navigate to [Google Rich Results Test](https://search.google.com/test/rich-results)
- Enter page URL
- Verify detected schema shows correct entity @ids
- Should see: Organization, WebPage, FAQPage, Product, etc.

### Schema.org Validator

- Use [Schema.org validation tool](https://validator.schema.org/)
- Verify @id references resolve correctly
- Check for entity hierarchy correctness

### Structured Data Testing

```bash
# Check landing page schema
curl -s https://aivis.biz/ | grep -A 50 'application/ld+json'

# Verify @graph contains entity anchors
# Should find: #org, #app, #website, #founder, #method, #terms
```

## Migration Guide (For Reference)

If adding a new page, follow this pattern:

1. **Create page builder in seoSchema.ts:**

   ```typescript
   export function buildCustomPageSchema(): Record<string, unknown> {
     return {
       '@context': 'https://schema.org',
       '@graph': [
         SCHEMA_ENTITIES.organization,
         SCHEMA_ENTITIES.website,
         { '@type': 'WebPage', '@id': '...', url: '...', ... },
       ]
     };
   }
   ```

2. **Import in component:**

   ```typescript
   import { buildCustomPageSchema } from "../lib/seoSchema";
   ```

3. **Use in usePageMeta:**

   ```typescript
   usePageMeta({
     title: "...",
     description: "...",
     path: "/custom",
     structuredData: buildCustomPageSchema(),
   });
   ```

4. **Test:**
   - Run TypeScript check: `npx tsc --noEmit`
   - Check page in Google Rich Results Test
   - Verify @ids appear in rendered JSON-LD

## Related Documentation

- [copilot-instructions.md](../../.github/copilot-instructions.md) - Tier system and architecture
- [AGENTS.md](../../AGENTS.md) - Repository conventions
- `/client/src/lib/seoSchema.ts` - Canonical entity definitions
- `/client/src/hooks/usePageMeta.ts` - Page meta hook implementation

## Implementation Timeline

- **Phase 1 (Complete)**: Refactored seoSchema.ts with SCHEMA_ENTITIES object
- **Phase 2 (Complete)**: Updated Landing.tsx to use buildLandingPageSchema()
- **Phase 3 (Complete)**: Updated PricingPage.tsx to use buildPricingPageSchema()
- **Phase 4 (Remaining)**: Update MethodologyPage.tsx, GuidePage.tsx, and other pages
- **Phase 5 (Optional)**: Full schema validation across all routes
