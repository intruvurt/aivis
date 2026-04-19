# AiVIS Content Architecture — Citation Attractor System

## Core Insight

You're not building pages. You're building a **structured knowledge graph that AI engines cite reliably**.

Two layer problem:

1. **Authority Pages (100)** — Manually curated, backlink targets, definitions of truth
2. **Context Pages (1000+)** — Templated, generated, long-tail capture, query variations

## Layer 1: Authority Pages (100)

These are your pillars. Heavily optimized. Canonical anchor points.

### A. Definition Pages (10)

| URL                                 | Purpose              | Audience               | Schema                             |
| ----------------------------------- | -------------------- | ---------------------- | ---------------------------------- |
| `/what-is-aivis`                    | Platform definition  | Founder/decision maker | Organization + SoftwareApplication |
| `/what-is-ai-visibility`            | Core concept         | SEO/content manager    | CreativeWork + DefinedTerm         |
| `/what-is-cite-ledger`              | Framework definition | Developer/analyst      | CreativeWork + Method              |
| `/what-is-brag`                     | Evidence model       | Technical              | CreativeWork + Method              |
| `/ai-citation-ready`                | Ready state          | User goal              | DefinedTerm                        |
| `/ai-vs-seo-difference`             | Comparison           | Researcher             | ComparisonChart                    |
| `/why-ai-engines-skip-sites`        | Problem framing      | Pain point             | Article + FAQPage                  |
| `/how-schema-affects-ai-visibility` | Technical            | Developer              | HowTo + Article                    |
| `/structured-data-for-ai`           | Implementation       | Technical              | Article + ItemList                 |
| `/canonical-tags-ai-indexing`       | Technical SEO        | SEO specialist         | Article + TechArticle              |

### B. Methodology Pages (8)

| URL                           | Purpose                | 8 Dimensions          | Schema               |
| ----------------------------- | ---------------------- | --------------------- | -------------------- |
| `/audit-methodology`          | Overall framework      | All 8                 | CreativeWork + HowTo |
| `/entity-resolution-audit`    | Dimension: Entity      | Entity clarity        | Method               |
| `/indexation-audit`           | Dimension: Indexation  | Coverage              | Method               |
| `/semantic-consistency-audit` | Dimension: Consistency | Drift                 | Method               |
| `/citation-likelihood-audit`  | Dimension: Citation    | Probability           | Method               |
| `/structured-data-audit`      | Dimension: Schema      | Coverage              | Method               |
| `/distributed-signals-audit`  | Dimension: Signals     | Channels              | Method               |
| `/ai-parsability-audit`       | Dimension: AI Parsing  | LLM extraction        | Method               |
| `/trust-vectors-audit`        | Dimension: Trust       | Authority + freshness | Method               |

### C. Comparison Pages (12)

| URL                                  | Purpose                                      | Schema          |
| ------------------------------------ | -------------------------------------------- | --------------- |
| `/aivis-vs-ahrefs`                   | Competitive positioning                      | ComparisonChart |
| `/aivis-vs-semrush`                  | Competitive positioning                      | ComparisonChart |
| `/ai-visibility-vs-keyword-ranking`  | Concept positioning                          | ComparisonChart |
| `/answer-engine-comparison`          | ChatGPT vs Perplexity vs Google AI vs Claude | ComparisonChart |
| `/brag-vs-attribution-models`        | Evidence framework comparison                | ComparisonChart |
| `/json-ld-vs-microdata-vs-rdfa`      | Schema format comparison                     | ComparisonChart |
| `/canonical-tags-vs-noindex`         | Meta strategy comparison                     | ComparisonChart |
| `/seo-schema-vs-ai-schema`           | Schema strategy comparison                   | ComparisonChart |
| `/manual-audit-vs-automated`         | Process comparison                           | ComparisonChart |
| `/free-vs-paid-tools`                | Tool comparison                              | ComparisonChart |
| `/observer-vs-starter-tiers`         | Product positioning                          | ItemList        |
| `/site-audit-vs-competitor-tracking` | Feature comparison                           | ComparisonChart |

### D. Use Case Pages (15)

