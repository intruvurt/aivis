# SO Post: "Cannot access 'lt' before initialization" — React + Vite Production Build

**Platform:** Stack Overflow  
**Author:** intruvurt  
**Tags:** `reactjs` `vite` `rollup` `temporal-dead-zone` `production-build`

---

> **How to post:** Copy the QUESTION block into the SO question body. Post it. Then copy the ANSWER block and post it as your own answer.

---

<!-- ═══════════════════════════════════════════════════════════════════ -->
<!-- QUESTION — paste this into the SO question body                    -->
<!-- Title: React app crashes in production build with "Cannot access   -->
<!--         'lt' before initialization" — works perfectly in dev       -->
<!-- ═══════════════════════════════════════════════════════════════════ -->

## QUESTION

I have a React 19 + Vite 7 + TypeScript app that works perfectly in development but crashes immediately when I build for production and serve it.

After running the build and previewing the output:

```
npm run build
npx vite preview --port 4173
```

The browser console shows this error on first load:

```
Uncaught ReferenceError: Cannot access 'lt' before initialization
```

The React error boundary catches it and displays "Something went wrong." The variable "lt" does not exist anywhere in my source code so it must be a minified name created by the bundler.

I have already ruled out circular dependencies. Running madge with the circular flag on the entire src directory shows zero cycles across 300+ files. All Zustand store files import cleanly. Barrel file re-exports are simple pass-throughs with no cycles. TypeScript strict mode with tsc --noEmit passes with zero errors. The Vite build itself completes successfully with no warnings other than chunk size.

The app works perfectly in dev mode with hot reload. The crash only happens in the production build.

My Vite config uses manual chunk splitting:

```js
// vite.config.ts (relevant section)
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'react-dom': ['react-dom'],
        'router': ['react-router-dom'],
        'recharts': ['recharts'],
        'state': ['zustand'],
        'icons': ['lucide-react'],
      },
    },
  },
},
```

Environment: React 19.1, Vite 7.3.1, esbuild minification, roughly 60 eagerly imported page components in the main App.tsx.

This is a production outage. How do I trace a minified variable name like "lt" back to the original source variable that is causing the crash?

<!-- ═══════════════════════════════════════════════════════════════════ -->
<!-- ANSWER — post this as your answer after the question is live       -->
<!-- ═══════════════════════════════════════════════════════════════════ -->

## ANSWER

This is a **Temporal Dead Zone (TDZ)** bug that only manifests in production because Rollup reorders and hoists code differently than Vite's dev server (which uses native ESM with on-demand compilation). The variable `lt` is Rollup's minified name for one of your source variables.

Here is the full debugging technique and root cause.

## Step 1: Reproduce locally

Build and serve the production bundle:

    npm run build
    npx vite preview --port 4173

Open `http://localhost:4173`. If you see the crash, you've confirmed it's a build-time issue, not a deployment issue. This rules out CDN caching, environment variables, and server config.

## Step 2: Identify the real variable name

The key insight: **`lt` is a minified name.** You need to find what it maps to in your source.

**Option A — Disable minification (fastest)**

In `vite.config.ts`, temporarily set:

```js
// vite.config.ts
export default defineConfig({
  build: {
    minify: false,
  },
});
```

Rebuild and serve. The error message will now show the **real variable name**:

    Cannot access 'refreshServerHistory' before initialization

Now you know exactly which variable and can grep for it.

