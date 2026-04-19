import fs from "fs";
import path from "path";

/**
 * AIVISSitemapCompiler
 *
 * Build-time entity graph compiler for AiVIS.
 *
 * Classifies routes by type and injects route-aware schema variants.
 * All pages share a unified retrieval spine to prevent citation drift.
 *
 * Input: routes.json (route classification)
 * Output: Every page has JSON-LD schema injected in </head>
 */

const RETRIEVAL_SPINE = {
  core: "AI visibility, entity resolution, and citation behavior in generative answer engines",
  concepts: [
    "AI visibility",
    "entity resolution",
    "citation behavior",
    "answer engine interpretation",
    "semantic disambiguation",
  ],
};

/**
 * Classify a route path by type
 * @param {string} path - URL path
 * @param {Array} routes - routes.json configuration
 * @returns {string} route type (home|blog|docs|dataset|ontology|page)
 */
function classifyRoute(path, routes) {
  if (!routes || routes.length === 0) {
    // Fallback classification
    if (path === "/" || path === "") return "home";
    if (path.includes("/blog")) return "blog";
    if (path.includes("/docs")) return "docs";
    if (path.includes("/dataset")) return "dataset";
    if (path.includes("/terms") || path.includes("/ontology"))
      return "ontology";
    return "page";
  }

  // Match path against routes patterns
  for (const route of routes) {
    const pattern = route.path.replace(/\*/g, "[^/]*");
    const regex = new RegExp(`^${pattern}$`);
    if (regex.test(path)) {
      return route.type || "page";
    }
  }

  return "page";
}

/**
 * Generate Schema.org @graph for a route
 * @param {string} route - URL path
 * @param {string} type - route type (home|blog|docs|dataset|ontology|page)
 * @param {Object} config - Vite plugin config
 * @returns {Object} JSON-LD schema
 */
function generateSchema(route, type, config) {
  const base = {
    "@context": "https://schema.org",
    "@graph": [],
  };

  // Organization entity
  const org = {
    "@type": "Organization",
    "@id": `${config.url}#org`,
    name: config.org,
    url: config.url,
    description: RETRIEVAL_SPINE.core,
    knowsAbout: RETRIEVAL_SPINE.concepts,
  };

  // WebSite entity
  const website = {
    "@type": "WebSite",
    "@id": `${config.url}#site`,
    url: config.url,
    name: config.org,
    about: RETRIEVAL_SPINE.core,
  };

  // Base page entity
  const pageBase = {
    "@type": "WebPage",
    url: config.url + route,
    isPartOf: { "@id": `${config.url}#site` },
    about: RETRIEVAL_SPINE.core,
  };

  switch (type) {
    case "home":
      base["@graph"] = [org, website, pageBase];
      break;

    case "blog":
      base["@graph"] = [
        org,
        website,
        {
          ...pageBase,
          "@type": "BlogPosting",
          headline: "AI Visibility Insights",
          articleSection: "AI visibility and entity resolution analysis",
        },
      ];
      break;

    case "docs":
      base["@graph"] = [
        org,
        website,
        {
          ...pageBase,
          "@type": "TechArticle",
          headline: "System Documentation",
          articleSection: "Entity resolution and citation systems",
        },
      ];
      break;

    case "dataset":
      base["@graph"] = [
        org,
        website,
        {
          "@type": "Dataset",
          name: "AIVIS Structured Signals",
          description: RETRIEVAL_SPINE.core,
          creator: { "@id": `${config.url}#org` },
        },
      ];
      break;

    case "ontology":
      base["@graph"] = [
        org,
        website,
        {
          "@type": "DefinedTermSet",
          name: "AI Visibility Ontology",
          hasDefinedTerm: RETRIEVAL_SPINE.concepts.map((c) => ({
            "@type": "DefinedTerm",
            name: c,
          })),
        },
      ];
      break;

    default:
      base["@graph"] = [org, website, pageBase];
  }

  return base;
}

/**
 * Generate HTML meta tags
 * @param {string} route - URL path
 * @param {Object} config - Vite plugin config
 * @returns {string} HTML meta tags
 */
function generateMeta(route, config) {
  const desc = RETRIEVAL_SPINE.core;
  return `    <title>${config.org}</title>
    <meta name="description" content="${desc}">
    <link rel="canonical" href="${config.url + route}">
    <meta property="og:title" content="${config.org}">
    <meta property="og:description" content="${desc}">
    <meta property="og:url" content="${config.url + route}">`;
}

/**
 * Inject schema + meta into HTML
 * @param {string} html - HTML document
 * @param {string} route - URL path
 * @param {string} type - route type
 * @param {Object} config - Vite plugin config
 * @returns {string} HTML with injection
 */
function inject(html, route, type, config) {
  const schema = generateSchema(route, type, config);
  const meta = generateMeta(route, config);

  const jsonLd = `<script type="application/ld+json">
${JSON.stringify(schema, null, 2)}
</script>`;

  // Inject before </head>
  const injectedHtml = html.replace(
    "</head>",
    `${meta}\n    ${jsonLd}\n  </head>`,
  );
  return injectedHtml;
}

/**
 * Load routes configuration from routes.json
 * @param {string} routesPath - path to routes.json
 * @returns {Array|null} routes configuration or null if not found
 */
function loadRoutes(routesPath) {
  try {
    if (!fs.existsSync(routesPath)) {
      console.warn(
        `[AIVISSitemapCompiler] routes.json not found at ${routesPath}`,
      );
      return null;
    }
    const content = fs.readFileSync(routesPath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    console.error(
      `[AIVISSitemapCompiler] Error loading routes.json:`,
      error.message,
    );
    return null;
  }
}

/**
 * Vite Plugin: AIVISSitemapCompiler
 *
 * Usage in vite.config.js:
 *
 * import AIVISSitemapCompiler from "./vite-aivis-sitemap-compiler";
 *
 * export default {
 *   plugins: [
 *     AIVISSitemapCompiler({
 *       url: "https://aivis.biz",
 *       org: "AiVIS",
 *       routesPath: "./routes.json"
 *     })
 *   ]
 * };
 */
export default function AIVISSitemapCompiler(config) {
  let routes = null;
  let routeCount = 0;

  return {
    name: "vite-aivis-sitemap-compiler",

    configResolved() {
      // Load routes at config time
      if (config.routesPath) {
        routes = loadRoutes(config.routesPath);
        if (routes) {
          routeCount = routes.length;
          console.log(
            `[AIVISSitemapCompiler] Loaded ${routeCount} route classifications`,
          );
        }
      }
    },

    transformIndexHtml(html, ctx) {
      const route = ctx.path || "/";
      const type = classifyRoute(route, routes);

      // Inject schema + meta for this route
      const injectedHtml = inject(html, route, type, config);

      return injectedHtml;
    },

    buildStart() {
      if (!routes) {
        console.warn(
          "[AIVISSitemapCompiler] No routes loaded. Build proceeding with fallback classification.",
        );
      }
    },

    buildEnd() {
      console.log(
        `[AIVISSitemapCompiler] Build complete. ${routeCount} routes classified.`,
      );
      console.log(
        `[AIVISSitemapCompiler] Retrieval spine injected into all pages:`,
      );
      console.log(`  "${RETRIEVAL_SPINE.core}"`);
    },
  };
}
