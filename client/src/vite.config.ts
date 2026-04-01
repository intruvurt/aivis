import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  // In Render, this is already /opt/render/project/src/client when you run in the client folder.
  // Keep it explicit anyway.
  const root = process.cwd();
  const env = loadEnv(mode, root, "VITE_");

  const apiUrl = (env.VITE_API_URL || "https://api.aivis.biz").replace(/\/$/, "");

  return {
    // IMPORTANT: if you serve at the domain root (https://aivis.biz), keep "/"
    // If you serve under a subpath (https://domain.com/aivis/), set base: "/aivis/"
    base: env.VITE_BASE_PATH || "/",

    plugins: [react()],

    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@components": path.resolve(__dirname, "./src/components"),
        "@context": path.resolve(__dirname, "./src/context"),
        "@constants": path.resolve(__dirname, "./src/constants"),
        "@views": path.resolve(__dirname, "./src/views"),
        "@pages": path.resolve(__dirname, "./src/pages"),
        "@hooks": path.resolve(__dirname, "./src/hooks"),
        "@utils": path.resolve(__dirname, "./src/utils"),
        "@stores": path.resolve(__dirname, "./src/stores"),
        "@types": path.resolve(__dirname, "./src/types"),
      },
    },

    build: {
      outDir: "dist",
      sourcemap: true, // helps you actually see production errors
    },

    server: {
      host: true,
      port: Number(env.VITE_PORT) || 5173,
      strictPort: false,

      // DEV ONLY. This never exists in production.
      proxy: {
        "/api": {
          target: apiUrl,
          changeOrigin: true,
          secure: true,
          rewrite: (p) => p.replace(/^\/api/, ""),
        },
      },
    },

    // Optional: makes it harder to "silently fail"
    define: {
      __APP_ENV__: JSON.stringify(mode),
    },
  };
});