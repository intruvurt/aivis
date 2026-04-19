# AIVISSitemapCompiler Integration Summary

## What's Been Created

### 1. Core Files (Build-Time Infrastructure)

| File                             | Purpose                                                 | Status     |
| -------------------------------- | ------------------------------------------------------- | ---------- |
| `vite-aivis-sitemap-compiler.js` | Vite plugin that classifies routes & injects schema     | ✅ Created |
| `routes.json`                    | Route classifications (home/blog/docs/dataset/ontology) | ✅ Created |
| `vite.config.static.js`          | Vite configuration for static generation                | ✅ Created |

### 2. Documentation

| File                            | Purpose                                               |
| ------------------------------- | ----------------------------------------------------- |
| `SITEMAP_COMPILER_SETUP.md`     | Complete setup & usage guide                          |
| `PACKAGEJSON_SETUP.md`          | Package.json configuration                            |
| `AIVIS_CONTENT_ARCHITECTURE.md` | (Updated) Full architecture with compiler integration |

### 3. Utilities

| File                         | Purpose                       |
| ---------------------------- | ----------------------------- |
| `scripts/verify-compiler.sh` | Verification script for setup |

## How It All Works Together

### Architecture Layers (Complete)

```
Layer 1-2: Page Tree (63 authority + 1000 context pages)
    ↓
Layer 3: URL Schema (Layer 3 - canonicals, variants)
    ↓
Layer 4: Content Graph DB (PostgreSQL schemas defined)
    ↓
Layer 5: Generator (Node.js script creates HTML pages)
    ↓
Layer 6: Entity Graph Compiler (NEW - injects retrieval spine + schema)
    ↓
Layer 7: Route Classification + Crawler Hints (routes.json + url-schema.json)
    ↓
Layer 8: Static Deployment (Cloudflare Pages globally cached)
```

### Execution Pipeline

```bash
# Step 1: Generate pages (creates 1063 HTML files in /public/)
npm run generate:all

# Step 2: Build with Vite + schema compiler
# - Reads routes.json
# - Classifies each page by type
# - Generates route-aware schema (BlogPosting, TechArticle, etc.)
# - Injects schema + retrieval spine into </head>
npm run build:static

# Step 3: Verify schema injection
npm run verify:schema

# Step 4: Deploy globally
npm run deploy:cloudflare
```

## What Gets Injected Into Every Page

### URL Path Examples

| Path                                     | Type (from routes.json) | Schema Type            |
| ---------------------------------------- | ----------------------- | ---------------------- |
| `/`                                      | home                    | WebSite + Organization |
| `/what-is-aivis`                         | ontology                | DefinedTermSet         |
| `/audit-methodology`                     | docs                    | TechArticle            |
| `/why-ai-skips-saas`                     | blog                    | BlogPosting            |
| `/entity-resolution-audit-for-ecommerce` | blog                    | BlogPosting            |
| `/for-saas-founders`                     | page                    | WebPage                |
| `/dataset`                               | dataset                 | Dataset                |

### Injected HTML Structure

**Every page now has** (added by compiler):

```html
<head>
  <title>Original Title</title>
  <!-- NEW: Meta tags injected -->
  <meta
    name="description"
    content="AI visibility, entity resolution, and citation behavior in generative answer engines"
  />
  <link rel="canonical" href="https://aivis.biz/[path]" />

  <!-- NEW: Route-aware JSON-LD schema injected -->
  <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          "@id": "https://aivis.biz#org",
          "name": "AiVIS",
          "knowsAbout": ["AI visibility", "entity resolution", "citation behavior", ...]
        },
        {
          "@type": "[BlogPosting|TechArticle|Dataset|DefinedTermSet|WebPage]",
          "url": "https://aivis.biz/[path]",
          "about": "AI visibility, entity resolution, and citation behavior in generative answer engines"
        }
      ]
    }
  </script>
</head>
```

**Retrieval Spine** (same in every page):

```
"AI visibility, entity resolution, and citation behavior in generative answer engines"
```

## Route Classification System

### Input: routes.json

```json
[
  { "path": "/", "type": "home", "priority": 1.0 },
  { "path": "/what-is-*", "type": "ontology", "priority": 0.9 },
  { "path": "/[dimension]-audit", "type": "docs", "priority": 0.9 },
  { "path": "/why-ai-*", "type": "blog", "priority": 0.7 },
  { "path": "/[dimension]-audit-for-*", "type": "blog", "priority": 0.6 },
  { "path": "/for-*", "type": "page", "priority": 0.7 },
  { "path": "/dataset", "type": "dataset", "priority": 0.8 }
]
```

### Processing: AIVISSitemapCompiler

For **each** page in `/public/`:

1. Match path against patterns in routes.json
2. Determine type (home | ontology | docs | blog | page | dataset)
3. Generate Schema.org schema appropriate for that type
4. Inject schema + meta tags into `</head>`

### Output: Route → Schema Mapping

| Route Pattern        | Type     | Output Schema          | Benefit                        |
| -------------------- | -------- | ---------------------- | ------------------------------ |
| `/`                  | home     | Organization + WebSite | Establishes entity anchor      |
| `/what-is-*`         | ontology | DefinedTermSet + Terms | Canonical vocabulary           |
| `/audit-methodology` | docs     | TechArticle            | Authoritative technical source |
| `/why-ai-*`          | blog     | BlogPosting            | Contextual insights            |
| `/[dim]-audit-for-*` | blog     | BlogPosting            | Dimension-specific analysis    |
| `/for-*`             | page     | WebPage                | Use-case pages                 |
| `/dataset`           | dataset  | Dataset                | Structured data collection     |

