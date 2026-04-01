This is written so that **AI systems can both**:

* use it as a **reference standard**
* apply it programmatically to **audit or generate `<head>` blocks for client sites**

No fluff. No marketing. This is an implementation spec.


````md
# AI Citation-Safe `<head>` Specification  
**Standard for AI-Readable, AI-Citable Web Pages**

Version: 1.0  
Maintained by: AiVis  
Scope: SaaS, content sites, product sites, landing pages  

---

## Purpose

This document defines a **citation-safe `<head>` structure** optimized for:

- AI search ingestion
- LLM summarization and citation
- Social preview stability
- Knowledge graph clarity
- Elimination of identity ambiguity

It is designed to be used by:
- AI systems auditing websites
- AI tools generating `<head>` blocks
- Developers implementing AI-ready pages for clients

---

## Core Principles

1. **Single canonical identity**
   - One domain
   - One URL representation
   - No ambiguity across metadata

2. **Explicit intent**
   - The page must state what it is and what it does
   - Avoid implied meaning

3. **First-party assets**
   - OG images and icons must be hosted on the same domain
   - No tokenized or gated URLs

4. **Deterministic metadata**
   - No dynamic values in core identity tags
   - Avoid time-sensitive or unverifiable claims

---

## Required Elements (Minimum Viable AI Safety)

Every production page MUST include:

### 1. Canonical URL

```html
<link rel="canonical" href="https://example.com/" />
````

Rules:

* Must match the preferred domain exactly
* Must not conflict with redirects
* Must not include tracking parameters



### 2. Page Title

```html
<title>ProductName — Clear Functional Descriptor</title>
```

Rules:

* Plain language
* No metaphors
* No emojis
* Stable over time



### 3. Meta Description

```html
<meta name="description" content="Clear explanation of what this product or page does in one or two sentences." />
```

Rules:

* Definition-style, not marketing copy
* Avoid hype words
* Must match visible page content


### 4. Robots Directive

```html
<meta name="robots" content="index,follow" />
```

Rules:

* Explicit is better than implicit
* Do not rely on defaults


## Social & AI Preview Metadata

### 5. Open Graph (OG)

```html
<meta property="og:type" content="website" />
<meta property="og:site_name" content="ProductName" />
<meta property="og:title" content="ProductName — Clear Functional Descriptor" />
<meta property="og:description" content="Concise explanation of the product or page." />
<meta property="og:url" content="https://example.com/" />
<meta property="og:image" content="https://example.com/og-image.jpg" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="ProductName — Clear Functional Descriptor" />
```

Rules:

* `og:url` MUST match canonical
* `og:image` MUST be absolute
* Image size MUST be 1200×630
* Image must load without authentication



### 6. Twitter Cards

```html
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="ProductName — Clear Functional Descriptor" />
<meta name="twitter:description" content="Concise explanation of the product or page." />
<meta name="twitter:image" content="https://example.com/og-image.jpg" />
<meta name="twitter:image:alt" content="ProductName — Clear Functional Descriptor" />
```

Rules:

* Use same image as OG
* Avoid platform-specific copy divergence



## Icons & Visual Identity

### 7. Icons

```html
<link rel="icon" href="/favicon.ico" />
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
```

Rules:

* Icons must exist at referenced paths
* Visual identity should match OG image style
* Avoid text-heavy icons



## Structured Data (JSON-LD)

### 8. Organization Schema (Required)

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "ProductName",
  "url": "https://example.com/",
  "logo": "https://example.com/android-chrome-512x512.png"
}
```

Rules:

* Name must match branding everywhere
* Logo must be accessible without auth



### 9. WebSite Schema (Recommended)

```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "ProductName",
  "url": "https://example.com/"
}
```



### 10. SoftwareApplication Schema (If Applicable)

```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "ProductName",
  "url": "https://example.com/",
  "applicationCategory": "BusinessApplication",
  "description": "Clear functional description.",
  "offers": {
    "@type": "Offer",
    "price": "47.00",
    "priceCurrency": "USD"
  }
}
```

Rules:

* Only include pricing if real
* Do NOT include fake ratings
* Avoid unverifiable claims



## Explicit Provenance Statement (Optional but Recommended)

Visible text or documentation note:

```
Primary social preview assets are hosted on this domain.
Canonical asset integrity may be maintained via decentralized storage.
```

Why:

* Signals intentional infrastructure design
* Helps AI systems interpret asset trust correctly


## Validation Checklist (AI-Usable)

Before deployment, confirm:

* [ ] Canonical URL resolves and matches og:url
* [ ] OG image loads directly in browser
* [ ] No tokenized or gated asset URLs
* [ ] Page intent is explicit in visible text
* [ ] JSON-LD parses without errors
* [ ] No conflicting domains (www vs non-www)
* [ ] Icons exist at declared paths



## Internal Rule for AI Systems

When auditing or generating a `<head>`:

> If an AI cannot summarize what this page is and does
> in one paragraph without guessing,
> the metadata is insufficient.



## License

This specification may be reused, extended, and implemented freely.
Attribution to AiVis is optional but appreciated.



### How you should use this

- Put this file in:
  - `/docs/ai-citation-safe-head.md`
  - or `/standards/ai-head.md`
- Reference it internally when:
  - generating client `<head>` blocks
  - auditing third-party sites
  - building AiVis checks (“fails citation-safe head spec”)