| URL                                       | Intent     | Audience         | Schema                   |
| ----------------------------------------- | ---------- | ---------------- | ------------------------ |
| `/for-saas-founders`                      | Use case   | Startup founder  | WebPage + FAQPage        |
| `/for-content-agencies`                   | Use case   | Agency           | WebPage + FAQPage        |
| `/for-seo-managers`                       | Use case   | In-house SEO     | WebPage + FAQPage        |
| `/for-enterprise`                         | Use case   | Corporate        | WebPage + FAQPage        |
| `/answer-engine-optimization`             | Trend      | Practitioner     | Article + HowTo          |
| `/ai-citation-strategy`                   | Strategy   | Content leader   | Article + GuideList      |
| `/content-visibility-audit`               | Action     | Content manager  | HowTo                    |
| `/schema-org-implementation`              | Action     | Developer        | HowTo + ItemList         |
| `/entity-clarity-guide`                   | Action     | Technical writer | HowTo + FAQPage          |
| `/structured-data-for-answer-engines`     | Action     | SEO strategist   | HowTo + DefinedTermSet   |
| `/preventing-ai-answers-without-citation` | Problem    | Publisher        | Article + FAQPage        |
| `/ai-search-indexing-checklist`           | Checklist  | Auditor          | CheckList                |
| `/content-repurposing-for-ai`             | Strategy   | Content team     | Article + HowTo          |
| `/competitor-citation-tracking`           | Monitoring | Analyst          | Article + Dashboard spec |
| `/measuring-ai-market-share`              | Business   | Executive        | Article + Chart spec     |

### E. Tier/Pricing Pages (10)

| URL                     | Intent         | Schema                   |
| ----------------------- | -------------- | ------------------------ |
| `/pricing`              | Main pricing   | PricingTable             |
| `/observer-tier`        | Free tier      | BreadcrumbList + FAQPage |
| `/starter-tier`         | $15/mo         | BreadcrumbList + FAQPage |
| `/alignment-tier`       | $49/mo         | BreadcrumbList + FAQPage |
| `/signal-tier`          | $149/mo        | BreadcrumbList + FAQPage |
| `/scorefix-tier`        | $299 one-time  | BreadcrumbList + FAQPage |
| `/tier-comparison`      | Feature matrix | ComparisonTable          |
| `/upgrade-guide`        | Migration      | HowTo                    |
| `/discount-codes`       | Promos         | ItemList                 |
| `/enterprise-licensing` | Volume         | BreadcrumbList + FAQPage |

### F. Learning Path Pages (8)

| URL                           | Intent              | Schema                 |
| ----------------------------- | ------------------- | ---------------------- |
| `/getting-started`            | New user            | GuideList + HowTo      |
| `/audit-interpretation-guide` | How to read results | HowTo + FAQPage        |
| `/evidence-ids-explained`     | BRAG deep dive      | Article + FAQPage      |
| `/using-recommendations`      | Action on findings  | HowTo                  |
| `/exporting-reports`          | Feature guide       | HowTo + FAQPage        |
| `/api-integration`            | Developer guide     | TechArticle + ItemList |
| `/oauth-setup`                | Integration         | HowTo + FAQPage        |
| `/team-collaboration`         | Workspace feature   | HowTo + FAQPage        |

**Authority Pages Total: ~63 pages**

---

## Layer 2: Context Pages (1000+)

These are **generated from templates**. Long-tail semantic capture. Not manually edited.

### Pattern 1: "Why AI skips X"

Template:

```
/why-ai-skips-[entity-type]
```

Generated for:

- News sites
- SaaS websites
- Ecommerce stores
- Nonprofits
- Directories
- APIs
- Docs sites
- Personal blogs
- Educational institutions
- Research papers

**Count: 10 variations × entity type combos = ~50 pages**

Example:

- `/why-ai-skips-news-sites`
- `/why-ai-skips-saas-documentation`
- `/why-ai-skips-product-pages`

### Pattern 2: "[Dimension] for [Entity Type]"

Template:

```
/[dimension]-audit-for-[entity-type]
```

Generated for:

- 8 dimensions (entity_resolution, indexation, semantic_consistency, citation_likelihood, structured_data, distributed_signals, ai_parsability, trust_vectors)
- 10 entity types (news, saas, ecommerce, nonprofit, directory, api, docs, blog, educational, research)

**Count: 8 × 10 = ~80 pages**

Example:

- `/structured-data-audit-for-saas-sites`
- `/entity-resolution-audit-for-news-publishers`
- `/ai-parsability-audit-for-api-documentation`

### Pattern 3: "[Topic] for [Answer Engine]"

Template:

```
/[topic]-for-[answer-engine]
```

Generated for:

- Topics: entity-clarity, schema-coverage, heading-structure, content-depth, citation-signals, indexation-strategy, content-freshness
- Answer Engines: ChatGPT, Perplexity, Google-AI, Claude, Llama, Grok

**Count: 7 × 6 = ~42 pages**

Example:

- `/entity-clarity-for-chatgpt`
- `/schema-coverage-for-perplexity`
- `/citation-signals-for-google-ai`

### Pattern 4: "How [Action] affects [AI-Dimension]"

Template:

```
/how-[action]-affects-[dimension]
```

Actions: redirects, canonicals, noindex, robots-txt, sitemap, schema-markup, h1-optimization, url-structure, internal-linking, content-clustering

