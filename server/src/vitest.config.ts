import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react() as any],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'server/tests/**',  // Exclude legacy test folder
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.config.{js,ts}',
        '**/*.d.ts',
        '__tests__/',
      ],
    },
  },
  resolve: {
    alias: [
      { find: /\.css$/, replacement: './__mocks__/styleMock.ts' },
      { find: '@', replacement: path.resolve(__dirname, 'src') },
    ],
  },
});