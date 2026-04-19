# Package.json Configuration for AIVISSitemapCompiler

## New Scripts to Add

Add these scripts to your `package.json` under the `"scripts"` section:

```json
{
  "scripts": {
    "generate:authority": "node scripts/generate-authority.js",
    "generate:context": "node scripts/generate-context.js",
    "generate:all": "npm run generate:authority && npm run generate:context",

    "build:static": "vite build --config vite.config.static.js",
    "build:static:watch": "vite build --config vite.config.static.js --watch",
    "build:deploy": "npm run generate:all && npm run build:static",

    "verify:compiler": "bash scripts/verify-compiler.sh",
    "verify:schema": "node scripts/verify-schema.js",

    "deploy:cloudflare": "wrangler pages publish public/ --project-name=aivis-pages",
    "deploy:full": "npm run build:deploy && npm run deploy:cloudflare"
  }
}
```

## Full Package.json Context (Relevant Section)

```json
{
  "name": "aivis",
  "type": "module",
  "scripts": {
    "install:all": "npm --prefix client install && npm --prefix server install",
    "build": "npm --prefix client install && npm --prefix client run build && npm --prefix server install && npm --prefix server run build",

    "generate:authority": "node scripts/generate-authority.js",
    "generate:context": "node scripts/generate-context.js",
    "generate:all": "npm run generate:authority && npm run generate:context",

    "build:static": "vite build --config vite.config.static.js",
    "build:static:watch": "vite build --config vite.config.static.js --watch",
    "build:deploy": "npm run generate:all && npm run build:static",

    "verify:compiler": "bash scripts/verify-compiler.sh",
    "verify:schema": "node scripts/verify-schema.js",

    "deploy:cloudflare": "wrangler pages publish public/ --project-name=aivis-pages",
    "deploy:full": "npm run build:deploy && npm run deploy:cloudflare",

    "dev": "cd server && npm run dev",
    "start": "npm --prefix server run start",
    "lint": "npm --prefix client run lint && npm --prefix server run lint"
  },
  "devDependencies": {
    "vite": "^latest",
    "wrangler": "^latest",
    "terser": "^latest"
  }
}
```

## Required Dependencies

Install these for the static generation pipeline:

```bash
npm install --save-dev vite wrangler terser

# Or individually:
npm install --save-dev vite
npm install --save-dev wrangler
npm install --save-dev terser
```

## Usage Examples

### Generate all pages with schema injection

```bash
# Generate authority pages (manual content only)
npm run generate:authority

# Generate context pages (templated, 1000+)
npm run generate:context

# Or both at once
npm run generate:all

# Verify setup
npm run verify:compiler

# Build with Vite (injects schema into all pages)
npm run build:static

# Deploy to Cloudflare
npm run deploy:cloudflare

# Or do everything at once
npm run deploy:full
```

### Watch mode (rebuild on file changes)

```bash
npm run build:static:watch
```

## Deployment Workflow

### Local Development

```bash
# 1. Generate initial pages
npm run generate:all

# 2. Build with schema injection
npm run build:static

# 3. Verify schema was injected
npm run verify:schema

# 4. Local testing (serves from dist/)
# Static files now available in /public/ for inspection
```

### Production Deployment

```bash
# 1. Generate all pages
npm run generate:all

# 2. Build with schema + compression
npm run build:static

# 3. Deploy to Cloudflare Pages
npm run deploy:cloudflare

# Or all in one:
npm run deploy:full
```

## Script Descriptions

| Script               | Purpose                                    | Output                                                      |
| -------------------- | ------------------------------------------ | ----------------------------------------------------------- |
| `generate:authority` | Create 63 manually-curated authority pages | `/public/what-is-*.html`, `/public/for-*.html`, etc.        |
| `generate:context`   | Create 1000+ templated context pages       | `/public/why-ai-*.html`, `/public/*-audit-for-*.html`, etc. |
| `generate:all`       | Run both generators                        | 1063 total HTML files                                       |
| `build:static`       | Vite build: inject schema into all pages   | Same files, but with JSON-LD in `</head>`                   |
| `build:static:watch` | Watch mode: rebuild on template changes    | Incremental builds                                          |
| `build:deploy`       | Generate + build in one command            | Ready for deployment                                        |
| `verify:compiler`    | Test compiler setup                        | Pass/fail report                                            |
| `verify:schema`      | Validate schema in generated pages         | Schema correctness check                                    |
| `deploy:cloudflare`  | Publish to Cloudflare Pages                | Live at https://aivis.biz/*                                 |
| `deploy:full`        | Generate + build + deploy                  | Complete pipeline                                           |

## Continuous Integration (GitHub Actions)

Add to `.github/workflows/deploy-static.yml`:

```yaml
name: Build and Deploy Static Pages

on:
  push:
    branches: [main]
    paths:
      - "generator/**"
      - "templates/**"
      - "routes.json"
      - "vite-aivis-sitemap-compiler.js"

jobs:
  build-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: "22"

      - name: Install dependencies
        run: npm install

      - name: Generate pages
        run: npm run generate:all

      - name: Build with schema compiler
        run: npm run build:static

      - name: Verify schema
        run: npm run verify:schema

      - name: Deploy to Cloudflare
        run: npm run deploy:cloudflare
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

## Troubleshooting

**Q: "vite not found" when running build:static?**

```bash
npm install --save-dev vite
```

**Q: "wrangler not found" when deploying?**

```bash
npm install -g wrangler
wrangler login
```

**Q: Schema not being injected?**

```bash
# Debug the build
npm run build:static -- --debug

# Check routes.json is valid
npm run verify:compiler
```

**Q: Want to customize the build process?**

Edit `vite.config.static.js` to change:

- Output directory (`outDir`)
- Minification (`minify: "terser"`)
- Compression settings
- Source maps (`sourcemap`)

See [Vite docs](https://vitejs.dev/config/) for all options.

## References

- [AIVISSitemapCompiler Documentation](./SITEMAP_COMPILER_SETUP.md)
- [AiVIS Content Architecture](./docs/AIVIS_CONTENT_ARCHITECTURE.md)
- [Vite Configuration Docs](https://vitejs.dev/config/)
- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
