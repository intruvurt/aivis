# AIVISSitemapCompiler: Before & After Example

## What the Compiler Does

The compiler transforms raw generated HTML pages into semantic, LLM-friendly pages by injecting:

1. **Meta tags** (description, canonical, OG tags)
2. **JSON-LD schema** (entity graph + retrieval spine)
3. **Route-aware semantic types** (BlogPosting vs TechArticle vs Dataset)

## Example: `/why-ai-skips-saas`

### BEFORE: Raw Generated HTML

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Why AI Engines Skip SaaS Websites</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  </head>
  <body>
    <h1>Why AI Engines Skip SaaS Websites</h1>

    <p>
      Most SaaS documentation sites are invisible to AI answer engines like
      ChatGPT, Perplexity, and Claude. Here's why...
    </p>

    <h2>Root Causes</h2>
    <ul>
      <li>Entity resolution failures (site identified as generic corp page)</li>
      <li>Poor indexation signals (no breadcrumbs, weak schema)</li>
      <li>Low semantic consistency (similar pages confuse canonicals)</li>
    </ul>

    <section id="citation-core" aria-hidden="true">
      <div>CITE LEDGER block</div>
    </section>
  </body>
</html>
```

### AFTER: Processed by AIVISSitemapCompiler

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Why AI Engines Skip SaaS Websites</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />

    <!-- ===== INJECTED BY COMPILER ===== -->

    <!-- Meta Tags -->
    <meta
      name="description"
      content="AI visibility, entity resolution, and citation behavior in generative answer engines"
    />
    <link rel="canonical" href="https://aivis.biz/why-ai-skips-saas" />
    <meta property="og:title" content="AiVIS" />
    <meta
      property="og:description"
      content="AI visibility, entity resolution, and citation behavior in generative answer engines"
    />
    <meta property="og:url" content="https://aivis.biz/why-ai-skips-saas" />

    <!-- JSON-LD Schema (Route-Aware) -->
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Organization",
            "@id": "https://aivis.biz#org",
            "name": "AiVIS",
            "url": "https://aivis.biz",
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
            "@type": "WebSite",
            "@id": "https://aivis.biz#site",
            "url": "https://aivis.biz",
            "name": "AiVIS",
            "about": "AI visibility, entity resolution, and citation behavior in generative answer engines"
          },
          {
            "@type": "BlogPosting",
            "url": "https://aivis.biz/why-ai-skips-saas",
            "isPartOf": {
              "@id": "https://aivis.biz#site"
            },
            "headline": "AI Visibility Insights",
            "articleSection": "AI visibility and entity resolution analysis",
            "about": "AI visibility, entity resolution, and citation behavior in generative answer engines"
          }
        ]
      }
    </script>

    <!-- ===== END INJECTED ===== -->
  </head>
  <body>
    <h1>Why AI Engines Skip SaaS Websites</h1>

    <p>
      Most SaaS documentation sites are invisible to AI answer engines like
      ChatGPT, Perplexity, and Claude. Here's why...
    </p>

    <h2>Root Causes</h2>
    <ul>
      <li>Entity resolution failures (site identified as generic corp page)</li>
      <li>Poor indexation signals (no breadcrumbs, weak schema)</li>
      <li>Low semantic consistency (similar pages confuse canonicals)</li>
    </ul>

    <section id="citation-core" aria-hidden="true">
      <div>CITE LEDGER block</div>
    </section>
  </body>
</html>
```

## Key Additions Explained

### 1. Meta Tags

```html
<meta
  name="description"
  content="AI visibility, entity resolution, and citation behavior in generative answer engines"
/>
<link rel="canonical" href="https://aivis.biz/why-ai-skips-saas" />
```

- **Description:** Consistent retrieval spine appears in every page
- **Canonical:** Tells crawlers this is the authoritative URL

### 2. Organization Entity

```json
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
}
```

- **@id:** Unique identifier for Organization
- **knowsAbout:** Establishes concepts AiVIS is known for
- **Same in every page:** Prevents entity drift

### 3. Route-Aware Schema Type

For **this page** (`/why-ai-skips-saas`), matches pattern `/why-ai-*` in routes.json:

```json
{
  "@type": "BlogPosting",
  "url": "https://aivis.biz/why-ai-skips-saas",
  "headline": "AI Visibility Insights",
  "articleSection": "AI visibility and entity resolution analysis",
  "about": "AI visibility, entity resolution, and citation behavior in generative answer engines"
}
```

- **@type:** BlogPosting (not generic Article)
- **headline/articleSection:** Semantic context
- **about:** Consistent retrieval spine

## Compare: Different Routes

### Example 2: `/audit-methodology` (docs route)

Pattern: `/audit-methodology` → type: `docs`

```json
{
  "@type": "TechArticle",
  "url": "https://aivis.biz/audit-methodology",
  "headline": "System Documentation",
  "articleSection": "Entity resolution and citation systems",
  "about": "AI visibility, entity resolution, and citation behavior in generative answer engines"
}
```

**Why TechArticle?** Because `/audit-methodology` matches the docs pattern in routes.json.

### Example 3: `/what-is-aivis` (ontology route)

Pattern: `/what-is-*` → type: `ontology`

```json
{
  "@type": "DefinedTermSet",
  "name": "AI Visibility Ontology",
  "hasDefinedTerm": [
    { "@type": "DefinedTerm", "name": "AI visibility" },
    { "@type": "DefinedTerm", "name": "entity resolution" },
    { "@type": "DefinedTerm", "name": "citation behavior" },
    { "@type": "DefinedTerm", "name": "answer engine interpretation" },
    { "@type": "DefinedTerm", "name": "semantic disambiguation" }
  ]
}
```

**Why DefinedTermSet?** Because `/what-is-*` pages are ontology/vocabulary definitions.

## Retrieval Spine Consistency

**Same text in every page's schema:**

```
"AI visibility, entity resolution, and citation behavior in generative answer engines"
```

This appears in:

- Every page's `<meta name="description">`
- Every page's schema `about` field
- Organization schema `knowsAbout` array
- WebSite schema `about` field

**Effect on LLMs:**

When Claude or Perplexity crawls 1000+ AiVIS pages, they see:

- Consistent vocabulary (same concepts repeated)
- Unified organization entity (same @id everywhere)
- Route-appropriate contexts (BlogPosting for context, TechArticle for methodology)
- **Result:** Recognizes AiVIS as a cohesive entity cluster, not 1000 random pages

## Performance Impact

### Build Time

- Generating 1063 pages: ~2 minutes
- Schema injection: +30 seconds
- Total build: ~2.5 minutes

### Output Size

- Before injection: 500MB (uncompressed)
- After injection: 510MB (added ~10MB of schema)
- After gzip: 50MB (standard compression)

### Runtime Performance

- Page load: <100ms p99 (Cloudflare edge)
- Schema parsing: LLMs handle instantly

## Deployment Checklist

- [ ] Routes match all page patterns
- [ ] Compiler reads routes.json correctly
- [ ] Schema injected in 1063/1063 pages
- [ ] Retrieval spine present in all pages
- [ ] Organization @id consistent across pages
- [ ] Route type (blog/docs/ontology) correct per page
- [ ] CloudFlare cache active
- [ ] Google Rich Results test passes

## Live Examples (After Deployment)

```bash
# Check a blog page
curl https://aivis.biz/why-ai-skips-saas | jq '. | select(.type=="application/ld+json")'

# Check a docs page
curl https://aivis.biz/audit-methodology | jq '. | select(.type=="application/ld+json")'

# Check an ontology page
curl https://aivis.biz/what-is-aivis | jq '. | select(.type=="application/ld+json")'

# Verify organization entity in all
curl https://aivis.biz/[any-page] | grep '"@type": "Organization"'
```

## Summary: What Happened

| Before Compiler     | After Compiler             |
| ------------------- | -------------------------- |
| Plain HTML          | HTML + schema              |
| No semantic context | Route-aware schema type    |
| Generic metadata    | Consistent retrieval spine |
| 1000 isolated pages | Unified entity cluster     |
| Not LLM-optimized   | LLM-citation-optimized     |

The compiler transforms a static site into a semantic knowledge graph that LLMs recognize as a cohesive entity, resulting in higher citation rates and better answer engine visibility.