**Count: 10 × 8 = ~80 pages**

Example:

- `/how-redirects-affect-citation-likelihood`
- `/how-robots-txt-affects-indexation`
- `/how-schema-markup-affects-ai-parsability`

### Pattern 5: "[Question] About [Concept]"

Template:

```
/[question]-about-[concept]
```

Questions: what-is, why, how, when, where, who, which
Concepts: BRAG, CITE LEDGER, schema.org, canonical tags, entities, evidence, audits, recommendations

**Count: 7 × 8 = ~56 pages**

Example:

- `/what-is-evidence-binding`
- `/why-does-canonical-matter-for-ai`
- `/how-do-evidence-ids-work`

### Pattern 6: "[Comparison] For [Decision Maker]"

Template:

```
/[comparison]-for-[decision-maker]
```

Comparisons: approach-1-vs-approach-2, tool-1-vs-tool-2, strategy-1-vs-strategy-2
Decision Makers: founder, seo-manager, content-director, cto, product-manager, marketing-director

**Count: ~15 comparisons × 6 personas = ~90 pages**

Example:

- `/manual-audit-vs-automated-for-founder`
- `/canonical-strategy-vs-noindex-for-seo-manager`
- `/observer-tier-vs-starter-tier-for-saas-cto`

### Pattern 7: "[Entity Type] Citation Strategy"

Template:

```
/[entity-type]-citation-strategy
```

Entity Types: news-site, saas-company, ecommerce-store, nonprofit-org, research-institution, personal-brand, documentation-site, api-provider, marketplace, directory

**Count: 10 pages**

Example:

- `/saas-citation-strategy`
- `/news-site-citation-strategy`
- `/research-institution-citation-strategy`

### Pattern 8: Long-Tail Question Clusters

Template:

```
/[long-tail-question-variation]
```

These are **query variations** that don't fit templates. Generated from:

- SEMrush/Ahrefs long-tail keyword exports
- People Also Ask scrapes
- Answer engine query logs (if available)
- FAQ section variations

**Count: 400+ pages**

Examples:

- `/how-do-answer-engines-decide-what-to-cite`
- `/why-doesnt-my-site-show-up-in-ai-answers`
- `/what-makes-content-citation-ready`
- `/can-you-block-ai-from-reading-your-site`
- `/do-canonical-tags-help-with-perplexity`

### Pattern 9: Entity Intersection Pages

Template:

```
/[concept-1]-[concept-2]-intersection
```

These capture combinations of concepts that co-occur in searcher intent:

- schema + seo + ai
- entities + canonicals + citations
- structured-data + answer-engines + indexing

**Count: 150+ pages**

Example:

- `/schema-org-and-answer-engine-indexing`
- `/canonical-tags-and-ai-visibility`
- `/entity-clarity-and-citation-likelihood`

**Context Pages Total: ~1000+ pages**

---

## Layer 3: URL Schema & Canonical Rules

### URL Structure

```
Authority pages:
/[noun]-[adjective]            → /ai-visibility
/what-is-[concept]             → /what-is-cite-ledger
/[concept]-for-[persona]       → /answer-engine-optimization-for-founders
/[concept]-[concept]           → /schema-org-implementation

Context pages (templated):
/why-ai-skips-[entity]         → /why-ai-skips-saas
/[dimension]-audit-for-[type]  → /entity-resolution-audit-for-news
/how-[action]-affects-[dim]    → /how-redirects-affect-citation-likelihood
/[question]-about-[concept]    → /what-is-evidence-binding
```

### Canonical Hierarchy

```
Primary canonical (highest authority):
/audit-methodology
↓ references ↓
/entity-resolution-audit (dimension deep dive)
↓ references ↓
/entity-resolution-audit-for-[type] (contextual variant)
↓ cross-references ↓
/why-ai-skips-[type] (related topic)
```

**Rule: Each canonical points to parent authority page**

```html
<!-- /entity-resolution-audit-for-saas (context page) -->
<link rel="canonical" href="https://aivis.biz/entity-resolution-audit" />
<!-- But internally links to variant AND parent -->
```

### Canonical Ruleset

1. **One canonical per intent cluster**
   - "What is entity clarity?" → `/what-is-aivis` (primary) or `/entity-resolution-audit` (secondary)
   - All variants (for-saas, for-news, etc.) point to authority page
2. **Internal graph linking (not canonical)**
   - Context pages link to each other `<a href>` (not rel=canonical)
   - Creates semantic graph for AI crawlers
   - Helps distribute authority without dilution

3. **Answer engine priority**
   - ChatGPT/Claude prefer deep, long-form authority pages
   - Perplexity likes clustered, comparison-heavy content
   - Google AI Overviews prefer structured + FAQ pages
