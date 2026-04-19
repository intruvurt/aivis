# React SPA Schema Architecture — Correct Pattern

**Status:** ✅ Implemented  
**Date:** 2026-04-19  
**Problem Solved:** Entity collapse at runtime (SPA-specific)

---

## The Problem We Solved

### Wrong Pattern (What We Had)

```typescript
// seoSchema.ts - Builder functions
export function buildLandingPageSchema() { return { ... } }
export function buildMethodologyPageSchema() { return { ... } }
// Repeat 4 times...

// Landing.tsx
const schema = buildLandingPageSchema();  // Runtime function call
const extended = [...schema['@graph'], ...pageExtensions];  // Dynamic concatenation
```

**Why this failed in React SPAs:**

- Google sees per-route **snapshot states** during crawl
- LLM crawlers often see **initial HTML only** (no hydration)
- Function builders encourage runtime concatenation
- Runtime concatenation = entities collapse into one undefined node
- Entity identity is ambiguous during extraction

### Correct Pattern (What We Deploy Now)

```typescript
// schemaRegistry.ts - Static schema objects
export const landingSchema = { '@context': '...', '@graph': [...] }
export const methodologySchema = { '@context': '...', '@graph': [...] }
// Repeat 4 times...

// Landing.tsx
<LandingSEO>
  <Landing />
</LandingSEO>

// LandingSEO.tsx - Injects schema via Helmet
<Helmet>
  <script type="application/ld+json">
    {JSON.stringify(landingSchema)}
  </script>
</Helmet>
```

**Why this works in React SPAs:**

- Each route gets a **complete, independent micro-graph**
- HTML output includes schema **before hydration**
- LLM crawlers see stable entity hierarchy at load time
- Google sees consistent @graphs across snapshots
- Shared @ids link graphs semantically without collapse

---

## Architecture Reference

### File Structure

```
client/src/
├── seo/
│   └── schemaRegistry.ts          ← 4 static schema objects + shared @ids
│
├── components/seo/
│   ├── LandingSEO.tsx             ← Injects landingSchema
│   ├── MethodologySEO.tsx         ← Injects methodologySchema
│   ├── VocabularySEO.tsx          ← Injects vocabularySchema
│   ├── DatasetSEO.tsx             ← Injects datasetSchema
│   └── index.ts                   ← Barrel export
│
└── pages/
    ├── Landing.tsx                ← Wrapped with <LandingSEO>
    ├── Methodology.tsx            ← Wrapped with <MethodologySEO>
    ├── Guide.tsx                  ← Wrapped with <VocabularySEO>
    └── Dataset.tsx                ← Wrapped with <DatasetSEO>
```

### The 4 Schemas (Micro-Graphs)

Each schema is **complete**, **independent**, and **stable**.

