# AIVISSitemapCompiler Setup Guide

## Overview

The `AIVISSitemapCompiler` is a Vite plugin that builds a structured knowledge graph by:

1. **Reading route classifications** from `routes.json`
2. **Assigning semantic schema types** based on route pattern (blog → BlogPosting, docs → TechArticle, etc.)
3. **Injecting retrieval spine** into every page's schema (same core concepts everywhere)
4. **Preventing citation drift** by ensuring unified entity cluster across 1000+ pages

## Files

```
/
├── routes.json                          # Route classifications (input to compiler)
├── vite-aivis-sitemap-compiler.js      # Vite plugin (the compiler)
├── vite.config.static.js               # Vite config for static generation
├── generator/
│   ├── generate.js                     # Generates ~1000 pages
│   └── templates/                      # Handlebars templates
├── public/                             # Generated HTML output
│   ├── *.html                          # 1063 generated pages
│   ├── url-schema.json                 # Crawler hints
│   └── sitemap.xml                     # Standard sitemap
└── .github/workflows/
    └── deploy-static.yml               # CI/CD automation
```

## Setup Steps

### Step 1: Install Dependencies

```bash
cd /workspaces/aivis

npm install vite --save-dev
npm install --save-dev terser
```

### Step 2: Generate Content

```bash
# Generate all 1000+ pages into /public/
npm run generate:context

# Verify output
ls -1 public/*.html | wc -l
# Should show: ~1063
```

### Step 3: Run Compiler (Build with Vite)

```bash
# Build using the static config
# This reads routes.json and injects schema into every page
npm run build -- --config vite.config.static.js

# Or add a package.json script:
# "build:static": "vite build --config vite.config.static.js"

npm run build:static
```

### Step 4: Verify Schema Injection

```bash
# Check that JSON-LD was injected
grep -l "application/ld+json" public/*.html | wc -l
# Should show: 1063

# Check specific page has schema
curl file:///$PWD/public/why-ai-skips-saas.html | grep -A 5 "@type.*BlogPosting"
# Should show schema

# Check retrieval spine present
curl file:///$PWD/public/what-is-aivis.html | grep "AI visibility, entity resolution"
# Should show in schema + meta
```

### Step 5: Deploy to Cloudflare

```bash
# Authenticate with Cloudflare
npm install -g wrangler
wrangler login

# Deploy pages
wrangler pages publish public/ --project-name=aivis-pages

# Verify live
curl -I https://aivis.biz/what-is-aivis
# Should show: CF-Cache-Status: HIT
```

## How It Works

### Input: routes.json

```json
[
  { "path": "/", "type": "home" },
  { "path": "/what-is-*", "type": "ontology" },
  { "path": "/why-ai-*", "type": "blog" },
  { "path": "/[dimension]-audit-for-*", "type": "blog" },
  { "path": "/docs/*", "type": "docs" }
]
```

### Processing: Vite Plugin

For each page in `/public/`:

1. Match path against routes.json patterns
2. Determine semantic type (blog → BlogPosting, docs → TechArticle, etc.)
3. Generate appropriate JSON-LD schema
4. Inject into `</head>` before deployment

### Output: Injected HTML

**Before:**

```html
<html>
  <head>
    <title>Why AI Skips SaaS Websites</title>
  </head>
  <body>
    ...
  </body>
</html>
```

**After (with compiler):**

```html
<html>
  <head>
    <title>Why AI Skips SaaS Websites</title>
    <meta
      name="description"
      content="AI visibility, entity resolution, and citation behavior in generative answer engines"
    />
    <link rel="canonical" href="https://aivis.biz/why-ai-skips-saas" />
    <script type="application/ld+json">
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
            "@type": "BlogPosting",
            "url": "https://aivis.biz/why-ai-skips-saas",
            "headline": "AI Visibility Insights",
            "about": "AI visibility, entity resolution, and citation behavior in generative answer engines"
          }
        ]
      }
    </script>
  </head>
  ...
</html>
```

## Package.json Scripts

Add these to your `package.json`:

```json
{
  "scripts": {
    "generate:all": "npm run generate:authority && npm run generate:context",
    "build:static": "vite build --config vite.config.static.js",
    "build:deploy": "npm run generate:all && npm run build:static",
    "deploy:cloudflare": "wrangler pages publish public/ --project-name=aivis-pages",
    "deploy:full": "npm run build:deploy && npm run deploy:cloudflare"
  }
}
```

## Route Classification Reference

| Type       | Schema Output  | Crawl Priority | Examples                        |
| ---------- | -------------- | -------------- | ------------------------------- |
| `home`     | WebSite + Org  | 1.0            | `/`                             |
| `ontology` | DefinedTermSet | 0.9            | `/what-is-*`                    |
| `docs`     | TechArticle    | 0.9            | `/audit-methodology`, `/docs/*` |
| `blog`     | BlogPosting    | 0.7            | `/why-ai-*`, `/how-*`           |
| `dataset`  | Dataset        | 0.8            | `/dataset`                      |
| `page`     | WebPage        | 0.7            | `/for-*`, `/pricing`            |

## Retrieval Spine (Injected Into All Pages)

```
"AI visibility, entity resolution, and citation behavior in generative answer engines"
```

This appears in:

- Every page's meta description
- Every page's schema `about` field
- Organization schema `knowsAbout` array
- Prevents citation drift across entity graph

## Troubleshooting

**Q: Schema not injected?**

- Check routes.json exists and is valid JSON
- Verify pages exist in `/public/` before building
- Check Vite build logs: `npm run build:static -- --debug`

**Q: Wrong schema type assigned?**

- Check route patterns in routes.json match your page paths
- Update routes.json patterns if needed
- Rebuild: `npm run build:static`

**Q: Cloudflare cache not clearing?**

- Manually purge: `curl -X POST https://api.cloudflare.com/client/v4/zones/ZONE_ID/purge_cache`
- Or set up Cloudflare Worker to auto-purge on deployment

**Q: How to customize retrieval spine?**

- Edit `RETRIEVAL_SPINE` in `vite-aivis-sitemap-compiler.js`
- Rebuild all pages: `npm run build:static`

## Next Steps

1. **Generate your first 50 pages** to test the pipeline
2. **Verify schema** using Google's Rich Results Test
3. **Deploy to Cloudflare Pages**
4. **Monitor LLM citations** per page
5. **Optimize based on data** (which pages get cited most?)

## References

- [Schema.org Documentation](https://schema.org/)
- [JSON-LD Format](https://json-ld.org/)
- [Cloudflare Pages](https://pages.cloudflare.com/)
- [AiVIS Content Architecture](./docs/AIVIS_CONTENT_ARCHITECTURE.md)
