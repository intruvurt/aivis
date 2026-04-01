import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
<<<<<<< Updated upstream
<<<<<<<< Updated upstream:server/src/index.tsx
<<<<<<< Updated upstream
import App from './App';
import './src/index.css';
=======
import App from './app/App';
import './app/index.css';
>>>>>>> Stashed changes
========
import App from './App';
import './src/index.css';
>>>>>>>> Stashed changes:index.tsx
=======
import App from './app/App';
import './app/index.css';
>>>>>>> Stashed changes
// Types imported for potential future use


// Initialize Sentry for client-side error tracking
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE || 'development',
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    tracesSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
      <App />
    </Sentry.ErrorBoundary>
  </React.StrictMode>
);

function ErrorFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Something went wrong</h1>
        <p className="text-slate-600 mb-6">
          We&apos;ve been notified and are working on a fix. Please try refreshing the page.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
        >
          Refresh Page
        </button>
      </div>
    </div>
  );
}