4. **Fragment identifiers for sections**
   ```html
   <!-- /entity-resolution-audit#for-saas -->
   <!-- /entity-resolution-audit#for-news -->
   ```
   (Fragments are NOT visited by most crawlers, so still canonical is parent)

---

## Layer 4: Content Graph Model

```sql
-- Core nodes
CREATE TABLE content_nodes (
  node_id UUID PRIMARY KEY,
  node_type ENUM('definition', 'methodology', 'comparison', 'use_case', 'tier', 'learning', 'contextual'),
  title VARCHAR,
  slug VARCHAR UNIQUE,
  canonical_url VARCHAR,

  -- Graph relationships
  parent_node_id UUID REFERENCES content_nodes(node_id),
  internal_links UUID[] ARRAY,

  -- SEO metadata
  target_intent VARCHAR, -- 'answer', 'comparison', 'definition', 'action'
  target_audience VARCHAR, -- 'founder', 'seo-manager', 'developer'
  search_volume INT,
  difficulty INT,

  -- Schema
  schema_type VARCHAR, -- 'Article', 'HowTo', 'ComparisonChart', etc.

  -- Content
  template_id VARCHAR, -- links to generator template
  is_generated BOOLEAN,
  generated_at TIMESTAMP,
  manual_edits_at TIMESTAMP,

  -- Citation framework
  cite_ledger_referenced BOOLEAN,
  evidence_ids VARCHAR[],
  authority_score FLOAT
);

-- Entity types for context generation
CREATE TABLE entity_types (
  entity_type_id UUID PRIMARY KEY,
  name VARCHAR, -- 'saas-company', 'news-site'
  description TEXT,
  example_entity VARCHAR
);

-- Dimensions
CREATE TABLE dimensions (
  dimension_id UUID PRIMARY KEY,
  name VARCHAR, -- 'entity_resolution', 'indexation'
  description TEXT,
  order_in_audit INT
);

-- Template definitions
CREATE TABLE generator_templates (
  template_id UUID PRIMARY KEY,
  template_name VARCHAR, -- 'why-ai-skips-[type]'
  url_pattern VARCHAR,
  h1_pattern VARCHAR,
  body_template TEXT, -- Handlebars/EJS template
  schema_template TEXT,
  internal_link_rules TEXT,
  canonical_rule TEXT,

  variables_needed VARCHAR[], -- ['entity_type', 'dimension']

  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Links (graph structure)
CREATE TABLE content_edges (
  source_node_id UUID REFERENCES content_nodes(node_id),
  target_node_id UUID REFERENCES content_nodes(node_id),
  relationship_type ENUM('child', 'variant', 'related', 'comparison'),
  anchor_text VARCHAR,
  PRIMARY KEY (source_node_id, target_node_id)
);
```

---

## Layer 5: Generator Blueprint

### Input

```
entity_types = [
  'news-site', 'saas-company', 'ecommerce-store', 'nonprofit',
  'directory', 'api', 'docs', 'blog', 'educational', 'research'
]

dimensions = [
  'entity_resolution', 'indexation', 'semantic_consistency',
  'citation_likelihood', 'structured_data', 'distributed_signals',
  'ai_parsability', 'trust_vectors'
]

answer_engines = [
  'ChatGPT', 'Perplexity', 'Google-AI', 'Claude', 'Llama', 'Grok'
]

decision_makers = [
  'founder', 'seo-manager', 'content-director', 'cto',
  'product-manager', 'marketing-director'
]
```

### Process

```
1. Load templates from generator_templates table
2. For each template:
   a. Get variables needed (entity_types, dimensions, etc.)
   b. Generate cartesian product of all combinations
   c. For each combination:
      - Render URL slug
      - Render h1 from pattern
      - Render body from template (with variables)
      - Render schema.org from schema_template
      - Generate internal_links from rules
      - Set canonical from canonical_rule
3. Write all pages to output directory
4. Write sitemap
5. Write robots.txt with crawl hints
```

### Output Per Page

```
/context-page-[n].html

<html>
  <head>
    <title>{generated_title}</title>
    <link rel="canonical" href="{canonical_url}" />
    <meta name="description" content="{generated_description}" />
    <script type="application/ld+json">
      {rendered_schema}
    </script>
  </head>
  <body>
    <h1>{generated_h1}</h1>
    <article>{rendered_body}</article>
    <section class="internal-links">
      {generated_internal_links}
    </section>
    <section id="citation-core" aria-hidden="true">
      {CITE_LEDGER_BLOCK}
    </section>
  </body>
</html>
```

---

## Layer 6: Build-Time Entity Graph Compiler

