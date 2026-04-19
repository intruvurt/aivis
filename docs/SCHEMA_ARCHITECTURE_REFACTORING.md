# Schema Architecture Refactoring: Separation of Concerns

**Date:** April 19, 2026  
**Status:** ✅ Complete and Compiled  
**Breaking Change:** Yes - new page builders, simplified landing schema

---

## The Problem (Before)

Previous architecture collapsed everything into one node:

```
Landing (@graph)
├─ Organization
├─ Founder
├─ Website
├─ SoftwareApplication ← Product
├─ DefinedTermSet ← Terminology (SHOULD BE ON GUIDE PAGE)
├─ Dataset ← Public audits (SHOULD BE ON DATASET PAGE)
├─ CreativeWork/Methodology ← BRAG logic (SHOULD BE ON METHODOLOGY PAGE)
├─ FAQPage ← Contextual (SHOULD BE METHODOLOGY'S FAQ)
├─ Product schema ← Pricing (OK HERE, better on pricing page)
└─ Breadcrumb, ItemList ← Navigation
```

**Results:**

- Diluted entity confidence (Google sees homepage as a database)
- Inconsistent LLM extraction (too much conceptual depth on identity layer)
- Weak canonical selection (methodology mixed with marketing messaging)
- Homepage JSON-LD ballooning to 800+ lines

---

## The Solution (After)

**Architectural Separation by Semantic Layer:**

### Layer 1: Landing Page (Identity + Platform Recognition)

**Purpose:** Conversion + AI platform recognition  
**Schema Size:** ~150-180 lines JSON-LD  
**Includes:**

- Organization (identity)
- Founder (person)
- Website (domain)
- SoftwareApplication (platform name)
- WebPage (landing page metadata)
- - Page extensions (breadcrumb, item list, product rating)

**What it DOES NOT include:**

- ❌ DefinedTermSet (→ goes to Vocabulary/Guide page)
- ❌ Dataset (→ goes to Dataset page)
- ❌ Methodology CreativeWork (→ goes to Methodology page)
- ❌ Full FAQ (contextual FAQ is methodology-specific)

**Result:** Clear entity identity for AI systems → high confidence

---

### Layer 2: Methodology Page (Truth Layer)

**Purpose:** Authority + citation depth + educational content  
**Schema Includes:**

