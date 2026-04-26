const plugins = [require('tailwindcss')];

try {
  const autoprefixer = require('autoprefixer');
  // Validate plugin init now so missing caniuse-lite internals fail closed.
  plugins.push(autoprefixer());
} catch (err) {
  // Keep production builds running when npm installs are partially corrupted.
  // This degrades vendor prefixing but avoids hard build failure.
  // eslint-disable-next-line no-console
  console.warn('[postcss] autoprefixer unavailable, continuing without it:', err?.message || err);
}

module.exports = {
  plugins,
};