**Concept:** Instead of runtime schema injection, the Vite build system classifies routes at build time and emits route-aware schema variants. All pages share a unified retrieval spine to prevent citation drift across the entity graph.

### AIVISSitemapCompiler: Route Classification

At build time, the compiler:

1. Reads `routes.json` (route → type mapping)
2. Classifies each route (home / blog / docs / dataset / ontology)
3. Assigns semantic schema variant per route type
4. Injects consistent retrieval spine into every page
5. Emits `<script type="application/ld+json">` into `</head>`

**Schema Variants Per Route Type:**

| Route Type | Schema Output  | Example                      | Benefit                                      |
| ---------- | -------------- | ---------------------------- | -------------------------------------------- |
| home       | WebSite + Org  | `/`                          | Establishes organizational entity anchor     |
| blog       | BlogPosting    | `/blog/*`                    | LLMs classify as article/opinion             |
| docs       | TechArticle    | `/docs/*`                    | LLMs treat as authoritative technical source |
| dataset    | Dataset        | `/dataset`                   | LLMs recognize structured data collection    |
| ontology   | DefinedTermSet | `/terms`, `/ontology`        | LLMs see canonical vocabulary                |
| page       | WebPage        | Default for undefined routes | Generic fallback                             |

### Output Per Page

**HTML (human-readable):**

```html
<h1>Why AI Skips SaaS Websites</h1>
<p>Most SaaS documentation ...</p>
<section id="citation-core" aria-hidden="true"></section>
```

**JSON-LD injected into `</head>` (machine-readable):**

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://aivis.biz#org",
      "name": "AiVIS",
      "description": "AI visibility, entity resolution, and citation behavior in generative answer engines",
      "knowsAbout": [
        "AI visibility",
        "entity resolution",
        "citation behavior",
        "answer engine interpretation",
        "semantic disambiguation"
      ]
    },
    {
      "@type": "TechArticle",
      "url": "https://aivis.biz/why-ai-skips-saas",
      "headline": "Why AI Skips SaaS Websites",
      "about": "AI visibility, entity resolution, and citation behavior in generative answer engines"
    }
  ]
}
```

### Entity Coherence Across 1000+ Pages

**Retrieval Spine (injected into every page's schema):**

```
"AI visibility, entity resolution, and citation behavior in generative answer engines"
```

**Effect on LLM indexing:**

- Every page mentions the same core concepts
- Reduces ambiguity in citation selection
- Creates stable entity cluster (not scattered definitions)
- Answer engines recognize unified entity graph instead of 1000 isolated pages

---

## Layer 7: Route Classification + Crawler Hints

### routes.json (Compiler Input)

Create `/routes.json` — tells the Vite compiler how to classify each route. This is the **source of truth**:

```json
[
  {
    "path": "/",
    "type": "home",
    "priority": 1.0,
    "changeFreq": "monthly"
  },
  {
    "path": "/what-is-*",
    "type": "ontology",
    "priority": 0.9,
    "changeFreq": "quarterly",
    "schema_note": "DefinedTermSet — canonical vocabulary"
  },
  {
    "path": "/audit-methodology",
    "type": "docs",
    "priority": 0.9,
    "changeFreq": "monthly",
    "schema_note": "TechArticle — authoritative technical source"
  },
  {
    "path": "/why-ai-*",
    "type": "blog",
    "priority": 0.7,
    "changeFreq": "quarterly",
    "schema_note": "BlogPosting — contextual insights"
  },
  {
    "path": "/[dimension]-audit-for-*",
    "type": "blog",
    "priority": 0.7,
    "changeFreq": "quarterly",
    "schema_note": "BlogPosting — dimension-specific analysis"
  },
  {
    "path": "/how-*",
    "type": "blog",
    "priority": 0.7,
    "changeFreq": "quarterly",
    "schema_note": "BlogPosting — how-to guides"
  },
  {
    "path": "/dataset",
    "type": "dataset",
    "priority": 0.8,
    "changeFreq": "weekly",
    "schema_note": "Dataset — structured data collection"
  },
  {
    "path": "/for-*",
    "type": "page",
    "priority": 0.7,
    "changeFreq": "monthly",
    "schema_note": "WebPage — use-case pages"
  },
  {
    "path": "/pricing*",
    "type": "page",
    "priority": 0.8,
    "changeFreq": "monthly",
    "schema_note": "WebPage — pricing"
  }
]
```

### /url-schema.json (Crawler Discovery)

Create `/public/url-schema.json` — published file that tells crawlers about your entity graph:

```json
{
  "schema_version": "1.0",
  "generated_at": "2026-04-19T00:00:00Z",
  "domain": "aivis.biz",

  "canonical_rules": {
    "context_pages": "context variants point canonical up to authority",
    "variants": "use fragment identifiers, share authority canonical"
  },

  "page_categories": [
    {
      "category": "authority",
      "count": 63,
      "crawl_priority": 1.0,
      "cache_ttl": "604800 (7 days)",
      "examples": ["/what-is-aivis", "/audit-methodology", "/for-saas-founders"]
    },
    {
      "category": "context",
      "count": 1000,
      "crawl_priority": 0.7,
      "cache_ttl": "2592000 (30 days)",
      "examples": [
        "/why-ai-skips-saas",
        "/entity-resolution-audit-for-ecommerce"
      ]
    }
  ],

  "entity_graph": {
    "central_nodes": [
      "#org (Organization)",
      "#site (WebSite)",
      "RETRIEVAL_SPINE: AI visibility + entity resolution + citation behavior"
    ],
    "schema_types_per_route": {
      "home": "Organization + WebSite + WebPage",
      "ontology": "DefinedTermSet + DefinedTerm nodes",
      "docs": "TechArticle",
      "blog": "BlogPosting",
      "dataset": "Dataset",
      "page": "WebPage"
    },
    "coherence_method": "All pages share same retrieval spine, prevents citation drift"
  }
}
```

---

## Layer 8: Deployment Architecture (Railway API + Cloudflare Static)

### Build & Generation (Local or CI/CD)

```bash
# Authority pages
npm run generate:authority  # ~63 pages, ~10s

