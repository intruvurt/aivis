/**
 * Restructure index.html for Lighthouse performance:
 * 1. Move JSON-LD from <head> to <body> (faster FCP)
 * 2. Defer gtag inline config
 * 3. Add Google Fonts as non-render-blocking <link> (replaces CSS @import)
 * 4. Move recaptcha from head to body
 */
import fs from 'fs';

let html = fs.readFileSync('./client/index.html', 'utf8');

// 1. Move JSON-LD blocks from <head> to <body>
const jsonLdStartMarker = '    <!-- Core entities:';
const headEndStr = '\r\n\r\n  </head>';
const jsonLdStart = html.indexOf(jsonLdStartMarker);
const headEnd = html.indexOf(headEndStr);

if (jsonLdStart === -1 || headEnd === -1) {
  console.error('Could not find JSON-LD boundaries:', jsonLdStart, headEnd);
  process.exit(1);
}

const jsonLdSection = html.substring(jsonLdStart, headEnd);
console.log('JSON-LD section length:', jsonLdSection.length, 'chars');

// Remove JSON-LD from head
html = html.substring(0, jsonLdStart) + html.substring(headEnd);

// Insert JSON-LD before </body>
html = html.replace(
  '  </body>',
  '\n    <!-- Structured data (JSON-LD) \u2014 moved to body for faster first contentful paint -->\n' + jsonLdSection + '\n  </body>'
);

// 2. Minify gtag inline - keep dataLayer + gtag function def in head (tiny, needed early)
// Move the config call to body
html = html.replace(
  `    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag("js", new Date());
      gtag("config", "G-B4WM53183L");
    </script>`,
  '    <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}</script>'
);

// Add the gtag config call at end of body (deferred)
html = html.replace(
  '    <script type="module" src="/src/main.tsx"></script>',
  '    <script>if(window.gtag){gtag("js",new Date());gtag("config","G-B4WM53183L")}</script>\n    <script type="module" src="/src/main.tsx"></script>'
);

// 3. Add Google Fonts <link> tags (non-render-blocking) + preconnect
const fontUrl = 'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Caveat:wght@400;600;700&family=Inter:wght@300;400;500;600;700&family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap';

const fontLinks = `
    <!-- Google Fonts (non-render-blocking, replaces CSS @import) -->
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="${fontUrl}" media="print" onload="this.media='all'" />
    <noscript><link rel="stylesheet" href="${fontUrl}" /></noscript>`;

html = html.replace(
  '    <link rel="dns-prefetch" href="https://www.google.com" />',
  '    <link rel="dns-prefetch" href="https://www.google.com" />' + fontLinks
);

// 4. Move recaptcha from head to body
const recaptchaBlock = `    <script>
      window.__AIVIS_RECAPTCHA_SITE_KEY = "6LdNwIgsAAAAAMyezxlfxM4jvpqIrApXKf8YQHr8";
    </script>
    <script
      src="https://www.google.com/recaptcha/api.js?render=6LdNwIgsAAAAAMyezxlfxM4jvpqIrApXKf8YQHr8"
      async
      defer
    ></script>`;

html = html.replace(recaptchaBlock, '');

// Add recaptcha at end of body (deferred)
html = html.replace(
  '  </body>',
  '    <script>window.__AIVIS_RECAPTCHA_SITE_KEY="6LdNwIgsAAAAAMyezxlfxM4jvpqIrApXKf8YQHr8"</script>\n    <script src="https://www.google.com/recaptcha/api.js?render=6LdNwIgsAAAAAMyezxlfxM4jvpqIrApXKf8YQHr8" async defer></script>\n  </body>'
);

fs.writeFileSync('./client/index.html', html);
console.log('index.html restructured successfully');
console.log('New file size:', html.length, 'chars');
console.log('Lines:', html.split('\n').length);
