/* global module */
/**
 * PM2 ecosystem config
 * - dev vs prod environments
 * - sane restarts + logs
 * - no watch in production (watch can thrash + leak secrets via file events)
 *
 * Usage:
 *   pm2 start ecosystem.config.cjs --env production
 *   pm2 start ecosystem.config.cjs --env development
 */

module.exports = {
  apps: [
    {
      name: "aivis-server",
      cwd: "./server",

      // Prefer a real prod entrypoint, not "npm run dev"
      // If your server supports: npm run start
      // If not, set script to your compiled entry (dist/server.js) and build first.
      script: "npm",
      args: "run start",

      exec_mode: "fork",
      instances: 1,

      // Reliability
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      restart_delay: 1500,
      kill_timeout: 8000,

      // Resource safety
      max_memory_restart: "700M",

      // Logging
      time: true,
      merge_logs: true,
      out_file: "./logs/server.out.log",
      error_file: "./logs/server.err.log",

      // IMPORTANT: watch only in development
      watch: false,
      watch_delay: 500,

      env: {
        NODE_ENV: "development",
        VITE_ENV: "development",
      },

      env_production: {
        NODE_ENV: "production",
        VITE_ENV: "production",
      },
    },

    {
      name: "aivis-client",
      cwd: "./client",

      /**
       * Production note:
       * You usually don't run Vite dev server under PM2 in production.
       * You either:
       * 1) build static and serve via nginx/vercel, or
       * 2) run a static server (serve) if you insist on Node hosting.
       *
       * This assumes you have "start" configured to serve built files.
       */
      script: "npm",
      args: "run start",

      exec_mode: "fork",
      instances: 1,

      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      restart_delay: 1500,
      kill_timeout: 8000,
      max_memory_restart: "500M",

      time: true,
      merge_logs: true,
      out_file: "./logs/client.out.log",
      error_file: "./logs/client.err.log",

      watch: false,

      env: {
        NODE_ENV: "development",
        VITE_ENV: "development",
      },

      env_production: {
        NODE_ENV: "production",
        VITE_ENV: "production",
      },
    },
  ],
};