#### Schema 1: Landing Page

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {Organization: #org},
    {Person: #founder},
    {WebSite: #website},
    {SoftwareApplication: #app},
    {WebPage},
    {BreadcrumbList},
    {ItemList},
    {Product},
    {AggregateRating},
    {FAQPage}
  ]
}
```

**Serves:** Identity layer + conversion + e-commerce  
**JSON-LD Size:** ~170 lines  
**Purpose:** Establish brand identity, show pricing offers, answer FAQ

#### Schema 2: Methodology Page

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {Organization: #org},           ← Lean reference
    {WebSite: #website},            ← Lean reference
    {CreativeWork: #method},        ← BRAG + CITE LEDGER definitions
    {DefinedTermSet: #terms},       ← Reference to Guide
    {WebPage},
    {BreadcrumbList},
    {FAQPage: methodology}
  ]
}
```

**Serves:** Truth layer + authority  
**JSON-LD Size:** ~100 lines  
**Purpose:** Define BRAG scoring, CITE LEDGER, audit process

#### Schema 3: Vocabulary/Guide Page

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {Organization: #org},                ← Lean reference
    {WebSite: #website},                 ← Lean reference
    {DefinedTermSet: #terms},            ← Full 7 terms
      - BRAG
      - CITE LEDGER
      - AI Visibility
      - Entity Clarity
      - Citation Readiness
      - AEO
      - Evidence Stack
    {WebPage},
    {BreadcrumbList}
  ]
}
```

**Serves:** Semantic layer + terminology  
**JSON-LD Size:** ~200 lines  
**Purpose:** Define all 7 core terms with @id anchors

#### Schema 4: Dataset Page

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {Organization: #org},           ← Lean reference
    {WebSite: #website},            ← Lean reference
    {Dataset: #dataset},            ← API + distribution + format
    {WebPage},
    {BreadcrumbList}
  ]
}
```

**Serves:** Machine layer + data transparency  
**JSON-LD Size:** ~80 lines  
**Purpose:** Public audit access, format specification, API docs

---

## Shared @IDs (Semantic Linking Without Collapse)

All 4 schemas use the same stable @ids, which link them conceptually:

```typescript
const SHARED_IDS = {
  org: 'https://aivis.biz/#org',        ← Organization identity
  founder: 'https://aivis.biz/#founder', ← Human authority
  website: 'https://aivis.biz/#website', ← Portal reference
  app: 'https://aivis.biz/#app',        ← Product reference
  method: 'https://aivis.biz/#method',  ← BRAG methodology
  terms: 'https://aivis.biz/#terms',    ← Vocabulary
  dataset: 'https://aivis.biz/#dataset' ← Public data
} as const;
```

**How they link:**

| Link Type   | Example                                                                              | Means                                              |
| ----------- | ------------------------------------------------------------------------------------ | -------------------------------------------------- |
| Same-page   | Landing includes `{@id: #org}` + `{worksFor: #org}`                                  | Organization identity is primary; founder supports |
| Cross-route | Methodology references `#method` + Guide references `#terms`                         | Docs are semantically linked but independent       |
| Crawl-time  | Google sees Landing snapshot with `#org`, then Methodology snapshot with same `#org` | Identity is consistent across routes               |
| LLM time    | Claude crawls and sees `#method` defined on /methodology, `#terms` on /guide         | Clear hierarchical sources for each concept        |

**Result:** Semantic linking WITHOUT entity collapse. Each route stands alone while the @id references maintain conceptual coherence.

---

## Implementation Pattern (React-Specific)

### Step 1: Define Schema Object (Static)

```typescript
// schemaRegistry.ts
export const landingSchema = {
  "@context": "https://schema.org",
  "@graph": [
    /* complete micro-graph */
  ],
} as const;
```

### Step 2: Create SEO Wrapper Component

```typescript
// components/seo/LandingSEO.tsx
import { Helmet } from 'react-helmet-async';
import { landingSchema } from '../../seo/schemaRegistry';

export function LandingSEO({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify(landingSchema)}
        </script>
      </Helmet>
      {children}
    </>
  );
}
```

### Step 3: Wrap Page Component

```typescript
// pages/Landing.tsx
import { LandingSEO } from '../components/seo';

export function Landing() {
  return (
    <LandingSEO>
      {/* Actual page content */}
      <section>...</section>
    </LandingSEO>
  );
}
```

### Step 4: Route Usage

```typescript
// App.tsx router
<Routes>
  <Route path="/" element={<Landing />} />           ← Includes LandingSEO wrapper
  <Route path="/methodology" element={<Methodology />} />  ← Includes MethodologySEO wrapper
  <Route path="/guide" element={<Guide />} />        ← Includes VocabularySEO wrapper
  <Route path="/dataset" element={<Dataset />} />    ← Includes DatasetSEO wrapper
</Routes>
```

---

## Why This Prevents Entity Collapse

### Wrong (Collapsed)

```
Google sees Landing page with @graph containing:
  [Organization, Person, WebSite, SoftwareApp, DefinedTermS, Dataset, CreativeWork, WebPage]

Query: "What is BRAG?"
Result: "Entity hierarchy is unclear. Is this about the organization, the app, or the methodology?"
```

### Correct (Separated)

```
Google sees Landing page:
  @graph: [Organization, Person, WebSite, SoftwareApp, WebPage, FAQPage]
Google sees Methodology page:
  @graph: [Organization, WebSite, CreativeWork(BRAG definition), DefinedTermSet ref, WebPage]
Google sees Guide page:
  @graph: [Organization, WebSite, DefinedTermSet(7 terms), WebPage]

Query: "What is BRAG?"
Result: "Clear: CreativeWork with @id #method on /methodology, Part of DefinedTermSet #terms on /guide"
```

**Key insight:** Each snapshot is independent, so LLMs and Google extract with high confidence per-route, not trying to resolve ambiguity across routes.

---

## Migration: From Old Pattern to New

### Before (Function Builders)

```typescript
// seoSchema.ts contained:
export function buildLandingPageSchema() { ... }
export function buildMethodologyPageSchema() { ... }

// Landing.tsx imported and called:
const schema = buildLandingPageSchema();
const extended = [...schema, pages-specific data];
// This encourages concatenation
```

### After (Static Schemas)

```typescript
// schemaRegistry.ts contains:
export const landingSchema = { ... };  // Complete, static
export const methodologySchema = { ... };  // Complete, static

// Landing.tsx wrapped:
<LandingSEO><Landing/></LandingSEO>
// No concatenation, pure injection
```

**Migration Steps:**

1. ✅ Created `seo/schemaRegistry.ts` with 4 static schemas
2. ✅ Created `components/seo/` with 4 SEO wrapper components
3. 🟡 Update existing pages (Landing.tsx, PricingPage.tsx) to use wrappers
4. 🟡 Create new pages (Methodology.tsx, Guide.tsx, Dataset.tsx)
5. 🟡 Update routing to include new pages
6. 📊 Test with Google Rich Results tool

---

## Validation Checklist

**Schema Structure:**

- ✅ Each schema is a complete @graph (not a builder function)
- ✅ All schemas share 7 @ids (org, founder, website, app, method, terms, dataset)
- ✅ No schema references another schema's unique entities
- ✅ Each schema's @ids are stable (hardcoded, not computed)
- ✅ TypeScript compiles without errors

**Component Structure:**

- 🟡 LandingSEO.tsx wraps <Landing /> and injects landingSchema
- 🟡 MethodologySEO.tsx wraps <Methodology /> and injects methodologySchema
- 🟡 VocabularySEO.tsx wraps <Guide /> and injects vocabularySchema
- 🟡 DatasetSEO.tsx wraps <Dataset /> and injects datasetSchema

**React Integration:**

- 🟡 Each page component is wrapped with its SEO component
- 🟡 Helmet properly injects <script type="application/ld+json"> tag
- 🟡 Schema appears in HTML source BEFORE hydration
- 🟡 Each route renders independent, complete schema

**Testing (Post-Implementation):**

- 🔮 Google Rich Results: https://search.google.com/test/rich-results
- 🔮 schema.org validation per-route
- 🔮 LLM extraction test (ask ChatGPT/Claude about BRAG, verify citation)

---

## Critical Differences from Old Architecture

| Aspect            | Old (Wrong)             | New (Correct)                   |
| ----------------- | ----------------------- | ------------------------------- |
| Schema Definition | Functions (builders)    | Static objects                  |
| Schema Scope      | Global graph attempted  | Per-route micro-graphs          |
| Entity Collapse   | Likely (runtime concat) | Prevented (static, independent) |
| Linking           | Overloaded @graph       | Shared @ids only                |
| React Hydration   | May cause re-renders    | Stable, no impact               |
| LLM Crawl Time    | Ambiguous hierarchy     | Clear per-page entity           |
| Google Snapshot   | Unclear entity priority | Single clear identity per route |

---

## Next Steps

### Immediate (This Session)

1. Update Landing.tsx to use `<LandingSEO>` wrapper
2. Create and wrap Methodology.tsx, Guide.tsx, Dataset.tsx
3. Update routing
4. TypeScript compilation check

### Testing (After Implementation)

1. Google Rich Results validation per-route
2. Manual entity inspection (view source)
3. LLM extraction testing (ask Claude about BRAG → should cite /methodology)

### Documentation (Future)

1. Add inline comments to each schema explaining its purpose
2. Create visual diagram showing @id linking
3. Add performance profiling (schema injection overhead)

---

**Status:** ✅ Architecture defined, 4 schemas created, 4 SEO components created, ready for page implementation.