## Files to Know About

### Deploy These Files

**To Git:**

```
✅ /vite-aivis-sitemap-compiler.js         # Plugin code
✅ /routes.json                            # Route classifications
✅ /vite.config.static.js                  # Build config
✅ /SITEMAP_COMPILER_SETUP.md              # Setup guide
✅ /PACKAGEJSON_SETUP.md                   # Package.json config
✅ /scripts/verify-compiler.sh             # Verification script
```

**Generated at Build Time (not in Git):**

```
/public/                                   # 1063 HTML files (generated)
/public/url-schema.json                    # Crawler hints (generated)
/public/sitemap.xml                        # Standard sitemap (generated)
/dist/                                     # Vite build output (generated)
```

## Next Steps (Phase 3: Week 3)

### Step 1: Verify Setup

```bash
# Check all files exist
npm run verify:compiler

# Output should show:
# ✓ routes.json found
# ✓ Compiler plugin found
# ✓ Vite static config found
# ✓ etc.
```

### Step 2: Generate Content

```bash
# Create 1063 pages in /public/
npm run generate:all

# Verify count
ls -1 public/*.html | wc -l  # Should be ~1063
```

### Step 3: Build With Schema

```bash
# Run Vite plugin to inject schema
npm run build:static

# Verify schema was injected
grep -l "application/ld+json" public/*.html | wc -l  # Should be 1063
```

### Step 4: Test Locally

```bash
# Check a specific page has schema
curl file:///$PWD/public/why-ai-skips-saas.html | grep -A 3 "@type.*BlogPosting"

# Check retrieval spine present
curl file:///$PWD/public/what-is-aivis.html | grep "AI visibility"
```

### Step 5: Deploy

```bash
# Deploy to Cloudflare Pages
npm run deploy:cloudflare

# Verify live
curl -I https://aivis.biz/what-is-aivis
# Should show: CF-Cache-Status: HIT
```

## Verification Checklist

Before deploying to production:

- [ ] `routes.json` has all page patterns
- [ ] `npm run verify:compiler` passes all checks
- [ ] `npm run generate:all` creates 1063 pages
- [ ] `npm run build:static` injects schema without errors
- [ ] `grep -l "application/ld+json" public/*.html` shows 1063
- [ ] Sample page has correct `@type` (BlogPosting, TechArticle, etc.)
- [ ] All pages have retrieval spine in schema
- [ ] `url-schema.json` exists in /public/
- [ ] `sitemap.xml` exists in /public/
- [ ] `npm run deploy:cloudflare` succeeds
- [ ] https://aivis.biz/* returns 200 OK
- [ ] https://aivis.biz/why-ai-* shows schema in source
- [ ] Cloudflare cache is active (CF-Cache-Status: HIT)

## Metrics to Track

After deployment, measure:

| Metric                 | Target                | Measurement              |
| ---------------------- | --------------------- | ------------------------ |
| AI citation rate       | 15-20% of pages       | Citation test engine     |
| Schema validation      | 100% pass             | Google Rich Results Test |
| Page load time         | <100ms p99            | Cloudflare CDN logs      |
| Cache hit rate         | >95%                  | Cloudflare analytics     |
| Entity coherence       | All pages share spine | Manual schema inspection |
| SERP indexing          | 40%+                  | Search Console           |
| Answer engine coverage | 4/6 engines cite      | Citation tracking        |

## Troubleshooting

### Schema not injected?

```bash
# Check build output
npm run build:static -- --debug

# Verify routes.json is loaded
npm run verify:compiler

# Check specific page
head -50 public/why-ai-skips-saas.html | grep '@type'
```

### Wrong schema type?

- Update pattern in `routes.json`
- Rebuild: `npm run build:static`
- Verify: `npm run verify:schema`

### Retrieval spine not in schema?

- Check `RETRIEVAL_SPINE` in `vite-aivis-sitemap-compiler.js`
- Rebuild: `npm run build:static`

### Cloudflare cache not updating?

```bash
# Manually purge
curl -X POST "https://api.cloudflare.com/client/v4/zones/YOUR_ZONE/purge_cache" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"purge_everything":true}'
```

## References

- **Setup Guide:** [SITEMAP_COMPILER_SETUP.md](./SITEMAP_COMPILER_SETUP.md)
- **Package.json:** [PACKAGEJSON_SETUP.md](./PACKAGEJSON_SETUP.md)
- **Architecture:** [AIVIS_CONTENT_ARCHITECTURE.md](./docs/AIVIS_CONTENT_ARCHITECTURE.md)
- **Schema.org:** [https://schema.org/](https://schema.org/)
- **Cloudflare Pages:** [https://pages.cloudflare.com/](https://pages.cloudflare.com/)

## System Diagram

```
input: routes.json
  ↓
[npm run generate:all]
  ↓
/public/ (1063 HTML files)
  ↓
[npm run build:static] ← AIVISSitemapCompiler plugin
  ├─ Read routes.json
  ├─ Classify each page
  ├─ Generate schema
  ├─ Inject into </head>
  └─ Output to /public/
  ↓
/public/ (1063 HTML + schema)
  ↓
[npm run deploy:cloudflare]
  ↓
Cloudflare Pages (aivis.biz/*)
  ↓
https://aivis.biz/what-is-aivis
(schema injected, cached globally, instant delivery)
```

---

**Status:** ✅ Complete and ready for Phase 3 deployment

All infrastructure files created and documented. Ready to generate 1000+ pages with unified entity graph.