**Option B — Use sourcemaps (if you can't disable minification)**

```js
// vite.config.ts
export default defineConfig({
  build: {
    sourcemap: true,
  },
});
```

Rebuild, then use this Node.js script to parse the sourcemap:

```js
// trace-minified.cjs
const { SourceMapConsumer } = require("source-map");
const fs = require("fs");

async function trace() {
  const raw = fs.readFileSync("dist/assets/index-XXXX.js.map", "utf8");
  const consumer = await new SourceMapConsumer(JSON.parse(raw));
  const src = fs.readFileSync("dist/assets/index-XXXX.js", "utf8");
  const lines = src.split("\n");

  for (let i = 0; i < lines.length; i++) {
    let idx = -1;
    while ((idx = lines[i].indexOf("lt", idx + 1)) !== -1) {
      const orig = consumer.originalPositionFor({
        line: i + 1,
        column: idx,
      });
      if (orig.name && orig.name !== "lt") {
        console.log(
          `line:${i + 1} col:${idx} -> ${orig.name} in ${orig.source}:${orig.line}`
        );
      }
    }
  }
}
trace();
```

This maps every occurrence of `lt` back to its original source name and file.

## Step 3: Find the TDZ violation

In my case, the real error was:

    Cannot access 'refreshServerHistory' before initialization

The code looked like this inside a large React component (~3500 lines):

```tsx
// Line ~2256 — declared FIRST
const handleClearAuditView = useCallback(() => {
  setData(null);
  setAuditUrl("");
  setError(null);
  useAnalysisStore.getState().setResult(null);
  void refreshServerHistory();       // ← references refreshServerHistory
}, [refreshServerHistory]);          // ← dep array evaluates EAGERLY during render

// ... ~150 lines of other hooks, effects, memos ...

// Line ~2400 — declared SECOND
const refreshServerHistory = useCallback(async () => {
  if (!isAuthenticated) return;
  try {
    setTrendRefreshing(true);
    const payload = await fetchJson(`${API_URL}/api/analytics?range=90d`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (payload?.success && payload?.data?.score_history) {
      setServerHistory(payload.data.score_history.map((point) => ({
        date: point.date,
        isoDate: point.date,
        visibility: point.score,
        url: point.url,
      })));
      setServerAuditCount(payload.data.summary?.total_audits ?? 0);
    }
  } catch {
    // non-fatal
  } finally {
    setTrendRefreshing(false);
  }
}, [isAuthenticated, token]);
```

`handleClearAuditView` is declared 150 lines above `refreshServerHistory`, but its dependency array `[refreshServerHistory]` evaluates immediately during the render pass. At that point, `refreshServerHistory` has not been initialized yet. **TDZ violation.**

## Step 4: Why this only crashes in production

This is the part that confuses everyone.

**In dev mode:** Vite uses native ESM and serves each module individually. The dependency array `[refreshServerHistory]` is evaluated during render, but Vite's dev server doesn't do the same module concatenation as Rollup, so the TDZ isn't triggered.

**In production:** Rollup concatenates modules into chunks and esbuild minifies them. The variable declarations get hoisted into a single scope. Now `const refreshServerHistory` (minified to `lt`) has real TDZ semantics enforced — accessing it before its declaration in the concatenated output throws a `ReferenceError`.

The key misconception: **`useCallback` dependency arrays evaluate eagerly during render, not lazily when called.** So even though the _body_ of `handleClearAuditView` would only run on click (by which time `refreshServerHistory` exists), the dependency array `[refreshServerHistory]` evaluates **immediately** during the component render pass.

## Step 5: The fix

Move the referenced callback **above** the callback that references it:

```tsx
// refreshServerHistory declared FIRST
const refreshServerHistory = useCallback(async () => {
  if (!isAuthenticated) return;
  try {
    setTrendRefreshing(true);
    const payload = await fetchJson(`${API_URL}/api/analytics?range=90d`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (payload?.success && payload?.data?.score_history) {
      setServerHistory(payload.data.score_history.map((point) => ({
        date: point.date,
        isoDate: point.date,
        visibility: point.score,
        url: point.url,
      })));
      setServerAuditCount(payload.data.summary?.total_audits ?? 0);
    }
  } catch {
    // non-fatal
  } finally {
    setTrendRefreshing(false);
  }
}, [isAuthenticated, token]);

useEffect(() => {
  void refreshServerHistory();
}, [refreshServerHistory]);

// handleClearAuditView declared AFTER — safe to reference refreshServerHistory
const handleClearAuditView = useCallback(() => {
  setData(null);
  setAuditUrl("");
  setError(null);
  useAnalysisStore.getState().setResult(null);
  void refreshServerHistory();
}, [refreshServerHistory]);
```

The fix is a **declaration order change**. No code logic changes. No new dependencies. No Rollup config changes.

## Why madge --circular didn't catch this

`madge` analyzes **file-level imports** for circular dependencies. This bug is a **declaration order issue within a single file**. Both callbacks live in the same component. No tool that analyzes the module graph will find this because the module graph is fine.

The bug is in the **evaluation order of `const` declarations within one component's render body.**

## Prevention

**1. Order hooks by dependency.** If callback A references callback B, declare B first.

**2. Use ESLint rule `no-use-before-define`:**

```js
rules: {
  "no-use-before-define": ["error", {
    functions: false,
    classes: true,
    variables: true,
    allowNamedExports: false,
  }],
}
```

This catches `const` references before declaration at lint time.

**3. Test production builds in CI.** Add `vite build && vite preview` to your CI pipeline. Dev mode behavior is fundamentally different from production on module concatenation, scope hoisting, and TDZ enforcement.

**4. When debugging minified errors, always disable minification first.** Adding `minify: false` to your Vite build config is the fastest way to unmask any minified variable name.

## Summary

| Symptom | Root cause |
| --- | --- |
| `Cannot access 'lt' before initialization` | TDZ violation — `const` callback referenced before its declaration |
| Only crashes in production build | Rollup module concatenation enforces TDZ; dev ESM serving does not |
| `madge --circular` finds nothing | Bug is declaration order within one file, not circular imports |
| `tsc --noEmit` passes | TypeScript does not validate runtime evaluation order of `const` in same scope |

The minified variable name is a red herring. Disable minification, read the real error, fix the declaration order.

This class of bug is increasingly common in large React components. `useCallback` and `useMemo` dependency arrays evaluate synchronously during render — they are subject to TDZ just like any other expression. In 2000+ line component files, these ordering bugs can be 150+ lines apart, making them nearly impossible to spot in review. The combination of "works in dev" + "passes typecheck" + "no circular deps" makes this an extremely frustrating class of production-only crash.

**The `minify: false` technique is your fastest path to diagnosis.** It turns a cryptic minified symbol into a clear variable name in under 30 seconds.
