import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => ({
  plugins: [react()],

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

          if (id.includes("/react-dom/")) return "react-dom";
          if (id.includes("/react-router/") || id.includes("/react-router-dom/")) return "router";
          if (id.includes("/framer-motion/")) return "motion";
          if (id.includes("/recharts/")) return "recharts";
          if (id.includes("/d3-") || id.includes("/victory")) return "chart-deps";
          if (id.includes("/zustand/") || id.includes("/@tanstack/")) return "state";
          if (id.includes("/lucide-react/")) return "icons";
          if (id.includes("/@sentry/")) return "sentry";
          if (id.includes("/i18next/") || id.includes("/react-i18next/")) return "i18n";

          // Everything else (react, scheduler, etc.) in vendor to avoid circular chunks
          return "vendor";
        }
      }
    }
  },

  optimizeDeps: {
    include: ["react", "react-dom", "react-router-dom", "recharts"]
  }
}));
