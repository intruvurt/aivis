/**
 * Vite Configuration for Static Content Generation
 *
 * This config is used ONLY for building static pages with AIVISSitemapCompiler.
 * It processes generated HTML pages and injects entity graph schema.
 *
 * Usage:
 *   npm run build:static      # Build static pages with schema
 *   vite build --config vite.config.static.js
 *
 * Output: /public/ directory with 1063+ HTML files, each with:
 *   - Route-aware JSON-LD schema (in </head>)
 *   - Meta tags (canonical, og:*, description)
 *   - CITE LEDGER block (in body)
 *   - Retrieval spine (consistent across all pages)
 */

import { defineConfig } from "vite";
import AIVISSitemapCompiler from "./vite-aivis-sitemap-compiler.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => ({
  plugins: [
    // Entity graph compiler - injects schema into every page
    AIVISSitemapCompiler({
      url: "https://aivis.biz",
      org: "AiVIS",
      routesPath: "./routes.json",
    }),
  ],

  root: "./",
  publicDir: "public",

  build: {
    // Build generated pages
    outDir: "dist",
    emptyOutDir: true,

    // Static framework-agnostic output
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "[name].js",
        assetFileNames: "[name].[ext]",
      },
    },

    // Minification + compression
    minify: "terser",
    terserOptions: {
      compress: true,
      mangle: true,
    },

    // Source maps for debugging
    sourcemap: mode !== "production",

    // Report compression
    reportCompressedSize: true,
  },

  // Server for local testing
  server: {
    host: true,
    port: 5173,
    strictPort: false,
    open: false,
  },

  preview: {
    host: true,
    port: 4173,
    strictPort: false,
  },
}));
