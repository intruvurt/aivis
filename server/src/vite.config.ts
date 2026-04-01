import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  server: {
    port: 3001,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, '.') },
    ],
  },
  build: {
    sourcemap: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // React core
          if (id.includes('node_modules/react-dom')) {
            return 'react-dom';
          }
          if (id.includes('node_modules/react/') || id.includes('node_modules/scheduler')) {
            return 'react';
          }
          // Router
          if (id.includes('node_modules/react-router')) {
            return 'router';
          }
          // Charts - split recharts which is large
          if (id.includes('node_modules/recharts')) {
            return 'recharts';
          }
          if (id.includes('node_modules/d3-') || id.includes('node_modules/victory')) {
            return 'chart-deps';
          }
          // PDF generation
          if (id.includes('node_modules/html2canvas')) {
            return 'html2canvas';
          }
          if (id.includes('node_modules/jspdf')) {
            return 'jspdf';
          }
          // State management
          if (id.includes('node_modules/zustand') || id.includes('node_modules/@tanstack')) {
            return 'state';
          }
          // Sentry - large monitoring lib
          if (id.includes('node_modules/@sentry')) {
            return 'sentry';
          }
          // UI utilities
          if (id.includes('node_modules/lucide-react')) {
            return 'icons';
          }
          // Other large vendor chunks
          if (id.includes('node_modules/')) {
            return 'vendor';
          }
        },
      },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'recharts'],
  },
});