- Organization (reference)
- Website (reference)
- CreativeWork for audit methodology (@id: #method)
  - BRAG definition
  - CITE LEDGER framework
  - Scoring system
  - Audit loop
  - Evidence ID structure
- DefinedTermSet (reference to #terms)
- WebPage (page metadata)
- FAQPage (methodology-specific questions)

**Key:** Owns the methodological story. BRAG and CITE LEDGER definitions live HERE.

**Rendered HTML includes:**

```html
<section id="brag">
  <h2>BRAG Framework</h2>
  <p>
    Based Retrieval and Auditable Grading ties every finding to real evidence...
  </p>
</section>

<section id="cite-ledger">
  <h2>CITE LEDGER</h2>
  <p>Immutable evidence registry with write-once structure...</p>
</section>

<section id="audit-loop">
  <h2>How Audits Work</h2>
  <ol>
    <li>Scrape → evidence IDs</li>
    <li>Label → validation</li>
    <li>Validate → persistence</li>
  </ol>
</section>

<section id="faq">
  <h3>FAQ</h3>
  <!-- Methodology-specific questions -->
</section>
```

---

### Layer 3: Vocabulary/Guide Page (Semantic Layer)

**Purpose:** Prevent entity collision, establish terminology  
**Schema Includes:**

- Organization (reference)
- Website (reference)
- DefinedTermSet (@id: #terms) with full hasDefinedTerm array:
  - BRAG (definition)
  - CITE LEDGER (definition)
  - AI Visibility (definition)
  - Entity Clarity (definition)
  - Citation Readiness (definition)
  - Answer Engine Optimization (definition)
  - Evidence Stack (definition)
- WebPage (page metadata, mainEntity: #terms)

**Key:** Single semantic authority. All LLMs reference this page for terminology.

**Result:** Every LLM knows what "AI Visibility" means because it's defined once at #terms.

---

### Layer 4: Dataset Page (Machine Layer)

**Purpose:** Machine consumption (no marketing language)  
**Schema Includes:**

- Organization (reference)
- Website (reference)
- Dataset (@id: #dataset)
  - encodingFormat: application/json
  - license: CC-BY-SA 4.0
  - distribution: API endpoint
  - keywords: machine-readable list
- WebPage (page metadata, mainEntity: #dataset)

**Key:** Pure data. No marketing. No narrative. Machines only.

**Rendered HTML includes:**

```json
{
  "schema": "https://schema.org/Dataset",
  "id": "https://aivis.biz/#dataset",
  "downloadUrl": "https://aivis.biz/api/v1/datasets/public-audits",
  "fields": {
    "auditId": "string (immutable)",
    "targetUrl": "string (URL)",
    "evidenceId": "string (audit-relative)",
    "category": "enum",
    "score": "0-100",
    "timestamp": "ISO8601"
  }
}
```

---

## Implementation Status

### ✅ Complete

- Refactored `seoSchema.ts` with architectural separation
- Landing page uses minimal schema (~160 lines JSON-LD vs 800+ before)
- Added new page builders:
  - `buildLandingPageSchema()` - identity layer
  - `buildMethodologyPageSchema()` - truth layer
  - `buildVocabularyPageSchema()` - semantic layer
  - `buildDatasetPageSchema()` - machine layer
- TypeScript compilation: ✅ No errors
- Landing.tsx updated and working
- PricingPage.tsx uses pricing schema correctly

### 🟡 Remaining (For Future Implementation)

**Create these pages:**

1. **Methodology.tsx** (at `/methodology`)

   ```tsx
   import { buildMethodologyPageSchema } from "../lib/seoSchema";
   import { usePageMeta } from "../hooks/usePageMeta";

   const Methodology = () => {
     usePageMeta({
       title: "Audit Methodology - AiVIS",
       description:
         "How AiVIS audits AI visibility: BRAG framework, scoring, audit loop, evidence scoring.",
       path: "/methodology",
       structuredData: buildMethodologyPageSchema(),
     });
     // Render sections: BRAG definition, CITE LEDGER, scoring, audit loop, FAQ
   };
   ```

2. **Guide.tsx** (at `/guide` or `/terms`)

   ```tsx
   import { buildVocabularyPageSchema } from "../lib/seoSchema";

   const Guide = () => {
     usePageMeta({
       title: "Terminology - AiVIS",
       description:
         "Canonical definitions: AI Visibility, Citation Readiness, BRAG, CITE LEDGER...",
       path: "/guide",
       structuredData: buildVocabularyPageSchema(),
     });
     // Render DefinedTerms: BRAG, CITE LEDGER, AI Visibility, etc.
   };
   ```

3. **Dataset.tsx** (at `/dataset`)

   ```tsx
   import { buildDatasetPageSchema } from "../lib/seoSchema";

   const Dataset = () => {
     usePageMeta({
       title: "Public Dataset - AiVIS",
       description:
         "Machine-readable dataset: public audit reports, evidence structures, JSON API.",
       path: "/dataset",
       structuredData: buildDatasetPageSchema(),
     });
     // Render: API endpoint, field definitions, download, versioning rules
   };
   ```

---

## Why This Architecture Wins

### 1. Clear Entity Identity

- **Before:** Homepage was a database of 5+ entity types → Google confused about what AiVIS is
- **After:** Clear hierarchy: Landing = Platform Identity, Methodology = How it Works, Guide = Terminology

### 2. Reduced LLM Confusion

- **Before:** ChatGPT sees BRAG definition on landing page → thinks it's marketing
- **After:** Claude checks `/methodology` (#method) for BRAG truth → higher extraction confidence

### 3. Scalability

- New conceptual pages don't bloat the landing schema
- Each page is independent semantic unit
- Adding "Competitors" or "API" pages doesn't affect other entity definitions

### 4. JSON-LD Size

- **Landing before:** ~800 lines (org + founder + website + app + terminology + dataset + methodology + faq + product + breadcrumb + itemlist)
- **Landing after:** ~160 lines (org + founder + website + app + breadcrumb + itemlist + product)
- **Methodology:** ~200 lines (org + website + methodology + terminology + faq)
- **Guide/Vocabulary:** ~300 lines (org + website + full DefinedTermSet)
- **Dataset:** ~150 lines (org + website + dataset + distribution)

**Total:** Same content, better distributed. Each page is <300 lines.

### 5. Semantic Web Best Practices

- Follows schema.org entity-locking pattern
- Each @id used consistently across all pages
- References via @id prevent definition duplication
- Canonical URLs enable entity disambiguation

---

## Testing Checklist

```
🟢 TypeScript Compilation
  ✓ seoSchema.ts compiles
  ✓ Landing.tsx compiles
  ✓ PricingPage.tsx compiles

🟡 Pages to Create & Test
  □ Methodology.tsx
    □ Renders buildMethodologyPageSchema()
    □ BRAG section with full definition
    □ CITE LEDGER explanation
    □ Scoring breakdown
    □ Audit loop visual
    □ FAQ section

  □ Guide.tsx (Vocabulary)
    □ Renders buildVocabularyPageSchema()
    □ 7 DefinedTerms rendered
    □ Each term has description + @id

  □ Dataset.tsx
    □ Renders buildDatasetPageSchema()
    □ API endpoint documented
    □ Field definitions table
    □ JSON-LD embedded

🟢 Schema Validation
  □ Google Rich Results test for each page
  □ Verify @ids resolve correctly
  □ Check entity hierarchy in network inspector
  □ Validate with schema.org validator
  □ Inspect JSON-LD output size per page

🟢 LLM Testing
  □ Ask ChatGPT: "What is BRAG?" (should reference /methodology#method)
  □ Ask Claude: "Explain AI Visibility" (should reference /guide#terms)
  □ Verify entity @ids are consistent
```

---

## Migration Notes

**Backward Compatibility:**

- Old `buildMethodologyPageSchema()` was empty → now returns full methodology schema
- Old `buildGuidePageSchema()` included terminology → now renamed to `buildVocabularyPageSchema()`
- New `buildLandingPageSchema()` returns only lean entities → Landing.tsx extends it locally

**Breaking Changes:**

- ❌ Don't call `buildLandingPageSchema()` directly expecting terminology
- ✅ Call it, then extend with breadcrumbs/items/faq locally
- ✅ Use `buildMethodologyPageSchema()` for methodology page
- ✅ Use `buildVocabularyPageSchema()` for guide/terms page

---

## File Changes Summary

| File              | Change                                        | Impact                               |
| ----------------- | --------------------------------------------- | ------------------------------------ |
| `seoSchema.ts`    | Complete refactor: LEAN_ENTITIES + 4 builders | ✅ Cleaner, architectural separation |
| `Landing.tsx`     | No breaking changes, already extends schema   | ✅ Still works, now simpler          |
| `PricingPage.tsx` | Already using page-specific schema            | ✅ Still works                       |
| `Methodology.tsx` | TBD: Create with buildMethodologyPageSchema() | 🟡 To implement                      |
| `Guide.tsx`       | TBD: Create with buildVocabularyPageSchema()  | 🟡 To implement                      |
| `Dataset.tsx`     | TBD: Create with buildDatasetPageSchema()     | 🟡 To implement                      |

---

## Architecture Diagram

```
SCHEMA_ENTITIES (Lean, All Pages Reference)
├─ Organization (#org)
├─ Founder (#founder)
├─ Website (#website)
└─ SoftwareApplication (#app)

Landing.tsx (@graph)
├─ LEAN_ENTITIES (4 items)
└─ + Page-local extensions (breadcrumb, itemlist, product, rating)

Methodology.tsx (@graph)
├─ LEAN_ENTITIES (2 items: org, website)
├─ CreativeWork for Methodology (#method)
├─ Reference: DefinedTermSet (#terms)
└─ FAQPage

Guide.tsx (Vocabulary) (@graph)
├─ LEAN_ENTITIES (2 items: org, website)
├─ DefinedTermSet with 7 terms (#terms)
│  ├─ BRAG
│  ├─ CITE LEDGER
│  ├─ AI Visibility
│  ├─ Entity Clarity
│  ├─ Citation Readiness
│  ├─ Answer Engine Optimization
│  └─ Evidence Stack
└─ WebPage

Dataset.tsx (@graph)
├─ LEAN_ENTITIES (2 items: org, website)
├─ Dataset (#dataset)
└─ Distribution (API format)

Pricing.tsx (@graph)
├─ LEAN_ENTITIES (2 items: org, website)
├─ Product schema with offers
└─ FAQPage for pricing questions
```

---

## Next: Implement Missing Pages

Each file follows this template:

```tsx
import { usePageMeta } from "../hooks/usePageMeta";
import { buildMethodologyPageSchema } from "../lib/seoSchema"; // or other builder

const MethodologyPage = () => {
  usePageMeta({
    title: "Audit Methodology - AiVIS",
    description:
      "How AI visibility audits work: BRAG framework, scoring, audit loop.",
    path: "/methodology",
    ogTitle: "How AiVIS Audits Work",
    structuredData: buildMethodologyPageSchema(),
  });

  return (
    <div className="...)">
      {/* Content sections matching schema entities */}
    </div>
  );
};

export default MethodologyPage;
```

---

## References

- Original Issue: Schema consolidation with architectural separation
- Pattern: Entity-locking via @id anchors (schema.org best practice)
- Files Modified: `seoSchema.ts`, `Landing.tsx`, `PricingPage.tsx`
- Documentation: This file + code comments in seoSchema.ts
