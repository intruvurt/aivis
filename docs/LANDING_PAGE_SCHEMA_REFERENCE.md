# Landing Page Schema: Clean Architecture Reference

## Current Landing Page JSON-LD Structure

**Location:** `client/src/pages/Landing.tsx`  
**Schema Builder:** `buildLandingPageSchema()` + page-local extensions  
**Estimated Size:** ~170 lines (vs 850 before)

### @graph Structure

```json
{
  "@context": "https://schema.org",
  "@graph": [
    // ──── LEAN CANONICAL ENTITIES ────────────────────────────────
    {
      "@type": "Organization",
      "@id": "https://aivis.biz/#org",
      "name": "AiVIS",
      "legalName": "Intruvurt Labs",
      "url": "https://aivis.biz/",
      "description": "AiVIS measures whether AI answer engines can read, trust, cite your website.",
      "logo": {
        "@type": "ImageObject",
        "url": "https://aivis.biz/aivis-logo.png"
      },
      "foundingDate": "2025-12-01",
      "address": {
        "@type": "PostalAddress",
        "addressRegion": "GA",
        "addressCountry": { "@type": "Country", "name": "US" }
      },
      "contactPoint": {
        "@type": "ContactPoint",
        "contactType": "customer support",
        "email": "support@aivis.biz"
      },
      "sameAs": [
        "https://twitter.com/dobleduche",
        "https://linkedin.com/in/web4aidev"
      ]
    },

    {
      "@type": "Person",
      "@id": "https://aivis.biz/#founder",
      "name": "Mase Bly",
      "jobTitle": "Founder, CTO",
      "url": "https://aivis.biz",
      "sameAs": ["https://twitter.com/dobleduche"],
      "worksFor": { "@id": "https://aivis.biz/#org" }
    },

    {
      "@type": "WebSite",
      "@id": "https://aivis.biz/#website",
      "name": "AiVIS - AI Visibility Intelligence Platform",
      "url": "https://aivis.biz/",
      "publisher": { "@id": "https://aivis.biz/#org" }
    },

    {
      "@type": ["SoftwareApplication", "WebApplication"],
      "@id": "https://aivis.biz/#app",
      "name": "AiVIS",
      "url": "https://aivis.biz/",
      "applicationCategory": "BusinessApplication",
      "operatingSystem": "Web",
      "description": "AI visibility auditing platform for answer engines.",
      "creator": { "@id": "https://aivis.biz/#org" },
      "publisher": { "@id": "https://aivis.biz/#org" }
    },

    // ──── PAGE-LOCAL EXTENSIONS (Added in Landing.tsx) ────────────
    {
      "@type": "WebPage",
      "@id": "https://aivis.biz/#webpage",
      "url": "https://aivis.biz/",
      "name": "AiVIS - AI Visibility Intelligence Platform",
      "description": "Measure and improve whether AI answer engines can read, trust, cite your site.",
      "isPartOf": { "@id": "https://aivis.biz/#website" },
      "about": { "@id": "https://aivis.biz/#org" }
    },

    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": "https://aivis.biz/"
        }
      ]
    },

    {
      "@type": "ItemList",
      "@id": "https://aivis.biz/#pricing-list",
      "numberOfItems": 4,
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "url": "https://aivis.biz/pricing#observer",
          "name": "Observer (Free) – 3 audits/month"
        },
        {
          "@type": "ListItem",
          "position": 2,
          "url": "https://aivis.biz/pricing#alignment",
          "name": "Alignment (Core) – 60 audits/month"
        },
        {
          "@type": "ListItem",
          "position": 3,
          "url": "https://aivis.biz/pricing#signal",
          "name": "Signal (Pro) – 110 audits/month"
        },
        {
          "@type": "ListItem",
          "position": 4,
          "url": "https://aivis.biz/pricing#scorefix",
          "name": "Score Fix (AutoFix PR)"
        }
      ]
    },

    {
      "@type": "Product",
      "name": "AiVIS - AI Visibility Intelligence Platform",
      "description": "AI visibility audit platform that scores how ChatGPT, Perplexity, Google AI and Claude read, trust cite your website.",
      "url": "https://aivis.biz/",
      "brand": { "@type": "Brand", "name": "AiVIS" },
      "offers": [
        {
          "@type": "Offer",
          "name": "Observer (Free)",
          "price": "0",
          "priceCurrency": "USD",
          "availability": "https://schema.org/InStock",
          "description": "3 AI visibility audits per month — free forever"
        },
        {
          "@type": "Offer",
          "name": "Starter",
          "price": "15",
          "priceCurrency": "USD",
          "availability": "https://schema.org/InStock",
          "description": "15 audits/month with all recommendations and PDF exports"
        },
        {
          "@type": "Offer",
          "name": "Alignment (Core)",
          "price": "49",
          "priceCurrency": "USD",
          "availability": "https://schema.org/InStock",
          "description": "60 audits/month with competitor tracking and citation workflows"
        },
        {
          "@type": "Offer",
          "name": "Signal (Pro)",
          "price": "149",
          "priceCurrency": "USD",
          "availability": "https://schema.org/InStock",
          "description": "110 audits/month with triple-check AI and citation testing"
        }
      ],
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "4.6",
        "bestRating": "5",
        "worstRating": "1",
        "ratingCount": "48",
        "reviewCount": "12"
      },
      "review": [
        {
          "@type": "Review",
          "author": { "@type": "Person", "name": "Early Adopter" },
          "reviewBody": "Ran first audit scored 15. Applied fixes. Re-scanned at 52. Evidence IDs made it obvious.",
          "reviewRating": {
            "@type": "Rating",
            "ratingValue": "5",
            "bestRating": "5"
          },
          "datePublished": "2026-03-15"
        }
      ]
    },

    {
      "@type": "FAQPage",
      "@id": "https://aivis.biz/#faq",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "What is AiVIS and what does it audit?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "AiVIS measures AI visibility — how well AI answer engines like ChatGPT, Perplexity, Google AI and Claude can read, extract, trust and cite your page content. It fetches your live page and scores six evidence-backed categories."
          }
        },
        {
          "@type": "Question",
          "name": "How is AI visibility different from traditional SEO?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Traditional SEO targets keyword rankings and backlinks. AI answer engines synthesize responses from structured content — thin structure, missing schema or poor heading hierarchy means you get skipped, regardless of domain authority."
          }
        }
        // ... more FAQ items
      ]
    }
  ]
}
```

