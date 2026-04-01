import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      "@": path.resolve(projectRoot, "src"),
      // Use this ONLY if you intentionally want css imports mocked during tests.
      // Vitest already handles CSS reasonably in jsdom, so most projects do not need this.
      // If you keep it, make sure __mocks__/styleMock.ts exists.
      "\\.css$": path.resolve(__dirname, "__mocks__/styleMock.ts"),
    },
  },

  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: [path.resolve(__dirname, "vitest.setup.ts")],

    // keep server tests out of the client runner
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.{idea,git,cache,output,temp}/**",
      "server/tests/**",
    ],

    // avoid weird multi-run when CI / watch
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,

    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      reportsDirectory: path.resolve(__dirname, "coverage"),
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "**/*.config.{js,ts,mjs,cjs}",
        "**/*.d.ts",
        "**/__tests__/**",
        "**/__mocks__/**",
        "**/coverage/**",
        "server/**",
      ],
    },
  },
});
