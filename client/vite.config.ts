import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import compression from "vite-plugin-compression";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateHomepageContract } from "./src/homepage/homepage.validate";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Homepage Enforcement Plugin — hard build stop on contract drift.
 * Runs validateHomepageContract() at buildStart. If any check fails,
 * the build exits immediately with the violation details.
 */
function homepageEnforcementPlugin(): Plugin {
  return {
    name: "homepage-enforcement",
    buildStart() {
      const errors = validateHomepageContract();
      if (errors.length > 0) {
        const details = errors.map((e) => `  ✗ ${e.code}: ${e.message}`).join("\n");
        throw new Error(
          `\n[Homepage Enforcement] Contract validation failed (${errors.length} error${errors.length > 1 ? "s" : ""}):\n${details}\n\nFix the contract violations in client/src/homepage/ before building.\n`
        );
      }
      console.log("[Homepage Enforcement] ✓ Contract validated — zero drift");
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [
    homepageEnforcementPlugin(),
    react(),
    // Gzip pre-compression for static hosting (Cloudflare, Vercel serve .gz automatically)
    ...(mode === "production"
      ? [
        compression({ algorithm: "gzip", threshold: 1024 }),
        compression({ algorithm: "brotliCompress", ext: ".br", threshold: 1024 }),
      ]
      : []),
  ],

  server: {
    host: true,
    port: 3001,
    strictPort: true,
    proxy: {
      "/api": {
        target: "https://api.aivis.biz",
        changeOrigin: true,
        secure: false
      }
    }
  },

  preview: {
    host: true,
    port: 4173,
    strictPort: true
  },

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "../shared")
    }
  },

  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: mode !== "production",
    chunkSizeWarningLimit: 550,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          // Consolidate all react-dom subpath exports into one chunk
          if (id.includes("/react-dom")) return "react-dom";
          if (id.includes("/react-router/") || id.includes("/react-router-dom/")) return "router";
          if (id.includes("/framer-motion/")) return "motion";
          if (id.includes("/recharts/")) return "recharts";
          if (id.includes("/d3-") || id.includes("/victory")) return "chart-deps";
          if (id.includes("/zustand/") || id.includes("/@tanstack/")) return "state";
          if (id.includes("/lucide-react/")) return "icons";
          if (id.includes("/@sentry/")) return "sentry";
          if (id.includes("/i18next/") || id.includes("/react-i18next/")) return "i18n";
          // Consolidate react core (react, scheduler) into one chunk
          if (id.includes("/react/") || id.includes("/scheduler/")) return "react-core";

          return "vendor";
        }
      }
    }
  },

  optimizeDeps: {
    include: ["react", "react-dom", "react-router-dom", "recharts"]
  }
}));
