Here is the corrected post ready to paste directly into SO:

Title: React 19 + Vite 7 production build crashes with "Cannot access 'lt' before initialization" - how to trace minified variable back to source

Body:

I have a React 19 + Vite 7 + TypeScript app that works perfectly in development but crashes immediately when I build for production and serve it.

After a successful build I preview the output using these two commands:

bash

npm run build
npx vite preview --port 4173
```

Opening the app in the browser immediately shows this error in the console:
```
Uncaught ReferenceError: Cannot access 'lt' before initialization

The React error boundary catches it and displays "Something went wrong." The variable lt does not exist anywhere in my source code so it must be a minified name created by the bundler.

Environment

React 19.1

Vite 7.3.1

TypeScript, strict mode

esbuild minification

~60 eagerly imported page components in App.tsx

What I have already ruled out

Circular dependencies - running madge --circular across 300+ files shows zero cycles. All Zustand store files import cleanly. Barrel re-exports are simple pass-throughs with no logic.

TypeScript errors - tsc --noEmit passes with zero errors.

Build errors - the Vite build completes successfully. The only warnings are chunk size notices.

Dev mode - the app runs perfectly with HMR. The crash is production-only.

Vite config

The relevant section of my vite.config.ts uses manual chunk splitting:

ts

build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'react-dom': ['react-dom'],
        'router':    ['react-router-dom'],
        'recharts':  ['recharts'],
        'state':     ['zustand'],
        'icons':     ['lucide-react'],
      },
    },
  },
},

What I need

How do I trace a minified variable name like lt back to the original source symbol that is causing the initialization error?

Specifically:

How do I use the Vite or Rollup source map to identify which original variable lt corresponds to?

Is there a way to build with minification disabled but chunking preserved so the error message becomes readable?

Can the manualChunks configuration cause a temporal dead zone violation by splitting a module from its dependencies across chunk boundaries - and if so what is the correct fix?