# Context pages
npm run generate:context    # ~1000 pages, ~2m

# Static export
next export                 # or astro build

# Output: /public/ directory with 1000+ HTML files
# Size: ~500MB uncompressed, ~50MB gzipped

du -sh public/
# Output: 500M     public/
```

### Split Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Your AiVIS System                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────┐  ┌──────────────────────┐ │
│  │  Railway API Server          │  │  Cloudflare Static   │ │
│  ├──────────────────────────────┤  ├──────────────────────┤ │
│  │ • Express.js                 │  │ • 1000+ HTML pages   │ │
│  │ • PostgreSQL                 │  │ • Global CDN         │ │
│  │ • /api/* routes              │  │ • Auto-compression   │ │
│  │ • Enterprise audit engine    │  │ • Cache rules        │ │
│  │ • Auth + webhooks            │  │ • Instant global     │ │
│  │                              │  │                      │ │
│  │ URL: api.aivis.biz:3000      │  │ URL: *.aivis.biz/*   │ │
│  └──────────────────────────────┘  └──────────────────────┘ │
│           ↑                                ↑                 │
│           └────────────────────────────────┘                 │
│          (Cloudflare Workers proxy          │
│           /api/* calls to Railway)          │
│                                                 │
└─────────────────────────────────────────────────────────────┘
```

### Step 1: Railway API (No Changes)

Your existing Railway setup is **unchanged**:

- Express server handles `/api/analyze`, `/api/audits`, `/api/auth/*`
- PostgreSQL database for users, cache, usage tracking
- Enterprise audit engine + CITE LEDGER integration

This layer stays as-is. No modifications needed.

---

### Step 2: Deploy Static Pages to Cloudflare Pages

**A. Generate pages locally**

```bash
npm run generate:authority && npm run generate:context
# Output: /public/ with 1000+ .html files
```

**B. Set up Cloudflare Pages**

In `wrangler.toml`:

```toml
name = "aivis-pages"
type = "javascript"
account_id = "your-accountid"
workers_dev = true

[build]
cwd = "./"
command = "npm run generate:context"

[triggers.crons]
crons = ["0 0 * * 0"]  # Weekly regeneration

[env.production]
route = "aivis.biz/*"
zone_id = "your-zone-id"
routes = [
  { pattern = "aivis.biz/what-is-*", zone_id = "your-zone-id" },
  { pattern = "aivis.biz/why-ai-*", zone_id = "your-zone-id" },
  { pattern = "aivis.biz/[dimension]-audit-*", zone_id = "your-zone-id" }
]
```

**C. Deploy to Cloudflare Pages**

```bash
# Install Wrangler
npm install -g wrangler

# Authenticate
wrangler login

# Deploy pages
wrangler pages publish public/ --project-name=aivis-pages

# Verify
curl -I https://aivis.biz/what-is-aivis
# Should show Cloudflare headers + instant response
```

---

### Step 3: Set Up Cache Rules (Cloudflare Dashboard)

Navigate to Cloudflare Dashboard → aivis.biz → Caching → Cache Rules

