This is a Temporal Dead Zone (TDZ) bug that only appears in production because Rollup concatenates and hoists code differently than Vite's dev server. The variable lt is Rollup's minified name for one of your source variables.

Step 1: Confirm it is a build issue not a deployment issue
bashnpm run build
npx vite preview --port 4173
If the crash reproduces locally this rules out CDN caching, environment variables, and server config.

Step 2: Find the real variable name behind lt
Option A — Disable minification (fastest)
Add this to vite.config.ts temporarily:
tsbuild: {
  minify: false,
}
```

Rebuild and serve. The error now shows the real variable name:
```
Cannot access 'refreshServerHistory' before initialization
Option B — Use source maps
tsbuild: {
  sourcemap: true,
}
Then run this script to map every occurrence of lt back to its original source:
jsconst { SourceMapConsumer } = require('source-map');
const fs = require('fs');

async function trace() {
  const raw = fs.readFileSync('dist/assets/index-XXXX.js.map', 'utf8');
  const consumer = await new SourceMapConsumer(JSON.parse(raw));
  const src = fs.readFileSync('dist/assets/index-XXXX.js', 'utf8');
  const lines = src.split('\n');

  for (let i = 0; i < lines.length; i++) {
    let idx = -1;
    while ((idx = lines[i].indexOf('lt', idx + 1)) !== -1) {
      const orig = consumer.originalPositionFor({ line: i + 1, column: idx });
      if (orig.name && orig.name !== 'lt') {
        console.log(`line:${i + 1} col:${idx} -> ${orig.name} in ${orig.source}:${orig.line}`);
      }
    }
  }
}
trace();

Step 3: The root cause
Once you disable minification the real error becomes clear. The pattern looks like this inside a large component:
tsx// Declared FIRST — line ~2256
const handleClearAuditView = useCallback(() => {
  void refreshServerHistory(); // references refreshServerHistory
}, [refreshServerHistory]);    // dependency array evaluates EAGERLY during render

// ... 150 lines of other hooks ...

// Declared SECOND — line ~2400
const refreshServerHistory = useCallback(async () => {
  // ...
}, [isAuthenticated, token]);
handleClearAuditView is declared 150 lines above refreshServerHistory but its dependency array [refreshServerHistory] evaluates immediately during the render pass. At that point refreshServerHistory has not been initialized yet. TDZ violation.

Step 4: Why this only crashes in production
In dev mode Vite serves each module individually using native ESM. The TDZ is not triggered because Vite does not do the same module concatenation as Rollup.
In production Rollup concatenates modules into chunks and esbuild minifies them. Variable declarations get hoisted into a single scope and const TDZ semantics are enforced strictly. Accessing refreshServerHistory before its declaration in the concatenated output throws the ReferenceError.
The critical misconception: useCallback dependency arrays evaluate eagerly during render, not lazily when the callback is called. Even though the body of handleClearAuditView only runs on click, the dependency array [refreshServerHistory] evaluates immediately during the component render pass.

Step 5: The fix
Move the referenced callback above the callback that references it. Declaration order change only — no logic changes, no new dependencies, no Rollup config changes:
tsx// refreshServerHistory declared FIRST
const refreshServerHistory = useCallback(async () => {
  if (!isAuthenticated) return;
  try {
    setTrendRefreshing(true);
    const payload = await fetchJson(`${API_URL}/api/analytics?range=90d`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (payload?.success && payload?.data?.score_history) {
      setServerHistory(
        payload.data.score_history.map((point) => ({
          date: point.date,
          isoDate: point.date,
          visibility: point.score,
          url: point.url,
        }))
      );
      setServerAuditCount(payload.data.summary?.total_audits ?? 0);
    }
  } catch {
    // non-fatal
  } finally {
    setTrendRefreshing(false);
  }
}, [isAuthenticated, token]);

// handleClearAuditView declared AFTER — safe to reference refreshServerHistory
const handleClearAuditView = useCallback(() => {
  setData(null);
  setAuditUrl('');
  setError(null);
  useAnalysisStore.getState().setResult(null);
  void refreshServerHistory();
}, [refreshServerHistory]);

Why your existing checks missed this
CheckWhy it missed the bugmadge --circularAnalyzes file-level imports. This bug is declaration order within a single file.tsc --noEmitTypeScript does not validate runtime evaluation order of const in the same scope.Dev mode worksVite dev server does not concatenate modules. TDZ is not enforced the same way.

Prevention
Order hooks by dependency. If callback A references callback B, declare B first. In components over 500 lines this is easy to lose track of.
Add the no-use-before-define ESLint rule:
js'no-use-before-define': ['error', {
  functions: false,
  classes: true,
  variables: true,
  allowNamedExports: false,
}]
This catches const references before declaration at lint time before they reach production.
Test production builds in CI. Add vite build && vite preview to your pipeline. Dev mode and production have fundamentally different behavior around module concatenation, scope hoisting, and TDZ enforcement.

The minified variable name is a red herring. Disable minification, read the real error, fix the declaration order.