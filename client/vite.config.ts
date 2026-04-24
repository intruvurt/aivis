import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import compression from "vite-plugin-compression";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateHomepageContract } from "./src/homepage/homepage.validate";
import { validateJsonLdArray, isAllValid, formatValidationErrors } from "./src/lib/jsonLdValidator";
import { queryRouteValidationPlugin } from "./src/build/queryRouteValidation";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function homepageEnforcementPlugin(): Plugin {
  return {
    name: "homepage-enforcement",
    buildStart() {
      const errors = validateHomepageContract();
      if (errors.length > 0) {
        const details = errors.map((e) => `  ✗ ${e.code}: ${e.message}`).join("\n");
        throw new Error(
          `\n[Homepage Enforcement] Contract validation failed:\n${details}\n`
        );
      }
    },
  };
}

function jsonLdValidationPlugin(): Plugin {
  return {
    name: "json-ld-validation",
    async buildStart() {
      const homepageSchema = await import("./src/homepage/homepage.schema");
      const schemas = homepageSchema.generateHomepageStructuredData();

      const results = validateJsonLdArray(schemas);

      if (!isAllValid(results)) {
        const failures = results.filter((r) => !r.isValid);

        const errorDetails = failures
          .map((f) =>
            `[@type: ${f.schema}]\n${formatValidationErrors([f])
              .split("\n")
              .map((l) => "  " + l)
              .join("\n")}`
          )
          .join("\n");

        throw new Error(
          `\n[JSON-LD Validation] Failed:\n${errorDetails}\n`
        );
      }
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [
    homepageEnforcementPlugin(),
    jsonLdValidationPlugin(),
    queryRouteValidationPlugin(),
    react(),
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
        secure: false,
      },
    },
  },

  preview: {
    host: true,
    port: 4173,
    strictPort: true,
  },

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "../shared"),
    },
    preserveSymlinks: false,
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

          if (id.includes("/react-dom")) return "react-dom";
          if (id.includes("/react-router")) return "router";
          if (id.includes("framer-motion")) return "motion";
          if (id.includes("recharts")) return "recharts";
          if (id.includes("zustand") || id.includes("@tanstack")) return "state";
          if (id.includes("lucide-react")) return "icons";
          if (id.includes("date-fns")) return "date-fns";
          if (id.includes("react")) return "react";
          if (id.includes("lodash")) return "lodash";
          if (id.includes("axios")) return "axios";


          return "vendor";
        },
      },
    },
  },

  optimizeDeps: {
    include: ["react", "react-dom", "react-router-dom", "recharts"],
  },
}));