---

## What Each @graph Item Does

| Item                | Purpose              | LLM Recognizes As      |
| ------------------- | -------------------- | ---------------------- |
| Organization        | Who creates AiVIS    | Company/Brand identity |
| Person (Founder)    | Human behind AiVIS   | Individual/Authority   |
| WebSite             | Primary domain       | Domain/Portal          |
| SoftwareApplication | The platform itself  | Product/Service        |
| WebPage             | This page metadata   | Current page URL       |
| BreadcrumbList      | Navigation hierarchy | Site structure         |
| ItemList (pricing)  | Tier options         | Product catalog        |
| Product             | Pricing schema       | E-commerce offering    |
| AggregateRating     | Social proof         | Credibility score      |
| FAQPage             | Common questions     | FAQ content            |

---

## Why This is Better

### For Google

```
OLD (confusing): "This homepage has:
  - Organization (Intruvurt Labs)? Or AiVIS?
  - Website schema, SoftwareApp schema, Product schema...
  - Also BRAG definition? Dataset? Methodology?
  - What is the PRIMARY entity?"

NEW (clear): "Homepage defines:
  - Organization: AiVIS (Intruvurt Labs brand)
  - Publisher: Same org
  - Creator: Same org
  - PRIMARY: This is a product landing page

  If I want to know about BRAG → /methodology
  If I want to know about AI Visibility (term) → /guide
  If I want the public dataset → /dataset"
```

### For LLMs

```
OLD (noisy signal):
  ChatGPT sees 7+ entity types on landing
  → "Is this a landing page, methodology page, or dataset?"
  → Lower confidence extraction

NEW (clear signal):
  Claude sees 4 core entities + product schema on landing
  → "Clear: this is a product landing page"
  → "To learn how it works, I should check /methodology"
  → Higher confidence extraction
```

### For Frontend

- Landing page is **self-contained** — no dependency on other pages
- Each page builder is **focused** — one semantic layer per builder
- New pages can be added **without affecting landing schema**
- Schema stays **under 200 lines JSON-LD**

---

## What Landing Page Does NOT Show

❌ **BRAG Definition** → lives at `/methodology#method`  
❌ **CITE LEDGER** → lives at `/methodology#method`  
❌ **Terminology** → lives at `/guide#terms` (DefinedTermSet)  
❌ **Dataset** → lives at `/dataset#dataset`  
❌ **Metadata FAQ** → contextual only on `/methodology`

---

## How Page Extensions Work

```typescript
// seoSchema.ts provides minimal base
export function buildLandingPageSchema() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      LEAN_ENTITIES.organization,     // Base: org
      LEAN_ENTITIES.founder,          // Base: founder
      LEAN_ENTITIES.website,          // Base: website
      LEAN_ENTITIES.applications,     // Base: app
      { /* WebPage */ }               // Base: page metadata
    ]
  };
}

// Landing.tsx extends it with page-specific content
function buildLandingStructuredData() {
  const baseSchema = buildLandingPageSchema();
  const graphArray = baseSchema['@graph'];

  const extendedGraph = [
    ...graphArray,
    buildBreadcrumbSchema([...]),     // PAGE: breadcrumb
    buildItemListSchema([...]),       // PAGE: pricing list
    buildFaqSchema([...]),            // PAGE: FAQ
    buildProductSchema({...}),        // PAGE: product schema
    // ... rating, review, etc
  ];

  return {
    '@context': 'https://schema.org',
    '@graph': extendedGraph
  };
}
```

**Result:** Clean separation. Base schema is ~25 lines, extensions are page-specific.

---

## Verification Checklist

- ✅ `buildLandingPageSchema()` includes 4 lean entities only
- ✅ No terminology in landing schema
- ✅ No dataset in landing schema
- ✅ No methodology CreativeWork in landing schema
- ✅ Landing.tsx extends schema with breadcrumb/itemlist/faq/product
- ✅ TypeScript compilation passes
- ✅ ~170 lines JSON-LD vs 850 before
- ✅ Each @id used consistently (`#org`, `#founder`, `#website`, `#app`)

---

## Next: Complete Other Pages

```typescript
// Methodology.tsx
usePageMeta({
  structuredData: buildMethodologyPageSchema(), // Includes #method + #terms reference
});

// Guide.tsx (Vocabulary)
usePageMeta({
  structuredData: buildVocabularyPageSchema(), // Full DefinedTermSet with 7 terms
});

// Dataset.tsx
usePageMeta({
  structuredData: buildDatasetPageSchema(), // Machine-readable dataset only
});
```

Each page is independent, focused, and owns exactly one semantic layer.

---

**Status:** ✅ Landing schema refactored complete. Ready for phase 2.