```
Rule 1: Authority Pages (Immutable, 7 days)
  Path: /what-is-* OR /audit-methodology OR /for-*
  Cache Level: Cache Everything
  TTL: 604800 seconds (7 days)
  Browser TTL: 86400 seconds (1 day)

Rule 2: Context Pages (30 days)
  Path: /why-ai-* OR /[dimension]-audit-for-* OR /how-*
  Cache Level: Cache Everything
  TTL: 2592000 seconds (30 days)
  Browser TTL: 604800 seconds (7 days)

Rule 3: Dynamic (No cache)
  Path: /api/*
  Cache Level: Bypass
```

---

### Step 4: Cloudflare Worker for API Proxying

If `/api/*` calls need to route through Cloudflare to Railway:

Create `worker.js` at repo root:

```javascript
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Route /api/* to Railway
    if (url.pathname.startsWith("/api/")) {
      const railwayUrl = new URL(
        url.pathname + url.search,
        "https://api.railway.app",
      );

      return fetch(
        new Request(railwayUrl, {
          method: request.method,
          headers: request.headers,
          body: request.body,
        }),
      );
    }

    // Serve static pages from Cloudflare cache
    return env.ASSETS.fetch(request);
  },
};
```

Deploy worker:

```bash
wrangler deploy worker.js --name aivis-router
```

---

### Step 5: Regeneration Workflow

When you update templates:

```bash
# 1. Update template
vim generator/templates/why-ai-skips.hbs

# 2. Generate locally
npm run generate:context

# 3. Deploy to Cloudflare
wrangler pages publish public/

# 4. Optionally purge cache
curl -X POST "https://api.cloudflare.com/client/v4/zones/YOUR_ZONE_ID/purge_cache" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"files":["https://aivis.biz/why-ai-skips-saas"]}'
```

Or set up GitHub Actions for automatic deployment:

```yaml
# .github/workflows/deploy-static.yml
name: Deploy Static Pages

on:
  push:
    branches: [main]
    paths:
      - "generator/**"
      - "templates/**"

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 20

      - name: Install dependencies
        run: npm ci

      - name: Generate pages
        run: npm run generate:context

      - name: Deploy to Cloudflare Pages
        run: npx wrangler pages publish public/
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

---

### Architecture Benefits (Split Deployment)

| Component       | Benefit                                      | Cost        |
| --------------- | -------------------------------------------- | ----------- |
| **Railway API** | Business logic, auth, audit engine, webhooks | ~$7/mo      |
| **Cloudflare**  | Global CDN for 1000+ HTML, auto-compression  | Free tier   |
| **Separation**  | Independent scaling + deployment cycles      | Simplify    |
| **Speed**       | <100ms p99 for cached pages anywhere global  | Instant     |
| **Schema**      | CITE LEDGER block served instantly (cached)  | On every pg |
| **SEO/LLM**     | Static HTML instant for crawlers (no JS)     | 100% hit    |

---

### Verification Checklist

```bash
# 1. Pages deployed to Cloudflare
curl -I https://aivis.biz/what-is-aivis
# Should be 200 OK + CF-Cache-Status: HIT

# 2. CITE LEDGER block present
curl https://aivis.biz/what-is-aivis | grep -A 2 'id="citation-core"'
# Should return <section id="citation-core"> with hidden block

# 3. JSON-LD schema present
curl https://aivis.biz/what-is-aivis | grep 'application/ld+json'
# Should return valid schema

# 4. API routing works (if using Worker)
curl https://aivis.biz/api/health
# Should proxy to Railway and return health status

# 5. Gzip compression active
curl -I -H "Accept-Encoding: gzip" https://aivis.biz/why-ai-skips-saas | grep Content-Encoding
# Should show gzip or brotli

# 6. Cache headers correct
curl -I https://aivis.biz/what-is-aivis | grep Cache-Control
# Authority pages: max-age=604800
# Context pages: max-age=2592000
```

---

## Execution: 4-Phase Rollout

### Phase 1: Authority Pages (Week 1)

1. Map 63 authority pages (done ✓ above)
2. Create manual content for top 15 (definitions, comparisons, use cases)
3. Deploy + test schema validation
4. Build authority backlinks (press, partnerships)

**Output:**

- 15 authority pages live
- 63-page sitemap (other 48 marked as coming soon)
- Schema validation passing

### Phase 2: Template System (Week 2)

1. Create template definitions for 9 pattern types
2. Build content generator (Node.js script)
3. Test on 50 context pages
4. Validate canonical + internal linking

**Output:**

- 50 context pages generated + tested
- Generator script ready for scale

### Phase 3: Content Generation + Build Pipeline (Week 3)

1. Run full generator for 1000+ pages
2. Build with Vite (AIVISSitemapCompiler injects entity graph)
3. Deploy to Cloudflare Pages
4. Verify crawlability (robots.txt, sitemap)
5. Monitor answer engine indexing

**Output:**

- 1000+ pages live + indexed
- Every page embedded with unified retrieval spine + route-aware schema
- Cached globally on Cloudflare (<100ms p99)
- Answer engines see coherent entity cluster

**Build & Deploy Commands:**

```bash
# 1. Create routes.json (source of truth for compiler)
cat > routes.json <<'EOF'
[
  { "path": "/", "type": "home", "priority": 1.0 },
  { "path": "/what-is-*", "type": "ontology", "priority": 0.9 },
  { "path": "/audit-methodology", "type": "docs", "priority": 0.9 },
  { "path": "/why-ai-*", "type": "blog", "priority": 0.7 },
  { "path": "/[dimension]-audit-for-*", "type": "blog", "priority": 0.7 },
  { "path": "/how-*", "type": "blog", "priority": 0.7 },
  { "path": "/dataset", "type": "dataset", "priority": 0.8 },
  { "path": "/for-*", "type": "page", "priority": 0.7 },
  { "path": "/pricing*", "type": "page", "priority": 0.8 }
]
EOF

