import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    setupFiles: ['./vitest.setup.ts'],
    env: {
      JWT_SECRET: 'vitest-test-secret-do-not-use-in-production',
      NODE_ENV: 'test',
    },
  },
});
