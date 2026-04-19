# AIVISSitemapCompiler Quick Reference

## TL;DR: One-Command Deployment

```bash
# Generate 1063 pages → inject schema → deploy to Cloudflare
npm run deploy:full
```

## Common Tasks

### Generate Content

```bash
# Generate just authority pages (63 manual pages)
npm run generate:authority

# Generate context pages (1000+ templated)
npm run generate:context

# Generate everything
npm run generate:all
```

### Build & Schema Injection

```bash
# Build with Vite + schema compiler
npm run build:static

# Watch mode (rebuild on changes)
npm run build:static:watch

# Build everything
npm run build:deploy
```

### Deploy

```bash
# Deploy to Cloudflare Pages
npm run deploy:cloudflare

# Deploy everything (generate + build + upload)
npm run deploy:full
```

### Verify

```bash
# Check setup is correct
npm run verify:compiler

# Validate schema in generated pages
npm run verify:schema

# Check specific page
curl https://aivis.biz/why-ai-skips-saas | grep "@type.*BlogPosting"

# Count pages with schema
grep -l "application/ld+json" public/*.html | wc -l
```

## Configuration Files

### routes.json (Route Classifier)

Maps URL patterns to schema types:

```json
[
  { "path": "/", "type": "home" },
  { "path": "/what-is-*", "type": "ontology" },
  { "path": "/why-ai-*", "type": "blog" }
]
```

**Types:** `home`, `blog`, `docs`, `dataset`, `ontology`, `page`

### vite-aivis-sitemap-compiler.js (The Plugin)

- Reads routes.json
- Classifies pages
- Injects schema into each page

**Don't edit** unless customizing retrieval spine.

### vite.config.static.js (Build Config)

- Configures Vite for static generation
- Uses AIVISSitemapCompiler plugin

**Edit to customize:**

- Output directory
- Compression settings
- Source maps

## What Gets Injected

Every page gets (in `</head>`):

```html
<meta name="description" content="...retrieval spine..." />
<link rel="canonical" href="https://aivis.biz/[path]" />
<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "[BlogPosting|TechArticle|Dataset|DefinedTermSet|WebPage]",
        "about": "...retrieval spine..."
      }
    ]
  }
</script>
```

## Schema Type per Route

| Pattern              | Type     | Schema         |
| -------------------- | -------- | -------------- |
| `/`                  | home     | WebSite + Org  |
| `/what-is-*`         | ontology | DefinedTermSet |
| `/audit-methodology` | docs     | TechArticle    |
| `/why-ai-*`          | blog     | BlogPosting    |
| `/for-*`             | page     | WebPage        |
| `/dataset`           | dataset  | Dataset        |

## Troubleshooting

| Problem                 | Solution                                              |
| ----------------------- | ----------------------------------------------------- |
| "vite not found"        | `npm install --save-dev vite`                         |
| Schema not injected     | `npm run verify:compiler` then `npm run build:static` |
| Wrong schema type       | Update pattern in `routes.json`                       |
| Pages not generated     | `npm run generate:all`                                |
| Cloudflare not updating | Manually purge cache in dashboard                     |

## File Locations

```
/vite-aivis-sitemap-compiler.js    ← The plugin
/routes.json                       ← Route config
/vite.config.static.js             ← Build config
/public/                           ← Generated pages
/public/url-schema.json            ← Crawler hints
/SITEMAP_COMPILER_SETUP.md         ← Full docs
```

## Performance Tips

- Build takes ~2-5 minutes for 1063 pages
- Cloudflare caches globally (<100ms p99)
- Schema injection adds <100ms to build
- Use `npm run build:static:watch` for development

## Useful Commands

```bash
# Count pages
ls -1 public/*.html | wc -l

# Check schema in page
grep "application/ld+json" public/why-ai-skips-saas.html

# Verify retrieval spine
grep -r "AI visibility, entity resolution" public/ | head -1

# Check cache header
curl -I https://aivis.biz/what-is-aivis | grep Cache

# Test locally before deploy
file:///$PWD/public/why-ai-skips-saas.html
```

## Next Steps

1. **Setup:** `npm run verify:compiler`
2. **Generate:** `npm run generate:all`
3. **Build:** `npm run build:static`
4. **Deploy:** `npm run deploy:cloudflare`
5. **Verify:** `curl https://aivis.biz/what-is-aivis`

---

**Docs:** See [SITEMAP_COMPILER_SETUP.md](./SITEMAP_COMPILER_SETUP.md) for full guide
