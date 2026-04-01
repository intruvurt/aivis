/* global process */
/**
 * Puppeteer config — pins Chrome cache to a predictable path on Render.
 * Render's home dir is /opt/render, so we use /opt/render/.cache/puppeteer
 * which matches what the error message says is already being used.
 * The build command runs `npx puppeteer browsers install chrome` to populate it.
 */
const { join } = require('path');

/** @type {import("puppeteer").Configuration} */
module.exports = {
  cacheDirectory: process.env.PUPPETEER_CACHE_DIR || join(require('os').homedir(), '.cache', 'puppeteer'),
};