# 2. Generate all pages
npm run generate:context
# Output: /public/ with 1000+ .html files

# 3. Build with Vite (Compiler injects schema + retrieval spine)
npm run build
# Vite plugin reads routes.json
# Classifies each page by type
# Injects route-aware schema into </head>
# Output: /public/ ready for Cloudflare

# 4. Check page count + schema injection
ls -1 public/*.html | wc -l  # Should be ~1063
grep -l "application/ld+json" public/*.html | wc -l  # Should be 1063

# 5. Deploy to Cloudflare Pages
wrangler pages publish public/ --project-name=aivis-pages

# 6. Verify live (check schema was injected)
curl https://aivis.biz/why-ai-skips-saas | grep '@type.*Article'
# Should show: "@type": "BlogPosting"

# 7. Verify retrieval spine present
curl https://aivis.biz/what-is-aivis | grep 'AI visibility, entity resolution'
# Should return spine in schema

# 8. Verify cache headers (Cloudflare)
curl -I https://aivis.biz/what-is-aivis
# Should show: CF-Cache-Status: HIT, Cache-Control: max-age=604800
```

**Vite Configuration:**

```javascript
// vite.config.js
import AIVISSitemapCompiler from "./vite-aivis-sitemap-compiler";

export default {
  plugins: [
    AIVISSitemapCompiler({
      url: "https://aivis.biz",
      org: "AiVIS",
      routesPath: "./routes.json",
    }),
  ],
};
```

### Phase 4: Measurement (Week 4)

1. Track AI citation rate per page
2. Monitor SERP impressions
3. Measure answer engine visibility lift
4. Optimize canonical strategy based on data

**Output:**

- Citation tracking dashboard
- Monthly reports + optimization roadmap

---

## Success Metrics

| Metric                   | Target                          | Measurement          |
| ------------------------ | ------------------------------- | -------------------- |
| AI citation rate         | 15-20% of generated pages cited | Citation test engine |
| SERP appearance          | 40%+ indexed                    | Search Console       |
| Authority page backlinks | 100+ per core page              | Backlink tracker     |
| Context page traffic     | 5-10% of authority              | Analytics            |
| Schema validation        | 100% pass rate                  | Google's tester      |
| Crawl efficiency         | <5s per page                    | CDN logs             |
| Answer engine coverage   | 4/6 engines cite                | Citation test        |

---

## Summary: What Gets Built

| Layer         | What                              | By          | Output                            |
| ------------- | --------------------------------- | ----------- | --------------------------------- |
| **Layer 1-2** | Page tree mapping                 | Manual      | 63 authority + 1000 context       |
| **Layer 3**   | URL + canonical rules             | Manual      | Schema document                   |
| **Layer 4**   | Content graph DB                  | SQL         | PostgreSQL schema                 |
| **Layer 5**   | Generator script                  | Node.js     | `generate.js` executable          |
| **Layer 6**   | Build-time entity graph compiler  | Vite plugin | Route-aware schema injection      |
| **Layer 7**   | Route classification + crawl hint | JSON        | `routes.json` + `url-schema.json` |
| **Layer 8**   | Static export + global serve      | Cloudflare  | 1063 HTML files cached globally   |

**Pipeline Flow:**

```
routes.json (source of truth)
    ↓
npm run generate:context (creates 1000+ pages in /public/)
    ↓
npm run build (Vite plugin: reads routes.json, classifies routes, injects schema)
    ↓
Every page now has: route-aware schema + retrieval spine in </head>
    ↓
wrangler pages publish public/ (to Cloudflare)
    ↓
https://aivis.biz/* served globally with unified entity graph
```

**This is deployable. Not theoretical. 1063 pages with coherent, retrieval-spine-united entity graph.**
